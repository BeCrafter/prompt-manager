#!/usr/bin/env node

/**
 * Rollback Release Script
 * 处理发布回滚操作，包括unpublish和版本恢复
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

class RollbackManager {
  constructor() {
    this.projectRoot = projectRoot;
    this.packageName = '@becrafter/prompt-manager';
  }

  async rollback(version, options = {}) {
    const { dryRun = false, force = false, reason = '' } = options;
    
    console.log(`🔄 Starting rollback for version ${version}`);
    if (reason) {
      console.log(`📝 Reason: ${reason}`);
    }
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No actual changes will be made');
    }

    try {
      // 1. 验证版本格式
      await this.validateVersion(version);
      
      // 2. 检查版本是否存在
      const versionExists = await this.checkVersionExists(version);
      if (!versionExists) {
        throw new Error(`Version ${version} does not exist on NPM`);
      }

      // 3. 确认回滚操作
      if (!dryRun && !force) {
        const confirmed = await this.confirmRollback(version);
        if (!confirmed) {
          console.log('❌ Rollback cancelled by user');
          return false;
        }
      }

      // 4. 执行回滚操作
      if (!dryRun) {
        await this.performRollback(version);
      } else {
        console.log(`✅ Would unpublish: ${this.packageName}@${version}`);
      }

      // 5. 创建回滚记录
      if (!dryRun) {
        await this.createRollbackRecord(version, reason);
      }

      success(`Rollback for version ${version} completed${dryRun ? ' (dry run)' : ''}`);
      return true;

    } catch (err) {
      error(`Rollback failed: ${err.message}`);
      return false;
    }
  }

  async validateVersion(version) {
    if (!version) {
      throw new Error('Version is required');
    }

    // 基本的语义版本验证
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9\-\.]+))?$/;
    if (!semverRegex.test(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    info(`✓ Version format validated: ${version}`);
  }

  async checkVersionExists(version) {
    try {
      info(`Checking if version ${version} exists on NPM...`);
      const command = `npm view ${this.packageName}@${version} version`;
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe' 
      }).trim();
      
      if (output === version) {
        info(`✓ Version ${version} exists on NPM`);
        return true;
      }
      
      warning(`Version ${version} not found on NPM (output: ${output})`);
      return false;
    } catch (error) {
      warning(`Failed to check version existence: ${error.message}`);
      // 假设版本存在，让 unpublish 命令来处理
      return true;
    }
  }

  async confirmRollback(version) {
    console.log(`\n⚠️  WARNING: You are about to unpublish version ${version}`);
    console.log('This action cannot be undone!');
    console.log('Users who have installed this version will not be able to reinstall it.');
    console.log('\nPlease type "yes" to confirm or anything else to cancel:');
    
    process.stdout.write('> ');
    
    return new Promise((resolve) => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let input = '';
      
      const onData = (key) => {
        if (key === '\u0003') { // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          resolve(false);
          return;
        }
        
        if (key === '\r' || key === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          resolve(input.trim().toLowerCase() === 'yes');
          return;
        }
        
        input += key;
        process.stdout.write(key);
      };
      
      process.stdin.on('data', onData);
    });
  }

  async performRollback(version) {
    info(`Unpublishing ${this.packageName}@${version}...`);
    
    try {
      // 使用 --force 强制 unpublish
      const command = `npm unpublish ${this.packageName}@${version} --force`;
      execSync(command, { 
        stdio: 'inherit',
        cwd: this.projectRoot 
      });
      
      success(`Successfully unpublished ${this.packageName}@${version}`);
    } catch (error) {
      throw new Error(`Failed to unpublish version ${version}: ${error.message}`);
    }
  }

  async createRollbackRecord(version, reason) {
    try {
      const timestamp = new Date().toISOString();
      const record = {
        version,
        reason: reason || 'No reason provided',
        timestamp,
        rolledBackBy: process.env.USER || process.env.USERNAME || 'unknown'
      };

      // 创建回滚记录文件
      const rollbackFile = path.join(this.projectRoot, 'rollback-history.json');
      let history = [];
      
      if (fs.existsSync(rollbackFile)) {
        try {
          const content = await fs.readFile(rollbackFile, 'utf8');
          history = JSON.parse(content);
        } catch (err) {
          warning('Failed to read rollback history, creating new file');
        }
      }
      
      history.unshift(record);
      
      // 只保留最近50条记录
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      
      await fs.writeFile(rollbackFile, JSON.stringify(history, null, 2));
      success(`Rollback record saved to rollback-history.json`);
      
    } catch (error) {
      warning(`Failed to create rollback record: ${error.message}`);
    }
  }

  async getRollbackHistory() {
    const rollbackFile = path.join(this.projectRoot, 'rollback-history.json');
    
    if (!fs.existsSync(rollbackFile)) {
      return [];
    }
    
    try {
      const content = await fs.readFile(rollbackFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      warning('Failed to read rollback history');
      return [];
    }
  }

  async listRollbacks() {
    const history = await this.getRollbackHistory();
    
    if (history.length === 0) {
      console.log('No rollback history found');
      return;
    }
    
    console.log('\n📜 Rollback History:');
    console.log('='.repeat(60));
    
    history.forEach((record, index) => {
      const date = new Date(record.timestamp).toLocaleString();
      console.log(`\n${index + 1}. Version ${record.version}`);
      console.log(`   Time: ${date}`);
      console.log(`   By: ${record.rolledBackBy}`);
      console.log(`   Reason: ${record.reason}`);
    });
    
    console.log('\n' + '='.repeat(60));
  }

  static showHelp() {
    console.log(`
🔄 Rollback Release Script

Usage:
  node scripts/rollback-release.js <command> [options]

Commands:
  rollback <version>    Rollback a specific version
  list                  Show rollback history
  help                  Show this help message

Options:
  --dry-run            Show what would be done without executing
  --force              Skip confirmation prompts
  --reason <text>      Specify rollback reason

Examples:
  node scripts/rollback-release.js rollback 1.0.0
  node scripts/rollback-release.js rollback 1.0.0 --dry-run
  node scripts/rollback-release.js rollback 1.0.0 --force --reason "Critical bug fix"
  node scripts/rollback-release.js list
`);
  }
}

// 主执行流程
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args[0] === 'help') {
    RollbackManager.showHelp();
    process.exit(0);
  }

  const command = args[0];
  const rollbackManager = new RollbackManager();

  try {
    switch (command) {
      case 'rollback': {
        const version = args[1];
        if (!version) {
          error('Version is required for rollback command');
          process.exit(1);
        }

        const options = {
          dryRun: args.includes('--dry-run'),
          force: args.includes('--force'),
        };

        // 解析 reason
        const reasonIndex = args.findIndex(arg => arg === '--reason');
        if (reasonIndex !== -1 && args[reasonIndex + 1]) {
          options.reason = args[reasonIndex + 1];
        }

        const success = await rollbackManager.rollback(version, options);
        process.exit(success ? 0 : 1);
      }

      case 'list': {
        await rollbackManager.listRollbacks();
        break;
      }

      default:
        error(`Unknown command: ${command}`);
        RollbackManager.showHelp();
        process.exit(1);
    }
  } catch (error) {
    error(`Error: ${error.message}`);
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