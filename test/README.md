# Prompt Manager 测试指南

## 测试结构

```
test/
├── run-tests.js              # 统一测试运行器
├── e2e/                      # 端到端测试
│   └── test-packaged-app.js  # 打包应用测试
└── integration/              # 集成测试
    └── test_upload.js        # 文件上传功能测试

packages/server/tests/
├── unit/                     # 单元测试
│   └── test.js              # 核心库功能测试
└── integration/              # 集成测试
    └── test-tools.js        # 工具系统测试
```

## 运行测试

### 运行所有测试
```bash
npm test
```

### 运行特定类型的测试

#### 服务器单元测试
```bash
npm run test:server
# 或
node test/run-tests.js --unit
```

#### 服务器集成测试
```bash
npm run test:integration
# 或
node test/run-tests.js --integration
```

#### E2E测试
```bash
npm run test:e2e
# 或
node test/run-tests.js --e2e
```

#### 上传功能测试
```bash
npm run test:upload
# 或
node test/run-tests.js --upload
```

### 代码质量检查

#### Lint检查
```bash
npm run lint:check
```

#### 格式检查
```bash
npm run format:check
```

#### 运行所有质量检查
```bash
node test/run-tests.js --quality
```

### 开发时测试

#### 服务器测试UI模式
```bash
npm run test:server:ui
```

#### 测试覆盖率
```bash
npm run test:server:coverage
```

## 测试说明

### 单元测试
- 位置: `packages/server/tests/unit/`
- 目的: 测试核心库的各个模块和函数
- 框架: Vitest

### 集成测试
- 位置: `packages/server/tests/integration/` 和 `test/integration/`
- 目的: 测试模块间的交互和完整功能流程
- 包括: 工具系统测试、文件上传测试等

### E2E测试
- 位置: `test/e2e/`
- 目的: 测试完整的用户场景和打包后的应用
- 包括: 应用启动、服务响应、Web界面访问等

## 添加新测试

### 添加单元测试
1. 在 `packages/server/tests/unit/` 创建测试文件
2. 使用 Vitest 语法编写测试
3. 运行 `npm run test:server` 验证

### 添加集成测试
1. 在 `packages/server/tests/integration/` 或 `test/integration/` 创建测试文件
2. 编写集成测试逻辑
3. 运行 `npm run test:integration` 验证

### 添加E2E测试
1. 在 `test/e2e/` 创建测试文件
2. 编写端到端测试逻辑
3. 运行 `npm run test:e2e` 验证

## CI/CD集成

测试已集成到GitHub Actions中，包括：
- 单元测试和集成测试
- E2E测试
- 代码质量检查（ESLint、Prettier）
- 安全审计
- 构建测试

详见 `.github/workflows/test-and-quality.yml`。