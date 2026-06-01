# syntax=docker/dockerfile:1.7
# 从 monorepo root 作为构建上下文
#   docker buildx build -f apps/api/Dockerfile -t devbrain/api:<tag> .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:${PATH}" \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl tini \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS builder
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/db packages/db
COPY apps/api apps/api

# 再次 install：源码 COPY 覆盖了 workspace symlink，需要重新创建（store 已缓存，仅链接）
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

RUN pnpm --filter @devbrain/db exec prisma generate \
 && pnpm --filter @devbrain/db build \
 && pnpm --filter @devbrain/api build \
 && pnpm deploy --filter @devbrain/api --prod --legacy /deploy/api

FROM base AS runtime
# Prisma CLI 仅 migrate 服务复用 api 镜像时需要，体积约 50MB
RUN npm install -g prisma@6 --no-fund --no-audit \
  && npm cache clean --force
WORKDIR /app
COPY --from=builder /deploy/api/package.json ./package.json
COPY --from=builder /deploy/api/node_modules ./node_modules
COPY --from=builder /deploy/api/dist ./dist
# migrate 服务使用 --schema=/app/prisma/schema.prisma
COPY --from=builder /repo/packages/db/prisma ./prisma
RUN mkdir -p /home/node/devbrain-storage \
  && chown -R node:node /home/node/devbrain-storage
ENV NODE_ENV=production \
    API_PORT=3001
EXPOSE 3001
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
