const { app } = require('electron');

/**
 * 应用状态管理器
 * 遵循单一职责原则，集中管理应用状态
 */

class AppState {
  constructor() {
    this.state = {
      service: 'stopped', // stopped | starting | running | stopping | error
      server: null,
      module: null,
      moduleVersion: 0,
      moduleLoading: null,
      isQuitting: false,
      runtimeRoot: null,
      failureCount: 0,
      debugEnabled: false
    };
    
    this.clickCounters = {
      aboutButton: { count: 0, lastTime: 0 },
      aboutWindow: { count: 0, lastTime: 0 }
    };
    
    this.ui = {
      tray: null,
      adminWindow: null,
      aboutWindow: null
    };
  }

  get(key) {
    return key ? this.state[key] : { ...this.state };
  }

  set(key, value) {
    if (typeof key === 'object') {
      Object.assign(this.state, key);
    } else {
      this.state[key] = value;
    }
    return this;
  }

  getServiceStatus() {
    const statusMap = {
      running: '运行中',
      starting: '启动中',
      stopping: '停止中',
      error: '启动失败',
      stopped: '已停止'
    };
    return statusMap[this.state.service] || '未知状态';
  }

  getClickCounter(type) {
    return this.clickCounters[type] || { count: 0, lastTime: 0 };
  }

  updateClickCounter(type, increment = 1) {
    const now = Date.now();
    const counter = this.clickCounters[type];
    
    if (now - counter.lastTime > 3000) {
      counter.count = 0;
    }
    
    counter.count += increment;
    counter.lastTime = now;
    
    return counter.count;
  }

  resetClickCounter(type) {
    this.clickCounters[type] = { count: 0, lastTime: 0 };
    return this;
  }

  getUI(component) {
    return component ? this.ui[component] : { ...this.ui };
  }

  setUI(component, instance) {
    this.ui[component] = instance;
    return this;
  }

  isServiceRunning() {
    return this.state.service === 'running';
  }

  isServiceStarting() {
    return this.state.service === 'starting';
  }

  isServiceStopping() {
    return this.state.service === 'stopping';
  }

  canStartService() {
    return ['stopped', 'error'].includes(this.state.service);
  }

  canStopService() {
    return ['running', 'error'].includes(this.state.service);
  }

  incrementFailureCount() {
    this.state.failureCount++;
    return this.state.failureCount;
  }

  resetFailureCount() {
    this.state.failureCount = 0;
    return this;
  }

  shouldPromptForRestart() {
    return this.state.failureCount >= 3;
  }
}

module.exports = AppState;