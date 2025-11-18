/**
 * 工具同步服务
 * 
 * 职责：
 * 1. 将系统内置工具从 packages/resources/tools/ 同步到 ~/.prompt-manager/toolbox/
 * 2. 为每个工具创建独立的沙箱目录结构
 * 3. 生成 package.json 文件（如果不存在）
 * 
 * 执行时机：
 * - HTTP 服务启动时（server.js 的 startServer() 函数中）
 * - 在 MCP 服务器初始化之前执行
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { pathExists } from './tool-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 同步系统工具到沙箱环境
 */
export async function syncSystemTools() {
  logger.info('开始同步系统工具到沙箱环境...');
  
  // 系统工具源目录
  const toolsDir = path.join(__dirname, '..', '..', 'resources', 'tools');
  
  // 目标沙箱目录
  const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
  
  // 确保工具箱目录存在
  await fs.ensureDir(toolboxDir);
  
  // 检查源目录是否存在
  if (!await pathExists(toolsDir)) {
    logger.warn(`系统工具目录不存在，跳过同步: ${toolsDir}`);
    return;
  }
  
  try {
    // 读取系统工具目录
    const entries = await fs.readdir(toolsDir, { withFileTypes: true });
    
    let syncedCount = 0;
    
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      
      const toolName = entry.name;
      const toolDir = path.join(toolsDir, toolName);
      const toolFile = path.join(toolDir, `${toolName}.tool.js`);
      
      // 检查工具文件是否存在
      if (!await pathExists(toolFile)) {
        logger.debug(`工具文件不存在，跳过: ${toolFile}`);
        continue;
      }
      
      try {
        // 创建目标沙箱目录
        const sandboxDir = path.join(toolboxDir, toolName);
        await fs.ensureDir(sandboxDir);
        
        // 复制工具文件
        const sandboxToolFile = path.join(sandboxDir, `${toolName}.tool.js`);
        await fs.copyFile(toolFile, sandboxToolFile);
        
        // 创建或更新 package.json
        const packageJsonPath = path.join(sandboxDir, 'package.json');
        let packageJson = {};
        
        if (await pathExists(packageJsonPath)) {
          // 读取现有的 package.json
          try {
            packageJson = await fs.readJson(packageJsonPath);
          } catch (error) {
            logger.warn(`读取 package.json 失败，将重新创建: ${packageJsonPath}`, { error: error.message });
          }
        }
        
        // 读取工具模块获取依赖信息
        let dependencies = {};
        try {
          const toolModule = await import(toolFile);
          if (toolModule.default && typeof toolModule.default.getDependencies === 'function') {
            dependencies = toolModule.default.getDependencies() || {};
          }
        } catch (error) {
          logger.warn(`读取工具依赖失败: ${toolName}`, { error: error.message });
        }
        
        // 更新 package.json
        packageJson = {
          name: `@prompt-manager/${toolName}`,
          version: packageJson.version || '1.0.0',
          description: packageJson.description || `Prompt Manager System Tool: ${toolName}`,
          main: `${toolName}.tool.js`,
          type: 'module',
          dependencies: {
            ...(packageJson.dependencies || {}),
            ...dependencies
          },
          private: true
        };
        
        // 写入 package.json
        await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
        
        // 创建必要的子目录
        await fs.ensureDir(path.join(sandboxDir, 'data'));
        await fs.ensureDir(path.join(sandboxDir, 'logs'));
        
        syncedCount++;
        logger.info(`系统工具 ${toolName} 已同步到沙箱环境`, { 
          source: toolFile,
          target: sandboxDir 
        });
        
      } catch (error) {
        logger.error(`同步工具失败: ${toolName}`, { error: error.message });
      }
    }
    
    logger.info(`系统工具同步完成，共同步 ${syncedCount} 个工具`);
    
  } catch (error) {
    logger.error('同步系统工具失败', { error: error.message });
    throw error;
  }
}

