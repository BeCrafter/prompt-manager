/**
 * 统一工具管理处理器
 * 
 * 职责：
 * 1. 实现 mcp__promptmanager__toolm 工具的处理逻辑
 * 2. 根据参数调用相应的工具和模式
 * 3. 管理工具的四种运行模式 (manual, execute, configure, log)
 * 4. 处理工具依赖安装和错误处理
 * 5. 与工具加载服务交互获取工具实例
 */

import YAML from 'yaml';
import { logger } from '../utils/logger.js';
import { toolLoaderService } from './tool-loader.service.js';

/**
 * 处理 toolm 工具调用
 * @param {object} args - 参数对象，包含 yaml 字段
 * @returns {object} MCP 格式的返回结果
 */
export async function handleToolM(args) {
  const { yaml: yamlInput } = args;
  
  if (!yamlInput) {
    throw new Error("缺少必需参数: yaml");
  }
  
  try {
    // 初始化工具加载器（如果尚未初始化）
    if (!toolLoaderService.initialized) {
      await toolLoaderService.initialize();
    }

    // Auto-correct common AI mistakes
    let yamlContent = yamlInput.trim();

    // Case 1: Just a plain URL string like "tool://filesystem" or "@tool://filesystem"
    if (yamlContent.match(/^@?tool:\/\/[\w-]+$/)) {
      const toolName = yamlContent.replace(/^@?tool:\/\//, '');
      yamlContent = `tool: tool://${toolName}\nmode: execute`;
    }

    // Case 2: Handle escaped backslashes and quotes: tool: \"@tool://xxx\"
    yamlContent = yamlContent.replace(/\\\\/g, '\\').replace(/\\"/g, '"');

    // Case 3: Remove @ prefix from tool URLs: @tool://xxx -> tool://xxx
    yamlContent = yamlContent.replace(/@tool:\/\//g, 'tool://');

    // Case 4: Remove quotes around tool URLs: tool: "tool://xxx" -> tool: tool://xxx
    yamlContent = yamlContent.replace(/(tool|toolUrl|url):\s*"(tool:\/\/[^\"]+)"/g, '$1: $2');

    // YAML → JSON conversion
    const configObj = YAML.parse(yamlContent);

    // Normalize field names
    const toolIdentifier = configObj.tool || configObj.toolUrl || configObj.url;
    const operationMode = configObj.mode || configObj.operation || 'execute';
    const parameters = configObj.parameters || {};

    // Validate required fields
    if (!toolIdentifier) {
      throw new Error('Missing required field: tool\nExample: tool: tool://filesystem\nAliases supported: tool / toolUrl / url');
    }

    // Validate URL format
    if (!toolIdentifier.startsWith('tool://')) {
      throw new Error(`Invalid tool format: ${toolIdentifier}\nMust start with tool://`);
    }

    // Get tool name
    const toolName = toolIdentifier.replace('tool://', '');
    
    // 检查工具是否存在
    if (!toolLoaderService.hasTool(toolName)) {
      const availableTools = toolLoaderService.getAllTools().map(t => t.name).join(', ');
      throw new Error(`工具 '${toolName}' 不存在\n可用工具: ${availableTools}`);
    }

    // 根据模式处理
    switch (operationMode) {
      case 'manual':
        return handleManualMode(toolName);
      
      case 'execute':
        return await handleExecuteMode(toolName, parameters);
      
      case 'configure':
        return handleConfigureMode(toolName, parameters);
      
      case 'log':
        return handleLogMode(toolName, parameters);
      
      default:
        throw new Error(`不支持的模式: ${operationMode}\n支持的模式: manual, execute, configure, log`);
    }

  } catch (error) {
    // YAML parsing errors
    if (error.name === 'YAMLException') {
      if (error.message.includes('bad indentation') || error.message.includes('mapping entry')) {
        throw new Error(`YAML format error: ${error.message}\n\nMultiline content requires | symbol, example:\ncontent: |\n  First line\n  Second line\n\nNote: Newline after |, indent content with 2 spaces`);
      }
      throw new Error(`YAML format error: ${error.message}\nCheck indentation (use spaces) and syntax`);
    }

    throw error;
  }
}

/**
 * 处理 manual 模式 - 显示工具手册
 * @param {string} toolName - 工具名称
 * @returns {object} MCP 格式的返回结果
 */
function handleManualMode(toolName) {
  logger.info(`显示工具手册: ${toolName}`);
  
  try {
    const manual = toolLoaderService.generateManual(toolName);
    
    return {
      content: [
        {
          type: "text",
          text: manual
        }
      ]
    };
  } catch (error) {
    logger.error(`生成工具手册失败: ${toolName}`, { error: error.message });
    throw error;
  }
}

/**
 * 处理 execute 模式 - 执行工具
 * @param {string} toolName - 工具名称
 * @param {object} parameters - 工具参数
 * @returns {object} MCP 格式的返回结果
 */
async function handleExecuteMode(toolName, parameters) {
  logger.info(`执行工具: ${toolName}`, { parameters });
  
  try {
    const tool = toolLoaderService.getTool(toolName);
    const toolModule = tool.module;

    // 检查工具是否需要依赖安装
    if (typeof toolModule.getDependencies === 'function') {
      const dependencies = toolModule.getDependencies();
      if (dependencies && Object.keys(dependencies).length > 0) {
        // TODO: 实现依赖检查和自动安装
        // 当前版本假设依赖已安装
        logger.debug(`工具 ${toolName} 需要依赖:`, dependencies);
      }
    }

    // 创建 API 上下文
    const apiContext = {
      logger: {
        info: (msg, meta) => logger.info(`[${toolName}] ${msg}`, meta),
        warn: (msg, meta) => logger.warn(`[${toolName}] ${msg}`, meta),
        error: (msg, meta) => logger.error(`[${toolName}] ${msg}`, meta),
        debug: (msg, meta) => logger.debug(`[${toolName}] ${msg}`, meta)
      },
      environment: {
        // TODO: 实现环境变量管理
        get: (key) => process.env[key],
        set: (key, value) => { process.env[key] = value; }
      }
    };

    // 绑定 API 上下文到工具模块
    toolModule.api = apiContext;

    // 执行工具
    const result = await toolModule.execute(parameters);
    
    logger.info(`工具执行成功: ${toolName}`);
    
    // 返回格式化的结果
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
    
    // 检查是否是业务错误
    const tool = toolLoaderService.getTool(toolName);
    const businessErrors = tool.businessErrors || [];
    
    for (const businessError of businessErrors) {
      if (businessError.match && businessError.match.test(error.message)) {
        throw new Error(`${businessError.description}: ${error.message}\n解决方案: ${businessError.solution}`);
      }
    }
    
    throw error;
  }
}

/**
 * 处理 configure 模式 - 配置工具环境变量
 * @param {string} toolName - 工具名称
 * @param {object} parameters - 配置参数
 * @returns {object} MCP 格式的返回结果
 */
function handleConfigureMode(toolName, parameters) {
  logger.info(`配置工具: ${toolName}`, { parameters });
  
  try {
    const tool = toolLoaderService.getTool(toolName);
    
    // 获取工具的环境变量定义
    const schema = tool.schema || {};
    const envProps = schema.environment?.properties || {};
    
    // 验证配置参数
    const configuredVars = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (!envProps[key]) {
        logger.warn(`未知的环境变量: ${key}`, { tool: toolName });
      }
      configuredVars[key] = value;
      // TODO: 持久化配置到工具专属的 .env 文件
      process.env[`${toolName.toUpperCase()}_${key}`] = String(value);
    }
    
    logger.info(`工具配置成功: ${toolName}`, { configured: Object.keys(configuredVars) });
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: toolName,
            mode: 'configure',
            configured: configuredVars
          }, null, 2)
        }
      ]
    };
    
  } catch (error) {
    logger.error(`工具配置失败: ${toolName}`, { error: error.message });
    throw error;
  }
}

/**
 * 处理 log 模式 - 查看工具日志
 * @param {string} toolName - 工具名称
 * @param {object} parameters - 日志参数
 * @returns {object} MCP 格式的返回结果
 */
function handleLogMode(toolName, parameters) {
  logger.info(`查看工具日志: ${toolName}`, { parameters });
  
  try {
    const action = parameters.action || 'tail';
    const lines = parameters.lines || 50;
    
    // TODO: 实现日志查看功能
    // 当前版本返回模拟数据
    const logs = [
      `[INFO] 工具 ${toolName} 日志查看功能开发中`,
      `[INFO] 请求动作: ${action}`,
      `[INFO] 请求行数: ${lines}`
    ];
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: toolName,
            mode: 'log',
            logs: logs
          }, null, 2)
        }
      ]
    };
    
  } catch (error) {
    logger.error(`查看工具日志失败: ${toolName}`, { error: error.message });
    throw error;
  }
}

