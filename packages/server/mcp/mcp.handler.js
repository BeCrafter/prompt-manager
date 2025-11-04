// 导入自定义模块
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { util } from '../utils/util.js';

// 处理 get_prompt 工具调用
export async function handleGetPrompt(args) {
  // 注意：这里为了兼容性，我们同时支持prompt_id和name参数
  const promptId = args.prompt_id || args.name;
  
  if (!promptId) {
    throw new Error("缺少必需参数: prompt_id");
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
  }, 'detail');
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
    }, 'list');
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

  return convertToText(result, 'list');
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
 * 处理列表格式输出
 * @param {*} result 
 * @returns 
 */
function formatListOutput(result) {
  // 生成当前时间戳
  const now = new Date();
  const formattedDate = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  // 构建新的输出格式
  let output = "";
  output += "[PROMPT_HEADER_AREA]\n";
  output += "🎭 **PromptManager 提示词清单**\n";
  output += `📅 ${formattedDate}\n\n`;
  output += "--------------------------------------------------\n";
  output += "[PROMPT_LIST_AREA]\n\n";
  output += `📦 **提示词列表** (${result.count}个)\n`;
  
  // 添加提示词列表
  if (result.results && Array.isArray(result.results) && result.results.length > 0) {
    result.results.forEach(prompt => {
      output += `- [${prompt.id}] ${prompt.name}\n`;
      output += `  - ${prompt.description}\n`;
    });
  } else {
    output += "(无提示词)\n";
  }
  
  output += "\n--------------------------------------------------\n";
  output += "[STATE_AREA]\n";
  output += "📍 **当前状态**：prompts_completed\n";
  
  // 返回格式化文本
  return output;
}

/**
 * 处理详情格式输出
 * @param {*} result 
 * @returns string
 */
function formatDetailOutput(result) {
  const prompt = result.prompt;
  
  // 生成当前时间戳
  const now = new Date();
  const formattedDate = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  // 构建新的输出格式
  let output = "";
  output += "--------------------------------------------------\n";
  output += "[PROMPT_HEADER_AREA]\n";
  output += `- id: ${prompt.id}\n`;
  output += `- name: ${prompt.name}\n`;
  output += `- description: ${prompt.description}\n`;
  output += `- filepath: ${prompt.filePath}\n\n`;
  output += "--------------------------------------------------\n";
  output += "[PROMPT_PARAMS_AREA]\n";
  
  // 添加参数信息
  if (prompt.arguments && Array.isArray(prompt.arguments) && prompt.arguments.length > 0) {
    prompt.arguments.forEach(param => {
      const requiredText = param.required ? "必填" : "非必填";
      output += `- ${param.name}: ${param.type}; ${requiredText}; ${param.description}\n`;
    });
  } else {
    output += "(无参数)\n";
  }
  
  output += "\n--------------------------------------------------\n";
  output += "[PROMPT_CONTENT_AREA]\n";
  
  // 添加消息内容
  if (prompt.messages && Array.isArray(prompt.messages)) {
    const userMessages = prompt.messages.filter(msg => msg.role === "user");
    if (userMessages.length > 0 && userMessages[0].content && userMessages[0].content.text) {
      output += userMessages[0].content.text + "\n";
    }
  }
  
  output += "\n[STATE_AREA]\n";
  output += "📍 **当前状态**：prompt_loaded\n";
  
  return output;
}

/**
 * 将对象转换为格式化的text类型输出
 * @param {*} result 
 * @param {string} format - 输出格式类型: 'list' 或 'detail'
 * @returns 
 */
function convertToText(result, format) {
  let ret = ""
  switch (format) {
    case 'list':
      ret = formatListOutput(result);
      break;
    case 'detail':
      ret = formatDetailOutput(result);
      break;
    default:
      ret =JSON.stringify(result, null, 2);
  }
  return {
    content: [
      {
        type: "text",
        text: ret
      }
    ]
  };
}
