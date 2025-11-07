#!/usr/bin/env node

/**
 * 简单测试脚本 - 验证适配器注册
 */

import { ToolInitializer } from './src/core/tool-initializer.js';
import { registry } from './src/core/registry.js';

console.log('🧪 开始测试适配器注册...');

try {
  // 初始化工具生态系统
  ToolInitializer.initialize();
  
  console.log('✅ 工具生态系统初始化成功');
  
  // 检查已注册的适配器
  const adapters = registry.getRegisteredAdapters();
  console.log(`✅ 已注册适配器: ${adapters.join(', ')}`);
  
  // 检查每个适配器的信息
  for (const adapterName of adapters) {
    const info = registry.getAdapterInfo(adapterName);
    console.log(`✅ 适配器 ${adapterName} 信息:`, info);
  }
  
  console.log('🎉 所有测试通过！');
} catch (error) {
  console.error('❌ 测试失败:', error);
  process.exit(1);
}