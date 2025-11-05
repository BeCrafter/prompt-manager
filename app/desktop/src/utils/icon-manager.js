/**
 * 图标管理器
 * 负责管理和提供应用程序图标
 */

const { nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

class IconManager {
  constructor() {
    this.iconCache = new Map();
    this.iconPaths = this.getIconPaths();
  }

  /**
   * 获取图标路径配置
   */
  getIconPaths() {
    const basePath = path.join(__dirname, '..', '..', 'assets', 'icons');
    
    return {
      '16': path.join(basePath, 'icon_16x16.png'),
      '24': path.join(basePath, 'icon_24x24.png'),
      '32': path.join(basePath, 'icon_32x32.png'),
      '48': path.join(basePath, 'icon_48x48.png'),
      '64': path.join(basePath, 'icon_64x64.png'),
      '96': path.join(basePath, 'icon_96x96.png'),
      '128': path.join(basePath, 'icon_128x128.png'),
      '256': path.join(basePath, 'icon_256x256.png'),
      '512': path.join(basePath, 'icon_512x512.png'),
      '1024': path.join(basePath, 'icon_1024x1024.png'),
      'default': path.join(basePath, 'icon.png'),
      'ico': path.join(basePath, 'icon.ico'),
      'icns': path.join(basePath, 'icon.icns')
    };
  }

  /**
   * 获取指定尺寸的图标
   * @param {string|number} size - 图标尺寸
   * @returns {nativeImage|null} - 图标对象
   */
  getIcon(size = 'default') {
    const sizeKey = String(size);
    
    if (this.iconCache.has(sizeKey)) {
      return this.iconCache.get(sizeKey);
    }

    const iconPath = this.iconPaths[sizeKey];
    if (!iconPath || !fs.existsSync(iconPath)) {
      // 防止递归调用：如果正在请求默认图标但找不到，返回 null
      if (sizeKey === 'default') {
        console.warn(`Default icon not found at ${iconPath}`);
        return null;
      }
      
      console.warn(`Icon not found for size ${sizeKey}, trying default`);
      return this.getIcon('default');
    }

    try {
      const icon = nativeImage.createFromPath(iconPath);
      
      if (icon.isEmpty()) {
        console.warn(`Failed to load icon from ${iconPath}`);
        // 如果是默认图标加载失败，返回 null 避免递归
        if (sizeKey === 'default') {
          return null;
        }
        // 否则尝试加载默认图标
        return this.getIcon('default');
      }

      this.iconCache.set(sizeKey, icon);
      return icon;
    } catch (error) {
      console.error(`Error loading icon ${iconPath}:`, error);
      // 如果是默认图标加载失败，返回 null 避免递归
      if (sizeKey === 'default') {
        return null;
      }
      // 否则尝试加载默认图标
      return this.getIcon('default');
    }
  }

  /**
   * 获取托盘图标（根据平台自动选择合适尺寸）
   */
  getTrayIcon() {
    const platform = process.platform;
    let iconSize;
    
    switch (platform) {
      case 'darwin':
        iconSize = '18'; // macOS 推荐 18x18
        break;
      case 'win32':
        iconSize = '16'; // Windows 推荐 16x16
        break;
      default:
        iconSize = '24'; // Linux 推荐 24x24
    }

    let icon = this.getIcon(iconSize);
    
    if (!icon) {
      icon = this.getIcon('default');
    }

    // macOS 特殊处理
    if (platform === 'darwin' && icon) {
      try {
        icon = icon.resize({ width: 18, height: 18 });
        icon.setTemplateImage(true);
      } catch (error) {
        console.warn('Failed to resize icon for macOS:', error);
      }
    }

    return icon;
  }

  /**
   * 获取关于对话框图标
   */
  getAboutDialogIcon() {
    return this.getIcon('64') || this.getIcon('default');
  }

  /**
   * 清除图标缓存
   */
  clearCache() {
    this.iconCache.clear();
  }
}

module.exports = IconManager;