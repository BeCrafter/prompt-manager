/**
 * 沙箱管理接口 - 专一职责：沙箱管理
 * 遵循接口隔离原则(ISP)，确保接口专一性
 */

class ISandboxManager {
  /**
   * 创建沙箱
   * @param {SandboxConfig} config - 沙箱配置
   * @returns {Promise<Sandbox>} 沙箱实例
   */
  async createSandbox(config) {
    throw new Error('createSandbox must be implemented by subclass');
  }
  
  /**
   * 销毁沙箱
   * @param {string} sandboxId - 沙箱ID
   * @returns {Promise<void>}
   */
  async destroySandbox(sandboxId) {
    throw new Error('destroySandbox must be implemented by subclass');
  }
  
  /**
   * 获取沙箱状态
   * @param {string} sandboxId - 沙箱ID
   * @returns {Promise<SandboxStatus>} 沙箱状态
   */
  async getSandboxStatus(sandboxId) {
    throw new Error('getSandboxStatus must be implemented by subclass');
  }
  
  /**
   * 列出所有沙箱
   * @returns {Promise<Sandbox[]>} 沙箱列表
   */
  async listSandboxes() {
    throw new Error('listSandboxes must be implemented by subclass');
  }
}

/**
 * 沙箱配置
 * @typedef {Object} SandboxConfig
 * @property {string} toolName - 工具名称
 * @property {Object} runtimeRequirements - 运行时需求
 * @property {Object} security - 安全配置
 * @property {Object} limits - 资源限制
 * @property {string} [workingDir] - 工作目录
 */

/**
 * 沙箱实例
 * @typedef {Object} Sandbox
 * @property {string} id - 沙箱ID
 * @property {string} directory - 沙箱目录
 * @property {Object} security - 安全配置
 * @property {Object} runtime - 运行时实例
 * @property {Date} createdAt - 创建时间
 * @property {string} status - 状态: 'creating', 'ready', 'running', 'stopped', 'error'
 */

/**
 * 沙箱状态
 * @typedef {Object} SandboxStatus
 * @property {string} id - 沙箱ID
 * @property {string} status - 状态
 * @property {Object} resourceUsage - 资源使用情况
 * @property {Date} lastActivity - 最后活动时间
 * @property {number} uptime - 运行时长(ms)
 */

export {
  ISandboxManager
};