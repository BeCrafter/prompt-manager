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
      const template = templateManager.getTemplate(templateId);
      if (!template) {
        throw new Error(`模板不存在: ${templateId}`);
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

      // 3. 构建优化提示词
      const optimizationPrompt = this.buildOptimizationPrompt(prompt, template);

      logger.info(`开始优化提示词，使用模板: ${template.name}，模型: ${model.name}`);

      // 4. 调用 AI API（流式）
      const result = await this.callAIModel(optimizationPrompt, model, onChunk);

      // 5. 如果提供了 sessionId，记录迭代信息
      if (sessionId) {
        this.sessionIterations.set(sessionId, {
          count: 1,
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
      const template = templateManager.getTemplate(templateId);
      if (!template) {
        throw new Error(`模板不存在: ${templateId}`);
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

      // 3. 构建迭代优化提示词
      const iterationPrompt = this.buildIterationPrompt(currentResult, session.lastResult, template, session.count, guideText);

      logger.info(`开始迭代优化（第 ${session.count + 1} 次），使用模板: ${template.name}，模型: ${model.name}${guideText ? '，有优化指导' : ''}`);

      // 4. 调用 AI API（流式）
      const result = await this.callAIModel(iterationPrompt, model, onChunk);

      // 5. 更新会话信息
      this.sessionIterations.set(sessionId, {
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
   * 构建优化提示词
   * @param {string} prompt - 原始提示词
   * @param {Object} template - 模板对象
   * @returns {string} 优化提示词
   */
  buildOptimizationPrompt(prompt, template) {
    // 将模板内容中的 {{prompt}} 占位符替换为实际提示词
    let optimizationPrompt = template.content;

    // 如果模板中没有 {{prompt}} 占位符，则追加到模板末尾
    if (!optimizationPrompt.includes('{{prompt}}')) {
      optimizationPrompt += '\n\n请优化以下提示词：\n\n{{prompt}}';
    }

    // 替换占位符
    optimizationPrompt = optimizationPrompt.replace(/{{prompt}}/g, prompt);

    return optimizationPrompt;
  }

  /**
   * 构建迭代优化提示词
   * @param {string} currentInput - 当前输入（用于本次优化的内容）
   * @param {string} previousResult - 上一次的优化结果
   * @param {Object} template - 模板对象
   * @param {number} iterationCount - 迭代次数
   * @param {string} guideText - 优化指导（可选）
   * @returns {string} 迭代优化提示词
   */
  buildIterationPrompt(currentInput, previousResult, template, iterationCount, guideText = '') {
    let iterationPrompt = template.content;

    // 构建上下文信息
    let context = `这是第 ${iterationCount + 1} 次优化。上一次的优化结果如下：\n\n${previousResult}\n\n`;

    // 如果有优化指导，添加到上下文中
    if (guideText && guideText.trim()) {
      context += `本次优化的具体要求：\n${guideText}\n\n`;
    }

    // 如果模板中没有 {{prompt}} 占位符，则追加到模板末尾
    if (!iterationPrompt.includes('{{prompt}}')) {
      iterationPrompt += '\n\n请基于以上上下文，继续优化以下内容：\n\n{{prompt}}';
    }

    // 替换占位符
    iterationPrompt = iterationPrompt.replace(/{{prompt}}/g, currentInput);

    // 在开头添加上下文
    return context + iterationPrompt;
  }

  /**
   * 调用 AI 模型（支持流式）
   * @param {string} prompt - 要发送的提示词
   * @param {Object} model - 模型配置
   * @param {Function} onChunk - 流式输出回调函数
   * @returns {Promise<string>} 完整的响应内容
   */
  async callAIModel(prompt, model, onChunk) {
    try {
      // 构建 API 请求
      const requestBody = {
        model: model.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true
      };

      // 发起请求
      const response = await fetch(model.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
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
              logger.warn('解析 SSE 数据失败:', error.message);
            }
          }
        }
      }

      logger.info(`AI 模型调用完成，返回 ${fullContent.length} 个字符`);
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
      const testPrompt = '请回复"测试成功"';
      const result = await this.callAIModel(testPrompt, model, null);

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