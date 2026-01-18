#!/usr/bin/env node

/**
 * NPM Publish Verification Script
 * 验证发布前的所有检查项
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

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

class PublishVerifier {
  runCommand(command, description) {
    try {
      info(`Running: ${description}...`);
      execSync(command, { stdio: 'pipe', cwd: projectRoot });
      success(`${description} passed`);
      return true;
    } catch (err) {
      error(`${description} failed`);
      this.results.errors.push(`${description}: ${err.message}`);
      return false;
    }
  }

  constructor() {
    this.results = {
      lint: false,
      format: false,
      test: false,
      integration: false,
      build: false,
      security: false,
      files: false,
      version: false,
      publishReady: false,
      errors: []
    };
  }

  async runTest() {
    console.log('\n');
    log('='.repeat(60), 'bright');
    log('Enhanced NPM Publish Verification', 'bright');
    log('='.repeat(60), 'bright');
    console.log('\n');

    try {
      // 测试1: Linting
      this.results.lint = this.runCommand('npm run lint:check', 'ESLint check');

      // 测试2: Format
      this.results.format = this.runCommand('npm run format:check', 'Prettier check');

      // 测试3: Unit Tests
      this.results.test = this.runCommand('npm run test:server', 'Unit tests');

      // 测试4: Integration Tests
      this.results.integration = this.runCommand('npm run test:server:integration', 'Integration tests');

      // 测试5: Build Verification
      this.results.build = this.checkBuildArtifacts();

      // 测试6: Security Check
      this.results.security = this.runSecurityCheck();

      // 测试7: Files
      this.checkFilesExist();

      // 测试8: Version consistency
      this.checkVersionConsistency();

      // 验证发布就绪
      this.checkPublishReady();

    } catch (error) {
      this.results.errors.push(error.message);
    }

    this.printResults();
  }

  checkFilesExist() {
    info('Checking files listed in package.json...');

    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const files = packageJson.files || [];
    let allExist = true;

    for (const filePattern of files) {
      if (filePattern.includes('**') || filePattern.includes('*')) {
        const fullPattern = path.join(projectRoot, filePattern);
        const matchedFiles = glob.sync(fullPattern);

        if (matchedFiles.length === 0) {
          error(`No files match pattern: ${filePattern}`);
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
      this.results.files = true;
    }
  }

  checkBuildArtifacts() {
    info('Checking build artifacts...');
    
    const requiredArtifacts = [
      'packages/web/index.html',
      'packages/web/assets/',
      'packages/server/dist/index.js'
    ];
    
    let allArtifactsExist = true;
    
    for (const artifact of requiredArtifacts) {
      const fullPath = path.join(projectRoot, artifact);
      if (!fs.existsSync(fullPath)) {
        error(`Build artifact missing: ${artifact}`);
        allArtifactsExist = false;
      }
    }
    
    if (allArtifactsExist) {
      success('All build artifacts exist');
      return true;
    }
    
    return false;
  }

  runSecurityCheck() {
    info('Running security checks...');
    
    try {
      // Check root package security
      execSync('npm audit --audit-level moderate', { stdio: 'pipe', cwd: projectRoot });
      
      // Check server package security
      execSync('npm audit --audit-level moderate', { stdio: 'pipe', cwd: path.join(projectRoot, 'packages/server') });
      
      success('Security audit passed');
      return true;
    } catch (error) {
      error(`Security audit failed: ${error.message}`);
      return false;
    }
  }

  checkVersionConsistency() {
    info('Checking version consistency...');

    const rootPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    const serverPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'packages/server/package.json'), 'utf8'));
    const desktopPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app/desktop/package.json'), 'utf8'));
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
      this.results.version = true;
    }
  }

  checkPublishReady() {
    info('Checking npm publish readiness...');

    // 检查核心文件存在
    const requiredFiles = [
      'packages/server/index.js',
      'packages/server/server.js',
      'packages/server/app.js',
      'packages/web/index.html'
    ];

    let allFilesExist = true;
    for (const filePath of requiredFiles) {
      const fullPath = path.join(projectRoot, filePath);
      if (!fs.existsSync(fullPath)) {
        error(`Required file missing: ${filePath}`);
        allFilesExist = false;
      }
    }

    // 检查所有关键项目
    const allChecksPass = [
      this.results.lint,
      this.results.format,
      this.results.test,
      this.results.integration,
      this.results.build,
      this.results.security,
      this.results.files,
      this.results.version
    ].every(check => check);

    if (allFilesExist && allChecksPass) {
      success('All checks passed - Ready for publish');
      this.results.publishReady = true;
    } else {
      const failedChecks = [];
      if (!this.results.lint) failedChecks.push('ESLint');
      if (!this.results.format) failedChecks.push('Format');
      if (!this.results.test) failedChecks.push('Unit Tests');
      if (!this.results.integration) failedChecks.push('Integration Tests');
      if (!this.results.build) failedChecks.push('Build');
      if (!this.results.security) failedChecks.push('Security');
      if (!this.results.files) failedChecks.push('Files');
      if (!this.results.version) failedChecks.push('Version');
      
      error(`Not ready for publish. Failed checks: ${failedChecks.join(', ')}`);
      this.results.publishReady = false;
    }
  }

  printResults() {
    console.log('\n');
    log('='.repeat(60), 'bright');
    log('Verification Results', 'bright');
    log('='.repeat(60), 'bright');
    console.log('\n');

    console.log('Code Quality:');
    console.log(`  ESLint:           ${this.results.lint ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Format:            ${this.results.format ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    console.log('Testing:');
    console.log(`  Unit Tests:        ${this.results.test ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Integration Tests: ${this.results.integration ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    console.log('Build & Security:');
    console.log(`  Build Artifacts:   ${this.results.build ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Security Audit:    ${this.results.security ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    console.log('Files & Version:');
    console.log(`  Package Files:     ${this.results.files ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Version Consistency: ${this.results.version ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Publish Ready:     ${this.results.publishReady ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (this.results.errors.length > 0) {
      console.log('Errors:');
      this.results.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${err}`);
      });
      console.log('');
    }

    const allPassed = Object.values(this.results).every(value =>
      typeof value === 'boolean' ? value : true
    );

    console.log('='.repeat(60), 'bright');
    if (allPassed) {
      log('🎉 All verification checks passed!', 'green');
      process.exit(0);
    } else {
      log('❌ CRITICAL CHECKS FAILED!', 'red');
      process.exit(1);
    }
  }
}

// 主执行流程
async function main() {
  console.log('\n');
  log('='.repeat(60), 'bright');
  log('NPM Publish Verification', 'bright');
  log('='.repeat(60), 'bright');
  console.log('\n');

  const verifier = new PublishVerifier();

  try {
    await verifier.runTest();
  } catch (err) {
    console.error(`Verification failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
