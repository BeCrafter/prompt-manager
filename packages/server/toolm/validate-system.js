#!/usr/bin/env node
/**
 * 工具系统全面验证脚本
 * 
 * 验证内容：
 * 1. 目录结构是否完整
 * 2. 文件是否存在且可读
 * 3. 模块导入是否正常
 * 4. 工具接口是否符合规范
 * 5. MCP服务器集成是否正确
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function section(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(` ${title}`, 'bright');
  log('='.repeat(60), 'blue');
  console.log();
}

// 验证结果收集
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
};

function check(description, test) {
  results.total++;
  try {
    const result = test();
    if (result === true || result === undefined) {
      success(description);
      results.passed++;
      return true;
    } else if (result === 'warning') {
      warning(description);
      results.warnings++;
      return 'warning';
    } else {
      error(description);
      results.failed++;
      results.errors.push(description);
      return false;
    }
  } catch (err) {
    error(`${description}: ${err.message}`);
    results.failed++;
    results.errors.push(`${description}: ${err.message}`);
    return false;
  }
}

async function asyncCheck(description, test) {
  results.total++;
  try {
    const result = await test();
    if (result === true || result === undefined) {
      success(description);
      results.passed++;
      return true;
    } else if (result === 'warning') {
      warning(description);
      results.warnings++;
      return 'warning';
    } else {
      error(description);
      results.failed++;
      results.errors.push(description);
      return false;
    }
  } catch (err) {
    error(`${description}: ${err.message}`);
    results.failed++;
    results.errors.push(`${description}: ${err.message}`);
    return false;
  }
}

// 1. 验证目录结构
async function validateDirectoryStructure() {
  section('1. 验证目录结构');
  
  const rootDir = path.join(__dirname, '..', '..', '..', '..');
  const paths = {
    'tools目录': path.join(__dirname),
    '系统工具目录': path.join(rootDir, 'packages', 'resources', 'tools'),
    '用户工具目录': path.join(os.homedir(), '.prompt-manager', 'tools'),
  };
  
  for (const [name, dirPath] of Object.entries(paths)) {
    await asyncCheck(`${name} 存在: ${dirPath}`, async () => {
      const exists = await fs.pathExists(dirPath);
      if (!exists && name === '用户工具目录') {
        // 用户工具目录不存在时创建
        await fs.ensureDir(dirPath);
        info(`  已创建目录: ${dirPath}`);
        return 'warning';
      }
      return exists;
    });
  }
}

// 2. 验证核心文件
async function validateCoreFiles() {
  section('2. 验证核心文件');
  
  const coreFiles = [
    { name: '工具加载服务', path: path.join(__dirname, 'tool-loader.service.js') },
    { name: '工具管理处理器', path: path.join(__dirname, 'tool-manager.handler.js') },
    { name: '工具系统入口', path: path.join(__dirname, 'index.js') },
    { name: 'MCP服务器', path: path.join(__dirname, '..', 'mcp.server.js') },
    { name: 'ToolX处理器', path: path.join(__dirname, '..', 'toolx.handler.js') },
  ];
  
  for (const file of coreFiles) {
    await asyncCheck(`${file.name} 文件存在`, async () => {
      return await fs.pathExists(file.path);
    });
    
    await asyncCheck(`${file.name} 可读`, async () => {
      try {
        await fs.access(file.path, fs.constants.R_OK);
        return true;
      } catch {
        return false;
      }
    });
  }
}

// 3. 验证工具文件
async function validateToolFiles() {
  section('3. 验证工具文件');
  
  const rootDir = path.join(__dirname, '..', '..', '..', '..');
  const toolsDir = path.join(rootDir, 'packages', 'resources', 'tools');
  
  if (!await fs.pathExists(toolsDir)) {
    error(`工具目录不存在: ${toolsDir}`);
    return;
  }
  
  const toolDirs = await fs.readdir(toolsDir);
  info(`找到 ${toolDirs.length} 个工具目录`);
  
  for (const toolDir of toolDirs) {
    const toolPath = path.join(toolsDir, toolDir);
    const stat = await fs.stat(toolPath);
    
    if (!stat.isDirectory()) continue;
    
    const toolFile = path.join(toolPath, `${toolDir}.tool.js`);
    await asyncCheck(`工具 '${toolDir}' 文件存在`, async () => {
      return await fs.pathExists(toolFile);
    });
  }
}

// 4. 验证模块导入
async function validateModuleImports() {
  section('4. 验证模块导入');
  
  // 验证工具加载服务
  await asyncCheck('导入工具加载服务', async () => {
    const module = await import('./tool-loader.service.js');
    return module.toolLoaderService !== undefined;
  });
  
  // 验证工具管理处理器
  await asyncCheck('导入工具管理处理器', async () => {
    const module = await import('./tool-manager.handler.js');
    return typeof module.handleToolM === 'function';
  });
  
  // 验证工具系统入口
  await asyncCheck('导入工具系统入口', async () => {
    const module = await import('./index.js');
    return module.toolLoaderService !== undefined && module.handleToolM !== undefined;
  });
}

// 5. 验证工具接口规范
async function validateToolInterfaces() {
  section('5. 验证工具接口规范');
  
  const rootDir = path.join(__dirname, '..', '..', '..', '..');
  const toolsDir = path.join(rootDir, 'packages', 'resources', 'tools');
  
  if (!await fs.pathExists(toolsDir)) {
    warning('工具目录不存在，跳过接口验证');
    return;
  }
  
  const toolDirs = await fs.readdir(toolsDir);
  
  for (const toolDir of toolDirs) {
    const toolPath = path.join(toolsDir, toolDir);
    const stat = await fs.stat(toolPath);
    
    if (!stat.isDirectory()) continue;
    
    const toolFile = path.join(toolPath, `${toolDir}.tool.js`);
    
    if (!await fs.pathExists(toolFile)) continue;
    
    await asyncCheck(`工具 '${toolDir}' 符合接口规范`, async () => {
      const toolModule = await import(toolFile);
      const tool = toolModule.default || toolModule;
      
      // 必需方法
      if (typeof tool.execute !== 'function') {
        throw new Error('缺少 execute 方法');
      }
      
      // 推荐方法
      const recommendedMethods = ['getMetadata', 'getSchema', 'getDependencies', 'getBusinessErrors'];
      const missing = recommendedMethods.filter(method => typeof tool[method] !== 'function');
      
      if (missing.length > 0) {
        info(`  缺少推荐方法: ${missing.join(', ')}`);
      }
      
      return true;
    });
  }
}

// 6. 验证工具加载器功能
async function validateToolLoaderFunctionality() {
  section('6. 验证工具加载器功能');
  
  const { toolLoaderService } = await import('./tool-loader.service.js');
  
  await asyncCheck('初始化工具加载器', async () => {
    await toolLoaderService.initialize();
    return toolLoaderService.initialized === true;
  });
  
  await asyncCheck('获取工具列表', async () => {
    const tools = toolLoaderService.getAllTools();
    info(`  加载了 ${tools.length} 个工具`);
    return Array.isArray(tools);
  });
  
  // 检查 filesystem 工具
  await asyncCheck('filesystem 工具已加载', async () => {
    return toolLoaderService.hasTool('filesystem');
  });
  
  if (toolLoaderService.hasTool('filesystem')) {
    await asyncCheck('获取 filesystem 工具详情', async () => {
      const tool = toolLoaderService.getTool('filesystem');
      info(`  工具名称: ${tool.metadata.name}`);
      info(`  工具描述: ${tool.metadata.description}`);
      return tool !== undefined;
    });
    
    await asyncCheck('生成 filesystem 工具手册', async () => {
      const manual = toolLoaderService.generateManual('filesystem');
      return typeof manual === 'string' && manual.length > 0;
    });
  }
}

// 7. 验证工具管理处理器功能
async function validateToolManagerFunctionality() {
  section('7. 验证工具管理处理器功能');
  
  const { handleToolM } = await import('./tool-manager.handler.js');
  
  // 测试 manual 模式
  await asyncCheck('手册模式正常工作', async () => {
    const yamlInput = `tool: tool://filesystem
mode: manual`;
    
    const result = await handleToolM({ yaml: yamlInput });
    return result.content && result.content[0].type === 'text';
  });
  
  // 测试 execute 模式
  await asyncCheck('执行模式正常工作', async () => {
    const yamlInput = `tool: tool://filesystem
mode: execute
parameters:
  method: list_allowed_directories`;
    
    const result = await handleToolM({ yaml: yamlInput });
    return result.content && result.content[0].type === 'text';
  });
  
  // 测试错误处理
  await asyncCheck('错误处理正常工作', async () => {
    try {
      const yamlInput = `tool: tool://nonexistent
mode: execute`;
      await handleToolM({ yaml: yamlInput });
      return false; // 应该抛出错误
    } catch (error) {
      return error.message.includes('不存在');
    }
  });
}

// 8. 验证 MCP 服务器集成
async function validateMCPServerIntegration() {
  section('8. 验证 MCP 服务器集成');
  
  await asyncCheck('MCP 服务器模块可导入', async () => {
    const module = await import('../mcp.server.js');
    return typeof module.getMcpServer === 'function';
  });
  
  await asyncCheck('MCP 服务器包含 toolm 工具', async () => {
    // 这需要实际启动服务器才能验证，这里只检查导入
    info('  需要启动服务器才能完全验证，当前仅检查模块导入');
    return 'warning';
  });
}

// 9. 生成报告
function generateReport() {
  section('验证结果汇总');
  
  console.log(`总计测试: ${results.total}`);
  log(`通过: ${results.passed}`, 'green');
  if (results.warnings > 0) {
    log(`警告: ${results.warnings}`, 'yellow');
  }
  if (results.failed > 0) {
    log(`失败: ${results.failed}`, 'red');
  }
  
  const percentage = (results.passed / results.total * 100).toFixed(1);
  console.log(`\n通过率: ${percentage}%`);
  
  if (results.errors.length > 0) {
    section('失败的测试');
    results.errors.forEach((err, index) => {
      error(`${index + 1}. ${err}`);
    });
  }
  
  console.log();
  if (results.failed === 0) {
    log('🎉 所有验证通过！工具系统已准备就绪。', 'green');
    return true;
  } else {
    log('⚠️  部分验证失败，请检查并修复错误。', 'yellow');
    return false;
  }
}

// 主函数
async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║     Prompt Manager 工具系统全面验证                    ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  try {
    await validateDirectoryStructure();
    await validateCoreFiles();
    await validateToolFiles();
    await validateModuleImports();
    await validateToolInterfaces();
    await validateToolLoaderFunctionality();
    await validateToolManagerFunctionality();
    await validateMCPServerIntegration();
    
    const success = generateReport();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n验证过程中发生致命错误:');
    console.error(error);
    process.exit(1);
  }
}

// 运行验证
main();

