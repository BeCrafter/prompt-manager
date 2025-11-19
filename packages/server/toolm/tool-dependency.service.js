/**
 * 工具依赖管理服务
 * 
 * 职责：
 * 1. 检查工具依赖是否已安装
 * 2. 自动安装工具依赖
 * 3. 验证依赖版本匹配
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { pathExists } from './tool-utils.js';

const execAsync = promisify(exec);

/**
 * 确保工具依赖已安装
 * @param {string} toolName - 工具名称
 * @param {object} toolModule - 工具模块（可选，用于自动创建 package.json）
 */
export async function ensureToolDependencies(toolName, toolModule = null) {
  const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  const packageJsonPath = path.join(toolDir, 'package.json');
  const nodeModulesPath = path.join(toolDir, 'node_modules');
  
  // 检查 package.json 是否存在，如果不存在则自动创建
  if (!await pathExists(packageJsonPath)) {
    logger.info(`工具 ${toolName} 缺少 package.json，正在自动创建...`);
    await createPackageJson(toolName, toolDir, toolModule);
  }
  
  const packageJson = await fs.readJson(packageJsonPath);
  const dependencies = packageJson.dependencies || {};
  
  // 如果没有依赖，直接返回
  if (Object.keys(dependencies).length === 0) {
    logger.debug(`工具 ${toolName} 无需依赖`);
    return;
  }
  
  // 检查 node_modules 是否存在
  if (!await pathExists(nodeModulesPath)) {
    logger.info(`工具 ${toolName} 依赖未安装，开始安装...`);
    await installDependencies(toolDir);
    return;
  }
  
  // 检查依赖是否需要更新（简化版本：检查 package.json 是否更新）
  // 这里可以进一步优化，检查 package.json 的修改时间
  logger.debug(`工具 ${toolName} 依赖已存在`);
}

/**
 * 自动创建 package.json 文件
 * @param {string} toolName - 工具名称
 * @param {string} toolDir - 工具目录
 * @param {object} toolModule - 工具模块（可选）
 */
async function createPackageJson(toolName, toolDir, toolModule) {
  // 确保工具目录存在
  await fs.ensureDir(toolDir);
  
  // 获取工具依赖（如果工具模块提供了 getDependencies 方法）
  let dependencies = {};
  if (toolModule && typeof toolModule.getDependencies === 'function') {
    try {
      dependencies = toolModule.getDependencies() || {};
    } catch (error) {
      logger.warn(`获取工具 ${toolName} 依赖失败:`, error.message);
    }
  }
  
  // 获取工具元数据（用于 package.json 的基本信息）
  let metadata = { name: toolName, version: '1.0.0' };
  if (toolModule && typeof toolModule.getMetadata === 'function') {
    try {
      metadata = toolModule.getMetadata() || metadata;
    } catch (error) {
      logger.warn(`获取工具 ${toolName} 元数据失败:`, error.message);
    }
  }
  
  // 创建 package.json
  const packageJson = {
    name: `@prompt-manager/tool-${toolName}`,
    version: metadata.version || '1.0.0',
    description: metadata.description || `Prompt Manager tool: ${toolName}`,
    main: `${toolName}.tool.js`,
    type: 'module',
    dependencies: dependencies
  };
  
  // 写入 package.json
  const packageJsonPath = path.join(toolDir, 'package.json');
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  
  logger.info(`已为工具 ${toolName} 创建 package.json`, { 
    dependencies: Object.keys(dependencies).length 
  });
}

/**
 * 安装工具依赖
 * @param {string} toolDir - 工具目录
 */
async function installDependencies(toolDir) {
  logger.info(`在目录 ${toolDir} 中安装依赖...`);
  
  try {
    // 执行 npm install
    const { stdout, stderr } = await execAsync('npm install', {
      cwd: toolDir,
      timeout: 300000, // 5分钟超时
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    
    if (stdout) {
      logger.debug('依赖安装输出:', stdout);
    }
    
    if (stderr && !stderr.includes('npm WARN')) {
      logger.warn('依赖安装警告:', stderr);
    }
    
    logger.info('依赖安装成功');
    
  } catch (error) {
    logger.error('依赖安装失败', { 
      error: error.message,
      toolDir 
    });
    throw new Error(`依赖安装失败: ${error.message}`);
  }
}

