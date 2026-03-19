#!/usr/bin/env node

/**
 * 跨平台依赖检查和安装脚本
 * 自动检查并安装所有必需的依赖
 * 兼容 Windows、macOS、Linux
 */

import { existsSync } from 'fs';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

// 清理 npm 环境变量
function clearNpmConfig() {
  delete process.env.npm_config_prefix;
  delete process.env.npm_config_cache;
  delete process.env.npm_config_tmp;
  delete process.env.npm_config_userconfig;
  delete process.env.npm_config_globalconfig;
  delete process.env.npm_config_localprefix;
}

// 检查依赖是否已安装
function checkDependenciesInstalled(path) {
  return existsSync(join(path, 'node_modules')) &&
         existsSync(join(path, 'node_modules', '.package-lock.json'));
}

// 主函数
async function main() {
  try {
    log('========================================', colors.blue);
    log('依赖检查和安装', colors.blue);
    log('========================================', colors.blue);

    // 检查 Node.js 版本
    log('\n1. 检查 Node.js 版本', colors.blue);
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (nodeMajor < 22) {
      log('✗ Node.js 版本过低！', colors.red);
      log(`当前版本: ${nodeVersion}`, colors.yellow);
      log('要求版本: >=22.20.0', colors.yellow);
      process.exit(1);
    } else if (nodeMajor >= 23) {
      log('⚠ Node.js 版本高于推荐版本', colors.yellow);
      log(`当前版本: ${nodeVersion}`, colors.yellow);
      log('推荐版本: v22.20.0', colors.yellow);
      log('继续使用，但可能会遇到兼容性问题', colors.yellow);
    } else {
      log(`✓ Node.js 版本: ${nodeVersion}`, colors.green);
    }

    // 检查并安装根目录依赖
    log('\n2. 检查根目录依赖', colors.blue);
    if (!checkDependenciesInstalled(PROJECT_ROOT)) {
      log('⚠ 根目录依赖未安装，正在安装...', colors.yellow);
      clearNpmConfig();
      await execCommand('npm', ['install']);
      log('✓ 根目录依赖安装完成', colors.green);
    } else {
      log('✓ 根目录依赖已安装', colors.green);
    }

    // 检查并安装 packages/server 依赖
    log('\n3. 检查 packages/server 依赖', colors.blue);
    const serverPath = join(PROJECT_ROOT, 'packages', 'server');
    if (!checkDependenciesInstalled(serverPath)) {
      log('⚠ packages/server 依赖未安装，正在安装...', colors.yellow);
      clearNpmConfig();
      await execCommand('npm', ['install'], { cwd: serverPath });
      log('✓ packages/server 依赖安装完成', colors.green);
    } else {
      log('✓ packages/server 依赖已安装', colors.green);
    }

    // 检查关键依赖
    log('\n4. 验证关键依赖', colors.blue);
    const criticalDeps = [
      join(serverPath, 'node_modules', 'ws'),
      join(serverPath, 'node_modules', 'express'),
      join(serverPath, 'node_modules', '@modelcontextprotocol', 'sdk')
    ];

    let missingDeps = 0;
    for (const dep of criticalDeps) {
      if (!existsSync(dep)) {
        log(`✗ 缺少关键依赖: ${dep}`, colors.red);
        missingDeps++;
      }
    }

    if (missingDeps > 0) {
      log(`⚠ 发现 ${missingDeps} 个缺失的关键依赖，正在重新安装...`, colors.yellow);
      clearNpmConfig();
      await execCommand('npm', ['install'], { cwd: serverPath });
      log('✓ 依赖重新安装完成', colors.green);
    } else {
      log('✓ 所有关键依赖都存在', colors.green);
    }

    // 检查并安装 app/desktop 依赖
    log('\n5. 检查 app/desktop 依赖', colors.blue);
    const desktopPath = join(PROJECT_ROOT, 'app', 'desktop');
    if (!checkDependenciesInstalled(desktopPath)) {
      log('⚠ app/desktop 依赖未安装，正在安装...', colors.yellow);
      clearNpmConfig();
      await execCommand('npm', ['install'], { cwd: desktopPath });
      log('✓ app/desktop 依赖安装完成', colors.green);
    } else {
      log('✓ app/desktop 依赖已安装', colors.green);
    }

    // 检查 electron 是否存在
    log('\n6. 验证 Electron 安装', colors.blue);
    const electronPath = join(desktopPath, 'node_modules', 'electron');
    if (!existsSync(electronPath)) {
      log('⚠ Electron 未安装，正在安装...', colors.yellow);
      clearNpmConfig();
      await execCommand('npm', ['install'], { cwd: desktopPath });
      log('✓ Electron 安装完成', colors.green);
    } else {
      log('✓ Electron 已安装', colors.green);
    }

    // 检查并安装 packages/admin-ui 依赖
    log('\n7. 检查 packages/admin-ui 依赖', colors.blue);
    const adminUiPath = join(PROJECT_ROOT, 'packages', 'admin-ui');
    if (!checkDependenciesInstalled(adminUiPath)) {
      log('⚠ packages/admin-ui 依赖未安装，正在安装...', colors.yellow);
      clearNpmConfig();
      await execCommand('npm', ['install'], { cwd: adminUiPath });
      log('✓ packages/admin-ui 依赖安装完成', colors.green);
    } else {
      log('✓ packages/admin-ui 依赖已安装', colors.green);
    }

    // 总结
    log('\n========================================', colors.blue);
    log('✓ 所有依赖检查和安装完成！', colors.green);
    log('========================================', colors.blue);
    log('\n现在可以运行以下命令：', colors.green);
    log('  npm run dev:desktop           - 启动桌面应用开发环境', colors.blue);
    log('  npm run build:desktop         - 构建桌面应用', colors.blue);
    log('  npm run test:module-loading   - 运行模块加载测试', colors.blue);
    console.log('');

  } catch (error) {
    log('\n依赖检查失败:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

// 运行主函数
main();
