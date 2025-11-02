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
            name: 'get_prompt',
            description: 'Retrieve the complete content of a specific prompt by its ID, including all messages, arguments, and metadata.',
            inputSchema: {
                prompt_id: z.string().describe('the unique identifier of the prompt to retrieve'),
            },
            handler: async (args) => {
                return handleGetPrompt(args);
            }
        },
        {
            name: 'search_prompts',
            description: 'For keyword search matching, retrieve or return all prompts. When a corresponding prompt word is matched, utilize the prompt ID to invoke the get_prompt tool to query the complete content of the prompt word.',
            inputSchema: {
                name: z.string().optional().describe('Optional name filter for prompts'),
            },
            handler: async (args) => {
                return handleSearchPrompts(args);
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