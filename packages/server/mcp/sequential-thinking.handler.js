/**
 * Sequential Thinking 工具处理器
 * 
 * 参考: https://github.com/spences10/mcp-sequentialthinking-tools
 * 
 * 功能：
 * - 通过顺序思维实现动态和反思性的问题解决
 * - 支持思维过程的分支和修订
 * - 帮助将复杂问题分解为可管理的步骤
 */

import { logger } from '../utils/logger.js';

/**
 * 思考状态管理
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

// 全局思考状态（可以根据需要改为按会话管理）
const thinkingState = new ThinkingState();

/**
 * 处理 sequential thinking 工具调用
 * @param {object} args - 参数对象
 * @returns {object} MCP 格式的返回结果
 */
export async function handleSequentialThinking(args) {
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

  try {
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
      response.finalSummary = generateFinalSummary(allThoughts, branches, revisions);
    }

    logger.debug('Sequential thinking result:', response);

    return {
      content: [
        {
          type: "text",
          text: formatThinkingOutput(response)
        }
      ]
    };

  } catch (error) {
    logger.error('Sequential thinking error:', error);
    throw error;
  }
}

/**
 * 生成最终总结
 */
function generateFinalSummary(thoughts, branches, revisions) {
  const summary = {
    totalSteps: thoughts.length,
    keyInsights: [],
    conclusions: [],
    recommendations: []
  };

  // 提取关键洞察（可以根据需要改进逻辑）
  thoughts.forEach(thought => {
    if (thought.content.includes('关键') || thought.content.includes('重要') || thought.content.includes('结论')) {
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

/**
 * 格式化思考输出
 */
function formatThinkingOutput(response) {
  let output = '';
  
  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  output += '🧠 **顺序思考工具**\n';
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

/**
 * 重置思考状态（可选功能）
 */
export function resetThinkingState() {
  thinkingState.reset();
  return {
    success: true,
    message: '思考状态已重置'
  };
}

