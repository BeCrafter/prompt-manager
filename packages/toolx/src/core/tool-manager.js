/**
 * 工具管理器 - 协调工具的整个生命周期
 * 实现工具枚举、加载、验证和执行的统一管理
 */

import { loader as toolLoader } from './tool-loader.js';
import { registry } from './registry.js';

class ToolManager {
  constructor() {
    this.toolLoader = toolLoader;
    this.adapterRegistry = registry;
    this.loadedTools = new Map();
    this.executingTools = new Map();
  }

  /**
   * 设置工具目录
   * @param {string} toolsDir - 工具目录路径
   */
  setToolsDirectory(toolsDir) {
    this.toolLoader.setToolsDirectory(toolsDir);
  }

  /**
   * 发现所有可用工具
   * @returns {Promise<Array>} 工具信息列表
   */
  async discoverTools() {
    return await this.toolLoader.discoverTools();
  }

  /**
   * 获取工具列表
   * @returns {Promise<Array>} 工具列表
   */
  async getToolList() {
    const tools = await this.discoverTools();
    return tools.map(tool => ({
      id: tool.metadata.id || tool.name,
      name: tool.metadata.name || tool.name,
      description: tool.metadata.description,
      version: tool.metadata.version,
      category: tool.metadata.category,
      tags: tool.metadata.tags
    }));
  }

  /**
   * 加载工具
   * @param {string} toolName - 工具名称
   * @returns {Promise<object>} 工具实例
   */
  async loadTool(toolName) {
    // 检查是否已加载
    if (this.loadedTools.has(toolName)) {
      return this.loadedTools.get(toolName);
    }

    try {
      // 加载工具
      const toolModule = await this.toolLoader.loadTool(toolName);
      
      // 缓存工具实例
      this.loadedTools.set(toolName, toolModule);
      
      return toolModule;
    } catch (error) {
      throw new Error(`Failed to load tool '${toolName}': ${error.message}`);
    }
  }

  /**
   * 验证工具运行时需求
   * @param {string} toolName - 工具名称
   * @param {string} adapterName - 适配器名称
   * @param {object} adapterConfig - 适配器配置
   * @returns {Promise<object>} 验证结果
   */
  async validateToolRuntimeRequirements(toolName, adapterName, adapterConfig) {
    try {
      // 加载工具
      const toolModule = await this.loadTool(toolName);
      
      // 获取适配器
      const adapter = this.adapterRegistry.create(adapterName, adapterConfig);
      
      // 验证运行时需求
      if (typeof adapter.validateToolRuntimeRequirements === 'function') {
        return await adapter.validateToolRuntimeRequirements(
          typeof toolModule.getRuntimeRequirements === 'function' 
            ? toolModule.getRuntimeRequirements() 
            : {}
        );
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  /**
   * 执行工具
   * @param {string} toolName - 工具名称
   * @param {string} adapterName - 适配器名称
   * @param {object} adapterConfig - 适配器配置
   * @param {object} params - 执行参数
   * @returns {Promise<any>} 执行结果
   */
  async executeTool(toolName, adapterName, adapterConfig, params) {
    const executionId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 记录执行开始
      this.executingTools.set(executionId, {
        toolName,
        adapterName,
        startTime: Date.now(),
        status: 'initializing'
      });
      
      // 加载工具
      const toolModule = await this.loadTool(toolName);
      
      // 验证运行时需求
      const validation = await this.validateToolRuntimeRequirements(toolName, adapterName, adapterConfig);
      if (!validation.valid) {
        throw new Error(`Tool runtime requirements validation failed: ${validation.errors.join(', ')}`);
      }
      
      // 更新执行状态
      const executionInfo = this.executingTools.get(executionId);
      executionInfo.status = 'running';
      
      // 为工具执行提供 importx 函数（如果需要）
      const originalImportx = global.importx;
      
      // 提供模拟的 importx 函数
      global.importx = async (moduleName) => {
        console.log(`importx called for ${moduleName} during tool execution`);
        
        if (moduleName === '@modelcontextprotocol/server-filesystem/dist/lib.js') {
          // 模拟 MCP 文件系统模块
          const fs = await import('fs/promises');
          const path = await import('path');
          
          return {
            setAllowedDirectories: (dirs) => {
              console.log('MCP: 设置允许的目录:', dirs);
            },
            readFileContent: async (filePath) => {
              console.log('MCP: 读取文件内容:', filePath);
              try {
                return await fs.readFile(filePath, 'utf8');
              } catch (error) {
                throw new Error(`无法读取文件: ${error.message}`);
              }
            },
            writeFileContent: async (filePath, content) => {
              console.log('MCP: 写入文件内容:', filePath);
              try {
                // 确保目录存在
                const dirPath = path.dirname(filePath);
                try {
                  await fs.access(dirPath);
                } catch {
                  await fs.mkdir(dirPath, { recursive: true });
                }
                await fs.writeFile(filePath, content, 'utf8');
              } catch (error) {
                throw new Error(`无法写入文件: ${error.message}`);
              }
            },
            getFileStats: async (filePath) => {
              console.log('MCP: 获取文件信息:', filePath);
              try {
                const stats = await fs.stat(filePath);
                return {
                  size: stats.size,
                  mtimeMs: stats.mtimeMs,
                  atimeMs: stats.atimeMs,
                  isFile: stats.isFile(),
                  isDirectory: stats.isDirectory()
                };
              } catch (error) {
                throw new Error(`无法获取文件信息: ${error.message}`);
              }
            },
            applyFileEdits: async (filePath, edits, dryRun = false) => {
              console.log('MCP: 应用文件编辑:', filePath);
              try {
                let content = await fs.readFile(filePath, 'utf8');
                
                for (const edit of edits) {
                  if (content.includes(edit.oldText)) {
                    content = content.replace(edit.oldText, edit.newText);
                  } else {
                    throw new Error(`未找到要替换的文本: ${edit.oldText}`);
                  }
                }
                
                if (!dryRun) {
                  await fs.writeFile(filePath, content, 'utf8');
                }
                
                return { success: true, content };
              } catch (error) {
                throw new Error(`文件编辑失败: ${error.message}`);
              }
            },
            headFile: async (filePath, lines) => {
              console.log('MCP: 读取文件前几行:', filePath);
              try {
                const content = await fs.readFile(filePath, 'utf8');
                const linesArray = content.split('\n');
                return linesArray.slice(0, lines).join('\n');
              } catch (error) {
                throw new Error(`无法读取文件前几行: ${error.message}`);
              }
            },
            tailFile: async (filePath, lines) => {
              console.log('MCP: 读取文件后几行:', filePath);
              try {
                const content = await fs.readFile(filePath, 'utf8');
                const linesArray = content.split('\n');
                return linesArray.slice(-lines).join('\n');
              } catch (error) {
                throw new Error(`无法读取文件后几行: ${error.message}`);
              }
            }
          };
        } else if (moduleName === 'glob') {
          // 模拟 glob 模块
          const fs = await import('fs/promises');
          const path = await import('path');
          
          return {
            glob: async (pattern, options = {}) => {
              console.log('Glob: 搜索文件模式:', pattern);
              // 简单实现，只返回匹配的文件名
              const dir = path.dirname(pattern);
              const basePattern = path.basename(pattern);
              
              try {
                const entries = await fs.readdir(dir);
                // 简单匹配，实际 glob 会更复杂
                const matched = entries.filter(entry => 
                  basePattern.includes('*') ? 
                    entry.includes(basePattern.replace('*', '')) : 
                    entry === basePattern
                );
                return matched.map(entry => path.join(dir, entry));
              } catch (error) {
                return [];
              }
            }
          };
        }
        
        throw new Error(`模块未找到: ${moduleName}`);
      };
      
      // 执行工具
      const result = await toolModule.execute(params);
      
      // 恢复原始的 importx 函数
      if (originalImportx !== undefined) {
        global.importx = originalImportx;
      } else {
        // 如果之前没有 importx，删除我们添加的
        delete global.importx;
      }
      
      // 更新执行状态
      executionInfo.status = 'completed';
      executionInfo.endTime = Date.now();
      executionInfo.duration = executionInfo.endTime - executionInfo.startTime;
      
      return result;
    } catch (error) {
      // 更新执行状态
      const executionInfo = this.executingTools.get(executionId);
      if (executionInfo) {
        executionInfo.status = 'failed';
        executionInfo.error = error.message;
        executionInfo.endTime = Date.now();
        executionInfo.duration = executionInfo.endTime - executionInfo.startTime;
      }
      
      throw error;
    } finally {
      // 清理执行记录（保留最近的100条记录）
      if (this.executingTools.size > 100) {
        const keys = Array.from(this.executingTools.keys());
        for (let i = 0; i < keys.length - 100; i++) {
          this.executingTools.delete(keys[i]);
        }
      }
    }
  }

  /**
   * 获取正在执行的工具列表
   * @returns {Array} 正在执行的工具列表
   */
  getExecutingTools() {
    return Array.from(this.executingTools.entries()).map(([id, info]) => ({
      id,
      ...info
    }));
  }

  /**
   * 获取工具执行历史
   * @param {number} limit - 限制返回的记录数
   * @returns {Array} 工具执行历史
   */
  getExecutionHistory(limit = 50) {
    return Array.from(this.executingTools.entries())
      .slice(-limit)
      .map(([id, info]) => ({
        id,
        ...info
      }))
      .reverse();
  }

  /**
   * 获取工具详细信息
   * @param {string} toolName - 工具名称
   * @returns {Promise<object>} 工具详细信息
   */
  async getToolDetails(toolName) {
    try {
      // 发现工具信息
      const tools = await this.discoverTools();
      const toolInfo = tools.find(t => t.name === toolName);
      
      if (!toolInfo) {
        throw new Error(`Tool '${toolName}' not found`);
      }
      
      return {
        ...toolInfo,
        loaded: this.loadedTools.has(toolName)
      };
    } catch (error) {
      throw new Error(`Failed to get tool details for '${toolName}': ${error.message}`);
    }
  }

  /**
   * 卸载工具
   * @param {string} toolName - 工具名称
   */
  unloadTool(toolName) {
    this.loadedTools.delete(toolName);
    this.toolLoader.clearCache(toolName);
  }

  /**
   * 卸载所有工具
   */
  unloadAllTools() {
    this.loadedTools.clear();
    this.toolLoader.clearCache();
  }

  /**
   * 获取管理器状态
   * @returns {object} 管理器状态
   */
  getStatus() {
    return {
      loadedTools: this.loadedTools.size,
      executingTools: this.executingTools.size,
      toolLoader: this.toolLoader.getCacheStats(),
      adapterRegistry: {
        registeredAdapters: this.adapterRegistry.getRegisteredAdapters(),
        adapterInfo: this.adapterRegistry.getRegisteredAdapters().map(name => 
          this.adapterRegistry.getAdapterInfo(name)
        )
      }
    };
  }
}

// 单例模式
const globalToolManager = new ToolManager();

export {
  ToolManager,
  globalToolManager as manager
};