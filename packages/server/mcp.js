// 由于循环依赖问题，我们需要重新实现获取提示词的逻辑
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取prompts目录路径
let promptsDir = config.getPromptsDir();

// 生成唯一ID的函数
function generateUniqueId(relativePath) {
  const hash = crypto.createHash('sha256');
  hash.update(relativePath);
  const hashHex = hash.digest('hex');
  return hashHex.substring(0, 8);
}

// 读取组元数据的函数
function readGroupMeta(dir) {
  const GROUP_META_FILENAME = '.groupmeta.json';
  try {
    const metaPath = path.join(dir, GROUP_META_FILENAME);
    if (!fs.existsSync(metaPath)) {
      return { enabled: true };
    }
    const raw = fs.readFileSync(metaPath, 'utf8');
    const data = JSON.parse(raw);
    return {
      enabled: data.enabled !== false
    };
  } catch (error) {
    console.warn('读取类目元数据失败:', error);
    return { enabled: true };
  }
}

// 获取提示词的函数
function getPromptsFromFiles() {
  const prompts = [];

  function traverseDir(currentPath, relativeDir = '', inheritedEnabled = true) {
    let currentEnabled = inheritedEnabled;
    if (relativeDir) {
      const meta = readGroupMeta(currentPath);
      currentEnabled = currentEnabled && (meta.enabled !== false);
    }

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          const childRelativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
          traverseDir(fullPath, childRelativePath, currentEnabled);
        } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
          try {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            const prompt = yaml.load(fileContent);
            if (prompt && prompt.name) {
              const relativePath = path.relative(promptsDir, fullPath);
              const normalizedRelativePath = relativePath.split(path.sep).join('/');
              const relativeDirForFile = path.dirname(normalizedRelativePath);
              const topLevelGroup = relativeDirForFile && relativeDirForFile !== '.' ? relativeDirForFile.split('/')[0] : (prompt.group || 'default');
              const groupPath = relativeDirForFile && relativeDirForFile !== '.' ? relativeDirForFile : topLevelGroup;
              prompts.push({
                ...prompt,
                uniqueId: generateUniqueId(prompt.name + '.yaml'),
                fileName: entry.name,
                relativePath: normalizedRelativePath,
                group: topLevelGroup,
                groupPath,
                groupEnabled: currentEnabled
              });
            }
          } catch (error) {
            console.error(`Error processing file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
    }
  }

  traverseDir(promptsDir);
  return prompts;
}

// 模拟MCP工具注册函数
function registerTool(tool) {
  // 在实际实现中，这里会与MCP SDK集成
  console.log(`Registered MCP tool: ${tool.name}`);
}

// search_prompts工具实现
async function searchPrompts(params = {}) {
  try {
    const { name } = params;
    const allPrompts = getPromptsFromFiles();
    
    // 过滤出启用的提示词
    const enabledPrompts = allPrompts.filter(prompt => {
      const groupActive = prompt.groupEnabled !== false;
      const promptActive = prompt.enabled === true;
      return groupActive && promptActive;
    });
    
    // 如果提供了name参数，则进一步过滤
    let filteredPrompts = enabledPrompts;
    if (name) {
      filteredPrompts = enabledPrompts.filter(prompt => 
        prompt.name && prompt.name.includes(name)
      );
    }
    
    // 返回提示词列表，只包含必要的信息
    return filteredPrompts.map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      group: prompt.group,
      groupPath: prompt.groupPath
    }));
  } catch (error) {
    console.error('Error in searchPrompts:', error);
    throw error;
  }
}

// get_prompt工具实现
async function getPrompt(params) {
  try {
    const { name } = params;
    
    // name参数是必需的
    if (!name) {
      throw new Error('name parameter is required');
    }
    
    const allPrompts = getPromptsFromFiles();
    
    // 查找指定名称的提示词
    const prompt = allPrompts.find(p => p.name === name);
    
    if (!prompt) {
      throw new Error(`Prompt with name "${name}" not found`);
    }
    
    // 检查提示词是否启用
    const groupActive = prompt.groupEnabled !== false;
    const promptActive = prompt.enabled === true;
    
    if (!groupActive || !promptActive) {
      throw new Error(`Prompt with name "${name}" is not enabled`);
    }
    
    // 返回提示词的完整信息
    return {
      name: prompt.name,
      description: prompt.description,
      group: prompt.group,
      groupPath: prompt.groupPath,
      messages: prompt.messages,
      parameters: prompt.parameters,
      relativePath: prompt.relativePath
    };
  } catch (error) {
    console.error('Error in getPrompt:', error);
    throw error;
  }
}

// 注册MCP工具
registerTool({
  name: 'search_prompts',
  description: 'Search for enabled prompts in the specified directory',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Optional name filter for prompts'
      }
    }
  },
  handler: searchPrompts
});

registerTool({
  name: 'get_prompt',
  description: 'Get the specific content of a prompt by its identifier',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Required prompt identifier'
      }
    },
    required: ['name']
  },
  handler: getPrompt
});

export { searchPrompts, getPrompt };