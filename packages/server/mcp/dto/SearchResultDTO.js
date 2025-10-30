/**
 * 搜索结果数据传输对象
 */
export class SearchResultDTO {
  constructor({ success, query, count, results, debug } = {}) {
    this.success = success;
    this.query = query;
    this.count = count;
    this.results = results;
    this.debug = debug;
  }

  /**
   * 创建搜索结果DTO
   * @param {string} query - 搜索查询
   * @param {Array} results - 搜索结果
   * @param {Object} debugInfo - 调试信息
   * @returns {SearchResultDTO} SearchResultDTO实例
   */
  static create(query, results, debugInfo = null) {
    return new SearchResultDTO({
      success: true,
      query: query || '',
      count: results ? results.length : 0,
      results: results || [],
      debug: debugInfo
    });
  }
}