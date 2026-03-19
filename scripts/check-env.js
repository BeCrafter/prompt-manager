#!/usr/bin/env node

/**
 * 跨平台环境检查脚本
 * 检查开发环境是否满足要求
 * 兼容 Windows、macOS、Linux
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

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
    log('检查开发环境', colors.blue);
    log('========================================', colors.blue);

    // 检查 Node.js 版本
    log('\n1. Node.js 版本', colors.blue);
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
    } else {
      log(`✓ Node.js 版本: ${nodeVersion}`, colors.green);
    }

    // 检查平台
    log('\n2. 操作系统', colors.blue);
    log(`✓ 平台: ${process.platform}`, colors.green);
    log(`✓ 架构: ${process.arch}`, colors.green);

    // 检查 npm
    log('\n3. npm 版本', colors.blue);
    try {
      const { exec } = await import('child_process');
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

    // 检查关键文件
    log('\n4. 关键文件检查', colors.blue);
    const criticalFiles = [
      'package.json',
      'app/desktop/package.json',
      'packages/server/package.json',
      'packages/admin-ui/package.json'
    ];

    let missingFiles = 0;
    for (const file of criticalFiles) {
      const filePath = join(PROJECT_ROOT, file);
      if (!existsSync(filePath)) {
        log(`✗ 缺少文件: ${file}`, colors.red);
        missingFiles++;
      }
    }

    if (missingFiles === 0) {
      log('✓ 所有关键文件都存在', colors.green);
    } else {
      log(`⚠ 发现 ${missingFiles} 个缺失的关键文件`, colors.yellow);
    }

    // 总结
    log('\n========================================', colors.blue);
    log('✓ 环境检查完成！', colors.green);
    log('========================================', colors.blue);
    console.log('');

  } catch (error) {
    log('\n环境检查失败:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

// 运行主函数
main();