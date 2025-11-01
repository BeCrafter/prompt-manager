# Prompt Manager

[![npm version](https://badge.fury.io/js/%40becrafter%2Fprompt-manager.svg)](https://www.npmjs.com/package/@becrafter/prompt-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

一个基于MCP协议的Prompt管理服务，支持HTTP流式传输、Web管理界面和桌面应用，可将静态提示词模板转换为可通过API调用的动态服务。

## 核心特性

- 🛠️ **MCP协议支持**：完全兼容模型上下文协议（MCP），可与各种AI客户端集成
- 🌐 **HTTP流式传输**：基于StreamableHTTP协议优化，提供稳定的长连接支持
- 📁 **递归扫描**：自动发现子目录中的 prompt 文件
- ⚙️ **灵活配置**：支持命令行参数和环境变量配置
- 🖥️ **原生桌面壳**：内置 Electron 菜单应用，可一键启动/停止服务，并内嵌管理后台
- 📋 **管理界面**：提供Web管理界面，方便创建、编辑和管理提示词

## 快速开始

### 1. 安装

```bash
# 全局安装
npm install -g @becrafter/prompt-manager

# 或作为项目依赖安装
npm install @becrafter/prompt-manager 
```

### 2. 启动服务器

```bash
# 使用默认配置启动
prompt-manager

# 指定提示词目录
prompt-manager --prompts-dir ./my-prompts

# 指定端口
prompt-manager --port 5621
```

> 默认情况下，服务会在 `~/.prompt-manager/prompts` 下创建并读取提示词目录。第一次启动会将仓库中的 `examples/prompts` 同步过去，方便快速体验。

### 3. CLI 命令

新版本的命令行逻辑已经集中在 `app/cli` 中，支持拓展式命令分发。常用用法保持不变：

```bash
# 默认等价于 prompt-manager start
prompt-manager

# 显式使用 start/run 命令
prompt-manager start --port 6000
prompt-manager run --prompts-dir ./examples/prompts

# 获取帮助/版本信息
prompt-manager --help
prompt-manager --version
```

后续如需增加自定义子命令，只需在 `app/cli/commands` 下添加对应实现并在 `app/cli/index.js` 注册即可。

## 桌面菜单应用（Electron）

为了让非技术同学也能便捷地运行服务，仓库新增了一个 Electron 菜单栏应用，位于 `app/desktop`。打包后的应用会连同 Node.js 运行时、`prompt-manager` 代码以及依赖一并分发，无需再额外配置环境。

### 目录与结构

- `app/desktop/main.js`：Electron 主进程，负责托盘 UI、服务生命周期、升级流程
- `app/desktop/assets/`：托盘、安装图标等资源
- `app/desktop/package.json`：单独的桌面工程配置与 `electron-builder` 打包描述

### 菜单功能

- **启/停服务**：根据当前状态切换文案，直接调用服务的 `startServer/stopServer`
- **复制服务地址**：一键复制当前 `http://127.0.0.1:<port>` 地址，方便分享或调试
- **打开管理后台**：在独立窗口中嵌入服务自带的 `/admin` 前端，可直接登录管理 prompt
- **检查更新**：调用 npm Registry 获取最新版本，下载 tarball、自动安装依赖，并保留 `examples/prompts` 内的示例内容（实际数据位于 `~/.prompt-manager/prompts`，不会受影响）
- **关于服务**：展示桌面端、服务端、Electron、Chromium、Node.js 等组件版本
- **退出服务**：先平滑停止 Express 服务，再退出 Electron 进程

### 本地开发/调试

```bash
# 安装依赖（仓库根目录已经装好 server 依赖）
cd app/desktop
npm install

# 启动托盘应用（也可使用根目录脚本 npm run desktop:dev）
npm run dev
```

启动后系统托盘只会出现一个图标，所有交互都在菜单里完成。

### 打包发布

```bash
# 在仓库根目录执行，会调用 app/desktop 内的 electron-builder
npm run desktop:build
```

`electron-builder` 会输出 macOS `.dmg`、Windows `.exe`（NSIS）以及 Linux `.AppImage` 安装包，`extraResources` 中包含 `prompt-manager` 的源码与依赖，从而保证离线可用。

### 升级机制

菜单中的 "检查更新" 会：

1. 读取当前运行的服务版本（`app.getPath('userData')/prompt-manager/package.json`）
2. 对比 npm Registry 上的最新版本
3. 在用户确认后停止服务、下载最新 tarball、重新写入运行目录
4. 通过 `npm install --omit=dev` 在沙盒目录中重新安装依赖
5. 保留示例 `examples/prompts` 目录（若存在），用户自定义数据保存在 `~/.prompt-manager/prompts`，无需额外迁移

整个过程无需系统层面的 Node/npm，真正实现"装上即用"。

## 配置选项

### 命令行参数

| 参数 | 简写 | 描述 |
|------|------|------|
| `--prompts-dir <目录>` | `-p` | 指定 prompts 文件所在目录 |
| `--port <端口>` | `-P` | 指定服务器端口 (默认: 5621) |
| `--help` | `-h` | 显示帮助信息 |
| `--version` | `-v` | 显示版本信息 |

### 环境变量

| 环境变量 | 描述 | 默认值 |
|----------|------|--------|
| `MCP_SERVER_NAME` | 服务器名称 | `prompt-manager` |
| `SERVER_PORT` | 服务器端口 | `5621` |
| `PROMPTS_DIR` | Prompts目录路径 | `~/.prompt-manager/prompts` |
| `MCP_SERVER_VERSION` | 服务器版本 | `0.0.18` |
| `LOG_LEVEL` | 日志级别 (error, warn, info, debug) | `info` |
| `MAX_PROMPTS` | 最大prompt数量限制 | `100` |
| `RECURSIVE_SCAN` | 是否启用递归扫描子目录 | `true` |
| `ADMIN_ENABLE` | 是否启用管理界面 | `true` |
| `ADMIN_PATH` | 管理界面路径 | `/admin` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `admin` |

> 安装或首次运行时，会自动将 `env.example` 内容写入 `~/.prompt-manager/.env`（如果该文件尚未存在），方便在系统范围内共享配置。

## API 接口

### MCP协议接口

服务器实现了MCP协议，支持以下工具：

- `search_prompts`: 搜索提示词
- `get_prompt`: 获取指定提示词的完整内容
- `reload_prompts`: 重新加载所有提示词

### Web管理接口

#### 获取提示词列表

```
GET /prompts[?search=关键词]
```

返回所有可用的提示词列表，支持搜索功能。

#### 获取单个提示词详情

```
GET /api/prompts/:name[?path=文件路径]
```

返回指定名称的提示词详细信息。

#### 创建/更新提示词

```
POST /api/prompts
```

创建或更新提示词文件。

请求体示例：
```json
{
  "name": "my-prompt",
  "group": "default",
  "yaml": "name: my-prompt\ndescription: 我的自定义提示词\nmessages:\n  - role: user\n    content:\n      text: 这是一个{{参数}}示例\n"
}
```

#### 删除提示词

```
DELETE /api/prompts/:name[?path=文件路径]
```

删除指定的提示词文件。

#### 切换提示词启用状态

```
POST /api/prompts/:name/toggle[?path=文件路径]
```

切换提示词的启用/禁用状态。

#### 处理提示词

```
POST /process
```

处理指定的提示词，支持参数替换。

请求体示例：
```json
{
  "promptName": "code-review",
  "arguments": {
    "language": "JavaScript",
    "code": "function hello() { console.log('Hello'); }"
  }
}
```

#### 分组管理

```
GET /api/groups
```

获取所有分组列表。

```
POST /api/groups
```

创建新分组。

```
PATCH /api/groups/rename
```

重命名分组。

```
PATCH /api/groups/status
```

更新分组启用状态。

```
DELETE /api/groups?path=分组路径
```

删除分组（仅当分组为空时）。

## 提示词格式

提示词文件使用 YAML 格式，需要包含以下基本结构：

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

## 开发

### 项目结构

```
prompt-manager/
├── app/
│   ├── cli/            # 命令行命令分发与共享工具
│   └── desktop/        # Electron 菜单应用
├── packages/
│   ├── admin-ui/       # 内置管理后台静态资源
│   └── server/         # 服务端核心逻辑
├── examples/
│   └── prompts/        # 随包示例提示词（首次启动会同步到 ~/.prompt-manager/prompts）
├── scripts/            # 安装/维护脚本（如 env 同步）
├── bin/                # 可执行入口
└── package.json
```

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/BeCrafter/prompt-manager.git
cd prompt-manager

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 许可证

MIT License