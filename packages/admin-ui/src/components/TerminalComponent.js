/**
 * TerminalComponent - 基于xterm.js的终端组件
 * 
 * 提供现代化的终端体验，支持实时交互、主题切换、快捷键等功能
 */

// xterm.js相关模块 - 将在init方法中动态导入
let Terminal, FitAddon, WebLinksAddon, SearchAddon, Unicode11Addon;

/**
 * 终端组件类
 */
export class TerminalComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      theme: 'dark',
      fontSize: 14,
      fontFamily: '"SF Mono", "JetBrains Mono", "Cascadia Code", "Fira Code", Monaco, "Consolas", "Courier New", monospace',
      cursorBlink: true,
      scrollback: 1000,
      ...options
    };
    
    this.terminal = null;
    this.fitAddon = null;
    this.webLinksAddon = null;
    this.searchAddon = null;
    this.unicode11Addon = null;
    this.websocket = null;
    this.sessionId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    
    // 显示加载状态
    this.showLoadingState();
    
    // 异步初始化（不等待）
    this.init().catch(error => {
      console.error('TerminalComponent异步初始化失败:', error);
    });
  }

  /**
   * 显示加载状态
   */
  showLoadingState() {
    if (this.container) {
      this.container.innerHTML = `
        <div class="terminal-loading">
          <div class="loading-spinner"></div>
          <p>正在初始化终端...</p>
        </div>
      `;
    }
  }

  /**
   * 初始化终端
   */
  async init() {
    try {
      console.log('TerminalComponent开始初始化...');
      await this.loadModules();
      this.createTerminal();
      this.setupAddons();
      this.setupEventListeners();
      this.render();
      this.connectWebSocket();
      console.log('TerminalComponent初始化完成');
    } catch (error) {
      console.error('TerminalComponent初始化过程中出错:', error);
      this.showErrorAndFallback(error);
    }
  }

  /**
   * 动态加载xterm.js模块
   */
  async loadModules() {
    try {
      console.log('正在导入xterm.js模块...');
      
      // 导入核心模块
      const xtermModule = await import('xterm');
      Terminal = xtermModule.Terminal;
      console.log('xterm.js导入成功');
      
      // 导入插件模块
      console.log('正在导入xterm插件...');
      const fitModule = await import('xterm-addon-fit');
      FitAddon = fitModule.FitAddon;
      
      const webLinksModule = await import('xterm-addon-web-links');
      WebLinksAddon = webLinksModule.WebLinksAddon;
      
      const searchModule = await import('xterm-addon-search');
      SearchAddon = searchModule.SearchAddon;
      
      const unicodeModule = await import('xterm-addon-unicode11');
      Unicode11Addon = unicodeModule.Unicode11Addon;
      
      console.log('所有xterm插件导入成功');
    } catch (error) {
      console.error('导入xterm模块失败:', error);
      throw new Error(`无法导入xterm.js: ${error.message}`);
    }
  }

  /**
   * 显示错误并回退
   */
  showErrorAndFallback(error) {
    if (this.container) {
      this.container.innerHTML = `
        <div class="terminal-error">
          <h3>终端初始化失败</h3>
          <p>错误信息: ${error.message}</p>
          <p>可能的原因:</p>
          <ul>
            <li>xterm.js 库未正确加载</li>
            <li>网络连接问题</li>
            <li>浏览器兼容性问题</li>
          </ul>
          <button onclick="location.reload()">重新加载页面</button>
        </div>
      `;
    }
    throw error;
  }

  /**
   * 创建xterm实例
   */
  createTerminal() {
    if (!Terminal) {
      throw new Error('Terminal模块未加载');
    }
    
    this.terminal = new Terminal({
      theme: this.getTheme(this.options.theme),
      fontSize: this.options.fontSize,
      fontFamily: this.options.fontFamily,
      cursorBlink: this.options.cursorBlink,
      scrollback: this.options.scrollback,
      allowTransparency: false,
      allowProposedApi: true,
      cols: 80,
      rows: 24,
      letterSpacing: 0,
      lineHeight: 1.25,
      rendererType: 'dom', // 使用DOM渲染器以获得更好的选中效果
      convertEol: true,
      termName: 'xterm-256color'
    });
  }

  /**
   * 获取主题配置
   */
  getTheme(themeName) {
    const themes = {
      dark: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selection: 'rgba(74, 144, 226, 0.4)',
        black: '#000000',
        red: '#cc0000',
        green: '#4e9a06',
        yellow: '#c4a000',
        blue: '#3465a4',
        magenta: '#75507b',
        cyan: '#06989a',
        white: '#d3d7cf',
        brightBlack: '#555753',
        brightRed: '#ef2929',
        brightGreen: '#8ae234',
        brightYellow: '#fce94f',
        brightBlue: '#729fcf',
        brightMagenta: '#ad7fa8',
        brightCyan: '#34e2e2',
        brightWhite: '#eeeeec'
      },
      light: {
        background: '#ffffff',
        foreground: '#333333',
        cursor: '#333333',
        selection: 'rgba(0, 123, 255, 0.4)',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      }
    };
    
    return themes[themeName] || themes.dark;
  }

  /**
   * 设置xterm插件
   */
  setupAddons() {
    // 自适应插件
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    // 链接插件
    this.webLinksAddon = new WebLinksAddon();
    this.terminal.loadAddon(this.webLinksAddon);

    // 搜索插件
    this.searchAddon = new SearchAddon();
    this.terminal.loadAddon(this.searchAddon);

    // Unicode11支持
    this.unicode11Addon = new Unicode11Addon();
    this.terminal.loadAddon(this.unicode11Addon);
    this.terminal.unicode.activeVersion = '11';
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 终端数据事件
    this.terminal.onData((data) => {
      this.sendData(data);
    });

    // 终端按键事件
    this.terminal.onKey((event) => {
      this.handleKey(event);
    });

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.fit();
    });

    // 终端焦点事件 - 使用文本区域的事件监听
    this.terminal.textarea?.addEventListener('focus', () => {
      this.container.classList.add('terminal-focused');
    });

    this.terminal.textarea?.addEventListener('blur', () => {
      this.container.classList.remove('terminal-focused');
    });
  }

  /**
   * 处理按键事件
   */
  handleKey(event) {
    const { key, domEvent } = event;
    
    // Ctrl+C 中断
    if (domEvent.ctrlKey && domEvent.key === 'c') {
      this.sendData('\x03');
      return;
    }

    // Ctrl+V 粘贴
    if (domEvent.ctrlKey && domEvent.key === 'v') {
      navigator.clipboard.readText().then(text => {
        this.sendData(text);
      });
      return;
    }

    // Ctrl+Shift+C 复制
    if (domEvent.ctrlKey && domEvent.shiftKey && domEvent.key === 'C') {
      const selection = this.terminal.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
      }
      return;
    }

    // Ctrl+F 搜索
    if (domEvent.ctrlKey && domEvent.key === 'f') {
      this.showSearch();
      return;
    }
  }

  /**
   * 渲染终端到容器
   */
  render() {
    if (!this.container) return;
    
    this.container.innerHTML = '';
    this.terminal.open(this.container);
    
    // 设置初始主题class
    this.updateThemeClass();
    
    // 创建工具栏
    this.createToolbar();
    
    // 适应大小
    setTimeout(() => this.fit(), 100);
  }

  /**
   * 创建工具栏
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'terminal-toolbar';
    
    // 状态指示器
    const status = document.createElement('div');
    status.className = 'terminal-status';
    status.innerHTML = `
      <span class="status-indicator ${this.isConnected ? 'connected' : 'disconnected'}"></span>
      <span class="status-text">${this.isConnected ? '已连接' : '未连接'}</span>
    `;
    
    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'terminal-actions';
    actions.innerHTML = `
      <button class="btn btn-sm" title="重新连接" id="reconnectBtn">
        <i class="icon-refresh"></i>
      </button>
      <button class="btn btn-sm" title="清除" id="clearBtn">
        <i class="icon-clear"></i>
      </button>
      <button class="btn btn-sm" title="主题" id="themeBtn">
        <i class="icon-theme"></i>
      </button>
    `;
    
    toolbar.appendChild(status);
    toolbar.appendChild(actions);
    this.container.insertBefore(toolbar, this.container.firstChild);
    
    // 绑定事件
    this.bindToolbarEvents();
  }

  /**
   * 绑定工具栏事件
   */
  bindToolbarEvents() {
    const reconnectBtn = document.getElementById('reconnectBtn');
    const clearBtn = document.getElementById('clearBtn');
    const themeBtn = document.getElementById('themeBtn');
    
    reconnectBtn?.addEventListener('click', () => this.reconnect());
    clearBtn?.addEventListener('click', () => this.clear());
    themeBtn?.addEventListener('click', () => this.toggleTheme());
  }


  /**
   * 连接WebSocket
   */
  connectWebSocket() {
    const wsUrl = this.getWebSocketUrl();
    
    console.log('尝试连接WebSocket:', wsUrl);
    // this.write(`正在连接到服务器: ${wsUrl}`);
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket连接成功');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateStatus('connected');
        this.createTerminalSession();
        // this.write('\r\n✓ WebSocket连接已建立\r\n');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('收到WebSocket消息:', message);
          this.handleMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error, event.data);
        }
      };
      
      this.websocket.onclose = (event) => {
        console.log('WebSocket连接关闭:', event.code, event.reason);
        this.isConnected = false;
        this.updateStatus('disconnected');
        this.write(`\r\n✗ 连接已关闭 (${event.code}: ${event.reason})\r\n`);
        // this.write(`\r\n✗ WebSocket连接已关闭 (${event.code}: ${event.reason})\r\n`);
        this.attemptReconnect();
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.writeError(`WebSocket连接失败: ${error.message || '未知错误'}`);
      };
      
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      this.writeError(`无法建立WebSocket连接: ${error.message}`);
    }
  }

  /**
   * 获取WebSocket URL
   */
  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const currentPort = window.location.port;
    
    // WebSocket服务运行在5622端口
    let wsPort = 5622;
    
    const wsUrl = `${protocol}//${host}:${wsPort}`;
    console.log('WebSocket URL:', wsUrl);
    return wsUrl;
  }

  /**
   * 尝试重连
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.updateStatus('reconnecting');
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connectWebSocket();
      }, this.reconnectDelay);
    } else {
      this.writeError('无法重新连接，请刷新页面重试');
    }
  }

  /**
   * 创建终端会话
   */
  createTerminalSession() {
    // 如果有旧会话，先关闭它
    if (this.sessionId) {
      this.sendMessage({
        type: 'terminal.close',
        sessionId: this.sessionId
      });
      this.sessionId = null;
    }
    
    // 创建新会话
    this.sendMessage({
      type: 'terminal.create',
      size: {
        cols: this.terminal.cols,
        rows: this.terminal.rows
      }
    });
  }

  /**
   * 发送消息
   */
  sendMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /**
   * 发送数据
   */
  sendData(data) {
    if (this.isConnected) {
      this.sendMessage({
        type: 'terminal.data',
        data: data
      });
    }
  }

  /**
   * 处理消息
   */
  handleMessage(message) {
    console.log('处理消息类型:', message.type, message);
    
    switch (message.type) {
      case 'welcome':
        console.log('收到欢迎消息:', message);
        // this.write('\r\n✓ 已连接到服务器\r\n');
        break;
        
      case 'terminal.created':
        this.sessionId = message.sessionId;
        console.log('终端会话已创建:', this.sessionId);
        this.write(`\r\n✓ 终端会话已创建 (ID: ${this.sessionId})\r\n`);
        if (message.info) {
          this.write(`Shell: ${message.info.shell}\r\n`);
          this.write(`工作目录: ${message.info.workingDirectory}\r\n`);
        }
        this.write('\r\n');
        break;
        
      case 'terminal.data':
        if (message.data) {
          this.write(message.data);
        }
        break;
        
      case 'terminal.exit':
        this.write(`\r\n[会话结束，退出代码: ${message.exitCode}]\r\n`);
        if (message.signal) {
          this.write(`[信号: ${message.signal}]\r\n`);
        }
        break;
        
      case 'terminal.resized':
        console.log('终端大小已调整:', message.size);
        break;
        
      case 'terminal.closed':
        console.log('终端会话已关闭:', message.sessionId);
        this.write(`\r\n[终端会话已关闭]\r\n`);
        this.sessionId = null;
        break;
        
      case 'error':
        this.writeError(`服务器错误: ${message.message}`);
        if (message.details) {
          this.writeError(`详细信息: ${message.details}`);
        }
        break;
        
      case 'pong':
        // 心跳响应，不需要处理
        break;
        
      default:
        console.warn('未知消息类型:', message.type, message);
        this.write(`\r\n[未知消息类型: ${message.type}]\r\n`);
    }
  }

  /**
   * 写入数据到终端
   */
  write(data) {
    if (this.terminal) {
      this.terminal.write(data);
    }
  }

  /**
   * 写入错误信息
   */
  writeError(message) {
    this.write(`\r\n\x1b[31m[错误] ${message}\x1b[0m\r\n`);
  }

  /**
   * 清除终端
   */
  clear() {
    if (this.terminal) {
      this.terminal.clear();
    }
  }

  /**
   * 适应大小
   */
  fit() {
    if (this.fitAddon) {
      this.fitAddon.fit();
      
      // 通知服务器终端大小变化
      if (this.isConnected && this.sessionId) {
        this.sendMessage({
          type: 'terminal.resize',
          cols: this.terminal.cols,
          rows: this.terminal.rows
        });
      }
    }
  }

  /**
   * 更新状态
   */
  updateStatus(status) {
    const indicator = document.querySelector('.status-indicator');
    const text = document.querySelector('.status-text');
    
    if (indicator) {
      indicator.className = `status-indicator ${status}`;
    }
    
    if (text) {
      const statusText = {
        connected: '已连接',
        disconnected: '未连接',
        reconnecting: '重连中...'
      };
      text.textContent = statusText[status] || '未知状态';
    }
  }

  /**
   * 重新连接
   */
  reconnect() {
    // 清理旧会话
    this.sessionId = null;
    this.isConnected = false;
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.reconnectAttempts = 0;
    this.connectWebSocket();
  }

  /**
   * 切换主题
   */
  toggleTheme() {
    this.options.theme = this.options.theme === 'dark' ? 'light' : 'dark';
    this.terminal.options.theme = this.getTheme(this.options.theme);
    
    // 更新主题class
    this.updateThemeClass();
    
    // 强制重新渲染以应用新的选中样式
    this.refreshTerminal();
    
    // 保存主题偏好
    localStorage.setItem('terminal-theme', this.options.theme);
  }

  /**
   * 设置主题
   */
  setTheme(themeName) {
    this.options.theme = themeName;
    this.terminal.options.theme = this.getTheme(themeName);
    
    // 更新主题class
    this.updateThemeClass();
    
    // 强制重新渲染以应用新的选中样式
    this.refreshTerminal();
  }
  
  /**
   * 刷新终端以应用新主题
   */
  refreshTerminal() {
    // 保存当前内容
    const buffer = this.terminal.buffer.active;
    const cursorX = this.terminal.buffer.active.cursorX;
    const cursorY = this.terminal.buffer.active.cursorY;
    
    // 强制重新渲染
    this.terminal.refresh(0, this.terminal.rows - 1);
  }
  
  /**
   * 更新主题class
   */
  updateThemeClass() {
    // 移除所有主题class
    this.terminal.element.classList.remove('theme-dark', 'theme-light');
    // 添加当前主题class
    this.terminal.element.classList.add(`theme-${this.options.theme}`);
  }

  /**
   * 获取会话信息
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      terminalSize: {
        cols: this.terminal.cols,
        rows: this.terminal.rows
      }
    };
  }

  /**
   * 销毁组件
   */
  destroy() {
    if (this.websocket) {
      this.websocket.close();
    }
    
    if (this.terminal) {
      this.terminal.dispose();
    }
    
    window.removeEventListener('resize', this.fit);
  }
}

// 导出默认创建函数
export function createTerminal(container, options) {
  return new TerminalComponent(container, options);
}