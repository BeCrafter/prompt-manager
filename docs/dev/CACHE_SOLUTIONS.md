# 开发环境缓存问题解决方案

## 问题描述

在开发过程中，前端架构的模块缓存会导致修改后不清楚变动是否生效，主要表现为：
- 前端修改后页面没有变化
- 后端 API 修改后前端调用的是旧版本
- 需要多次刷新才能看到最新修改

## 解决方案

### 1. 前端缓存解决方案

#### Webpack 配置优化
已在 `packages/admin-ui/webpack.config.js` 中添加以下配置：

```javascript
// 禁用 webpack 缓存
cache: false,

devServer: {
  // ... 其他配置
  client: {
    overlay: {
      errors: true,
      warnings: false,
    },
    logging: 'info',
  },
  // 监听文件变化的配置
  watchFiles: {
    paths: ['src/**/*', 'css/**/*'],
    options: {
      usePolling: false,
    },
  },
}
```

#### 浏览器缓存清除
1. **禁用浏览器缓存**（开发时推荐）
   - Chrome: F12 → Network → 勾选 "Disable cache"
   - Firefox: F12 → Network → 勾选 "Disable cache"

2. **强制刷新**
   - Mac: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`

3. **清除应用缓存**
   ```javascript
   // 在浏览器控制台执行
   if ('caches' in window) {
     caches.keys().then(names => {
       names.forEach(name => caches.delete(name));
     });
   }
   localStorage.clear();
   sessionStorage.clear();
   ```

### 2. 后端缓存解决方案

#### 使用开发启动脚本
创建了 `packages/server/dev-server.js`，特性：
- 使用 `--watch` 标志自动重启
- 禁用 Node.js 模块缓存
- 提供详细的日志输出
- 支持环境变量配置

#### 启动方式
```bash
# 方式 1: 使用 npm script
npm run dev:backend

# 方式 2: 直接运行
cd packages/server
node dev-server.js

# 方式 3: 使用 --watch（原有方式）
cd packages/server
node --watch server.js
```

### 3. 前后端联动调试

#### 使用联动调试脚本
创建了 `scripts/dev-all.sh`，一键启动前后端服务：

```bash
# 在项目根目录执行
npm run dev:all
```

#### 脚本功能
- ✅ 自动检查端口占用
- ✅ 并行启动前后端服务
- ✅ 自动安装依赖（如需要）
- ✅ 实时日志输出
- ✅ 优雅关闭（Ctrl+C）
- ✅ PID 管理

#### 服务地址
- 后端服务: http://localhost:5621
- 前端服务: http://localhost:9000
- 后端 API: http://localhost:5621/adminapi

#### 日志查看
```bash
# 查看后端日志
tail -f .pids/backend.log

# 查看前端日志
tail -f .pids/frontend.log
```

### 4. 其他调试技巧

#### 前端调试
1. **使用 Source Map**
   - 已在 webpack 配置中启用
   - 可以在浏览器中直接调试源代码

2. **React DevTools / Vue DevTools**
   - 安装浏览器扩展
   - 查看组件状态和 props

3. **网络请求调试**
   - F12 → Network
   - 查看请求/响应详情
   - 检查 CORS 问题

#### 后端调试
1. **使用 VS Code 调试器**
   ```json
   // .vscode/launch.json
   {
     "type": "node",
     "request": "launch",
     "name": "Debug Server",
     "program": "${workspaceFolder}/packages/server/server.js",
     "runtimeArgs": ["--watch"]
   }
   ```

2. **日志级别配置**
   - 开发环境: `debug`
   - 生产环境: `info`

3. **API 测试工具**
   - 使用 Postman / Insomnia
   - 或使用浏览器扩展 Talend API Tester

### 5. 常见问题

#### Q: 前端修改后没有变化
**A:** 
1. 检查 webpack dev server 是否正常运行
2. 确认浏览器缓存已禁用
3. 尝试强制刷新（Ctrl+Shift+R）
4. 检查控制台是否有错误

#### Q: 后端修改后没有生效
**A:**
1. 确认使用 `--watch` 或 `dev-server.js` 启动
2. 检查终端是否有重启日志
3. 手动重启服务：`Ctrl+C` 后重新启动

#### Q: 前后端无法通信
**A:**
1. 检查 CORS 配置
2. 确认端口正确（后端 5621，前端 9000）
3. 检查防火墙设置
4. 查看网络请求日志

#### Q: 端口被占用
**A:**
```bash
# 查找占用端口的进程
lsof -i :5621
lsof -i :9000

# 杀死进程
kill -9 <PID>

# 或修改端口配置
# 后端: 通过环境变量 PORT=5622
# 前端: 修改 webpack.config.js
```

### 6. 最佳实践

1. **开发流程**
   ```bash
   # 1. 启动联动调试
   npm run dev:all
   
   # 2. 修改代码
   # - 前端: packages/admin-ui/src/
   # - 后端: packages/server/
   
   # 3. 自动生效
   # - 前端: HMR 自动更新
   # - 后端: --watch 自动重启
   
   # 4. 查看日志
   tail -f .pids/backend.log
   tail -f .pids/frontend.log
   ```

2. **提交代码前**
   ```bash
   # 运行测试
   npm test
   
   # 代码检查
   npm run lint
   
   # 格式化代码
   npm run format
   ```

3. **性能优化**
   - 生产环境启用缓存
   - 使用 CDN 加速
   - 代码分割和懒加载

## 总结

通过以上配置，你可以：
- ✅ 避免前端模块缓存问题
- ✅ 避免后端模块缓存问题
- ✅ 实现前后端联动调试
- ✅ 提高开发效率
- ✅ 快速定位问题

如有其他问题，请查看项目文档或提交 Issue。