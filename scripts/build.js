#!/usr/bin/env node

/**
 * 跨平台构建脚本
 * 支持 Desktop 应用构建和开发环境设置
 * 兼容 Windows、macOS、Linux
 */

import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// 颜色定义（Windows CMD 可能不支持 ANSI 颜色）
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// 检查是否支持颜色
const supportsColor = process.stdout.isTTY && !process.env.CI;

function log(message, color = colors.reset) {
  if (supportsColor) {
    console.log(`${color}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

// 执行命令的辅助函数
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: options.cwd || PROJECT_ROOT,
      shell: process.platform === 'win32',
      env: { ...process.env, ...options.env }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

// 环境检查函数
async function checkEnvironment() {
  log('========================================', colors.blue);
  log('检查构建环境', colors.blue);
  log('========================================', colors.blue);

  // 检查 Node.js 版本
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);

  log(`✓ Node.js 版本: ${nodeVersion}`, colors.green);

  // 检查版本
  if (nodeMajor < 22) {
    log('✗ Node.js 版本过低！', colors.red);
    log(`当前版本: ${nodeVersion}`, colors.yellow);
    log('要求版本: >=22.20.0 <23.0.0', colors.yellow);
    process.exit(1);
  } else if (nodeMajor >= 23) {
    log('✗ Node.js 版本过高！', colors.red);
    log(`当前版本: ${nodeVersion}`, colors.yellow);
    log('要求版本: >=22.20.0 <23.0.0', colors.yellow);
    log('建议使用 Node.js v22.20.0', colors.yellow);
    process.exit(1);
  } else {
    log('✓ Node.js 版本符合要求', colors.green);
  }

  // 检查 npm
  try {
    const npmVersion = await new Promise((resolve, reject) => {
      exec('npm --version', (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
    log(`✓ npm 版本: ${npmVersion}`, colors.green);
  } catch (error) {
    log('✗ npm 未安装', colors.red);
    process.exit(1);
  }

  // 检查 node-pty（用于桌面应用）
  const nodePtyPath = join(PROJECT_ROOT, 'app', 'desktop', 'node_modules', 'node-pty');
  if (existsSync(nodePtyPath)) {
    log('✓ node-pty 已安装', colors.green);
  } else {
    log('⚠ node-pty 未安装（将在安装依赖时处理）', colors.yellow);
  }

  console.log('');
}

// 清理 npm 环境变量
function clearNpmConfig() {
  delete process.env.npm_config_prefix;
  delete process.env.npm_config_cache;
  delete process.env.npm_config_tmp;
  delete process.env.npm_config_userconfig;
  delete process.env.npm_config_globalconfig;
  delete process.env.npm_config_localprefix;
}

// 清理缓存
function cleanCache() {
  log('清理缓存...');

  if (process.platform === 'darwin') {
    const cachePath = join(process.env.HOME, 'Library', 'Application Support', '@becrafter', 'prompt-desktop', 'prompt-manager');
    if (existsSync(cachePath)) {
      // 在实际实现中，这里应该删除缓存目录
      log('清理 macOS 缓存...', colors.yellow);
    }
  }
}

// 清理异常文件
async function cleanInvalidFiles() {
  log('清理异常文件...');

  try {
    const cleanupScript = join(PROJECT_ROOT, 'scripts', 'cleanup-invalid-files.js');
    if (existsSync(cleanupScript)) {
      await execCommand('node', [cleanupScript, '--target', 'packages/server']);
      await execCommand('node', [cleanupScript, '--target', 'app/desktop/node_modules/@becrafter/prompt-manager-core']);
    }
  } catch (error) {
    log('清理异常文件时出错:', colors.yellow);
    log(error.message, colors.yellow);
  }
}

// 主构建流程
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '';

  try {
    // 设置 npm 镜像源
    log('Setting npm registry to https://registry.npmmirror.com');
    await execCommand('npm', ['config', 'set', 'registry', 'https://registry.npmmirror.com']);

    // 检查环境
    await checkEnvironment();

    // 安装 app/desktop 依赖
    log('========================================', colors.blue);
    log('安装依赖', colors.blue);
    log('========================================', colors.blue);
    log('Installing dependencies for app/desktop...');
    clearNpmConfig();
    await execCommand('npm', ['install'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });

    // 重建 node-pty 以适配 Electron 的 Node.js 版本
    log('========================================', colors.blue);
    log('重建 node-pty 模块', colors.blue);
    log('========================================', colors.blue);
    log('Rebuilding node-pty for Electron...');
    clearNpmConfig();
    await execCommand('npx', ['electron-rebuild', '-f', '-w', 'node-pty'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });

    // 安装 packages/admin-ui 依赖
    log('Installing dependencies for packages/admin-ui...');
    clearNpmConfig();
    await execCommand('npm', ['install'], { cwd: join(PROJECT_ROOT, 'packages', 'admin-ui') });

    // 安装 packages/server 依赖（核心服务依赖）
    log('Installing dependencies for packages/server...');
    clearNpmConfig();
    await execCommand('npm', ['install', '--ignore-scripts'], { cwd: join(PROJECT_ROOT, 'packages', 'server') });

    // 清理缓存
    cleanCache();

    // 构建 admin-ui
    log('========================================', colors.blue);
    log('构建前端资源', colors.blue);
    log('========================================', colors.blue);
    log('Building admin-ui...');
    clearNpmConfig();
    await execCommand('npm', ['run', 'build'], { cwd: join(PROJECT_ROOT, 'packages', 'admin-ui') });

    // 构建根目录环境
    log('========================================', colors.blue);
    log('构建根目录环境', colors.blue);
    log('========================================', colors.blue);
    log('Building root environment...');
    clearNpmConfig();
    await execCommand('npm', ['install', '--ignore-scripts']);

    // 重建根目录的 node-pty 以适配 Electron
    log('========================================', colors.blue);
    log('重建根目录 node-pty 模块', colors.blue);
    log('========================================', colors.blue);
    log('Rebuilding node-pty for Electron in root directory...');
    clearNpmConfig();
    await execCommand('npx', ['electron-rebuild', '-f', '-w', 'node-pty', '--version=39.0.0']);

    // 清理异常文件
    await cleanInvalidFiles();

    // 根据参数执行 desktop 构建
    log('========================================', colors.blue);
    log('构建桌面应用', colors.blue);
    log('========================================', colors.blue);
    log('Building desktop app...');

    clearNpmConfig();
    switch (command) {
      case 'dev':
        await execCommand('npm', ['run', 'dev'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });
        break;
      case 'build:all':
        await execCommand('npm', ['run', 'build', '--', '--mac', '--win', '--linux'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });
        break;
      case 'build:mac':
        await execCommand('npm', ['run', 'build', '--', '--mac'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });
        break;
      case 'build:win':
        await execCommand('npm', ['run', 'build', '--', '--win'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });
        break;
      case 'build:linux':
        await execCommand('npm', ['run', 'build', '--', '--linux'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });
        break;
      default:
        await execCommand('npm', ['run', 'build'], { cwd: join(PROJECT_ROOT, 'app', 'desktop') });
    }

    // 打印构建完成时间
    console.log('');
    log('========================================', colors.green);
    log('构建完成', colors.green);
    log('========================================', colors.green);
    log(`Time: ${new Date().toISOString()}\n`);

  } catch (error) {
    log('\n构建失败:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

// 运行主函数
main();