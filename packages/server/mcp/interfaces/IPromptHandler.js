/**
 * Prompt处理器接口定义
 */
export default class IPromptHandler {
  /**
   * 处理获取Prompt请求
   * @param {Object} args - 请求参数
   * @returns {Promise<Object>} 处理结果
   */
  async handleGetPrompt(args) {
    throw new Error('Method not implemented');
  }

  /**
   * 处理搜索Prompt请求
   * @param {Object} args - 请求参数
   * @returns {Promise<Object>} 处理结果
   */
  async handleSearchPrompts(args) {
    throw new Error('Method not implemented');
  }

  /**
   * 处理重新加载Prompt请求
   * @param {Object} args - 请求参数
   * @returns {Promise<Object>} 处理结果
   */
  async handleReloadPrompts(args) {
    throw new Error('Method not implemented');
  }
}