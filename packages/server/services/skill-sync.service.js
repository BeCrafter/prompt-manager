import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import pkg from 'sync-hub';
const { createSyncer } = pkg;
import { logger } from '../utils/logger.js';
import { config } from '../utils/config.js';

function expandPath(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath.replace(/\$(\w+)|\$\{(\w+)\}/g, (match, varName1, varName2) => {
    const varName = varName1 || varName2;
    return process.env[varName] || match;
  });
}

/**
 * 技能全局同步服务
 * 职责：
 * 1. 管理同步配置（目标目录、开关）
 * 2. 监听技能目录变更并自动同步
 * 3. 提供手动同步接口
 */
class SkillSyncService {
  constructor() {
    this.configPath = path.join(config.getConfigsDir(), 'skill-sync.json');
    this.skillsDir = config.getSkillsDir();
    this.syncConfig = {
      enabled: false,
      targets: [],
      lastSyncTime: null,
      lastSyncMethod: null,
      error: null
    };
    this.watcher = null;
    this.syncHub = null;
  }

  /**
   * 初始化服务
   */
  async init() {
    try {
      await this.loadConfig();
      // 在测试环境下默认不启动监听，除非配置显式开启
      if (this.syncConfig.enabled && process.env.NODE_ENV !== 'test') {
        await this.startWatching();
      }
      logger.info('SkillSyncService 初始化完成');
    } catch (error) {
      logger.error('SkillSyncService 初始化失败:', error);
    }
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const data = await fs.readJson(this.configPath);
        this.syncConfig = { ...this.syncConfig, ...data };
      } else {
        await this.saveConfig();
      }
    } catch (error) {
      logger.error('加载同步配置失败:', error);
    }
  }

  /**
   * 保存配置
   */
  async saveConfig() {
    try {
      await fs.ensureDir(path.dirname(this.configPath));
      await fs.writeJson(this.configPath, this.syncConfig, { spaces: 2 });
    } catch (error) {
      logger.error('保存同步配置失败:', error);
    }
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置项
   */
  async updateConfig(newConfig) {
    const wasEnabled = this.syncConfig.enabled;
    this.syncConfig = { ...this.syncConfig, ...newConfig };
    await this.saveConfig();

    if (this.syncConfig.enabled && !wasEnabled) {
      await this.startWatching();
    } else if (!this.syncConfig.enabled && wasEnabled) {
      await this.stopWatching();
    } else if (this.syncConfig.enabled && wasEnabled) {
      // 如果目标目录改变，重启监听以确保同步到新位置
      await this.stopWatching();
      await this.startWatching();
    }
  }

  /**
   * 获取配置
   */
  getConfig() {
    return {
      ...this.syncConfig,
      effectiveSyncMethod: this.detectSyncMethod()
    };
  }

  getResolvedTargets() {
    return (this.syncConfig.targets || []).map(target => expandPath(target)).filter(Boolean);
  }

  detectSyncMethod() {
    const targets = this.getResolvedTargets();
    if (targets.length === 0) {
      return null;
    }

    for (const target of targets) {
      try {
        if (!fs.existsSync(target)) {
          return 'copy';
        }
        const stats = fs.lstatSync(target);
        if (!stats.isSymbolicLink()) {
          return 'copy';
        }
        const realTarget = fs.realpathSync(target);
        if (realTarget !== this.skillsDir) {
          return 'copy';
        }
      } catch (error) {
        return 'copy';
      }
    }

    return 'link';
  }

  /**
   * 开始监听目录
   */
  async startWatching() {
    if (this.watcher) return;
    const targets = this.getResolvedTargets();
    if (targets.length === 0) return;

    logger.info('开始监听技能目录变更并自动同步:', this.skillsDir);

    this.watcher = createSyncer(this.skillsDir, targets, {
      preferLink: true,
      fallbackToCopy: true,
      deleteOrphaned: false,
      ignorePatterns: ['**/.*']
    });

    const method = await this.watcher.sync(); // 启动前先同步一次
    this.syncConfig.lastSyncMethod = method || null;
    await this.saveConfig();
    if (method !== 'link') {
      this.watcher.watch();
    } else {
      logger.info('符号链接模式无需监听自动同步');
    }
  }

  /**
   * 停止监听
   */
  async stopWatching() {
    if (this.watcher) {
      await this.watcher.stopWatch();
      this.watcher = null;
      logger.info('已停止监听技能目录');
    }
  }

  /**
   * 执行同步
   */
  async runSync() {
    const targets = this.getResolvedTargets();
    if (targets.length === 0) {
      logger.warn('未配置同步目标目录，跳过同步');
      return;
    }

    try {
      logger.info('开始执行技能全局同步...');

      const syncer = createSyncer(this.skillsDir, targets, {
        preferLink: true,
        fallbackToCopy: true,
        deleteOrphaned: false,
        ignorePatterns: ['**/.*']
      });

      const method = await syncer.sync();

      this.syncConfig.lastSyncTime = new Date().toISOString();
      this.syncConfig.lastSyncMethod = method || null;
      this.syncConfig.error = null;
      await this.saveConfig();

      logger.info('技能全局同步完成');
      return { method };
    } catch (error) {
      logger.error('执行技能同步时发生错误:', error);
      this.syncConfig.error = error.message;
      await this.saveConfig();
      throw error;
    }
  }
}

export const skillSyncService = new SkillSyncService();
