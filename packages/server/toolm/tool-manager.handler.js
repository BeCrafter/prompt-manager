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
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';
import { toolLoaderService } from './tool-loader.service.js';
import { ensureToolDependencies } from './tool-dependency.service.js';
import { loadToolEnvironment, saveToolEnvironment, getToolEnvironmentInfo } from './tool-environment.service.js';
import { getLogger, flushAllLogQueues } from './tool-logger.service.js';
import { getStorage } from './tool-storage.service.js';
import fs from 'fs-extra';
import { createRequire } from 'module';
import { pathExists } from './tool-utils.js';

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
    const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);

    // 1. 确保依赖已安装
    await ensureToolDependencies(toolName);

    // 2. 加载工具环境变量
    const toolEnvVars = await loadToolEnvironment(toolName);
    
    // 3. 创建工具日志记录器
    const toolLogger = getLogger(toolName);
    
    // 4. 创建工具存储服务
    const toolStorage = getStorage(toolName);
    
    // 5. 创建环境变量访问器（合并系统环境变量和工具环境变量）
    const mergedEnv = {
      ...process.env,
      ...toolEnvVars
    };
    
    // 6. 创建 API 上下文
    const apiContext = {
      logger: toolLogger,
      storage: toolStorage,
      environment: {
        get: (key) => {
          // 优先从工具环境变量获取
          if (toolEnvVars[key] !== undefined) {
            return toolEnvVars[key];
          }
          // 然后从系统环境变量获取
          return process.env[key];
        },
        set: async (key, value) => {
          // 更新工具环境变量
          toolEnvVars[key] = value;
          await saveToolEnvironment(toolName, { [key]: value });
        }
      }
    };

    // 7. 创建工具专用的 require 函数，用于从工具的 node_modules 导入模块
    // createRequire 需要绝对路径
    const packageJsonPath = path.resolve(path.join(toolDir, 'package.json'));
    const toolRequire = createRequire(packageJsonPath);
    
    // 8. 创建工具执行上下文（包含API和工具的所有方法）
    // 首先创建一个包含所有工具方法的上下文对象
    const toolContext = {
      api: apiContext,
      __toolDir: toolDir,
      __toolName: toolName,
      // 文件系统初始化状态（框架管理）
      _filesystemInitialized: false,
      _allowedDirectories: null,
      
      // 框架提供的文件系统基础能力
      /**
       * 获取允许的目录列表（框架提供）
       * 工具可以选择覆盖此方法以实现自定义逻辑
       */
      getAllowedDirectories() {
        const { api } = this;
        
        // 默认值
        let allowedDirs = ['~/.prompt-manager'];
        
        if (api && api.environment) {
          try {
            let configStr = api.environment.get('ALLOWED_DIRECTORIES');
            
            // 如果直接获取失败，尝试使用工具特定的环境变量名
            if (!configStr) {
              const toolSpecificKey = `${toolName.toUpperCase().replace(/-/g, '_')}_ALLOWED_DIRECTORIES`;
              configStr = process.env[toolSpecificKey];
            }
            
            if (configStr) {
              // 处理转义字符（从 .env 文件解析时可能需要）
              configStr = configStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
              
              // 首先尝试作为 JSON 字符串解析
              try {
                const parsed = JSON.parse(configStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  allowedDirs = parsed;
                }
              } catch (parseError) {
                // 如果不是 JSON，尝试作为逗号分隔的字符串
                if (typeof configStr === 'string' && configStr.includes(',')) {
                  allowedDirs = configStr.split(',').map(s => s.trim()).filter(s => s);
                } else if (configStr) {
                  allowedDirs = [configStr];
                }
              }
            }
          } catch (error) {
            // 回退到默认值
            api?.logger?.warn('Failed to parse ALLOWED_DIRECTORIES', { error: error.message });
          }
        }
        
        // 展开 ~ 到主目录并规范化路径
        return allowedDirs.map(dir => {
          const expanded = dir.replace(/^~/, os.homedir());
          return path.resolve(expanded);
        });
      },
      
      /**
       * 初始化文件系统（框架提供）
       * 工具可以选择覆盖此方法以实现自定义初始化逻辑
       */
      async initializeFilesystem() {
        if (!this._filesystemInitialized) {
          // 获取允许的目录列表
          const allowedDirectories = this.getAllowedDirectories();
          this._allowedDirectories = allowedDirectories;
          this._filesystemInitialized = true;
          
          // 记录日志
          const { api } = this;
          api?.logger?.info('Filesystem initialized', { 
            allowedDirectories: this._allowedDirectories 
          });
        }
      },
      
      /**
       * PromptManager特定的路径处理（框架提供）
       * 将相对路径转换为绝对路径，并确保在允许的目录范围内
       * 工具可以选择覆盖此方法以实现自定义路径解析逻辑
       */
      resolvePromptManagerPath(inputPath) {
        const { api } = this;
        
        // 获取允许的目录列表
        const allowedDirs = this._allowedDirectories || this.getAllowedDirectories();
        
        if (!inputPath) {
          // 没有路径时返回第一个允许的目录
          return allowedDirs[0];
        }
        
        // 处理 ~ 开头的路径
        const expandedPath = inputPath.replace(/^~/, os.homedir());
        
        // 如果是绝对路径
        if (path.isAbsolute(expandedPath)) {
          const resolved = path.resolve(expandedPath);
          
          // 规范化路径（移除末尾的斜杠，统一路径分隔符）
          const normalizedResolved = path.normalize(resolved);
          
          // 检查路径是否在允许的目录列表中或其子目录中
          // 策略：允许访问配置的目录及其所有子目录和文件
          // 使用 path.relative 来确保路径真正在允许目录内部，防止路径遍历攻击
          const isAllowed = allowedDirs.some(dir => {
            const normalizedDir = path.normalize(dir);
            
            // 完全匹配允许的目录
            if (normalizedResolved === normalizedDir) {
              return true;
            }
            
            // 检查是否是允许目录的子路径（包括子目录和文件）
            // path.relative 返回相对路径：
            // - 如果在同一目录树中，返回相对路径（如 "subdir/file.txt"）
            // - 如果不在同一目录树中，会包含 ..（如 "../sibling/file.txt"）
            const relativePath = path.relative(normalizedDir, normalizedResolved);
            
            // 如果 relativePath 以 .. 开头，说明路径不在允许目录内（可能是父目录或兄弟目录）
            if (relativePath.startsWith('..')) {
              return false;
            }
            
            // 如果 relativePath 为空，说明是完全匹配（已在上面检查）
            if (relativePath === '') {
              return false;
            }
            
            // 相对路径存在且不以 .. 开头，说明是允许目录的子路径
            // 允许访问允许目录下的所有子目录和文件
            return true;
          });
          
          if (!isAllowed) {
            const dirsStr = allowedDirs.join(', ');
            api?.logger?.warn('Path access denied', { path: resolved, allowedDirs });
            throw new Error(`路径越权: ${inputPath} 不在允许的目录范围内 [${dirsStr}]`);
          }
          
          return resolved;
        }
        
        // 相对路径，尝试在每个允许的目录中解析
        // 优先使用第一个允许的目录（通常是 ~/.prompt-manager）
        const baseDir = allowedDirs[0];
        const fullPath = path.join(baseDir, expandedPath);
        const resolved = path.resolve(fullPath);
        
        // 规范化路径
        const normalizedResolved = path.normalize(resolved);
        
        // 安全检查：确保解析后的路径在允许的目录内或其子目录中
        // 策略：允许访问配置的目录及其所有子目录和文件
        // 使用 path.relative 来确保路径真正在允许目录内部，防止路径遍历攻击
        const isAllowed = allowedDirs.some(dir => {
          const normalizedDir = path.normalize(dir);
          
          // 完全匹配允许的目录
          if (normalizedResolved === normalizedDir) {
            return true;
          }
          
          // 检查是否是允许目录的子路径（包括子目录和文件）
          // path.relative 返回相对路径：
          // - 如果在同一目录树中，返回相对路径（如 "subdir/file.txt"）
          // - 如果不在同一目录树中，会包含 ..（如 "../sibling/file.txt"）
          const relativePath = path.relative(normalizedDir, normalizedResolved);
          
          // 如果 relativePath 以 .. 开头，说明路径不在允许目录内（可能是父目录或兄弟目录）
          if (relativePath.startsWith('..')) {
            return false;
          }
          
          // 如果 relativePath 为空，说明是完全匹配（已在上面检查）
          if (relativePath === '') {
            return false;
          }
          
          // 相对路径存在且不以 .. 开头，说明是允许目录的子路径
          // 允许访问允许目录下的所有子目录和文件
          return true;
        });
        
        if (!isAllowed) {
          const dirsStr = allowedDirs.join(', ');
          api?.logger?.warn('Path resolution failed', { path: inputPath, resolved, allowedDirs });
          throw new Error(`路径越权: ${inputPath} 解析后超出允许的目录范围 [${dirsStr}]`);
        }
        
        return resolved;
      },
      
      // 提供工具专用的模块导入函数
      requireToolModule: (moduleName) => {
        try {
          // 首先尝试从工具的 node_modules 导入
          return toolRequire(moduleName);
        } catch (error) {
          // 如果失败，尝试从系统 node_modules 导入
          try {
            return require(moduleName);
          } catch (e) {
            throw new Error(`无法导入模块 ${moduleName}: ${error.message}`);
          }
        }
      },
      // 提供工具专用的动态导入函数（支持 ES 模块和 CommonJS）
      importToolModule: async (moduleName) => {
        try {
          // 首先尝试使用 require 导入（适用于 CommonJS 模块，如 pdf-parse）
          const module = toolRequire(moduleName);
          
          logger.debug(`模块 ${moduleName} require 成功`, {
            type: typeof module,
            isFunction: typeof module === 'function',
            isObject: typeof module === 'object',
            keys: typeof module === 'object' ? Object.keys(module).slice(0, 10) : []
          });
          
          // pdf-parse 是 CommonJS 模块，直接导出函数
          // 如果 module 是函数，直接返回
          if (typeof module === 'function') {
            return { default: module };
          }
          
          // 如果是对象，检查是否有 default
          if (module && typeof module === 'object') {
            // 如果已经有 default，直接返回
            if (module.default) {
              return module;
            }
            
            // 检查是否有常见的导出名称（如 PDFParse）
            if (module.PDFParse && typeof module.PDFParse === 'function') {
              return { default: module.PDFParse };
            }
            
            // 否则包装为 { default: module }
            return { default: module, ...module };
          }
          
          return module;
        } catch (requireError) {
          logger.debug(`require 失败，尝试 import: ${moduleName}`, { error: requireError.message });
          // 如果 require 失败，尝试使用 import（适用于 ES 模块）
          try {
            const modulePath = toolRequire.resolve(moduleName);
            logger.debug(`使用 import 导入模块: ${moduleName}`, { path: modulePath });
            return await import(modulePath);
          } catch (resolveError) {
            logger.debug(`resolve 失败，尝试直接导入: ${moduleName}`, { error: resolveError.message });
            // 如果 resolve 失败，尝试直接导入（可能从系统 node_modules）
            try {
              logger.debug(`尝试直接导入模块: ${moduleName}`);
              return await import(moduleName);
            } catch (importError) {
              logger.error(`导入模块失败: ${moduleName}`, {
                requireError: requireError.message,
                resolveError: resolveError.message,
                importError: importError.message,
                toolDir
              });
              throw new Error(`无法导入模块 ${moduleName}。请确保依赖已安装。错误: ${requireError.message}`);
            }
          }
        }
      }
    };
    
    // 9. 将工具模块的所有方法复制到上下文中，并绑定this
    // 这样工具方法之间可以相互调用（如 execute 调用 this.initializeFilesystem）
    for (const [key, value] of Object.entries(toolModule)) {
      if (typeof value === 'function') {
        toolContext[key] = value.bind(toolContext);
      } else {
        toolContext[key] = value;
      }
    }
    
    // 9. 记录执行开始
    toolLogger.info('执行开始', { 
      tool: toolName,
      parameters: Object.keys(parameters)
    });

    // 10. 执行工具（使用绑定后的execute方法）
    let result;
    try {
      result = await toolContext.execute(parameters);
      
      // 11. 记录执行完成
      toolLogger.info('执行完成', { 
        tool: toolName,
        success: true
      });
      
    } catch (error) {
      // 记录执行错误
      toolLogger.error('执行失败', { 
        tool: toolName,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
    
    logger.info(`工具执行成功: ${toolName}`);
    
    // 12. 返回格式化的结果
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
async function handleConfigureMode(toolName, parameters) {
  logger.info(`配置工具: ${toolName}`, { parameters });
  
  try {
    const tool = toolLoaderService.getTool(toolName);
    
    // 获取工具的环境变量定义
    const schema = tool.schema || {};
    const envProps = schema.environment?.properties || {};
    
    // 如果有配置参数，保存配置
    if (parameters && Object.keys(parameters).length > 0) {
      // 验证配置参数
      const configuredVars = {};
      for (const [key, value] of Object.entries(parameters)) {
        if (!envProps[key]) {
          logger.warn(`未知的环境变量: ${key}`, { tool: toolName });
        }
        configuredVars[key] = value;
      }
      
      // 保存到 .env 文件
      await saveToolEnvironment(toolName, configuredVars);
      
      logger.info(`工具配置成功: ${toolName}`, { configured: Object.keys(configuredVars) });
    }
    
    // 获取当前配置信息
    const envInfo = await getToolEnvironmentInfo(toolName, schema);
    const metadata = tool.metadata || {};
    
    // 生成格式化的配置信息
    let configText = `# 工具配置信息\n\n`;
    configText += `## 工具信息\n\n`;
    configText += `**工具名称**: ${toolName}\n`;
    configText += `**工具版本**: ${metadata.version || '1.0.0'}\n`;
    configText += `**配置状态**: ${envInfo.configured.length > 0 ? '✅ 已配置' : '⚠️ 未配置'}\n\n`;
    
    configText += `## 环境配置路径\n\n`;
    configText += `**配置文件路径**: \`${envInfo.envFilePath}\`\n\n`;
    
    if (envInfo.configured.length > 0) {
      configText += `## 当前配置\n\n`;
      configText += `### 已配置项\n\n`;
      configText += `| 配置项 | 当前值 | 说明 | 状态 |\n`;
      configText += `|--------|--------|------|------|\n`;
      for (const item of envInfo.configured) {
        const value = String(item.value).length > 50 
          ? String(item.value).substring(0, 50) + '...'
          : String(item.value);
        configText += `| ${item.key} | ${value} | ${item.description} | ${item.status} |\n`;
      }
      configText += `\n`;
    }
    
    if (envInfo.unconfigured.length > 0) {
      configText += `### 未配置项（使用默认值）\n\n`;
      configText += `| 配置项 | 默认值 | 说明 | 状态 |\n`;
      configText += `|--------|--------|------|------|\n`;
      for (const item of envInfo.unconfigured) {
        const defaultValue = item.defaultValue !== undefined 
          ? String(item.defaultValue)
          : '(无)';
        configText += `| ${item.key} | ${defaultValue} | ${item.description} | ${item.status} |\n`;
      }
      configText += `\n`;
    }
    
    configText += `## 配置操作\n\n`;
    configText += `### 如何更新配置\n\n`;
    configText += `使用以下命令更新配置：\n\n`;
    configText += `\`\`\`yaml\n`;
    configText += `tool: tool://${toolName}\n`;
    configText += `mode: configure\n`;
    configText += `parameters:\n`;
    if (envProps && Object.keys(envProps).length > 0) {
      const firstKey = Object.keys(envProps)[0];
      const firstDef = envProps[firstKey];
      configText += `  ${firstKey}: ${firstDef.default || 'value'}\n`;
    }
    configText += `\`\`\`\n\n`;
    
    return {
      content: [
        {
          type: "text",
          text: configText
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
async function handleLogMode(toolName, parameters) {
  logger.info(`查看工具日志: ${toolName}`, { parameters });
  
  try {
    // 先刷新日志队列，确保最新日志已写入
    await flushAllLogQueues();
    
    const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
    const logFilePath = path.join(toolDir, 'run.log');
    
    // 检查日志文件是否存在
    if (!await pathExists(logFilePath)) {
      return {
        content: [
          {
            type: "text",
            text: `工具 ${toolName} 暂无日志文件\n\n日志文件路径: \`${logFilePath}\``
          }
        ]
      };
    }
    
    // 读取日志文件
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    const logLines = logContent.split('\n').filter(line => line.trim());
    
    const action = parameters.action || 'tail';
    const lines = parameters.lines || 50;
    
    let selectedLines = [];
    
    if (action === 'tail') {
      // 取最后N行
      selectedLines = logLines.slice(-lines);
    } else if (action === 'head') {
      // 取前N行
      selectedLines = logLines.slice(0, lines);
    } else if (action === 'all') {
      // 取所有行
      selectedLines = logLines;
    } else {
      throw new Error(`不支持的操作: ${action}，支持的操作: tail, head, all`);
    }
    
    const logText = selectedLines.join('\n');
    
    return {
      content: [
        {
          type: "text",
          text: `# 工具日志\n\n**工具**: ${toolName}\n**日志文件**: \`${logFilePath}\`\n**操作**: ${action}\n**行数**: ${selectedLines.length}\n\n\`\`\`\n${logText}\n\`\`\``
        }
      ]
    };
    
  } catch (error) {
    logger.error(`查看工具日志失败: ${toolName}`, { error: error.message });
    throw error;
  }
}

