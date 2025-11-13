/**
 * 资源路径管理器
 * 集中管理所有资源文件路径
 */

const path = require('path');

class ResourcePaths {
  constructor() {
    this.basePath = path.join(__dirname, '..', '..');
    this.assetsPath = path.join(this.basePath, 'assets');
  }

  /**
   * 模板路径
   */
  static get templates() {
    const templatesPath = path.join(__dirname, '..', '..', 'assets', 'templates');
    return {
      base: templatesPath,
      about: path.join(templatesPath, 'about.html'),
      update: path.join(templatesPath, 'update.html'),
      error: path.join(templatesPath, 'error.html')
    };
  }

  /**
   * 预加载脚本路径
   */
  static get preload() {
    return path.join(__dirname, '..', '..', 'preload.js');
  }

  /**
   * 主入口路径
   */
  static get main() {
    return path.join(__dirname, '..', '..', 'main.js');
  }

  /**
   * 包信息路径
   */
  static get packageJson() {
    return path.join(__dirname, '..', '..', '..', '..', 'package.json');
  }
}

module.exports = ResourcePaths;