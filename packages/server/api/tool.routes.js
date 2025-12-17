/**
 * 工具管理接口
 */

import express from 'express';
import path from 'path';
import { logger } from '../utils/logger.js';
import { toolLoaderService } from '../toolm/tool-loader.service.js';
import { pathExists } from '../toolm/tool-utils.js';
import os from 'os';

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

    const {
      search,
      category,
      tags,
      author,
      page = 1,
      limit = 20
    } = req.query;

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
      tools = tools.filter(tool => 
        tool.metadata.category === category
      );
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
      tools = tools.filter(tool => 
        tool.metadata.author?.toLowerCase() === authorLower
      );
    }

    // 排序
    tools.sort((a, b) => a.name.localeCompare(b.name));

    // 分页处理
    const total = tools.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTools = tools.slice(startIndex, endIndex);

    // 格式化返回数据
    const formattedTools = paginatedTools.map(tool => {
      const metadata = tool.metadata || {};
      return {
        id: metadata.id || tool.name,
        name: metadata.name || tool.name,
        description: metadata.description || '',
        version: metadata.version || '1.0.0',
        category: metadata.category || 'other',
        author: metadata.author || 'Prompt Manager',
        tags: metadata.tags || [],
        scenarios: metadata.scenarios || [],
        limitations: metadata.limitations || []
      };
    });

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

    const tool = toolLoaderService.getTool(toolName);
    
    // 查找 README.md 文件
    const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
    const readmePath = path.join(toolboxDir, 'README.md');
    
    if (!await pathExists(readmePath)) {
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

export { router as toolRouter };