/**
 * 应用主入口
 * 重构后的主程序，遵循SRP、KISS、DRY、YAGNI原则
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 设置Node.js环境变量以支持模块解析
process.env.NODE_OPTIONS = '--no-warnings';

// 导入管理器模块
const AppState = require('./src/core/state-manager');
const Logger = require('./src/core/logger');
const ErrorHandler = require('./src/core/error-handler');
const RuntimeManager = require('./src/services/runtime-manager');
const ModuleLoader = require('./src/services/module-loader');
const ServiceManager = require('./src/services/service-manager');
const TrayManager = require('./src/ui/tray-manager');
const UpdateManager = require('./src/services/update-manager');
const AboutDialogManager = require('./src/ui/about-dialog-manager');
const IconManager = require('./src/utils/icon-manager');

class PromptManagerApp {
  constructor() {
    this.stateManager = new AppState();
    this.logger = new Logger({ debugEnabled: false });
    this.errorHandler = new ErrorHandler(this.logger);
    this.runtimeManager = new RuntimeManager(this.logger, this.errorHandler);
    this.moduleLoader = new ModuleLoader(this.logger, this.errorHandler);
    this.iconManager = new IconManager();
    this.serviceManager = new ServiceManager(this.logger, this.errorHandler, this.moduleLoader);
    this.updateManager = new UpdateManager(this.logger, this.errorHandler, this.runtimeManager);
    this.aboutDialogManager = new AboutDialogManager(this.logger, this.runtimeManager, this.iconManager);
    this.trayManager = new TrayManager(this.logger, this.errorHandler, this.iconManager);
    
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing Prompt Manager Desktop Application');
      
      // 初始化日志系统
      await this.logger.initialize();
      
      // 设置应用菜单
      this.setupApplicationMenu();
      
      // 初始化系统托盘
      await this.trayManager.initialize(this.stateManager);
      
      // 设置事件监听
      this.setupEventListeners();
      
      // 确保运行时环境
      const serverRoot = await this.runtimeManager.ensureRuntimeEnvironment();
      this.stateManager.set('runtimeRoot', serverRoot);
      
      // 启动服务
      await this.startService();
      
      this.isInitialized = true;
      this.logger.info('Application initialized successfully');
      
    } catch (error) {
      this.logger.error('Application initialization failed', error);
      this.errorHandler.handleError('APP_INIT_FAILED', error, {
        logFilePath: this.logger.getLogFilePath()
      });
      
      throw error;
    }
  }

  setupApplicationMenu() {
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
    
    // 隐藏默认应用菜单
    const { Menu } = require('electron');
    Menu.setApplicationMenu(null);
  }

  setupEventListeners() {
    // 托盘事件
    this.trayManager.on('service-start-requested', () => this.startService());
    this.trayManager.on('service-stop-requested', () => this.stopService());
    this.trayManager.on('update-check-requested', () => this.checkForUpdates());
    this.trayManager.on('about-dialog-requested', () => this.showAboutDialog());
    this.trayManager.on('quit-requested', () => this.quitApplication());
    
    // 服务管理器事件
    this.serviceManager.on('status-update', () => this.trayManager.updateMenu());
    this.serviceManager.on('restart-requested', () => this.restartApplication());
    
    // IPC事件
    ipcMain.on('about-window-click', (event, data) => {
      this.aboutDialogManager.handleAboutWindowClick(data);
    });
    
    // 应用事件
    app.on('window-all-closed', (event) => {
      event.preventDefault(); // 防止应用退出
    });
    
    app.on('before-quit', async (event) => {
      if (this.stateManager.get('isQuitting')) return;
      
      event.preventDefault();
      await this.quitApplication();
    });
    
    app.on('activate', () => {
      if (!this.trayManager.tray) {
        this.trayManager.initialize(this.stateManager);
      }
    });
  }

  async startService() {
    const serverRoot = this.stateManager.get('runtimeRoot');
    if (!serverRoot) {
      this.logger.error('Cannot start service: runtime root not set');
      return false;
    }
    
    return await this.serviceManager.startService(serverRoot, this.stateManager);
  }

  async stopService() {
    return await this.serviceManager.stopService(this.stateManager);
  }

  async checkForUpdates() {
    try {
      await this.updateManager.checkForUpdates();
    } catch (error) {
      this.logger.error('Update check failed', error);
    }
  }

  showAboutDialog() {
    this.aboutDialogManager.showAboutDialog();
  }

  handleAboutWindowClick(data) {
    // 委托给AboutDialogManager处理
    this.aboutDialogManager.handleAboutWindowClick(data);
  }

  async restartApplication() {
    this.logger.info('Restarting application');
    
    try {
      await this.stopService();
      app.relaunch();
      app.exit(0);
    } catch (error) {
      this.logger.error('Failed to restart application', error);
    }
  }

  async quitApplication() {
    this.logger.info('Quitting application');
    
    try {
      this.stateManager.set('isQuitting', true);
      
      // 停止服务
      await this.stopService();
      
      // 清理资源
      await this.aboutDialogManager.closeAboutDialog();
      
      this.trayManager.destroy();
      await this.logger.close();
      await this.runtimeManager.cleanup();
      
      app.quit();
    } catch (error) {
      this.logger.error('Error during application shutdown', error);
      app.quit(); // 强制退出
    }
  }
}

// 应用启动
const promptManagerApp = new PromptManagerApp();

app.whenReady().then(async () => {
  try {
    await promptManagerApp.initialize();
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

// 异常处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (promptManagerApp.logger) {
    promptManagerApp.logger.error('Uncaught Exception', error);
  }
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (promptManagerApp.logger) {
    promptManagerApp.logger.error('Unhandled Rejection', reason);
  }
});