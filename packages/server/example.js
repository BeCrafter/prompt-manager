// 示例：使用 @becrafter/prompt-manager-core 库

// 方法1：ES6 导入
import {
  startServer,
  stopServer,
  getServerAddress,
  getServerState,
  config,
  logger,
  promptManager
} from './index.js'; // 开发环境中使用
// } from '@becrafter/prompt-manager-core'; // 发布环境中使用


// 方法2：CommonJS 导入（如果需要）
// const { startServer, stopServer, getServerAddress, getServerState, config, logger, promptManager } = require('@becrafter/prompt-manager-core');

async function main() {
  try {
    console.log('启动 Prompt Manager 服务器...');

    // 启动服务器
    const server = await startServer({
      configOverrides: {
        promptsDir: './my-prompts',  // 自定义 prompts 目录
        port: 3000,                  // 自定义端口
        adminEnable: true,           // 启用管理员功能
        adminRequireAuth: false      // 禁用管理员认证（仅用于开发）
      }
    });

    console.log('服务器已启动，地址：', getServerAddress());

    // 加载提示词
    await promptManager.loadPrompts();
    console.log('已加载提示词数量：', promptManager.getPrompts().length);

    // 获取服务器状态
    console.log('服务器状态：', getServerState());

    // 这里可以添加更多自定义逻辑...

    // 优雅关闭服务器（例如在接收到退出信号时）
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务器...');
      await stopServer();
      process.exit(0);
    });

  } catch (error) {
    console.error('启动服务器时出错：', error);
    process.exit(1);
  }
}

// 运行示例
main();