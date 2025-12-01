import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
import { util } from './utils/util.js';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { adminRouter } from './api/admin.routes.js';
import { openRouter } from './api/open.routes.js';
import { surgeRouter } from './api/surge.routes.js';
import { getMcpServer } from './mcp/mcp.server.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';


const app = express();
const adminUiRoot = util.getWebUiRoot();

// 自定义中间件，用于处理 ASAR 包中的静态文件
function serveAsarStatic(root) {
  return async (req, res, next) => {
    // 检查 root 是否是 ASAR 包中的路径
    if (root.includes('.asar')) {
      try {
        // 动态导入 asar 模块（在 ES 模块环境中）
        const { default: asar } = await import('@electron/asar');
        
        // 从 root 中提取 asar 文件路径和相对路径
        const asarPathMatch = root.match(/^(.*?\.asar)(\/.*)?$/);
        const asarFilePath = asarPathMatch ? asarPathMatch[1] : root.replace(/\/.*$/, '.asar');
        const relativePathInAsar = asarPathMatch && asarPathMatch[2] ? asarPathMatch[2].substring(1) : 'web';
        
        const filePath = path.posix.join(relativePathInAsar, req.path).replace(/^\//, '');
        const stat = asar.statFile(asarFilePath, filePath);
        
        if (stat) {
          const fileContent = asar.extractFile(asarFilePath, filePath);
          
          // 设置适当的 Content-Type
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
          };
          
          if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
          }
          
          res.send(fileContent);
        } else {
          next();
        }
      } catch (error) {
        // 文件不存在或 asar 模块无法导入，继续到下一个中间件
        next();
      }
    } else {
      // 不是 ASAR 包中的路径，使用默认的静态文件服务
      express.static(root)(req, res, next);
    }
  };
}

// 全局中间件
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));


// 为管理员界面提供静态文件服务 - 根路径
// 检查是否需要使用 ASAR 处理（需要验证 .asar 文件实际上存在）
const isAsarPath = adminUiRoot.includes('.asar') && fs.existsSync(adminUiRoot.replace(/\/.*$/, '.asar'));
if (isAsarPath) {
  app.use(config.adminPath, serveAsarStatic(adminUiRoot));
} else {
  app.use(config.adminPath, express.static(adminUiRoot));
}

// 统一处理 index.html 请求的辅助函数
async function sendIndexHtml(req, res) {
  if (isAsarPath) {
    try {
      // 动态导入 asar 模块（在 ES 模块环境中）
      const { default: asar } = await import('@electron/asar');
      
      // 从 adminUiRoot 中提取 asar 文件路径和相对路径
      const asarPathMatch = adminUiRoot.match(/^(.*?\.asar)(\/.*)?$/);
      const asarFilePath = asarPathMatch ? asarPathMatch[1] : adminUiRoot.replace(/\/.*$/, '.asar');
      const relativePathInAsar = asarPathMatch && asarPathMatch[2] ? asarPathMatch[2].substring(1) : 'web';
      const indexPath = path.posix.join(relativePathInAsar, 'index.html');
      
      // 检查文件是否存在
      const stat = asar.statFile(asarFilePath, indexPath);
      if (stat) {
        // 读取 index.html 文件内容
        const fileContent = asar.extractFile(asarFilePath, indexPath);
        res.setHeader('Content-Type', 'text/html');
        res.send(fileContent);
      } else {
        res.status(500).send('Internal Server Error');
      }
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.sendFile(path.join(adminUiRoot, 'index.html'));
  }
}

// 为管理员界面提供根路径访问（当用户访问 /admin 时显示 index.html）
app.get(config.adminPath, sendIndexHtml);

// 为管理员界面提供根路径访问（当用户访问 /admin/ 时显示 index.html）
app.get(config.adminPath + '/', sendIndexHtml);


// 注册后台API
app.use('/adminapi', adminRouter);

// 注册开放API
app.use('/openapi', openRouter);

// 注册 Surge 静态资源代理 API
app.use('/surge', surgeRouter);


const transports = {};
const mcpServers = {}; // 存储每个会话的MCP服务器实例

// 挂载MCP流式服务（独立路径前缀，避免冲突）
app.all('/mcp', (req, res) => {
  try {
    let transport;
    const sessionId = req.headers['mcp-session-id'] || '';
    
    if (sessionId && transports[sessionId]) {
      const existingTransport = transports[sessionId];
      // Check if the transport is of the correct type
      if (existingTransport instanceof StreamableHTTPServerTransport) {
        // Reuse existing transport
        transport = existingTransport;
      } else {
        // Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)
        res.status(400).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Bad Request: Session exists but uses a different transport protocol'
            },
            id: null
        });
        return;
      }
    } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
      const eventStore = new InMemoryEventStore();
      
      // 预先创建 MCP 服务器实例，避免异步时序问题
      let mcpServerPromise = null;
      let serverReady = false;
      
      transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore, // Enable resumability
          onsessioninitialized: async sessionId => {
              // Store the transport by session ID when session is initialized
              console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
              transports[sessionId] = transport;
              
              try {
                  // 为新会话创建MCP服务器实例（同步等待完成）
                  const server = await getMcpServer();
                  mcpServers[sessionId] = server;
                  server.connect(transport);
                  serverReady = true;
                  console.log(`MCP server connected for session ${sessionId}`);
              } catch (error) {
                  console.error('创建MCP服务器失败:', error);
                  // 即使失败也标记为ready，避免阻塞
                  serverReady = true;
              }
          }
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
              console.log(`Transport closed for session ${sid}, removing from transports map`);
              delete transports[sid];
              // 清理MCP服务器实例
              if (mcpServers[sid]) {
                  delete mcpServers[sid];
              }
          }
      };

      // 添加错误处理
      transport.onerror = (error) => {
          console.error('MCP Transport error:', error);
      };
    } else {
      // Invalid request - no session ID or not initialization request
      res.status(400).json({
          jsonrpc: '2.0',
          error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided'
          },
          id: null
      });
      return;
    }
    
    // Handle the request with the transport
    transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error('Error handling MCP request: ' + error.message);
    return res.status(500).json({
        jsonrpc: '2.0',
        error: {
            code: -32603,
            message: 'Internal server error'
        },
        id: null
    });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(`[服务器错误]: ${err.message}`);
  res.status(500).send('Internal Server Error')
});

// 404处理
app.use((req, res) => {
  res.status(404).send('Not Found')
});

// 导出清理函数
export function cleanupMcpSessions() {
  console.log('Cleaning up MCP sessions');
  // 清理所有活动的传输和服务器实例
  for (const sessionId in transports) {
    try {
      if (transports[sessionId] && typeof transports[sessionId].close === 'function') {
        transports[sessionId].close();
      }
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
    delete transports[sessionId];
  }
  
  // 注意：mcpServers 对象在 app.js 中不可访问，需要在 server.js 中处理
}

export default app;