/**
 * 监控模块测试用例
 * 验证指标收集和性能监控功能
 */

const assert = require('assert');
const { MetricsCollector } = require('../src/monitoring/metrics-collector');

describe('监控模块测试', () => {
  let metricsCollector;
  
  beforeEach(() => {
    metricsCollector = new MetricsCollector({
      retentionPeriod: 1000, // 1秒用于测试
      maxDataPoints: 10,
      enabled: true
    });
  });
  
  afterEach(() => {
    metricsCollector.removeAllListeners();
  });
  
  describe('指标收集', () => {
    it('应该成功记录执行时间', () => {
      metricsCollector.recordExecutionTime('test-operation', 100);
      
      const metrics = metricsCollector.getOperationMetrics('test-operation');
      assert.ok(metrics);
      assert.strictEqual(metrics.count, 1);
      assert.strictEqual(metrics.totalTime, 100);
      assert.strictEqual(metrics.avgTime, 100);
      assert.strictEqual(metrics.minTime, 100);
      assert.strictEqual(metrics.maxTime, 100);
    });
    
    it('应该正确计算平均时间', () => {
      metricsCollector.recordExecutionTime('test-operation', 100);
      metricsCollector.recordExecutionTime('test-operation', 200);
      metricsCollector.recordExecutionTime('test-operation', 300);
      
      const metrics = metricsCollector.getOperationMetrics('test-operation');
      assert.strictEqual(metrics.count, 3);
      assert.strictEqual(metrics.totalTime, 600);
      assert.strictEqual(metrics.avgTime, 200);
      assert.strictEqual(metrics.minTime, 100);
      assert.strictEqual(metrics.maxTime, 300);
    });
    
    it('应该成功记录错误', () => {
      const error = new Error('Test error');
      metricsCollector.recordError('test-operation', error);
      
      const errorMetrics = metricsCollector.getOperationMetrics('test-operation_errors');
      assert.ok(errorMetrics);
      assert.strictEqual(errorMetrics.count, 1);
      assert.strictEqual(errorMetrics.errors.length, 1);
      assert.strictEqual(errorMetrics.errors[0].message, 'Test error');
    });
    
    it('应该成功记录资源使用', () => {
      let eventEmitted = false;
      metricsCollector.on('resourceUsage', () => {
        eventEmitted = true;
      });
      
      metricsCollector.recordResourceUsage('memory', 1024 * 1024 * 100); // 100MB
      
      assert.ok(eventEmitted);
      
      // 验证峰值统计
      const overview = metricsCollector.getSystemOverview();
      assert.strictEqual(overview.peakMemoryUsage, 1024 * 1024 * 100);
    });
    
    it('应该成功记录自定义指标', () => {
      let eventEmitted = false;
      metricsCollector.on('customMetric', () => {
        eventEmitted = true;
      });
      
      metricsCollector.recordCustomMetric('custom-metric', 42);
      
      assert.ok(eventEmitted);
    });
  });
  
  describe('时间序列数据', () => {
    it('应该正确存储时间序列数据', () => {
      const startTime = Date.now();
      metricsCollector.recordTimeSeries('test', 'duration', 100, startTime);
      metricsCollector.recordTimeSeries('test', 'duration', 200, startTime + 1000);
      
      const series = metricsCollector.getTimeSeries('test', 'duration');
      assert.strictEqual(series.length, 2);
      assert.strictEqual(series[0].value, 100);
      assert.strictEqual(series[1].value, 200);
    });
    
    it('应该限制数据点数量', () => {
      // 记录超过限制的数据点
      for (let i = 0; i < 15; i++) {
        metricsCollector.recordTimeSeries('test', 'value', i, Date.now() + i);
      }
      
      const series = metricsCollector.getTimeSeries('test', 'value');
      assert.strictEqual(series.length, 10); // 应该只保留最新的10个
      assert.strictEqual(series[0].value, 5); // 第一个应该是第6个数据点
    });
    
    it('应该支持时间范围查询', () => {
      const now = Date.now();
      metricsCollector.recordTimeSeries('test', 'value', 1, now - 2000);
      metricsCollector.recordTimeSeries('test', 'value', 2, now - 1000);
      metricsCollector.recordTimeSeries('test', 'value', 3, now);
      
      const series = metricsCollector.getTimeSeries('test', 'value', now - 1500, now - 500);
      assert.strictEqual(series.length, 1);
      assert.strictEqual(series[0].value, 2);
    });
  });
  
  describe('聚合指标', () => {
    it('应该计算聚合指标', () => {
      const now = Date.now();
      const period = 3600000; // 1小时
      const periodStart = Math.floor(now / period) * period;
      
      // 记录同一周期内的数据
      metricsCollector.recordTimeSeries('test-op', 'duration', 100, periodStart + 100);
      metricsCollector.recordTimeSeries('test-op', 'duration', 200, periodStart + 200);
      metricsCollector.recordTimeSeries('test-op', 'duration', 300, periodStart + 300);
      
      const aggregated = metricsCollector.getAggregatedMetrics('test-op', 'duration', period);
      assert.ok(aggregated);
      assert.strictEqual(aggregated.count, 3);
      assert.strictEqual(aggregated.min, 100);
      assert.strictEqual(aggregated.max, 300);
      assert.strictEqual(aggregated.avg, 200);
      assert.strictEqual(aggregated.sum, 600);
    });
    
    it('应该处理没有数据的聚合', () => {
      const aggregated = metricsCollector.getAggregatedMetrics('nonexistent', 'duration');
      assert.strictEqual(aggregated, null);
    });
  });
  
  describe('系统概览', () => {
    it('应该提供正确的系统概览', () => {
      // 记录一些操作和错误
      metricsCollector.recordExecutionTime('op1', 100);
      metricsCollector.recordExecutionTime('op1', 200);
      metricsCollector.recordExecutionTime('op2', 150);
      metricsCollector.recordError('op1', new Error('Test error'));
      
      const overview = metricsCollector.getSystemOverview();
      
      assert.ok(overview.uptime > 0);
      assert.strictEqual(overview.totalOperations, 3);
      assert.strictEqual(overview.totalErrors, 1);
      assert.strictEqual(overview.errorRate, 33.33);
      assert.strictEqual(overview.averageResponseTime, 150);
      assert.strictEqual(overview.activeOperations, 2);
      assert.strictEqual(overview.timeSeriesCount, 3); // op1, op2, op1_errors
    });
    
    it('应该处理空的系统概览', () => {
      const overview = metricsCollector.getSystemOverview();
      
      assert.ok(overview.uptime >= 0);
      assert.strictEqual(overview.totalOperations, 0);
      assert.strictEqual(overview.totalErrors, 0);
      assert.strictEqual(overview.errorRate, 0);
      assert.strictEqual(overview.averageResponseTime, 0);
    });
  });
  
  describe('详细报告', () => {
    it('应该生成详细的报告', () => {
      // 记录测试数据
      metricsCollector.recordExecutionTime('test-op', 100, { category: 'test' });
      metricsCollector.recordError('test-op', new Error('Test error'), { severity: 'low' });
      metricsCollector.recordResourceUsage('memory', 1024 * 1024 * 50);
      
      const report = metricsCollector.getDetailedReport();
      
      assert.ok(report.overview);
      assert.ok(report.operations);
      assert.ok(report.errors);
      assert.ok(report.resources);
      
      // 验证操作指标
      assert.ok(report.operations['test-op']);
      assert.strictEqual(report.operations['test-op'].count, 1);
      assert.strictEqual(report.operations['test-op'].errors, 1);
      
      // 验证错误指标
      assert.ok(report.errors['test-op']);
      assert.strictEqual(report.errors['test-op'].count, 1);
      
      // 验证资源指标
      assert.ok(report.resources.memory);
    });
  });
  
  describe('阈值检查', () => {
    it('应该正确检查阈值', () => {
      // 记录高错误率的数据
      metricsCollector.recordExecutionTime('op1', 100);
      metricsCollector.recordError('op1', new Error('Error 1'));
      metricsCollector.recordError('op1', new Error('Error 2'));
      
      const thresholds = {
        errorRate: 50, // 50%错误率阈值
        responseTime: 200,
        memoryUsage: 1024 * 1024 * 100,
        cpuUsage: 80
      };
      
      const result = metricsCollector.checkThresholds(thresholds);
      
      assert.ok(result.alerts.length > 0);
      assert.ok(result.alertCount > 0);
      
      // 验证警报类型
      const errorRateAlert = result.alerts.find(alert => alert.type === 'error_rate');
      assert.ok(errorRateAlert);
      assert.strictEqual(errorRateAlert.severity, 'high');
    });
    
    it('应该处理没有警报的情况', () => {
      metricsCollector.recordExecutionTime('op1', 100);
      
      const thresholds = {
        errorRate: 10, // 10%错误率阈值
        responseTime: 200
      };
      
      const result = metricsCollector.checkThresholds(thresholds);
      
      assert.strictEqual(result.alerts.length, 0);
      assert.strictEqual(result.alertCount, 0);
    });
  });
  
  describe('数据导出', () => {
    beforeEach(() => {
      metricsCollector.recordExecutionTime('test-op', 100);
      metricsCollector.recordError('test-op', new Error('Test error'));
    });
    
    it('应该支持JSON导出', () => {
      const json = metricsCollector.exportMetrics('json');
      const parsed = JSON.parse(json);
      
      assert.ok(parsed.overview);
      assert.ok(parsed.operations);
      assert.ok(parsed.errors);
    });
    
    it('应该支持CSV导出', () => {
      const csv = metricsCollector.exportMetrics('csv');
      
      assert.ok(csv.includes('Overview'));
      assert.ok(csv.includes('Operations'));
      assert.ok(csv.includes('test-op'));
    });
    
    it('应该默认使用JSON格式', () => {
      const json = metricsCollector.exportMetrics();
      const parsed = JSON.parse(json);
      
      assert.ok(parsed);
    });
  });
  
  describe('数据清理', () => {
    it('应该清理过期数据', () => {
      const oldTime = Date.now() - 2000; // 2秒前
      const newTime = Date.now();
      
      // 记录过期和新鲜的数据
      metricsCollector.recordTimeSeries('test', 'value', 1, oldTime);
      metricsCollector.recordTimeSeries('test', 'value', 2, newTime);
      
      // 设置短的保留期并清理
      metricsCollector.retentionPeriod = 1000; // 1秒
      metricsCollector.cleanup();
      
      const series = metricsCollector.getTimeSeries('test', 'value');
      assert.strictEqual(series.length, 1);
      assert.strictEqual(series[0].value, 2); // 应该只保留新鲜的数据
    });
    
    it('应该清理错误详情', () => {
      const oldTime = Date.now() - 2000;
      const newTime = Date.now();
      
      // 记录过期和新鲜的错误
      metricsCollector.recordError('op1', new Error('Old error'), { timestamp: oldTime });
      metricsCollector.recordError('op1', new Error('New error'), { timestamp: newTime });
      
      metricsCollector.retentionPeriod = 1000;
      metricsCollector.cleanup();
      
      const errorMetrics = metricsCollector.getOperationMetrics('op1_errors');
      assert.strictEqual(errorMetrics.errors.length, 1);
      assert.strictEqual(errorMetrics.errors[0].message, 'New error');
    });
  });
  
  describe('配置和控制', () => {
    it('应该支持启用/禁用指标收集', () => {
      metricsCollector.setEnabled(false);
      
      // 禁用后不应该记录指标
      metricsCollector.recordExecutionTime('test-op', 100);
      const metrics = metricsCollector.getOperationMetrics('test-op');
      assert.strictEqual(metrics, null);
      
      // 重新启用
      metricsCollector.setEnabled(true);
      metricsCollector.recordExecutionTime('test-op', 100);
      const newMetrics = metricsCollector.getOperationMetrics('test-op');
      assert.ok(newMetrics);
    });
    
    it('应该支持重置所有指标', () => {
      metricsCollector.recordExecutionTime('op1', 100);
      metricsCollector.recordExecutionTime('op2', 200);
      
      assert.strictEqual(metricsCollector.metrics.size, 2);
      
      metricsCollector.reset();
      
      assert.strictEqual(metricsCollector.metrics.size, 0);
      assert.strictEqual(metricsCollector.timeSeries.size, 0);
      
      const overview = metricsCollector.getSystemOverview();
      assert.strictEqual(overview.totalOperations, 0);
      assert.strictEqual(overview.totalErrors, 0);
    });
  });
  
  describe('事件处理', () => {
    it('应该正确发出事件', () => {
      const events = [];
      
      metricsCollector.on('executionTime', (data) => events.push({ type: 'executionTime', data }));
      metricsCollector.on('error', (data) => events.push({ type: 'error', data }));
      metricsCollector.on('resourceUsage', (data) => events.push({ type: 'resourceUsage', data }));
      metricsCollector.on('customMetric', (data) => events.push({ type: 'customMetric', data }));
      
      metricsCollector.recordExecutionTime('test-op', 100);
      metricsCollector.recordError('test-op', new Error('Test error'));
      metricsCollector.recordResourceUsage('memory', 1024 * 1024 * 50);
      metricsCollector.recordCustomMetric('custom-value', 42);
      
      assert.strictEqual(events.length, 4);
      assert.strictEqual(events[0].type, 'executionTime');
      assert.strictEqual(events[1].type, 'error');
      assert.strictEqual(events[2].type, 'resourceUsage');
      assert.strictEqual(events[3].type, 'customMetric');
    });
    
    it('应该在清理时发出事件', (done) => {
      metricsCollector.on('cleanup', (data) => {
        assert.ok(data.cleanedCount >= 0);
        assert.ok(data.cutoffTime > 0);
        done();
      });
      
      // 手动触发清理
      metricsCollector.cleanup();
    });
    
    it('应该在重置时发出事件', (done) => {
      metricsCollector.on('reset', () => {
        done();
      });
      
      metricsCollector.reset();
    });
  });
});