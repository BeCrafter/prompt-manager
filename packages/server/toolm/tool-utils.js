/**
 * 工具模块共享工具函数
 */

import { access } from 'fs/promises';

/**
 * 检查路径是否存在（替代 fs.pathExists，因为 fs-extra v11 中已移除）
 * @param {string} filePath - 文件或目录路径
 * @returns {Promise<boolean>}
 */
export async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

