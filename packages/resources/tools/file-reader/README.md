# File Reader Tool

统一文件读取工具，支持本地和远程文件，自动识别文件类型并转换为模型友好格式。

## 功能特性

1. **统一接口** (`read_file`)
   - 支持本地文件（file:// 协议或本地路径）
   - 支持远程文件（http://, https://）
   - 自动识别文件类型
   - 智能转换为模型友好格式

2. **文件类型支持**
   - 文本文件（.txt, .md, .log 等）
   - 代码文件（.js, .py, .java 等）
   - 配置文件（.json, .yaml, .xml 等）
   - 图片文件（.png, .jpg, .gif 等）
   - 视频/音频文件（提取元信息）
   - 文档文件（PDF 等，需要配合 pdf-reader 工具）

3. **智能转换**
   - 自动检测编码格式（UTF-8, GBK 等）
   - JSON/YAML/XML 自动解析为对象
   - 图片转换为 base64 + 描述
   - 视频/音频提取元信息

4. **链接提取**
   - 支持提取文本中的嵌套链接
   - 递归读取链接内容
   - 防止无限递归

5. **缓存机制**
   - 自动缓存读取结果
   - 可配置缓存超时时间
   - 减少重复读取

## 环境变量配置

工具需要配置以下环境变量：

- `ALLOWED_DIRECTORIES` (可选): 允许访问的本地目录列表（JSON数组格式）
  - 默认值: `["~/.prompt-manager"]`
  - 示例: `["~/.prompt-manager", "/tmp"]`

- `ALLOWED_URLS` (可选): 允许访问的远程URL白名单（JSON数组格式，支持通配符）
  - 默认值: `["https://*", "http://*"]`
  - 示例: `["https://example.com/*", "https://*.github.com/*"]`

- `MAX_FILE_SIZE` (可选): 最大文件大小（字节），默认 `10485760` (10MB)

- `DEFAULT_TIMEOUT` (可选): 默认超时时间（毫秒），默认 `30000` (30秒)

- `DEFAULT_CACHE_TIMEOUT` (可选): 默认缓存超时时间（毫秒），默认 `600000` (10分钟)

- `MAX_RECURSION_DEPTH` (可选): 最大递归深度，默认 `3`

## 使用方法

### 1. 配置环境变量

```yaml
tool: tool://file-reader
mode: configure
parameters:
  ALLOWED_DIRECTORIES: '["~/.prompt-manager", "/tmp"]'
  ALLOWED_URLS: '["https://*", "http://*"]'
  MAX_FILE_SIZE: "10485760"
```

### 2. 读取本地文件

```yaml
tool: tool://file-reader
mode: execute
parameters:
  method: read_file
  url: "~/.prompt-manager/config.json"
  convertTo: "auto"  # auto, text, json, xml, image, video, audio
  encoding: "auto"  # auto, utf-8, gbk, etc.
```

### 3. 读取远程文件

```yaml
tool: tool://file-reader
mode: execute
parameters:
  method: read_file
  url: "https://example.com/data.json"
  convertTo: "json"
```

### 4. 提取嵌套链接

```yaml
tool: tool://file-reader
mode: execute
parameters:
  method: read_file
  url: "https://example.com/index.md"
  extractLinks: true
  maxDepth: 3
```

## 参数说明

### read_file 方法

- `method` (必需): 必须为 `"read_file"`
- `url` (必需): 文件URL或路径（支持 file://, http://, https:// 或本地路径）
- `encoding` (可选): 文本文件编码（默认自动检测，支持 utf-8, gbk, gb2312等），默认 `"auto"`
- `convertTo` (可选): 转换目标格式（auto/text/json/xml/image/video/audio），默认 `"auto"`
- `includeMetadata` (可选): 是否包含文件元信息，默认 `true`
- `maxSize` (可选): 最大文件大小（字节），默认 `10485760` (10MB)
- `timeout` (可选): 远程文件下载超时时间（毫秒），默认 `30000` (30秒)
- `basePath` (可选): 基础路径（用于解析相对路径）
- `extractLinks` (可选): 是否提取并读取文本中的嵌套链接，默认 `false`
- `maxDepth` (可选): 递归读取链接的最大深度（防止无限递归），默认 `3`，范围 1-10
- `cacheTimeout` (可选): 缓存超时时间（毫秒），默认 `600000` (10分钟)
- `useCache` (可选): 是否使用缓存，默认 `true`

## 返回格式

### 文本文件返回

```json
{
  "success": true,
  "source": {
    "url": "file:///path/to/file.txt",
    "resolvedUrl": "/path/to/file.txt",
    "type": "local",
    "path": "/path/to/file.txt"
  },
  "file": {
    "type": "text",
    "mimeType": "text/plain",
    "encoding": "utf-8",
    "size": 1024
  },
  "content": "文件内容...",
  "format": "text",
  "metadata": {
    "detectedType": "text",
    "conversion": "text_decode",
    "originalSize": 1024,
    "convertedSize": 1024,
    "fromCache": false,
    "nestedLinksCount": 0
  }
}
```

### JSON文件返回

```json
{
  "success": true,
  "source": {
    "url": "https://example.com/data.json",
    "resolvedUrl": "https://example.com/data.json",
    "type": "remote",
    "path": "https://example.com/data.json"
  },
  "file": {
    "type": "json",
    "mimeType": "application/json",
    "encoding": "utf-8",
    "size": 2048
  },
  "content": {
    "key": "value"
  },
  "format": "json",
  "metadata": {
    "detectedType": "json",
    "conversion": "json_parse",
    "originalSize": 2048,
    "convertedSize": 512,
    "fromCache": false
  }
}
```

### 图片文件返回

```json
{
  "success": true,
  "file": {
    "type": "image",
    "mimeType": "image/png",
    "size": 8192
  },
  "content": {
    "dataUrl": "data:image/png;base64,...",
    "base64": "...",
    "mimeType": "image/png",
    "dimensions": {
      "width": 800,
      "height": 600
    },
    "size": 8192,
    "description": "图片文件，格式: image/png，大小: 8.00KB，尺寸: 800x600"
  },
  "format": "image"
}
```

## 错误处理

工具定义了以下业务错误：

- `INVALID_URL`: 无效的URL格式
- `URL_NOT_ALLOWED`: URL不在白名单中
- `FILE_NOT_FOUND`: 文件不存在
- `FILE_TOO_LARGE`: 文件过大
- `NETWORK_ERROR`: 网络错误
- `PERMISSION_DENIED`: 权限不足
- `UNSUPPORTED_ENCODING`: 不支持的编码格式
- `PARSE_ERROR`: 文件解析失败
- `PATH_OUTSIDE_SCOPE`: 路径越权访问

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **URL白名单**: 远程文件需要配置 `ALLOWED_URLS` 白名单
3. **文件大小限制**: 默认最大文件大小为 10MB，可通过环境变量调整
4. **编码检测**: 自动编码检测可能不准确，建议明确指定编码
5. **链接提取**: 递归读取链接时注意 `maxDepth` 设置，避免无限递归
6. **缓存机制**: 使用缓存可提高性能，但可能返回过期数据
7. **相对路径**: 使用相对路径时需要提供 `basePath` 参数

## 测试步骤

1. **重启服务器**（如果服务器已在运行）

2. **查看工具手册**
   ```yaml
   tool: tool://file-reader
   mode: manual
   ```

3. **配置环境变量**
   ```yaml
   tool: tool://file-reader
   mode: configure
   parameters:
     ALLOWED_DIRECTORIES: '["~/.prompt-manager"]'
     ALLOWED_URLS: '["https://*", "http://*"]'
   ```

4. **测试读取本地文件**
   ```yaml
   tool: tool://file-reader
   mode: execute
   parameters:
     method: read_file
     url: "~/.prompt-manager/test.txt"
   ```

5. **测试读取远程文件**
   ```yaml
   tool: tool://file-reader
   mode: execute
   parameters:
     method: read_file
     url: "https://example.com/data.json"
     convertTo: "json"
   ```

## 开发说明

工具遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 符合工具开发指南的所有要求

## 版本历史

- **1.0.0** (2025-01-01): 初始版本
  - 实现统一文件读取接口
  - 支持本地和远程文件
  - 自动识别文件类型并转换
  - 支持链接提取和缓存机制

