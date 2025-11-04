/**
 * 路径工具
 * 提供路径相关的实用功能
 */

const path = require('path');
const fs = require('fs');

class PathUtils {
  /**
   * 确保目录存在，如果不存在则创建
   * @param {string} dirPath - 目录路径
   * @returns {Promise<void>}
   */
  static async ensureDir(dirPath) {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 检查路径是否存在
   * @param {string} targetPath - 目标路径
   * @returns {Promise<boolean>}
   */
  static async pathExists(targetPath) {
    try {
      await fs.promises.access(targetPath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 安全地删除目录
   * @param {string} targetPath - 目标路径
   * @returns {Promise<void>}
   */
  static async safeRemoveDir(targetPath) {
    try {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } catch (error) {
      // 忽略不存在的目录错误
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 复制目录内容
   * @param {string} source - 源目录
   * @param {string} destination - 目标目录
   * @returns {Promise<void>}
   */
  static async copyDir(source, destination) {
    await this.ensureDir(destination);
    
    const entries = await fs.promises.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 获取文件扩展名
   * @param {string} filePath - 文件路径
   * @returns {string}
   */
  static getFileExtension(filePath) {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * 检查是否为图片文件
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  static isImageFile(filePath) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.ico'];
    return imageExtensions.includes(this.getFileExtension(filePath));
  }

  /**
   * 规范化路径
   * @param {string} inputPath - 输入路径
   * @returns {string}
   */
  static normalizePath(inputPath) {
    return path.normalize(inputPath);
  }

  /**
   * 获取相对路径
   * @param {string} from - 起始路径
   * @param {string} to - 目标路径
   * @returns {string}
   */
  static getRelativePath(from, to) {
    return path.relative(from, to);
  }

  /**
   * 解析路径
   * @param {string} inputPath - 输入路径
   * @returns {object}
   */
  static parsePath(inputPath) {
    return path.parse(inputPath);
  }

  /**
   * 获取安全的文件名
   * @param {string} fileName - 原始文件名
   * @returns {string}
   */
  static getSafeFileName(fileName) {
    // 移除不安全的字符
    return fileName.replace(/[<>:"/\\|?*]/g, '_');
  }
}

module.exports = PathUtils;