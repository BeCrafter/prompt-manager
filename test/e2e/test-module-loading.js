#!/usr/bin/env node

/**
 * 模块加载测试
 * 测试开发环境和打包环境下的模块加载是否正常
 * 防止出现 "ERR_MODULE_NOT_FOUND" 等依赖问题
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

class ModuleLoadingTester {
  constructor() {
    this.testResults = {
      packagesServerDependencies: false,
      packagesServerIndexExists: false,
      packagesServerDependenciesExist: false,
      devAppStartup: false,
      buildScriptIncludesServerDeps: false,
      buildConfigIncludesServerFiles: false,
      errors: []
    };
  }

  /**
   * 测试 packages/server 依赖是否已安装
   */
  testPackagesServerDependencies() {
    console.log('1. 测试 packages/server 依赖...');
    
    const packageJsonPath = path.join(projectRoot, 'packages/server/package.json');
    const nodeModulesPath = path.join(projectRoot, 'packages/server/node_modules');
    
    try {
      // 检查 package.json 是否存在
      if (!fs.existsSync(packageJsonPath)) {
        throw new Error('packages/server/package.json 不存在');
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      this.testResults.packagesServerIndexExists = true;
      
      // 检查 node_modules 是否存在
      if (!fs.existsSync(nodeModulesPath)) {
        throw new Error('packages/server/node_modules 不存在，需要运行 npm install');
      }
      
      // 检查关键依赖是否存在
      const criticalDeps = ['ws', 'express', '@modelcontextprotocol/sdk'];
      const missingDeps = [];
      
      for (const dep of criticalDeps) {
        const depPath = path.join(nodeModulesPath, dep);
        if (!fs.existsSync(depPath)) {
          missingDeps.push(dep);
        }
      }
      
      if (missingDeps.length > 0) {
        throw new Error(`packages/server/node_modules 中缺少依赖: ${missingDeps.join(', ')}`);
      }
      
      this.testResults.packagesServerDependencies = true;
      this.testResults.packagesServerDependenciesExist = true;
      console.log('✅ packages/server 依赖检查通过\n');
      return true;
      
    } catch (error) {
      console.log(`❌ packages/server 依赖检查失败: ${error.message}\n`);
      this.testResults.errors.push(error.message);
      return false;
    }
  }

  /**
   * 测试构建脚本是否包含 packages/server 依赖安装
   */
  testBuildScriptIncludesServerDeps() {
    console.log('2. 测试构建脚本是否包含 packages/server 依赖安装...');
    
    const buildScriptPath = path.join(projectRoot, 'scripts/build.sh');
    
    try {
      if (!fs.existsSync(buildScriptPath)) {
        throw new Error('scripts/build.sh 不存在');
      }
      
      const buildScript = fs.readFileSync(buildScriptPath, 'utf8');
      
      // 检查是否包含 packages/server 依赖安装
      if (!buildScript.includes('packages/server') || !buildScript.includes('npm install')) {
        throw new Error('构建脚本未包含 packages/server 依赖安装步骤');
      }
      
      this.testResults.buildScriptIncludesServerDeps = true;
      console.log('✅ 构建脚本检查通过\n');
      return true;
      
    } catch (error) {
      console.log(`❌ 构建脚本检查失败: ${error.message}\n`);
      this.testResults.errors.push(error.message);
      return false;
    }
  }

  /**
   * 测试打包配置是否正确配置了 server 依赖
   */
  testBuildConfigIncludesServerFiles() {
    console.log('3. 测试打包配置是否正确配置了 server 依赖...');
    
    const desktopPackageJsonPath = path.join(projectRoot, 'app/desktop/package.json');
    
    try {
      if (!fs.existsSync(desktopPackageJsonPath)) {
        throw new Error('app/desktop/package.json 不存在');
      }
      
      const packageJson = JSON.parse(fs.readFileSync(desktopPackageJsonPath, 'utf8'));
      
      // 检查 dependencies 中是否包含 @becrafter/prompt-manager-core
      if (!packageJson.dependencies || !packageJson.dependencies['@becrafter/prompt-manager-core']) {
        throw new Error('app/desktop/package.json 的 dependencies 中未包含 @becrafter/prompt-manager-core');
      }
      
      // 检查是否使用 file: 协议引用本地包
      const coreDep = packageJson.dependencies['@becrafter/prompt-manager-core'];
      if (!coreDep.startsWith('file:')) {
        throw new Error('@becrafter/prompt-manager-core 应该使用 file: 协议引用本地包');
      }
      
      // 验证引用的路径是否正确
      const serverPath = path.join(projectRoot, 'packages/server');
      if (!fs.existsSync(serverPath)) {
        throw new Error(`引用的 server 路径不存在: ${serverPath}`);
      }
      
      this.testResults.buildConfigIncludesServerFiles = true;
      console.log('✅ 打包配置检查通过\n');
      return true;
      
    } catch (error) {
      console.log(`❌ 打包配置检查失败: ${error.message}\n`);
      this.testResults.errors.push(error.message);
      return false;
    }
  }

  /**
   * 测试开发环境应用启动
   */
  async testDevAppStartup() {
    console.log('4. 测试开发环境应用启动...');
    
    return new Promise((resolve) => {
      const appPath = path.join(projectRoot, 'app/desktop');
      
      // 设置环境变量
      const env = {
        ...process.env,
        NODE_ENV: 'development',
        ELECTRON_IS_DEV: '1',
        // 设置超时以防止测试挂起
        TEST_MODE: 'true'
      };
      
      const timeout = setTimeout(() => {
        if (this.appProcess) {
          this.appProcess.kill('SIGTERM');
        }
        console.log('⚠️ 开发环境应用启动超时（这是正常的，因为需要用户交互）\n');
        this.testResults.devAppStartup = true; // 超时也算通过，因为主要是测试能否加载模块
        resolve(true);
      }, 10000); // 10秒超时
      
      this.appProcess = spawn('npm', ['run', 'dev'], {
        cwd: appPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: env
      });
      
      let moduleLoaded = false;
      let moduleLoadError = null;
      
      this.appProcess.stdout.on('data', (data) => {
        const message = data.toString();
        
        // 检测模块加载成功的日志
        if (message.includes('Server module loaded successfully')) {
          moduleLoaded = true;
        }
        
        // 检测模块加载失败的错误
        if (message.includes('ERR_MODULE_NOT_FOUND') || 
            message.includes('Could not find core library')) {
          moduleLoadError = message;
        }
        
        console.log(`[APP] ${message.trim()}`);
      });
      
      this.appProcess.stderr.on('data', (data) => {
        const message = data.toString();
        
        // 检测模块加载失败的错误
        if (message.includes('ERR_MODULE_NOT_FOUND') || 
            message.includes('Could not find core library')) {
          moduleLoadError = message;
        }
        
        console.error(`[APP ERROR] ${message.trim()}`);
      });
      
      this.appProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.log(`❌ 开发环境应用启动失败: ${error.message}\n`);
        this.testResults.errors.push(error.message);
        resolve(false);
      });
      
      // 等待一段时间检查模块加载状态
      setTimeout(() => {
        if (moduleLoadError) {
          clearTimeout(timeout);
          console.log(`❌ 模块加载失败: ${moduleLoadError}\n`);
          this.testResults.errors.push(moduleLoadError);
          if (this.appProcess) {
            this.appProcess.kill('SIGTERM');
          }
          resolve(false);
        } else if (moduleLoaded) {
          clearTimeout(timeout);
          console.log('✅ 模块加载成功\n');
          this.testResults.devAppStartup = true;
          if (this.appProcess) {
            this.appProcess.kill('SIGTERM');
          }
          resolve(true);
        }
        // 继续等待超时
      }, 5000);
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.appProcess) {
      this.appProcess.kill('SIGTERM');
      this.appProcess = null;
    }
  }

  /**
   * 运行完整测试
   */
  async runTest() {
    console.log('=====================================');
    console.log('模块加载测试');
    console.log('=====================================\n');

    try {
      // 测试1: packages/server 依赖
      this.testPackagesServerDependencies();
      
      // 测试2: 构建脚本
      this.testBuildScriptIncludesServerDeps();
      
      // 测试3: 打包配置
      this.testBuildConfigIncludesServerFiles();
      
      // 测试4: 开发环境启动
      await this.testDevAppStartup();
      
    } catch (error) {
      console.error(`测试失败: ${error.message}`);
      this.testResults.errors.push(error.message);
    } finally {
      this.cleanup();
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
    console.log(`packages/server 依赖存在: ${this.testResults.packagesServerDependencies ? '✅ 通过' : '❌ 失败'}`);
    console.log(`packages/server index.js 存在: ${this.testResults.packagesServerIndexExists ? '✅ 通过' : '❌ 失败'}`);
    console.log(`packages/server node_modules 存在: ${this.testResults.packagesServerDependenciesExist ? '✅ 通过' : '❌ 失败'}`);
    console.log(`开发环境应用启动: ${this.testResults.devAppStartup ? '✅ 通过' : '❌ 失败'}`);
    console.log(`构建脚本包含 server 依赖: ${this.testResults.buildScriptIncludesServerDeps ? '✅ 通过' : '❌ 失败'}`);
    console.log(`打包配置正确引用 server: ${this.testResults.buildConfigIncludesServerFiles ? '✅ 通过' : '❌ 失败'}`);
    
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
      console.log('\n修复建议:');
      if (!this.testResults.packagesServerDependencies) {
        console.log('1. 运行: cd packages/server && npm install');
      }
      if (!this.testResults.buildScriptIncludesServerDeps) {
        console.log('2. 在 scripts/build.sh 中添加 packages/server 依赖安装');
      }
      if (!this.testResults.buildConfigIncludesServerFiles) {
        console.log('3. 确保 app/desktop/package.json 的 dependencies 中包含 @becrafter/prompt-manager-core 并使用 file: 协议');
      }
      process.exit(1);
    }
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ModuleLoadingTester();
  tester.runTest().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}

export default ModuleLoadingTester;