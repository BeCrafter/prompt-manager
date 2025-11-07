# ToolX 沙箱工具库架构设计文档

## 概述

ToolX 是 PromptManager 体系中的沙箱工具库，提供安全、隔离的工具执行环境。它通过多种适配器模式支持不同运行环境（Electron、Node.js、Docker），确保 AI Agent 可以安全地执行文件操作等任务。

## 核心设计原则

- **SOLID**: 单一职责、开闭原则、里氏替换、接口隔离、依赖倒置
- **KISS**: 保持简单直接
- **DRY**: 避免重复代码
- **YAGNI**: 不添加不必要的功能

## 目录结构

```
packages/toolx/
├── index.js                      # ToolX 主入口文件
├── package.json                  # ToolX 模块配置
├── run-examples.js               # 示例运行脚本
├── simple-runner.js              # 简单执行器示例
├── simple-test.js                # 简单测试脚本
├── test-runner.js                # 测试运行器
├── validate.js                   # 工具验证脚本
├── docs/                         # 文档目录
│   ├── sandbox-tool-architecture.md  # 本架构文档
│   └── sandbox-tool-prd.md           # 产品需求文档
├── examples/                     # 使用示例目录
│   ├── README.md                 # 示例说明文档
│   ├── adapter-example.js        # 适配器使用示例
│   ├── real-filesystem-example.js # 真实文件系统工具调用示例
│   └── simple-execution-example.js # 简单执行示例
├── resources/                    # 资源目录
│   └── tools/                    # 工具集合目录
│       └── filesystem/           # 文件系统工具目录
│           ├── filesystem-esm.tool.js  # ESM版本文件系统工具
│           ├── filesystem.tool.js      # CommonJS版本文件系统工具
│           └── filesystem/             # 文件系统工具子目录
│               └── filesystem-esm.tool.js # ESM版本文件系统工具副本
├── src/                          # 源码目录
│   ├── adapters/                 # 适配器实现目录
│   │   ├── docker-adapter.js     # Docker适配器
│   │   ├── electron-adapter.js   # Electron适配器
│   │   └── nodejs-adapter.js     # Node.js适配器
│   ├── core/                     # 核心模块目录
│   │   ├── base/                 # 基础功能目录
│   │   │   └── process-pool.js   # 进程池实现（消除代码重复）
│   │   ├── config-loader.js      # 配置加载器
│   │   ├── config-validator.js   # 配置验证器
│   │   ├── registry.js           # 工具注册表
│   │   ├── tool-initializer.js   # 工具初始化器
│   │   ├── tool-loader.js        # 工具加载器（支持ES/CS模块）
│   │   └── tool-manager.js       # 工具管理器
│   ├── interfaces/               # 接口定义目录
│   │   ├── command-executor.js   # 命令执行器接口
│   │   ├── dependency-manager.js # 依赖管理器接口
│   │   └── sandbox-manager.js    # 沙箱管理器接口
│   ├── monitoring/               # 监控模块目录
│   │   └── metrics-collector.js  # 指标收集器
│   ├── security/                 # 安全模块目录
│   │   ├── policy-validator.js   # 策略验证器
│   │   └── resource-limiter.js   # 资源限制器
│   └── test/                     # 测试相关目录
│       ├── validator.js          # 测试验证器
│       └── ...                   # 各种测试文件
├── test/                         # 测试目录
│   ├── adapters.test.js          # 适配器测试
│   ├── config-loader.test.js     # 配置加载器测试
│   ├── e2e.test.js               # 端到端测试
│   ├── index.js                  # 测试入口
│   ├── interfaces.test.js        # 接口测试
│   ├── monitoring.test.js        # 监控测试
│   ├── performance.test.js       # 性能测试
│   ├── process-pool.test.js      # 进程池测试
│   ├── registry.test.js          # 注册表测试
│   └── security.test.js          # 安全测试
└── ...
```

## 核心模块详解

### 1. 工具加载器 (src/core/tool-loader.js)

工具加载器负责工具的发现、加载和验证，实现了工具枚举机制：

- 支持 ES 模块和 CommonJS 模块
- 优先查找 ESM 版本的工具文件 (toolName-esm.tool.js)，然后是普通版本 (toolName.tool.js)
- 实现工具缓存机制以提高性能
- 验证工具接口的完整性

### 2. 工具管理器 (src/core/tool-manager.js)

工具管理器负责工具的执行和生命周期管理：

- 提供工具执行接口
- 处理工具执行时的上下文和参数验证
- 实现工具执行的沙箱隔离
- 支持 importx 函数的注入

### 3. 适配器模块

#### Docker 适配器 (src/adapters/docker-adapter.js)
- 通过 Docker 容器提供完全隔离的执行环境
- 支持资源限制和安全策略
- 提供进程管理功能

#### Electron 适配器 (src/adapters/electron-adapter.js)
- 为 Electron 环境提供工具执行能力
- 集成 Electron 的安全机制
- 提供桌面应用环境下的工具执行

#### Node.js 适配器 (src/adapters/nodejs-adapter.js)
- 在 Node.js 环境中执行工具
- 提供基础的工具执行能力
- 实现 Node.js 环境下的安全机制

### 4. 安全模块

#### 策略验证器 (src/security/policy-validator.js)
- 验证工具执行策略
- 确保工具符合安全要求
- 防止恶意工具执行

#### 资源限制器 (src/security/resource-limiter.js)
- 限制工具执行时的资源使用
- 包括内存、CPU 时间、文件访问限制
- 防止资源耗尽攻击

### 5. 监控模块

#### 指标收集器 (src/monitoring/metrics-collector.js)
- 收集工具执行的性能指标
- 监控工具执行时间和资源使用
- 提供执行统计信息

## 工具接口规范

每个工具必须实现以下方法：

1. `getDependencies()` - 获取工具依赖
2. `getMetadata()` - 获取工具元信息
3. `getSchema()` - 获取参数Schema
4. `getBusinessErrors()` - 获取业务错误定义
5. `execute(params)` - 执行工具
6. `getRuntimeRequirements()` - 获取运行时需求（可选）

## 文件系统工具 (filesystem)

filesystem 工具是 ToolX 的核心示例工具，提供文件操作功能：

- 基于 MCP (Model Context Protocol) 标准
- 支持 ES 模块和 CommonJS 模块
- 包括读写、搜索、编辑等功能
- 实现安全的文件访问控制

### ESM 版本 vs CommonJS 版本

- `filesystem-esm.tool.js`: 使用 ES 模块语法，支持 importx 动态导入
- `filesystem.tool.js`: 使用 CommonJS 语法，兼容传统 Node.js 环境

## 示例用法

### 真实文件系统工具调用示例 (examples/real-filesystem-example.js)

演示如何使用 ToolX 框架真实调用 filesystem 工具，包括：

- ToolX 实例初始化
- 工具发现和加载
- 真实文件操作方法调用
- 工具元信息获取
- 测试环境清理

## 配置与测试

### 配置加载器 (src/core/config-loader.js)

- 加载 ToolX 框架配置
- 支持多种配置格式
- 提供配置验证功能

### 测试框架

- 单元测试覆盖核心模块
- 集成测试验证适配器功能
- 端到端测试确保整体功能

## 设计亮点

1. **架构隔离性**: 通过沙箱隔离确保工具执行不会影响核心系统
2. **平台独立性**: 支持多种运行环境，不依赖特定平台
3. **生态自主性**: 独立的工具生态系统，确保可扩展性
4. **模块化设计**: 遵循 SOLID 原则，便于维护和扩展
5. **安全机制**: 多层安全验证和资源限制
6. **性能优化**: 工具缓存和进程池机制

## 演进方向

- 支持更多适配器类型
- 增强安全验证机制
- 优化性能和资源管理
- 扩展工具库生态