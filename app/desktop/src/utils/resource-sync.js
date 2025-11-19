/**
 * 通用资源同步工具
 * 支持将代码中的内容同步到运行环境中
 * 支持目录同步、文件同步和基于内容的文件创建
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { app } = require('electron');
const PathUtils = require('./path-utils');

class ResourceSync {
  /**
   * 检查是否为打包应用
   */
  static _checkIfPackaged() {
    const appPath = app.getAppPath();
    const isDev = appPath.includes('node_modules/electron') || 
                 process.env.NODE_ENV === 'development' ||
                 process.defaultApp;
    
    return !isDev && app.isPackaged;
  }

  /**
   * 获取项目根目录（开发模式）
   */
  static _getProjectRoot() {
    // 从 app/desktop/src/utils -> 项目根目录
    return path.resolve(__dirname, '..', '..', '..', '..');
  }

  /**
   * 获取用户配置根目录
   */
  static _getUserConfigRoot() {
    return path.join(os.homedir(), '.prompt-manager');
  }

  /**
   * 查找实际存在的源路径
   * @param {Object} options - 查找选项
   * @param {string|Function} options.devPath - 开发模式下的路径（字符串或返回路径的函数）
   * @param {string[]|Function} options.packagedPaths - 打包模式下的可能路径数组（或返回路径数组的函数）
   * @returns {Promise<string|null>} 找到的源路径，如果不存在则返回 null
   */
  static async findSourcePath({ devPath, packagedPaths }) {
    const isPackaged = this._checkIfPackaged();
    
    if (isPackaged) {
      // 打包模式
      let paths;
      if (typeof packagedPaths === 'function') {
        paths = packagedPaths();
      } else {
        paths = packagedPaths || [];
      }

      // 尝试每个路径，返回第一个存在的
      for (const possiblePath of paths) {
        try {
          if (await PathUtils.pathExists(possiblePath)) {
            return possiblePath;
          }
        } catch (error) {
          // 继续尝试下一个路径
          continue;
        }
      }
      
      console.warn('在打包模式下未找到源路径，尝试的路径:', paths);
      return null;
    } else {
      // 开发模式
      let sourcePath;
      if (typeof devPath === 'function') {
        sourcePath = devPath();
      } else {
        sourcePath = devPath;
      }

      if (sourcePath && await PathUtils.pathExists(sourcePath)) {
        return sourcePath;
      }
      
      console.warn('在开发模式下未找到源路径:', sourcePath);
      return null;
    }
  }

  /**
   * 同步目录
   * @param {Object} config - 同步配置
   * @param {string} config.targetPath - 目标目录路径
   * @param {string|Function} config.devPath - 开发模式下的源路径
   * @param {string[]|Function} config.packagedPaths - 打包模式下的可能源路径
   * @param {boolean} config.skipIfExists - 如果目标已存在则跳过（默认: true）
   * @param {string} config.name - 资源名称（用于日志）
   * @returns {Promise<Object>} 同步结果
   */
  static async syncDirectory({
    targetPath,
    devPath,
    packagedPaths,
    skipIfExists = true,
    name = '目录'
  }) {
    try {
      // 检查目标目录是否已存在
      const targetExists = await PathUtils.pathExists(targetPath);
      if (targetExists && skipIfExists) {
        console.log(`${name}目录已存在，跳过同步: ${targetPath}`);
        return { success: true, skipped: true, targetPath };
      }

      // 查找源路径
      const sourcePath = await this.findSourcePath({ devPath, packagedPaths });
      
      if (!sourcePath) {
        console.warn(`未找到源${name}目录，跳过同步`);
        return { success: false, error: `Source ${name} directory not found` };
      }

      // 创建目标目录的父目录
      await PathUtils.ensureDir(path.dirname(targetPath));
      
      // 如果目标已存在但不跳过，先删除
      if (targetExists && !skipIfExists) {
        await PathUtils.safeRemoveDir(targetPath);
      }

      // 创建目标目录
      await PathUtils.ensureDir(targetPath);
      console.log(`已创建${name}目录: ${targetPath}`);

      // 复制目录内容
      await PathUtils.copyDir(sourcePath, targetPath);
      console.log(`已同步${name}: ${sourcePath} -> ${targetPath}`);

      return { 
        success: true, 
        skipped: false, 
        targetPath, 
        sourcePath 
      };
    } catch (error) {
      console.error(`${name}同步失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 同步文件（从源文件复制）
   * @param {Object} config - 同步配置
   * @param {string} config.targetPath - 目标文件路径
   * @param {string|Function} config.devPath - 开发模式下的源文件路径
   * @param {string[]|Function} config.packagedPaths - 打包模式下的可能源文件路径
   * @param {boolean} config.skipIfExists - 如果目标已存在则跳过（默认: true）
   * @param {string} config.name - 资源名称（用于日志）
   * @returns {Promise<Object>} 同步结果
   */
  static async syncFile({
    targetPath,
    devPath,
    packagedPaths,
    skipIfExists = true,
    name = '文件'
  }) {
    try {
      // 检查目标文件是否已存在
      const targetExists = await PathUtils.pathExists(targetPath);
      if (targetExists && skipIfExists) {
        console.log(`${name}文件已存在，跳过同步: ${targetPath}`);
        return { success: true, skipped: true, targetPath };
      }

      // 查找源路径
      const sourcePath = await this.findSourcePath({ devPath, packagedPaths });
      
      if (!sourcePath) {
        console.warn(`未找到源${name}文件，跳过同步`);
        return { success: false, error: `Source ${name} file not found` };
      }

      // 创建目标文件的父目录
      await PathUtils.ensureDir(path.dirname(targetPath));

      // 复制文件
      await fs.copyFile(sourcePath, targetPath);
      console.log(`已同步${name}文件: ${sourcePath} -> ${targetPath}`);

      return { 
        success: true, 
        skipped: false, 
        targetPath, 
        sourcePath 
      };
    } catch (error) {
      console.error(`${name}文件同步失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 基于内容创建文件
   * @param {Object} config - 同步配置
   * @param {string} config.targetPath - 目标文件路径
   * @param {string|Function} config.content - 文件内容（字符串或返回内容的函数）
   * @param {boolean} config.skipIfExists - 如果目标已存在则跳过（默认: true）
   * @param {string} config.name - 资源名称（用于日志）
   * @returns {Promise<Object>} 同步结果
   */
  static async syncContent({
    targetPath,
    content,
    skipIfExists = true,
    name = '文件'
  }) {
    try {
      // 检查目标文件是否已存在
      const targetExists = await PathUtils.pathExists(targetPath);
      if (targetExists && skipIfExists) {
        console.log(`${name}文件已存在，跳过创建: ${targetPath}`);
        return { success: true, skipped: true, targetPath };
      }

      // 获取文件内容
      let fileContent;
      if (typeof content === 'function') {
        fileContent = content();
      } else {
        fileContent = content;
      }

      if (!fileContent) {
        return { success: false, error: 'Content is required' };
      }

      // 创建目标文件的父目录
      await PathUtils.ensureDir(path.dirname(targetPath));

      // 写入文件
      await fs.writeFile(targetPath, fileContent, 'utf8');
      console.log(`已创建${name}文件: ${targetPath}`);

      return { 
        success: true, 
        skipped: false, 
        targetPath 
      };
    } catch (error) {
      console.error(`${name}文件创建失败:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ResourceSync;

