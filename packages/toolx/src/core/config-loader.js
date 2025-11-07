/**
 * 配置加载器 - 简单直接的配置管理，遵循KISS原则
 * 支持配置继承和缓存，减少重复配置，遵循DRY原则
 */

import fs from 'fs/promises';
import path from 'path';
import { validator } from './config-validator.js';

class ConfigLoader {
  constructor() {
    this.configCache = new Map();
    this.configDir = null;
    this.baseConfig = null;
  }
  
  /**
   * 设置配置目录
   * @param {string} configDir - 配置目录路径
   */
  setConfigDirectory(configDir) {
    this.configDir = configDir;
  }
  
  /**
   * 加载场景配置
   * @param {string} scenarioName - 场景名称
   * @returns {Promise<object>} 配置对象
   */
  async loadScenario(scenarioName) {
    if (!this.configDir) {
      throw new Error('Config directory not set. Call setConfigDirectory() first.');
    }
    
    const cacheKey = `scenario_${scenarioName}`;
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }
    
    try {
      const scenarioConfig = await this.loadYAML(`scenarios/${scenarioName}.yml`);
      let finalConfig = scenarioConfig;
      
      // 处理继承
      if (scenarioConfig.extends) {
        const baseConfig = await this.loadBaseConfig(scenarioConfig.extends);
        finalConfig = this.deepMerge(baseConfig, scenarioConfig);
      }
      
      // 环境变量替换
      finalConfig = this.replaceEnvVars(finalConfig);
      
      // 配置验证
      this.validateConfig(finalConfig);
      
      this.configCache.set(cacheKey, finalConfig);
      return finalConfig;
    } catch (error) {
      throw new Error(`Failed to load config for '${scenarioName}': ${error.message}`);
    }
  }
  
  /**
   * 加载基础配置
   * @param {string} configPath - 配置文件路径
   * @returns {Promise<object>} 基础配置
   */
  async loadBaseConfig(configPath) {
    const cacheKey = `base_${configPath}`;
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }
    
    const baseConfig = await this.loadYAML(configPath);
    
    // 只缓存base部分，不包含场景特定配置
    const baseOnly = { ...baseConfig };
    if (baseOnly.base) {
      Object.assign(baseOnly, baseOnly.base);
      delete baseOnly.base;
    }
    
    this.configCache.set(cacheKey, baseOnly);
    return baseOnly;
  }
  
  /**
   * 加载YAML文件
   * @param {string} relativePath - 相对路径
   * @returns {Promise<object>} 解析后的对象
   */
  async loadYAML(relativePath) {
    const fullPath = path.resolve(this.configDir, relativePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      return await this.parseYAML(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Config file not found: ${fullPath}`);
      }
      throw new Error(`Failed to read config file ${fullPath}: ${error.message}`);
    }
  }
  
  /**
   * YAML解析器
   * @param {string} content - YAML内容
   * @returns {object} 解析后的对象
   */
  async parseYAML(content) {
    try {
      // 尝试使用js-yaml（如果可用）
      const yamlModule = await import('js-yaml');
      return yamlModule.load(content);
    } catch (error) {
      // 如果js-yaml不可用，使用增强的内置解析器
      return this.enhancedYAMLParser(content);
    }
  }
  
  /**
   * 增强的YAML解析器实现
   * @param {string} content - YAML内容
   * @returns {object} 解析后的对象
   */
  enhancedYAMLParser(content) {
    const lines = content.split('\n');
    const result = {};
    const stack = [{ obj: result, indent: -1, isArray: false }];
    
    // 辅助函数：解析值
    const parseValue = (value) => {
      value = value.trim();
      
      // 处理引号字符串
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
      }
      
      // 处理布尔值
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (value === 'null') return null;
      
      // 处理数字
      if (!isNaN(value) && value !== '') {
        return Number(value);
      }
      
      // 处理数组
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          return JSON.parse(value);
        } catch (e) {
          // 如果JSON解析失败，返回原始字符串
          return value;
        }
      }
      
      return value;
    };
    
    // 辅助函数：处理数组项
    const handleArrayItem = (line, indentLevel, parent) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (value) {
          // 数组项有值
          parent.push(parseValue(value));
        } else {
          // 数组项是对象
          const newObj = {};
          parent.push(newObj);
          return newObj;
        }
      }
      return null;
    };
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const indent = line.search(/\S/);
      
      // 找到当前层级的父对象
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      const current = stack[stack.length - 1].obj;
      const isArrayContext = stack[stack.length - 1].isArray;
      
      // 处理数组项
      if (isArrayContext && trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (value) {
          current.push(parseValue(value));
        } else {
          const newObj = {};
          current.push(newObj);
          stack.push({ obj: newObj, indent, isArray: false });
        }
        continue;
      }
      
      // 处理键值对
      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        
        if (value) {
          // 有值的键值对
          current[key] = parseValue(value);
        } else {
          // 没有值，可能是对象或数组
          const nextLine = lines[lines.indexOf(line) + 1];
          const nextIndent = nextLine ? nextLine.search(/\S/) : -1;
          
          if (nextIndent > indent) {
            const nextTrimmed = nextLine.trim();
            if (nextTrimmed.startsWith('- ')) {
              // 数组
              current[key] = [];
              stack.push({ obj: current[key], indent, isArray: true });
            } else {
              // 对象
              current[key] = {};
              stack.push({ obj: current[key], indent, isArray: false });
            }
          } else {
            // 空对象
            current[key] = {};
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * 深度合并对象
   * @param {object} base - 基础对象
   * @param {object} override - 覆盖对象
   * @returns {object} 合并后的对象
   */
  deepMerge(base, override) {
    const result = { ...base };
    
    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.deepMerge(result[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    
    return result;
  }
  
  /**
   * 环境变量替换
   * @param {object} config - 配置对象
   * @returns {object} 替换后的配置
   */
  replaceEnvVars(config) {
    const jsonStr = JSON.stringify(config);
    const replaced = jsonStr.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const envValue = process.env[envVar];
      if (envValue === undefined) {
        console.warn(`Environment variable '${envVar}' not found, keeping original value`);
        return match;
      }
      return envValue;
    });
    
    try {
      return JSON.parse(replaced);
    } catch (error) {
      throw new Error(`Failed to parse config after environment variable replacement: ${error.message}`);
    }
  }
  
  /**
   * 配置验证
   * @param {object} config - 配置对象
   */
  validateConfig(config) {
    const result = validator.validate(config);
    
    if (!result.valid) {
      const errorMessage = `Configuration validation failed:\n${result.errors.map(error => `- ${error}`).join('\n')}`;
      throw new Error(errorMessage);
    }
  }
  
  /**
   * 获取可用场景列表
   * @returns {Promise<string[]>} 场景名称列表
   */
  async getAvailableScenarios() {
    if (!this.configDir) {
      throw new Error('Config directory not set');
    }
    
    try {
      const scenariosDir = path.resolve(this.configDir, 'scenarios');
      const files = await fs.readdir(scenariosDir);
      
      return files
        .filter(file => file.endsWith('.yml'))
        .map(file => file.replace('.yml', ''));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
  
  /**
   * 清除配置缓存
   * @param {string} [scenarioName] - 特定场景名称，不提供则清除所有缓存
   */
  clearCache(scenarioName) {
    if (scenarioName) {
      this.configCache.delete(`scenario_${scenarioName}`);
    } else {
      this.configCache.clear();
    }
  }
  
  /**
   * 获取缓存统计信息
   * @returns {object} 缓存统计
   */
  getCacheStats() {
    return {
      size: this.configCache.size,
      keys: Array.from(this.configCache.keys())
    };
  }
  
  /**
   * 重新加载配置
   * @param {string} scenarioName - 场景名称
   * @returns {Promise<object>} 重新加载的配置
   */
  async reloadScenario(scenarioName) {
    this.clearCache(scenarioName);
    return await this.loadScenario(scenarioName);
  }
}

// 单例模式 - 全局配置加载器
const globalConfigLoader = new ConfigLoader();

export {
  ConfigLoader,
  globalConfigLoader as loader
};