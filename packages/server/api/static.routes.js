/**
 * 管理后台接口
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../utils/config.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminUiRoot = path.join(__dirname, '..', 'admin-ui');

// 为管理员界面提供静态文件服务 - 根路径
router.use(config.adminPath, express.static(adminUiRoot));

// 为管理员界面提供根路径访问（当用户访问 /admin 时显示 admin.html）
router.get(config.adminPath, (req, res) => {
  res.sendFile(path.join(adminUiRoot, 'admin.html'));
});

// 为管理员界面提供根路径访问（当用户访问 /admin/ 时显示 admin.html）
router.get(config.adminPath + '/', (req, res) => {
  res.sendFile(path.join(adminUiRoot, 'admin.html'));
});

export const staticRouter = router;