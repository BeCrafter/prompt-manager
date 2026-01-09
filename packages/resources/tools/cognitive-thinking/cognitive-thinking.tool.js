/**
 * 认知思考工具 (Cognitive Thinking Tool)
 *
 * 战略意义：
 * 1. 架构纯粹性：将分散的思考工具统一为一个自适应工具
 * 2. 智能路由：基于用户需求自动选择最适合的思考模式
 * 3. 系统整合：让思考过程更加连贯和智能化
 * 4. 自适应调用：根据上下文动态调整思考策略
 *
 * 核心功能：
 * - 自适应思考路由：自动识别探索性vs执行性需求
 * - 顺序思考模式：动态反思性思维，支持分支和修订
 * - 规划执行模式：结构化思考-计划-行动的三元结构
 * - 融合工具模式：根据场景参数显式选择思考模式
 *
 * 注意：此工具将在独立沙箱环境中运行，依赖将自动安装到工具目录的 node_modules 中
 * 所有日志将输出到 ~/.prompt-manager/toolbox/cognitive-thinking/run.log 文件中
 */

/**
 * 思考状态管理类
 * 支持顺序思考的状态追踪
 */
class ThinkingState {
  constructor() {
    this.thoughts = [];
    this.currentThoughtNumber = 0;
    this.branches = new Map();
    this.revisions = [];
  }

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

  createBranch(fromThoughtNumber, branchId, branchThought) {
    const branch = {
      fromThought: fromThoughtNumber,
      branchId: branchId,
      thoughts: [branchThought],
      timestamp: new Date().toISOString()
    };

    this.branches.set(branchId, branch);
    return branch;
  }

  getThoughts() {
    return this.thoughts;
  }

  getBranches() {
    return Array.from(this.branches.values());
  }

  getRevisions() {
    return this.revisions;
  }

  getSummary() {
    return {
      totalThoughts: this.thoughts.length,
      totalBranches: this.branches.size,
      totalRevisions: this.revisions.length,
      currentThought: this.currentThoughtNumber
    };
  }

  reset() {
    this.thoughts = [];
    this.currentThoughtNumber = 0;
    this.branches.clear();
    this.revisions = [];
  }
}

/**
 * 思考和规划条目类
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
 * 思考和规划内存管理类
 */
class ThinkPlanMemory {
  constructor() {
    this.entries = [];
    this.mutex = new Map(); // 用于会话级别的并发控制
  }

  addEntry(thoughtNumber, thought, plan, action, sessionId = 'default') {
    const entry = new ThinkPlanEntry(thoughtNumber, thought, plan, action);

    if (!this.mutex.has(sessionId)) {
      this.mutex.set(sessionId, []);
    }

    this.mutex.get(sessionId).push(entry);
    this.entries.push(entry);

    return entry;
  }

  getAllEntries(sessionId = 'default') {
    if (sessionId === 'default') {
      return [...this.entries];
    }
    return [...(this.mutex.get(sessionId) || [])];
  }

  getEntryByNumber(thoughtNumber, sessionId = 'default') {
    const entries = sessionId === 'default' ? this.entries : (this.mutex.get(sessionId) || []);
    return entries.find(entry => entry.thoughtNumber === thoughtNumber) || null;
  }

  clearEntries(sessionId = 'default') {
    if (sessionId === 'default') {
      this.entries = [];
      this.mutex.clear();
    } else {
      this.mutex.delete(sessionId);
    }
  }

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

  getCount(sessionId = 'default') {
    const entries = this.getAllEntries(sessionId);
    return entries.length;
  }
}

// 全局状态实例
const thinkingState = new ThinkingState();
const thinkPlanMemory = new ThinkPlanMemory();

// 思考模式枚举
const THINKING_MODES = {
  EXPLORATORY: 'exploratory', // 探索性思考
  EXECUTION: 'execution',     // 执行性思考
  ADAPTIVE: 'adaptive'        // 自适应模式
};

/**
 * 自适应思考路由器
 * 根据输入内容自动识别合适的思考模式
 */
class AdaptiveRouter {
  static analyzeThinkingMode(input) {
    // 分析输入特征来判断思考模式

    // 执行性思考的特征
    const executionPatterns = [
      /需要.*实现|要.*做|应该.*执行|计划.*步骤/i,
      /部署|上线|发布|迁移|重构/i,
      /完成.*任务|执行.*计划|实施.*方案/i,
      /action|plan|执行|行动|步骤/i,
      /\d+\..*然后|\d+\..*接着|\d+\..*最后/i, // 步骤化描述
      /backup|deploy|test|verify/i // 技术操作关键词
    ];

    // 探索性思考的特征
    const exploratoryPatterns = [
      /为什么|怎么|是什么|原因|分析|诊断/i,
      /可能.*原因|潜在.*问题|需要.*调查/i,
      /探索|发现|理解|学习|研究/i,
      /thought|thinking|反思|假设|验证/i,
      /如果.*那么|假设|可能|或许/i, // 假设性思考
      /问题|issue|bug|error|异常/i // 问题诊断
    ];

    const inputText = JSON.stringify(input).toLowerCase();

    // 计算匹配分数
    let executionScore = 0;
    let exploratoryScore = 0;

    executionPatterns.forEach(pattern => {
      if (pattern.test(inputText)) executionScore++;
    });

    exploratoryPatterns.forEach(pattern => {
      if (pattern.test(inputText)) exploratoryScore++;
    });

    // 如果明确指定了模式，使用指定模式
    if (input.mode) {
      return input.mode;
    }

    // 如果明确指定了场景，使用场景映射
    if (input.scenario) {
      return input.scenario === 'exploratory' ? THINKING_MODES.EXPLORATORY : THINKING_MODES.EXECUTION;
    }

    // 根据分数判断模式
    if (executionScore > exploratoryScore) {
      return THINKING_MODES.EXECUTION;
    } else if (exploratoryScore > executionScore) {
      return THINKING_MODES.EXPLORATORY;
    } else {
      // 分数相等时，检查是否有明确的执行指示
      if (input.action || input.plan || input.thoughtNumber) {
        return THINKING_MODES.EXECUTION;
      }
      return THINKING_MODES.EXPLORATORY;
    }
  }
}

/**
 * 顺序思考处理器
 */
class SequentialThinkingHandler {
  static async handle(args) {
    const {
      thought,
      nextThoughtNeeded = true,
      thoughtNumber,
      totalThoughts = 10,
      isRevision = false,
      revisesThought,
      branchFromThought,
      branchId,
      needsMoreThoughts = false
    } = args;

    if (!thought) {
      throw new Error('缺少必需参数: thought');
    }

    // 处理思考记录
    let thoughtRecord;

    if (isRevision && revisesThought) {
      // 修订现有思考
      thinkingState.reviseThought(revisesThought, thought);
      thoughtRecord = {
        number: revisesThought,
        type: 'revision',
        revisesThought: revisesThought,
        content: thought
      };
    } else if (branchFromThought && branchId) {
      // 创建分支
      const branch = thinkingState.createBranch(branchFromThought, branchId, thought);
      thoughtRecord = {
        number: branchFromThought,
        type: 'branch',
        branchFromThought: branchFromThought,
        branchId: branchId,
        content: thought
      };
    } else {
      // 添加新思考
      const addedThought = thinkingState.addThought(thought, {
        thoughtNumber: thoughtNumber,
        totalThoughts: totalThoughts,
        nextThoughtNeeded: nextThoughtNeeded,
        needsMoreThoughts: needsMoreThoughts
      });
      thoughtRecord = {
        number: addedThought.number,
        type: 'regular',
        content: thought
      };
    }

    // 获取当前状态摘要
    const summary = thinkingState.getSummary();
    const allThoughts = thinkingState.getThoughts();
    const branches = thinkingState.getBranches();
    const revisions = thinkingState.getRevisions();

    // 构建响应
    const response = {
      success: true,
      thought: thoughtRecord,
      summary: summary,
      progress: {
        current: thoughtNumber || summary.currentThought,
        total: totalThoughts,
        percentage: Math.round(((thoughtNumber || summary.currentThought) / totalThoughts) * 100)
      },
      nextThoughtNeeded: nextThoughtNeeded || needsMoreThoughts,
      thoughts: allThoughts.map(t => ({
        number: t.number,
        content: t.content,
        revised: t.revised || false
      })),
      ...(branches.length > 0 && { branches: branches }),
      ...(revisions.length > 0 && { revisions: revisions })
    };

    // 如果不需要更多思考，可以生成最终总结
    if (!nextThoughtNeeded && !needsMoreThoughts) {
      response.finalSummary = SequentialThinkingHandler.generateFinalSummary(allThoughts, branches, revisions);
    }

    return response;
  }

  static generateFinalSummary(thoughts, branches, revisions) {
    const summary = {
      totalSteps: thoughts.length,
      keyInsights: [],
      conclusions: [],
      recommendations: []
    };

    // 提取关键洞察
    thoughts.forEach(thought => {
      if (thought.content.includes('关键') || thought.content.includes('重要') ||
          thought.content.includes('结论') || thought.content.includes('发现')) {
        summary.keyInsights.push({
          step: thought.number,
          content: thought.content
        });
      }
    });

    // 提取结论
    const lastThoughts = thoughts.slice(-3);
    summary.conclusions = lastThoughts.map(t => ({
      step: t.number,
      content: t.content
    }));

    return summary;
  }

  static formatOutput(response) {
    let output = '';

    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    output += '🧠 **顺序思考模式**\n';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    // 当前思考
    output += `**思考 ${response.thought.number || response.summary.currentThought}**\n`;
    output += `${response.thought.content}\n\n`;

    // 进度信息
    output += `**进度**: ${response.progress.current}/${response.progress.total} (${response.progress.percentage}%)\n\n`;

    // 思考历史
    if (response.thoughts && response.thoughts.length > 0) {
      output += '**思考历史**:\n';
      response.thoughts.forEach(t => {
        const marker = t.revised ? '↩️' : '•';
        output += `${marker} [${t.number}] ${t.content.substring(0, 100)}${t.content.length > 100 ? '...' : ''}\n`;
      });
      output += '\n';
    }

    // 分支信息
    if (response.branches && response.branches.length > 0) {
      output += '**分支**:\n';
      response.branches.forEach(branch => {
        output += `  └─ 分支 ${branch.branchId} (来自思考 ${branch.fromThought})\n`;
      });
      output += '\n';
    }

    // 修订信息
    if (response.revisions && response.revisions.length > 0) {
      output += '**修订**:\n';
      response.revisions.forEach(rev => {
        output += `  ↻ 思考 ${rev.originalNumber} 已修订\n`;
      });
      output += '\n';
    }

    // 下一步
    if (response.nextThoughtNeeded) {
      output += '**下一步**: 继续思考...\n';
    } else {
      output += '**状态**: 思考完成\n';
      if (response.finalSummary) {
        output += '\n**最终总结**:\n';
        output += `- 总步骤数: ${response.finalSummary.totalSteps}\n`;
        if (response.finalSummary.keyInsights.length > 0) {
          output += '- 关键洞察:\n';
          response.finalSummary.keyInsights.forEach(insight => {
            output += `  • [步骤 ${insight.step}] ${insight.content}\n`;
          });
        }
      }
    }

    output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return output;
  }
}

/**
 * 思考规划处理器
 */
class ThinkPlanHandler {
  static async handle(args) {
    const {
      thought,
      plan,
      action,
      thoughtNumber,
      sessionId = 'default'
    } = args;

    // 验证必需参数
    if (!thought || thought.trim().length === 0) {
      throw new Error('缺少必需参数: thought');
    }
    if (!plan || plan.trim().length === 0) {
      throw new Error('缺少必需参数: plan');
    }
    if (!action || action.trim().length === 0) {
      throw new Error('缺少必需参数: action');
    }
    if (!thoughtNumber || thoughtNumber.trim().length === 0) {
      throw new Error('缺少必需参数: thoughtNumber');
    }

    // 添加新条目
    const entry = thinkPlanMemory.addEntry(thoughtNumber, thought, plan, action, sessionId);
    const currentCount = thinkPlanMemory.getCount(sessionId);

    // 构建响应
    const response = {
      success: true,
      entry: entry,
      currentCount: currentCount,
      sessionId: sessionId
    };

    return response;
  }

  static formatOutput(response) {
    const entry = response.entry;
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
    output += '📋 **思考规划模式**\n';
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

    output += `**思考编号**: [${entry.thoughtNumber}]\n\n`;

    output += '🤔 **思考内容**:\n';
    output += `${entry.thought}\n\n`;

    output += '📋 **规划方案**:\n';
    output += `${entry.plan}\n\n`;

    output += '🎯 **下一步行动**:\n';
    output += `${entry.action}\n\n`;

    output += `⏰ **记录时间**: ${timestamp}\n\n`;
    output += `📊 **当前已记录**: ${response.currentCount} 个思考步骤\n`;
    output += `🔖 **会话ID**: ${response.sessionId}\n`;

    output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return output;
  }
}

/**
 * 主工具类
 */
export default {
  /**
   * 获取工具依赖
   * 返回的依赖将被安装到工具的独立 node_modules 目录中
   */
  getDependencies() {
    return {
      // 此工具不依赖第三方包，使用 Node.js 内置模块
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'cognitive-thinking',
      name: '认知思考工具',
      description: '统一的认知思考工具，支持自适应路由、顺序思考和规划执行三种模式，让系统架构更加纯粹',
      version: '1.0.0',
      category: 'ai',
      author: 'Prompt Manager',
      tags: ['thinking', 'cognitive', 'adaptive', 'planning', 'exploratory'],
      scenarios: [
        '复杂问题分析和诊断',
        '项目规划和执行',
        '决策制定和策略思考',
        '创意发散和方案探索',
        '系统架构设计',
        '技术方案评估'
      ],
      limitations: [
        '不直接执行外部操作',
        '依赖用户提供准确的上下文信息',
        '思考深度受限于输入信息的质量'
      ]
    };
  },

  /**
   * 获取参数Schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          // 自适应模式参数
          mode: {
            type: 'string',
            description: '思考模式，可选：adaptive（自适应）、exploratory（探索性）、execution（执行性）',
            enum: ['adaptive', 'exploratory', 'execution'],
            default: 'adaptive'
          },

          // 顺序思考模式参数
          thought: {
            type: 'string',
            description: '当前思考内容（顺序思考模式必需）'
          },
          nextThoughtNeeded: {
            type: 'boolean',
            description: '是否需要继续思考',
            default: true
          },
          thoughtNumber: {
            type: 'number',
            description: '思考步骤编号'
          },
          totalThoughts: {
            type: 'number',
            description: '预计总思考步骤数',
            default: 10
          },
          isRevision: {
            type: 'boolean',
            description: '是否为对之前思考的修订',
            default: false
          },
          revisesThought: {
            type: 'number',
            description: '被修订的思考编号（当isRevision为true时必需）'
          },
          branchFromThought: {
            type: 'number',
            description: '分支起始的思考编号'
          },
          branchId: {
            type: 'string',
            description: '分支标识符'
          },
          needsMoreThoughts: {
            type: 'boolean',
            description: '是否需要更多思考步骤',
            default: false
          },

          // 规划执行模式参数
          plan: {
            type: 'string',
            description: '规划方案（执行性模式必需）'
          },
          action: {
            type: 'string',
            description: '下一步行动（执行性模式必需）'
          },
          sessionId: {
            type: 'string',
            description: '会话标识符',
            default: 'default'
          }
        },
        required: [] // 自适应模式下参数可动态确定
      },
      environment: {
        type: 'object',
        properties: {
          DEFAULT_SESSION_ID: {
            type: 'string',
            description: '默认会话ID',
            default: 'default'
          },
          MAX_THINKING_STEPS: {
            type: 'number',
            description: '最大思考步骤数限制',
            default: 100
          }
        },
        required: []
      }
    };
  },

  /**
   * 获取业务错误定义
   */
  getBusinessErrors() {
    return [
      {
        code: 'MISSING_THOUGHT',
        description: '缺少必需的思考内容参数',
        match: /缺少必需参数: thought/i,
        solution: '请提供 thought 参数描述您的当前思考',
        retryable: true
      },
      {
        code: 'INVALID_MODE',
        description: '无效的思考模式',
        match: /不支持.*模式|无效.*模式/i,
        solution: '请使用 adaptive、exploratory 或 execution 模式',
        retryable: true
      },
      {
        code: 'MISSING_EXECUTION_PARAMS',
        description: '执行模式缺少必需参数',
        match: /缺少必需参数.*plan|缺少必需参数.*action/i,
        solution: '执行模式需要提供 thought、plan 和 action 参数',
        retryable: true
      },
      {
        code: 'THINKING_OVERFLOW',
        description: '思考步骤超过限制',
        match: /思考步骤.*超过.*限制/i,
        solution: '请控制思考步骤数量，或使用不同的会话ID',
        retryable: false
      }
    ];
  },

  /**
   * 执行工具
   */
  async execute(params) {
    const { api } = this;

    // 记录执行开始
    api?.logger?.info('认知思考工具执行开始', {
      mode: params.mode,
      hasThought: !!params.thought,
      hasPlan: !!params.plan,
      hasAction: !!params.action
    });

    try {
      // 参数验证和预处理
      const validatedParams = this.validateAndPreprocessParams(params);

      // 自适应路由分析
      const thinkingMode = AdaptiveRouter.analyzeThinkingMode(validatedParams);
      api?.logger?.info('自适应路由分析结果', { detectedMode: thinkingMode });

      let result;

      // 根据模式路由到对应的处理器
      switch (thinkingMode) {
        case THINKING_MODES.EXPLORATORY:
          result = await SequentialThinkingHandler.handle(validatedParams);
          result.formattedOutput = SequentialThinkingHandler.formatOutput(result);
          break;

        case THINKING_MODES.EXECUTION:
          result = await ThinkPlanHandler.handle(validatedParams);
          result.formattedOutput = ThinkPlanHandler.formatOutput(result);
          break;

        default:
          throw new Error(`不支持的思考模式: ${thinkingMode}`);
      }

      // 记录执行成功
      api?.logger?.info('认知思考工具执行完成', {
        mode: thinkingMode,
        success: result.success
      });

      return result.formattedOutput;

    } catch (error) {
      // 记录错误
      api?.logger?.error('认知思考工具执行失败', {
        error: error.message,
        params: JSON.stringify(params).substring(0, 200)
      });
      throw error;
    }
  },

  /**
   * 参数验证和预处理
   */
  validateAndPreprocessParams(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('参数必须是对象');
    }

    // 深度克隆参数避免修改原对象
    const processedParams = JSON.parse(JSON.stringify(params));

    // 基本类型转换
    if (processedParams.thoughtNumber && typeof processedParams.thoughtNumber === 'string') {
      const num = parseInt(processedParams.thoughtNumber, 10);
      if (!isNaN(num)) {
        processedParams.thoughtNumber = num;
      }
    }

    if (processedParams.totalThoughts && typeof processedParams.totalThoughts === 'string') {
      const num = parseInt(processedParams.totalThoughts, 10);
      if (!isNaN(num)) {
        processedParams.totalThoughts = num;
      }
    }

    // 布尔值标准化
    ['nextThoughtNeeded', 'isRevision', 'needsMoreThoughts'].forEach(key => {
      if (processedParams[key] !== undefined) {
        processedParams[key] = Boolean(processedParams[key]);
      }
    });

    return processedParams;
  },

  /**
   * 获取思考状态摘要
   */
  getThinkingSummary(sessionId = 'default') {
    const thinkingSummary = thinkingState.getSummary();
    const planningSummary = thinkPlanMemory.getSummary(sessionId);

    return {
      sequentialThinking: thinkingSummary,
      thinkPlanning: planningSummary,
      combinedStats: {
        totalThinkingSteps: thinkingSummary.totalThoughts,
        totalPlanningSteps: thinkPlanMemory.getCount(sessionId),
        totalBranches: thinkingSummary.totalBranches,
        totalRevisions: thinkingSummary.totalRevisions
      }
    };
  },

  /**
   * 重置思考状态
   */
  resetThinkingState(sessionId = 'default') {
    thinkingState.reset();
    thinkPlanMemory.clearEntries(sessionId);

    return {
      success: true,
      message: `认知思考状态已重置 (会话: ${sessionId})`
    };
  }
};