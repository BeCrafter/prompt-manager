/**
 * 应用主入口
 * 重构后的主程序，遵循SRP、KISS、DRY、YAGNI原则
 */

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');

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
const SplashManager = require('./src/ui/splash-manager');
const IconManager = require('./src/utils/icon-manager');
const RuntimeSync = require('./src/utils/runtime-sync');
const SelfCheck = require('./src/utils/self-check');

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
    this.splashManager = new SplashManager(this.logger, this.iconManager);
    
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing Prompt Manager Desktop Application');
      
      // 显示启动画面
      await this.splashManager.showSplash();
      this.splashManager.updateStatus('正在初始化...', 10);
      
      // 运行应用自检
      this.splashManager.updateStatus('正在检查应用环境...', 20);
      const selfCheck = new SelfCheck(this.logger);
      const selfCheckPassed = await selfCheck.run();
      
      if (!selfCheckPassed) {
        const report = selfCheck.getReport();
        this.logger.warn('Application self-check found issues:\n' + report);
        
        // 即使自检有问题，也继续启动，但记录警告
        this.splashManager.updateStatus('应用环境检查完成（发现一些问题）...', 25);
      } else {
        this.splashManager.updateStatus('应用环境检查完成...', 25);
      }
      
      // 同步环境配置
      await RuntimeSync.syncRuntime();
      this.splashManager.updateStatus('正在同步工具箱...', 35);
      
      // 初始化日志系统
      await this.logger.initialize();
      
      // 设置应用菜单
      this.setupApplicationMenu();
      
      // 初始化系统托盘
      this.splashManager.updateStatus('正在启动托盘服务...', 60);
      await this.trayManager.initialize(this.stateManager);
      
      // 设置事件监听
      this.setupEventListeners();
      
      // 确保运行时环境
      this.splashManager.updateStatus('正在准备运行时环境...', 70);
      const serverRoot = await this.runtimeManager.ensureRuntimeEnvironment();
      this.stateManager.set('runtimeRoot', serverRoot);
      
      // 启动服务
      this.splashManager.updateStatus('正在启动核心服务...', 80);
      await this.startService();
      
      this.isInitialized = true;
      this.logger.info('Application initialized successfully');
      
      // 关闭启动画面
      this.splashManager.updateStatus('准备就绪...', 100);
      setTimeout(() => {
        this.splashManager.closeSplash();
      }, 500); // 短暂延迟以显示完成状态
      
    } catch (error) {
      this.logger.error('Application initialization failed', error);
      
      // 关闭启动画面
      this.splashManager.closeSplash();
      
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

    // 注册全局快捷键
    this.registerGlobalShortcuts();
  }

  /**
   * 注册全局快捷键
   */
  registerGlobalShortcuts() {
    // 注册显示应用的快捷键
    const showAccelerator = process.platform === 'darwin' ? 'Option+Command+P' : 'Alt+Shift+P';
    
    const ret = globalShortcut.register(showAccelerator, () => {
      this.logger.info('Global shortcut triggered:', showAccelerator);
      this.bringToFront();
    });

    if (!ret) {
      this.logger.warn('Failed to register global shortcut:', showAccelerator);
    } else {
      this.logger.info('Global shortcut registered successfully:', showAccelerator);
    }

    // 注册隐藏应用的快捷键
    const hideAccelerator = process.platform === 'darwin' ? 'Option+Command+H' : 'Alt+Shift+H';
    
    const hideRet = globalShortcut.register(hideAccelerator, () => {
      this.logger.info('Hide shortcut triggered:', hideAccelerator);
      this.sendToBackground();
    });

    if (!hideRet) {
      this.logger.warn('Failed to register hide shortcut:', hideAccelerator);
    } else {
      this.logger.info('Hide shortcut registered successfully:', hideAccelerator);
    }

    // 应用退出时注销所有全局快捷键
    app.on('will-quit', () => {
      globalShortcut.unregisterAll();
      this.logger.info('All global shortcuts unregistered');
    });
  }

  /**
   * 将应用带到前台
   */
  bringToFront() {
    // 显示 Dock 图标 (macOS)
    if (process.platform === 'darwin') {
      app.dock.show();
    }

    // 打开管理后台窗口
    const state = this.stateManager.get();
    const serverAddress = state.server?.address || 'http://127.0.0.1:5621';
    const adminUrl = state.server?.adminPath ? 
      `${serverAddress}${state.server.adminPath}` : 
      `${serverAddress}/admin`;

    // 如果服务正在运行，打开管理后台
    if (this.stateManager.isServiceRunning()) {
      this.trayManager.openAdminWindow(adminUrl);
    } else {
      // 如果服务未运行，启动服务
      this.logger.info('Service not running, starting service...');
      this.startService();
    }
  }

  /**
   * 将应用隐藏到后台
   */
  sendToBackground() {
    // 关闭所有窗口
    this.trayManager.adminWindowManager.closeAdminWindow();

    // 隐藏 Dock 图标 (macOS)
    if (process.platform === 'darwin') {
      app.dock.hide();
    }

    this.logger.info('Application sent to background');
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
      
      // 关闭启动画面
      await this.splashManager.closeSplash();
      
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