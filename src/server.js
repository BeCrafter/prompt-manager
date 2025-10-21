import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';

const app = express();
app.use(express.json());

// 获取prompts目录路径
const promptsDir = config.getPromptsDir();

function generateUniqueId(relativePath) {
  const hash = crypto.createHash('sha256');
  hash.update(relativePath);
  const hashHex = hash.digest('hex');
  return hashHex.substring(0, 8);
}

function getPromptsFromFiles() {
  const prompts = [];

  function traverseDir(currentPath) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          traverseDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
          try {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            const prompt = yaml.load(fileContent);
            if (prompt && prompt.name) {
              const relativePath = path.relative(promptsDir, fullPath);
              prompts.push({
                ...prompt,
                uniqueId: generateUniqueId(prompt.name + '.yaml'),
                fileName: entry.name,
                relativePath: relativePath,
                // filePath: fullPath,
              });
            }
          } catch (error) {
            logger.error(`Error processing file ${fullPath}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${currentPath}:`, error);
    }
  }

  traverseDir(promptsDir);
  return prompts;
}

// 获取服务器信息
app.get('/', (req, res) => {
  res.json({
    name: config.getServerName(),
    version: config.getServerVersion(),
    description: 'Prompt服务器，用于管理和处理提示词',
    endpoints: [
      { path: '/', method: 'GET', description: '获取服务器信息' },
      { path: '/prompts', method: 'GET', description: '获取所有提示词列表' },
      { path: '/process', method: 'POST', description: '处理提示词' },
      { path: '/help', method: 'GET', description: '获取帮助信息' },
      { path: '/version', method: 'GET', description: '获取版本信息' }
    ]
  });
});

// 获取帮助信息
app.get('/help', (req, res) => {
  res.json({
    name: config.getServerName(),
    description: 'Prompt服务器，用于管理和处理提示词',
    usage: [
      { endpoint: '/prompts', method: 'GET', description: '获取所有提示词列表' },
      { 
        endpoint: '/process', 
        method: 'POST', 
        description: '处理提示词',
        body: {
          promptName: 'String (必需) - 提示词名称',
          arguments: 'Object (可选) - 提示词参数'
        },
        example: {
          promptName: 'code-review',
          arguments: {
            language: 'JavaScript',
            code: 'function hello() { console.log("Hello"); }'
          }
        }
      }
    ],
    configuration: {
      SERVER_PORT: '服务器端口 (默认: 3000)',
      PROMPTS_DIR: 'Prompts目录路径',
      MCP_SERVER_NAME: '服务器名称',
      MCP_SERVER_VERSION: '服务器版本',
      LOG_LEVEL: '日志级别 (error, warn, info, debug)',
      MAX_PROMPTS: '最大prompt数量限制'
    }
  });
});

// 获取版本信息
app.get('/version', (req, res) => {
  res.json({
    name: config.getServerName(),
    version: config.getServerVersion(),
  });
});

app.get('/prompts', (req, res) => {
  try {
    const prompts = getPromptsFromFiles();
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function processPromptContent(prompt, args) {
  let content = '';
  
  if (prompt.messages && Array.isArray(prompt.messages)) {
    const userMessages = prompt.messages.filter(msg => msg.role === 'user');
    
    for (const message of userMessages) {
      if (message.content && typeof message.content.text === 'string') {
        let text = message.content.text;
        
        // Replace arguments
        if (args) {
            for (const [key, value] of Object.entries(args)) {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                text = text.replace(placeholder, String(value));
            }
        }
        
        content += text + '\n\n';
      }
    }
  }
  
  return content.trim();
}

app.post('/process', async (req, res) => {
  try {
    const { promptName, arguments: args } = req.body;
    
    if (!promptName) {
      return res.status(400).json({ error: 'Missing promptName' });
    }
    
    const prompts = getPromptsFromFiles();
    const prompt = prompts.find(p => p.name === promptName);
    
    if (!prompt) {
      return res.status(404).json({ error: `Prompt "${promptName}" not found` });
    }
    
    const processedPrompt = await processPromptContent(prompt, args);
    res.json({ processedText: processedPrompt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
async function startServer() {
  try {
    // 验证配置
    await config.validate();
    
    // 显示配置信息
    config.showConfig();
    
    // 确保prompts目录存在
    await config.ensurePromptsDir();
    
    // 启动服务器
    app.listen(config.getPort(), () => {
      logger.info(`服务器已启动，监听端口 ${config.getPort()}`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error.message);
    process.exit(1);
  }
}

startServer();