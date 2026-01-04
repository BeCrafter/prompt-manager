import { templateManager } from './template.service.js';
import { modelManager } from './model.service.js';
import { logger } from '../utils/logger.js';

/**
 * 优化服务类
 */
class OptimizationService {
  constructor() {
    this.sessionIterations = new Map(); // 会话级迭代追踪
  }

  /**
   * 优化提示词（支持流式）
   * @param {string} prompt - 原始提示词
   * @param {string} templateId - 模板ID
   * @param {string} modelId - 模型ID
   * @param {Function} onChunk - 流式输出回调函数
   * @param {string} sessionId - 会话ID（用于迭代优化）
   * @returns {Promise<Object>} 优化结果
   */
  async optimizePrompt(prompt, templateId, modelId, onChunk, sessionId = null) {
    try {
      // 1. 加载模板
      let template = templateManager.getTemplate(templateId);
      if (!template) {
        // 尝试获取第一个系统优化模板
        template = templateManager.getTemplates().find(t => (t.type || 'optimize') === 'optimize');
      }
      
      if (!template) {
        throw new Error(`未找到可用模板: ${templateId}`);
      }

      // 2. 加载模型配置
      const model = modelManager.getModel(modelId);
      if (!model) {
        throw new Error(`模型不存在: ${modelId}`);
      }

      // 检查模型是否启用
      if (model.enabled !== true) {
        throw new Error(`模型未启用: ${model.name}`);
      }

      // 检查 API Key
      if (!model.apiKey) {
        throw new Error(`模型 ${model.name} 的 API Key 未配置`);
      }

      // 3. 构建优化消息列表
      const messages = this.buildMessages(prompt, template);

      logger.info(`开始优化提示词，使用模板: ${template.name}，模型: ${model.name}`);

      // 4. 调用 AI API（流式）
      const result = await this.callAIModel(messages, model, onChunk);

      // 5. 如果提供了 sessionId，记录迭代信息
      if (sessionId) {
        this.sessionIterations.set(sessionId, {
          count: 1,
          originalPrompt: prompt, // 记录原始提示词
          lastResult: result,
          lastTemplateId: templateId,
          lastModelId: modelId
        });
      }

      return result;
    } catch (error) {
      logger.error('优化提示词失败:', error);
      throw error;
    }
  }

  /**
   * 迭代优化（在当前结果基础上继续优化）
   * @param {string} currentResult - 当前优化结果
   * @param {string} templateId - 模板ID
   * @param {string} modelId - 模型ID
   * @param {Function} onChunk - 流式输出回调函数
   * @param {string} sessionId - 会话ID
   * @param {string} guideText - 优化指导（可选）
   * @returns {Promise<Object>} 优化结果
   */
  async iterateOptimization(currentResult, templateId, modelId, onChunk, sessionId, guideText = '') {
    try {
      // 检查会话是否存在
      const session = this.sessionIterations.get(sessionId);
      if (!session) {
        throw new Error('会话不存在，请先进行初始优化');
      }

      // 检查迭代次数限制（最多 10 次）
      if (session.count >= 10) {
        throw new Error('已达到最大迭代次数（10次）');
      }

      // 1. 加载模板
      let template = templateManager.getTemplate(templateId);
      if (!template) {
        // 尝试获取第一个迭代优化模板
        template = templateManager.getTemplates().find(t => t.type === 'iterate');
      }

      if (!template) {
        // 回退到简单迭代逻辑（如果没有迭代模板）
        template = {
          name: '默认迭代',
          format: 'simple',
          type: 'iterate',
          content: '{{prompt}}'
        };
      }

      // 2. 加载模型配置
      const model = modelManager.getModel(modelId);
      if (!model) {
        throw new Error(`模型不存在: ${modelId}`);
      }

      // 检查模型是否启用
      if (model.enabled !== true) {
        throw new Error(`模型未启用: ${model.name}`);
      }

      // 检查 API Key
      if (!model.apiKey) {
        throw new Error(`模型 ${model.name} 的 API Key 未配置`);
      }

      // 3. 构建迭代优化消息列表
      const messages = this.buildIterationMessages(
        currentResult, 
        session.lastResult,
        template, 
        session.count, 
        guideText,
        session.originalPrompt // 传入原始提示词
      );

      logger.info(`开始迭代优化（第 ${session.count + 1} 次），使用模板: ${template.name}，模型: ${model.name}${guideText ? '，有优化指导' : ''}`);

      // 4. 调用 AI API（流式）
      const result = await this.callAIModel(messages, model, onChunk);

      // 5. 更新会话信息
      this.sessionIterations.set(sessionId, {
        ...session, // 保留 originalPrompt 等信息
        count: session.count + 1,
        lastResult: result,
        lastTemplateId: templateId,
        lastModelId: modelId
      });

      return result;
    } catch (error) {
      logger.error('迭代优化失败:', error);
      throw error;
    }
  }

  /**
   * 替换提示词内容中的变量
   * @param {string} content - 提示词内容
   * @param {Object} variables - 变量映射
   * @returns {string} 替换后的内容
   */
  replaceVariables(content, variables) {
    if (!content || typeof content !== 'string') return content;
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      // 允许使用 {{key}} 或 {{ key }} 格式
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(placeholder, String(value ?? ''));
    }
    return result;
  }

  /**
   * 构建消息列表
   * @param {string} prompt - 原始提示词
   * @param {Object} template - 模板对象
   * @returns {Array} 消息列表
   */
  buildMessages(prompt, template) {
    if (template.format === 'advanced' && Array.isArray(template.content)) {
      const variables = { 
        originalPrompt: prompt,
        prompt: prompt, // 兼容旧模板
        input: prompt   // 兼容旧模板
      };
      return template.content.map(msg => ({
        role: msg.role,
        content: this.replaceVariables(msg.content, variables)
      }));
    }

    // 简单模板处理
    const variables = { prompt };
    let content = template.content;
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    // 如果模板中没有包含变量占位符，则自动追加
    if (!content.includes('{{prompt}}') && !content.includes('{{input}}')) {
      content += '\n\n请优化以下提示词：\n\n{{prompt}}';
    }

    return [
      {
        role: 'user',
        content: this.replaceVariables(content, variables)
      }
    ];
  }

  /**
   * 构建迭代消息列表
   * @param {string} currentInput - 当前输入（界面上展示的待迭代内容）
   * @param {string} previousResult - 上一次结果（会话记录）
   * @param {Object} template - 模板对象
   * @param {number} iterationCount - 迭代次数
   * @param {string} guideText - 指导文字
   * @param {string} originalPrompt - 最初的原始提示词
   * @returns {Array} 消息列表
   */
  buildIterationMessages(currentInput, previousResult, template, iterationCount, guideText = '', originalPrompt = '') {
    if (template.format === 'advanced' && Array.isArray(template.content)) {
      const variables = {
        originalPrompt: originalPrompt || '',
        lastOptimizedPrompt: currentInput, // 当前界面显示的结果即为“上一次优化结果”
        iterateInput: guideText || '',
        // 兼容别名
        prompt: currentInput,
        previousResult: previousResult || currentInput,
        iterationCount: iterationCount + 1,
        guideText: guideText || ''
      };
      
      return template.content.map(msg => ({
        role: msg.role,
        content: this.replaceVariables(msg.content, variables)
      }));
    }

    // 简单模板逻辑保持简单
    const variables = {
      prompt: currentInput,
      previousResult: previousResult || currentInput,
      iterationCount: iterationCount + 1,
      guideText: guideText || ''
    };

    let content = template.content;
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    // 构建默认迭代上下文（如果模板是简单的且没有包含占位符）
    let finalContent = '';
    
    // 如果没有使用任何变量占位符，执行默认拼接逻辑
    const hasVariables = ['{{prompt}}', '{{previousResult}}', '{{guideText}}']
      .some(v => content.includes(v));

    if (!hasVariables) {
      if (!content.includes('{{previousResult}}')) {
        finalContent += `这是第 ${variables.iterationCount} 次优化。上一次的优化结果如下：\n\n${variables.previousResult}\n\n`;
      }
      
      if (guideText && !content.includes('{{guideText}}')) {
        finalContent += `本次优化的具体要求：\n${guideText}\n\n`;
      }

      finalContent += `请基于以上上下文，继续优化以下内容：\n\n{{prompt}}`;
    } else {
      finalContent = content;
    }

    return [
      {
        role: 'user',
        content: this.replaceVariables(finalContent, variables)
      }
    ];
  }

  /**
   * 调用 AI 模型（支持流式）
   * @param {Array} messages - 消息列表
   * @param {Object} model - 模型配置
   * @param {Function} onChunk - 流式输出回调函数
   * @returns {Promise<string>} 完整的响应内容
   */
  async callAIModel(messages, model, onChunk) {
    try {
      // 记录请求日志
      logger.info(`[AI Request] 模型: ${model.name}, 消息数: ${messages.length}`);
      messages.forEach((msg, i) => {
        logger.debug(`[Message ${i}] Role: ${msg.role}, Content: ${msg.content.substring(0, 1000)}${msg.content.length > 1000 ? '...' : ''}`);
      });
      
      // 构建 API 请求
      const requestBody = {
        model: model.model,
        messages,
        stream: true
      };

      const headers = {
        'Content-Type': 'application/json',
      }
      if (model.apiKey) {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      }

      // 发起请求
      const response = await fetch(model.apiEndpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.message) {
            errorDetail = errorJson.error.message;
          } else if (errorJson.message) {
            errorDetail = errorJson.message;
          }
        } catch (e) {
          // 如果不是 JSON，限制长度
          if (errorDetail.length > 200) {
            errorDetail = errorDetail.substring(0, 200) + '...';
          }
        }
        throw new Error(`API 请求失败 (${response.status} ${response.statusText}): ${errorDetail}`);
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // 解码数据
        const chunk = decoder.decode(value, { stream: true });

        // 解析 SSE 格式数据
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              // 提取内容
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                const content = parsed.choices[0].delta.content;

                if (content) {
                  fullContent += content;

                  // 调用回调函数
                  if (onChunk) {
                    onChunk(content);
                  }
                }
              }
            } catch (error) {
              // logger.warn('解析 SSE 数据失败:', error.message);
            }
          }
        }
      }

      logger.info(`AI 模型调用完成，返回 ${fullContent.length} 个字符`);
      logger.debug(`[AI Response] Content: ${fullContent.substring(0, 5000)}${fullContent.length > 5000 ? '...' : ''}`);
      return fullContent;
    } catch (error) {
      logger.error('调用 AI 模型失败:', error);
      throw error;
    }
  }

  /**
   * 清除会话迭代信息
   * @param {string} sessionId - 会话ID
   */
  clearSession(sessionId) {
    this.sessionIterations.delete(sessionId);
    logger.debug(`清除会话迭代信息: ${sessionId}`);
  }

  /**
   * 获取会话迭代信息
   * @param {string} sessionId - 会话ID
   * @returns {Object|null} 会话信息
   */
  getSessionInfo(sessionId) {
    return this.sessionIterations.get(sessionId) || null;
  }

  /**
   * 测试模型连接
   * @param {string} modelId - 模型ID
   * @returns {Promise<Object>} 测试结果
   */
  async testModel(modelId) {
    try {
      const model = modelManager.getModel(modelId);
      if (!model) {
        throw new Error(`模型不存在: ${modelId}`);
      }

      // 发送一个简单的测试请求
      const messages = [{ role: 'user', content: '请回复"测试成功"' }];
      const result = await this.callAIModel(messages, model, null);

      return {
        success: true,
        message: '模型连接测试成功',
        response: result
      };
    } catch (error) {
      return {
        success: false,
        message: `模型连接测试失败: ${error.message}`,
        error: error.message
      };
    }
  }
}

// 创建全局OptimizationService实例
export const optimizationService = new OptimizationService();

// 导出OptimizationService类供测试使用
export { OptimizationService };