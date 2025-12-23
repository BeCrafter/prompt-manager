#!/usr/bin/env node

/**
 * Prompt Manager 统一测试运行器
 * 
 * 这个脚本提供了统一的测试入口，可以运行不同类型和范围的测试
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TestRunner {
  constructor() {
    this.projectRoot = join(__dirname, '..');
    this.serverDir = join(this.projectRoot, 'packages/server');
    this.testDir = join(this.projectRoot, 'test');
  }

  /**
   * 运行命令
   */
  async runCommand(command, cwd = this.projectRoot) {
    return new Promise((resolve, reject) => {
      console.log(`\n📁 目录: ${cwd}`);
      console.log(`🔧 执行: ${command}`);
      console.log('─'.repeat(50));

      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        cwd,
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('✅ 命令执行成功');
          resolve(0);
        } else {
          console.log(`❌ 命令执行失败，退出码: ${code}`);
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        console.error(`❌ 执行错误: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * 运行服务器单元测试
   */
  async runServerUnitTests() {
    console.log('\n🧪 运行服务器单元测试...');
    await this.runCommand('npm run test', this.serverDir);
  }

  /**
   * 运行服务器集成测试
   */
  async runServerIntegrationTests() {
    console.log('\n🔗 运行服务器集成测试...');
    await this.runCommand('npm run test:integration', this.serverDir);
  }

  /**
   * 运行E2E测试
   */
  async runE2ETests() {
    console.log('\n🎭 运行E2E测试...');
    await this.runCommand('node test/e2e/test-packaged-app.js');
  }

  /**
   * 运行上传功能测试
   */
  async runUploadTests() {
    console.log('\n📤 运行上传功能测试...');
    await this.runCommand('node test/integration/test_upload.js');
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始运行所有测试...');
    
    try {
      await this.runServerUnitTests();
      await this.runServerIntegrationTests();
      await this.runUploadTests();
      // E2E测试需要打包应用，暂时跳过
      // await this.runE2ETests();
      
      console.log('\n🎉 所有测试通过！');
      return 0;
    } catch (error) {
      console.error('\n💥 测试失败:', error.message);
      return 1;
    }
  }

  /**
   * 运行代码质量检查
   */
  async runQualityChecks() {
    console.log('\n🔍 运行代码质量检查...');
    
    try {
      await this.runCommand('npm run lint:check', this.serverDir);
      await this.runCommand('npm run format:check', this.serverDir);
      
      console.log('\n✅ 代码质量检查通过！');
      return 0;
    } catch (error) {
      console.error('\n❌ 代码质量检查失败:', error.message);
      return 1;
    }
  }
}

// 主函数
async function main() {
  const runner = new TestRunner();
  const args = process.argv.slice(2);
  
  let exitCode = 0;
  
  try {
    if (args.includes('--unit')) {
      await runner.runServerUnitTests();
    } else if (args.includes('--integration')) {
      await runner.runServerIntegrationTests();
    } else if (args.includes('--e2e')) {
      await runner.runE2ETests();
    } else if (args.includes('--upload')) {
      await runner.runUploadTests();
    } else if (args.includes('--quality')) {
      exitCode = await runner.runQualityChecks();
    } else {
      exitCode = await runner.runAllTests();
    }
  } catch (error) {
    console.error('测试运行失败:', error);
    exitCode = 1;
  }
  
  process.exit(exitCode);
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TestRunner;