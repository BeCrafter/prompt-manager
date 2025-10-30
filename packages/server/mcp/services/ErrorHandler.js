import { logger } from '../../utils/logger.js';

/**
 * 错误处理服务
 */
export class ErrorHandler {
  /**
   * 处理MCP错误
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文信息
   */
  static handleMcpError(error, context = {}) {
    // 记录错误日志
    logger.error(`MCP错误: ${error.message}`, {
      code: error.code,
      stack: error.stack,
      context
    });

    // 返回标准化错误响应
    return {
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        ...context
      }
    };
  }

  /**
   * 处理工具调用错误
   * @param {Error} error - 错误对象
   * @param {string} toolName - 工具名称
   * @param {Object} params - 参数
   */
  static handleToolError(error, toolName, params = {}) {
    logger.error(`工具调用错误: ${toolName}`, {
      error: error.message,
      code: error.code,
      params,
      stack: error.stack
    });

    return {
      error: {
        code: error.code || 'TOOL_ERROR',
        message: `工具 "${toolName}" 调用失败: ${error.message}`,
        tool: toolName,
        params
      }
    };
  }
}