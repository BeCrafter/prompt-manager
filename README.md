# Prompt Manager

[![npm version](https://badge.fury.io/js/%40becrafter%2Fprompt-manager.svg)](https://www.npmjs.com/package/@becrafter/prompt-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.20.0-brightgreen)]()

> 🚀 **让AI提示词管理变得简单而强大** - 支持MCP协议、AI优化、多界面管理的企业级提示词管理平台

## ✨ 核心特性

### 🎯 AI提示词管理
- 📝 **模板化管理** - 将常用提示词保存为可复用的模板
- 🔍 **智能搜索** - 支持关键词和语义搜索，快速找到所需提示词
- 📁 **分组组织** - 支持文件夹分组，便于分类管理
- 🔧 **参数化支持** - 支持变量替换，让提示词更灵活

### 🤖 AI增强功能
- ⚡ **AI优化** - 使用AI自动优化你的提示词质量
- 🔄 **迭代改进** - 支持多轮迭代优化，持续提升效果
- 📊 **会话跟踪** - 跟踪优化过程中的迭代状态

### 🔌 开放生态
- 🔗 **MCP协议** - 完全兼容Model Context Protocol标准
- 🛠️ **ToolM系统** - 内置工具沙箱，支持扩展自定义工具
- 🌐 **API驱动** - 提供完整的REST API，支持程序化调用
- 📡 **流式传输** - 支持HTTP流式传输，实时获取结果

### 💻 多界面支持
- 🖥️ **桌面应用** - 开箱即用的Electron桌面应用
- 🌐 **Web管理** - 现代化的Web管理界面
- 💻 **命令行** - 强大的CLI工具，支持脚本集成

## 🚀 快速开始

### 方式一：桌面应用（推荐）

```bash
# 1. 下载并安装桌面应用
npm run desktop:build

# 2. 双击运行安装包
# 3. 点击系统托盘图标开始使用
```

**效果展示：**
![演示动画](./docs/assets/demo.gif)


![](./docs/assets/1.png)
![](./docs/assets/2.png)
![](./docs/assets/3.png)
![](./docs/assets/4.png)
![](./docs/assets/5.png)
![](./docs/assets/6.png)
![](./docs/assets/7.png)
![](./docs/assets/8.png)



### 方式二：命令行运行

```bash
# 1. 全局安装
npm install -g @becrafter/prompt-manager

# 2. 启动服务
prompt-manager

# 3. 访问管理界面
# http://localhost:5621/admin
```

### 方式三：开发环境

```bash
# 克隆项目
git clone https://github.com/BeCrafter/prompt-manager.git
cd prompt-manager

# 安装依赖
npm install

# 启动开发服务器
npm run dev:all

# 访问管理界面
# http://localhost:5621/admin
```

## 🎨 使用场景

### 👥 团队协作
- **共享提示词库** - 团队成员共享高质量提示词模板
- **标准化流程** - 统一团队的AI使用规范和最佳实践
- **知识传承** - 新成员快速上手，避免重复造轮子

### 🤖 AI开发者
- **提示词优化** - 使用AI自动改进提示词效果
- **版本管理** - 跟踪提示词的演进历史
- **效果对比** - A/B测试不同版本的提示词效果

### 🛠️ 程序集成
- **API调用** - 通过REST API集成到现有系统中
- **MCP协议** - 与支持MCP的AI客户端无缝集成
- **自动化流程** - 在CI/CD流程中自动调用提示词

## 📋 核心功能

### 提示词管理
- ✅ 创建和编辑提示词模板
- ✅ 支持YAML格式配置
- ✅ 参数化变量替换
- ✅ 分组和标签管理
- ✅ 启用/禁用控制

### AI优化服务
- ✅ 多模型支持（OpenAI、Google等）
- ✅ 流式优化输出
- ✅ 迭代优化模式
- ✅ 优化历史记录

### 工具生态
- ✅ 内置常用工具（文件操作、PDF读取等）
- ✅ 沙箱安全执行
- ✅ 自定义工具扩展
- ✅ 工具市场机制

### 界面体验
- ✅ 现代化Web界面
- ✅ 原生桌面应用
- ✅ 命令行工具
- ✅ 响应式设计

## 🛠️ 开发环境要求

### 系统要求

- **Node.js**: v22.20.0+ (推荐使用 nvm 管理版本)
- **操作系统**: macOS, Windows, Linux
- **内存**: 至少 512MB 可用内存

### 环境检查

项目提供了便捷的环境检查脚本：

```bash
# 自动检查开发环境
npm run check:env

# 或手动检查
node --version  # 应显示 v22.x.x
npm --version   # 检查 npm 版本
```

### 常见问题

#### Node.js 版本问题
```bash
# 使用 nvm 切换版本
nvm install 22
nvm use 22

# 或从官网下载 v22.20.0
# https://nodejs.org/
```

#### 依赖编译问题
```bash
# 修复 node-pty 编译问题
npm run fix:pty
```

## 📝 提示词格式

Prompt Manager 使用简洁的 YAML 格式定义提示词：

```yaml
name: code-review
description: 代码审查助手
messages:
  - role: user
    content:
      text: |
        请审查这段 {{language}} 代码：

        ```{{language}}
        {{code}}
        ```

        请指出潜在问题和改进建议
arguments:
  - name: language
    description: 编程语言
    type: string
    required: true
  - name: code
    description: 要审查的代码
    type: string
    required: true
enabled: true
```

### 参数支持
- **变量替换**: 使用 `{{变量名}}` 语法
- **类型支持**: string, number, boolean
- **可选参数**: 设置 `required: false`

### 分组管理
- **文件夹分组**: 将提示词放在子目录中自动分组
- **分组元数据**: 在 `.group.json` 中定义分组信息

## ⚙️ 配置和部署

### 命令行参数
```bash
prompt-manager --port 5621              # 指定端口
prompt-manager --prompts-dir ./prompts  # 指定提示词目录
```

### 环境变量
```env
SERVER_PORT=5621
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
LOG_LEVEL=info
```

### 存储位置
- **提示词**: `~/.prompt-manager/prompts`
- **配置**: `~/.prompt-manager/.env`
- **日志**: `~/Library/Application Support/@becrafter/prompt-desktop/`

## 🔧 开发者指南

### 作为库使用
```javascript
import { startServer } from '@becrafter/prompt-manager-core';

await startServer({
  configOverrides: {
    promptsDir: './my-prompts',
    port: 3000
  }
});
```

### 开发环境
```bash
git clone https://github.com/BeCrafter/prompt-manager.git
cd prompt-manager
npm install
npm run dev:all  # 启动所有服务
```

## 📡 API 概览

### 管理 API (需要认证)
- `GET /adminapi/prompts` - 获取提示词列表
- `POST /adminapi/prompts` - 创建/更新提示词
- `GET /adminapi/optimization/models` - 获取AI模型列表
- `POST /adminapi/prompts/optimize` - AI优化提示词

### 公开 API (无需认证)
- `GET /openapi/prompts` - 获取启用的提示词
- `POST /openapi/process` - 处理提示词

### MCP 协议支持
- `search_prompts` - 搜索提示词
- `get_prompt` - 获取提示词详情
- `reload_prompts` - 重新加载提示词

## 🤝 贡献指南

我们欢迎各种形式的贡献！

1. **Bug 报告** - [提交 Issue](https://github.com/BeCrafter/prompt-manager/issues)
2. **功能建议** - 在 Discussions 中分享你的想法
3. **代码贡献** - Fork 并提交 Pull Request
4. **文档改进** - 帮助完善文档和示例

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢所有贡献者和用户，让这个项目变得更好！

**Made with ❤️ by BeCrafter Team**
