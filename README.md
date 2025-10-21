# MCP Prompt Server

[![npm version](https://badge.fury.io/js/%40becrafter%2Fprompt-server.svg)](https://www.npmjs.com/package/@becrafter/prompt-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

一个基于 模型上下文协议（MCP） 的 Prompt 管理服务器 。可以将分散的、静态的提示词模板，转变为一个可通过 API 调用的、可动态配置的、可复用的服务，从而更高效地管理和使用 AI 提示词。

## 核心特性

- 🛠️ **完整接口**：提供提示词列表、处理、帮助和版本信息等接口
- 📁 **递归扫描**：自动发现子目录中的 prompt 文件
- ⚙️ **灵活配置**：支持命令行参数和环境变量配置

## 快速开始

### 1. 安装

```bash
# 全局安装
npm install -g @becrafter/prompt-server

# 或作为项目依赖安装
npm install @becrafter/prompt-server 
```

### 2. 启动服务器

```bash
# 使用默认配置启动
prompt-server

# 指定提示词目录
prompt-server --prompts-dir ./my-prompts

# 指定端口
prompt-server --port 8080
```

## 配置选项

### 命令行参数

| 参数 | 简写 | 描述 |
|------|------|------|
| `--prompts-dir <目录>` | `-p` | 指定 prompts 文件所在目录 |
| `--port <端口>` | `-P` | 指定服务器端口 (默认: 3000) |
| `--help` | `-h` | 显示帮助信息 |
| `--version` | `-v` | 显示版本信息 |

### 环境变量

| 环境变量 | 描述 | 默认值 |
|----------|------|--------|
| `MCP_SERVER_NAME` | 服务器名称 | `prompt-server` |
| `SERVER_PORT` | 服务器端口 | `3000` |
| `PROMPTS_DIR` | Prompts目录路径 | 当前工作目录下的 `prompts` 目录 |
| `MCP_SERVER_VERSION` | 服务器版本 | `0.0.5` |
| `LOG_LEVEL` | 日志级别 (error, warn, info, debug) | `info` |
| `MAX_PROMPTS` | 最大prompt数量限制 | `100` |
| `RECURSIVE_SCAN` | 是否启用递归扫描子目录 | `true` |

## API 接口

### 获取服务器信息

```
GET /
```

返回服务器基本信息和可用接口列表。

### 获取提示词列表

```
GET /prompts
```

返回所有可用的提示词列表。

### 处理提示词

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

### 获取帮助信息

```
GET /help
```

返回服务器使用帮助信息。

### 获取版本信息

```
GET /version
```

返回服务器版本信息。

## 提示词格式

提示词文件使用 YAML 格式，需要包含以下基本结构：

```yaml
name: prompt-name
description: 提示词描述
messages:
  - role: user
    content:
      text: 提示词内容，支持 {{参数名}} 格式的参数替换
```

## 开发

### 项目结构

```
prompt-server/
├── bin/                # 可执行文件
├── prompts/            # 示例提示词
│   ├── developer/      # 开发相关提示词
│   ├── generator/      # 生成器提示词
│   └── operation/      # 运维相关提示词
├── src/
│   ├── config.js       # 配置管理
│   ├── logger.js       # 日志工具
│   └── server.js       # 服务器主程序
└── package.json
```

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/BeCrafter/prompt-server.git
cd prompt-server

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 许可证

MIT License
