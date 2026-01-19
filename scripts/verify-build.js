#!/usr/bin/env node

/**
 * 构建验证脚本
 * 验证构建产物是否正确生成
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

// 验证构建产物
function verifyBuildArtifacts() {
  info('验证构建产物...');

  const requiredArtifacts = [
    'packages/web/index.html',
    'packages/server/dist/index.js'
  ];

  let allExist = true;

  for (const artifact of requiredArtifacts) {
    const fullPath = path.join(projectRoot, artifact);
    if (fs.existsSync(fullPath)) {
      success(`${artifact} 存在`);
    } else {
      error(`${artifact} 不存在`);
      allExist = false;
    }
  }

  // 检查 admin-ui 构建产物（至少应该有index.html）
  const webDir = path.join(projectRoot, 'packages/web');
  if (fs.existsSync(webDir)) {
    const files = fs.readdirSync(webDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    if (jsFiles.length > 0) {
      success(`packages/web 包含 ${jsFiles.length} 个 JS 文件`);
    } else {
      warning('packages/web 中没有找到 JS 文件');
    }
  }

  return allExist;
}

// 运行构建测试
async function testBuild() {
  console.log('\n');
  log('='.repeat(50), 'blue');
  log('构建验证', 'blue');
  log('='.repeat(50), 'blue');
  console.log('\n');

  try {
    const artifactsOk = verifyBuildArtifacts();

    console.log('\n');
    log('='.repeat(50), 'blue');

    if (artifactsOk) {
      success('所有构建产物验证通过');
      process.exit(0);
    } else {
      error('构建产物验证失败');
      process.exit(1);
    }
  } catch (err) {
    error(`验证失败: ${err.message}`);
    process.exit(1);
  }
}

testBuild();