/**
 * 工具模式处理器服务
 *
 * 职责：
 * 1. 处理 manual 模式 - 显示工具手册
 * 2. 处理 configure 模式 - 配置工具环境变量
 * 3. 处理 log 模式 - 查看工具日志
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';
import { toolLoaderService } from './tool-loader.service.js';
import { saveToolEnvironment, getToolEnvironmentInfo } from './tool-environment.service.js';
import { flushAllLogQueues } from './tool-logger.service.js';
import { pathExists } from './tool-utils.js';
import { executeTool } from './tool-execution.service.js';

/**
 * 处理 manual 模式 - 显示工具手册
 * @param {string} toolName - 工具名称
 * @returns {object} MCP 格式的返回结果
 */
export function handleManualMode(toolName) {
  logger.info(`显示工具手册: ${toolName}`);

  try {
    const manual = toolLoaderService.generateManual(toolName);

    return {
      content: [
        {
          type: 'text',
          text: manual
        }
      ]
    };
  } catch (error) {
    logger.error(`生成工具手册失败: ${toolName}`, { error: error.message });
    throw error;
  }
}

/**
 * 处理 execute 模式 - 执行工具
 * @param {string} toolName - 工具名称
 * @param {object} parameters - 工具参数
 * @returns {object} MCP 格式的返回结果
 */
export async function handleExecuteMode(toolName, parameters) {
  return await executeTool(toolName, parameters);
}

/**
 * 处理 configure 模式 - 配置工具环境变量
 * @param {string} toolName - 工具名称
 * @param {object} parameters - 配置参数
 * @returns {object} MCP 格式的返回结果
 */
export async function handleConfigureMode(toolName, parameters) {
  logger.info(`配置工具: ${toolName}`, { parameters });

  try {
    const tool = toolLoaderService.getTool(toolName);

    // 获取工具的环境变量定义
    const schema = tool.schema || {};
    const envProps = schema.environment?.properties || {};

    // 如果有配置参数，保存配置
    if (parameters && Object.keys(parameters).length > 0) {
      // 验证配置参数
      const configuredVars = {};
      for (const [key, value] of Object.entries(parameters)) {
        if (!envProps[key]) {
          logger.warn(`未知的环境变量: ${key}`, { tool: toolName });
        }
        configuredVars[key] = value;
      }

      // 保存到 .env 文件
      await saveToolEnvironment(toolName, configuredVars);

      logger.info(`工具配置成功: ${toolName}`, { configured: Object.keys(configuredVars) });
    }

    // 获取当前配置信息
    const envInfo = await getToolEnvironmentInfo(toolName, schema);
    const metadata = tool.metadata || {};

    // 生成格式化的配置信息
    let configText = '# 工具配置信息\n\n';
    configText += '## 工具信息\n\n';
    configText += `**工具名称**: ${toolName}\n`;
    configText += `**工具版本**: ${metadata.version || '1.0.0'}\n`;
    configText += `**配置状态**: ${envInfo.configured.length > 0 ? '✅ 已配置' : '⚠️ 未配置'}\n\n`;

    configText += '## 环境配置路径\n\n';
    configText += `**配置文件路径**: \`${envInfo.envFilePath}\`\n\n`;

    if (envInfo.configured.length > 0) {
      configText += '## 当前配置\n\n';
      configText += '### 已配置项\n\n';
      configText += '| 配置项 | 当前值 | 说明 | 状态 |\n';
      configText += '|--------|--------|------|------|\n';
      for (const item of envInfo.configured) {
        const value = String(item.value).length > 50 ? `${String(item.value).substring(0, 50)}...` : String(item.value);
        configText += `| ${item.key} | ${value} | ${item.description} | ${item.status} |\n`;
      }
      configText += '\n';
    }

    if (envInfo.unconfigured.length > 0) {
      configText += '### 未配置项（使用默认值）\n\n';
      configText += '| 配置项 | 默认值 | 说明 | 状态 |\n';
      configText += '|--------|--------|------|------|\n';
      for (const item of envInfo.unconfigured) {
        const defaultValue = item.defaultValue !== undefined ? String(item.defaultValue) : '(无)';
        configText += `| ${item.key} | ${defaultValue} | ${item.description} | ${item.status} |\n`;
      }
      configText += '\n';
    }

    configText += '## 配置操作\n\n';
    configText += '### 如何更新配置\n\n';
    configText += '使用以下命令更新配置：\n\n';
    configText += '```yaml\n';
    configText += `tool: tool://${toolName}\n`;
    configText += 'mode: configure\n';
    configText += 'parameters:\n';
    if (envProps && Object.keys(envProps).length > 0) {
      const firstKey = Object.keys(envProps)[0];
      const firstDef = envProps[firstKey];
      configText += `  ${firstKey}: ${firstDef.default || 'value'}\n`;
    }
    configText += '```\n\n';

    return {
      content: [
        {
          type: 'text',
          text: configText
        }
      ]
    };
  } catch (error) {
    logger.error(`工具配置失败: ${toolName}`, { error: error.message });
    throw error;
  }
}

/**
 * 处理 log 模式 - 查看工具日志
 * @param {string} toolName - 工具名称
 * @param {object} parameters - 日志参数
 * @returns {object} MCP 格式的返回结果
 */
export async function handleLogMode(toolName, parameters) {
  logger.info(`查看工具日志: ${toolName}`, { parameters });

  try {
    // 先刷新日志队列，确保最新日志已写入
    await flushAllLogQueues();

    const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
    const logFilePath = path.join(toolDir, 'run.log');

    // 检查日志文件是否存在
    if (!(await pathExists(logFilePath))) {
      return {
        content: [
          {
            type: 'text',
            text: `工具 ${toolName} 暂无日志文件\n\n日志文件路径: \`${logFilePath}\``
          }
        ]
      };
    }

    // 读取日志文件
    const logContent = await fs.readFile(logFilePath, 'utf-8');
    const logLines = logContent.split('\n').filter(line => line.trim());

    const action = parameters.action || 'tail';
    const lines = parameters.lines || 50;

    let selectedLines = [];

    if (action === 'tail') {
      // 取最后N行
      selectedLines = logLines.slice(-lines);
    } else if (action === 'head') {
      // 取前N行
      selectedLines = logLines.slice(0, lines);
    } else if (action === 'all') {
      // 取所有行
      selectedLines = logLines;
    } else {
      throw new Error(`不支持的操作: ${action}，支持的操作: tail, head, all`);
    }

    const logText = selectedLines.join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `# 工具日志\n\n**工具**: ${toolName}\n**日志文件**: \`${logFilePath}\`\n**操作**: ${action}\n**行数**: ${selectedLines.length}\n\n\`\`\`\n${logText}\n\`\`\``
        }
      ]
    };
  } catch (error) {
    logger.error(`查看工具日志失败: ${toolName}`, { error: error.message });
    throw error;
  }
}
