const { Tray, Menu, clipboard, nativeImage, dialog, shell, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('../core/event-emitter');

class TrayManager extends EventEmitter {
  constructor(logger, errorHandler, iconManager) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.iconManager = iconManager;
    this.tray = null;
    this.menuTemplate = [];
    this.iconPaths = [];
    this.currentState = null;
    this.adminWindow = null; // 添加adminWindow引用
  }

  async initialize(stateManager) {
    this.currentState = stateManager;

    await this.createTray();
    this.updateMenu();
    
    return this.tray;
  }

  async createTray() {
    this.logger.info('Creating system tray');
    
    try {
      const icon = await this.loadTrayIcon();
      this.tray = new Tray(icon);
      this.tray.setToolTip('Prompt Manager');
      
      this.logger.info('System tray created successfully');
    } catch (error) {
      this.logger.error('Failed to create tray icon', error);
      
      // 降级处理：使用空图标
      try {
        this.tray = new Tray(nativeImage.createEmpty());
        this.tray.setToolTip('Prompt Manager - Icon Missing');
        this.logger.warn('Created tray with empty icon as fallback');
      } catch (fallbackError) {
        this.errorHandler.handleIconLoadError(fallbackError);
        throw fallbackError;
      }
    }
  }

  async loadTrayIcon() {
    const icon = this.iconManager.getTrayIcon();
    
    if (!icon) {
      throw new Error('Failed to load tray icon from icon manager');
    }
    
    this.logger.info('Tray icon loaded successfully', { 
      isEmpty: icon.isEmpty(), 
      size: icon.getSize() 
    });
    
    return icon;
  }

  updateMenu() {
    if (!this.tray || !this.currentState) return;
    
    const menu = Menu.buildFromTemplate(this.buildMenuTemplate());
    this.tray.setContextMenu(menu);
    
    this.logger.debug('Tray menu updated');
  }

  buildMenuTemplate() {
    const state = this.currentState.get();
    const serviceStatus = this.currentState.getServiceStatus();
    const isRunning = this.currentState.isServiceRunning();
    const serverAddress = state.server?.address || 'http://127.0.0.1:5621';
    const adminUrl = state.server?.adminPath ? 
      `${serverAddress}${state.server.adminPath}` : 
      `${serverAddress}/admin`;

    return [
      {
        label: `状态：${serviceStatus}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: isRunning ? '停止服务' : '启动服务',
        click: () => this.handleServiceToggle()
      },
      {
        label: '复制服务地址',
        enabled: isRunning,
        click: () => this.copyServiceAddress(serverAddress)
      },
      {
        label: '打开管理后台',
        enabled: isRunning,
        click: () => this.openAdminWindow(adminUrl)
      },
      { type: 'separator' },
      {
        label: '检查更新',
        click: () => this.checkForUpdates()
      },
      {
        label: '关于服务',
        click: () => this.showAboutDialog()
      },
      { type: 'separator' },
      {
        label: '退出服务',
        click: () => this.quitApplication()
      }
    ];
  }

  handleServiceToggle() {
    const isRunning = this.currentState.isServiceRunning();
    
    if (isRunning) {
      this.logger.info('User requested to stop service');
      this.emit('service-stop-requested');
    } else {
      this.logger.info('User requested to start service');
      this.emit('service-start-requested');
    }
  }

  copyServiceAddress(address) {
    try {
      const serviceUrl = `${address}/mcp`;
      clipboard.writeText(serviceUrl);
      this.logger.info('Service address copied to clipboard', { address: serviceUrl });
    } catch (error) {
      this.logger.error('Failed to copy service address', error);
    }
  }

  openAdminWindow(adminUrl) {
    if (this.adminWindow) {
      this.adminWindow.focus();
      return;
    }

    try {
      this.adminWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Prompt Server 管理后台',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      this.adminWindow.loadURL(adminUrl);
      
      this.adminWindow.on('closed', () => {
        this.adminWindow = null;
      });

      this.logger.info('Admin window opened', { url: adminUrl });
    } catch (error) {
      this.logger.error('Failed to open admin window', error);
    }
  }

  checkForUpdates() {
    this.logger.info('User requested to check for updates');
    this.emit('update-check-requested');
  }

  showAboutDialog() {
    this.logger.info('User requested to show about dialog');
    this.emit('about-dialog-requested');
  }

  quitApplication() {
    this.logger.info('User requested to quit application');
    this.emit('quit-requested');
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.logger.info('Tray destroyed');
    }
    
    if (this.adminWindow) {
      this.adminWindow.close();
      this.adminWindow = null;
    }
  }
}

module.exports = TrayManager;