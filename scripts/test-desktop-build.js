#!/usr/bin/env node

/**
 * 桌面应用构建测试脚本
 * 验证构建产物的完整性和基本功能
 * 兼容 Windows、macOS、Linux
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, statSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const DIST_DIR = join(PROJECT_ROOT, 'dist');

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

// 获取平台参数
const platform = process.argv[2] || process.platform;

// 根据平台定义预期的文件类型
const expectedFiles = {
  mac: ['.dmg'],
  win: ['.exe', '.zip'],
  linux: ['.AppImage', '.tar.xz']
};

// 根据平台定义合理的文件大小范围（字节）
const expectedSizes = {
  mac: { min: 50 * 1024 * 1024, max: 200 * 1024 * 1024 },      // 50-200 MB
  win: { min: 80 * 1024 * 1024, max: 300 * 1024 * 1024 },      // 80-300 MB
  linux: { min: 60 * 1024 * 1024, max: 250 * 1024 * 1024 }     // 60-250 MB
};

// 检查文件大小是否合理
function checkFileSize(filePath, platform) {
  const stats = statSync(filePath);
  const size = stats.size;
  const platformKey = platform.startsWith('win') ? 'win' : platform;

  const { min, max } = expectedSizes[platformKey];

  if (size < min) {
    return {
      passed: false,
      message: `文件过小: ${formatSize(size)} (最小: ${formatSize(min)})`
    };
  }

  if (size > max) {
    return {
      passed: false,
      message: `文件过大: ${formatSize(size)} (最大: ${formatSize(max)})`
    };
  }

  return {
    passed: true,
    message: `文件大小正常: ${formatSize(size)}`
  };
}

// 格式化文件大小
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// 获取 dist 目录中的所有文件
function getDistFiles() {
  if (!existsSync(DIST_DIR)) {
    return [];
  }

  try {
    return readdirSync(DIST_DIR).filter(file => {
      const filePath = join(DIST_DIR, file);
      return existsSync(filePath) && statSync(filePath).isFile();
    });
  } catch (error) {
    return [];
  }
}

// 验证构建产物
function validateBuild(platform) {
  log('========================================', colors.blue);
  log('验证桌面应用构建', colors.blue);
  log('========================================', colors.blue);

  log(`\n平台: ${platform}`, colors.yellow);
  log(`构建目录: ${DIST_DIR}`, colors.yellow);

  const files = getDistFiles();

  if (files.length === 0) {
    log('✗ 错误: 没有找到任何构建产物', colors.red);
    return false;
  }

  log(`\n找到 ${files.length} 个文件:`, colors.yellow);

  // 根据平台检查预期的文件类型
  const platformKey = platform.startsWith('win') ? 'win' : platform;
  const expectedExtensions = expectedFiles[platformKey] || [];

  let allPassed = true;
  let foundExpectedFiles = false;

  for (const file of files) {
    const filePath = join(DIST_DIR, file);
    const ext = file.substring(file.lastIndexOf('.'));

    log(`\n文件: ${file}`, colors.blue);

    // 检查文件扩展名
    if (expectedExtensions.includes(ext)) {
      foundExpectedFiles = true;
      log(`  ✓ 文件类型正确: ${ext}`, colors.green);
    } else {
      log(`  ⚠ 文件类型: ${ext} (不是预期的类型)`, colors.yellow);
    }

    // 检查文件大小
    const sizeCheck = checkFileSize(filePath, platform);
    if (sizeCheck.passed) {
      log(`  ✓ ${sizeCheck.message}`, colors.green);
    } else {
      log(`  ✗ ${sizeCheck.message}`, colors.red);
      allPassed = false;
    }
  }

  // 检查是否找到预期的文件类型
  if (!foundExpectedFiles) {
    log(`\n✗ 错误: 没有找到预期的文件类型 (${expectedExtensions.join(', ')})`, colors.red);
    allPassed = false;
  }

  // 总结
  log('\n========================================', colors.blue);
  if (allPassed) {
    log('✓ 构建验证通过！', colors.green);
  } else {
    log('✗ 构建验证失败！', colors.red);
  }
  log('========================================', colors.blue);

  return allPassed;
}

// 主函数
async function main() {
  try {
    const passed = validateBuild(platform);
    process.exit(passed ? 0 : 1);
  } catch (error) {
    log('\n构建验证失败:', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

// 运行主函数
main();