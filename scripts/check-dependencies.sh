#!/bin/bash

# 依赖检查和安装脚本
# 自动检查并安装所有必需的依赖

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

# 清理 npm 环境变量
unset_npm_config() {
    unset npm_config_prefix
    unset npm_config_cache
    unset npm_config_tmp
    unset npm_config_userconfig
    unset npm_config_globalconfig
    unset npm_config_localprefix
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}依赖检查和安装${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 Node.js 版本
echo -e "\n${BLUE}1. 检查 Node.js 版本${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js 未安装${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')

if [ "$NODE_MAJOR" -lt 22 ]; then
    echo -e "${RED}✗ Node.js 版本过低！${NC}"
    echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
    echo -e "${YELLOW}要求版本: >=22.20.0${NC}"
    exit 1
elif [ "$NODE_MAJOR" -ge 23 ]; then
    echo -e "${YELLOW}⚠ Node.js 版本高于推荐版本${NC}"
    echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
    echo -e "${YELLOW}推荐版本: v22.20.0${NC}"
    echo -e "${YELLOW}继续使用，但可能会遇到兼容性问题${NC}"
else
    echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"
fi

# 检查并安装根目录依赖
echo -e "\n${BLUE}2. 检查根目录依赖${NC}"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo -e "${YELLOW}⚠ 根目录依赖未安装，正在安装...${NC}"
    unset_npm_config && npm install
    echo -e "${GREEN}✓ 根目录依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ 根目录依赖已安装${NC}"
fi

# 检查并安装 packages/server 依赖
echo -e "\n${BLUE}3. 检查 packages/server 依赖${NC}"
if [ ! -d "packages/server/node_modules" ] || [ ! -f "packages/server/node_modules/.package-lock.json" ]; then
    echo -e "${YELLOW}⚠ packages/server 依赖未安装，正在安装...${NC}"
    (cd packages/server && unset_npm_config && npm install)
    echo -e "${GREEN}✓ packages/server 依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ packages/server 依赖已安装${NC}"
fi

# 检查关键依赖是否存在
echo -e "\n${BLUE}4. 验证关键依赖${NC}"

CRITICAL_DEPS=(
    "packages/server/node_modules/ws"
    "packages/server/node_modules/express"
    "packages/server/node_modules/@modelcontextprotocol/sdk"
)

MISSING_DEPS=0
for dep in "${CRITICAL_DEPS[@]}"; do
    if [ ! -d "$dep" ]; then
        echo -e "${RED}✗ 缺少关键依赖: $dep${NC}"
        MISSING_DEPS=$((MISSING_DEPS + 1))
    fi
done

if [ $MISSING_DEPS -gt 0 ]; then
    echo -e "${YELLOW}⚠ 发现 $MISSING_DEPS 个缺失的关键依赖，正在重新安装...${NC}"
    (cd packages/server && unset_npm_config && npm install)
    echo -e "${GREEN}✓ 依赖重新安装完成${NC}"
else
    echo -e "${GREEN}✓ 所有关键依赖都存在${NC}"
fi

# 检查并安装 app/desktop 依赖
echo -e "\n${BLUE}5. 检查 app/desktop 依赖${NC}"
if [ ! -d "app/desktop/node_modules" ] || [ ! -f "app/desktop/node_modules/.package-lock.json" ]; then
    echo -e "${YELLOW}⚠ app/desktop 依赖未安装，正在安装...${NC}"
    (cd app/desktop && unset_npm_config && npm install)
    echo -e "${GREEN}✓ app/desktop 依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ app/desktop 依赖已安装${NC}"
fi

# 检查 electron 是否存在
echo -e "\n${BLUE}6. 验证 Electron 安装${NC}"
if [ ! -d "app/desktop/node_modules/electron" ]; then
    echo -e "${YELLOW}⚠ Electron 未安装，正在安装...${NC}"
    (cd app/desktop && unset_npm_config && npm install)
    echo -e "${GREEN}✓ Electron 安装完成${NC}"
else
    echo -e "${GREEN}✓ Electron 已安装${NC}"
fi

# 检查并安装 packages/admin-ui 依赖
echo -e "\n${BLUE}7. 检查 packages/admin-ui 依赖${NC}"
if [ ! -d "packages/admin-ui/node_modules" ] || [ ! -f "packages/admin-ui/node_modules/.package-lock.json" ]; then
    echo -e "${YELLOW}⚠ packages/admin-ui 依赖未安装，正在安装...${NC}"
    (cd packages/admin-ui && unset_npm_config && npm install)
    echo -e "${GREEN}✓ packages/admin-ui 依赖安装完成${NC}"
else
    echo -e "${GREEN}✓ packages/admin-ui 依赖已安装${NC}"
fi

# 总结
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ 所有依赖检查和安装完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "\n${GREEN}现在可以运行以下命令：${NC}"
echo -e "  ${BLUE}npm run desktop:dev${NC}           - 启动桌面应用开发环境"
echo -e "  ${BLUE}npm run desktop:check${NC}         - 检查依赖和模块加载"
echo -e "  ${BLUE}npm run desktop:verify${NC}        - 完整验证并启动"
echo -e "  ${BLUE}npm run desktop:build${NC}         - 构建桌面应用"
echo -e "  ${BLUE}npm run test:module-loading${NC}   - 运行模块加载测试"
echo ""