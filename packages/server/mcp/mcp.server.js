import { config } from '../utils/config.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
    handleGetPrompt,
    handleSearchPrompts,
    handleReloadPrompts
} from './mcp.handler.js';
import { handleToolX } from './toolx.handler.js';

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
        {
            name: 'toolx',
            description: `ToolX is the Prompt Manager tool runtime for loading and executing various tools.

## Why ToolX Exists

ToolX is your gateway to the Prompt Manager tool ecosystem. Think of it as:
- A **universal remote control** for all Prompt Manager tools
- Your **interface** to specialized capabilities (file operations, etc.)
- The **bridge** between you (AI agent) and powerful system tools

Without ToolX, you cannot access any Prompt Manager ecosystem tools.

## When to Use ToolX

### Common Scenarios (IF-THEN rules):
- IF user needs file operations → USE tool://filesystem via toolx
- IF you see tool:// in any context → USE toolx to call it

### First Time Using Any Tool
⚠️ **MUST run mode: manual first** to read the tool's documentation
⚠️ Example: toolx with mode: manual for tool://filesystem

## How to Use ToolX (Copy These Patterns)

### Pattern 1: Read Tool Manual (First Time)

**Exact code to use:**
\`\`\`javascript
// Call the toolx function with this exact structure:
toolx({
  yaml: \`tool: tool://filesystem\nmode: manual\`
})
\`\`\`

**What this does:** Shows you how to use the filesystem tool

### Pattern 2: Execute Tool with Parameters

**Exact code to use:**
\`\`\`javascript
toolx({
  yaml: \`tool: tool://filesystem\nmode: execute\nparameters:\n  path: /path/to/file.txt\n  action: read\`
})
\`\`\`

**What this does:** Reads a file at the specified path

### Pattern 3: Configure Tool Environment

**Exact code to use:**
\`\`\`javascript
toolx({
  yaml: \`tool: tool://my-tool\nmode: configure\nparameters:\n  API_KEY: sk-xxx123\n  TIMEOUT: 30000\`
})
\`\`\`

**What this does:** Sets environment variables for the tool

## Critical Rules (Must Follow)

### ✅ Correct Format
The yaml parameter MUST be a complete YAML document:
- Start with \`tool: tool://tool-name\`
- Add \`mode: execute\` (or manual/configure)
- If needed, add \`parameters:\` section with proper indentation

### ❌ Common Mistakes to Avoid
- DON'T pass just "tool://filesystem" (missing YAML structure)
- DON'T add @ prefix like "@tool://filesystem" (system handles it)
- DON'T forget "tool://" prefix (not "tool: filesystem")
- DON'T forget to read manual first for new tools

## Available System Tools

Quick reference of built-in tools:
- **tool://filesystem** - File operations (read/write/list/delete)

To see all available tools: check the tools directory

## Step-by-Step Workflow

### Step 1: Discover Available Tools
Check the tools directory to see what tools exist

### Step 2: Read Tool Manual
\`\`\`javascript
toolx({
  yaml: \`tool: tool://TOOLNAME\nmode: manual\`
})
\`\`\`

### Step 3: Execute Tool
Copy the example from manual, modify parameters for your needs

### Step 4: Handle Errors
If execution fails, check:
- Is the tool name correct?
- Are parameters properly indented?
- Did you read the manual first?

`,
            inputSchema: {
                yaml: z.string().describe('YAML 格式的工具调用配置')
            },
            handler: async (args) => {
                return handleToolX(args);
            }
        }
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