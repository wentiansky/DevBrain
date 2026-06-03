# VPS 发布脚本实现计划

> **给后续 agentic worker：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 新增一个本地执行的 VPS 发布脚本，用 SSH 连接服务器并把生产服务升级到指定 GHCR 镜像版本。

**架构：** 脚本在本地解析目标 VPS、远端项目目录和镜像 tag，默认使用当前 `HEAD` 生成 `sha-<full-sha>`。远端执行时进入部署目录，切换到对应 commit，更新 `.env` 中的 `IMAGE_TAG`，再按现有 Docker Compose 生产流程执行 `config`、`pull`、`migrate`、`up` 和 `ps`。

**技术栈：** Bash、SSH、Git、Docker Compose、GHCR 镜像 tag、现有 `docker-compose.yml` + `docker-compose.prod.yml`。

---

### Task 1: 新增发布脚本

**Files:**
- Create: `scripts/release-vps.sh`

- [x] **Step 1: 编写脚本结构**

脚本使用 `set -Eeuo pipefail`，提供 `--help`、`--host`、`--user`、`--path`、`--tag`、`--ref`、`--port`、`--dry-run` 参数，并支持同名环境变量。

- [x] **Step 2: 实现本地校验**

校验 git 可用、当前 commit SHA 可解析、`VPS_HOST` 和 `VPS_PATH` 存在；默认 `VPS_USER=devbrain`、`VPS_PATH=/opt/devbrain`、`IMAGE_TAG=sha-<HEAD>`。

- [x] **Step 3: 实现远端升级命令**

远端执行 `git fetch`、`git checkout`、更新 `.env`、`docker compose config`、`pull`、`up -d postgres redis`、`run --rm migrate`、`up -d api web worker caddy`、`ps`。

- [x] **Step 4: 支持 dry-run**

`--dry-run` 只打印将要连接的目标、tag 和远端命令，不实际 SSH。

### Task 2: 新增 package 快捷命令

**Files:**
- Modify: `package.json`

- [x] **Step 1: 添加 `release:vps`**

新增 `release:vps`，命令为 `bash scripts/release-vps.sh`。

### Task 3: 验证

**Files:**
- Verify: `scripts/release-vps.sh`
- Verify: `package.json`

- [x] **Step 1: Bash 语法检查**

运行：`bash -n scripts/release-vps.sh`

期望：无输出，退出码为 0。

- [x] **Step 2: 帮助信息检查**

运行：`bash scripts/release-vps.sh --help`

期望：输出中文用法，退出码为 0。

- [x] **Step 3: dry-run 检查**

运行：`bash scripts/release-vps.sh --host example.com --dry-run`

期望：输出远端升级命令，不发起 SSH。
