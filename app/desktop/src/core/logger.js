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
    
    // 始终输出到控制台
    if (level === 'error') {
      process.stderr.write(formattedMessage);
    } else {
      process.stdout.write(formattedMessage);
    }

    // 写入日志文件
    if (this.logStream) {
      const shouldWrite = level === 'error' || 
                         (this.debugEnabled && ['debug', 'warn'].includes(level)) ||
                         (!this.debugEnabled && ['info'].includes(level));
      
      if (shouldWrite) {
        this.logStream.write(formattedMessage);
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