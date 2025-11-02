# Prompt Manager 项目概述

## 项目简介

Prompt Manager 是一个基于 MCP（Model Context Protocol）协议的 Prompt 管理服务。它支持 HTTP 流式传输、提供 Web 管理界面和桌面应用，能够将静态提示词模板转换为可通过 API 调用的动态服务。

核心特性包括：
- 完全兼容模型上下文协议（MCP）
- 基于 StreamableHTTP 协议优化的 HTTP 流式传输
- 自动发现子目录中的 prompt 文件
- 支持命令行参数和环境变量配置
- 内置 Electron 菜单应用，可一键启动/停止服务
- 提供 Web 管理界面，方便创建、编辑和管理提示词

## 技术栈

- **后端**: Node.js (>=18.0.0), Express.js
- **前端**: 内置管理界面使用原生 JavaScript 和 Codemirror
- **协议**: MCP (Model Context Protocol)
- **桌面应用**: Electron
- **包管理**: npm/pnpm

## 项目结构

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

## 构建和运行

### 安装依赖

在项目根目录运行：

```bash
npm install
```

### 启动开发服务器

```bash
# 启动服务端开发服务器
npm run dev

# 启动桌面应用开发环境
npm run desktop:dev
```

### 构建桌面应用

```bash
# 构建桌面应用安装包
npm run desktop:build
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

## 开发约定

1. **代码风格**: 项目使用 ES6 模块系统，遵循标准的 JavaScript 编码规范。
2. **目录结构**: 
   - `app/` 目录包含客户端相关代码（CLI 和桌面应用）
   - `packages/` 目录包含服务端核心逻辑和管理界面
   - `examples/` 目录包含示例提示词文件
3. **配置管理**: 支持通过命令行参数、环境变量和配置文件进行配置。
4. **日志记录**: 使用自定义 logger 模块进行日志记录。
5. **错误处理**: 统一的错误处理机制，关键操作都有适当的错误捕获和处理。

## API 接口

### MCP 协议接口

服务器实现了 MCP 协议，支持以下工具：

- `search_prompts`: 搜索提示词
- `get_prompt`: 获取指定提示词的完整内容
- `reload_prompts`: 重新加载所有提示词（暂未启用）

### Web 管理接口

1. **获取提示词列表**
   ```
   GET /prompts[?search=关键词]
   ```

2. **获取单个提示词详情**
   ```
   GET /api/prompts/:name[?path=文件路径]
   ```

3. **创建/更新提示词**
   ```
   POST /api/prompts
   ```

4. **删除提示词**
   ```
   DELETE /api/prompts/:name[?path=文件路径]
   ```

5. **切换提示词启用状态**
   ```
   POST /api/prompts/:name/toggle[?path=文件路径]
   ```

6. **处理提示词**
   ```
   POST /process
   ```

7. **分组管理**
   - 获取所有分组列表: `GET /api/groups`
   - 创建新分组: `POST /api/groups`
   - 重命名分组: `PATCH /api/groups/rename`
   - 更新分组启用状态: `PATCH /api/groups/status`
   - 删除分组: `DELETE /api/groups?path=分组路径`

## 桌面应用

位于 `app/desktop` 目录，使用 Electron 构建的菜单栏应用，提供以下功能：

- 启/停服务
- 复制服务地址
- 打开管理后台
- 检查更新
- 关于服务信息

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