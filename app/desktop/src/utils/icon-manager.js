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
      'icns': path.join(basePath, 'icon.icns'),
      'ico':  path.join(basePath, 'icon.ico'),
      'png':  path.join(basePath, 'icon.png'),
      'tray': path.join(basePath, 'tray.png'),
    };
  }

  /**
   * 获取应用程序图标
   * @returns {nativeImage|null} - 图标对象
   */
  getAppIcon() {
    const platform = process.platform;
    if (platform === 'darwin') {
      const iconPath = this.iconPaths['icns'];
      return fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;
    } else if (platform === 'win32') {
      const iconPath = this.iconPaths['ico'];
      return fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;
    }
    const iconPath = this.iconPaths['png'];
    return fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : null;
  }

  /**
   * 获取指定尺寸的托盘图标
   * @param {string|number} size - 图标尺寸
   * @returns {nativeImage|null} - 图标对象
   */
  getTrayIconBySize(size) {
    const sizeKey = String(size);
    
    if (this.iconCache.has(`tray-${sizeKey}`)) {
      return this.iconCache.get(`tray-${sizeKey}`);
    }

    const iconPath = this.iconPaths['tray'];
    if (!iconPath || !fs.existsSync(iconPath)) {
      console.warn(`Tray icon not found for size ${sizeKey}`);
      return null;
    }

    try {
      const icon = nativeImage.createFromPath(iconPath);
      icon.resize({ width: size, height: size });
      
      if (icon.isEmpty()) {
        console.warn(`Failed to load tray icon from ${iconPath}`);
        return null;
      }

      this.iconCache.set(`tray-${sizeKey}`, icon);
      return icon;
    } catch (error) {
      console.error(`Error loading tray icon ${iconPath}:`, error);
      return null;
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

    let icon = this.getTrayIconBySize(iconSize);

    // macOS 特殊处理
    if (platform === 'darwin' && icon) {
      try {
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
    // 优先使用应用图标，如果没有则使用较大的托盘图标
    const appIcon = this.getAppIcon();
    return appIcon.resize({ width: 64, height: 64 });
  }

  /**
   * 清除图标缓存
   */
  clearCache() {
    this.iconCache.clear();
  }
}

module.exports = IconManager;