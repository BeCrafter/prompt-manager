/**
 * 工具加载器 - 负责工具的发现、加载和验证
 * 实现工具枚举机制
 */

import fs from 'fs/promises';
import path from 'path';

class ToolLoader {
  constructor() {
    this.toolsDir = null;
    this.loadedTools = new Map();
    this.toolCache = new Map();
  }

  /**
   * 设置工具目录
   * @param {string} toolsDir - 工具目录路径
   */
  setToolsDirectory(toolsDir) {
    this.toolsDir = toolsDir;
  }

  /**
   * 发现所有可用工具
   * @returns {Promise<Array>} 工具信息列表
   */
  async discoverTools() {
    if (!this.toolsDir) {
      throw new Error('Tools directory not set. Call setToolsDirectory() first.');
    }

    try {
      const toolDirs = await fs.readdir(this.toolsDir);
      const tools = [];

      for (const toolDir of toolDirs) {
        const toolPath = path.join(this.toolsDir, toolDir);
        const stat = await fs.stat(toolPath);
        
        if (stat.isDirectory()) {
          const toolInfo = await this.getToolInfo(toolDir, toolPath);
          if (toolInfo) {
            tools.push(toolInfo);
          }
        }
      }

      return tools;
    } catch (error) {
      throw new Error(`Failed to discover tools: ${error.message}`);
    }
  }

  /**
   * 获取工具信息
   * @param {string} toolName - 工具名称
   * @param {string} toolPath - 工具路径
   * @returns {Promise<object|null>} 工具信息
   */
  async getToolInfo(toolName, toolPath) {
    try {
      // 查找符合命名规范的工具文件
      const files = await fs.readdir(toolPath);
      
      // 优先查找ESM版本的工具文件 (toolName-esm.tool.js)，然后是普通版本 (toolName.tool.js)
      let toolFile = files.find(file => file === `${toolName}-esm.tool.js`);
      if (!toolFile) {
        toolFile = files.find(file => file === `${toolName}.tool.js`);
      }
      if (!toolFile) {
        toolFile = files.find(file => file.endsWith('.tool.js') && file.startsWith(toolName));
      }

      if (!toolFile) {
        return null;
      }

      const toolFilePath = path.join(toolPath, toolFile);
      
      // 在测试环境中，为了避免复杂依赖问题，我们可以采用更安全的导入方式
      // 或者只返回工具的基本信息而不执行其代码
      let toolModule;
      try {
        // Try to dynamically import as ES module first
        toolModule = await import(toolFilePath);
      } catch (esmError) {
        try {
          // If ES module import fails, try to use CommonJS require
          // Create a new require function for this file
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          
          // For the specific filesystem tool, we need to provide importx function
          // Temporarily define importx in the global scope for this require
          const originalImportx = global.importx;
          if (typeof global.importx === 'undefined') {
            global.importx = async (moduleName) => {
              // This is a placeholder for the real importx function
              // which would be provided by the actual ToolSandbox environment
              console.warn(`importx called for ${moduleName} in tool loading context - this is a placeholder`);
              if (moduleName === '@modelcontextprotocol/server-filesystem/dist/lib.js') {
                // Return a mock MCP filesystem module for loading purposes
                return {
                  setAllowedDirectories: () => {},
                  readFileContent: async () => '',
                  writeFileContent: async () => {},
                  getFileStats: async () => ({ size: 0, mtimeMs: Date.now(), isFile: true, isDirectory: false }),
                  applyFileEdits: async () => ({ success: true }),
                  headFile: async () => '',
                  tailFile: async () => ''
                };
              } else if (moduleName === 'glob') {
                return { glob: async () => [] };
              }
              return {};
            };
          }
          
          toolModule = require(toolFilePath);
          
          // Restore original importx
          if (originalImportx !== undefined) {
            global.importx = originalImportx;
          } else {
            delete global.importx;
          }
        } catch (cjsError) {
          // If both fail, log the error but return basic tool info
          console.warn(`Failed to load tool module '${toolName}': ${esmError.message}, CJS: ${cjsError.message}`);
          
          // Return basic tool info (without data that requires module execution)
          return {
            name: toolName,
            path: toolPath,
            file: toolFile,
            metadata: { name: toolName, description: `Tool ${toolName} (load failed: both ESM and CJS imports failed)` },
            dependencies: {},
            runtimeRequirements: {},
            lastModified: (await fs.stat(toolFilePath)).mtime
          };
        }
      }

      // 获取工具元信息
      const metadata = typeof toolModule.getMetadata === 'function' 
        ? toolModule.getMetadata() 
        : { name: toolName, description: 'No description available' };

      // 获取工具依赖
      const dependencies = typeof toolModule.getDependencies === 'function' 
        ? toolModule.getDependencies() 
        : {};

      // 获取运行时需求
      const runtimeRequirements = typeof toolModule.getRuntimeRequirements === 'function' 
        ? toolModule.getRuntimeRequirements() 
        : {};

      return {
        name: toolName,
        path: toolPath,
        file: toolFile,
        metadata,
        dependencies,
        runtimeRequirements,
        lastModified: (await fs.stat(toolFilePath)).mtime
      };
    } catch (error) {
      console.warn(`Failed to get info for tool '${toolName}': ${error.message}`);
      return null;
    }
  }

  /**
   * 加载工具实例
   * @param {string} toolName - 工具名称
   * @returns {Promise<object>} 工具实例
   */
  async loadTool(toolName) {
    if (!this.toolsDir) {
      throw new Error('Tools directory not set. Call setToolsDirectory() first.');
    }

    // 检查缓存
    if (this.toolCache.has(toolName)) {
      return this.toolCache.get(toolName);
    }

    try {
      const toolPath = path.join(this.toolsDir, toolName);
      const stat = await fs.stat(toolPath);
      
      if (!stat.isDirectory()) {
        throw new Error(`Tool '${toolName}' directory not found`);
      }

      // 查找工具文件 - 优先查找ESM版本，然后是普通版本
      const files = await fs.readdir(toolPath);
      let toolFile = files.find(file => file === `${toolName}-esm.tool.js`);
      if (!toolFile) {
        toolFile = files.find(file => file === `${toolName}.tool.js`);
      }
      if (!toolFile) {
        toolFile = files.find(file => file.endsWith('.tool.js') && file.startsWith(toolName));
      }

      if (!toolFile) {
        throw new Error(`Tool file not found for '${toolName}'`);
      }

      const toolFilePath = path.join(toolPath, toolFile);
      
      // 动态导入工具模块
      let toolModule;
      try {
        // First, try to dynamically import as ES module
        toolModule = await import(toolFilePath);
      } catch (esmError) {
        try {
          // If ES module import fails, try to use CommonJS require
          // Create a new require function for this file
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          
          // For the specific filesystem tool, we need to provide importx function
          // Temporarily define importx in the global scope for this require
          const originalImportx = global.importx;
          if (typeof global.importx === 'undefined') {
            global.importx = async (moduleName) => {
              // This is a placeholder for the real importx function
              // which would be provided by the actual ToolSandbox environment
              console.warn(`importx called for ${moduleName} in tool loading context - this is a placeholder`);
              if (moduleName === '@modelcontextprotocol/server-filesystem/dist/lib.js') {
                // Return a mock MCP filesystem module for loading purposes
                return {
                  setAllowedDirectories: () => {},
                  readFileContent: async () => '',
                  writeFileContent: async () => {},
                  getFileStats: async () => ({ size: 0, mtimeMs: Date.now(), isFile: true, isDirectory: false }),
                  applyFileEdits: async () => ({ success: true }),
                  headFile: async () => '',
                  tailFile: async () => ''
                };
              } else if (moduleName === 'glob') {
                return { glob: async () => [] };
              }
              return {};
            };
          }
          
          toolModule = require(toolFilePath);
          
          // Restore original importx
          if (originalImportx !== undefined) {
            global.importx = originalImportx;
          } else {
            delete global.importx;
          }
        } catch (cjsError) {
          throw new Error(`Failed to load tool '${toolName}': ${esmError.message}, CJS: ${cjsError.message}`);
        }
      }
      
      // 验证工具接口
      this.validateToolInterface(toolModule);

      // 缓存工具实例
      this.toolCache.set(toolName, toolModule);
      
      return toolModule;
    } catch (error) {
      throw new Error(`Failed to load tool '${toolName}': ${error.message}`);
    }
  }

  /**
   * 验证工具接口
   * @param {object} toolModule - 工具模块
   */
  validateToolInterface(toolModule) {
    const requiredMethods = ['getDependencies', 'getMetadata', 'getSchema', 'getBusinessErrors', 'execute'];
    
    for (const method of requiredMethods) {
      if (typeof toolModule[method] !== 'function') {
        throw new Error(`Tool is missing required method: ${method}`);
      }
    }
    
    // 可选方法
    if (typeof toolModule.getRuntimeRequirements !== 'function') {
      console.warn('Tool is missing optional method: getRuntimeRequirements');
    }
  }

  /**
   * 验证工具运行时需求
   * @param {object} toolModule - 工具模块
   * @param {object} runtimeValidator - 运行时验证器
   * @returns {Promise<object>} 验证结果
   */
  async validateToolRuntimeRequirements(toolModule, runtimeValidator) {
    if (typeof toolModule.getRuntimeRequirements !== 'function') {
      return { valid: true, errors: [] };
    }

    const runtimeRequirements = toolModule.getRuntimeRequirements();
    return await runtimeValidator(runtimeRequirements);
  }

  /**
   * 获取工具列表
   * @returns {Array} 工具元数据列表
   */
  getToolList() {
    return Array.from(this.toolCache.keys()).map(name => {
      const tool = this.toolCache.get(name);
      return {
        name,
        metadata: typeof tool.getMetadata === 'function' ? tool.getMetadata() : {}
      };
    });
  }

  /**
   * 清除工具缓存
   * @param {string} [toolName] - 特定工具名称，不提供则清除所有缓存
   */
  clearCache(toolName) {
    if (toolName) {
      this.toolCache.delete(toolName);
    } else {
      this.toolCache.clear();
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {object} 缓存统计
   */
  getCacheStats() {
    return {
      size: this.toolCache.size,
      keys: Array.from(this.toolCache.keys())
    };
  }
}

// 单例模式
const globalToolLoader = new ToolLoader();

export {
  ToolLoader,
  globalToolLoader as loader
};