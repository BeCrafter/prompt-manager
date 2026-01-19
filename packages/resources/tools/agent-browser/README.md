# agent-browser 工具

AI 友好的浏览器自动化工具，基于 Vercel Labs 的 agent-browser npm 包，提供基于引用的确定性元素选择和 93% 上下文节省。

## 功能特性

- ✅ **AI 优先设计** - 专为 Claude Code、Cursor、Copilot 等 AI 智能体优化
- ✅ **93% 上下文节省** - 通过 Snapshot + Refs 机制，仅返回简化的元素引用列表
- ✅ **确定性选择** - 使用 `@e1`、`@e2` 引用代替易变的 CSS 选择器
- ✅ **完整功能** - 支持 50+ 命令，涵盖导航、表单、截图、网络、存储等
- ✅ **会话管理** - 支持多个隔离的浏览器实例
- ✅ **多浏览器支持** - Chromium、Firefox、WebKit
- ✅ **直接 API** - 使用 BrowserManager 类，避免 CLI 解析开销

## 安装

此工具会自动安装 `agent-browser` npm 包到工具的 node_modules 目录。

首次使用时可能需要安装 Chromium 浏览器：

```bash
# 自动安装（首次启动时）
# 或手动安装
npm install agent-browser
npx agent-browser install
```

## 核心概念

### Refs（元素引用）

Ref 系统是 agent-browser 的核心特性，提供确定性的元素选择：

```bash
# 1. 获取快照（带 refs）
action: snapshot

# 输出示例：
# - heading "Example Domain" [ref=e1]
# - button "Submit" [ref=e2]
# - textbox "Email" [ref=e3]
# - link "Learn more" [ref=e4]

# 2. 使用 refs 进行交互
action: click
selector: "@e2"        # 点击按钮

action: fill
selector: "@e3"        # 填充邮箱字段
text: "test@example.com"

action: click
selector: "@e2"        # 提交表单
```

**为什么使用 refs？**
- ✅ **确定性** - Ref 指向快照中的确切元素
- ✅ **快速** - 无需重新查询 DOM
- ✅ **AI 友好** - Snapshot + ref 工作流对 LLM 最优

## 使用方式

### 方式一：通过 Prompt Manager 工具系统调用

#### 基本工作流

```yaml
# 1. 启动浏览器
tool: tool://agent-browser
mode: execute
parameters:
  action: launch
  options:
    headless: false  # 显示浏览器窗口用于调试

# 2. 导航到 URL
tool: tool://agent-browser
mode: execute
parameters:
  action: navigate
  url: "https://example.com"
  waitUntil: "load"

# 3. 获取快照（交互元素）
tool: tool://agent-browser
mode: execute
parameters:
  action: snapshot
  interactive: true

# 4. 使用 refs 点击元素
tool: tool://agent-browser
mode: execute
parameters:
  action: click
  selector: "@e2"

# 5. 填充表单
tool: tool://agent-browser
mode: execute
parameters:
  action: fill
  selector: "@e3"
  value: "test@example.com"

# 6. 截图
tool: tool://agent-browser
mode: execute
parameters:
  action: screenshot
  screenshotPath: "/path/to/screenshot.png"
  fullPage: true

# 7. 关闭浏览器
tool: tool://agent-browser
mode: execute
parameters:
  action: close
```

#### 表单填充示例

```yaml
# 填充登录表单
tool: tool://agent-browser
mode: execute
parameters:
  action: fill
  selector: "#username"
  value: "myusername"

tool: tool://agent-browser
mode: execute
parameters:
  action: fill
  selector: "#password"
  value: "mypassword"

tool: tool://agent-browser
mode: execute
parameters:
  action: click
  selector: "#login-button"
```

#### 语义定位器示例

```yaml
# 通过角色查找并点击
tool: tool://agent-browser
mode: execute
parameters:
  action: getbyrole
  role: "button"
  name: "Submit"
  subaction: "click"

# 通过文本查找并填充
tool: tool://agent-browser
mode: execute
parameters:
  action: getbytext
  text: "Email"
  subaction: "fill"
  value: "user@example.com"

# 通过标签查找并操作
tool: tool://agent-browser
mode: execute
parameters:
  action: getbylabel
  label: "Password"
  subaction: "fill"
  value: "secret123"
```

### 方式二：高级方法调用

工具内部也提供高级方法，可以直接调用：

```javascript
// 获取带引用的快照
const snapshot = await tool.getSnapshotWithRefs({ 
  interactive: true,
  maxDepth: 5 
});

// 导航
await tool.navigate('https://example.com', { 
  headless: false 
});

// 使用引用交互
await tool.click('@e2');
await tool.fill('@e3', 'test@example.com');

// 截图
await tool.screenshot('/path/to/screenshot.png', { 
  fullPage: true 
});
```

## 完整操作列表

### 核心命令

| Action | 描述 | 参数 |
|--------|------|------|
| `launch` | 启动浏览器 | `headless`, `viewport`, `device`, `executablePath` |
| `navigate` | 导航到 URL | `url`, `waitUntil`, `headers` |
| `click` | 点击元素 | `selector`, `button`, `clickCount`, `delay` |
| `type` | 输入文本 | `selector`, `text`, `delay`, `clear` |
| `fill` | 填充输入框 | `selector`, `value` |
| `check` | 勾选复选框 | `selector` |
| `uncheck` | 取消勾选 | `selector` |
| `upload` | 上传文件 | `selector`, `files` |
| `dblclick` | 双击 | `selector` |
| `focus` | 聚焦元素 | `selector` |
| `drag` | 拖拽 | `source`, `target` |
| `screenshot` | 截图 | `screenshotPath`, `fullPage`, `screenshotFormat`, `quality` |
| `snapshot` | 获取快照 | `interactive`, `maxDepth`, `compact`, `selector` |
| `evaluate` | 执行 JavaScript | `script`, `scriptArgs` |
| `wait` | 等待 | `selector`, `timeout`, `state` |
| `scroll` | 滚动 | `selector`, `direction`, `amount`, `x`, `y` |
| `select` | 选择下拉选项 | `selector`, `values` |
| `hover` | 悬停 | `selector` |
| `content` | 获取内容 | `selector` |
| `close` | 关闭浏览器 | - |
| `back` | 后退 | - |
| `forward` | 前进 | - |
| `reload` | 刷新 | - |

### 语义定位器

| Action | 描述 | 参数 |
|--------|------|------|
| `getbyrole` | 按 ARIA 角色查找 | `role`, `name`, `subaction`, `value` |
| `getbytext` | 按文本内容查找 | `text`, `exact`, `subaction` |
| `getbylabel` | 按标签查找 | `label`, `subaction`, `value` |
| `getbyplaceholder` | 按占位符查找 | `placeholder`, `subaction`, `value` |
| `getbyalttext` | 按 alt 文本查找 | `altText`, `exact`, `subaction` |
| `getbytitle` | 按 title 属性查找 | `name`, `exact`, `subaction` |
| `getbytestid` | 按 data-testid 查找 | `testId`, `subaction`, `value` |
| `nth` | 第 N 个元素 | `selector`, `index`, `subaction`, `value` |

### 信息获取

| Action | 描述 | 参数 |
|--------|------|------|
| `gettext` | 获取文本 | `selector` |
| `gethtml` | 获取 HTML | `selector` |
| `getattribute` | 获取属性 | `selector`, `attribute` |
| `isvisible` | 检查可见性 | `selector` |
| `isenabled` | 检查是否启用 | `selector` |
| `ischecked` | 检查是否勾选 | `selector` |
| `count` | 计数元素 | `selector` |
| `boundingbox` | 获取边界框 | `selector` |
| `url` | 获取当前 URL | - |
| `title` | 获取页面标题 | - |

### 标签页和窗口

| Action | 描述 | 参数 |
|--------|------|------|
| `tab_new` | 新建标签页 | - |
| `tab_list` | 列出标签页 | - |
| `tab_switch` | 切换标签页 | `index` |
| `tab_close` | 关闭标签页 | `index` |
| `window_new` | 新建窗口 | `viewport` |

### Cookie 和存储

| Action | 描述 | 参数 |
|--------|------|------|
| `cookies_get` | 获取 Cookies | `urls` |
| `cookies_set` | 设置 Cookies | `cookies` |
| `cookies_clear` | 清除 Cookies | - |
| `storage_get` | 获取存储 | `key`, `storageType` |
| `storage_set` | 设置存储 | `key`, `value`, `storageType` |
| `storage_clear` | 清除存储 | `storageType` |

### 网络和路由

| Action | 描述 | 参数 |
|--------|------|------|
| `route` | 添加路由 | `routeUrl`, `responseBody`, `abort` |
| `unroute` | 移除路由 | `routeUrl` |
| `requests` | 查看请求 | `filter`, `clearRequests` |
| `download` | 下载文件 | `selector`, `downloadPath` |

### 设置和模拟

| Action | 描述 | 参数 |
|--------|------|------|
| `viewport` | 设置视口 | `width`, `height` |
| `device` | 设备模拟 | `device` |
| `geolocation` | 地理位置 | `latitude`, `longitude`, `accuracy` |
| `permissions` | 权限设置 | `permissions`, `grant` |
| `useragent` | User Agent | `userAgent` |
| `timezone` | 时区 | `timezone` |
| `locale` | 区域设置 | `locale` |
| `offline` | 离线模式 | `offline` |
| `headers` | HTTP 头部 | `headers` |

### 高级功能

| Action | 描述 | 参数 |
|--------|------|------|
| `dialog` | 处理对话框 | `dialogResponse`, `promptText` |
| `pdf` | 保存为 PDF | `pdfPath`, `format` |
| `tracing` | 追踪 | `tracePath` |
| `har` | HAR 录制 | `harPath` |
| `console` | 控制台消息 | `clearConsole` |
| `errors` | 页面错误 | `clearErrors` |

## 完整示例

### 示例 1：登录流程

```yaml
# 1. 导航到登录页
tool: tool://agent-browser
mode: execute
parameters:
  action: navigate
  url: "https://example.com/login"

# 2. 获取快照
tool: tool://agent-browser
mode: execute
parameters:
  action: snapshot
  interactive: true

# 3. 填充用户名
tool: tool://agent-browser
mode: execute
parameters:
  action: fill
  selector: "@e3"
  value: "myusername"

# 4. 填充密码
tool: tool://agent-browser
mode: execute
parameters:
  action: fill
  selector: "@e4"
  value: "mypassword"

# 5. 点击登录按钮
tool: tool://agent-browser
mode: execute
parameters:
  action: click
  selector: "@e5"

# 6. 等待跳转
tool: tool://agent-browser
mode: execute
parameters:
  action: wait
  state: "visible"
  selector: "#dashboard"
```

### 示例 2：数据抓取

```yaml
# 导航到目标页面
tool: tool://agent-browser
mode: execute
parameters:
  action: navigate
  url: "https://example.com/products"

# 获取快照
tool: tool://agent-browser
mode: execute
parameters:
  action: snapshot

# 获取产品列表
tool: tool://agent-browser
mode: execute
parameters:
  action: count
  selector: ".product-item"

# 获取第一个产品信息
tool: tool://agent-browser
mode: execute
parameters:
  action: gettext
  selector: ".product-item:first-child .title"

# 截图保存
tool: tool://agent-browser
mode: execute
parameters:
  action: screenshot
  screenshotPath: "/products.png"
  fullPage: false
```

### 示例 3：使用语义定位器

```yaml
# 点击提交按钮（通过角色）
tool: tool://agent-browser
mode: execute
parameters:
  action: getbyrole
  role: "button"
  name: "Submit"
  subaction: "click"

# 填充邮箱输入框（通过标签）
tool: tool://agent-browser
mode: execute
parameters:
  action: getbylabel
  label: "Email"
  subaction: "fill"
  value: "user@example.com"

# 点击登录链接（通过文本）
tool: tool://agent-browser
mode: execute
parameters:
  action: getbytext
  text: "Sign In"
  exact: true
  subaction: "click"
```

### 示例 4：多标签页管理

```yaml
# 打开第一个网站
tool: tool://agent-browser
mode: execute
parameters:
  action: navigate
  url: "https://site-a.com"

# 新建标签页打开第二个网站
tool: tool://agent-browser
mode: execute
parameters:
  action: tab_new

# 导航到第二个网站
tool: tool://agent-browser
mode: execute
parameters:
  action: navigate
  url: "https://site-b.com"

# 切换回第一个标签页
tool: tool://agent-browser
mode: execute
parameters:
  action: tab_switch
  index: 0

# 关闭第二个标签页
tool: tool://agent-browser
mode: execute
parameters:
  action: tab_close
  index: 1
```

## 环境变量

| 环境变量 | 描述 | 默认值 |
|----------|------|---------|
| `AGENT_BROWSER_EXECUTABLE_PATH` | 浏览器可执行文件路径 | - |
| `AGENT_BROWSER_HEADLESS` | 是否使用无头模式 | `true` |

## 配置选项

### 启动选项

```yaml
options:
  headless: false          # 显示浏览器窗口
  viewport:              # 视口大小
    width: 1920
    height: 1080
  device: "iPhone 14"    # 使用预定义设备
  executablePath: "/path/to/chrome"  # 自定义浏览器路径
```

### 快照选项

```yaml
interactive: true        # 仅包含交互元素
maxDepth: 3            # 限制深度
compact: true           # 紧凑模式
selector: "#main"       # 限制范围
```

### 截图选项

```yaml
screenshotPath: "/path/to/file.png"
fullPage: true                   # 整页截图
screenshotFormat: "jpeg"         # png 或 jpeg
quality: 90                      # JPEG 质量（0-100）
```

## 错误处理

工具会返回标准化的错误响应：

```yaml
success: false
error:
  message: "错误描述"
  code: "ERROR_CODE"          # 如 BROWSER_NOT_LAUNCHED, ELEMENT_NOT_FOUND
  solution: "解决方案建议"
  retryable: true/false
```

### 常见错误码

| 错误码 | 描述 | 解决方案 |
|---------|------|---------|
| `BROWSER_NOT_LAUNCHED` | 浏览器未启动 | 先调用 `launch` 操作 |
| `ELEMENT_NOT_FOUND` | 元素未找到 | 使用 `snapshot` 获取有效的元素引用 |
| `NAVIGATION_FAILED` | 导航失败 | 检查 URL 是否有效 |
| `BROWSER_LAUNCH_FAILED` | 浏览器启动失败 | 检查浏览器安装或使用 `executablePath` |
| `TIMEOUT` | 操作超时 | 增加 `timeout` 参数或检查网络连接 |
| `FRAME_NOT_FOUND` | 框架未找到 | 检查框架选择器、名称或 URL |

## 高级技巧

### 1. 调试模式

使用 `headed: false` 显示浏览器窗口进行调试：

```yaml
parameters:
  action: launch
  options:
    headless: false
```

### 2. 性能优化

使用 `interactive: true` 仅获取交互元素，减少上下文使用：

```yaml
parameters:
  action: snapshot
  interactive: true
  maxDepth: 3
```

### 3. Cookie 持久化

保存和加载认证状态：

```yaml
# 保存状态
tool: tool://agent-browser
mode: execute
parameters:
  action: storage_state_save
  statePath: "/path/to/auth-state.json"

# 加载状态
tool: tool://agent-browser
mode: execute
parameters:
  action: storage_state_load
  statePath: "/path/to/auth-state.json"
```

### 4. 设备模拟

快速模拟移动设备：

```yaml
parameters:
  action: device
  device: "iPhone 14"   # 或 "Pixel 5", "iPad Pro"
```

### 5. 网络请求拦截

模拟 API 响应：

```yaml
# 拦截并返回模拟数据
tool: tool://agent-browser
mode: execute
parameters:
  action: route
  routeUrl: "**/api/**"
  responseBody:
    status: 200
    contentType: "application/json"
    body: '{"success": true, "data": [...] }'
```

## 与现有工具的对比

| 特性 | agent-browser | playwright | chrome-devtools |
|--------|---------------|------------|----------------|
| **AI 优化** | ✅ Ref 系统 | ❌ 完整 DOM | ❌ 完整 DOM |
| **上下文效率** | ✅ 93% 节省 | ❌ 大量上下文 | ❌ 大量上下文 |
| **浏览器支持** | Chromium, Firefox, WebKit | 3 种 | 仅 Chromium |
| **网络监控** | ✅ 完整 | ❌ 基础 | ✅ 高级 |
| **性能分析** | ✅ 追踪/HAR | ❌ | ✅ 完整 |
| **实现方式** | 直接 API（高效） | Playwright 包装 | chrome-devtools-mcp 适配器 |

## 参考资源

- [agent-browser 官方文档](https://agent-browser.dev)
- [GitHub 仓库](https://github.com/vercel-labs/agent-browser)
- [npm 包](https://www.npmjs.com/package/agent-browser)
- [API 文档](https://unpkg.com/browse/agent-browser@0.5.0/dist/browser.d.ts)

## 注意事项

1. **浏览器安装**：首次使用时可能需要下载 Chromium 浏览器
2. **Headless vs Headed**：生产环境建议使用 `headless: true`，调试时可设为 `false`
3. **Ref 有效性**：Ref 仅在获取快照后有效，页面变化后需要重新获取快照
4. **内存管理**：长时间运行建议定期关闭浏览器或使用会话隔离
5. **超时设置**：对于慢速网站，适当增加 `timeout` 参数

## 版本信息

- **工具版本**: 1.0.0
- **agent-browser 版本**: ^0.5.0
- **基础库**: Playwright 1.57.0
- **最后更新**: 2026-01-16
