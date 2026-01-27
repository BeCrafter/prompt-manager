#!/usr/bin/env node

/**
 * Version Management Script
 * 统一管理项目中所有文件的版本更新
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

class VersionManager {
  constructor() {
    this.projectRoot = process.cwd();
    this.filesToUpdate = [
      'package.json',
      'packages/server/package.json',
      'app/desktop/package.json',
      'README.md',
      'packages/server/utils/config.js'
    ];
  }

  /**
   * 更新所有相关文件的版本号
   */
  async updateVersion(newVersion) {
    console.log(`🔄 Updating version to ${newVersion}...`);
    
    // 验证版本格式
    if (!this.isValidVersion(newVersion)) {
      throw new Error(`Invalid version format: ${newVersion}`);
    }

    try {
      // 更新各个文件
      for (const file of this.filesToUpdate) {
        await this.updateFile(file, newVersion);
      }

      // 更新 package-lock.json 文件
      await this.updatePackageLock(newVersion);
      
      // 更新 app/desktop/package-lock.json
      await this.updateDesktopPackageLock(newVersion);

      // 更新 packages/server/package-lock.json
      await this.updateServerPackageLock(newVersion);

      console.log('✅ Version update completed successfully');
      console.log(`📝 Updated version: ${newVersion}`);
    } catch (error) {
      console.error(`❌ Version update failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 验证版本格式
   */
  isValidVersion(version) {
    // 仅支持 semver 和 beta 预发布格式（如 1.2.3 或 1.2.3-beta.1）
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;
    return semverRegex.test(version);
  }

  /**
   * 更新单个文件
   */
  async updateFile(filePath, version) {
    const fullPath = path.join(this.projectRoot, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
    }

    try {
      // 根据文件类型使用不同的更新策略
      if (filePath.endsWith('.json')) {
        await this.updateJsonFile(fullPath, version);
      } else if (filePath.includes('env.example')) {
        await this.updateEnvFile(fullPath, version);
      } else if (filePath.includes('README.md')) {
        await this.updateReadmeFile(fullPath, version);
      } else if (filePath.includes('config.js')) {
        await this.updateConfigFile(fullPath, version);
      }
      
      console.log(`  ✓ Updated ${filePath}`);
    } catch (error) {
      console.error(`  ✗ Failed to update ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新 JSON 文件的版本
   */
  async updateJsonFile(filePath, version) {
    const content = await fs.readJson(filePath);
    content.version = version;
    await fs.writeJson(filePath, content, { spaces: 2 });
  }

  /**
   * 更新 env.example 文件
   */
  async updateEnvFile(filePath, version) {
    let content = await fs.readFile(filePath, 'utf8');
    const regex = /^MCP_SERVER_VERSION=.+$/m;
    if (regex.test(content)) {
      content = content.replace(regex, `MCP_SERVER_VERSION=${version}`);
    } else {
      // 如果没有找到该行，在文件末尾添加
      content += `\nMCP_SERVER_VERSION=${version}\n`;
    }
    await fs.writeFile(filePath, content);
  }

  /**
   * 更新 README.md 文件中的版本信息
   */
  async updateReadmeFile(filePath, version) {
    let content = await fs.readFile(filePath, 'utf8');
    
    // 更新版本表格中的版本信息
    const versionTableRegex = /\|\s*`MCP_SERVER_VERSION`\s*\|\s*服务器版本\s*\|\s*`[^`]*`\s*\|/;
    if (versionTableRegex.test(content)) {
      content = content.replace(
        versionTableRegex,
        `| \`MCP_SERVER_VERSION\` | 服务器版本 | \`${version}\` |`
      );
    }
    
    await fs.writeFile(filePath, content);
  }

  /**
   * 更新 config.js 文件中的默认版本
   */
  async updateConfigFile(filePath, version) {
    let content = await fs.readFile(filePath, 'utf8');
    
    // 更新 serverVersion 默认值
    const versionRegex = /this\.serverVersion\s*=\s*process\.env\.MCP_SERVER_VERSION\s*\|\|\s*['"][^'"]*['"];?/;
    if (versionRegex.test(content)) {
      content = content.replace(
        versionRegex,
        `this.serverVersion = process.env.MCP_SERVER_VERSION || '${version}';`
      );
    }
    
    await fs.writeFile(filePath, content);
  }

  /**
   * 更新根目录的 package-lock.json
   */
  async updatePackageLock(newVersion) {
    const lockFile = path.join(this.projectRoot, 'package-lock.json');
    
    if (!fs.existsSync(lockFile)) {
      console.warn('⚠️  package-lock.json not found');
      return;
    }

    try {
      // 使用 jq 命令更新 package-lock.json（如果可用）
      try {
        const jqCommand = `jq --arg v "${newVersion}" '.version = $v | .packages."".version = $v' "${lockFile}" > "${lockFile}.tmp" && mv "${lockFile}.tmp" "${lockFile}"`;
        execSync(jqCommand, { stdio: 'pipe' });
      } catch (jqError) {
        // 如果 jq 不可用，使用 JavaScript 处理
        await this.updatePackageLockJson(lockFile, newVersion);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to update package-lock.json: ${error.message}`);
    }
  }

  /**
   * 更新桌面应用的 package-lock.json
   */
  async updateDesktopPackageLock(newVersion) {
    const lockFile = path.join(this.projectRoot, 'app/desktop/package-lock.json');
    
    if (!fs.existsSync(lockFile)) {
      console.warn('⚠️  app/desktop/package-lock.json not found');
      return;
    }

    try {
      // 更新桌面应用的版本
      await this.updatePackageLockJson(lockFile, newVersion);
    } catch (error) {
      console.warn(`⚠️  Failed to update desktop package-lock.json: ${error.message}`);
    }
  }

  /**
   * 更新服务端的 package-lock.json
   */
  async updateServerPackageLock(newVersion) {
    const lockFile = path.join(this.projectRoot, 'packages/server/package-lock.json');

    if (!fs.existsSync(lockFile)) {
      console.warn('⚠️  packages/server/package-lock.json not found');
      return;
    }

    try {
      await this.updatePackageLockJson(lockFile, newVersion);
    } catch (error) {
      console.warn(`⚠️  Failed to update server package-lock.json: ${error.message}`);
    }
  }

  /**
   * JavaScript 方式更新 package-lock.json
   */
  async updatePackageLockJson(lockFile, newVersion) {
    const lockContent = await fs.readJson(lockFile);
    
    if (lockContent.version !== undefined) {
      lockContent.version = newVersion;
    }
    
    if (lockContent.packages && lockContent.packages['']) {
      lockContent.packages[''].version = newVersion;
    }
    
    // 如果是桌面应用的 lock 文件，也要更新 prompt-desktop 包的版本
    if (lockFile.includes('app/desktop')) {
      const desktopPackageName = '@becrafter/prompt-desktop';
      if (lockContent.packages && lockContent.packages[`node_modules/${desktopPackageName}`]) {
        lockContent.packages[`node_modules/${desktopPackageName}`].version = newVersion;
      }
    }
    
    await fs.writeJson(lockFile, lockContent, { spaces: 2 });
  }

  /**
   * 获取当前版本
   */
  async getCurrentVersion() {
    const packageJson = path.join(this.projectRoot, 'package.json');
    const content = await fs.readJson(packageJson);
    return content.version;
  }

  /**
   * 显示帮助信息
   */
  static showHelp() {
    console.log(`
📦 Version Management Script

Usage:
  node scripts/update-version.js <version> [options]

Arguments:
  version           New version number (e.g., 1.0.0, 1.0.0-beta.1)

Options:
  --dry-run         Show what would be changed without making changes
  --help           Show this help message

Examples:
  node scripts/update-version.js 1.0.0
  node scripts/update-version.js 1.0.0-beta.1
  node scripts/update-version.js 1.0.0-alpha.1
  node scripts/update-version.js 1.0.0-rc.1
  node scripts/update-version.js 1.0.0-dev.1
`);
  }
}

// 主执行流程
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    VersionManager.showHelp();
    process.exit(0);
  }

  const newVersion = args[0];
  const isDryRun = args.includes('--dry-run');

  try {
    const versionManager = new VersionManager();
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No files will be modified');
      const currentVersion = await versionManager.getCurrentVersion();
      console.log(`Current version: ${currentVersion}`);
      console.log(`New version: ${newVersion}`);
      console.log(`Files to update: ${versionManager.filesToUpdate.join(', ')}`);
      console.log('✅ Dry run completed');
    } else {
      await versionManager.updateVersion(newVersion);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});