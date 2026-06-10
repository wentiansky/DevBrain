#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
DevBrain VPS 发布脚本

用法：
  scripts/release-vps.sh [选项]
  pnpm release:vps [选项]

选项：
  --host <host>      VPS 地址或 SSH alias，默认 devbrain，也可用 VPS_HOST
  --user <user>      SSH 用户；显式传 --host 时默认 devbrain，也可用 VPS_USER
  --path <path>      VPS 项目目录，默认 /opt/devbrain，也可用 VPS_PATH
  --tag <tag>        镜像 tag，默认 sha-<当前 HEAD>，也可用 IMAGE_TAG
  --ref <ref>        远端 git ref，默认当前完整 SHA，也可用 GIT_REF
  --port <port>      SSH 端口，默认 22，也可用 SSH_PORT
  --dry-run          只打印将执行的命令，不连接 VPS
  -h, --help         显示帮助

前置条件：
  1. 本地代码已推送到 GitHub。
  2. GitHub Actions 已构建并推送对应 tag 的 GHCR 镜像。
  3. VPS 已登录 GHCR，并且项目目录存在 docker-compose.yml、docker-compose.prod.yml、.env。

示例：
  pnpm release:vps
  scripts/release-vps.sh --host 1.2.3.4
  scripts/release-vps.sh --host devbrain.example.com --tag sha-2604d06...
  VPS_HOST=1.2.3.4 VPS_USER=devbrain pnpm release:vps
EOF
}

log() {
  printf '[release] %s\n' "$*"
}

die() {
  printf '[release] 错误：%s\n' "$*" >&2
  exit 1
}

shell_quote() {
  printf "%q" "$1"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令：$1"
}

HOST_WAS_SET=0
if [[ -n "${VPS_HOST:-}" ]]; then
  HOST_WAS_SET=1
fi

VPS_HOST="${VPS_HOST:-devbrain}"
VPS_USER="${VPS_USER:-}"
VPS_PATH="${VPS_PATH:-/opt/devbrain}"
IMAGE_TAG="${IMAGE_TAG:-}"
GIT_REF="${GIT_REF:-}"
SSH_PORT="${SSH_PORT:-22}"
DRY_RUN=0
USER_WAS_SET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      [[ $# -ge 2 ]] || die "--host 缺少参数"
      VPS_HOST="$2"
      HOST_WAS_SET=1
      shift 2
      ;;
    --user)
      [[ $# -ge 2 ]] || die "--user 缺少参数"
      VPS_USER="$2"
      USER_WAS_SET=1
      shift 2
      ;;
    --path)
      [[ $# -ge 2 ]] || die "--path 缺少参数"
      VPS_PATH="$2"
      shift 2
      ;;
    --tag)
      [[ $# -ge 2 ]] || die "--tag 缺少参数"
      IMAGE_TAG="$2"
      shift 2
      ;;
    --ref)
      [[ $# -ge 2 ]] || die "--ref 缺少参数"
      GIT_REF="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || die "--port 缺少参数"
      SSH_PORT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --)
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "未知参数：$1"
      ;;
  esac
done

require_command git
require_command ssh

HEAD_SHA="$(git rev-parse HEAD 2>/dev/null)" || die "无法读取当前 git HEAD"

if [[ -n "$(git status --porcelain)" ]]; then
  log "警告：当前工作区有未提交改动；默认只发布已提交的 HEAD 镜像。"
fi

if [[ -z "$GIT_REF" ]]; then
  GIT_REF="$HEAD_SHA"
fi

if [[ -z "$IMAGE_TAG" ]]; then
  IMAGE_TAG="sha-$HEAD_SHA"
fi

[[ -n "$VPS_HOST" ]] || die "请通过 --host 或 VPS_HOST 指定 VPS 地址"
[[ -n "$VPS_PATH" ]] || die "请通过 --path 或 VPS_PATH 指定 VPS 项目目录"

if [[ -z "$VPS_USER" && "$HOST_WAS_SET" -eq 1 && "$USER_WAS_SET" -eq 0 ]]; then
  VPS_USER="devbrain"
fi

if [[ -n "$VPS_USER" ]]; then
  SSH_TARGET="$VPS_USER@$VPS_HOST"
else
  SSH_TARGET="$VPS_HOST"
fi

REMOTE_PROJECT_DIR="$(shell_quote "$VPS_PATH")"
REMOTE_GIT_REF="$(shell_quote "$GIT_REF")"
REMOTE_IMAGE_TAG="$(shell_quote "$IMAGE_TAG")"

read -r -d '' REMOTE_SCRIPT <<EOF || true
set -Eeuo pipefail

log() {
  printf '[remote-release] %s\\n' "\$*"
}

die() {
  printf '[remote-release] 错误：%s\\n' "\$*" >&2
  exit 1
}

cd $REMOTE_PROJECT_DIR

[[ -f .env ]] || die "当前目录缺少 .env"
[[ -d .git ]] || die "当前目录不是 git 仓库"

log "拉取 git ref: $GIT_REF"
git fetch --depth=1 origin $REMOTE_GIT_REF
git checkout --detach FETCH_HEAD

[[ -f docker-compose.yml ]] || die "当前目录缺少 docker-compose.yml"
[[ -f docker-compose.prod.yml ]] || die "当前目录缺少 docker-compose.prod.yml"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

log "更新 .env IMAGE_TAG=$IMAGE_TAG"
if grep -q '^IMAGE_TAG=' .env; then
  sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=$REMOTE_IMAGE_TAG/" .env
else
  printf '\\nIMAGE_TAG=%s\\n' $REMOTE_IMAGE_TAG >> .env
fi

log "校验 compose 配置"
"\${COMPOSE[@]}" config >/tmp/devbrain-compose.yml

log "拉取生产镜像"
"\${COMPOSE[@]}" pull postgres api web worker

log "启动数据库与 Redis"
"\${COMPOSE[@]}" up -d postgres redis

log "执行数据库迁移"
"\${COMPOSE[@]}" run --rm -T migrate </dev/null

log "升级业务服务"
"\${COMPOSE[@]}" up -d api web worker caddy

log "当前服务状态"
"\${COMPOSE[@]}" ps

log "发布完成：IMAGE_TAG=$IMAGE_TAG"
EOF

log "目标 VPS：$SSH_TARGET:$SSH_PORT"
log "远端目录：$VPS_PATH"
log "Git ref：$GIT_REF"
log "镜像 tag：$IMAGE_TAG"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "dry-run 模式，不会连接 VPS。远端将执行："
  printf '%s\n' "$REMOTE_SCRIPT"
  exit 0
fi

log "开始连接 VPS 并发布"
ssh -p "$SSH_PORT" "$SSH_TARGET" "bash -s" <<<"$REMOTE_SCRIPT"
