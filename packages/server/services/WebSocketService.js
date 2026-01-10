/**
 * WebSocketService - WebSocket服务管理类
 *
 * 提供实时双向通信服务，支持终端会话的实时数据传输
 * 处理客户端连接、消息路由和会话管理
 */

import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { terminalService } from './TerminalService.js';

/**
 * WebSocket连接类
 */
class WebSocketConnection {
  constructor(ws, clientId) {
    this.ws = ws;
    this.clientId = clientId;
    this.connectedAt = new Date();
    this.lastActivity = new Date();
    this.sessionId = null;
    this.isAuthenticated = false;
    this.userInfo = null;

    this.setupWebSocketEvents();
  }

  /**
   * 设置WebSocket事件监听
   */
  setupWebSocketEvents() {
    this.ws.on('message', data => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code, reason) => {
      this.handleClose(code, reason);
    });

    this.ws.on('error', error => {
      this.handleError(error);
    });

    this.ws.on('pong', () => {
      this.lastActivity = new Date();
    });
  }

  /**
   * 处理消息
   */
  async handleMessage(data) {
    try {
      this.lastActivity = new Date();
      const message = JSON.parse(data.toString());

      logger.debug(`Received message from client ${this.clientId}:`, message.type);

      // 根据消息类型处理
      switch (message.type) {
      case 'terminal.create':
        await this.handleTerminalCreate(message);
        break;
      case 'terminal.data':
        await this.handleTerminalData(message);
        break;
      case 'terminal.resize':
        await this.handleTerminalResize(message);
        break;
      case 'terminal.close':
        await this.handleTerminalClose(message);
        break;
      case 'ping':
        this.handlePing(message);
        break;
      default:
        this.sendError('Unknown message type', message.type);
      }
    } catch (error) {
      logger.error(`Error handling message from client ${this.clientId}:`, error);
      this.sendError('Message processing error', error.message);
    }
  }

  /**
   * 处理终端创建
   */
  async handleTerminalCreate(message) {
    try {
      const options = {
        id: message.sessionId,
        workingDirectory: message.workingDirectory,
        size: message.size || { cols: 80, rows: 24 },
        shell: message.shell,
        environment: message.environment
      };

      const session = await terminalService.createSession(options);
      this.sessionId = session.id;

      // 监听会话数据
      session.on('data', data => {
        this.send('terminal.data', {
          sessionId: session.id,
          data
        });
      });

      session.on('exit', info => {
        this.send('terminal.exit', {
          sessionId: session.id,
          exitCode: info.exitCode,
          signal: info.signal
        });
      });

      this.send('terminal.created', {
        sessionId: session.id,
        info: session.getInfo()
      });

      logger.info(`Terminal session created for client ${this.clientId}: ${session.id}`);
    } catch (error) {
      this.sendError('Failed to create terminal session', error.message);
    }
  }

  /**
   * 处理终端数据
   */
  async handleTerminalData(message) {
    if (!this.sessionId) {
      this.sendError('No active terminal session', 'terminal.data');
      return;
    }

    try {
      const session = terminalService.getSession(this.sessionId);
      if (session && session.isActive) {
        session.write(message.data);
      } else {
        this.sendError('Terminal session not found or inactive', 'terminal.data');
      }
    } catch (error) {
      this.sendError('Failed to write to terminal', error.message);
    }
  }

  /**
   * 处理终端大小调整
   */
  async handleTerminalResize(message) {
    if (!this.sessionId) {
      this.sendError('No active terminal session', 'terminal.resize');
      return;
    }

    try {
      const session = terminalService.getSession(this.sessionId);
      if (session && session.isActive) {
        session.resize(message.cols, message.rows);
        this.send('terminal.resized', {
          sessionId: this.sessionId,
          size: { cols: message.cols, rows: message.rows }
        });
      } else {
        this.sendError('Terminal session not found or inactive', 'terminal.resize');
      }
    } catch (error) {
      this.sendError('Failed to resize terminal', error.message);
    }
  }

  /**
   * 处理终端关闭
   */
  async handleTerminalClose(_message) {
    if (this.sessionId) {
      try {
        await terminalService.removeSession(this.sessionId);
        this.send('terminal.closed', {
          sessionId: this.sessionId
        });
        this.sessionId = null;
      } catch (error) {
        this.sendError('Failed to close terminal session', error.message);
      }
    }
  }

  /**
   * 处理ping
   */
  handlePing(_message) {
    this.send('pong', {
      timestamp: Date.now(),
      clientId: this.clientId
    });
  }

  /**
   * 处理连接关闭
   */
  handleClose(code, reason) {
    logger.info(`Client ${this.clientId} disconnected: ${code} - ${reason}`);

    // 清理关联的终端会话
    if (this.sessionId) {
      terminalService.removeSession(this.sessionId);
    }
  }

  /**
   * 处理错误
   */
  handleError(error) {
    logger.error(`WebSocket error for client ${this.clientId}:`, error);
  }

  /**
   * 发送消息
   */
  send(type, data) {
    if (this.ws.readyState === this.ws.OPEN) {
      const message = {
        type,
        timestamp: Date.now(),
        clientId: this.clientId,
        ...data
      };

      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 发送错误消息
   */
  sendError(message, details = null) {
    this.send('error', {
      message,
      details
    });
  }

  /**
   * 获取连接信息
   */
  getInfo() {
    return {
      clientId: this.clientId,
      connectedAt: this.connectedAt,
      lastActivity: this.lastActivity,
      sessionId: this.sessionId,
      isAuthenticated: this.isAuthenticated,
      readyState: this.ws.readyState
    };
  }

  /**
   * 关闭连接
   */
  close(code = 1000, reason = 'Normal closure') {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.close(code, reason);
    }
  }
}

/**
 * WebSocketService 主类
 */
export class WebSocketService {
  constructor(options = {}) {
    this.options = {
      port: options.port || 8081, // 默认端口
      host: '0.0.0.0',
      maxConnections: 100,
      heartbeatInterval: 30000, // 30秒心跳
      connectionTimeout: 300000, // 5分钟超时
      ...options
    };

    this.wss = null;
    this.connections = new Map();
    this.isRunning = false;

    logger.info('WebSocketService initialized');
  }

  /**
   * 启动WebSocket服务
   */
  async start() {
    if (this.isRunning) {
      throw new Error('WebSocket service is already running');
    }

    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.options.port,
          host: this.options.host,
          maxConnections: this.options.maxConnections
        });

        this.wss.on('connection', (ws, request) => {
          this.handleConnection(ws, request);
        });

        this.wss.on('error', error => {
          logger.error('WebSocket server error:', error);
          if (!this.isRunning) {
            reject(error);
          }
        });

        this.wss.on('listening', () => {
          this.isRunning = true;
          // 获取实际分配的端口
          const address = this.wss.address();
          this.actualPort = typeof address === 'string' ? parseInt(address) : address.port;
          logger.info(`WebSocket server listening on ${this.options.host}:${this.actualPort}`);

          // 启动心跳检测
          this.startHeartbeat();

          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 停止WebSocket服务
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    // 关闭所有连接
    for (const connection of this.connections.values()) {
      connection.close(1001, 'Server shutdown');
    }
    this.connections.clear();

    // 停止心跳检测
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 关闭服务器
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.isRunning = false;
    logger.info('WebSocket service stopped');
  }

  /**
   * 处理新连接
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();

    // 检查连接数限制
    if (this.connections.size >= this.options.maxConnections) {
      ws.close(1013, 'Server overload');
      return;
    }

    try {
      const connection = new WebSocketConnection(ws, clientId);
      this.connections.set(clientId, connection);

      logger.info(`New client connected: ${clientId} from ${request.socket.remoteAddress}`);

      // 发送欢迎消息
      connection.send('welcome', {
        clientId,
        serverInfo: {
          version: '1.0.0',
          platform: process.platform,
          nodeVersion: process.version
        }
      });

      // 监听连接关闭
      ws.on('close', () => {
        this.connections.delete(clientId);
      });
    } catch (error) {
      logger.error(`Failed to handle connection for client ${clientId}:`, error);
      ws.close(1011, 'Internal error');
    }
  }

  /**
   * 生成客户端ID
   */
  generateClientId() {
    return randomUUID();
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const [clientId, connection] of this.connections) {
        // 检查连接超时
        if (now - connection.lastActivity > this.options.connectionTimeout) {
          logger.info(`Client ${clientId} timeout, disconnecting`);
          connection.close(1000, 'Connection timeout');
          this.connections.delete(clientId);
          continue;
        }

        // 发送ping
        if (connection.ws.readyState === connection.ws.OPEN) {
          connection.ws.ping();
        } else {
          // 连接已关闭，清理
          this.connections.delete(clientId);
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * 广播消息给所有客户端
   */
  broadcast(type, data) {
    for (const connection of this.connections.values()) {
      connection.send(type, data);
    }
  }

  /**
   * 获取连接
   */
  getConnection(clientId) {
    return this.connections.get(clientId);
  }

  /**
   * 获取所有连接
   */
  getAllConnections() {
    return Array.from(this.connections.values());
  }

  /**
   * 获取实际分配的端口
   */
  getPort() {
    return this.actualPort || this.options.port;
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    const activeConnections = this.getAllConnections().filter(conn => conn.ws.readyState === conn.ws.OPEN);

    return {
      isRunning: this.isRunning,
      port: this.getPort(),
      host: this.options.host,
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      maxConnections: this.options.maxConnections,
      uptime: process.uptime()
    };
  }
}

// 创建单例实例
export const webSocketService = new WebSocketService();

// 导出类型定义
export { WebSocketConnection };
