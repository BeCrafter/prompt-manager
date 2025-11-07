/**
 * ToolX 沙箱工具库 - 主入口文件
 * 
 * 提供统一的API接口来使用ToolX的所有功能
 */

import { ToolInitializer } from './src/core/tool-initializer.js';
import { manager as toolManager } from './src/core/tool-manager.js';
import { loader as configLoader } from './src/core/config-loader.js';
import { validator as configValidator } from './src/core/config-validator.js';
import { registry } from './src/core/registry.js';
import { MetricsCollector } from './src/monitoring/metrics-collector.js';
import { SecurityPolicyValidator } from './src/security/policy-validator.js';
import { ResourceLimiter } from './src/security/resource-limiter.js';

// 初始化工具生态系统
ToolInitializer.initialize();

class ToolX {
  constructor() {
    this.toolManager = toolManager;
    this.configLoader = configLoader;
    this.configValidator = configValidator;
    this.adapterRegistry = registry;
    this.metricsCollector = new MetricsCollector({ enabled: true });
    this.securityValidator = null;
    this.resourceLimiter = null;
  }

  /**
   * 设置配置目录
   * @param {string} configDir - 配置目录路径
   */
  setConfigDirectory(configDir) {
    this.configLoader.setConfigDirectory(configDir);
  }

  /**
   * 设置工具目录
   * @param {string} toolsDir - 工具目录路径
   */
  setToolsDirectory(toolsDir) {
    this.toolManager.setToolsDirectory(toolsDir);
  }

  /**
   * 加载场景配置
   * @param {string} scenarioName - 场景名称
   * @returns {Promise<object>} 配置对象
   */
  async loadConfig(scenarioName) {
    return await this.configLoader.loadScenario(scenarioName);
  }

  /**
   * 发现所有可用工具
   * @returns {Promise<Array>} 工具信息列表
   */
  async discoverTools() {
    return await this.toolManager.discoverTools();
  }

  /**
   * 获取工具列表
   * @returns {Promise<Array>} 工具列表
   */
  async getToolList() {
    return await this.toolManager.getToolList();
  }

  /**
   * 执行工具
   * @param {string} toolName - 工具名称
   * @param {string} adapterName - 适配器名称
   * @param {object} adapterConfig - 适配器配置
   * @param {object} params - 执行参数
   * @returns {Promise<any>} 执行结果
   */
  async executeTool(toolName, adapterName, adapterConfig, params) {
    // 记录执行开始
    const startTime = Date.now();
    this.metricsCollector.recordCustomMetric('tool_execution_start', 1, { 
      toolName, 
      adapterName 
    });

    try {
      const result = await this.toolManager.executeTool(toolName, adapterName, adapterConfig, params);
      
      // 记录执行完成
      const duration = Date.now() - startTime;
      this.metricsCollector.recordExecutionTime('tool_execution', duration, { 
        toolName, 
        adapterName,
        success: true
      });
      
      return result;
    } catch (error) {
      // 记录执行错误
      const duration = Date.now() - startTime;
      this.metricsCollector.recordExecutionTime('tool_execution', duration, { 
        toolName, 
        adapterName,
        success: false
      });
      this.metricsCollector.recordError('tool_execution', error, { 
        toolName, 
        adapterName 
      });
      
      throw error;
    }
  }

  /**
   * 验证配置
   * @param {object} config - 配置对象
   * @returns {object} 验证结果
   */
  validateConfig(config) {
    return this.configValidator.validate(config);
  }

  /**
   * 获取适配器注册表
   * @returns {object} 适配器注册表
   */
  getAdapterRegistry() {
    return this.adapterRegistry;
  }

  /**
   * 获取监控收集器
   * @returns {object} 监控收集器
   */
  getMetricsCollector() {
    return this.metricsCollector;
  }

  /**
   * 创建安全策略验证器
   * @param {object} securityConfig - 安全配置
   * @returns {object} 安全策略验证器
   */
  createSecurityValidator(securityConfig) {
    this.securityValidator = new SecurityPolicyValidator(securityConfig);
    return this.securityValidator;
  }

  /**
   * 创建资源限制器
   * @param {object} limitsConfig - 资源限制配置
   * @returns {object} 资源限制器
   */
  createResourceLimiter(limitsConfig) {
    this.resourceLimiter = new ResourceLimiter(limitsConfig);
    return this.resourceLimiter;
  }

  /**
   * 获取系统状态
   * @returns {object} 系统状态
   */
  getStatus() {
    return {
      toolManager: this.toolManager.getStatus(),
      configLoader: this.configLoader.getCacheStats(),
      metricsCollector: this.metricsCollector.getSystemOverview(),
      securityValidator: this.securityValidator ? this.securityValidator.getSecurityStats() : null,
      resourceLimiter: this.resourceLimiter ? this.resourceLimiter.getGlobalStats() : null
    };
  }

  /**
   * 获取详细报告
   * @returns {object} 详细报告
   */
  getDetailedReport() {
    return {
      system: this.getStatus(),
      metrics: this.metricsCollector.getDetailedReport(),
      adapters: this.adapterRegistry.getRegisteredAdapters().map(name => 
        this.adapterRegistry.getAdapterInfo(name)
      )
    };
  }
}

// 创建全局实例
const toolx = new ToolX();

// 导出公共API
export {
  ToolX,
  toolx,
  ToolInitializer,
  toolManager,
  configLoader,
  configValidator,
  registry,
  MetricsCollector,
  SecurityPolicyValidator,
  ResourceLimiter
};

// 默认导出
export default toolx;