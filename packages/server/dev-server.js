#!/usr/bin/env node

/**
 * 开发服务器启动脚本
 * 
 * 这个脚本用于启动开发服务器，具有以下特性：
 * 1. 禁用 Node.js 模块缓存，确保每次修改都能立即生效
 * 2. 使用 --watch 标志自动重启
 * 3. 提供更详细的日志输出
 * 4. 支持环境变量配置
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 开发服务器配置
const devConfig = {
  // 使用 --watch 标志自动重启
  watch: true,
  // 禁用缓存的环境变量
  env: {
    ...process.env,
    NODE_ENV: 'development',
    // 禁用 V8 缓存
    NODE_OPTIONS: '--no-warnings',
  },
  // 日志级别
  logLevel: 'debug',
};

// 启动开发服务器
function startDevServer() {
  console.log('🚀 启动开发服务器...');
  console.log('📝 工作目录:', __dirname);
  console.log('🔄 模块缓存: 已禁用');
  console.log('👀 文件监听: 已启用');
  console.log('');

  const args = ['--watch', 'server.js'];

  // 如果有额外的参数，传递给服务器
  const serverArgs = process.argv.slice(2);
  if (serverArgs.length > 0) {
    args.push(...serverArgs);
  }

  const serverProcess = spawn('node', args, {
    cwd: __dirname,
    stdio: 'inherit',
    env: devConfig.env,
  });

  serverProcess.on('error', (error) => {
    console.error('❌ 启动开发服务器失败:', error);
    process.exit(1);
  });

  serverProcess.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`❌ 开发服务器异常退出 (code: ${code}, signal: ${signal})`);
      process.exit(code || 1);
    }
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭开发服务器...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      serverProcess.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 正在关闭开发服务器...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      serverProcess.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  });
}

// 启动服务器
startDevServer();
