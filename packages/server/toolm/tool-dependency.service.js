/**
 * 工具依赖管理服务
 * 
 * 职责：
 * 1. 检查工具依赖是否已安装
 * 2. 自动安装工具依赖（使用 @npmcli/arborist，不依赖系统 npm）
 * 3. 验证依赖版本匹配
 * 
 * 使用 PackageInstaller 基于 @npmcli/arborist 实现，可在 Electron 环境中直接使用
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';
import { pathExists } from './tool-utils.js';
import PackageInstaller from './package-installer.service.js';

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
  
  // 检查 node_modules 是否存在，或者检查依赖是否需要更新
  const needsInstall = !await pathExists(nodeModulesPath) || await needsDependencyUpdate(toolDir, dependencies);
  
  if (needsInstall) {
    logger.info(`工具 ${toolName} 依赖需要安装或更新，开始安装...`);
    await installDependencies(toolDir, dependencies);
    return;
  }
  
  logger.debug(`工具 ${toolName} 依赖已存在且为最新`);
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
 * 检查依赖是否需要更新
 * @param {string} toolDir - 工具目录
 * @param {Object} expectedDependencies - 期望的依赖列表
 * @returns {Promise<boolean>} 是否需要更新
 */
async function needsDependencyUpdate(toolDir, expectedDependencies) {
  try {
    // 检查每个依赖是否已安装且版本匹配
    for (const [packageName, expectedVersion] of Object.entries(expectedDependencies)) {
      const isInstalled = await PackageInstaller.isPackageInstalled(toolDir, packageName);
      if (!isInstalled) {
        logger.debug(`依赖 ${packageName} 未安装，需要更新`);
        return true;
      }
      
      // 可以进一步检查版本是否匹配（简化版本，暂时只检查是否存在）
      // 如果需要精确版本匹配，可以读取 package.json 并比较版本
    }
    
    return false;
  } catch (error) {
    logger.warn('检查依赖更新状态失败，将重新安装', { error: error.message });
    return true; // 出错时重新安装
  }
}

/**
 * 安装工具依赖（使用 PackageInstaller 基于 @npmcli/arborist）
 * @param {string} toolDir - 工具目录
 * @param {Object} dependencies - 依赖列表
 */
async function installDependencies(toolDir, dependencies) {
  logger.info(`在目录 ${toolDir} 中安装依赖...`, { dependencies });
  
  try {
    // 使用 PackageInstaller 安装依赖
    // PackageInstaller 使用 @npmcli/arborist，不依赖系统 npm
    // 可在 Electron 环境中直接使用
    const result = await PackageInstaller.install({
      workingDir: toolDir,
      dependencies: dependencies,
      timeout: 300000 // 5分钟超时
    });
    
    logger.info('依赖安装成功', {
      elapsed: result.elapsed,
      installedCount: result.installedPackages.length,
      packages: result.installedPackages
    });
    
    return result;
    
  } catch (error) {
    logger.error('依赖安装失败', { 
      error: error.message,
      toolDir,
      dependencies,
      stack: error.stack
    });
    throw new Error(`依赖安装失败: ${error.message}`);
  }
}

