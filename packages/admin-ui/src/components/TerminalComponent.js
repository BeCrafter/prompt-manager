/**
 * TerminalComponent - 基于xterm.js的终端组件（优化版）
 * 
 * 提供现代化的终端体验，支持实时交互、主题切换、快捷键等功能
 * 
 * 优化点：
 * - 使用 Canvas 渲染器提升性能
 * - 改进 WebSocket 重连机制
 * - 添加命令历史记录
 * - 优化字体渲染
 * - 改进主题切换
 */

// xterm.js相关模块 - 将在init方法中动态导入
let Terminal, FitAddon, WebLinksAddon, SearchAddon, Unicode11Addon, CanvasAddon;

// 配置加载器 - 用于获取动态WebSocket端口
import { configLoader } from '../utils/config-loader.js';

/**
 * 终端组件类（优化版）
 */
export class TerminalComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      theme: 'dark',
      fontSize: 14,
      fontFamily: '"SF Mono", "JetBrains Mono", "Cascadia Code", "Fira Code", Monaco, "Menlo", "Consolas", "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
      rendererType: 'canvas', // 使用 Canvas 渲染器提升性能
      allowTransparency: false,
      convertEol: true,
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
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    
    // 命令历史记录
    this.commandHistory = [];
    this.historyIndex = -1;
    this.currentInput = '';
    
    // 心跳定时器
    this.heartbeatInterval = null;

    // 渲染器检测
    this.rendererType = 'unknown';
    this.isCanvasRenderer = false;

    // IME输入状态
    this.isComposing = false;

    // 初始化状态
    this.isInitialized = false;
    this.initPromise = null;
    
    // 显示加载状态
    this.showLoadingState();
    
    // 异步初始化
    this.initPromise = this.init().catch(error => {
      console.error('TerminalComponent异步初始化失败:', error);
      throw error;
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
      await this.connectWebSocket();
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

      // 导入 Canvas 渲染器插件
      console.log('正在导入 Canvas 渲染器插件...');
      const canvasModule = await import('xterm-addon-canvas');
      CanvasAddon = canvasModule.CanvasAddon;
      console.log('Canvas 渲染器插件导入成功');

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
   * 创建xterm实例（优化版）
   */
  createTerminal() {
    if (!Terminal) {
      throw new Error('Terminal模块未加载');
    }
    
    this.terminal = new Terminal({
      // 主题配置
      theme: this.getTheme(this.options.theme),
      
      // 字体配置（优化）
      fontSize: this.options.fontSize,
      fontFamily: this.options.fontFamily,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      lineHeight: 1.2,
      letterSpacing: 0,
      
      // 光标配置
      cursorBlink: this.options.cursorBlink,
      cursorStyle: this.options.cursorStyle,
      cursorWidth: 2,
      
      // 滚动配置
      scrollback: this.options.scrollback,
      scrollSensitivity: 1,
      
      // 渲染配置（优化）
      // 注意：不设置 rendererType，通过 CanvasAddon 插件来强制使用 Canvas 渲染
      allowTransparency: this.options.allowTransparency,
      allowProposedApi: true,
      
      // 终端配置
      cols: 80,
      rows: 24,
      tabStopWidth: this.options.tabStopWidth,
      convertEol: this.options.convertEol,
      termName: 'xterm-256color',
      
      // 性能优化
      rightClickSelectsWord: true,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      
      // 字符集
      unicodeVersion: '11'
    });
  }

  /**
   * 获取主题配置（优化版 - 改进对比度和视觉效果）
   */
  getTheme(themeName) {
    const themes = {
      dark: {
        // 基础颜色
        background: '#0a0a0a',
        foreground: '#f0f0f0',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        
        // 选中效果（优化 - 更明显的对比度）
        selection: 'rgba(100, 181, 246, 0.45)',
        selectionForeground: '#ffffff',
        
        // ANSI 颜色（优化对比度）
        black: '#000000',
        red: '#ff5f56',
        green: '#00c853',
        yellow: '#ffbd2e',
        blue: '#00a2ff',
        magenta: '#ff79c6',
        cyan: '#00e5ff',
        white: '#e0e0e0',
        
        // 亮色 ANSI 颜色
        brightBlack: '#666666',
        brightRed: '#ff5f56',
        brightGreen: '#00e676',
        brightYellow: '#ffbd2e',
        brightBlue: '#00a2ff',
        brightMagenta: '#ff79c6',
        brightCyan: '#00e5ff',
        brightWhite: '#ffffff'
      },
      light: {
        // 基础颜色
        background: '#ffffff',
        foreground: '#1a1a1a',
        cursor: '#1a1a1a',
        cursorAccent: '#ffffff',
        
        // 选中效果（优化 - 更明显的对比度）
        selection: 'rgba(24, 144, 255, 0.3)',
        selectionForeground: '#000000',
        
        // ANSI 颜色（优化对比度）
        black: '#1a1a1a',
        red: '#e53935',
        green: '#43a047',
        yellow: '#fdd835',
        blue: '#1e88e5',
        magenta: '#8e24aa',
        cyan: '#00acc1',
        white: '#f5f5f5',
        
        // 亮色 ANSI 颜色
        brightBlack: '#757575',
        brightRed: '#e53935',
        brightGreen: '#43a047',
        brightYellow: '#fdd835',
        brightBlue: '#1e88e5',
        brightMagenta: '#8e24aa',
        brightCyan: '#00acc1',
        brightWhite: '#ffffff'
      }
    };
    
    return themes[themeName] || themes.dark;
  }

  /**
   * 设置xterm插件
   */
  setupAddons() {
    // Canvas 渲染器插件 - 必须在其他插件之前加载
    try {
      if (CanvasAddon) {
        this.canvasAddon = new CanvasAddon();
        this.terminal.loadAddon(this.canvasAddon);
        this.isCanvasRenderer = true;
        this.rendererType = 'canvas';
        console.log('✓ Canvas 渲染器已启用');
      } else {
        console.warn('CanvasAddon 未加载，将使用默认渲染器');
        this.rendererType = 'dom';
      }
    } catch (error) {
      console.error('加载 Canvas 渲染器失败:', error);
      console.warn('将使用默认 DOM 渲染器');
      this.rendererType = 'dom';
    }

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
      // 在 IME composition 期间阻止数据发送，防止中文输入重复显示
      // 修复：macOS + Electron + 搜狗输入法等 IME 环境下的字符重复问题
      if (this.isComposing) {
        console.log('IME composing - ignoring data:', data);
        return;
      }
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

    // 中文IME输入支持 - 直接监听textarea的composition事件
    if (this.terminal.textarea) {
      this.terminal.textarea.addEventListener('compositionstart', (e) => {
        this.isComposing = true;
        this.container.classList.add('composing');
        console.log('Composition started', e);
      });

      this.terminal.textarea.addEventListener('compositionupdate', (e) => {
        console.log('Composition update', e);
      });

      this.terminal.textarea.addEventListener('compositionend', (e) => {
        this.isComposing = false;
        this.container.classList.remove('composing');
        console.log('Composition ended', e);
      });
    }
  }

  /**
   * 处理按键事件（优化版 - 添加命令历史和快捷键）
   */
  handleKey(event) {
    const { key, domEvent } = event;

    // 中文IME输入期间，阻止某些快捷键
    if (this.isComposing) {
      console.log('IME composing - ignoring key:', key);
      return;
    }

    // Ctrl+C 中断
    if (domEvent.ctrlKey && domEvent.key === 'c') {
      this.sendData('\x03');
      return;
    }

    // Ctrl+V 粘贴
    if (domEvent.ctrlKey && domEvent.key === 'v') {
      navigator.clipboard.readText().then(text => {
        this.sendData(text);
      }).catch(err => {
        console.error('粘贴失败:', err);
      });
      return;
    }

    // Ctrl+Shift+C 复制
    if (domEvent.ctrlKey && domEvent.shiftKey && domEvent.key === 'C') {
      const selection = this.terminal.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).then(() => {
          this.write('\r\n\x1b[32m✓ 已复制到剪贴板\x1b[0m\r\n');
        }).catch(err => {
          console.error('复制失败:', err);
        });
      }
      return;
    }

    // Ctrl+L 清屏
    if (domEvent.ctrlKey && domEvent.key === 'l') {
      this.terminal.clear();
      return;
    }

    // Ctrl+F 搜索
    if (domEvent.ctrlKey && domEvent.key === 'f') {
      this.showSearch();
      return;
    }

    // Ctrl+Shift+V 粘贴（另一种方式）
    if (domEvent.ctrlKey && domEvent.shiftKey && domEvent.key === 'V') {
      navigator.clipboard.readText().then(text => {
        this.sendData(text);
      }).catch(err => {
        console.error('粘贴失败:', err);
      });
      return;
    }

    // Ctrl+K 清除到行尾
    if (domEvent.ctrlKey && domEvent.key === 'k') {
      this.sendData('\x1b[K');
      return;
    }

    // Ctrl+U 清除到行首
    if (domEvent.ctrlKey && domEvent.key === 'u') {
      this.sendData('\x1b[1K');
      return;
    }

    // Ctrl+W 删除前一个单词
    if (domEvent.ctrlKey && domEvent.key === 'w') {
      this.sendData('\x17');
      return;
    }

    // Ctrl+A 移动到行首
    if (domEvent.ctrlKey && domEvent.key === 'a') {
      this.sendData('\x01');
      return;
    }

    // Ctrl+E 移动到行尾
    if (domEvent.ctrlKey && domEvent.key === 'e') {
      this.sendData('\x05');
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

    // 检测实际使用的渲染器
    setTimeout(() => this.detectRenderer(), 200);
  }

  /**
   * 检测实际使用的渲染器类型
   */
  detectRenderer() {
    try {
      const screen = this.terminal.element.querySelector('.xterm-screen');
      if (!screen) {
        console.warn('无法检测渲染器：找不到 xterm-screen 元素');
        return;
      }

      // 检查是否有 canvas 元素
      const canvas = screen.querySelector('canvas');
      if (canvas) {
        this.rendererType = 'canvas';
        this.isCanvasRenderer = true;
        console.log('✓ 检测到 Canvas 渲染器');
      } else {
        // 检查是否有 DOM 元素（rows 和 chars）
        const rows = screen.querySelector('.xterm-rows');
        if (rows) {
          this.rendererType = 'dom';
          this.isCanvasRenderer = false;
          console.log('⚠ 检测到 DOM 渲染器（降级模式）');
        }
      }

      // 在控制台显示渲染器信息
      console.log('渲染器信息:', {
        type: this.rendererType,
        isCanvas: this.isCanvasRenderer,
        canvas: !!canvas,
        rows: !!screen.querySelector('.xterm-rows')
      });
    } catch (error) {
      console.error('检测渲染器失败:', error);
    }
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
      <span class="renderer-info" title="渲染器类型">${this.isCanvasRenderer ? '🎨 Canvas' : '📄 DOM'}</span>
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
    
    reconnectBtn?.addEventListener('click', async () => await this.reconnect());
    clearBtn?.addEventListener('click', () => this.clear());
    themeBtn?.addEventListener('click', () => this.toggleTheme());
  }


  /**
   * 连接WebSocket（优化版 - 改进重连机制和心跳保活）
   */
  async connectWebSocket() {
    const wsUrl = await this.getWebSocketUrl();

    console.log('尝试连接WebSocket:', wsUrl);
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket连接成功');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000; // 重置重连延迟
        this.updateStatus('connected');
        
        // 启动心跳保活
        this.startHeartbeat();
        
        // 创建终端会话
        this.createTerminalSession();
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error, event.data);
        }
      };
      
      this.websocket.onclose = (event) => {
        console.log('WebSocket连接关闭:', event.code, event.reason);
        this.isConnected = false;
        this.updateStatus('disconnected');
        
        // 停止心跳
        this.stopHeartbeat();
        
        // 显示断开消息（仅在非正常关闭时）
        if (event.code !== 1000) {
          this.write(`\r\n\x1b[31m✗ 连接已断开 (${event.code}: ${event.reason || 'Unknown'})\x1b[0m\r\n`);
          // 尝试重连
          this.attemptReconnect();
        }
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.writeError(`连接错误: ${error.message || '未知错误'}`);
      };
      
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      this.writeError(`无法建立连接: ${error.message}`);
      this.attemptReconnect();
    }
  }

/**
   * 启动心跳保活
   */
  startHeartbeat() {
    this.stopHeartbeat(); // 先停止现有的心跳
    
    // 每30秒发送一次 ping
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, 30000);
  }

/**
   * 停止心跳保活
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 获取WebSocket URL
   */
  async getWebSocketUrl() {
    console.log('🔍 TerminalComponent.getWebSocketUrl() 被调用 - 开始获取WebSocket URL');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;

    console.log('🔍 尝试从配置加载器获取动态WebSocket端口...');
    try {
      // 从配置加载器获取动态WebSocket端口
      const wsUrl = await configLoader.getWebSocketUrl();
      console.log('✅ 使用动态配置的WebSocket URL:', wsUrl);
      console.log('✅ 成功调用了 /adminapi/config/public 接口获取端口配置');
      return wsUrl;
    } catch (error) {
      console.warn('❌ 获取动态WebSocket配置失败，使用默认配置:', error.message);
      console.warn('❌ 这意味着 /adminapi/config/public 接口调用失败');

      // 降级到默认端口
      const defaultWsUrl = `${protocol}//${host}:5622`;
      console.log('使用默认WebSocket URL:', defaultWsUrl);
      return defaultWsUrl;
    }
  }

  /**
   * 尝试重连（优化版 - 使用指数退避算法）
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.updateStatus('reconnecting');
      
      // 指数退避算法：延迟 = 基础延迟 * (2 ^ (重试次数 - 1))
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，延迟 ${delay}ms`);
      
      this.write(`\r\n\x1b[33m⏳ ${delay/1000}秒后尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...\x1b[0m\r\n`);
      
      setTimeout(async () => {
        await this.connectWebSocket();
      }, delay);
    } else {
      this.writeError(`\r\n\x1b[31m✗ 已达到最大重连次数 (${this.maxReconnectAttempts})，请刷新页面重试\x1b[0m\r\n`);
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
   * 更新终端连接状态显示
   * 
   * @param {string} status - 连接状态，可选值：'connected'、'disconnected'、'reconnecting'
   */
  updateStatus(status) {
    const indicator = this.container.querySelector('.status-indicator');
    const text = this.container.querySelector('.status-text');
    
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
  async reconnect() {
    // 清理旧会话
    this.sessionId = null;
    this.isConnected = false;

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.reconnectAttempts = 0;
    await this.connectWebSocket();
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
   * 销毁组件（优化版 - 确保正确清理所有资源）
   */
  destroy() {
    console.log('销毁 TerminalComponent...');
    
    // 停止心跳
    this.stopHeartbeat();
    
    // 关闭 WebSocket
    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.close(1000, 'Component destroyed');
      }
      this.websocket = null;
    }
    
    // 关闭终端会话
    if (this.sessionId) {
      this.sendMessage({
        type: 'terminal.close',
        sessionId: this.sessionId
      });
      this.sessionId = null;
    }
    
    // 销毁终端
    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }
    
    // 移除事件监听器
    window.removeEventListener('resize', this.fit);
    
    // 清理状态
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.commandHistory = [];
    this.historyIndex = -1;
    
    console.log('TerminalComponent 已销毁');
  }
}

// 导出默认创建函数
export function createTerminal(container, options) {
  return new TerminalComponent(container, options);
}