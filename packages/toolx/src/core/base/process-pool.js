/**
 * 进程池基类 - 消除重复代码，遵循DRY原则
 * 提供通用的进程池管理功能，子类只需实现具体的进程创建逻辑
 */

import EventEmitter from 'events';

class BaseProcessPool extends EventEmitter {
  constructor(runtimeProvider, options = {}) {
    super();
    
    // 验证必需参数
    if (!runtimeProvider) {
      throw new Error('runtimeProvider is required');
    }
    
    this.runtimeProvider = runtimeProvider;
    this.maxWorkers = Math.max(1, Math.min(10, options.maxWorkers || 4));
    this.minWorkers = Math.max(1, Math.min(this.maxWorkers, options.minWorkers || 1));
    this.warmupWorkers = Math.max(0, Math.min(this.maxWorkers, options.warmupWorkers || 2));
    this.maxIdleTime = options.maxIdleTime || 300000; // 5分钟
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30秒
    this.recycleThreshold = options.recycleThreshold || 100;
    
    // 调度策略
    this.schedulingStrategy = options.schedulingStrategy || 'least-used'; // least-used, round-robin, resource-based
    
    // 进程管理
    this.workers = new Map();
    this.availableWorkers = [];
    this.busyWorkers = new Set();
    this.usageCount = new Map();
    this.lastActivity = new Map();
    this.workerCounter = 0;
    
    // 资源监控
    this.workerResources = new Map(); // 存储每个worker的资源使用情况
    
    // 状态管理
    this.isInitialized = false;
    this.isShuttingDown = false;
    this.maintenanceTimer = null;
    
    // 性能统计
    this.stats = {
      totalCreated: 0,
      totalDestroyed: 0,
      totalAcquired: 0,
      totalReleased: 0,
      averageWaitTime: 0,
      peakWorkers: 0,
      totalWaitTime: 0
    };
    
    // 调度统计
    this.schedulingStats = {
      leastUsed: 0,
      roundRobin: 0,
      resourceBased: 0
    };
  }
  
  /**
   * 初始化进程池
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    try {
      // 预热进程
      const warmupPromises = [];
      for (let i = 0; i < this.warmupWorkers; i++) {
        warmupPromises.push(this.createWorker());
      }
      
      await Promise.all(warmupPromises);
      
      // 启动维护任务
      this.startMaintenanceTasks();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * 获取工作进程 - 负载均衡算法
   * @param {string} toolName - 工具名称
   * @returns {Promise<object>} 工作进程
   */
  async acquireWorker(toolName) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    
    try {
      // 选择最少使用的进程（负载均衡）
      let worker = this.selectWorker();
      
      // 动态扩容
      if (!worker && this.workers.size < this.maxWorkers) {
        worker = await this.createWorker();
      }
      
      if (!worker) {
        throw new Error(`No available workers in pool. Current: ${this.workers.size}/${this.maxWorkers}`);
      }
      
      // 更新状态
      this.updateWorkerStatus(worker, 'busy');
      this.usageCount.set(worker.id, (this.usageCount.get(worker.id) || 0) + 1);
      this.lastActivity.set(worker.id, Date.now());
      this.stats.totalAcquired++;
      
      // 检查回收阈值
      if (this.usageCount.get(worker.id) > this.recycleThreshold) {
        await this.recycleWorker(worker.id);
        return await this.acquireWorker(toolName);
      }
      
      // 更新等待时间统计
      const waitTime = Date.now() - startTime;
      this.updateAverageWaitTime(waitTime);
      
      this.emit('workerAcquired', { workerId: worker.id, toolName, waitTime });
      return worker;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * 释放工作进程
   * @param {string} workerId - 进程ID
   */
  releaseWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker '${workerId}' not found`);
    }
    
    this.updateWorkerStatus(worker, 'available');
    this.lastActivity.set(workerId, Date.now());
    this.stats.totalReleased++;
    
    this.emit('workerReleased', { workerId });
  }
  
  /**
   * 销毁工作进程
   * @param {string} workerId - 进程ID
   * @returns {Promise<void>}
   */
  async destroyWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return;
    }
    
    try {
      // 从各种集合中移除
      this.workers.delete(workerId);
      this.availableWorkers = this.availableWorkers.filter(w => w.id !== workerId);
      this.busyWorkers.delete(workerId);
      this.usageCount.delete(workerId);
      this.lastActivity.delete(workerId);
      
      // 调用子类实现的销毁方法
      await this.doDestroyWorker(worker);
      
      this.stats.totalDestroyed++;
      this.emit('workerDestroyed', { workerId });
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  /**
   * 回收工作进程
   * @param {string} workerId - 进程ID
   * @returns {Promise<void>}
   */
  async recycleWorker(workerId) {
    this.emit('workerRecycling', { workerId });
    await this.destroyWorker(workerId);
    
    // 如果当前进程数低于最小值，创建新进程
    if (this.workers.size < this.minWorkers) {
      await this.createWorker();
    }
  }
  
  /**
   * 选择可用工作进程
   * @returns {object|null} 工作进程
   */
  selectWorker() {
    if (this.availableWorkers.length === 0) {
      return null;
    }
    
    // 根据调度策略选择进程
    switch (this.schedulingStrategy) {
      case 'round-robin':
        this.schedulingStats.roundRobin++;
        return this.selectWorkerRoundRobin();
        
      case 'resource-based':
        this.schedulingStats.resourceBased++;
        return this.selectWorkerResourceBased();
        
      case 'least-used':
      default:
        this.schedulingStats.leastUsed++;
        return this.selectWorkerLeastUsed();
    }
  }
  
  /**
   * 选择使用次数最少的进程
   * @returns {object|null} 工作进程
   */
  selectWorkerLeastUsed() {
    return this.availableWorkers
      .sort((a, b) => (this.usageCount.get(a.id) || 0) - (this.usageCount.get(b.id) || 0))[0];
  }
  
  /**
   * 轮询选择进程
   * @returns {object|null} 工作进程
   */
  selectWorkerRoundRobin() {
    if (this.availableWorkers.length === 0) {
      return null;
    }
    
    // 简单的轮询实现
    if (!this.lastSelectedIndex) {
      this.lastSelectedIndex = 0;
    } else {
      this.lastSelectedIndex = (this.lastSelectedIndex + 1) % this.availableWorkers.length;
    }
    
    return this.availableWorkers[this.lastSelectedIndex];
  }
  
  /**
   * 基于资源使用情况选择进程
   * @returns {object|null} 工作进程
   */
  selectWorkerResourceBased() {
    if (this.availableWorkers.length === 0) {
      return null;
    }
    
    // 选择资源使用最少的进程
    return this.availableWorkers
      .sort((a, b) => {
        const resourcesA = this.workerResources.get(a.id) || { cpu: 0, memory: 0 };
        const resourcesB = this.workerResources.get(b.id) || { cpu: 0, memory: 0 };
        const totalA = resourcesA.cpu + resourcesA.memory;
        const totalB = resourcesB.cpu + resourcesB.memory;
        return totalA - totalB;
      })[0];
  }
  
  /**
   * 更新工作进程资源使用情况
   * @param {string} workerId - 工作进程ID
   * @param {object} resources - 资源使用情况
   */
  updateWorkerResources(workerId, resources) {
    this.workerResources.set(workerId, resources);
  }
  
  /**
   * 获取工作进程资源使用情况
   * @param {string} workerId - 工作进程ID
   * @returns {object} 资源使用情况
   */
  getWorkerResources(workerId) {
    return this.workerResources.get(workerId) || { cpu: 0, memory: 0 };
  }
  
  /**
   * 更新工作进程状态
   * @param {object} worker - 工作进程
   * @param {string} status - 状态
   */
  updateWorkerStatus(worker, status) {
    if (status === 'available') {
      this.busyWorkers.delete(worker.id);
      if (!this.availableWorkers.includes(worker)) {
        this.availableWorkers.push(worker);
      }
    } else if (status === 'busy') {
      this.availableWorkers = this.availableWorkers.filter(w => w.id !== worker.id);
      this.busyWorkers.add(worker.id);
    }
  }
  
  /**
   * 启动维护任务
   */
  startMaintenanceTasks() {
    if (this.maintenanceTimer) {
      return;
    }
    
    this.maintenanceTimer = setInterval(async () => {
      try {
        await this.performMaintenance();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.healthCheckInterval);
  }
  
  /**
   * 停止维护任务
   */
  stopMaintenanceTasks() {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
  }
  
  /**
   * 执行维护任务
   * @returns {Promise<void>}
   */
  async performMaintenance() {
    // 健康检查
    await this.healthCheck();
    
    // 资源监控
    await this.monitorWorkerResources();
    
    // 回收空闲进程
    await this.recycleIdleWorkers();
    
    // 更新峰值统计
    this.stats.peakWorkers = Math.max(this.stats.peakWorkers, this.workers.size);
  }
  
  /**
   * 监控工作进程资源使用情况
   * @returns {Promise<void>}
   */
  async monitorWorkerResources() {
    try {
      // 这里可以实现具体的资源监控逻辑
      // 例如，通过子类实现的具体监控方法
      // 暂时留空，由子类实现具体逻辑
    } catch (error) {
      this.emit('error', new Error(`Resource monitoring failed: ${error.message}`));
    }
  }
  
  /**
   * 健康检查
   * @returns {Promise<void>}
   */
  async healthCheck() {
    const healthCheckPromises = [];
    
    for (const [workerId, worker] of this.workers) {
      healthCheckPromises.push(
        this.isWorkerHealthy(worker).then(isHealthy => {
          if (!isHealthy) {
            this.emit('workerUnhealthy', { workerId });
            return this.destroyWorker(workerId);
          }
        })
      );
    }
    
    await Promise.all(healthCheckPromises);
  }
  
  /**
   * 回收空闲进程
   * @returns {Promise<void>}
   */
  async recycleIdleWorkers() {
    const now = Date.now();
    const idleWorkers = this.availableWorkers.filter(worker => {
      const lastActivity = this.lastActivity.get(worker.id) || 0;
      return (now - lastActivity) > this.maxIdleTime && this.workers.size > this.minWorkers;
    });
    
    const recyclePromises = idleWorkers.map(worker => this.recycleWorker(worker.id));
    await Promise.all(recyclePromises);
  }
  
  /**
   * 更新平均等待时间
   * @param {number} waitTime - 等待时间
   */
  updateAverageWaitTime(waitTime) {
    const alpha = 0.1; // 平滑因子
    this.stats.averageWaitTime = this.stats.averageWaitTime * (1 - alpha) + waitTime * alpha;
  }
  
  /**
   * 获取进程池状态
   * @returns {object} 状态信息
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isShuttingDown: this.isShuttingDown,
      workers: {
        total: this.workers.size,
        available: this.availableWorkers.length,
        busy: this.busyWorkers.size
      },
      config: {
        maxWorkers: this.maxWorkers,
        minWorkers: this.minWorkers,
        warmupWorkers: this.warmupWorkers,
        maxIdleTime: this.maxIdleTime,
        healthCheckInterval: this.healthCheckInterval,
        recycleThreshold: this.recycleThreshold,
        schedulingStrategy: this.schedulingStrategy
      },
      stats: { ...this.stats },
      schedulingStats: { ...this.schedulingStats },
      resourceStats: {
        trackedWorkers: this.workerResources.size
      }
    };
  }
  
  /**
   * 调整进程池配置
   * @param {object} newConfig - 新配置
   * @returns {void}
   */
  adjustConfig(newConfig) {
    if (newConfig.maxWorkers !== undefined) {
      this.maxWorkers = Math.max(1, Math.min(10, newConfig.maxWorkers));
    }
    
    if (newConfig.minWorkers !== undefined) {
      this.minWorkers = Math.max(1, Math.min(this.maxWorkers, newConfig.minWorkers));
    }
    
    if (newConfig.maxIdleTime !== undefined) {
      this.maxIdleTime = newConfig.maxIdleTime;
    }
    
    if (newConfig.healthCheckInterval !== undefined) {
      this.healthCheckInterval = newConfig.healthCheckInterval;
      // 重新设置健康检查间隔
      this.stopMaintenanceTasks();
      this.startMaintenanceTasks();
    }
    
    if (newConfig.schedulingStrategy !== undefined) {
      this.schedulingStrategy = newConfig.schedulingStrategy;
    }
    
    this.emit('configAdjusted', { newConfig });
  }
  
  /**
   * 获取当前配置
   * @returns {object} 当前配置
   */
  getConfig() {
    return {
      maxWorkers: this.maxWorkers,
      minWorkers: this.minWorkers,
      warmupWorkers: this.warmupWorkers,
      maxIdleTime: this.maxIdleTime,
      healthCheckInterval: this.healthCheckInterval,
      recycleThreshold: this.recycleThreshold,
      schedulingStrategy: this.schedulingStrategy
    };
  }
  
  /**
   * 关闭进程池
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    
    // 停止维护任务
    this.stopMaintenanceTasks();
    
    // 销毁所有工作进程
    const destroyPromises = Array.from(this.workers.keys()).map(workerId => 
      this.destroyWorker(workerId)
    );
    
    await Promise.all(destroyPromises);
    
    this.emit('shutdown');
  }
  
  // 抽象方法 - 子类必须实现
  
  /**
   * 创建工作进程
   * @returns {Promise<object>} 工作进程
   */
  async createWorker() {
    const workerId = `worker_${++this.workerCounter}_${Date.now()}`;
    const worker = await this.doCreateWorker(workerId);
    
    this.workers.set(workerId, worker);
    this.availableWorkers.push(worker);
    this.lastActivity.set(workerId, Date.now());
    this.stats.totalCreated++;
    
    this.emit('workerCreated', { workerId });
    return worker;
  }
  
  /**
   * 检查进程健康状态
   * @param {object} worker - 工作进程
   * @returns {Promise<boolean>} 是否健康
   */
  async isWorkerHealthy(worker) {
    throw new Error('isWorkerHealthy must be implemented by subclass');
  }
  
  /**
   * 具体的工作进程创建逻辑
   * @param {string} workerId - 工作进程ID
   * @returns {Promise<object>} 工作进程
   */
  async doCreateWorker(workerId) {
    throw new Error('doCreateWorker must be implemented by subclass');
  }
  
  /**
   * 具体的工作进程销毁逻辑
   * @param {object} worker - 工作进程
   * @returns {Promise<void>}
   */
  async doDestroyWorker(worker) {
    throw new Error('doDestroyWorker must be implemented by subclass');
  }
}

export {
  BaseProcessPool
};

