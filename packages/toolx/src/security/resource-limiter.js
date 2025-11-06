/**
 * 资源限制器 - 控制沙箱资源使用
 * 防止资源耗尽攻击，确保系统稳定性
 */

class ResourceLimiter {
  constructor(limitsConfig) {
    this.maxMemory = this.parseMemory(limitsConfig.maxMemory || '512MB');
    this.maxCPU = this.parseCPU(limitsConfig.maxCPU || '50%');
    this.maxExecutionTime = limitsConfig.maxExecutionTime || 30000;
    this.maxFileSize = this.parseMemory(limitsConfig.maxFileSize || '10MB');
    this.maxNetworkRequests = limitsConfig.maxNetworkRequests || 10;
    this.maxProcesses = limitsConfig.maxProcesses || 5;
    
    // 资源使用跟踪
    this.resources = new Map();
    this.globalStats = {
      totalMemoryUsed: 0,
      totalCPUUsed: 0,
      activeProcesses: 0,
      networkRequests: 0
    };
  }
  
  /**
   * 解析内存大小
   * @param {string} memoryStr - 内存字符串
   * @returns {number} 字节数
   */
  parseMemory(memoryStr) {
    const units = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };
    
    const match = memoryStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) {
      throw new Error(`Invalid memory format: ${memoryStr}. Use format like '512MB', '2GB', etc.`);
    }
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    return Math.floor(value * units[unit]);
  }
  
  /**
   * 解析CPU限制
   * @param {string} cpuStr - CPU字符串
   * @returns {number} CPU核心数
   */
  parseCPU(cpuStr) {
    const match = cpuStr.match(/^(\d+(?:\.\d+)?)\s*%?$/);
    if (!match) {
      throw new Error(`Invalid CPU format: ${cpuStr}. Use format like '50%' or '2'`);
    }
    
    const value = parseFloat(match[1]);
    
    // 如果是百分比，转换为核心数（假设系统有4个核心）
    if (cpuStr.includes('%')) {
      return (value / 100) * this.getCPUCores();
    }
    
    return value;
  }
  
  /**
   * 获取CPU核心数
   * @returns {number} CPU核心数
   */
  getCPUCores() {
    try {
      const os = require('os');
      return os.cpus().length;
    } catch (error) {
      // 默认假设4个核心
      return 4;
    }
  }
  
  /**
   * 创建资源跟踪器
   * @param {string} resourceId - 资源ID
   * @returns {ResourceTracker} 资源跟踪器
   */
  createResourceTracker(resourceId) {
    if (this.resources.has(resourceId)) {
      throw new Error(`Resource tracker for '${resourceId}' already exists`);
    }
    
    const tracker = new ResourceTracker(resourceId, this);
    this.resources.set(resourceId, tracker);
    this.globalStats.activeProcesses++;
    
    return tracker;
  }
  
  /**
   * 获取资源跟踪器
   * @param {string} resourceId - 资源ID
   * @returns {ResourceTracker|null} 资源跟踪器
   */
  getResourceTracker(resourceId) {
    return this.resources.get(resourceId) || null;
  }
  
  /**
   * 销毁资源跟踪器
   * @param {string} resourceId - 资源ID
   */
  destroyResourceTracker(resourceId) {
    const tracker = this.resources.get(resourceId);
    if (tracker) {
      tracker.cleanup();
      this.resources.delete(resourceId);
      this.globalStats.activeProcesses--;
    }
  }
  
  /**
   * 检查全局资源限制
   * @returns {boolean} 是否超限
   */
  checkGlobalLimits() {
    return this.globalStats.activeProcesses <= this.maxProcesses;
  }
  
  /**
   * 创建超时定时器
   * @param {Function} callback - 超时回调
   * @param {number} [timeout] - 自定义超时时间
   * @returns {NodeJS.Timeout} 定时器
   */
  createTimeout(callback, timeout = this.maxExecutionTime) {
    return setTimeout(callback, timeout);
  }
  
  /**
   * 创建内存监控器
   * @param {string} resourceId - 资源ID
   * @param {number} interval - 检查间隔
   * @returns {NodeJS.Interval} 监控器
   */
  createMemoryMonitor(resourceId, interval = 5000) {
    const tracker = this.getResourceTracker(resourceId);
    if (!tracker) {
      throw new Error(`Resource tracker '${resourceId}' not found`);
    }
    
    return setInterval(() => {
      const memoryUsage = tracker.getMemoryUsage();
      if (memoryUsage > this.maxMemory) {
        throw new ResourceLimitError(`Memory limit exceeded: ${memoryUsage} > ${this.maxMemory}`);
      }
    }, interval);
  }
  
  /**
   * 获取全局统计信息
   * @returns {object} 全局统计
   */
  getGlobalStats() {
    return {
      ...this.globalStats,
      limits: {
        maxMemory: this.maxMemory,
        maxCPU: this.maxCPU,
        maxExecutionTime: this.maxExecutionTime,
        maxFileSize: this.maxFileSize,
        maxNetworkRequests: this.maxNetworkRequests,
        maxProcesses: this.maxProcesses
      },
      activeTrackers: this.resources.size
    };
  }
  
  /**
   * 清理所有资源跟踪器
   */
  cleanup() {
    for (const [resourceId, tracker] of this.resources) {
      tracker.cleanup();
    }
    this.resources.clear();
    this.globalStats.activeProcesses = 0;
  }
}

/**
 * 资源跟踪器类
 */
class ResourceTracker {
  constructor(resourceId, limiter) {
    this.resourceId = resourceId;
    this.limiter = limiter;
    this.startTime = Date.now();
    this.memoryUsage = 0;
    this.cpuUsage = 0;
    this.networkRequests = 0;
    this.filesCreated = [];
    this.timers = [];
    this.monitors = [];
  }
  
  /**
   * 记录内存使用
   * @param {number} bytes - 使用的字节数
   */
  recordMemoryUsage(bytes) {
    this.memoryUsage = bytes;
    this.limiter.globalStats.totalMemoryUsed += bytes;
    
    if (bytes > this.limiter.maxMemory) {
      throw new ResourceLimitError(`Memory limit exceeded: ${bytes} > ${this.limiter.maxMemory}`);
    }
  }
  
  /**
   * 记录CPU使用
   * @param {number} cores - 使用的核心数
   */
  recordCPUUsage(cores) {
    this.cpuUsage = cores;
    this.limiter.globalStats.totalCPUUsed += cores;
    
    if (cores > this.limiter.maxCPU) {
      throw new ResourceLimitError(`CPU limit exceeded: ${cores} > ${this.limiter.maxCPU}`);
    }
  }
  
  /**
   * 记录网络请求
   * @param {string} url - 请求URL
   */
  recordNetworkRequest(url) {
    this.networkRequests++;
    this.limiter.globalStats.networkRequests++;
    
    if (this.networkRequests > this.limiter.maxNetworkRequests) {
      throw new ResourceLimitError(`Network request limit exceeded: ${this.networkRequests} > ${this.limiter.maxNetworkRequests}`);
    }
  }
  
  /**
   * 记录文件创建
   * @param {string} filePath - 文件路径
   * @param {number} size - 文件大小
   */
  recordFileCreation(filePath, size) {
    this.filesCreated.push({ path: filePath, size, createdAt: Date.now() });
    
    if (size > this.limiter.maxFileSize) {
      throw new ResourceLimitError(`File size limit exceeded: ${size} > ${this.limiter.maxFileSize}`);
    }
  }
  
  /**
   * 添加定时器
   * @param {NodeJS.Timeout} timer - 定时器
   */
  addTimer(timer) {
    this.timers.push(timer);
  }
  
  /**
   * 添加监控器
   * @param {NodeJS.Interval} monitor - 监控器
   */
  addMonitor(monitor) {
    this.monitors.push(monitor);
  }
  
  /**
   * 获取内存使用情况
   * @returns {number} 内存使用量（字节）
   */
  getMemoryUsage() {
    return this.memoryUsage;
  }
  
  /**
   * 获取CPU使用情况
   * @returns {number} CPU使用量（核心数）
   */
  getCPUUsage() {
    return this.cpuUsage;
  }
  
  /**
   * 获取运行时间
   * @returns {number} 运行时间（毫秒）
   */
  getRuntime() {
    return Date.now() - this.startTime;
  }
  
  /**
   * 检查执行时间限制
   */
  checkExecutionTime() {
    const runtime = this.getRuntime();
    if (runtime > this.limiter.maxExecutionTime) {
      throw new ResourceLimitError(`Execution time limit exceeded: ${runtime}ms > ${this.limiter.maxExecutionTime}ms`);
    }
  }
  
  /**
   * 获取资源使用统计
   * @returns {object} 资源统计
   */
  getResourceStats() {
    return {
      resourceId: this.resourceId,
      memoryUsage: this.memoryUsage,
      cpuUsage: this.cpuUsage,
      networkRequests: this.networkRequests,
      filesCreated: this.filesCreated.length,
      runtime: this.getRuntime(),
      startTime: this.startTime
    };
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    // 清理定时器
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];
    
    // 清理监控器
    this.monitors.forEach(monitor => clearInterval(monitor));
    this.monitors = [];
    
    // 更新全局统计
    this.limiter.globalStats.totalMemoryUsed -= this.memoryUsage;
    this.limiter.globalStats.totalCPUUsed -= this.cpuUsage;
    this.limiter.globalStats.networkRequests -= this.networkRequests;
    
    // 重置本地统计
    this.memoryUsage = 0;
    this.cpuUsage = 0;
    this.networkRequests = 0;
    this.filesCreated = [];
  }
}

/**
 * 资源限制错误类
 */
class ResourceLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResourceLimitError';
    this.code = 'RESOURCE_LIMIT_EXCEEDED';
  }
}

export {
  ResourceLimiter,
  ResourceTracker
};