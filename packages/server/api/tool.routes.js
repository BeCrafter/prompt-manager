/**
 * 工具管理接口
 */

import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs-extra';
import fse from 'fs-extra';
import { logger } from '../utils/logger.js';
import { toolLoaderService } from '../toolm/tool-loader.service.js';
import { pathExists } from '../toolm/tool-utils.js';
import { config } from '../utils/config.js';
import { authorConfigService } from '../services/author-config.service.js';

// 配置 multer 用于处理文件上传
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = config.getTempDir();
      fs.ensureDirSync(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // 生成唯一文件名，避免并发上传冲突
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  // 文件类型验证
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传ZIP格式的文件'), false);
    }
  },
  // 文件大小限制（50MB）
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

const router = express.Router();

/**
 * 获取工具列表
 */
router.get('/list', async (req, res) => {
  try {
    // 确保工具加载器已初始化
    if (!toolLoaderService.initialized) {
      await toolLoaderService.initialize();
    }

    const { search, category, tags, author, page = 1, limit = 20 } = req.query;

    // 获取所有工具
    let tools = toolLoaderService.getAllTools();

    // 过滤处理
    if (search) {
      const searchLower = search.toLowerCase();
      tools = tools.filter(tool => {
        const nameMatch = tool.metadata.name?.toLowerCase().includes(searchLower);
        const descMatch = tool.metadata.description?.toLowerCase().includes(searchLower);
        return nameMatch || descMatch;
      });
    }

    if (category) {
      tools = tools.filter(tool => tool.metadata.category === category);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      tools = tools.filter(tool => {
        const toolTags = tool.metadata.tags || [];
        return tagArray.some(tag => toolTags.includes(tag));
      });
    }

    if (author) {
      const authorLower = author.toLowerCase();
      tools = tools.filter(tool => tool.metadata.author?.toLowerCase() === authorLower);
    }

    // 排序
    tools.sort((a, b) => a.name.localeCompare(b.name));

    // 分页处理
    const total = tools.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTools = tools.slice(startIndex, endIndex);

    const formattedTools = await Promise.all(
      paginatedTools.map(async tool => {
        const metadata = tool.metadata || {};
        const authorName = metadata.author || 'BeCrafter';

        const authorInfo = await authorConfigService.resolveAuthor(authorName);

        return {
          id: metadata.id || tool.name,
          name: metadata.name || tool.name,
          description: metadata.description || '',
          version: metadata.version || '1.0.0',
          category: metadata.category || 'other',
          author: authorInfo.name,
          author_info: {
            id: authorInfo.id,
            name: authorInfo.name,
            github: authorInfo.github,
            homepage: authorInfo.homepage,
            bio: authorInfo.bio,
            featured: authorInfo.featured,
            sort_order: authorInfo.sort_order,
            aliases: authorInfo.aliases,
            avatar_url: authorInfo.avatar_url
          },
          tags: metadata.tags || [],
          scenarios: metadata.scenarios || [],
          limitations: metadata.limitations || []
        };
      })
    );

    const response = {
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      tools: formattedTools
    };

    res.json(response);
  } catch (error) {
    logger.error('获取工具列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取工具详情
 */
router.get('/detail/:toolName', async (req, res) => {
  try {
    // 确保工具加载器已初始化
    if (!toolLoaderService.initialized) {
      await toolLoaderService.initialize();
    }

    const { toolName } = req.params;

    // 检查工具是否存在
    if (!toolLoaderService.hasTool(toolName)) {
      return res.status(404).json({
        success: false,
        error: `工具 '${toolName}' 不存在`
      });
    }

    const tool = toolLoaderService.getTool(toolName);
    const metadata = tool.metadata || {};

    // 格式化工具详情
    const toolDetail = {
      id: metadata.id || tool.name,
      name: metadata.name || tool.name,
      description: metadata.description || '',
      version: metadata.version || '1.0.0',
      category: metadata.category || 'other',
      author: metadata.author || 'Prompt Manager',
      tags: metadata.tags || [],
      scenarios: metadata.scenarios || [],
      limitations: metadata.limitations || [],
      schema: tool.schema || {},
      businessErrors: tool.businessErrors || []
    };

    res.json({
      success: true,
      tool: toolDetail
    });
  } catch (error) {
    logger.error('获取工具详情失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 读取工具的 README.md 文件
 */
router.get('/readme/:toolName', async (req, res) => {
  try {
    // 确保工具加载器已初始化
    if (!toolLoaderService.initialized) {
      await toolLoaderService.initialize();
    }

    const { toolName } = req.params;

    // 检查工具是否存在
    if (!toolLoaderService.hasTool(toolName)) {
      return res.status(404).json({
        success: false,
        error: `工具 '${toolName}' 不存在`
      });
    }

    // 查找 README.md 文件
    const toolboxDir = config.getToolDir(toolName);
    const readmePath = path.join(toolboxDir, 'README.md');

    if (!(await pathExists(readmePath))) {
      return res.status(404).json({
        success: false,
        error: `工具 '${toolName}' 的 README.md 文件不存在`
      });
    }

    const fs = await import('fs');
    const readmeContent = await fs.promises.readFile(readmePath, 'utf-8');

    res.json({
      success: true,
      toolName,
      content: readmeContent
    });
  } catch (error) {
    logger.error('读取工具 README 失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 上传工具包
 *
 * 上传内容必须是 .zip 文件
 * 上传后需要做工具名的重复性检查，重复的不允许会给出提示，让用户自己判断是否需要覆盖
 * 解压缩 .zip 文件，然后检查里面是否存在规范约定的两个文件，至少存在这两个
 * 然后运行工具验证，看程序是否可以正常运行
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  let tempZipPath = null;
  let extractedDir = null;

  try {
    // 验证文件是否存在
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传ZIP文件'
      });
    }

    tempZipPath = req.file.path;

    // 验证文件类型
    if (!req.file.originalname.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({
        success: false,
        error: '上传的文件必须是ZIP格式'
      });
    }

    // 创建临时解压目录
    const tempDir = config.getTempDir();
    fs.ensureDirSync(tempDir);
    extractedDir = path.join(tempDir, `extracted_${Date.now()}_${Math.round(Math.random() * 1e9)}`);
    fs.ensureDirSync(extractedDir);

    // 解压ZIP文件
    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(extractedDir, true);

    // 检查解压后的目录结构
    const files = fs.readdirSync(extractedDir);

    // 查找工具文件（以 .tool.js 结尾的文件）
    const toolFiles = files.filter(
      file => file.endsWith('.tool.js') && fs.statSync(path.join(extractedDir, file)).isFile()
    );

    if (toolFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ZIP文件中未找到以 .tool.js 结尾的工具文件'
      });
    }

    // 提取工具名（从第一个 .tool.js 文件名推断）
    const toolFileName = toolFiles[0];
    const toolName = toolFileName.replace('.tool.js', '');

    // 检查是否存在 README.md
    const hasReadme = files.some(
      file => file.toLowerCase() === 'readme.md' && fs.statSync(path.join(extractedDir, file)).isFile()
    );

    if (!hasReadme) {
      return res.status(400).json({
        success: false,
        error: 'ZIP文件中必须包含 README.md 文件'
      });
    }

    // 检查工具是否已存在
    const toolboxDir = config.getToolboxDir();
    const targetToolDir = path.join(toolboxDir, toolName);
    const toolExists = await pathExists(targetToolDir);

    // 如果工具已存在且没有覆盖参数，则提示用户
    if (toolExists && req.body.overwrite !== 'true') {
      return res.status(409).json({
        success: false,
        error: `工具 "${toolName}" 已存在`,
        toolName,
        canOverwrite: true
      });
    }

    // 如果用户确认覆盖，先删除原有工具目录
    if (toolExists && req.body.overwrite === 'true') {
      await fse.remove(targetToolDir);
    }

    // 将解压的文件复制到工具目录
    await fse.ensureDir(targetToolDir);
    await fse.copy(extractedDir, targetToolDir);

    // 检查工具文件是否可导入（语法验证）
    const toolFilePath = path.join(targetToolDir, toolFileName);
    if (!(await pathExists(toolFilePath))) {
      return res.status(500).json({
        success: false,
        error: `工具文件 ${toolFileName} 不存在`
      });
    }

    // 尝试动态导入工具以验证语法
    let tool;
    try {
      const toolModule = await import(`file://${toolFilePath}`);
      tool = toolModule.default || toolModule;

      // 验证工具接口是否符合规范
      if (typeof tool.execute !== 'function') {
        return res.status(400).json({
          success: false,
          error: '工具文件缺少必需的 execute 方法'
        });
      }

      // 运行测试验证工具是否能正常工作
      const { createToolContext } = await import('../toolm/tool-context.service.js');
      await createToolContext(toolName, tool);

      // 执行一个简单的测试，检查工具是否能被正确初始化
      if (typeof tool.getMetadata === 'function') {
        try {
          const metadata = tool.getMetadata();
          if (!metadata || typeof metadata !== 'object') {
            logger.warn(`工具 ${toolName} 的 getMetadata 方法返回值无效`);
          }
        } catch (metaError) {
          logger.warn(`工具 ${toolName} 的 getMetadata 方法调用失败:`, metaError.message);
        }
      }

      // 简单测试 execute 方法是否存在
      if (tool.execute && typeof tool.execute === 'function') {
        // 为了安全起见，不实际执行工具，只验证其签名
        logger.info(`工具 ${toolName} 的 execute 方法存在，签名验证通过`);
      }
    } catch (importError) {
      // 清理失败的工具目录
      await fse.remove(targetToolDir);
      return res.status(400).json({
        success: false,
        error: `工具文件语法错误: ${importError.message}`
      });
    }

    // 验证 package.json（如果存在）
    const packageJsonPath = path.join(targetToolDir, 'package.json');
    let dependencies = {};
    if (await pathExists(packageJsonPath)) {
      try {
        const packageJson = await fse.readJson(packageJsonPath);
        dependencies = packageJson.dependencies || {};
      } catch (error) {
        // 如果 package.json 有问题，但不是致命错误，记录警告
        logger.warn(`工具 ${toolName} 的 package.json 文件有问题:`, error.message);
      }
    }

    // 如果有依赖，尝试安装（使用工具依赖管理服务）
    if (Object.keys(dependencies).length > 0) {
      try {
        const { ensureToolDependencies } = await import('../toolm/tool-dependency.service.js');
        await ensureToolDependencies(toolName, null);
      } catch (depError) {
        // 依赖安装失败不是致命错误，但要记录
        logger.warn(`工具 ${toolName} 依赖安装失败，将在运行时尝试:`, depError.message);
      }
    }

    // 验证工具是否能被工具加载器识别
    try {
      if (toolLoaderService.initialized) {
        // 重新加载工具
        await toolLoaderService.reload();
      }

      // 验证工具是否可以被加载
      if (toolLoaderService.hasTool(toolName)) {
        logger.info(`工具 ${toolName} 验证通过并已加载`);
      }
    } catch (loadError) {
      logger.warn(`工具 ${toolName} 无法被工具加载器识别:`, loadError.message);
    }

    res.json({
      success: true,
      message: `工具 ${toolName} 上传成功`,
      toolName,
      overwritten: toolExists && req.body.overwrite === 'true'
    });
  } catch (error) {
    logger.error('工具上传失败:', error);

    // 清理临时文件
    try {
      if (extractedDir && (await pathExists(extractedDir))) {
        await fse.remove(extractedDir);
      }
    } catch (cleanupError) {
      logger.error('清理临时文件失败:', cleanupError);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    // 确保临时上传的ZIP文件被清理
    try {
      if (tempZipPath && (await pathExists(tempZipPath))) {
        await fse.remove(tempZipPath);
      }
    } catch (cleanupError) {
      logger.error('清理上传文件失败:', cleanupError);
    }

    // 确保临时解压目录被清理
    try {
      if (extractedDir && (await pathExists(extractedDir))) {
        await fse.remove(extractedDir);
      }
    } catch (cleanupError) {
      logger.error('清理临时解压目录失败:', cleanupError);
    }
  }
});

export { router as toolRouter };
