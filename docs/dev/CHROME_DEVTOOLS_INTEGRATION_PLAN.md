# Chrome DevTools MCP 集成方案

## 目标

将 chrome-devtools-mcp 的能力完全集成到 Prompt Manager 工具系统中，**直接复用官方代码库的实现**，避免重复维护代码。

## 核心思路

chrome-devtools-mcp 的工具实现是**模块化**的，每个工具都在 `src/tools/` 目录下独立实现。我们可以：

1. **直接引入 chrome-devtools-mcp 包**
2. **导入工具实现模块**（如 `inputTools`, `pagesTools` 等）
3. **使用 McpContext 管理浏览器实例**
4. **创建适配层**，将我们的工具接口路由到 chrome-devtools-mcp 的工具 handler

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│  chrome-devtools.tool.js (适配层)                        │
│  - 实现 execute() 方法                                    │
│  - 路由 method 参数到对应的工具 handler                   │
│  - 管理浏览器生命周期                                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  chrome-devtools-mcp 工具模块                            │
│  - inputTools (click, fill, hover, etc.)                │
│  - pagesTools (navigate, newPage, etc.)                 │
│  - networkTools (listNetworkRequests, etc.)            │
│  - performanceTools (startTrace, etc.)                 │
│  - ...                                                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  McpContext (浏览器上下文管理)                            │
│  - 管理浏览器实例                                          │
│  - 管理页面状态                                            │
│  - 管理快照和网络请求                                      │
└─────────────────────────────────────────────────────────┘
```

## 实现步骤

### 1. 依赖声明

```javascript
getDependencies() {
  return {
    'chrome-devtools-mcp': '^0.10.2',
    'puppeteer': '^24.31.0'  // chrome-devtools-mcp 的依赖
  };
}
```

### 2. 工具映射表

创建 method 到工具 handler 的映射：

```javascript
const toolMap = {
  // 输入自动化
  'click': inputTools.click,
  'fill': inputTools.fill,
  'hover': inputTools.hover,
  'pressKey': inputTools.pressKey,
  'drag': inputTools.drag,
  'uploadFile': inputTools.uploadFile,
  'handleDialog': inputTools.handleDialog,
  
  // 导航自动化
  'navigate': pagesTools.navigatePage,
  'newPage': pagesTools.newPage,
  'closePage': pagesTools.closePage,
  'listPages': pagesTools.listPages,
  'selectPage': pagesTools.selectPage,
  'waitFor': pagesTools.waitFor,
  
  // 网络监控
  'listNetworkRequests': networkTools.listNetworkRequests,
  'getNetworkRequest': networkTools.getNetworkRequest,
  
  // 性能分析
  'startPerformanceTrace': performanceTools.performanceStartTrace,
  'stopPerformanceTrace': performanceTools.performanceStopTrace,
  'analyzePerformance': performanceTools.performanceAnalyzeInsight,
  
  // 调试
  'evaluateScript': scriptTools.evaluateScript,
  'getConsoleMessage': consoleTools.getConsoleMessage,
  'listConsoleMessages': consoleTools.listConsoleMessages,
  'takeScreenshot': screenshotTools.takeScreenshot,
  'takeSnapshot': snapshotTools.takeSnapshot,
  
  // 模拟
  'emulate': emulationTools.emulate,
  'resizePage': emulationTools.resizePage,
};
```

### 3. 浏览器实例管理

使用 McpContext 管理浏览器实例（类似 playwright 工具的全局管理器）：

```javascript
// 全局浏览器实例管理器
const browserInstances = new Map();

async function getMcpContext(toolName, options = {}) {
  const manager = getBrowserManager(toolName);
  
  // 如果已有上下文且浏览器仍然连接，直接返回
  if (manager.context && manager.context.browser.isConnected()) {
    return manager.context;
  }
  
  // 创建新的浏览器实例和上下文
  const browser = await ensureBrowserLaunched({
    headless: options.headless ?? true,
    channel: options.channel ?? 'stable',
    isolated: options.isolated ?? false,
  });
  
  const context = await McpContext.from(browser, logger, {
    experimentalDevToolsDebugging: false,
    experimentalIncludeAllPages: false,
  });
  
  manager.context = context;
  manager.browser = browser;
  
  return context;
}
```

### 4. 适配层实现

创建适配层，将我们的参数格式转换为 chrome-devtools-mcp 的格式：

```javascript
async execute(params) {
  const { api } = this;
  const { method, ...restParams } = params;
  
  // 1. 获取工具 handler
  const tool = toolMap[method];
  if (!tool) {
    throw new Error(`不支持的方法: ${method}`);
  }
  
  // 2. 获取或创建 McpContext
  const context = await this.getMcpContext(params.options);
  
  // 3. 创建请求和响应对象
  const request = {
    params: this.transformParams(method, restParams)
  };
  
  const response = new McpResponse();
  
  // 4. 调用工具 handler
  await tool.handler(request, response, context);
  
  // 5. 处理响应并返回
  const content = await response.handle(method, context);
  
  return this.formatResponse(content);
}
```

### 5. 参数转换

不同工具的参数格式可能不同，需要转换：

```javascript
transformParams(method, params) {
  // 根据不同的方法转换参数格式
  switch (method) {
    case 'click':
      return {
        uid: params.uid,
        dblClick: params.dblClick ?? false
      };
    case 'navigate':
      return {
        type: 'url',
        url: params.url,
        timeout: params.timeout
      };
    // ... 其他方法的转换
    default:
      return params;
  }
}
```

## 优势

1. **完全复用官方实现** - 不需要自己维护代码，与官方保持同步
2. **功能完整** - 支持 chrome-devtools-mcp 的所有功能
3. **易于维护** - 官方更新时，只需更新依赖版本
4. **架构一致** - 与 playwright 工具保持类似的设计模式

## 注意事项

1. **模块导入** - 需要确认 chrome-devtools-mcp 的 npm 包是否包含编译后的工具模块
2. **类型兼容** - chrome-devtools-mcp 是 TypeScript，需要处理类型兼容性
3. **依赖版本** - 确保 puppeteer 版本与 chrome-devtools-mcp 兼容
4. **浏览器管理** - 需要管理浏览器的生命周期，支持 keepAlive 参数

## 下一步

1. 检查 chrome-devtools-mcp npm 包的结构
2. 确认可以直接导入工具模块
3. 实现适配层代码
4. 测试各个工具功能
5. 在 mcp.server.js 中注册工具描述

