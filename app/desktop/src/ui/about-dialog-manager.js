const { BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const TemplateRenderer = require('../utils/template-renderer');
const IconManager = require('../utils/icon-manager');

class AboutDialogManager {
  constructor(logger, runtimeManager, iconManager) {
    this.logger = logger;
    this.runtimeManager = runtimeManager;
    this.iconManager = iconManager;
    this.aboutWindow = null;
    this.clickCount = 0;
    this.lastClickTime = 0;
    this.templateRenderer = new TemplateRenderer();
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
      
      // 获取图标数据
      const logoIcon = this.iconManager.getAboutDialogIcon();
      const logoData = logoIcon ? logoIcon.toPNG().toString('base64') : '';
      
      // 准备模板数据
      const templateData = {
        version: packageInfo.version,
        electronVersion: electronVersion,
        nodeVersion: nodeVersion,
        logoData: logoData,
        debugLogEnabled: debugEnabled,
        clickCount: 3 - this.clickCount,
        logFilePath: debugEnabled ? this.logger.getLogFilePath() : ''
      };
      
      // 使用TemplateRenderer渲染模板
      const htmlContent = this.templateRenderer.render('about', templateData);
      
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
      
      // 获取图标数据
      const logoIcon = this.iconManager.getAboutDialogIcon();
      const logoData = logoIcon ? logoIcon.toPNG().toString('base64') : '';
      
      // 准备模板数据
      const templateData = {
        version: packageInfo.version,
        electronVersion: electronVersion,
        nodeVersion: nodeVersion,
        logoData: logoData,
        debugLogEnabled: debugEnabled,
        clickCount: 3 - this.clickCount,
        logFilePath: debugEnabled ? this.logger.getLogFilePath() : ''
      };
      
      // 使用TemplateRenderer重新渲染模板
      const htmlContent = this.templateRenderer.render('about', templateData);
      
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