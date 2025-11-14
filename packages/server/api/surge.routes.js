/**
 * Surge 静态资源代理接口
 * 代理所有 /surge/* 请求到指定的 Surge 静态资源地址
 */

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../utils/config.js';

const router = express.Router();

// 从配置中获取 Surge 目标地址，默认为 https://becrafter.surge.sh
const surgeTarget = config.surgeTarget || 'https://becrafter.surge.sh';

// 创建代理中间件
const surgeProxy = createProxyMiddleware({
  target: surgeTarget,
  changeOrigin: true,
  // 当路由已经去除了 /surge 前缀后，路径变为 /test_prompts.json
  // 我们需要将其重写为 /assets/test_prompts.json
  pathRewrite: {
    '^/': '/assets/',  // 将 / 开头的路径重写为 /assets/ 开头
  },
  // 设置代理请求头
  onProxyReq: (proxyReq, req, res) => {
    // 可以在这里添加自定义逻辑，如设置请求头等
    console.log(`代理请求: ${req.method} ${req.url} -> ${surgeTarget}${req.url.replace(/^\/(.*)/, '/assets/$1')}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // 可以在这里添加自定义逻辑，如修改响应头等
    proxyRes.headers['surge-proxy'] = 'enabled';
  },
  onError: (err, req, res) => {
    console.error('Surge 代理错误:', err);
    res.status(500).send('代理错误');
  }
});

// 使用代理中间件处理所有请求
// 由于在 app.js 中已经使用了 /surge 路径前缀，这里直接处理所有请求
router.use(surgeProxy);

export const surgeRouter = router;