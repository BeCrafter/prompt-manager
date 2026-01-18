#!/usr/bin/env node

/**
 * Pre-release Check Script
 * 发布前的全面检查和验证
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
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

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

class PreReleaseChecker {
  constructor(version) {
    this.version = version;
    this.projectRoot = projectRoot;
    this.checks = [
      'versionFormat',
      'dependencyCheck',
      'lint',
      'format',
      'unitTests',
      'integrationTests',
      'build',
      'security',
      'documentation',
      'fileExistence'
    ];
    this.results = {};
  }

  async runAllChecks() {
    console.log(`\n🔍 Running pre-release checks for version: ${colors.bright}${this.version}${colors.reset}`);
    console.log('='.repeat(60));

    let allPassed = true;

    for (const check of this.checks) {
      console.log(`\n📋 Running ${check}...`);
      try {
        this.results[check] = await this.runCheck(check);
        if (this.results[check].success) {
          success(`${check}: ${this.results[check].message}`);
        } else {
          error(`${check}: ${this.results[check].message}`);
          allPassed = false;
        }
      } catch (err) {
        error(`${check}: ${err.message}`);
        this.results[check] = { success: false, message: err.message };
        allPassed = false;
      }
    }

    this.printSummary(allPassed);
    return allPassed;
  }

  async runCheck(checkName) {
    switch (checkName) {
      case 'versionFormat':
        return this.checkVersionFormat();
      case 'dependencyCheck':
        return this.checkDependencies();
      case 'lint':
        return this.runLinting();
      case 'format':
        return this.runFormatting();
      case 'unitTests':
        return this.runUnitTests();
      case 'integrationTests':
        return this.runIntegrationTests();
      case 'build':
        return this.runBuild();
      case 'security':
        return this.runSecurityCheck();
      case 'documentation':
        return this.checkDocumentation();
      case 'fileExistence':
        return this.checkRequiredFiles();
      default:
        throw new Error(`Unknown check: ${checkName}`);
    }
  }

  async checkVersionFormat() {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?$/;
    const prefixedRegex = /^(beta|canary)-(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?$/;
    const vPrefixedRegex = /^v(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?$/;
    
    if (semverRegex.test(this.version) || prefixedRegex.test(this.version) || vPrefixedRegex.test(this.version)) {
      return { success: true, message: 'Valid version format' };
    }
    
    return { success: false, message: 'Invalid version format. Expected: 1.0.0, v1.0.0, beta-1.0.0, or canary-1.0.0' };
  }

  async checkDependencies() {
    try {
      info('Checking project dependencies...');
      execSync('npm run check:deps', { stdio: 'pipe', cwd: this.projectRoot });
      return { success: true, message: 'Dependencies are valid' };
    } catch (error) {
      return { success: false, message: 'Dependency check failed' };
    }
  }

  async runLinting() {
    try {
      info('Running ESLint...');
      execSync('npm run lint:check', { stdio: 'pipe', cwd: this.projectRoot });
      return { success: true, message: 'No linting errors' };
    } catch (error) {
      return { success: false, message: 'Linting errors found' };
    }
  }

  async runFormatting() {
    try {
      info('Checking code formatting...');
      execSync('npm run format:check', { stdio: 'pipe', cwd: this.projectRoot });
      return { success: true, message: 'Code formatting is correct' };
    } catch (error) {
      return { success: false, message: 'Code formatting issues found' };
    }
  }

  async runUnitTests() {
    try {
      info('Running unit tests...');
      execSync('npm run test:server', { stdio: 'pipe', cwd: this.projectRoot });
      return { success: true, message: 'All unit tests passed' };
    } catch (error) {
      return { success: false, message: 'Some unit tests failed' };
    }
  }

  async runIntegrationTests() {
    try {
      info('Running integration tests...');
      execSync('npm run test:server:integration', { stdio: 'pipe', cwd: this.projectRoot });
      return { success: true, message: 'All integration tests passed' };
    } catch (error) {
      return { success: false, message: 'Some integration tests failed' };
    }
  }

  async runBuild() {
    try {
      info('Building admin UI...');
      execSync('npm run build:admin-ui', { stdio: 'pipe', cwd: this.projectRoot });
      
      info('Building core package...');
      execSync('npm run build:core', { stdio: 'pipe', cwd: this.projectRoot });
      
      return { success: true, message: 'Build completed successfully' };
    } catch (error) {
      return { success: false, message: 'Build failed' };
    }
  }

  async runSecurityCheck() {
    try {
      info('Running security audit...');
      execSync('npm audit --audit-level moderate', { stdio: 'pipe', cwd: this.projectRoot });
      
      info('Checking server dependencies...');
      execSync('cd packages/server && npm audit --audit-level moderate', { stdio: 'pipe', cwd: this.projectRoot });
      
      return { success: true, message: 'No security vulnerabilities found' };
    } catch (error) {
      return { success: false, message: 'Security vulnerabilities detected' };
    }
  }

  async checkDocumentation() {
    const requiredDocs = [
      'README.md',
      'AGENTS.md',
      'packages/server/README.md'
    ];

    let missingDocs = [];
    for (const doc of requiredDocs) {
      const fullPath = path.join(this.projectRoot, doc);
      if (!fs.existsSync(fullPath)) {
        missingDocs.push(doc);
      }
    }

    if (missingDocs.length === 0) {
      return { success: true, message: 'All required documentation exists' };
    }

    return { success: false, message: `Missing documentation: ${missingDocs.join(', ')}` };
  }

  async checkRequiredFiles() {
    const requiredFiles = [
      'package.json',
      'packages/server/package.json',
      'app/desktop/package.json',
      'packages/server/index.js',
      'packages/server/server.js',
      'packages/web/index.html',
      'env.example'
    ];

    let missingFiles = [];
    for (const file of requiredFiles) {
      const fullPath = path.join(this.projectRoot, file);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length === 0) {
      return { success: true, message: 'All required files exist' };
    }

    return { success: false, message: `Missing files: ${missingFiles.join(', ')}` };
  }

  printSummary(allPassed) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Pre-release Check Summary');
    console.log('='.repeat(60));

    const passed = Object.values(this.results).filter(result => result.success).length;
    const total = Object.keys(this.results).length;

    console.log(`\nResults: ${passed}/${total} checks passed\n`);

    for (const [checkName, result] of Object.entries(this.results)) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${checkName.padEnd(20)} ${status}`);
    }

    console.log('\n' + '='.repeat(60));

    if (allPassed) {
      log('🎉 All pre-release checks passed!', 'green');
      log(`✨ Ready to release version ${this.version}`, 'cyan');
    } else {
      log('❌ Some pre-release checks failed!', 'red');
      log('🔧 Please fix the issues before releasing', 'yellow');
    }
  }
}

// 主执行流程
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log(`
🔍 Pre-release Check Script

Usage:
  node scripts/pre-release-check.js <version> [options]

Arguments:
  version           Version to check (e.g., 1.0.0, beta-1.0.0, canary-1.0.0)

Options:
  --quick           Run only essential checks (lint, format, unit tests)
  --help            Show this help message

Examples:
  node scripts/pre-release-check.js 1.0.0
  node scripts/pre-release-check.js beta-1.0.0 --quick
`);
    process.exit(0);
  }

  const version = args[0];
  const isQuick = args.includes('--quick');

  if (!version) {
    error('Version argument is required');
    process.exit(1);
  }

  try {
    const checker = new PreReleaseChecker(version);
    
    if (isQuick) {
      // 快速检查模式，只运行核心检查
      checker.checks = ['versionFormat', 'lint', 'format', 'unitTests'];
    }
    
    const allPassed = await checker.runAllChecks();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    error(`Pre-release check failed: ${error.message}`);
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  error('Unhandled Rejection:', error);
  process.exit(1);
});

main().catch((err) => {
  error('Fatal error:', err);
  process.exit(1);
});