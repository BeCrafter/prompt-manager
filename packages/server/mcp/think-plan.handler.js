/**
 * Think Plan 工具处理器
 * 
 * 功能：
 * - 系统化思考与规划工具
 * - 支持分阶段梳理思考、规划和行动步骤
 * - 强调思考（thought）、计划（plan）与实际行动（action）的结合
 * - 通过编号（thoughtNumber）追踪过程
 * - 不会获取新信息或更改数据库，只会将想法附加到记忆中
 */

import { logger } from '../utils/logger.js';

/**
 * 思考和规划条目
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
 * 思考和规划内存管理
 */
class ThinkPlanMemory {
  constructor() {
    this.entries = [];
    this.mutex = new Map(); // 用于会话级别的并发控制
  }

  /**
   * 添加新的思考和规划条目
   */
  addEntry(thoughtNumber, thought, plan, action, sessionId = 'default') {
    const entry = new ThinkPlanEntry(thoughtNumber, thought, plan, action);
    
    if (!this.mutex.has(sessionId)) {
      this.mutex.set(sessionId, []);
    }
    
    this.mutex.get(sessionId).push(entry);
    this.entries.push(entry);
    
    logger.debug(`ThinkPlan Entry [${thoughtNumber}] added:`, {
      thought: thought.substring(0, 50) + '...',
      plan: plan.substring(0, 50) + '...',
      action: action.substring(0, 50) + '...'
    });
    
    return entry;
  }

  /**
   * 获取所有记录
   */
  getAllEntries(sessionId = 'default') {
    if (sessionId === 'default') {
      return [...this.entries];
    }
    return [...(this.mutex.get(sessionId) || [])];
  }

  /**
   * 根据编号获取特定记录
   */
  getEntryByNumber(thoughtNumber, sessionId = 'default') {
    const entries = sessionId === 'default' ? this.entries : (this.mutex.get(sessionId) || []);
    return entries.find(entry => entry.thoughtNumber === thoughtNumber) || null;
  }

  /**
   * 以 JSON 格式获取所有记录
   */
  getEntriesAsJSON(sessionId = 'default') {
    const entries = this.getAllEntries(sessionId);
    return JSON.stringify(entries.map(e => e.toJSON()), null, 2);
  }

  /**
   * 清空所有记录
   */
  clearEntries(sessionId = 'default') {
    if (sessionId === 'default') {
      this.entries = [];
      this.mutex.clear();
    } else {
      this.mutex.delete(sessionId);
      // 从全局 entries 中移除该会话的记录
      this.entries = this.entries.filter(e => {
        // 这里简化处理，实际可能需要更复杂的会话追踪
        return true; // 保留所有记录，只清除会话特定记录
      });
    }
    logger.info(`ThinkPlan memory cleared for session: ${sessionId}`);
  }

  /**
   * 获取思考和规划过程的摘要
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
   * 获取当前记录数量
   */
  getCount(sessionId = 'default') {
    const entries = this.getAllEntries(sessionId);
    return entries.length;
  }
}

// 全局内存实例
const thinkPlanMemory = new ThinkPlanMemory();

/**
 * 处理 think_and_plan 工具调用
 * @param {object} args - 参数对象
 * @returns {object} MCP 格式的返回结果
 */
export async function handleThinkPlan(args) {
  const {
    thought,
    plan,
    action,
    thoughtNumber,
    sessionId = 'default'
  } = args;

  try {
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

    // 构建响应内容
    const response = formatThinkPlanOutput(entry, currentCount);

    logger.info(`ThinkPlan Entry [${thoughtNumber}] recorded`);

    return {
      content: [
        {
          type: "text",
          text: response
        }
      ]
    };

  } catch (error) {
    logger.error('ThinkPlan error:', error);
    throw error;
  }
}

/**
 * 格式化思考和规划输出
 */
function formatThinkPlanOutput(entry, currentCount) {
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
}

/**
 * 获取所有思考和规划记录
 */
export function getThinkPlanMemory(sessionId = 'default') {
  return thinkPlanMemory.getAllEntries(sessionId);
}

/**
 * 根据编号获取特定的思考和规划记录
 */
export function getThinkPlanMemoryByNumber(thoughtNumber, sessionId = 'default') {
  return thinkPlanMemory.getEntryByNumber(thoughtNumber, sessionId);
}

/**
 * 以 JSON 格式获取所有记录
 */
export function getThinkPlanMemoryAsJSON(sessionId = 'default') {
  return thinkPlanMemory.getEntriesAsJSON(sessionId);
}

/**
 * 清空所有记录
 */
export function clearThinkPlanMemory(sessionId = 'default') {
  thinkPlanMemory.clearEntries(sessionId);
  return {
    success: true,
    message: `思考和规划记录已清空 (会话: ${sessionId})`
  };
}

/**
 * 获取思考和规划过程的摘要
 */
export function getThinkPlanSummary(sessionId = 'default') {
  return thinkPlanMemory.getSummary(sessionId);
}

