/**
 * 配置验证器 - 基于JSON Schema的配置验证
 * 提供更强大和灵活的配置验证功能
 */

class ConfigValidator {
  constructor() {
    // 定义配置Schema
    this.configSchema = {
      type: 'object',
      required: ['runtime', 'processPool', 'security'],
      properties: {
        runtime: {
          type: 'object',
          required: ['nodePath', 'npmPath', 'workingDir'],
          properties: {
            nodePath: { type: 'string', minLength: 1 },
            npmPath: { type: 'string', minLength: 1 },
            npxPath: { type: 'string' },
            workingDir: { type: 'string', minLength: 1 },
            envVars: { 
              type: 'object',
              additionalProperties: { type: 'string' }
            }
          }
        },
        processPool: {
          type: 'object',
          required: ['maxWorkers', 'minWorkers', 'warmupWorkers', 'maxIdleTime', 'healthCheckInterval'],
          properties: {
            maxWorkers: { type: 'number', minimum: 1, maximum: 10 },
            minWorkers: { type: 'number', minimum: 1 },
            warmupWorkers: { type: 'number', minimum: 0 },
            maxIdleTime: { type: 'number', minimum: 1000 },
            healthCheckInterval: { type: 'number', minimum: 1000 },
            recycleThreshold: { type: 'number', minimum: 1 }
          }
        },
        security: {
          type: 'object',
          required: ['enableSandbox'],
          properties: {
            enableSandbox: { type: 'boolean' },
            allowedDomains: { 
              type: 'array',
              items: { type: 'string' }
            },
            blockedCommands: { 
              type: 'array',
              items: { type: 'string' }
            },
            blockedModules: { 
              type: 'array',
              items: { type: 'string' }
            },
            fileAccessWhitelist: { 
              type: 'array',
              items: { type: 'string' }
            },
            maxExecutionTime: { type: 'number', minimum: 1000 },
            contextIsolation: { type: 'boolean' },
            nodeIntegration: { type: 'boolean' }
          }
        },
        limits: {
          type: 'object',
          properties: {
            maxMemory: { type: 'string', pattern: '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB)$' },
            maxCPU: { type: 'string', pattern: '^\\d+(\\.\\d+)?\\s*%?$' },
            maxFileSize: { type: 'string', pattern: '^\\d+(\\.\\d+)?\\s*(B|KB|MB|GB)$' },
            maxNetworkRequests: { type: 'number', minimum: 1 },
            maxProcesses: { type: 'number', minimum: 1 }
          }
        },
        docker: {
          type: 'object',
          properties: {
            imageName: { type: 'string' },
            networkMode: { type: 'string' },
            volumeMounts: { 
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    };
  }

  /**
   * 验证配置对象
   * @param {object} config - 配置对象
   * @returns {object} 验证结果
   */
  validate(config) {
    const errors = [];
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // 基本类型检查
    if (!config || typeof config !== 'object') {
      result.valid = false;
      result.errors.push('Configuration must be an object');
      return result;
    }

    // 验证根对象
    this.validateObject(config, this.configSchema, '', errors);

    // 特殊验证规则
    if (config.processPool) {
      if (config.processPool.minWorkers > config.processPool.maxWorkers) {
        errors.push('processPool.minWorkers cannot be greater than processPool.maxWorkers');
      }
      
      if (config.processPool.warmupWorkers > config.processPool.maxWorkers) {
        errors.push('processPool.warmupWorkers cannot exceed processPool.maxWorkers');
      }
    }

    if (errors.length > 0) {
      result.valid = false;
      result.errors = errors;
    }

    return result;
  }

  /**
   * 验证对象结构
   * @param {any} value - 要验证的值
   * @param {object} schema - Schema定义
   * @param {string} path - 当前路径
   * @param {string[]} errors - 错误数组
   */
  validateObject(value, schema, path, errors) {
    // 类型检查
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path || 'root'} must be an object`);
        return;
      }

      // 检查必需字段
      if (schema.required) {
        for (const requiredField of schema.required) {
          if (!(requiredField in value)) {
            errors.push(`${path ? path + '.' : ''}${requiredField} is required`);
          }
        }
      }

      // 验证属性
      if (schema.properties) {
        for (const [key, propertySchema] of Object.entries(schema.properties)) {
          const propertyValue = value[key];
          const propertyPath = path ? `${path}.${key}` : key;

          if (propertyValue !== undefined) {
            this.validateValue(propertyValue, propertySchema, propertyPath, errors);
          }
        }
      }

      // 检查额外属性
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!schema.properties || !(key in schema.properties)) {
            errors.push(`${path ? path + '.' : ''}${key} is not allowed`);
          }
        }
      }
    }
  }

  /**
   * 验证值
   * @param {any} value - 要验证的值
   * @param {object} schema - Schema定义
   * @param {string} path - 当前路径
   * @param {string[]} errors - 错误数组
   */
  validateValue(value, schema, path, errors) {
    // 类型检查
    if (schema.type) {
      if (!this.checkType(value, schema.type)) {
        errors.push(`${path} must be of type ${schema.type}`);
        return;
      }
    }

    // 字符串验证
    if (schema.type === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path} must be at least ${schema.minLength} characters long`);
      }

      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path} must be at most ${schema.maxLength} characters long`);
      }

      if (schema.pattern && typeof value === 'string') {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push(`${path} must match pattern ${schema.pattern}`);
        }
      }
    }

    // 数字验证
    if (schema.type === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path} must be at least ${schema.minimum}`);
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path} must be at most ${schema.maximum}`);
      }
    }

    // 数组验证
    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${path} must be an array`);
        return;
      }

      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${path} must have at least ${schema.minItems} items`);
      }

      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${path} must have at most ${schema.maxItems} items`);
      }

      if (schema.items && value.length > 0) {
        for (let i = 0; i < value.length; i++) {
          this.validateValue(value[i], schema.items, `${path}[${i}]`, errors);
        }
      }
    }

    // 对象验证
    if (schema.type === 'object') {
      this.validateObject(value, schema, path, errors);
    }
  }

  /**
   * 检查值类型
   * @param {any} value - 要检查的值
   * @param {string} type - 期望的类型
   * @returns {boolean} 是否匹配
   */
  checkType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * 获取配置Schema
   * @returns {object} 配置Schema
   */
  getSchema() {
    return this.configSchema;
  }
}

// 单例模式
const globalConfigValidator = new ConfigValidator();

export {
  ConfigValidator,
  globalConfigValidator as validator
};