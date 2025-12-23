#!/usr/bin/env node

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * 测试打包后的应用是否能正常启动和服务
 */
class PackagedAppTester {
  constructor() {
    this.appProcess = null;
    this.serviceStarted = false;
    this.testResults = {
      appLaunch: false,
      serviceStart: false,
      healthCheck: false,
      webAccess: false,
      errors: []
    };
  }

  /**
   * 检查端口是否可用
   */
  async checkPortAvailable(port, timeout = 2000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);

      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/health',
        method: 'GET',
        timeout: timeout
      }, (res) => {
        clearTimeout(timer);
        resolve(true);
      });

      req.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        clearTimeout(timer);
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * 等待服务启动
   */
  async waitForService(port = 5621, maxWait = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const isAvailable = await this.checkPortAvailable(port, 2000);
      if (isAvailable) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  /**
   * 测试健康检查端点
   */
  async testHealthCheck(port = 5621) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            resolve(health.status === 'ok');
          } catch (error) {
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * 测试 Web 界面访问
   */
  async testWebAccess(port = 5621) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/admin',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * 启动应用
   */
  async startApp() {
    const platform = process.platform;
    let appPath;

    if (platform === 'darwin') {
      appPath = './dist/mac/Prompt Manager.app/Contents/MacOS/Prompt Manager';
    } else if (platform === 'win32') {
      appPath = './dist/Prompt Manager.exe';
    } else {
      appPath = './dist/prompt-manager';
    }

    if (!fs.existsSync(appPath)) {
      console.error(`应用文件不存在: ${appPath}`);
      console.error('当前目录:', process.cwd());
      console.error('dist 目录内容:');
      try {
        const distFiles = fs.readdirSync('./dist');
        console.error(distFiles);
      } catch (e) {
        console.error('无法读取 dist 目录');
      }
      throw new Error(`应用文件不存在: ${appPath}`);
    }

    console.log(`启动应用: ${appPath}`);
    
    this.appProcess = spawn(appPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ELECTRON_IS_DEV: '0'
      }
    });

    this.appProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      console.log(`[APP] ${message}`);
      
      // 检测服务启动成功的日志
      if (message.includes('MCP服务启动成功') || message.includes('Server verification successful')) {
        this.serviceStarted = true;
      }
    });

    this.appProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      
      // 过滤掉已知的警告信息
      if (message.includes('DeprecationWarning') || 
          message.includes('系统工具目录不存在') ||
          message.includes('fs.Stats constructor is deprecated')) {
        console.log(`[APP WARN] ${message}`);
      } else {
        console.error(`[APP ERROR] ${message}`);
        this.testResults.errors.push(message);
      }
    });

    this.appProcess.on('error', (error) => {
      console.error(`应用启动失败: ${error.message}`);
      this.testResults.errors.push(error.message);
    });

    this.appProcess.on('exit', (code) => {
      console.log(`应用退出，代码: ${code}`);
    });

    // 等待应用启动 - 更长的等待时间
    console.log('等待应用启动...');
    let waitTime = 0;
    const maxWaitTime = 30000; // 30秒
    const checkInterval = 1000; // 每1秒检查一次
    
    while (waitTime < maxWaitTime && !this.serviceStarted) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waitTime += checkInterval;
      console.log(`等待中... ${waitTime/1000}秒`);
    }
    
    if (!this.serviceStarted) {
      console.warn('应用启动超时，但继续测试...');
    } else {
      console.log('应用启动成功检测到服务日志');
    }
    
    // 额外等待2秒确保服务完全就绪
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return this.appProcess;
  }

  /**
   * 停止应用
   */
  async stopApp() {
    if (this.appProcess) {
      console.log('停止应用...');
      this.appProcess.kill('SIGTERM');
      
      // 等待进程退出
      await new Promise(resolve => {
        this.appProcess.on('exit', resolve);
        setTimeout(resolve, 5000); // 最多等待5秒
      });
      
      // 如果还没退出，强制杀死
      if (this.appProcess && !this.appProcess.killed) {
        this.appProcess.kill('SIGKILL');
      }
    }
  }

  /**
   * 运行完整测试
   */
  async runTest() {
    console.log('开始测试打包后的应用...\n');

    try {
      // 测试1: 启动应用
      console.log('1. 测试应用启动...');
      await this.startApp();
      this.testResults.appLaunch = true;
      console.log('✅ 应用启动成功\n');

      // 测试2: 等待服务启动
      console.log('2. 等待服务启动...');
      const serviceStarted = await this.waitForService();
      if (serviceStarted) {
        this.testResults.serviceStart = true;
        console.log('✅ 服务启动成功\n');
      } else {
        console.log('❌ 服务启动失败\n');
        throw new Error('服务启动超时');
      }

      // 测试3: 健康检查
      console.log('3. 测试健康检查端点...');
      const healthOk = await this.testHealthCheck();
      if (healthOk) {
        this.testResults.healthCheck = true;
        console.log('✅ 健康检查通过\n');
      } else {
        console.log('❌ 健康检查失败\n');
      }

      // 测试4: Web 界面访问
      console.log('4. 测试 Web 界面访问...');
      const webAccessible = await this.testWebAccess();
      if (webAccessible) {
        this.testResults.webAccess = true;
        console.log('✅ Web 界面可访问\n');
      } else {
        console.log('❌ Web 界面无法访问\n');
      }

    } catch (error) {
      console.error(`测试失败: ${error.message}`);
      this.testResults.errors.push(error.message);
    } finally {
      // 清理
      await this.stopApp();
    }

    // 输出测试结果
    this.printResults();
  }

  /**
   * 输出测试结果
   */
  printResults() {
    console.log('=====================================');
    console.log('测试结果汇总:');
    console.log('=====================================');
    console.log(`应用启动: ${this.testResults.appLaunch ? '✅ 通过' : '❌ 失败'}`);
    console.log(`服务启动: ${this.testResults.serviceStart ? '✅ 通过' : '❌ 失败'}`);
    console.log(`健康检查: ${this.testResults.healthCheck ? '✅ 通过' : '❌ 失败'}`);
    console.log(`Web访问: ${this.testResults.webAccess ? '✅ 通过' : '❌ 失败'}`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n错误信息:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    const allPassed = Object.values(this.testResults).every(value => 
      typeof value === 'boolean' ? value : true
    );

    console.log('\n=====================================');
    if (allPassed) {
      console.log('🎉 所有测试通过！');
      process.exit(0);
    } else {
      console.log('❌ 部分测试失败');
      process.exit(1);
    }
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new PackagedAppTester();
  tester.runTest().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}

export default PackagedAppTester;