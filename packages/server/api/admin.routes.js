/**
 * 管理后台接口
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { util, GROUP_META_FILENAME } from '../utils/util.js';
import { config } from '../utils/config.js';
import {adminAuthMiddleware} from '../middlewares/auth.middleware.js'

const router = express.Router();

// 获取prompts目录路径（在启动时可能被覆盖）
let promptsDir = config.getPromptsDir();

// 登录端点
router.post('/login', (req, res) => {
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
            filteredPrompts = filteredPrompts.filter(prompt => prompt.enabled);
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

        const targetSegments = [];
        if (groupName) {
            targetSegments.push(groupName);
        }

        const finalFileName = `${name}.yaml`;
        targetSegments.push(finalFileName);

        const targetRelativePath = path.posix.join(...targetSegments);
        const targetDir = path.join(promptsDir, path.posix.dirname(targetRelativePath));
        const filePath = path.join(promptsDir, targetRelativePath);

        fse.ensureDirSync(targetDir);

        // 检查是否重名（同目录下）
        const prompts = util.getPromptsFromFiles();
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
router.post('/groups', adminAuthMiddleware, (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: '分组名称是必需的' });
        }

        // 验证名称格式
        if (!util.isValidGroupName(name)) {
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

// 重命名分组目录
router.patch('/groups/rename', adminAuthMiddleware, (req, res) => {
    try {
        const { path: groupPath, newName } = req.body || {};
        if (!groupPath || !newName) {
            return res.status(400).json({ error: '分组路径和新名称是必需的' });
        }
        if (!util.isValidGroupName(newName)) {
            return res.status(400).json({ error: '名称格式无效，只能包含字母、数字、中划线、下划线和中文' });
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

export const adminRouter = router;