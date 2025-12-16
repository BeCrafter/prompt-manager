/**
 * 工具描述生成服务（优化版）
 * 
 * 从AI模型理解和使用工具的角度优化：
 * 1. 提高信息密度，减少冗余
 * 2. 增强语义匹配能力（利用tags、category）
 * 3. 提供工具对比和区分信息
 * 4. 优化IF-THEN规则，使其更语义化
 * 5. 按分类组织工具，提高检索效率
 */

import { toolLoaderService } from './tool-loader.service.js';
import { logger } from '../utils/logger.js';

/**
 * 按分类组织工具
 * @param {Array} tools - 工具列表
 * @returns {Object} 按category分组的工具
 */
function groupToolsByCategory(tools) {
  const grouped = {};
  
  for (const tool of tools) {
    const category = tool.metadata.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(tool);
  }
  
  // 按category名称排序
  const sortedCategories = Object.keys(grouped).sort();
  const result = {};
  for (const cat of sortedCategories) {
    result[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  }
  
  return result;
}

/**
 * 生成语义化的使用场景规则（优化版）
 * @param {Array} tools - 工具列表
 * @returns {string} 使用场景规则文本
 */
function generateUsageScenarios(tools) {
  const scenarios = [];
  
  for (const tool of tools) {
    const { name, metadata } = tool;
    const toolId = `tool://${name}`;
    
    // 策略1：优先使用scenarios，合并前2个场景（如果存在）
    let scenarioText = '';
    
    if (metadata.scenarios && metadata.scenarios.length > 0) {
      // 合并前2个场景，用"或"连接，提供更丰富的语义信息
      if (metadata.scenarios.length >= 2) {
        scenarioText = `${metadata.scenarios[0]} 或 ${metadata.scenarios[1]}`;
      } else {
        scenarioText = metadata.scenarios[0];
      }
    } else if (metadata.description) {
      // 策略2：从description中提取核心语义（前80字符，更完整）
      scenarioText = metadata.description.length > 80 
        ? metadata.description.substring(0, 80) + '...'
        : metadata.description;
    } else {
      // 策略3：使用工具名称和category
      const category = metadata.category ? `（${metadata.category}类）` : '';
      scenarioText = `需要使用 ${name} 功能${category}`;
    }
    
    // 添加tags作为语义增强（如果存在）
    let tagsHint = '';
    if (metadata.tags && metadata.tags.length > 0) {
      // 只显示前3个最相关的tags
      const keyTags = metadata.tags.slice(0, 3).map(t => `#${t}`).join(' ');
      tagsHint = ` ${keyTags}`;
    }
    
    scenarios.push(`- IF ${scenarioText}${tagsHint} → 使用 ${toolId}`);
  }
  
  return scenarios.join('\n');
}

/**
 * 生成分类工具列表（优化版）
 * @param {Object} groupedTools - 按category分组的工具
 * @returns {string} 工具列表文本
 */
function generateCategorizedToolList(groupedTools) {
  const sections = [];
  
  const categoryNames = {
    'system': '系统工具',
    'utility': '实用工具',
    'ai': 'AI工具',
    'browser': '浏览器工具',
    'other': '其他工具'
  };
  
  for (const [category, tools] of Object.entries(groupedTools)) {
    const categoryName = categoryNames[category] || category;
    const toolItems = [];
    
    for (const tool of tools) {
      const { name, metadata } = tool;
      const toolId = `tool://${name}`;
      
      // 生成工具描述（优化截断逻辑）
      let description = metadata.description || `${name} 工具`;
      
      // 智能截断：尝试在句号、逗号处截断，保持语义完整
      if (description.length > 120) {
        const truncated = description.substring(0, 120);
        const lastPunctuation = Math.max(
          truncated.lastIndexOf('。'),
          truncated.lastIndexOf('，'),
          truncated.lastIndexOf('.'),
          truncated.lastIndexOf(',')
        );
        if (lastPunctuation > 80) {
          description = truncated.substring(0, lastPunctuation + 1);
        } else {
          description = truncated + '...';
        }
      }
      
      // 添加tags（如果存在）
      let tagsDisplay = '';
      if (metadata.tags && metadata.tags.length > 0) {
        tagsDisplay = ` [${metadata.tags.slice(0, 3).join(', ')}]`;
      }
      
      toolItems.push(`  - **${toolId}** - ${description}${tagsDisplay}`);
    }
    
    sections.push(`### ${categoryName}\n${toolItems.join('\n')}`);
  }
  
  return sections.join('\n\n');
}

/**
 * 生成工具对比信息（帮助区分相似工具）
 * @param {Array} tools - 工具列表
 * @returns {string} 工具对比文本
 */
function generateToolComparison(tools) {
  // 识别相似工具（基于category和tags）
  const similarGroups = [];
  const processed = new Set();
  
  for (let i = 0; i < tools.length; i++) {
    if (processed.has(i)) continue;
    
    const tool1 = tools[i];
    const group = [tool1];
    processed.add(i);
    
    // 查找相似工具（相同category或tags重叠）
    for (let j = i + 1; j < tools.length; j++) {
      if (processed.has(j)) continue;
      
      const tool2 = tools[j];
      
      // 判断相似度：相同category或tags有重叠
      const sameCategory = tool1.metadata.category === tool2.metadata.category;
      const tagsOverlap = tool1.metadata.tags && tool2.metadata.tags &&
        tool1.metadata.tags.some(tag => tool2.metadata.tags.includes(tag));
      
      if (sameCategory && tagsOverlap) {
        group.push(tool2);
        processed.add(j);
      }
    }
    
    if (group.length > 1) {
      similarGroups.push(group);
    }
  }
  
  if (similarGroups.length === 0) {
    return '';
  }
  
  const comparisons = [];
  for (const group of similarGroups) {
    const toolNames = group.map(t => `tool://${t.name}`).join('、');
    const differences = [];
    
    for (const tool of group) {
      const keyFeature = tool.metadata.description?.split('，')[0] || 
                        tool.metadata.scenarios?.[0] || 
                        tool.name;
      differences.push(`- **${tool.name}**：${keyFeature}`);
    }
    
    comparisons.push(`**相似工具对比**（${toolNames}）：\n${differences.join('\n')}`);
  }
  
  return comparisons.join('\n\n');
}

/**
 * 生成 toolm 工具的完整描述（优化版）
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
    
    // 按名称排序（用于IF-THEN规则）
    tools.sort((a, b) => a.name.localeCompare(b.name));
    
    // 按分类组织工具
    const groupedTools = groupToolsByCategory(tools);
    
    // 生成使用场景规则
    const usageScenarios = generateUsageScenarios(tools);
    
    // 生成分类工具列表
    const categorizedToolList = generateCategorizedToolList(groupedTools);
    
    // 生成工具对比信息
    const toolComparison = generateToolComparison(tools);
    
    // 组装完整的描述（优化结构，减少冗余）
    const description = `🛠️ ToolM 是 Prompt Manager 新一代工具系统运行时，提供统一的工具管理和执行能力。

【规范名称】promptmanager_toolm
【调用说明】在提示词中使用 promptmanager_toolm，实际调用时自动映射到 mcp__[server]__action

## 核心特性

- **智能工具加载** - 自动扫描并加载所有可用工具
- **四种运行模式** - manual（手册）、execute（执行）、configure（配置）、log（日志）
- **依赖管理** - 自动处理工具依赖和安装
- **错误智能处理** - 业务错误识别和解决方案提示
- **统一接口** - 所有工具遵循标准接口规范

## 何时使用 ToolM

### 快速决策（IF-THEN 规则）：
${usageScenarios}
- IF 看到 tool:// 格式 → 使用 toolm 调用
- IF 不确定工具用法 → 先用 manual 模式查看手册

${toolComparison ? `\n### 工具选择指南\n\n${toolComparison}\n` : ''}

### 首次使用任何工具
⚠️ **必须先运行 mode: manual** 阅读工具文档
⚠️ 示例：toolm with mode: manual for tool://filesystem

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

## 关键规则

### ✅ 正确格式
- 以 \`tool: tool://tool-name\` 开头
- 添加 \`mode: execute\`（或 manual/configure/log）
- 如需参数，添加 \`parameters:\` 部分并正确缩进

### ❌ 常见错误
- 不要只传 "tool://filesystem"（缺少 YAML 结构）
- 不要忘记 "tool://" 前缀
- 不要跳过手册，首次使用必须先看 manual

## 可用工具列表

${categorizedToolList}

更多工具正在开发中...`;

    logger.debug('工具描述生成成功（优化版）', { toolCount: tools.length });
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
  return `🛠️ ToolM 是 Prompt Manager 新一代工具系统运行时，提供统一的工具管理和执行能力。

## 核心特性

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

## 关键规则

### ✅ 正确格式
- 以 \`tool: tool://tool-name\` 开头
- 添加 \`mode: execute\`（或 manual/configure/log）
- 如需参数，添加 \`parameters:\` 部分并正确缩进

### ❌ 常见错误
- 不要只传 "tool://filesystem"（缺少 YAML 结构）
- 不要忘记 "tool://" 前缀
- 不要跳过手册，首次使用必须先看 manual`;
}

