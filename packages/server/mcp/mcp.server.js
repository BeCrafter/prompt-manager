import { config } from '../utils/config.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
    handleGetPrompt,
    handleSearchPrompts,
    handleReloadPrompts
} from './mcp.handler.js';
import { handleToolM } from '../toolm/index.js';

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
            name: 'toolm',
            description: `ToolM 是 Prompt Manager 新一代工具系统运行时，提供统一的工具管理和执行能力。

## 核心特性

ToolM 作为统一工具管理器，提供：
- **智能工具加载** - 自动扫描并加载所有可用工具
- **四种运行模式** - manual（手册）、execute（执行）、configure（配置）、log（日志）
- **依赖管理** - 自动处理工具依赖和安装
- **错误智能处理** - 业务错误识别和解决方案提示
- **统一接口** - 所有工具遵循标准接口规范

## 何时使用 ToolM

### 常见场景（IF-THEN 规则）：
- IF 需要文件操作 → 使用 tool://filesystem 通过 toolm
- IF 需要处理PDF文档 → 使用 tool://pdf-reader 通过 toolm
- IF 需要读取本地或远程文件 → 使用 tool://file-reader 通过 toolm
- IF 看到 tool:// 格式 → 使用 toolm 调用
- IF 不确定工具用法 → 先用 manual 模式查看手册

### 首次使用任何工具
⚠️ **必须先运行 mode: manual** 阅读工具文档
⚠️ 示例：toolm with mode: manual for tool://filesystem

## 如何使用 ToolM（复制这些模式）

### 模式 1：查看工具手册（首次使用）

**使用代码：**
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: manual\`
})
\`\`\`

**作用：** 显示 filesystem 工具的完整使用手册

### 模式 2：执行工具操作

**使用代码：**
\`\`\`javascript
// 写入文件
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: execute
parameters:
  method: write_file
  path: ~/.prompt-manager/test.txt
  content: |
    Hello World
    这是测试内容\`
})

// 读取文件
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: execute
parameters:
  method: read_text_file
  path: ~/.prompt-manager/test.txt\`
})
\`\`\`

**作用：** 根据指定的工具和参数执行操作

### 模式 3：配置工具环境

**使用代码：**
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: configure
parameters:
  ALLOWED_DIRECTORIES: '["~/.prompt-manager", "/tmp"]'\`
})
\`\`\`

**作用：** 设置工具的环境变量

### 模式 4：查看工具日志

**使用代码：**
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://filesystem
mode: log
parameters:
  action: tail
  lines: 50\`
})
\`\`\`

**作用：** 查看工具最近的 50 条日志

## 关键规则（必须遵守）

### ✅ 正确格式
yaml 参数必须是完整的 YAML 文档：
- 以 \`tool: tool://tool-name\` 开头
- 添加 \`mode: execute\`（或 manual/configure/log）
- 如需参数，添加 \`parameters:\` 部分并正确缩进

### ❌ 常见错误避免
- 不要只传 "tool://filesystem"（缺少 YAML 结构）
- 不要添加 @ 前缀如 "@tool://filesystem"（系统会处理）
- 不要忘记 "tool://" 前缀（不是 "tool: filesystem"）
- 不要跳过手册，首次使用必须先看 manual

## 系统内置工具

完整内置工具列表：
- **tool://filesystem** - 文件系统操作（读/写/列表/搜索等）
- **tool://pdf-reader** - PDF文档读取与处理（分页提取文本和图片）
- **tool://file-reader** - 统一文件读取工具（支持本地和远程文件，自动识别文件类型并转换为模型友好格式，支持缓存、相对路径解析和链接提取）

更多工具正在开发中...

## 逐步工作流程

### 步骤 1：查看可用工具
使用 manual 模式了解工具能力

### 步骤 2：阅读工具手册
\`\`\`javascript
mcp__promptmanager__toolm({
  yaml: \`tool: tool://TOOLNAME
mode: manual\`
})
\`\`\`

### 步骤 3：执行工具操作
根据手册中的示例，修改参数以满足需求

### 步骤 4：处理错误
如果执行失败，检查：
- 工具名称是否正确？
- 参数是否正确缩进？
- 是否先阅读了手册？
- 错误提示中是否有解决方案？
`,
            inputSchema: {
                yaml: z.string().describe('YAML 格式的工具调用配置')
            },
            handler: async (args) => {
                return handleToolM(args);
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