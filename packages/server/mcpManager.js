import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { PromptManager } from './manager.js';
import { handleSearchPrompts, handleGetPrompt, handleReloadPrompts } from './mcp.js';

/**
 * MCP服务器管理类
 */
export class MCPManager {
  constructor() {
    this.server = null;
    this.stdioTransport = null;
    this.httpTransport = null;
    this.promptManager = null;
    this.isInitialized = false;
  }

  /**
   * 初始化MCP服务器
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // 初始化prompt管理器
      this.promptManager = new PromptManager(config.getPromptsDir());
      await this.promptManager.loadPrompts();

      // 创建MCP服务器
      this.server = new Server({
        name: 'Prompt Server MCP',
        version: config.serverVersion,
      }, {
        capabilities: {
          tools: {}
        }
      });

      // 注册工具处理器
      this.registerToolHandlers();

      // 启动Stdio传输
      this.stdioTransport = new StdioServerTransport();
      await this.server.connect(this.stdioTransport);

      this.isInitialized = true;
      logger.info('MCP服务器初始化完成');
    } catch (error) {
      logger.error('MCP服务器初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 注册工具处理器
   */
  registerToolHandlers() {
    // 注册工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_prompts',
            description: 'For keyword search matching, retrieve or return all prompts. When a corresponding prompt word is matched, utilize the prompt ID to invoke the get_prompt tool to query the complete content of the prompt word.',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Optional name filter for prompts'
                }
              }
            }
          },
          {
            name: 'get_prompt',
            description: 'Retrieve the complete content of a specific prompt by its ID, including all messages, arguments, and metadata.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt_id: {
                  type: 'string',
                  description: 'The unique identifier of the prompt to retrieve'
                }
              },
              required: ['prompt_id']
            }
          },
          {
            name: 'reload_prompts',
            description: 'Force a reload of all preset prompts to overwrite the cache.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    // 注册工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_prompts':
            return await handleSearchPrompts(args, this.promptManager);
          case 'get_prompt':
            return await handleGetPrompt(args, this.promptManager);
          case 'reload_prompts':
            // 重新加载prompts
            return await handleReloadPrompts(this.promptManager);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`执行工具 ${name} 时发生错误:`, error.message);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });
  }

  /**
   * 处理HTTP请求
   */
  async handleHTTPRequest(req, res) {
    try {
      // 如果HTTP传输不存在，创建一个新的
      if (!this.httpTransport) {
        this.httpTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true
        });

        // 连接服务器到HTTP传输
        await this.server.connect(this.httpTransport);
      }

      // 处理请求
      await this.httpTransport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('MCP HTTP请求处理失败:', error.message);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error'
          }
        });
      }
    }
  }

  /**
   * 关闭MCP服务器
   */
  async close() {
    try {
      if (this.httpTransport) {
        this.httpTransport.close();
        this.httpTransport = null;
      }

      if (this.server) {
        this.server.close();
        this.server = null;
      }

      this.isInitialized = false;
      logger.info('MCP服务器已关闭');
    } catch (error) {
      logger.error('关闭MCP服务器时发生错误:', error.message);
    }
  }

  /**
   * 重新加载prompts
   */
  async reloadPrompts() {
    if (this.promptManager) {
      return await this.promptManager.reloadPrompts();
    }
  }

  /**
   * 获取prompt管理器
   */
  getPromptManager() {
    return this.promptManager;
  }
}

// 导出单例实例
export const mcpManager = new MCPManager();