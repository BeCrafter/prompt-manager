# 终端增强功能开发指南

## 概述

本文档详细介绍了 Prompt Manager 终端增强功能的架构设计、实现细节和使用方法。该功能通过 WebSocket + PTY + xterm.js 技术栈，提供了真实的终端交互体验。

## 技术架构

### 整体架构

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   前端 xterm.js  │ ◄──────────────► │  WebSocket服务  │
│                 │                  │                 │
│ - 终端UI渲染     │                  │ - 连接管理       │
│ - 用户交互处理   │                  │ - 消息路由       │
│ - 主题切换       │                  │ - 会话管理       │
└─────────────────┘                  └─────────────────┘
                                                │
                                                ▼
                                        ┌─────────────────┐
                                        │  TerminalService │
                                        │                 │
                                        │ - PTY会话管理    │
                                        │ - 跨平台支持     │
                                        │ - 安全控制       │
                                        └─────────────────┘
```

### 核心组件

#### 1. TerminalService (后端)
- **位置**: `packages/server/services/TerminalService.js`
- **功能**: 管理终端会话、PTY进程、跨平台兼容性
- **关键特性**:
  - 支持多会话并发
  - 自动清理超时会话
  - 跨平台Shell支持
  - 安全权限控制

#### 2. WebSocketService (后端)
- **位置**: `packages/server/services/WebSocketService.js`
- **功能**: 处理WebSocket连接、消息路由、实时通信
- **关键特性**:
  - 连接状态管理
  - 心跳检测
  - 自动重连机制
  - 消息队列处理

#### 3. TerminalComponent (前端)
- **位置**: `packages/admin-ui/src/components/TerminalComponent.js`
- **功能**: 提供现代化终端UI、用户交互、主题支持
- **关键特性**:
  - xterm.js集成
  - 多主题支持
  - 快捷键处理
  - 响应式设计

## 使用指南

### 基本使用

1. **启动服务**
   ```bash
   npm start
   ```

2. **访问终端界面**
   - 打开浏览器访问 `http://localhost:5621/admin/`
   - 点击左侧导航的 "Terminal" 按钮
   - 等待WebSocket连接建立

3. **使用终端**
   - 直接在终端中输入命令
   - 支持所有系统原生命令
   - 支持交互式程序（vim、top、ssh等）

### 高级功能

#### 主题切换
```javascript
// 通过工具栏按钮切换
terminalComponent.toggleTheme();

// 或者直接设置主题
terminalComponent.setTheme('light');
```

#### 快捷键
- `Ctrl+C`: 中断当前命令
- `Ctrl+V`: 粘贴文本
- `Ctrl+Shift+C`: 复制选中内容
- `Ctrl+F`: 搜索内容

#### 会话管理
```javascript
// 创建新会话
const session = await terminalService.createSession({
  workingDirectory: '/custom/path',
  size: { cols: 120, rows: 30 }
});

// 获取会话信息
const info = session.getInfo();

// 关闭会话
await terminalService.removeSession(session.id);
```

## 开发指南

### 环境搭建

1. **安装依赖**
   ```bash
   npm install
   cd packages/server && npm install
   cd ../admin-ui && npm install
   ```

2. **开发模式启动**
   ```bash
   # 启动后端服务
   cd packages/server
   npm run dev
   
   # 启动前端开发服务器（新终端）
   cd ../admin-ui
   npm run dev
   ```

### 添加新功能

参考现有代码结构，在相应模块中扩展功能：
- **后端**: 在 `TerminalService.js` 和 `WebSocketService.js` 中添加新方法
- **前端**: 在 `TerminalComponent.js` 中添加UI和交互逻辑

### 测试

#### 单元测试
```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test TerminalService.test.js

# 生成覆盖率报告
npm run test:coverage
```

#### 集成测试
```bash
# 运行集成测试
npm run test -- --run tests/integration
```

#### E2E测试
```bash
# 安装Playwright浏览器
npx playwright install

# 运行E2E测试
npx playwright test

# 查看测试报告
npx playwright show-report
```

### 代码质量

#### ESLint检查
```bash
# 检查代码规范
npm run lint:check

# 自动修复
npm run lint
```

#### Prettier格式化
```bash
# 检查格式
npm run format:check

# 自动格式化
npm run format
```

## 配置选项

### 配置选项

各组件支持灵活配置：
- **TerminalService**: 会话管理、超时设置、工作目录等
- **WebSocketService**: 端口、连接数、心跳检测等
- **TerminalComponent**: 主题、字体、交互行为等

详细配置参数请参考各模块的JSDoc文档。

## 安全考虑

### 权限控制

1. **命令白名单**: 在生产环境中应该实现命令白名单机制
2. **路径限制**: 限制可访问的文件系统路径
3. **会话隔离**: 确保不同用户会话完全隔离
4. **资源限制**: 限制CPU和内存使用

### 安全配置示例

```javascript
// 在TerminalService中添加安全检查
function validateCommand(command) {
  const dangerousCommands = ['rm -rf /', 'format c:', 'sudo rm'];
  return !dangerousCommands.some(dangerous => 
    command.includes(dangerous)
  );
}

// 路径访问限制
function validatePath(path) {
  const allowedPaths = ['/home/user', '/tmp', '/var/tmp'];
  return allowedPaths.some(allowed => 
    path.startsWith(allowed)
  );
}
```

## 故障排除

### 常见问题

#### 1. WebSocket连接失败
- **症状**: 终端显示"未连接"状态
- **解决方案**:
  - 检查防火墙设置
  - 确认端口8081未被占用
  - 查看浏览器控制台错误信息

#### 2. PTY创建失败
- **症状**: 无法创建终端会话
- **解决方案**:
  - 检查node-pty依赖是否正确安装
  - 确认系统支持PTY功能
  - 查看服务器日志错误信息

#### 3. 性能问题
- **症状**: 终端响应缓慢
- **解决方案**:
  - 减少并发会话数量
  - 调整会话超时时间
  - 优化网络连接质量

### 调试技巧

- 启用调试模式查看详细日志
- 使用浏览器开发者工具监控WebSocket消息
- 通过API方法检查服务状态
- 查看服务器日志定位问题

## 性能优化

### 前端优化

1. **虚拟滚动**: 对于大量输出的场景，考虑实现虚拟滚动
2. **输出缓冲**: 批量处理终端输出，减少DOM操作
3. **延迟加载**: 按需加载终端功能

### 后端优化

1. **连接池**: 复用PTY进程，减少创建开销
2. **输出压缩**: 压缩WebSocket消息传输
3. **负载均衡**: 在多实例环境中分配负载

## 贡献指南

### 提交代码

1. **Fork项目** 并创建功能分支
2. **编写测试** 确保新功能有完整测试覆盖
3. **运行检查** 确保通过所有代码质量检查
4. **提交PR** 并提供详细的变更说明

### 代码规范

1. **JSDoc注释**: 为所有公共API提供详细注释
2. **错误处理**: 使用统一的错误处理模式
3. **日志记录**: 使用结构化日志记录
4. **测试覆盖**: 确保新代码有足够的测试覆盖

## 版本历史

### v0.0.24
- ✨ 新增终端增强功能
- 🔧 集成 WebSocket + PTY + xterm.js
- 🧪 添加完整的测试套件
- 📚 完善文档和代码质量工具

### 未来计划
- 🚀 支持更多终端主题
- 🔌 插件系统支持
- 📱 移动端优化
- 🌐 多语言支持

---

*本文档会随着功能更新持续完善，如有问题请提交Issue或PR。*