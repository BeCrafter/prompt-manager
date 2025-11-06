/**
 * 进程池测试用例
 * 验证进程池管理和负载均衡功能
 */

const assert = require('assert');
const { BaseProcessPool } = require('../src/core/base/process-pool');

// 模拟运行时提供者
class MockRuntimeProvider {
  constructor() {
    this.workingDir = '/tmp/test';
    this.envVars = { NODE_ENV: 'test' };
  }
}

// 模拟工作进程
class MockWorker {
  constructor(id) {
    this.id = id;
    this.isHealthy = true;
    this.process = {
      kill: function() {}
    };
  }
}

// 模拟进程池实现
class MockProcessPool extends BaseProcessPool {
  constructor(runtimeProvider, options) {
    super(runtimeProvider, options);
    this.createdWorkers = [];
  }
  
  async doCreateWorker(workerId) {
    const worker = new MockWorker(workerId);
    this.createdWorkers.push(worker);
    return worker;
  }
  
  async isWorkerHealthy(worker) {
    return worker.isHealthy;
  }
  
  async doDestroyWorker(worker) {
    worker.isHealthy = false;
    const index = this.createdWorkers.indexOf(worker);
    if (index > -1) {
      this.createdWorkers.splice(index, 1);
    }
  }
}

describe('进程池测试', () => {
  let processPool;
  let runtimeProvider;
  
  beforeEach(() => {
    runtimeProvider = new MockRuntimeProvider();
    processPool = new MockProcessPool(runtimeProvider, {
      maxWorkers: 4,
      minWorkers: 1,
      warmupWorkers: 2,
      maxIdleTime: 1000,
      healthCheckInterval: 500
    });
  });
  
  afterEach(async () => {
    if (processPool) {
      await processPool.shutdown();
    }
  });
  
  describe('初始化和配置', () => {
    it('应该正确初始化配置', () => {
      assert.strictEqual(processPool.runtimeProvider, runtimeProvider);
      assert.strictEqual(processPool.maxWorkers, 4);
      assert.strictEqual(processPool.minWorkers, 1);
      assert.strictEqual(processPool.warmupWorkers, 2);
      assert.strictEqual(processPool.maxIdleTime, 1000);
      assert.strictEqual(processPool.healthCheckInterval, 500);
    });
    
    it('应该验证配置边界值', () => {
      const pool = new MockProcessPool(runtimeProvider, {
        maxWorkers: 15, // 超过最大值
        minWorkers: 0,  // 低于最小值
        warmupWorkers: 20 // 超过maxWorkers
      });
      
      assert.strictEqual(pool.maxWorkers, 10); // 应该被限制为10
      assert.strictEqual(pool.minWorkers, 1);  // 应该被限制为1
      assert.strictEqual(pool.warmupWorkers, 10); // 应该被限制为maxWorkers
    });
    
    it('应该成功初始化进程池', async () => {
      await processPool.initialize();
      
      assert.ok(processPool.isInitialized);
      // 应该预热指定数量的工作进程
      assert.strictEqual(processPool.createdWorkers.length, 2);
      assert.strictEqual(processPool.availableWorkers.length, 2);
    });
  });
  
  describe('工作进程管理', () => {
    beforeEach(async () => {
      await processPool.initialize();
    });
    
    it('应该成功创建新的工作进程', async () => {
      const worker = await processPool.createWorker();
      
      assert.ok(worker);
      assert.ok(worker.id);
      assert.ok(processPool.workers.has(worker.id));
      assert.strictEqual(processPool.createdWorkers.length, 3);
    });
    
    it('应该成功获取可用工作进程', async () => {
      const worker = await processPool.acquireWorker('test-tool');
      
      assert.ok(worker);
      assert.ok(processPool.busyWorkers.has(worker.id));
      assert.ok(!processPool.availableWorkers.includes(worker));
      assert.strictEqual(processPool.stats.totalAcquired, 1);
    });
    
    it('应该成功释放工作进程', async () => {
      const worker = await processPool.acquireWorker('test-tool');
      processPool.releaseWorker(worker.id);
      
      assert.ok(!processPool.busyWorkers.has(worker.id));
      assert.ok(processPool.availableWorkers.includes(worker));
      assert.strictEqual(processPool.stats.totalReleased, 1);
    });
    
    it('应该支持负载均衡', async () => {
      // 创建多个工作进程
      await processPool.createWorker();
      await processPool.createWorker();
      
      // 获取工作进程，应该选择使用次数最少的
      const worker1 = await processPool.acquireWorker('tool1');
      const worker2 = await processPool.acquireWorker('tool2');
      const worker3 = await processPool.acquireWorker('tool3');
      
      // 确保获取了不同的工作进程
      assert.notStrictEqual(worker1.id, worker2.id);
      assert.notStrictEqual(worker2.id, worker3.id);
      
      // 释放所有工作进程
      processPool.releaseWorker(worker1.id);
      processPool.releaseWorker(worker2.id);
      processPool.releaseWorker(worker3.id);
      
      // 再次获取，应该实现负载均衡
      const nextWorker = await processPool.acquireWorker('tool4');
      assert.ok([worker1.id, worker2.id, worker3.id].includes(nextWorker.id));
    });
  });
  
  describe('健康检查和维护', () => {
    beforeEach(async () => {
      await processPool.initialize();
    });
    
    it('应该检测不健康的工作进程', async () => {
      const worker = await processPool.createWorker();
      worker.isHealthy = false;
      
      const isHealthy = await processPool.isWorkerHealthy(worker);
      assert.strictEqual(isHealthy, false);
    });
    
    it('应该销毁不健康的工作进程', async () => {
      const worker = await processPool.createWorker();
      const workerId = worker.id;
      
      worker.isHealthy = false;
      await processPool.destroyWorker(workerId);
      
      assert.ok(!processPool.workers.has(workerId));
      assert.strictEqual(processPool.createdWorkers.length, 1);
      assert.strictEqual(processPool.stats.totalDestroyed, 1);
    });
    
    it('应该回收工作进程', async () => {
      const worker = await processPool.createWorker();
      const workerId = worker.id;
      
      await processPool.recycleWorker(workerId);
      
      assert.ok(!processPool.workers.has(workerId));
      // 由于minWorkers=1，应该重新创建一个工作进程
      assert.strictEqual(processPool.workers.size, 1);
    });
  });
  
  describe('资源限制和回收', () => {
    beforeEach(async () => {
      processPool = new MockProcessPool(runtimeProvider, {
        maxWorkers: 3,
        minWorkers: 1,
        warmupWorkers: 1,
        maxIdleTime: 100, // 短时间用于测试
        healthCheckInterval: 50
      });
      await processPool.initialize();
    });
    
    it('应该限制最大工作进程数', async () => {
      // 创建达到最大限制的工作进程
      await processPool.createWorker();
      await processPool.createWorker();
      
      // 尝试创建超过限制的工作进程
      const worker = await processPool.createWorker();
      assert.strictEqual(worker, null);
      
      assert.strictEqual(processPool.workers.size, 3);
    });
    
    it('应该回收空闲工作进程', async () => {
      const worker = await processPool.createWorker();
      
      // 模拟空闲时间超过限制
      processPool.lastActivity.set(worker.id, Date.now() - 200);
      processPool.workers.size = 2; // 模拟超过最小工作进程数
      
      await processPool.recycleIdleWorkers();
      
      // 工作进程应该被回收
      assert.ok(!processPool.workers.has(worker.id));
    });
  });
  
  describe('统计和监控', () => {
    beforeEach(async () => {
      await processPool.initialize();
    });
    
    it('应该正确统计操作', async () => {
      const initialStats = { ...processPool.stats };
      
      await processPool.createWorker();
      const worker = await processPool.acquireWorker('test-tool');
      processPool.releaseWorker(worker.id);
      await processPool.destroyWorker(worker.id);
      
      assert.strictEqual(processPool.stats.totalCreated, initialStats.totalCreated + 1);
      assert.strictEqual(processPool.stats.totalAcquired, initialStats.totalAcquired + 1);
      assert.strictEqual(processPool.stats.totalReleased, initialStats.totalReleased + 1);
      assert.strictEqual(processPool.stats.totalDestroyed, initialStats.totalDestroyed + 1);
    });
    
    it('应该提供正确的状态信息', () => {
      const status = processPool.getStatus();
      
      assert.ok(status.isInitialized);
      assert.ok(!status.isShuttingDown);
      assert.strictEqual(typeof status.workers, 'object');
      assert.strictEqual(typeof status.config, 'object');
      assert.strictEqual(typeof status.stats, 'object');
      
      // 验证工作进程统计
      assert.strictEqual(status.workers.total, 2);
      assert.strictEqual(status.workers.available, 2);
      assert.strictEqual(status.workers.busy, 0);
    });
  });
  
  describe('错误处理', () => {
    it('应该处理初始化失败', async () => {
      // 模拟创建工作进程失败
      class FailingProcessPool extends MockProcessPool {
        async doCreateWorker() {
          throw new Error('Failed to create worker');
        }
      }
      
      const failingPool = new FailingProcessPool(runtimeProvider, { warmupWorkers: 1 });
      
      await assert.rejects(
        async () => await failingPool.initialize(),
        /Failed to create worker/
      );
    });
    
    it('应该处理获取工作进程失败', async () => {
      processPool.maxWorkers = 1;
      await processPool.initialize();
      
      // 占用唯一的工作进程
      await processPool.acquireWorker('tool1');
      
      // 尝试获取另一个工作进程应该失败
      await assert.rejects(
        async () => await processPool.acquireWorker('tool2'),
        /No available workers in pool/
      );
    });
    
    it('应该处理销毁不存在的工作进程', async () => {
      // 销毁不存在的工作进程不应该抛出错误
      await assert.doesNotReject(
        async () => await processPool.destroyWorker('nonexistent-id')
      );
    });
  });
  
  describe('关闭和清理', () => {
    beforeEach(async () => {
      await processPool.initialize();
      await processPool.createWorker();
      await processPool.createWorker();
    });
    
    it('应该成功关闭进程池', async () => {
      await processPool.shutdown();
      
      assert.ok(processPool.isShuttingDown);
      assert.strictEqual(processPool.workers.size, 0);
      assert.strictEqual(processPool.availableWorkers.length, 0);
      assert.strictEqual(processPool.busyWorkers.size, 0);
    });
    
    it('应该可以重复关闭', async () => {
      await processPool.shutdown();
      await processPool.shutdown(); // 重复关闭不应该出错
      
      assert.ok(processPool.isShuttingDown);
    });
  });
  
  describe('事件处理', () => {
    let events;
    
    beforeEach(async () => {
      events = [];
      processPool.on('workerCreated', (data) => events.push({ type: 'workerCreated', data }));
      processPool.on('workerDestroyed', (data) => events.push({ type: 'workerDestroyed', data }));
      processPool.on('workerAcquired', (data) => events.push({ type: 'workerAcquired', data }));
      processPool.on('workerReleased', (data) => events.push({ type: 'workerReleased', data }));
      processPool.on('error', (data) => events.push({ type: 'error', data }));
      
      await processPool.initialize();
    });
    
    it('应该正确发出事件', async () => {
      const worker = await processPool.createWorker();
      const workerId = worker.id;
      
      assert.strictEqual(events.length, 2); // initialized + workerCreated
      assert.strictEqual(events[1].type, 'workerCreated');
      assert.strictEqual(events[1].data.workerId, workerId);
      
      const acquiredWorker = await processPool.acquireWorker('test-tool');
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[2].type, 'workerAcquired');
      
      processPool.releaseWorker(acquiredWorker.id);
      assert.strictEqual(events.length, 4);
      assert.strictEqual(events[3].type, 'workerReleased');
      
      await processPool.destroyWorker(workerId);
      assert.strictEqual(events.length, 5);
      assert.strictEqual(events[4].type, 'workerDestroyed');
    });
  });
});