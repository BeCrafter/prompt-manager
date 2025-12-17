# Ant Design Vue 重构 @packages/admin-ui/ 项目开发文档

## 1. 项目概述

### 1.1 项目目标
使用 Ant Design Vue 1:1 复刻现有的 @packages/admin-ui/ 页面，实现技术栈从原生 JavaScript + HTML + CSS 到 Vue 3 + Ant Design Vue 的迁移。

### 1.2 当前技术栈分析
- **前端框架**: 纯原生 JavaScript + HTML + CSS（无框架）
- **构建工具**: Webpack 5 + Babel
- **核心依赖**: CodeMirror 5.65.2 + js-yaml
- **样式**: 自定义 CSS（约 2600 行）
- **架构**: 单页应用（SPA）模式，基于原生 JS 实现

### 1.3 目标技术栈
- **前端框架**: Vue 3 + Ant Design Vue 4
- **构建工具**: Vite（推荐）或升级后的 Webpack
- **核心依赖**: CodeMirror 5.65.2 + js-yaml
- **样式**: Ant Design Vue 主题 + 自定义 CSS
- **架构**: Vue 3 组件化架构

## 2. 技术可行性分析

### 2.1 Ant Design Vue 兼容性
✅ **技术可行性**: Ant Design Vue 基于 Vue 3，与当前原生 JS 架构兼容
✅ **功能覆盖**: Ant Design Vue 组件库能覆盖现有所有 UI 组件
✅ **CodeMirror 集成**: 可以继续使用 CodeMirror 作为编辑器
⚠️ **技术栈迁移**: 需要从原生 JS 迁移到 Vue 3 + Ant Design Vue

### 2.2 组件映射关系

| 当前组件 | Ant Design Vue 对应组件 | 复杂度 |
|---------|------------------------|--------|
| 登录界面 | a-form + a-input + a-button | 低 |
| 顶部导航 | a-layout-header + a-dropdown | 中 |
| 左侧边栏 | a-layout-sider + a-menu | 高 |
| 编辑器区域 | a-tabs + a-card + CodeMirror | 高 |
| 参数配置 | a-form + a-table + a-modal | 高 |
| 弹窗系统 | a-modal + a-message | 中 |

## 3. 详细重构计划

### 3.1 第一阶段：技术栈准备

#### 3.1.1 安装依赖
```bash
npm install vue@3 ant-design-vue@4 @ant-design/icons-vue
npm install -D @vitejs/plugin-vue vue-loader @vue/compiler-sfc
```

#### 3.1.2 构建工具迁移
- 从 Webpack 迁移到 Vite（推荐）或升级 Webpack 配置
- 配置 Vue 3 支持

### 3.2 第二阶段：组件重构

#### 3.2.1 项目结构设计
```
packages/admin-ui/
├── src/
│   ├── components/          # Vue 组件
│   │   ├── LoginForm.vue   # 登录组件
│   │   ├── Header.vue      # 顶部导航
│   │   ├── Sidebar.vue     # 左侧边栏
│   │   ├── Editor.vue      # 编辑器组件
│   │   └── ConfigPanel.vue # 参数配置面板
│   ├── App.vue             # 根组件
│   ├── main.js             # 入口文件
│   └── router/             # 路由配置
├── index.html              # HTML 模板
├── vite.config.js          # Vite 配置
└── package.json            # 项目配置
```

#### 3.2.2 组件实现计划

1. **登录组件 (LoginForm.vue)**
   - 使用 Ant Design Vue Form 组件
   - 实现用户名/密码验证
   - 集成登录逻辑

2. **顶部导航 (Header.vue)**
   - 使用 Ant Design Vue Layout.Header
   - 实现用户信息展示
   - 集成下拉菜单

3. **左侧边栏 (Sidebar.vue)**
   - 使用 Ant Design Vue Layout.Sider + Menu
   - 实现菜单展开/折叠
   - 集成路由跳转

4. **编辑器组件 (Editor.vue)**
   - 使用 Ant Design Vue Tabs + Card
   - 集成 CodeMirror 编辑器
   - 实现编辑器功能

5. **参数配置面板 (ConfigPanel.vue)**
   - 使用 Ant Design Vue Form + Table
   - 实现参数配置功能
   - 集成模态框

### 3.3 第三阶段：功能迁移

1. **API 调用层**: 保持现有 API 接口不变
2. **状态管理**: 使用 Vue 3 Composition API 替代原生 JS 状态管理
3. **事件系统**: 使用 Vue 事件系统替代原生事件监听
4. **样式迁移**: 将现有 CSS 转换为 Ant Design Vue 主题定制

## 4. 验证方案

### 4.1 Context7 组件文档集成
使用 Context7 获取 Ant Design Vue 组件文档，确保组件使用的正确性。

### 4.2 Chrome DevTools 验证
1. **Element 面板**: 验证 DOM 结构和样式
2. **Console 面板**: 检查 JavaScript 错误
3. **Network 面板**: 验证 API 请求
4. **Application 面板**: 检查存储和缓存

### 4.3 功能验证
1. **登录功能**: 验证用户登录/登出
2. **编辑器功能**: 验证代码编辑、语法高亮等
3. **参数配置**: 验证参数的添加、编辑、删除
4. **路由功能**: 验证页面跳转

## 5. 工作量和风险评估

### 5.1 工作量估算
- **小型重构**: 2-3 周（熟悉 Vue + Ant Design）
- **中型重构**: 3-4 周（包含完整测试）
- **大型重构**: 4-6 周（包含性能优化和完整迁移）

### 5.2 主要风险
1. **学习曲线**: 需要掌握 Vue 3 + Ant Design Vue
2. **兼容性问题**: CodeMirror 在 Vue 中的集成
3. **样式覆盖**: Ant Design 主题定制可能复杂
4. **构建配置**: Webpack 到 Vite 的迁移风险

### 5.3 优势
1. **组件化**: 更好的代码组织和复用
2. **开发效率**: Ant Design 提供丰富的现成组件
3. **维护性**: Vue 3 的响应式系统更易维护
4. **生态丰富**: Vue 3 生态完善，工具链成熟

## 6. 推荐方案

采用渐进式重构策略：
1. 先引入 Vue 3，保持现有功能
2. 逐步替换组件，从简单到复杂
3. 保留 CodeMirror，作为独立组件集成
4. 分阶段测试，确保功能完整性

技术栈建议：
Vue 3 + Ant Design Vue 4 + Vite + TypeScript（可选）

## 7. 开发指南

### 7.1 组件开发规范
1. **组件命名**: 使用 PascalCase 命名组件
2. **代码风格**: 遵循 Vue 3 编码规范
3. **样式管理**: 使用 Ant Design Vue 主题变量
4. **组件通信**: 使用 props、emit 和 provide/inject

### 7.2 测试策略
1. **单元测试**: 使用 Vitest 测试组件
2. **集成测试**: 测试组件间的交互
3. **E2E 测试**: 使用 Playwright 测试完整功能

### 7.3 部署与发布
1. **构建命令**: `npm run build`
2. **部署流程**: 与现有部署流程保持一致
3. **版本管理**: 使用语义化版本控制

## 8. 结论

可以实现 Ant Design Vue 1:1 复刻 @packages/admin-ui/ 页面，需要完整的技术栈迁移。建议采用渐进式重构策略，分阶段实施，确保功能完整性和稳定性。

---

**文档生成时间**: 2025-12-16
**文档用途**: AI 模型开发参考
**验证工具**: Context7 + Chrome DevTools