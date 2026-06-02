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
docker compose config >/tmp/devbrain-compose.yml
```

拉应用镜像并构建 Postgres 镜像：

```bash
docker compose pull api web worker
docker compose build postgres
```

启动数据库和 Redis，并执行迁移：

```bash
docker compose up -d postgres redis
docker compose run --rm migrate
```

启动业务服务：

```bash
docker compose up -d api web worker caddy
docker compose ps
```

端口预期：

- Caddy：`0.0.0.0:80->80/tcp`
- API：`127.0.0.1:3001->3001/tcp`
- Web：`127.0.0.1:3000->3000/tcp`
- Postgres：`127.0.0.1:5432->5432/tcp`
- Redis：`127.0.0.1:6379->6379/tcp`

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
docker compose logs --tail=120 api web worker caddy
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
docker compose logs -f worker
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
docker compose pull api web worker
docker compose up -d api web worker
docker compose restart caddy
docker compose ps
```

如果 schema 有 migration，先执行：

```bash
docker compose run --rm migrate
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
docker compose ps
docker compose logs --tail=120 web api caddy
docker compose restart caddy
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
docker compose pull api web worker
```

### 错误8：API/Web/Postgres/Redis 暴露到公网

原因：compose 端口绑定没有限制到 `127.0.0.1`，或安全组直接放开了内部端口。

解决方法：compose 里内部服务端口应绑定到 `127.0.0.1`，公网只开放 Caddy 的 80。

```yaml
ports:
  - '127.0.0.1:3001:3001'
```

安全组或防火墙不要开放 `3000`、`3001`、`5432`、`6379`。
