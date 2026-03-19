#!/usr/bin/env node

/**
 * 跨平台环境清理脚本
 * 清理缓存、依赖和构建产物
 * 兼容 Windows、macOS、Linux
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, rmSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  const supportsColor = process.stdout.isTTY && !process.env.CI;
  if (supportsColor) {
    console.log(`${color}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

// 递归删除目录
function removeDirectory(dirPath) {
  if (existsSync(dirPath)) {
    try {
      rmSync(dirPath, { recursive: true, force: true });
      log(`✓ 已删除: ${dirPath}`, colors.green);
    } catch (error) {
      log(`✗ 删除失败: ${dirPath}`, colors.red);
      log(error.message, colors.yellow);
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';

  try {
    log('========================================', colors.blue);
    log('清理环境', colors.blue);
    log('========================================', colors.blue);

    if (mode === 'cache-only' || mode === 'all') {
      log('\n1. 清理缓存', colors.blue);

      // 清理 npm 缓存
      log('清理 npm 缓存...', colors.yellow);
      try {
        const { execSync } = await import('child_process');
        execSync('npm cache clean --force', { stdio: 'inherit' });
      } catch (error) {
        log('npm 缓存清理失败', colors.yellow);
      }

      // 清理 macOS 缓存
      if (process.platform === 'darwin') {
        const cachePath = join(process.env.HOME, 'Library', 'Application Support', '@becrafter');
        removeDirectory(cachePath);
      }

      // 清理 Windows 缓存
      if (process.platform === 'win32') {
        const cachePath = join(process.env.LOCALAPPDATA, '@becrafter');
        removeDirectory(cachePath);
      }
    }

    if (mode === 'deps-only' || mode === 'all') {
      log('\n2. 清理依赖', colors.blue);

      const dependencies = [
        'node_modules',
        'app/desktop/node_modules',
        'packages/server/node_modules',
        'packages/admin-ui/node_modules'
      ];

      for (const dep of dependencies) {
        const depPath = join(PROJECT_ROOT, dep);
        removeDirectory(depPath);
      }

      // 删除 lockfiles
      log('\n清理 lockfiles...', colors.yellow);
      const lockfiles = [
        'package-lock.json',
        'app/desktop/package-lock.json',
        'packages/server/package-lock.json',
        'packages/admin-ui/package-lock.json'
      ];

      const { unlinkSync } = await import('fs');
      for (const lockfile of lockfiles) {
        const lockfilePath = join(PROJECT_ROOT, lockfile);
        if (existsSync(lockfilePath)) {
          try {
            unlinkSync(lockfilePath);
            log(`✓ 已删除: ${lockfile}`, colors.green);
          } catch (error) {
            log(`✗ 删除失败: ${lockfile}`, colors.red);
          }
        }
      }
    }

    if (mode === 'build-only' || mode === 'all') {
      log('\n3. 清理构建产物', colors.blue);

      const buildArtifacts = [
        'dist',
        'packages/server/dist',
        'packages/web'
      ];

      for (const artifact of buildArtifacts) {
        const artifactPath = join(PROJECT_ROOT, artifact);
        removeDirectory(artifactPath);
      }
    }

    // 总结
    log('\n========================================', colors.blue);
    log('✓ 环境清理完成！', colors.green);
    log('========================================', colors.blue);

    if (mode === 'all' || mode === 'deps-only') {
      log('\n运行以下命令重新安装依赖:', colors.yellow);
      log('  npm install', colors.blue);
    }

    console.log('');

  } catch (error) {
    log('\n清理失败:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

// 运行主函数
main();