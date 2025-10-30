/**
 * 相似度计算服务
 */
export class SimilarityService {
  /**
   * 计算搜索关键词与prompt的相似度得分
   * @param {string} searchTerm - 搜索关键词
   * @param {Object} prompt - prompt对象
   * @returns {number} 相似度得分 (0-100)
   */
  static calculateSimilarityScore(searchTerm, prompt) {
    let totalScore = 0;
    const searchLower = searchTerm ? searchTerm.toLowerCase() : '';
    
    // 搜索字段权重配置（专注于内容搜索，不包含ID检索）
    const fieldWeights = {
      name: 60,         // 名称权重高，是主要匹配字段
      description: 40   // 描述权重适中，是辅助匹配字段
    };
    
    // 计算name匹配得分
    if (prompt && prompt.name && typeof prompt.name === 'string') {
      const nameScore = this.getStringMatchScore(searchLower, prompt.name.toLowerCase());
      totalScore += nameScore * fieldWeights.name;
    }
    
    // 计算description匹配得分
    if (prompt.description) {
      const descScore = this.getStringMatchScore(searchLower, prompt.description.toLowerCase());
      totalScore += descScore * fieldWeights.description;
    }
    
    // 标准化得分到0-100范围
    const maxPossibleScore = Object.values(fieldWeights).reduce((sum, weight) => sum + weight, 0);
    return Math.round((totalScore / maxPossibleScore) * 100);
  }

  /**
   * 计算两个字符串的匹配得分
   * @param {string} search - 搜索词 (已转小写)
   * @param {string} target - 目标字符串 (已转小写)
   * @returns {number} 匹配得分 (0-1)
   */
  static getStringMatchScore(search, target) {
    if (!search || !target) return 0;
    
    // 完全匹配得分最高
    if (target === search) return 1.0;
    
    // 完全包含得分较高
    if (target.includes(search)) return 0.8;
    
    // 部分词匹配
    const searchWords = search.split(/\s+/).filter(word => word.length > 0);
    const targetWords = target.split(/\s+/).filter(word => word.length > 0);
    
    let matchedWords = 0;
    for (const searchWord of searchWords) {
      for (const targetWord of targetWords) {
        if (targetWord.includes(searchWord) || searchWord.includes(targetWord)) {
          matchedWords++;
          break;
        }
      }
    }
    
    if (searchWords.length > 0) {
      const wordMatchRatio = matchedWords / searchWords.length;
      return wordMatchRatio * 0.6; // 部分词匹配得分
    }
    
    return 0;
  }
}