/**
 * MCP传输层接口定义
 */
export default class IMcpTransport {
  /**
   * 启动传输层
   */
  async start() {
    throw new Error('Method not implemented');
  }

  /**
   * 处理HTTP请求
   * @param {Object} req - HTTP请求对象
   * @param {Object} res - HTTP响应对象
   * @param {Object} body - 请求体
   */
  async handleRequest(req, res, body) {
    throw new Error('Method not implemented');
  }

  /**
   * 发送消息
   * @param {Object} message - 要发送的消息
   */
  async send(message) {
    throw new Error('Method not implemented');
  }

  /**
   * 关闭传输层
   */
  async close() {
    throw new Error('Method not implemented');
  }

  /**
   * 标记为断开连接
   */
  markAsDisconnected() {
    throw new Error('Method not implemented');
  }

  /**
   * 重新连接
   */
  async reconnect() {
    throw new Error('Method not implemented');
  }
}