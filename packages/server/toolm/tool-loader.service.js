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
import os from 'os';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ToolLoaderService {
  constructor() {
    // 工具缓存：toolName -> toolModule
    this.toolCache = new Map();
    
    // 工具目录列表
    this.toolDirectories = [
      // 系统内置工具目录
      path.join(__dirname, '..', '..', 'resources', 'tools'),
      // 用户工具目录
      path.join(os.homedir(), '.prompt-manager', 'tools')
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
    
    // 确保用户工具目录存在
    const userToolsDir = path.join(os.homedir(), '.prompt-manager', 'tools');
    await fs.ensureDir(userToolsDir);
    
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
      if (!await fs.pathExists(toolsDir)) {
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
          
          if (await fs.pathExists(toolFile)) {
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
    const tool = this.getTool(toolName);
    const { metadata, schema, businessErrors } = tool;

    let manual = '';
    
    // 标题和基本信息
    manual += `# ${metadata.name || toolName}\n\n`;
    
    if (metadata.description) {
      manual += `## 描述\n\n${metadata.description}\n\n`;
    }

    if (metadata.version) {
      manual += `**版本**: ${metadata.version}\n\n`;
    }

    if (metadata.author) {
      manual += `**作者**: ${metadata.author}\n\n`;
    }

    if (metadata.tags && metadata.tags.length > 0) {
      manual += `**标签**: ${metadata.tags.join(', ')}\n\n`;
    }

    // 使用场景
    if (metadata.scenarios && metadata.scenarios.length > 0) {
      manual += `## 使用场景\n\n`;
      metadata.scenarios.forEach(scenario => {
        manual += `- ${scenario}\n`;
      });
      manual += '\n';
    }

    // 参数说明
    if (schema.parameters) {
      manual += `## 参数说明\n\n`;
      
      const props = schema.parameters.properties || {};
      for (const [key, value] of Object.entries(props)) {
        const required = schema.parameters.required?.includes(key) ? '**必需**' : '可选';
        manual += `### ${key} (${required})\n\n`;
        manual += `- **类型**: ${value.type || '未指定'}\n`;
        if (value.description) {
          manual += `- **说明**: ${value.description}\n`;
        }
        if (value.enum) {
          manual += `- **可选值**: ${value.enum.join(', ')}\n`;
        }
        if (value.default) {
          manual += `- **默认值**: ${value.default}\n`;
        }
        manual += '\n';
      }
    }

    // 环境变量
    if (schema.environment && schema.environment.properties) {
      manual += `## 环境变量\n\n`;
      const envProps = schema.environment.properties;
      for (const [key, value] of Object.entries(envProps)) {
        manual += `### ${key}\n\n`;
        if (value.description) {
          manual += `- **说明**: ${value.description}\n`;
        }
        if (value.default) {
          manual += `- **默认值**: ${value.default}\n`;
        }
        manual += '\n';
      }
    }

    // 错误处理
    if (businessErrors && businessErrors.length > 0) {
      manual += `## 常见错误\n\n`;
      businessErrors.forEach(error => {
        manual += `### ${error.code}\n\n`;
        manual += `- **描述**: ${error.description}\n`;
        manual += `- **解决方案**: ${error.solution}\n`;
        manual += `- **可重试**: ${error.retryable ? '是' : '否'}\n\n`;
      });
    }

    // 限制说明
    if (metadata.limitations && metadata.limitations.length > 0) {
      manual += `## 限制说明\n\n`;
      metadata.limitations.forEach(limitation => {
        manual += `- ${limitation}\n`;
      });
      manual += '\n';
    }

    // 使用示例
    manual += `## 使用示例\n\n`;
    manual += '```javascript\n';
    manual += `toolm({\n`;
    manual += `  yaml: \`tool: tool://${toolName}\n`;
    manual += `mode: execute\n`;
    manual += `parameters:\n`;
    manual += `  // 在此填写参数\`\n`;
    manual += `})\n`;
    manual += '```\n';

    return manual;
  }
}

// 导出单例实例
export const toolLoaderService = new ToolLoaderService();

