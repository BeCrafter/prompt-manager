/**
 * 工具执行服务
 *
 * 职责：
 * 1. 处理工具执行模式
 * 2. 创建执行上下文
 * 3. 执行工具并处理错误
 */

import { logger } from '../utils/logger.js';
import { toolLoaderService } from './tool-loader.service.js';
import { ensureToolDependencies } from './tool-dependency.service.js';
import { createToolContext } from './tool-context.service.js';
import { generateHelpInfo } from './tool-manual-generator.service.js';

/**
 * 执行工具
 * @param {string} toolName - 工具名称
 * @param {object} parameters - 工具参数
 * @returns {object} MCP 格式的返回结果
 */
export async function executeTool(toolName, parameters) {
  logger.info(`执行工具: ${toolName}`, { parameters });

  try {
    const tool = toolLoaderService.getTool(toolName);
    const toolModule = tool.module;

    // 1. 确保工具运行环境已初始化（创建 package.json 并安装依赖）
    await ensureToolDependencies(toolName, toolModule);

    // 2. 创建工具执行上下文
    const toolContext = await createToolContext(toolName, toolModule);

    // 3. 记录执行开始
    toolContext.api.logger.info('执行开始', {
      tool: toolName,
      parameters: Object.keys(parameters)
    });

    // 4. 执行工具（使用绑定后的execute方法）
    let result;
    try {
      result = await toolContext.execute(parameters);

      // 5. 记录执行完成
      toolContext.api.logger.info('执行完成', {
        tool: toolName,
        success: true
      });
    } catch (error) {
      // 记录执行错误
      toolContext.api.logger.error('执行失败', {
        tool: toolName,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }

    logger.info(`工具执行成功: ${toolName}`);

    // 6. 格式化并返回结果
    const content = formatToolResult(result, toolName);
    return { content };
  } catch (error) {
    logger.error(`工具执行失败: ${toolName}`, { error: error.message });

    const tool = toolLoaderService.getTool(toolName);
    const helpInfo = generateErrorHelpInfo(toolName, error, tool, parameters);

    return createTextResponse(helpInfo);
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化工具执行结果
 * 根据结果类型自动识别并转换为 MCP 格式的内容
 *
 * @param {any} result - 工具执行结果
 * @param {string} toolName - 工具名称
 * @returns {Array} MCP 格式的内容数组
 */
function formatToolResult(result, toolName) {
  const content = [];

  // 尝试提取图片数据
  const imageContent = extractImageContent(result);
  if (imageContent.length > 0) {
    content.push(...imageContent);

    // 对于截图操作，只返回图片
    if (result?.method === 'takeScreenshot') {
      logger.info('截图成功，返回图片数据');
      return content;
    }

    // 其他操作有图片时，添加文本信息
    if (result?.text) {
      content.push(createTextContent(result.text));
    } else if (result?.method) {
      content.push(createTextContent(`操作成功：${result.method}`));
    }

    return content;
  }

  // 处理 file-reader 工具的其他格式（二进制、媒体元信息等）
  if (result?.format && result?.content) {
    return [createJsonTextContent(result, toolName)];
  }

  // 默认情况：返回 JSON 格式
  return [createJsonTextContent(result, toolName)];
}

/**
 * 从工具结果中提取图片内容
 * 支持多种工具返回格式：
 * 1. chrome-devtools: result.images 数组
 * 2. filesystem: result.base64 + result.mimeType (图片类型)
 * 3. file-reader: result.format === 'image' + result.content.base64
 *
 * @param {any} result - 工具执行结果
 * @returns {Array} 图片内容数组
 */
function extractImageContent(result) {
  const images = [];

  if (!result) {
    return images;
  }

  // 情况1: chrome-devtools 工具返回的图片数组
  if (Array.isArray(result.images) && result.images.length > 0) {
    for (const image of result.images) {
      if (image?.data && image?.mimeType) {
        images.push(createImageContent(image.data, image.mimeType));
      }
    }
    return images;
  }

  // 情况2: filesystem 工具的 read_media_file 返回的 base64 + mimeType
  if (result.base64 && result.mimeType && result.mimeType.startsWith('image/')) {
    images.push(createImageContent(result.base64, result.mimeType));
    logger.info('读取图片文件成功，返回图片数据');
    return images;
  }

  // 情况3: file-reader 工具返回的图片格式
  if (result.format === 'image' && result.content?.base64 && result.content?.mimeType) {
    images.push(createImageContent(result.content.base64, result.content.mimeType));

    // 如果有描述信息，也一并返回
    if (result.content.description) {
      images.push(createTextContent(result.content.description));
    }
    logger.info('读取图片文件成功，返回图片数据');
    return images;
  }

  return images;
}

/**
 * 创建图片类型的内容
 *
 * @param {string} data - base64 编码的图片数据
 * @param {string} mimeType - 图片 MIME 类型
 * @returns {object} MCP 图片内容对象
 */
function createImageContent(data, mimeType) {
  return {
    type: 'image',
    data,
    mimeType
  };
}

/**
 * 创建文本类型的内容
 *
 * @param {string} text - 文本内容
 * @returns {object} MCP 文本内容对象
 */
function createTextContent(text) {
  return {
    type: 'text',
    text
  };
}

/**
 * 创建 JSON 格式的文本内容
 *
 * @param {any} result - 工具执行结果
 * @param {string} toolName - 工具名称
 * @returns {object} MCP 文本内容对象
 */
function createJsonTextContent(result, toolName) {
  return createTextContent(
    JSON.stringify(
      {
        success: true,
        tool: toolName,
        mode: 'execute',
        result
      },
      null,
      2
    )
  );
}

/**
 * 创建文本类型的响应
 *
 * @param {string} text - 文本内容
 * @returns {object} MCP 格式的响应对象
 */
function createTextResponse(text) {
  return {
    content: [createTextContent(text)]
  };
}

/**
 * 生成错误帮助信息
 *
 * @param {string} toolName - 工具名称
 * @param {Error} error - 错误对象
 * @param {object} tool - 工具对象
 * @param {object} parameters - 工具参数
 * @returns {string} 帮助信息文本
 */
function generateErrorHelpInfo(toolName, error, tool, parameters) {
  // 检查是否是参数验证错误
  if (isValidationErrorType(error.message)) {
    return generateHelpInfo(toolName, error, tool, parameters);
  }

  // 检查是否是业务错误
  const businessErrors = tool?.businessErrors || [];
  for (const businessError of businessErrors) {
    if (businessError.match?.test(error.message)) {
      return generateHelpInfo(toolName, error, tool, parameters, businessError);
    }
  }

  // 其他错误也返回帮助信息
  return generateHelpInfo(toolName, error, tool, parameters);
}

/**
 * 判断是否是参数验证错误
 *
 * @param {string} errorMessage - 错误消息
 * @returns {boolean} 是否是参数验证错误
 */
function isValidationErrorType(errorMessage) {
  const validationPatterns = [
    /不支持的方法/i,
    /缺少必需参数/i,
    /缺少参数/i,
    /参数.*必须是/i,
    /参数.*的值必须是/i,
    /无效的参数/i,
    /参数.*类型错误/i,
    /参数.*格式错误/i
  ];

  return validationPatterns.some(pattern => pattern.test(errorMessage));
}
