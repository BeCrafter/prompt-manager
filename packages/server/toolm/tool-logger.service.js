/**
 * 工具日志记录服务
 *
 * 职责：
 * 1. 为每个工具提供独立的日志记录器
 * 2. 日志自动写入到工具的 run.log 文件
 * 3. 自动清理过期日志
 * 4. 限制日志文件大小
 */

import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { pathExists } from './tool-utils.js';
import { config } from '../utils/config.js';

// 日志队列，用于批量写入
const logQueues = new Map();

// 日志清理间隔（1小时）
const CLEANUP_INTERVAL = 60 * 60 * 1000;

// 日志保留时间（3小时）
const LOG_RETENTION_HOURS = 3;

// 最大日志文件大小（10MB）
const MAX_LOG_SIZE = 10 * 1024 * 1024;

// 当日志文件过大时保留的行数
const MAX_LOG_LINES = 1000;

/**
 * 获取工具日志记录器
 * @param {string} toolName - 工具名称
 * @returns {object} 日志记录器对象
 */
export function getLogger(toolName) {
  if (!logQueues.has(toolName)) {
    logQueues.set(toolName, []);
  }

  const logQueue = logQueues.get(toolName);

  return {
    info: (message, meta) => log(toolName, 'INFO', message, meta),
    warn: (message, meta) => log(toolName, 'WARN', message, meta),
    error: (message, meta) => log(toolName, 'ERROR', message, meta),
    debug: (message, meta) => log(toolName, 'DEBUG', message, meta)
  };

  function log(toolName, level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

    const logEntry = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

    // 添加到队列
    logQueue.push(logEntry);

    // 如果队列达到一定大小，立即刷新
    if (logQueue.length >= 10) {
      flushLogQueue(toolName).catch(error => {
        logger.error(`刷新工具日志队列失败: ${toolName}`, { error: error.message });
      });
    } else {
      // 延迟刷新，批量写入
      setTimeout(() => {
        flushLogQueue(toolName).catch(error => {
          logger.error(`刷新工具日志队列失败: ${toolName}`, { error: error.message });
        });
      }, 100);
    }
  }
}

/**
 * 刷新日志队列
 * @param {string} toolName - 工具名称
 */
async function flushLogQueue(toolName) {
  const logQueue = logQueues.get(toolName);
  if (!logQueue || logQueue.length === 0) {
    return;
  }

  const toolDir = config.getToolDir(toolName);
  const logFilePath = path.join(toolDir, 'run.log');

  try {
    // 确保目录存在
    await fs.ensureDir(toolDir);

    // 读取现有日志（如果存在）
    let existingLogs = '';
    if (await pathExists(logFilePath)) {
      existingLogs = await fs.readFile(logFilePath, 'utf-8');
    }

    // 清理过期日志
    const cleanedLogs = cleanOldLogs(existingLogs);

    // 合并新日志
    const newLogs = logQueue.join('');
    const allLogs = cleanedLogs + newLogs;

    // 检查日志文件大小
    const logsToWrite = allLogs.length > MAX_LOG_SIZE ? keepRecentLogs(allLogs) : allLogs;

    // 写入日志文件
    await fs.writeFile(logFilePath, logsToWrite, 'utf-8');

    // 清空队列
    logQueue.length = 0;
  } catch (error) {
    logger.error(`写入工具日志失败: ${toolName}`, { error: error.message });
  }
}

/**
 * 清理过期日志
 * @param {string} logs - 日志内容
 * @returns {string} 清理后的日志
 */
function cleanOldLogs(logs) {
  const lines = logs.split('\n');
  const now = Date.now();
  const retentionMs = LOG_RETENTION_HOURS * 60 * 60 * 1000;

  const validLines = [];

  for (const line of lines) {
    if (!line.trim()) {
      validLines.push(line);
      continue;
    }

    // 提取时间戳
    const timestampMatch = line.match(/^\[([^\]]+)\]/);
    if (timestampMatch) {
      try {
        const timestamp = new Date(timestampMatch[1]).getTime();
        if (now - timestamp < retentionMs) {
          validLines.push(line);
        }
      } catch (error) {
        // 无法解析时间戳，保留该行
        validLines.push(line);
      }
    } else {
      // 没有时间戳，保留该行
      validLines.push(line);
    }
  }

  return validLines.join('\n');
}

/**
 * 保留最近的日志行
 * @param {string} logs - 日志内容
 * @returns {string} 保留的日志
 */
function keepRecentLogs(logs) {
  const lines = logs.split('\n');
  const recentLines = lines.slice(-MAX_LOG_LINES);
  return `${recentLines.join('\n')}\n`;
}

/**
 * 启动定期清理任务
 */
export function startLogCleanupTask() {
  setInterval(async () => {
    const toolboxDir = config.getToolboxDir();

    if (!(await pathExists(toolboxDir))) {
      return;
    }

    try {
      const entries = await fs.readdir(toolboxDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const toolName = entry.name;
        const logFilePath = path.join(toolboxDir, toolName, 'run.log');

        if (await pathExists(logFilePath)) {
          const logs = await fs.readFile(logFilePath, 'utf-8');
          const cleanedLogs = cleanOldLogs(logs);

          if (cleanedLogs.length < logs.length) {
            await fs.writeFile(logFilePath, cleanedLogs, 'utf-8');
            logger.debug(`清理工具日志: ${toolName}`);
          }
        }
      }
    } catch (error) {
      logger.error('定期清理日志失败', { error: error.message });
    }
  }, CLEANUP_INTERVAL);

  logger.info('工具日志清理任务已启动');
}

/**
 * 强制刷新所有日志队列
 */
export async function flushAllLogQueues() {
  const toolNames = Array.from(logQueues.keys());
  for (const toolName of toolNames) {
    await flushLogQueue(toolName);
  }
}
