const { dialog, shell } = require('electron');
const EventEmitter = require('../core/event-emitter');

class ServiceManager extends EventEmitter {
  constructor(logger, errorHandler, moduleLoader) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.moduleLoader = moduleLoader;
    this.currentModule = null;
    this.serverState = null;
  }

  async startService(serverRoot, stateManager) {
    this.logger.info('Starting service', { serverRoot });
    
    try {
      // 验证服务状态
      if (!stateManager.canStartService()) {
        this.logger.warn('Service cannot be started in current state', { 
          currentState: stateManager.get('service') 
        });
        return false;
      }

      // 更新状态
      stateManager.set('service', 'starting');
      this.emitStatusUpdate(stateManager);

      // 加载服务器模块
      const module = await this.moduleLoader.loadServerModule(serverRoot, true);
      
      // 停止现有服务实例
      await this.stopExistingService(module);
      
      // 启动新服务
      await module.startServer();
      
      // 增强的服务器验证机制
      let isRunning = false;
      let retryCount = 0;
      const maxRetries = 5;
      const retryDelay = 1000; // 1秒
      
      this.logger.info('Verifying server startup...');
      
      while (!isRunning && retryCount < maxRetries) {
        try {
          this.logger.debug(`Server verification attempt ${retryCount + 1}/${maxRetries}`);
          isRunning = await module.isServerRunning();
          
          if (!isRunning) {
            retryCount++;
            if (retryCount < maxRetries) {
              this.logger.debug(`Server not running, waiting ${retryDelay}ms before next attempt...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        } catch (error) {
          retryCount++;
          this.logger.debug(`Server check failed (attempt ${retryCount}/${maxRetries}):`, { 
            error: error.message 
          });
          
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
      
      if (!isRunning) {
        const errorMsg = `服务器启动失败：经过 ${maxRetries} 次重试后仍无法验证服务状态`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      this.logger.info('Server verification successful');
      
      // 获取服务器状态
      this.serverState = module.getServerState();
      this.currentModule = module;
      
      // 更新状态
      stateManager.set({
        service: 'running',
        server: this.serverState,
        module: module
      });
      stateManager.resetFailureCount();
      
      this.logger.info('Service started successfully', { serverState: this.serverState });
      this.emitStatusUpdate(stateManager);
      
      return true;
      
    } catch (error) {
      this.logger.error('Failed to start service', error);
      
      // 更新状态
      stateManager.set('service', 'error');
      this.serverState = { status: 'error', message: error.message };
      const failureCount = stateManager.incrementFailureCount();
      
      // 处理错误
      const shouldRestart = await this.errorHandler.handleServiceStartError(
        error, 
        failureCount, 
        this.logger.getLogFilePath()
      );
      
      if (shouldRestart) {
        this.logger.info('User requested application restart');
        this.emitRestartRequested();
      }
      
      this.emitStatusUpdate(stateManager);
      return false;
    }
  }

  async stopService(stateManager) {
    this.logger.info('Stopping service');
    
    try {
      // 验证服务状态
      if (!stateManager.canStopService()) {
        this.logger.warn('Service cannot be stopped in current state', { 
          currentState: stateManager.get('service') 
        });
        return false;
      }

      // 更新状态
      stateManager.set('service', 'stopping');
      this.emitStatusUpdate(stateManager);

      // 停止服务
      if (this.currentModule && typeof this.currentModule.stopServer === 'function') {
        await this.currentModule.stopServer();
        this.logger.info('Server stopped successfully');
      }

      // 清理状态
      this.currentModule = null;
      this.serverState = null;
      
      // 更新状态
      stateManager.set({
        service: 'stopped',
        server: null,
        module: null
      });
      
      // 清理模块缓存
      const serverRoot = stateManager.get('runtimeRoot');
      if (serverRoot) {
        this.moduleLoader.clearCache(serverRoot);
      }
      
      this.logger.info('Service stopped successfully');
      this.emitStatusUpdate(stateManager);
      
      return true;
      
    } catch (error) {
      this.logger.error('Failed to stop service', error);
      
      // 更新状态
      stateManager.set('service', 'error');
      this.errorHandler.handleError('SERVICE_STOP_FAILED', error);
      this.emitStatusUpdate(stateManager);
      
      return false;
    }
  }

  async stopExistingService(module) {
    if (!module || typeof module.stopServer !== 'function') {
      this.logger.debug('No existing service to stop');
      return;
    }

    try {
      this.logger.debug('Stopping existing service instance');
      await module.stopServer();
      this.logger.info('Existing service instance stopped');
    } catch (error) {
      this.logger.warn('Failed to stop existing service instance', error);
      // 不抛出错误，继续启动新服务
    }
  }

  getServiceStatus() {
    return {
      state: this.serverState,
      module: this.currentModule,
      isRunning: this.currentModule !== null
    };
  }

  emitStatusUpdate(stateManager) {
    this.emit('status-update', stateManager.getServiceStatus());
  }

  emitRestartRequested() {
    this.emit('restart-requested');
  }
}

module.exports = ServiceManager;