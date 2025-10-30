import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';
import IMcpServer from './interfaces/IMcpServer.js';
import { ErrorHandler } from './services/ErrorHandler.js';

/**
 * MCP传输层实现
 */
class McpTransport {
  /**
   * 初始化MCP传输层
   * @param {Object} options - 配置项
   * @param {boolean} options.stateful - 有状态模式
   * @param {Object} options.security - 安全配置
   * @param {boolean} options.enableJsonResponse - 启用JSON响应模式
   * @param {Object} options.eventStore - 事件存储
   */
  constructor({ 
    stateful = true, 
    security = {},
    enableJsonResponse = false,
    eventStore = null
  } = {}) {
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: stateful ? () => randomUUID() : undefined,
      allowedHosts: security.allowedHosts || [],
      allowedOrigins: security.allowedOrigins || [],
      enableDnsRebindingProtection: security.enableDnsRebindingProtection !== undefined ? security.enableDnsRebindingProtection : false,
      enableJsonResponse: enableJsonResponse,
      eventStore: eventStore
    });
  }

  /**
   * 启动传输层
   */
  async start() {
    return await this.transport.start();
  }

  /**
   * 处理HTTP请求
   */
  async handleRequest(req, res, body) {
    return await this.transport.handleRequest(req, res, body);
  }

  /**
   * 发送消息
   */
  async send(message) {
    return await this.transport.send(message);
  }

  /**
   * 关闭传输层
   */
  async close() {
    return await this.transport.close();
  }

  /**
   * 标记为断开连接
   */
  markAsDisconnected() {
    return this.transport.markAsDisconnected();
  }

  /**
   * 重新连接
   */
  async reconnect() {
    return await this.transport.reconnect();
  }

  /**
   * 设置消息处理器
   * @param {Function} handler - 消息处理器
   */
  setOnMessageHandler(handler) {
    this.transport.onmessage = handler;
  }

  /**
   * 设置会话初始化回调
   * @param {Function} callback - 回调函数
   */
  setOnSessionInitialized(callback) {
    this.transport.onsessioninitialized = callback;
  }

  /**
   * 设置会话关闭回调
   * @param {Function} callback - 回调函数
   */
  setOnSessionClosed(callback) {
    this.transport.onsessionclosed = callback;
  }

  /**
   * 获取底层传输实例
   */
  getTransport() {
    return this.transport;
  }
}

/**
 * MCP核心服务类
 * 实现IMcpServer接口
 */
class McpCore extends IMcpServer {
  /**
   * 初始化MCP核心服务
   * @param {Object} options - 配置项
   * @param {boolean} options.stateful - 有状态模式（默认true）
   * @param {Object} options.security - 安全配置
   * @param {Array<string>} options.security.allowedHosts - 允许的主机列表
   * @param {Array<string>} options.security.allowedOrigins - 允许的源列表
   * @param {boolean} options.enableJsonResponse - 启用JSON响应模式（默认false）
   * @param {Object} options.eventStore - 事件存储（用于恢复功能）
   */
  constructor({ 
    stateful = true, 
    security = {},
    enableJsonResponse = false,
    eventStore = null
  } = {}) {
    super();
    
    this.exposedMethods = {};
    this.logger = logger;
    this.initialized = false; // 添加服务器初始化状态跟踪
    
    // 初始化传输层
    this.transport = new McpTransport({
      stateful,
      security,
      enableJsonResponse,
      eventStore
    });
    
    // 设置会话事件回调
    this.transport.setOnSessionInitialized((sessionId) => {
      this.logger.info(`会话初始化：${sessionId}`);
      this._handleSessionEvent('initialized', sessionId);
    });
    
    this.transport.setOnSessionClosed((sessionId) => {
      this.logger.info(`会话关闭：${sessionId}`);
      this._handleSessionEvent('closed', sessionId);
    });
    
    // 存储会话事件处理器
    this.sessionEventHandlers = [];
  
    // 设置定时健康检查
    this.healthCheckInterval = setInterval(() => {
      this._checkHealth().catch(err => {
        this.logger.error('健康检查异常:', err.message);
      });
    }, 30000);
    
    this.logger.info(`MCP核心服务初始化完成`, {
      stateful,
      enableJsonResponse,
      security: {
        allowedHosts: security.allowedHosts?.length || 0,
        allowedOrigins: security.allowedOrigins?.length || 0,
        dnsRebindingProtection: !!security.allowedHosts || !!security.allowedOrigins
      }
    });
  }

  /**
   * 健康检查
   */
  async _checkHealth() {
    try {
      // 健康检查逻辑可以在这里实现
      this.logger.debug('健康检查执行中...');
    } catch (err) {
      this.logger.error('健康检查失败:', err.message);
    }
  }

  /**
   * 添加会话事件处理器
   * @param {Function} handler - 事件处理器
   */
  onSessionEvent(handler) {
    if (typeof handler !== 'function') {
      const error = new Error('会话事件处理器必须是函数');
      this.logger.error(error.message);
      throw error;
    }
    this.sessionEventHandlers.push(handler);
  }

  /**
   * 处理会话事件
   * @param {string} eventType - 事件类型
   * @param {string} sessionId - 会话ID
   */
  _handleSessionEvent(eventType, sessionId) {
    // 在会话关闭时重置初始化状态，以便下次连接可以重新初始化
    if (eventType === 'closed') {
      this.initialized = false;
    }
    
    for (const handler of this.sessionEventHandlers) {
      try {
        handler(eventType, sessionId);
      } catch (err) {
        this.logger.error(`会话事件处理器执行错误: ${err.message}`);
      }
    }
  }

  /**
   * 暴露MCP方法
   * @param {string} methodName - 方法名
   * @param {Function} handler - 方法实现（支持同步/异步）
   * @param {Object} metadata - 方法元数据（可选）
   * @param {string} metadata.description - 方法描述
   * @param {Object} metadata.inputSchema - 输入模式定义
   */
  expose(methodName, handler, metadata = {}) {
    if (typeof handler !== 'function') {
      const error = new Error(`方法${methodName}必须是函数`);
      this.logger.error(error.message);
      throw error;
    }
    
    this.exposedMethods[methodName] = {
      handler,
      metadata: {
        description: metadata.description || `工具方法: ${methodName}`,
        inputSchema: metadata.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    };
    
    this.logger.info(`已暴露方法：${methodName}`);
  }

  /**
   * 生成Express中间件
   * @returns {Function} Express中间件
   */
  createMiddleware() {
    // 启动Transport（仅启动一次）
    this.transport.start().catch(err => {
      this.logger.error(`启动失败：${err.message}`);
    });
    
    // 返回Express中间件函数
    return async (req, res, next) => {
      try {
        // 记录请求信息
        this.logger.debug(`收到请求: ${req.method} ${req.url}`, {
          headers: req.headers,
          method: req.method,
          url: req.url
        });
        
        // 检查Content-Type头
        const contentType = req.headers['content-type'];
        if (contentType && !contentType.includes('application/json')) {
          this.logger.warn(`不支持的Content-Type: ${contentType}`);
        }
        
        // 转发请求给MCP Transport处理
        await this.transport.handleRequest(req, res, req.body);
      } catch (err) {
        // 记录错误但不中断其他中间件
        this.logger.error(`内部错误: ${err.message}`, { stack: err.stack });
        next(err); // 传递给错误处理中间件
      }
    };
  }

  /**
   * 设置消息处理器
   * @param {Function} handler - 消息处理器
   */
  setMessageHandler(handler) {
    this.transport.setOnMessageHandler(handler);
  }

  /**
   * 关闭MCP服务
   */
  async close() {
    await this.transport.close();
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    // 重置初始化状态
    this.initialized = false;
    this.logger.info('服务已关闭');
  }

  /**
   * 获取传输层实例
   */
  getTransport() {
    return this.transport;
  }

  /**
   * 获取暴露的方法
   */
  getExposedMethods() {
    return this.exposedMethods;
  }

  /**
   * 内部：处理JSON-RPC消息
   */
  async _handleMessage(message, context) {
    if (!this.transport || typeof this.transport.handleRequest !== 'function') {
      this.logger.error('连接已断开，无法处理消息');
      return;
    }

    if (!message.jsonrpc) {
      this.logger.debug('收到非JSON-RPC消息', { message });
      return;
    }
    
    const { method, params = {}, id } = message;
    this.logger.debug(`处理消息: ${method}`, { method, id, hasParams: !!params });
    
    try {
      let result;
      
      // 处理不同的MCP方法
      if (method === 'initialize' || method === 'notifications/initialized') {
        result = this._handleInitialize();
      } else if (method === 'tools/list') {
        result = this._handleListTools();
      } else if (method === 'tools/call') {
        result = await this._handleCallTool(params, context);
      } else {
        // 处理自定义方法
        this.logger.debug('处理自定义方法:', method, params, context);
        result = await this._handleCustomMethod(method, params, context);
      }
      
      // 发送成功响应
      if (id !== undefined) {
        this.logger.debug(`发送响应: ${method}`, { method, id });
        await this.transport.send({ jsonrpc: '2.0', id, result });
      }
    } catch (err) {
      // 发送错误响应
      this.logger.error(`处理消息错误: ${err.message}`, { method, id, stack: err.stack });
      
      if (id !== undefined) {
        const errorResponse = ErrorHandler.handleMcpError(err, { method, id });
        await this.transport.send({
          jsonrpc: '2.0',
          id,
          error: errorResponse.error
        });
      }
    }
  }

  /**
   * 处理初始化请求
   */
  _handleInitialize() {
    // 检查是否已经初始化
    if (!this.initialized) {
      // 标记服务器为已初始化
      this.initialized = true;
    }
    
    return {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: this._handleListTools(),
        resources: {},
        prompts: {}
      },
      serverInfo: {
        name: "Prompt Manager MCP Server",
        version: "1.0.0"
      }
    };
  }

  /**
   * 处理工具列表请求
   */
  _handleListTools() {
    return {
      tools: Object.entries(this.exposedMethods).map(([name, { metadata }]) => ({
        name,
        description: metadata.description,
        inputSchema: metadata.inputSchema
      }))
    };
  }

  /**
   * 处理工具调用请求
   */
  async _handleCallTool(params, context) {
    const { name, arguments: args = {} } = params;
    const tool = this.exposedMethods[name];
    
    if (!tool) {
      throw new Error(`工具 ${name} 未找到`);
    }
    
    // 验证参数是一个对象
    if (typeof args !== 'object' || args === null) {
      throw new Error(`工具 ${name} 的参数必须是一个对象`);
    }
    
    // 调用工具处理函数
    return await tool.handler(args, context);
  }

  /**
   * 处理自定义方法
   */
  async _handleCustomMethod(method, params, context) {
    const methodDef = this.exposedMethods[method];
    const getReturnByMethod = (method) => {
      let methodReturn = {
        'resources/list': {'resources': []},
        'resources/templates/list': {'resourceTemplates': []},
        'prompts/list': {'prompts': []},
        'notifications/list': {'notifications': []},
      };

      // get return structure by method name
      let ret = methodReturn[method] || {};

      if (Object.keys(ret).length > 0) {
        return ret;
      }

      // get return structure by method name parsing
      let field;
      let methodList = method.split('/');
      if (methodList.length === 2) {
        field = methodList[0];
      } else if (methodList.length > 2) {
        field = methodList.slice(0, -1).reduce((acc, curr, index) => 
          index === 0 ? curr : acc + curr.charAt(0).toUpperCase() + curr.slice(1), 
          ''
        );
      } else {
        field = methodList[0] || '';
      }
      this.logger.debug('field', field);

      // default return structure
      ret[field] = [];
      return ret || null
    };
    
    if (!methodDef) {
      this.logger.warn(`方法 ${method} 未找到`);
      return getReturnByMethod(method) || null;
    }
    
    return await methodDef.handler(params, context);
  }
}

/**
 * MCP服务器主类
 * 提供统一的入口点
 */
class McpServer {
  /**
   * 初始化MCP流式服务器
   * @param {Object} options - 配置项
   * @param {boolean} options.stateful - 有状态模式（默认true）
   * @param {Object} options.security - 安全配置
   * @param {boolean} options.enableJsonResponse - 启用JSON响应模式（默认false）
   * @param {Object} options.eventStore - 事件存储（用于恢复功能）
   */
  constructor(options = {}) {
    this.mcpCore = new McpCore(options);
    
    // 绑定常用方法到实例
    this.expose = this.mcpCore.expose.bind(this.mcpCore);
    this.createMiddleware = this.mcpCore.createMiddleware.bind(this.mcpCore);
    this.close = this.mcpCore.close.bind(this.mcpCore);
    this.onSessionEvent = this.mcpCore.onSessionEvent.bind(this.mcpCore);
    this.setMessageHandler = this.mcpCore.setMessageHandler.bind(this.mcpCore);
  }

  /**
   * 获取底层MCP核心服务（用于高级用法）
   */
  getCore() {
    return this.mcpCore;
  }

  /**
   * 获取传输层实例（用于高级用法）
   */
  getTransport() {
    return this.mcpCore.getTransport();
  }
}

export default McpServer;