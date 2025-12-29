import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { z } from 'zod';
import crypto from 'crypto';
import os from 'os';
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';
import { util } from '../utils/util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 模板数据结构验证schema
 */
const TemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, '模板名称不能为空'),
  description: z.string().optional(),
  content: z.string().min(1, '模板内容不能为空'),
  isBuiltIn: z.boolean().optional().default(false),
  filePath: z.string().optional()
});

/**
 * 模板管理器类
 */
class TemplateManager {
  constructor() {
    this.builtInDir = path.join(util.getBuiltInConfigsDir(), 'templates/built-in');
    this.customDir = path.join(os.homedir(), '.prompt-manager/configs/templates');
    this.loadedTemplates = new Map();
    this.idToPathMap = new Map();
  }

  /**
   * 基于文件路径生成固定长度的唯一ID
   * @param {string} relativePath - 相对于模板目录的路径
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
   * 加载所有模板
   */
  async loadTemplates() {
    try {
      logger.info('开始加载优化模板');

      // 确保目录存在
      await this.ensureDirectories();

      // 清空之前的加载结果
      this.loadedTemplates.clear();
      this.idToPathMap.clear();

      // 加载内置模板
      await this.loadTemplatesFromDir(this.builtInDir, true);

      // 加载用户自定义模板
      await this.loadTemplatesFromDir(this.customDir, false);

      logger.info(`模板加载完成: 共 ${this.loadedTemplates.size} 个模板`);

      return {
        success: this.loadedTemplates.size,
        templates: Array.from(this.loadedTemplates.values())
      };
    } catch (error) {
      logger.error('加载模板时发生错误:', error);
      throw error;
    }
  }

  /**
   * 从指定目录加载模板
   * @param {string} dir - 目录路径
   * @param {boolean} isBuiltIn - 是否为内置模板
   */
  async loadTemplatesFromDir(dir, isBuiltIn) {
    try {
      if (!fs.existsSync(dir)) {
        logger.warn(`模板目录不存在: ${dir}`);
        return;
      }

      const files = await fs.readdir(dir);
      const templateFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.yaml', '.yml', '.json'].includes(ext);
      });

      for (const fileName of templateFiles) {
        const filePath = path.join(dir, fileName);
        const relativePath = fileName;

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const ext = path.extname(fileName).toLowerCase();

          let templateData;
          if (ext === '.json') {
            templateData = JSON.parse(content);
          } else {
            templateData = YAML.parse(content);
          }

          // 验证模板数据结构
          const validatedTemplate = TemplateSchema.parse(templateData);

          // 添加元数据
          validatedTemplate.isBuiltIn = isBuiltIn;
          validatedTemplate.filePath = filePath;

          // 生成唯一ID
          const uniqueId = this.generateUniqueId(relativePath);
          validatedTemplate.id = uniqueId;

          // 注册ID到路径的映射
          this.registerIdPathMapping(uniqueId, relativePath);

          // 存储模板
          this.loadedTemplates.set(uniqueId, validatedTemplate);

          logger.debug(`加载模板: ${validatedTemplate.name} -> ID: ${uniqueId} (${isBuiltIn ? '内置' : '自定义'})`);
        } catch (error) {
          logger.error(`加载模板文件 ${fileName} 失败:`, error.message);
        }
      }
    } catch (error) {
      logger.error(`扫描模板目录 ${dir} 时发生错误:`, error.message);
    }
  }

  /**
   * 获取所有已加载的模板
   */
  getTemplates() {
    return Array.from(this.loadedTemplates.values());
  }

  /**
   * 根据ID获取模板
   * @param {string} id - 模板ID
   */
  getTemplate(id) {
    return this.loadedTemplates.get(id) || null;
  }

  /**
   * 创建新模板
   * @param {Object} templateData - 模板数据
   * @returns {Object} 创建的模板
   */
  async createTemplate(templateData) {
    try {
      // 验证模板数据
      const validatedTemplate = TemplateSchema.parse(templateData);

      // 生成文件名（使用名称的拼音或英文，这里简化为使用名称）
      const fileName = `${validatedTemplate.name.replace(/\s+/g, '_')}.yaml`;
      const filePath = path.join(this.customDir, fileName);

      // 检查文件是否已存在
      if (fs.existsSync(filePath)) {
        throw new Error(`模板 ${validatedTemplate.name} 已存在`);
      }

      // 准备保存的数据
      const dataToSave = {
        name: validatedTemplate.name,
        description: validatedTemplate.description || '',
        content: validatedTemplate.content
      };

      // 保存为 YAML 文件
      await fs.writeFile(filePath, YAML.stringify(dataToSave), 'utf8');

      // 生成唯一ID
      const uniqueId = this.generateUniqueId(fileName);

      // 更新模板数据
      validatedTemplate.id = uniqueId;
      validatedTemplate.isBuiltIn = false;
      validatedTemplate.filePath = filePath;

      // 注册ID到路径的映射
      this.registerIdPathMapping(uniqueId, fileName);

      // 存储到内存
      this.loadedTemplates.set(uniqueId, validatedTemplate);

      logger.info(`创建模板: ${validatedTemplate.name} -> ID: ${uniqueId}`);

      return validatedTemplate;
    } catch (error) {
      logger.error('创建模板失败:', error);
      throw error;
    }
  }

  /**
   * 更新模板
   * @param {string} id - 模板ID
   * @param {Object} templateData - 新的模板数据
   * @returns {Object} 更新后的模板
   */
  async updateTemplate(id, templateData) {
    try {
      const existingTemplate = this.getTemplate(id);

      if (!existingTemplate) {
        throw new Error(`模板不存在: ${id}`);
      }

      // 内置模板不能修改
      if (existingTemplate.isBuiltIn) {
        throw new Error('内置模板不能修改');
      }

      // 验证模板数据
      const validatedTemplate = TemplateSchema.parse(templateData);

      // 准备保存的数据
      const dataToSave = {
        name: validatedTemplate.name,
        description: validatedTemplate.description || '',
        content: validatedTemplate.content
      };

      // 更新文件
      await fs.writeFile(existingTemplate.filePath, YAML.stringify(dataToSave), 'utf8');

      // 更新内存中的数据
      existingTemplate.name = validatedTemplate.name;
      existingTemplate.description = validatedTemplate.description;
      existingTemplate.content = validatedTemplate.content;

      logger.info(`更新模板: ${existingTemplate.name} -> ID: ${id}`);

      return existingTemplate;
    } catch (error) {
      logger.error('更新模板失败:', error);
      throw error;
    }
  }

  /**
   * 删除模板
   * @param {string} id - 模板ID
   */
  async deleteTemplate(id) {
    try {
      const template = this.getTemplate(id);

      if (!template) {
        throw new Error(`模板不存在: ${id}`);
      }

      // 内置模板不能删除
      if (template.isBuiltIn) {
        throw new Error('内置模板不能删除');
      }

      // 删除文件
      await fs.remove(template.filePath);

      // 从内存中移除
      this.loadedTemplates.delete(id);
      this.idToPathMap.delete(id);

      logger.info(`删除模板: ${template.name} -> ID: ${id}`);
    } catch (error) {
      logger.error('删除模板失败:', error);
      throw error;
    }
  }

  /**
   * 重新加载模板
   */
  async reloadTemplates() {
    logger.info('重新加载模板');
    return await this.loadTemplates();
  }

  /**
   * 验证模板数据结构
   * @param {Object} templateData - 要验证的模板数据
   * @returns {Object} 验证后的模板数据
   */
  validateTemplateData(templateData) {
    return TemplateSchema.parse(templateData);
  }
}

// 创建全局TemplateManager实例
export const templateManager = new TemplateManager();

// 导出TemplateManager类供测试使用
export { TemplateManager };