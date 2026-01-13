#!/bin/bash

# 前后端联动调试脚本
# 同时启动后端服务器和前端开发服务器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$PROJECT_ROOT/packages/server"
ADMIN_UI_DIR="$PROJECT_ROOT/packages/admin-ui"

# PID 文件
PIDS_DIR="$PROJECT_ROOT/.pids"
mkdir -p "$PIDS_DIR"

BACKEND_PID_FILE="$PIDS_DIR/backend.pid"
FRONTEND_PID_FILE="$PIDS_DIR/frontend.pid"

# 环境检查函数
check_environment() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}检查开发环境${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    # 检查 Node.js 版本
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js 未安装${NC}"
        echo -e "${YELLOW}请访问 https://nodejs.org/ 下载安装${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    
    echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"
    
    # 检查版本是否符合要求
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo -e "${RED}✗ Node.js 版本过低！${NC}"
        echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
        echo -e "${YELLOW}要求版本: v22.x${NC}"
        echo -e "${YELLOW}建议版本: v22.20.0${NC}"
        echo ""
        echo -e "${BLUE}升级方法:${NC}"
        echo -e "${YELLOW}nvm install 22${NC}"
        echo -e "${YELLOW}nvm use 22${NC}"
        echo -e "${YELLOW}nvm alias default 22${NC}"
        exit 1
    elif [ "$NODE_MAJOR" -ge 23 ]; then
        echo -e "${YELLOW}⚠ Node.js 版本可能过高！${NC}"
        echo -e "${YELLOW}当前版本: $NODE_VERSION${NC}"
        echo -e "${YELLOW}建议版本: v22.20.0${NC}"
        echo -e "${YELLOW}可能存在兼容性问题，建议使用 v22.x 版本${NC}"
        echo ""
        read -p "是否继续？(y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
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
    
    # 检查 node-pty
    if [ -d "$SERVER_DIR/node_modules/node-pty" ]; then
        echo -e "${GREEN}✓ node-pty 已安装${NC}"
        
        # 快速测试 node-pty 是否可用
        if node -e "import('node-pty').then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; then
            echo -e "${GREEN}✓ node-pty 可以正常加载${NC}"
        else
            echo -e "${YELLOW}⚠ node-pty 可能需要重建${NC}"
            echo -e "${YELLOW}正在重建 node-pty...${NC}"
            cd "$SERVER_DIR"
            npm rebuild node-pty
            cd "$PROJECT_ROOT"
        fi
    else
        echo -e "${YELLOW}⚠ node-pty 未安装${NC}"
        echo -e "${YELLOW}将在安装依赖时处理${NC}"
    fi
    
    echo ""
}

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在停止所有服务...${NC}"
    
    # 停止后端
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            echo -e "${BLUE}停止后端服务 (PID: $BACKEND_PID)${NC}"
            kill $BACKEND_PID 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # 停止前端
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            echo -e "${BLUE}停止前端服务 (PID: $FRONTEND_PID)${NC}"
            kill $FRONTEND_PID 2>/dev/null || true
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    echo -e "${GREEN}所有服务已停止${NC}"
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 检查端口是否可用
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}错误: 端口 $port 已被占用 ($service)${NC}"
        echo -e "${YELLOW}请先停止占用该端口的服务或修改配置${NC}"
        exit 1
    fi
}

# 启动后端服务
start_backend() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}启动后端服务器${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    cd "$SERVER_DIR"
    
    # 检查端口
    check_port 5621 "后端服务"
    
    # 启动后端（使用 --watch 自动重启）
    echo -e "${GREEN}后端服务启动中...${NC}"
    echo -e "${YELLOW}访问地址: http://localhost:5621${NC}"
    echo -e "${YELLOW}API 地址: http://localhost:5621/adminapi${NC}"
    echo ""
    
    node --watch server.js > "$PIDS_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$BACKEND_PID_FILE"
    
    # 等待后端启动
    echo -e "${YELLOW}等待后端服务启动...${NC}"
    sleep 3
    
    # 检查后端是否启动成功
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端服务启动成功 (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}✗ 后端服务启动失败${NC}"
        cat "$PIDS_DIR/backend.log"
        exit 1
    fi
    
    echo ""
}

    # 启动前端服务
    start_frontend() {
      echo -e "${BLUE}========================================${NC}"
      echo -e "${BLUE}启动前端开发服务器${NC}"
      echo -e "${BLUE}========================================${NC}"
      
      cd "$ADMIN_UI_DIR"
      
      # 检查端口
      check_port 6521 "前端服务"
      
      # 启动前端（使用watch模式保持运行）
      echo -e "${GREEN}前端服务启动中...${NC}"
      echo -e "${YELLOW}访问地址: http://localhost:9000${NC}"
      echo -e "${YELLOW}后端地址: http://localhost:5621 (通过环境变量传递)${NC}"
      echo ""
      
      # 使用 env 命令确保环境变量被传递到子进程
      # 注意：使用 --watch 参数保持webpack-dev-server持续运行
      env HTTP_PORT=5621 npx webpack serve --mode development --watch > "$PIDS_DIR/frontend.log" 2>&1 &
      FRONTEND_PID=$!
      echo $FRONTEND_PID > "$FRONTEND_PID_FILE"
      
      # 等待前端启动
      echo -e "${YELLOW}等待前端服务启动...${NC}"
      sleep 10
      
      # 检查前端是否启动成功
      if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 前端服务启动成功 (PID: $FRONTEND_PID)${NC}"
      else
        echo -e "${RED}✗ 前端服务启动失败${NC}"
        cat "$PIDS_DIR/frontend.log"
        exit 1
      fi
      
      echo ""
    }

# 显示服务信息
show_info() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}所有服务已启动${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${BLUE}后端服务:${NC}"
    echo -e "  - 地址: http://localhost:5621"
    echo -e "  - API: http://localhost:5621/adminapi"
    echo -e "  - 日志: $PIDS_DIR/backend.log"
    echo ""
    echo -e "${BLUE}前端服务:${NC}"
    echo -e "  - 地址: http://localhost:6521"
    echo -e "  - 日志: $PIDS_DIR/frontend.log"
    echo ""
    echo -e "${YELLOW}提示:${NC}"
    echo -e "  - 按 Ctrl+C 停止所有服务"
    echo -e "  - 前端修改会自动热更新"
    echo -e "  - 后端修改会自动重启"
    echo -e "  - 查看日志: tail -f $PIDS_DIR/backend.log 或 $PIDS_DIR/frontend.log"
    echo ""
}

# 主函数
main() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Prompt Manager 开发环境${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    # 检查环境
    check_environment
    
    # 检查依赖
    if [ ! -d "$SERVER_DIR/node_modules" ]; then
        echo -e "${YELLOW}安装后端依赖...${NC}"
        cd "$SERVER_DIR" && npm install
    fi
    
    if [ ! -d "$ADMIN_UI_DIR/node_modules" ]; then
        echo -e "${YELLOW}安装前端依赖...${NC}"
        cd "$ADMIN_UI_DIR" && npm install
    fi
    
    # 启动服务
    start_backend
    start_frontend
    show_info
    
    # 保持脚本运行
    wait
}

# 运行主函数
main
