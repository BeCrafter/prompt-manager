import app from './app.js';
import { pathToFileURL } from 'url';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { util } from './utils/util.js';
import { PromptManager } from './services/manager.js';
import { initializeMcpServer } from './mcp/initializer.js';


// 获取prompts目录路径（在启动时可能被覆盖）
let promptsDir = config.getPromptsDir();

// 创建全局PromptManager实例
export const promptManager = new PromptManager(promptsDir);


let serverInstance = null;
let serverStartingPromise = null;
let mcpManagerInstance = null;

export function getServerAddress() {
  return `http://127.0.0.1:${config.getPort()}`;
}

export function isServerRunning() {
  return Boolean(serverInstance);
}

// 封装配置处理逻辑
async function _handleConfig(options) {
  if (options.configOverrides) {
    config.applyOverrides(options.configOverrides);
  }
  promptsDir = config.getPromptsDir();
  promptManager.promptsDir = promptsDir;
  await config.ensurePromptsDir();
  await util.seedPromptsIfEmpty();
  await config.validate();
  config.showConfig();
}

export async function startServer(options = {}) {
  if (serverInstance) return serverInstance;
  if (serverStartingPromise) return serverStartingPromise;

  serverStartingPromise = (async () => {
    try {
      await _handleConfig(options);
      await promptManager.loadPrompts();
      mcpManagerInstance = await initializeMcpServer();

      return await new Promise((resolve, reject) => {
        const server = app.listen(config.getPort(), () => {
          logger.info(`MCP服务启动成功  http://localhost:${config.getPort()}/mcp`);
          if (config.adminEnable) {
            logger.info(`管理员界面可通过 http://localhost:${config.getPort()}${config.adminPath} 访问`);
            process.stderr.write('\n======================================================================================\n');
          }
          resolve(server);
        });

        server.on('error', (err) => {
          logger.error('服务器启动失败:', err.message);
          reject(err);
        });
      });
    } catch (error) {
      logger.error('服务器启动失败:', error.message);
      throw error;
    } finally {
      serverStartingPromise = null;
    }
  })();

  return serverStartingPromise;
}

export async function stopServer() {
  if (serverStartingPromise) {
    try {
      await serverStartingPromise;
    } catch (error) {
      // ignore failing start when stopping
    }
  }

  if (!serverInstance) {
    return;
  }

  await new Promise((resolve, reject) => {
    serverInstance.close((err) => {
      if (err) {
        logger.error('停止服务器失败:', err.message);
        reject(err);
      } else {
        logger.info('服务器已停止');
        resolve();
      }
    });
  });

  serverInstance = null;
  
  // 停止MCP服务器
  if (mcpManagerInstance) {
    await mcpManagerInstance.close();
    mcpManagerInstance = null;
  }
}

export function getServerState() {
  return {
    running: Boolean(serverInstance),
    port: config.getPort(),
    address: getServerAddress(),
    adminPath: config.adminPath
  };
}

// 是否直接运行
const isDirectRun = (() => {
  try {
    const executed = process.argv[1];
    if (!executed) return false;
    return pathToFileURL(executed).href === import.meta.url;
  } catch (error) {
    return false;
  }
})();

if (isDirectRun) {
  startServer().catch((error) => {
    logger.error('服务器启动失败:', error.message);
    process.exit(1);
  });
}
