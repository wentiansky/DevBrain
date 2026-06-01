# DevBrain 生产部署手册

本文档面向 P0 功能闭环已经完成、VPS 已购买的状态，描述把 DevBrain 上线到生产环境的完整步骤。严格遵循 CLAUDE.md 锁定的部署约束：**镜像在 GitHub Actions 构建后推送到 GHCR；VPS 只 `docker compose pull` GHCR 镜像，不在 VPS 上构建 Next.js**。

> 阅读顺序：先把第 1 节"前置补齐"做完再进入第 2 节起的执行步骤。第 1 节不通过则后续步骤无法完成。

---

## 0. 部署拓扑速览

```
GitHub repo                GHCR                       VPS (Caddy + Compose)
   │                        │                              │
   │ push tag/SHA           │ pull-by-SHA                  │ 8 services
   ▼                        ▼                              ▼
build & push  ────►  ghcr.io/<owner>/<image>:<sha>  ────►  postgres / redis /
                                                          migrate / api / web /
                                                          worker / backup / caddy
```

外部依赖：

- Cloudflare R2（对象存储 + 备份归档）
- DashScope（embedding `text-embedding-v3`、rerank `gte-rerank`、LLM `qwen-plus`）
- Sentry / Langfuse / Better Stack（监控、trace、心跳）

---

## 1. 前置补齐清单（部署前必须完成）

下列 4 项在当前仓库还是占位或缺失，必须先合入 `main` 并验证通过，否则后续步骤无法继续。每项给出验收标准。

### 1.1 三个应用 Dockerfile

- `apps/api/Dockerfile`：以 monorepo root 为 context 构建，包含 `packages/db`（Prisma schema + migrations），输出生产镜像可同时承担 `api` 与 `migrate` 服务（`docker-compose.yml` 的 `migrate` 复用 api 镜像跑 `prisma migrate deploy`）。
- `apps/worker/Dockerfile`：复用 monorepo workspace，包含 BullMQ worker 与 ingestion 依赖。
- `apps/web/Dockerfile`：多阶段构建，`next build` 后只保留 `.next/standalone` + `.next/static` + `public/`，运行时 `node server.js`。

**验收标准**：

```bash
docker buildx build -f apps/api/Dockerfile -t devbrain/api:test .
docker buildx build -f apps/worker/Dockerfile -t devbrain/worker:test .
docker buildx build -f apps/web/Dockerfile -t devbrain/web:test .
docker compose --env-file .env config            # compose 配置仍可解析
docker compose up -d postgres redis              # 基础服务可起
docker compose run --rm migrate                  # Prisma 迁移成功退出 0
```

### 1.2 GitHub Actions：build & push GHCR（pull-by-SHA）

新增 `.github/workflows/build-and-push.yml`，触发条件 `push: branches: [main]` 与 `workflow_dispatch`。每次构建：

1. `actions/checkout@v4` + `pnpm/action-setup` + `actions/setup-node`（读 `.nvmrc`）。
2. 并行 build `api` / `web` / `worker` 三个镜像，tag 为 `ghcr.io/<owner>/devbrain-<service>:sha-${{ github.sha }}` 与 `:latest`。
3. `docker/login-action@v3` 用 `GITHUB_TOKEN` 登录 ghcr.io，`docker buildx build --push --cache-from type=gha --cache-to type=gha,mode=max`。
4. 输出 `IMAGE_TAG=sha-<sha>` 到 job summary，供 VPS 部署引用。

**验收标准**：

- `main` 推一个 commit 后，GHCR 上能看到三个新 tag `sha-<full-sha>`。
- `docker pull ghcr.io/<owner>/devbrain-api:sha-<sha>` 在本机可拉取（先 `docker login ghcr.io`）。

### 1.3 Caddyfile 生产化

把 `infra/caddy/Caddyfile` 从 `:80` 占位改为：

```caddy
{$DEVBRAIN_DOMAIN} {
  encode zstd gzip

  @auth path /auth/*
  reverse_proxy @auth api:3001

  @api path /api/*
  reverse_proxy @api api:3001 {
    flush_interval -1            # SSE/streaming 必须关闭缓冲
    transport http {
      read_timeout 5m
    }
  }

  reverse_proxy /* web:3000
}
```

并在 `.env.production` 中提供 `DEVBRAIN_DOMAIN=<your-domain>`。Caddy 自动申请 Let's Encrypt 证书，无需手工配置。

**验收标准**：本机 `docker compose config` 解析通过；上线后 `curl -I https://<domain>/api/healthz` 返回 200 且 `curl -N` 的 streaming 接口立即返回首字节。

### 1.4 backup 脚本上线前必须 restore-test

修改 `infra/backup/backup.sh`：

- 在 `pg_dump` 之后追加 `curl -fsS "$BETTERSTACK_HEARTBEAT_URL"`（成功才打卡）。
- 失败路径（`set -euo pipefail`）下不打卡，由 Better Stack 告警。

**验收标准**：在 VPS 部署完成之后、对外公开域名之前，手动执行一次：

```bash
docker compose exec backup /usr/local/bin/backup.sh
docker compose exec postgres pg_restore --list /backups/devbrain_<date>.dump   # 能列出 schema
# 在 staging 数据库或临时容器内 pg_restore 恢复并跑一条业务查询
```

未完成 restore-test 不允许把域名对外。

---

## 2. GHCR 构建（开发机执行）

1. 确认前置 1.1、1.2 已合入 `main`。
2. 在 `main` 推送或手工触发一次 `build-and-push` workflow。
3. 等待 Action 绿灯，记录 commit SHA（缩写或全量）。本次记为 `<SHA>`。
4. 在 GHCR 页面把 `ghcr.io/<owner>/devbrain-api`、`devbrain-web`、`devbrain-worker` 三个镜像设为 **private**，并创建只读 PAT（`read:packages`），稍后给 VPS 用。

---

## 3. VPS 初始化（首次执行一次）

假设 VPS 为 Ubuntu 22.04/24.04 LTS，单机 ≥ 2 vCPU / 4 GB / 40 GB SSD。

### 3.1 系统基线

```bash
ssh root@<vps-ip>
adduser devbrain && usermod -aG sudo devbrain
rsync --archive --chown=devbrain:devbrain ~/.ssh /home/devbrain/
exit
ssh devbrain@<vps-ip>

sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get -y install ca-certificates curl gnupg ufw fail2ban
sudo timedatectl set-timezone Asia/Shanghai
```

### 3.2 防火墙

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

> Postgres / Redis / API / Web 端口在 `docker-compose.yml` 中均绑定到 `127.0.0.1`，不暴露公网，无需额外放行。

### 3.3 安装 Docker Engine + Compose Plugin

按 Docker 官方步骤安装 `docker-ce` `docker-ce-cli` `containerd.io` `docker-buildx-plugin` `docker-compose-plugin`，然后：

```bash
sudo usermod -aG docker devbrain
newgrp docker
docker version && docker compose version
```

### 3.4 GHCR 登录

```bash
echo "<GHCR_READ_ONLY_PAT>" | docker login ghcr.io -u <github-user> --password-stdin
```

### 3.5 目录布局

```bash
sudo mkdir -p /opt/devbrain
sudo chown devbrain:devbrain /opt/devbrain
cd /opt/devbrain
git clone --depth=1 https://github.com/<owner>/devbrain.git .
git checkout <SHA>                  # 锁定到 GHCR 镜像对应的 SHA
```

VPS 只需要 `docker-compose.yml`、`infra/`、`.env.production`，不需要 `apps/`、`packages/` 的源码运行。但为了让 `infra/postgres/Dockerfile`（pgvector + zhparser）能在 VPS 本地构建一次（Postgres 不走 GHCR），需要 `infra/postgres/` 全量。Next.js / Nest.js 镜像一律 pull。

### 3.6 DNS

把 `<your-domain>` 的 A 记录指向 VPS 公网 IP，TTL 暂设 300s。`dig +short <your-domain>` 出来是 VPS IP 即可。Caddy 申请证书前 DNS 必须已生效。

---

## 4. 首次部署

### 4.1 写入 `.env.production`

```bash
cd /opt/devbrain
cp .env.example .env
chmod 600 .env
nano .env
```

**必须**覆盖的字段（不能留默认）：

| 类别 | 字段 | 说明 |
| --- | --- | --- |
| 镜像 | `REGISTRY=ghcr.io/<owner>/`、`IMAGE_PREFIX=devbrain-`、`IMAGE_TAG=sha-<SHA>` | 与 GHCR tag 对齐；`IMAGE_PREFIX` 去掉斜杠 |
| 数据库 | `POSTGRES_PASSWORD`、`DATABASE_URL` | 随机长口令 |
| Auth | `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`REFRESH_TOKEN_PEPPER` | `openssl rand -hex 64`，三个互不相同 |
| Auth | `AUTH_COOKIE_SECURE=true` | 生产强制 |
| CORS | `CORS_ORIGIN=https://<your-domain>` | 不允许 `*` |
| 域名 | `DEVBRAIN_DOMAIN=<your-domain>` | Caddyfile 引用 |
| Provider | `EMBEDDING_PROVIDER=dashscope`、`RERANK_PROVIDER=dashscope`、`LLM_PROVIDER=qwen` | 切换到真实 provider |
| DashScope | `DASHSCOPE_API_KEY` | 阿里云控制台获取 |
| R2 | `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_ENDPOINT`、`R2_BUCKET` | Cloudflare R2 控制台 |
| 监控 | `SENTRY_DSN`、`LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`BETTERSTACK_HEARTBEAT_URL` | 各平台控制台 |
| 环境 | `NODE_ENV=production` | |

确认 `.env` 权限为 `600`，且未被 `git add`（`.gitignore` 已默认忽略）。

### 4.2 拉取镜像

```bash
docker compose pull api web worker backup caddy
docker compose build postgres        # pgvector + zhparser 仅在 VPS 本地构建一次
```

### 4.3 启动基础服务并跑迁移

```bash
docker compose up -d postgres redis
docker compose run --rm migrate     # 退出码 0 才能继续
```

如果迁移失败：检查 `DATABASE_URL`、Postgres 健康检查日志（`docker compose logs postgres`）、Prisma migrations 是否随镜像打包。

### 4.4 启动业务服务

```bash
docker compose up -d api web worker backup caddy
docker compose ps                    # 8 个服务，全部 Up / healthy
```

Caddy 首次启动会向 Let's Encrypt 申请证书，约 30 秒。`docker compose logs caddy` 出现 `certificate obtained successfully` 即成功。

---

## 5. 上线后验证

按顺序跑完，任一步骤失败立即停在该步处理。

### 5.1 健康检查

```bash
curl -sf https://<your-domain>/api/healthz             # 200
curl -sfI https://<your-domain>/                       # 200，Caddy 已挂证书
```

### 5.2 端到端冒烟（真实 DashScope + Qwen）

1. 浏览器访问 `https://<your-domain>/`，注册一个测试账号。
2. 创建一个个人 KB，上传一个 Markdown 文档。
3. 在 worker 日志里确认 ingestion 完成：`docker compose logs -f worker | grep -E '(chunk|embedding|complete)'`。
4. 在对话页面提问，验证：
   - 首 token 延迟 < 3s
   - streaming 流畅、Caddy 没有缓冲
   - 引用气泡可点击，命中正确的 chunk anchor
5. 在 Langfuse trace 中确认本次对话已记录，rerank 步骤可见 top-N。
6. 在 Sentry 项目中触发一次故意错误（例如访问 `/api/__not_found`），确认事件上报。

### 5.3 备份首跑与 restore-test

```bash
docker compose exec backup /usr/local/bin/backup.sh
ls -lh $(docker compose exec backup ls /backups)
# 拷贝到临时容器尝试 restore
docker run --rm --network devbrain_internal -v devbrain_pgdata_test:/var/lib/postgresql/data \
  pgvector/pgvector:pg16 pg_restore --list /backups/devbrain_<date>.dump
```

Better Stack 心跳能收到一次成功打卡后才算完成。

### 5.4 监控对接确认

- Sentry：测试事件可见、Release 自动关联 SHA。
- Langfuse：trace 已记录、含模型名与 token 用量。
- Better Stack：心跳监控 + Uptime 监控（`https://<your-domain>/api/healthz` 1 分钟）均在线。

---

## 6. 升级、回滚与故障处理

### 6.1 滚动升级（新 SHA）

```bash
cd /opt/devbrain
git fetch && git checkout <NEW_SHA>
nano .env                           # 更新 IMAGE_TAG=sha-<NEW_SHA>
docker compose pull api web worker
docker compose run --rm migrate     # 迁移先于 app
docker compose up -d api web worker
docker compose ps
```

升级期间 Caddy / Postgres / Redis / Worker / Backup 不重启。

### 6.2 回滚

```bash
nano .env                           # IMAGE_TAG 回退到上一个 SHA
docker compose pull api web worker
# 注意：如果新 SHA 包含破坏性 migration，先用 6.4 节恢复 DB
docker compose up -d api web worker
```

发布前应记录最后一个稳定的 `IMAGE_TAG`，便于快速回切。

### 6.3 常见故障排查入口

| 现象 | 第一步看 |
| --- | --- |
| 502 / 网关错误 | `docker compose logs caddy` + `docker compose ps` |
| streaming 卡顿 | 确认 Caddyfile 有 `flush_interval -1`、`API` 容器日志无 backpressure |
| 检索结果异常 | `docker compose logs api worker` 中 embedding/rerank 调用响应码 |
| 登录失败 | `JWT_*` 与 `REFRESH_TOKEN_PEPPER` 没改默认值；`AUTH_COOKIE_SECURE` 在 HTTPS 下应为 true |
| Sentry 收不到 | DSN 输错；测试事件可用 `npx @sentry/cli send-event` 验证 |

### 6.4 数据库恢复

```bash
docker compose stop api web worker
docker compose exec postgres pg_restore --clean --if-exists \
  -U $POSTGRES_USER -d $POSTGRES_DB /backups/devbrain_<date>.dump
docker compose start api web worker
```

恢复后立刻跑一次 5.2 的端到端冒烟。

---

## 7. 安全与运维注意事项

- `.env` 仅存在于 VPS，永不进 git；任何凭证轮换都重新生成。
- GHCR PAT 使用 `read:packages` 最小权限；建议 90 天轮换一次。
- Postgres / Redis / API 端口全部绑定 `127.0.0.1`，绝不开放到公网。
- Argon2id 参数（`m=64MB/t=3/p=4`）与 token rotation 实现禁止降级。
- 任何对 schema 的破坏性变更都必须先 `pg_dump` 再迁移。
- 备份脚本必须始终连接 Better Stack 心跳；连续 2 次未打卡 = oncall 告警。
- Sentry / Langfuse 默认 PII scrubbing 必须开启，禁止上报原始私文档、token、完整 prompt。
