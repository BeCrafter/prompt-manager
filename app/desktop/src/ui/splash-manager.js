const { BrowserWindow, nativeImage } = require('electron');
const path = require('path');

class SplashManager {
  constructor(logger, iconManager) {
    this.logger = logger;
    this.iconManager = iconManager;
    this.splashWindow = null;
  }

  /**
   * 创建并显示启动画面
   */
  async showSplash() {
    this.logger.info('Showing splash screen');
    
    // 如果启动画面已存在，直接返回
    if (this.splashWindow) {
      return;
    }

    try {
      // 创建启动窗口
      this.splashWindow = this.createSplashWindow();
      
      // 加载启动画面内容
      const htmlContent = this.generateSplashHTML();
      this.splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      
      // 设置窗口事件
      this.setupWindowEvents();
      
      this.logger.info('Splash screen shown successfully');
      
    } catch (error) {
      this.logger.error('Failed to show splash screen', error);
      // 如果启动画面失败，不阻塞主流程
    }
  }

  /**
   * 创建启动窗口
   */
  createSplashWindow() {
    return new BrowserWindow({
      width: 400,
      height: 100,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      fullscreenable: false,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
  }

  /**
   * 生成启动画面HTML内容
   */
  generateSplashHTML() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Prompt Manager - Loading</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    
    .container {
      width: 360px;
      padding: 20px;
      background: white;
      border: 2px solid #1a1a1a;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      text-align: center;
    }
    
    .title {
      font-size: 20px;
      font-weight: 580;
      color: #666;
      margin: 0 0 16px 0;
      letter-spacing: -0.02em;
      font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
      position: relative;
    }
    
    .title::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 1px;
      background: linear-gradient(to right, transparent, #ccc, transparent);
    }
    
    .loading-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    
    .loading-text {
      font-size: 14px;
      color: #999;
    }
    
    .dots {
      display: flex;
      gap: 4px;
    }
    
    .dot {
      width: 6px;
      height: 6px;
      background: #aaa;
      border-radius: 50%;
      animation: pulse 1.5s infinite ease-in-out;
    }
    
    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes pulse {
      0%, 80%, 100% {
        transform: scale(0);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">Prompt Manager</div>
    <div class="loading-container">
      <div class="loading-text">正在启动</div>
      <div class="dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>
  </div>
  
  <script>
    // 简单的动画效果增强
    let dotIndex = 0;
    const dots = document.querySelectorAll('.dot');
    
    setInterval(() => {
      // 重置所有点
      dots.forEach(dot => {
        dot.style.animation = 'none';
        setTimeout(() => {
          dot.style.animation = 'pulse 1.5s infinite ease-in-out';
        }, 10);
      });
      
      // 依次激活点
      dotIndex = (dotIndex + 1) % dots.length;
    }, 1500);
  </script>
</body>
</html>`;
  }

  /**
   * 更新启动状态
   * @param {string} message - 状态消息
   * @param {number} progress - 进度百分比 (0-100)
   */
  updateStatus(message, progress) {
    if (!this.splashWindow || this.splashWindow.isDestroyed()) {
      return;
    }

    try {
      this.splashWindow.webContents.executeJavaScript(`
        (function() {
          const statusElement = document.getElementById('status');
          const progressElement = document.getElementById('progress');
          if (statusElement) statusElement.textContent = "${message}";
          if (progressElement && ${progress} >= 0) {
            progressElement.style.width = "${progress}%";
          }
        })();
      `);
    } catch (error) {
      this.logger.warn('Failed to update splash status', error);
    }
  }

  /**
   * 设置窗口事件
   */
  setupWindowEvents() {
    if (!this.splashWindow) return;
    
    this.splashWindow.once('ready-to-show', () => {
      if (this.splashWindow) {
        this.splashWindow.show();
      }
    });
    
    this.splashWindow.on('closed', () => {
      this.splashWindow = null;
      this.logger.info('Splash screen closed');
    });
  }

  /**
   * 关闭启动画面
   */
  async closeSplash() {
    this.logger.info('Closing splash screen');
    
    if (this.splashWindow) {
      try {
        this.splashWindow.close();
        this.splashWindow = null;
      } catch (error) {
        this.logger.warn('Failed to close splash window', error);
      }
    }
  }
}

module.exports = SplashManager;