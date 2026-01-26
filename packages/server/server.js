import app from './app.js';
import { pathToFileURL } from 'url';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { util } from './utils/util.js';
import { syncSystemTools } from './toolm/tool-sync.service.js';
import { syncAuthorConfig } from './toolm/author-sync.service.js';
import { startLogCleanupTask } from './toolm/tool-logger.service.js';
import { webSocketService } from './services/WebSocketService.js';
import { skillSyncService } from './services/skill-sync.service.js';
import { checkPortAvailable } from './utils/port-checker.js';

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

export async function isServerRunning() {
  if (!serverInstance) {
    return false;
  }

  // 实际验证服务器是否在监听
  return new Promise(resolve => {
    import('http')
      .then(http => {
        // 设置超时以避免长时间等待
        const req = http.request(
          {
            hostname: 'localhost',
            port: config.getPort(),
            path: '/health',
            method: 'GET',
            timeout: 2000
          },
          _res => {
            resolve(true);
          }
        );

        req.on('error', () => {
          resolve(false);
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      })
      .catch(() => {
        resolve(false);
      });
  });
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
  // 内置配置不需要同步到用户目录，直接从 packages/server/configs/ 读取
  // await util.seedBuiltInConfigsIfEmpty();
  await config.validate();
  config.showConfig();
}

export async function startServer(options = {}) {
  if (serverInstance) return serverInstance;
  if (serverStartingPromise) return serverStartingPromise;

  serverStartingPromise = (async () => {
    try {
      await _handleConfig(options);

      // 检查端口可用性
      const port = config.getPort();
      const isPortAvailable = await checkPortAvailable(port);

      if (!isPortAvailable) {
        const errorMsg = `端口 ${port} 已被占用，请检查是否有其他服务在使用该端口，或手动指定其他端口`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      await promptManager.loadPrompts();

      // 加载优化模板和模型
      try {
        const { templateManager } = await import('./services/template.service.js');
        await templateManager.loadTemplates();
        logger.info('优化模板加载完成');
      } catch (error) {
        logger.warn('加载优化模板失败，继续启动服务', { error: error.message });
      }

      try {
        const { modelManager } = await import('./services/model.service.js');
        await modelManager.loadModels();
        logger.info('优化模型加载完成');
      } catch (error) {
        logger.warn('加载优化模型失败，继续启动服务', { error: error.message });
      }

      // 加载技能
      try {
        const { skillsManager } = await import('./services/skills.service.js');
        await skillsManager.loadSkills();
        logger.info('技能加载完成');

        // 初始化技能同步服务
        await skillSyncService.init();
      } catch (error) {
        logger.warn('加载技能或初始化同步服务失败，继续启动服务', { error: error.message });
      }

      // 同步系统工具到沙箱环境
      try {
        await syncSystemTools();
      } catch (error) {
        logger.error('同步系统工具失败，继续启动服务', { error: error.message });
      }

      // 同步作者配置到沙箱环境
      try {
        await syncAuthorConfig();
      } catch (error) {
        logger.error('同步作者配置失败，继续启动服务', { error: error.message });
      }

      // MCP 长连接可能长时间空闲（IDE 侧保持会话），若沿用 Node 默认超时（requestTimeout 5 分钟、keepAliveTimeout 5 秒、headersTimeout 60 秒）
      // 会导致连接被动关闭。这里将相关超时调高/关闭以避免 IDE 定期断开。
      const MCP_LONG_TIMEOUT = 24 * 60 * 60 * 1000; // 24h

      // 启动日志清理任务
      startLogCleanupTask();

      return await new Promise((resolve, reject) => {
        const server = app.listen(port, async () => {
          try {
            // 服务器已经成功启动并监听端口
            logger.info(`MCP服务启动成功  http://localhost:${port}/mcp`);
            if (config.adminEnable) {
              logger.info(`管理员界面可通过 http://localhost:${port}${config.adminPath} 访问`);
              process.stderr.write(
                '\n======================================================================================\n'
              );
            }

            // 放宽 HTTP 服务器超时，防止 MCP 流式会话被意外回收
            server.keepAliveTimeout = MCP_LONG_TIMEOUT;
            server.headersTimeout = MCP_LONG_TIMEOUT + 1000; // 必须大于 keepAliveTimeout
            server.requestTimeout = 0; // 0 表示关闭 request 超时
            server.setTimeout(0); // 兼容旧接口，关闭 socket 超时
            logger.info(`MCP 长连接超时已放宽: keepAliveTimeout=${server.keepAliveTimeout}ms`);

            // 设置服务器实例
            serverInstance = server;

            try {
              // WebSocket服务使用动态端口（端口0，由系统自动分配）
              await webSocketService.start();
              const wsPort = webSocketService.getPort();
              logger.info(`WebSocket服务启动成功，端口: ${wsPort}`);
            } catch (wsError) {
              logger.error('WebSocket服务启动失败:', wsError.message);
              // WebSocket服务失败不影响主服务器运行
            }

            resolve(server);
          } catch (error) {
            logger.error('服务器启动后处理失败:', error.message);
            server.close();
            reject(error);
          }
        });

        server.on('error', err => {
          logger.error('服务器启动失败:', err.message);
          if (err.code === 'EADDRINUSE') {
            logger.error(`端口 ${port} 已被占用，请检查是否有其他服务在使用该端口`);
          }
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
    serverInstance.close(err => {
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
  startServer().catch(error => {
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
