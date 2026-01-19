#!/bin/bash

# 环境清理脚本
# 用于清理所有缓存和依赖，解决环境安装不一致问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 清理函数
cleanup_cache() {
    log_info "清理 NPM 缓存..."
    npm cache clean --force 2>/dev/null || log_warning "清理 NPM 缓存失败，继续..."

    log_info "清理 Yarn 缓存..."
    yarn cache clean 2>/dev/null || log_warning "清理 Yarn 缓存失败，继续..."
}

cleanup_node_modules() {
    log_info "删除所有 node_modules 目录..."

    # 删除根目录的 node_modules
    if [ -d "node_modules" ]; then
        rm -rf node_modules
        log_success "删除根目录 node_modules"
    fi

    # 删除子包的 node_modules
    for dir in packages/* app/*; do
        if [ -d "$dir/node_modules" ]; then
            rm -rf "$dir/node_modules"
            log_success "删除 $dir/node_modules"
        fi
    done
}

cleanup_lockfiles() {
    log_info "删除所有锁定文件..."

    # 删除根目录的锁定文件
    for lockfile in package-lock.json yarn.lock pnpm-lock.yaml; do
        if [ -f "$lockfile" ]; then
            rm -f "$lockfile"
            log_success "删除根目录 $lockfile"
        fi
    done

    # 删除子包的锁定文件
    for dir in packages/* app/*; do
        for lockfile in package-lock.json yarn.lock pnpm-lock.yaml; do
            if [ -f "$dir/$lockfile" ]; then
                rm -f "$dir/$lockfile"
                log_success "删除 $dir/$lockfile"
            fi
        done
    done
}

cleanup_build_artifacts() {
    log_info "清理构建产物..."

    # 删除构建目录
    if [ -d "dist" ]; then
        rm -rf dist
        log_success "删除构建目录 dist"
    fi

    if [ -d "packages/web" ]; then
        rm -rf packages/web
        log_success "删除前端构建产物 packages/web"
    fi

    # 删除服务器构建产物
    if [ -d "packages/server/dist" ]; then
        rm -rf packages/server/dist
        log_success "删除服务器构建产物 packages/server/dist"
    fi

    # 删除桌面应用构建产物
    if [ -d "app/desktop/dist" ]; then
        rm -rf app/desktop/dist
        log_success "删除桌面应用构建产物 app/desktop/dist"
    fi

    # 清理其他可能的构建缓存
    find . -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name ".nuxt" -type d -exec rm -rf {} + 2>/dev/null || true
}

cleanup_temp_files() {
    log_info "清理临时文件..."

    # 删除 npm 调试日志
    find . -name "npm-debug.log*" -type f -delete 2>/dev/null || true
    find . -name ".npm" -type d -exec rm -rf {} + 2>/dev/null || true

    # 删除 yarn 调试文件
    find . -name ".yarn-integrity" -type f -delete 2>/dev/null || true

    # 删除操作系统临时文件
    find . -name "*.tmp" -type f -delete 2>/dev/null || true
    find . -name "*.temp" -type f -delete 2>/dev/null || true
    find . -name "*~" -type f -delete 2>/dev/null || true

    # 删除可能由构建过程产生的异常文件（比如electron-builder的特殊字符文件）
    node scripts/cleanup-invalid-files.js --target packages/server 2>/dev/null || true
    node scripts/cleanup-invalid-files.js --target app/desktop/node_modules/@becrafter/prompt-manager-core 2>/dev/null || true

    log_success "临时文件清理完成"
}

reinstall_dependencies() {
    log_info "重新安装依赖..."

    # 设置npm镜像源
    npm config set registry https://registry.npmmirror.com

    # 清理npm环境变量
    unset npm_config_prefix
    unset npm_config_cache
    unset npm_config_tmp
    unset npm_config_userconfig
    unset npm_config_globalconfig
    unset npm_config_localprefix

    # 安装根目录依赖
    log_info "安装根目录依赖..."
    npm install --ignore-scripts

    # 安装桌面应用依赖
    if [ -d "app/desktop" ]; then
        log_info "安装桌面应用依赖..."
        (cd app/desktop && npm install)
    fi

    # 安装admin-ui依赖
    if [ -d "packages/admin-ui" ]; then
        log_info "安装 admin-ui 依赖..."
        (cd packages/admin-ui && npm install)
    fi

    # 安装server依赖
    if [ -d "packages/server" ]; then
        log_info "安装 server 依赖..."
        (cd packages/server && npm install --ignore-scripts)
    fi

    log_success "依赖重新安装完成"
}

verify_installation() {
    log_info "验证安装..."

    # 检查根目录依赖
    if [ -d "node_modules" ] && [ -f "package.json" ]; then
        log_success "根目录依赖安装正常"
    else
        log_error "根目录依赖安装失败"
        return 1
    fi

    # 检查桌面应用依赖
    if [ -d "app/desktop/node_modules" ]; then
        log_success "桌面应用依赖安装正常"
    else
        log_warning "桌面应用依赖可能有问题"
    fi

    # 检查admin-ui依赖
    if [ -d "packages/admin-ui/node_modules" ]; then
        log_success "admin-ui 依赖安装正常"
    else
        log_warning "admin-ui 依赖可能有问题"
    fi

    # 检查server依赖
    if [ -d "packages/server/node_modules" ]; then
        log_success "server 依赖安装正常"
    else
        log_warning "server 依赖可能有问题"
    fi

    return 0
}

main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}环境清理脚本${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    log_info "开始清理环境..."

    # 执行清理步骤
    cleanup_cache
    cleanup_node_modules
    cleanup_lockfiles
    cleanup_build_artifacts
    cleanup_temp_files
    reinstall_dependencies

    # 验证安装
    if verify_installation; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        log_success "环境清理完成！"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        log_info "建议运行以下命令验证构建："
        echo "  npm run verify"
        echo "  npm run build:desktop"
    else
        echo ""
        echo -e "${RED}========================================${NC}"
        log_error "环境清理过程中出现问题，请检查上述错误信息"
        echo -e "${RED}========================================${NC}"
        exit 1
    fi
}

# 检查参数
case "${1:-}" in
    "cache-only")
        log_info "仅清理缓存..."
        cleanup_cache
        log_success "缓存清理完成"
        ;;
    "deps-only")
        log_info "仅清理依赖..."
        cleanup_node_modules
        cleanup_lockfiles
        reinstall_dependencies
        verify_installation
        ;;
    "build-only")
        log_info "仅清理构建产物..."
        cleanup_build_artifacts
        log_success "构建产物清理完成"
        ;;
    "help"|"-h"|"--help")
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  cache-only    仅清理缓存"
        echo "  deps-only     仅清理和重新安装依赖"
        echo "  build-only    仅清理构建产物"
        echo "  help          显示此帮助信息"
        echo ""
        echo "不带参数运行将执行完整清理流程"
        ;;
    *)
        main
        ;;
esac