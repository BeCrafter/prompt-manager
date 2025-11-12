import express from 'express';
import cors from 'cors';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { util } from './utils/util.js';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { adminRouter } from './api/admin.routes.js';
import { openRouter } from './api/open.routes.js';
import { getMcpServer } from './mcp/mcp.server.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';


const app = express();
const adminUiRoot = util.getWebUiRoot();

// 全局中间件
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));


// 为管理员界面提供静态文件服务 - 根路径
app.use(config.adminPath, express.static(adminUiRoot));

// 为管理员界面提供根路径访问（当用户访问 /admin 时显示 index.html）
app.get(config.adminPath, (req, res) => {
  res.sendFile(path.join(adminUiRoot,  'index.html'));
});

// 为管理员界面提供根路径访问（当用户访问 /admin/ 时显示 index.html）
app.get(config.adminPath + '/', (req, res) => {
  res.sendFile(path.join(adminUiRoot,  'index.html'));
});


// 注册后台API
app.use('/adminapi', adminRouter);

// 注册开放API
app.use('/openapi', openRouter);


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
      transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore, // Enable resumability
          onsessioninitialized: sessionId => {
              // Store the transport by session ID when session is initialized
              console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
              transports[sessionId] = transport;
              
              // 为新会话创建MCP服务器实例
              mcpServers[sessionId] = getMcpServer();
              mcpServers[sessionId].connect(transport);
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