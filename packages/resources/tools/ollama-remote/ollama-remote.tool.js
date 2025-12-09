/**
 * Ollama Remote Tool - 远程 Ollama 服务器交互工具
 * 
 * 功能说明：
 * - 列出远程 Ollama 服务器上所有可用的模型
 * - 向远程 Ollama 服务器发送对话请求
 * 
 * 注意：此工具将在独立沙箱环境中运行
 * 需要配置 OLLAMA_BASE_URL 和可选的 OLLAMA_API_KEY 环境变量
 */

export default {
  /**
   * 获取工具依赖
   * 使用 Node.js 内置模块和 fetch API，无需额外依赖
   */
  getDependencies() {
    return {
      // 使用 Node.js 内置模块和全局 fetch，无需额外依赖
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'ollama-remote',
      name: 'Ollama Remote',
      description: '远程 Ollama 服务器交互工具，支持列出模型和发送对话请求',
      version: '1.0.0',
      category: 'ai',
      author: 'Prompt Manager',
      tags: ['ollama', 'ai', 'llm', 'remote', 'chat'],
      scenarios: [
        '列出远程 Ollama 服务器上的可用模型',
        '与远程 Ollama 模型进行对话',
        '使用自定义系统提示词进行对话',
        '调整模型温度参数'
      ],
      limitations: [
        '需要配置 OLLAMA_BASE_URL 环境变量',
        '需要确保网络可以访问远程 Ollama 服务器',
        '不支持流式响应（返回完整结果）',
        'API Key 通过 Bearer Token 方式传递'
      ]
    };
  },

  /**
   * 获取参数 Schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: '操作方法',
            enum: ['list_models', 'chat'],
            default: 'list_models'
          },
          // list_models 方法的参数
          only_remote: {
            type: 'boolean',
            description: '只显示云端模型信息（仅用于 list_models 方法）',
            default: false
          },
          // chat 方法的参数
          model: {
            type: 'string',
            description: '要使用的模型名称（chat 方法必需），例如 "llama3", "deepseek-coder"'
          },
          message: {
            type: 'string',
            description: '发送给模型的提示词或问题（chat 方法必需）'
          },
          system_prompt: {
            type: 'string',
            description: '可选的系统级指令（仅用于 chat 方法）'
          },
          temperature: {
            type: 'number',
            description: '模型温度，0-1之间（仅用于 chat 方法）',
            minimum: 0,
            maximum: 1,
            default: 0.7
          }
        },
        required: ['method']
      },
      environment: {
        type: 'object',
        properties: {
          OLLAMA_BASE_URL: {
            type: 'string',
            description: 'Ollama 服务器基础 URL，例如 http://localhost:11434',
            default: 'http://localhost:11434'
          },
          OLLAMA_API_KEY: {
            type: 'string',
            description: 'Ollama API 密钥（可选），用于 Bearer Token 认证',
            default: ''
          }
        },
        required: []
      }
    };
  },

  /**
   * 获取业务错误定义
   */
  getBusinessErrors() {
    return [
      {
        code: 'CONNECTION_FAILED',
        description: '连接远程 Ollama 服务器失败',
        match: /连接失败|Connection Failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
        solution: '请检查 OLLAMA_BASE_URL 配置和网络连接',
        retryable: true
      },
      {
        code: 'API_ERROR',
        description: 'Ollama API 返回错误',
        match: /Error: Ollama API responded with status/i,
        solution: '请检查 API 密钥和服务器状态',
        retryable: true
      },
      {
        code: 'INVALID_RESPONSE',
        description: '无效的 API 响应',
        match: /无效的响应|Invalid response|No content returned/i,
        solution: '请检查服务器响应格式是否正确',
        retryable: true
      },
      {
        code: 'MISSING_PARAMETER',
        description: '缺少必需参数',
        match: /缺少必需参数|Missing required parameter/i,
        solution: '请检查方法参数是否完整',
        retryable: false
      },
      {
        code: 'NO_MODELS_AVAILABLE',
        description: '没有可用的模型',
        match: /当前 Ollama 服务器上没有可用的模型/i,
        solution: '请先在 Ollama 服务器上下载模型（使用 ollama pull <模型名>）',
        retryable: false
      }
    ];
  },

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  /**
   * 获取 Ollama 基础 URL
   */
  getOllamaBaseUrl() {
    const { api } = this;
    const baseUrl = api.environment.get('OLLAMA_BASE_URL') || 'http://localhost:11434';
    // 移除末尾的斜杠
    return baseUrl.replace(/\/$/, '');
  },

  /**
   * 获取 Ollama API Key
   */
  getOllamaApiKey() {
    const { api } = this;
    return api.environment.get('OLLAMA_API_KEY') || '';
  },

  /**
   * 构建请求头
   */
  buildHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const apiKey = this.getOllamaApiKey();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  },

  /**
   * 列出 Ollama 模型
   */
  async listModels(params) {
    const { api } = this;

    api?.logger?.info('开始列出 Ollama 模型', {
      only_remote: params.only_remote || false
    });

    try {
      const baseUrl = this.getOllamaBaseUrl();
      const url = `${baseUrl}/api/tags`;
      const headers = this.buildHeaders();

      api?.logger?.debug('请求 URL', { url });

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama API responded with status ${response.status}: ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      const models = data.models || [];

      if (models.length === 0) {
        return {
          success: true,
          message: '当前 Ollama 服务器上没有可用的模型。\n\n您可以通过以下方式获取模型：\n1. 本地模型：使用 `ollama pull <模型名>` 下载模型\n2. 云端模型：配置 Ollama Cloud 账户或代理服务',
          models: [],
          total: 0
        };
      }

      // 格式化模型列表
      const modelList = models.map((model) => {
        const name = model.name;
        const size = model.size;
        const modifiedAt = model.modified_at;

        // 检测是否为云端模型（一般云端模型会有特定的命名模式）
        const isRemoteModel = name.includes('cloud') ||
          name.includes('online') ||
          name.includes('api') ||
          name.includes('remote') ||
          (name.includes('llama3') && !name.includes(':'));

        return {
          name,
          size: this.formatSize(size),
          sizeBytes: size,
          modifiedAt,
          isRemoteModel
        };
      });

      // 如果只显示云端模型，过滤结果
      const filteredModels = params.only_remote
        ? modelList.filter(model => model.isRemoteModel)
        : modelList;

      const displayModels = filteredModels.length > 0 ? filteredModels : modelList;

      api?.logger?.info('模型列表获取成功', {
        total: models.length,
        displayed: displayModels.length,
        only_remote: params.only_remote || false
      });

      return {
        success: true,
        total: models.length,
        displayed: displayModels.length,
        only_remote: params.only_remote || false,
        models: displayModels.map((model, index) => ({
          index: index + 1,
          name: model.name,
          size: model.size,
          modifiedAt: model.modifiedAt,
          type: model.isRemoteModel ? '☁️ 云端' : '💾 本地'
        }))
      };

    } catch (error) {
      api?.logger?.error('列出模型失败', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },

  /**
   * 与 Ollama 对话
   */
  async chat(params) {
    const { api } = this;

    // 验证必需参数
    if (!params.model) {
      throw new Error('缺少必需参数: model');
    }
    if (!params.message) {
      throw new Error('缺少必需参数: message');
    }

    api?.logger?.info('开始与 Ollama 对话', {
      model: params.model,
      hasSystemPrompt: !!params.system_prompt,
      temperature: params.temperature || 0.7
    });

    try {
      const baseUrl = this.getOllamaBaseUrl();
      const url = `${baseUrl}/v1/chat/completions`;
      const headers = this.buildHeaders();

      // 构建请求体
      const body = {
        model: params.model,
        messages: [
          ...(params.system_prompt ? [{ role: 'system', content: params.system_prompt }] : []),
          { role: 'user', content: params.message }
        ],
        stream: false, // MCP 工具通常需要一次性返回结果，关闭流式传输
        options: {
          temperature: params.temperature || 0.7
        }
      };

      api?.logger?.debug('请求配置', {
        url,
        model: params.model,
        messageLength: params.message.length,
        hasSystemPrompt: !!params.system_prompt
      });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Ollama API responded with status ${response.status}: ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'No content returned';

      api?.logger?.info('对话成功', {
        model: params.model,
        replyLength: reply.length
      });

      return {
        success: true,
        model: params.model,
        reply: reply,
        usage: data.usage || null,
        finishReason: data.choices?.[0]?.finish_reason || null
      };

    } catch (error) {
      api?.logger?.error('对话失败', {
        error: error.message,
        stack: error.stack,
        model: params.model
      });
      throw error;
    }
  },

  /**
   * 执行工具
   */
  async execute(params) {
    const { api } = this;

    // 记录执行开始
    api?.logger?.info('执行开始', {
      tool: this.__toolName,
      method: params.method,
      params: Object.keys(params)
    });

    try {
      // 参数验证
      if (!params.method) {
        throw new Error('缺少必需参数: method');
      }

      // 根据方法执行相应操作
      switch (params.method) {
        case 'list_models':
          return await this.listModels(params);

        case 'chat':
          return await this.chat(params);

        default:
          throw new Error(`不支持的方法: ${params.method}`);
      }

    } catch (error) {
      // 错误处理和日志记录
      api?.logger?.error('执行失败', {
        error: error.message,
        stack: error.stack,
        method: params.method
      });
      throw error;
    }
  }
};

