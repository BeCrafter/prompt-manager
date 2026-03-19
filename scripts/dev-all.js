#!/usr/bin/env node

/**
 * 跨平台开发环境启动脚本
 * 同时启动后端和桌面应用开发环境
 * 兼容 Windows、macOS、Linux
 */

import { spawn } from 'child_process';
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

function log(message, color = colors.reset) {
  const supportsColor = process.stdout.isTTY && !process.env.CI;
  if (supportsColor) {
    console.log(`${color}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

// 主函数
async function main() {
  try {
    log('========================================', colors.blue);
    log('启动开发环境', colors.blue);
    log('========================================', colors.blue);

    log('\n正在启动后端服务...', colors.yellow);
    const backendProcess = spawn('npm', ['run', 'dev:backend'], {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
      shell: process.platform === 'win32'
    });

    // 等待一段时间后启动桌面应用
    setTimeout(() => {
      log('\n正在启动桌面应用...', colors.yellow);
      const desktopProcess = spawn('npm', ['run', 'dev:desktop'], {
        stdio: 'inherit',
        cwd: PROJECT_ROOT,
        shell: process.platform === 'win32'
      });

      desktopProcess.on('error', (error) => {
        log('桌面应用启动失败:', colors.red);
        log(error.message, colors.red);
      });

      // 处理退出
      process.on('SIGINT', () => {
        log('\n正在关闭所有服务...', colors.yellow);
        backendProcess.kill();
        desktopProcess.kill();
        process.exit(0);
      });

    }, 3000); // 等待3秒后启动桌面应用

    backendProcess.on('error', (error) => {
      log('后端服务启动失败:', colors.red);
      log(error.message, colors.red);
      process.exit(1);
    });

    log('\n✓ 开发环境启动成功！', colors.green);
    log('\n按 Ctrl+C 停止所有服务', colors.yellow);
    console.log('');

  } catch (error) {
    log('\n启动失败:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

// 运行主函数
main();