/**
 * 版本比较工具
 * 提供版本号比较功能
 */

class VersionUtils {
  /**
   * 比较两个版本号
   * @param {string} versionA - 版本A
   * @param {string} versionB - 版本B
   * @returns {number} - 如果A>B返回正数，A<B返回负数，相等返回0
   */
  static compareVersions(a, b) {
    const toNumbers = (value = '') => value.split('.').map((part) => parseInt(part, 10) || 0);
    const [a1, a2, a3] = toNumbers(a);
    const [b1, b2, b3] = toNumbers(b);
    
    if (a1 !== b1) return a1 - b1;
    if (a2 !== b2) return a2 - b2;
    return a3 - b3;
  }

  /**
   * 检查版本是否为有效格式
   * @param {string} version - 版本号
   * @returns {boolean} - 是否有效
   */
  static isValidVersion(version) {
    if (!version || typeof version !== 'string') return false;
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  /**
   * 解析版本号
   * @param {string} version - 版本号
   * @returns {object} - 解析后的版本对象
   */
  static parseVersion(version) {
    if (!this.isValidVersion(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }
    
    const [major, minor, patch] = version.split('.').map(Number);
    return { major, minor, patch };
  }

  /**
   * 格式化版本号
   * @param {number} major - 主版本号
   * @param {number} minor - 次版本号
   * @param {number} patch - 修订版本号
   * @returns {string} - 格式化后的版本号
   */
  static formatVersion(major, minor, patch) {
    return `${major}.${minor}.${patch}`;
  }
}

module.exports = VersionUtils;