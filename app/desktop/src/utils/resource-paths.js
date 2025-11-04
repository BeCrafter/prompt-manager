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
   * 图标路径
   */
  static get icons() {
    const iconsPath = path.join(__dirname, '..', '..', 'assets', 'icons');
    return {
      base: iconsPath,
      '16': path.join(iconsPath, 'icon_16x16.png'),
      '24': path.join(iconsPath, 'icon_24x24.png'),
      '32': path.join(iconsPath, 'icon_32x32.png'),
      '48': path.join(iconsPath, 'icon_48x48.png'),
      '64': path.join(iconsPath, 'icon_64x64.png'),
      '96': path.join(iconsPath, 'icon_96x96.png'),
      '128': path.join(iconsPath, 'icon_128x128.png'),
      '256': path.join(iconsPath, 'icon_256x256.png'),
      '512': path.join(iconsPath, 'icon_512x512.png'),
      '1024': path.join(iconsPath, 'icon_1024x1024.png'),
      'default': path.join(iconsPath, 'icon.png'),
      'ico': path.join(iconsPath, 'icon.ico'),
      'icns': path.join(iconsPath, 'icon.icns')
    };
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
    return path.join(__dirname, '..', '..', 'main-refactored.js');
  }

  /**
   * 包信息路径
   */
  static get packageJson() {
    return path.join(__dirname, '..', '..', '..', '..', 'package.json');
  }

  /**
   * 获取相对路径
   */
  static getRelativePath(from, to) {
    return path.relative(from, to);
  }

  /**
   * 规范化路径
   */
  static normalizePath(inputPath) {
    return path.normalize(inputPath);
  }

  /**
   * 解析路径
   */
  static parsePath(inputPath) {
    return path.parse(inputPath);
  }

  /**
   * 检查是否为图标文件
   */
  static isIconFile(filePath) {
    const iconExtensions = ['.png', '.ico', '.icns'];
    const ext = path.extname(filePath).toLowerCase();
    return iconExtensions.includes(ext);
  }

  /**
   * 检查是否为模板文件
   */
  static isTemplateFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.html';
  }

  /**
   * 获取资源类型
   */
  static getResourceType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (this.isIconFile(filePath)) return 'icon';
    if (this.isTemplateFile(filePath)) return 'template';
    if (ext === '.js') return 'script';
    if (ext === '.json') return 'config';
    
    return 'unknown';
  }

  /**
   * 获取所有资源路径
   */
  static getAllPaths() {
    return {
      icons: this.icons,
      templates: this.templates,
      preload: this.preload,
      main: this.main,
      packageJson: this.packageJson
    };
  }
}

module.exports = ResourcePaths;