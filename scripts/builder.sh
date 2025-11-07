#!/bin/bash

# 项目编译脚本

set -e  # 遇到错误时退出

# 获取脚本所在的目录路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    printf "${GREEN}%s${NC}\n" "$1"
}

log_warn() {
    printf "${YELLOW}%s${NC}\n" "$1"
}

log_error() {
    printf "${RED}%s${NC}\n" "$1"
}

# 创建符号链接函数
create_symlink() {
    local source="$1"
    local target="$2"
    local name="$3"
    
    if [ ! -L "$target" ]; then
        ln -sf "$source" "$target"
        log_info "$name 符号链接创建成功!"
    else
        log_warn "$name 符号链接已存在，跳过创建!"
    fi
}

# 清理符号链接函数
cleanup_symlinks() {
    rm -f "$PROJECT_ROOT/.npmrc" "$PROJECT_ROOT/.pnpmrc" "$PROJECT_ROOT/pnpm-workspace.yaml"
    if [ $? -eq 0 ]; then
        log_info "配置文件链接清理完成!"
    else
        log_error "配置文件链接清理失败!"
        exit 1
    fi
}

# 清理旧配置文件函数
cleanup_old_config() {
    local config_dir="$HOME/Library/Application Support/@becrafter/prompt-desktop/prompt-manager"
    
    if [ -d "$config_dir" ]; then
        rm -rf "$config_dir"
        if [ $? -eq 0 ]; then
            log_info "旧的配置文件已清理!"
        else
            log_error "清理旧的配置文件失败!"
        fi
    else
        log_info "旧的配置文件不存在，无需清理!"
    fi
}

# 主构建函数
build_app() {
    cd "$PROJECT_ROOT/app/desktop"
    
    # 确保依赖已安装
    log_info "检查并安装依赖..."
    if [ -f "package.json" ]; then
        if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
            log_info "正在安装依赖..."
            pnpm install || npm install || log_warn "依赖安装可能存在问题，继续构建..."
        else
            log_info "依赖已存在，跳过安装"
        fi
    else
        log_error "package.json 不存在!"
        exit 1
    fi
    
    npx electron-builder "$@"
    return $?
}

# 主程序开始
printf "Build started! Time: %s\n\n" "$(date +"%Y-%m-%d %H:%M:%S")"

# 编译前置操作
log_info "开始创建配置文件链接..."

# 创建指向 config 目录中配置文件的符号链接
create_symlink "config/npmrc" "$PROJECT_ROOT/.npmrc" ".npmrc"
create_symlink "config/pnpmrc" "$PROJECT_ROOT/.pnpmrc" ".pnpmrc"
create_symlink "config/pnpm-workspace.yaml" "$PROJECT_ROOT/pnpm-workspace.yaml" "pnpm-workspace.yaml"

printf "\n"

# 清理旧的配置文件
cleanup_old_config

printf "\n"

# 运行 Electron Builder 进行编译
log_info "开始构建 Electron 应用..."
if build_app "$@"; then
    log_info "Electron 应用编译完成!"
else
    log_error "Electron 应用编译失败!"
    cleanup_symlinks
    exit 1
fi

printf "\nBuild finished! Time: %s\n\n" "$(date +"%Y-%m-%d %H:%M:%S")"

# 编译后置操作
log_info "开始清理配置文件链接..."
cleanup_symlinks
