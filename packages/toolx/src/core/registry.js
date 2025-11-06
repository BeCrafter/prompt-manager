/**
 * 适配器注册表 - 支持扩展，无需修改现有代码
 * 遵循开闭原则(OCP)，对扩展开放，对修改关闭
 */

import { ICommandExecutor } from './interfaces/command-executor.js';
import { IDependencyManager } from './interfaces/dependency-manager.js';
import { ISandboxManager } from './interfaces/sandbox-manager.js';

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
    this.instances = new Map();
    this.requiredInterfaces = [ICommandExecutor, IDependencyManager, ISandboxManager];
  }
  
  /**
   * 注册适配器
   * @param {string} name - 适配器名称
   * @param {class} AdapterClass - 适配器类
   */
  register(name, AdapterClass) {
    if (this.adapters.has(name)) {
      throw new Error(`Adapter '${name}' is already registered`);
    }
    
    if (!this.implementsInterface(AdapterClass)) {
      throw new Error(`Adapter '${name}' must implement required interfaces: ${this.requiredInterfaces.map(i => i.name).join(', ')}`);
    }
    
    this.adapters.set(name, AdapterClass);
  }
  
  /**
   * 创建适配器实例
   * @param {string} name - 适配器名称
   * @param {object} config - 配置参数
   * @returns {object} 适配器实例
   */
  create(name, config) {
    const AdapterClass = this.adapters.get(name);
    if (!AdapterClass) {
      throw new Error(`Unknown adapter: '${name}'. Available adapters: ${Array.from(this.adapters.keys()).join(', ')}`);
    }
    
    // 创建缓存键，相同配置复用实例
    const cacheKey = this.createCacheKey(name, config);
    if (!this.instances.has(cacheKey)) {
      try {
        const instance = new AdapterClass(config);
        this.instances.set(cacheKey, instance);
      } catch (error) {
        throw new Error(`Failed to create adapter '${name}': ${error.message}`);
      }
    }
    
    return this.instances.get(cacheKey);
  }
  
  /**
   * 获取已注册的适配器列表
   * @returns {string[]} 适配器名称列表
   */
  getRegisteredAdapters() {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * 检查适配器是否已注册
   * @param {string} name - 适配器名称
   * @returns {boolean} 是否已注册
   */
  isRegistered(name) {
    return this.adapters.has(name);
  }
  
  /**
   * 注销适配器
   * @param {string} name - 适配器名称
   */
  unregister(name) {
    if (!this.adapters.has(name)) {
      throw new Error(`Adapter '${name}' is not registered`);
    }
    
    // 清理相关实例
    for (const [cacheKey, instance] of this.instances) {
      if (cacheKey.startsWith(`${name}_`)) {
        this.instances.delete(cacheKey);
      }
    }
    
    this.adapters.delete(name);
  }
  
  /**
   * 清除所有实例缓存
   */
  clearInstances() {
    this.instances.clear();
  }
  
  /**
   * 获取适配器信息
   * @param {string} name - 适配器名称
   * @returns {object} 适配器信息
   */
  getAdapterInfo(name) {
    const AdapterClass = this.adapters.get(name);
    if (!AdapterClass) {
      throw new Error(`Unknown adapter: '${name}'`);
    }
    
    return {
      name,
      className: AdapterClass.name,
      instanceCount: this.getInstanceCount(name),
      requiredInterfaces: this.requiredInterfaces.map(i => i.name)
    };
  }
  
  /**
   * 验证接口实现
   * @param {class} AdapterClass - 适配器类
   * @returns {boolean} 是否实现接口
   */
  implementsInterface(AdapterClass) {
    return this.requiredInterfaces.every(InterfaceClass => {
      // 检查原型链
      if (AdapterClass.prototype instanceof InterfaceClass) {
        return true;
      }
      
      // 检查方法实现
      const interfaceMethods = Object.getOwnPropertyNames(InterfaceClass.prototype);
      return interfaceMethods.every(method => {
        if (method === 'constructor') return true;
        return typeof AdapterClass.prototype[method] === 'function';
      });
    });
  }
  
  /**
   * 创建缓存键
   * @param {string} name - 适配器名称
   * @param {object} config - 配置参数
   * @returns {string} 缓存键
   */
  createCacheKey(name, config) {
    const configStr = JSON.stringify(config, Object.keys(config).sort());
    return `${name}_${Buffer.from(configStr).toString('base64')}`;
  }
  
  /**
   * 获取适配器实例数量
   * @param {string} name - 适配器名称
   * @returns {number} 实例数量
   */
  getInstanceCount(name) {
    let count = 0;
    for (const cacheKey of this.instances.keys()) {
      if (cacheKey.startsWith(`${name}_`)) {
        count++;
      }
    }
    return count;
  }
}

// 单例模式 - 全局唯一注册表
const globalRegistry = new AdapterRegistry();

export {
  AdapterRegistry,
  globalRegistry as registry
};