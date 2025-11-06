/**
 * 命令执行接口 - 专一职责：命令执行
 * 遵循接口隔离原则(ISP)，确保接口专一性
 */

class ICommandExecutor {
  /**
   * 执行命令
   * @param {string} command - 命令名称
   * @param {string[]} args - 命令参数
   * @param {ExecutionOptions} options - 执行选项
   * @returns {Promise<ExecutionResult>} 执行结果
   */
  async executeCommand(command, args, options = {}) {
    throw new Error('executeCommand must be implemented by subclass');
  }
}

/**
 * 执行选项
 * @typedef {Object} ExecutionOptions
 * @property {string} cwd - 工作目录
 * @property {Object} env - 环境变量
 * @property {number} timeout - 超时时间(ms)
 * @property {string} input - 输入数据
 */

/**
 * 执行结果
 * @typedef {Object} ExecutionResult
 * @property {number} code - 退出码
 * @property {string} stdout - 标准输出
 * @property {string} stderr - 错误输出
 * @property {number} duration - 执行时长(ms)
 * @property {boolean} success - 是否成功
 */

export {
  ICommandExecutor
};