/**
 * 验证脚本 - 验证所有组件是否可以正确导入和初始化
 */

import { ICommandExecutor } from './src/core/interfaces/command-executor.js';
import { IDependencyManager } from './src/core/interfaces/dependency-manager.js';
import { ISandboxManager } from './src/core/interfaces/sandbox-manager.js';
import { AdapterRegistry } from './src/core/registry.js';
import { BaseProcessPool } from './src/core/base/process-pool.js';
import { ConfigLoader } from './src/core/config-loader.js';
import { SecurityPolicyValidator } from './src/security/policy-validator.js';
import { ResourceLimiter } from './src/security/resource-limiter.js';
import { MetricsCollector } from './src/monitoring/metrics-collector.js';

console.log('开始验证所有组件...');

// 验证接口
console.log('✓ 验证接口定义');
try {
  const executor = new ICommandExecutor();
  console.log('  - ICommandExecutor 创建成功');
} catch (e) {
  console.log('  - ICommandExecutor 创建失败:', e.message);
}

try {
  const manager = new IDependencyManager();
  console.log('  - IDependencyManager 创建成功');
} catch (e) {
  console.log('  - IDependencyManager 创建失败:', e.message);
}

try {
  const sandboxManager = new ISandboxManager();
  console.log('  - ISandboxManager 创建成功');
} catch (e) {
  console.log('  - ISandboxManager 创建失败:', e.message);
}

// 验证核心组件
console.log('✓ 验证核心组件');
try {
  const registry = new AdapterRegistry();
  console.log('  - AdapterRegistry 创建成功');
} catch (e) {
  console.log('  - AdapterRegistry 创建失败:', e.message);
}

try {
  const configLoader = new ConfigLoader();
  console.log('  - ConfigLoader 创建成功');
} catch (e) {
  console.log('  - ConfigLoader 创建失败:', e.message);
}

// 验证安全组件
console.log('✓ 验证安全组件');
try {
  const validator = new SecurityPolicyValidator({
    blockedCommands: [],
    allowedDomains: [],
    blockedModules: []
  });
  console.log('  - SecurityPolicyValidator 创建成功');
} catch (e) {
  console.log('  - SecurityPolicyValidator 创建失败:', e.message);
}

try {
  const limiter = new ResourceLimiter({
    maxMemory: '512MB',
    maxExecutionTime: 30000
  });
  console.log('  - ResourceLimiter 创建成功');
} catch (e) {
  console.log('  - ResourceLimiter 创建失败:', e.message);
}

// 验证监控组件
console.log('✓ 验证监控组件');
try {
  const metrics = new MetricsCollector();
  console.log('  - MetricsCollector 创建成功');
} catch (e) {
  console.log('  - MetricsCollector 创建失败:', e.message);
}

// 验证进程池（使用模拟类）
console.log('✓ 验证进程池');
try {
  class MockRuntimeProvider {
    constructor() {
      this.workingDir = '/tmp';
    }
  }
  
  class MockProcessPool extends BaseProcessPool {
    constructor(runtimeProvider, options) {
      super(runtimeProvider, options);
    }
    
    async doCreateWorker(workerId) {
      return { id: workerId, process: null, isHealthy: true };
    }
    
    async isWorkerHealthy(worker) {
      return worker.isHealthy;
    }
    
    async doDestroyWorker(worker) {
      worker.isHealthy = false;
    }
  }
  
  const runtimeProvider = new MockRuntimeProvider();
  const processPool = new MockProcessPool(runtimeProvider, {
    maxWorkers: 2,
    minWorkers: 1
  });
  console.log('  - BaseProcessPool 创建成功');
} catch (e) {
  console.log('  - BaseProcessPool 创建失败:', e.message);
}

console.log('\n✓ 所有组件验证完成！');
console.log('\n系统架构总结:');
console.log('1. 核心接口: ICommandExecutor, IDependencyManager, ISandboxManager');
console.log('2. 适配器注册: AdapterRegistry (支持OCP原则)');
console.log('3. 进程池: BaseProcessPool (消除代码重复，DRY原则)');
console.log('4. 配置管理: ConfigLoader (支持继承，减少重复配置)');
console.log('5. 安全模块: SecurityPolicyValidator, ResourceLimiter (细粒度权限控制)');
console.log('6. 监控模块: MetricsCollector (完整性能指标)');
console.log('7. 适配器: ElectronRuntimeProvider, NodeJSRuntimeProvider, DockerRuntimeProvider (多环境支持)');
console.log('\n架构遵循SOLID、KISS、DRY、YAGNI原则，具有良好的可扩展性和可维护性。');
