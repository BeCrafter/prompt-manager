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
    
    // 6. 返回格式化的结果
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: toolName,
            mode: 'execute',
            result: result
          }, null, 2)
        }
      ]
    };
    
  } catch (error) {
    logger.error(`工具执行失败: ${toolName}`, { error: error.message });
    
    // 获取工具对象
    const tool = toolLoaderService.getTool(toolName);
    
    // 检查是否是参数验证错误（需要返回帮助信息）
    const isValidationError = isValidationErrorType(error.message);
    
    if (isValidationError) {
      // 生成帮助信息并返回
      const helpInfo = generateHelpInfo(toolName, error, tool, parameters);
      return {
        content: [
          {
            type: "text",
            text: helpInfo
          }
        ]
      };
    }
    
    // 检查是否是业务错误
    const businessErrors = tool.businessErrors || [];
    
    for (const businessError of businessErrors) {
      if (businessError.match && businessError.match.test(error.message)) {
        // 业务错误也返回帮助信息
        const helpInfo = generateHelpInfo(toolName, error, tool, parameters, businessError);
        return {
          content: [
            {
              type: "text",
              text: helpInfo
            }
          ]
        };
      }
    }
    
    // 其他错误也返回帮助信息
    const helpInfo = generateHelpInfo(toolName, error, tool, parameters);
    return {
      content: [
        {
          type: "text",
          text: helpInfo
        }
      ]
    };
  }
}

/**
 * 判断是否是参数验证错误
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

