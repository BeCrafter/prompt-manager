import McpServer from './server.js';
import { logger } from '../utils/logger.js';
import IInitializer from './interfaces/IInitializer.js';

// 延迟导入处理函数以避免循环依赖
let mcpServer;
let mcpMiddleware;
let mcpHandlers;

/**
 * MCP初始化器实现
 * 实现IInitializer接口
 */
class McpInitializer extends IInitializer {
  /**
   * 构造函数
   */
  constructor() {
    super();
    this.mcpServer = null;
    this.mcpMiddleware = null;
    this.mcpHandlers = null;
  }

  /**
   * 导入MCP处理器函数
   * @returns {Object} 处理器函数对象
   */
  async importMcpHandlers() {
    if (!this.mcpHandlers) {
      this.mcpHandlers = await import('./handler.js');
    }
    return this.mcpHandlers;
  }

  /**
   * 初始化MCP服务器
   * @returns {Promise<McpServer>} MCP服务器实例
   */
  async initializeMcpServer() {
    if (this.mcpServer) return this.mcpServer;
    
    logger.info('正在初始化MCP服务器...');
    
    // 创建MCP服务器实例
    this.mcpServer = new McpServer({
        stateful: true, // 有状态模式，支持多客户端连接
        enableJsonResponse: true, // 启用JSON响应模式，更适合与AI编辑器通信
        security: {
            allowedHosts: process.env.MCP_ALLOWED_HOSTS?.split(',').map(h => h.trim()) || ['localhost', '127.0.0.1'], // 允许本地主机
            allowedOrigins: process.env.MCP_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:*', 'https://localhost:*', 'http://127.0.0.1:*', 'https://127.0.0.1:*'], // 允许本地来源
            enableDnsRebindingProtection: false // 禁用DNS重绑定保护，避免连接问题
        }
    });

    try {
      // 延迟导入处理函数以避免循环依赖
      const { handleGetPrompt, handleSearchPrompts, handleReloadPrompts } = await this.importMcpHandlers();

      this.mcpServer.expose('get_prompt', handleGetPrompt, {
          description: 'Retrieve the complete content of a specific prompt by its ID, including all messages, arguments, and metadata.',
          inputSchema: {
              type: 'object',
              properties: {
                  prompt_id: {
                      type: 'string',
                      description: 'the unique identifier of the prompt to retrieve'
                  }
              },
              required: ['prompt_id']
          }
      });

      this.mcpServer.expose('search_prompts', handleSearchPrompts, {
          description: 'For keyword search matching, retrieve or return all prompts. When a corresponding prompt word is matched, utilize the prompt ID to invoke the get_prompt tool to query the complete content of the prompt word.',
          inputSchema: {
              type: 'object',
              properties: {
                  name: {
                      type: 'string',
                      description: 'Optional name filter for prompts'
                  }
              },
              required: []
          }
      });

      this.mcpServer.expose('reload_prompts', handleReloadPrompts, {
          description: 'Force a reload of all preset prompts to overwrite the cache.',
          inputSchema: {
              type: 'object',
              properties: {},
              required: []
          }
      });

      // 设置消息处理器
      const core = this.mcpServer.getCore();
      this.mcpServer.setMessageHandler(core._handleMessage.bind(core));

      this.mcpMiddleware = this.mcpServer.createMiddleware();
      logger.info(`MCP服务器初始化完成\n`);
    } catch (error) {
      // 如果导入处理函数失败，清理已创建的服务器实例
      logger.error('MCP服务器初始化失败: ' + error.message);
      this.mcpServer = null;
      throw new Error('初始化MCP服务器失败: ' + error.message);
    }
    return this.mcpServer;
  }

  /**
   * 获取MCP中间件
   * @returns {Function} Express中间件
   */
  getMcpMiddleware() {
    if (!this.mcpServer) {
      throw new Error('MCP服务器未初始化, 请先调用initializeMcpServer()');
    }
    return this.mcpMiddleware;
  }

  /**
   * 获取MCP服务器实例
   * @returns {McpServer} MCP服务器实例
   */
  getMcpServerInstance() {
    if (!this.mcpServer) {
      throw new Error('MCP服务器未初始化, 请先调用initializeMcpServer()');
    }
    return this.mcpServer;
  }
}

// 创建全局初始化器实例
const initializer = new McpInitializer();

/**
 * 初始化MCP服务器（向后兼容）
 * @returns {Promise<McpServer>} MCP服务器实例
 */
export async function initializeMcpServer() {
  return await initializer.initializeMcpServer();
}

/**
 * 获取MCP中间件（向后兼容）
 * @returns {Function} Express中间件
 */
export function getMcpMiddleware() {
  return initializer.getMcpMiddleware();
}

/**
 * 获取MCP服务器实例（向后兼容）
 * @returns {McpServer} MCP服务器实例
 */
export function getMcpServerInstance() {
  return initializer.getMcpServerInstance();
}

// 导出初始化器类
export default McpInitializer;