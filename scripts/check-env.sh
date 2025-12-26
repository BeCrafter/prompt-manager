#!/bin/bash

# 开发环境检查脚本
# 检查 Node.js 版本、npm 版本等开发环境要求

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

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Prompt Manager 开发环境检查${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 Node.js 版本
check_node_version() {
    echo -e "${BLUE}检查 Node.js 版本...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js 未安装${NC}"
        echo -e "${YELLOW}请访问 https://nodejs.org/ 下载安装${NC}"
        return 1
    fi
    
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"
    
    # 检查是否符合要求 (>=22.20.0 <23.0.0)
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo -e "${YELLOW}⚠ Node.js 版本过低，建议使用 v22.x${NC}"
        echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
        echo -e "${YELLOW}建议版本: v22.20.0${NC}"
    elif [ "$NODE_MAJOR" -ge 23 ]; then
        echo -e "${YELLOW}⚠ Node.js 版本过高，可能存在兼容性问题${NC}"
        echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
        echo -e "${YELLOW}建议版本: v22.20.0${NC}"
    else
        echo -e "${GREEN}✓ Node.js 版本符合要求${NC}"
    fi
    echo ""
}

# 检查 npm 版本
check_npm_version() {
    echo -e "${BLUE}检查 npm 版本...${NC}"
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm 未安装${NC}"
        return 1
    fi
    
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm 版本: $NPM_VERSION${NC}"
    echo ""
}

# 检查 nvm 是否安装
check_nvm() {
    echo -e "${BLUE}检查 Node.js 版本管理工具...${NC}"
    
    if [ -n "$NVM_DIR" ]; then
        echo -e "${GREEN}✓ nvm 已安装${NC}"
        echo -e "  NVM_DIR: $NVM_DIR"
    elif command -v nvm &> /dev/null; then
        echo -e "${GREEN}✓ nvm 已安装${NC}"
    else
        echo -e "${YELLOW}⚠ 未检测到 nvm${NC}"
        echo -e "${YELLOW}建议安装 nvm 以便管理 Node.js 版本${NC}"
        echo -e "${YELLOW}安装命令: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash${NC}"
    fi
    echo ""
}

# 检查依赖是否安装
check_dependencies() {
    echo -e "${BLUE}检查项目依赖...${NC}"
    
    if [ ! -d "node_modules" ] || [ ! -d "packages/server/node_modules" ] || [ ! -d "packages/admin-ui/node_modules" ]; then
        echo -e "${YELLOW}⚠ 部分依赖未安装${NC}"
        echo -e "${YELLOW}运行 'npm install' 安装依赖${NC}"
    else
        echo -e "${GREEN}✓ 所有依赖已安装${NC}"
    fi
    echo ""
}

# 检查 node-pty 状态
check_node_pty() {
    echo -e "${BLUE}检查 node-pty 模块...${NC}"
    
    if [ -d "packages/server/node_modules/node-pty" ]; then
        echo -e "${GREEN}✓ node-pty 已安装${NC}"
        
        # 检查是否需要重建
        if node -e "import('node-pty').then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; then
            echo -e "${GREEN}✓ node-pty 可以正常加载${NC}"
        else
            echo -e "${YELLOW}⚠ node-pty 可能需要重建${NC}"
            echo -e "${YELLOW}运行 'npm run fix:pty' 重建 node-pty${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ node-pty 未安装${NC}"
        echo -e "${YELLOW}运行 'npm install' 安装依赖${NC}"
    fi
    echo ""
}

# 显示环境信息
show_env_info() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}环境信息${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "操作系统: $(uname -s)"
    echo -e "架构: $(uname -m)"
    echo -e "Node.js: $(node --version)"
    echo -e "npm: $(npm --version)"
    echo -e "工作目录: $PROJECT_ROOT"
    echo ""
}

# 显示建议
show_suggestions() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}建议${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "1. 使用 nvm 管理 Node.js 版本:"
    echo -e "   ${YELLOW}nvm install 22${NC}"
    echo -e "   ${YELLOW}nvm use 22${NC}"
    echo -e "   ${YELLOW}nvm alias default 22${NC}"
    echo ""
    echo -e "2. 自动使用正确的 Node.js 版本:"
    echo -e "   ${YELLOW}cd $PROJECT_ROOT${NC}"
    echo -e "   ${YELLOW}nvm use${NC}"
    echo ""
    echo -e "3. 在 .nvmrc 中指定版本:"
    echo -e "   ${YELLOW}cat .nvmrc${NC}"
    echo ""
}

# 主函数
main() {
    check_node_version
    check_npm_version
    check_nvm
    check_dependencies
    check_node_pty
    show_env_info
    show_suggestions
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}环境检查完成${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# 运行主函数
main
