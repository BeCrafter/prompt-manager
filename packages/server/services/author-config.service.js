/**
 * 作者配置加载服务
 *
 * 职责：
 * - 从配置文件加载作者信息
 * - 构建别名映射
 * - 提供作者查询接口
 *
 * 注意：此服务只负责读取配置，不允许在程序中设置作者信息
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AuthorConfigService {
  constructor() {
    this.config = null;
    this.aliasMap = new Map();
    this.cacheTTL = 24 * 60 * 60 * 1000;
    this.lastLoadTime = 0;
  }

  getConfigPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const isNpmPackage = __dirname.includes('node_modules');
    const isDist = __dirname.includes('dist');
    const isElectronPackaged = process.resourcesPath != null;

    if (isElectronPackaged) {
      return path.join(process.resourcesPath, 'runtime', 'configs', 'authors.json');
    }

    if (isNpmPackage) {
      return path.join(__dirname, '..', 'configs', 'authors.json');
    }

    if (isDist) {
      return path.join(__dirname, '..', 'configs', 'authors.json');
    }

    return path.join(__dirname, '..', 'configs', 'authors.json');
  }

  async loadConfig() {
    const now = Date.now();

    if (this.config && now - this.lastLoadTime < this.cacheTTL) {
      return this.config;
    }

    const configPath = this.getConfigPath();
    logger.debug('Loading author config from path', { configPath });

    try {
      const configData = await fs.readJson(configPath);

      if (!configData.authors) {
        throw new Error('配置文件格式错误：缺少 authors 字段');
      }

      this.config = configData;
      this.lastLoadTime = now;

      this.buildAliasMap();

      logger.info('Author config loaded successfully', {
        authorCount: Object.keys(configData.authors).length
      });

      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn('作者配置文件不存在，将使用默认配置', { path: configPath });
        return this.getDefaultConfig();
      } else {
        logger.error('加载作者配置失败:', error);
        return this.getDefaultConfig();
      }
    }
  }

  buildAliasMap() {
    this.aliasMap.clear();

    if (!this.config || !this.config.authors) {
      return;
    }

    for (const [authorId, author] of Object.entries(this.config.authors)) {
      this.aliasMap.set(authorId.toLowerCase(), authorId);

      if (author.name) {
        this.aliasMap.set(author.name.toLowerCase(), authorId);
      }

      if (author.aliases && Array.isArray(author.aliases)) {
        for (const alias of author.aliases) {
          this.aliasMap.set(alias.toLowerCase(), authorId);
        }
      }
    }
  }

  async resolveAuthor(authorInput) {
    await this.loadConfig();

    if (!this.config || !this.config.settings) {
      logger.debug('Using default author info (config not loaded)');
      return this.getDefaultAuthorInfo();
    }

    if (!authorInput) {
      const defaultAuthorId = this.config.settings.default_author;
      return this.getAuthorInfo(defaultAuthorId);
    }

    const normalized = authorInput.toString().trim().toLowerCase();

    if (this.aliasMap.has(normalized)) {
      const authorId = this.aliasMap.get(normalized);
      logger.debug('Author resolved via alias map', { alias: authorInput, authorId });
      return this.getAuthorInfo(authorId);
    }

    logger.warn(`未知作者 "${authorInput}"，将使用默认作者`);
    const defaultAuthorId = this.config.settings.default_author;
    return this.getAuthorInfo(defaultAuthorId);
  }

  getGitHubAvatarUrl(githubUrl) {
    if (!githubUrl) return null;

    /*eslint no-useless-escape: "off"*/
    const match = githubUrl.match(/github\.com\/([^\/]+)/i);
    if (!match) return null;
    return `https://github.com/${match[1]}.png`;
  }

  getAuthorInfo(authorId) {
    if (!this.config || !this.config.authors) {
      return this.getDefaultAuthorInfo();
    }

    const author = this.config.authors[authorId];

    if (!author) {
      logger.warn(`作者 "${authorId}" 不存在于配置中`);
      return this.getDefaultAuthorInfo();
    }

    return {
      id: authorId,
      name: author.name || authorId,
      github: author.github || null,
      homepage: author.homepage || null,
      bio: author.bio || '开发者',
      featured: author.featured || false,
      sort_order: author.sort_order || 999,
      aliases: author.aliases || [],
      avatar_url: author.github ? this.getGitHubAvatarUrl(author.github) : null
    };
  }

  async getAllAuthors() {
    await this.loadConfig();

    if (!this.config || !this.config.authors) {
      return [];
    }

    const authors = Object.entries(this.config.authors)
      .map(([id, author]) => ({
        id,
        name: author.name || id,
        github: author.github || null,
        homepage: author.homepage || null,
        bio: author.bio || '开发者',
        featured: author.featured || false,
        sort_order: author.sort_order || 999,
        aliases: author.aliases || []
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    return authors;
  }

  getDefaultAuthorInfo() {
    return {
      id: 'default',
      name: 'Unknown',
      github: null,
      homepage: null,
      bio: '开发者',
      featured: false,
      sort_order: 999,
      aliases: []
    };
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      authors: {},
      settings: {
        default_author: 'default',
        cache_avatar_hours: 24
      }
    };
  }

  async reload() {
    this.lastLoadTime = 0;
    this.aliasMap.clear();
    return await this.loadConfig();
  }
}

export const authorConfigService = new AuthorConfigService();
