import { config } from '../utils/config.js';
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
            this.server.tool(tool.name, tool.description, tool.inputSchema, tool.handler);
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
                type: 'object',
                properties: {
                    prompt_id: {
                        type: 'string',
                        description: 'the unique identifier of the prompt to retrieve'
                    }
                },
                required: ['prompt_id']
            },
            handler: async (args) => {
                return handleGetPrompt(args);
            }
        },
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
                },
                required: []
            },
            handler: async (args) => {
                return handleSearchPrompts(args);
            }
        },
        {
            name: 'reload_prompts',
            description: 'Force a reload of all preset prompts to overwrite the cache.',
            inputSchema: {
                type: 'object',
                properties: {},
                required: []
            },
            handler: async (args) => {
                return handleReloadPrompts(args);
            }
        }
    ]);
    return mcpServer.getServer();
};