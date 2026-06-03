# DevBrain 生产 IP 最小化部署手册

本文档面向 P0 功能闭环已经完成、VPS 已购买、但前期暂不购买域名和暂不接入监控的状态。当前目标是用公网 IP 先跑通真实朋友试用闭环：镜像仍由 GitHub Actions 构建并推送到 GHCR，VPS 只 `docker compose pull` GHCR 镜像，不在 VPS 上构建 Next.js / NestJS / Worker。

阅读顺序：先看第 0 节确认当前部署边界，再完成第 1 节前置补齐，最后按第 2 节开始执行。第 1 节不满足时不要继续上线。

---

## 0. 当前部署边界

当前采用“HTTP + 公网 IP”的试用阶段部署：

- 暂不买域名，浏览器访问 `http://<vps-ip>/`。
- 暂不申请 TLS 证书，Caddy 只监听 `:80`。
- 暂不接入 Sentry、Langfuse、Better Stack。
- 暂不把 `/healthz`、`/readyz`、数据库连通性探活作为上线门槛。
- 仍然使用 GHCR 镜像、Docker Compose、Caddy、Postgres、Redis、Worker。
- 仍然使用真实 DashScope embedding / rerank / Qwen-Plus 做端到端冒烟。
- 暂不启动自动 backup 服务；试用阶段仅用于非私密数据，完整生产模式前必须补齐备份和 restore-test。

当前临时例外：

| 项目                 | 试用阶段配置                       | 恢复完整生产模式时                         |
| -------------------- | ---------------------------------- | ------------------------------------------ |
| 访问入口             | `http://<vps-ip>/`                 | `https://<your-domain>/`                   |
| Caddy 站点           | `:80`                              | `{$DEVBRAIN_DOMAIN}`                       |
| `AUTH_COOKIE_SECURE` | `false`                            | `true`                                     |
| `CORS_ORIGIN`        | `http://<vps-ip>`                  | `https://<your-domain>`                    |
| `DEVBRAIN_DOMAIN`    | 不需要配置                         | 配置为真实域名                             |
| Sentry               | 不配置 `SENTRY_DSN`                | 配置 DSN 并验证测试事件                    |
| Langfuse             | 不配置 `LANGFUSE_*`                | 配置 key 并验证 trace                      |
| Better Stack         | 不配置 `BETTERSTACK_HEARTBEAT_URL` | 配置心跳和 Uptime                          |
| 对象存储             | local adapter + 共享持久化 volume  | 切到 R2 presigned PUT 并 smoke             |
| 自动备份             | 不作为最小上线门槛                 | 补齐 backup service、R2 上传、restore-test |
| 健康检测             | 不作为上线门槛                     | 验证 `/healthz`、`/readyz`、HTTPS 证书     |

安全边界：

- HTTP + `AUTH_COOKIE_SECURE=false` 只允许本人和少量朋友试用，不允许上传真实私密文档。
- Argon2id 参数、refresh token rotation、refresh token hash、权限校验不得降级。
- Postgres、Redis、API、Web 不应直接暴露公网；公网入口只允许 Caddy 的 80 端口。
- `.env` 只存在于 VPS，永不提交到 git。

---

## 1. 前置补齐清单

### 1.1 Dockerfile 与镜像构建

仓库必须已经包含并验证三个应用镜像：

- `apps/api/Dockerfile`：生产镜像可运行 API，也可被 `migrate` 服务复用执行 `prisma migrate deploy`。
- `apps/worker/Dockerfile`：生产镜像可运行文档处理 Worker。
- `apps/web/Dockerfile`：生产镜像使用 Next.js standalone 输出，运行时执行 `node server.js`。

开发机验收：

```bash
docker buildx build -f apps/api/Dockerfile -t devbrain/api:test .
docker buildx build -f apps/worker/Dockerfile -t devbrain/worker:test .
docker buildx build -f apps/web/Dockerfile -t devbrain/web:test .
docker compose --env-file .env config
docker compose up -d postgres redis
docker compose run --rm migrate
```

### 1.2 GitHub Actions 推送 GHCR

需要有 `.github/workflows/build-and-push.yml`，触发条件至少包含 `push: branches: [main]` 和 `workflow_dispatch`。

每次构建至少产出四个镜像：

- `ghcr.io/<owner>/devbrain-api:sha-<sha>`
- `ghcr.io/<owner>/devbrain-web:sha-<sha>`
- `ghcr.io/<owner>/devbrain-worker:sha-<sha>`
- `ghcr.io/<owner>/devbrain-postgres:sha-<sha>`

验收标准：

- `main` 推送后 workflow 成功。
- GHCR 能看到四个 `sha-<full-sha>` tag。
- 本机登录 GHCR 后能 `docker pull ghcr.io/<owner>/devbrain-api:sha-<sha>`。

### 1.3 Compose 生产端口与环境变量收敛

上线前必须确认 `docker-compose.yml` 与 `docker-compose.prod.yml` 合并后的生产配置不会把内部服务暴露到公网。生产环境必须使用：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

`docker-compose.yml` 保留本地和生产共享的服务拓扑；`docker-compose.prod.yml` 负责删除应用和 Postgres 的 `build` 配置、启用 GHCR 镜像拉取策略，并补齐生产 Caddy 的 HTTPS 端口与可切换 Caddyfile mount。

端口要求：

- Postgres 只绑定 `127.0.0.1:${POSTGRES_PORT:-5432}:5432`。
- Redis 只绑定 `127.0.0.1:${REDIS_PORT:-6379}:6379`。
- API 不直接暴露公网；如需宿主机调试，只绑定 `127.0.0.1:${API_PORT:-3001}:3001`。
- Web 不直接暴露公网；如需宿主机调试，只绑定 `127.0.0.1:${WEB_PORT:-3000}:3000`。
- Caddy 是唯一公网入口。生产 override 可预置 443 映射；IP 试用阶段由 VPS 防火墙/安全组只开放 80，切到域名 HTTPS 后再开放 443。

环境变量要求：

- `api` 服务必须透传 `REFRESH_TOKEN_PEPPER`、`AUTH_COOKIE_SECURE`、`CORS_ORIGIN`、`AUTH_ACCESS_TOKEN_TTL_SECONDS`、`AUTH_REFRESH_TOKEN_TTL_SECONDS`。
- `api` 服务必须透传 `EMBEDDING_PROVIDER`、`RERANK_PROVIDER`、`LLM_PROVIDER`、`RERANK_MODEL`、`LLM_MODEL`、`RETRIEVAL_LOW_RELEVANCE_THRESHOLD`。
- `api` 和 `worker` 服务必须透传 `STORAGE_SIGNATURE_SECRET`、`DEV_STORAGE_ROOT`、`STORAGE_TOKEN_TTL_SECONDS`。
- `worker` 服务必须透传 `EMBEDDING_PROVIDER`、`EMBEDDING_MODEL`、`EMBEDDING_BATCH_SIZE`、`EMBEDDING_TIMEOUT_MS`。
- 试用阶段如果继续使用 local storage adapter，`api` 和 `worker` 必须挂载同一个持久化 volume 到同一个 `DEV_STORAGE_ROOT`，否则上传文件后 Worker 读不到对象。
- `backup` 服务在试用阶段不启动；恢复完整生产模式前再补齐 image/build、`/backups` volume、R2 配置和心跳。

验收标准：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

在 VPS 上，公网访问 `http://<vps-ip>:3001` 和 `http://<vps-ip>:3000` 不应成功；`http://<vps-ip>/` 应由 Caddy 转发。

### 1.4 Caddyfile：HTTP + IP

试用阶段 `infra/caddy/Caddyfile` 使用以下形状，不申请证书：

```caddy
:80 {
  encode zstd gzip

  @auth path /auth/*
  reverse_proxy @auth api:3001

  handle_path /api/* {
    reverse_proxy api:3001 {
      flush_interval -1
      transport http {
        read_timeout 5m
      }
    }
  }

  reverse_proxy /* web:3000
}
```

验收标准：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

恢复完整生产模式时，把 `:80` 改成 `{$DEVBRAIN_DOMAIN}`，并在 `.env` 中配置 `DEVBRAIN_DOMAIN=<your-domain>`。

### 1.5 Backup 暂缓项

试用阶段暂不把 backup 服务作为上线门槛。当前只允许上传非私密、可丢失的试用数据；如果要保存真实用户数据，必须先恢复本节能力。

恢复完整生产模式前必须补齐：

- `backup` 服务有可用 image 或 build 配置。
- `/backups` 有明确 volume，并能被备份容器写入。
- `infra/backup/backup.sh` 路径与容器入口一致。
- R2 上传配置可用。
- `BETTERSTACK_HEARTBEAT_URL` 为空时不影响手动备份；配置后仅在备份成功后打卡。
- `pg_dump` 失败时脚本必须非 0 退出。
- dump 文件能被 `pg_restore --list` 读取。
- 至少完成一次临时库 restore-test。

```bash
docker compose exec backup /backup.sh
docker compose exec backup ls -lh /backups
docker compose exec backup pg_restore --list /backups/devbrain_<date>.dump
```

---

## 2. GHCR 构建

开发机执行：

1. 确认第 1 节前置补齐已经合入 `main`。
2. 推送 `main` 或手动触发 `build-and-push` workflow。
3. 等待 workflow 成功，记录本次 commit SHA，后文记为 `<SHA>`。
4. 在 GHCR 页面确认 `devbrain-api`、`devbrain-web`、`devbrain-worker`、`devbrain-postgres` 四个镜像可被 VPS 拉取。
5. 为 VPS 创建只读 PAT，权限只需要 `read:packages`。

---

## 3. VPS 初始化

假设 VPS 为 Ubuntu 22.04/24.04 LTS，最低建议 2 vCPU / 4 GB RAM / 40 GB SSD。

### 3.1 系统用户

```bash
ssh root@<vps-ip>
adduser devbrain
usermod -aG sudo devbrain
rsync --archive --chown=devbrain:devbrain ~/.ssh /home/devbrain/
exit
ssh devbrain@<vps-ip>
```

### 3.2 系统基础包

```bash
sudo apt-get update
sudo apt-get -y upgrade
sudo apt-get -y install ca-certificates curl gnupg ufw fail2ban git
sudo timedatectl set-timezone Asia/Shanghai
```

### 3.3 防火墙

试用阶段只开放 SSH 和 HTTP：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status
```

恢复完整生产模式并启用 HTTPS 时再开放 443：

```bash
sudo ufw allow 443/tcp
```

### 3.4 Docker Engine + Compose Plugin

按 Docker 官方步骤安装 `docker-ce`、`docker-ce-cli`、`containerd.io`、`docker-buildx-plugin`、`docker-compose-plugin`，然后执行：

```bash
sudo usermod -aG docker devbrain
newgrp docker
docker version
docker compose version
```

### 3.5 GHCR 登录

```bash
echo "<GHCR_READ_ONLY_PAT>" | docker login ghcr.io -u <github-user> --password-stdin
```

### 3.6 拉取部署仓库

```bash
sudo mkdir -p /opt/devbrain
sudo chown devbrain:devbrain /opt/devbrain
cd /opt/devbrain
git clone --depth=1 https://github.com/<owner>/devbrain.git .
git fetch --depth=1 origin <SHA>
git checkout <SHA>
```

VPS 通过仓库获得 `docker-compose.yml`、`docker-compose.prod.yml`、`infra/`、`.env.example` 和迁移相关文件。API / Web / Worker 运行时使用 GHCR 镜像，不在 VPS 上构建应用镜像。

---

## 4. 首次部署

### 4.1 写入 `.env`

Docker Compose 默认读取 `/opt/devbrain/.env`：

```bash
cd /opt/devbrain
cp .env.example .env
chmod 600 .env
nano .env
```

必须覆盖以下字段，不能保留默认弱口令：

| 类别      | 字段                                                                   | 试用阶段值                                                |
| --------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| 镜像      | `REGISTRY=ghcr.io/<owner>/`                                            | 注意末尾保留 `/`                                          |
| 镜像      | `IMAGE_PREFIX=devbrain-`                                               | 与 GHCR 镜像名前缀一致                                    |
| 镜像      | `IMAGE_TAG=sha-<SHA>`                                                  | 与 workflow 产物一致                                      |
| 数据库    | `POSTGRES_PASSWORD`                                                    | 随机长口令                                                |
| 数据库    | `DATABASE_URL`                                                         | `postgresql://devbrain:<password>@postgres:5432/devbrain` |
| Redis     | `REDIS_URL`                                                            | `redis://redis:6379`                                      |
| Web       | `API_URL=http://api:3001`                                              | Next.js 服务端 rewrite 访问容器内 API                     |
| Auth      | `JWT_ACCESS_SECRET`                                                    | `openssl rand -hex 64`                                    |
| Auth      | `JWT_REFRESH_SECRET`                                                   | `openssl rand -hex 64`                                    |
| Auth      | `REFRESH_TOKEN_PEPPER`                                                 | `openssl rand -hex 64`                                    |
| Auth      | `AUTH_ACCESS_TOKEN_TTL_SECONDS=900`                                    | 不超过 15 分钟                                            |
| Auth      | `AUTH_REFRESH_TOKEN_TTL_SECONDS=604800`                                | 不超过 7 天                                               |
| Auth      | `AUTH_COOKIE_SECURE=false`                                             | HTTP + IP 试用阶段临时例外                                |
| CORS      | `CORS_ORIGIN=http://<vps-ip>`                                          | 不允许 `*`                                                |
| Storage   | `STORAGE_SIGNATURE_SECRET`                                             | `openssl rand -hex 64`                                    |
| Storage   | `DEV_STORAGE_ROOT=/home/node/devbrain-storage`                         | compose 已固定该路径；API/Worker 共享同一 volume          |
| Provider  | `EMBEDDING_PROVIDER=dashscope`                                         | 真实 embedding                                            |
| Provider  | `RERANK_PROVIDER=dashscope`                                            | 真实 rerank                                               |
| Provider  | `LLM_PROVIDER=qwen`                                                    | 真实 Qwen-Plus                                            |
| DashScope | `DASHSCOPE_API_KEY`                                                    | 阿里云控制台获取                                          |
| R2        | `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_ENDPOINT`、`R2_BUCKET` | 试用阶段可留空；恢复完整生产模式前补齐                    |
| 监控      | `SENTRY_DSN`、`LANGFUSE_*`、`BETTERSTACK_HEARTBEAT_URL`                | 试用阶段留空                                              |
| 环境      | `NODE_ENV=production`                                                  | 生产运行模式                                              |

确认 `.env` 不会被提交：

```bash
git status --short .env
```

该命令应无输出。

后续生产命令统一使用合并后的 compose 文件：

```bash
COMPOSE='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

如果 `config` 阶段提示 `!reset` 无法解析，说明 VPS 的 Docker Compose 版本过旧，需要先升级 `docker-compose-plugin`。

### 4.2 拉取生产镜像

```bash
$COMPOSE config >/tmp/devbrain-compose.yml
$COMPOSE pull postgres api web worker
```

### 4.3 启动基础服务并迁移

```bash
$COMPOSE up -d postgres redis
$COMPOSE run --rm migrate
```

迁移失败时先看：

```bash
$COMPOSE logs postgres
$COMPOSE logs migrate
```

### 4.4 启动业务服务

```bash
$COMPOSE up -d api web worker caddy
$COMPOSE ps
```

试用阶段不要求所有服务显示 `healthy`，但至少应看到目标服务处于运行状态。Caddy 不会申请 Let's Encrypt 证书。

---

## 5. 上线后验证

试用阶段只把端到端主链路作为上线门槛。任一步骤失败时停在当前步骤排查。

### 5.1 容器与入口

```bash
$COMPOSE ps
$COMPOSE logs --tail=100 caddy
curl -I http://<vps-ip>/
```

预期：

- `postgres`、`redis`、`api`、`web`、`worker`、`caddy` 已启动。
- `curl -I http://<vps-ip>/` 返回 HTTP 响应。
- 公网访问 `http://<vps-ip>:3001` 和 `http://<vps-ip>:3000` 不应成功。

### 5.2 真实端到端冒烟

1. 浏览器访问 `http://<vps-ip>/`。
2. 注册一个测试账号并登录。
3. 创建一个个人 KB。
4. 上传一个 Markdown 文档。
5. 查看 worker 日志确认 ingestion 完成：

```bash
$COMPOSE logs -f worker
```

6. 进入 Chat 提问，验证回答流式输出。
7. 确认回答引用可点击，并能定位到正确 chunk 或 source panel。

试用阶段跳过：

- `/api/healthz` 与 `/api/readyz` 验证。Caddy 必须使用 `handle_path /api/*` 剥掉 `/api` 前缀后再转发到 API，因为 API 容器内部路由是 `/healthz`、`/readyz`、`/kbs`。
- HTTPS 证书验证。
- Langfuse trace 验证。
- Sentry 测试事件。
- Better Stack 心跳和 Uptime。

### 5.3 手动备份提示

试用阶段自动 backup 暂不作为上线门槛。若试用数据需要临时保留，可先用 VPS / 云厂商磁盘快照兜底，或在停写后从 Postgres 容器手动导出 dump。

恢复完整生产模式前，必须补齐 backup service、R2 上传、Better Stack 心跳和 restore-test。

---

## 6. 升级与回滚

### 6.1 升级到新 SHA

```bash
cd /opt/devbrain
git fetch --depth=1 origin <NEW_SHA>
git checkout <NEW_SHA>
nano .env
$COMPOSE pull postgres api web worker
$COMPOSE run --rm migrate
$COMPOSE up -d api web worker
$COMPOSE ps
```

`.env` 中只更新 `IMAGE_TAG=sha-<NEW_SHA>`。迁移必须先于应用重启。

### 6.2 回滚

```bash
cd /opt/devbrain
git checkout <PREVIOUS_SHA>
nano .env
$COMPOSE pull postgres api web worker
$COMPOSE up -d api web worker
$COMPOSE ps
```

如果新版本已经执行破坏性 migration，不能只回滚镜像；必须先按第 6.4 节恢复数据库。

### 6.3 常见排查入口

| 现象                        | 第一入口                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `http://<vps-ip>/` 访问失败 | `$COMPOSE logs caddy`、`$COMPOSE ps`、`sudo ufw status`                                         |
| 502                         | `$COMPOSE logs caddy`、`$COMPOSE logs web api`                                                  |
| 登录失败                    | 检查 `JWT_*`、`REFRESH_TOKEN_PEPPER`、`AUTH_COOKIE_SECURE=false`、`CORS_ORIGIN=http://<vps-ip>` |
| 上传后文档不处理            | `$COMPOSE logs worker`、`$COMPOSE logs redis`                                                   |
| 检索或生成失败              | `$COMPOSE logs api worker`，检查 `DASHSCOPE_API_KEY` 和 provider 配置                           |
| streaming 卡顿              | 确认 Caddyfile 的 `/api/*` 代理包含 `flush_interval -1`                                         |
| 公网可访问 3000/3001        | 立刻修正 compose 端口绑定或防火墙规则，只保留 80 公网入口                                       |

### 6.4 数据库恢复

恢复前先停应用写入：

```bash
$COMPOSE stop api web worker
```

按备份文件所在位置选择恢复方式。恢复完成后再启动应用：

```bash
$COMPOSE start api web worker
```

恢复后必须重新跑第 5.2 节端到端冒烟。

---

## 7. 恢复完整生产模式清单

当决定购买域名并正式对外时，按顺序恢复：

1. 域名 A 记录指向 VPS 公网 IP。
2. `sudo ufw allow 443/tcp`。
3. Caddyfile 从 `:80` 改为 `{$DEVBRAIN_DOMAIN}`。
4. `.env` 增加 `DEVBRAIN_DOMAIN=<your-domain>`。
5. `.env` 修改 `CORS_ORIGIN=https://<your-domain>`。
6. `.env` 修改 `AUTH_COOKIE_SECURE=true`。
7. 接入 Sentry，并验证测试事件可见。
8. 接入 Langfuse，并验证一次对话 trace 可见，且不包含原始私文档、token、完整 prompt。
9. 接入 Better Stack 心跳和 Uptime。
10. 对象存储切到 R2 presigned PUT，并完成上传 / HEAD smoke。
11. 补齐并启动 backup service，完成 R2 上传、备份心跳和 restore-test。
12. 恢复上线验证：`/api/healthz`、`/api/readyz`、HTTPS 证书。

完整生产模式验证命令：

```bash
curl -sf https://<your-domain>/api/healthz
curl -sf https://<your-domain>/api/readyz
curl -sfI https://<your-domain>/
```

---

## 8. 安全与运维注意事项

- `.env` 只保存在 VPS，权限保持 `600`。
- GHCR PAT 只给 `read:packages`，建议 90 天轮换一次。
- Postgres、Redis、API、Web 不直接暴露公网，公网入口只允许 Caddy。
- HTTP + IP 试用阶段不上传真实私密文档。
- 任何破坏性 schema 变更前必须先备份，并确认备份可恢复。
- Argon2id 参数、token rotation、refresh token hash 禁止为了部署便利而降级。
- 恢复 Sentry / Langfuse 后必须开启 PII scrubbing，禁止上报原始私文档、token、完整 prompt。
