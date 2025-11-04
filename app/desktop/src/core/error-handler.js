const { dialog } = require('electron');

class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
    this.errorMessages = {
      MODULE_LOAD_FAILED: '模块加载失败',
      SERVER_INIT_FAILED: '服务器初始化失败',
      DEPENDENCY_INSTALL_FAILED: '依赖安装失败',
      SERVICE_START_FAILED: '服务启动失败',
      SERVICE_STOP_FAILED: '服务停止失败',
      UPGRADE_FAILED: '升级失败',
      ICON_LOAD_FAILED: '图标加载失败'
    };
  }

  handleError(errorType, error, context = {}) {
    const errorMessage = this.formatErrorMessage(errorType, error, context);
    
    // 记录错误日志
    this.logger.error(errorMessage, error, {
      errorType,
      context,
      timestamp: new Date().toISOString()
    });

    // 显示用户友好的错误提示
    this.showErrorDialog(errorType, errorMessage, context);
    
    return errorMessage;
  }

  formatErrorMessage(errorType, error, context) {
    const baseMessage = this.errorMessages[errorType] || '发生未知错误';
    const detailMessage = error?.message || String(error);
    
    let fullMessage = `${baseMessage}: ${detailMessage}`;
    
    if (context.logFilePath) {
      fullMessage += `\n\n请查看日志文件: ${context.logFilePath}`;
    }
    
    return fullMessage;
  }

  showErrorDialog(errorType, message, context = {}) {
    const options = {
      type: 'error',
      title: '错误',
      message: message.split('\n')[0], // 第一行作为标题
      detail: message.split('\n').slice(1).join('\n') // 其余作为详情
    };

    // 特殊错误类型的自定义处理
    switch (errorType) {
      case 'SERVICE_START_FAILED':
        if (context.failureCount >= 3) {
          options.buttons = ['重启应用', '取消'];
          options.defaultId = 0;
          options.cancelId = 1;
          options.message = '服务启动失败';
          options.detail = '多次尝试启动服务均失败，建议重启应用以恢复正常状态。';
        }
        break;
        
      case 'DEPENDENCY_INSTALL_FAILED':
        options.message = '依赖安装失败';
        options.detail = `无法安装服务器依赖: ${context.detail || '未知错误'}\n\n请查看日志文件获取更多信息。`;
        break;
    }

    return dialog.showMessageBox(options);
  }

  async handleServiceStartError(error, failureCount, logFilePath) {
    const context = { failureCount, logFilePath };
    
    if (failureCount >= 3) {
      const { response } = await this.showErrorDialog('SERVICE_START_FAILED', '', context);
      return response === 0; // 返回是否需要重启
    } else {
      this.handleError('SERVICE_START_FAILED', error, context);
      return false;
    }
  }

  handleModuleLoadError(error, context = {}) {
    return this.handleError('MODULE_LOAD_FAILED', error, context);
  }

  handleServerInitError(error, context = {}) {
    return this.handleError('SERVER_INIT_FAILED', error, context);
  }

  handleDependencyInstallError(error, context = {}) {
    return this.handleError('DEPENDENCY_INSTALL_FAILED', error, context);
  }

  handleUpgradeError(error, context = {}) {
    return this.handleError('UPGRADE_FAILED', error, context);
  }

  handleIconLoadError(error, context = {}) {
    return this.handleError('ICON_LOAD_FAILED', error, context);
  }
}

module.exports = ErrorHandler;