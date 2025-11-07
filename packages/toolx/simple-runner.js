#!/usr/bin/env node

/**
 * 简单测试运行器
 */

console.log('🔧 开始加载测试验证器...');

import('./src/test/validator.js')
  .then(async ({ validator: testValidator }) => {
    console.log('✅ 测试验证器加载成功');
    
    try {
      console.log('🧪 开始运行测试...');
      // 运行一个简单的测试
      await testValidator.runTest('core');
      console.log('✅ 核心组件测试完成');
      process.exit(0);
    } catch (error) {
      console.error('❌ 测试执行失败:', error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ 测试验证器加载失败:', error);
    process.exit(1);
  });