import fs from 'fs-extra';
import path from 'path';

/**
 * 文件系统工具
 * @param {Object} params - 工具参数
 * @param {string} mode - 操作模式
 * @returns {Promise<Object>} 执行结果
 */
export default async function filesystem(params, mode = 'execute') {
  // 根据模式执行不同的操作
  switch (mode) {
    case 'manual':
      // 生成 Markdown 格式的手册
      return generateManual();

    case 'execute':
      // 执行模式 - 实际执行操作
      const { action, path: filePath, content } = params;
      
      if (!action) {
        throw new Error('缺少必需参数: action');
      }
      
      if (!filePath) {
        throw new Error('缺少必需参数: path');
      }
      
      switch (action) {
        case 'read':
          try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            return {
              success: true,
              action: 'read',
              path: filePath,
              content: fileContent
            };
          } catch (error) {
            throw new Error(`读取文件失败: ${error.message}`);
          }
          
        case 'write':
          if (content === undefined) {
            throw new Error('写入文件需要提供 content 参数');
          }
          try {
            await fs.writeFile(filePath, content, 'utf8');
            return {
              success: true,
              action: 'write',
              path: filePath,
              message: '文件写入成功'
            };
          } catch (error) {
            throw new Error(`写入文件失败: ${error.message}`);
          }
          
        case 'list':
          try {
            const items = await fs.readdir(filePath);
            return {
              success: true,
              action: 'list',
              path: filePath,
              items: items
            };
          } catch (error) {
            throw new Error(`列出目录内容失败: ${error.message}`);
          }
          
        case 'delete':
          try {
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
              await fs.rm(filePath, { recursive: true });
              return {
                success: true,
                action: 'delete',
                path: filePath,
                type: 'directory',
                message: '目录删除成功'
              };
            } else {
              await fs.unlink(filePath);
              return {
                success: true,
                action: 'delete',
                path: filePath,
                type: 'file',
                message: '文件删除成功'
              };
            }
          } catch (error) {
            throw new Error(`删除文件或目录失败: ${error.message}`);
          }
          
        default:
          throw new Error(`不支持的操作类型: ${action}`);
      }
      
    default:
      throw new Error(`不支持的模式: ${mode}`);
  }
}

/**
 * 生成 Markdown 格式的手册
 * @returns {string} Markdown 格式的手册
 */
function generateManual() {
  return `# 🔧 filesystem

> 文件系统工具 - 用于文件操作

## 📋 基础信息

- **标识**: \`tool://filesystem\`
- **分类**: 系统工具

## ✅ 适用场景

- 读取文件内容进行分析
- 写入文件内容保存数据
- 列出目录内容查看文件结构
- 删除文件或目录进行清理

## 📝 参数定义

### execute 模式参数

| 参数 | 类型 | 必需 | 描述 | 默认值 |
|------|------|------|------|--------|
| action | string (read|write|list|delete) | ✅ | 操作类型 | - |
| path | string | ✅ | 文件或目录路径 | - |
| content | string | ❌ | 写入的文件内容 (仅在action为write时需要) | - |

## 💻 使用示例

通过 toolx 调用，使用 YAML 格式：

\`\`\`yaml
# 读取文件内容
tool: tool://filesystem
mode: execute
parameters:
  action: read
  path: /path/to/file.txt

# 写入文件内容
tool: tool://filesystem
mode: execute
parameters:
  action: write
  path: /path/to/file.txt
  content: "Hello, World!"

# 列出目录内容
tool: tool://filesystem
mode: execute
parameters:
  action: list
  path: /path/to/directory

# 删除文件或目录
tool: tool://filesystem
mode: execute
parameters:
  action: delete
  path: /path/to/file-or-directory
\`\`\`

## 🚨 业务错误

| 错误码 | 描述 | 解决方案 | 可重试 |
|--------|------|----------|--------|
| MISSING_ACTION | 缺少必需参数: action | 提供 action 参数 | ❌ |
| MISSING_PATH | 缺少必需参数: path | 提供 path 参数 | ❌ |
| READ_FAILED | 读取文件失败 | 检查文件路径是否存在且可读 | ✅ |
| WRITE_FAILED | 写入文件失败 | 检查文件路径是否可写 | ✅ |
| LIST_FAILED | 列出目录内容失败 | 检查目录路径是否存在且可读 | ✅ |
| DELETE_FAILED | 删除文件或目录失败 | 检查文件或目录是否存在且可删除 | ✅ |
`;
}