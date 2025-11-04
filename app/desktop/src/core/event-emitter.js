/**
 * 事件发射器基类
 * 提供标准化的事件处理功能
 */

class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {function} listener - 监听器函数
   */
  on(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {function} listener - 监听器函数
   */
  off(event, listener) {
    if (!this.listeners[event]) return;
    
    const index = this.listeners[event].indexOf(listener);
    if (index > -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  /**
   * 发射事件
   * @param {string} event - 事件名称
   * @param {...any} args - 传递给监听器的参数
   */
  emit(event, ...args) {
    if (!this.listeners[event]) return;
    
    this.listeners[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * 移除指定事件的所有监听器
   * @param {string} event - 事件名称
   */
  removeAllListeners(event) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }

  /**
   * 获取指定事件的监听器数量
   * @param {string} event - 事件名称
   * @returns {number} - 监听器数量
   */
  listenerCount(event) {
    return this.listeners[event] ? this.listeners[event].length : 0;
  }

  /**
   * 获取所有事件名称
   * @returns {string[]} - 事件名称数组
   */
  eventNames() {
    return Object.keys(this.listeners);
  }
}

module.exports = EventEmitter;