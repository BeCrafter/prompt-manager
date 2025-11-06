/**
 * 依赖管理接口 - 专一职责：依赖管理
 * 遵循接口隔离原则(ISP)，确保接口专一性
 */

class IDependencyManager {
  /**
   * 安装依赖
   * @param {Object} dependencies - 依赖配置
   * @param {string} targetDir - 目标目录
   * @returns {Promise<InstallResult>} 安装结果
   */
  async installDependencies(dependencies, targetDir) {
    throw new Error('installDependencies must be implemented by subclass');
  }
  
  /**
   * 检查依赖状态
   * @param {string} targetDir - 目标目录
   * @returns {Promise<DependencyStatus>} 依赖状态
   */
  async checkDependencies(targetDir) {
    throw new Error('checkDependencies must be implemented by subclass');
  }
  
  /**
   * 卸载依赖
   * @param {string[]} packages - 要卸载的包名
   * @param {string} targetDir - 目标目录
   * @returns {Promise<UninstallResult>} 卸载结果
   */
  async uninstallDependencies(packages, targetDir) {
    throw new Error('uninstallDependencies must be implemented by subclass');
  }
}

/**
 * 依赖配置
 * @typedef {Object} Dependencies
 * @property {string} [packageName] - 包名和版本号，如: { 'lodash': '^4.17.21' }
 */

/**
 * 安装结果
 * @typedef {Object} InstallResult
 * @property {boolean} success - 是否成功
 * @property {string[]} installed - 已安装的包列表
 * @property {string[]} failed - 安装失败的包列表
 * @property {number} duration - 安装时长(ms)
 * @property {string} output - 安装输出
 */

/**
 * 依赖状态
 * @typedef {Object} DependencyStatus
 * @property {boolean} satisfied - 依赖是否满足
 * @property {Object} installed - 已安装的依赖
 * @property {string[]} missing - 缺失的依赖
 * @property {string[]} outdated - 过期的依赖
 */

/**
 * 卸载结果
 * @typedef {Object} UninstallResult
 * @property {boolean} success - 是否成功
 * @property {string[]} uninstalled - 已卸载的包列表
 * @property {string[]} failed - 卸载失败的包列表
 * @property {number} duration - 卸载时长(ms)
 */

export {
  IDependencyManager
};