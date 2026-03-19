#!/usr/bin/env node

/**
 * 本地安装测试脚本
 * 用于在不发布到 npm 的情况下测试包的安装和运行
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import tar from 'tar';
import { fileURLToPath } from 'url';
import http from 'http';


// 辅助函数：检查 tar 包中是否包含指定文件
function checkTarContains(tarPath, pattern) {
  try {
    const entries = [];
    tar.list({
      file: tarPath,
      sync: true,
      onentry: (entry) => {
        entries.push(entry.path);
      }
    });
    const matches = entries.filter(e => e.includes(pattern));
    return matches.length > 0;
  } catch (error) {
    return false;
  }
}

// 辅助函数：获取 tar 包中匹配的文件列表
function getTarFiles(tarPath, pattern) {
  try {
    const entries = [];
    tar.list({
      file: tarPath,
      sync: true,
      onentry: (entry) => {
        entries.push(entry.path);
      }
    });
    const matches = entries.filter(e => pattern.test(e));
    return matches.slice(0, 10);
  } catch (error) {
    return [];
  }
}

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

    // 验证发布包中包含 web 目录
    console.log('验证: 发布包包含 packages/web 目录');
    try {
      const hasWebFiles = checkTarContains(packPath, 'packages/web/index.html');
      if (hasWebFiles) {
        console.log('✅ 发布包包含 Web 界面文件\n');
      } else {
        console.log('❌ 发布包不包含 Web 界面文件\n');
        console.log('检查包文件:', packPath);
        console.log('包内容预览:');
        const webFiles = getTarFiles(packPath, /packages\/web|package/);
        console.log('包内容预览:');
        webFiles.forEach(f => console.log('  ' + f));
        throw new Error('发布包不包含 Web 界面文件');
      }
    } catch (error) {
      console.log('❌ 检查发布包失败:', error.message, '\n');
      throw error;
    }

    // 验证发布包中包含 examples 目录
    console.log('验证: 发布包包含 examples 目录');
    try {
      const hasExampleFiles = checkTarContains(packPath, 'examples/prompts');
      if (hasExampleFiles) {
        console.log('✅ 发布包包含 Examples 目录\n');
      } else {
        console.log('❌ 发布包不包含 Examples 目录\n');
        console.log('检查包文件:', packPath);
        console.log('包内容预览:');
        const exampleFiles = getTarFiles(packPath, /examples|package/);
        console.log('包内容预览:');
        exampleFiles.forEach(f => console.log('  ' + f));
        throw new Error('发布包不包含 Examples 目录');
      }
    } catch (error) {
      console.log('❌ 检查发布包失败:', error.message, '\n');
      throw error;
    }

    // 测试启动（短暂运行）
    console.log('测试: 启动服务（5秒后自动停止）');
    const child = spawn('./node_modules/.bin/prompt-manager', ['--port', '5621'], {
      stdio: 'inherit'
    });

    // 等待服务启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 Admin UI HTTP 访问
    console.log('验证: Admin UI HTTP 访问');
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 5621,
          path: '/admin',
          method: 'GET',
          timeout: 5000
        }, (res) => {
          if (res.statusCode === 200 || res.statusCode === 301) {
            console.log('✅ Admin UI 可正常访问\n');
            resolve();
          } else {
            console.log(`❌ Admin UI 返回状态码: ${res.statusCode}\n`);
            reject(new Error(`Admin UI 返回状态码: ${res.statusCode}`));
          }
        });

        req.on('error', (error) => {
          console.log('❌ Admin UI 访问失败:', error.message, '\n');
          reject(error);
        });

        req.end();
      });
    } catch (error) {
      console.log('❌ Admin UI HTTP 验证失败:', error.message, '\n');
      child.kill('SIGTERM');
      throw error;
    }

    // 设置超时处理
    const timeout = setTimeout(async () => {
      child.kill('SIGTERM');

      // 验证提示词同步
      console.log('验证: 提示词同步');
      try {
        const userPromptsDir = path.join(os.homedir(), '.prompt-manager', 'prompts');
        if (fs.existsSync(userPromptsDir)) {
          const files = fs.readdirSync(userPromptsDir);
          if (files.length > 0) {
            console.log(`✅ 提示词已同步: ${files.length} 个文件\n`);
          } else {
            console.log('❌ 提示词目录为空\n');
          }
        } else {
          console.log('❌ 用户提示词目录不存在\n');
        }
      } catch (error) {
        console.log('❌ 验证提示词同步失败:', error.message, '\n');
      }

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
    }, 3000);

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

    // 处理未捕获的异常
    process.on('uncaughtException', async (error) => {
      console.error('\n❌ 未捕获的异常:', error.message);
      child.kill('SIGTERM');

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
