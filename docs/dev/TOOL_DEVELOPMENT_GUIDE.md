# Prompt Manager 工具开发规范

## 1. 模块结构规范

```javascript
// 使用 ES6 模块导出
import { /* 必要的内置模块 */ } from 'node:module';

export default {
  // 工具实现方法
};
```

## 2. 必需接口方法

### 2.1 getDependencies()
```javascript
getDependencies() {
  return {
    // 如果使用第三方依赖则在此声明，使用 Node.js 内置模块则返回空对象
  };
}
```

### 2.2 getMetadata()
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

### 2.3 getSchema()
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

### 2.4 getBusinessErrors()
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

### 2.5 execute(params)
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

## 3. 安全和权限规范

### 3.1 路径验证和沙箱隔离
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

### 3.2 环境变量配置
```javascript
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
    }
  }
  
  // 展开 ~ 到主目录并标准化路径
  return allowedDirs.map(dir => {
    const expanded = dir.replace(/^~/, os.homedir());
    return path.resolve(expanded);
  });
}
```

## 4. 日志记录规范

```javascript
// 使用 api.logger 记录不同级别的日志
api?.logger?.info('执行开始', { 
  method: params.method,
  path: params.path 
});
api?.logger?.warn('警告信息', { context });
api?.logger?.error('错误信息', { error: error.message });
```

## 5. 异步处理规范

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

## 6. 工具实现模板

```javascript
/**
 * 工具名称 - Prompt Manager 体系的工具描述
 * 
 * 战略意义：
 * 1. 架构隔离性
 * 2. 平台独立性
 * 3. 生态自主性
 */

import { /* 必要模块 */ } from 'node:module';

export default {
  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      // 依赖声明
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
    
    // 日志记录
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

## 7. 最佳实践

1. **安全性**: 始终验证输入参数和路径，确保操作在安全范围内
2. **错误处理**: 提供清晰的错误信息和解决方案
3. **日志记录**: 记录关键操作和错误信息
4. **性能**: 对大文件或耗时操作提供适当的处理机制
5. **可配置性**: 通过环境变量提供可配置选项
6. **文档**: 在文件开头提供工具的战略意义和用途说明

## 8. 验证机制

为了确保新增工具与当前框架适配，且每个函数运行正确符合预期，需要实现以下验证机制：

### 8.1 工具接口验证
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

### 8.2 参数验证
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

### 8.3 单元测试验证
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

### 8.4 集成测试验证
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

### 8.5 自动化验证脚本
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
    
    return { valid: true, metadata };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

### 8.6 工具注册到MCP系统

工具开发完成后，需要将其注册到 MCP 的 toolm 系统中才能被识别和使用。工具注册遵循以下规范：

#### 8.6.1 工具文件结构
工具必须放在以下目录之一：
- 系统内置工具：`packages/resources/tools/{tool-name}/{tool-name}.tool.js`
- 用户工具：`~/.prompt-manager/tools/{tool-name}/{tool-name}.tool.js`

例如，filesystem 工具的路径为：`packages/resources/tools/filesystem/filesystem.tool.js`

#### 8.6.2 工具加载机制
ToolLoaderService 会自动扫描上述目录中的工具，遵循以下规则：
1. 每个工具在独立的子目录中
2. 工具主文件名必须与目录名一致并以 `.tool.js` 结尾
3. 工具必须导出 ES6 模块的 default 对象
4. 工具必须实现 `execute` 方法（必需）和推荐方法（getMetadata, getSchema, getDependencies, getBusinessErrors）

#### 8.6.3 工具调用方式
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
  ALLOWED_DIRECTORIES: '["/allowed/path", "/another/path"]'
```

4. **log 模式** - 查看工具日志（预留功能）
```yaml
tool: tool://pdf-reader
mode: log
parameters:
  action: tail
  lines: 50
```

#### 8.6.4 工具验证
工具注册后，可以通过以下方式验证：
1. 确认工具出现在 `toolLoaderService.getAllTools()` 列表中
2. 使用 `tool://tool-name` 调用 `manual` 模式查看工具手册
3. 使用有效参数执行 `execute` 模式测试功能

### 8.7 验证清单
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
- [ ] 工具已正确放置在工具目录 (resources/tools 或 ~/.prompt-manager/tools)
- [ ] 工具文件名与目录名一致 (tool-name.tool.js)
- [ ] 工具能在 toolm 系统中被识别和调用
- [ ] manual 模式能返回正确的工具手册
- [ ] 在 MCP 服务器的 toolm 描述中补充了新工具的说明
- [ ] 更新了系统内置工具列表，包含新工具的名称和功能描述
- [ ] 添加了新工具的使用场景到 MCP 服务器的描述中

这个验证机制确保了新增工具的质量、兼容性和可用性。