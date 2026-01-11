/**
 * 作者配置同步服务
 *
 * 职责：
 * 1. 将作者配置从 packages/server/configs/ 同步到 ~/.prompt-manager/configs/
 * 2. 确保配置文件在工作目录可用
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { pathExists } from './tool-utils.js';
import { config } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 同步作者配置到沙箱环境
 */
export async function syncAuthorConfig() {
  logger.info('开始同步作者配置到沙箱环境...');

  let sourceDir;

  const isElectronPackaged = process.resourcesPath != null;

  const isNpmPackage = __dirname.includes('node_modules');

  if (isElectronPackaged) {
    sourceDir = path.join(process.resourcesPath, 'runtime', 'configs');
    logger.debug('Electron 打包环境，使用配置目录:', { sourceDir });
  } else if (isNpmPackage) {
    sourceDir = path.join(__dirname, '..', 'configs');
    logger.debug('NPM 包环境，使用配置目录:', { sourceDir });
  } else {
    sourceDir = path.join(__dirname, '..', '..', 'server', 'configs');
    logger.debug('开发环境，使用配置目录:', { sourceDir });
  }

  const sourceConfigPath = path.join(sourceDir, 'authors.json');
  const targetConfigPath = config.getConfigsDir();
  const targetConfigFile = path.join(targetConfigPath, 'authors.json');

  try {
    if (!(await pathExists(sourceConfigPath))) {
      logger.warn(`作者配置源文件不存在，跳过同步: ${sourceConfigPath}`);
      return;
    }

    await fs.ensureDir(targetConfigPath);

    const configExists = await pathExists(targetConfigFile);

    if (!configExists) {
      logger.info('首次同步，复制作者配置文件');
      await fs.copyFile(sourceConfigPath, targetConfigFile);
      logger.info('作者配置同步成功', { source: sourceConfigPath, target: targetConfigFile });
    } else {
      const sourceMtime = (await fs.stat(sourceConfigPath)).mtimeMs;
      const targetMtime = (await fs.stat(targetConfigFile)).mtimeMs;

      if (sourceMtime > targetMtime) {
        logger.info('源配置更新，同步作者配置文件');
        await fs.copyFile(sourceConfigPath, targetConfigFile);
        logger.info('作者配置同步成功', { source: sourceConfigPath, target: targetConfigFile });
      } else {
        logger.debug('作者配置已是最新，无需同步');
      }
    }

    const configData = await fs.readJson(targetConfigFile);
    const authorCount = Object.keys(configData.authors || {}).length;
    logger.info('作者配置同步完成', {
      author_count: authorCount,
      default_author: configData.settings?.default_author
    });
  } catch (error) {
    logger.error('同步作者配置失败:', error);

    if (error.code === 'ENOENT' && !(await pathExists(sourceConfigPath))) {
      logger.warn('源配置目录不存在，使用默认配置');
      const defaultConfig = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        authors: {},
        settings: {
          default_author: 'default'
        }
      };
      await fs.ensureDir(targetConfigPath);
      await fs.writeJson(targetConfigFile, defaultConfig);
      logger.info('创建默认作者配置文件');
    }
  }
}
