import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// 为管理员界面提供静态文件服务 - 根路径
app.use(config.adminPath, express.static(path.join(__dirname, '..', 'public')));

// 为管理员界面提供根路径访问（当用户访问 /admin 时显示 admin.html）
app.get(config.adminPath, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

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
                group: relativePath.split('/')[0],
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

// 管理员API中间件
function adminAuthMiddleware(req, res, next) {
  // 检查是否启用了管理员功能
  if (!config.adminEnable) {
    return res.status(404).json({ error: 'Admin功能未启用' });
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }
  
  const token = authHeader.substring(7);
  
  // 验证令牌
  const admin = config.admins.find(a => a.token === token);
  if (!admin) {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
  
  req.admin = admin;
  next();
}

// 登录端点
app.post('/api/login', (req, res) => {
  // 检查是否启用了管理员功能
  if (!config.adminEnable) {
    return res.status(404).json({ error: 'Admin功能未启用' });
  }
  
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码是必需的' });
  }
  
  // 验证凭据
  const admin = config.admins.find(a => a.username === username && a.password === password);
  if (!admin) {
    return res.status(401).json({ error: '无效的用户名或密码' });
  }
  
  res.json({ token: admin.token });
});

// 获取所有分组（直接从目录读取）
app.get('/api/groups', adminAuthMiddleware, (req, res) => {
  try {
    const groupDir = promptsDir;
    const groups = [];
    
    // 获取所有分组目录
    const entries = fs.readdirSync(groupDir, { withFileTypes: true });
    const directories = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories.push(entry.name);
      }
    }
    
    // 确保 default 目录存在
    if (!directories.includes('default')) {
      directories.push('default');
    }
    
    // 为每个目录添加名称
    directories.forEach(dirName => {
      groups.push({
        name: dirName
      });
    });
    
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有提示词（支持搜索、过滤和分组）
app.get('/api/prompts', adminAuthMiddleware, (req, res) => {
  try {
    const prompts = getPromptsFromFiles();
    
    // 处理搜索参数
    const search = req.query.search;
    const enabled = req.query.enabled === 'true';
    const group = req.query.group;
    
    let filteredPrompts = prompts;
    
    // 应用分组过滤
    if (group) {
      filteredPrompts = filteredPrompts.filter(prompt => (prompt.group || 'default') === group);
    }
    
    // 应用搜索过滤
    if (search) {
      filteredPrompts = filteredPrompts.filter(prompt => 
        prompt.name.includes(search) || 
        (prompt.description && prompt.description.includes(search))
      );
    }
    
    // 应用启用状态过滤
    if (enabled) {
      filteredPrompts = filteredPrompts.filter(prompt => prompt.enabled);
    }
    
    res.json(filteredPrompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个提示词
app.get('/api/prompts/:name', adminAuthMiddleware, (req, res) => {
  try {
    const prompts = getPromptsFromFiles();
    const prompt = prompts.find(p => p.name === req.params.name);
    
    if (!prompt) {
      return res.status(404).json({ error: `Prompt "${req.params.name}" 未找到` });
    }
    
    // 读取原始YAML文件内容
    const promptPath = path.join(promptsDir, prompt.relativePath);
    const yamlContent = fs.readFileSync(promptPath, 'utf8');
    
    res.json({
      ...prompt,
      yaml: yamlContent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存提示词
app.post('/api/prompts', adminAuthMiddleware, (req, res) => {
  try {
    const { name, group, yaml: yamlContent } = req.body;
    
    if (!name || !yamlContent) {
      return res.status(400).json({ error: '名称和YAML内容是必需的' });
    }
    
    // 验证名称格式
    if (!/^[a-zA-Z0-9-_]{1,64}$/.test(name)) {
      return res.status(400).json({ error: '名称格式无效' });
    }
    
    // 确定文件路径
    const groupName = group || 'default';
    const groupDir = path.join(promptsDir, groupName);
    const filePath = path.join(groupDir, `${name}.yaml`);
    
    // 确保分组目录存在
    fse.ensureDirSync(groupDir);
    
    // 检查是否重名
    const prompts = getPromptsFromFiles();
    const existingPrompt = prompts.find(p => p.name === name && p.relativePath !== path.relative(promptsDir, filePath));
    
    if (existingPrompt) {
      return res.status(400).json({ error: '名称已存在' });
    }
    
    // 保存文件
    fs.writeFileSync(filePath, yamlContent, 'utf8');
    
    res.json({ message: '保存成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建新分组目录
app.post('/api/groups', adminAuthMiddleware, (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '分组名称是必需的' });
    }
    
    // 验证名称格式
    if (!/^[a-zA-Z0-9-_\u4e00-\u9fa5]{1,64}$/.test(name)) {
      return res.status(400).json({ error: '名称格式无效，只能包含字母、数字、中划线、下划线和中文' });
    }
    
    const groupDir = path.join(promptsDir, name);
    
    // 检查目录是否已存在
    if (fs.existsSync(groupDir)) {
      return res.status(400).json({ error: '分组已存在' });
    }
    
    // 创建目录
    fs.mkdirSync(groupDir, { recursive: true });
    
    res.json({ message: '分组创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 切换提示词启用状态
app.post('/api/prompts/:name/toggle', adminAuthMiddleware, (req, res) => {
  try {
    const prompts = getPromptsFromFiles();
    const prompt = prompts.find(p => p.name === req.params.name);
    
    if (!prompt) {
      return res.status(404).json({ error: `Prompt "${req.params.name}" 未找到` });
    }
    
    // 读取原始YAML文件内容
    const promptPath = path.join(promptsDir, prompt.relativePath);
    const yamlContent = fs.readFileSync(promptPath, 'utf8');
    
    // 解析YAML
    const promptData = yaml.load(yamlContent);
    
    // 切换启用状态
    promptData.enabled = !promptData.enabled;
    
    // 保存更新后的YAML
    const newYamlContent = yaml.dump(promptData);
    fs.writeFileSync(promptPath, newYamlContent, 'utf8');
    
    res.json({ message: '状态切换成功', enabled: promptData.enabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除提示词（软删）
app.delete('/api/prompts/:name', adminAuthMiddleware, (req, res) => {
  try {
    const prompts = getPromptsFromFiles();
    const prompt = prompts.find(p => p.name === req.params.name);
    
    if (!prompt) {
      return res.status(404).json({ error: `Prompt "${req.params.name}" 未找到` });
    }
    
    // 读取原始文件路径
    const promptPath = path.join(promptsDir, prompt.relativePath);
    
    // 直接删除文件
    fse.unlinkSync(promptPath);
    
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Markdown预览
app.post('/api/md-preview', adminAuthMiddleware, (req, res) => {
  try {
    const { yaml: yamlContent, vars } = req.body;
    
    if (!yamlContent) {
      return res.status(400).json({ error: 'YAML内容是必需的' });
    }
    
    // 解析YAML
    const promptData = yaml.load(yamlContent);
    
    // 处理变量替换
    let content = '';
    if (promptData.messages && Array.isArray(promptData.messages)) {
      const userMessages = promptData.messages.filter(msg => msg.role === 'user');
      
      for (const message of userMessages) {
        if (message.content && typeof message.content.text === 'string') {
          let text = message.content.text;
          
          // 替换变量
          if (vars) {
            for (const [key, value] of Object.entries(vars)) {
              const placeholder = new RegExp(`{{${key}}}`, 'g');
              text = text.replace(placeholder, String(value));
            }
          }
          
          content += text + '\n\n';
        }
      }
    }
    
    // 简单的Markdown转HTML（实际应用中可以使用专门的库）
    const html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/### (.*?)(<br>|$)/g, '<h3>$1</h3>')
      .replace(/## (.*?)(<br>|$)/g, '<h2>$1</h2>')
      .replace(/# (.*?)(<br>|$)/g, '<h1>$1</h1>');
    
    res.json({ html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
      if (config.adminEnable) {
        logger.info(`管理员界面可通过 http://localhost:${config.getPort()}${config.adminPath} 访问`);
      }
    });
  } catch (error) {
    logger.error('服务器启动失败:', error.message);
    process.exit(1);
  }
}

startServer();
