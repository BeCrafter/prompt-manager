/**
 * ToolX 沙箱工具库 - 适配器系统示例
 * 
 * 该示例演示了如何使用 ToolX 的适配器系统
 * 展示了适配器注册表和不同运行时环境的支持
 */

import { AdapterRegistry } from '../src/core/registry.js';
import { SecurityPolicyValidator } from '../src/security/policy-validator.js';
import { ResourceLimiter } from '../src/security/resource-limiter.js';

// 导入接口定义
import { ICommandExecutor } from '../src/core/interfaces/command-executor.js';
import { IDependencyManager } from '../src/core/interfaces/dependency-manager.js';
import { ISandboxManager } from '../src/core/interfaces/sandbox-manager.js';

async function runAdapterExample() {
  console.log('🔌 ToolX 沙箱工具库 - 适配器系统示例');
  console.log('====================================');

  // 1. 创建适配器注册表
  console.log('\n🔍 1. 初始化适配器注册表...');
  const registry = new AdapterRegistry();
  console.log('   ✓ 适配器注册表创建成功');

  // 2. 创建安全和资源管理组件
  console.log('\n🛡️  2. 初始化安全和资源管理组件...');
  const securityValidator = new SecurityPolicyValidator({
    blockedCommands: ['dangerous_command'],
    allowedDomains: ['safe.example.com']
  });
  
  const resourceLimiter = new ResourceLimiter({
    maxMemory: '512MB',
    maxExecutionTime: 30000
  });
  
  console.log('   ✓ 安全验证器和资源限制器初始化完成');

  // 3. 模拟适配器类（实际使用时会导入真实的适配器）
  console.log('\n🏗️  3. 演示适配器模式实现...');
  
  // 模拟一个简单的适配器类结构，实现所有必需的接口
  class MockAdapter extends ICommandExecutor {
    constructor(config) {
      super();
      this.config = config;
      this.initialized = false;
      this.sandboxes = new Map();
    }
    
    async initialize() {
      this.initialized = true;
      console.log('     模拟适配器初始化完成');
    }
    
    async executeCommand(command, args, options = {}) {
      console.log(`     执行命令: ${command} ${args.join(' ')}`);
      return {
        code: 0,
        stdout: `Mock output for ${command}`,
        stderr: '',
        duration: 100,
        success: true
      };
    }
    
    // 实现依赖管理接口方法
    async installDependencies(dependencies, targetDir) {
      console.log(`     安装依赖到 ${targetDir}:`, dependencies);
      return {
        success: true,
        installed: Object.keys(dependencies || {}),
        failed: [],
        duration: 50,
        output: 'Mock installation complete'
      };
    }
    
    async checkDependencies(targetDir) {
      console.log(`     检查依赖状态: ${targetDir}`);
      return {
        satisfied: true,
        installed: {},
        missing: [],
        outdated: []
      };
    }
    
    async uninstallDependencies(packages, targetDir) {
      console.log(`     卸载依赖:`, packages);
      return {
        success: true,
        uninstalled: packages,
        failed: [],
        duration: 30
      };
    }
    
    // 实现沙箱管理接口方法
    async createSandbox(config) {
      const sandboxId = `mock-sandbox-${Date.now()}`;
      const sandbox = {
        id: sandboxId,
        directory: `/tmp/${sandboxId}`,
        security: config.security,
        runtime: this.config.runtime,
        createdAt: new Date(),
        status: 'ready'
      };
      
      this.sandboxes.set(sandboxId, sandbox);
      console.log(`     创建沙箱: ${sandboxId}`);
      
      return sandbox;
    }
    
    async destroySandbox(sandboxId) {
      this.sandboxes.delete(sandboxId);
      console.log(`     销毁沙箱: ${sandboxId}`);
    }
    
    async getSandboxStatus(sandboxId) {
      const sandbox = this.sandboxes.get(sandboxId);
      if (!sandbox) {
        throw new Error(`Sandbox ${sandboxId} not found`);
      }
      
      return {
        id: sandboxId,
        status: sandbox.status,
        resourceUsage: { memory: 0, cpu: 0 },
        lastActivity: new Date(),
        uptime: Date.now() - sandbox.createdAt.getTime()
      };
    }
    
    async listSandboxes() {
      return Array.from(this.sandboxes.values());
    }
  }

  // 注册模拟适配器
  try {
    registry.register('mock', MockAdapter);
    console.log('   ✓ 模拟适配器注册成功');
  } catch (error) {
    console.log('   ✗ 适配器注册失败:', error.message);
  }

  // 4. 创建适配器实例
  console.log('\n⚙️  4. 创建适配器实例...');
  
  try {
    const mockAdapter = registry.create('mock', {
      runtime: { nodePath: '/usr/bin/node' },
      security: securityValidator,
      limits: resourceLimiter
    });
    
    console.log('   ✓ 适配器实例创建成功');
    console.log('   ✓ 实例类型:', mockAdapter.constructor.name);
    
    // 演示适配器功能
    await mockAdapter.initialize();
    const result = await mockAdapter.executeCommand('echo', ['hello', 'world'], {});
    console.log('   ✓ 命令执行结果:', result.stdout);
    
    // 演示沙箱功能
    const sandbox = await mockAdapter.createSandbox({
      toolName: 'test-tool',
      security: securityValidator,
      limits: resourceLimiter
    });
    console.log('   ✓ 沙箱创建成功:', sandbox.id);
    
    const status = await mockAdapter.getSandboxStatus(sandbox.id);
    console.log('   ✓ 沙箱状态查询成功:', status.status);
    
    await mockAdapter.destroySandbox(sandbox.id);
    console.log('   ✓ 沙箱销毁成功');
    
  } catch (error) {
    console.log('   ✗ 适配器实例创建失败:', error.message);
  }

  // 5. 演示注册表功能
  console.log('\n📋 5. 注册表功能演示...');
  
  // 获取已注册的适配器
  const registeredAdapters = registry.getRegisteredAdapters();
  console.log('   ✓ 已注册的适配器:', registeredAdapters);
  
  // 检查适配器是否存在
  const isRegistered = registry.isRegistered('mock');
  console.log('   ✓ mock适配器已注册:', isRegistered);
  
  // 获取适配器信息
  try {
    const adapterInfo = registry.getAdapterInfo('mock');
    console.log('   ✓ 适配器信息:', {
      name: adapterInfo.name,
      className: adapterInfo.className,
      instanceCount: adapterInfo.instanceCount
    });
  } catch (error) {
    console.log('   ✗ 获取适配器信息失败:', error.message);
  }

  // 6. 演示安全验证集成
  console.log('\n🔒 6. 安全验证集成演示...');
  
  // 演示命令验证
  try {
    securityValidator.validateCommand('safe_command', ['arg1', 'arg2']);
    console.log('   ✓ 安全命令验证通过');
  } catch (error) {
    console.log('   ✗ 安全命令验证失败:', error.message);
  }
  
  // 演示路径验证
  try {
    securityValidator.validateFilePath('/tmp/safe_file.txt');
    console.log('   ✓ 安全路径验证通过');
  } catch (error) {
    console.log('   ✗ 安全路径验证失败:', error.message);
  }

  // 7. 演示资源限制集成
  console.log('\n📊 7. 资源限制集成演示...');
  
  // 创建资源跟踪器
  const tracker = resourceLimiter.createResourceTracker('adapter-operation');
  console.log('   ✓ 资源跟踪器创建成功');
  
  // 模拟资源使用
  tracker.recordMemoryUsage(256 * 1024 * 1024); // 256MB
  tracker.recordCPUUsage(0.75); // 75% CPU
  tracker.recordNetworkRequest('https://api.example.com/data');
  tracker.recordFileCreation('/tmp/test.txt', 1024); // 1KB file
  
  console.log('   ✓ 内存使用:', Math.round(tracker.getMemoryUsage() / (1024 * 1024)), 'MB');
  console.log('   ✓ CPU使用:', tracker.getCPUUsage(), 'cores');
  console.log('   ✓ 执行时间:', tracker.getRuntime(), 'ms');
  console.log('   ✓ 网络请求数:', tracker.networkRequests);
  console.log('   ✓ 文件操作数:', tracker.filesCreated.length);

  // 8. 获取安全统计
  console.log('\n📈 8. 安全统计信息...');
  const securityStats = securityValidator.getSecurityStats();
  console.log('   ✓ 总验证次数:', securityStats.totalValidations);
  console.log('   ✓ 阻止的命令数:', securityStats.blockedCommands);
  console.log('   ✓ 阻止的网络请求数:', securityStats.blockedNetworkRequests);
  console.log('   ✓ 阻止的模块数:', securityStats.blockedModules);
  console.log('   ✓ 阻止的路径数:', securityStats.blockedPaths);

  console.log('\n✅ 适配器系统示例执行完成！');
  console.log('\n💡 ToolX 适配器系统特点：');
  console.log('   - 🔄 插件式扩展（开闭原则 OCP）');
  console.log('   - 🔌 支持多种运行时环境（Node.js, Electron, Docker）');
  console.log('   - 🔐 与安全验证系统深度集成');
  console.log('   - 📊 资源限制和监控功能');
  console.log('   - 🏗️ 遵循SOLID设计原则');
}

// 执行适配器示例
runAdapterExample().catch(error => {
  console.error('适配器示例执行出错:', error);
  process.exit(1);
});