# PDF Reader Tool

PDF 分页阅读工具，支持按页码提取文本和图片，智能缓存避免重复解析。

## 功能特性

1. **分页阅读** (`read_pdf`)
   - 不传 `pages` 参数：只返回 PDF 元信息（总页数、标题等）
   - 传单个页码：读取指定页的文本和图片
   - 传页码数组：批量读取多页内容

2. **智能缓存**
   - 自动缓存 PDF 元信息
   - 缓存已解析的页面内容
   - 避免重复解析，提高性能

3. **图片提取**
   - 支持提取 PDF 中的图片
   - 图片存储在工具目录的 `pdf-cache` 子目录
   - 返回图片路径和元信息

## 环境变量配置

工具需要配置以下环境变量：

- `ALLOWED_DIRECTORIES` (可选): 允许访问的目录列表（JSON数组格式）
  - 默认值: `["~/.prompt-manager"]`
  - 示例: `["~/.prompt-manager", "/tmp"]`

## 使用方法

### 1. 配置环境变量

```yaml
tool: tool://pdf-reader
mode: configure
parameters:
  ALLOWED_DIRECTORIES: '["~/.prompt-manager"]'
```

### 2. 获取 PDF 元信息

```yaml
tool: tool://pdf-reader
mode: execute
parameters:
  method: read_pdf
  pdfPath: "~/.prompt-manager/document.pdf"
  # 不传 pages 参数，只返回元信息
```

### 3. 读取指定页面

```yaml
tool: tool://pdf-reader
mode: execute
parameters:
  method: read_pdf
  pdfPath: "~/.prompt-manager/document.pdf"
  pages: 1  # 读取第1页
  extractImages: true  # 可选，是否提取图片
```

### 4. 批量读取多页

```yaml
tool: tool://pdf-reader
mode: execute
parameters:
  method: read_pdf
  pdfPath: "~/.prompt-manager/document.pdf"
  pages: [1, 2, 3]  # 读取第1、2、3页
  extractImages: true
```

### 5. 强制刷新缓存

```yaml
tool: tool://pdf-reader
mode: execute
parameters:
  method: read_pdf
  pdfPath: "~/.prompt-manager/document.pdf"
  pages: 1
  forceRefresh: true  # 强制重新解析，忽略缓存
```

## 参数说明

### read_pdf 方法

- `method` (必需): 必须为 `"read_pdf"`
- `pdfPath` (必需): PDF 文件的绝对路径或相对路径（相对于允许的目录）
- `pages` (可选): 要读取的页码
  - 不传：只返回 PDF 元信息
  - 传数字：读取单页（如 `1`）
  - 传数组：读取多页（如 `[1, 2, 3]`）
- `extractImages` (可选): 是否提取图片，默认 `true`
- `forceRefresh` (可选): 强制重新解析，忽略缓存，默认 `false`

## 返回格式

### 只获取元信息（不传 pages）

```json
{
  "success": true,
  "metadata": {
    "totalPages": 10,
    "title": "文档标题",
    "author": "作者",
    "cachedPages": 0
  },
  "message": "使用 pages 参数指定要读取的页码，例如：pages: 1 或 pages: [1,2,3]"
}
```

### 读取页面内容

```json
{
  "success": true,
  "metadata": {
    "totalPages": 10,
    "title": "文档标题",
    "author": "作者",
    "requestedPages": [1, 2]
  },
  "content": {
    "text": "\n=== 第 1 页 ===\n页面1内容...\n=== 第 2 页 ===\n页面2内容...",
    "pages": [
      {
        "page": 1,
        "hasImages": true,
        "imageCount": 2,
        "images": [
          {
            "page": 1,
            "index": 0,
            "path": "/path/to/pdf-cache/hash/page-1-img-0.png",
            "width": null,
            "height": null
          }
        ],
        "fromCache": false
      }
    ],
    "hasImages": true,
    "imageCount": 2,
    "imagesDirectory": "/path/to/pdf-cache/hash"
  },
  "cache": {
    "hits": 0,
    "misses": 2,
    "totalCachedPages": 2
  }
}
```

## 错误处理

工具定义了以下业务错误：

- `PATH_OUTSIDE_SCOPE`: 路径越权访问
- `FILE_NOT_FOUND`: PDF文件不存在
- `INVALID_PDF`: 无效的PDF文件
- `PERMISSION_DENIED`: 权限不足
- `PAGE_OUT_OF_RANGE`: 页码超出范围

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **路径限制**: 默认只能访问 `~/.prompt-manager` 目录，可通过环境变量配置额外允许的目录
3. **缓存机制**: PDF 元信息和已解析的页面会被缓存，提高后续读取性能
4. **图片存储**: 提取的图片存储在工具目录的 `pdf-cache/{pdf-hash}/` 目录下
5. **页码范围**: 页码从 1 开始，必须小于等于总页数
6. **大文件处理**: 大文件可能需要较长时间处理，建议先获取元信息了解总页数
7. **图片提取**: 图片提取依赖于 PDF 的图片存储格式，某些 PDF 可能无法提取图片

## 测试步骤

1. **重启服务器**（如果服务器已在运行）

2. **查看工具手册**
   ```yaml
   tool: tool://pdf-reader
   mode: manual
   ```

3. **配置环境变量**
   ```yaml
   tool: tool://pdf-reader
   mode: configure
   parameters:
     ALLOWED_DIRECTORIES: '["~/.prompt-manager"]'
   ```

4. **测试获取 PDF 元信息**
   ```yaml
   tool: tool://pdf-reader
   mode: execute
   parameters:
     method: read_pdf
     pdfPath: "~/.prompt-manager/test.pdf"
   ```

5. **测试读取指定页面**
   ```yaml
   tool: tool://pdf-reader
   mode: execute
   parameters:
     method: read_pdf
     pdfPath: "~/.prompt-manager/test.pdf"
     pages: 1
     extractImages: true
   ```

## 开发说明

工具基于 `pdf-parse` 库开发，遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 智能缓存机制
- 符合工具开发指南的所有要求

## 版本历史

- **2.1.0** (2025-01-01): 当前版本
  - 实现 PDF 分页阅读功能
  - 支持图片提取
  - 智能缓存机制
  - 完整的错误处理

