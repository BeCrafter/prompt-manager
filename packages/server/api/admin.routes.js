/**
 * 管理后台接口
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import { util, GROUP_META_FILENAME } from '../utils/util.js';
import { config } from '../utils/config.js';
import {adminAuthMiddleware} from '../middlewares/auth.middleware.js'
import { templateManager } from '../services/template.service.js';
import { modelManager } from '../services/model.service.js';
import { optimizationService } from '../services/optimization.service.js';
import { webSocketService } from '../services/WebSocketService.js';

const router = express.Router();

// 获取prompts目录路径（在启动时可能被覆盖）
let promptsDir = config.getPromptsDir();
const PROMPT_NAME_REGEX = /^(?![.]{1,2}$)[^\\/:*?"<>|\r\n]{1,64}$/;

// 获取服务器配置端点
router.get('/config', (req, res) => {
    // 检查是否启用了管理员功能
    if (!config.adminEnable) {
        return res.status(404).json({ error: 'Admin功能未启用' });
    }

    res.json({
        requireAuth: config.adminRequireAuth,
        adminEnable: config.adminEnable
    });
});

// 获取公开配置端点（无需认证）
router.get('/config/public', (req, res) => {
  const publicConfig = config.getPublicConfig();

  // 如果 WebSocket 服务已启动，使用实际分配的端口
  if (webSocketService.isRunning) {
    publicConfig.websocketPort = webSocketService.getPort();
  } else {
    // 如果 WebSocket 服务未启动，返回 null 表示尚未确定
    publicConfig.websocketPort = null;
  }

  res.json({
    success: true,
    data: publicConfig
  });
});

// 登录端点
router.post('/login', (req, res) => {
    // 检查是否启用了管理员功能
    if (!config.adminEnable) {
        return res.status(404).json({ error: 'Admin功能未启用' });
    }

    // 如果不需要认证，返回默认token
    if (!config.adminRequireAuth) {
        return res.json({ token: config.admins[0].token });
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

// 获取分组目录
router.get('/groups', adminAuthMiddleware, (req, res) => {
    try {
        const tree = util.buildGroupTree(promptsDir);
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
router.get('/prompts', adminAuthMiddleware, (req, res) => {
    try {
        const prompts = util.getPromptsFromFiles();

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
            filteredPrompts = filteredPrompts.filter(prompt => {
                // 检查提示词本身是否启用
                const promptActive = prompt.enabled === true;
                if (!promptActive) return false;
                
                // 检查目录状态 - util.getPromptsFromFiles() 已经正确处理了继承的启用状态
                // groupEnabled 已经考虑了父目录的禁用状态
                const groupActive = prompt.groupEnabled !== false;
                return groupActive;
            });
        }

        filteredPrompts.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'));

        res.json(filteredPrompts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个提示词
router.get('/prompts/:name', adminAuthMiddleware, (req, res) => {
    try {
        const prompts = util.getPromptsFromFiles();
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
router.post('/prompts', adminAuthMiddleware, (req, res) => {
    try {
        const { name, group, yaml: yamlContent, relativePath: originalRelativePath } = req.body;
        const trimmedName = (name || '').trim();

        if (!trimmedName || !yamlContent) {
            return res.status(400).json({ error: '名称和YAML内容是必需的' });
        }

        // 验证名称格式
        if (!PROMPT_NAME_REGEX.test(trimmedName)) {
            return res.status(400).json({ error: '名称格式无效，不能包含 / \\ : * ? \" < > | 或换行，长度需在1-64字符' });
        }

        // 计算目标路径
        const groupName = group || 'default';
        const normalizedOriginalPath = originalRelativePath ? path.normalize(originalRelativePath).replace(/\\/g, '/') : null;

        const targetSegments = [];
        if (groupName) {
            targetSegments.push(groupName);
        }

        const finalFileName = `${trimmedName}.yaml`;
        targetSegments.push(finalFileName);

        const targetRelativePath = path.posix.join(...targetSegments);
        const targetDir = path.join(promptsDir, path.posix.dirname(targetRelativePath));
        const filePath = path.join(promptsDir, targetRelativePath);

        fse.ensureDirSync(targetDir);

        // 检查是否重名（同目录下）
        const prompts = util.getPromptsFromFiles();
        const existingPrompt = prompts.find(p => {
            if (p.name !== trimmedName) return false;
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
router.post('/groups', adminAuthMiddleware, (req, res) => {
    try {
        const { name, parent } = req.body;

        if (!name) {
            return res.status(400).json({ error: '分组名称是必需的' });
        }

        // 验证名称格式
        if (!util.isValidGroupName(name)) {
            return res.status(400).json({ error: '名称格式无效，不能包含 / \\ : * ? \" < > | 或换行，长度需在1-64字符' });
        }

        // 构建目标目录路径
        let targetPath;
        if (parent) {
            // 验证父级目录路径
            const resolvedParent = util.resolveGroupDir(parent);
            if (!resolvedParent) {
                return res.status(400).json({ error: '无效的父级目录路径' });
            }
            targetPath = path.join(resolvedParent.dir, name);
        } else {
            targetPath = path.join(promptsDir, name);
        }

        // 检查目录是否已存在
        if (fs.existsSync(targetPath)) {
            return res.status(400).json({ error: '分组已存在' });
        }

        // 创建目录
        fs.mkdirSync(targetPath, { recursive: true });

        res.json({ message: '分组创建成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 重命名分组目录
router.patch('/groups/rename', adminAuthMiddleware, (req, res) => {
    try {
        const { path: groupPath, newName } = req.body || {};
        if (!groupPath || !newName) {
            return res.status(400).json({ error: '分组路径和新名称是必需的' });
        }
        if (!util.isValidGroupName(newName)) {
            return res.status(400).json({ error: '名称格式无效，不能包含 / \\ : * ? \" < > | 或换行，长度需在1-64字符' });
        }
        if (groupPath === 'default') {
            return res.status(400).json({ error: '默认分组不允许重命名' });
        }

        const resolved = util.resolveGroupDir(groupPath);
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

// 设置分组目录状态
router.patch('/groups/status', adminAuthMiddleware, (req, res) => {
    try {
        const { path: groupPath, enabled } = req.body || {};
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: '状态值无效' });
        }
        if (!groupPath) {
            return res.status(400).json({ error: '分组路径是必需的' });
        }

        const resolved = util.resolveGroupDir(groupPath);
        if (!resolved) {
            return res.status(400).json({ error: '无效的分组路径' });
        }
        const { dir } = resolved;
        if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory()) {
            return res.status(404).json({ error: '分组不存在' });
        }

        util.writeGroupMeta(dir, { enabled });

        res.json({ message: '分组状态已更新', enabled });
    } catch (error) {
        logger.error('更新分组状态失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除分组目录
router.delete('/groups', adminAuthMiddleware, (req, res) => {
    try {
        const groupPath = req.query.path;
        if (!groupPath) {
            return res.status(400).json({ error: '分组路径是必需的' });
        }
        if (groupPath === 'default') {
            return res.status(400).json({ error: '默认分组不允许删除' });
        }

        const resolved = util.resolveGroupDir(groupPath);
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
router.post('/prompts/:name/toggle', adminAuthMiddleware, (req, res) => {
    try {
        const prompts = util.getPromptsFromFiles();
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
router.delete('/prompts/:name', adminAuthMiddleware, (req, res) => {
    try {
        const prompts = util.getPromptsFromFiles();
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
router.post('/md-preview', adminAuthMiddleware, (req, res) => {
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

// 执行终端命令
router.post('/terminal/execute', adminAuthMiddleware, (req, res) => {
    try {
        const { command, cwd } = req.body;

        if (!command) {
            return res.status(400).json({ error: '命令是必需的' });
        }

        // 设置执行选项
        const options = {
            cwd: cwd || process.cwd(),
            shell: true,
            env: { ...process.env, FORCE_COLOR: '1' } // 启用颜色输出
        };

        let output = '';
        let errorOutput = '';
        let exitCode = null;

        const child = spawn(command, [], options);

        // 设置超时（5分钟）
        const timeout = setTimeout(() => {
            child.kill('SIGTERM');
            res.status(408).json({ error: '命令执行超时' });
        }, 5 * 60 * 1000);

        // 监听标准输出
        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
        });

        // 监听错误输出
        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
        });

        // 监听进程结束
        child.on('close', (code) => {
            clearTimeout(timeout);
            exitCode = code;

            res.json({
                success: true,
                command,
                output,
                errorOutput,
                exitCode,
                cwd: options.cwd
            });
        });

        // 监听错误
        child.on('error', (error) => {
            clearTimeout(timeout);
            logger.error('终端命令执行错误:', error);
            res.status(500).json({ error: `命令执行失败: ${error.message}` });
        });

    } catch (error) {
        logger.error('终端命令执行异常:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取当前工作目录
router.get('/terminal/cwd', adminAuthMiddleware, (req, res) => {
    try {
        res.json({
            cwd: process.cwd(),
            home: process.env.HOME || process.env.USERPROFILE
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 列出目录内容
router.get('/terminal/ls', adminAuthMiddleware, (req, res) => {
    try {
        const { path: targetPath = '.' } = req.query;
        const fullPath = path.resolve(targetPath);

        // 检查路径是否存在
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: '路径不存在' });
        }

        // 检查是否是目录
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: '路径不是目录' });
        }

        // 读取目录内容
        const items = fs.readdirSync(fullPath).map(item => {
            const itemPath = path.join(fullPath, item);
            const itemStat = fs.statSync(itemPath);

            return {
                name: item,
                path: itemPath,
                type: itemStat.isDirectory() ? 'directory' : 'file',
                size: itemStat.size,
                modified: itemStat.mtime.toISOString()
            };
        });

        // 排序：目录在前，文件在后，按名称排序
        items.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        res.json({
            success: true,
            path: fullPath,
            items
        });

    } catch (error) {
        logger.error('列出目录内容失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 优化相关路由 ====================

// 优化提示词（流式）
router.post('/prompts/optimize', adminAuthMiddleware, async (req, res) => {
    try {
        const { prompt, templateId, modelId, sessionId } = req.body;

        if (!prompt || !templateId || !modelId) {
            return res.status(400).json({ error: '提示词、模板ID和模型ID是必需的' });
        }

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 调用优化服务（流式）
        await optimizationService.optimizePrompt(
            prompt,
            templateId,
            modelId,
            (chunk) => {
                // 流式输出回调
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            },
            sessionId
        );

        // 发送完成信号
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        logger.error('优化提示词失败:', error);
        // 格式化错误信息，添加用户友好的前缀
        const errorMessage = `模型执行失败: ${error.message}`;
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
    }
});

// 迭代优化（流式）
router.post('/prompts/optimize/iterate', adminAuthMiddleware, async (req, res) => {
    try {
        const { currentResult, templateId, modelId, sessionId, guideText } = req.body;

        if (!currentResult || !templateId || !modelId || !sessionId) {
            return res.status(400).json({ error: '当前结果、模板ID、模型ID和会话ID是必需的' });
        }

        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 调用迭代优化服务（流式）
        await optimizationService.iterateOptimization(
            currentResult,
            templateId,
            modelId,
            (chunk) => {
                // 流式输出回调
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            },
            sessionId,
            guideText // 传递优化指导参数
        );

        // 发送完成信号
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        logger.error('迭代优化失败:', error);
        // 格式化错误信息，添加用户友好的前缀
        const errorMessage = `模型执行失败: ${error.message}`;
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
    }
});

// 清除会话迭代信息
router.delete('/prompts/optimize/session/:sessionId', adminAuthMiddleware, (req, res) => {
    try {
        const { sessionId } = req.params;
        optimizationService.clearSession(sessionId);
        res.json({ message: '会话已清除' });
    } catch (error) {
        logger.error('清除会话失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取会话迭代信息
router.get('/prompts/optimize/session/:sessionId', adminAuthMiddleware, (req, res) => {
    try {
        const { sessionId } = req.params;
        const sessionInfo = optimizationService.getSessionInfo(sessionId);
        res.json(sessionInfo);
    } catch (error) {
        logger.error('获取会话信息失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 模板管理路由 ====================

// 获取所有模板
router.get('/optimization/templates', adminAuthMiddleware, (req, res) => {
    try {
        const templates = templateManager.getTemplates();
        res.json(templates);
    } catch (error) {
        logger.error('获取模板列表失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 创建模板
router.post('/optimization/templates', adminAuthMiddleware, async (req, res) => {
    try {
        const template = await templateManager.createTemplate(req.body);
        res.json(template);
    } catch (error) {
        logger.error('创建模板失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 更新模板
router.put('/optimization/templates/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const template = await templateManager.updateTemplate(id, req.body);
        res.json(template);
    } catch (error) {
        logger.error('更新模板失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除模板
router.delete('/optimization/templates/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await templateManager.deleteTemplate(id);
        res.json({ message: '模板删除成功' });
    } catch (error) {
        logger.error('删除模板失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 模型管理路由 ====================

// 获取模型提供商列表
router.get('/optimization/models/providers', adminAuthMiddleware, async (req, res) => {
    try {
        const providers = await modelManager.getProviders();
        res.json(providers);
    } catch (error) {
        logger.error('获取模型提供商列表失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取模型提供商的默认配置
router.get('/optimization/models/providers/:key', adminAuthMiddleware, async (req, res) => {
    try {
        const { key } = req.params;
        const defaults = await modelManager.getProviderDefaults(key);
        if (!defaults) {
            return res.status(404).json({ error: '提供商不存在' });
        }
        res.json(defaults);
    } catch (error) {
        logger.error('获取提供商默认配置失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取所有模型
router.get('/optimization/models', adminAuthMiddleware, (req, res) => {
    try {
        const models = modelManager.getModels();
        res.json(models);
    } catch (error) {
        logger.error('获取模型列表失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 创建模型
router.post('/optimization/models', adminAuthMiddleware, async (req, res) => {
    try {
        const model = await modelManager.createModel(req.body);
        res.json(model);
    } catch (error) {
        logger.error('创建模型失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 更新模型
router.put('/optimization/models/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const model = await modelManager.updateModel(id, req.body);
        res.json(model);
    } catch (error) {
        logger.error('更新模型失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除模型
router.delete('/optimization/models/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await modelManager.deleteModel(id);
        res.json({ message: '模型删除成功' });
    } catch (error) {
        logger.error('删除模型失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 测试模型连接
router.post('/optimization/models/:id/test', adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await optimizationService.testModel(id);
        res.json(result);
    } catch (error) {
        logger.error('测试模型连接失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 优化配置路由 ====================

// 获取优化配置（预留接口，可用于全局配置）
router.get('/optimization/config', adminAuthMiddleware, (req, res) => {
    try {
        res.json({
            maxIterations: 10,
            encryptionEnabled: true
        });
    } catch (error) {
        logger.error('获取优化配置失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 更新优化配置（预留接口）
router.put('/optimization/config', adminAuthMiddleware, (req, res) => {
    try {
        res.json({ message: '配置更新成功' });
    } catch (error) {
        logger.error('更新优化配置失败:', error);
        res.status(500).json({ error: error.message });
    }
});

export const adminRouter = router;