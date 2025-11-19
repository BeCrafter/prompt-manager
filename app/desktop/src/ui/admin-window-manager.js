const { BrowserWindow, nativeImage } = require('electron');
const path = require('path');

/**
 * 管理后台窗口管理器
 * 负责创建和管理管理后台窗口，提供加载效果
 */
class AdminWindowManager {
  constructor(logger, iconManager) {
    this.logger = logger;
    this.iconManager = iconManager;
    this.adminWindow = null;
  }

  /**
   * 打开管理后台窗口
   * @param {string} adminUrl - 管理后台URL
   */
  openAdminWindow(adminUrl) {
    if (this.adminWindow && !this.adminWindow.isDestroyed()) {
      this.adminWindow.focus();
      return;
    }

    try {
      this.logger.info('Opening admin window', { url: adminUrl });
      
      // 创建窗口
      this.adminWindow = this.createAdminWindow();
      
      // 先显示加载页面（随机选择一种动画效果）
      const animationTypes = ['spinner', 'dots', 'wave', 'pulse', 'bars', 'gradient', 'orbit', 'ripple'];
      const randomAnimation = animationTypes[Math.floor(Math.random() * animationTypes.length)];
      this.showLoadingPage(randomAnimation);
      
      // 设置窗口事件
      this.setupWindowEvents(adminUrl);
      
      this.logger.info('Admin window created successfully');
    } catch (error) {
      this.logger.error('Failed to open admin window', error);
    }
  }

  /**
   * 创建管理后台窗口
   */
  createAdminWindow() {
    const window = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Prompt Server 管理后台',
      show: false, // 先不显示，等加载完成后再显示
      backgroundColor: '#ffffff',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    // 设置窗口图标（如果可用）
    try {
      const icon = this.iconManager.getAppIcon();
      if (icon && !icon.isEmpty()) {
        window.setIcon(icon);
      }
    } catch (error) {
      this.logger.warn('Failed to set window icon', error);
    }

    return window;
  }

  /**
   * 显示加载页面
   * @param {string} animationType - 动画类型
   */
  showLoadingPage(animationType = 'spinner') {
    if (!this.adminWindow || this.adminWindow.isDestroyed()) {
      return;
    }

    const htmlContent = this.generateLoadingHTML(animationType);
    this.adminWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // 加载页面后显示窗口
    this.adminWindow.once('ready-to-show', () => {
      if (this.adminWindow && !this.adminWindow.isDestroyed()) {
        this.adminWindow.show();
        this.logger.info('Admin window loading page shown', { animationType });
      }
    });
  }

  /**
   * 生成加载页面HTML
   * @param {string} animationType - 动画类型: 'spinner' | 'dots' | 'wave' | 'pulse' | 'skeleton' | 'bars' | 'gradient' | 'orbit' | 'ripple'
   */
  generateLoadingHTML(animationType = 'spinner') {
    const baseStyles = this.getBaseStyles();
    const animationStyles = this.getAnimationStyles(animationType);
    const animationHTML = this.getAnimationHTML(animationType);
    
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>正在加载管理后台...</title>
  <style>
    ${baseStyles}
    ${animationStyles}
  </style>
</head>
<body>
  <div class="loading-container">
    <div class="loading-text">正在加载管理后台...</div>
    ${animationHTML}
  </div>
  
  <script>
    // 模拟进度更新（如果动画类型支持）
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
      let progress = 0;
      const progressFill = document.querySelector('.progress-fill');
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress > 90) {
          progress = 90;
        }
        if (progressFill) {
          progressFill.style.width = progress + '%';
        }
      }, 200);
      window.addEventListener('beforeunload', () => {
        clearInterval(interval);
      });
    }
  </script>
</body>
</html>`;
  }

  /**
   * 获取基础样式
   */
  getBaseStyles() {
    return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      color: rgb(134, 134, 134);
    }
    
    .loading-container {
      text-align: center;
      padding: 60px 40px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      border: 1px solid rgb(200, 200, 200);
      max-width: 500px;
      width: 90%;
    }
    
    .loading-text {
      font-size: 14px;
      margin-bottom: 48px;
      color: rgb(134, 134, 134);
      font-weight: 400;
      letter-spacing: 0.5px;
    }
    
    .animation-wrapper {
      margin: 40px 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }`;
  }

  /**
   * 获取动画样式
   */
  getAnimationStyles(animationType) {
    const styles = {
      spinner: `
    .spinner {
      width: 80px;
      height: 80px;
      margin: 0 auto;
      position: relative;
    }
    
    .spinner-ring {
      width: 100%;
      height: 100%;
      border: 5px solid rgba(200, 200, 200, 0.2);
      border-top-color: rgb(134, 134, 134);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }`,

      dots: `
    .dots {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin: 40px 0;
    }
    
    .dot {
      width: 16px;
      height: 16px;
      background: rgb(134, 134, 134);
      border-radius: 50%;
      animation: dotPulse 1.4s infinite ease-in-out;
    }
    
    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes dotPulse {
      0%, 80%, 100% {
        transform: scale(0.8);
        opacity: 0.5;
      }
      40% {
        transform: scale(1.2);
        opacity: 1;
      }
    }`,

      wave: `
    .wave {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      margin: 40px 0;
      height: 80px;
    }
    
    .wave-bar {
      width: 6px;
      height: 60px;
      background: rgb(134, 134, 134);
      border-radius: 3px;
      animation: wave 1.2s infinite ease-in-out;
    }
    
    .wave-bar:nth-child(1) { animation-delay: -0.4s; }
    .wave-bar:nth-child(2) { animation-delay: -0.3s; }
    .wave-bar:nth-child(3) { animation-delay: -0.2s; }
    .wave-bar:nth-child(4) { animation-delay: -0.1s; }
    .wave-bar:nth-child(5) { animation-delay: 0s; }
    
    @keyframes wave {
      0%, 40%, 100% {
        transform: scaleY(0.4);
        opacity: 0.5;
      }
      20% {
        transform: scaleY(1);
        opacity: 1;
      }
    }`,

      pulse: `
    .pulse {
      width: 100px;
      height: 100px;
      margin: 0 auto;
      position: relative;
    }
    
    .pulse-circle {
      width: 100%;
      height: 100%;
      border: 4px solid rgb(134, 134, 134);
      border-radius: 50%;
      position: absolute;
      animation: pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    .pulse-circle:nth-child(2) {
      animation-delay: 0.5s;
    }
    
    .pulse-circle:nth-child(3) {
      animation-delay: 1s;
    }
    
    @keyframes pulseRing {
      0% {
        transform: scale(0.8);
        opacity: 1;
      }
      100% {
        transform: scale(1.8);
        opacity: 0;
      }
    }`,

      bars: `
    .bars {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      gap: 5px;
      margin: 40px 0;
      height: 80px;
    }
    
    .bar {
      width: 8px;
      background: rgb(134, 134, 134);
      border-radius: 4px;
      animation: barBounce 1.4s infinite ease-in-out;
    }
    
    .bar:nth-child(1) { height: 30px; animation-delay: -0.32s; }
    .bar:nth-child(2) { height: 55px; animation-delay: -0.16s; }
    .bar:nth-child(3) { height: 80px; animation-delay: 0s; }
    .bar:nth-child(4) { height: 55px; animation-delay: 0.16s; }
    .bar:nth-child(5) { height: 30px; animation-delay: 0.32s; }
    
    @keyframes barBounce {
      0%, 80%, 100% {
        transform: scaleY(0.5);
        opacity: 0.7;
      }
      40% {
        transform: scaleY(1);
        opacity: 1;
      }
    }`,

      gradient: `
    .gradient-loader {
      width: 100px;
      height: 100px;
      margin: 0 auto;
      border-radius: 50%;
      background: linear-gradient(45deg, 
        rgb(134, 134, 134) 0%, 
        rgba(134, 134, 134, 0.3) 50%, 
        rgb(134, 134, 134) 100%);
      background-size: 200% 200%;
      animation: gradientMove 2s ease infinite;
    }
    
    @keyframes gradientMove {
      0% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0% 50%;
      }
    }`,

      orbit: `
    .orbit {
      width: 100px;
      height: 100px;
      margin: 0 auto;
      position: relative;
    }
    
    .orbit-dot {
      width: 16px;
      height: 16px;
      background: rgb(134, 134, 134);
      border-radius: 50%;
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      animation: orbitRotate 1.5s linear infinite;
    }
    
    .orbit-dot:nth-child(2) {
      animation-delay: 0.5s;
    }
    
    .orbit-dot:nth-child(3) {
      animation-delay: 1s;
    }
    
    @keyframes orbitRotate {
      0% {
        transform: translateX(-50%) rotate(0deg) translateY(0);
      }
      100% {
        transform: translateX(-50%) rotate(360deg) translateY(0);
      }
    }`,

      ripple: `
    .ripple {
      width: 100px;
      height: 100px;
      margin: 0 auto;
      position: relative;
    }
    
    .ripple-circle {
      width: 100%;
      height: 100%;
      border: 3px solid rgb(134, 134, 134);
      border-radius: 50%;
      position: absolute;
      animation: rippleExpand 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    
    .ripple-circle:nth-child(2) {
      animation-delay: 0.5s;
    }
    
    .ripple-circle:nth-child(3) {
      animation-delay: 1s;
    }
    
    @keyframes rippleExpand {
      0% {
        transform: scale(0.8);
        opacity: 1;
      }
      100% {
        transform: scale(1.8);
        opacity: 0;
      }
    }`
    };

    // 添加进度条样式（所有动画共用）
    const progressBarStyle = `
    .progress-bar {
      width: 100%;
      height: 3px;
      background: rgba(200, 200, 200, 0.3);
      border-radius: 2px;
      margin-top: 48px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: rgb(134, 134, 134);
      border-radius: 2px;
      animation: progress 2s ease-in-out infinite;
      width: 60%;
    }
    
    @keyframes progress {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(0%); }
      100% { transform: translateX(100%); }
    }`;

    return (styles[animationType] || styles.spinner) + progressBarStyle;
  }

  /**
   * 获取动画HTML
   */
  getAnimationHTML(animationType) {
    const htmls = {
      spinner: `
    <div class="animation-wrapper">
      <div class="spinner">
        <div class="spinner-ring"></div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`,

      dots: `
    <div class="dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`,

      wave: `
    <div class="wave">
      <div class="wave-bar"></div>
      <div class="wave-bar"></div>
      <div class="wave-bar"></div>
      <div class="wave-bar"></div>
      <div class="wave-bar"></div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`,

      pulse: `
    <div class="animation-wrapper">
      <div class="pulse">
        <div class="pulse-circle"></div>
        <div class="pulse-circle"></div>
        <div class="pulse-circle"></div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`,

      bars: `
    <div class="bars">
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`,

      gradient: `
    <div class="animation-wrapper">
      <div class="gradient-loader"></div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`,

      orbit: `
    <div class="animation-wrapper">
      <div class="orbit">
        <div class="orbit-dot"></div>
        <div class="orbit-dot"></div>
        <div class="orbit-dot"></div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`,

      ripple: `
    <div class="animation-wrapper">
      <div class="ripple">
        <div class="ripple-circle"></div>
        <div class="ripple-circle"></div>
        <div class="ripple-circle"></div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>`
    };

    return htmls[animationType] || htmls.spinner;
  }

  /**
   * 设置窗口事件
   * @param {string} adminUrl - 管理后台URL
   */
  setupWindowEvents(adminUrl) {
    if (!this.adminWindow) return;

    // 监听页面开始加载
    this.adminWindow.webContents.on('did-start-loading', () => {
      this.logger.debug('Admin page started loading');
    });

    // 监听页面加载完成
    this.adminWindow.webContents.on('did-finish-load', () => {
      this.logger.info('Admin page finished loading');
      // 页面加载完成后，窗口会自动显示实际内容
    });

    // 监听页面加载失败
    this.adminWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      this.logger.error('Admin page failed to load', {
        errorCode,
        errorDescription,
        url: validatedURL
      });
      
      // 显示错误页面
      this.showErrorPage(errorDescription, validatedURL);
    });

    // 监听窗口关闭
    this.adminWindow.on('closed', () => {
      this.adminWindow = null;
      this.logger.info('Admin window closed');
    });

    // 延迟加载实际URL，给加载页面一些显示时间
    setTimeout(() => {
      if (this.adminWindow && !this.adminWindow.isDestroyed()) {
        this.logger.info('Loading admin URL', { url: adminUrl });
        this.adminWindow.loadURL(adminUrl);
      }
    }, 500); // 500ms延迟，让用户看到加载动画
  }

  /**
   * 显示错误页面
   * @param {string} errorDescription - 错误描述
   * @param {string} url - 失败的URL
   */
  showErrorPage(errorDescription, url) {
    if (!this.adminWindow || this.adminWindow.isDestroyed()) {
      return;
    }

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>加载失败</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #333;
    }
    
    .error-container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 90%;
    }
    
    .error-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    
    .error-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #e74c3c;
    }
    
    .error-message {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
      line-height: 1.6;
    }
    
    .error-url {
      font-size: 12px;
      color: #999;
      word-break: break-all;
      margin-top: 16px;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 6px;
    }
    
    .retry-button {
      margin-top: 24px;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .retry-button:hover {
      background: #5568d3;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">⚠️</div>
    <div class="error-title">无法加载管理后台</div>
    <div class="error-message">${errorDescription || '页面加载失败'}</div>
    <div class="error-url">${url || ''}</div>
    <button class="retry-button" onclick="window.location.reload()">重试</button>
  </div>
</body>
</html>`;

    this.adminWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  }

  /**
   * 关闭管理后台窗口
   */
  closeAdminWindow() {
    if (this.adminWindow && !this.adminWindow.isDestroyed()) {
      this.adminWindow.close();
      this.adminWindow = null;
      this.logger.info('Admin window closed');
    }
  }

  /**
   * 检查窗口是否存在
   */
  hasWindow() {
    return this.adminWindow && !this.adminWindow.isDestroyed();
  }

  /**
   * 获取窗口实例
   */
  getWindow() {
    return this.adminWindow;
  }
}

module.exports = AdminWindowManager;

