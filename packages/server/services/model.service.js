import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';
import { z } from 'zod';
import crypto from 'crypto';
import os from 'os';
import { logger } from '../utils/logger.js';
import { util } from '../utils/util.js';

/**
 * 模型数据结构验证schema
 */
const ModelSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '模型名称不能为空'),
  provider: z.string().min(1, '提供商不能为空'),
  model: z.string().min(1, '模型名称不能为空'),
  apiEndpoint: z.string().url('API端点必须是有效的URL'),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  isBuiltIn: z.boolean().optional().default(false),
  filePath: z.string().optional()
});

/**
 * 加密密钥（从环境变量获取，如果没有则使用默认密钥）
 * 注意：在生产环境中应该使用强密钥并妥善保管
 */
const ENCRYPTION_KEY = process.env.MODEL_ENCRYPTION_KEY || 'default-encryption-key-32-bytes!';
const ALGORITHM = 'aes-256-cbc';

/**
 * 模型管理器类
 */
class ModelManager {
  constructor() {
    this.builtInDir = path.join(util.getBuiltInConfigsDir(), 'models/built-in');
    this.customDir = path.join(os.homedir(), '.prompt-manager/configs/models');
    this.loadedModels = new Map();
    this.idToPathMap = new Map();
    this.providersConfig = null;
  }

  /**
   * 基于文件路径生成固定长度的唯一ID
   * @param {string} relativePath - 相对于模型目录的路径
   * @returns {string} 固定长度的唯一ID字符串（8位）
   */
  generateUniqueId(relativePath) {
    const hash = crypto.createHash('sha256');
    hash.update(relativePath);
    const hashHex = hash.digest('hex');
    return hashHex.substring(0, 8);
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
   * 确保目录存在
   */
  async ensureDirectories() {
    await fs.ensureDir(this.builtInDir);
    await fs.ensureDir(this.customDir);
  }

  /**
   * 加载提供商配置
   * @returns {Object} 提供商配置
   */
  async loadProvidersConfig() {
    if (this.providersConfig) {
      return this.providersConfig;
    }

    const providersConfigPath = path.join(util.getBuiltInConfigsDir(), 'models/providers.yaml');

    try {
      if (fs.existsSync(providersConfigPath)) {
        const content = await fs.readFile(providersConfigPath, 'utf-8');
        this.providersConfig = YAML.parse(content);
        logger.info('提供商配置加载成功:', providersConfigPath);
        return this.providersConfig;
      }
    } catch (error) {
      logger.warn('加载提供商配置失败:', error.message);
    }

    this.providersConfig = { providers: {} };
    return this.providersConfig;
  }

  /**
   * 获取提供商列表
   * @returns {Array} 提供商列表
   */
  async getProviders() {
    const config = await this.loadProvidersConfig();
    return Object.entries(config.providers || {}).map(([key, value]) => ({
      key,
      ...value
    }));
  }

  /**
   * 获取提供商的默认配置
   * @param {string} providerKey - 提供商键名
   * @returns {Object} 提供商默认配置
   */
  async getProviderDefaults(providerKey) {
    const config = await this.loadProvidersConfig();
    const provider = config.providers?.[providerKey];

    if (!provider) {
      return null;
    }

    return {
      provider: provider.name,
      model: provider.defaultModel,
      apiEndpoint: provider.defaultEndpoint,
      models: provider.models || []
    };
  }

  /**
   * 加密 API Key
   * @param {string} text - 要加密的文本
   * @returns {string} 加密后的文本
   */
  encrypt(text) {
    if (!text) return '';

    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('加密失败:', error);
      throw error;
    }
  }

  /**
   * 解密 API Key
   * @param {string} text - 要解密的文本
   * @returns {string} 解密后的文本
   */
  decrypt(text) {
    if (!text) return '';

    try {
      const parts = text.split(':');
      const iv = Buffer.from(parts.shift(), 'hex');
      const encrypted = parts.join(':');
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('解密失败:', error);
      throw error;
    }
  }

  /**
   * 加载所有模型
   */
  async loadModels() {
    try {
      logger.info('开始加载模型配置');

      // 确保目录存在
      await this.ensureDirectories();

      // 清空之前的加载结果
      this.loadedModels.clear();
      this.idToPathMap.clear();

      // 加载内置模型
      await this.loadModelsFromDir(this.builtInDir, true);

      // 加载用户自定义模型
      await this.loadModelsFromDir(this.customDir, false);

      logger.info(`模型加载完成: 共 ${this.loadedModels.size} 个模型`);

      return {
        success: this.loadedModels.size,
        models: Array.from(this.loadedModels.values())
      };
    } catch (error) {
      logger.error('加载模型时发生错误:', error);
      throw error;
    }
  }

  /**
   * 从指定目录加载模型
   * @param {string} dir - 目录路径
   * @param {boolean} isBuiltIn - 是否为内置模型
   */
  async loadModelsFromDir(dir, isBuiltIn) {
    try {
      if (!fs.existsSync(dir)) {
        logger.warn(`模型目录不存在: ${dir}`);
        return;
      }

      const files = await fs.readdir(dir);
      const modelFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.yaml', '.yml', '.json'].includes(ext);
      });

      for (const fileName of modelFiles) {
        const filePath = path.join(dir, fileName);
        const relativePath = fileName;

        try {
          let content = await fs.readFile(filePath, 'utf8');
          const ext = path.extname(fileName).toLowerCase();

          // 环境变量替换 (支持 ${VAR} 格式)
          content = content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
            return process.env[varName] || '';
          });

          let modelData;
          if (ext === '.json') {
            modelData = JSON.parse(content);
          } else {
            modelData = YAML.parse(content);
          }

          // 验证模型数据结构
          const validatedModel = ModelSchema.parse(modelData);

          // 添加元数据
          validatedModel.isBuiltIn = isBuiltIn;
          validatedModel.filePath = filePath;

          // 解密 API Key（仅对自定义模型）
          if (validatedModel.apiKey && !isBuiltIn) {
            try {
              validatedModel.apiKey = this.decrypt(validatedModel.apiKey);
            } catch (error) {
              logger.warn(`解密模型 ${validatedModel.name} 的 API Key 失败，将使用空值`);
              validatedModel.apiKey = '';
            }
          }
          // 内置模型的 API Key 直接使用配置文件中的值（明文）

          // 生成唯一ID
          const uniqueId = this.generateUniqueId(relativePath);
          validatedModel.id = uniqueId;

          // 注册ID到路径的映射
          this.registerIdPathMapping(uniqueId, relativePath);

          // 存储模型
          this.loadedModels.set(uniqueId, validatedModel);

          logger.debug(`加载模型: ${validatedModel.name} -> ID: ${uniqueId} (${isBuiltIn ? '内置' : '自定义'})`);
        } catch (error) {
          logger.error(`加载模型文件 ${fileName} 失败:`, error.message);
        }
      }
    } catch (error) {
      logger.error(`扫描模型目录 ${dir} 时发生错误:`, error.message);
    }
  }

  /**
   * 获取所有已加载的模型
   */
  getModels() {
    return Array.from(this.loadedModels.values());
  }

  /**
   * 根据ID获取模型
   * @param {string} id - 模型ID
   */
  getModel(id) {
    return this.loadedModels.get(id) || null;
  }

  /**
   * 创建新模型
   * @param {Object} modelData - 模型数据
   * @returns {Object} 创建的模型
   */
  async createModel(modelData) {
    try {
      // 验证模型数据
      const validatedModel = ModelSchema.parse(modelData);

      // 生成文件名
      const fileName = `${validatedModel.name.replace(/\s+/g, '_')}.yaml`;
      const filePath = path.join(this.customDir, fileName);

      // 检查文件是否已存在
      if (fs.existsSync(filePath)) {
        throw new Error(`模型 ${validatedModel.name} 已存在`);
      }

      // 加密 API Key
      const encryptedApiKey = validatedModel.apiKey ? this.encrypt(validatedModel.apiKey) : '';

      // 准备保存的数据
      const dataToSave = {
        name: validatedModel.name,
        provider: validatedModel.provider,
        model: validatedModel.model,
        apiEndpoint: validatedModel.apiEndpoint,
        apiKey: encryptedApiKey,
        enabled: validatedModel.enabled !== false
      };

      // 保存为 YAML 文件
      await fs.writeFile(filePath, YAML.stringify(dataToSave), 'utf8');

      // 生成唯一ID
      const uniqueId = this.generateUniqueId(fileName);

      // 更新模型数据
      validatedModel.id = uniqueId;
      validatedModel.isBuiltIn = false;
      validatedModel.filePath = filePath;

      // 注册ID到路径的映射
      this.registerIdPathMapping(uniqueId, fileName);

      // 存储到内存
      this.loadedModels.set(uniqueId, validatedModel);

      logger.info(`创建模型: ${validatedModel.name} -> ID: ${uniqueId}`);

      return validatedModel;
    } catch (error) {
      logger.error('创建模型失败:', error);
      throw error;
    }
  }

  /**
   * 更新模型
   * @param {string} id - 模型ID
   * @param {Object} modelData - 新的模型数据
   * @returns {Object} 更新后的模型
   */
  async updateModel(id, modelData) {
    try {
      const existingModel = this.getModel(id);

      if (!existingModel) {
        throw new Error(`模型不存在: ${id}`);
      }

      // 内置模型不能修改
      if (existingModel.isBuiltIn) {
        throw new Error('内置模型不能修改');
      }

      // 验证模型数据
      const validatedModel = ModelSchema.parse(modelData);

      // 加密 API Key
      const encryptedApiKey = validatedModel.apiKey ? this.encrypt(validatedModel.apiKey) : '';

      // 准备保存的数据
      const dataToSave = {
        name: validatedModel.name,
        provider: validatedModel.provider,
        model: validatedModel.model,
        apiEndpoint: validatedModel.apiEndpoint,
        apiKey: encryptedApiKey,
        enabled: validatedModel.enabled !== false
      };

      // 更新文件
      await fs.writeFile(existingModel.filePath, YAML.stringify(dataToSave), 'utf8');

      // 更新内存中的数据
      existingModel.name = validatedModel.name;
      existingModel.provider = validatedModel.provider;
      existingModel.model = validatedModel.model;
      existingModel.apiEndpoint = validatedModel.apiEndpoint;
      existingModel.apiKey = validatedModel.apiKey;
      existingModel.enabled = validatedModel.enabled;

      logger.info(`更新模型: ${existingModel.name} -> ID: ${id}`);

      return existingModel;
    } catch (error) {
      logger.error('更新模型失败:', error);
      throw error;
    }
  }

  /**
   * 删除模型
   * @param {string} id - 模型ID
   */
  async deleteModel(id) {
    try {
      const model = this.getModel(id);

      if (!model) {
        throw new Error(`模型不存在: ${id}`);
      }

      // 内置模型不能删除
      if (model.isBuiltIn) {
        throw new Error('内置模型不能删除');
      }

      // 删除文件
      await fs.remove(model.filePath);

      // 从内存中移除
      this.loadedModels.delete(id);
      this.idToPathMap.delete(id);

      logger.info(`删除模型: ${model.name} -> ID: ${id}`);
    } catch (error) {
      logger.error('删除模型失败:', error);
      throw error;
    }
  }

  /**
   * 重新加载模型
   */
  async reloadModels() {
    logger.info('重新加载模型');
    return await this.loadModels();
  }

  /**
   * 验证模型数据结构
   * @param {Object} modelData - 要验证的模型数据
   * @returns {Object} 验证后的模型数据
   */
  validateModelData(modelData) {
    return ModelSchema.parse(modelData);
  }
}

// 创建全局ModelManager实例
export const modelManager = new ModelManager();

// 导出ModelManager类供测试使用
export { ModelManager };
