# 思考工具

AI友好的思考工具，支持顺序思考和思考规划模式。支持结构化推理、规划和迭代思维过程，具有智能参数推断功能。

## 🎯 核心特性

### 顺序思考模式
- **逐步推理** - 将复杂问题分解为可管理的思考步骤
- **分支管理** - 探索替代方法并创建决策分支
- **修订跟踪** - 修订和改进之前的想法
- **进度跟踪** - 监控思考进度和完成状态

### 思考规划模式
- **结构化规划** - 在单个条目中结合思考、规划和行动
- **会话隔离** - 支持多个独立的思考会话
- **编号跟踪** - 使用自定义编号组织想法（例如：TP-001、TP-002）
- **摘要生成** - 生成规划进度的文本摘要

### AI友好设计
- **智能参数推断** - 自动编号、步骤估算和参数补全
- **上下文感知建议** - 基于思考状态的智能推荐
- **渐进式文档** - 逐步引入复杂度以便于采用
- **错误预防** - 清晰的验证和有用的错误消息

## 📝 方法概述

### 顺序思考方法
- `add_thought` - 添加新的思考步骤并自动编号
- `revise_thought` - 修订现有想法
- `create_branch` - 创建替代的思考分支
- `get_thoughts` - 检索所有思考记录
- `get_thought_summary` - 获取思考进度摘要
- `reset_thoughts` - 清除所有思考记录

### 思考规划方法
- `add_plan_entry` - 添加结构化的思考-规划-行动条目
- `get_plan_entries` - 检索所有规划条目
- `get_plan_entry` - 通过编号获取特定规划条目
- `clear_plan_entries` - 清除会话的规划条目
- `get_plan_summary` - 生成规划过程摘要

## 🚀 快速开始

### 1. 添加简单想法

```yaml
tool: tool://thinking
mode: execute
parameters:
  method: add_thought
  thought: "分析性能问题"
```

### 2. 添加结构化规划

```yaml
tool: tool://thinking
mode: execute
parameters:
  method: add_plan_entry
  thought: "需要优化数据库查询"
  plan: "1. 分析慢查询 2. 添加索引 3. 测试性能"
  action: "对主查询运行EXPLAIN"
  thoughtNumber: "TP-001"
```

### 3. 获取当前状态

```yaml
tool: tool://thinking
mode: execute
parameters:
  method: get_thoughts
```

### 4. 查看手册

```yaml
tool: tool://thinking
mode: manual
```

## 🎯 使用案例

### 复杂问题解决
使用顺序思考来分解和系统分析复杂问题：

```yaml
tool: tool://thinking
mode: execute
parameters:
  method: add_thought
  thought: "识别应用程序变慢的根本原因"
  totalThoughts: 5
  nextThoughtNeeded: true
```

### 项目规划
使用思考规划模式进行结构化项目规划：

```yaml
tool: tool://thinking
mode: execute
parameters:
  method: add_plan_entry
  thought: "实现用户认证系统"
  plan: "设计API、创建数据库架构、实现端点、添加测试"
  action: "创建用户模型和迁移"
  thoughtNumber: "AUTH-001"
```

### 决策分析
使用分支来探索不同的方法：

```yaml
tool: tool://thinking
mode: execute
parameters:
  method: create_branch
  fromThoughtNumber: 2
  branchId: "alternative-cache-strategy"
  branchThought: "考虑使用Redis缓存而不是内存缓存"
```

## 🔧 环境配置

该工具支持可选的环境变量进行自定义：

- `DEFAULT_SESSION_ID`（可选）：思考规划操作的默认会话ID（默认值：'default'）
- `MAX_THINKING_STEPS`（可选）：允许的最大思考步骤数（默认值：100）

通过以下方式配置：

```yaml
tool: tool://thinking
mode: configure
parameters:
  DEFAULT_SESSION_ID: "my-project"
  MAX_THINKING_STEPS: 50
```

## 📊 参数参考

### 通用参数

| 参数 | 类型 | 描述 | 是否必需 |
|------|------|------|----------|
| `method` | string | 操作方法名称 | 是 |

### 顺序思考参数

| 参数 | 类型 | 描述 | 是否必需 |
|------|------|------|----------|
| `thought` | string | 思考内容 | 是（对于add_thought） |
| `thoughtNumber` | number | 思考步骤编号（自动分配） | 可选 |
| `totalThoughts` | number | 预期总步骤数 | 可选 |
| `nextThoughtNeeded` | boolean | 是否继续思考 | 可选 |
| `newThought` | string | 修订的思考内容 | 是（对于revise_thought） |
| `fromThoughtNumber` | number | 分支的源思考 | 是（对于create_branch） |
| `branchId` | string | 分支标识符 | 是（对于create_branch） |
| `branchThought` | string | 分支思考内容 | 是（对于create_branch） |

### 思考规划参数

| 参数 | 类型 | 描述 | 是否必需 |
|------|------|------|----------|
| `thought` | string | 思考内容 | 是 |
| `plan` | string | 规划策略 | 是 |
| `action` | string | 下一步行动 | 是 |
| `thoughtNumber` | string | 思考标识符（例如：TP-001） | 是 |
| `sessionId` | string | 会话标识符 | 可选（默认值：'default'） |

## 📋 输出格式

### 顺序思考输出

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 **顺序思考工具**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**思考 1**
分析性能问题...

**进度**: 1/5 (20%)

**思考历史**:
• [1] 分析性能问题...
• [2] 检查数据库查询...

**分支**:
  └─ 分支 cache-optimization（来自思考 2）

**下一步**: 继续思考...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 思考规划输出

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 **思考和规划记录**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**思考编号**: [TP-001]

🤔 **思考内容**:
需要优化数据库查询

📋 **规划方案**:
1. 分析慢查询 2. 添加索引 3. 测试性能

🎯 **下一步行动**:
对主查询运行EXPLAIN

⏰ **记录时间**: 2025/01/11 15:30:00

📊 **当前已记录**: 1 个思考步骤
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## ⚠️ 错误处理

该工具提供带有建议的智能错误消息：

### 常见错误

**缺少必需参数：**
```
❌ 方法 add_thought 缺少必需参数: thought
📝 请提供您的思考内容
💡 示例: thought: "分析问题的原因"
🔗 更多帮助: 使用 mode: manual 查看完整文档
```

**无效方法：**
```
❌ 不支持的方法: invalid_method
📝 可用方法: add_thought, get_thoughts, add_plan_entry...
💡 提示: 使用 mode: manual 查看所有可用方法
```

**未找到思考：**
```
❌ 思考 5 不存在
📝 请检查思考编号是否正确
💡 建议操作:
   1. 使用 get_thoughts 查看当前的思考编号
   2. 确认使用的编号是否正确
🔗 获取更多帮助: 使用 mode: manual 查看完整文档
```

## 🔄 会话管理

### 顺序思考
- 跨所有会话的全局状态
- 想法持续存在直到明确重置
- 分支和修订跟踪全局维护

### 思考规划模式
- 基于会话的隔离
- 每个会话维护独立的规划条目
- 默认会话：'default'
- 通过`sessionId`参数支持自定义会话

## 📈 最佳实践

### 顺序思考
1. **从分析开始** - 从问题识别开始
2. **设置现实的步骤数量** - 使用`totalThoughts`来指导进度
3. **使用分支探索替代方案** - 探索不同的方法
4. **定期修订** - 随着理解的深入改进想法

### 思考规划模式
1. **使用一致的编号** - 采用TP-001、TP-002格式
2. **保持条目聚焦** - 每个条目一个明确的行动
3. **利用会话** - 为不同项目使用不同的会话
4. **定期审查** - 使用摘要跟踪整体进度

### 通用提示
1. **从简单开始** - 最初使用最少的参数
2. **利用自动推断** - 让工具处理编号和建议
3. **定期检查进度** - 使用摘要方法监控状态
4. **需要时重置** - 为新的思考会话清除状态

## 🛠️ 开发

该工具实现了ToolM接口并遵循Prompt Manager开发标准。

### 工具接口
- `getMetadata()` - 工具元数据和功能
- `getSchema()` - 参数模式和验证
- `getBusinessErrors()` - 自定义错误定义
- `execute()` - 主要执行方法

### 测试
```bash
# 运行工具特定测试
npm test -- --grep thinking

# 集成测试
tool: tool://thinking
mode: manual
```

## 📚 相关文档

- [ToolM接口指南](./TOOLM_INTERFACE.md)
- [Prompt Manager工具概述](../README.md)
- [顺序思考模式](./SEQUENTIAL_THINKING.md)
- [思考规划方法论](./THINK_PLAN_METHODOLOGY.md)

## 🔄 版本历史

- **1.0.0** - 初始实现，支持完整的顺序思考和思考规划功能
  - AI友好的参数推断
  - 智能错误处理和建议
  - 基于会话的规划隔离
  - 全面的手册文档
  - ToolM接口合规

---

**用 ❤️ 为AI辅助思考和规划工作流程制作**