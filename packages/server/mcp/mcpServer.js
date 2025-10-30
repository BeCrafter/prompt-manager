import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

class Mcp {
  /**
   * 初始化MCP管理器
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
    this.exposedMethods = {};
    this.logger = logger;
    
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: stateful ? () => randomUUID() : undefined,
      allowedHosts: security.allowedHosts || [],
      allowedOrigins: security.allowedOrigins || [],
      enableDnsRebindingProtection: security.enableDnsRebindingProtection !== undefined ? security.enableDnsRebindingProtection : false, // 默认禁用DNS重绑定保护
      enableJsonResponse: enableJsonResponse,
      eventStore: eventStore,
      onsessioninitialized: (sessionId) => {
        this.logger.info(`会话初始化：${sessionId}`);
        this._handleSessionEvent('initialized', sessionId);
      },
      onsessionclosed: (sessionId) => {
        this.logger.info(`会话关闭：${sessionId}`);
        this._handleSessionEvent('closed', sessionId);
      },
    });
    
    // 绑定消息处理逻辑
    this.transport.onmessage = this._handleMessage.bind(this);
    
    // 存储会话事件处理器
    this.sessionEventHandlers = [];
  
    // 设置定时健康检查
    this.healthCheckInterval = setInterval(() => {
      this._checkHealth().catch(err => {
        this.logger.error('健康检查异常:', err.message);
      });
    }, 30000);
    
    this.logger.info(`MCP管理器初始化完成`, {
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
      if (!this.transport || typeof this.transport.handleRequest !== 'function') {
        this.logger.warn('健康检查: Transport 不可用');
        await this._recoverConnection();
      }
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
        console.log('处理自定义方法:', method, params, context);
        result = await this._handleCustomMethod(method, params, context);
      }
      
      // console.log('方法结果:', result);

      // 发送成功响应
      if (id !== undefined) {
        this.logger.debug(`发送响应: ${method}`, { method, id });
        await this.transport.send({ jsonrpc: '2.0', id, result });
      }
    } catch (err) {
      // 发送错误响应
      this.logger.error(`处理消息错误: ${err.message}`, { method, id, stack: err.stack });

      // 标记连接为不可用
      this.transport.markAsDisconnected();
      
      // 尝试自动恢复
      setTimeout(() => this._recoverConnection(), 5000);

      if (id !== undefined) {
        await this.transport.send({
          jsonrpc: '2.0',
          id,
          error: {
            code: err.code || -32601,
            message: err.message,
            data: undefined
          }
        });
      }
    }
  }

  /**
   * 处理初始化请求
   */
  _handleInitialize() {
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
   * 尝试恢复连接
   */
  async _recoverConnection() {
    try {
      await this.transport.reconnect();
      this.logger.info('连接已恢复');
    } catch (err) {
      this.logger.error('恢复连接失败:', err.message);
      // 指数退避重试
      const delay = Math.min(30000, 5000 * Math.pow(2, this.reconnectAttempts));
      setTimeout(() => this._recoverConnection(), delay);
      this.reconnectAttempts++;
    }
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
    const getFieldValue = (field, result) => {
      let val = {};
      for (const key in result) {
        if (key.toLowerCase() === field.toLowerCase()) {
          val[field] = result[key];
          break;
        }
      }

      if (Object.keys(val).length === 0) {
        val[field] = [];
      }
      console.log('getFieldValue', field, val);
      return val || null
    };
    
    if (!methodDef) {
      logger.error(`方法 ${method} 未找到`);

      let methodList = method.split('/');
      let field;
      if (methodList.length === 2) {
        field = methodList[0];  // 长度为2时使用第一个元素
      } else if (methodList.length > 2) {
        // 小驼峰拼接前 length-1 个元素
        field = methodList.slice(0, -1).reduce((acc, curr, index) => 
          index === 0 ? curr : acc + curr.charAt(0).toUpperCase() + curr.slice(1), 
          ''
        );
      } else {
        field = methodList[0] || '';  // 默认处理
      }
      console.log('field', field);

      let result = {
        'resources': [],
        'prompts': [],
        'notifications': [],
        'templates': []
      };
      return getFieldValue(field, result) || null;
    }
    
    return await methodDef.handler(params, context);
  }

  /**
   * 关闭MCP服务
   */
  async close() {
    await this.transport.close();
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.logger.info('服务已关闭');
  }
  
  /**
   * 获取Transport实例（用于高级用法）
   */
  getTransport() {
    return this.transport;
  }
}


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
        this.mcpServer = new Mcp(options);
        
        // 绑定常用方法到实例
        this.expose = this.mcpServer.expose.bind(this.mcpServer);
        this.createMiddleware = this.mcpServer.createMiddleware.bind(this.mcpServer);
        this.close = this.mcpServer.close.bind(this.mcpServer);
        this.onSessionEvent = this.mcpServer.onSessionEvent.bind(this.mcpServer);
    }

    /**
     * 获取底层MCP管理器（用于高级用法）
     */
    getManager() {
        return this.mcpServer;
    }

    /**
     * 获取Transport实例（用于高级用法）
     */
    getTransport() {
        return this.mcpServer.getTransport();
    }
}

export default McpServer;