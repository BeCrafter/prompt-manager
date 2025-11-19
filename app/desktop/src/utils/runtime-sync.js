/**
 * 运行时环境同步工具
 * 负责将打包的 runtime 目录同步到 ~/.prompt-manager 目录
 * runtime 目录包含所有运行时需要的资源（toolbox、.env 等）
 * 
 * 优化方案：直接同步整个 runtime 目录内容，避免逐个文件处理
 */

const path = require('path');
const { app } = require('electron');
const ResourceSync = require('./resource-sync');
const PathUtils = require('./path-utils');

class RuntimeSync {
  /**
   * 同步运行时环境
   * 将 runtime 目录下的所有内容同步到 ~/.prompt-manager 目录
   * 支持选择性同步（只同步不存在的文件/目录）
   */
  static async syncRuntime() {
    const configRoot = ResourceSync._getUserConfigRoot();
    
    // 确保配置目录存在
    await PathUtils.ensureDir(configRoot);
    
    const isPackaged = ResourceSync._checkIfPackaged();
    
    if (isPackaged) {
      // 打包模式：从 runtime 目录同步
      return await this._syncFromRuntime(configRoot);
    } else {
      // 开发模式：从源文件同步（构建 runtime 结构）
      return await this._syncFromDev(configRoot);
    }
  }
  
  /**
   * 从打包的 runtime 目录同步
   */
  static async _syncFromRuntime(configRoot) {
    const resourcesPath = process.resourcesPath;
    const possiblePaths = [
      path.join(resourcesPath, 'runtime'), // extraResources 中的 runtime（最常见）
      path.join(app.getAppPath(), 'runtime'), // 备用路径
    ];
    
    // 查找 runtime 目录
    const runtimePath = await ResourceSync.findSourcePath({
      devPath: null,
      packagedPaths: () => possiblePaths
    });
    
    if (!runtimePath) {
      console.warn('未找到 runtime 目录，跳过同步');
      return { success: false, error: 'Runtime directory not found' };
    }
    
    // 同步 runtime 目录下的所有内容到 configRoot
    // 逐个同步子目录和文件，避免覆盖已存在的文件
    const results = await this._syncContents(runtimePath, configRoot);
    
    return {
      success: true,
      configRoot,
      runtimePath,
      results
    };
  }
  
  /**
   * 从开发环境源文件同步（模拟 runtime 结构）
   */
  static async _syncFromDev(configRoot) {
    const projectRoot = ResourceSync._getProjectRoot();
    const results = {};
    
    // 同步 toolbox（对应 runtime/toolbox）
    const toolboxSource = path.join(projectRoot, 'packages', 'resources', 'tools');
    const toolboxTarget = path.join(configRoot, 'toolbox');
    if (await PathUtils.pathExists(toolboxSource)) {
      const result = await ResourceSync.syncDirectory({
        targetPath: toolboxTarget,
        devPath: () => toolboxSource,
        packagedPaths: () => [],
        skipIfExists: true,
        name: '工具箱'
      });
      results.toolbox = result;
    }
    
    // 同步 .env（对应 runtime/.env）
    const envSource = path.join(projectRoot, 'env.example');
    const envTarget = path.join(configRoot, '.env');
    if (await PathUtils.pathExists(envSource)) {
      const result = await ResourceSync.syncFile({
        targetPath: envTarget,
        devPath: () => envSource,
        packagedPaths: () => [],
        skipIfExists: true,
        name: '环境配置'
      });
      results['.env'] = result;
    }
    
    return {
      success: true,
      configRoot,
      results
    };
  }
  
  /**
   * 同步 runtime 目录下的所有内容到目标目录
   * 逐个同步子目录和文件，避免覆盖已存在的文件
   */
  static async _syncContents(runtimePath, configRoot) {
    const fs = require('fs').promises;
    const results = {};
    
    try {
      // 读取 runtime 目录下的所有条目
      const entries = await fs.readdir(runtimePath, { withFileTypes: true });
      
      for (const entry of entries) {
        const sourcePath = path.join(runtimePath, entry.name);
        const targetPath = path.join(configRoot, entry.name);
        
        if (entry.isDirectory()) {
          // 同步目录（如 toolbox）
          const result = await ResourceSync.syncDirectory({
            targetPath,
            devPath: () => sourcePath,
            packagedPaths: () => [sourcePath],
            skipIfExists: true,
            name: entry.name
          });
          results[entry.name] = result;
        } else if (entry.isFile()) {
          // 同步文件（如 .env）
          const result = await ResourceSync.syncFile({
            targetPath,
            devPath: () => sourcePath,
            packagedPaths: () => [sourcePath],
            skipIfExists: true,
            name: entry.name
          });
          results[entry.name] = result;
        }
      }
      
      return results;
    } catch (error) {
      console.error('同步 runtime 内容失败:', error);
      throw error;
    }
  }
}

module.exports = RuntimeSync;

