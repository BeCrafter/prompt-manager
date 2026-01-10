import { config } from '../utils/config.js';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { handlePrompts } from './prompt.handler.js';
import { handleToolM } from '../toolm/index.js';
// import { generateToolmDescription } from '../toolm/tool-description-generator.service.js';
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
    // {
    //     name: 'thinking',
    //     description: `🧭 **智能思考工具箱**\n\n【规范名称】promptmanager_thinking\n【调用说明】在提示词中使用 promptmanager_thinking，实际调用时自动映射到 mcp__[server]__action\n\n⚠️ **务必先读说明**：每次首次使用某个 scenario 时，先发送仅包含 \`{"scenario":"..."}\` 的请求获取完整描述，确认理解适用场景与参数要求后，再携带 payload 调用。跳过此步骤易导致字段缺失或流程误用。\n\n## 核心特性\n\n- **双模式思考** - 提供顺序思考（exploratory）和思考规划（execution）两种模式\n- **智能引导** - 通过场景参数自动匹配合适的思考策略\n- **结构化流程** - 支持多轮思考追踪和分支管理\n- **错误预防** - 强制预读说明，避免参数配置错误\n- **灵活扩展** - 支持修订、分支和会话管理\n\n## 何时使用 Thinking Toolkit\n\n### 快速决策（IF-THEN 规则）：\n- IF 需要探索性思考、诊断问题、发散推理 → 使用 scenario: "exploratory"\n- IF 需要结构化规划、制定执行步骤 → 使用 scenario: "execution"\n- IF 看到 scenario 参数 → 使用 thinking_toolkit 调用\n- IF 不确定场景用法 → 先用仅包含 scenario 的请求查看说明\n\n### 首次使用任何场景\n⚠️ **必须先发送仅包含 scenario 的请求** 阅读场景完整描述\n⚠️ 示例：thinking_toolkit with scenario: "exploratory" (无payload)\n\n## 如何使用 Thinking Toolkit\n\n### 模式 1：查看场景说明（首次使用）\n\n\`\`\`javascript\nmcp_mcp-router_thinking_toolkit({\n  scenario: "exploratory"\n})\n\`\`\`\n\n**重要**：每次使用新场景前必须先执行此步骤，了解场景的具体参数要求和使用方法。\n\n### 模式 2：执行顺序思考\n\n\`\`\`javascript\nmcp_mcp-router_thinking_toolkit({\n  scenario: "exploratory",\n  payload: {\n    thought: "分析性能下降的可能原因",\n    totalThoughts: 5,\n    nextThoughtNeeded: true\n  }\n})\n\`\`\`\n\n### 模式 3：执行思考规划\n\n\`\`\`javascript\nmcp_mcp-router_thinking_toolkit({\n  scenario: "execution",\n  payload: {\n    thought: "需要上线新版本",\n    plan: "1. 备份 2. 部署 3. 验证",\n    action: "先执行备份脚本",\n    thoughtNumber: "TP-001"\n  }\n})\n\`\`\`\n\n## 关键规则\n\n### ✅ 正确格式\n- 先发送 \`{"scenario": "..."}\` 获取场景说明\n- 根据说明确认参数要求后，再携带 payload 调用\n- scenario 必填：exploratory（顺序思考）或 execution（思考规划）\n- payload 根据场景填写对应字段\n\n### ❌ 常见错误\n- 不要跳过场景说明，直接携带 payload 调用（易导致参数错误）\n- 不要混用不同场景的参数字段\n- 不要在首次使用场景时直接执行 payload\n\n## 支持的思考场景\n\n### Exploratory（顺序思考）\n适合探索、诊断、发散推理场景，支持多轮思考追踪和分支管理。\n\n### Execution（思考规划）\n适合结构化计划制定和行动追踪，按步骤执行任务规划。\n\n更多场景正在开发中...`,
    //     inputSchema: thinkingToolkitInputSchema,
    //     handler: async (args) => handleThinkingToolkit(args)
    // }
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
