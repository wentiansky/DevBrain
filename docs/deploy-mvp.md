# DevBrain MVP IP 部署步骤

本文档记录本次已跑通的最小生产 IP 部署流程。当前目标是先用 `http://<vps-ip>/` 给朋友试用，不买域名，不接 Sentry / Langfuse / Better Stack，不启用自动备份。

## 1. 前置条件

- VPS：Ubuntu，示例为 Hetzner CPX22。
- 本地仓库已推送到 GitHub `main`。
- GitHub Actions 已成功构建并推送 GHCR 镜像：
  - `ghcr.io/wentiansky/devbrain-api:sha-<SHA>`
  - `ghcr.io/wentiansky/devbrain-web:sha-<SHA>`
  - `ghcr.io/wentiansky/devbrain-worker:sha-<SHA>`
- GitHub PAT 已创建，权限只需要 `read:packages`。
- DashScope API Key 已准备好。

当前试用部署只开放 HTTP 80。安全组或防火墙建议只开放：

```text
TCP 22
TCP 80
```

不要开放：

```text
3000
3001
5432
6379
443
```

## 2. VPS 安装 Docker

SSH 登录 VPS 后执行：

```bash
apt-get update
apt-get -y upgrade
apt-get -y install ca-certificates curl gnupg git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

验证：

```bash
docker version
docker compose version
```

## 3. 登录 GHCR

在 VPS 上执行：

```bash
echo "<GHCR_READ_ONLY_PAT>" | docker login ghcr.io -u wentiansky --password-stdin
```

成功标准：

```text
Login Succeeded
```

## 4. 拉取部署仓库

```bash
mkdir -p /opt/devbrain
cd /opt/devbrain
git clone --depth=1 https://github.com/wentiansky/DevBrain.git .
git fetch --depth=1 origin <SHA>
git checkout <SHA>
```

验证：

```bash
git rev-parse HEAD
```

输出应等于本次部署的完整 `<SHA>`。

## 5. 写入 `.env`

```bash
cd /opt/devbrain
cp .env.example .env
chmod 600 .env
```

生成随机密钥：

```bash
openssl rand -hex 32
openssl rand -hex 64
openssl rand -hex 64
openssl rand -hex 64
openssl rand -hex 64
```

分别用于：

```text
POSTGRES_PASSWORD
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
REFRESH_TOKEN_PEPPER
STORAGE_SIGNATURE_SECRET
```

编辑 `.env`：

```bash
nano .env
```

至少修改这些字段：

```env
REGISTRY=ghcr.io/wentiansky/
IMAGE_PREFIX=devbrain-
IMAGE_TAG=sha-<SHA>

POSTGRES_PASSWORD=<随机密码>
DATABASE_URL=postgresql://devbrain:<同一个随机密码>@postgres:5432/devbrain
REDIS_URL=redis://redis:6379
API_URL=http://api:3001

JWT_ACCESS_SECRET=<随机值>
JWT_REFRESH_SECRET=<随机值>
REFRESH_TOKEN_PEPPER=<随机值>
STORAGE_SIGNATURE_SECRET=<随机值>

AUTH_COOKIE_SECURE=false
CORS_ORIGIN=http://<vps-ip>

EMBEDDING_PROVIDER=dashscope
RERANK_PROVIDER=dashscope
RERANK_MODEL=gte-rerank-v2
LLM_PROVIDER=qwen
LLM_MODEL=qwen-plus-2025-12-01
DASHSCOPE_API_KEY=<DashScope API Key>

NODE_ENV=production
```

后续生产命令统一使用合并后的 compose 文件：

```bash
COMPOSE='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

`docker-compose.yml` 只保留本地和生产共享的服务拓扑；`docker-compose.prod.yml` 删除应用和 Postgres 的 `build` 配置，改为拉取 GHCR 镜像，并承载 Caddy 443 端口与 `CADDY_CONFIG` 切换。

试用阶段这些可以留空：

```env
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=
R2_BUCKET=
SENTRY_DSN=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
BETTERSTACK_HEARTBEAT_URL=
```

确认 `.env` 没有进入 git：

```bash
git status --short .env
```

应无输出。

## 6. 启动服务

先解析 compose：

```bash
$COMPOSE config >/tmp/devbrain-compose.yml
```

拉生产镜像：

```bash
$COMPOSE pull postgres api web worker
```

启动数据库和 Redis，并执行迁移：

```bash
$COMPOSE up -d postgres redis
$COMPOSE run --rm migrate
```

启动业务服务：

```bash
$COMPOSE up -d api web worker caddy
$COMPOSE ps
```

> P0 性能优化专项落地后（参见 `openspec/changes/optimize-web-first-load-perf/`），`web` 服务会带 healthcheck，`caddy` 通过 `depends_on: web.condition: service_healthy` 在 Web 就绪后再接流量。**切流前必须确认 `$COMPOSE ps` 输出中 `web`、`api` 状态为 `(healthy)`**，否则用户首请求会撞到 Next.js standalone JIT 冷启动延迟。

端口预期：

- Caddy：`0.0.0.0:80->80/tcp`（仅 IP/dev 模式）或 `0.0.0.0:80->80/tcp 0.0.0.0:443->443/tcp`（域名 HTTPS 模式）
- API：`127.0.0.1:3001->3001/tcp`
- Web：`127.0.0.1:3000->3000/tcp`
- Postgres：`127.0.0.1:5432->5432/tcp`
- Redis：`127.0.0.1:6379->6379/tcp`

## 6.5 切换到域名 + HTTPS（P0 性能优化专项）

P0 性能优化专项 `optimize-web-first-load-perf` 启用后，`infra/caddy/` 下有两份 Caddyfile，由 compose 环境变量 `CADDY_CONFIG` 决定 mount 哪份：

| `CADDY_CONFIG` 值 | mount 文件 | 行为 |
|---|---|---|
| 未设置（默认） | `infra/caddy/Caddyfile` | `:80` plain HTTP；适合本地 `pnpm dev` 与 VPS IP 直连 |
| `Caddyfile.prod` | `infra/caddy/Caddyfile.prod` | 域名 + 自动 ACME + HTTPS + HTTP/2 |

前置条件：

1. 已购买域名，已把 A 记录指向 VPS 公网 IP，`dig <domain> +short` 能解析到 IP。
2. VPS 防火墙/安全组**同时开放 `80/tcp` 与 `443/tcp`**；ACME HTTP-01 校验依赖 `:80` 可达，浏览器走 `:443`，缺一不可。
3. 生产启动命令必须带 `docker-compose.prod.yml`，让 caddy 服务包含 `'${CADDY_HTTPS_PORT:-443}:443'`，否则即便 ACME 签发成功，HTTPS 流量也无法到达容器。
4. `.env` 中追加 `CADDY_CONFIG=Caddyfile.prod`、`WEB_DOMAIN=<生产域名>`、`ACME_EMAIL=<你的邮箱>`。

切换步骤：

```bash
# 编辑 .env，追加 prod 配置项
cat >> .env <<'EOF'
CADDY_CONFIG=Caddyfile.prod
WEB_DOMAIN=devbrain.example.com
ACME_EMAIL=ops@example.com
EOF

# 校验两份 Caddyfile 语法
docker run --rm -v $PWD/infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
docker run --rm \
  -e WEB_DOMAIN=devbrain.example.com -e ACME_EMAIL=ops@example.com \
  -v $PWD/infra/caddy/Caddyfile.prod:/etc/caddy/Caddyfile:ro \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile

# 重新解析并重建 caddy（如果 compose 上次未带 443 端口或换了 mount，需 --force-recreate）
$COMPOSE config >/tmp/devbrain-compose.yml
$COMPOSE up -d --force-recreate caddy

# 观察 Caddy 日志，确认 ACME 签发成功
$COMPOSE logs -f caddy
```

回滚：把 `.env` 中 `CADDY_CONFIG` 注释掉，`$COMPOSE up -d --force-recreate caddy`，即回到 dev `Caddyfile`（`:80` plain HTTP）；DB schema 和应用容器不变。

签发成功后验证：

```bash
# HTTP/2 协商
curl -I --http2 https://devbrain.example.com/

# 静态资源命中长缓存
curl -I https://devbrain.example.com/_next/static/<任意 chunk>.js \
  | grep -i cache-control
# 期望：Cache-Control: public, max-age=31536000, immutable

# HTML 路由不缓存
curl -I https://devbrain.example.com/ | grep -i cache-control
# 期望：Cache-Control: private, no-cache 或等效语义
```

## 6.6 接入 Cloudflare CDN（P0 性能优化专项）

跨洲部署（如德国 VPS、国内访问）首屏 LCP 物理上限 ≈ 5s；要进 2.5s 必须由 CDN 提供国内边缘节点。本节记录 Cloudflare 免费档接入步骤与回退预案。

前置条件：

1. §6.5 已完成，HTTPS + ACME + HTTP/2 已工作，回源 Caddy 持有有效证书。
2. 域名管理权限可切 NS。

接入步骤：

```text
# 1. Cloudflare 注册账号并添加域名，记录分配的两条 NS

# 2. 把域名注册商的 NS 切换到 Cloudflare；先把 TTL 调到 5min 便于回退
dig NS <生产域名> +short  # 等到看到 Cloudflare NS 生效

# 3. Cloudflare DNS 面板：A 记录 <生产域名> 指 VPS 公网 IP，Proxy 状态：橙云 ON

# 4. SSL/TLS 面板：
#    - 加密模式：Full (Strict)
#    - Always Use HTTPS：ON
#    - 不要在 Cloudflare 端开 HSTS（HSTS 由回源 Caddy 控制，避免双发冲突）

# 5. Speed / Optimization 面板：启用 Brotli、Early Hints、HTTP/3

# 6. Caching → Cache Rules 创建两条规则：
#    规则 1（Cache Next static assets）：
#      条件：(http.request.uri.path matches "^/_next/static/" or http.request.uri.path matches "^/_next/image")
#      动作：Cache Eligibility = Eligible for cache + Edge TTL = 1 year + Browser TTL = Respect origin
#    规则 2（Bypass dynamic）：
#      条件：URI Path 匹配 / 或 /login 或 /register 或 /kb/ 或 /api/ 或 /auth/ 或 /storage/local/
#      动作：Cache Eligibility = Bypass cache

# 7. SSL/TLS → Origin Server 生成 Origin Certificate，下载 Cloudflare CA 证书

# 8. 在 Caddyfile.prod 启用 Authenticated Origin Pulls（mTLS），mount CA 证书；
#    或退而求其次：VPS 防火墙 ufw allow from <Cloudflare IP 段> to any port 80,443，其他 deny
```

验证（首次访问后等几分钟边缘缓存生效）：

```bash
# 静态资源：第二次访问必须 HIT
curl -I https://<生产域名>/_next/static/<chunk>.js | grep -i cf-cache-status
# 期望：cf-cache-status: HIT

# HTML 必须 BYPASS / DYNAMIC，不能 HIT
curl -I https://<生产域名>/ | grep -i cf-cache-status
# 期望：cf-cache-status: BYPASS（或 DYNAMIC）

# API 必须 BYPASS
curl -I https://<生产域名>/api/healthz | grep -i cf-cache-status
# 期望：cf-cache-status: BYPASS

# HTTP/3 协商
curl -I --http3 https://<生产域名>/
```

回退预案：

- DNS NS 切回原服务商；NS TTL 5min 等几分钟即可恢复 VPS 直连。
- 若 Cloudflare 国内节点抽风（症状：HTML 访问超时但回源 VPS 正常），先在 Cloudflare DNS 面板把 A 记录 Proxy 状态从橙云改灰云（临时绕过 CDN，DNS 解析直接到 VPS），再决定 NS 切回。
- 若 Cache Rules 误配导致 HTML 被缓存串号，立即 Caching → Configuration 面板 Purge Everything；同时检查 Cache Rules 规则 2 是否正确覆盖 HTML 路径。

## 7. 验证

本机验证：

```bash
curl -I http://127.0.0.1:3001/healthz
curl -I http://127.0.0.1:3000/
curl -I http://<vps-ip>/
```

成功标准：

- API `/healthz` 返回 `200`。
- Web 本地 `3000` 返回 `200`。
- 公网 `http://<vps-ip>/` 返回 `200`。

查看日志：

```bash
$COMPOSE logs --tail=120 api web worker caddy
```

Worker 正常日志应包含：

```text
Worker 已注册队列: document-processing
Worker 已启动，等待文档处理任务...
```

浏览器冒烟：

1. 打开 `http://<vps-ip>/`。
2. 注册测试账号。
3. 创建 KB。
4. 上传 Markdown。
5. 查看 worker 日志：

```bash
$COMPOSE logs -f worker
```

6. 文档 ready 后进入 Chat 提问，确认有流式回答和引用。

## 8. 升级

GitHub Actions 构建成功后，在 VPS 上执行：

```bash
cd /opt/devbrain
git fetch --depth=1 origin <NEW_SHA>
git checkout <NEW_SHA>
nano .env
```

把 `.env` 中的 `IMAGE_TAG` 改成：

```env
IMAGE_TAG=sha-<NEW_SHA>
```

然后：

```bash
$COMPOSE pull postgres api web worker
$COMPOSE up -d api web worker
$COMPOSE restart caddy
$COMPOSE ps
```

如果 schema 有 migration，先执行：

```bash
$COMPOSE run --rm migrate
```

## 9. 常见错误

### 错误1：`/repo/apps/web/public: not found`

原因：`apps/web/public` 是空目录，git 不会提交空目录，GitHub Actions 中 Dockerfile `COPY` 失败。

解决方法：提交 `apps/web/public/.gitkeep`，确保目录存在。

### 错误2：`@prisma/client did not initialize yet`

原因：生产镜像里的 `@devbrain/db` 依赖 Prisma Client，但默认生成位置在 `node_modules/.prisma/client`，`pnpm deploy` 后没有把生成物带到运行环境。

解决方法：让 `packages/db` 自己拥有 Prisma Client。`schema.prisma` 设置固定输出目录：

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}
```

`@devbrain/db` 从 `./generated/prisma` 导出 Prisma 类型和 Client，并在 `packages/db build` 时复制 generated runtime 到 `dist/generated`。

### 错误3：`Cannot find module './generated/prisma'`

原因：Prisma Client 已生成到 `src/generated`，但 `tsc` 不会自动复制生成的 JS 文件到 `dist`。

解决方法：`packages/db/package.json` 的 build 需要复制 generated runtime：

```json
"build": "prisma generate && tsc && cp -R src/generated dist/generated"
```

### 错误4：启动时 `npm i prisma@... -D --silent` 失败

原因：容器启动时执行 `prisma generate`，Prisma 尝试自动安装 CLI。生产容器不应该在启动时安装依赖。

解决方法：不要在容器启动命令里跑 `prisma generate`。应在 `@devbrain/db` 构建阶段生成并打包 Prisma Client。

### 错误5：公网返回 `502 Bad Gateway`

原因：常见情况是 Caddy 仍连着旧的 Web 容器 IP，或者 Web/API 尚未 ready。

解决方法：

```bash
$COMPOSE ps
$COMPOSE logs --tail=120 web api caddy
$COMPOSE restart caddy
```

然后重新验证：

```bash
curl -I http://127.0.0.1:3000/
curl -I http://<vps-ip>/
```

### 错误6：`curl http://127.0.0.1:3001/api/healthz` 失败

原因：API 服务内部路由是 `/healthz`，不是 `/api/healthz`。`/api/*` 是 Caddy 对外分流时使用的路径形状。

解决方法：

```bash
curl -I http://127.0.0.1:3001/healthz
curl -I http://<vps-ip>/api/healthz
```

### 错误7：GHCR `docker pull` 权限失败

原因：VPS 没登录 GHCR，或 PAT 没有 `read:packages` 权限。

解决方法：

```bash
echo "<GHCR_READ_ONLY_PAT>" | docker login ghcr.io -u wentiansky --password-stdin
$COMPOSE pull postgres api web worker
```

### 错误8：API/Web/Postgres/Redis 暴露到公网

原因：compose 端口绑定没有限制到 `127.0.0.1`，或安全组直接放开了内部端口。

解决方法：compose 里内部服务端口应绑定到 `127.0.0.1`，公网只开放 Caddy 的 80。

```yaml
ports:
  - '127.0.0.1:3001:3001'
```

安全组或防火墙不要开放 `3000`、`3001`、`5432`、`6379`。
