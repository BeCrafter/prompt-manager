/**
 * 工具加载服务
 *
 * 职责：
 * 1. 扫描并加载 ~/.prompt-manager/tools 和 packages/resources/tools 目录下的所有工具
 * 2. 验证工具是否符合标准接口规范
 * 3. 提供工具元数据注册表
 * 4. 管理工具体验生命周期
 * 5. 实现工具的四种运行模式 (manual, execute, configure, log)
 */

import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { pathExists } from './tool-utils.js';
import { generateManual as generateManualFromService } from './tool-manual-generator.service.js';
import { config } from '../utils/config.js';

class ToolLoaderService {
  constructor() {
    // 工具缓存：toolName -> toolModule
    this.toolCache = new Map();

    // 工具目录列表（所有工具都在沙箱环境中）
    this.toolDirectories = [
      // 沙箱工具目录（系统工具和用户工具都在这里）
      config.getToolboxDir()
    ];

    // 已初始化标志
    this.initialized = false;
  }

  /**
   * 初始化工具加载器
   * 扫描所有工具目录并加载工具
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    logger.info('初始化工具加载器...');

    // 确保工具箱目录存在
    const toolboxDir = config.getToolboxDir();
    await fs.ensureDir(toolboxDir);

    // 扫描并加载所有工具
    await this.scanAndLoadTools();

    this.initialized = true;
    logger.info(`工具加载器初始化完成，共加载 ${this.toolCache.size} 个工具`);
  }

  /**
   * 扫描并加载所有工具目录中的工具
   */
  async scanAndLoadTools() {
    for (const toolsDir of this.toolDirectories) {
      if (!(await pathExists(toolsDir))) {
        logger.debug(`工具目录不存在，跳过: ${toolsDir}`);
        continue;
      }

      try {
        const entries = await fs.readdir(toolsDir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }

          const toolName = entry.name;
          const toolDir = path.join(toolsDir, toolName);
          const toolFile = path.join(toolDir, `${toolName}.tool.js`);

          if (await pathExists(toolFile)) {
            try {
              await this.loadTool(toolName, toolFile);
            } catch (error) {
              logger.error(`加载工具失败: ${toolName}`, { error: error.message });
            }
          }
        }
      } catch (error) {
        logger.error(`扫描工具目录失败: ${toolsDir}`, { error: error.message });
      }
    }
  }

  /**
   * 加载单个工具
   * @param {string} toolName - 工具名称
   * @param {string} toolFile - 工具文件路径
   */
  async loadTool(toolName, toolFile) {
    logger.debug(`加载工具: ${toolName}`, { file: toolFile });

    // 动态导入工具模块
    const toolModule = await import(toolFile);
    const tool = toolModule.default || toolModule;

    // 验证工具接口
    this.validateToolInterface(toolName, tool);

    // 缓存工具实例
    this.toolCache.set(toolName, {
      name: toolName,
      file: toolFile,
      module: tool,
      metadata: tool.getMetadata ? tool.getMetadata() : { name: toolName },
      schema: tool.getSchema ? tool.getSchema() : {},
      businessErrors: tool.getBusinessErrors ? tool.getBusinessErrors() : []
    });

    logger.info(`工具加载成功: ${toolName}`);
  }

  /**
   * 验证工具接口是否符合规范
   * @param {string} toolName - 工具名称
   * @param {object} tool - 工具模块
   */
  validateToolInterface(toolName, tool) {
    // 必需的方法
    const requiredMethods = ['execute'];

    // 推荐的方法
    const recommendedMethods = ['getMetadata', 'getSchema', 'getDependencies', 'getBusinessErrors'];

    // 检查必需方法
    for (const method of requiredMethods) {
      if (typeof tool[method] !== 'function') {
        throw new Error(`工具 ${toolName} 缺少必需方法: ${method}`);
      }
    }

    // 检查推荐方法
    for (const method of recommendedMethods) {
      if (typeof tool[method] !== 'function') {
        logger.warn(`工具 ${toolName} 缺少推荐方法: ${method}`);
      }
    }
  }

  /**
   * 获取工具实例
   * @param {string} toolName - 工具名称
   * @returns {object} 工具实例
   */
  getTool(toolName) {
    if (!this.initialized) {
      throw new Error('工具加载器尚未初始化，请先调用 initialize()');
    }

    const tool = this.toolCache.get(toolName);
    if (!tool) {
      const availableTools = Array.from(this.toolCache.keys()).join(', ');
      throw new Error(`工具 '${toolName}' 不存在。可用工具: ${availableTools}`);
    }

    return tool;
  }

  /**
   * 获取所有已加载的工具列表
   * @returns {Array} 工具列表
   */
  getAllTools() {
    if (!this.initialized) {
      throw new Error('工具加载器尚未初始化，请先调用 initialize()');
    }

    return Array.from(this.toolCache.values()).map(tool => ({
      name: tool.name,
      metadata: tool.metadata,
      schema: tool.schema
    }));
  }

  /**
   * 检查工具是否存在
   * @param {string} toolName - 工具名称
   * @returns {boolean}
   */
  hasTool(toolName) {
    return this.toolCache.has(toolName);
  }

  /**
   * 重新加载所有工具
   */
  async reload() {
    logger.info('重新加载所有工具...');
    this.toolCache.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * 生成工具手册（manual模式）
   * @param {string} toolName - 工具名称
   * @returns {string} Markdown格式的手册
   */
  generateManual(toolName) {
    // 使用统一的工具手册生成服务
    const tool = this.getTool(toolName);
    return generateManualFromService(toolName, tool);
  }
}

// 导出单例实例
export const toolLoaderService = new ToolLoaderService();
