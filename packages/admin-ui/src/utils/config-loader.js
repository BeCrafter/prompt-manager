/**
 * 配置加载器
 * 支持从环境变量、.env 文件和 API 动态获取配置
 */

import { getBackendUrl } from './env-loader.js';

class ConfigLoader {
  constructor() {
    this.config = null;
    this.loadPromise = null;
  }
  
  /**
   * 加载配置
   */
  async loadConfig() {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    
    this.loadPromise = this._loadConfigInternal();
    return this.loadPromise;
  }
  
  async _loadConfigInternal() {
    console.log('🔍 ConfigLoader._loadConfigInternal() 开始加载配置');

    // 1. 从 API 获取动态配置（这是唯一的配置源）
    console.log('🔍 从 API 获取服务器配置');
    try {
      const backendUrl = getBackendUrl();
      const apiUrl = `${backendUrl}/adminapi/config/public`;
      console.log('🔍 调用 API:', apiUrl);

      const response = await fetch(apiUrl);
      console.log('🔍 API 响应状态:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('🔍 API 响应数据:', result);

      if (!result.success) {
        throw new Error(result.error || 'API 返回失败');
      }

      this.config = result.data;
      console.log('✅ 从 API 获取配置成功:', this.config);
      console.log('✅ 成功获取服务器端口配置！');
      return this.config;
    } catch (error) {
      console.error('❌ 从 API 获取配置失败:', error.message);
      console.error('❌ 这意味着无法连接到后端服务器或API不可用');

      // 2. API 获取失败，使用默认配置
      this.config = {
        httpPort: parseInt(new URL(getBackendUrl()).port) || 5621,
        websocketPort: 5622,
        version: '0.0.0'
      };
      console.log('⚠️ 使用默认配置:', this.config);
      return this.config;
    }
  }
  
  /**
   * 获取服务器 HTTP 端口
   */
  async getHttpPort() {
    const config = await this.loadConfig();
    return config.httpPort || 5621;
  }

  /**
   * 获取 WebSocket 端口
   */
  async getWebSocketPort() {
    const config = await this.loadConfig();
    return config.websocketPort || 5622;
  }

  /**
   * 获取 WebSocket URL
   */
  async getWebSocketUrl() {
    const config = await this.loadConfig();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const wsPort = config.websocketPort || 5622;

    const wsUrl = `${protocol}//${host}:${wsPort}`;
    console.log('WebSocket URL:', wsUrl);
    return wsUrl;
  }
  
  /**
   * 获取后端 URL
   */
  getBackendUrl() {
    return getBackendUrl();
  }
  
  /**
   * 重新加载配置
   */
  async reloadConfig() {
    this.loadPromise = null;
    this.config = null;
    return this.loadConfig();
  }
}

export const configLoader = new ConfigLoader();