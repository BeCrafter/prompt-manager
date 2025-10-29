import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { util } from './utils/util.js';
import { PromptManager } from './services/manager.js';
import { getMcpMiddleware } from './mcp/mcp.js';
import { staticRouter } from './api/static.routes.js';
import { adminRouter } from './api/admin.routes.js';
import { openRouter } from './api/open.routes.js';


const app = express();
const adminUiRoot = util.getAdminUiRoot();

// 全局中间件
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));


// 为管理员界面提供静态文件服务 - 根路径
app.use(config.adminPath, express.static(adminUiRoot));

// 为管理员界面提供根路径访问（当用户访问 /admin 时显示 admin.html）
app.get(config.adminPath, (req, res) => {
  res.sendFile(path.join(adminUiRoot, 'admin.html'));
});

// 为管理员界面提供根路径访问（当用户访问 /admin/ 时显示 admin.html）
app.get(config.adminPath + '/', (req, res) => {
  res.sendFile(path.join(adminUiRoot, 'admin.html'));
});


// 注册后台API
app.use('/adminapi', adminRouter);

// 注册开放API
app.use('/openapi', openRouter);

// 挂载MCP流式服务（独立路径前缀，避免冲突）
app.all('/mcp', (req, res, next) => {
  try {
    const middleware = getMcpMiddleware();
    middleware(req, res, next);
  } catch (error) {
    return res.status(500).json({ error: 'MCP服务器未初始化: ' + error.message });
  }
});

// 获取prompts目录路径（在启动时可能被覆盖）
let promptsDir = config.getPromptsDir();

// 创建全局PromptManager实例
export const promptManager = new PromptManager(promptsDir);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(`[服务器错误]: ${err.message}`);
  res.status(500).send('Internal Server Error')
});

// 404处理
app.use((req, res) => {
  res.status(404).send('Not Found')
});

export default app;