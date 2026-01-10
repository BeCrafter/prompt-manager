/**
 * 工具存储服务
 *
 * 职责：
 * 1. 为每个工具提供独立的存储空间
 * 2. 数据持久化到工具目录的 data 目录
 * 3. 提供简单的 key-value 存储接口
 */

import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { pathExists } from './tool-utils.js';
import { config } from '../utils/config.js';

// 存储缓存：toolName -> storage data
const storageCache = new Map();

/**
 * 获取工具存储服务
 * @param {string} toolName - 工具名称
 * @returns {object} 存储服务对象
 */
export function getStorage(toolName) {
  if (!storageCache.has(toolName)) {
    storageCache.set(toolName, {});
  }

  const storage = storageCache.get(toolName);
  const storageFile = getStorageFilePath(toolName);

  // 加载存储数据（如果存在）
  loadStorageData(toolName, storageFile, storage);

  return {
    getItem: key => {
      return storage[key];
    },

    setItem: (key, value) => {
      storage[key] = value;
      // 异步保存
      saveStorageData(toolName, storageFile, storage).catch(error => {
        logger.error(`保存工具存储失败: ${toolName}`, { error: error.message });
      });
    },

    removeItem: key => {
      delete storage[key];
      // 异步保存
      saveStorageData(toolName, storageFile, storage).catch(error => {
        logger.error(`保存工具存储失败: ${toolName}`, { error: error.message });
      });
    },

    clear: () => {
      storageCache.set(toolName, {});
      // 删除存储文件
      fs.remove(storageFile).catch(error => {
        logger.error(`删除工具存储文件失败: ${toolName}`, { error: error.message });
      });
    }
  };
}

/**
 * 获取存储文件路径
 * @param {string} toolName - 工具名称
 * @returns {string} 存储文件路径
 */
function getStorageFilePath(toolName) {
  const toolDir = config.getToolDir(toolName);
  return path.join(toolDir, 'data', 'storage.json');
}

/**
 * 加载存储数据
 * @param {string} toolName - 工具名称
 * @param {string} storageFile - 存储文件路径
 * @param {object} storage - 存储对象
 */
async function loadStorageData(toolName, storageFile, storage) {
  try {
    if (await pathExists(storageFile)) {
      const data = await fs.readJson(storageFile);
      Object.assign(storage, data);
      logger.debug(`工具 ${toolName} 存储数据已加载`);
    }
  } catch (error) {
    logger.warn(`加载工具存储数据失败: ${toolName}`, { error: error.message });
  }
}

/**
 * 保存存储数据
 * @param {string} toolName - 工具名称
 * @param {string} storageFile - 存储文件路径
 * @param {object} storage - 存储对象
 */
async function saveStorageData(toolName, storageFile, storage) {
  try {
    const toolDir = path.dirname(storageFile);
    await fs.ensureDir(toolDir);
    await fs.writeJson(storageFile, storage, { spaces: 2 });
    logger.debug(`工具 ${toolName} 存储数据已保存`);
  } catch (error) {
    logger.error(`保存工具存储数据失败: ${toolName}`, { error: error.message });
    throw error;
  }
}
