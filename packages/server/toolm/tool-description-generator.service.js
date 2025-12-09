/**
 * 工具描述生成服务
 * 
 * 职责：
 * 1. 从工具加载服务获取所有工具的元数据
 * 2. 动态生成 toolm 工具的 description
 * 3. 自动生成工具列表和使用场景说明
 */

import { toolLoaderService } from './tool-loader.service.js';
import { logger } from '../utils/logger.js';

/**
 * 生成工具的使用场景规则（IF-THEN 格式）
 * @param {Array} tools - 工具列表
 * @returns {string} 使用场景规则文本
 */
function generateUsageScenarios(tools) {
  const scenarios = [];
  
  for (const tool of tools) {
    const { name, metadata } = tool;
    const toolId = `tool://${name}`;
    
    // 从 metadata 中提取使用场景描述
    // 优先使用 scenarios 字段的第一个场景，如果没有则从 description 提取关键词
    let scenarioText = '';
    
    if (metadata.scenarios && metadata.scenarios.length > 0) {
      // 使用第一个场景作为主要描述
      scenarioText = metadata.scenarios[0];
    } else if (metadata.description) {
      // 从描述中提取核心功能关键词（前60个字符）
      scenarioText = metadata.description.length > 60 
        ? metadata.description.substring(0, 60) + '...'
        : metadata.description;
    } else {
      // 使用工具名称
      scenarioText = `需要使用 ${name} 功能`;
    }
    
    scenarios.push(`- IF ${scenarioText} → 使用 ${toolId}`);
  }
  
  return scenarios.join('\n');
}

/**
 * 生成工具列表说明
 * @param {Array} tools - 工具列表
 * @returns {string} 工具列表文本
 */
function generateToolList(tools) {
  const toolItems = [];
  
  for (const tool of tools) {
    const { name, metadata } = tool;
    const toolId = `tool://${name}`;
    
    // 生成工具描述
    let description = metadata.description || `${name} 工具`;
    
    // 如果描述太长，截取前100个字符
    if (description.length > 100) {
      description = description.substring(0, 100) + '...';
    }
    
    toolItems.push(`- **${toolId}** - ${description}`);
  }
  
  return toolItems.join('\n');
}

/**
 * 生成 toolm 工具的完整描述
 * @returns {string} toolm 工具的 description
 */
export function generateToolmDescription() {
  try {
    // 确保工具加载器已初始化
    if (!toolLoaderService.initialized) {
      logger.warn('工具加载器尚未初始化，使用默认描述');
      return getDefaultDescription();
    }
    
    // 获取所有工具
    const tools = toolLoaderService.getAllTools();
    
    if (tools.length === 0) {
      logger.warn('未发现任何工具，使用默认描述');
      return getDefaultDescription();
    }
    
    // 按名称排序
    tools.sort((a, b) => a.name.localeCompare(b.name));
    
    // 生成使用场景规则
    const usageScenarios = generateUsageScenarios(tools);
    
    // 生成工具列表
    const toolList = generateToolList(tools);
    
    // 组装完整的描述
    const description = `ToolM 是 Prompt Manager 新一代工具系统运行时，提供统一的工具管理和执行能力。

## 核心特性

ToolM 作为统一工具管理器，提供：
- **智能工具加载** - 自动扫描并加载所有可用工具
- **四种运行模式** - manual（手册）、execute（执行）、configure（配置）、log（日志）
- **依赖管理** - 自动处理工具依赖和安装
- **错误智能处理** - 业务错误识别和解决方案提示
- **统一接口** - 所有工具遵循标准接口规范

## 何时使用 ToolM

### 常见场景（IF-THEN 规则）：
${usageScenarios}
- IF 看到 tool:// 格式 → 使用 toolm 调用
- IF 不确定工具用法 → 先用 manual 模式查看手册

### 首次使用任何工具
⚠️ **必须先运行 mode: manual** 阅读工具文档
⚠️ 示例：toolm with mode: manual for tool://filesystem

## 如何使用 ToolM（复制这些模式）

### 模式 1：查看工具手册（首次使用）

**使用代码：**
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: manual\`
})
\`\`\`

**作用：** 显示 filesystem 工具的完整使用手册

### 模式 2：执行工具操作

**使用代码：**
\`\`\`javascript
// 写入文件
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: execute
parameters:
  method: write_file
  path: ~/.prompt-manager/test.txt
  content: |
    Hello World
    这是测试内容\`
})

// 读取文件
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: execute
parameters:
  method: read_text_file
  path: ~/.prompt-manager/test.txt\`
})
\`\`\`

**作用：** 根据指定的工具和参数执行操作

### 模式 3：配置工具环境

**使用代码：**
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: configure
parameters:
  ALLOWED_DIRECTORIES: '["~/.prompt-manager", "/tmp"]'\`
})
\`\`\`

**作用：** 设置工具的环境变量

### 模式 4：查看工具日志

**使用代码：**
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: log
parameters:
  action: tail
  lines: 50\`
})
\`\`\`

**作用：** 查看工具最近的 50 条日志

## 关键规则（必须遵守）

### ✅ 正确格式
yaml 参数必须是完整的 YAML 文档：
- 以 \`tool: tool://tool-name\` 开头
- 添加 \`mode: execute\`（或 manual/configure/log）
- 如需参数，添加 \`parameters:\` 部分并正确缩进

### ❌ 常见错误避免
- 不要只传 "tool://filesystem"（缺少 YAML 结构）
- 不要添加 @ 前缀如 "@tool://filesystem"（系统会处理）
- 不要忘记 "tool://" 前缀（不是 "tool: filesystem"）
- 不要跳过手册，首次使用必须先看 manual

## 系统内置工具

完整内置工具列表：
${toolList}

更多工具正在开发中...

## 逐步工作流程

### 步骤 1：查看可用工具
使用 manual 模式了解工具能力

### 步骤 2：阅读工具手册
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://TOOLNAME
mode: manual\`
})
\`\`\`

### 步骤 3：执行工具操作
根据手册中的示例，修改参数以满足需求

### 步骤 4：处理错误
如果执行失败，检查：
- 工具名称是否正确？
- 参数是否正确缩进？
- 是否先阅读了手册？
- 错误提示中是否有解决方案？`;

    logger.debug('工具描述生成成功', { toolCount: tools.length });
    return description;
    
  } catch (error) {
    logger.error('生成工具描述失败，使用默认描述', { error: error.message });
    return getDefaultDescription();
  }
}

/**
 * 获取默认描述（当工具加载失败时使用）
 * @returns {string} 默认描述
 */
function getDefaultDescription() {
  return `ToolM 是 Prompt Manager 新一代工具系统运行时，提供统一的工具管理和执行能力。

## 核心特性

ToolM 作为统一工具管理器，提供：
- **智能工具加载** - 自动扫描并加载所有可用工具
- **四种运行模式** - manual（手册）、execute（执行）、configure（配置）、log（日志）
- **依赖管理** - 自动处理工具依赖和安装
- **错误智能处理** - 业务错误识别和解决方案提示
- **统一接口** - 所有工具遵循标准接口规范

## 何时使用 ToolM

### 常见场景（IF-THEN 规则）：
- IF 看到 tool:// 格式 → 使用 toolm 调用
- IF 不确定工具用法 → 先用 manual 模式查看手册

### 首次使用任何工具
⚠️ **必须先运行 mode: manual** 阅读工具文档

## 如何使用 ToolM

### 模式 1：查看工具手册（首次使用）

\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: manual\`
})
\`\`\`

### 模式 2：执行工具操作

\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: execute
parameters:
  method: read_text_file
  path: ~/.prompt-manager/test.txt\`
})
\`\`\`

## 关键规则（必须遵守）

### ✅ 正确格式
yaml 参数必须是完整的 YAML 文档：
- 以 \`tool: tool://tool-name\` 开头
- 添加 \`mode: execute\`（或 manual/configure/log）
- 如需参数，添加 \`parameters:\` 部分并正确缩进

### ❌ 常见错误避免
- 不要只传 "tool://filesystem"（缺少 YAML 结构）
- 不要添加 @ 前缀如 "@tool://filesystem"（系统会处理）
- 不要忘记 "tool://" 前缀（不是 "tool: filesystem"）
- 不要跳过手册，首次使用必须先看 manual`;
}

