import McpServer from './mcpServer.js';
import { logger } from './logger.js';
import { handleGetPrompt, handleSearchPrompts, handleReloadPrompts } from './mcpHandler.js';


// 创建MCP服务器实例
const mcpServer = new McpServer({
    stateful: false, // 无状态模式，更适用于多客户端场景
    enableJsonResponse: false, // 使用SSE流，更适合实时通信
    security: {
        allowedHosts: process.env.MCP_ALLOWED_HOSTS?.split(',').map(h => h.trim()) || [],
        allowedOrigins: process.env.MCP_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [],
        enableDnsRebindingProtection: process.env.MCP_DNS_REBINDING_PROTECTION === 'true'
    }
});

mcpServer.expose('translate', async (params, { context }) => {
    logger.info('Translate工具被调用', { params });
    
    const { text, target_language, source_language } = params;
    
    // 模拟翻译（实际实现中应该连接翻译API）
    return {
      translated_text: `[${target_language}] ${text}`, // 实际应用中这里应该是翻译结果
      source_language: source_language || 'auto',
      target_language: target_language,
      timestamp: new Date().toISOString()
    };
  }, {
    description: '翻译工具：翻译文本',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要翻译的文本'
        },
        target_language: {
          type: 'string',
          description: '目标语言代码（如en, zh, es等）',
          default: 'en'
        },
        source_language: {
          type: 'string',
          description: '源语言代码（可选）',
          default: 'auto'
        }
      },
      required: ['text', 'target_language']
    }
});

mcpServer.expose('get_prompt', handleGetPrompt, {
    description: '获取特定提示词的内容',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: '提示词名称'
            }
        },
        required: ['name']
    }
});

mcpServer.expose('search_prompts', handleSearchPrompts, {
    description: '搜索提示词',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: '搜索关键词'
            }
        },
        required: ['query']
    }
});

mcpServer.expose('reload_prompts', handleReloadPrompts, {
    description: '重新加载提示词',
    inputSchema: {
        type: 'object',
        properties: {},
        required: []
    }
});

export const mcpMiddleware = mcpServer.createMiddleware();
export const mcpServerInstance = mcpServer;