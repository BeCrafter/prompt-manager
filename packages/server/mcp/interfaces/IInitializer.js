/**
 * 初始化器接口定义
 */
export default class IInitializer {
  /**
   * 初始化MCP服务器
   * @returns {Promise<IMcpServer>} MCP服务器实例
   */
  async initializeMcpServer() {
    throw new Error('Method not implemented');
  }

  /**
   * 获取MCP中间件
   * @returns {Function} Express中间件
   */
  getMcpMiddleware() {
    throw new Error('Method not implemented');
  }

  /**
   * 获取MCP服务器实例
   * @returns {IMcpServer} MCP服务器实例
   */
  getMcpServerInstance() {
    throw new Error('Method not implemented');
  }
}