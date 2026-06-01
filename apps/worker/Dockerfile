# syntax=docker/dockerfile:1.7
#   docker buildx build -f apps/worker/Dockerfile -t devbrain/worker:<tag> .

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
COPY apps/worker apps/worker

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline

RUN pnpm --filter @devbrain/db exec prisma generate \
 && pnpm --filter @devbrain/db build \
 && pnpm --filter @devbrain/worker build \
 && pnpm deploy --filter @devbrain/worker --prod --legacy /deploy/worker

FROM base AS runtime
WORKDIR /app
COPY --from=builder /deploy/worker/package.json ./package.json
COPY --from=builder /deploy/worker/node_modules ./node_modules
COPY --from=builder /deploy/worker/dist ./dist
ENV NODE_ENV=production
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
