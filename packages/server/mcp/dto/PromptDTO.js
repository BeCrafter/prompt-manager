/**
 * Prompt数据传输对象
 */
export class PromptDTO {
  constructor({ id, name, description, messages, arguments: args, filePath, metadata } = {}) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.messages = messages || [];
    this.arguments = args || [];
    this.filePath = filePath;
    this.metadata = metadata;
  }

  /**
   * 从原始Prompt对象创建DTO
   * @param {Object} prompt - 原始Prompt对象
   * @returns {PromptDTO} PromptDTO实例
   */
  static fromPrompt(prompt) {
    return new PromptDTO({
      id: prompt.uniqueId || prompt.id,
      name: prompt.name,
      description: prompt.description || `Prompt: ${prompt.name}`,
      messages: prompt.messages || [],
      arguments: prompt.arguments || [],
      filePath: prompt.relativePath || prompt.filePath,
      metadata: {
        uniqueId: prompt.uniqueId,
        fileName: prompt.fileName,
        fullPath: prompt.filePath,
      }
    });
  }
}