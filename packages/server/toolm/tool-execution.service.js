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
    
    // 检查是否是参数验证错误（需要返回帮助信息）
    const isValidationError = isValidationErrorType(error.message);
    
    if (isValidationError) {
      // 生成帮助信息并返回
      const helpInfo = generateHelpInfo(toolName, error, parameters);
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
    const tool = toolLoaderService.getTool(toolName);
    const businessErrors = tool.businessErrors || [];
    
    for (const businessError of businessErrors) {
      if (businessError.match && businessError.match.test(error.message)) {
        // 业务错误也返回帮助信息
        const helpInfo = generateHelpInfo(toolName, error, parameters, businessError);
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
    const helpInfo = generateHelpInfo(toolName, error, parameters);
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

/**
 * 生成帮助信息
 */
function generateHelpInfo(toolName, error, parameters = {}, businessError = null) {
  const tool = toolLoaderService.getTool(toolName);
  const { metadata, schema } = tool;
  
  let helpText = '';
  
  // 错误提示
  helpText += `# ⚠️ 工具执行错误\n\n`;
  helpText += `**工具**: ${metadata.name || toolName}\n\n`;
  helpText += `**错误信息**: ${error.message}\n\n`;
  
  if (businessError) {
    helpText += `**错误类型**: ${businessError.description}\n\n`;
    helpText += `**解决方案**: ${businessError.solution}\n\n`;
  }
  
  helpText += `---\n\n`;
  
  // 工具基本信息
  helpText += `## 📋 工具信息\n\n`;
  if (metadata.description) {
    helpText += `**描述**: ${metadata.description}\n\n`;
  }
  
  // 当前参数
  if (parameters && Object.keys(parameters).length > 0) {
    helpText += `## 📥 当前参数\n\n`;
    helpText += `\`\`\`json\n${JSON.stringify(parameters, null, 2)}\n\`\`\`\n\n`;
  }
  
  // 参数说明
  if (schema.parameters) {
    helpText += `## 📝 参数说明\n\n`;
    
    const props = schema.parameters.properties || {};
    const required = schema.parameters.required || [];
    
    // 必需参数
    if (required.length > 0) {
      helpText += `### ✅ 必需参数\n\n`;
      for (const key of required) {
        const prop = props[key];
        if (prop) {
          helpText += `- **${key}** (${prop.type || '未指定类型'})`;
          if (prop.enum) {
            helpText += ` - 可选值: ${prop.enum.join(', ')}`;
          }
          helpText += `\n`;
          if (prop.description) {
            helpText += `  ${prop.description}\n`;
          }
        }
      }
      helpText += `\n`;
    }
    
    // 可选参数
    const optional = Object.keys(props).filter(k => !required.includes(k));
    if (optional.length > 0) {
      helpText += `### 📌 可选参数\n\n`;
      for (const key of optional) {
        const prop = props[key];
        if (prop) {
          helpText += `- **${key}** (${prop.type || '未指定类型'})`;
          if (prop.default !== undefined) {
            helpText += ` - 默认值: ${prop.default}`;
          }
          if (prop.enum) {
            helpText += ` - 可选值: ${prop.enum.join(', ')}`;
          }
          helpText += `\n`;
          if (prop.description) {
            helpText += `  ${prop.description}\n`;
          }
        }
      }
      helpText += `\n`;
    }
  }
  
  // 使用示例
  helpText += `## 💡 使用示例\n\n`;
  
  // 根据错误类型生成不同的示例
  if (error.message.includes('不支持的方法')) {
    // 方法错误，显示所有支持的方法
    if (schema.parameters && schema.parameters.properties && schema.parameters.properties.method) {
      const methodEnum = schema.parameters.properties.method.enum || [];
      if (methodEnum.length > 0) {
        helpText += `### ❌ 错误：不支持的方法\n\n`;
        helpText += `**支持的方法列表**：\n\n`;
        methodEnum.forEach(method => {
          helpText += `- \`${method}\`\n`;
        });
        helpText += `\n`;
      }
    }
  }
  
  if (error.message.includes('缺少必需参数') || error.message.includes('缺少参数')) {
    // 提取缺失的参数名
    const missingMatch = error.message.match(/缺少.*参数[：:]\s*([^\n]+)/i);
    if (missingMatch) {
      const missingParams = missingMatch[1].split(',').map(p => p.trim());
      helpText += `### ❌ 错误：缺少必需参数\n\n`;
      helpText += `**缺失的参数**：${missingParams.join(', ')}\n\n`;
      helpText += `**这些参数是必需的，必须提供**\n\n`;
    }
  }
  
  // 生成正确的使用示例
  helpText += `### ✅ 正确使用方式\n\n`;
  helpText += `\`\`\`yaml\n`;
  helpText += `tool: tool://${toolName}\n`;
  helpText += `mode: execute\n`;
  helpText += `parameters:\n`;
  
  // 根据schema生成示例参数
  if (schema.parameters && schema.parameters.properties) {
    const props = schema.parameters.properties;
    const required = schema.parameters.required || [];
    
    // 先添加必需参数
    for (const key of required) {
      const prop = props[key];
      if (prop) {
        if (prop.enum && prop.enum.length > 0) {
          helpText += `  ${key}: ${prop.enum[0]}  # ${prop.description || ''}\n`;
        } else if (prop.type === 'string') {
          // 根据参数名提供更合适的示例值
          let exampleValue = "示例值";
          if (key.includes('path') || key.includes('url') || key.includes('file')) {
            exampleValue = key.includes('url') ? "https://example.com/file.txt" : "~/.prompt-manager/file.txt";
          } else if (key.includes('method')) {
            exampleValue = prop.enum ? prop.enum[0] : "method_name";
          }
          helpText += `  ${key}: "${exampleValue}"  # ${prop.description || ''}\n`;
        } else if (prop.type === 'number') {
          helpText += `  ${key}: 0  # ${prop.description || ''}\n`;
        } else if (prop.type === 'boolean') {
          helpText += `  ${key}: true  # ${prop.description || ''}\n`;
        } else if (prop.type === 'array') {
          helpText += `  ${key}: []  # ${prop.description || ''}\n`;
        } else if (prop.type === 'object') {
          helpText += `  ${key}: {}  # ${prop.description || ''}\n`;
        } else {
          helpText += `  ${key}: # ${prop.description || ''}\n`;
        }
      }
    }
    
    // 添加一些常用的可选参数（最多3个）
    const optional = Object.keys(props).filter(k => !required.includes(k));
    let shownOptional = 0;
    for (const key of optional) {
      if (shownOptional >= 3) break;
      const prop = props[key];
      if (prop) {
        if (prop.default !== undefined) {
          const defaultValue = typeof prop.default === 'string' ? `"${prop.default}"` : prop.default;
          helpText += `  # ${key}: ${defaultValue}  # ${prop.description || ''} (可选，默认值: ${prop.default})\n`;
          shownOptional++;
        } else if (prop.enum && prop.enum.length > 0) {
          helpText += `  # ${key}: ${prop.enum[0]}  # ${prop.description || ''} (可选)\n`;
          shownOptional++;
        }
      }
    }
  }
  
  helpText += `\`\`\`\n\n`;
  
  // 查看完整手册的提示
  helpText += `---\n\n`;
  helpText += `## 🔍 需要更多帮助？\n\n`;
  helpText += `使用以下命令查看完整的工具手册：\n\n`;
  helpText += `\`\`\`yaml\n`;
  helpText += `tool: tool://${toolName}\n`;
  helpText += `mode: manual\n`;
  helpText += `\`\`\`\n\n`;
  
  return helpText;
}

