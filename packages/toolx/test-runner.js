#!/usr/bin/env node

/**
 * ToolX 测试运行器
 * 
 * 运行 ToolX 测试验证框架
 */

import { validator as testValidator } from './src/test/validator.js';

async function runTests() {
  console.log('🧪 ToolX 测试验证框架');
  console.log('========================\n');
  
  try {
    // 运行所有测试
    const report = await testValidator.runAllTests();
    
    // 退出码根据测试结果
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    
    console.log(`\n🏁 测试验证框架执行完成 (退出码: ${exitCode})`);
    process.exit(exitCode);
  } catch (error) {
    console.error('❌ 测试验证框架执行失败:', error);
    process.exit(1);
  }
}

// 执行测试
runTests().catch(error => {
  console.error('❌ 测试执行器失败:', error);
  process.exit(1);
});