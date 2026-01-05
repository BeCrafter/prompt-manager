#!/usr/bin/env node

/**
 * 本地安装测试脚本
 * 用于在不发布到 npm 的情况下测试包的安装和运行
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(os.tmpdir(), 'prompt-manager-test');

async function main() {
  console.log('🚀 开始本地安装测试...\n');

  const originalCwd = process.cwd();

  try {
    // 切换到项目根目录
    process.chdir(PROJECT_ROOT);

    // 1. 创建测试包
    console.log('📦 创建测试包...');
    execSync('npm pack', { stdio: 'inherit' });

    // 找到最新的包文件
    const files = fs.readdirSync('.').filter(f => f.match(/becrafter-prompt-manager.*\.tgz/));
    const latestPack = files.sort().pop();

    if (!latestPack) {
      throw new Error('未找到生成的包文件');
    }

    const packPath = path.join(PROJECT_ROOT, latestPack);
    console.log(`✅ 包文件: ${packPath}\n`);

    // 2. 清理和创建测试目录
    console.log('🧹 准备测试环境...');
    await fs.remove(TEST_DIR);
    await fs.ensureDir(TEST_DIR);
    process.chdir(TEST_DIR);

    // 3. 安装包
    console.log('📥 安装包到测试环境...');
    execSync(`npm install "${packPath}"`, {
      stdio: 'inherit'
    });

    console.log('✅ 包安装成功\n');

    // 4. 测试 CLI
    console.log('🧪 测试 CLI 功能...\n');

    // 测试帮助
    console.log('测试: prompt-manager --help');
    try {
      execSync('./node_modules/.bin/prompt-manager --help', { stdio: 'inherit' });
      console.log('✅ CLI 帮助功能正常\n');
    } catch (error) {
      console.log('❌ CLI 帮助功能失败\n');
      throw error;
    }

    // 测试启动（短暂运行）
    console.log('测试: 启动服务（5秒后自动停止）');
    const child = spawn('./node_modules/.bin/prompt-manager', ['--port', '5999'], {
      stdio: 'inherit'
    });

    // 设置超时处理
    const timeout = setTimeout(async () => {
      child.kill('SIGTERM');
      console.log('\n✅ 服务启动测试完成');
      console.log('\n🎉 本地安装测试通过！\n');

      // 自动清理测试目录
      try {
        console.log('🧹 清理测试环境...');
        await fs.remove(TEST_DIR);
        console.log('✅ 测试环境已清理\n');
      } catch (cleanupError) {
        console.warn('⚠️ 清理测试环境失败:', cleanupError.message);
      }

      // 恢复原始工作目录
      process.chdir(originalCwd);
    }, 5000);

    // 监听子进程退出
    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        console.log(`\n⚠️  服务进程退出 (code: ${code})`);
      }
    });

    child.on('error', async (error) => {
      clearTimeout(timeout);
      console.error('\n❌ 服务启动失败:', error.message);

      // 清理测试目录
      try {
        console.log('🧹 清理测试环境...');
        await fs.remove(TEST_DIR);
        console.log('✅ 测试环境已清理\n');
      } catch (cleanupError) {
        console.warn('⚠️ 清理测试环境失败:', cleanupError.message);
      }

      process.chdir(originalCwd);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ 测试失败:', error.message);

    // 清理测试目录
    try {
      console.log('🧹 清理测试环境...');
      await fs.remove(TEST_DIR);
      console.log('✅ 测试环境已清理\n');
    } catch (cleanupError) {
      console.warn('⚠️ 清理测试环境失败:', cleanupError.message);
    }

    process.chdir(originalCwd);
    process.exit(1);
  }
}

main();
