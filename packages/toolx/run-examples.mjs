#!/usr/bin/env node

/**
 * ToolX 沙箱工具库 - 快速运行脚本
 * 
 * 提供一个简单的命令行界面来运行 ToolX 示例
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const examples = {
  'simple': 'examples/simple-execution-example.js',
  'adapter': 'examples/adapter-example.js',
  'all': ['examples/simple-execution-example.js', 'examples/adapter-example.js']
};

function runExample(exampleName) {
  const examplePath = examples[exampleName];
  
  if (!examplePath) {
    console.error(`❌ 未知示例: ${exampleName}`);
    console.log('可用示例:');
    Object.keys(examples).forEach(name => {
      if (name !== 'all') {
        console.log(`  - ${name}`);
      }
    });
    process.exit(1);
  }
  
  if (Array.isArray(examplePath)) {
    // Run all examples
    console.log('🚀 运行所有 ToolX 示例...\n');
    runAllExamples(examplePath);
  } else {
    // Run single example
    console.log(`🚀 运行 ${exampleName} 示例...\n`);
    runSingleExample(examplePath);
  }
}

function runSingleExample(examplePath) {
  const fullPath = join(__dirname, examplePath);
  const child = spawn('node', [fullPath], { stdio: 'inherit' });
  
  child.on('close', (code) => {
    if (code === 0) {
      console.log(`\n✅ ${examplePath} 执行完成`);
    } else {
      console.error(`\n❌ ${examplePath} 执行失败 (退出码: ${code})`);
      process.exit(code);
    }
  });
}

function runAllExamples(examplePaths) {
  let index = 0;
  
  function runNext() {
    if (index >= examplePaths.length) {
      console.log('\n🎉 所有示例执行完成！');
      return;
    }
    
    const examplePath = examplePaths[index];
    console.log(`\n${'-'.repeat(50)}\n`);
    console.log(`🚀 运行示例 ${index + 1}/${examplePaths.length}: ${examplePath}\n`);
    
    const fullPath = join(__dirname, examplePath);
    const child = spawn('node', [fullPath], { stdio: 'inherit' });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${examplePath} 执行完成`);
        index++;
        runNext();
      } else {
        console.error(`\n❌ ${examplePath} 执行失败 (退出码: ${code})`);
        process.exit(code);
      }
    });
  }
  
  runNext();
}

// Parse command line arguments
const args = process.argv.slice(2);
const exampleName = args[0] || 'simple';

console.log('🔧 ToolX 沙箱工具库 - 示例运行器');
console.log('====================================\n');

runExample(exampleName);