# @becrafter/prompt-manager-core 封装完成

## 封装说明

我们已成功将 `@becrafter/prompt-manager` 的核心功能封装为一个独立的库 `@becrafter/prompt-manager-core`。这个库包含以下主要功能：

1. **服务器管理**：启动、停止和管理 Prompt Manager 服务器
2. **配置管理**：动态配置服务器参数
3. **提示词管理**：加载、检索和管理提示词
4. **MCP 协议支持**：支持 Model Context Protocol
5. **Web API**：提供管理后台和开放 API
6. **工具函数**：各种实用工具函数

## 项目结构

```
packages/server/
├── index.js          # 库的主要入口点
├── server.js         # 服务器启动/停止逻辑
├── app.js            # Express 应用实例
├── api/              # API 路由
├── mcp/              # MCP 协议相关
├── middlewares/      # 中间件
├── services/         # 服务层
├── utils/            # 工具函数
├── package.json      # 库的包配置
├── README.md         # 使用说明
├── example.js        # 使用示例
├── test.js           # 测试文件
└── dist/             # 构建输出目录
    └── index.js      # 构建后的库文件
```

## 安装和使用

### 1. 安装库

```bash
npm install @becrafter/prompt-manager-core
```

### 2. 基本使用

```javascript
import {
  startServer,
  stopServer,
  getServerState,
  getServerAddress,
  isServerRunning,
  config,
  logger,
  promptManager
} from '@becrafter/prompt-manager-core';

async function main() {
  try {
    // 启动服务器
    await startServer({
      configOverrides: {
        promptsDir: './my-prompts',
        port: 3000,
        adminEnable: true
      }
    });

    console.log('服务器地址：', getServerAddress());

    // 加载提示词
    await promptManager.loadPrompts();
    console.log('加载的提示词数量：', promptManager.getPrompts().length);

  } catch (error) {
    console.error('错误：', error);
  }
}

main();
```

### 3. 在其他项目中使用

在新的 Node.js 项目中：

```bash
mkdir my-project && cd my-project
npm init -y
npm install @becrafter/prompt-manager-core
```

创建 `index.js`:

```javascript
import { startServer, stopServer } from '@becrafter/prompt-manager-core';

// 启动服务器
startServer({
  configOverrides: {
    port: 8080,
    promptsDir: './prompts'
  }
})
.then(() => {
  console.log('服务器已启动');
})
.catch(err => {
  console.error('启动失败：', err);
});

// 监听退出信号
process.on('SIGINT', async () => {
  await stopServer();
  process.exit(0);
});
```

## 主要导出

### 服务器管理
- `startServer(options)` - 启动服务器
- `stopServer()` - 停止服务器
- `getServerState()` - 获取服务器状态
- `getServerAddress()` - 获取服务器地址
- `isServerRunning()` - 检查服务器是否运行

### 核心对象
- `app` - Express 应用实例
- `config` - 配置管理器
- `logger` - 日志记录器
- `util` - 工具函数
- `promptManager` - 提示词管理器

### MCP 支持
- `getMcpServer()` - 获取 MCP 服务器实例
- `handleGetPrompt`, `handleSearchPrompts`, `handleReloadPrompts` - MCP 处理函数

### API 路由
- `adminRouter` - 管理 API 路由
- `openRouter` - 开放 API 路由

### 中间件
- `adminAuthMiddleware` - 管理员认证中间件

## 构建

库使用 esbuild 进行构建：

```bash
npm run build
```

这会创建一个优化后的 `dist/index.js` 文件，可以直接在其他项目中使用。

## 测试

运行测试以验证库功能：

```bash
npm test
```

## 示例

查看 `example.js` 文件以了解详细使用方法。

## 总结

通过此封装，现在可以轻松地将 Prompt Manager 的核心功能集成到其他项目中，而无需复制整个代码库。库提供了一个干净的 API，允许其他项目根据需要定制和扩展功能。