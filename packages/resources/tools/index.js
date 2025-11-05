/**
 * ToolX 工具系统 - 提供各种服务内部工具的统一调用接口
 * 
 * 工具目录结构:
 * - 所有工具都位于 /tools 目录下
 * - 每个工具是一个独立的 JS 文件
 * - 工具导出一个默认函数，接受参数和模式作为输入
 */

// 导出所有可用的工具
export { default as filesystem } from './filesystem/filesystem.tool.js';

// 工具列表
export const availableTools = [
  'filesystem'
];