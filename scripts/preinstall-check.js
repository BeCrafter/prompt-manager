#!/usr/bin/env node

/**
 * 安装前检查脚本
 * 在 npm install 之前检查 Node.js 版本
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const engines = packageJson.engines || { node: '>=18.0.0' };

// 获取当前 Node.js 版本
const nodeVersion = process.version;
const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);

// 解析版本要求
const nodeRequirement = engines.node;

console.log('\n🔍 检查 Node.js 版本...\n');
console.log(`当前版本: ${nodeVersion}`);
console.log(`要求版本: ${nodeRequirement}\n`);

// 简单的版本检查
if (nodeMajor < 22) {
  console.error('❌ Node.js 版本过低！');
  console.error('当前版本:', nodeVersion);
  console.error('建议版本: v22.20.0\n');
  console.error('请升级 Node.js 版本后重试。\n');
  process.exit(1);
}

if (nodeMajor >= 23) {
  console.warn('⚠️  Node.js 版本可能过高！');
  console.warn('当前版本:', nodeVersion);
  console.warn('建议版本: v22.20.0');
  console.warn('可能存在兼容性问题，建议使用 v22.x 版本。\n');
}

console.log('✅ Node.js 版本检查通过！\n');
