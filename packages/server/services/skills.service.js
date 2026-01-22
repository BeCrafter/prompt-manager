import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { util } from '../utils/util.js';
import { config } from '../utils/config.js';

// 技能限制常量
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 单个文件最大 10MB
const MAX_FILES_COUNT = 50; // 每个技能最多 50 个文件
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 技能总大小最大 100MB

/**
 * Skill元数据验证Schema（严格遵循官方文档）
 * 参考: https://code.claude.com/docs/zh-CN/skills#available-metadata-fields
 */
const SkillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1, '技能名称不能为空')
    .max(64, '技能名称不能超过64个字符')
    .regex(/^[a-z0-9-]+$/, '技能名称只能包含小写字母、数字和连字符'),

  description: z.string().min(1, '技能描述不能为空').max(1024, '技能描述不能超过1024个字符'),

  version: z.string().optional().default('0.0.1'),

  allowedTools: z.array(z.string()).optional(),

  model: z.string().optional(),

  context: z.enum(['fork', 'shared']).optional(),

  agent: z.string().optional(),

  userInvocable: z.boolean().optional().default(true),

  disableModelInvocation: z.boolean().optional().default(false),

  hooks: z
    .object({
      PreToolUse: z
        .array(
          z.object({
            matcher: z.string(),
            hooks: z.array(
              z.object({
                type: z.string(),
                command: z.string(),
                once: z.boolean().optional().default(false)
              })
            )
          })
        )
        .optional(),
      PostToolUse: z
        .array(
          z.object({
            matcher: z.string(),
            hooks: z.array(
              z.object({
                type: z.string(),
                command: z.string(),
                once: z.boolean().optional().default(false)
              })
            )
          })
        )
        .optional(),
      Stop: z
        .array(
          z.object({
            matcher: z.string(),
            hooks: z.array(
              z.object({
                type: z.string(),
                command: z.string()
              })
            )
          })
        )
        .optional()
    })
    .optional()
});

/**
 * 技能加载项（带元数据）
 * 注意：此 Schema 当前保留用于类型定义和文档目的
 */
/* eslint-disable no-unused-vars */
const SkillItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  allowedTools: z.array(z.string()).optional(),
  model: z.string().optional(),
  context: z.enum(['fork', 'shared']).optional(),
  agent: z.string().optional(),
  userInvocable: z.boolean().optional(),
  disableModelInvocation: z.boolean().optional(),
  hooks: z.any().optional(),
  type: z.enum(['built-in', 'custom']),
  filePath: z.string(),
  skillDir: z.string(),
  relativePath: z.string(),
  yamlContent: z.string(),
  markdownContent: z.string(),
  updatedAt: z.string().optional()
});

/**
 * 技能管理器类
 * 严格遵循 model.service.js 的设计模式
 */
class SkillsManager {
  constructor() {
    this.builtInDir = path.join(util.getBuiltInConfigsDir(), 'skills/built-in');
    this.customDir = config.getSkillsDir();
    this.loadedSkills = new Map();
    this.idToPathMap = new Map();
  }

  /**
   * 生成技能唯一ID（基于目录相对路径）
   * 遵循 model.service.js 的 generateUniqueId 模式
   */
  generateUniqueId(relativePath) {
    const hash = crypto.createHash('sha256');
    hash.update(relativePath);
    return hash.digest('hex').substring(0, 8);
  }

  /**
   * 确保目录存在
   */
  async ensureDirectories() {
    await fs.ensureDir(this.builtInDir);
    await fs.ensureDir(this.customDir);
  }

  /**
   * 加载所有技能
   * 遵循 model.service.js loadModels 模式
   */
  async loadSkills() {
    try {
      logger.info('开始加载技能配置');

      await this.ensureDirectories();

      this.loadedSkills.clear();
      this.idToPathMap.clear();

      // 加载内置技能
      await this.loadSkillsFromDir(this.builtInDir, true);

      // 加载自定义技能
      await this.loadSkillsFromDir(this.customDir, false);

      logger.info(`技能加载完成: 共 ${this.loadedSkills.size} 个技能`);

      return {
        success: this.loadedSkills.size,
        skills: Array.from(this.loadedSkills.values())
      };
    } catch (error) {
      logger.error('加载技能时发生错误:', error);
      throw error;
    }
  }

  /**
   * 从目录加载技能
   * 遵循 model.service.js loadModelsFromDir 模式
   */
  async loadSkillsFromDir(dir, isBuiltIn) {
    try {
      if (!fs.existsSync(dir)) {
        logger.warn(`技能目录不存在: ${dir}`);
        return;
      }

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;

        const skillDir = path.join(dir, entry.name);
        const skillFile = path.join(skillDir, 'SKILL.md');

        // 必须存在 SKILL.md 文件
        if (!fs.existsSync(skillFile)) {
          logger.warn(`技能目录缺少 SKILL.md: ${skillDir}`);
          continue;
        }

        try {
          const content = await fs.readFile(skillFile, 'utf8');
          const skill = await this.parseSkillFile(skillDir, entry.name, content, isBuiltIn);

          if (skill) {
            this.loadedSkills.set(skill.id, skill);
            this.idToPathMap.set(skill.id, skill.relativePath);
            logger.debug(`加载技能: ${skill.name} -> ID: ${skill.id} (${isBuiltIn ? '内置' : '自定义'})`);
          }
        } catch (error) {
          logger.error(`加载技能 ${entry.name} 失败:`, error.message);
        }
      }
    } catch (error) {
      logger.error(`扫描技能目录 ${dir} 时发生错误:`, error.message);
    }
  }

  /**
   * 解析SKILL.md文件
   * 严格遵循官方格式：YAML前置 + Markdown
   */
  async parseSkillFile(skillDir, dirName, content, isBuiltIn) {
    // 分离YAML前置和Markdown内容
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      throw new Error('SKILL.md 必须包含 YAML 前置部分（以 --- 包裹）');
    }

    const frontmatterYaml = frontmatterMatch[1];
    const markdownContent = frontmatterMatch[2].trim();

    // 解析YAML前置
    let frontmatter;
    try {
      frontmatter = yaml.load(frontmatterYaml);
    } catch (error) {
      throw new Error(`YAML 前置解析失败: ${error.message}`);
    }

    // 验证前置字段
    const validatedFrontmatter = SkillFrontmatterSchema.parse(frontmatter);

    // 生成唯一ID
    const relativePath = path.join(dirName, 'SKILL.md');
    const uniqueId = this.generateUniqueId(relativePath);

    // 获取所有文件
    const files = [];
    let totalSize = 0;
    try {
      const entries = await fs.readdir(skillDir, { withFileTypes: true });

      if (entries.length > MAX_FILES_COUNT) {
        logger.warn(`技能目录文件数量超过限制 (${entries.length} > ${MAX_FILES_COUNT}): ${skillDir}`);
      }

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          const filePath = path.join(skillDir, entry.name);
          const stats = await fs.stat(filePath);

          if (stats.size > MAX_FILE_SIZE) {
            logger.warn(`跳过超大文件 (${(stats.size / 1024).toFixed(2)}KB): ${filePath}`);
            continue;
          }

          if (totalSize + stats.size > MAX_TOTAL_SIZE) {
            logger.warn(`技能总大小超过限制，停止读取后续文件: ${skillDir}`);
            break;
          }

          const content = await fs.readFile(filePath, 'utf8');
          files.push({
            name: entry.name,
            content
          });
          totalSize += stats.size;

          if (files.length >= MAX_FILES_COUNT) break;
        }
      }
    } catch (error) {
      logger.error(`读取技能目录文件失败 ${skillDir}:`, error.message);
    }

    // 获取文件修改时间
    const skillFile = path.join(skillDir, 'SKILL.md');
    let updatedAt = '';
    try {
      const stats = await fs.stat(skillFile);
      updatedAt = stats.mtime.toISOString();
    } catch (error) {
      updatedAt = new Date().toISOString();
    }

    return {
      id: uniqueId,
      name: validatedFrontmatter.name,
      description: validatedFrontmatter.description,
      version: validatedFrontmatter.version,
      allowedTools: validatedFrontmatter.allowedTools,
      model: validatedFrontmatter.model,
      context: validatedFrontmatter.context,
      agent: validatedFrontmatter.agent,
      userInvocable: validatedFrontmatter.userInvocable,
      disableModelInvocation: validatedFrontmatter.disableModelInvocation,
      hooks: validatedFrontmatter.hooks,
      type: isBuiltIn ? 'built-in' : 'custom',
      filePath: path.join(skillDir, 'SKILL.md'),
      skillDir,
      relativePath,
      yamlContent: frontmatterYaml,
      markdownContent,
      fullContent: content,
      files,
      updatedAt
    };
  }

  /**
   * 获取所有已加载的技能
   */
  getSkills() {
    return Array.from(this.loadedSkills.values());
  }

  /**
   * 获取技能列表概要（不包含文件内容，用于列表展示）
   */
  getSkillsSummary() {
    return Array.from(this.loadedSkills.values()).map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      updatedAt: skill.updatedAt,
      type: skill.type,
      fileCount: skill.files ? skill.files.length : 1
    }));
  }

  /**
   * 根据ID获取技能
   */
  getSkill(id) {
    return this.loadedSkills.get(id) || null;
  }

  /**
   * 根据路径获取技能
   */
  getSkillByPath(relativePath) {
    const id = this.idToPathMap.get(relativePath);
    return id ? this.loadedSkills.get(id) : null;
  }

  /**
   * 创建新技能
   */
  async createSkill(skillData) {
    try {
      // 验证技能数据（验证失败会抛出异常）
      SkillFrontmatterSchema.parse(skillData.frontmatter);

      // 验证目录名称
      const dirName = skillData.name.replace(/[^a-z0-9-]/g, '-').toLowerCase();
      const skillDir = path.join(this.customDir, dirName);

      // 检查目录是否已存在
      if (fs.existsSync(skillDir)) {
        throw new Error(`技能 "${skillData.name}" 已存在（文件名冲突）`);
      }

      // 构建SKILL.md内容
      const yamlContent = yaml.dump(skillData.frontmatter, { indent: 2 });
      const fullContent = `---\n${yamlContent}---\n\n${skillData.markdown || ''}`;

      // 创建目录和文件
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), fullContent, 'utf8');

      // 写入其他文件
      if (skillData.files && Array.isArray(skillData.files)) {
        if (skillData.files.length > MAX_FILES_COUNT) {
          throw new Error(`文件数量超过限制 (最多 ${MAX_FILES_COUNT} 个)`);
        }

        let currentTotalSize = 0;
        for (const file of skillData.files) {
          if (file.name === 'SKILL.md') continue;

          const contentSize = Buffer.byteLength(file.content, 'utf8');
          if (contentSize > MAX_FILE_SIZE) {
            throw new Error(`文件 "${file.name}" 大小超过限制 (最大 1MB)`);
          }

          currentTotalSize += contentSize;
          if (currentTotalSize > MAX_TOTAL_SIZE) {
            throw new Error(`技能总大小超过限制 (最大 10MB)`);
          }

          // 确保文件名安全
          const safeName = file.name.replace(/[\\/]/g, '_');
          await fs.writeFile(path.join(skillDir, safeName), file.content, 'utf8');
        }
      }

      // 解析并加载技能
      const skill = await this.parseSkillFile(skillDir, dirName, fullContent, false);

      if (skill) {
        this.loadedSkills.set(skill.id, skill);
        this.idToPathMap.set(skill.id, skill.relativePath);
        logger.info(`创建技能: ${skill.name} -> ID: ${skill.id}`);
      }

      return skill;
    } catch (error) {
      logger.error('创建技能失败:', error);
      throw error;
    }
  }

  /**
   * 更新技能
   */
  async updateSkill(id, skillData) {
    try {
      const existingSkill = this.getSkill(id);

      if (!existingSkill) {
        throw new Error(`技能不存在: ${id}`);
      }

      if (existingSkill.type === 'built-in') {
        throw new Error('内置技能不能修改');
      }

      // 验证技能数据（验证失败会抛出异常）
      if (skillData.frontmatter) {
        SkillFrontmatterSchema.parse(skillData.frontmatter);
      }

      // 检查是否需要重命名目录（如果名称改变了）
      let skillDir = existingSkill.skillDir;
      let dirName = path.basename(skillDir);
      const newName = skillData.frontmatter?.name;

      if (newName && newName !== existingSkill.name) {
        const newDirName = newName.replace(/[^a-z0-9-]/g, '-').toLowerCase();
        const newSkillDir = path.join(path.dirname(skillDir), newDirName);

        if (newSkillDir !== skillDir) {
          // 检查新目录是否已存在
          if (fs.existsSync(newSkillDir)) {
            throw new Error(`无法重命名：技能目录 "${newDirName}" 已存在`);
          }
          // 执行重命名
          await fs.rename(skillDir, newSkillDir);
          skillDir = newSkillDir;
          dirName = newDirName;
          logger.info(`技能目录已重命名: ${existingSkill.skillDir} -> ${skillDir}`);
        }
      }

      // 构建SKILL.md内容
      let fullContent;
      if (skillData.frontmatter) {
        const yamlContent = yaml.dump(skillData.frontmatter, { indent: 2 });
        fullContent = `---\n${yamlContent}---\n\n${skillData.markdown || existingSkill.markdownContent}`;
      } else {
        // 如果没有提供 frontmatter，则保持原样，只更新 markdown 部分（如果提供）
        const yamlContent = existingSkill.yamlContent;
        fullContent = `---\n${yamlContent}---\n\n${skillData.markdown || existingSkill.markdownContent}`;
      }

      // 更新 SKILL.md 文件
      const skillFile = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillFile, fullContent, 'utf8');

      // 更新其他文件
      if (skillData.files && Array.isArray(skillData.files)) {
        if (skillData.files.length > MAX_FILES_COUNT) {
          throw new Error(`文件数量超过限制 (最多 ${MAX_FILES_COUNT} 个)`);
        }

        const currentFiles = await fs.readdir(skillDir);
        const newFileNames = skillData.files.map(f => f.name);

        // 写入/更新文件
        let currentTotalSize = 0;
        for (const file of skillData.files) {
          if (file.name === 'SKILL.md') continue;

          const contentSize = Buffer.byteLength(file.content, 'utf8');
          if (contentSize > MAX_FILE_SIZE) {
            throw new Error(`文件 "${file.name}" 大小超过限制 (最大 1MB)`);
          }

          currentTotalSize += contentSize;
          if (currentTotalSize > MAX_TOTAL_SIZE) {
            throw new Error(`技能总大小超过限制 (最大 10MB)`);
          }

          const safeName = file.name.replace(/[\\/]/g, '_');
          await fs.writeFile(path.join(skillDir, safeName), file.content, 'utf8');
        }

        // 删除已移除的文件
        for (const fileName of currentFiles) {
          if (fileName === 'SKILL.md' || fileName.startsWith('.')) continue;
          if (!newFileNames.includes(fileName)) {
            await fs.remove(path.join(skillDir, fileName));
          }
        }
      }

      // 重新解析
      const newSkill = await this.parseSkillFile(skillDir, dirName, fullContent, false);

      if (newSkill) {
        // 如果 ID 发生了变化（因为目录名变了），需要清理旧的 ID
        if (newSkill.id !== id) {
          this.loadedSkills.delete(id);
          this.idToPathMap.delete(id);
        }
        this.loadedSkills.set(newSkill.id, newSkill);
        this.idToPathMap.set(newSkill.id, newSkill.relativePath);
        logger.info(`更新技能: ${newSkill.name} -> ID: ${newSkill.id} (原 ID: ${id})`);
      }

      return newSkill;
    } catch (error) {
      logger.error('更新技能失败:', error);
      throw error;
    }
  }

  /**
   * 删除技能
   */
  async deleteSkill(id) {
    try {
      const skill = this.getSkill(id);

      if (!skill) {
        throw new Error(`技能不存在: ${id}`);
      }

      if (skill.type === 'built-in') {
        throw new Error('内置技能不能删除');
      }

      // 删除整个技能目录
      await fs.remove(skill.skillDir);

      // 从内存中移除
      this.loadedSkills.delete(id);
      this.idToPathMap.delete(id);

      logger.info(`删除技能: ${skill.name} -> ID: ${id}`);
    } catch (error) {
      logger.error('删除技能失败:', error);
      throw error;
    }
  }

  /**
   * 重新加载技能
   */
  async reloadSkills() {
    logger.info('重新加载技能');
    return await this.loadSkills();
  }

  /**
   * 验证技能数据结构
   */
  validateSkillFrontmatter(frontmatter) {
    return SkillFrontmatterSchema.parse(frontmatter);
  }

  /**
   * 解析SKILL.md内容（供API使用）
   */
  parseSkillContent(content) {
    return this.parseSkillFile('', 'temp', content, false);
  }

  /**
   * 复制技能（用于复制功能）
   */
  async duplicateSkill(id, newName) {
    try {
      const skill = this.getSkill(id);

      if (!skill) {
        throw new Error(`技能不存在: ${id}`);
      }

      // 验证新名称
      const newDirName = newName.replace(/[^a-z0-9-]/g, '-').toLowerCase();
      const newSkillDir = path.join(this.customDir, newDirName);

      if (fs.existsSync(newSkillDir)) {
        throw new Error(`技能 "${newName}" 已存在`);
      }

      // 复制目录
      await fs.copy(skill.skillDir, newSkillDir);

      // 读取并更新SKILL.md中的名称
      const newSkillFile = path.join(newSkillDir, 'SKILL.md');
      let newContent = await fs.readFile(newSkillFile, 'utf8');

      // 更新YAML前置中的名称
      const frontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (frontmatterMatch) {
        const frontmatter = yaml.load(frontmatterMatch[1]);
        frontmatter.name = newName;
        frontmatter.description = frontmatter.description || `${skill.description} (副本)`;
        const newYamlContent = yaml.dump(frontmatter, { indent: 2 });
        newContent = `---\n${newYamlContent}---\n${frontmatterMatch[2]}`;
        await fs.writeFile(newSkillFile, newContent, 'utf8');
      }

      // 重新加载技能
      await this.reloadSkills();

      // 返回新技能
      const newSkill = this.getSkillByPath(path.join(newDirName, 'SKILL.md'));
      return newSkill;
    } catch (error) {
      logger.error('复制技能失败:', error);
      throw error;
    }
  }
}

// 创建全局SkillsManager实例
export const skillsManager = new SkillsManager();

// 导出SkillsManager类供测试使用
export { SkillsManager };
