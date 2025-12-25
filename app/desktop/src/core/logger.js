const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor(options = {}) {
    this.logFilePath = options.logFilePath || path.join(app.getPath('userData'), 'prompt-manager-desktop.log');
    this.debugEnabled = options.debugEnabled || false;
    this.logStream = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
      this.initialized = true;
      
      this.info('Logging initialized', { logFile: this.logFilePath });
      this.info(`Debug logging is ${this.debugEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to initialize logging:', error);
      throw error;
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
  }

  write(level, message, meta = {}) {
    if (!this.initialized && level !== 'error') return;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    try {
      // 始终输出到控制台，但先检查流是否可写
      if (level === 'error') {
        if (process.stderr && process.stderr.writable) {
          process.stderr.write(formattedMessage);
        } else {
          // 如果 stderr 不可用，使用 console.error 作为后备
          console.error(formattedMessage.trim());
        }
      } else {
        if (process.stdout && process.stdout.writable) {
          process.stdout.write(formattedMessage);
        } else {
          // 如果 stdout 不可用，使用 console.log 作为后备
          console.log(formattedMessage.trim());
        }
      }

      // 写入日志文件，检查流是否可写
      if (this.logStream && this.logStream.writable) {
        const shouldWrite = level === 'error' || 
                           (this.debugEnabled && ['debug', 'warn'].includes(level)) ||
                           (!this.debugEnabled && ['info'].includes(level));
        
        if (shouldWrite) {
          this.logStream.write(formattedMessage);
        }
      }
    } catch (error) {
      // 静默处理写入错误，避免应用崩溃
      // 只在调试模式下记录错误
      if (this.debugEnabled) {
        try {
          console.error(`Logger write error: ${error.message}`);
        } catch (e) {
          // 如果连 console.error 都失败，就放弃
        }
      }
    }
  }

  info(message, meta = {}) {
    this.write('info', message, meta);
  }

  error(message, error = null, meta = {}) {
    const errorMeta = { ...meta };
    if (error) {
      errorMeta.error = error.message || String(error);
      errorMeta.stack = error.stack;
    }
    this.write('error', message, errorMeta);
  }

  warn(message, meta = {}) {
    this.write('warn', message, meta);
  }

  debug(message, meta = {}) {
    if (this.debugEnabled) {
      this.write('debug', message, meta);
    }
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = enabled;
    this.info(`Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  getLogFilePath() {
    return this.logFilePath;
  }

  async close() {
    if (this.logStream) {
      return new Promise((resolve) => {
        this.logStream.end(() => {
          this.logStream = null;
          this.initialized = false;
          resolve();
        });
      });
    }
  }
}

module.exports = Logger;