import app from './app.js';
import { pathToFileURL } from 'url';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { util } from './utils/util.js';
import { syncSystemTools } from './toolm/tool-sync.service.js';
import { startLogCleanupTask } from './toolm/tool-logger.service.js';
import { webSocketService } from './services/WebSocketService.js';

// 动态导入 promptManager，以处理 Electron 打包后的路径问题
let promptManager;
try {
  const managerModule = await import('./services/manager.js');
  promptManager = managerModule.promptManager;
} catch (error) {
  logger.error('Failed to import promptManager:', error.message);
  // 如果直接导入失败，尝试使用 util.getPromptManager()
  promptManager = await util.getPromptManager();
}

// 获取prompts目录路径（在启动时可能被覆盖）
let promptsDir = config.getPromptsDir();

let serverInstance = null;
let serverStartingPromise = null;

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
      
      // 同步系统工具到沙箱环境
      try {
        await syncSystemTools();
      } catch (error) {
        logger.error('同步系统工具失败，继续启动服务', { error: error.message });
      }
      
    // MCP 长连接可能长时间空闲（IDE 侧保持会话），若沿用 Node 默认超时（requestTimeout 5 分钟、keepAliveTimeout 5 秒、headersTimeout 60 秒）
    // 会导致连接被动关闭。这里将相关超时调高/关闭以避免 IDE 定期断开。
    const MCP_LONG_TIMEOUT = 24 * 60 * 60 * 1000; // 24h

      // 启动日志清理任务
      startLogCleanupTask();

      return await new Promise((resolve, reject) => {
        const server = app.listen(config.getPort(), async () => {
          logger.info(`MCP服务启动成功  http://localhost:${config.getPort()}/mcp`);
          if (config.adminEnable) {
            logger.info(`管理员界面可通过 http://localhost:${config.getPort()}${config.adminPath} 访问`);
            process.stderr.write('\n======================================================================================\n');
          }

        // 放宽 HTTP 服务器超时，防止 MCP 流式会话被意外回收
        server.keepAliveTimeout = MCP_LONG_TIMEOUT;
        server.headersTimeout = MCP_LONG_TIMEOUT + 1000; // 必须大于 keepAliveTimeout
        server.requestTimeout = 0; // 0 表示关闭 request 超时
        server.setTimeout(0); // 兼容旧接口，关闭 socket 超时
        logger.info(`MCP 长连接超时已放宽: keepAliveTimeout=${server.keepAliveTimeout}ms`);

          // 保存服务器实例引用，以便后续可以关闭它
          serverInstance = server;
          
          // 启动WebSocket服务
          try {
            await webSocketService.start();
            logger.info(`WebSocket服务启动成功，端口: 5622`);
          } catch (wsError) {
            logger.error('WebSocket服务启动失败:', wsError.message);
            // WebSocket服务失败不影响主服务器运行
          }
          
          resolve(server);
        });

        server.on('error', (err) => {
          logger.error('服务器启动失败:', err.message);
          reject(err);
        });
      });
    } catch (error) {
      logger.error('服务器启动失败::', error.message);
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
      // 等待启动流程结束，避免中途关闭导致的资源悬挂
      await serverStartingPromise;
    } catch (error) {
      // ignore failing start when stopping
    }
  }

  if (!serverInstance) {
    return;
  }

  // 清理MCP会话
  try {
    const appModule = await import('./app.js');
    if (appModule.cleanupMcpSessions) {
      appModule.cleanupMcpSessions();
    }
  } catch (error) {
    logger.warn('清理MCP会话时出错:', error.message);
  }

  // 关闭WebSocket服务
  try {
    await webSocketService.stop();
    logger.info('WebSocket服务已关闭');
  } catch (error) {
    logger.warn('关闭WebSocket服务时出错:', error.message);
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

// 导出当前模块作为默认导出，包含所有公共API
export default {
  startServer,
  stopServer,
  getServerState,
  getServerAddress,
  isServerRunning,
  app,
  config,
  logger,
  util,
  promptManager
};
