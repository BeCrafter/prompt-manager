import { config } from '../utils/config.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
    handleGetPrompt,
    handleSearchPrompts,
    handleReloadPrompts
} from './mcp.handler.js';

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
            this.server.registerTool(tool.name,
                {
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                },
                tool.handler
            );
        }
    }

    getServer() {
        return this.server;
    }
}

export const getMcpServer = () => {
    const mcpServer = new Server();
    mcpServer.registerTools([
        {
            name: 'search_prompts',
            description: `功能：智能检索提示词库，匹配用户需求\n描述：根据用户输入内容（可为空）搜索匹配的提示词，返回候选提示词的 ID、名称、简短描述。若输入为空则返回全部提示词列表。帮助用户快速定位适合的提示词，无需记忆具体名称。\n\n示例：\n- 用户："我想写一首诗" → 工具返回：[ID:001, 名称:诗歌创作, 描述:生成古典/现代风格诗歌]\n- 用户："（无输入）" → 工具返回：完整提示词库概览`,
            inputSchema: {
                name: z.string().optional().describe('提示词名称或关键词，用于搜索匹配提示词'),
            },
            handler: async (args) => {
                return handleSearchPrompts(args);
            }
        },
        {
            name: 'get_prompt',
            description: `功能：精准获取并应用提示词详情\n描述：根据提示词 ID 或名称 调用具体内容，自动将其嵌入当前对话上下文，无需用户手动复制。支持通过 search_prompts 返回的 ID/名称直接获取。\n\n示例：\n- 用户："使用 ID 001" → 工具自动加载诗歌创作提示词并生成内容\n- 用户："调用'营销文案生成'" → 工具匹配名称后应用对应提示词`,
            inputSchema: {
                prompt_id: z.string().describe('提示词的唯一标识 ID/名称'),
            },
            handler: async (args) => {
                return handleGetPrompt(args);
            }
        },
        // {
        //     name: 'reload_prompts',
        //     description: 'Force a reload of all preset prompts to overwrite the cache.',
        //     inputSchema: {},
        //     handler: async (args) => {
        //         return handleReloadPrompts(args);
        //     }
        // }
    ]);
    return mcpServer.getServer();
};