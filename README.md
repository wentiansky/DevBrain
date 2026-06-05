# DevBrain

DevBrain 是一个面向开发者的 self-hostable RAG 知识库。它支持上传技术文档、项目资料和学习笔记，通过混合检索、重排和流式对话生成带引用的回答，帮助用户把分散资料变成可追溯、可验证的问答系统。

本 README 面向公开仓库，只描述公开的产品能力、技术选型和运行方式。更完整的阶段边界见 `docs/planning/devbrain-prd.md` 和 `docs/planning/development-roadmap.md`。

---

## 项目定位

- 面向开发者个人和小团队的知识库工具。
- 重点解决“资料分散、搜索低效、回答缺少出处”的问题。
- P0 目标是形成最小可用 RAG 闭环：注册/登录、个人 KB、Markdown 上传、worker 处理、真实检索/生成、流式对话和文本引用定位。
- P1 再补产品化能力、部署运维能力和真实反馈触发的增强功能。

---

## 当前实现快照

截至 2026-06-05，仓库代码已覆盖 P0 主链：认证、个人 KB、Markdown 上传、worker ingestion、混合检索、真实生成、SSE chat streaming、文本 citation 和前端 source panel。

同时已具备上线试用所需的基础工程资产：`docker-compose.yml` + `docker-compose.prod.yml`、API/Web/Worker/Postgres 镜像 Dockerfile、GHCR 构建 workflow、`pnpm release:vps` 发布脚本、双 Caddyfile、容器 healthcheck、Web Vitals 开发期采集和 Sentry 浏览器端错误上报。

仍未视为完整生产闭环的部分：R2 对象存储 adapter、Langfuse、Better Stack、自动备份 restore-test、反馈入口、Web Vitals 生产上报，以及 Cloudflare/CDN/Sentry 的生产侧证据归档。这些继续按 P1 或 `optimize-web-first-load-perf` 的外部验收推进。

---

## 核心能力

### P0 范围

- **注册/登录**：支持账号注册、登录、退出、JWT access/refresh 和 token family rotation。
- **空状态**：新用户登录后看到可操作空状态，可以直接创建第一个 KB。
- **个人 KB**：支持 personal space 下的 KB 创建、列表、详情和权限校验。
- **Markdown 上传**：支持上传 Markdown 文档，进入 Document 状态机。
- **Worker ready**：文档解析、切块、embedding 在 worker 中执行，不阻塞 API request path。
- **真实检索/生成**：PostgreSQL FTS + pgvector 召回，通过 RRF 融合和 DashScope rerank 后调用真实 LLM。
- **Chat streaming**：NestJS 返回 `text/event-stream`，前端消费自定义 JSON SSE 事件并流式展示回答。
- **文本 citation 定位**：回答中使用引用，点击后定位到 Markdown chunk anchor 或 source panel。

### P1 候选

- 产品化补齐：找回密码、team、多格式文档、完整文档管理、模型设置、完整会话管理。
- 上线与反馈前置：CI/GHCR、VPS 部署、监控、备份、反馈入口和反馈整理。
- 反馈触发增强：评测、代码搜索、面试题模式、多模型对比、repo ingest、共享链接、PDF/移动端优化等。
- 完整 P1 候选以 `docs/planning/devbrain-prd.md` 为准，README 只保留公开概览。

---

## 技术栈

| 层               | 选型                                                    | 说明                                                                           |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 前端             | Next.js 16 App Router、React 19、Tailwind v4、shadcn/ui | RSC + Client Components，受保护段静态外壳 + 客户端认证恢复                     |
| 状态             | TanStack Query、Zustand、URL state                      | 服务端数据和纯 UI 状态分层管理                                                 |
| Markdown         | `unified`、`remark-parse`、`remark-gfm`                 | Worker 解析 Markdown、切块、生成 anchor；前端当前展示纯文本回答和 source panel |
| PDF              | `react-pdf` + `customTextRenderer`                      | P1 使用，支持页码、bbox 和文本高亮                                             |
| 后端             | NestJS、REST、Streaming                                 | 模块化 API 和可测试的服务边界                                                  |
| ORM              | Prisma                                                  | schema-first，便于迁移和类型生成                                               |
| 数据库           | PostgreSQL 16 + pgvector + PG FTS + zhparser            | 业务数据、向量和全文检索统一管理                                               |
| 缓存/队列        | Redis 7 + BullMQ                                        | 异步文档处理和任务状态管理                                                     |
| 对象存储         | local adapter；R2/S3 兼容存储待 P1                      | API/Worker 共享持久化 volume；R2 presigned PUT 仍待独立实现                    |
| LLM 调用         | 自研 provider router + NestJS SSE                       | 当前代码未接入 LangChain.js 或 Vercel AI SDK `useChat`                         |
| Embedding/Rerank | DashScope `text-embedding-v4`、`gte-rerank-v2`          | P0 真实 provider smoke 必须至少跑通一次                                        |
| 鉴权             | Argon2id、JWT access/refresh、token family rotation     | refresh token 只存 SHA-256，cookie 使用 HttpOnly/Secure/SameSite               |
| 反向代理         | Caddy 2                                                 | P1 部署使用，自动 HTTPS                                                        |
| 部署             | Docker Compose、GHCR pull-by-SHA、`release-vps`         | CI 构建镜像，VPS 只拉取镜像并执行 migration                                    |
| 可观测           | Sentry 浏览器端错误上报；Langfuse/Better Stack 待 P1    | 浏览器端 DSN 构建期注入；Web Vitals 生产上报、LLM trace 和外部探测待补齐       |
| 备份             | `pg_dump`、rclone、supercronic                          | backup 镜像资产已存在；restore-test 和生产启用仍待 P1                          |

---

## 架构图

```mermaid
flowchart TB
    User([用户浏览器]) --> Web[Next.js Web<br/>App Router + RSC + useChatStream]
    Web --> API[NestJS API<br/>REST + SSE]

    API --> PG[(PostgreSQL 16<br/>pgvector + FTS + zhparser)]
    API --> Redis[(Redis 7<br/>BullMQ)]
    Worker[Worker<br/>parse + chunk + embedding] --> PG
    Worker --> Redis

    API --> Router{Provider Router}
    Router --> Qwen[Qwen-Plus]
    API --> DashScope[Embedding / Rerank Provider]

    API --> LocalStorage[(Local Storage Volume)]
    Worker --> LocalStorage
    Worker -. P1 .-> R2[(Cloudflare R2)]
    API -. P1 .-> Langfuse[LLM Trace]
    API -. P1 .-> Sentry[Server Error Tracking]
    Web --> Sentry[Browser Error Tracking]
    Web -. dev .-> Console[Web Vitals Console]
```

---

## 关键设计

### 一个 Postgres 承载业务数据、向量和全文检索

P0 使用 PostgreSQL 16 同时承载业务表、pgvector 向量和 PG FTS。这样可以减少基础设施数量，简化备份恢复和权限控制。代码层保留 `VectorStore` 抽象，后续规模增长后可评估是否重新讨论独立向量库。

### Hybrid Search + RRF + Rerank

初始检索链路：

1. BM25 召回候选。
2. 向量检索召回候选。
3. RRF 融合两路结果。
4. rerank 重排。
5. 选取最终上下文交给 LLM。

BM25 对 API 名、错误码、函数名等精确关键词更敏感；向量检索对语义相近表达更友好。两者融合后再 rerank，可以在工程复杂度可控的前提下提升回答上下文质量。

### Citation Protocol

```ts
type Citation = {
  id: string;
  documentId: string;
  sourceType: 'pdf' | 'markdown' | 'txt' | 'docx';
  chunkId: string;
  chunkText: string;
  score: number;
  page?: number;
  bbox?: { x: number; y: number; width: number; height: number; unit: 'ratio' };
  headingPath?: string[];
  anchor?: string;
};
```

P0 使用 Markdown 文本 citation，依赖 `chunkId + anchor + headingPath` 定位。PDF 的 `page + bbox` 是 Citation Protocol v2 的保留能力，进入 P1 后实现 viewer 和跳页高亮。

### LLM 调用边界

当前代码路径：

- provider router 由后端自研，集中在 `apps/api/src/providers`。
- Retrieval 与 generation 分别位于 `apps/api/src/retrieval` 和 `apps/api/src/generation`。
- Chat streaming 使用 NestJS `text/event-stream`，前端通过 `apps/web/src/features/chat/use-chat-stream.ts` 消费自定义 JSON SSE 事件。
- LangChain.js 与 Vercel AI SDK `useChat` 暂未接入；若后续要回到原锁定架构，需要独立 change 明确迁移范围和兼容策略。

---

## 项目结构

```text
devbrain/
├── apps/
│   ├── api/                 # NestJS API
│   ├── web/                 # Next.js Web
│   └── worker/              # worker
├── packages/
│   └── db/                  # Prisma schema、migration、generated client
├── infra/
│   ├── backup/              # backup image、backup.sh、crontab
│   ├── caddy/               # dev/prod Caddyfile
│   └── postgres/            # PostgreSQL 16 + pgvector + zhparser 镜像
├── docs/
│   └── planning/            # 产品需求和开发路线图
├── openspec/                # OpenSpec changes/specs
├── scripts/
│   └── release-vps.sh       # VPS 发布脚本
├── docker-compose.prod.yml
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── README.md
```

---

## 本地开发

### 前置条件

- Node 22+。
- pnpm 10.x。
- Docker 24+ 和 Docker Compose v2。

### 初始化

```bash
pnpm install
cp .env.example .env
```

### 启动基础依赖

```bash
docker compose up -d postgres redis
```

### 启动开发服务

```bash
pnpm dev
```

默认端口：

- Web: `http://localhost:3000`
- API: `http://localhost:3001`

### 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm format
docker compose config
```

Provider smoke 命令：

```bash
pnpm --filter @devbrain/worker smoke:embedding:dashscope
pnpm --filter @devbrain/api smoke:rerank:dashscope
pnpm --filter @devbrain/api smoke:llm:qwen
```

OpenAPI / generated client：

```bash
pnpm gen:openapi
pnpm gen:client
```

VPS 发布：

```bash
pnpm release:vps --dry-run
pnpm release:vps
```

首次部署和域名/CDN 切换见 `docs/deploy.md`、`docs/deploy-mvp.md` 和 `docs/config-domain.md`。

---

## P0 验收

- 注册/登录/退出可用。
- 新用户首次登录能看到空状态并创建个人 KB。
- 用户能上传 Markdown，并看到 worker 把文档推进到 `ready` 或 `failed`。
- Markdown 被解析为 chunks、embedding 和 FTS 字段。
- 用户能在 KB 内提问并收到真实 LLM 的流式回答。
- 回答包含文本 citation，点击后能定位到 chunk anchor 或 source panel。
- 本地 E2E 跑通：注册/登录 -> 空状态 -> 创建 KB -> 上传 Markdown -> 等待 ready -> 提问 -> citation 定位。
- 真实 DashScope embedding、DashScope rerank、Qwen-Plus smoke 至少手动跑通一次。

---

## Roadmap

### P0

- [x] 注册/登录。
- [x] 空状态。
- [x] 创建个人 KB。
- [x] 上传 Markdown。
- [x] worker ready。
- [x] 真实的检索/生成。
- [x] Chat streaming。
- [x] 文本 citation 定位。

### P0 收尾性能优化专项

- [ ] `optimize-web-first-load-perf`：仓库内大部分代码改造已落地，包括受保护段 RSC 静态外壳、路由级骨架、客户端 auth/KB 并行 fetch、双 Caddyfile、HTTPS/HTTP/2 生产配置、静态资源 `immutable`、容器 healthcheck、Web Vitals 开发期采集和 Sentry 浏览器端错误上报。仍待补齐或归档：Web Vitals 生产上报、Cloudflare cache status、真实 LCP/TTFB/INP、Sentry 面板证据和 SSE 经 CDN 冒烟。详见 `openspec/changes/optimize-web-first-load-perf/`、`docs/planning/devbrain-prd.md` §11.5 和 `docs/deploy-mvp.md`。

### P1

- [ ] 原 P0 剩余产品化能力：找回密码、team、多格式文档、完整文档管理、模型设置、部署、监控、备份、反馈闭环。
- [ ] 原 P1 候选能力：评测、代码搜索、面试题模式、多模型对比、repo ingest、共享链接、PDF/移动端优化。

## License

MIT
