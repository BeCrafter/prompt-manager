const fs = require('fs').promises;
const path = require('path');
const { constants } = require('fs');

/**
 * 路径工具类 - 提供文件系统相关工具方法
 * 专注于文件系统操作和路径处理
 */
class PathUtils {
  /**
   * 检查路径是否存在
   */
  static async pathExists(targetPath) {
    try {
      await fs.access(targetPath, constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 安全地删除目录
   */
  static async safeRemoveDir(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to remove directory ${dirPath}:`, error.message);
    }
  }

  /**
   * 确保目录存在
   */
  static async ensureDir(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 复制目录
   */
  static async copyDir(src, dest) {
    try {
      await fs.cp(src, dest, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to copy directory from ${src} to ${dest}: ${error.message}`);
    }
  }
}

module.exports = PathUtils;