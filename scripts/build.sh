#!/bin/bash

# 构建脚本
# 支持 Desktop 应用构建和开发环境设置

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

# 立即清理所有 npm 环境变量以避免与 nvm 冲突
unset npm_config_prefix
unset npm_config_cache
unset npm_config_tmp
unset npm_config_userconfig
unset npm_config_globalconfig
unset npm_config_localprefix

# 清理 npm 环境变量函数
unset_npm_config() {
    unset npm_config_prefix
    unset npm_config_cache
    unset npm_config_tmp
    unset npm_config_userconfig
    unset npm_config_globalconfig
    unset npm_config_localprefix
}

# 环境检查函数
check_environment() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}检查构建环境${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    # 检查 Node.js 版本
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js 未安装${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"
    
    # 检查版本
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo -e "${RED}✗ Node.js 版本过低！${NC}"
        echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
        echo -e "${YELLOW}要求版本: >=22.20.0 <23.0.0${NC}"
        exit 1
    elif [ "$NODE_MAJOR" -ge 23 ]; then
        echo -e "${RED}✗ Node.js 版本过高！${NC}"
        echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
        echo -e "${YELLOW}要求版本: >=22.20.0 <23.0.0${NC}"
        echo -e "${YELLOW}建议使用 Node.js v22.20.0${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Node.js 版本符合要求${NC}"
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm 未安装${NC}"
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm 版本: $NPM_VERSION${NC}"
    
    # 检查 node-pty（用于桌面应用）
    if [ -d "app/desktop/node_modules/node-pty" ]; then
        echo -e "${GREEN}✓ node-pty 已安装${NC}"
    else
        echo -e "${YELLOW}⚠ node-pty 未安装（将在安装依赖时处理）${NC}"
    fi
    
    echo ""
}

# 设置 npm 镜像源
echo "Setting npm registry to https://registry.npmmirror.com"
npm config set registry https://registry.npmmirror.com

# 检查环境
check_environment

# 安装 app/desktop 依赖
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}安装依赖${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Installing dependencies for app/desktop..."
# 使用 --ignore-scripts 跳过 postinstall 脚本，避免 Python 3.13 的 distutils 问题
# 原生模块将在后面使用 electron-rebuild 统一重建
(cd app/desktop && unset_npm_config && npm install --ignore-scripts)

# 重建 node-pty 以适配 Electron 的 Node.js 版本
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}重建 node-pty 模块${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Rebuilding node-pty for Electron..."
(cd app/desktop && unset_npm_config && npx electron-rebuild -f -w node-pty)
cd -

# 安装 packages/admin-ui 依赖
echo "Installing dependencies for packages/admin-ui..."
(cd packages/admin-ui && unset_npm_config && npm install)
cd -

# 安装 packages/server 依赖（核心服务依赖）
echo "Installing dependencies for packages/server..."
# 使用 --ignore-scripts 跳过 postinstall 脚本
(cd packages/server && unset_npm_config && npm install --ignore-scripts)
cd -

# 清理缓存
echo "Cleaning up cache..."
rm -rf ~/Library/Application\ Support/@becrafter/prompt-desktop/prompt-manager

  # 构建 admin-ui
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}构建前端资源${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo "Building admin-ui..."
  unset_npm_config && cd packages/admin-ui && npm run build

# 构建根目录环境
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}构建根目录环境${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Building root environment..."
# 使用 --ignore-scripts 跳过 postinstall 脚本
unset_npm_config && npm install --ignore-scripts

# 重建根目录的 node-pty 以适配 Electron
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}重建根目录 node-pty 模块${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Rebuilding node-pty for Electron in root directory..."
unset_npm_config && npx electron-rebuild -f -w node-pty --version=39.0.0

# 根据参数执行 desktop 构建
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}构建桌面应用${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Building desktop app..."

case "$1" in
  "dev")
    unset_npm_config && npm run dev --prefix app/desktop
    ;;
  "build:all")
    unset_npm_config && npm run build --prefix app/desktop -- --mac --win --linux
    ;;
  "build:mac")
    unset_npm_config && npm run build --prefix app/desktop -- --mac
    ;;
  "build:win")
    unset_npm_config && npm run build --prefix app/desktop -- --win
    ;;
  "build:linux")
    unset_npm_config && npm run build --prefix app/desktop -- --linux
    ;;
  *)
    unset_npm_config && npm run build --prefix app/desktop
    ;;
esac

# 打印构建完成时间
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}构建完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Time: $(date +'%Y-%m-%d %H:%M:%S')\n"
