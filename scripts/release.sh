#!/usr/bin/env bash
# @becrafter/prompt-manager 发布脚本 —— 版本号唯一来源是 git tag(只读,不创建/推送)。
# 发布前预检(npm ci + check:deps + build),强制走官方 registry,支持 --dry-run。
# 桌面应用的构建/上传由 release 工作流的独立 job 负责,不在本脚本范围。
#
# 用法:
#   ./scripts/release.sh            # CI:版本取自当前 git tag(如 v1.2.3 / v1.2.3-beta.1)
#   ./scripts/release.sh 1.2.3      # 本地:显式指定版本(不创建/推送 tag)
#   ./scripts/release.sh --dry-run  # 只预检 + npm publish --dry-run,不真发
#
# 环境变量:
#   NPM_REGISTRY  覆盖发布目标 registry(默认 https://registry.npmjs.org/)
#   CI=true 时依赖 NODE_AUTH_TOKEN(由 setup-node 注入 .npmrc),跳过交互登录。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
export NPM_REGISTRY

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${CYAN}▸${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
die()  { echo -e "${RED}✗${NC} $1" >&2; exit 1; }

DRY_RUN=false
VERSION_ARG=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -h|--help) sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) VERSION_ARG="$arg" ;;
  esac
done

# ── 版本号:唯一来源是 git tag(只读),本地可用参数显式指定 ──
if [[ -n "$VERSION_ARG" ]]; then
  VERSION="${VERSION_ARG#v}"
else
  TAG="$(git describe --tags --exact-match 2>/dev/null || echo "")"
  [[ -n "$TAG" ]] || die "当前 HEAD 无 tag;CI 需由 tag 触发,本地请显式指定版本: ./scripts/release.sh 1.2.3"
  VERSION="${TAG#v}"
fi
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.\-]+)?$ ]] || die "非法版本号: $VERSION"

# ── npm tag:latest / beta / alpha / rc / dev(未知预发布格式直接拒绝)──
case "$VERSION" in
  *-beta.*)  NPM_TAG=beta ;;
  *-alpha.*) NPM_TAG=alpha ;;
  *-rc.*)    NPM_TAG=rc ;;
  *-dev.*)   NPM_TAG=dev ;;
  *-*)       die "不支持的预发布版本格式: $VERSION(仅支持 -beta.* / -alpha.* / -rc.* / -dev.*)" ;;
  *)         NPM_TAG=latest ;;
esac

# ── 预检:官方 registry + 本地 npm 配置提示 ──
info "版本 $VERSION → npm tag $NPM_TAG(registry: $NPM_REGISTRY)$($DRY_RUN && echo ' [dry-run]')"
LOCAL_REG="$(npm config get registry 2>/dev/null | tr -d '\r')"
if [[ -n "$LOCAL_REG" && "$LOCAL_REG" != "$NPM_REGISTRY" && "$LOCAL_REG" != "undefined" && "$LOCAL_REG" != "null" ]]; then
  warn "本地默认 registry 指向 $LOCAL_REG(非官方);发布强制走官方 $NPM_REGISTRY"
fi

npm ci || die "npm ci 失败"
# 同步各文件版本与 tag(只改本地文件,不创建/推送 git tag;
# --dry-run 同样同步以便预览准确,结束后可 git checkout -- . 还原)
node scripts/update-version.js "$VERSION" || die "同步版本失败"
npm run check:deps || die "check:deps 失败"
npm run build || die "build 失败"

# ── 发布(强制官方 registry)──
if $DRY_RUN; then
  info "dry-run: npm publish --dry-run,不真发"
  npm publish --tag "$NPM_TAG" --registry "$NPM_REGISTRY" --dry-run
else
  npm publish --tag "$NPM_TAG" --registry "$NPM_REGISTRY"
fi
ok "版本 $VERSION 发布完成(tag: $NPM_TAG)"
