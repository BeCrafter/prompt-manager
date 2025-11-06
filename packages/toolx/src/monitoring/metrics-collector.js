/**
 * 指标收集器 - 收集和分析系统性能指标
 * 提供实时监控和历史数据分析功能
 */

import EventEmitter from 'events';

class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.retentionPeriod = options.retentionPeriod || 86400000; // 24小时
    this.maxDataPoints = options.maxDataPoints || 1000;
    this.enabled = options.enabled !== false;
    
    // 指标存储
    this.metrics = new Map();
    this.timeSeries = new Map();
    this.startTime = Date.now();
    
    // 性能统计
    this.stats = {
      totalOperations: 0,
      totalErrors: 0,
      totalDuration: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      peakCPUUsage: 0
    };
    
    // 启动清理任务
    this.startCleanupTask();
  }
  
  /**
   * 记录执行时间
   * @param {string} operation - 操作名称
   * @param {number} duration - 执行时间
   * @param {object} metadata - 元数据
   */
  recordExecutionTime(operation, duration, metadata = {}) {
    if (!this.enabled) return;
    
    const timestamp = Date.now();
    
    // 更新操作指标
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        errors: 0,
        lastExecution: timestamp
      });
    }
    
    const metric = this.metrics.get(operation);
    metric.count++;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.count;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    metric.lastExecution = timestamp;
    
    // 更新全局统计
    this.stats.totalOperations++;
    this.stats.totalDuration += duration;
    this.stats.averageResponseTime = this.stats.totalDuration / this.stats.totalOperations;
    
    // 记录时间序列数据
    this.recordTimeSeries(operation, 'duration', duration, timestamp, metadata);
    
    // 发出事件
    this.emit('executionTime', { operation, duration, timestamp, metadata });
  }
  
  /**
   * 记录错误
   * @param {string} operation - 操作名称
   * @param {Error} error - 错误对象
   * @param {object} metadata - 元数据
   */
  recordError(operation, error, metadata = {}) {
    if (!this.enabled) return;
    
    const timestamp = Date.now();
    
    // 更新操作错误统计
    if (this.metrics.has(operation)) {
      this.metrics.get(operation).errors++;
    }
    
    // 更新全局错误统计
    this.stats.totalErrors++;
    
    // 记录错误详情
    const errorKey = `${operation}_errors`;
    if (!this.metrics.has(errorKey)) {
      this.metrics.set(errorKey, {
        count: 0,
        errors: []
      });
    }
    
    const errorMetric = this.metrics.get(errorKey);
    errorMetric.count++;
    errorMetric.errors.push({
      timestamp,
      message: error.message,
      stack: error.stack,
      code: error.code,
      metadata
    });
    
    // 限制错误详情数量
    if (errorMetric.errors.length > 100) {
      errorMetric.errors = errorMetric.errors.slice(-100);
    }
    
    // 记录时间序列数据
    this.recordTimeSeries(operation, 'error', 1, timestamp, { error: error.message });
    
    // 发出事件
    this.emit('error', { operation, error, timestamp, metadata });
  }
  
  /**
   * 记录资源使用
   * @param {string} resourceType - 资源类型
   * @param {number} value - 使用量
   * @param {object} metadata - 元数据
   */
  recordResourceUsage(resourceType, value, metadata = {}) {
    if (!this.enabled) return;
    
    const timestamp = Date.now();
    
    // 更新峰值统计
    if (resourceType === 'memory') {
      this.stats.peakMemoryUsage = Math.max(this.stats.peakMemoryUsage, value);
    } else if (resourceType === 'cpu') {
      this.stats.peakCPUUsage = Math.max(this.stats.peakCPUUsage, value);
    }
    
    // 记录时间序列数据
    this.recordTimeSeries(resourceType, 'usage', value, timestamp, metadata);
    
    // 发出事件
    this.emit('resourceUsage', { resourceType, value, timestamp, metadata });
  }
  
  /**
   * 记录自定义指标
   * @param {string} metricName - 指标名称
   * @param {number} value - 指标值
   * @param {object} metadata - 元数据
   */
  recordCustomMetric(metricName, value, metadata = {}) {
    if (!this.enabled) return;
    
    const timestamp = Date.now();
    
    // 记录时间序列数据
    this.recordTimeSeries(metricName, 'custom', value, timestamp, metadata);
    
    // 发出事件
    this.emit('customMetric', { metricName, value, timestamp, metadata });
  }
  
  /**
   * 记录时间序列数据
   * @param {string} category - 分类
   * @param {string} type - 类型
   * @param {number} value - 值
   * @param {number} timestamp - 时间戳
   * @param {object} metadata - 元数据
   */
  recordTimeSeries(category, type, value, timestamp, metadata) {
    const key = `${category}_${type}`;
    
    if (!this.timeSeries.has(key)) {
      this.timeSeries.set(key, []);
    }
    
    const series = this.timeSeries.get(key);
    series.push({
      timestamp,
      value,
      metadata
    });
    
    // 限制数据点数量
    if (series.length > this.maxDataPoints) {
      series.splice(0, series.length - this.maxDataPoints);
    }
  }
  
  /**
   * 获取操作指标
   * @param {string} operation - 操作名称
   * @returns {object|null} 操作指标
   */
  getOperationMetrics(operation) {
    return this.metrics.get(operation) || null;
  }
  
  /**
   * 获取时间序列数据
   * @param {string} category - 分类
   * @param {string} type - 类型
   * @param {number} [startTime] - 开始时间
   * @param {number} [endTime] - 结束时间
   * @returns {Array} 时间序列数据
   */
  getTimeSeries(category, type, startTime, endTime) {
    const key = `${category}_${type}`;
    const series = this.timeSeries.get(key) || [];
    
    if (!startTime && !endTime) {
      return series;
    }
    
    return series.filter(point => {
      if (startTime && point.timestamp < startTime) return false;
      if (endTime && point.timestamp > endTime) return false;
      return true;
    });
  }
  
  /**
   * 获取聚合指标
   * @param {string} operation - 操作名称
   * @param {string} metric - 指标类型
   * @param {number} [period] - 聚合周期（毫秒）
   * @returns {object} 聚合指标
   */
  getAggregatedMetrics(operation, metric, period = 3600000) { // 默认1小时
    const series = this.getTimeSeries(operation, metric);
    if (series.length === 0) {
      return null;
    }
    
    const now = Date.now();
    const periodStart = Math.floor(now / period) * period;
    
    const periodData = series.filter(point => 
      point.timestamp >= periodStart && point.timestamp < periodStart + period
    );
    
    if (periodData.length === 0) {
      return null;
    }
    
    const values = periodData.map(point => point.value);
    return {
      period,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      sum: values.reduce((sum, val) => sum + val, 0),
      timestamp: periodStart
    };
  }
  
  /**
   * 获取系统概览
   * @returns {object} 系统概览
   */
  getSystemOverview() {
    const uptime = Date.now() - this.startTime;
    const errorRate = this.stats.totalOperations > 0 
      ? (this.stats.totalErrors / this.stats.totalOperations) * 100 
      : 0;
    
    return {
      uptime,
      totalOperations: this.stats.totalOperations,
      totalErrors: this.stats.totalErrors,
      errorRate: Math.round(errorRate * 100) / 100,
      averageResponseTime: Math.round(this.stats.averageResponseTime * 100) / 100,
      peakMemoryUsage: this.stats.peakMemoryUsage,
      peakCPUUsage: this.stats.peakCPUUsage,
      activeOperations: this.metrics.size,
      timeSeriesCount: this.timeSeries.size
    };
  }
  
  /**
   * 获取详细报告
   * @returns {object} 详细报告
   */
  getDetailedReport() {
    const report = {
      overview: this.getSystemOverview(),
      operations: {},
      errors: {},
      resources: {},
      custom: {}
    };
    
    // 收集操作指标
    for (const [operation, metric] of this.metrics) {
      if (operation.endsWith('_errors')) {
        report.errors[operation.replace('_errors', '')] = metric;
      } else {
        report.operations[operation] = metric;
      }
    }
    
    // 收集资源指标
    ['memory', 'cpu', 'network', 'disk'].forEach(resource => {
      const usageSeries = this.getTimeSeries(resource, 'usage');
      if (usageSeries.length > 0) {
        const values = usageSeries.map(point => point.value);
        report.resources[resource] = {
          current: values[values.length - 1],
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, val) => sum + val, 0) / values.length
        };
      }
    });
    
    return report;
  }
  
  /**
   * 检查性能阈值
   * @param {object} thresholds - 阈值配置
   * @returns {object} 阈值检查结果
   */
  checkThresholds(thresholds) {
    const alerts = [];
    const overview = this.getSystemOverview();
    
    // 检查错误率阈值
    if (thresholds.errorRate && overview.errorRate > thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        current: overview.errorRate,
        threshold: thresholds.errorRate,
        severity: 'high'
      });
    }
    
    // 检查响应时间阈值
    if (thresholds.responseTime && overview.averageResponseTime > thresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        current: overview.averageResponseTime,
        threshold: thresholds.responseTime,
        severity: 'medium'
      });
    }
    
    // 检查内存使用阈值
    if (thresholds.memoryUsage && overview.peakMemoryUsage > thresholds.memoryUsage) {
      alerts.push({
        type: 'memory_usage',
        current: overview.peakMemoryUsage,
        threshold: thresholds.memoryUsage,
        severity: 'medium'
      });
    }
    
    // 检查CPU使用阈值
    if (thresholds.cpuUsage && overview.peakCPUUsage > thresholds.cpuUsage) {
      alerts.push({
        type: 'cpu_usage',
        current: overview.peakCPUUsage,
        threshold: thresholds.cpuUsage,
        severity: 'high'
      });
    }
    
    return {
      alerts,
      alertCount: alerts.length,
      timestamp: Date.now()
    };
  }
  
  /**
   * 导出指标数据
   * @param {string} format - 导出格式 ('json' | 'csv')
   * @returns {string} 导出的数据
   */
  exportMetrics(format = 'json') {
    const report = this.getDetailedReport();
    
    if (format === 'csv') {
      return this.convertToCSV(report);
    }
    
    return JSON.stringify(report, null, 2);
  }
  
  /**
   * 转换为CSV格式
   * @param {object} data - 数据对象
   * @returns {string} CSV字符串
   */
  convertToCSV(data) {
    const lines = [];
    
    // 概览数据
    lines.push('Overview');
    lines.push('Metric,Value');
    Object.entries(data.overview).forEach(([key, value]) => {
      lines.push(`${key},${value}`);
    });
    
    // 操作数据
    lines.push('\nOperations');
    lines.push('Operation,Count,AvgTime,MinTime,MaxTime,Errors');
    Object.entries(data.operations).forEach(([operation, metric]) => {
      lines.push(`${operation},${metric.count},${metric.avgTime},${metric.minTime},${metric.maxTime},${metric.errors || 0}`);
    });
    
    return lines.join('\n');
  }
  
  /**
   * 清理过期数据
   */
  cleanup() {
    const cutoffTime = Date.now() - this.retentionPeriod;
    let cleanedCount = 0;
    
    // 清理时间序列数据
    for (const [key, series] of this.timeSeries) {
      const originalLength = series.length;
      const filtered = series.filter(point => point.timestamp > cutoffTime);
      
      if (filtered.length !== originalLength) {
        this.timeSeries.set(key, filtered);
        cleanedCount += originalLength - filtered.length;
      }
    }
    
    // 清理错误详情
    for (const [key, metric] of this.metrics) {
      if (key.endsWith('_errors') && metric.errors) {
        const originalLength = metric.errors.length;
        metric.errors = metric.errors.filter(error => error.timestamp > cutoffTime);
        cleanedCount += originalLength - metric.errors.length;
      }
    }
    
    if (cleanedCount > 0) {
      this.emit('cleanup', { cleanedCount, cutoffTime });
    }
  }
  
  /**
   * 启动清理任务
   */
  startCleanupTask() {
    // 每小时清理一次过期数据
    const interval = setInterval(() => {
      this.cleanup();
    }, 3600000);
    
    // 不阻止事件循环退出
    if (interval.unref) {
      interval.unref();
    }
  }
  
  /**
   * 重置所有指标
   */
  reset() {
    this.metrics.clear();
    this.timeSeries.clear();
    this.stats = {
      totalOperations: 0,
      totalErrors: 0,
      totalDuration: 0,
      averageResponseTime: 0,
      peakMemoryUsage: 0,
      peakCPUUsage: 0
    };
    this.startTime = Date.now();
    
    this.emit('reset');
  }
  
  setEnabled(enabled) {
    this.enabled = enabled;
    this.emit('enabledChanged', { enabled });
  }
}

export {
  MetricsCollector
};


