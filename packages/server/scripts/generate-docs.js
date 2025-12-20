#!/usr/bin/env node

/**
 * 文档生成脚本
 * 
 * 自动生成JSDoc和TypeDoc文档，并创建索引页面
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function success(msg) {
  log(`✓ ${msg}`, 'green');
}

function error(msg) {
  log(`✗ ${msg}`, 'red');
}

function warning(msg) {
  log(`⚠ ${msg}`, 'yellow');
}

function info(msg) {
  log(`ℹ ${msg}`, 'cyan');
}

/**
 * 清理文档目录
 */
async function cleanDocsDir() {
  const docsDir = path.join(projectRoot, 'docs');
  
  try {
    await fs.remove(docsDir);
    await fs.ensureDir(docsDir);
    success('文档目录已清理');
  } catch (err) {
    error(`清理文档目录失败: ${err.message}`);
    throw err;
  }
}

/**
 * 生成JSDoc文档
 */
async function generateJSDoc() {
  try {
    info('生成JSDoc文档...');
    
    const jsdocConfig = path.join(projectRoot, 'jsdoc.conf.json');
    const command = `npx jsdoc -c ${jsdocConfig}`;
    
    execSync(command, { 
      cwd: projectRoot,
      stdio: 'inherit'
    });
    
    success('JSDoc文档生成完成');
  } catch (err) {
    error(`JSDoc文档生成失败: ${err.message}`);
    throw err;
  }
}

/**
 * 生成TypeDoc文档
 */
async function generateTypeDoc() {
  try {
    info('生成TypeDoc文档...');
    
    const typedocConfig = path.join(projectRoot, 'typedoc.json');
    const command = `npx typedoc --options ${typedocConfig}`;
    
    execSync(command, { 
      cwd: projectRoot,
      stdio: 'inherit'
    });
    
    success('TypeDoc文档生成完成');
  } catch (err) {
    warning(`TypeDoc文档生成失败: ${err.message}`);
    // TypeDoc失败不中断整个流程，因为可能缺少TypeScript配置
  }
}

/**
 * 生成API文档索引
 */
async function generateAPIIndex() {
  try {
    info('生成API文档索引...');
    
    const indexPath = path.join(projectRoot, 'docs', 'index.md');
    const content = `# Prompt Manager API 文档

本文档包含 Prompt Manager 项目的完整 API 参考。

## 文档类型

### 📚 JSDoc 文档
基于代码注释生成的详细 API 文档，包含所有类、方法和参数说明。

[查看 JSDoc 文档](./jsdoc/)

### 🔧 TypeDoc 文档
TypeScript 风格的 API 文档，提供更好的类型信息和模块组织。

[查看 TypeDoc 文档](./typedoc/)

## 主要模块

### 服务层
- **TerminalService** - 终端会话管理
- **WebSocketService** - WebSocket 连接管理
- **ToolMService** - 工具系统管理

### 协议层
- **MCP Server** - Model Context Protocol 服务器
- **API Routes** - RESTful API 路由

### 工具层
- **Tool Loader** - 工具加载器
- **Tool Manager** - 工具管理器

## 开发指南

### 添加新 API
1. 在代码中添加 JSDoc 注释
2. 运行 \`npm run docs\` 生成文档
3. 提交更新后的文档

### 文档格式
- 使用 JSDoc 标准注释格式
- 包含参数类型、返回值说明
- 提供使用示例

## 版本信息

- 生成时间: ${new Date().toISOString()}
- Node.js 版本: ${process.version}
- 平台: ${process.platform}

---

*此文档由自动化脚本生成，请勿手动编辑。*
`;

    await fs.writeFile(indexPath, content);
    success('API文档索引生成完成');
  } catch (err) {
    error(`API文档索引生成失败: ${err.message}`);
    throw err;
  }
}

/**
 * 生成变更日志
 */
async function generateChangelog() {
  try {
    info('生成变更日志...');
    
    const changelogPath = path.join(projectRoot, 'docs', 'CHANGELOG.md');
    
    // 尝试从git获取最近的提交
    let recentCommits = '';
    try {
      const gitLog = execSync('git log --oneline -10', { 
        cwd: projectRoot,
        encoding: 'utf8'
      });
      recentCommits = gitLog;
    } catch (err) {
      warning('无法获取Git提交历史');
    }

    const content = `# 变更日志

## 最近更新

${recentCommits ? '### 最近提交\n\n```\n' + recentCommits + '\n```\n\n' : ''}

## 版本历史

### v0.0.24 - 当前版本
- ✨ 新增终端增强功能
- 🔧 集成 WebSocket + PTY + xterm.js
- 🧪 添加完整的测试套件
- 📚 完善文档和代码质量工具

### v0.0.23
- 🐛 修复终端菜单点击无响应问题
- 🔧 优化webpack配置

### v0.0.22
- ✨ 添加交互式终端功能
- 🎨 改进用户界面

---

*注意: 此为自动生成的变更日志，详细信息请查看Git提交历史。*
`;

    await fs.writeFile(changelogPath, content);
    success('变更日志生成完成');
  } catch (err) {
    error(`变更日志生成失败: ${err.message}`);
    throw err;
  }
}

/**
 * 生成项目统计信息
 */
async function generateStats() {
  try {
    info('生成项目统计信息...');
    
    const statsPath = path.join(projectRoot, 'docs', 'stats.json');
    
    // 收集统计信息
    const stats = {
      generatedAt: new Date().toISOString(),
      version: require(path.join(projectRoot, 'package.json')).version,
      nodeVersion: process.version,
      platform: process.platform,
      files: {
        javascript: 0,
        test: 0,
        config: 0,
        total: 0
      },
      lines: {
        code: 0,
        comment: 0,
        total: 0
      }
    };

    // 统计文件数量
    const countFiles = async (dir, pattern) => {
      try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        let count = 0;
        
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) {
            count += await countFiles(fullPath, pattern);
          } else if (file.name.match(pattern)) {
            count++;
          }
        }
        return count;
      } catch (err) {
        return 0;
      }
    };

    stats.files.javascript = await countFiles(projectRoot, /\.js$/);
    stats.files.test = await countFiles(path.join(projectRoot, 'tests'), /\.test\.js$/);
    stats.files.config = await countFiles(projectRoot, /\.(json|yml|yaml|jsdoc|md)$/);
    stats.files.total = stats.files.javascript + stats.files.test + stats.files.config;

    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
    success('项目统计信息生成完成');
  } catch (err) {
    warning(`项目统计信息生成失败: ${err.message}`);
  }
}

/**
 * 主函数
 */
async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║           Prompt Manager 文档生成工具                   ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  try {
    await cleanDocsDir();
    await generateJSDoc();
    await generateTypeDoc();
    await generateAPIIndex();
    await generateChangelog();
    await generateStats();
    
    log('\n╔════════════════════════════════════════════════════════╗', 'green');
    log('║                    🎉 生成完成！                        ║', 'green');
    log('╚════════════════════════════════════════════════════════╝', 'green');
    
    log('\n📚 文档位置:', 'blue');
    log(`  JSDoc: ${path.join(projectRoot, 'docs', 'jsdoc', 'index.html')}`, 'blue');
    log(`  TypeDoc: ${path.join(projectRoot, 'docs', 'typedoc', 'index.html')}`, 'blue');
    log(`  索引: ${path.join(projectRoot, 'docs', 'index.md')}`, 'blue');
    
  } catch (error) {
    log('\n❌ 文档生成失败:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// 运行脚本
main();