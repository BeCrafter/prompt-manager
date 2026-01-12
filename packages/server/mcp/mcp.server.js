import { config } from '../utils/config.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { handlePrompts } from './prompt.handler.js';
import { handleToolM } from '../toolm/index.js';
import { generateToolmDescription } from '../toolm/tool-description-generator-optimized.service.js';
import { toolLoaderService } from '../toolm/tool-loader.service.js';

class Server {
  constructor() {
    this.server = new McpServer(
      {
        name: 'Prompt Management Server',
        version: config.getServerVersion()
      },
      { capabilities: { logging: {} } }
    );
  }

  registerTools(tools) {
    for (const tool of tools) {
      this.server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema
        },
        tool.handler
      );
    }
  }

  getServer() {
    return this.server;
  }
}

export const getMcpServer = async () => {
  const mcpServer = new Server();

  // 确保工具加载器已初始化（用于生成动态描述）
  if (!toolLoaderService.initialized) {
    try {
      await toolLoaderService.initialize();
    } catch (error) {
      // 如果初始化失败，继续使用默认描述
      console.warn('工具加载器初始化失败，使用默认描述:', error.message);
    }
  }

  // 动态生成 toolm 工具的描述
  const toolmDescription = generateToolmDescription();

  mcpServer.registerTools([
    {
      name: 'prompts',
      description:
        '🤖 **提示词助手** - 你的AI提示词管家\n\n【规范名称】promptmanager_prompts\n【调用说明】在提示词中使用 promptmanager_prompts，实际调用时自动映射到 mcp__[server]__action\n\n我可以帮你找到并使用各种专业的提示词，让AI变得更聪明、更专业。\n\n## 我能做什么\n- 🔍 **找提示词** - 告诉我你想要什么功能，我帮你搜索匹配的提示词\n- 📋 **用提示词** - 帮你加载并应用专业的提示词到对话中\n- 📚 **逛提示词库** - 带你浏览所有可用的提示词，了解有什么可以用的\n\n## 在对话中怎么和我说\n\n**想找提示词时可以说：**\n- "帮我找找代码审查相关的提示词"\n- "有什么标题生成的提示词可以用吗？"\n- "我想看看所有可用的提示词"\n\n**想用某个提示词时可以说：**\n- "用代码审查的提示词帮我看看这段代码"\n- "加载标题生成器，我要写文章标题"\n- "用文档生成提示词帮我写API文档"\n\n## 实际使用示例\n\n```json\n// 对话中的自然表达：\n// "我想找个代码审查的提示词"\n{"action": "search", "query": "代码审查"}\n\n// "帮我用标题生成器"\n{"action": "get", "query": "examples-prompts-generator-gen_title"}\n\n// "看看有什么提示词可以用"\n{"action": "search"}\n```\n\n**提示：** 先搜索找到合适的提示词ID，然后用"get"加载它，就能直接在对话中使用啦！',
      inputSchema: {
        action: z.enum(['search', 'get']).describe('操作类型：search(搜索提示词) 或 get(获取提示词详情)'),
        query: z.string().optional().describe('搜索关键词(用于search) 或 提示词ID/名称(用于get)')
      },
      handler: async args => {
        return handlePrompts(args);
      }
    },
    {
      name: 'toolm',
      description: toolmDescription,
      inputSchema: {
        yaml: z.string().describe('YAML 格式的工具调用配置')
      },
      handler: async args => {
        return handleToolM(args);
      }
    }
  ]);
  return mcpServer.getServer();
};
