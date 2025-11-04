const { BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const TemplateRenderer = require('../utils/template-renderer');
const IconManager = require('../utils/icon-manager');

class AboutDialogManager {
  constructor(logger, runtimeManager) {
    this.logger = logger;
    this.runtimeManager = runtimeManager;
    this.aboutWindow = null;
    this.clickCount = 0;
    this.lastClickTime = 0;
    this.templateRenderer = new TemplateRenderer();
    this.iconManager = new IconManager();
  }

  async showAboutDialog() {
    this.logger.info('Showing about dialog');
    
    // 如果窗口已存在，直接聚焦
    if (this.aboutWindow) {
      this.aboutWindow.focus();
      return;
    }

    try {
      const packageInfo = await this.getPackageInfo();
      const electronVersion = process.versions.electron;
      const nodeVersion = process.versions.node;
      const debugEnabled = this.logger.debugEnabled;
      
      this.aboutWindow = this.createAboutWindow();
      
      // 使用现有的about.html模板文件
      const templatePath = path.join(__dirname, '..', '..', 'assets', 'templates', 'about.html');
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // 替换模板中的变量
      const logoPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'icon_64x64.png');
      let logoData = '';
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoData = logoBuffer.toString('base64');
      }
      
      let htmlContent = templateContent
        .replace(/\{\{version\}\}/g, packageInfo.version)
        .replace(/\{\{electronVersion\}\}/g, electronVersion)
        .replace(/\{\{nodeVersion\}\}/g, nodeVersion)
        .replace(/\{\{logoData\}\}/g, logoData);
      
      // 处理调试日志状态
      const clickCount = 3 - this.clickCount;
      if (debugEnabled) {
        const logFilePath = this.logger.getLogFilePath();
        htmlContent = htmlContent.replace(
          /\{\{#if debugLogEnabled\}\}(.*?)\{\{\/if\}\}/gs,
          `<div class="notification">
      <div class="notification-title">调试日志已开启</div>
      <div class="notification-content">日志文件路径: ${logFilePath}</div>
    </div>`
        );
        htmlContent = htmlContent.replace(/\{\{clickCount\}\}/g, clickCount.toString());
      } else {
        htmlContent = htmlContent.replace(/\{\{#if debugLogEnabled\}\}(.*?)\{\{\/if\}\}/gs, '');
        htmlContent = htmlContent.replace(/连续点击此窗口 (\d+) 次可(.*?)调试日志/, `连续点击此窗口 ${clickCount} 次可开启调试日志`);
      }
      
      this.aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      
      this.setupWindowEvents();
      this.setupClickTracking();
      
      this.logger.info('About dialog opened successfully');
      
    } catch (error) {
      this.logger.error('Failed to show about dialog', error);
      this.showFallbackAboutDialog(error);
    }
  }

  createAboutWindow() {
    const ResourcePaths = require('../utils/resource-paths');
    
    return new BrowserWindow({
      width: 400,
      height: 320,
      title: '关于 Prompt Manager',
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: ResourcePaths.preload
      }
    });
  }

  setupWindowEvents() {
    this.aboutWindow.on('closed', () => {
      this.aboutWindow = null;
      this.clickCount = 0;
      this.lastClickTime = 0;
      this.logger.info('About dialog closed');
    });
  }

  setupClickTracking() {
    this.aboutWindow.webContents.on('did-finish-load', () => {
      this.aboutWindow.webContents.executeJavaScript(`
        document.addEventListener('click', (event) => {
          const currentTime = Date.now();
          if (window.electronAPI) {
            window.electronAPI.sendAboutWindowClick({
              currentTime: currentTime
            });
          }
        });
      `);
    });
  }

  handleAboutWindowClick(data) {
    const currentTime = data.currentTime;
    
    // 如果距离上次点击超过3秒，重置计数器
    if (currentTime - this.lastClickTime > 3000) {
      this.clickCount = 0;
    }
    
    // 更新点击时间和计数器
    this.lastClickTime = currentTime;
    this.clickCount++;
    
    // 如果点击了3次，切换调试日志状态
    if (this.clickCount >= 3) {
      this.clickCount = 0; // 重置计数器
      const debugEnabled = !this.logger.debugEnabled;
      this.logger.setDebugEnabled(debugEnabled);
      
      // 更新窗口内容
      this.updateAboutWindowContent();
      
      this.logger.info('Debug logging toggled', { enabled: debugEnabled });
      
      // 如果开启了调试日志，显示日志文件路径
      // if (debugEnabled) {
      //   const logFilePath = this.logger.getLogFilePath();
      //   dialog.showMessageBox({
      //     type: 'info',
      //     title: '调试日志已开启',
      //     message: '调试日志已开启',
      //     detail: `日志文件路径: ${logFilePath}\n\n现在将记录更多详细信息。`
      //   });
      // }
    } else {
      // 更新窗口内容显示剩余点击次数
      this.updateAboutWindowContent();
    }
  }

  async getPackageInfo() {
    try {
      return this.runtimeManager.getPackageInfo();
    } catch (error) {
      this.logger.warn('Failed to get package info, using fallback', error);
      return { version: 'unknown' };
    }
  }

  

  updateAboutWindowContent() {
    if (!this.aboutWindow) return;
    
    try {
      const packageInfo = this.runtimeManager.getPackageInfo();
      const electronVersion = process.versions.electron;
      const nodeVersion = process.versions.node;
      const debugEnabled = this.logger.debugEnabled;
      const clickCount = 3 - this.clickCount;
      
      // 使用现有的about.html模板文件
      const templatePath = path.join(__dirname, '..', '..', 'assets', 'templates', 'about.html');
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      
      // 替换模板中的变量
      const logoPath = path.join(__dirname, '..', '..', 'assets', 'icons', 'icon_64x64.png');
      let logoData = '';
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoData = logoBuffer.toString('base64');
      }
      
      let htmlContent = templateContent
        .replace(/\{\{version\}\}/g, packageInfo.version)
        .replace(/\{\{electronVersion\}\}/g, electronVersion)
        .replace(/\{\{nodeVersion\}\}/g, nodeVersion)
        .replace(/\{\{logoData\}\}/g, logoData);
      
      // 处理调试日志状态和点击提示
      if (debugEnabled) {
        const logFilePath = this.logger.getLogFilePath();
        htmlContent = htmlContent.replace(
          /\{\{#if debugLogEnabled\}\}(.*?)\{\{\/if\}\}/gs,
          `<div class="notification">
            <div class="notification-title">调试日志已开启</div>
            <div class="notification-content">日志文件路径: ${logFilePath}</div>
          </div>`
        );
      } else {
        htmlContent = htmlContent.replace(/\{\{#if debugLogEnabled\}\}(.*?)\{\{\/if\}\}/gs, '');
      }
      
      this.aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      
    } catch (error) {
      this.logger.error('Failed to update about window content', error);
    }
  }

  showFallbackAboutDialog(error) {
    dialog.showMessageBox({
      type: 'info',
      title: '关于 Prompt Manager',
      message: 'Prompt Manager',
      detail: `版本信息获取失败: ${error.message}\n\nElectron: ${process.versions.electron}\nNode.js: ${process.versions.node}`
    });
  }

  async closeAboutDialog() {
    if (this.aboutWindow) {
      this.aboutWindow.close();
      this.aboutWindow = null;
    }
  }
}

module.exports = AboutDialogManager;