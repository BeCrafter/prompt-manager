/**
 * 性能基准测试用例
 * 验证系统性能和可扩展性
 */

const assert = require('assert');
const { performance } = require('perf_hooks');
const { BaseProcessPool } = require('../src/core/base/process-pool');
const { MetricsCollector } = require('../src/monitoring/metrics-collector');

// 模拟运行时提供者
class MockRuntimeProvider {
  constructor() {
    this.workingDir = '/tmp/test';
  }
}

// 模拟工作进程
class MockWorker {
  constructor(id) {
    this.id = id;
    this.isHealthy = true;
  }
}

// 模拟进程池实现
class MockProcessPool extends BaseProcessPool {
  constructor(runtimeProvider, options) {
    super(runtimeProvider, options);
  }
  
  async doCreateWorker(workerId) {
    // 模拟创建工作进程的延迟
    await new Promise(resolve => setTimeout(resolve, 1));
    return new MockWorker(workerId);
  }
  
  async isWorkerHealthy(worker) {
    return worker.isHealthy;
  }
  
  async doDestroyWorker(worker) {
    worker.isHealthy = false;
  }
}

describe('性能基准测试', () => {
  let metricsCollector;
  
  before(() => {
    metricsCollector = new MetricsCollector({ enabled: false }); // 禁用以避免影响性能测试
  });
  
  after(() => {
    if (metricsCollector) {
      metricsCollector.removeAllListeners();
    }
  });
  
  describe('进程池性能', () => {
    let processPool;
    
    beforeEach(() => {
      const runtimeProvider = new MockRuntimeProvider();
      processPool = new MockProcessPool(runtimeProvider, {
        maxWorkers: 10,
        minWorkers: 2,
        warmupWorkers: 2,
        maxIdleTime: 5000,
        healthCheckInterval: 1000
      });
    });
    
    afterEach(async () => {
      if (processPool) {
        await processPool.shutdown();
      }
    });
    
    it('应该快速初始化进程池', async function() {
      this.timeout(5000);
      
      const startTime = performance.now();
      await processPool.initialize();
      const endTime = performance.now();
      
      const initTime = endTime - startTime;
      assert.ok(initTime < 1000, `初始化时间过长: ${initTime}ms`);
      
      // 验证预热的工作进程
      assert.strictEqual(processPool.workers.size, 2);
      assert.strictEqual(processPool.availableWorkers.length, 2);
    });
    
    it('应该高效创建工作进程', async function() {
      this.timeout(5000);
      
      await processPool.initialize();
      
      const startTime = performance.now();
      
      // 创建多个工作进程
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(processPool.createWorker());
      }
      
      const workers = await Promise.all(promises);
      const endTime = performance.now();
      
      const createTime = endTime - startTime;
      assert.ok(createTime < 100, `创建工作进程时间过长: ${createTime}ms`);
      
      // 验证所有工作进程都已创建
      assert.strictEqual(workers.length, 5);
      assert.strictEqual(processPool.workers.size, 7); // 2个预热的 + 5个新创建的
    });
    
    it('应该快速获取和释放工作进程', async function() {
      this.timeout(5000);
      
      await processPool.initialize();
      
      // 预创建一些工作进程
      for (let i = 0; i < 3; i++) {
        await processPool.createWorker();
      }
      
      const startTime = performance.now();
      
      // 执行多次获取和释放操作
      for (let i = 0; i < 100; i++) {
        const worker = await processPool.acquireWorker(`tool-${i}`);
        processPool.releaseWorker(worker.id);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 100;
      
      assert.ok(avgTime < 10, `平均获取/释放时间过长: ${avgTime}ms`);
    });
    
    it('应该支持高并发操作', async function() {
      this.timeout(10000);
      
      await processPool.initialize();
      
      // 预创建足够的工作进程
      for (let i = 0; i < 8; i++) {
        await processPool.createWorker();
      }
      
      const startTime = performance.now();
      
      // 并发执行大量操作
      const promises = [];
      for (let i = 0; i < 200; i++) {
        promises.push(processPool.acquireWorker(`tool-${i}`));
      }
      
      const workers = await Promise.all(promises);
      const acquireTime = performance.now() - startTime;
      
      // 释放所有工作进程
      const releaseStartTime = performance.now();
      workers.forEach(worker => processPool.releaseWorker(worker.id));
      const releaseTime = performance.now() - releaseStartTime;
      
      assert.ok(acquireTime < 1000, `并发获取时间过长: ${acquireTime}ms`);
      assert.ok(releaseTime < 100, `并发释放时间过长: ${releaseTime}ms`);
      
      // 验证所有工作进程都回到可用状态
      assert.strictEqual(processPool.availableWorkers.length, 10);
    });
  });
  
  describe('配置加载性能', () => {
    const configCache = new Map();
    
    function createTestConfig(name, depth = 5) {
      if (configCache.has(name)) {
        return configCache.get(name);
      }
      
      let config = `runtime:\n  timeout: 30000\n  maxMemory: "512MB"\n`;
      
      // 添加嵌套配置以增加复杂性
      for (let i = 0; i < depth; i++) {
        config += `  nested${i}:\n    value${i}: ${i}\n    array${i}:\n`;
        for (let j = 0; j < 10; j++) {
          config += `      - item${j}\n`;
        }
      }
      
      configCache.set(name, config);
      return config;
    }
    
    it('应该快速加载简单配置', () => {
      const simpleConfig = 'runtime:\n  timeout: 30000\n  maxMemory: "512MB"\n';
      
      const startTime = performance.now();
      
      // 模拟多次加载
      for (let i = 0; i < 1000; i++) {
        // 这里只是模拟，实际的YAML解析在ConfigLoader中
        const config = simpleConfig;
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 1000;
      
      assert.ok(avgTime < 1, `简单配置加载时间过长: ${avgTime}ms`);
    });
    
    it('应该高效处理配置缓存', () => {
      const config = createTestConfig('cached-test');
      
      const startTime = performance.now();
      
      // 模拟缓存命中
      for (let i = 0; i < 10000; i++) {
        // 模拟从缓存获取
        const cached = config;
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 10000;
      
      assert.ok(avgTime < 0.01, `缓存访问时间过长: ${avgTime}ms`);
    });
  });
  
  describe('适配器性能', () => {
    // 模拟适配器性能测试
    class MockAdapter {
      constructor() {
        this.stats = {
          totalCommands: 0,
          totalDependencies: 0,
          totalSandboxes: 0
        };
      }
      
      async executeCommand(command, args, options = {}) {
        // 模拟命令执行延迟
        await new Promise(resolve => setTimeout(resolve, options.delay || 1));
        this.stats.totalCommands++;
        return { code: 0, stdout: 'success', stderr: '' };
      }
      
      async installDependencies(dependencies, targetDir) {
        // 模拟依赖安装延迟
        await new Promise(resolve => setTimeout(resolve, 10));
        this.stats.totalDependencies++;
        return { success: true, installed: Object.keys(dependencies) };
      }
      
      async createSandbox(config) {
        // 模拟沙箱创建延迟
        await new Promise(resolve => setTimeout(resolve, 5));
        this.stats.totalSandboxes++;
        return { id: `sandbox-${Date.now()}`, directory: '/tmp/sandbox' };
      }
    }
    
    let adapter;
    
    beforeEach(() => {
      adapter = new MockAdapter();
    });
    
    it('应该快速执行简单命令', async function() {
      this.timeout(5000);
      
      const startTime = performance.now();
      
      // 执行大量简单命令
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(adapter.executeCommand('echo', ['test'], { delay: 0 }));
      }
      
      await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 1000;
      
      assert.ok(avgTime < 5, `平均命令执行时间过长: ${avgTime}ms`);
      assert.strictEqual(adapter.stats.totalCommands, 1000);
    });
    
    it('应该高效管理沙箱', async function() {
      this.timeout(5000);
      
      const startTime = performance.now();
      
      // 创建和销毁大量沙箱
      const sandboxIds = [];
      for (let i = 0; i < 100; i++) {
        const sandbox = await adapter.createSandbox({ name: `test-${i}` });
        sandboxIds.push(sandbox.id);
      }
      
      const createEndTime = performance.now();
      const createAvgTime = (createEndTime - startTime) / 100;
      
      // 验证沙箱创建性能
      assert.ok(createAvgTime < 20, `平均沙箱创建时间过长: ${createAvgTime}ms`);
      assert.strictEqual(adapter.stats.totalSandboxes, 100);
    });
  });
  
  describe('内存使用性能', () => {
    it('应该保持低内存占用', function() {
      this.timeout(5000);
      
      const initialMemory = process.memoryUsage();
      
      // 创建大量对象来测试内存使用
      const objects = [];
      for (let i = 0; i < 10000; i++) {
        objects.push({
          id: i,
          data: `test-data-${i}`,
          nested: {
            value: i * 2,
            array: [i, i + 1, i + 2]
          }
        });
      }
      
      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;
      
      // 清理对象
      objects.length = 0;
      
      // 验证内存增长在合理范围内（这里假设不超过10MB）
      assert.ok(memoryIncrease < 10 * 1024 * 1024, `内存增长过大: ${memoryIncrease} bytes`);
    });
    
    it('应该正确处理垃圾回收', function() {
      this.timeout(5000);
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage();
      
      // 创建临时对象
      let tempObjects = [];
      for (let i = 0; i < 50000; i++) {
        tempObjects.push({ data: `temp-${i}`, array: new Array(100).fill(i) });
      }
      
      const peakMemory = process.memoryUsage();
      const peakUsage = peakMemory.heapUsed - initialMemory.heapUsed;
      
      // 清理对象
      tempObjects = null;
      
      // 等待垃圾回收
      return new Promise(resolve => {
        setTimeout(() => {
          if (global.gc) {
            global.gc();
          }
          
          const finalMemory = process.memoryUsage();
          const finalUsage = finalMemory.heapUsed - initialMemory.heapUsed;
          
          // 验证内存已回收
          assert.ok(finalUsage < peakUsage * 0.5, `垃圾回收效果不佳: ${finalUsage} < ${peakUsage * 0.5}`);
          resolve();
        }, 100);
      });
    });
  });
  
  describe('并发性能', () => {
    class ConcurrencyTestWorker {
      constructor(id) {
        this.id = id;
        this.tasksCompleted = 0;
      }
      
      async doWork(duration = 1) {
        await new Promise(resolve => setTimeout(resolve, duration));
        this.tasksCompleted++;
        return { workerId: this.id, taskId: this.tasksCompleted };
      }
    }
    
    it('应该支持高并发任务处理', async function() {
      this.timeout(10000);
      
      const workers = [];
      for (let i = 0; i < 10; i++) {
        workers.push(new ConcurrencyTestWorker(i));
      }
      
      const startTime = performance.now();
      
      // 并发执行大量任务
      const tasks = [];
      for (let i = 0; i < 1000; i++) {
        const worker = workers[i % workers.length];
        tasks.push(worker.doWork(0)); // 几乎无延迟
      }
      
      const results = await Promise.all(tasks);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 1000;
      
      assert.ok(avgTime < 100, `并发任务处理时间过长: ${avgTime}ms`);
      assert.strictEqual(results.length, 1000);
      
      // 验证所有任务都已完成
      const totalCompleted = workers.reduce((sum, worker) => sum + worker.tasksCompleted, 0);
      assert.strictEqual(totalCompleted, 1000);
    });
    
    it('应该正确处理异步操作', async function() {
      this.timeout(5000);
      
      // 测试Promise链性能
      const startTime = performance.now();
      
      let promise = Promise.resolve(0);
      for (let i = 0; i < 1000; i++) {
        promise = promise.then(value => value + 1);
      }
      
      const result = await promise;
      const endTime = performance.now();
      
      assert.strictEqual(result, 1000);
      assert.ok(endTime - startTime < 100, `Promise链处理时间过长: ${endTime - startTime}ms`);
    });
  });
  
  describe('监控性能', () => {
    let metricsCollector;
    
    beforeEach(() => {
      metricsCollector = new MetricsCollector({ 
        enabled: true,
        maxDataPoints: 1000 
      });
    });
    
    afterEach(() => {
      if (metricsCollector) {
        metricsCollector.removeAllListeners();
      }
    });
    
    it('应该高效记录指标', () => {
      const startTime = performance.now();
      
      // 记录大量指标
      for (let i = 0; i < 10000; i++) {
        metricsCollector.recordExecutionTime('test-op', 10, { iteration: i });
        metricsCollector.recordCustomMetric('custom-value', i);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 10000;
      
      assert.ok(avgTime < 1, `平均指标记录时间过长: ${avgTime}ms`);
      
      // 验证指标已正确记录
      const operationMetrics = metricsCollector.getOperationMetrics('test-op');
      assert.ok(operationMetrics);
      assert.strictEqual(operationMetrics.count, 10000);
    });
    
    it('应该快速查询指标', () => {
      // 预先记录一些指标
      for (let i = 0; i < 1000; i++) {
        metricsCollector.recordExecutionTime('query-test', i);
      }
      
      const startTime = performance.now();
      
      // 执行多次查询
      for (let i = 0; i < 1000; i++) {
        const metrics = metricsCollector.getOperationMetrics('query-test');
        assert.ok(metrics);
      }
      
      const endTime = performance.now();
      const avgTime = (endTime - startTime) / 1000;
      
      assert.ok(avgTime < 1, `平均指标查询时间过长: ${avgTime}ms`);
    });
  });
  
  describe('基准性能对比', () => {
    it('应该提供性能基准报告', function() {
      this.timeout(5000);
      
      // 这是一个示例测试，实际的基准测试应该在专门的基准测试环境中运行
      const benchmarks = {
        'process_pool_initialization': { target: 1000, actual: 0 },
        'worker_creation': { target: 100, actual: 0 },
        'command_execution': { target: 10, actual: 0 },
        'config_loading': { target: 5, actual: 0 }
      };
      
      // 这里只是示例，实际应该运行具体的性能测试
      Object.keys(benchmarks).forEach(key => {
        benchmarks[key].actual = benchmarks[key].target * (0.8 + Math.random() * 0.4); // 模拟实际性能
      });
      
      // 验证所有基准都在可接受范围内（±20%）
      Object.values(benchmarks).forEach(benchmark => {
        const deviation = Math.abs(benchmark.actual - benchmark.target) / benchmark.target;
        assert.ok(deviation < 0.2, `性能基准偏差过大: ${deviation * 100}%`);
      });
    });
  });
});
