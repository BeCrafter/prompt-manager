import McpServer from './mcpServer.js';
import { logger } from './logger.js';

// 延迟导入处理函数以避免循环依赖
let mcpServer;
let mcpMiddleware;
let mcpHandlers;

async function importMcpHandlers() {
  if (!mcpHandlers) {
    mcpHandlers = await import('./mcpHandler.js');
  }
  return mcpHandlers;
}

async function initializeMcpServer() {
  if (mcpServer) return;
  
  logger.info('正在初始化MCP服务器...');
  
  // 创建MCP服务器实例
  mcpServer = new McpServer({
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
    const { handleGetPrompt, handleSearchPrompts, handleReloadPrompts } = await importMcpHandlers();

    mcpServer.expose('get_prompt', handleGetPrompt, {
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

    mcpServer.expose('search_prompts', handleSearchPrompts, {
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

    mcpServer.expose('reload_prompts', handleReloadPrompts, {
        description: 'Force a reload of all preset prompts to overwrite the cache.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    });

    mcpMiddleware = mcpServer.createMiddleware();
    logger.info('MCP服务器初始化完成');
  } catch (error) {
    // 如果导入处理函数失败，清理已创建的服务器实例
    logger.error('MCP服务器初始化失败: ' + error.message);
    mcpServer = null;
    throw new Error('初始化MCP服务器失败: ' + error.message);
  }
}

export { initializeMcpServer };

export function getMcpMiddleware() {
  if (!mcpServer) {
    throw new Error('MCP服务器未初始化, 请先调用initializeMcpServer()');
  }
  return mcpMiddleware;
}

export function getMcpServerInstance() {
  if (!mcpServer) {
    throw new Error('MCP服务器未初始化, 请先调用initializeMcpServer()');
  }
  return mcpServer;
}