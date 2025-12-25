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
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd"
cd "$PROJECT_ROOT"

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
        echo -e "${YELLOW}要求版本: v22.x${NC}"
        exit 1
    elif [ "$NODE_MAJOR" -ge 23 ]; then
        echo -e "${YELLOW}⚠ Node.js 版本可能过高！${NC}"
        echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
        echo -e "${YELLOW}建议版本: v22.20.0${NC}"
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
cd app/desktop
npm install
cd -

# 安装 packages/admin-ui 依赖
echo "Installing dependencies for packages/admin-ui..."
cd packages/admin-ui
npm install
cd -

# 清理缓存
echo "Cleaning up cache..."
rm -rf ~/Library/Application\ Support/@becrafter/prompt-desktop/prompt-manager

if [ "$1" != "dev" ]; then
  # 构建 admin-ui
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}构建前端资源${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo "Building admin-ui..."
  npm run admin:build
fi

# 构建根目录环境
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}构建根目录环境${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Building root environment..."
npm install

# 根据参数执行 desktop 构建
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}构建桌面应用${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Building desktop app..."

case "$1" in
  "dev")
    npm run dev --prefix app/desktop
    ;;
  "build:all")
    npm run build --prefix app/desktop -- --mac --win --linux
    ;;
  "build:mac")
    npm run build --prefix app/desktop -- --mac
    ;;
  "build:win")
    npm run build --prefix app/desktop -- --win
    ;;
  "build:linux")
    npm run build --prefix app/desktop -- --linux
    ;;
  *)
    npm run build --prefix app/desktop
    ;;
esac

# 打印构建完成时间
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}构建完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Time: $(date +'%Y-%m-%d %H:%M:%S')\n"
