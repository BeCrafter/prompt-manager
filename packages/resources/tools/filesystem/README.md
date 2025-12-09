# Filesystem Tool

基于MCP标准的文件系统操作工具，提供读写、搜索、编辑等功能。

## 功能特性

1. **文件读取** (`read_text_file`, `read_media_file`, `read_multiple_files`)
   - 读取文本文件（支持 head/tail 参数）
   - 读取媒体文件（图片、音频等，转换为 base64）
   - 批量读取多个文件

2. **文件写入** (`write_file`, `edit_file`)
   - 写入文件（自动创建父目录）
   - 编辑文件（支持多个替换操作）
   - 预览模式（dryRun）

3. **目录操作** (`create_directory`, `list_directory`, `list_directory_with_sizes`, `directory_tree`)
   - 创建目录
   - 列出目录内容
   - 列出目录内容（带大小信息）
   - 构建目录树

4. **文件管理** (`move_file`, `search_files`, `get_file_info`, `list_allowed_directories`)
   - 移动/重命名文件
   - 搜索文件（支持模式匹配）
   - 获取文件信息
   - 列出允许访问的目录

## 环境变量配置

工具需要配置以下环境变量：

- `ALLOWED_DIRECTORIES` (可选): 允许访问的目录列表（JSON数组格式）
  - 默认值: `["~/.prompt-manager"]`
  - 示例: `["~/.prompt-manager", "/tmp"]`

## 使用方法

### 1. 配置环境变量

```yaml
tool: tool://filesystem
mode: configure
parameters:
  ALLOWED_DIRECTORIES: '["~/.prompt-manager", "/tmp"]'
```

### 2. 读取文本文件

```yaml
tool: tool://filesystem
mode: execute
parameters:
  method: read_text_file
  path: "~/.prompt-manager/config.json"
  head: 10  # 可选，读取前10行
  tail: 20  # 可选，读取后20行
```

### 3. 写入文件

```yaml
tool: tool://filesystem
mode: execute
parameters:
  method: write_file
  path: "~/.prompt-manager/test.txt"
  content: "文件内容"
```

### 4. 编辑文件

```yaml
tool: tool://filesystem
mode: execute
parameters:
  method: edit_file
  path: "~/.prompt-manager/config.json"
  edits:
    - oldText: "旧文本"
      newText: "新文本"
  dryRun: false  # 可选，预览模式
```

### 5. 列出目录

```yaml
tool: tool://filesystem
mode: execute
parameters:
  method: list_directory
  path: "~/.prompt-manager"
```

### 6. 搜索文件

```yaml
tool: tool://filesystem
mode: execute
parameters:
  method: search_files
  path: "~/.prompt-manager"
  pattern: "*.json"
  excludePatterns: ["node_modules", "*.log"]
```

### 7. 获取文件信息

```yaml
tool: tool://filesystem
mode: execute
parameters:
  method: get_file_info
  path: "~/.prompt-manager/config.json"
```

## 参数说明

### read_text_file 方法

- `method` (必需): 必须为 `"read_text_file"`
- `path` (必需): 文件路径
- `head` (可选): 读取前N行
- `tail` (可选): 读取后N行

### read_media_file 方法

- `method` (必需): 必须为 `"read_media_file"`
- `path` (必需): 媒体文件路径

### read_multiple_files 方法

- `method` (必需): 必须为 `"read_multiple_files"`
- `paths` (必需): 文件路径数组

### write_file 方法

- `method` (必需): 必须为 `"write_file"`
- `path` (必需): 文件路径
- `content` (必需): 文件内容

### edit_file 方法

- `method` (必需): 必须为 `"edit_file"`
- `path` (必需): 文件路径
- `edits` (必需): 编辑操作数组，每个元素包含：
  - `oldText`: 要替换的原始文本（必须完全匹配）
  - `newText`: 替换后的新文本
- `dryRun` (可选): 仅预览不执行，默认 `false`

### create_directory 方法

- `method` (必需): 必须为 `"create_directory"`
- `path` (必需): 目录路径

### list_directory 方法

- `method` (必需): 必须为 `"list_directory"`
- `path` (必需): 目录路径

### list_directory_with_sizes 方法

- `method` (必需): 必须为 `"list_directory_with_sizes"`
- `path` (必需): 目录路径
- `sortBy` (可选): 排序方式（name/size），默认按名称排序

### directory_tree 方法

- `method` (必需): 必须为 `"directory_tree"`
- `path` (必需): 目录路径

### move_file 方法

- `method` (必需): 必须为 `"move_file"`
- `source` (必需): 源路径
- `destination` (必需): 目标路径

### search_files 方法

- `method` (必需): 必须为 `"search_files"`
- `path` (必需): 搜索根目录
- `pattern` (必需): 搜索模式（支持通配符）
- `excludePatterns` (可选): 排除模式数组

### get_file_info 方法

- `method` (必需): 必须为 `"get_file_info"`
- `path` (必需): 文件或目录路径

### list_allowed_directories 方法

- `method` (必需): 必须为 `"list_allowed_directories"`
- 无需其他参数

## 返回格式

### read_text_file 返回

```json
"文件内容..."
```

### read_media_file 返回

```json
{
  "base64": "base64-encoded-data",
  "mimeType": "image/png"
}
```

### read_multiple_files 返回

```json
[
  {
    "path": "file1.txt",
    "content": "内容1",
    "success": true
  },
  {
    "path": "file2.txt",
    "error": "错误信息",
    "success": false
  }
]
```

### write_file 返回

```json
{
  "bytesWritten": 1024,
  "path": "~/.prompt-manager/test.txt"
}
```

### edit_file 返回

```json
{
  "editsApplied": 2,
  "path": "~/.prompt-manager/config.json"
}
```

### list_directory 返回

```json
[
  {
    "name": "file1.txt",
    "type": "file"
  },
  {
    "name": "dir1",
    "type": "directory"
  }
]
```

### get_file_info 返回

```json
{
  "size": 1024,
  "created": "2025-01-01T00:00:00.000Z",
  "modified": "2025-01-01T00:00:00.000Z",
  "accessed": "2025-01-01T00:00:00.000Z",
  "isDirectory": false,
  "isFile": true,
  "permissions": 33188
}
```

## 错误处理

工具定义了以下业务错误：

- `PATH_OUTSIDE_SCOPE`: 路径越权访问
- `FILE_NOT_FOUND`: 文件或目录不存在
- `PERMISSION_DENIED`: 权限不足
- `FILE_TOO_LARGE`: 文件过大
- `DIRECTORY_NOT_EMPTY`: 目录非空
- `INVALID_PATH`: 无效路径

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **路径限制**: 默认只能访问 `~/.prompt-manager` 目录，可通过环境变量配置额外允许的目录
3. **自动创建目录**: `write_file` 方法会自动创建父目录
4. **路径解析**: 支持 `~` 开头的路径（自动展开为用户主目录）
5. **文件大小**: 单文件大小建议不超过 10MB
6. **编辑操作**: `edit_file` 的 `oldText` 必须完全匹配文件中的文本
7. **搜索模式**: `search_files` 支持通配符（* 和 ?）

## 测试步骤

1. **重启服务器**（如果服务器已在运行）

2. **查看工具手册**
   ```yaml
   tool: tool://filesystem
   mode: manual
   ```

3. **配置环境变量**
   ```yaml
   tool: tool://filesystem
   mode: configure
   parameters:
     ALLOWED_DIRECTORIES: '["~/.prompt-manager"]'
   ```

4. **测试列出允许的目录**
   ```yaml
   tool: tool://filesystem
   mode: execute
   parameters:
     method: list_allowed_directories
   ```

5. **测试读取文件**
   ```yaml
   tool: tool://filesystem
   mode: execute
   parameters:
     method: read_text_file
     path: "~/.prompt-manager/test.txt"
   ```

6. **测试写入文件**
   ```yaml
   tool: tool://filesystem
   mode: execute
   parameters:
     method: write_file
     path: "~/.prompt-manager/test.txt"
     content: "Hello, World!"
   ```

## 开发说明

工具遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 符合工具开发指南的所有要求

## 版本历史

- **2.0.0** (2025-01-01): 当前版本
  - 实现所有 MCP 标准文件系统操作
  - 支持批量文件读取
  - 支持文件编辑和预览模式
  - 完整的错误处理和路径验证

