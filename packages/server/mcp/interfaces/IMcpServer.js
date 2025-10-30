/**
 * MCP服务器接口定义
 */
export default class IMcpServer {
  /**
   * 暴露MCP方法
   * @param {string} methodName - 方法名
   * @param {Function} handler - 方法实现
   * @param {Object} metadata - 方法元数据
   */
  expose(methodName, handler, metadata) {
    throw new Error('Method not implemented');
  }

  /**
   * 创建Express中间件
   * @returns {Function} Express中间件
   */
  createMiddleware() {
    throw new Error('Method not implemented');
  }

  /**
   * 关闭MCP服务
   */
  async close() {
    throw new Error('Method not implemented');
  }

  /**
   * 添加会话事件处理器
   * @param {Function} handler - 事件处理器
   */
  onSessionEvent(handler) {
    throw new Error('Method not implemented');
  }
}