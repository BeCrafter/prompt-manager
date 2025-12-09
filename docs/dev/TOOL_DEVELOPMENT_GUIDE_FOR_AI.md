# Prompt Manager 工具开发完整指南（AI模型专用）

> **本文档专为AI模型设计，可直接用于指导工具开发。请严格按照本文档的规范和要求开发工具。**

## 📋 目录

1. [快速开始](#快速开始)
2. [工具结构规范](#工具结构规范)
3. [必需接口详解](#必需接口详解)
4. [完整代码模板](#完整代码模板)
5. [开发步骤](#开发步骤)
6. [验证清单](#验证清单)
7. [常见问题](#常见问题)
8. [最佳实践](#最佳实践)

---

## 🚀 快速开始

### 开发工具前必须了解

1. **工具格式**：必须使用 ES6 模块格式（`export default`），不能使用 CommonJS
2. **必需方法**：`execute()` 是必需的，其他方法强烈推荐实现
3. **执行环境**：工具在独立沙箱环境中运行，有独立的 `node_modules`
4. **日志位置**：所有日志自动写入 `~/.prompt-manager/toolbox/{toolname}/run.log`
5. **文件位置**：
   - 系统工具：`packages/resources/tools/{tool-name}/{tool-name}.tool.js`
   - 用户工具：`~/.prompt-manager/toolbox/{tool-name}/{tool-name}.tool.js`

### 工具调用方式

工具通过 MCP 协议调用，使用 `mcp__promptmanager__toolm` 工具：

```yaml
tool: tool://{tool-name}
mode: execute  # manual | execute | configure | log
parameters:
  # 工具参数
```

---

## 📐 工具结构规范

### 文件结构

```
{tool-name}.tool.js  # 工具主文件（必需）
package.json         # 依赖配置（自动生成，但需要 getDependencies() 方法）
node_modules/        # 依赖目录（自动安装）
.env                 # 环境变量配置（可选）
run.log              # 运行日志（自动生成）
```

### 代码结构

```javascript
// 1. 导入语句（使用 ES6 import）
import path from 'path';
import os from 'os';

// 2. 导出工具对象（必须使用 export default）
export default {
  // 3. 必需方法：execute
  async execute(params) { ... },
  
  // 4. 推荐方法（强烈建议实现）
  getDependencies() { ... },
  getMetadata() { ... },
  getSchema() { ... },
  getBusinessErrors() { ... },
  
  // 5. 工具特定的辅助方法（可选）
  helperMethod() { ... }
};
```

---

## 🔧 必需接口详解

### 1. execute(params) - 必需方法

**作用**：工具的核心执行方法，处理所有业务逻辑。

**参数**：`params` - 对象，包含工具执行所需的所有参数

**返回值**：可以是任何类型（对象、字符串、数组等），会作为工具执行结果返回

**重要说明**：
- 工具直接返回业务结果即可，框架会自动包装成 MCP 格式
- 返回对象、字符串、数组都可以，不需要特殊格式
- 框架会将返回值包装为：`{ success: true, tool: toolName, mode: 'execute', result: <你的返回值> }`

**必须实现的功能**：
- ✅ 参数验证（根据 `getSchema()` 定义的参数规范）
- ✅ 错误处理（捕获异常并记录日志）
- ✅ 日志记录（使用 `api.logger` 记录关键操作）

**代码模板**：

```javascript
async execute(params) {
  const { api } = this;  // 获取 API 上下文
  
  // 1. 记录执行开始
  api?.logger?.info('执行开始', { 
    tool: this.__toolName,
    params: Object.keys(params)
  });
  
  try {
    // 2. 参数验证
    this.validateParams(params);
    
    // 3. 业务逻辑处理
    const result = await this.processBusinessLogic(params);
    
    // 4. 记录执行成功
    api?.logger?.info('执行成功', { 
      resultSize: typeof result === 'string' ? result.length : 'object'
    });
    
    // 5. 返回结果
    return result;
    
  } catch (error) {
    // 6. 错误处理和日志记录
    api?.logger?.error('执行失败', { 
      error: error.message,
      stack: error.stack
    });
    throw error;  // 重新抛出错误，让框架处理
  }
}
```

### 2. getDependencies() - 强烈推荐

**作用**：声明工具的 npm 依赖包。

**返回值**：对象，键为包名，值为版本号

**示例**：

```javascript
getDependencies() {
  return {
    // 如果工具需要第三方依赖，在此声明
    'pdf-parse': '^1.1.1',
    'axios': '^1.0.0',
    'cheerio': '^1.0.0'
    // 如果只使用 Node.js 内置模块，返回空对象
  };
}
```

**重要提示**：
- 依赖会自动安装到工具的独立 `node_modules` 目录
- 使用精确的版本号（推荐使用 `^` 前缀）
- 不要依赖全局环境中的包

### 3. getMetadata() - 强烈推荐

**作用**：定义工具的元信息，用于工具手册生成和工具管理。

**返回值**：对象，包含工具的元数据

**必需字段**：
- `id` - 工具唯一标识符（通常与工具名称相同）
- `name` - 工具显示名称
- `description` - 工具功能描述
- `version` - 版本号（语义化版本，如 "1.0.0"）
- `category` - 工具类别（如：system, utility, ai, file, network 等）

**可选字段**：
- `author` - 作者名称
- `tags` - 标签数组（用于搜索和分类）
- `scenarios` - 使用场景数组（描述工具的使用场景）
- `limitations` - 限制说明数组（描述工具的限制）

**示例**：

```javascript
getMetadata() {
  return {
    id: 'file-processor',
    name: '文件处理器',
    description: '用于处理各种文件格式的工具，支持读取、转换、分析等功能',
    version: '1.0.0',
    category: 'file',
    author: 'Your Name',
    tags: ['file', 'processor', 'utility'],
    scenarios: [
      '批量处理文件',
      '文件格式转换',
      '文件内容分析'
    ],
    limitations: [
      '最大文件大小限制为 100MB',
      '不支持加密文件',
      '处理大文件时可能较慢'
    ]
  };
}
```

### 4. getSchema() - 强烈推荐

**作用**：定义工具的输入参数和环境变量的 Schema，用于参数验证和工具手册生成。

**返回值**：对象，包含 `parameters` 和 `environment` 两个字段

**结构**：

```javascript
getSchema() {
  return {
    parameters: {
      type: 'object',
      properties: {
        // 参数定义
        paramName: {
          type: 'string',        // 参数类型：string, number, boolean, object, array
          description: '参数说明',
          enum: ['value1', 'value2'],  // 可选值列表（可选）
          default: 'defaultValue',      // 默认值（可选）
          // 其他验证规则...
        }
      },
      required: ['paramName']  // 必需参数列表
    },
    environment: {
      type: 'object',
      properties: {
        ENV_VAR_NAME: {
          type: 'string',
          description: '环境变量说明',
          default: 'default_value'
        }
      },
      required: []  // 必需的环境变量（通常为空）
    }
  };
}
```

**参数类型详解**：

1. **string 类型**：
```javascript
fileName: {
  type: 'string',
  description: '文件名',
  minLength: 1,
  maxLength: 255
}
```

2. **number 类型**：
```javascript
maxSize: {
  type: 'number',
  description: '最大文件大小（字节）',
  minimum: 0,
  maximum: 104857600  // 100MB
}
```

3. **boolean 类型**：
```javascript
overwrite: {
  type: 'boolean',
  description: '是否覆盖已存在的文件',
  default: false
}
```

4. **array 类型**：
```javascript
fileList: {
  type: 'array',
  description: '文件列表',
  items: {
    type: 'string'
  },
  minItems: 1
}
```

5. **object 类型**：
```javascript
options: {
  type: 'object',
  description: '配置选项',
  properties: {
    encoding: { type: 'string', default: 'utf-8' },
    flag: { type: 'string', default: 'w' }
  }
}
```

6. **枚举值**：
```javascript
method: {
  type: 'string',
  description: '操作方法',
  enum: ['read', 'write', 'delete', 'list'],
  default: 'read'
}
```

**环境变量 Schema 示例**：

```javascript
environment: {
  type: 'object',
  properties: {
    ALLOWED_DIRECTORIES: {
      type: 'string',
      description: '允许访问的目录列表（JSON 数组格式）',
      default: '["~/.prompt-manager"]'
    },
    MAX_FILE_SIZE: {
      type: 'string',
      description: '最大文件大小（字节）',
      default: '10485760'  // 10MB
    },
    API_KEY: {
      type: 'string',
      description: 'API 密钥（如果工具需要）',
      default: ''
    }
  },
  required: []
}
```

### 5. getBusinessErrors() - 强烈推荐

**作用**：定义工具可能遇到的业务错误，用于错误识别和解决方案提示。

**返回值**：数组，包含错误定义对象

**错误对象结构**：

```javascript
{
  code: 'ERROR_CODE',           // 错误代码（大写字母和下划线）
  description: '错误描述',      // 人类可读的错误描述
  match: /error pattern/i,      // 错误匹配模式（正则表达式）
  solution: '解决方案',         // 解决建议
  retryable: false              // 是否可重试（boolean）
}
```

**示例**：

```javascript
getBusinessErrors() {
  return [
    {
      code: 'FILE_NOT_FOUND',
      description: '文件不存在',
      match: /ENOENT|文件不存在|File not found/i,
      solution: '请检查文件路径是否正确，确保文件存在',
      retryable: false
    },
    {
      code: 'PERMISSION_DENIED',
      description: '权限不足',
      match: /EACCES|权限不足|Permission denied/i,
      solution: '请检查文件权限，确保有读取/写入权限',
      retryable: false
    },
    {
      code: 'NETWORK_ERROR',
      description: '网络错误',
      match: /网络错误|Network error|ECONNREFUSED/i,
      solution: '请检查网络连接，稍后重试',
      retryable: true
    },
    {
      code: 'FILE_TOO_LARGE',
      description: '文件过大',
      match: /文件过大|File too large|MAX_FILE_SIZE/i,
      solution: '文件大小超过限制，请使用较小的文件或增加 MAX_FILE_SIZE 配置',
      retryable: false
    }
  ];
}
```

---

## 📝 完整代码模板

### 基础模板（最小可用版本）

```javascript
/**
 * {工具名称} - {工具描述}
 * 
 * 功能说明：
 * - 功能点1
 * - 功能点2
 * 
 * 注意：此工具将在独立沙箱环境中运行
 */

// 导入 Node.js 内置模块（使用 ES6 import）
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

export default {
  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      // 如果有第三方依赖，在此声明
      // 'axios': '^1.0.0'
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'tool-name',
      name: '工具名称',
      description: '工具功能描述',
      version: '1.0.0',
      category: 'utility',
      author: 'Your Name',
      tags: ['tag1', 'tag2'],
      scenarios: [
        '使用场景1',
        '使用场景2'
      ],
      limitations: [
        '限制说明1',
        '限制说明2'
      ]
    };
  },

  /**
   * 获取参数 Schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          // 定义参数
          action: {
            type: 'string',
            description: '操作类型',
            enum: ['action1', 'action2'],
            default: 'action1'
          }
        },
        required: ['action']
      },
      environment: {
        type: 'object',
        properties: {
          // 定义环境变量
        },
        required: []
      }
    };
  },

  /**
   * 获取业务错误定义
   */
  getBusinessErrors() {
    return [
      {
        code: 'ERROR_CODE',
        description: '错误描述',
        match: /error pattern/i,
        solution: '解决方案',
        retryable: false
      }
    ];
  },

  /**
   * 执行工具
   */
  async execute(params) {
    const { api } = this;
    
    // 记录执行开始
    api?.logger?.info('执行开始', { 
      tool: this.__toolName,
      params: Object.keys(params)
    });
    
    try {
      // 参数验证（业务层面，框架已做基础验证）
      this.validateParams(params);
      
      // 如果涉及文件操作，必须先初始化文件系统
      // await this.initializeFilesystem();
      
      // 业务逻辑处理
      const result = await this.processLogic(params);
      
      // 记录执行成功
      api?.logger?.info('执行成功');
      
      // 直接返回业务结果，框架会自动包装
      return result;
      
    } catch (error) {
      // 错误处理和日志记录
      api?.logger?.error('执行失败', { 
        error: error.message,
        stack: error.stack
      });
      // 重新抛出错误，框架会匹配业务错误定义并处理
      throw error;
    }
  },

  /**
   * 参数验证（辅助方法）
   */
  validateParams(params) {
    const schema = this.getSchema();
    const required = schema.parameters.required || [];
    
    // 检查必需参数
    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        throw new Error(`缺少必需参数: ${param}`);
      }
    }
    
    // 检查参数类型和值
    const properties = schema.parameters.properties || {};
    for (const [key, value] of Object.entries(params)) {
      const prop = properties[key];
      if (prop) {
        // 类型验证
        if (prop.type === 'string' && typeof value !== 'string') {
          throw new Error(`参数 ${key} 必须是字符串类型`);
        }
        if (prop.type === 'number' && typeof value !== 'number') {
          throw new Error(`参数 ${key} 必须是数字类型`);
        }
        if (prop.type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`参数 ${key} 必须是布尔类型`);
        }
        
        // 枚举值验证
        if (prop.enum && !prop.enum.includes(value)) {
          throw new Error(`参数 ${key} 的值必须是以下之一: ${prop.enum.join(', ')}`);
        }
      }
    }
  },

  /**
   * 业务逻辑处理（辅助方法）
   */
  async processLogic(params) {
    const { api } = this;
    
    // 实现具体的业务逻辑
    // ...
    
    return { success: true };
  }
};
```

### 文件操作工具模板（包含 Storage 和工具目录使用）

```javascript
/**
 * 文件操作工具 - 提供文件读写、路径解析等功能
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';

export default {
  getDependencies() {
    return {};
  },

  getMetadata() {
    return {
      id: 'file-operator',
      name: '文件操作工具',
      description: '提供安全的文件读写、路径解析等功能',
      version: '1.0.0',
      category: 'file',
      tags: ['file', 'io'],
      scenarios: [
        '读取文件内容',
        '写入文件内容',
        '检查文件是否存在'
      ],
      limitations: [
        '只能访问允许的目录',
        '文件大小限制为 10MB'
      ]
    };
  },

  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: '操作方法',
            enum: ['read', 'write', 'exists'],
            default: 'read'
          },
          filePath: {
            type: 'string',
            description: '文件路径（支持 ~ 开头）'
          },
          content: {
            type: 'string',
            description: '文件内容（write 方法必需）'
          }
        },
        required: ['method', 'filePath']
      },
      environment: {
        type: 'object',
        properties: {
          ALLOWED_DIRECTORIES: {
            type: 'string',
            description: '允许访问的目录列表（JSON 数组格式）',
            default: '["~/.prompt-manager"]'
          }
        },
        required: []
      }
    };
  },

  getBusinessErrors() {
    return [
      {
        code: 'FILE_NOT_FOUND',
        description: '文件不存在',
        match: /ENOENT|文件不存在/i,
        solution: '请检查文件路径是否正确',
        retryable: false
      },
      {
        code: 'PERMISSION_DENIED',
        description: '权限不足',
        match: /EACCES|权限不足/i,
        solution: '请检查文件权限',
        retryable: false
      },
      {
        code: 'PATH_OUT_OF_BOUNDS',
        description: '路径越权',
        match: /路径越权|不在允许的目录范围内/i,
        solution: '请使用允许的目录范围内的路径',
        retryable: false
      }
    ];
  },

  async execute(params) {
    const { api } = this;
    
    api?.logger?.info('文件操作开始', { 
      method: params.method,
      filePath: params.filePath
    });
    
    try {
      // 初始化文件系统（设置允许的目录）
      await this.initializeFilesystem();
      
      // 解析并验证路径
      const safePath = this.resolvePromptManagerPath(params.filePath);
      
      // 根据方法执行操作
      switch (params.method) {
        case 'read':
          return await this.readFile(safePath);
        case 'write':
          if (!params.content) {
            throw new Error('write 方法需要 content 参数');
          }
          return await this.writeFile(safePath, params.content);
        case 'exists':
          return await this.checkExists(safePath);
        default:
          throw new Error(`不支持的方法: ${params.method}`);
      }
      
    } catch (error) {
      api?.logger?.error('文件操作失败', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },

  async readFile(filePath) {
    const { api } = this;
    
    // 检查缓存（使用 Storage API）
    const cacheKey = `file:${filePath}`;
    const cached = api.storage.getItem(cacheKey);
    if (cached && cached.timestamp > Date.now() - 60000) {  // 1分钟缓存
      api?.logger?.info('文件读取成功（缓存）', { size: cached.size });
      return cached;
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    const result = { content, size: content.length };
    
    // 保存到缓存
    api.storage.setItem(cacheKey, {
      ...result,
      timestamp: Date.now()
    });
    
    api?.logger?.info('文件读取成功', { size: content.length });
    return result;
  },

  async writeFile(filePath, content) {
    const { api } = this;
    await fs.writeFile(filePath, content, 'utf-8');
    
    // 清除缓存
    const cacheKey = `file:${filePath}`;
    api.storage.setItem(cacheKey, null);
    
    api?.logger?.info('文件写入成功', { size: content.length });
    return { success: true, size: content.length };
  },

  async checkExists(filePath) {
    try {
      await fs.access(filePath);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  },
  
  // 使用工具目录存储数据文件的示例
  async saveToToolDir(data) {
    const { api } = this;
    
    // 在工具目录下创建数据目录
    const dataDir = path.join(this.__toolDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // 保存数据文件
    const filePath = path.join(dataDir, 'data.json');
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    api?.logger?.info('数据已保存到工具目录', { filePath });
    return { success: true, filePath };
  }
};
```

### 使用第三方依赖的工具模板

```javascript
/**
 * PDF 处理工具 - 使用 pdf-parse 库处理 PDF 文件
 */

import path from 'path';
import fs from 'fs/promises';

export default {
  getDependencies() {
    return {
      'pdf-parse': '^1.1.1'  // 声明依赖
    };
  },

  getMetadata() {
    return {
      id: 'pdf-processor',
      name: 'PDF 处理工具',
      description: '读取和解析 PDF 文件内容',
      version: '1.0.0',
      category: 'file',
      tags: ['pdf', 'document'],
      scenarios: [
        '提取 PDF 文本内容',
        '获取 PDF 元信息'
      ],
      limitations: [
        '不支持加密的 PDF',
        '大文件处理可能较慢'
      ]
    };
  },

  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'PDF 文件路径'
          },
          extractText: {
            type: 'boolean',
            description: '是否提取文本内容',
            default: true
          }
        },
        required: ['filePath']
      },
      environment: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  },

  getBusinessErrors() {
    return [
      {
        code: 'PDF_PARSE_ERROR',
        description: 'PDF 解析失败',
        match: /PDF parse error|无法解析/i,
        solution: '请确保 PDF 文件格式正确且未加密',
        retryable: false
      }
    ];
  },

  async execute(params) {
    const { api } = this;
    
    api?.logger?.info('PDF 处理开始', { filePath: params.filePath });
    
    try {
      // 初始化文件系统
      await this.initializeFilesystem();
      
      // 解析路径
      const safePath = this.resolvePromptManagerPath(params.filePath);
      
      // 读取文件
      const buffer = await fs.readFile(safePath);
      
      // 导入第三方模块（使用工具上下文提供的方法）
      const pdfParse = await this.importToolModule('pdf-parse');
      
      // 解析 PDF
      const data = await pdfParse.default(buffer);
      
      api?.logger?.info('PDF 处理成功', { 
        pages: data.numpages,
        textLength: data.text.length
      });
      
      const result = {
        pages: data.numpages,
        info: data.info,
        metadata: data.metadata
      };
      
      if (params.extractText !== false) {
        result.text = data.text;
      }
      
      return result;
      
    } catch (error) {
      api?.logger?.error('PDF 处理失败', { 
        error: error.message 
      });
      throw error;
    }
  }
};
```

---

## 🛠️ 开发步骤

### 步骤 1：规划工具功能

1. 确定工具名称和 ID（使用小写字母和连字符，如 `file-processor`）
2. 列出工具的功能点
3. 确定需要的参数
4. 确定需要的环境变量
5. 确定可能的错误情况

### 步骤 2：创建工具文件

1. 创建文件：`{tool-name}.tool.js`
2. 使用完整代码模板作为起点
3. 填写所有必需和推荐的方法

### 步骤 3：实现核心功能

1. 实现 `execute()` 方法
2. 实现参数验证逻辑
3. 实现业务逻辑
4. 添加错误处理
5. 添加日志记录

### 步骤 4：完善元信息

1. 填写 `getMetadata()` - 确保所有字段都有值
2. 填写 `getSchema()` - 确保参数定义完整准确
3. 填写 `getBusinessErrors()` - 列出所有可能的错误

### 步骤 5：测试和验证

1. 使用验证清单检查所有项
2. 测试正常流程
3. 测试错误情况
4. 检查日志输出

### 步骤 6：工具自动注册（无需手动操作）

**重要更新**：工具系统已实现自动注册机制，无需手动修改 `mcp.server.js` 文件！

**自动注册机制**：

1. **工具自动发现**：
   - 系统启动时自动扫描 `~/.prompt-manager/toolbox/` 目录
   - 自动加载所有符合规范的工具（`{tool-name}.tool.js`）
   - 自动从工具的 `getMetadata()` 方法获取元数据

2. **描述自动生成**：
   - `toolm` 工具的 description 会自动从所有已加载工具的元数据生成
   - 自动生成"常见场景（IF-THEN 规则）"列表
   - 自动生成"系统内置工具"列表
   - 工具描述来自 `getMetadata().description`
   - 使用场景来自 `getMetadata().scenarios`（优先）或 `description`

3. **无需手动操作**：
   - ✅ 不需要修改 `packages/server/mcp/mcp.server.js`
   - ✅ 不需要手动添加工具描述
   - ✅ 工具创建后，重启服务器即可自动注册
   - ✅ 工具列表和使用场景会自动更新

**工作原理**：

```javascript
// 在 getMcpServer() 中自动执行：
1. 初始化工具加载器（扫描并加载所有工具）
2. 调用 generateToolmDescription() 生成动态描述
3. 从所有工具的 getMetadata() 提取信息
4. 自动生成工具列表和使用场景规则
```

**确保自动注册成功的条件**：

1. ✅ 工具文件位于正确目录：
   - 系统工具：`packages/resources/tools/{tool-name}/{tool-name}.tool.js`
   - 用户工具：`~/.prompt-manager/toolbox/{tool-name}/{tool-name}.tool.js`

2. ✅ 工具实现了 `getMetadata()` 方法：
   - 包含 `description` 字段（用于工具列表）
   - 包含 `scenarios` 字段（用于使用场景规则，可选但推荐）

3. ✅ 重启服务器：
   - 新工具需要重启服务器才能被加载
   - 工具描述会在服务器启动时自动生成

**示例：工具元数据如何影响自动注册**：

```javascript
getMetadata() {
  return {
    id: 'my-tool',
    name: '我的工具',
    description: '这是一个用于XXX的工具，支持YYY和ZZZ功能',  // 会出现在工具列表中
    scenarios: [
      '需要XXX功能时使用',  // 会出现在 IF-THEN 规则中（第一个场景）
      '需要YYY功能时使用'
    ],
    // ...
  };
}
```

**自动生成的描述格式**：

- **使用场景规则**：`- IF {scenarios[0]} → 使用 tool://{tool-name}`
- **工具列表项**：`- **tool://{tool-name}** - {description}`

**注意事项**：
- 工具描述应该简洁明了，突出工具的核心功能（建议 50-120 字符）
- `scenarios` 数组的第一个元素会用于生成 IF-THEN 规则
- 如果工具没有 `scenarios`，系统会从 `description` 中提取
- 工具按名称字母顺序排序显示

### 步骤 7：创建 README.md 文档

**重要**：工具完成并验证正确之后，必须在工具同级目录创建 README.md 文档，格式与现有工具保持一致。

**文件位置**：
- 系统工具：`packages/resources/tools/{tool-name}/README.md`
- 用户工具：`~/.prompt-manager/toolbox/{tool-name}/README.md`

**文档结构**：

```markdown
# {工具名称} Tool

{工具简短描述，1-2句话说明工具的核心功能}

## 功能特性

1. **功能1** (`method1`)
   - 功能点1
   - 功能点2

2. **功能2** (`method2`)
   - 功能点1
   - 功能点2

## 环境变量配置

工具需要配置以下环境变量：

- `ENV_VAR_NAME` (必需/可选): 环境变量说明
  - 默认值: `default_value`
  - 示例: `example_value`

## 使用方法

### 1. 配置环境变量

```yaml
tool: tool://{tool-name}
mode: configure
parameters:
  ENV_VAR: "value"
```

### 2. 执行操作

```yaml
tool: tool://{tool-name}
mode: execute
parameters:
  method: "method_name"
  param1: "value1"
  param2: "value2"
```

## 参数说明

### method1 方法

- `method` (必需): 必须为 `"method1"`
- `param1` (必需): 参数1说明
- `param2` (可选): 参数2说明，默认 `default_value`

### method2 方法

- `method` (必需): 必须为 `"method2"`
- `param3` (必需): 参数3说明

## 返回格式

### method1 返回

```json
{
  "success": true,
  "data": "..."
}
```

### method2 返回

```json
{
  "success": true,
  "result": "..."
}
```

## 错误处理

工具定义了以下业务错误：

- `ERROR_CODE1`: 错误描述1
- `ERROR_CODE2`: 错误描述2

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **其他注意事项**: ...

## 测试步骤

1. **重启服务器**（如果服务器已在运行）

2. **查看工具手册**
   ```yaml
   tool: tool://{tool-name}
   mode: manual
   ```

3. **配置环境变量**
   ```yaml
   tool: tool://{tool-name}
   mode: configure
   parameters:
     ENV_VAR: "value"
   ```

4. **测试执行**
   ```yaml
   tool: tool://{tool-name}
   mode: execute
   parameters:
     method: "method_name"
     param1: "value1"
   ```

## 开发说明

工具遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 符合工具开发指南的所有要求

## 版本历史

- **1.0.0** (2025-01-01): 初始版本
  - 实现功能1
  - 实现功能2
  - 支持环境变量配置
  - 完整的错误处理
```

**文档编写要点**：

1. **标题和简介**：
   - 使用 `# {工具名称} Tool` 作为标题
   - 第一段简要描述工具的核心功能（1-2句话）

2. **功能特性**：
   - 列出工具的主要功能点
   - 每个功能点说明对应的方法和主要能力

3. **环境变量配置**：
   - 列出所有环境变量及其说明
   - 标注是否必需
   - 提供默认值和示例

4. **使用方法**：
   - 提供配置环境变量的示例
   - 提供主要操作的使用示例
   - 使用 YAML 代码块格式

5. **参数说明**：
   - 按方法分组说明参数
   - 标注参数是否必需
   - 说明参数类型和默认值

6. **返回格式**：
   - 提供主要方法的返回格式示例
   - 使用 JSON 代码块格式

7. **错误处理**：
   - 列出所有业务错误代码和描述
   - 参考 `getBusinessErrors()` 中的定义

8. **注意事项**：
   - 列出使用工具时需要注意的事项
   - 包括服务器同步、路径限制、性能考虑等

9. **测试步骤**：
   - 提供完整的测试流程
   - 从查看手册到执行测试的步骤

10. **开发说明**：
    - 说明工具遵循的开发规范
    - 可以提及参考实现或依赖库

11. **版本历史**：
    - 记录版本号和发布日期
    - 列出每个版本的主要变更

**参考示例**：
- 系统工具示例：`packages/resources/tools/ollama-remote/README.md`
- 其他工具示例：`packages/resources/tools/chrome-devtools/README.md`、`packages/resources/tools/filesystem/README.md` 等

---

## ✅ 验证清单

在提交工具前，必须完成以下所有检查项：

### 代码结构验证

- [ ] 使用 `export default` 导出工具对象（不是 `module.exports`）
- [ ] 所有 import 语句使用 ES6 语法（`import ... from ...`）
- [ ] 文件名为 `{tool-name}.tool.js` 格式
- [ ] 代码格式规范，缩进一致

### 接口完整性验证

- [ ] 实现了 `execute()` 方法（必需）
- [ ] 实现了 `getDependencies()` 方法（推荐）
- [ ] 实现了 `getMetadata()` 方法（推荐）
- [ ] 实现了 `getSchema()` 方法（推荐）
- [ ] 实现了 `getBusinessErrors()` 方法（推荐）

### 元数据验证

- [ ] `getMetadata()` 返回对象包含所有必需字段：
  - [ ] `id` - 工具唯一标识符
  - [ ] `name` - 工具显示名称
  - [ ] `description` - 工具功能描述
  - [ ] `version` - 版本号（语义化版本格式）
  - [ ] `category` - 工具类别
- [ ] `id` 与工具文件名一致（去除 `.tool.js` 后缀）
- [ ] `version` 符合语义化版本规范（如 `1.0.0`）

### Schema 验证

- [ ] `getSchema()` 返回对象包含 `parameters` 和 `environment` 字段
- [ ] `parameters.properties` 中定义了所有使用的参数
- [ ] `parameters.required` 中列出了所有必需参数
- [ ] 每个参数都有 `type` 和 `description`
- [ ] 枚举值参数定义了 `enum` 数组
- [ ] 有默认值的参数定义了 `default`

### 参数验证验证

- [ ] `execute()` 方法中实现了参数验证
- [ ] 验证必需参数是否存在
- [ ] 验证参数类型是否正确
- [ ] 验证枚举值是否在允许范围内
- [ ] 验证失败时抛出清晰的错误信息
- [ ] **注意**：框架会根据 `getSchema()` 进行基础验证，但工具内部仍需进行业务层面的验证（如方法特定的参数要求）

### 错误处理验证

- [ ] `execute()` 方法使用 try-catch 包裹业务逻辑
- [ ] 所有错误都被捕获并记录日志
- [ ] 错误信息清晰易懂
- [ ] `getBusinessErrors()` 定义了所有可能的业务错误
- [ ] 每个错误定义包含：code, description, match, solution, retryable

### 日志记录验证

- [ ] 使用 `api.logger.info()` 记录执行开始
- [ ] 使用 `api.logger.info()` 记录执行成功
- [ ] 使用 `api.logger.error()` 记录执行失败
- [ ] 关键操作都有日志记录
- [ ] 日志包含足够的上下文信息

### 安全验证

- [ ] **所有文件路径都通过 `resolvePromptManagerPath()` 解析**（包括 path、paths、source、destination 等所有路径参数）
- [ ] **文件操作前调用 `initializeFilesystem()`**（必须在首次使用路径解析前调用）
- [ ] 不直接使用用户提供的路径（必须使用解析后的安全路径）
- [ ] 环境变量通过 `api.environment.get()` 获取
- [ ] 不访问系统敏感信息
- [ ] 路径解析失败时让错误自然抛出（框架会处理）

### 依赖管理验证

- [ ] `getDependencies()` 声明了所有第三方依赖
- [ ] 依赖版本号格式正确（如 `^1.0.0`）
- [ ] 不依赖全局环境中的包
- [ ] Node.js 内置模块直接使用 `import`，不通过工具上下文

### 功能验证

- [ ] 工具能正常执行（使用有效参数）
- [ ] 工具能正确处理错误情况（使用无效参数）
- [ ] 工具返回的结果格式正确
- [ ] 工具能在沙箱环境中正常运行

### 文档验证

- [ ] 文件开头有工具说明注释
- [ ] 每个方法都有注释说明
- [ ] 复杂逻辑有注释解释
- [ ] 使用场景和限制说明清晰
- [ ] **已创建 README.md 文档**（与工具文件同级目录）
- [ ] README.md 包含所有必需部分：
  - [ ] 标题和简介
  - [ ] 功能特性
  - [ ] 环境变量配置
  - [ ] 使用方法（包含配置和执行示例）
  - [ ] 参数说明（按方法分组）
  - [ ] 返回格式（主要方法的返回示例）
  - [ ] 错误处理（列出所有业务错误）
  - [ ] 注意事项
  - [ ] 测试步骤（完整测试流程）
  - [ ] 开发说明
  - [ ] 版本历史
- [ ] README.md 格式与现有工具保持一致
- [ ] README.md 中的示例代码可以正常运行

### 工具自动注册验证

- [ ] **工具已实现 `getMetadata()` 方法**（必需，用于自动注册）
- [ ] `getMetadata()` 包含 `description` 字段（用于工具列表）
- [ ] `getMetadata()` 包含 `scenarios` 字段（推荐，用于使用场景规则）
- [ ] 工具文件位于正确目录（系统工具或用户工具目录）
- [ ] 重启服务器后工具能自动被发现和加载
- [ ] 工具描述在 toolm 的 description 中自动出现
- [ ] 工具名称与 `getMetadata().id` 一致

---

## ❓ 常见问题

### Q1: 如何导入第三方 npm 包？

**A:** 使用工具上下文提供的 `importToolModule()` 方法：

```javascript
// 在 getDependencies() 中声明依赖
getDependencies() {
  return {
    'axios': '^1.0.0'
  };
}

// 在 execute() 中使用
async execute(params) {
  const axios = await this.importToolModule('axios');
  // 使用 axios...
}
```

### Q2: 如何访问文件系统？

**A:** 必须使用工具上下文提供的方法，严格按照以下步骤：

```javascript
async execute(params) {
  const { api } = this;
  
  // 步骤1：初始化文件系统（必须，在路径解析前调用）
  await this.initializeFilesystem();
  
  // 步骤2：解析所有路径参数（会自动验证权限）
  // 注意：所有路径相关的参数都必须解析
  const safePath = this.resolvePromptManagerPath(params.filePath);
  
  // 如果有多个路径参数，都需要解析
  if (params.paths) {
    params.paths = params.paths.map(p => this.resolvePromptManagerPath(p));
  }
  if (params.source) {
    params.source = this.resolvePromptManagerPath(params.source);
  }
  if (params.destination) {
    params.destination = this.resolvePromptManagerPath(params.destination);
  }
  
  // 步骤3：使用安全路径进行文件操作
  const fs = await import('fs/promises');
  const content = await fs.readFile(safePath, 'utf-8');
  
  return content;
}
```

**关键要点**：
- ✅ 必须先调用 `initializeFilesystem()`
- ✅ 所有路径参数都必须通过 `resolvePromptManagerPath()` 解析
- ✅ 路径解析失败会自动抛出错误，不需要手动处理
- ✅ 使用解析后的安全路径进行文件操作

### Q3: 如何访问环境变量？

**A:** 通过 `api.environment.get()` 方法：

```javascript
async execute(params) {
  const { api } = this;
  
  // 获取环境变量
  const apiKey = api.environment.get('API_KEY');
  const maxSize = api.environment.get('MAX_FILE_SIZE');
  
  // 设置环境变量（会保存到 .env 文件）
  await api.environment.set('LAST_RUN', new Date().toISOString());
}
```

### Q3.1: 如何使用存储服务（Storage API）？

**A:** 通过 `api.storage` 对象进行数据持久化存储：

```javascript
async execute(params) {
  const { api } = this;
  
  // 读取存储数据
  const cachedData = api.storage.getItem('cache-key');
  
  // 写入存储数据（会自动持久化）
  api.storage.setItem('cache-key', {
    data: 'value',
    timestamp: Date.now()
  });
  
  // 存储复杂对象
  const allData = api.storage.getItem('all-data') || {};
  allData[params.id] = { value: params.value };
  api.storage.setItem('all-data', allData);
}
```

**重要说明**：
- Storage API 用于工具内部的数据缓存和状态管理
- 数据会持久化到工具目录，重启后仍然可用
- 适合存储：缓存数据、配置信息、处理状态等
- 不适合存储：大文件、敏感信息（应使用环境变量）

### Q3.2: 如何使用工具目录存储数据？

**A:** 使用 `this.__toolDir` 获取工具目录路径：

```javascript
async execute(params) {
  const { api } = this;
  
  // 获取工具目录
  const toolDir = this.__toolDir;  // ~/.prompt-manager/toolbox/{tool-name}
  
  // 在工具目录下创建子目录存储数据
  const dataDir = path.join(toolDir, 'data');
  const cacheDir = path.join(toolDir, 'cache', 'subdir');
  
  // 确保目录存在
  const fs = await import('fs/promises');
  await fs.mkdir(cacheDir, { recursive: true });
  
  // 在工具目录下存储文件
  const filePath = path.join(cacheDir, 'data.json');
  await fs.writeFile(filePath, JSON.stringify(data));
}
```

**重要说明**：
- `this.__toolDir` 指向工具的沙箱目录
- 可以在此目录下创建子目录存储工具特定的数据
- 不需要通过 `resolvePromptManagerPath()` 解析（工具目录本身是安全的）
- 适合存储：缓存文件、临时文件、工具特定的数据文件

### Q4: 如何记录日志？

**A:** 使用 `api.logger` 对象：

```javascript
async execute(params) {
  const { api } = this;
  
  api.logger.info('信息日志', { context: 'data' });
  api.logger.warn('警告日志', { warning: 'message' });
  api.logger.error('错误日志', { error: error.message });
  api.logger.debug('调试日志', { debug: 'info' });
}
```

### Q5: 工具执行失败怎么办？

**A:** 确保错误被正确抛出，框架会自动处理：

```javascript
async execute(params) {
  try {
    // 业务逻辑
  } catch (error) {
    // 记录错误日志
    this.api.logger.error('执行失败', { error: error.message });
    // 重新抛出错误
    throw error;
  }
}
```

### Q6: 如何验证参数？

**A:** 在 `execute()` 方法开始处验证：

```javascript
async execute(params) {
  const schema = this.getSchema();
  const required = schema.parameters.required || [];
  
  // 检查必需参数
  for (const param of required) {
    if (params[param] === undefined) {
      throw new Error(`缺少必需参数: ${param}`);
    }
  }
  
  // 检查参数类型和值
  // ...
}
```

### Q7: 工具可以访问哪些目录？

**A:** 通过环境变量 `ALLOWED_DIRECTORIES` 配置，默认是 `~/.prompt-manager`：

```javascript
// 在 getSchema() 中定义环境变量
environment: {
  properties: {
    ALLOWED_DIRECTORIES: {
      type: 'string',
      description: '允许访问的目录列表（JSON 数组格式）',
      default: '["~/.prompt-manager"]'
    }
  }
}

// 在 execute() 中使用
const allowedDirs = this.getAllowedDirectories();
```

### Q8: 如何测试工具？

**A:** 使用 MCP 工具调用：

```yaml
# 查看工具手册
tool: tool://{tool-name}
mode: manual

# 执行工具
tool: tool://{tool-name}
mode: execute
parameters:
  param1: value1
  param2: value2

# 配置环境变量
tool: tool://{tool-name}
mode: configure
parameters:
  ENV_VAR: value
```

---

## 💡 最佳实践

### 1. 代码组织

- ✅ 将复杂逻辑拆分为辅助方法
- ✅ 每个方法职责单一
- ✅ 使用有意义的变量和方法名
- ✅ 添加必要的注释

### 2. 错误处理

- ✅ 始终使用 try-catch 包裹可能出错的操作
- ✅ 提供清晰的错误信息
- ✅ 记录详细的错误日志
- ✅ 在 `getBusinessErrors()` 中定义所有可能的错误

### 3. 参数验证

- ✅ 在 `execute()` 开始处验证所有参数
- ✅ 验证参数类型、范围、格式
- ✅ 提供清晰的验证错误信息
- ✅ 使用 Schema 定义作为验证依据

### 4. 日志记录

- ✅ 记录执行开始和结束
- ✅ 记录关键操作步骤
- ✅ 记录错误和异常
- ✅ 日志包含足够的上下文信息

### 5. 安全性

- ✅ 始终验证文件路径
- ✅ 使用 `resolvePromptManagerPath()` 解析路径
- ✅ 不信任用户输入
- ✅ 限制资源访问范围

### 6. 性能

- ✅ 避免同步阻塞操作
- ✅ 对大文件使用流式处理
- ✅ 合理使用缓存
- ✅ 优化循环和递归

### 7. 可维护性

- ✅ 代码结构清晰
- ✅ 方法职责明确
- ✅ 添加必要的注释
- ✅ 遵循代码规范

---

## ⚠️ 框架层面关键规则（必须严格遵守）

> **这些规则是框架层面的要求，违反会导致工具无法正常运行或集成失败！**

### 规则 1：文件系统操作流程（文件操作工具必须遵守）

### 规则 1：文件系统操作流程

**必须严格按照以下顺序**：

```javascript
async execute(params) {
  // 1. 获取 API 上下文
  const { api } = this;
  
  // 2. 初始化文件系统（如果涉及文件操作）
  await this.initializeFilesystem();
  
  // 3. 解析所有路径参数
  const safePath = this.resolvePromptManagerPath(params.filePath);
  
  // 4. 使用安全路径进行操作
  const fs = await import('fs/promises');
  const content = await fs.readFile(safePath, 'utf-8');
  
  return content;
}
```

**错误示例**（会导致路径解析失败）：
```javascript
// ❌ 错误：没有初始化文件系统
const path = this.resolvePromptManagerPath(params.filePath);  // 可能失败

// ❌ 错误：直接使用用户路径
const content = await fs.readFile(params.filePath, 'utf-8');  // 安全风险
```

### 规则 2：返回值格式

**工具直接返回业务结果即可**，框架会自动包装成 MCP 格式：

```javascript
// ✅ 正确：直接返回业务结果
return { success: true, data: [...] };
return "文件内容";
return [{ file: 'a.txt' }, { file: 'b.txt' }];
return null;  // 也可以返回 null

// ❌ 错误：不要手动包装成 MCP 格式
return { content: [{ type: "text", text: "..." }] };  // 框架会处理，不要手动包装
```

**框架会自动将返回值包装为**：
```json
{
  "success": true,
  "tool": "tool-name",
  "mode": "execute",
  "result": <你的返回值>
}
```

### 规则 3：错误处理

**错误必须通过 `throw` 抛出**，框架会自动处理并匹配业务错误定义：

```javascript
// ✅ 正确：抛出错误
if (!params.filePath) {
  throw new Error('缺少必需参数: filePath');
}

// ✅ 正确：捕获后重新抛出
try {
  // 业务逻辑
} catch (error) {
  api.logger.error('执行失败', { error: error.message });
  throw error;  // 重新抛出，框架会匹配 getBusinessErrors() 中的错误定义
}

// ❌ 错误：不要返回错误对象
return { error: '执行失败' };  // 应该抛出错误，不要返回错误对象
```

**框架的错误处理流程**：
1. 工具抛出错误
2. 框架捕获错误
3. 框架匹配 `getBusinessErrors()` 中的错误模式（通过 `match` 正则表达式）
4. 如果匹配成功，返回格式化的错误信息（包含解决方案）
5. 如果匹配失败，返回原始错误信息

### 规则 4：模块导入

**Node.js 内置模块直接使用 `import`，第三方模块使用工具上下文方法**：

```javascript
// ✅ 正确：直接导入 Node.js 内置模块（推荐在文件顶部）
import path from 'path';
import os from 'os';

// ✅ 正确：动态导入 Node.js 内置模块（在 execute 方法中）
const fs = await import('fs/promises');
const fs2 = await import('fs');
const fsPromises = fs2.promises;

// ✅ 正确：第三方模块使用工具上下文方法（必须在 getDependencies() 中声明）
const pdfParse = await this.importToolModule('pdf-parse');
const axios = await this.importToolModule('axios');

// ❌ 错误：不要用工具上下文方法导入内置模块
const fs = await this.importToolModule('fs');  // 不必要，直接 import 即可

// ❌ 错误：不要直接 import 第三方模块（必须通过工具上下文）
import pdfParse from 'pdf-parse';  // 错误！应该用 importToolModule()
```

**模块导入规则总结**：
- Node.js 内置模块（`fs`, `path`, `os`, `crypto` 等）→ 直接 `import` 或 `await import()`
- 第三方 npm 包（`pdf-parse`, `axios` 等）→ 使用 `await this.importToolModule()`
- 必须在 `getDependencies()` 中声明所有第三方依赖

**第三方模块导入的兼容性处理**：

某些第三方模块可能有不同的导出格式（类、函数、对象等），需要进行兼容性处理：

```javascript
async execute(params) {
  const { api } = this;
  
  // 导入第三方模块
  const module = await this.importToolModule('some-module');
  
  // 兼容性处理：检查不同的导出格式
  let ModuleClass;
  
  // 方式1：检查是否是类（新版本可能导出类）
  if (module.PDFParse && typeof module.PDFParse === 'function') {
    ModuleClass = module.PDFParse;
  }
  // 方式2：检查 default 是否是类
  else if (module.default && typeof module.default === 'function') {
    const defaultExport = module.default;
    // 检查是否是类（类通常有 prototype 或 toString 以 'class' 开头）
    if (defaultExport.toString().startsWith('class') || defaultExport.prototype) {
      ModuleClass = defaultExport;
    } else {
      // 可能是函数（旧版本）
      ModuleClass = defaultExport;
    }
  }
  // 方式3：直接是函数
  else if (typeof module === 'function') {
    ModuleClass = module;
  }
  // 方式4：从对象中查找
  else {
    ModuleClass = module.PDFParse || module.default || module;
  }
  
  // 验证模块是否有效
  if (!ModuleClass || (typeof ModuleClass !== 'function' && typeof ModuleClass !== 'object')) {
    throw new Error('模块格式错误：无法找到有效的导出');
  }
  
  // 使用模块
  if (typeof ModuleClass === 'function' && ModuleClass.toString().startsWith('class')) {
    // 是类，需要实例化
    const instance = new ModuleClass(options);
    const result = await instance.method();
  } else {
    // 是函数，直接调用
    const result = await ModuleClass(data);
  }
}
```

### 规则 5：上下文访问

**必须通过 `this` 访问上下文，所有方法都会被绑定到同一个上下文对象**：

```javascript
// ✅ 正确：通过 this 访问 API 上下文
const { api } = this;
api.logger.info('日志');
api.environment.get('KEY');

// ✅ 正确：通过 this 访问框架提供的方法
await this.initializeFilesystem();
const path = this.resolvePromptManagerPath(params.filePath);
const dirs = this.getAllowedDirectories();
const module = await this.importToolModule('module-name');

// ✅ 正确：通过 this 访问工具属性
const toolDir = this.__toolDir;
const toolName = this.__toolName;

// ✅ 正确：工具方法之间可以相互调用（因为都绑定到同一个 this）
async execute(params) {
  const result = await this.helperMethod(params);  // 可以调用其他方法
  return result;
}

// ❌ 错误：不要直接访问（虽然可以，但不推荐）
const api = this.api;  // 可以，但推荐解构：const { api } = this;
```

**上下文绑定说明**：
- 工具的所有方法（包括 `execute`、`getMetadata` 等）都会被绑定到同一个上下文对象
- 因此工具方法之间可以相互调用，共享 `this` 上下文
- `this.api`、`this.__toolDir`、`this.__toolName` 等属性在所有方法中都可访问

### 规则 6：参数验证时机

**框架会做基础验证，工具需要做业务层面的验证**：

```javascript
async execute(params) {
  // 框架已经根据 getSchema() 做了基础验证：
  // - 检查必需参数是否存在
  // - 检查参数类型是否正确
  // - 检查枚举值是否在允许范围内
  
  // 工具内部需要做业务层面的验证：
  // - 方法特定的参数要求（如 method='write' 时需要 content）
  // - 参数之间的关联性验证
  // - 业务规则验证
  
  // 方式1：简单的条件验证
  if (params.method === 'write' && !params.content) {
    throw new Error('write 方法需要 content 参数');
  }
  
  // 方式2：使用 methodRequirements 对象（推荐，适合多个方法）
  const methodRequirements = {
    'read': ['filePath'],
    'write': ['filePath', 'content'],
    'delete': ['filePath']
  };
  
  const required = methodRequirements[params.method];
  if (!required) {
    throw new Error(`不支持的方法: ${params.method}`);
  }
  
  const missing = required.filter(field => !params[field]);
  if (missing.length > 0) {
    throw new Error(`方法 ${params.method} 缺少必需参数: ${missing.join(', ')}`);
  }
  
  // 业务逻辑...
}
```

### 规则 7：环境变量类型处理

**环境变量从 .env 文件读取时是字符串，需要根据类型转换**：

```javascript
async execute(params) {
  const { api } = this;
  
  // 环境变量读取（返回字符串）
  const allowedDirsStr = api.environment.get('ALLOWED_DIRECTORIES');
  
  // 需要解析 JSON 字符串（如果环境变量是 JSON 格式）
  let allowedDirs;
  try {
    allowedDirs = JSON.parse(allowedDirsStr);
  } catch {
    // 如果不是 JSON，可能是逗号分隔的字符串
    allowedDirs = allowedDirsStr.split(',').map(s => s.trim());
  }
  
  // 数字类型的环境变量需要转换
  const maxSize = parseInt(api.environment.get('MAX_FILE_SIZE'), 10);
  
  // 布尔类型的环境变量需要转换
  const enabled = api.environment.get('ENABLED') === 'true';
}
```

### 规则 8：多个路径参数的处理

**所有路径相关的参数都必须解析**：

```javascript
async execute(params) {
  await this.initializeFilesystem();
  
  // 单个路径参数
  if (params.path) {
    params.path = this.resolvePromptManagerPath(params.path);
  }
  
  // 多个路径参数（数组）
  if (params.paths) {
    params.paths = params.paths.map(p => this.resolvePromptManagerPath(p));
  }
  
  // 源路径和目标路径
  if (params.source) {
    params.source = this.resolvePromptManagerPath(params.source);
  }
  if (params.destination) {
    params.destination = this.resolvePromptManagerPath(params.destination);
  }
  
  // 使用解析后的路径进行操作
  // ...
}
```

### 规则 9：工具方法调用

**工具方法之间可以相互调用，因为都绑定到同一个上下文**：

```javascript
export default {
  async execute(params) {
    // 可以调用其他工具方法
    const validated = this.validateParams(params);
    const result = await this.processLogic(validated);
    return result;
  },
  
  // 辅助方法
  validateParams(params) {
    // 验证逻辑
    return params;
  },
  
  async processLogic(params) {
    // 业务逻辑
    // 也可以调用其他方法
    const data = await this.fetchData(params);
    return this.transformData(data);
  },
  
  async fetchData(params) {
    // 数据获取
  },
  
  transformData(data) {
    // 数据转换
  }
};
```

### 规则 10：资源清理

**对于需要清理资源的操作（如文件句柄、网络连接等），使用 try-finally 确保清理**：

```javascript
async execute(params) {
  const { api } = this;
  
  let resource = null;
  let parser = null;
  
  try {
    // 创建资源
    const module = await this.importToolModule('some-module');
    parser = new module.Parser(options);
    
    // 使用资源
    const result = await parser.process();
    
    return result;
    
  } finally {
    // 确保资源清理（无论成功还是失败都会执行）
    if (parser && typeof parser.destroy === 'function') {
      await parser.destroy();
    }
    if (resource && typeof resource.close === 'function') {
      await resource.close();
    }
  }
}
```

### 规则 11：Storage API 使用

**使用 `api.storage` 进行数据持久化存储**：

```javascript
async execute(params) {
  const { api } = this;
  
  // 读取存储数据
  const cache = api.storage.getItem('cache-key');
  if (cache && !params.forceRefresh) {
    return cache;  // 使用缓存
  }
  
  // 处理数据
  const result = await this.processData(params);
  
  // 保存到存储
  api.storage.setItem('cache-key', {
    data: result,
    timestamp: Date.now()
  });
  
  // 存储复杂对象（需要先读取，修改，再写入）
  const allData = api.storage.getItem('all-data') || {};
  allData[params.id] = result;
  api.storage.setItem('all-data', allData);
  
  return result;
}
```

**Storage API 特点**：
- 数据持久化到工具目录，重启后仍然可用
- 适合存储：缓存数据、配置信息、处理状态、元数据等
- 不适合存储：大文件（应使用文件系统）、敏感信息（应使用环境变量）
- 存储的是 JSON 可序列化的数据

---

## 📚 参考资源

- **系统架构文档**：`docs/dev/TOOL_SANDBOX_DESIGN.md`
- **开发规范文档**：`docs/dev/TOOL_DEVELOPMENT_GUIDE.md`
- **工具示例**：`packages/resources/tools/`

---

## 🎯 开发检查清单（快速参考）

在提交工具前，快速检查以下关键点：

1. ✅ 使用 `export default` 导出
2. ✅ 实现了 `execute()` 方法
3. ✅ 实现了参数验证
4. ✅ 实现了错误处理
5. ✅ 实现了日志记录
6. ✅ 所有文件路径通过 `resolvePromptManagerPath()` 解析
7. ✅ 元数据完整（id, name, description, version, category）
8. ✅ Schema 定义完整准确
9. ✅ 业务错误定义完整
10. ✅ 依赖声明完整
11. ✅ **工具元数据完整**（`getMetadata()` 包含 description 和 scenarios，用于自动注册）
12. ✅ **已创建 README.md 文档**（与工具文件同级目录，格式与现有工具一致）

---

**文档版本**：1.0.0  
**最后更新**：2025-01-XX  
**维护者**：Prompt Manager Team

