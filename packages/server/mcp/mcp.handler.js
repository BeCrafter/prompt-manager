// 导入自定义模块
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { util } from '../utils/util.js';

// 处理 get_prompt 工具调用
export async function handleGetPrompt(args) {
  // 注意：这里为了兼容性，我们同时支持prompt_id和name参数
  const promptId = args.prompt_id || args.name;
  
  if (!promptId) {
    throw new Error("缺少必需参数: prompt_id 或 name");
  }
  
  const promptManager = await util.getPromptManager();
  const prompt = promptManager.getPrompt(promptId);
  if (!prompt) {
    throw new Error(`未找到ID为 "${promptId}" 的prompt`);
  }
  
  // 返回完整的prompt信息
  const promptInfo = {
    id: prompt.uniqueId,        // 使用基于文件路径的唯一ID
    name: prompt.name,
    description: prompt.description || `Prompt: ${prompt.name}`,
    messages: prompt.messages || [],
    arguments: prompt.arguments || [],
    filePath: prompt.relativePath,  // 添加文件路径信息
  };

  if (config.getLogLevel() === 'debug') {
    promptInfo.metadata = {
      uniqueId: prompt.uniqueId,
      fileName: prompt.fileName,
      fullPath: prompt.filePath,
    };
  }

  return convertToText({
    success: true,
    prompt: promptInfo
  });
}

// 处理 search_prompts 工具调用
export async function handleSearchPrompts(args) {
  // 注意：这里为了兼容性，我们同时支持title和name参数
  const searchTerm = args.title || args.name;
  
  const logLevel = config.getLogLevel();
  const promptManager = await util.getPromptManager();
  let allPrompts = (await promptManager.loadPrompts()).prompts || [];

  // 如果搜索词为空，则返回所有提示词
  if (!searchTerm) {
    let simplifiedPrompts = formatResults(allPrompts);

    return convertToText({
      success: true,
      query: searchTerm || '',
      count: simplifiedPrompts.length,
      results: simplifiedPrompts
    });
  }
  
  // 实现相似度匹配算法
  const searchResults = allPrompts.map(prompt => {
    prompt.description = prompt.description || `Prompt: ${prompt.name}`;
    prompt.arguments = prompt.arguments || [];
    prompt.hasArguments = prompt.arguments && prompt.arguments.length > 0;
    return {
      prompt: prompt,
      score: util.calculateSimilarityScore(searchTerm, prompt),
    };
  })
  .filter(result => result.score > 0) // 只返回有匹配的结果
  .sort((a, b) => b.score - a.score); // 按相似度得分降序排列
  

  let result = {
    success: true,
    query: searchTerm || '',
    count: searchResults.length,
    results: formatResults(searchResults),
  }

  if (logLevel === 'debug') {
    result.debug = {
      scores: searchResults.map(result => ({
        id: result.prompt.id,
        name: result.prompt.name,
        score: result.score,
        fullPath: result.prompt.filePath,
      }))
    }
  }

  return convertToText(result);
}

/**
 * 处理 reload_prompts 工具调用
 */
export async function handleReloadPrompts(args) {
  logger.info('重新加载prompts...');
  
  const promptManager = await util.getPromptManager();
  const result = await promptManager.reloadPrompts();
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          message: `重新加载完成: 成功 ${result.success} 个, 失败 ${result.errorCount} 个`,
          result: formatResults(result.prompts)
        }, null, 2)
      }
    ]
  };
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