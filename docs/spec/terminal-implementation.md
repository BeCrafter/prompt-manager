# 终端功能开发实现方案

## 文档信息

- **项目名称**: Prompt Manager - 终端功能
- **文档版本**: v1.0
- **创建日期**: 2025-12-27
- **状态**: 待评审
- **负责人**: 开发团队

---

## 0. 技术方案概述

### 0.1 复用现有代码

**好消息：后端代码无需调整**

- `packages/server/services/TerminalService.js` - 已完成，直接复用
- `packages/server/services/WebSocketService.js` - 已完成，直接复用
- `node-pty` 模块 - 已集成，无需调整

**需要调整：前端代码**

- `packages/admin-ui/src/components/TerminalComponent.js` - 需要简化工具栏
- `packages/admin-ui/css/terminal-fix.css` - 需要调整样式
- 新增：浮动按钮组件
- 新增：侧边抽屉容器

### 0.2 架构调整

**原有架构：**
```
导航栏 → 独立的终端视图页面
```

**新架构：**
```
提示词编辑页面 → 浮动按钮 → 侧边抽屉 → TerminalComponent
```

### 0.3 技术栈

**后端（无需调整）：**
- Node.js >= 18.0.0
- Express.js
- node-pty
- ws (WebSocket)

**前端（需要调整）：**
- 原生 JavaScript
- xterm.js 5.3.0
- xterm-addon-canvas
- xterm-addon-fit
- xterm-addon-web-links
- xterm-addon-search
- xterm-addon-unicode11

---

## 1. 开发任务分解

### 1.1 Phase 1: 前端调整（1-2 天）

#### 任务 1.1: 创建浮动按钮组件

**文件：** `packages/admin-ui/src/components/TerminalFloatingButton.js`

**功能：**
- 固定在提示词编辑页面右下角
- 点击时打开终端面板
- 终端打开时，按钮高亮
- 支持拖拽（可选）

**代码结构：**
```javascript
export class TerminalFloatingButton {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.button = null;
    this.isOpen = false;
    this.onClick = null;
    
    this.render();
    this.bindEvents();
  }
  
  render() {
    // 创建浮动按钮
  }
  
  bindEvents() {
    // 绑定点击事件
  }
  
  toggle() {
    // 切换打开/关闭状态
  }
  
  setOpen(isOpen) {
    // 设置打开状态
  }
  
  destroy() {
    // 销毁组件
  }
}
```

**样式：**
```css
.terminal-floating-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.terminal-floating-button:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.05);
}

.terminal-floating-button.active {
  background: rgba(76, 175, 80, 0.8);
  box-shadow: 0 0 16px rgba(76, 175, 80, 0.5);
}
```

---

#### 任务 1.2: 创建侧边抽屉容器

**文件：** `packages/admin-ui/src/components/TerminalDrawer.js`

**功能：**
- 从右下角滑出的侧边抽屉
- 包含 TerminalComponent
- 支持拖拽调整大小
- 支持最小化
- 支持关闭

**代码结构：**
```javascript
export class TerminalDrawer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: 600,
      height: 'auto',
      minHeight: 300,
      maxHeight: 800,
      position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
      ...options
    };
    
    this.drawer = null;
    this.header = null;
    this.content = null;
    this.terminalComponent = null;
    this.isOpen = false;
    this.isMinimized = false;
    
    this.render();
    this.bindEvents();
  }
  
  render() {
    // 创建抽屉容器
    // 创建头部（工具栏）
    // 创建内容区域（放置 TerminalComponent）
  }
  
  bindEvents() {
    // 绑定拖拽事件
    // 绑定最小化事件
    // 绑定关闭事件
  }
  
  open() {
    // 打开抽屉
  }
  
  close() {
    // 关闭抽屉
  }
  
  toggle() {
    // 切换打开/关闭
  }
  
  minimize() {
    // 最小化
  }
  
  restore() {
    // 恢复
  }
  
  resize(width, height) {
    // 调整大小
  }
  
  initTerminal() {
    // 初始化 TerminalComponent
  }
  
  destroy() {
    // 销毁组件
  }
}
```

**样式：**
```css
.terminal-drawer {
  position: fixed;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  z-index: 999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.terminal-drawer.position-bottom-right {
  bottom: 80px;
  right: 24px;
  transform-origin: bottom right;
}

.terminal-drawer.closed {
  transform: scale(0.9);
  opacity: 0;
  pointer-events: none;
}

.terminal-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: move;
  user-select: none;
}

.terminal-drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.terminal-drawer-actions {
  display: flex;
  gap: 4px;
}

.terminal-drawer-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.terminal-drawer-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.terminal-drawer-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.terminal-drawer-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;
  height: 8px;
  cursor: nwse-resize;
}
```

---

#### 任务 1.3: 调整 TerminalComponent.js

**文件：** `packages/admin-ui/src/components/TerminalComponent.js`

**需要调整的地方：**

1. **简化工具栏**
   - 移除"重新连接"按钮（不需要）
   - 简化状态指示器（只显示连接状态）
   - 保留"清除"和"主题切换"按钮

2. **调整初始化逻辑**
   - 不再自动连接 WebSocket（由 TerminalDrawer 控制）
   - 添加 `connect()` 和 `disconnect()` 方法

3. **调整样式**
   - 适应侧边抽屉的大小
   - 半透明背景

**代码调整：**
```javascript
// 在 createToolbar() 方法中
createToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'terminal-toolbar';
  
  // 状态指示器
  const status = document.createElement('div');
  status.className = 'terminal-status';
  status.innerHTML = `
    <span class="status-indicator ${this.isConnected ? 'connected' : 'disconnected'}"></span>
    <span class="status-text">${this.isConnected ? '已连接' : '未连接'}</span>
  `;
  
  // 操作按钮（简化）
  const actions = document.createElement('div');
  actions.className = 'terminal-actions';
  actions.innerHTML = `
    <button class="btn btn-sm" title="清除" id="clearBtn">
      <i class="icon-clear"></i>
    </button>
    <button class="btn btn-sm" title="主题" id="themeBtn">
      <i class="icon-theme"></i>
    </button>
  `;
  
  toolbar.appendChild(status);
  toolbar.appendChild(actions);
  this.container.insertBefore(toolbar, this.container.firstChild);
  
  this.bindToolbarEvents();
}

// 新增方法
async connect() {
  if (this.isConnected) return;
  await this.connectWebSocket();
}

async disconnect() {
  if (!this.isConnected) return;
  this.websocket?.close();
}
```

---

#### 任务 1.4: 调整 terminal-fix.css

**文件：** `packages/admin-ui/css/terminal-fix.css`

**需要调整的地方：**

1. **调整终端面板样式**
   - 半透明背景
   - 模糊效果
   - 圆角边框

2. **调整工具栏样式**
   - 简化设计
   - 半透明背景

3. **调整滚动条样式**
   - 更细的滚动条
   - 半透明样式

**代码调整：**
```css
/* 终端容器样式（适应侧边抽屉） */
.xterm-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

/* 工具栏样式（简化） */
.terminal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.terminal-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.terminal-actions .btn {
  padding: 3px 6px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.terminal-actions .btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}
```

---

#### 任务 1.5: 集成到提示词编辑页面

**文件：** `packages/admin-ui/src/index.js`（或其他入口文件）

**需要做的事情：**

1. 在提示词编辑页面加载时，创建浮动按钮和侧边抽屉
2. 监听浮动按钮点击事件，打开/关闭抽屉
3. 抽屉打开时，初始化 TerminalComponent
4. 抽屉关闭时，断开连接（可选：保持后台运行）

**代码示例：**
```javascript
// 在提示词编辑页面初始化时
function initTerminalFeature() {
  // 创建浮动按钮
  const floatingButton = new TerminalFloatingButton(document.body);
  
  // 创建侧边抽屉
  const drawer = new TerminalDrawer(document.body);
  
  // 绑定点击事件
  floatingButton.onClick = () => {
    drawer.toggle();
    floatingButton.setOpen(drawer.isOpen);
    
    if (drawer.isOpen) {
      drawer.initTerminal();
    }
  };
  
  // 返回实例，方便后续操作
  return {
    floatingButton,
    drawer
  };
}

// 在页面加载时调用
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否在提示词编辑页面
  if (isPromptEditPage()) {
    initTerminalFeature();
  }
});
```

---

### 1.2 Phase 2: 集成测试（1 天）

#### 测试清单

**功能测试：**
- [ ] 浮动按钮显示正常
- [ ] 点击浮动按钮，抽屉滑出
- [ ] 再次点击，抽屉收起
- [ ] 终端初始化成功
- [ ] 可以输入命令
- [ ] 可以执行命令
- [ ] 命令输出显示正常
- [ ] 支持 ANSI 颜色
- [ ] 快捷键正常工作（Ctrl+C、Ctrl+L、Ctrl+V）
- [ ] 主题切换正常
- [ ] 清除终端正常

**UI/UX 测试：**
- [ ] 抽屉滑出/收起动画流畅（60fps）
- [ ] 抽屉可以拖拽调整大小
- [ ] 抽屉可以最小化
- [ ] 最小化后可以恢复
- [ ] 浮动按钮在终端打开时高亮
- [ ] 半透明背景和模糊效果正常

**兼容性测试：**
- [ ] Chrome 90+ 正常
- [ ] Firefox 88+ 正常
- [ ] Safari 14+ 正常
- [ ] Edge 90+ 正常

**性能测试：**
- [ ] 浮动按钮不阻塞主线程
- [ ] 抽屉滑出/收起动画流畅
- [ ] 终端初始化时间 < 1 秒
- [ ] 命令响应延迟 < 100ms
- [ ] 内存占用 < 30MB
- [ ] 无内存泄漏

**稳定性测试：**
- [ ] 可以长时间使用（> 1 小时）
- [ ] 可以处理大量输出（> 1000 行）
- [ ] 网络波动时自动重连
- [ ] 可以正确清理资源

---

### 1.3 Phase 3: 优化和文档（1 天）

#### 优化任务

**动画优化：**
- [ ] 优化抽屉滑出/收起动画
- [ ] 优化按钮 hover 动画
- [ ] 优化主题切换动画

**样式优化：**
- [ ] 调整浮动按钮样式
- [ ] 调整抽屉样式
- [ ] 调整工具栏样式
- [ ] 调整滚动条样式

**交互优化：**
- [ ] 优化拖拽体验
- [ ] 优化最小化/恢复体验
- [ ] 优化键盘快捷键

**性能优化：**
- [ ] 减少不必要的重绘
- [ ] 优化 WebSocket 消息处理
- [ ] 优化终端渲染

#### 文档任务

**用户文档：**
- [ ] 编写使用说明
- [ ] 编写快捷键说明
- [ ] 添加截图和示例

**开发文档：**
- [ ] 更新 API 文档
- [ ] 更新组件文档
- [ ] 添加代码注释

**更新 README：**
- [ ] 更新功能列表
- [ ] 更新使用说明
- [ ] 更新截图

---

## 2. 代码清单

### 2.1 新增文件

```
packages/admin-ui/src/components/
├── TerminalFloatingButton.js    # 浮动按钮组件
└── TerminalDrawer.js            # 侧边抽屉组件
```

### 2.2 修改文件

```
packages/admin-ui/src/
├── index.js                     # 集成到提示词编辑页面
└── components/
    └── TerminalComponent.js     # 简化工具栏，添加 connect/disconnect 方法

packages/admin-ui/css/
└── terminal.css             # 调整样式，适应侧边抽屉
```

### 2.3 无需修改的文件

```
packages/server/services/
├── TerminalService.js           # 已完成，无需修改
└── WebSocketService.js          # 已完成，无需修改
```

---

## 3. 技术细节

### 3.1 浮动按钮实现

**HTML 结构：**
```html
<button class="terminal-floating-button" title="打开终端">
  <svg viewBox="0 0 24 24" width="24" height="24">
    <!-- 终端图标 -->
  </svg>
</button>
```

**CSS 动画：**
```css
.terminal-floating-button {
  transition: all 0.2s ease;
}

.terminal-floating-button:hover {
  transform: scale(1.05);
}

.terminal-floating-button.active {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.5);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(76, 175, 80, 0);
  }
}
```

---

### 3.2 侧边抽屉实现

**HTML 结构：**
```html
<div class="terminal-drawer position-bottom-right">
  <div class="terminal-drawer-header">
    <div class="terminal-drawer-title">
      <span class="status-indicator connected"></span>
      <span class="status-text">已连接</span>
    </div>
    <div class="terminal-drawer-actions">
      <button class="terminal-drawer-btn" title="最小化">−</button>
      <button class="terminal-drawer-btn" title="关闭">×</button>
    </div>
  </div>
  <div class="terminal-drawer-content">
    <!-- TerminalComponent 容器 -->
    <div class="xterm-container"></div>
  </div>
  <div class="terminal-drawer-resize-handle"></div>
</div>
```

**CSS 动画：**
```css
.terminal-drawer {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.terminal-drawer.closed {
  transform: scale(0.9);
  opacity: 0;
  pointer-events: none;
}

.terminal-drawer.minimized {
  height: 40px;
  overflow: hidden;
}
```

**JavaScript 拖拽实现：**
```javascript
initDrag() {
  const header = this.header;
  let isDragging = false;
  let startX, startY, startWidth, startHeight;
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = this.drawer.offsetWidth;
    startHeight = this.drawer.offsetHeight;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
  
  function onMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    const newWidth = Math.max(400, startWidth + deltaX);
    const newHeight = Math.max(300, startHeight + deltaY);
    
    drawer.resize(newWidth, newHeight);
  }
  
  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}
```

---

### 3.3 TerminalComponent 调整

**移除的功能：**
- 重新连接按钮（不需要）
- 渲染器类型显示（简化）

**保留的功能：**
- 连接状态指示器
- 清除按钮
- 主题切换按钮

**新增的方法：**
```javascript
async connect() {
  if (this.isConnected) return;
  await this.connectWebSocket();
}

async disconnect() {
  if (!this.isConnected) return;
  this.websocket?.close();
}
```

---

### 3.4 集成逻辑

**初始化流程：**
```javascript
1. 页面加载
2. 检查是否在提示词编辑页面
3. 创建浮动按钮
4. 创建侧边抽屉
5. 绑定点击事件
6. 等待用户点击浮动按钮
7. 打开抽屉
8. 初始化 TerminalComponent
9. 连接 WebSocket
10. 创建 PTY 会话
```

**销毁流程：**
```javascript
1. 用户关闭抽屉
2. 断开 WebSocket（可选）
3. 销毁 TerminalComponent
4. 清理事件监听器
```

---

## 4. 测试方案

### 4.1 单元测试

**TerminalFloatingButton 测试：**
```javascript
describe('TerminalFloatingButton', () => {
  it('should create button element', () => {
    const button = new TerminalFloatingButton(document.body);
    expect(button.button).not.toBeNull();
  });
  
  it('should toggle open state', () => {
    const button = new TerminalFloatingButton(document.body);
    button.toggle();
    expect(button.isOpen).toBe(true);
    button.toggle();
    expect(button.isOpen).toBe(false);
  });
});
```

**TerminalDrawer 测试：**
```javascript
describe('TerminalDrawer', () => {
  it('should create drawer element', () => {
    const drawer = new TerminalDrawer(document.body);
    expect(drawer.drawer).not.toBeNull();
  });
  
  it('should open and close drawer', () => {
    const drawer = new TerminalDrawer(document.body);
    drawer.open();
    expect(drawer.isOpen).toBe(true);
    drawer.close();
    expect(drawer.isOpen).toBe(false);
  });
  
  it('should minimize and restore drawer', () => {
    const drawer = new TerminalDrawer(document.body);
    drawer.minimize();
    expect(drawer.isMinimized).toBe(true);
    drawer.restore();
    expect(drawer.isMinimized).toBe(false);
  });
});
```

---

### 4.2 集成测试

**端到端测试：**
```javascript
describe('Terminal Integration', () => {
  it('should open drawer and connect to terminal', async () => {
    const floatingButton = new TerminalFloatingButton(document.body);
    const drawer = new TerminalDrawer(document.body);
    
    floatingButton.onClick = () => {
      drawer.toggle();
      drawer.initTerminal();
    };
    
    floatingButton.onClick();
    
    expect(drawer.isOpen).toBe(true);
    expect(drawer.terminalComponent).not.toBeNull();
    expect(drawer.terminalComponent.isConnected).toBe(true);
  });
});
```

---

### 4.3 性能测试

**性能指标测试：**
```javascript
describe('Terminal Performance', () => {
  it('should initialize in less than 1 second', async () => {
    const start = performance.now();
    const drawer = new TerminalDrawer(document.body);
    await drawer.initTerminal();
    const end = performance.now();
    
    expect(end - start).toBeLessThan(1000);
  });
  
  it('should handle large output without lag', async () => {
    const drawer = new TerminalDrawer(document.body);
    await drawer.initTerminal();
    
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      drawer.terminalComponent.write(`Line ${i}\n`);
    }
    const end = performance.now();
    
    expect(end - start).toBeLessThan(1000);
  });
});
```

---

## 5. 部署方案

### 5.1 构建流程

```bash
# 1. 安装依赖
npm install

# 2. 构建前端
cd packages/admin-ui
npm run build

# 3. 返回根目录
cd ../..

# 4. 测试
npm test

# 5. 打包
npm run build
```

### 5.2 发布流程

```bash
# 1. 更新版本号
npm version patch

# 2. 提交代码
git add .
git commit -m "feat: 添加终端功能"

# 3. 推送到远程
git push

# 4. 发布到 npm
npm publish
```

---

## 6. 风险和应对

### 6.1 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 浮动按钮遮挡内容 | 低 | 中 | 可拖拽调整位置 |
| 抽屉动画卡顿 | 中 | 低 | 使用 CSS 动画 |
| 终端性能问题 | 低 | 低 | 复用现有代码 |
| 兼容性问题 | 低 | 低 | 在主流浏览器测试 |

### 6.2 产品风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|----------|
| 用户不需要 | 中 | 中 | 快速验证，收集反馈 |
| 功能定位不清晰 | 高 | 低 | 明确产品定位 |
| 增加复杂性 | 中 | 中 | 保持简单，只做 MVP |

---

## 7. 后续优化

### 7.1 短期优化（1-2 周）

- [ ] 收集用户反馈
- [ ] 优化动画效果
- [ ] 优化样式细节
- [ ] 修复 bug

### 7.2 中期优化（1-2 个月）

- [ ] 添加命令历史记录
- [ ] 添加自动执行命令功能
- [ ] 与提示词测试功能集成
- [ ] 优化性能

### 7.3 长期优化（3-6 个月）

- [ ] 根据用户反馈决定是否继续投入
- [ ] 如果用户反馈好，可以考虑添加更多功能
- [ ] 如果用户反馈不好，考虑移除这个功能

---

## 8. 总结

### 8.1 核心原则

1. **复用现有代码** - 后端无需调整，前端只需简化
2. **保持简单** - 只做 MVP，不追求功能完整
3. **快速验证** - 3-4 天完成，快速上线收集反馈
4. **及时止损** - 如果用户反馈不好，及时移除

### 8.2 开发时间线

| 阶段 | 时间 | 任务 |
|------|------|------|
| Phase 1 | 1-2 天 | 前端调整 |
| Phase 2 | 1 天 | 集成测试 |
| Phase 3 | 1 天 | 优化和文档 |
| **总计** | **3-4 天** | **完成开发** |

### 8.3 成功标准

- [ ] 功能正常运行
- [ ] 性能满足要求
- [ ] 兼容主流浏览器
- [ ] 用户反馈良好

---

**文档结束**