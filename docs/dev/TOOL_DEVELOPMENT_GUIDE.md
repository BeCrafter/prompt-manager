# Prompt Manager 工具开发规范 (独立沙箱版)

## 1. 概述

Prompt Manager 的工具现在运行在独立的沙箱环境中，每个工具都有自己的依赖和运行环境，与项目主环境完全隔离。

重要的是，**所有工具（包括系统内置工具和用户工具）都必须在沙箱环境中运行**。系统内置工具虽然开发时位于 `packages/resources/tools/` 目录，但在运行时会通过同步机制复制到 `～/.prompt-manager/toolbox/` 目录并在沙箱环境中执行。

### 1.1 执行环境说明

**实现方案：ES6 模块 + 受限执行环境**

工具使用 ES6 模块格式开发，在受限的执行环境中运行。通过以下安全措施实现有效隔离：

- **上下文绑定**：工具通过 `this.api` 访问受限的 API
- **超时控制**：工具执行有超时限制（默认 30 秒）
- **API 层限制**：所有操作都通过受限的 API 层
- **路径验证**：所有文件路径都经过严格验证
- **日志隔离**：每个工具有独立的日志文件
- **依赖隔离**：每个工具有独立的 `node_modules`

**适用场景：** 系统内置工具、用户自己开发的工具（信任度高）

**选择原因：** ES6 语法开发体验好，避免转换风险，当前需求已足够安全

## 2. 模块结构规范

### 2.1 ES6 模块格式

工具必须使用 ES6 模块格式开发：

```javascript
// 使用 ES6 模块导出
import path from 'path';
import os from 'os';

export default {
  // 工具实现方法
  getDependencies() { ... },
  getMetadata() { ... },
  getSchema() { ... },
  async execute(params) {
    // 通过 this.api 访问受限的 API
    const { api } = this;
    api?.logger?.info('执行开始');
    // ...
  }
};
```

### 2.2 上下文访问

工具执行时，可以通过 `this` 访问以下上下文：

- `this.api` - 受限的 API 对象，包含：
  - `api.logger` - 日志记录器（info, warn, error, debug）
  - `api.storage` - 存储服务（getItem, setItem）
  - `api.environment` - 环境变量访问（get, set）
- `this.__toolDir` - 工具目录路径
- `this.__toolName` - 工具名称

**注意：** 工具代码中的 `this` 会被自动绑定到包含 `api` 的上下文对象，确保工具可以正确访问 `this.api`。

## 3. 必需接口方法

### 2.1 getDependencies()
```javascript
getDependencies() {
  return {
    // 如果使用第三方依赖则在此声明，使用 Node.js 内置模块则返回空对象
  };
}
```

### 3.2 getMetadata()
```javascript
getMetadata() {
  return {
    id: 'tool-id',                    // 工具唯一标识符
    name: 'tool-name',                // 工具名称
    description: '工具描述',           // 功能描述
    version: '1.0.0',                 // 版本号
    category: 'category',             // 工具类别 (system, utility, ai, etc.)
    author: 'Author Name',            // 作者
    tags: ['tag1', 'tag2'],           // 标签数组
    scenarios: [                      // 使用场景
      '场景1',
      '场景2'
    ],
    limitations: [                    // 限制说明
      '限制1',
      '限制2'
    ]
  };
}
```

### 3.3 getSchema()
```javascript
getSchema() {
  return {
    parameters: {                     // 输入参数 Schema
      type: 'object',
      properties: {
        // 参数定义
        method: {
          type: 'string',
          description: '方法名',
          enum: ['method1', 'method2']  // 可选方法列表
        }
        // 其他参数...
      },
      required: ['method']            // 必需参数
    },
    environment: {                    // 环境变量 Schema
      type: 'object',
      properties: {
        ENV_VAR_NAME: {
          type: 'string',
          description: '环境变量描述',
          default: 'default_value'
        }
      },
      required: []
    }
  };
}
```

### 3.4 getBusinessErrors()
```javascript
getBusinessErrors() {
  return [
    {
      code: 'ERROR_CODE',             // 错误码
      description: '错误描述',         // 人类可读描述
      match: /error pattern/i,        // 错误匹配模式
      solution: '解决方案',            // 解决建议
      retryable: false                // 是否可重试
    }
  ];
}
```

### 3.5 execute(params)
```javascript
async execute(params) {
  const { api } = this;              // 获取 MCP API
  
  // 记录执行开始
  api?.logger?.info('执行操作', { 
    method: params.method,
    // 其他参数...
  });
  
  try {
    // 参数验证
    // 业务逻辑处理
    // 调用具体功能
    
    // 返回结果
    return result;
  } catch (error) {
    // 记录错误
    api?.logger?.error('操作失败', { 
      method: params.method,
      error: error.message 
    });
    throw error;
  }
}
```

### 3.6 getRuntimeConfig() (可选)
```javascript
getRuntimeConfig() {
  return {
    // 沙箱类型：nodejs, python, docker 等
    sandboxType: 'nodejs',
    // 最大内存限制 (MB)
    maxMemory: 512,
    // 最大执行时间 (秒)
    maxExecutionTime: 30,
    // 允许的文件系统访问路径
    allowedDirectories: [
      '~/.prompt-manager/toolbox/{toolname}/data',
      '~/.prompt-manager/shared'
    ],
    // 网络访问权限
    networkAccess: true,
    // 环境变量
    environment: {
      NODE_ENV: 'production'
    }
  };
}
```

## 4. 安全和权限规范

### 4.1 路径验证和沙箱隔离
```javascript
// 安全路径解析示例
resolveSecurePath(inputPath) {
  const allowedDirs = this.getAllowedDirectories();
  
  // 验证路径在允许范围内
  if (!allowedDirs.some(dir => resolvedPath.startsWith(dir))) {
    throw new Error(`路径越权: ${inputPath}`);
  }
  
  return resolvedPath;
}
```

### 4.2 环境变量配置
```javascript
import path from 'path';
import os from 'os';

getAllowedDirectories() {
  const { api } = this;
  
  // 从环境变量获取配置
  let allowedDirs = ['~/.prompt-manager'];  // 默认值
  
  if (api && api.environment) {
    try {
      const configStr = api.environment.get('ALLOWED_DIRECTORIES');
      if (configStr) {
        const parsed = JSON.parse(configStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allowedDirs = parsed;
        }
      }
    } catch (error) {
      // 解析失败时使用默认值
      api?.logger?.warn('Failed to parse ALLOWED_DIRECTORIES', { error: error.message });
    }
  }
  
  // 展开 ~ 到主目录并标准化路径
  return allowedDirs.map(dir => {
    const expanded = dir.replace(/^~/, os.homedir());
    return path.resolve(expanded);
  });
}
```

## 5. 执行环境说明

### 5.1 执行方式

工具使用 ES6 模块格式，通过动态 `import()` 加载，然后在受限的执行环境中运行：

1. **模块加载**：使用 `import()` 动态导入工具模块
2. **上下文绑定**：将工具方法绑定到包含 `api` 的上下文对象
3. **受限执行**：工具只能通过 `this.api` 访问受限的 API
4. **超时控制**：工具执行有超时限制（默认 30 秒，可通过 `getRuntimeConfig()` 自定义）

### 5.2 安全措施

通过以下措施实现安全隔离：

- **API 层限制**：所有操作都通过受限的 API 层，工具无法直接访问主进程对象
- **路径验证**：所有文件路径都经过严格验证，防止越权访问
- **超时控制**：防止工具无限执行或阻塞
- **日志隔离**：每个工具有独立的日志文件
- **依赖隔离**：每个工具有独立的 `node_modules`

## 6. 日志记录规范

所有工具的输入和输出日志都应输出到 `~/.prompt-manager/toolbox/{toolname}/run.log` 文件中。

```javascript
// 使用 api.logger 记录不同级别的日志
api?.logger?.info('执行开始', { 
  method: params.method,
  path: params.path 
});
api?.logger?.warn('警告信息', { context });
api?.logger?.error('错误信息', { error: error.message });

// 在受限执行环境中，console 输出会自动重定向到 run.log 文件
console.log('这将被记录到 run.log 文件中');
console.info('这将被记录到 run.log 文件中');
console.warn('这将被记录到 run.log 文件中');
console.error('这将被记录到 run.log 文件中');
```

日志文件格式：
```
[2025-11-18T02:00:08.104Z] [INFO] 执行开始 - 工具: pdf-reader, 参数: {"pdfPath":"/path/to/doc.pdf"}
[2025-11-18T02:00:08.150Z] [DEBUG] 加载 PDF 文件: /path/to/doc.pdf
[2025-11-18T02:00:09.200Z] [INFO] PDF 加载成功 - 页数: 15
[2025-11-18T02:00:10.300Z] [INFO] 执行完成 - 结果大小: 125KB
[2025-11-18T02:00:10.305Z] [ERROR] 文件处理失败 - 错误: 无法解析加密的PDF
```

**重要提示**：日志文件仅保留最近3小时的数据，超过3小时的日志会被自动清理，以确保日志文件不会占用过多磁盘空间。

## 6. 异步处理规范

```javascript
async execute(params) {
  // 使用 async/await 进行异步操作
  const fsPromises = (await import('fs')).promises;
  
  try {
    // 异步操作
    const result = await fsPromises.readFile(filePath, 'utf-8');
    return result;
  } catch (error) {
    // 错误处理
    throw error;
  }
}
```

## 7. 工具实现模板

```javascript
/**
 * 工具名称 - Prompt Manager 体系的工具描述
 * 
 * 战略意义：
 * 1. 架构隔离性
 * 2. 平台独立性
 * 3. 生态自主性
 * 
 * 注意：此工具将在独立沙箱环境中运行，依赖将自动安装到工具目录的 node_modules 中
 * 所有日志将输出到 ~/.prompt-manager/toolbox/{toolname}/run.log 文件中
 */

import { /* 必要模块 */ } from 'node:module';

export default {
  /**
   * 获取工具依赖
   * 返回的依赖将被安装到工具的独立 node_modules 目录中
   */
  getDependencies() {
    return {
      // 依赖声明，例如：
      // 'pdf-parse': '^1.1.1',
      // 'axios': '^1.0.0'
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      // 元数据定义
    };
  },

  /**
   * 获取参数Schema
   */
  getSchema() {
    return {
      // Schema 定义
    };
  },

  /**
   * 获取业务错误定义
   */
  getBusinessErrors() {
    return [
      // 错误定义
    ];
  },

  /**
   * 执行工具
   */
  async execute(params) {
    const { api } = this;
    
    // 日志记录 - 这些日志将输出到 ~/.prompt-manager/toolbox/{toolname}/run.log
    api?.logger?.info('执行开始', { 
      method: params.method,
      // 参数...
    });
    
    try {
      // 业务逻辑
      return result;
    } catch (error) {
      // 错误处理
      api?.logger?.error('执行失败', { 
        method: params.method,
        error: error.message 
      });
      throw error;
    }
  },
  
  // 工具特定的辅助方法...
};
```

## 8. 最佳实践

1. **安全性**: 始终验证输入参数和路径，确保操作在安全范围内
2. **错误处理**: 提供清晰的错误信息和解决方案
3. **日志记录**: 记录关键操作和错误信息
4. **性能**: 对大文件或耗时操作提供适当的处理机制
5. **可配置性**: 通过环境变量提供可配置选项
6. **文档**: 在文件开头提供工具的战略意义和用途说明
7. **沙箱兼容性**: 确保工具能在受限的沙箱环境中正常运行
8. **依赖管理**: 明确声明工具的所有依赖，不要依赖全局环境

## 9. 验证机制

为了确保新增工具与当前框架适配，且每个函数运行正确符合预期，需要实现以下验证机制：

### 9.1 工具接口验证
```javascript
// 验证工具是否实现了必需的接口方法
function validateToolInterface(tool) {
  const requiredMethods = ['getDependencies', 'getMetadata', 'getSchema', 'getBusinessErrors', 'execute'];
  
  for (const method of requiredMethods) {
    if (typeof tool[method] !== 'function') {
      throw new Error(`工具缺少必需的方法: ${method}`);
    }
  }
  
  // 验证元数据完整性
  const metadata = tool.getMetadata();
  const requiredMetadata = ['id', 'name', 'description', 'version', 'category'];
  for (const field of requiredMetadata) {
    if (!metadata[field]) {
      throw new Error(`元数据缺少必需字段: ${field}`);
    }
  }
  
  // 验证 Schema 格式
  const schema = tool.getSchema();
  if (!schema.parameters || !schema.environment) {
    throw new Error('Schema 缺少必需的 parameters 或 environment 字段');
  }
  
  return true;
}
```

### 9.2 参数验证
```javascript
// 在 execute 方法中验证参数
async execute(params) {
  const { api } = this;
  
  // 使用 Schema 验证参数
  const schema = this.getSchema();
  const validation = this.validateParameters(params, schema.parameters);
  
  if (!validation.valid) {
    throw new Error(`参数验证失败: ${validation.errors.join(', ')}`);
  }
  
  // 执行业务逻辑...
}
```

### 9.3 单元测试验证
```javascript
// 为工具创建单元测试
describe('工具名称测试', () => {
  let tool;
  
  beforeEach(() => {
    tool = createToolInstance(); // 创建工具实例
  });
  
  test('接口完整性验证', () => {
    expect(typeof tool.getDependencies).toBe('function');
    expect(typeof tool.getMetadata).toBe('function');
    expect(typeof tool.getSchema).toBe('function');
    expect(typeof tool.getBusinessErrors).toBe('function');
    expect(typeof tool.execute).toBe('function');
  });
  
  test('元数据完整性验证', () => {
    const metadata = tool.getMetadata();
    expect(metadata.id).toBeDefined();
    expect(metadata.name).toBeDefined();
    expect(metadata.description).toBeDefined();
    expect(metadata.version).toBeDefined();
    expect(metadata.category).toBeDefined();
  });
  
  test('参数验证测试', async () => {
    // 测试有效参数
    const validParams = {
      method: 'example_method',
      // 其他必需参数...
    };
    
    const result = await tool.execute(validParams);
    expect(result).toBeDefined();
    // 验证返回结果符合预期...
  });
  
  test('错误处理验证', async () => {
    // 测试无效参数应抛出错误
    await expect(tool.execute({})).rejects.toThrow();
    // 验证特定错误情况...
  });
});
```

### 9.4 集成测试验证
```javascript
// 集成测试确保工具与 MCP 框架正确集成
async function integrationTest() {
  // 1. 注册工具到 MCP 框架
  const mcpServer = createMcpServer();
  mcpServer.registerTool('tool-id', tool);
  
  // 2. 测试 MCP 调用
  const response = await mcpServer.callTool('tool-id', {
    method: 'example_method',
    // 参数...
  });
  
  // 3. 验证响应格式和内容
  expect(response).toBeDefined();
  expect(response.result).toBeDefined();
  
  // 4. 验证日志记录
  // 检查是否正确记录了执行日志
}
```

### 9.5 环境变量配置

工具支持通过 `.env` 文件配置环境变量。当使用 configure 模式时，工具框架会在工具目录内创建 `.env` 文件，并将环境变量配置到文件中。

### .env 文件格式
```
# Tool Environment Variables
# Tool: {toolname}
# Generated by PromptManager ToolEnvironment
# Last modified: 2025-11-18T02:00:08.104Z

ALLOWED_DIRECTORIES=/Users
API_KEY=your-api-key
CUSTOM_VAR=value
LOG_RETENTION_HOURS=3
```

文件位置：`~/.prompt-manager/toolbox/{toolname}/.env`

在执行工具前，框架会自动检查是否存在 `.env` 文件，如果存在则加载其中的环境变量，然后执行工具代码；如果不存在则直接执行代码。

支持的环境变量包括：
- `LOG_RETENTION_HOURS`: 设置日志保留时间（小时），默认为3小时
- `ALLOWED_DIRECTORIES`: 允许访问的目录列表
- 其他工具特定的环境变量

## 9.6 自动化验证脚本
```javascript
// 创建工具验证脚本
async function validateTool(toolPath) {
  const tool = await import(toolPath);
  
  try {
    // 1. 验证接口
    validateToolInterface(tool.default);
    
    // 2. 验证元数据
    const metadata = tool.default.getMetadata();
    console.log(`✓ 工具 ${metadata.id} 元数据验证通过`);
    
    // 3. 验证 Schema
    const schema = tool.default.getSchema();
    console.log(`✓ 工具 ${metadata.id} Schema 验证通过`);
    
    // 4. 执行示例调用
    const exampleParams = getExampleParams(schema);
    const result = await tool.default.execute(exampleParams);
    console.log(`✓ 工具 ${metadata.id} 执行验证通过`);
    
    // 5. 验证沙箱环境
    await validateSandboxEnvironment(tool.default);
    console.log(`✓ 工具 ${metadata.id} 沙箱环境验证通过`);
    
    return { valid: true, metadata };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 验证沙箱环境的函数
async function validateSandboxEnvironment(tool) {
  // 检查是否定义了运行时配置
  if (typeof tool.getRuntimeConfig === 'function') {
    const runtimeConfig = tool.getRuntimeConfig();
    // 验证配置格式
    if (typeof runtimeConfig !== 'object') {
      throw new Error('getRuntimeConfig 必须返回对象');
    }
  }
  
  // 检查依赖是否正确声明
  if (typeof tool.getDependencies === 'function') {
    const dependencies = tool.getDependencies();
    // 验证依赖格式
    if (typeof dependencies !== 'object') {
      throw new Error('getDependencies 必须返回对象');
    }
  }
}
```

### 9.6 工具注册到MCP系统

工具开发完成后，需要将其注册到 MCP 的 toolm 系统中才能被识别和使用。工具注册遵循以下规范：

#### 9.6.1 工具文件结构
工具必须放在以下目录之一，并使用新的沙箱结构：

##### 系统内置工具
- 原始位置：`packages/resources/tools/{tool-name}/{tool-name}.tool.js`（开发时）
- 同步到：`~/.prompt-manager/toolbox/{tool-name}/{tool-name}.tool.js`（运行时）

系统工具在开发时位于 `packages/resources/tools/` 目录，但在运行时会通过同步机制复制到 `~/.prompt-manager/toolbox/` 目录并在沙箱环境中执行。

##### 用户工具
- 用户工具：`~/.prompt-manager/toolbox/{tool-name}/{tool-name}.tool.js`

例如，filesystem 工具的路径为：`packages/resources/toolbox/filesystem/filesystem.tool.js`

新工具目录结构：
```
~/.prompt-manager/toolbox/{tool-name}/
├── {tool-name}.tool.js       # 工具主文件
├── package.json              # 工具依赖配置
├── node_modules/             # 工具独立依赖（自动生成）
├── data/                     # 工具数据存储（可选）
└── logs/                     # 工具运行日志（可选）
```

所有工具，无论系统内置还是用户创建，都必须在沙箱环境中运行。系统工具在启动时会自动从 `packages/resources/tools/` 同步到 `~/.prompt-manager/toolbox/` 目录，然后在沙箱环境中执行。

#### 9.6.2 工具加载机制
ToolLoaderService 会自动扫描上述目录中的工具，遵循以下规则：
1. 每个工具在独立的子目录中
2. 工具主文件名必须是 `tool.js`
3. 工具必须导出 ES6 模块的 default 对象
4. 工具必须实现 `execute` 方法（必需）和推荐方法（getMetadata, getSchema, getDependencies, getBusinessErrors）
5. 工具必须包含 `package.json` 文件定义依赖
6. 工具执行前会自动检查和安装依赖

#### 9.6.3 工具依赖管理
工具依赖现在采用独立沙箱机制：
- 每个工具都有独立的 `node_modules` 目录
- 依赖在工具首次执行前自动安装
- 依赖版本在 `package.json` 中定义
- 工具间依赖完全隔离

#### 9.6.4 工具调用方式
通过 MCP 的 `mcp__promptmanager__toolm` 工具调用注册的工具，支持四种模式：

1. **execute 模式** - 执行工具
```yaml
tool: tool://pdf-reader
mode: execute
parameters:
  pdfPath: "/path/to/document.pdf"
  pages: [1, 2, 3]
  extractImages: true
```

2. **manual 模式** - 获取工具手册
```yaml
tool: tool://pdf-reader
mode: manual
```

3. **configure 模式** - 配置工具环境变量
```yaml
tool: tool://pdf-reader
mode: configure
parameters:
  ALLOWED_DIRECTORIES: "/allowed/path:/another/path"
  API_KEY: "your-api-key-value"
```

当使用 configure 模式时，工具框架会在工具目录内创建 `.env` 文件，并将环境变量配置到文件中：
```
# Tool Environment Variables
# Tool: pdf-reader
# Generated by PromptManager ToolEnvironment
# Last modified: 2025-11-18T02:00:08.104Z

ALLOWED_DIRECTORIES=/allowed/path:/another/path
API_KEY=your-api-key-value
```

文件位置：`~/.prompt-manager/toolbox/pdf-reader/.env`

4. **log 模式** - 查看工具日志（预留功能）
```yaml
tool: tool://pdf-reader
mode: log
parameters:
  action: tail
  lines: 50
```

#### 9.6.5 工具验证
工具注册后，可以通过以下方式验证：
1. 确认工具出现在 `toolLoaderService.getAllTools()` 列表中
2. 使用 `tool://tool-name` 调用 `manual` 模式查看工具手册
3. 使用有效参数执行 `execute` 模式测试功能
4. 验证工具依赖是否已正确安装
5. 验证工具能否在沙箱环境中正常运行

### 9.7 验证清单
在发布新工具前，使用以下清单验证：

- [ ] 实现了所有必需接口方法 (getDependencies, getMetadata, getSchema, getBusinessErrors, execute)
- [ ] 元数据包含所有必需字段 (id, name, description, version, category)
- [ ] Schema 定义了 parameters 和 environment
- [ ] 参数验证逻辑正确
- [ ] 错误处理机制完好
- [ ] 日志记录功能正常
- [ ] 安全机制有效 (路径验证、权限控制等)
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 性能测试满足要求
- [ ] 文档完整
- [ ] 工具已正确放置在工具目录 (resources/toolbox 或 ~/.prompt-manager/toolbox)
- [ ] 工具文件名是 `tool.js` (不是 `{tool-name}.tool.js`)
- [ ] 工具包含 `package.json` 文件定义依赖
- [ ] 工具能在 toolm 系统中被识别和调用
- [ ] 依赖在首次执行前能自动安装
- [ ] manual 模式能返回正确的工具手册
- [ ] configure 模式能正确创建和更新 .env 文件
- [ ] 环境变量能正确从 .env 文件加载
- [ ] 工具执行前会检查并加载 .env 文件中的环境变量
- [ ] 工具执行时的日志会输出到 ~/.prompt-manager/toolbox/{toolname}/run.log 文件
- [ ] 日志格式符合标准（包含时间戳、级别、消息）
- [ ] console 输出会被重定向到 run.log 文件
- [ ] 日志文件仅保留最近3小时的数据，过期日志会被自动清理
- [ ] 在 MCP 服务器的 toolm 描述中补充了新工具的说明
- [ ] 更新了系统内置工具列表，包含新工具的名称和功能描述
- [ ] 添加了新工具的使用场景到 MCP 服务器的描述中
- [ ] 工具在沙箱环境中运行（权限受限）
- [ ] 系统内置工具会从 packages/resources/tools/ 同步到 ~/.prompt-manager/toolbox/ 目录
- [ ] 工具定义了适当的运行时配置（可选的 getRuntimeConfig 方法）
- [ ] 工具依赖声明正确，不会与系统环境冲突

这个验证机制确保了新增工具的质量、兼容性和可用性。