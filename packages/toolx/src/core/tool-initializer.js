/**
 * 工具初始化器 - 初始化工具生态系统
 * 注册所有适配器和初始化核心组件
 */

import { registry } from './registry.js';
import { ElectronRuntimeProvider } from '../adapters/electron-adapter.js';
import { NodeJSRuntimeProvider } from '../adapters/nodejs-adapter.js';
import { DockerRuntimeProvider } from '../adapters/docker-adapter.js';

class ToolInitializer {
  /**
   * 初始化工具生态系统
   */
  static initialize() {
    // 注册所有适配器
    this.registerAdapters();
    
    console.log('Tool ecosystem initialized successfully');
  }
  
  /**
   * 注册所有适配器
   */
  static registerAdapters() {
    try {
      // 注册Electron适配器
      registry.register('electron', ElectronRuntimeProvider);
      console.log('Electron adapter registered');
      
      // 注册Node.js适配器
      registry.register('nodejs', NodeJSRuntimeProvider);
      console.log('Node.js adapter registered');
      
      // 注册Docker适配器
      registry.register('docker', DockerRuntimeProvider);
      console.log('Docker adapter registered');
      
    } catch (error) {
      console.error('Failed to register adapters:', error.message);
      throw error;
    }
  }
  
  /**
   * 获取已注册的适配器列表
   * @returns {string[]} 适配器名称列表
   */
  static getRegisteredAdapters() {
    return registry.getRegisteredAdapters();
  }
  
  /**
   * 获取适配器信息
   * @param {string} name - 适配器名称
   * @returns {object} 适配器信息
   */
  static getAdapterInfo(name) {
    return registry.getAdapterInfo(name);
  }
}

export {
  ToolInitializer
};