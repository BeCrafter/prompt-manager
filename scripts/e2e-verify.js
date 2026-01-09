#!/usr/bin/env node

/**
 * Comprehensive E2E Verification Script
 * 综合端到端验证脚本
 * 验证 npm 包和桌面应用的完整流程
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

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

function warn(message) {
  log(`⚠ ${message}`, 'yellow');
}

class E2EVerifier {
  constructor() {
    this.results = {
      // 代码质量检查
      lint: false,
      format: false,
      test: false,

      // 依赖检查
      rootDeps: false,
      serverDeps: false,
      desktopDeps: false,
      adminUiDeps: false,

      // 构建检查
      adminUiBuilt: false,
      coreBuilt: false,
      desktopBuildable: false,

      // 模块加载检查
      moduleLoading: false,
      devAppStartup: false,

      // npm 包检查
      packageFiles: false,
      versionConsistency: false,
      npmPublishReady: false,

      // 桌面应用检查
      desktopConfig: false,
      electronBuild: false,
      desktopPackable: false,

      // E2E 功能测试
      e2eAppLaunch: false,
      e2eServiceStart: false,
      e2eHealthCheck: false,
      e2eWebAccess: false,

      errors: [],
      warnings: [],
    };
  }

  async runCommand(command, description, cwd = __dirname) {
    try {
      info(`Running: ${description}...`);
      execSync(command, { stdio: 'pipe', cwd, timeout: 120000 });
      success(`${description} passed`);
      return true;
    } catch (err) {
      error(`${description} failed`);
      this.results.errors.push(`${description}: ${err.message}`);
      return false;
    }
  }

  // ========== 代码质量检查 ==========
  async checkLint() {
    info('Checking code linting...');
    this.results.lint = await this.runCommand(
      'npm run lint:check',
      'ESLint check'
    );
  }

  async checkFormat() {
    info('Checking code formatting...');
    this.results.format = await this.runCommand(
      'npm run format:check',
      'Prettier check'
    );
  }

  async checkTests() {
    info('Running all tests...');
    this.results.test = await this.runCommand(
      'npm test',
      'All tests'
    );
  }

  // ========== 依赖检查 ==========
  checkDependencies() {
    info('Checking dependencies...');

    const checks = [
      { path: path.join(projectRoot, 'node_modules'), name: 'root' },
      { path: path.join(projectRoot, 'packages/server/node_modules'), name: 'server' },
      { path: path.join(projectRoot, 'app/desktop/node_modules'), name: 'desktop' },
      { path: path.join(projectRoot, 'packages/admin-ui/node_modules'), name: 'admin-ui' },
    ];

    for (const check of checks) {
      if (fs.existsSync(check.path)) {
        success(`${check.name} dependencies installed`);
        if (check.name === 'root') this.results.rootDeps = true;
        if (check.name === 'server') this.results.serverDeps = true;
        if (check.name === 'desktop') this.results.desktopDeps = true;
        if (check.name === 'admin-ui') this.results.adminUiDeps = true;
      } else {
        warn(`${check.name} dependencies not found`);
        this.results.warnings.push(`${check.name} dependencies not installed`);
      }
    }
  }

  // ========== 构建检查 ==========
  checkAdminUIBuilt() {
    info('Checking admin UI build...');

    const webDir = path.join(projectRoot, 'packages/web');
    const indexHtml = path.join(webDir, 'index.html');

    if (fs.existsSync(webDir) && fs.existsSync(indexHtml)) {
      success('Admin UI built');
      this.results.adminUiBuilt = true;
    } else {
      error('Admin UI not built');
      this.results.errors.push('Admin UI not built');
    }
  }

  async checkCoreBuilt() {
    info('Checking core build...');

    const distDir = path.join(projectRoot, 'packages/server/dist');
    if (fs.existsSync(distDir)) {
      success('Core package built');
      this.results.coreBuilt = true;
    } else {
      warn('Core package not built (optional for development)');
      this.results.warnings.push('Core package not built');
    }
  }

  checkDesktopBuildable() {
    info('Checking desktop build configuration...');

    const desktopPackage = path.join(projectRoot, 'app/desktop/package.json');
    const buildConfig = path.join(projectRoot, 'app/desktop/package.json');

    if (fs.existsSync(desktopPackage)) {
      const packageJson = JSON.parse(fs.readFileSync(desktopPackage, 'utf8'));

      // 检查 build 配置
      if (packageJson.build && packageJson.build.files) {
        success('Desktop build configuration valid');
        this.results.desktopBuildable = true;
      } else {
        error('Desktop build configuration missing');
        this.results.errors.push('Desktop build configuration missing');
      }
    } else {
      error('Desktop package.json not found');
      this.results.errors.push('Desktop package.json not found');
    }
  }

  // ========== 模块加载检查 ==========
  async checkModuleLoading() {
    info('Checking module loading...');

    this.results.moduleLoading = await this.runCommand(
      'node test/e2e/test-module-loading.js',
      'Module loading test'
    );
  }

  // ========== npm 包检查 ==========
  checkPackageFiles() {
    info('Checking package files...');

    const rootPackage = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(rootPackage, 'utf8'));

    const files = packageJson.files || [];
    let allExist = true;

    for (const filePattern of files) {
      if (filePattern.includes('**')) {
        const dir = path.join(projectRoot, filePattern.split('**')[0]);
        if (fs.existsSync(dir)) {
          // 验证目录非空
          const items = fs.readdirSync(dir);
          if (items.length === 0) {
            warn(`Empty directory: ${filePattern}`);
            allExist = false;
          }
        } else {
          error(`Directory missing: ${filePattern}`);
          allExist = false;
        }
      } else {
        const fullPath = path.join(projectRoot, filePattern);
        if (!fs.existsSync(fullPath)) {
          error(`File missing: ${filePattern}`);
          allExist = false;
        }
      }
    }

    if (allExist) {
      success('All package files exist');
      this.results.packageFiles = true;
    }
  }

  checkVersionConsistency() {
    info('Checking version consistency...');

    const rootPackage = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
    );
    const serverPackage = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'packages/server/package.json'), 'utf8')
    );
    const desktopPackage = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'app/desktop/package.json'), 'utf8')
    );
    const envExample = fs.readFileSync(path.join(projectRoot, 'env.example'), 'utf8');

    const version = rootPackage.version;
    let consistent = true;

    if (serverPackage.version !== version) {
      error(`Server version mismatch: ${serverPackage.version} != ${version}`);
      consistent = false;
    }

    if (desktopPackage.version !== version) {
      error(`Desktop version mismatch: ${desktopPackage.version} != ${version}`);
      consistent = false;
    }

    const envVersionMatch = envExample.match(/MCP_SERVER_VERSION=(.+)/);
    if (envVersionMatch) {
      const envVersion = envVersionMatch[1].trim();
      if (envVersion !== version) {
        error(`env.example version mismatch: ${envVersion} != ${version}`);
        consistent = false;
      }
    }

    if (consistent) {
      success('Version consistency verified');
      this.results.versionConsistency = true;
    }
  }

  async checkNPMPublishReady() {
    info('Checking npm publish readiness...');

    const result = await this.runCommand(
      'node scripts/verify-publish.js',
      'NPM publish verification'
    );

    this.results.npmPublishReady = result;
  }

  // ========== 桌面应用检查 ==========
  checkDesktopConfig() {
    info('Checking desktop configuration...');

    const desktopPackage = path.join(projectRoot, 'app/desktop/package.json');
    const packageJson = JSON.parse(fs.readFileSync(desktopPackage, 'utf8'));

    // 检查核心依赖
    const coreDep = packageJson.dependencies?.['@becrafter/prompt-manager-core'];
    if (coreDep) {
      if (coreDep.startsWith('file:')) {
        success('Desktop uses local core package');
        this.results.desktopConfig = true;
      } else {
        error('Desktop should use file: protocol for core package');
        this.results.errors.push('Desktop not using file: protocol');
      }
    } else {
      error('Desktop missing core dependency');
      this.results.errors.push('Desktop missing core dependency');
    }
  }

  async checkElectronBuild() {
    info('Checking Electron build readiness...');

    const electronPath = path.join(projectRoot, 'app/desktop/node_modules/electron');
    if (fs.existsSync(electronPath)) {
      success('Electron installed');
      this.results.electronBuild = true;
    } else {
      error('Electron not installed');
      this.results.errors.push('Electron not installed');
    }
  }

  checkDesktopPackable() {
    info('Checking desktop packable configuration...');

    const desktopPackage = path.join(projectRoot, 'app/desktop/package.json');
    const packageJson = JSON.parse(fs.readFileSync(desktopPackage, 'utf8'));

    // 检查 electron-builder 配置
    if (packageJson.build && packageJson.build.files) {
      success('Desktop packable configuration valid');
      this.results.desktopPackable = true;
    } else {
      error('Desktop packable configuration missing');
      this.results.errors.push('Desktop packable configuration missing');
    }
  }

  // ========== E2E 功能测试 ==========
  async checkE2ETests() {
    info('Running E2E tests...');

    // 注意：E2E 测试需要打包后的应用
    // 这里只检查测试脚本是否存在
    const e2eTestPath = path.join(projectRoot, 'test/e2e/test-packaged-app.js');
    if (fs.existsSync(e2eTestPath)) {
      success('E2E test script exists');
      warn('E2E tests require packaged app. Run: npm run desktop:build && npm run test:e2e');
      return true;
    } else {
      error('E2E test script not found');
      this.results.errors.push('E2E test script not found');
      return false;
    }
  }

  // ========== 并行执行所有检查 ==========
  async runParallelChecks() {
    info('Running parallel checks...\n');

    // 代码质量检查（可以并行）
    await Promise.all([
      this.checkLint(),
      this.checkFormat(),
      this.checkTests(),
    ]);

    console.log('');

    // 依赖检查
    this.checkDependencies();

    console.log('');

    // 构建检查
    this.checkAdminUIBuilt();
    await this.checkCoreBuilt();
    this.checkDesktopBuildable();

    console.log('');

    // npm 包检查
    await this.checkNPMPublishReady();
    this.checkPackageFiles();
    this.checkVersionConsistency();

    console.log('');

    // 桌面应用检查
    this.checkDesktopConfig();
    await this.checkElectronBuild();
    this.checkDesktopPackable();

    console.log('');

    // 模块加载检查
    await this.checkModuleLoading();

    console.log('');

    // E2E 测试检查
    await this.checkE2ETests();
  }

  // ========== 输出结果 ==========
  printResults() {
    console.log('\n');
    log('='.repeat(60), 'bright');
    log('E2E Verification Results', 'bright');
    log('='.repeat(60), 'bright');
    console.log('\n');

    // 代码质量检查
    log('Code Quality Checks:', 'cyan');
    console.log(`  ESLint:         ${this.results.lint ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Format:          ${this.results.format ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Tests:           ${this.results.test ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 依赖检查
    log('Dependency Checks:', 'cyan');
    console.log(`  Root deps:       ${this.results.rootDeps ? '✅ PASS' : '⚠️  WARN'}`);
    console.log(`  Server deps:     ${this.results.serverDeps ? '✅ PASS' : '⚠️  WARN'}`);
    console.log(`  Desktop deps:    ${this.results.desktopDeps ? '✅ PASS' : '⚠️  WARN'}`);
    console.log(`  Admin UI deps:   ${this.results.adminUiDeps ? '✅ PASS' : '⚠️  WARN'}`);
    console.log('');

    // 构建检查
    log('Build Checks:', 'cyan');
    console.log(`  Admin UI:        ${this.results.adminUiBuilt ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Core:            ${this.results.coreBuilt ? '✅ PASS' : '⚠️  WARN'}`);
    console.log(`  Desktop build:    ${this.results.desktopBuildable ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // npm 包检查
    log('NPM Package Checks:', 'cyan');
    console.log(`  Package files:   ${this.results.packageFiles ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Version check:    ${this.results.versionConsistency ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Publish ready:    ${this.results.npmPublishReady ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 桌面应用检查
    log('Desktop App Checks:', 'cyan');
    console.log(`  Config:          ${this.results.desktopConfig ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Electron:        ${this.results.electronBuild ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Packable:        ${this.results.desktopPackable ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // 模块加载检查
    log('Module Loading:', 'cyan');
    console.log(`  Module loading:  ${this.results.moduleLoading ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    // E2E 测试检查
    log('E2E Tests:', 'cyan');
    console.log(`  E2E scripts:    ${this.results.e2eAppLaunch ? '✅ PASS' : '⚠️  SKIP'}`);
    console.log('');

    // 错误和警告
    if (this.results.errors.length > 0) {
      log('Errors:', 'red');
      this.results.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
      console.log('');
    }

    if (this.results.warnings.length > 0) {
      log('Warnings:', 'yellow');
      this.results.warnings.forEach((warn, idx) => {
        console.log(`  ${idx + 1}. ${warn}`);
      });
      console.log('');
    }

    // 总结
    log('='.repeat(60), 'bright');
    const criticalChecks = [
      this.results.lint,
      this.results.format,
      this.results.test,
      this.results.adminUiBuilt,
      this.results.packageFiles,
      this.results.versionConsistency,
      this.results.moduleLoading,
      this.results.desktopConfig,
      this.results.electronBuild,
    ];

    const allCriticalPassed = criticalChecks.every(check => check === true);

    if (allCriticalPassed && this.results.errors.length === 0) {
      log('🎉 All critical checks PASSED!', 'green');
      log('\nNext steps:', 'blue');
      console.log('  1. For NPM publish:');
      console.log('     npm version <major|minor|patch>');
      console.log('     git push origin main');
      console.log('     git tag v<version>');
      console.log('     git push origin v<version>');
      console.log('');
      console.log('  2. For desktop app build:');
      console.log('     npm run desktop:build');
      console.log('     npm run test:e2e');
      console.log('');
      process.exit(0);
    } else {
      log('❌ CRITICAL CHECKS FAILED!', 'red');
      log('\nFix required:', 'yellow');
      console.log('  1. Fix linting issues: npm run lint');
      console.log('  2. Fix formatting issues: npm run format');
      console.log('  3. Fix test failures: npm test');
      console.log('  4. Build admin UI: npm run build:admin-ui');
      console.log('  5. Check module loading: npm run test:module-loading');
      console.log('  6. Install dependencies: npm run check:deps');
      console.log('');
      process.exit(1);
    }
  }
}

// 主执行流程
async function main() {
  console.log('\n');
  log('='.repeat(60), 'bright');
  log('Comprehensive E2E Verification', 'bright');
  log('='.repeat(60), 'bright');
  console.log('\n');

  const verifier = new E2EVerifier();

  try {
    await verifier.runParallelChecks();
    verifier.printResults();
  } catch (err) {
    error(`Verification failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  error(err.message);
  process.exit(1);
});
