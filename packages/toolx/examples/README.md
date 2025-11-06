# ToolX 沙箱工具库 - 使用示例

ToolX 是一个遵循 SOLID、KISS、DRY、YAGNI 设计原则的 Node.js 沙箱工具库，提供安全的代码执行环境。

## 示例说明

### 1. 简单执行示例
演示基本的安全验证、资源限制和监控功能。

运行命令：
```bash
node examples/simple-execution-example.js
```

### 2. 适配器系统示例
演示适配器注册表和不同运行时环境的支持。

运行命令：
```bash
node examples/adapter-example.js
```

## 关于 filesystem.tool.js

`@packages/toolx/resources/tools/filesystem/filesystem.tool.js` 是一个为 PromptX 生态系统设计的文件系统工具，它已经具备了完善的安全机制，包括：

- MCP 标准的文件系统操作
- 路径访问控制和验证
- 可配置的允许目录列表
- 环境变量配置支持

该工具无需调整即可与 ToolX 沙箱基础设施配合使用。ToolX 为这类工具提供底层的运行时隔离、资源限制和安全验证功能。

## 快速开始

1. 确保 Node.js >= 18.0.0 已安装
2. 在项目根目录运行示例：

```bash
# 运行简单执行示例
node examples/simple-execution-example.js

# 运行适配器系统示例
node examples/adapter-example.js

# 运行所有示例
node run-examples.mjs all
```

## 核心功能

- **安全验证**: 多层安全策略验证（命令、网络、模块、路径）
- **资源限制**: 内存、CPU、执行时间、文件大小限制
- **性能监控**: 实时指标收集和分析
- **适配器系统**: 支持多种运行时环境（Node.js, Electron, Docker）
- **进程池管理**: 高效的进程管理和负载均衡

## 设计原则

- **SOLID**: 遵循面向对象设计的五大原则
- **KISS**: 保持简单和直接的设计
- **DRY**: 消除重复代码，提高可维护性
- **YAGNI**: 只实现必要的功能，避免过度设计

更多信息请参考架构文档。