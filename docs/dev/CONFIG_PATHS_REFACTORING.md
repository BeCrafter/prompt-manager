# 配置路径统一重构指南

> **创建日期**: 2026-01-10
> **状态**: 待执行
> **优先级**: 高

## 📋 目录

- [问题分析](#问题分析)
- [重构目标](#重构目标)
- [当前问题汇总](#当前问题汇总)
- [重构方案](#重构方案)
- [详细修改指南](#详细修改指南)
- [执行策略](#执行策略)
- [验证检查清单](#验证检查清单)

---

## 问题分析

### 核心问题

当前项目中存在严重的**配置散乱问题**：

1. **configHome 依赖于 promptsDir**
   - 当指定自定义 promptsDir 时，configHome 会跟随变化
   - 违反了配置固定的原则

2. **硬编码路径泛滥**
   - 22处硬编码分布在14个文件中
   - 各服务独立计算路径，缺乏统一管理

### 影响范围

- ✅ 运行时路径不一致
- ✅ 配置难以维护和测试
- ✅ 自定义 promptsDir 时配置文件位置混乱
- ✅ 路径变更需要修改多个文件

---

## 重构目标

### 核心原则

1. **单一真实来源 (Single Source of Truth)**
   - 所有路径配置从 `config.js` 获取
   - configHome 始终固定为 `${HOME}/.prompt-manager`

2. **统一接口访问**
   - 提供各子目录的 getter 方法
   - 参数化方法（如 `getToolDir(toolName)`）

3. **清晰分层**
   - 配置层 vs 业务层分离
   - 配置计算集中在 config.js

4. **向后兼容**
   - 保留现有方法
   - 新增便捷方法

### 目标路径结构

\`\`\`
~/.prompt-manager/              # configHome (固定)
  ├── .env                     # 环境变量文件
  ├── configs/                 # 配置目录
  │   ├── models/             # 模型配置
  │   └── templates/          # 模板配置
  ├── prompts/                # 提示词目录（默认）
  ├── toolbox/                # 工具沙箱
  │   ├── filesystem/
  │   ├── pdf-reader/
  │   └── ...
  └── temp/                   # 临时文件

/path/to/custom/prompts/         # promptsDir (可自定义)
  └── *.yaml                     # 提示词文件
\`\`\`

---

## 当前问题汇总

### 问题1: configHome 依赖于 promptsDir

**文件**: \`packages/server/utils/config.js\`

**问题代码**:
\`\`\`javascript
// 第115行 - 构造函数
this.promptsDir = expandPath(cliArgs.promptsDir) ||
  expandPath(process.env.PROMPTS_DIR) ||
  DEFAULT_PROMPTS_DIR;
this.configHome = path.dirname(this.promptsDir);  // ❌ 问题！

// 第184行 - applyOverrides
if (promptsDir) {
  this.promptsDir = expandPath(promptsDir);
  this.configHome = path.dirname(this.promptsDir);  // ❌ 问题！
}
\`\`\`

**影响**:
- 默认路径: \`promptsDir = ~/.prompt-manager/prompts\` → \`configHome = ~/.prompt-manager\` ✅
- 自定义路径: \`promptsDir = /custom/path/prompts\` → \`configHome = /custom/path\` ❌

### 问题2: 硬编码路径统计

| 文件 | 硬编码次数 | 路径类型 |
|------|----------|---------|
| \`utils/util.js\` | 2处 | promptsDir, userConfigDir |
| \`services/model.service.js\` | 1处 | configs/models |
| \`services/template.service.js\` | 1处 | configs/templates |
| \`api/tool.routes.js\` | 4处 | temp, toolbox (多次) |
| \`toolm/tool-loader.service.js\` | 2处 | toolbox |
| \`toolm/tool-sync.service.js\` | 1处 | toolbox |
| \`toolm/tool-logger.service.js\` | 2处 | toolbox |
| \`toolm/tool-context.service.js\` | 1处 | toolbox |
| \`toolm/tool-mode-handlers.service.js\` | 1处 | toolbox |
| \`toolm/tool-dependency.service.js\` | 1处 | toolbox |
| \`toolm/tool-environment.service.js\` | 3处 | toolbox |
| \`toolm/tool-storage.service.js\` | 1处 | toolbox |
| \`toolm/validate-system.js\` | 1处 | tools |

**总计**: 22处硬编码分布在14个文件中

---

## 重构方案

### 阶段1: 扩展配置基础设施

#### 文件: \`packages/server/utils/config.js\`

**新增方法位置**: 在第 254 行 \`getPort()\` 之后

\`\`\`javascript
/**
 * 获取配置主目录
 * @returns {string} 配置主目录路径
 */
getConfigHome() {
  return this.configHome || DEFAULT_HOME_DIR;
}

/**
 * 获取临时文件目录
 * @returns {string} 临时文件目录路径
 */
getTempDir() {
  return path.join(this.getConfigHome(), 'temp');
}

/**
 * 获取工具箱目录
 * @returns {string} 工具箱目录路径
 */
getToolboxDir() {
  return path.join(this.getConfigHome(), 'toolbox');
}

/**
 * 获取指定工具的目录
 * @param {string} toolName - 工具名称
 * @returns {string} 工具目录路径
 * @throws {Error} 如果 toolName 未提供
 */
getToolDir(toolName) {
  if (!toolName) {
    throw new Error('toolName is required for getToolDir()');
  }
  return path.join(this.getToolboxDir(), toolName);
}

/**
 * 获取模型配置目录
 * @returns {string} 模型配置目录路径
 */
getModelsDir() {
  return path.join(this.getConfigHome(), 'configs', 'models');
}

/**
 * 获取模板配置目录
 * @returns {string} 模板配置目录路径
 */
getTemplatesDir() {
  return path.join(this.getConfigHome(), 'configs', 'templates');
}

/**
 * 获取用户配置目录
 * @returns {string} 用户配置目录路径
 */
getConfigsDir() {
  return path.join(this.getConfigHome(), 'configs');
}

/**
 * 获取环境变量文件路径
 * @returns {string} .env 文件路径
 */
getEnvFilePath() {
  return path.join(this.getConfigHome(), '.env');
}
\`\`\`

**修改构造函数中的 configHome 赋值**:

\`\`\`javascript
// 第115行
// 修改前：
// this.configHome = path.dirname(this.promptsDir);

// 修改后：
this.configHome = DEFAULT_HOME_DIR;
\`\`\`

\`\`\`javascript
// 第184行
// 修改前：
// this.configHome = path.dirname(this.promptsDir);

// 修改后：
// configHome 保持不变，不重新赋值
\`\`\`

**新增验证方法**（在第 329 行 \`getPublicConfig()\` 之前）:

\`\`\`javascript
/**
 * 验证配置路径一致性
 * @throws {Error} 如果路径配置不一致
 */
validatePaths() {
  const configHome = this.getConfigHome();
  const expectedHome = DEFAULT_HOME_DIR;
  
  if (configHome !== expectedHome) {
    throw new Error(
      \`ConfigHome不一致: 期望 \${expectedHome}, 实际 \${configHome}\`
    );
  }
  
  // 验证各目录是否可以创建
  const dirsToCheck = [
    this.getPromptsDir(),
    this.getTempDir(),
    this.getToolboxDir(),
    this.getModelsDir(),
    this.getTemplatesDir()
  ];
  
  for (const dir of dirsToCheck) {
    // 仅验证路径格式，不实际创建目录
    if (!dir || typeof dir !== 'string') {
      throw new Error(\`无效的目录路径: \${dir}\`);
    }
  }
  
  return true;
}
\`\`\`


---

## 详细修改指南

### 2.1 \`packages/server/utils/util.js\`

**需要添加的导入**（在文件开头）:
\`\`\`javascript
import { config } from './config.js';
\`\`\`

**修改1: promptsDir（第19行）**:
\`\`\`diff
- const promptsDir = path.join(os.homedir(), '.prompt-manager', 'prompts');
+ const promptsDir = config.getPromptsDir();
\`\`\`

**修改2: userConfigDir（第60行）**:
\`\`\`diff
async seedBuiltInConfigsIfEmpty() {
  try {
-   const userConfigDir = path.join(os.homedir(), '.prompt-manager', 'configs');
+   const userConfigDir = config.getConfigsDir();
    const builtInConfigsDir = this.getBuiltInConfigsDir();
\`\`\`

---

### 2.2 \`packages/server/services/model.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改: customDir（第42行）**:
\`\`\`diff
class ModelManager {
  constructor() {
    this.builtInDir = path.join(util.getBuiltInConfigsDir(), 'models/built-in');
-   this.customDir = path.join(os.homedir(), '.prompt-manager/configs/models');
+   this.customDir = config.getModelsDir();
    this.loadedModels = new Map();
    this.idToPathMap = new Map();
    this.providersConfig = null;
  }
\`\`\`

---

### 2.3 \`packages/server/services/template.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改: customDir（第35行）**:
\`\`\`diff
class TemplateManager {
  constructor() {
    this.builtInDir = path.join(util.getBuiltInConfigsDir(), 'templates/built-in');
-   this.customDir = path.join(os.homedir(), '.prompt-manager/configs/templates');
+   this.customDir = config.getTemplatesDir();
    this.loadedTemplates = new Map();
    this.idToPathMap = new Map();
  }
\`\`\`

---

### 2.4 \`packages/server/api/tool.routes.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改1: uploadDir（第20行）**:
\`\`\`diff
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
-     const uploadDir = path.join(os.homedir(), '.prompt-manager', 'temp');
+     const uploadDir = config.getTempDir();
      fs.ensureDirSync(uploadDir);
      cb(null, uploadDir);
    },
\`\`\`

**修改2: toolboxDir（第205行）**:
\`\`\`diff
- const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolboxDir = config.getToolDir(toolName);
  const readmePath = path.join(toolboxDir, 'README.md');
\`\`\`

**修改3: tempDir（第264行）**:
\`\`\`diff
- const tempDir = path.join(os.homedir(), '.prompt-manager', 'temp');
+ const tempDir = config.getTempDir();
  extractedDir = path.join(tempDir, \`extracted_\${Date.now()}_\${Math.round(Math.random() * 1e9)}\`);
\`\`\`

**修改4: toolboxDir（第305行）**:
\`\`\`diff
- const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
+ const toolboxDir = config.getToolboxDir();
  const targetToolDir = path.join(toolboxDir, toolName);
\`\`\`

---

### 2.5 \`packages/server/toolm/tool-loader.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改1: toolDirectories（第31行）**:
\`\`\`diff
class ToolLoaderService {
  constructor() {
    this.toolCache = new Map();
    this.toolDirectories = [
-     path.join(os.homedir(), '.prompt-manager', 'toolbox')
+     config.getToolboxDir()
    ];
    this.initialized = false;
  }
\`\`\`

**修改2: toolboxDir（第50行）**:
\`\`\`diff
async initialize() {
  if (this.initialized) {
    return;
  }
  logger.info('初始化工具加载器...');
- const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
+ const toolboxDir = config.getToolboxDir();
  await fs.ensureDir(toolboxDir);
  await this.scanAndLoadTools();
  this.initialized = true;
  logger.info(\`工具加载器初始化完成，共加载 \${this.toolCache.size} 个工具\`);
}
\`\`\`

---

### 2.6 \`packages/server/toolm/tool-sync.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改: toolboxDir（第54行）**:
\`\`\`diff
export async function syncSystemTools() {
  logger.info('开始同步系统工具到沙箱环境...');
  // ... 中间代码保持不变 ...
- const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
+ const toolboxDir = config.getToolboxDir();
  await fs.ensureDir(toolboxDir);
  // ... 后续代码保持不变 ...
}
\`\`\`

---

### 2.7 \`packages/server/toolm/tool-logger.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改1: toolDir（第86行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

**修改2: toolboxDir（第174行）**:
\`\`\`diff
- const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
+ const toolboxDir = config.getToolboxDir();
\`\`\`

**修改3: logFilePath（第189行）**:
\`\`\`diff
- const logFilePath = path.join(toolboxDir, toolName, 'run.log');
+ const logFilePath = path.join(config.getToolDir(toolName), 'run.log');
\`\`\`

---

### 2.8 \`packages/server/toolm/tool-context.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改1: toolDir（第24行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

**修改2: allowedDirs（第74行）**:
\`\`\`diff
- let allowedDirs = ['~/.prompt-manager'];
+ let allowedDirs = [config.getConfigHome()];
\`\`\`

**修改3: expanded（第116行，如果存在）**:
\`\`\`diff
- const expanded = dir.replace(/^~/, os.homedir());
+ const expanded = dir.replace(/^~/, config.getConfigHome());
\`\`\`

**修改4: expandedPath（第148行，如果存在）**:
\`\`\`diff
- const expandedPath = inputPath.replace(/^~/, os.homedir());
+ const expandedPath = inputPath.replace(/^~/, config.getConfigHome());
\`\`\`

---

### 2.9 \`packages/server/toolm/tool-mode-handlers.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改: toolDir（第166行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

---

### 2.10 \`packages/server/toolm/tool-dependency.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改: toolDir（第25行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

---

### 2.11 \`packages/server/toolm/tool-environment.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改1: toolDir（第22行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

**修改2: toolDir（第94行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

**修改3: toolDir（第160行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

---

### 2.12 \`packages/server/toolm/tool-storage.service.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改: toolDir（第72行）**:
\`\`\`diff
- const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
+ const toolDir = config.getToolDir(toolName);
\`\`\`

---

### 2.13 \`packages/server/toolm/validate-system.js\`

**需要添加的导入**:
\`\`\`javascript
import { config } from '../utils/config.js';
\`\`\`

**修改: 第128行附近**:
\`\`\`diff
// 可能是在一个对象或消息中
{
- '用户工具目录': path.join(os.homedir(), '.prompt-manager', 'tools')
+ '用户工具目录': config.getToolboxDir()
}
\`\`\`


---

## 执行策略

### 执行顺序

\`\`\`
1. 备份当前状态（git commit 或创建分支）
   ↓
2. 修改 config.js（基础设施）
   ↓
3. 验证 config.js（运行测试）
   ↓
4. 逐文件修改核心服务（util, model, template）
   ↓
5. 验证核心服务
   ↓
6. 修改 API 路由
   ↓
7. 验证 API
   ↓
8. 修改 ToolM 服务（批量处理）
   ↓
9. 验证 ToolM
   ↓
10. 全面验证（npm run verify:e2e）
\`\`\`

### 容错机制

#### 1. 导入冲突处理

**检测代码**:
\`\`\`javascript
const hasConfigImport = fileContent.includes("import { config } from");
\`\`\`

**处理策略**:
\`\`\`javascript
if (hasConfigImport) {
  // 跳过添加导入
  logger.debug('config 已导入，跳过添加导入语句');
} else {
  // 添加导入到文件开头
  fileContent = \`import { config } from '../utils/config.js';\\n\` + fileContent;
}
\`\`\`

#### 2. 路径替换冲突处理

**检测代码**:
\`\`\`javascript
const hasConfigCall = fileContent.includes('config.');
\`\`\`

**处理策略**:
\`\`\`javascript
if (hasConfigCall) {
  logger.debug('文件已使用 config，检查是否需要修改');
  // 仅替换未被替换的硬编码
} else {
  // 执行完整替换
}
\`\`\`

#### 3. 批量修改脚本（可选）

\`\`\`javascript
// scripts/fix-hardcoded-paths.js

const filesToModify = [
  { path: 'utils/util.js', replacements: [...] },
  { path: 'services/model.service.js', replacements: [...] },
  // ...
];

for (const file of filesToModify) {
  try {
    await modifyFile(file);
    logger.info(\`✅ 已修改: \${file.path}\`);
  } catch (error) {
    logger.error(\`❌ 修改失败: \${file.path}\`, error);
    // 继续处理其他文件
  }
}
\`\`\`

---

## 验证检查清单

### 修改前

- [ ] 创建新分支 \`git checkout -b refactor/config-paths\`
- [ ] 运行 \`npm run verify\` 确保当前状态正常
- [ ] 记录当前测试结果

### 阶段1: 配置基础设施

- [ ] 修改 \`config.js\` 添加新方法
- [ ] 修改构造函数中的 configHome 赋值（第115行）
- [ ] 修改 applyOverrides 中的 configHome 赋值（第184行）
- [ ] 添加 \`validatePaths()\` 验证方法
- [ ] 运行 \`npm run test:server\` 验证配置类

### 阶段2: 核心服务

- [ ] 修改 \`utils/util.js\`（2处修改）
- [ ] 修改 \`services/model.service.js\`（1处修改）
- [ ] 修改 \`services/template.service.js\`（1处修改）
- [ ] 运行单元测试验证核心服务

### 阶段3: API 路由

- [ ] 修改 \`api/tool.routes.js\`（4处修改）
- [ ] 测试文件上传功能
- [ ] 测试工具安装功能

### 阶段4: ToolM 服务

- [ ] 修改 \`toolm/tool-loader.service.js\`（2处修改）
- [ ] 修改 \`toolm/tool-sync.service.js\`（1处修改）
- [ ] 修改 \`toolm/tool-logger.service.js\`（3处修改）
- [ ] 修改 \`toolm/tool-context.service.js\`（2-4处修改）
- [ ] 修改 \`toolm/tool-mode-handlers.service.js\`（1处修改）
- [ ] 修改 \`toolm/tool-dependency.service.js\`（1处修改）
- [ ] 修改 \`toolm/tool-environment.service.js\`（3处修改）
- [ ] 修改 \`toolm/tool-storage.service.js\`（1处修改）
- [ ] 修改 \`toolm/validate-system.js\`（1处修改）
- [ ] 运行工具集成测试

### 阶段5: 全面验证

- [ ] 运行 \`npm run verify\`（代码质量）
- [ ] 运行 \`npm run verify:e2e\`（端到端测试）
- [ ] 测试默认路径场景（不指定 --prompts-dir）
- [ ] 测试自定义路径场景（--prompts-dir /custom/path）
- [ ] 检查是否有遗漏的硬编码路径
- [ ] 验证所有配置目录正确创建
- [ ] 验证工具沙箱正常工作
- [ ] 验证模型和模板配置正常加载

### 提交检查

- [ ] 所有测试通过
- [ ] 无 ESLint 错误
- [ ] 无 Prettier 错误
- [ ] 代码变更已 review
- [ ] 创建 Pull Request
- [ ] 更新 AGENTS.md 文档（如果需要）

---

## 修改汇总表

| 优先级 | 文件 | 修改数量 | 状态 |
|-------|------|---------|------|
| P0 | \`config.js\` | 新增7个方法 + 2处修改 | ⬜ 待执行 |
| P0 | \`util.js\` | 2处修改 | ⬜ 待执行 |
| P0 | \`model.service.js\` | 1处修改 | ⬜ 待执行 |
| P0 | \`template.service.js\` | 1处修改 | ⬜ 待执行 |
| P1 | \`api/tool.routes.js\` | 4处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-loader.service.js\` | 2处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-sync.service.js\` | 1处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-logger.service.js\` | 3处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-context.service.js\` | 2-4处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-mode-handlers.service.js\` | 1处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-dependency.service.js\` | 1处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-environment.service.js\` | 3处修改 | ⬜ 待执行 |
| P1 | \`toolm/tool-storage.service.js\` | 1处修改 | ⬜ 待执行 |
| P2 | \`toolm/validate-system.js\` | 1处修改 | ⬜ 待执行 |

**总计**: 14个文件，约30处修改

---

## 预期效果

### 修改前

\`\`\`javascript
// 分散在各处的硬编码
const uploadDir = path.join(os.homedir(), '.prompt-manager', 'temp');
const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
const modelsDir = path.join(os.homedir(), '.prompt-manager', 'configs/models');
\`\`\`

### 修改后

\`\`\`javascript
// 统一从 config 获取
const uploadDir = config.getTempDir();
const toolboxDir = config.getToolboxDir();
const modelsDir = config.getModelsDir();
\`\`\`

### 优势

1. ✅ **统一管理**: 所有路径从单一来源获取
2. ✅ **易于维护**: 配置变更只需修改 \`config.js\`
3. ✅ **可测试**: 可在测试中 mock config
4. ✅ **灵活**: 支持自定义 configHome
5. ✅ **清晰**: 语义化方法名
6. ✅ **自动处理**: configHome 和 DEFAULT_HOME_DIR 自动切换

---

## 风险与注意事项

### 向后兼容性

**影响**: 对于使用自定义 promptsDir 的用户

- 之前: 配置和工具也会放在自定义路径
- 之后: 配置和工具固定在 \`~/.prompt-manager\`
- **影响**: 需要迁移旧配置文件到 \`~/.prompt-manager/configs/\`

### 潜在问题

1. **导入冲突**: 部分文件可能已导入 config
2. **路径差异**: 部分文件可能使用不同的硬编码方式
3. **测试依赖**: 测试文件可能依赖于硬编码路径

### 缓解措施

1. 逐文件修改，每修改一个文件就验证
2. 使用 \`npm run verify\` 进行全面测试
3. 在新分支上操作，避免污染主分支
4. 遇到问题立即回滚

---

## 附录

### A. config.js 新方法完整代码

\`\`\`javascript
/**
 * 获取配置主目录
 * @returns {string} 配置主目录路径
 */
getConfigHome() {
  return this.configHome || DEFAULT_HOME_DIR;
}

/**
 * 获取临时文件目录
 * @returns {string} 临时文件目录路径
 */
getTempDir() {
  return path.join(this.getConfigHome(), 'temp');
}

/**
 * 获取工具箱目录
 * @returns {string} 工具箱目录路径
 */
getToolboxDir() {
  return path.join(this.getConfigHome(), 'toolbox');
}

/**
 * 获取指定工具的目录
 * @param {string} toolName - 工具名称
 * @returns {string} 工具目录路径
 * @throws {Error} 如果 toolName 未提供
 */
getToolDir(toolName) {
  if (!toolName) {
    throw new Error('toolName is required for getToolDir()');
  }
  return path.join(this.getToolboxDir(), toolName);
}

/**
 * 获取模型配置目录
 * @returns {string} 模型配置目录路径
 */
getModelsDir() {
  return path.join(this.getConfigHome(), 'configs', 'models');
}

/**
 * 获取模板配置目录
 * @returns {string} 模板配置目录路径
 */
getTemplatesDir() {
  return path.join(this.getConfigHome(), 'configs', 'templates');
}

/**
 * 获取用户配置目录
 * @returns {string} 用户配置目录路径
 */
getConfigsDir() {
  return path.join(this.getConfigHome(), 'configs');
}

/**
 * 获取环境变量文件路径
 * @returns {string} .env 文件路径
 */
getEnvFilePath() {
  return path.join(this.getConfigHome(), '.env');
}

/**
 * 验证配置路径一致性
 * @throws {Error} 如果路径配置不一致
 */
validatePaths() {
  const configHome = this.getConfigHome();
  const expectedHome = DEFAULT_HOME_DIR;
  
  if (configHome !== expectedHome) {
    throw new Error(
      \`ConfigHome不一致: 期望 \${expectedHome}, 实际 \${configHome}\`
    );
  }
  
  // 验证各目录是否可以创建
  const dirsToCheck = [
    this.getPromptsDir(),
    this.getTempDir(),
    this.getToolboxDir(),
    this.getModelsDir(),
    this.getTemplatesDir()
  ];
  
  for (const dir of dirsToCheck) {
    // 仅验证路径格式，不实际创建目录
    if (!dir || typeof dir !== 'string') {
      throw new Error(\`无效的目录路径: \${dir}\`);
    }
  }
  
  return true;
}
\`\`\`

### B. 快速查找命令

\`\`\`bash
# 查找所有硬编码路径
grep -r "os.homedir()" packages/server --include="*.js" | grep ".prompt-manager"

# 查找 toolbox 路径
grep -r "toolbox" packages/server --include="*.js"

# 查找 configs 路径
grep -r "configs" packages/server --include="*.js"

# 检查是否遗漏
grep -r "path.join(os.homedir()" packages/server --include="*.js"
\`\`\`

---

## 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-01-10 | 1.0 | 初始版本，完整重构方案 |

---

**相关文档**:
- [AGENTS.md](../../AGENTS.md) - 项目开发指南
- [README.md](../../README.md) - 项目说明

---

## 快速开始

### 步骤1: 创建分支

\`\`\`bash
git checkout -b refactor/config-paths
\`\`\`

### 步骤2: 验证当前状态

\`\`\`bash
npm run verify
\`\`\`

### 步骤3: 按阶段执行

1. **阶段1**: 修改 \`config.js\`
2. **阶段2**: 修改核心服务
3. **阶段3**: 修改 API 路由
4. **阶段4**: 修改 ToolM 服务
5. **阶段5**: 全面验证

### 步骤4: 提交代码

\`\`\`bash
git add .
git commit -m "refactor: 统一配置路径管理"
git push origin refactor/config-paths
\`\`\`

---

**祝你好运！有问题随时参考本指南。**
