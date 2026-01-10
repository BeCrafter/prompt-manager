/**
 * 统一工具管理处理器
 *
 * 职责：
 * 1. 实现 mcp__promptmanager__toolm 工具的处理逻辑
 * 2. 路由到不同的模式处理器
 * 3. 统一错误处理
 */

import { toolLoaderService } from './tool-loader.service.js';
import { parseToolYaml } from './tool-yaml-parser.service.js';
import {
  handleManualMode,
  handleExecuteMode,
  handleConfigureMode,
  handleLogMode
} from './tool-mode-handlers.service.js';

/**
 * 处理 toolm 工具调用
 * @param {object} args - 参数对象，包含 yaml 字段
 * @returns {object} MCP 格式的返回结果
 */
export async function handleToolM(args) {
  const { yaml: yamlInput } = args;

  /* eslint-disable no-useless-catch */
  try {
    // 初始化工具加载器（如果尚未初始化）
    if (!toolLoaderService.initialized) {
      await toolLoaderService.initialize();
    }

    // 解析 YAML 配置
    const { toolName, mode, parameters } = parseToolYaml(yamlInput);

    // 检查工具是否存在
    if (!toolLoaderService.hasTool(toolName)) {
      const availableTools = toolLoaderService
        .getAllTools()
        .map(t => t.name)
        .join(', ');
      throw new Error(`工具 '${toolName}' 不存在\n可用工具: ${availableTools}`);
    }

    // 根据模式路由到对应的处理器
    switch (mode) {
    case 'manual':
      return handleManualMode(toolName);

    case 'execute':
      return await handleExecuteMode(toolName, parameters);

    case 'configure':
      return await handleConfigureMode(toolName, parameters);

    case 'log':
      return await handleLogMode(toolName, parameters);

    default:
      throw new Error(`不支持的模式: ${mode}\n支持的模式: manual, execute, configure, log`);
    }
  } catch (error) {
    // 错误已经在 parseToolYaml 中处理，直接抛出
    throw error;
  }
}
