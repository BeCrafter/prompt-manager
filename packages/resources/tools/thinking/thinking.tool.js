/**
 * Thinking Tool - AI-Friendly Unified Thinking Tool
 *
 * Features:
 * - Sequential Thinking: Step-by-step reasoning with branches and revisions
 * - Think-Plan Mode: Structured planning with thought-plan-action entries
 * - AI-Friendly Design: Smart parameter inference and contextual suggestions
 * - Session Management: Isolated planning sessions
 * - ToolM Interface: Full compliance with Prompt Manager tool ecosystem
 */

import { randomUUID } from 'crypto';

/**
 * Sequential Thinking State Management
 */
class ThinkingState {
  constructor() {
    this.thoughts = [];
    this.currentThoughtNumber = 0;
    this.branches = new Map();
    this.revisions = [];
  }

  /**
   * Add a new thought to the sequence
   */
  addThought(thought, metadata = {}) {
    const thoughtObj = {
      number: this.currentThoughtNumber + 1,
      content: thought,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    this.thoughts.push(thoughtObj);
    this.currentThoughtNumber = thoughtObj.number;

    return thoughtObj;
  }

  /**
   * Revise an existing thought
   */
  reviseThought(thoughtNumber, newThought) {
    const originalThought = this.thoughts.find(t => t.number === thoughtNumber);
    if (!originalThought) {
      throw new Error(`思考 ${thoughtNumber} 不存在`);
    }

    const revision = {
      originalNumber: thoughtNumber,
      newContent: newThought,
      timestamp: new Date().toISOString()
    };

    this.revisions.push(revision);
    originalThought.revised = true;
    originalThought.revision = revision;

    return revision;
  }

  /**
   * Create a thinking branch
   */
  createBranch(fromThoughtNumber, branchId, branchThought) {
    const branch = {
      fromThought: fromThoughtNumber,
      branchId,
      thoughts: [branchThought],
      timestamp: new Date().toISOString()
    };

    this.branches.set(branchId, branch);
    return branch;
  }

  /**
   * Get all thoughts
   */
  getThoughts() {
    return this.thoughts;
  }

  /**
   * Get all branches
   */
  getBranches() {
    return Array.from(this.branches.values());
  }

  /**
   * Get all revisions
   */
  getRevisions() {
    return this.revisions;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    return {
      totalThoughts: this.thoughts.length,
      totalBranches: this.branches.size,
      totalRevisions: this.revisions.length,
      currentThought: this.currentThoughtNumber
    };
  }

  /**
   * Reset all state
   */
  reset() {
    this.thoughts = [];
    this.currentThoughtNumber = 0;
    this.branches.clear();
    this.revisions = [];
  }
}

/**
 * Think-Plan Entry Class
 */
class ThinkPlanEntry {
  constructor(thoughtNumber, thought, plan, action) {
    this.thoughtNumber = thoughtNumber;
    this.thought = thought;
    this.plan = plan;
    this.action = action;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      thoughtNumber: this.thoughtNumber,
      thought: this.thought,
      plan: this.plan,
      action: this.action,
      timestamp: this.timestamp.toISOString()
    };
  }
}

/**
 * Think-Plan Memory Management
 */
class ThinkPlanMemory {
  constructor() {
    this.entries = [];
    this.mutex = new Map();
  }

  /**
   * Add a new planning entry
   */
  addEntry(thoughtNumber, thought, plan, action, sessionId = 'default') {
    const entry = new ThinkPlanEntry(thoughtNumber, thought, plan, action);
    entry.sessionId = sessionId; // Add session ID to entry

    if (!this.mutex.has(sessionId)) {
      this.mutex.set(sessionId, []);
    }

    this.mutex.get(sessionId).push(entry);
    this.entries.push(entry);

    return entry;
  }

  /**
   * Get all entries for a session
   */
  getAllEntries(sessionId = 'default') {
    if (sessionId === 'default') {
      return [...this.entries];
    }
    return [...(this.mutex.get(sessionId) || [])];
  }

  /**
   * Get specific entry by thought number
   */
  getEntryByNumber(thoughtNumber, sessionId = 'default') {
    const entries = this.getAllEntries(sessionId);
    return entries.find(entry => entry.thoughtNumber === thoughtNumber) || null;
  }

  /**
   * Get entries as JSON string
   */
  getEntriesAsJSON(sessionId = 'default') {
    const entries = this.getAllEntries(sessionId);
    return JSON.stringify(
      entries.map(e => e.toJSON()),
      null,
      2
    );
  }

  /**
   * Clear entries for a session
   */
  clearEntries(sessionId = 'default') {
    if (sessionId === 'default') {
      this.entries = [];
      this.mutex.clear();
    } else {
      this.mutex.delete(sessionId);
      this.entries = this.entries.filter(entry => entry.sessionId !== sessionId);
    }
  }

  /**
   * Generate summary text
   */
  getSummary(sessionId = 'default') {
    const entries = this.getAllEntries(sessionId);

    if (entries.length === 0) {
      return '暂无思考和规划记录';
    }

    let summary = `思考和规划过程摘要 (共 ${entries.length} 个步骤):\n\n`;

    entries.forEach((entry, index) => {
      summary += `${index + 1}. [${entry.thoughtNumber}] ${entry.thought}\n`;
      if (index < entries.length - 1) {
        summary += '\n';
      }
    });

    return summary;
  }

  /**
   * Get entry count for session
   */
  getCount(sessionId = 'default') {
    const entries = this.getAllEntries(sessionId);
    return entries.length;
  }
}

const thinkingState = new ThinkingState();
const thinkPlanMemory = new ThinkPlanMemory();
export default {
  /**
   * Get tool dependencies
   */
  getDependencies() {
    return {
    };
  },

  /**
   * Get tool metadata
   */
  getMetadata() {
    return {
      id: 'thinking',
      name: 'Thinking Tool',
      description: 'AI友好的思考工具，支持顺序思考和思考规划模式。支持结构化推理、规划和迭代思维过程。',
      version: '1.0.0',
      category: 'thinking',
      author: 'Prompt Manager',
      tags: ['thinking', 'reasoning', 'planning', 'sequential', 'mcp', 'ai-friendly'],
      scenarios: [
        '复杂问题分析和分解',
        '结构化项目规划和执行',
        '决策分析与替代方案探索',
        '迭代思维精炼和修订',
        '基于会话的规划隔离'
      ],
      limitations: [
        '顺序思考使用全局状态（无会话隔离）',
        '思考规划模式支持会话隔离',
        '最大思考步骤可通过环境配置',
        '无外部数据源集成'
      ]
    };
  },

  /**
   * Get parameter schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: 'Operation method',
            enum: [
              'add_thought',
              'revise_thought',
              'create_branch',
              'get_thoughts',
              'get_thought_summary',
              'reset_thoughts',
              'add_plan_entry',
              'get_plan_entries',
              'get_plan_entry',
              'clear_plan_entries',
              'get_plan_summary'
            ]
          },
          thought: { type: 'string', description: '思考内容' },
          thoughtNumber: { type: 'number', description: '思考步骤编号' },
          totalThoughts: { type: 'number', description: '预期总步骤数' },
          nextThoughtNeeded: { type: 'boolean', description: '是否继续思考' },
          newThought: { type: 'string', description: '修订的思考内容' },
          fromThoughtNumber: { type: 'number', description: '分支的源思考' },
          branchId: { type: 'string', description: '分支标识符' },
          branchThought: { type: 'string', description: '分支思考内容' },
          plan: { type: 'string', description: '规划策略' },
          action: { type: 'string', description: '下一步行动' },
          sessionId: { type: 'string', description: '会话标识符' }
        },
        required: ['method']
      },
      environment: {
        type: 'object',
        properties: {
          DEFAULT_SESSION_ID: {
            type: 'string',
            description: '思考规划操作的默认会话ID',
            default: 'default'
          },
          MAX_THINKING_STEPS: {
            type: 'number',
            description: '允许的最大思考步骤数',
            default: 100
          }
        },
        required: []
      }
    };
  },

  /**
   * Get business error definitions
   */
  getBusinessErrors() {
    return [
      {
        code: 'THOUGHT_NOT_FOUND',
        description: '思考编号不存在',
        match: /思考.*不存在|thought.*not.*found/i,
        solution: '请使用 get_thoughts 查看当前的思考编号',
        retryable: true
      },
      {
        code: 'THOUGHT_NUMBER_CONFLICT',
        description: '思考编号冲突',
        match: /思考编号.*冲突|number.*conflict/i,
        solution: '请确保每个思考的编号唯一',
        retryable: true
      },
      {
        code: 'PLAN_ENTRY_NOT_FOUND',
        description: '规划条目不存在',
        match: /规划.*不存在|plan.*entry.*not.*found/i,
        solution: '请使用 get_plan_entries 查看当前的规划记录',
        retryable: true
      },
      {
        code: 'SESSION_NOT_FOUND',
        description: '会话不存在',
        match: /会话.*不存在|session.*not.*found/i,
        solution: '请提供正确的 sessionId，或使用默认会话',
        retryable: true
      },
      {
        code: 'INVALID_METHOD',
        description: '不支持的方法',
        match: /不支持.*方法|invalid.*method|unknown.*method/i,
        solution: '请使用 mode: manual 查看所有可用方法',
        retryable: false
      },
      {
        code: 'MISSING_REQUIRED_PARAM',
        description: '缺少必需参数',
        match: /缺少必需参数|missing.*required/i,
        solution: '请提供必需的参数，参考手册了解每个方法的要求',
        retryable: false
      },
      {
        code: 'MAX_STEPS_EXCEEDED',
        description: '思考步骤超过限制',
        match: /思考步骤.*超过.*限制|max.*steps.*exceeded/i,
        solution: '请控制思考步骤数量，或使用不同的会话ID',
        retryable: false
      }
    ];
  },

  /**
   * Main execution method
   */
  async execute(params, mode = 'execute') {
    const { api } = this;

    api?.logger?.info('Thinking Tool execution started', {
      mode,
      method: params.method,
      hasApi: !!api
    });

    try {
      if (mode === 'manual') {
        return {
          content: [
            {
              type: 'text',
              text: this.generateManual()
            }
          ]
        };
      }

      if (mode === 'configure') {
        return this.handleConfigure(params, api);
      }

      this.validateParams(params);

      let result;
      switch (params.method) {
        case 'add_thought':
          result = this.handleAddThought(params);
          break;
        case 'revise_thought':
          result = this.handleReviseThought(params);
          break;
        case 'create_branch':
          result = this.handleCreateBranch(params);
          break;
        case 'get_thoughts':
          result = this.handleGetThoughts(params);
          break;
        case 'get_thought_summary':
          result = this.handleGetThoughtSummary(params);
          break;
        case 'reset_thoughts':
          result = this.handleResetThoughts(params);
          break;

        case 'add_plan_entry':
          result = this.handleAddPlanEntry(params);
          break;
        case 'get_plan_entries':
          result = this.handleGetPlanEntries(params);
          break;
        case 'get_plan_entry':
          result = this.handleGetPlanEntry(params);
          break;
        case 'clear_plan_entries':
          result = this.handleClearPlanEntries(params);
          break;
        case 'get_plan_summary':
          result = this.handleGetPlanSummary(params);
          break;

        default:
          throw new Error(`不支持的方法: ${params.method}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      api?.logger?.error('Thinking Tool execution failed', {
        mode,
        method: params.method,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Parameter validation
   */
  validateParams(params) {
    const { method } = params;
    if (!method) {
      throw new Error('缺少必需参数: method');
    }

    const methodRequirements = {
      'add_thought': ['thought'],
      'revise_thought': ['thoughtNumber', 'newThought'],
      'create_branch': ['fromThoughtNumber', 'branchId', 'branchThought'],
      'add_plan_entry': ['thought', 'plan', 'action', 'thoughtNumber'],
      // Other methods have no required params beyond method
    };

    const required = methodRequirements[method];
    if (!required) return;

    const missing = required.filter(field => !params[field] || params[field] === '');
    if (missing.length > 0) {
      throw new Error(`方法 ${method} 缺少必需参数: ${missing.join(', ')}`);
    }
  },

  /**
   * Handle add thought
   */
  handleAddThought(params) {
    const addedThought = thinkingState.addThought(params.thought, {
      thoughtNumber: params.thoughtNumber,
      totalThoughts: params.totalThoughts || 10,
      nextThoughtNeeded: params.nextThoughtNeeded !== false
    });

    const summary = thinkingState.getSummary();
    const progress = {
      current: addedThought.number,
      total: params.totalThoughts || 10,
      percentage: Math.round((addedThought.number / (params.totalThoughts || 10)) * 100)
    };

    const data = {
      thought: {
        number: addedThought.number,
        content: params.thought,
        type: 'regular'
      },
      summary,
      progress,
      nextThoughtNeeded: params.nextThoughtNeeded !== false,
      thoughts: thinkingState.getThoughts().map(t => ({
        number: t.number,
        content: t.content,
        revised: t.revised || false
      })),
      ...(thinkingState.getBranches().length > 0 && { branches: thinkingState.getBranches() }),
      ...(thinkingState.getRevisions().length > 0 && { revisions: thinkingState.getRevisions() })
    };

    return this.formatSequentialThinkingOutput(data);
  },

  handleReviseThought(params) {
    thinkingState.reviseThought(params.thoughtNumber, params.newThought);
    const data = {
      thought: {
        number: params.thoughtNumber,
        content: params.newThought,
        type: 'revision',
        revisesThought: params.thoughtNumber
      },
      revisions: thinkingState.getRevisions(),
      thoughts: thinkingState.getThoughts().map(t => ({
        number: t.number,
        content: t.content,
        revised: t.revised || false
      }))
    };
    return this.formatSequentialThinkingOutput(data);
  },

  handleCreateBranch(params) {
    const branch = thinkingState.createBranch(
      params.fromThoughtNumber,
      params.branchId,
      params.branchThought
    );
    const data = {
      thought: {
        number: params.fromThoughtNumber,
        type: 'branch',
        branchFromThought: params.fromThoughtNumber,
        branchId: params.branchId,
        content: params.branchThought
      },
      branches: thinkingState.getBranches(),
      thoughts: thinkingState.getThoughts().map(t => ({
        number: t.number,
        content: t.content,
        revised: t.revised || false
      }))
    };
    return this.formatSequentialThinkingOutput(data);
  },

  handleGetThoughts(params) {
    const data = {
      thoughts: thinkingState.getThoughts(),
      branches: thinkingState.getBranches(),
      revisions: thinkingState.getRevisions(),
      summary: thinkingState.getSummary()
    };
    return this.formatSequentialThinkingOutput(data);
  },

  handleGetThoughtSummary(params) {
    const summary = thinkingState.getSummary();
    return `思考状态摘要:
- 总思考数: ${summary.totalThoughts}
- 分支数: ${summary.totalBranches}
- 修订数: ${summary.totalRevisions}
- 当前思考编号: ${summary.currentThought}`;
  },

  handleResetThoughts(params) {
    thinkingState.reset();
    return `✅ 思考状态已重置
所有思考记录、分支和修订历史已被清除。`;
  },
  handleAddPlanEntry(params) {
    const sessionId = params.sessionId || 'default';
    const entry = thinkPlanMemory.addEntry(
      params.thoughtNumber,
      params.thought,
      params.plan,
      params.action,
      sessionId
    );
    const currentCount = thinkPlanMemory.getCount(sessionId);

    return this.formatThinkPlanOutput(entry, currentCount);
  },

  handleGetPlanEntries(params) {
    const sessionId = params.sessionId || 'default';
    const entries = thinkPlanMemory.getAllEntries(sessionId);
    let result = `📋 规划记录列表 (会话: ${sessionId})\n`;
    result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    result += `📊 共 ${entries.length} 个规划条目\n\n`;

    entries.forEach((entry, index) => {
      result += `${index + 1}. [${entry.thoughtNumber}] ${entry.thought}\n`;
      result += `   📋 ${entry.plan}\n`;
      result += `   🎯 ${entry.action}\n`;
      result += `   ⏰ ${entry.timestamp.toLocaleString('zh-CN')}\n\n`;
    });

    result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    return result;
  },

  handleGetPlanEntry(params) {
    const sessionId = params.sessionId || 'default';
    const entry = thinkPlanMemory.getEntryByNumber(params.thoughtNumber, sessionId);
    if (!entry) {
      throw new Error(`规划条目 ${params.thoughtNumber} 不存在`);
    }
    return this.formatThinkPlanOutput(entry, thinkPlanMemory.getCount(sessionId));
  },

  handleClearPlanEntries(params) {
    const sessionId = params.sessionId || 'default';
    const beforeCount = thinkPlanMemory.getCount(sessionId);
    thinkPlanMemory.clearEntries(sessionId);
    return `✅ 规划记录已清空\n会话: ${sessionId}\n清空条目数: ${beforeCount}`;
  },

  handleGetPlanSummary(params) {
    const sessionId = params.sessionId || 'default';
    const summary = thinkPlanMemory.getSummary(sessionId);
    const count = thinkPlanMemory.getCount(sessionId);
    return `📊 规划摘要 (会话: ${sessionId})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${summary}\n\n📈 统计信息:\n- 规划条目总数: ${count}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  },

  formatSequentialThinkingOutput(data) {
    let output = '';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += '🧠 **顺序思考工具**\n';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    if (data.thought) {
      output += `**思考 ${data.thought.number}**\n`;
      output += `${data.thought.content}\n\n`;
    }

    if (data.progress) {
      output += `**进度**: ${data.progress.current}/${data.progress.total} (${data.progress.percentage}%)\n\n`;
    }

    if (data.thoughts && data.thoughts.length > 0) {
      output += '**思考历史**:\n';
      data.thoughts.forEach(t => {
        const marker = t.revised ? '↩️' : '•';
        const content = t.content.length > 100 ? t.content.substring(0, 100) + '...' : t.content;
        output += `${marker} [${t.number}] ${content}\n`;
      });
      output += '\n';
    }

    if (data.branches && data.branches.length > 0) {
      output += '**分支**:\n';
      data.branches.forEach(branch => {
        output += `  └─ 分支 ${branch.branchId} (来自思考 ${branch.fromThought})\n`;
      });
      output += '\n';
    }

    if (data.revisions && data.revisions.length > 0) {
      output += '**修订**:\n';
      data.revisions.forEach(rev => {
        output += `  ↻ 思考 ${rev.originalNumber} 已修订\n`;
      });
      output += '\n';
    }

    if (data.nextThoughtNeeded === false) {
      output += '**状态**: 思考完成\n\n';
    } else {
      output += '**下一步**: 继续思考...\n\n';
    }

    if (data.finalSummary) {
      output += '**最终总结**:\n';
      output += `- 总步骤数: ${data.finalSummary.totalSteps}\n`;
      if (data.finalSummary.keyInsights && data.finalSummary.keyInsights.length > 0) {
        output += '- 关键洞察:\n';
        data.finalSummary.keyInsights.forEach(insight => {
          output += `  • [步骤 ${insight.step}] ${insight.content}\n`;
        });
      }
    }

    output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    return output;
  },

  formatThinkPlanOutput(entry, currentCount) {
    const timestamp = entry.timestamp.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let output = '';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += '🧠 **思考和规划记录**\n';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    output += `**思考编号**: [${entry.thoughtNumber}]\n\n`;

    output += '🤔 **思考内容**:\n';
    output += `${entry.thought}\n\n`;

    output += '📋 **规划方案**:\n';
    output += `${entry.plan}\n\n`;

    output += '🎯 **下一步行动**:\n';
    output += `${entry.action}\n\n`;

    output += `⏰ **记录时间**: ${timestamp}\n\n`;
    output += `📊 **当前已记录**: ${currentCount} 个思考步骤\n`;

    output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    return output;
  },

  generateManual2() {
    let manual = `# 🧠 Thinking Tool - 统一思考工具

## 🎯 60秒快速开始

### 最常用的3个方法

#### 1️⃣ add_thought - 添加思考
**何时使用**: 开始思考或添加新的思考步骤
**必填参数**: thought (思考内容)
**最简示例**:
\`\`\`yaml
tool: tool://thinking
mode: execute
parameters:
  method: add_thought
  thought: "分析问题的原因"
\`\`\`

#### 2️⃣ add_plan_entry - 添加规划
**何时使用**: 需要结构化思考和执行计划
**必填参数**: thought, plan, action
**最简示例**:
\`\`\`yaml
tool: tool://thinking
mode: execute
parameters:
  method: add_plan_entry
  thought: "需要部署新版本"
  plan: "1. 备份数据 2. 部署代码 3. 验证"
  action: "执行备份脚本"
\`\`\`

#### 3️⃣ get_thoughts - 查看思考
**何时使用**: 查看所有已记录的思考
**参数**: 无
**最简示例**:
\`\`\`yaml
tool: tool://thinking
mode: execute
parameters:
  method: get_thoughts
\`\`\`

---

## 📝 方法完整列表

### Sequential Thinking 方法群
- add_thought - 添加思考步骤
- revise_thought - 修订思考
- create_branch - 创建分支
- get_thoughts - 获取所有思考
- get_thought_summary - 获取摘要
- reset_thoughts - 重置思考状态

### Think Plan 方法群
- add_plan_entry - 添加规划条目
- get_plan_entries - 获取规划记录
- get_plan_entry - 获取特定条目
- clear_plan_entries - 清空规划
- get_plan_summary - 获取规划摘要

---

## 🎯 使用场景

### Sequential Thinking
适合复杂问题分析、方案探索、决策制定

### Think Plan
适合项目规划、任务执行、流程设计

---

## 🔧 环境配置

支持环境变量配置：
- DEFAULT_SESSION_ID (默认: 'default')
- MAX_THINKING_STEPS (默认: 100)

配置方法:
\`\`\`yaml
tool: tool://thinking
mode: configure
parameters:
  DEFAULT_SESSION_ID: "my-project"
\`\`\`

---

## 📚 完整文档

使用 mode: manual 查看完整文档和所有参数说明。`;

      return {
        content: [
          {
            type: 'text',
            text: manual
          }
        ]
      };
  },

  /**
   * Handle configuration
   */
  handleConfigure(params, api) {
    const configured = [];

    if (params.DEFAULT_SESSION_ID !== undefined) {
      api?.environment?.set('DEFAULT_SESSION_ID', params.DEFAULT_SESSION_ID);
      configured.push(`DEFAULT_SESSION_ID: "${params.DEFAULT_SESSION_ID}"`);
    }

    if (params.MAX_THINKING_STEPS !== undefined) {
      api?.environment?.set('MAX_THINKING_STEPS', params.MAX_THINKING_STEPS.toString());
      configured.push(`MAX_THINKING_STEPS: ${params.MAX_THINKING_STEPS}`);
    }

    if (configured.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '⚠️ 没有配置任何环境变量\n\n可配置的环境变量：\n- DEFAULT_SESSION_ID (默认: "default")\n- MAX_THINKING_STEPS (默认: 100)'
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ 环境变量配置完成\n\n已配置:\n${configured.map(c => `• ${c}`).join('\n')}\n\n配置将在下次重启后生效。`
        }
      ]
    };
  },
};