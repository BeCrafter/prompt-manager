// 导入自定义模块
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { util } from '../utils/util.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 处理 toolx 工具调用
export async function handleToolX(args) {
  const { yaml: yamlInput } = args;
  
  if (!yamlInput) {
    throw new Error("缺少必需参数: yaml");
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
    // This happens when AI generates YAML in a JSON string
    yamlContent = yamlContent.replace(/\\\\/g, '\\').replace(/\\"/g, '"');

    // Case 3: Remove @ prefix from tool URLs: @tool://xxx -> tool://xxx
    yamlContent = yamlContent.replace(/@tool:\/\//g, 'tool://');

    // Case 4: Remove quotes around tool URLs: tool: "tool://xxx" -> tool: tool://xxx
    yamlContent = yamlContent.replace(/(tool|toolUrl|url):\s*"(tool:\/\/[^\"]+)"/g, '$1: $2');

    // YAML → JSON conversion
    const configObj = YAML.parse(yamlContent);

    // Normalize field names (support aliases for AI-friendliness)
    // Priority: tool > toolUrl > url
    const toolIdentifier = configObj.tool || configObj.toolUrl || configObj.url;

    // Priority: mode > operation
    const operationMode = configObj.mode || configObj.operation;

    // Validate required fields
    if (!toolIdentifier) {
      throw new Error('Missing required field: tool\nExample: tool: tool://filesystem\nAliases supported: tool / toolUrl / url');
    }

    // Validate URL format
    if (!toolIdentifier.startsWith('tool://')) {
      throw new Error(`Invalid tool format: ${toolIdentifier}\nMust start with tool://`);
    }

    // Get tool name
    const toolName = toolIdentifier.replace('tool://', '');
    
    // Check if tool exists in our local tools directory
    const rootDir = path.join(__dirname, '..', '..', '..');
    const toolsDir = path.join(rootDir, 'packages', 'resources', 'tools');
    const toolPath = path.join(toolsDir, `${toolName}`, `${toolName}.tool.js`);
    
    if (!fs.existsSync(toolPath)) {
      // List available tools
      const availableTools = await fs.readdir(toolsDir);
      const toolList = availableTools.filter(file => file.endsWith('.js')).map(file => path.basename(file, '.js'));
      
      throw new Error(`Tool '${toolName}' not found\nAvailable tools: ${toolList.join(', ')}\nTools are located in: ${toolsDir}`);
    }

    // Load and execute the tool
    const toolModule = await import(toolPath);
    const toolFunction = toolModule.default || toolModule.execute || toolModule.run;
    
    if (typeof toolFunction !== 'function') {
      throw new Error(`Tool '${toolName}' does not export a valid function`);
    }

    // Execute the tool with provided parameters
    const result = await toolFunction(configObj.parameters || {}, operationMode || 'execute');
    
    // 如果是 manual 模式，直接返回 Markdown 格式的手册
    if (operationMode === 'manual') {
      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    }
    
    // 其他模式返回 JSON 格式的结果
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            tool: toolName,
            mode: operationMode || 'execute',
            result: result
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    // YAML parsing errors
    if (error.name === 'YAMLException') {
      // Check for multiline string issues
      if (error.message.includes('bad indentation') || error.message.includes('mapping entry')) {
        throw new Error(`YAML format error: ${error.message}\n\nMultiline content requires | symbol, example:\ncontent: |\n  First line\n  Second line\n\nNote: Newline after |, indent content with 2 spaces`);
      }
      throw new Error(`YAML format error: ${error.message}\nCheck indentation (use spaces) and syntax`);
    }

    // Tool not found
    if (error.message?.includes('Tool not found')) {
      throw new Error(error.message);
    }

    throw error;
  }
}