/**
 * 工具执行上下文服务
 *
 * 职责：
 * 1. 创建工具执行上下文（包含 API、路径解析、模块导入等）
 * 2. 提供统一的工具执行环境
 */

import path from 'path';
import { createRequire } from 'module';
import { logger } from '../utils/logger.js';
import { getLogger } from './tool-logger.service.js';
import { getStorage } from './tool-storage.service.js';
import { loadToolEnvironment, saveToolEnvironment } from './tool-environment.service.js';
import { config } from '../utils/config.js';

/**
 * 创建工具执行上下文
 * @param {string} toolName - 工具名称
 * @param {object} toolModule - 工具模块
 * @returns {object} 工具执行上下文
 */
export async function createToolContext(toolName, toolModule) {
  const toolDir = config.getToolDir(toolName);

  // 1. 加载工具环境变量
  const toolEnvVars = await loadToolEnvironment(toolName);

  // 2. 创建工具日志记录器
  const toolLogger = getLogger(toolName);

  // 3. 创建工具存储服务
  const toolStorage = getStorage(toolName);

  // 4. 创建 API 上下文
  const apiContext = {
    logger: toolLogger,
    storage: toolStorage,
    environment: {
      get: key => {
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

  // 5. 创建工具专用的 require 函数
  const packageJsonPath = path.resolve(path.join(toolDir, 'package.json'));
  const toolRequire = createRequire(packageJsonPath);

  // 6. 创建工具执行上下文
  const toolContext = {
    api: apiContext,
    __toolDir: toolDir,
    __toolName: toolName,
    // 文件系统初始化状态（框架管理）
    _filesystemInitialized: false,
    _allowedDirectories: null,

    // 框架提供的文件系统基础能力
    getAllowedDirectories() {
      const { api } = this;

      // 默认值
      let allowedDirs = [config.getConfigHome()];

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
                allowedDirs = configStr
                  .split(',')
                  .map(s => s.trim())
                  .filter(s => s);
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
        const expanded = dir.replace(/^~/, config.getConfigHome());
        return path.resolve(expanded);
      });
    },

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

    resolvePromptManagerPath(inputPath) {
      const { api } = this;

      // 获取允许的目录列表
      const allowedDirs = this._allowedDirectories || this.getAllowedDirectories();

      if (!inputPath) {
        // 没有路径时返回第一个允许的目录
        return allowedDirs[0];
      }

      // 处理 ~ 开头的路径
      const expandedPath = inputPath.replace(/^~/, config.getConfigHome());

      // 如果是绝对路径
      if (path.isAbsolute(expandedPath)) {
        const resolved = path.resolve(expandedPath);
        const normalizedResolved = path.normalize(resolved);

        // 检查路径是否在允许的目录范围内
        const isAllowed = allowedDirs.some(dir => {
          const normalizedDir = path.normalize(dir);

          // 完全匹配允许的目录
          if (normalizedResolved === normalizedDir) {
            return true;
          }

          // 检查是否是允许目录的子路径
          const relativePath = path.relative(normalizedDir, normalizedResolved);

          // 如果 relativePath 以 .. 开头，说明路径不在允许目录内
          if (relativePath.startsWith('..')) {
            return false;
          }

          // 如果 relativePath 为空，说明是完全匹配（已在上面检查）
          if (relativePath === '') {
            return false;
          }

          // 相对路径存在且不以 .. 开头，说明是允许目录的子路径
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
      const baseDir = allowedDirs[0];
      const fullPath = path.join(baseDir, expandedPath);
      const resolved = path.resolve(fullPath);
      const normalizedResolved = path.normalize(resolved);

      // 安全检查：确保解析后的路径在允许的目录内或其子目录中
      const isAllowed = allowedDirs.some(dir => {
        const normalizedDir = path.normalize(dir);

        // 完全匹配允许的目录
        if (normalizedResolved === normalizedDir) {
          return true;
        }

        // 检查是否是允许目录的子路径
        const relativePath = path.relative(normalizedDir, normalizedResolved);

        // 如果 relativePath 以 .. 开头，说明路径不在允许目录内
        if (relativePath.startsWith('..')) {
          return false;
        }

        // 如果 relativePath 为空，说明是完全匹配（已在上面检查）
        if (relativePath === '') {
          return false;
        }

        // 相对路径存在且不以 .. 开头，说明是允许目录的子路径
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
    requireToolModule: moduleName => {
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
    importToolModule: async moduleName => {
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
          logger.debug(`resolve 失败，尝试特殊路径: ${moduleName}`, { error: resolveError.message });

          // 特殊处理：某些包的 main 字段指向错误的路径，需要尝试备用路径
          const fallbackPaths = {
            'chrome-devtools-mcp': 'chrome-devtools-mcp/build/src/index.js'
          };

          if (fallbackPaths[moduleName]) {
            try {
              const fallbackPath = toolRequire.resolve(fallbackPaths[moduleName]);
              logger.debug(`使用备用路径导入 ${moduleName}`, { path: fallbackPath });
              return await import(fallbackPath);
            } catch (fallbackError) {
              logger.debug(`备用路径也失败: ${moduleName}`, { error: fallbackError.message });
            }
          }

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

  // 7. 将工具模块的所有方法复制到上下文中，并绑定this
  // 这样工具方法之间可以相互调用（如 execute 调用 this.initializeFilesystem）
  for (const [key, value] of Object.entries(toolModule)) {
    if (typeof value === 'function') {
      toolContext[key] = value.bind(toolContext);
    } else {
      toolContext[key] = value;
    }
  }

  return toolContext;
}
