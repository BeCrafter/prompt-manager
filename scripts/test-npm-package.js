#!/usr/bin/env node

/**
 * NPM Package Verification Script
 * 完整的npm包本地验证流程
 * 
 * 使用方法:
 *   node scripts/test-npm-package.js
 * 
 * 验证步骤:
 *   1. 运行发布前验证 (lint, test, build, security等)
 *   2. 打包npm包
 *   3. 在临时目录安装npm包
 *   4. 启动服务并测试API
 *   5. 清理临时文件
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

function step(message, num) {
  log(`\n${colors.cyan}[${num}] ${message}${colors.reset}`, 'bright');
}

class NpmPackageVerifier {
  constructor() {
    this.testDir = path.join('/tmp', `npm-package-test-${randomUUID()}`);
    this.packageFile = null;
    this.servicePort = 5621;
    this.serverProcess = null;
    this.results = {
      publishVerify: false,
      packageBuild: false,
      packageInstall: false,
      serviceStart: false,
      apiResponse: false
    };
  }

  async run() {
    console.log('\n');
    log('='.repeat(70), 'bright');
    log('NPM Package Local Verification', 'bright');
    log('='.repeat(70), 'bright');
    console.log('\n');

    try {
      // 步骤1: 运行发布前验证
      step('运行发布前验证 (lint, test, build, security)', 1);
      this.results.publishVerify = this.runCommand('npm run verify:publish', '发布前验证', 120000);

      if (!this.results.publishVerify) {
        error('发布前验证失败，终止测试');
        this.cleanup();
        process.exit(1);
      }

      // 步骤2: 打包npm包
      step('打包npm包', 2);
      this.results.packageBuild = this.buildPackage();

      if (!this.results.packageBuild) {
        error('打包失败，终止测试');
        this.cleanup();
        process.exit(1);
      }

      // 步骤3: 安装npm包到临时目录
      step('安装npm包到临时目录', 3);
      this.results.packageInstall = this.installPackage();

      if (!this.results.packageInstall) {
        error('安装失败，终止测试');
        this.cleanup();
        process.exit(1);
      }

      // 步骤4: 启动服务
      step('启动服务', 4);
      this.results.serviceStart = this.startService();

      if (!this.results.serviceStart) {
        error('服务启动失败，终止测试');
        this.cleanup();
        process.exit(1);
      }

      // 步骤5: 测试API响应
      step('测试API响应', 5);
      this.results.apiResponse = this.testApi();

      if (!this.results.apiResponse) {
        error('API测试失败');
        this.stopService();
        this.cleanup();
        process.exit(1);
      }

      // 打印结果
      this.printResults();

      // 清理
      this.stopService();
      this.cleanup();

      // 退出
      if (this.allPassed()) {
        log('\n🎉 所有验证通过！', 'green');
        process.exit(0);
      } else {
        log('\n❌ 验证失败！', 'red');
        process.exit(1);
      }

    } catch (err) {
      error(`验证过程中发生错误: ${err.message}`);
      this.stopService();
      this.cleanup();
      process.exit(1);
    }
  }

  runCommand(command, description, timeout = 30000) {
    try {
      info(`执行: ${description}...`);
      execSync(command, {
        stdio: 'pipe',
        cwd: projectRoot,
        timeout: timeout
      });
      success(`${description} 完成`);
      return true;
    } catch (err) {
      error(`${description} 失败: ${err.message}`);
      return false;
    }
  }

  buildPackage() {
    try {
      info('正在打包npm包...');
      const output = execSync('npm pack', {
        stdio: 'pipe',
        cwd: projectRoot
      }).toString();

      // 提取包文件名
      const match = output.match(/becrafter-prompt-manager-[\d.]+\.tgz/);
      if (match) {
        this.packageFile = path.join(projectRoot, match[0]);
        success(`npm包已创建: ${match[0]}`);
        return true;
      } else {
        error('无法提取包文件名');
        return false;
      }
    } catch (err) {
      error(`打包失败: ${err.message}`);
      return false;
    }
  }

  installPackage() {
    try {
      info(`创建临时测试目录: ${this.testDir}`);
      fs.mkdirSync(this.testDir, { recursive: true });

      info('安装npm包...');
      execSync(`npm install ${this.packageFile}`, {
        stdio: 'pipe',
        cwd: this.testDir,
        timeout: 120000
      });

      success('npm包安装成功');
      return true;
    } catch (err) {
      error(`安装失败: ${err.message}`);
      return false;
    }
  }

  startService() {
    try {
      info(`启动服务 (端口: ${this.servicePort})...`);

      // 启动服务并记录日志
      const logFile = path.join(this.testDir, 'service.log');
      execSync(
        `npx prompt-manager --port ${this.servicePort} > ${logFile} 2>&1 &`,
        {
          stdio: 'pipe',
          cwd: this.testDir,
          shell: true
        }
      );

      // 等待服务启动
      info('等待服务启动...');
      let attempts = 0;
      const maxAttempts = 30; // 最多等待30秒

      while (attempts < maxAttempts) {
        try {
          // 检查进程是否在运行
          execSync('pgrep -f "prompt-manager"', { stdio: 'pipe' });

          // 尝试连接API
          const response = execSync(
            `curl -s http://localhost:${this.servicePort}/adminapi/config/public`,
            { stdio: 'pipe', timeout: 5000 }
          ).toString();

          if (response && response.includes('serverName')) {
            success('服务启动成功');
            return true;
          }
        } catch (err) {
          // 服务还未就绪，继续等待
        }

        attempts++;
        this.sleep(1000);
      }

      // 检查日志文件
      if (fs.existsSync(logFile)) {
        const logContent = fs.readFileSync(logFile, 'utf8');
        error('服务启动日志:');
        console.log(logContent);
      }

      error('服务启动超时');
      return false;

    } catch (err) {
      error(`服务启动失败: ${err.message}`);
      return false;
    }
  }

  testApi() {
    try {
      info('测试配置API...');
      const response = execSync(
        `curl -s http://localhost:${this.servicePort}/adminapi/config/public`,
        { stdio: 'pipe', timeout: 5000 }
      ).toString();

      const data = JSON.parse(response);
      if (data.success && data.data.serverName === 'prompt-manager') {
        success('配置API响应正常');
      } else {
        error('配置API响应格式异常');
        return false;
      }

      info('测试管理界面...');
      const htmlResponse = execSync(
        `curl -s http://localhost:${this.servicePort}/admin/`,
        { stdio: 'pipe', timeout: 5000 }
      ).toString();

      if (htmlResponse.includes('<!doctype html>') || htmlResponse.includes('<!DOCTYPE html>')) {
        success('管理界面响应正常');
      } else {
        error('管理界面响应异常');
        return false;
      }

      return true;
    } catch (err) {
      error(`API测试失败: ${err.message}`);
      return false;
    }
  }

  stopService() {
    try {
      info('停止服务...');
      execSync('pkill -f "prompt-manager"', { stdio: 'pipe' });
      success('服务已停止');
    } catch (err) {
      // 忽略停止失败
    }
  }

  cleanup() {
    try {
      info('清理临时文件...');
      if (fs.existsSync(this.testDir)) {
        fs.rmSync(this.testDir, { recursive: true, force: true });
      }
      success('清理完成');
    } catch (err) {
      warning(`清理失败: ${err.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  warning(message) {
    log(`⚠ ${message}`, 'yellow');
  }

  allPassed() {
    return Object.values(this.results).every(value => value === true);
  }

  printResults() {
    console.log('\n');
    log('='.repeat(70), 'bright');
    log('验证结果', 'bright');
    log('='.repeat(70), 'bright');
    console.log('\n');

    console.log('发布前验证:');
    console.log(`  Lint & Test & Build:  ${this.results.publishVerify ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    console.log('NPM包构建:');
    console.log(`  Package Build:        ${this.results.packageBuild ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    console.log('NPM包安装:');
    console.log(`  Package Install:      ${this.results.packageInstall ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    console.log('服务运行:');
    console.log(`  Service Start:        ${this.results.serviceStart ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  API Response:         ${this.results.apiResponse ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    console.log('='.repeat(70), 'bright');
  }
}

// 主执行流程
async function main() {
  const verifier = new NpmPackageVerifier();
  await verifier.run();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});