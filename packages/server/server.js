import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath, pathToFileURL } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { searchPrompts, getPrompt } from './mcp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const adminUiRoot = path.join(__dirname, '..', 'admin-ui');
const examplesPromptsRoot = path.join(__dirname, '..', '..', 'examples', 'prompts');

// 为管理员界面提供静态文件服务 - 根路径
app.use(config.adminPath, express.static(adminUiRoot));

// 为管理员界面提供根路径访问（当用户访问 /admin 时显示 admin.html）
app.get(config.adminPath, (req, res) => {
  res.sendFile(path.join(adminUiRoot, 'admin.html'));
});

// 获取prompts目录路径（在启动时可能被覆盖）
let promptsDir = config.getPromptsDir();

async function seedPromptsIfEmpty() {
  try {
    const entries = await fse.readdir(promptsDir);
    if (entries.length > 0) {
      return;
    }
  } catch (error) {
    logger.warn('读取Prompts目录失败，尝试同步示例数据:', error.message);
  }

  try {
    const exists = await fse.pathExists(examplesPromptsRoot);
    if (!exists) {
      return;
    }
    await fse.copy(examplesPromptsRoot, promptsDir, {
      overwrite: false,
      errorOnExist: false,
      recursive: true
    });
    logger.info(`已将示例Prompts同步到 ${promptsDir}`);
  } catch (error) {
    logger.warn('同步示例Prompts失败:', error.message);
  }
}
const GROUP_META_FILENAME = '.groupmeta.json';
const GROUP_NAME_REGEX = /^[a-zA-Z0-9-_\u4e00-\u9fa5]{1,64}$/;

function generateUniqueId(relativePath) {
  const hash = crypto.createHash('sha256');
  hash.update(relativePath);
  const hashHex = hash.digest('hex');
  return hashHex.substring(0, 8);
}

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
      SERVER_PORT: '服务器端口 (默认: 5621)',
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
    const filtered = prompts.filter(prompt => {
      const groupActive = prompt.groupEnabled !== false;
      const promptActive = prompt.enabled === true;
      return groupActive && promptActive;
    });
    res.json(filtered);
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

function isValidGroupName(name) {
  return GROUP_NAME_REGEX.test(name);
}

function validateGroupPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    return null;
  }
  const segments = relativePath.split('/').filter(Boolean);
  if (!segments.length) {
    return null;
  }
  for (const segment of segments) {
    if (!isValidGroupName(segment)) {
      return null;
    }
  }
  return segments;
}

function resolveGroupDir(relativePath) {
  const segments = validateGroupPath(relativePath);
  if (!segments) return null;
  const targetPath = path.resolve(promptsDir, ...segments);
  const normalizedPromptsDir = path.resolve(promptsDir);
  if (!targetPath.startsWith(normalizedPromptsDir)) {
    return null;
  }
  return { dir: targetPath, segments };
}

function getGroupMetaPath(dir) {
  return path.join(dir, GROUP_META_FILENAME);
}

function readGroupMeta(dir) {
  try {
    const metaPath = getGroupMetaPath(dir);
    if (!fs.existsSync(metaPath)) {
      return { enabled: true };
    }
    const raw = fs.readFileSync(metaPath, 'utf8');
    const data = JSON.parse(raw);
    return {
      enabled: data.enabled !== false
    };
  } catch (error) {
    logger.warn('读取类目元数据失败:', error);
    return { enabled: true };
  }
}

function writeGroupMeta(dir, meta = {}) {
  const metaPath = getGroupMetaPath(dir);
  const data = {
    enabled: meta.enabled !== false
  };
  fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf8');
}

// 获取所有分组（直接从目录读取）
function buildGroupTree(baseDir, relativePath = '') {
  const nodes = [];
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const childDir = path.join(baseDir, entry.name);
      const children = buildGroupTree(childDir, childRelativePath);
      const meta = readGroupMeta(childDir);
      nodes.push({
        name: entry.name,
        path: childRelativePath,
        children,
        enabled: meta.enabled !== false
      });
    }
  } catch (error) {
    logger.error('读取分组目录失败:', error);
  }
  nodes.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  return nodes;
}

app.get('/api/groups', adminAuthMiddleware, (req, res) => {
  try {
    const tree = buildGroupTree(promptsDir);
    const hasDefault = tree.some(node => node.path === 'default');
    if (!hasDefault) {
      tree.unshift({ name: 'default', path: 'default', children: [], enabled: true });
    }
    res.json(tree);
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
    const groupPathFilter = req.query.groupPath;
    const group = req.query.group;
    
    let filteredPrompts = prompts;
    
    // 应用分组过滤
    if (groupPathFilter) {
      filteredPrompts = filteredPrompts.filter(prompt => (prompt.groupPath || prompt.group || 'default') === groupPathFilter);
    } else if (group) {
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

    filteredPrompts.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'));
    
    res.json(filteredPrompts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个提示词
app.get('/api/prompts/:name', adminAuthMiddleware, (req, res) => {
  try {
    const prompts = getPromptsFromFiles();
    const targetPath = req.query.path;
    let prompt;
    if (targetPath) {
      prompt = prompts.find(p => p.relativePath === targetPath);
    }
    if (!prompt) {
      prompt = prompts.find(p => p.name === req.params.name);
    }
    
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
    const { name, group, yaml: yamlContent, relativePath: originalRelativePath } = req.body;
    
    if (!name || !yamlContent) {
      return res.status(400).json({ error: '名称和YAML内容是必需的' });
    }
    
    // 验证名称格式
    if (!/^[a-zA-Z0-9-_]{1,64}$/.test(name)) {
      return res.status(400).json({ error: '名称格式无效' });
    }
    
    // 计算目标路径
    const groupName = group || 'default';
    const normalizedOriginalPath = originalRelativePath ? path.normalize(originalRelativePath).replace(/\\/g, '/') : null;
    const originalDirParts = normalizedOriginalPath ? path.posix.dirname(normalizedOriginalPath).split('/').filter(Boolean) : [];
    let subPathSegments = [];

    if (normalizedOriginalPath && originalDirParts.length > 1) {
      subPathSegments = originalDirParts.slice(1);
    }

    const targetSegments = [];
    if (groupName) {
      targetSegments.push(groupName);
    }
    if (subPathSegments.length) {
      targetSegments.push(...subPathSegments);
    }

    const finalFileName = `${name}.yaml`;
    targetSegments.push(finalFileName);

    const targetRelativePath = path.posix.join(...targetSegments);
    const targetDir = path.join(promptsDir, path.posix.dirname(targetRelativePath));
    const filePath = path.join(promptsDir, targetRelativePath);

    fse.ensureDirSync(targetDir);
    
    // 检查是否重名（同目录下）
    const prompts = getPromptsFromFiles();
    const existingPrompt = prompts.find(p => {
      if (p.name !== name) return false;
      const isOriginalFile = normalizedOriginalPath && p.relativePath === normalizedOriginalPath;
      if (isOriginalFile) return false;
      const sameRelativePath = p.relativePath === targetRelativePath;
      if (sameRelativePath) return false;
      const sameDirectory = path.posix.dirname(p.relativePath || '') === path.posix.dirname(targetRelativePath);
      return sameDirectory;
    });
    
    if (existingPrompt) {
      return res.status(400).json({ error: '名称已存在' });
    }
    
    // 保存文件
    fs.writeFileSync(filePath, yamlContent, 'utf8');

    // 如果目标路径与原始路径不同，删除旧文件
    if (normalizedOriginalPath && normalizedOriginalPath !== targetRelativePath) {
      const originalFilePath = path.join(promptsDir, normalizedOriginalPath);
      if (fs.existsSync(originalFilePath)) {
        fs.unlinkSync(originalFilePath);
      }
    }

    res.json({ message: '保存成功', relativePath: targetRelativePath, group: groupName });
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
    if (!isValidGroupName(name)) {
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

app.patch('/api/groups/rename', adminAuthMiddleware, (req, res) => {
  try {
    const { path: groupPath, newName } = req.body || {};
    if (!groupPath || !newName) {
      return res.status(400).json({ error: '分组路径和新名称是必需的' });
    }
    if (!isValidGroupName(newName)) {
      return res.status(400).json({ error: '名称格式无效，只能包含字母、数字、中划线、下划线和中文' });
    }
    if (groupPath === 'default') {
      return res.status(400).json({ error: '默认分组不允许重命名' });
    }

    const resolved = resolveGroupDir(groupPath);
    if (!resolved) {
      return res.status(400).json({ error: '无效的分组路径' });
    }
    const { dir: oldDir, segments } = resolved;
    if (!fs.existsSync(oldDir) || !fs.lstatSync(oldDir).isDirectory()) {
      return res.status(404).json({ error: '分组不存在' });
    }

    const parentSegments = segments.slice(0, -1);
    const oldName = segments[segments.length - 1];
    if (newName === oldName) {
      return res.json({ message: '分组名称未变更', path: groupPath });
    }
    const newSegments = [...parentSegments, newName];
    const newDir = path.resolve(promptsDir, ...newSegments);
    if (fs.existsSync(newDir)) {
      return res.status(400).json({ error: '目标名称已存在，请选择其他名称' });
    }

    fse.moveSync(oldDir, newDir);

    res.json({ message: '分组重命名成功', path: newSegments.join('/') });
  } catch (error) {
    logger.error('分组重命名失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/groups/status', adminAuthMiddleware, (req, res) => {
  try {
    const { path: groupPath, enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '状态值无效' });
    }
    if (!groupPath) {
      return res.status(400).json({ error: '分组路径是必需的' });
    }

    const resolved = resolveGroupDir(groupPath);
    if (!resolved) {
      return res.status(400).json({ error: '无效的分组路径' });
    }
    const { dir } = resolved;
    if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) {
      return res.status(404).json({ error: '分组不存在' });
    }

    writeGroupMeta(dir, { enabled });

    res.json({ message: '分组状态已更新', enabled });
  } catch (error) {
    logger.error('更新分组状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/groups', adminAuthMiddleware, (req, res) => {
  try {
    const groupPath = req.query.path;
    if (!groupPath) {
      return res.status(400).json({ error: '分组路径是必需的' });
    }
    if (groupPath === 'default') {
      return res.status(400).json({ error: '默认分组不允许删除' });
    }

    const resolved = resolveGroupDir(groupPath);
    if (!resolved) {
      return res.status(400).json({ error: '无效的分组路径' });
    }
    const { dir } = resolved;
    if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) {
      return res.status(404).json({ error: '分组不存在' });
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.name !== GROUP_META_FILENAME && !entry.name.startsWith('.'));

    if (entries.length > 0) {
      return res.status(400).json({ error: '目录非空，请先移除其下的Prompt或子目录' });
    }

    fse.removeSync(dir);
    res.json({ message: '分组删除成功' });
  } catch (error) {
    logger.error('删除分组失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 切换提示词启用状态
app.post('/api/prompts/:name/toggle', adminAuthMiddleware, (req, res) => {
  try {
    const prompts = getPromptsFromFiles();
    const targetPath = req.query.path;
    let prompt;
    if (targetPath) {
      prompt = prompts.find(p => p.relativePath === targetPath);
    }
    if (!prompt) {
      prompt = prompts.find(p => p.name === req.params.name);
    }
    
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
    const targetPath = req.query.path;
    let prompt;
    if (targetPath) {
      prompt = prompts.find(p => p.relativePath === targetPath);
    }
    if (!prompt) {
      prompt = prompts.find(p => p.name === req.params.name);
    }
    
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

let serverInstance = null;
let serverStartingPromise = null;
let mcpServerInstance = null;
let mcpHttpTransport = null;
const mcpTransports = new Map();

export function getServerAddress() {
  return `http://127.0.0.1:${config.getPort()}`;
}

export function isServerRunning() {
  return Boolean(serverInstance);
}

export async function startServer(options = {}) {
  if (serverInstance) {
    return serverInstance;
  }
  if (serverStartingPromise) {
    return serverStartingPromise;
  }

  const { configOverrides } = options;
  if (configOverrides) {
    config.applyOverrides(configOverrides);
  }
  promptsDir = config.getPromptsDir();

  serverStartingPromise = (async () => {
    try {
      await config.ensurePromptsDir();
      promptsDir = config.getPromptsDir();
      await seedPromptsIfEmpty();
      await config.validate();
      config.showConfig();

      return await new Promise((resolve, reject) => {
        const server = app.listen(config.getPort(), () => {
          logger.info(`服务器已启动，监听端口 ${config.getPort()}`);
          if (config.adminEnable) {
            logger.info(`管理员界面可通过 http://localhost:${config.getPort()}${config.adminPath} 访问`);
          }
          resolve(server);
        });

        server.on('error', (err) => {
          logger.error('服务器启动失败:', err.message);
          reject(err);
        });
      });
    } catch (error) {
      logger.error('服务器启动失败:', error.message);
      throw error;
    }
  })();

  try {
    serverInstance = await serverStartingPromise;
    
    // 启动MCP服务器
    startMCPServer();
    
    return serverInstance;
  } finally {
    serverStartingPromise = null;
  }
}

export async function stopServer() {
  if (serverStartingPromise) {
    try {
      await serverStartingPromise;
    } catch (error) {
      // ignore failing start when stopping
    }
  }

  if (!serverInstance) {
    return;
  }

  await new Promise((resolve, reject) => {
    serverInstance.close((err) => {
      if (err) {
        logger.error('停止服务器失败:', err.message);
        reject(err);
      } else {
        logger.info('服务器已停止');
        resolve();
      }
    });
  });

  serverInstance = null;
  
  // 停止MCP服务器
  if (mcpServerInstance) {
    mcpServerInstance.close();
    mcpServerInstance = null;
  }
  
  // 关闭所有MCP传输
  for (const transport of mcpTransports.values()) {
    transport.close();
  }
  mcpTransports.clear();
  
  // 关闭MCP HTTP传输
  if (mcpHttpTransport) {
    mcpHttpTransport.close();
    mcpHttpTransport = null;
  }
}

export function getServerState() {
  return {
    running: Boolean(serverInstance),
    port: config.getPort(),
    address: getServerAddress(),
    adminPath: config.adminPath
  };
}

// 启动MCP服务器
async function startMCPServer() {
  try {
    // 创建MCP服务器
    mcpServerInstance = new Server({
      name: 'Prompt Server MCP',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // 注册search_prompts工具
    mcpServerInstance.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_prompts',
            description: 'Search for enabled prompts in the specified directory',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Optional name filter for prompts'
                }
              }
            }
          },
          {
            name: 'get_prompt',
            description: 'Get the specific content of a prompt by its identifier',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Required prompt identifier'
                }
              },
              required: ['name']
            }
          }
        ]
      };
    });

    // 注册工具处理器
    mcpServerInstance.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (name === 'search_prompts') {
        const result = await searchPrompts(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result
        };
      } else if (name === 'get_prompt') {
        const result = await getPrompt(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result
        };
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    });

    // 启动Stdio传输
    const stdioTransport = new StdioServerTransport();
    await mcpServerInstance.connect(stdioTransport);
    
    // 添加MCP HTTP端点
    app.post('/mcp', express.json(), async (req, res) => {
      try {
        // 创建新的HTTP传输实例
        mcpHttpTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true
        });
        
        // 清理传输实例
        res.on('close', () => {
          mcpHttpTransport.close();
          mcpServerInstance.close();
        });
        
        // 连接服务器到HTTP传输
        await mcpServerInstance.connect(mcpHttpTransport);
        
        // 处理请求
        await mcpHttpTransport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error('MCP HTTP请求处理失败:', error.message);
        if (!res.headersSent) {
          res.status(500).json({ 
            jsonrpc: '2.0', 
            error: { 
              code: -32603, 
              message: 'Internal error' 
            } 
          });
        }
      }
    });
    
    logger.info(`MCP服务器已启动  http://localhost:${config.getPort()}/mcp   端点`);
  } catch (error) {
    logger.error('启动MCP服务器失败:', error.message);
    mcpServerInstance = null;
  }
}

const isDirectRun = (() => {
  try {
    const executed = process.argv[1];
    if (!executed) return false;
    return pathToFileURL(executed).href === import.meta.url;
  } catch (error) {
    return false;
  }
})();

if (isDirectRun) {
  startServer().catch((error) => {
    logger.error('服务器启动失败:', error.message);
    process.exit(1);
  });
}
