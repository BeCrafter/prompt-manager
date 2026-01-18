# 快速开始指南

## 🚀 一键启动

### 开发环境
```bash
# 完整验证并启动（推荐）
npm run desktop:verify

# 仅启动开发环境
npm run desktop:dev
```

### 生产构建
```bash
# 构建所有平台
npm run desktop:build:all

# 构建特定平台
npm run desktop:build:mac    # macOS
npm run desktop:build:win    # Windows
npm run desktop:build:linux  # Linux
```

## 📋 可用命令

### 🔄 依赖管理

#### 检查和安装依赖
```bash
# 检查所有依赖并自动安装缺失的依赖
npm run check:deps

# 完整检查：依赖 + 模块加载测试
npm run desktop:check
```

#### 安装特定依赖
```bash
# 安装根目录依赖
npm install

# 安装 packages/server 依赖
cd packages/server && npm install

# 安装 app/desktop 依赖
cd app/desktop && npm install

# 安装 packages/admin-ui 依赖
cd packages/admin-ui && npm install
```

### 🧪 测试

#### 运行测试
```bash
# 运行所有测试
npm test

# 仅运行模块加载测试
npm run test:module-loading

# 运行服务端测试
npm run test:server

# 运行端到端测试
npm run test:e2e
```

### 🖥️ 桌面应用

#### 开发环境
```bash
# 启动桌面应用开发环境
npm run desktop:dev

# 完整验证并启动（推荐）
npm run desktop:verify
```

#### 生产构建
```bash
# 构建桌面应用
npm run desktop:build

# 构建所有平台
npm run desktop:build:all

# 构建特定平台
npm run desktop:build:mac
npm run desktop:build:win
npm run desktop:build:linux
```

### 🔧 开发工具

#### 代码质量
```bash
# 代码检查
npm run lint

# 代码格式化
npm run format

# 检查代码格式
npm run format:check
```

## 📝 工作流程

### 首次设置
```bash
# 1. 克隆仓库
git clone https://github.com/BeCrafter/prompt-manager.git
cd prompt-manager

# 2. 检查并安装所有依赖
npm run check:deps

# 3. 运行测试验证
npm run test:module-loading

# 4. 启动开发环境
npm run desktop:verify
```

### 日常开发
```bash
# 1. 拉取最新代码
git pull

# 2. 检查依赖
npm run check:deps

# 3. 启动开发环境
npm run desktop:dev
```

### 发布前检查
```bash
# 1. 运行所有测试
npm test

# 2. 检查代码质量
npm run lint
npm run format:check

# 3. 构建应用
npm run desktop:build:all

# 4. 运行端到端测试
npm run test:e2e
```

## ⚠️ 常见问题

### 问题：模块加载失败
**错误信息**：`ERR_MODULE_NOT_FOUND` 或 `Could not find core library`

**解决方案**：
```bash
# 运行依赖检查和安装
npm run check:deps

# 重新安装 packages/server 依赖
cd packages/server && npm install

# 重新安装 app/desktop 依赖
cd app/desktop && npm install
```

### 问题：端口被占用
**错误信息**：`端口 5621 已被占用`

**解决方案**：
```bash
# 查找占用端口的进程
lsof -i :5621

# 杀死进程
kill -9 <PID>

# 或者使用其他端口
PORT=5621 npm run desktop:dev
```

### 问题：Node.js 版本不兼容
**错误信息**：`Unsupported engine`

**解决方案**：
```bash
# 检查当前 Node.js 版本
node --version

# 如果版本过高，可以继续使用，但可能会有兼容性问题
# 推荐使用 Node.js v22.20.0
```

## 📊 依赖检查脚本说明

`scripts/check-dependencies.sh` 脚本会自动检查以下内容：

1. ✅ Node.js 版本检查
2. ✅ 根目录依赖安装
3. ✅ packages/server 依赖安装
4. ✅ 关键依赖验证（ws, express, @modelcontextprotocol/sdk）
5. ✅ app/desktop 依赖安装
6. ✅ Electron 安装验证
7. ✅ packages/admin-ui 依赖安装

## 🎯 推荐使用方式

### 最简单的方式
```bash
# 一键启动（自动检查依赖并启动）
npm run desktop:verify
```

### 最安全的方式
```bash
# 完整检查流程
npm run check:deps          # 检查依赖
npm run test:module-loading # 运行测试
npm run desktop:dev         # 启动应用
```

### 构建发布版本
```bash
# 完整构建流程
npm run check:deps          # 检查依赖
npm test                    # 运行测试
npm run desktop:build:all   # 构建所有平台
```

## 🔍 故障排查

### 查看日志
```bash
# 查看桌面应用日志
cat ~/Library/Application\ Support/@becrafter/prompt-desktop/prompt-manager-desktop.log

# macOS
tail -f ~/Library/Application\ Support/@becrafter/prompt-desktop/prompt-manager-desktop.log

# Linux
tail -f ~/.config/@becrafter/prompt-desktop/prompt-manager-desktop.log

# Windows
type %APPDATA%\@becrafter\prompt-desktop\prompt-manager-desktop.log
```

### 清理缓存
```bash
# 清理 npm 缓存
npm cache clean --force

# 清理应用缓存
rm -rf ~/Library/Application\ Support/@becrafter/prompt-desktop

# 重新安装依赖
rm -rf node_modules
npm install
```

## 📚 更多信息

- [项目 README](README.md)
- [开发文档](docs/dev/TOOL_DEVELOPMENT_GUIDE.md)
- [API 文档](packages/server/README.md)