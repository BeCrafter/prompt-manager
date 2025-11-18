# Prompt Manager 工具开发规范 (独立沙箱版)

## 1. 概述

Prompt Manager 的工具现在运行在独立的沙箱环境中，每个工具都有自己的依赖和运行环境，与项目主环境完全隔离。

重要的是，**所有工具（包括系统内置工具和用户工具）都必须在沙箱环境中运行**。系统内置工具虽然放在 `packages/resources/tools/` 目录，但在运行时会通过同步机制复制到 `～/.prompt-manager/toolbox/` 目录并在沙箱环境中执行。

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

### 4.1 路径验证
工具必须验证所有文件路径，确保操作在允许的目录范围内。通过 `api.environment.get('ALLOWED_DIRECTORIES')` 获取允许的目录列表。

### 4.2 环境变量访问
通过 `api.environment.get(key)` 和 `api.environment.set(key, value)` 访问环境变量。环境变量通过 `.env` 文件配置，详见 `TOOL_SANDBOX_DESIGN.md`。

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

所有工具的日志都通过 `api.logger` 记录，自动输出到 `~/.prompt-manager/toolbox/{toolname}/run.log` 文件。

```javascript
api?.logger?.info('执行开始', { method: params.method });
api?.logger?.warn('警告信息', { context });
api?.logger?.error('错误信息', { error: error.message });
api?.logger?.debug('调试信息', { data });
```

**注意**：`console.log` 等输出也会自动重定向到日志文件。日志文件仅保留最近3小时的数据，详见 `TOOL_SANDBOX_DESIGN.md`。

## 7. 异步处理规范

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

## 8. 工具实现模板

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

## 9. 最佳实践

1. **安全性**: 始终验证输入参数和路径，确保操作在安全范围内
2. **错误处理**: 提供清晰的错误信息和解决方案
3. **日志记录**: 记录关键操作和错误信息
4. **性能**: 对大文件或耗时操作提供适当的处理机制
5. **可配置性**: 通过环境变量提供可配置选项
6. **文档**: 在文件开头提供工具的战略意义和用途说明
7. **沙箱兼容性**: 确保工具能在受限的沙箱环境中正常运行
8. **依赖管理**: 明确声明工具的所有依赖，不要依赖全局环境

## 10. 验证机制

为了确保新增工具与当前框架适配，且每个函数运行正确符合预期，需要实现以下验证机制：

### 10.1 工具接口验证
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

### 10.2 参数验证
在 `execute` 方法中应验证参数是否符合 Schema 定义，验证失败时抛出清晰的错误信息。

### 10.3 测试建议
建议为工具编写单元测试和集成测试，验证接口完整性、参数验证、错误处理等功能。

### 10.4 工具注册

#### 文件位置
- **系统内置工具**：`packages/resources/tools/{tool-name}/{tool-name}.tool.js`（开发时）
- **用户工具**：`~/.prompt-manager/toolbox/{tool-name}/{tool-name}.tool.js`

系统工具在应用启动时会自动同步到 `~/.prompt-manager/toolbox/` 目录。

#### 目录结构
```
~/.prompt-manager/toolbox/{tool-name}/
├── {tool-name}.tool.js       # 工具主文件
├── package.json              # 工具依赖配置（必需）
├── node_modules/             # 工具独立依赖（自动生成）
├── .env                      # 环境变量配置（可选）
└── run.log                   # 运行日志（自动生成）
```

#### 工具调用
通过 MCP 的 `mcp__promptmanager__toolm` 工具调用，支持四种模式：
- `manual` - 获取工具手册
- `execute` - 执行工具
- `configure` - 配置环境变量
- `log` - 查看日志（预留）

详见 `TOOL_SANDBOX_DESIGN.md` 中的工具调用方式说明。

### 10.5 验证清单
在发布新工具前，使用以下核心清单验证：

**接口完整性**
- [ ] 实现了必需方法：`execute`
- [ ] 实现了推荐方法：`getDependencies`, `getMetadata`, `getSchema`, `getBusinessErrors`
- [ ] 元数据包含必需字段：`id`, `name`, `description`, `version`, `category`

**功能验证**
- [ ] 参数验证逻辑正确
- [ ] 错误处理机制完善
- [ ] 日志记录功能正常
- [ ] 安全机制有效（路径验证、权限控制）

**部署验证**
- [ ] 工具文件位置正确（系统工具：`packages/resources/tools/`，用户工具：`~/.prompt-manager/toolbox/`）
- [ ] 工具文件名格式：`{tool-name}.tool.js`
- [ ] 包含 `package.json` 文件定义依赖
- [ ] 工具能在 toolm 系统中被识别和调用
- [ ] 依赖在首次执行前能自动安装

**测试**
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 性能满足要求