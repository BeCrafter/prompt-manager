# Playwright Tool

基于 Playwright 的浏览器自动化工具，支持页面导航、元素操作、截图、内容提取等功能。

## 功能特性

1. **页面导航** (`navigate`, `goBack`, `goForward`, `reload`)
   - 导航到指定 URL
   - 浏览器前进/后退
   - 刷新页面

2. **元素操作** (`click`, `fill`, `waitForSelector`)
   - 点击元素
   - 填写表单
   - 等待元素出现

3. **内容获取** (`getContent`, `getTitle`, `getUrl`)
   - 获取页面 HTML 内容
   - 获取页面标题
   - 获取当前 URL

4. **截图功能** (`screenshot`)
   - 页面截图
   - 支持整页截图
   - 自动保存到工具目录

5. **脚本执行** (`evaluate`)
   - 在页面中执行 JavaScript 代码
   - 获取执行结果

6. **浏览器管理** (`close`)
   - 关闭浏览器实例

## 环境变量配置

工具支持以下环境变量：

- `PLAYWRIGHT_BROWSER` (可选): 默认浏览器类型（chromium/firefox/webkit），默认 `chromium`
- `PLAYWRIGHT_HEADLESS` (可选): 是否无头模式（true/false），默认 `true`
- `PLAYWRIGHT_TIMEOUT` (可选): 默认超时时间（毫秒），默认 `30000`

## 使用方法

### 1. 配置环境变量

```yaml
tool: tool://playwright
mode: configure
parameters:
  PLAYWRIGHT_BROWSER: "chromium"
  PLAYWRIGHT_HEADLESS: "true"
  PLAYWRIGHT_TIMEOUT: "30000"
```

### 2. 导航到页面

```yaml
tool: tool://playwright
mode: execute
parameters:
  method: navigate
  url: "https://example.com"
  options:
    headless: true
    waitUntil: "load"
    timeout: 30000
```

### 3. 点击元素

```yaml
tool: tool://playwright
mode: execute
parameters:
  method: click
  selector: "button#submit"
  options:
    timeout: 5000
```

### 4. 填写表单

```yaml
tool: tool://playwright
mode: execute
parameters:
  method: fill
  selector: "input#username"
  text: "用户名"
```

### 5. 截图

```yaml
tool: tool://playwright
mode: execute
parameters:
  method: screenshot
  url: "https://example.com"  # 可选，如果页面未导航则自动导航
  fullPage: true
  screenshotPath: "screenshot.png"  # 可选，默认保存到工具目录
```

### 6. 获取页面内容

```yaml
tool: tool://playwright
mode: execute
parameters:
  method: getContent
```

### 7. 执行脚本

```yaml
tool: tool://playwright
mode: execute
parameters:
  method: evaluate
  script: "document.title"
```

### 8. 保持浏览器打开（连续操作）

```yaml
tool: tool://playwright
mode: execute
parameters:
  method: navigate
  url: "https://example.com"
  keepAlive: true  # 保持浏览器打开
  options:
    keepAlive: true
```

## 参数说明

### 通用参数

- `method` (必需): 操作方法名称
- `keepAlive` (可选): 操作完成后是否保持浏览器打开（默认 false）。设置为 true 时，浏览器会保持打开状态，可用于连续操作或调试
- `options` (可选): 操作选项对象
  - `browser`: 浏览器类型（chromium/firefox/webkit），默认 `chromium`
  - `headless`: 是否无头模式，默认 `true`
  - `timeout`: 超时时间（毫秒），默认 `30000`
  - `waitUntil`: 等待页面加载状态（load/domcontentloaded/networkidle），默认 `load`
  - `keepAlive`: 是否保持浏览器打开，默认 `false`

### 导航相关参数

- `url`: 目标 URL（navigate 方法必需，screenshot 方法可选）

### 元素操作参数

- `selector`: CSS选择器（click、fill、waitForSelector 方法需要）
- `text`: 要填写的文本（fill 方法需要）

### 截图参数

- `screenshotPath`: 截图保存路径（可选，默认保存到工具目录的 data 子目录）
- `fullPage`: 是否截取整页，默认 `false`
- `url`: 目标 URL（可选，如果页面未导航则自动导航）

### 脚本执行参数

- `script`: 要执行的JavaScript代码（evaluate 方法需要）

## 返回格式

### navigate 返回

```json
{
  "success": true,
  "url": "https://example.com",
  "title": "页面标题"
}
```

### click 返回

```json
{
  "success": true,
  "selector": "button#submit"
}
```

### fill 返回

```json
{
  "success": true,
  "selector": "input#username",
  "text": "用户名"
}
```

### screenshot 返回

```json
{
  "success": true,
  "path": "/path/to/screenshot.png",
  "url": "https://example.com"
}
```

### getContent 返回

```json
{
  "success": true,
  "content": "<html>...</html>",
  "length": 1024
}
```

### evaluate 返回

```json
{
  "success": true,
  "result": "执行结果"
}
```

## 错误处理

工具定义了以下业务错误：

- `BROWSER_LAUNCH_FAILED`: 浏览器启动失败
- `NAVIGATION_FAILED`: 页面导航失败
- `ELEMENT_NOT_FOUND`: 元素未找到
- `SCREENSHOT_FAILED`: 截图失败
- `NETWORK_ERROR`: 网络错误
- `INVALID_SELECTOR`: 无效的选择器
- `TIMEOUT`: 操作超时

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **浏览器安装**: 首次使用时需要安装 Playwright 浏览器（会自动安装，可能需要几分钟）
3. **浏览器生命周期**: 默认情况下操作完成后会自动关闭浏览器（可通过 `keepAlive` 参数控制）
4. **跨执行保持**: 使用 `keepAlive: true` 时，浏览器实例会跨执行保持，便于连续操作
5. **一个指令一个页面**: 一个指令（一个 execute 调用）中只会使用一个浏览器窗口/页面实例
6. **数据存储**: 工具数据存储在 `~/.prompt-manager/toolbox/playwright/data/` 目录下
7. **浏览器二进制**: 浏览器二进制文件会下载到 `~/.cache/ms-playwright/` 目录

## 测试步骤

1. **重启服务器**（如果服务器已在运行）

2. **查看工具手册**
   ```yaml
   tool: tool://playwright
   mode: manual
   ```

3. **配置环境变量**
   ```yaml
   tool: tool://playwright
   mode: configure
   parameters:
     PLAYWRIGHT_BROWSER: "chromium"
     PLAYWRIGHT_HEADLESS: "true"
   ```

4. **测试导航**
   ```yaml
   tool: tool://playwright
   mode: execute
   parameters:
     method: navigate
     url: "https://example.com"
   ```

5. **测试截图**
   ```yaml
   tool: tool://playwright
   mode: execute
   parameters:
     method: screenshot
     url: "https://example.com"
     fullPage: true
   ```

## 开发说明

工具基于 Playwright 库开发，遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 智能浏览器生命周期管理
- 符合工具开发指南的所有要求

## 版本历史

- **1.1.0** (2025-01-01): 当前版本
  - 实现所有 Playwright 核心功能
  - 支持 keepAlive 参数保持浏览器状态
  - 自动浏览器安装和验证
  - 完整的错误处理和日志记录

