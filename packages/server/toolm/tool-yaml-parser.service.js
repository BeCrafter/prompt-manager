/**
 * 工具 YAML 解析服务
 *
 * 职责：
 * 1. 解析和规范化 YAML 配置
 * 2. 自动修正常见的 AI 错误
 * 3. 验证必需字段
 */

import YAML from 'yaml';

/**
 * 解析和规范化 YAML 配置
 * @param {string} yamlInput - 原始 YAML 输入
 * @returns {object} 解析后的配置对象 { toolName, mode, parameters }
 */
export function parseToolYaml(yamlInput) {
  if (!yamlInput) {
    throw new Error('缺少必需参数: yaml');
  }

  try {
    // Auto-correct common AI mistakes
    let yamlContent = yamlInput.trim();

    // Case 1: Just a plain URL string like "tool://filesystem" or "@tool://filesystem"
    if (yamlContent.match(/^@?tool:\/\/[\w-]+$/)) {
      const toolName = yamlContent.replace(/^@?tool:\/\//, '');
      yamlContent = `tool: tool://${toolName}\nmode: execute`;
    }

    // Case 2: Handle escaped backslashes and quotes: tool: \"@tool://xxx\"
    yamlContent = yamlContent.replace(/\\\\/g, '\\').replace(/\\"/g, '"');

    // Case 3: Remove @ prefix from tool URLs: @tool://xxx -> tool://xxx
    yamlContent = yamlContent.replace(/@tool:\/\//g, 'tool://');

    // Case 3: Remove quotes around tool URLs: tool: "tool://xxx" -> tool: tool://xxx
    yamlContent = yamlContent.replace(/(tool|toolUrl|url):\s*"(tool:\/\/[^"]+)"/g, '$1: $2');

    // YAML → JSON conversion
    const configObj = YAML.parse(yamlContent);

    // Normalize field names
    const toolIdentifier = configObj.tool || configObj.toolUrl || configObj.url;
    const operationMode = configObj.mode || configObj.operation || 'execute';
    const parameters = configObj.parameters || {};

    // Validate required fields
    if (!toolIdentifier) {
      throw new Error(
        'Missing required field: tool\nExample: tool: tool://filesystem\nAliases supported: tool / toolUrl / url'
      );
    }

    // Validate URL format
    if (!toolIdentifier.startsWith('tool://')) {
      throw new Error(`Invalid tool format: ${toolIdentifier}\nMust start with tool://`);
    }

    // Get tool name
    const toolName = toolIdentifier.replace('tool://', '');

    return {
      toolName,
      mode: operationMode,
      parameters
    };
  } catch (error) {
    // YAML parsing errors
    if (error.name === 'YAMLException') {
      if (error.message.includes('bad indentation') || error.message.includes('mapping entry')) {
        throw new Error(
          `YAML format error: ${error.message}\n\nMultiline content requires | symbol, example:\ncontent: |\n  First line\n  Second line\n\nNote: Newline after |, indent content with 2 spaces`
        );
      }
      throw new Error(`YAML format error: ${error.message}\nCheck indentation (use spaces) and syntax`);
    }

    throw error;
  }
}
