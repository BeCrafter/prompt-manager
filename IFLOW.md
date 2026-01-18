# Prompt Manager 项目概述

## 项目简介

Prompt Manager 是一个基于 MCP（Model Context Protocol）协议的 Prompt 管理服务。它支持 HTTP 流式传输、提供 Web 管理界面和桌面应用，能够将静态提示词模板转换为可通过 API 调用的动态服务。

### 核心特性

- **MCP 协议支持**：完全兼容模型上下文协议（MCP），提供标准化的工具调用接口
- **HTTP 流式传输**：基于 StreamableHTTP 协议优化的 HTTP 流式传输，支持长连接和会话恢复
- **提示词管理**：自动发现子目录中的 prompt 文件，支持分组管理和启用/禁用控制
- **ToolM 系统**：内置工具管理系统，支持沙箱执行、动态加载和工具上传
- **终端集成**：提供 WebSocket 终端服务，支持实时命令执行和会话管理
- **提示词优化**：AI 辅助的提示词优化功能，支持流式输出和迭代改进
- **多界面支持**：原生 JS 管理界面和 Electron 桌面应用
- **灵活配置**：支持命令行参数、环境变量和配置文件进行配置

## 技术栈

- **后端**: Node.js (推荐 v22.x), Express.js
- **前端管理界面**:
  - 原生 JavaScript + CodeMirror（admin-ui）
- **协议**: MCP (Model Context Protocol)
- **桌面应用**: Electron
- **工具沙箱**: ES6 模块 + 限制性 API
- **包管理**: npm/pnpm

## 项目结构

```
prompt-manager/
├── app/
│   ├── cli/              # 命令行命令分发与共享工具
│   └── desktop/          # Electron 菜单应用
├── packages/
│   ├── server/           # 服务端核心逻辑
│   │   ├── api/          # API 路由（admin, open, tool, surge）
│   │   ├── mcp/          # MCP 协议实现
│   │   ├── toolm/        # ToolM 工具管理系统
│   │   ├── services/     # 核心服务（manager, websocket, terminal, optimization）
│   │   └── utils/        # 工具函数
│   ├── admin-ui/         # 原生 JS 管理界面
│   ├── resources/        # 内置工具资源
│   │   └── tools/        # 内置工具（filesystem, pdf-reader, chrome-devtools 等）
│   └── web/              # 静态 Web 资源
├── examples/
│   └── prompts/          # 示例提示词（首次启动同步到 ~/.prompt-manager/prompts）
├── scripts/              # 安装/维护脚本
├── docs/                 # 项目文档
│   ├── dev/              # 开发文档
│   ├── prd/              # 产品需求文档
│   ├── spec/             # 技术规范
│   └── ui/               # UI 设计文档
└── bin/                  # 可执行入口
```

## 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│   CLI 命令行     │  Electron 桌面  │   Web 管理界面           │
└────────┬────────┴────────┬────────┴──────────┬──────────────┘
         │                 │                   │
         └─────────────────┼───────────────────┘
                           │
         ┌─────────────────┴───────────────────┐
         │         Express 服务器 (端口 5621)   │
         └─────────────────┬───────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼────────┐      ┌─────▼──────┐      ┌────────▼────────┐
│  MCP 协议   │      │  Admin API │      │  ToolM 系统     │
│  (流式传输)  │      │  (管理接口) │      │  (工具沙箱)      │
└───┬────────┘      └─────┬──────┘      └────────┬────────┘
    │                     │                      │
    │               ┌─────▼──────┐               │
    │               │ Prompt     │               │
    │               │ Manager    │               │
    │               └─────┬──────┘               │
    │                     │                      │
    └─────────────────────┼──────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐  ┌───▼────┐  ┌──▼──────┐
         │ 文件系统 │  │ 终端服务│  │ 优化服务 │
         │ (~/.pm) │  │(动态)  │  │(AI 优化) │
         └─────────┘  └────────┘  └─────────┘
```

## MCP 协议实现

### MCP 工具列表

1. **`prompts`** - 提示词管理助手
   - `search`: 搜索提示词（支持关键词和语义搜索）
   - `get`: 获取指定提示词的完整内容
   - 位置: `packages/server/mcp/mcp.server.js:70`

2. **`toolm`** - 工具管理系统
   - 动态工具描述生成
   - 支持工具的 manual、execute、configure、log 模式
   - 位置: `packages/server/mcp/mcp.server.js:85`

3. **`thinking`** - 智能思考工具包
   - `exploratory`: 探索性思考场景
   - `execution`: 执行性思考场景
   - 位置: `packages/server/mcp/mcp.server.js:100`

### MCP 会话管理

- 使用 `StreamableHTTPServerTransport` 实现流式传输
- 会话恢复支持（`InMemoryEventStore`）
- 断开连接后 10 分钟会话保持（TTL）
- 长连接超时：24 小时

## ToolM 工具管理系统

### 核心服务

- **ToolLoaderService** (`tool-loader.service.js`): 扫描和加载沙箱中的工具
- **ToolExecutionService** (`tool-execution.service.js`): 在沙箱中执行工具
- **ToolDependencyService** (`tool-dependency.service.js`): 管理工具依赖
- **ToolContextService** (`tool-context.service.js`): 提供限制性 API 上下文
- **ToolSyncService** (`tool-sync.service.js`): 同步系统工具到沙箱

### 工具执行模式

- `manual`: 读取工具文档
- `execute`: 使用参数运行工具
- `configure`: 设置工具环境变量
- `log`: 查看工具日志

### 内置工具

位于 `packages/resources/tools/`:

- `filesystem` - 文件操作（读写、删除、列表）
- `pdf-reader` - PDF 文本提取
- `file-reader` - 通用文件读取
- `chrome-devtools` - Chrome DevTools 集成
- `playwright` - 浏览器自动化
- `todolist` - 待办事项管理
- `ollama-remote` - Ollama API 访问

## API 接口

### Admin API (`/adminapi`)

管理接口，需要认证（默认启用）：

- `GET /config` - 获取服务器配置
- `POST /login` - 用户认证
- `GET /groups` - 获取分组树
- `POST /groups` - 创建分组
- `PATCH /groups/rename` - 重命名分组
- `PATCH /groups/status` - 更新分组状态
- `DELETE /groups` - 删除分组
- `GET /prompts` - 获取提示词列表（支持搜索/过滤）
- `GET /prompts/:name` - 获取单个提示词
- `POST /prompts` - 创建/更新提示词
- `POST /prompts/:name/toggle` - 切换启用状态
- `DELETE /prompts/:name` - 删除提示词
- `POST /md-preview` - Markdown 预览
- `POST /terminal/execute` - 执行终端命令
- `GET /terminal/cwd` - 获取当前目录
- `GET /terminal/ls` - 列出目录内容

### Open API (`/openapi`)

公开接口，无需认证：

- `GET /prompts` - 获取启用的提示词（支持相似度搜索）
- `POST /process` - 处理提示词（带参数替换）

### Tool API (`/tool`)

工具管理接口：

- `GET /list` - 获取工具列表（支持搜索/过滤/分页）
- `GET /detail/:toolName` - 获取工具详情
- `GET /readme/:toolName` - 获取工具 README
- `POST /upload` - 上传工具包（ZIP）

### Surge Proxy (`/surge`)

代理静态资源到 `https://becrafter.surge.sh`

### 提示词优化 API

- `POST /adminapi/prompts/optimize` - 优化提示词（SSE 流式输出）
- `POST /adminapi/prompts/optimize/iterate` - 迭代优化
- `GET/POST/PUT/DELETE /adminapi/optimization/templates` - 模板管理
- `GET/POST/PUT/DELETE /adminapi/optimization/models` - 模型管理

## WebSocket 终端服务

### 服务端口

- WebSocket 服务端口: `动态分配（通过 /adminapi/config/public 获取）`

### 消息类型

- `terminal.create` - 创建终端会话
- `terminal.data` - 发送数据到终端
- `terminal.resize` - 调整终端大小
- `terminal.close` - 关闭会话

### 终端特性

- 使用 `node-pty` 实现伪终端
- 支持自定义 Shell 和环境变量
- 会话管理和自动清理

## 配置管理

### 配置来源（优先级从高到低）

1. 命令行参数（`--prompts-dir`, `--port`）
2. 环境变量
3. `~/.prompt-manager/.env` 配置文件

### 关键环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SERVER_PORT` | 服务器端口 | 5621 |
| `PROMPTS_DIR` | 提示词目录 | ~/.prompt-manager/prompts |
| `ADMIN_ENABLE` | 启用管理界面 | true |
| `ADMIN_REQUIRE_AUTH` | 需要认证 | true |
| `ADMIN_USERNAME` | 管理员用户名 | admin |
| `ADMIN_PASSWORD` | 管理员密码 | admin |
| `LOG_LEVEL` | 日志级别 | info |
| `MCP_SESSION_TTL_MS` | 会话 TTL | 600000 (10分钟) |

## 构建和运行

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动服务端（带热重载）
npm run dev

# 启动所有服务（server + admin-ui-re）
npm run dev:all

# 启动桌面应用开发环境
npm run desktop:dev

# 启动 Vue 管理界面开发环境
npm run admin:dev
```

### 构建生产版本

```bash
# 构建桌面应用安装包
npm run desktop:build

# 构建管理界面
npm run admin:build

# 构建核心库
npm run build:core
```

### 测试

```bash
# 运行所有测试
npm run test

# 运行服务端测试
npm run test:server

# 运行 E2E 测试
npm run test:e2e
```

### 命令行使用

```bash
# 使用默认配置启动
prompt-manager

# 指定提示词目录
prompt-manager --prompts-dir ./my-prompts

# 指定端口
prompt-manager --port 5621

# 显式使用 start/run 命令
prompt-manager start --port 6000
prompt-manager run --prompts-dir ./examples/prompts

# 获取帮助/版本信息
prompt-manager --help
prompt-manager --version
```

## 桌面应用

### 位置

`app/desktop/` 目录

### 功能

- 启/停服务
- 复制服务地址
- 打开管理后台
- 检查更新
- 关于服务信息

### 技术栈

- Electron
- 原生系统托盘菜单

## 管理界面

### admin-ui（原生 JS）

- 位置: `packages/admin-ui/`
- 技术栈: 原生 JavaScript + CodeMirror
- 构建工具: Webpack

## 提示词格式

### 基本结构

```yaml
name: prompt-name
description: 提示词描述
messages:
  - role: user
    content:
      text: 提示词内容，支持 {{参数名}} 格式的参数替换
arguments:
  - name: 参数名
    description: 参数描述
    type: string|number|boolean
    required: true|false
enabled: true|false  # 是否启用该提示词
```

### 分组支持

提示词文件可以组织在子目录中，每个子目录自动成为一个分组。分组元数据存储在 `.group.json` 文件中：

```json
{
  "name": "分组名称",
  "enabled": true,
  "description": "分组描述"
}
```

## 提示词优化功能

### 核心服务

- **OptimizationService** (`optimization.service.js`): AI 优化服务
  - 流式 AI 优化
  - 迭代改进支持
  - 会话跟踪

- **TemplateManager** (`template.service.js`): 模板管理
  - 内置和自定义模板
  - 模板 CRUD 操作

- **ModelManager** (`model.service.js`): 模型管理
  - 多提供商支持（OpenAI, Google 等）
  - 加密 API 密钥存储
  - 模型配置管理

### 优化模式

- `quick`: 快速优化
- `deep`: 深度优化
- `iterate`: 迭代优化

## 开发约定

1. **代码风格**: 项目使用 ES6 模块系统，遵循标准的 JavaScript 编码规范
2. **目录结构**:
   - `app/` - 客户端代码（CLI 和桌面应用）
   - `packages/` - 服务端核心逻辑和管理界面
   - `examples/` - 示例提示词文件
   - `docs/` - 项目文档
3. **配置管理**: 支持命令行参数、环境变量和配置文件
4. **日志记录**: 使用自定义 logger 模块
5. **错误处理**: 统一的错误处理机制
6. **Node.js 版本**: 推荐 v22.x（如 v22.20.0）

## 文档资源

- 开发文档: `docs/dev/`
- 产品需求: `docs/prd/`
- 技术规范: `docs/spec/`
- UI 设计: `docs/ui/`