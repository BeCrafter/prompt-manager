/**
 * ToolX 沙箱工具库 - 简单执行示例
 * 
 * 该示例演示了如何使用 ToolX 沙箱库来安全执行命令
 * 展示了基本的命令执行、安全验证和资源限制功能
 */

import { AdapterRegistry } from '../src/core/registry.js';
import { SecurityPolicyValidator } from '../src/security/policy-validator.js';
import { ResourceLimiter } from '../src/security/resource-limiter.js';
import { MetricsCollector } from '../src/monitoring/metrics-collector.js';

async function runExample() {
  console.log('🚀 ToolX 沙箱工具库 - 简单执行示例');
  console.log('==================================');

  // 1. 创建安全策略验证器
  console.log('\n🔍 1. 初始化安全策略验证器...');
  const securityValidator = new SecurityPolicyValidator({
    blockedCommands: ['rm', 'mv', 'cp', 'chmod', 'chown'],
    allowedDomains: ['httpbin.org', 'httpbingo.org'], // 用于测试网络请求
    blockedModules: ['fs', 'child_process', 'cluster', 'worker_threads'],
    fileAccessWhitelist: ['/tmp', './sandbox']
  });
  
  console.log('   ✓ 阻止的命令:', securityValidator.blockedCommands);
  console.log('   ✓ 允许的域名:', securityValidator.allowedDomains);
  console.log('   ✓ 阻止的模块:', securityValidator.blockedModules);

  // 2. 创建资源限制器
  console.log('\n🛡️  2. 初始化资源限制器...');
  const resourceLimiter = new ResourceLimiter({
    maxMemory: '256MB',
    maxExecutionTime: 10000, // 10秒
    maxFileSize: '10MB'
  });
  
  console.log('   ✓ 最大内存:', Math.round(resourceLimiter.maxMemory / (1024 * 1024)), 'MB');
  console.log('   ✓ 最大执行时间:', resourceLimiter.maxExecutionTime, 'ms');
  console.log('   ✓ 最大文件大小:', Math.round(resourceLimiter.maxFileSize / (1024 * 1024)), 'MB');

  // 3. 创建监控收集器
  console.log('\n📊 3. 初始化监控收集器...');
  const metricsCollector = new MetricsCollector({ enabled: true });
  
  console.log('   ✓ 监控已启用');
  
  // 4. 测试安全验证功能
  console.log('\n🔒 4. 测试安全验证...');
  
  try {
    // 测试命令验证
    const isValidCommand = securityValidator.validateCommand('ls', ['-la']);
    console.log('   ✓ 安全命令 "ls -la" 验证通过');
  } catch (error) {
    console.log('   ✗ 命令验证失败:', error.message);
  }
  
  try {
    // 测试危险命令验证
    securityValidator.validateCommand('rm', ['-rf', '/']);
    console.log('   ✗ 危险命令验证失败 - 这不应该出现！');
  } catch (error) {
    console.log('   ✓ 危险命令 "rm -rf /" 被正确阻止:', error.message);
  }
  
  try {
    // 测试网络请求验证
    const isValidNetwork = securityValidator.validateNetworkRequest('https://httpbin.org/get');
    console.log('   ✓ 安全网络请求验证通过');
  } catch (error) {
    console.log('   ✗ 网络请求验证失败:', error.message);
  }
  
  try {
    // 测试路径验证
    const isValidPath = securityValidator.validateFilePath('/tmp/test.txt');
    console.log('   ✓ 安全路径验证通过');
  } catch (error) {
    console.log('   ✗ 路径验证失败:', error.message);
  }

  // 5. 测试资源限制功能
  console.log('\n⏰ 5. 测试资源限制...');
  
  // 创建资源跟踪器
  const tracker = resourceLimiter.createResourceTracker('test-operation');
  console.log('   ✓ 资源跟踪器创建成功');
  
  // 记录一些资源使用情况
  tracker.recordMemoryUsage(128 * 1024 * 1024); // 128MB
  tracker.recordCPUUsage(0.5); // 50% CPU
  
  console.log('   ✓ 内存使用记录:', Math.round(tracker.getMemoryUsage() / (1024 * 1024)), 'MB');
  console.log('   ✓ CPU使用记录:', tracker.getCPUUsage(), 'cores');
  console.log('   ✓ 执行时间:', tracker.getRuntime(), 'ms');

  // 6. 测试监控功能
  console.log('\n📈 6. 测试监控功能...');
  
  // 记录执行时间
  metricsCollector.recordExecutionTime('test_operation', 1234, { 
    test: true, 
    category: 'example' 
  });
  
  // 记录资源使用
  metricsCollector.recordResourceUsage('memory', 128, { unit: 'MB' });
  metricsCollector.recordResourceUsage('cpu', 45, { unit: 'percent' });
  
  console.log('   ✓ 执行时间记录成功');
  console.log('   ✓ 资源使用记录成功');
  
  // 获取操作指标
  const operationMetrics = metricsCollector.getOperationMetrics('test_operation');
  console.log('   ✓ 操作指标:', operationMetrics);

  // 7. 获取系统概览
  console.log('\n📋 7. 系统概览...');
  const overview = metricsCollector.getSystemOverview();
  console.log('   ✓ 总操作数:', overview.totalOperations);
  console.log('   ✓ 错误数:', overview.totalErrors);
  console.log('   ✓ 平均响应时间:', overview.averageResponseTime, 'ms');
  console.log('   ✓ 错误率:', overview.errorRate, '%');

  console.log('\n✅ 示例执行完成！');
  console.log('\n💡 ToolX 沙箱工具库提供：');
  console.log('   - 🔐 多层安全验证（命令、网络、模块、路径）');
  console.log('   - 🛡️ 资源限制和监控');
  console.log('   - 📊 性能指标收集');
  console.log('   - 🔌 适配器模式支持多环境运行');
  console.log('   - 🏗️ 遵循SOLID、KISS、DRY、YAGNI设计原则');
}

// 执行示例
runExample().catch(error => {
  console.error('示例执行出错:', error);
  process.exit(1);
});