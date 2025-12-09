# Chrome DevTools Tool

基于 chrome-devtools-mcp 的浏览器自动化工具，完全复用官方实现。支持页面导航、元素操作、性能分析、网络监控、控制台监控等功能。

## 功能特性

1. **输入自动化** (`click`, `fill`, `hover`, `press_key`, `drag`, `upload_file`, `handle_dialog`, `fill_form`)
   - 点击、填写、悬停、按键、拖拽等交互操作
   - 支持文件上传和对话框处理
   - 批量表单填写

2. **导航自动化** (`navigate_page`, `new_page`, `close_page`, `list_pages`, `select_page`, `wait_for`)
   - 页面导航（URL、前进、后退、刷新）
   - 多页面管理
   - 等待页面元素或文本出现

3. **网络监控** (`list_network_requests`, `get_network_request`)
   - 监控网络请求
   - 查看请求详情（方法、URL、状态、头部等）

4. **性能分析** (`performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight`)
   - 性能追踪和 Core Web Vitals 分析
   - 性能洞察分析

5. **调试功能** (`evaluate_script`, `get_console_message`, `list_console_messages`, `take_screenshot`, `take_snapshot`)
   - 执行 JavaScript 代码
   - 监控控制台消息
   - 页面截图和快照

6. **设备模拟** (`emulate`, `resize_page`)
   - 模拟网络条件和 CPU 降速
   - 调整页面尺寸

## 环境变量配置

工具支持以下环境变量：

- `CHROME_HEADLESS` (可选): 是否无头模式（true/false），默认 `true`
- `CHROME_CHANNEL` (可选): Chrome 渠道（stable/canary/beta/dev），默认 `stable`
- `CHROME_ISOLATED` (可选): 是否使用隔离的用户数据目录（true/false），默认 `false`

## 使用方法

### 1. 配置环境变量

```yaml
tool: tool://chrome-devtools
mode: configure
parameters:
  CHROME_HEADLESS: "true"
  CHROME_CHANNEL: "stable"
  CHROME_ISOLATED: "false"
```

### 2. 导航到页面

```yaml
tool: tool://chrome-devtools
mode: execute
parameters:
  method: navigate_page
  url: "https://example.com"
  type: "url"
  options:
    headless: true
    keepAlive: false
```

### 3. 获取页面快照

```yaml
tool: tool://chrome-devtools
mode: execute
parameters:
  method: take_snapshot
  verbose: false
```

### 4. 点击元素

```yaml
tool: tool://chrome-devtools
mode: execute
parameters:
  method: click
  uid: "element-uid-from-snapshot"
  dblClick: false
```

### 5. 填写表单

```yaml
tool: tool://chrome-devtools
mode: execute
parameters:
  method: fill
  uid: "input-uid-from-snapshot"
  value: "要填写的内容"
```

### 6. 截图

```yaml
tool: tool://chrome-devtools
mode: execute
parameters:
  method: take_screenshot
  format: "png"
  fullPage: false
  filePath: "screenshot.png"  # 可选
```

### 7. 性能分析

```yaml
tool: tool://chrome-devtools
mode: execute
parameters:
  method: performance_start_trace
  reload: true
  autoStop: true
```

## 参数说明

### 通用参数

- `method` (必需): 操作方法名称
- `keepAlive` (可选): 操作完成后是否保持浏览器打开（默认 false）。设置为 true 时，浏览器会保持打开状态，可用于连续操作或调试
- `options` (可选): 操作选项对象
  - `headless`: 是否无头模式
  - `channel`: Chrome 渠道
  - `isolated`: 是否使用隔离的用户数据目录
  - `keepAlive`: 是否保持浏览器打开
- `timeout` (可选): 超时时间（毫秒），默认 30000

### 导航相关参数

- `url`: 目标 URL（navigate_page、new_page 方法）
- `type`: 导航类型（url/back/forward/reload），默认 `url`
- `ignoreCache`: 是否忽略缓存，默认 `false`
- `pageIdx`: 页面索引（select_page、close_page 方法）

### 元素操作参数

- `uid`: 元素的唯一标识符（从页面快照中获取）
- `value`: 要填写的值（fill 方法）
- `key`: 按键或组合键（press_key 方法，如 "Enter", "Control+A"）
- `from_uid`: 拖拽源元素的 uid（drag 方法）
- `to_uid`: 拖拽目标元素的 uid（drag 方法）
- `filePath`: 文件路径（upload_file 方法）
- `action`: 对话框操作（handle_dialog 方法：accept/dismiss）
- `elements`: 表单元素数组（fill_form 方法）

### 网络监控参数

- `includePreservedRequests`: 是否包含保留的请求，默认 `false`
- `resourceTypes`: 资源类型过滤数组
- `pageSize`: 最大返回数量
- `reqid`: 网络请求ID（get_network_request 方法，可选）

### 性能分析参数

- `reload`: 是否重新加载页面（performance_start_trace 方法，必需）
- `autoStop`: 是否自动停止追踪（performance_start_trace 方法，必需）
- `insightName`: 性能洞察名称（performance_analyze_insight 方法，必需）
- `insightSetId`: 性能洞察集合ID（performance_analyze_insight 方法，必需）

### 调试参数

- `function`: 要执行的JavaScript函数（evaluate_script 方法）
- `args`: 函数参数数组（evaluate_script 方法）
- `msgid`: 控制台消息ID（get_console_message 方法）
- `types`: 消息类型过滤数组（list_console_messages 方法）
- `verbose`: 是否详细模式（take_snapshot 方法），默认 `false`

### 截图参数

- `format`: 截图格式（png/jpeg/webp），默认 `png`
- `fullPage`: 是否截取整页（与 uid 不兼容），默认 `false`
- `quality`: 压缩质量（0-100，仅用于 JPEG 和 WebP）
- `uid`: 元素 uid（截取特定元素）

## 返回格式

### 导航返回

```json
{
  "success": true,
  "method": "navigate_page",
  "text": "页面标题",
  "pages": [
    {
      "index": 0,
      "title": "页面标题",
      "selected": true
    }
  ]
}
```

### 快照返回

```json
{
  "success": true,
  "method": "take_snapshot",
  "snapshot": "Page Snapshot:\n[1] heading: 标题\n[2] button: 按钮\n..."
}
```

### 截图返回

```json
{
  "success": true,
  "method": "take_screenshot",
  "images": [
    {
      "data": "base64-encoded-image-data",
      "mimeType": "image/png"
    }
  ]
}
```

## 错误处理

工具定义了以下业务错误：

- `BROWSER_LAUNCH_FAILED`: 浏览器启动失败
- `NAVIGATION_FAILED`: 页面导航失败
- `ELEMENT_NOT_FOUND`: 元素未找到
- `SCREENSHOT_FAILED`: 截图失败
- `NETWORK_ERROR`: 网络错误
- `INVALID_UID`: 无效的元素标识符
- `TIMEOUT`: 操作超时
- `PAGE_CLOSED`: 页面已关闭

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **浏览器安装**: 首次使用时需要安装 Chrome 浏览器（会自动安装）
3. **浏览器生命周期**: 默认情况下操作完成后会自动关闭浏览器（可通过 `keepAlive` 参数控制）
4. **跨执行保持**: 使用 `keepAlive: true` 时，浏览器实例会跨执行保持，便于连续操作
5. **快照失效**: 页面导航后，旧的快照会失效，需要重新获取
6. **元素标识符**: 操作元素前必须先调用 `take_snapshot` 获取页面快照，然后使用快照中的 `uid`
7. **数据存储**: 工具数据存储在 `~/.prompt-manager/toolbox/chrome-devtools/data/` 目录下

## 测试步骤

1. **重启服务器**（如果服务器已在运行）

2. **查看工具手册**
   ```yaml
   tool: tool://chrome-devtools
   mode: manual
   ```

3. **配置环境变量**
   ```yaml
   tool: tool://chrome-devtools
   mode: configure
   parameters:
     CHROME_HEADLESS: "true"
   ```

4. **测试导航和快照**
   ```yaml
   tool: tool://chrome-devtools
   mode: execute
   parameters:
     method: navigate_page
     url: "https://example.com"
   ```

   ```yaml
   tool: tool://chrome-devtools
   mode: execute
   parameters:
     method: take_snapshot
   ```

5. **测试截图**
   ```yaml
   tool: tool://chrome-devtools
   mode: execute
   parameters:
     method: take_screenshot
     fullPage: true
   ```

## 开发说明

工具基于 [chrome-devtools-mcp](https://github.com/modelcontextprotocol/servers/tree/main/src/chrome-devtools) 开发，完全复用官方实现，遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 符合工具开发指南的所有要求

## 版本历史

- **1.0.0** (2025-01-01): 初始版本
  - 实现所有 chrome-devtools-mcp 功能
  - 支持 keepAlive 参数保持浏览器状态
  - 完整的错误处理和日志记录

