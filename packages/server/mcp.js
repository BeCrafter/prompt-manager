// 导入自定义模块
import { config } from './config.js';
import { logger } from './logger.js';

// 处理 get_prompt 工具调用
export async function handleGetPrompt(args, promptManager) {
  // 注意：这里为了兼容性，我们同时支持prompt_id和name参数
  const promptId = args.prompt_id || args.name;
  
  if (!promptId) {
    throw new Error("缺少必需参数: prompt_id 或 name");
  }
  
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
export async function handleSearchPrompts(args, promptManager) {
  // 注意：这里为了兼容性，我们同时支持title和name参数
  const searchTerm = args.title || args.name;
  
  const logLevel = config.getLogLevel();
  const allPrompts = promptManager.getPrompts();

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
      score: calculateSimilarityScore(searchTerm, prompt),
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
export async function handleReloadPrompts(promptManager) {
  logger.info('重新加载prompts...');
  
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

  // console.log(results);

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

/**
 * 计算搜索关键词与prompt的相似度得分
 * @param {string} searchTerm - 搜索关键词
 * @param {Object} prompt - prompt对象
 * @returns {number} 相似度得分 (0-100)
 */
function calculateSimilarityScore(searchTerm, prompt) {
  let totalScore = 0;
  const searchLower = searchTerm ? searchTerm.toLowerCase() : '';
  
  // 搜索字段权重配置（专注于内容搜索，不包含ID检索）
  const fieldWeights = {
    name: 60,         // 名称权重高，是主要匹配字段
    description: 40   // 描述权重适中，是辅助匹配字段
  };
  
  // 计算name匹配得分
  if (prompt && prompt.name && typeof prompt.name === 'string') {
    const nameScore = getStringMatchScore(searchLower, prompt.name.toLowerCase());
    totalScore += nameScore * fieldWeights.name;
  }
  
  // 计算description匹配得分
  if (prompt.description) {
    const descScore = getStringMatchScore(searchLower, prompt.description.toLowerCase());
    totalScore += descScore * fieldWeights.description;
  }
  
  // 标准化得分到0-100范围
  const maxPossibleScore = Object.values(fieldWeights).reduce((sum, weight) => sum + weight, 0);
  return Math.round((totalScore / maxPossibleScore) * 100);
}

/**
 * 计算两个字符串的匹配得分
 * @param {string} search - 搜索词 (已转小写)
 * @param {string} target - 目标字符串 (已转小写)
 * @returns {number} 匹配得分 (0-1)
 */
function getStringMatchScore(search, target) {
  if (!search || !target) return 0;
  
  // 完全匹配得分最高
  if (target === search) return 1.0;
  
  // 完全包含得分较高
  if (target.includes(search)) return 0.8;
  
  // 部分词匹配
  const searchWords = search.split(/\s+/).filter(word => word.length > 0);
  const targetWords = target.split(/\s+/).filter(word => word.length > 0);
  
  let matchedWords = 0;
  for (const searchWord of searchWords) {
    for (const targetWord of targetWords) {
      if (targetWord.includes(searchWord) || searchWord.includes(targetWord)) {
        matchedWords++;
        break;
      }
    }
  }
  
  if (searchWords.length > 0) {
    const wordMatchRatio = matchedWords / searchWords.length;
    return wordMatchRatio * 0.6; // 部分词匹配得分
  }
  
  return 0;
}