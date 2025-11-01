import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { GROUP_META_FILENAME } from '../utils/util.js';

/**
 * Prompt数据结构验证schema
 */
const PromptSchema = z.object({
  name: z.string().min(1, 'Prompt名称不能为空'),
  description: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.object({
      text: z.string()
    })
  })).optional(),
  arguments: z.array(z.object({
    name: z.string().min(1, '参数名不能为空'),
    description: z.string().optional(),
    type: z.enum(['string', 'number', 'boolean']).optional().default('string'),
    required: z.boolean().optional().default(true)
  })).optional().default([]),
  // 元数据字段（可选，用于远程服务）
  uniqueId: z.string().optional(),
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  relativePath: z.string().optional()
});

/**
 * Prompt管理器类
 */
class PromptManager {
  constructor(promptsDir) {
    this.promptsDir = promptsDir;
    this.loadedPrompts = new Map();
    this.loadErrors = new Map();
    this.idToPathMap = new Map(); // ID到文件路径的映射
  }

  /**
   * 基于文件路径生成固定长度的唯一ID
   * @param {string} relativePath - 相对于prompts目录的路径
   * @returns {string} 固定长度的唯一ID字符串（8位）
   */
  generateUniqueId(relativePath) {
    // 使用SHA-256哈希算法生成固定长度的ID
    const hash = crypto.createHash('sha256');
    hash.update(relativePath);
    const hashHex = hash.digest('hex');
    
    // 取前8位作为ID，保证长度一致
    // 8位十六进制可以表示 16^8 = 4,294,967,296 种不同的值，足够保证唯一性
    const shortId = hashHex.substring(0, 8);
    
    return shortId;
  }

  /**
   * 基于文件路径生成固定长度的唯一ID（可配置长度版本）
   * @param {string} relativePath - 相对于prompts目录的路径
   * @param {number} length - ID长度，默认为8
   * @returns {string} 固定长度的唯一ID字符串
   */
  generateUniqueIdWithLength(relativePath, length = 8) {
    const hash = crypto.createHash('sha256');
    hash.update(relativePath);
    const hashHex = hash.digest('hex');
    
    // 取指定长度的字符作为ID
    const shortId = hashHex.substring(0, length);
    
    return shortId;
  }

  /**
   * 基于ID反解文件路径
   * @param {string} id - 唯一ID
   * @returns {string|null} 文件路径，如果找不到则返回null
   */
  getIdToPath(id) {
    return this.idToPathMap.get(id) || null;
  }

  /**
   * 读取组元数据的函数 
   * @param {string} dir - 目录路径
   * @returns {Object} 组元数据
   */
  readGroupMeta(dir) {
    try {
      const metaPath = path.join(dir, GROUP_META_FILENAME);
      if (!fs.existsSync(metaPath)) {
        return { enabled: true };
      }
      const raw = fs.readFileSync(metaPath, 'utf8');
      const data = JSON.parse(raw);
      return {
        enabled: data.enabled !== false
      };
    } catch (error) {
      console.warn('读取类目元数据失败:', error);
      return { enabled: true };
    }
  }

  /**
   * 注册ID到路径的映射
   * @param {string} id - 唯一ID
   * @param {string} relativePath - 相对路径
   */
  registerIdPathMapping(id, relativePath) {
    this.idToPathMap.set(id, relativePath);
  }

  /**
   * 从远程服务器加载prompts
   */
  async loadRemotePrompts() {
    try {
      logger.info(`开始从远程服务器 ${config.remoteUrl} 加载prompts`);

      const headers = {
        'Content-Type': 'application/json',
        ...(config.remoteHeaders || {})
      };

      const response = await fetch(config.remoteUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`远程服务器返回错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 清空之前的加载结果
      this.loadedPrompts.clear();
      this.loadErrors.clear();

      let successCount = 0;
      let errorCount = 0;

      // 处理远程数据
      for (const promptData of data) {
        try {
          const validatedPrompt = PromptSchema.parse(promptData);
          
          // 检查远程服务是否提供了uniqueId
          if (promptData.uniqueId) {
            // 远程服务提供了uniqueId，直接使用
            validatedPrompt.uniqueId = promptData.uniqueId;
            
            // 可选：如果提供了其他元数据字段就使用，没提供就设置默认值
            validatedPrompt.filePath = promptData.filePath || `remote://${validatedPrompt.name}`;
            validatedPrompt.fileName = promptData.fileName || `${validatedPrompt.name}.yaml`;
            validatedPrompt.relativePath = promptData.relativePath || `${validatedPrompt.name}.yaml`;
            
            // 注册ID到路径的映射
            this.registerIdPathMapping(promptData.uniqueId, validatedPrompt.relativePath);
            
            // 使用唯一ID作为存储键
            this.loadedPrompts.set(promptData.uniqueId, validatedPrompt);
            logger.debug(`使用远程服务提供的uniqueId: ${validatedPrompt.name} -> ID: ${promptData.uniqueId}`);
          } else {
            // 远程服务未提供uniqueId，使用兼容模式
            const virtualPath = `${validatedPrompt.name}.yaml`;
            const uniqueId = this.generateUniqueId(virtualPath);
            validatedPrompt.uniqueId = uniqueId;
            validatedPrompt.filePath = `remote://${validatedPrompt.name}`;
            validatedPrompt.fileName = `${validatedPrompt.name}.yaml`;
            validatedPrompt.relativePath = virtualPath;
            
            // 注册ID到路径的映射
            this.registerIdPathMapping(uniqueId, virtualPath);
            
            // 使用唯一ID作为存储键
            this.loadedPrompts.set(uniqueId, validatedPrompt);
            logger.debug(`使用兼容模式加载远程prompt: ${validatedPrompt.name} -> ID: ${uniqueId}`);
          }
          
          successCount++;
        } catch (error) {
          errorCount++;
          this.loadErrors.set(promptData.name || 'unknown', error.message);
          logger.error(`验证远程prompt失败:`, error.message);
        }
      }

      logger.info(`远程Prompt加载完成: 成功 ${successCount} 个, 失败 ${errorCount} 个`);
      
      return {
        success: successCount,
        errorCount: errorCount,
        prompts: Array.from(this.loadedPrompts.values()),
        loadErrors: Object.fromEntries(this.loadErrors)
      };
    } catch (error) {
      logger.error('加载远程prompts时发生错误:', error);
      throw error;
    }
  }

  /**
   * 递归扫描目录，获取所有prompt文件
   * 
   * @param {string} currentPath  - 当前目录路径
   * @param {string} relativePath - 相对于当前目录的路径
   * @returns {Array} 所有prompt文件
   */
  async scanPromptFiles(currentPath, relativePath = '') {
    const promptFiles = [];

    if (relativePath) {
      // console.log('读取组元数据:', "{relativePath:", relativePath, ", currentPath:", currentPath, "}");
      const meta = this.readGroupMeta(path.join(currentPath, relativePath));
      if (meta.enabled === false) {
        return [];
      }
    }
    
    try {
      const items = await fs.readdir(currentPath, { withFileTypes: true });
      // console.log('扫描目录:', "{currentPath:", currentPath, ", items:", items, "}");
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);                                     // 文件的绝对路径，相对于当前目录，如：/home/work/prompt-manager/prompts/xxx/xxx.yaml
        const itemRelativePath = relativePath ? path.join(relativePath, item.name) : item.name; // 文件的相对路径，相对于当前目录，如：xxx/xxx.yaml

        if (item.isDirectory()) {
          // 递归扫描子目录
          const subFiles = await this.scanPromptFiles(itemPath, itemRelativePath);
          promptFiles.push(...subFiles);
        } else if (item.isFile()) {
          // 检查文件扩展名
          const ext = path.extname(item.name).toLowerCase();
          if (['.yaml', '.yml', '.json'].includes(ext)) {
            promptFiles.push({
              fileName: item.name,
              filePath: itemPath,
              relativePath: itemRelativePath
            });
          }
        }
      }
    } catch (error) {
      logger.warn(`扫描目录 ${currentPath} 时发生错误:`, error.message);
    }
    
    return promptFiles;
  }

  /**
   * 加载所有prompts
   */
  async loadPrompts() {
    // 如果配置了远程URL，则从远程加载
    if (config.remoteUrl) {
      return await this.loadRemotePrompts();
    }

    try {
      logger.info(`开始从 ${this.promptsDir} 加载prompts`);
      
      // 确保目录存在
      await fs.ensureDir(this.promptsDir);
      
      // 根据配置决定是否递归扫描
      let promptFiles;
      if (config.recursiveScan) {
        promptFiles = await this.scanPromptFiles(this.promptsDir);
      } else {
        // 只扫描根目录
        const files = await fs.readdir(this.promptsDir);
        promptFiles = files
          .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.yaml', '.yml', '.json'].includes(ext);
          })
          .map(file => ({
            fileName: file,
            filePath: path.join(this.promptsDir, file),
            relativePath: file
          }));
      }
      
      logger.debug(`找到 ${promptFiles.length} 个prompt文件`);

      // 清空之前的加载结果
      this.loadedPrompts.clear();
      this.loadErrors.clear();

      // 并行加载所有文件
      const loadPromises = promptFiles.map(fileInfo => this.loadPromptFile(fileInfo));
      const results = await Promise.allSettled(loadPromises);

      // 统计加载结果
      let successCount = 0;
      let errorCount = 0;

      let loadedCount   = 0;
      let disabledCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          if (result.value !== null) {
            loadedCount++;
          }else{
            disabledCount++;
          }
        } else {
          errorCount++;
          const fileInfo = promptFiles[index];
          const errorKey = fileInfo.relativePath || fileInfo.fileName;
          this.loadErrors.set(errorKey, result.reason.message);
          logger.error(`加载prompt文件 ${errorKey} 失败:`, result.reason.message);
        }
      });

      logger.info(`本地Prompt加载完成: 启用 ${loadedCount} 个, 禁用 ${disabledCount} 个, 失败 ${errorCount} 个\n`);
      
      return {
        success: loadedCount,
        errorCount: errorCount,
        prompts: Array.from(this.loadedPrompts.values()),
        loadErrors: Object.fromEntries(this.loadErrors)
      };
    } catch (error) {
      logger.error('加载prompts时发生错误:', error);
      throw error;
    }
  }

  /**
   * 加载单个prompt文件
   */
  async loadPromptFile(fileInfo) {
    // 支持旧的字符串参数格式（向后兼容）
    const fileName = typeof fileInfo === 'string' ? fileInfo : fileInfo.fileName;
    const filePath = typeof fileInfo === 'string' ? path.join(this.promptsDir, fileInfo) : fileInfo.filePath;
    const relativePath = typeof fileInfo === 'string' ? fileInfo : fileInfo.relativePath;
    
    if (fileName === GROUP_META_FILENAME) {
      // 跳过组元数据文件
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const ext = path.extname(fileName).toLowerCase();
      
      let promptData;
      if (ext === '.json') {
        promptData = JSON.parse(content);
      } else {
        promptData = YAML.parse(content);
      }

      if (promptData.enabled !== true) {
        logger.debug(`skipped loading prompt: ${promptData.name} -> disabled`);
        return null;
      }
      logger.debug(`loaded prompt: ${promptData.name} -> ${filePath}`);

      // 验证prompt数据结构
      const validatedPrompt = PromptSchema.parse(promptData);
      
      // 添加文件路径信息
      validatedPrompt.filePath = filePath;
      validatedPrompt.fileName = fileName;
      validatedPrompt.relativePath = relativePath;
      
      // 生成基于文件路径的唯一ID
      const uniqueId = this.generateUniqueId(relativePath);
      validatedPrompt.uniqueId = uniqueId;
      
      // 注册ID到路径的映射
      this.registerIdPathMapping(uniqueId, relativePath);
      
      // 使用唯一ID作为存储键
      this.loadedPrompts.set(uniqueId, validatedPrompt);
      logger.debug(`成功加载prompt: ${validatedPrompt.name} -> ID: ${uniqueId} (${relativePath})`);
      
      return validatedPrompt;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = `数据验证失败: ${error.errors.map(e => e.message).join(', ')}`;
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  /**
   * 获取所有已加载的prompts
   */
  getPrompts() {
    return Array.from(this.loadedPrompts.values());
  }

  /**
   * 根据ID获取prompt
   * @param {string} id - 唯一ID或原始名称（向后兼容）
   */
  getPrompt(id) {
    // 首先尝试直接匹配唯一ID
    if (this.loadedPrompts.has(id)) {
      return this.loadedPrompts.get(id);
    }
    
    // 如果直接匹配失败，尝试匹配原始名称（向后兼容）
    for (const [key, prompt] of this.loadedPrompts.entries()) {
      if (prompt.name === id || prompt.relativePath === id) {
        return prompt;
      }
    }
    
    return null;
  }

  /**
   * 根据名称获取prompt（向后兼容方法）
   * @deprecated 建议使用 getPrompt(id) 方法
   */
  getPromptByName(name) {
    return this.getPrompt(name);
  }

  /**
   * 获取prompt ID列表
   */
  getPromptNames() {
    return Array.from(this.loadedPrompts.keys());
  }

  /**
   * 验证prompt数据结构
   * @param {Object} promptData - 要验证的prompt数据
   * @returns {Object} 验证后的prompt数据
   */
  validatePromptData(promptData) {
    return PromptSchema.parse(promptData);
  }

  /**
   * 获取所有prompt的ID和路径映射
   */
  getIdPathMappings() {
    return Object.fromEntries(this.idToPathMap);
  }

  /**
   * 检查prompt是否存在
   */
  hasPrompt(name) {
    return this.loadedPrompts.has(name);
  }

  /**
   * 获取加载错误信息
   */
  getLoadErrors() {
    return Object.fromEntries(this.loadErrors);
  }

  /**
   * 重新加载prompts
   */
  async reloadPrompts() {
    logger.info('重新加载prompts');
    return await this.loadPrompts();
  }
}

// 创建全局PromptManager实例
export const promptManager = new PromptManager(config.getPromptsDir());