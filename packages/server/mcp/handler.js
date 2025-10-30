// 导入自定义模块
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { PromptDTO } from './dto/PromptDTO.js';
import { SearchResultDTO } from './dto/SearchResultDTO.js';
import { SimilarityService } from './services/SimilarityService.js';
import { ErrorHandler } from './services/ErrorHandler.js';
import { ValidationError, ResourceNotFoundError } from './errors/McpErrors.js';

// 延迟获取promptManager以避免循环依赖
let _promptManager;

async function getPromptManager() {
  if (!_promptManager) {
    const serverModule = await import('../../server/server.js');
    _promptManager = serverModule.promptManager;
  }
  return _promptManager;
}

// 处理 get_prompt 工具调用
export async function handleGetPrompt(args) {
  try {
    // 注意：这里为了兼容性，我们同时支持prompt_id和name参数
    const promptId = args.prompt_id || args.name;
    
    if (!promptId) {
      throw new ValidationError("缺少必需参数: prompt_id 或 name");
    }
    
    const promptManager = await getPromptManager();
    const prompt = promptManager.getPrompt(promptId);
    if (!prompt) {
      throw new ResourceNotFoundError("Prompt", promptId);
    }
    
    // 使用DTO封装返回数据
    const promptDTO = PromptDTO.fromPrompt(prompt);
    
    // 根据日志级别决定是否添加元数据
    if (config.getLogLevel() === 'debug') {
      promptDTO.metadata = {
        uniqueId: prompt.uniqueId,
        fileName: prompt.fileName,
        fullPath: prompt.filePath,
      };
    }

    return convertToText({
      success: true,
      prompt: promptDTO
    });
  } catch (error) {
    return ErrorHandler.handleToolError(error, 'get_prompt', args);
  }
}

// 处理 search_prompts 工具调用
export async function handleSearchPrompts(args) {
  try {
    // 注意：这里为了兼容性，我们同时支持title和name参数
    const searchTerm = args.title || args.name;
    
    const logLevel = config.getLogLevel();
    const promptManager = await getPromptManager();
    const allPrompts = promptManager.getPrompts();

    // 如果搜索词为空，则返回所有提示词
    if (!searchTerm) {
      const simplifiedPrompts = formatResults(allPrompts);
      const resultDTO = SearchResultDTO.create(searchTerm, simplifiedPrompts);
      return convertToText(resultDTO);
    }
    
    // 实现相似度匹配算法
    const searchResults = allPrompts
      .map(prompt => {
        prompt.description = prompt.description || `Prompt: ${prompt.name}`;
        prompt.arguments = prompt.arguments || [];
        return {
          prompt: prompt,
          score: SimilarityService.calculateSimilarityScore(searchTerm, prompt),
        };
      })
      .filter(result => result.score > 0) // 只返回有匹配的结果
      .sort((a, b) => b.score - a.score); // 按相似度得分降序排列
    
    const formattedResults = formatResults(searchResults);
    const resultDTO = SearchResultDTO.create(searchTerm, formattedResults);
    
    // 添加调试信息
    if (logLevel === 'debug') {
      resultDTO.debug = {
        scores: searchResults.map(result => ({
          id: result.prompt.id,
          name: result.prompt.name,
          score: result.score,
          fullPath: result.prompt.filePath,
        }))
      };
    }

    return convertToText(resultDTO);
  } catch (error) {
    return ErrorHandler.handleToolError(error, 'search_prompts', args);
  }
}

/**
 * 处理 reload_prompts 工具调用
 */
export async function handleReloadPrompts(args) {
  try {
    logger.info('重新加载prompts...');
    
    const promptManager = await getPromptManager();
    const result = await promptManager.reloadPrompts();
    
    // 格式化结果
    const formattedPrompts = formatResults(result.prompts);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `重新加载完成: 成功 ${result.success} 个, 失败 ${result.errorCount} 个`,
            result: formattedPrompts
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return ErrorHandler.handleToolError(error, 'reload_prompts', args);
  }
}

/**
 * 格式化搜索结果
 * @param {*} results 
 * @returns 
 */
function formatResults(results = []) {
  if (!Array.isArray(results)) return [];

  return results.map(result => {
    const prompt = result.prompt ? result.prompt : result;
    const baseItem = {
      id: prompt.id || prompt.uniqueId || '',
      name: prompt.name || 'Unnamed Prompt',
      description: prompt.description || `Prompt: ${prompt.name || 'Unnamed'}`
    };

    if (config.getLogLevel() === 'debug') {
      return {
        ...baseItem,
        metadata: {
          fullPath: prompt.filePath || ''
        }
      };
    }
    return baseItem;
  });
}

/**
 * 将对象转换为text类型
 * @param {*} object 
 * @returns 
 */
function convertToText(result) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}