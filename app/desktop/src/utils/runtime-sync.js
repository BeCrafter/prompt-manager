/**
 * 运行时环境同步工具
 * 负责将打包的 runtime 目录同步到 ~/.prompt-manager 目录
 * runtime 目录包含所有运行时需要的资源（toolbox、.env 等）
 * 
 *
 * 注意：built-in 目录是系统内置配置，不应同步到用户目录
 * - built-in 目录包含的模型/模板配置不应暴露给用户
 * - 用户不应该能够修改或删除系统内置配置
 *
 */

const path = require("path");
const { app } = require("electron");
const ResourceSync = require("./resource-sync");
const PathUtils = require("./path-utils");

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
      path.join(resourcesPath, "runtime"), // extraResources 中的 runtime（最常见）
      path.join(app.getAppPath(), "runtime"), // 备用路径
    ];

    // 查找 runtime 目录
    const runtimePath = await ResourceSync.findSourcePath({
      devPath: null,
      packagedPaths: () => possiblePaths,
    });

    if (!runtimePath) {
      console.warn("未找到 runtime 目录，跳过同步");
      return { success: false, error: "Runtime directory not found" };
    }

    // 同步 runtime 目录下的所有内容到 configRoot
    // 逐个同步子目录和文件，避免覆盖已存在的文件
    const results = await this._syncContents(runtimePath, configRoot);

    return {
      success: true,
      configRoot,
      runtimePath,
      results,
    };
  }

  /**
   * 从开发环境源文件同步（模拟 runtime 结构）
   */
  static async _syncFromDev(configRoot) {
    const projectRoot = ResourceSync._getProjectRoot();
    const results = {};

    // 同步 toolbox（对应 runtime/toolbox）
    // 使用递归同步，确保新增的工具能够被同步
    const toolboxSource = path.join(
      projectRoot,
      "packages",
      "resources",
      "tools",
    );
    const toolboxTarget = path.join(configRoot, "toolbox");
    if (await PathUtils.pathExists(toolboxSource)) {
      const result = await this._syncDirectoryRecursive(
        toolboxSource,
        toolboxTarget,
        "toolbox",
      );
      results.toolbox = result;
    }

    // 同步 .env（对应 runtime/.env）
    const envSource = path.join(projectRoot, "env.example");
    const envTarget = path.join(configRoot, ".env");
    if (await PathUtils.pathExists(envSource)) {
      const result = await ResourceSync.syncFile({
        targetPath: envTarget,
        devPath: () => envSource,
        packagedPaths: () => [],
        skipIfExists: true,
        name: "环境配置",
      });
      results[".env"] = result;
    }

    return {
      success: true,
      configRoot,
      results,
    };
  }

  /**
   * 递归同步目录
   * 确保新增的子目录和文件能够被同步到运行环境
   * @param {string} sourceDir - 源目录路径
   * @param {string} targetDir - 目标目录路径
   * @param {string} dirName - 目录名称（用于日志）
   * @returns {Promise<Object>} 同步结果
   */
  static async _syncDirectoryRecursive(sourceDir, targetDir, dirName = "目录") {
    const fs = require("fs").promises;
    const results = {
      synced: [],
      skipped: [],
      errors: [],
    };

    try {
      await PathUtils.ensureDir(targetDir);

      const entries = await fs.readdir(sourceDir, { withFileTypes: true });

      for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        try {
          if (entry.isDirectory()) {
            if (entry.name === "built-in") {
              console.log(
                `跳过 built-in 目录（系统内置配置不应暴露给用户）: ${sourcePath}`,
              );
              results.skipped.push({
                item: entry.name,
                reason: "系统内置配置",
              });
              continue;
            }

            const subResult = await this._syncDirectoryRecursive(
              sourcePath,
              targetPath,
              entry.name,
            );

            results.synced.push(...subResult.details.synced);
            results.skipped.push(...subResult.details.skipped);
            results.errors.push(...subResult.details.errors);
          } else if (entry.isFile()) {
            const targetExists = await PathUtils.pathExists(targetPath);
            let needsSync = !targetExists;

            if (targetExists) {
              try {
                const sourceStat = await fs.stat(sourcePath);
                const targetStat = await fs.stat(targetPath);
                if (sourceStat.mtime > targetStat.mtime) {
                  needsSync = true;
                }
              } catch (statError) {
                needsSync = true;
              }
            }

            if (needsSync) {
              await PathUtils.ensureDir(path.dirname(targetPath));

              await fs.copyFile(sourcePath, targetPath);
              console.log(`已同步文件: ${entry.name} -> ${targetPath}`);

              results.synced.push(entry.name);
            } else {
              console.log(`文件已存在且无需更新，跳过: ${entry.name}`);
              results.skipped.push({
                item: entry.name,
                reason: "已存在且无需更新",
              });
            }
          }
        } catch (error) {
          console.error(`同步失败: ${entry.name}`, error);
          results.errors.push({ item: entry.name, error: error.message });
        }
      }

      return {
        success: results.errors.length === 0,
        synced: results.synced.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        details: results,
      };
    } catch (error) {
      console.error(`递归同步 ${dirName} 失败:`, error);
      return {
        success: false,
        error: error.message,
        details: results,
      };
    }
  }

  /**
   * 同步 runtime 目录下的所有内容到目标目录
   * 逐个同步子目录和文件，避免覆盖已存在的文件
   */
  static async _syncContents(runtimePath, configRoot) {
    const fs = require("fs").promises;
    const results = {};

    try {
      const entries = await fs.readdir(runtimePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === "built-in") {
          console.log(
            `跳过 built-in 目录（系统内置配置不应暴露给用户）: ${entry.name}`,
          );
          results[entry.name] = { skipped: true, reason: "系统内置配置" };
          continue;
        }

        const sourcePath = path.join(runtimePath, entry.name);
        const targetPath = path.join(configRoot, entry.name);

        if (entry.isDirectory()) {
          const result = await this._syncDirectoryRecursive(
            sourcePath,
            targetPath,
            entry.name,
          );
          results[entry.name] = result;
        } else if (entry.isFile()) {
          const result = await ResourceSync.syncFile({
            targetPath,
            devPath: () => sourcePath,
            packagedPaths: () => [sourcePath],
            skipIfExists: true,
            name: entry.name,
          });
          results[entry.name] = result;
        }
      }

      return results;
    } catch (error) {
      console.error("同步 runtime 内容失败:", error);
      throw error;
    }
  }
}

module.exports = RuntimeSync;
