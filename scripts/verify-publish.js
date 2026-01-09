#!/usr/bin/env node

/**
 * NPM Publish Verification Script
 * 验证发布前的所有检查项
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(__dirname, '..';
const __dirname = path.dirname(__filename);
const projectRoot = path.join(projectRoot, '..');

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

function warn(message) {
  log(`⚠ ${message}`, 'yellow');
}

function runCommand(command, description) {
  try {
    info(`Running: ${description}...`);
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    success(`${description} passed`);
    return true;
  } catch (err) {
    error(`${description} failed`);
    return false;
  }
}

function checkFilesExist() {
  info('Checking files listed in package.json...');

  const packageJsonPath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const files = packageJson.files || [];
  let allExist = true;

  for (const filePattern of files) {
    // 处理通配符模式
    if (filePattern.includes('**')) {
      const dir = path.join(projectRoot, filePattern.split('**')[0]);
      if (!fs.existsSync(dir)) {
        error(`Directory missing: ${filePattern}`);
        allExist = false;
      } else {
        success(`Directory exists: ${filePattern}`);
      }
    } else if (filePattern.includes('*')) {
      const dir = path.dirname(filePattern);
      const fullDir = path.join(projectRoot, dir);
      if (fs.existsSync(fullDir)) {
        const files = fs.readdirSync(fullDir);
        if (files.length > 0) {
          success(`Files exist: ${filePattern}`);
        } else {
          warn(`No files matching: ${filePattern}`);
        }
      } else {
        error(`Directory missing: ${filePattern}`);
        allExist = false;
      }
    } else {
      const fullPath = path.join(projectRoot, filePattern);
      if (fs.existsSync(fullPath)) {
        success(`File exists: ${filePattern}`);
      } else {
        error(`File missing: ${filePattern}`);
        allExist = false;
      }
    }
  }

  return allExist;
}

function checkAdminUIBuilt() {
  info('Checking admin UI build...');

  const webDir = path.join(projectRoot, 'packages/web');
  if (!fs.existsSync(webDir)) {
    error('Admin UI not built. Run: npm run build:admin-ui');
    return false;
  }

  const indexHtml = path.join(webDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    error('Admin UI index.html not found');
    return false;
  }

  success('Admin UI build verified');
  return true;
}

function checkVersionConsistency() {
  info('Checking version consistency...');

  const rootPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const serverPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'packages/server/package.json'), 'utf8'));
  const desktopPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app/desktop/package.json'), 'utf8'));
  const envExample = fs.readFileSync(path.join(projectRoot, 'env.example'), 'utf8');

  const version = rootPackage.version;
  let consistent = true;

  // 检查 server package 版本
  if (serverPackage.version !== version) {
    warn(`Server package version mismatch: ${serverPackage.version} != ${version}`);
    consistent = false;
  } else {
    success('Server package version consistent');
  }

  // 检查 desktop package 版本
  if (desktopPackage.version !== version) {
    warn(`Desktop package version mismatch: ${desktopPackage.version} != ${version}`);
    consistent = false;
  } else {
    success('Desktop package version consistent');
  }

  // 检查 env.example 中的版本
  const envVersionMatch = envExample.match(/MCP_SERVER_VERSION=(.+)/);
  if (envVersionMatch) {
    const envVersion = envVersionMatch[1].trim();
    if (envVersion !== version) {
      warn(`env.example version mismatch: ${envVersion} != ${version}`);
      consistent = false;
    } else {
      success('env.example version consistent');
    }
  }

  // 检查 config.js 中的版本
  const configPath = path.join(projectRoot, 'packages/server/utils/config.js');
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const configVersionMatch = configContent.match(/this\.serverVersion = process\.env\.MCP_SERVER_VERSION \|\| '([^']+)'/);
    if (configVersionMatch) {
      const configVersion = configVersionMatch[1];
      if (configVersion !== version) {
        warn(`config.js version mismatch: ${configVersion} != ${version}`);
        consistent = false;
      } else {
        success('config.js version consistent');
      }
    }
  }

  return consistent;
}

async function main() {
  console.log('\n');
  log('='.repeat(60), 'bright');
  log('NPM Publish Verification', 'bright');
  log('='.repeat(60), 'bright');
  console.log('\n');

  const results = {
    lint: runCommand('npm run lint:check', 'ESLint check'),
    format: runCommand('npm run format:check', 'Prettier check'),
    test: runCommand('npm test', 'All tests'),
    files: checkFilesExist(),
    adminUI: checkAdminUIBuilt(),
    version: checkVersionConsistency(),
  };

  console.log('\n');
  log('='.repeat(60), 'bright');
  log('Verification Summary', 'bright');
  log('='.repeat(60), 'bright');
  console.log('\n');

  const passed = Object.entries(results)
    .filter(([_, result]) => result === true)
    .map(([name, _]) => `✓ ${name}`);

  const failed = Object.entries(results)
    .filter(([_, result]) => result === false)
    .map(([name, _]) => `✗ ${name}`);

  if (passed.length > 0) {
    log('Passed:', 'green');
    passed.forEach(item => console.log(`  ${item}`));
    console.log('');
  }

  if (failed.length > 0) {
    log('Failed:', 'red');
    failed.forEach(item => console.log(`  ${item}`));
    console.log('');

    error('Verification failed! Please fix the issues above.');
    process.exit(1);
  } else {
    success('All verification checks passed!');
    info('You can now create a tag and push to trigger NPM publish:');
    console.log('');
    log('  git tag v<version>', 'blue');
    log('  git push origin v<version>', 'blue');
    console.log('');
    process.exit(0);
  }
}

main().catch(err => {
  error(err.message);
  process.exit(1);
});
