/**
 * 端到端测试用例
 * 验证整个系统的集成和功能
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const { AdapterRegistry } = require('../src/core/registry');
const { ConfigLoader } = require('../src/core/config-loader');
const { NodeJSRuntimeProvider } = require('../src/adapters/nodejs-adapter');
const { MetricsCollector } = require('../src/monitoring/metrics-collector');

describe('端到端测试', () => {
  let registry;
  let configLoader;
  let metricsCollector;
  let testConfigDir;
  
  before(async () => {
    // 创建临时配置目录
    testConfigDir = path.join(__dirname, 'temp-e2e-config');
    await fs.mkdir(testConfigDir, { recursive: true });
    await fs.mkdir(path.join(testConfigDir, 'scenarios'), { recursive: true });
  });
  
  after(async () => {
    // 清理临时配置目录
    await fs.rmdir(testConfigDir, { recursive: true });
  });
  
  beforeEach(() => {
    registry = new AdapterRegistry();
    configLoader = new ConfigLoader();
    configLoader.setConfigDirectory(testConfigDir);
    metricsCollector = new MetricsCollector();
  });
  
  afterEach(() => {
    metricsCollector.removeAllListeners();
  });
  
  describe('完整工作流程', () => {
    beforeEach(async () => {
      // 创建测试配置
      const baseConfig = `
base:
  runtime:
    timeout: 10000
    maxMemory: "512MB"
    maxFileSize: "10MB"
  processPool:
    maxWorkers: 2
    minWorkers: 1
    warmupWorkers: 1
  security:
    enableSandbox: true
    allowedDomains: ["example.com"]
    blockedCommands: ["rm", "sudo", "chmod"]
    fileAccessWhitelist: ["/tmp", "/tmp/test"]
  limits:
    maxCPU: "50%"
    maxExecutionTime: 10000
    maxNetworkRequests: 5
    maxProcesses: 5
logging:
  level: "info"
  file: "./logs/toolx.log"
performance:
  metrics:
    enabled: true
    interval: 60000
    retention: 86400000
  alerts:
    memoryThreshold: 80
    cpuThreshold: 90
    responseTimeThreshold: 5000
`;
      
      const scenarioConfig = `
extends: "../base-config.yml"

scenario: "nodejs-test"
description: "Node.js测试场景"

runtime:
  nodePath: "node"
  npmPath: "npm"
  npxPath: "npx"
  workingDir: "/tmp/test-workspace"
  envVars:
    NODE_ENV: "test"

processPool:
  type: "child-process"
  maxWorkers: 2
  minWorkers: 1
`;
      
      await fs.writeFile(path.join(testConfigDir, 'base-config.yml'), baseConfig);
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'nodejs-test.yml'), scenarioConfig);
    });
    
    it('应该成功完成完整的适配器工作流程', async () => {
      // 1. 加载配置
      const config = await configLoader.loadScenario('nodejs-test');
      assert.ok(config);
      assert.strictEqual(config.scenario, 'nodejs-test');
      
      // 2. 注册适配器
      registry.register('nodejs-test', NodeJSRuntimeProvider);
      assert.ok(registry.isRegistered('nodejs-test'));
      
      // 3. 创建适配器实例
      const adapter = registry.create('nodejs-test', config);
      assert.ok(adapter);
      assert.ok(adapter instanceof NodeJSRuntimeProvider);
      
      // 4. 验证适配器初始化
      await adapter.initialize();
      
      // 5. 创建沙箱
      const sandbox = await adapter.createSandbox({ toolName: 'test-tool' });
      assert.ok(sandbox);
      assert.ok(sandbox.id);
      assert.ok(sandbox.directory);
      
      // 6. 执行简单命令
      const result = await adapter.executeCommand('node', ['--version'], { timeout: 5000 });
      assert.ok(result);
      assert.strictEqual(result.success, true);
      assert.ok(result.stdout.includes('v'));
      
      // 7. 检查安全验证
      await assert.rejects(
        async () => await adapter.executeCommand('rm', ['-rf', '/']),
        /blocked by security policy/
      );
      
      // 8. 安装依赖（模拟）
      const depsResult = await adapter.installDependencies({ 'lodash': '^4.17.21' }, '/tmp/test-deps');
      assert.ok(depsResult);
      assert.strictEqual(depsResult.success, true);
      
      // 9. 获取沙箱状态
      const status = await adapter.getSandboxStatus(sandbox.id);
      assert.ok(status);
      assert.strictEqual(status.id, sandbox.id);
      
      // 10. 列出沙箱
      const sandboxes = await adapter.listSandboxes();
      assert.ok(Array.isArray(sandboxes));
      assert.ok(sandboxes.some(s => s.id === sandbox.id));
      
      // 11. 检查统计信息
      const stats = adapter.getStats();
      assert.ok(stats);
      assert.strictEqual(typeof stats.totalCommands, 'number');
      assert.strictEqual(typeof stats.totalDependencies, 'number');
      assert.strictEqual(typeof stats.totalSandboxes, 'number');
      
      // 12. 销毁沙箱
      await adapter.destroySandbox(sandbox.id);
      
      // 13. 验证沙箱已被销毁
      await assert.rejects(
        async () => await adapter.getSandboxStatus(sandbox.id),
        /not found/
      );
    });
    
    it('应该验证配置继承机制', async () => {
      const config = await configLoader.loadScenario('nodejs-test');
      
      // 验证继承的配置
      assert.strictEqual(config.runtime.timeout, 10000);
      assert.strictEqual(config.processPool.maxWorkers, 2);
      assert.strictEqual(config.security.enableSandbox, true);
      assert.deepStrictEqual(config.security.blockedCommands, ["rm", "sudo", "chmod"]);
      
      // 验证覆盖的配置
      assert.strictEqual(config.scenario, 'nodejs-test');
      assert.strictEqual(config.runtime.nodePath, 'node');
      assert.strictEqual(config.processPool.type, 'child-process');
    });
  });
  
  describe('适配器注册和使用', () => {
    beforeEach(async () => {
      // 创建简单的测试配置
      const config = `
runtime:
  nodePath: "node"
  npmPath: "npm"
  workingDir: "/tmp/test"
processPool:
  maxWorkers: 2
  minWorkers: 1
security:
  enableSandbox: true
  blockedCommands: ["rm"]
limits:
  maxExecutionTime: 5000
`;
      
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'simple-test.yml'), config);
    });
    
    it('应该支持多个适配器实例', async () => {
      const config1 = await configLoader.loadScenario('simple-test');
      const config2 = await configLoader.loadScenario('simple-test');
      
      // 使用不同配置创建适配器
      const adapter1 = new NodeJSRuntimeProvider(config1);
      const adapter2 = new NodeJSRuntimeProvider(config2);
      
      // 验证它们是不同的实例但使用相同的配置
      assert.notStrictEqual(adapter1, adapter2);
      assert.deepStrictEqual(adapter1.config, adapter2.config);
    });
    
    it('应该正确处理适配器关闭', async () => {
      const config = await configLoader.loadScenario('simple-test');
      const adapter = new NodeJSRuntimeProvider(config);
      
      // 初始化适配器
      await adapter.initialize();
      
      // 创建一些沙箱
      const sandbox1 = await adapter.createSandbox({ toolName: 'test1' });
      const sandbox2 = await adapter.createSandbox({ toolName: 'test2' });
      
      // 关闭适配器
      await adapter.shutdown();
      
      // 验证适配器已关闭
      assert.strictEqual(adapter.processPool.isShuttingDown, true);
    });
  });
  
  describe('错误处理和恢复', () => {
    beforeEach(async () => {
      const config = `
runtime:
  nodePath: "node"
  npmPath: "npm"
  workingDir: "/tmp/test"
processPool:
  maxWorkers: 1
  minWorkers: 1
security:
  enableSandbox: true
  blockedCommands: ["rm", "sudo"]
limits:
  maxExecutionTime: 3000
`;
      
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'error-test.yml'), config);
    });
    
    it('应该正确处理命令执行错误', async () => {
      const config = await configLoader.loadScenario('error-test');
      const adapter = new NodeJSRuntimeProvider(config);
      
      await adapter.initialize();
      
      // 尝试执行一个不存在的命令
      await assert.rejects(
        async () => await adapter.executeCommand('nonexistent-command', []),
        /spawn nonexistent-command ENOENT/
      );
    });
    
    it('应该正确处理安全限制', async () => {
      const config = await configLoader.loadScenario('error-test');
      const adapter = new NodeJSRuntimeProvider(config);
      
      await adapter.initialize();
      
      // 尝试执行被阻止的命令
      await assert.rejects(
        async () => await adapter.executeCommand('rm', ['-rf', '/']),
        /blocked by security policy/
      );
    });
    
    it('应该正确处理超时', async () => {
      const config = await configLoader.loadScenario('error-test');
      const adapter = new NodeJSRuntimeProvider(config);
      
      await adapter.initialize();
      
      // 执行一个长时间运行的命令
      await assert.rejects(
        async () => await adapter.executeCommand('node', ['-e', 'setTimeout(() => {}, 10000)'], { timeout: 100 }),
        /timeout/
      );
    });
  });
  
  describe('监控集成', () => {
    beforeEach(async () => {
      const config = `
runtime:
  nodePath: "node"
  npmPath: "npm"
  workingDir: "/tmp/test"
processPool:
  maxWorkers: 2
  minWorkers: 1
security:
  enableSandbox: true
limits:
  maxExecutionTime: 5000
`;
      
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'monitor-test.yml'), config);
    });
    
    it('应该与监控模块集成', async () => {
      const config = await configLoader.loadScenario('monitor-test');
      const adapter = new NodeJSRuntimeProvider(config);
      
      await adapter.initialize();
      
      // 记录一些操作
      const startTime = Date.now();
      try {
        await adapter.executeCommand('node', ['--version']);
      } catch (error) {
        // 忽略错误，只测试监控
      }
      
      // 验证指标已记录
      const stats = adapter.getStats();
      assert.ok(stats);
    });
  });
  
  describe('性能验证', () => {
    beforeEach(async () => {
      const config = `
runtime:
  nodePath: "node"
  npmPath: "npm"
  workingDir: "/tmp/test"
processPool:
  maxWorkers: 4
  minWorkers: 1
  warmupWorkers: 2
security:
  enableSandbox: true
limits:
  maxExecutionTime: 10000
`;
      
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'perf-test.yml'), config);
    });
    
    it('应该验证并发性能', async function() {
      this.timeout(10000); // 增加超时时间
      
      const config = await configLoader.loadScenario('perf-test');
      const adapter = new NodeJSRuntimeProvider(config);
      
      await adapter.initialize();
      
      // 执行多个并发操作
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(adapter.executeCommand('node', ['--version']));
      }
      
      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 5);
      
      // 验证所有操作都成功
      results.forEach(result => {
        assert.ok(result.success || result.stdout.includes('v'));
      });
    });
    
    it('应该验证沙箱管理性能', async function() {
      this.timeout(10000);
      
      const config = await configLoader.loadScenario('perf-test');
      const adapter = new NodeJSRuntimeProvider(config);
      
      await adapter.initialize();
      
      // 批量创建和销毁沙箱
      const sandboxIds = [];
      
      // 创建多个沙箱
      for (let i = 0; i < 3; i++) {
        const sandbox = await adapter.createSandbox({ toolName: `test-${i}` });
        sandboxIds.push(sandbox.id);
      }
      
      // 验证沙箱存在
      for (const id of sandboxIds) {
        const status = await adapter.getSandboxStatus(id);
        assert.ok(status);
      }
      
      // 销毁所有沙箱
      for (const id of sandboxIds) {
        await adapter.destroySandbox(id);
      }
      
      // 验证沙箱已被销毁
      for (const id of sandboxIds) {
        await assert.rejects(
          async () => await adapter.getSandboxStatus(id),
          /not found/
        );
      }
    });
  });
  
  describe('配置管理验证', () => {
    beforeEach(async () => {
      // 创建多个配置场景
      const baseConfig = `
base:
  runtime:
    timeout: 5000
    maxMemory: "256MB"
  processPool:
    maxWorkers: 2
    minWorkers: 1
  security:
    enableSandbox: true
`;
      
      const devConfig = `
extends: "../base-config.yml"

scenario: "development"
runtime:
  nodePath: "node"
  workingDir: "/tmp/dev-workspace"
processPool:
  maxWorkers: 4
`;
      
      const prodConfig = `
extends: "../base-config.yml"

scenario: "production"
runtime:
  nodePath: "node"
  workingDir: "/tmp/prod-workspace"
security:
  blockedCommands: ["rm", "sudo", "chmod", "mv"]
`;
      
      await fs.writeFile(path.join(testConfigDir, 'base-config.yml'), baseConfig);
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'dev.yml'), devConfig);
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'prod.yml'), prodConfig);
    });
    
    it('应该正确处理不同场景配置', async () => {
      // 加载开发环境配置
      const devConfig = await configLoader.loadScenario('dev');
      assert.strictEqual(devConfig.scenario, 'development');
      assert.strictEqual(devConfig.processPool.maxWorkers, 4); // 覆盖值
      assert.strictEqual(devConfig.runtime.maxMemory, '256MB'); // 继承值
      
      // 加载生产环境配置
      const prodConfig = await configLoader.loadScenario('prod');
      assert.strictEqual(prodConfig.scenario, 'production');
      assert.strictEqual(prodConfig.security.blockedCommands.length, 4); // 覆盖值
      assert.strictEqual(prodConfig.processPool.maxWorkers, 2); // 继承值
    });
    
    it('应该列出所有可用场景', async () => {
      const scenarios = await configLoader.getAvailableScenarios();
      assert.deepStrictEqual(scenarios.sort(), ['dev', 'prod']);
    });
  });
});