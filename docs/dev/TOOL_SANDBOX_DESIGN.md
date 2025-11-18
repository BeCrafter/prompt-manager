# Prompt Manager 工具独立沙箱环境设计方案

## 1. 背景与问题

当前 Prompt Manager 的工具机制存在以下问题：
- 工具依赖与项目环境混用，导致依赖冲突
- 工具无法独立管理自己的依赖版本
- 工具间可能产生依赖冲突
- 工具部署和更新不够灵活

## 2. 设计目标

- 每个工具拥有独立的运行沙箱环境
- 工具依赖自动安装和管理
- 工具运行环境隔离
- 向后兼容现有工具

## 3. 沙箱环境结构

### 3.1 目录结构变更
```
# 旧结构
~/.prompt-manager/tools/{toolname}/{toolname}.tool.js

# 新结构
~/.prompt-manager/toolbox/{toolname}/
├── {toolname}.tool.js        # 工具主文件
├── package.json              # 工具依赖配置
├── node_modules/             # 工具独立依赖
├── data/                     # 工具数据存储
└── logs/                     # 工具运行日志
```

### 3.2 系统内置工具目录
系统内置工具也需要在沙箱环境中运行。原有位于 `packages/resources/tools/` 目录下的工具需要同步到沙箱环境：

```
# 原始系统工具目录
packages/resources/tools/{toolname}/{toolname}.tool.js

# 同步到沙箱环境
~/.prompt-manager/toolbox/{toolname}/
├── {toolname}.tool.js       # 工具主文件
├── package.json             # 工具依赖配置
├── node_modules/            # 工具独立依赖
├── data/                    # 工具数据存储
└── logs/                    # 工具运行日志
```

### 3.3 工具同步与沙箱执行机制
所有工具（包括系统内置工具）都必须在沙箱环境中运行：

1. **系统工具同步**：启动时将 `packages/resources/tools/` 目录下的工具同步到 `~/.prompt-manager/toolbox/` 目录
2. **沙箱执行**：所有工具都通过沙箱执行器运行，确保隔离性
3. **依赖管理**：每个工具独立管理其依赖，无论是否为系统内置工具
4. **环境变量**：所有工具都支持通过 `.env` 文件配置环境变量
5. **日志记录**：所有工具的日志都输出到 `run.log` 文件中

```javascript
async function syncSystemTools() {
  const toolsDir = path.join(__dirname, '..', 'resources', 'tools');
  const toolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  
  if (!fs.existsSync(toolsDir)) {
    return;
  }
  
  const toolNames = fs.readdirSync(toolsDir);
  
  for (const toolName of toolNames) {
    const toolDir = path.join(toolsDir, toolName);
    const toolFile = path.join(toolDir, `${toolName}.tool.js`);
    
    if (fs.statSync(toolDir).isDirectory() && fs.existsSync(toolFile)) {
      // 同步到 toolbox 目录
      const sandboxDir = path.join(toolboxDir, toolName);
      const sandboxToolFile = path.join(sandboxDir, `${toolName}.tool.js`);
      
      // 创建沙箱目录
      await fs.promises.mkdir(sandboxDir, { recursive: true });
      
      // 复制工具文件
      await fs.promises.copyFile(toolFile, sandboxToolFile);
      
      // 创建默认的 package.json（如果不存在）
      const packageJsonPath = path.join(sandboxDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        const toolModule = await import(toolFile);
        const dependencies = toolModule.default.getDependencies ? toolModule.default.getDependencies() : {};
        
        const packageJson = {
          name: `@prompt-manager/${toolName}`,
          version: '1.0.0',
          description: `Prompt Manager System Tool: ${toolName}`,
          main: `${toolName}.tool.js`,
          dependencies: dependencies,
          private: true
        };
        
        await fs.promises.writeFile(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2)
        );
      }
      
      console.log(`系统工具 ${toolName} 已同步到沙箱环境`);
    }
  }
}
```

## 4. 工具接口扩展

### 4.1 getDependencies() 方法扩展
```javascript
getDependencies() {
  return {
    // 工具的 npm 依赖
    'pdf-parse': '^1.1.1',
    'puppeteer': '^19.0.0',
    // 本地文件依赖（相对于工具目录）
    './local-module.js': 'local',
    // 系统命令依赖
    'docker': '>=20.0.0'
  };
}
```

### 4.2 新增 getRuntimeConfig() 方法
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

## 5. 依赖管理机制

### 5.1 依赖检查与安装流程
```javascript
async function ensureToolDependencies(toolName) {
  const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  const packageJsonPath = path.join(toolDir, 'package.json');
  
  // 检查 package.json 是否存在
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`工具 ${toolName} 缺少 package.json 文件`);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const nodeModulesPath = path.join(toolDir, 'node_modules');
  
  // 检查 node_modules 是否存在或是否需要更新
  if (!fs.existsSync(nodeModulesPath)) {
    await installDependencies(toolDir);
  } else {
    // 检查依赖版本是否匹配
    const installedPackageJson = await getInstalledDependencies(nodeModulesPath);
    if (!dependenciesMatch(packageJson.dependencies, installedPackageJson)) {
      await updateDependencies(toolDir);
    }
  }
}

async function installDependencies(toolDir) {
  // 在工具目录中执行 npm install
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    const child = exec('npm install', { cwd: toolDir }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`依赖安装失败: ${stderr}`));
      } else {
        console.log('依赖安装成功:', stdout);
        resolve();
      }
    });
    
    // 设置超时
    setTimeout(() => {
      child.kill();
      reject(new Error('依赖安装超时'));
    }, 300000); // 5分钟超时
  });
}
```

### 5.2 依赖版本锁定
每个工具的 `package.json` 应包含精确的依赖版本，推荐使用 `package-lock.json` 锁定版本。

## 6. 沙箱执行机制

### 6.0 实际实现说明

**实际实现：ES6 模块 + 受限执行环境**

设计文档中提到的 VM 执行方案是理想方案，但实际实现采用了 ES6 模块 + 受限执行环境方案。

**实现方式：**
- 工具使用 ES6 模块格式开发
- 通过动态 `import()` 加载工具模块
- 通过上下文绑定和 API 层限制实现安全隔离

**安全措施：**
- 上下文绑定（this.api）- 工具只能通过受限 API 访问资源
- 超时控制 - 防止工具无限执行
- API 层限制 - 所有操作通过受限 API
- 路径验证 - 防止越权访问
- 日志隔离 - 每个工具有独立日志
- 依赖隔离 - 每个工具有独立的 node_modules

**适用场景：**
- ✅ 系统内置工具（信任度高）
- ✅ 用户自己开发的工具（用户负责安全）
- ⚠️ 第三方不可信工具（未来可能需要 VM 完全隔离）

**选择原因：**
1. ES6 语法开发体验更好
2. 避免 ES6 转 CommonJS 的转换风险
3. 对于系统工具和用户工具，当前方案已足够安全
4. 节省开发时间

详细说明请参考 `TOOL_DEVELOPMENT_GUIDE.md`。

---

### 6.1 工具执行器（设计文档方案）
```javascript
class ToolSandboxExecutor {
  async execute(toolName, params) {
    // 1. 确保依赖已安装
    await ensureToolDependencies(toolName);
    
    // 2. 创建沙箱环境
    const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
    const toolModulePath = path.join(toolDir, `{toolName}.tool.js`);
    
    // 3. 创建工具 API 接口，限制权限
    const toolApi = this.createSandboxedApi(toolName, params);
    
    // 4. 在 Node.js 沙箱中执行工具
    const { runInNewContext } = require('vm');
    const fs = require('fs');
    const path = require('path');
    
    // 读取工具代码
    const toolCode = fs.readFileSync(toolModulePath, 'utf-8');
    
    // 定义沙箱上下文
    const sandbox = {
      // Node.js 内置模块（受限）
      require: this.createSandboxedRequire(toolDir),
      console: console,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      Buffer: Buffer,
      // 工具 API
      api: toolApi,
      params: params,
      // 工具上下文
      __toolDir: toolDir,
      __toolName: toolName
    };
    
    try {
      // 执行工具代码
      const result = runInNewContext(`
        const module = { exports: {} };
        (function(exports, require, module, __filename, __dirname, api, params) {
          ${toolCode}
          return module.exports;
        })(module.exports, require, module, __filename, __dirname, api, params);
        module.exports.execute(params);
      `, sandbox, {
        filename: toolModulePath,
        timeout: this.getRuntimeConfig(toolName).maxExecutionTime * 1000
      });
      
      return result;
    } catch (error) {
      throw new Error(`工具执行失败: ${error.message}`);
    }
  }
  
  createSandboxedRequire(toolDir) {
    return (moduleName) => {
      // 限制 require 路径，只能访问工具目录和 node_modules
      if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
        // 相对路径，检查是否在工具目录内
        const resolvedPath = path.resolve(toolDir, moduleName);
        if (!resolvedPath.startsWith(toolDir)) {
          throw new Error('路径访问被拒绝');
        }
      }
      
      // 从工具的 node_modules 加载
      const toolNodeModules = path.join(toolDir, 'node_modules');
      const modulePath = path.join(toolNodeModules, moduleName);
      
      // 验证路径安全
      if (!modulePath.startsWith(toolNodeModules) && !modulePath.startsWith(toolDir)) {
        throw new Error('模块访问被拒绝');
      }
      
      return require(modulePath);
    };
  }
}
```

### 6.2 环境变量配置机制
工具现在支持通过 `.env` 文件配置环境变量，该文件位于工具沙箱目录中。

#### 6.2.1 .env 文件格式
```
# Tool Environment Variables
# Tool: {toolname}
# Generated by PromptManager ToolEnvironment
# Last modified: 2025-11-18T02:00:08.104Z

ALLOWED_DIRECTORIES=/Users/wangming
API_KEY=your-api-key
CUSTOM_VAR=value
```

文件位置：`~/.prompt-manager/toolbox/{toolname}/.env`

#### 6.2.2 环境变量加载机制
```javascript
async function loadToolEnvironment(toolName) {
  const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  const envFilePath = path.join(toolDir, '.env');
  
  // 检查 .env 文件是否存在
  if (!fs.existsSync(envFilePath)) {
    return {}; // 如果不存在则返回空对象
  }
  
  try {
    // 读取 .env 文件内容
    const envContent = fs.readFileSync(envFilePath, 'utf-8');
    
    // 解析 .env 文件内容
    const envVars = {};
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      // 跳过注释和空行
      if (line.trim() === '' || line.startsWith('#')) {
        continue;
      }
      
      // 解析键值对
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        // 重新连接值部分（因为值中可能包含等号）
        let value = valueParts.join('=').trim();
        
        // 处理带引号的值
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        
        envVars[key.trim()] = value;
      }
    }
    
    return envVars;
  } catch (error) {
    console.error(`加载工具 ${toolName} 的环境变量失败:`, error.message);
    return {};
  }
}
```

#### 6.2.3 工具执行时的环境变量集成
```javascript
class ToolSandboxExecutor {
  async execute(toolName, params) {
    // 1. 确保依赖已安装
    await ensureToolDependencies(toolName);
    
    // 2. 加载工具环境变量
    const toolEnvVars = await loadToolEnvironment(toolName);
    
    // 3. 创建沙箱环境，合并环境变量
    const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
    const toolModulePath = path.join(toolDir, `{toolName}.tool.js`);
    
    // 4. 创建工具 API 接口，限制权限
    const toolApi = this.createSandboxedApi(toolName, params);
    
    // 5. 在 Node.js 沙箱中执行工具，传递环境变量
    const { runInNewContext } = require('vm');
    const fs = require('fs');
    const path = require('path');
    
    // 读取工具代码
    const toolCode = fs.readFileSync(toolModulePath, 'utf-8');
    
    // 定义沙箱上下文，包含环境变量
    const sandbox = {
      // Node.js 内置模块（受限）
      require: this.createSandboxedRequire(toolDir),
      console: console,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      Buffer: Buffer,
      // 工具 API
      api: toolApi,
      params: params,
      // 工具上下文
      __toolDir: toolDir,
      __toolName: toolName,
      // 环境变量
      process: {
        env: {
          ...process.env,  // 继承主进程环境变量
          ...toolEnvVars   // 合并工具特定环境变量
        }
      }
    };
    
    try {
      // 执行工具代码
      const result = runInNewContext(`
        const module = { exports: {} };
        (function(exports, require, module, __filename, __dirname, api, params, process) {
          ${toolCode}
          return module.exports;
        })(module.exports, require, module, __filename, __dirname, api, params, process);
        module.exports.execute(params);
      `, sandbox, {
        filename: toolModulePath,
        timeout: this.getRuntimeConfig(toolName).maxExecutionTime * 1000
      });
      
      return result;
    } catch (error) {
      throw new Error(`工具执行失败: ${error.message}`);
    }
  }
}
```

#### 6.2.4 configure 模式实现
```javascript
async function configureToolEnvironment(toolName, environmentParams) {
  const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  
  // 确保工具目录存在
  if (!fs.existsSync(toolDir)) {
    throw new Error(`工具目录不存在: ${toolDir}`);
  }
  
  const envFilePath = path.join(toolDir, '.env');
  
  // 生成 .env 文件内容
  const timestamp = new Date().toISOString();
  let envContent = `# Tool Environment Variables\n`;
  envContent += `# Tool: ${toolName}\n`;
  envContent += `# Generated by PromptManager ToolEnvironment\n`;
  envContent += `# Last modified: ${timestamp}\n\n`;
  
  // 添加环境变量
  for (const [key, value] of Object.entries(environmentParams)) {
    // 转义值以确保安全
    const escapedValue = String(value).replace(/\n/g, '\\n');
    envContent += `${key}=${escapedValue}\n`;
  }
  
  // 写入 .env 文件
  try {
    await fs.promises.writeFile(envFilePath, envContent, 'utf-8');
    console.log(`工具 ${toolName} 的环境变量已配置到: ${envFilePath}`);
    
    return {
      success: true,
      message: `环境变量已成功配置到 ${toolName} 工具`,
      envFile: envFilePath
    };
  } catch (error) {
    throw new Error(`配置工具环境变量失败: ${error.message}`);
  }
}
```

### 6.3 日志记录机制
所有工具的输入和输出日志都应输出到 `~/.prompt-manager/toolbox/{toolname}/run.log` 文件中。

#### 6.3.1 日志文件格式
日志文件采用标准的结构化格式，包含时间戳、日志级别和消息内容：

```
[2025-11-18T02:00:08.104Z] [INFO] 执行开始 - 工具: pdf-reader, 参数: {"pdfPath":"/path/to/doc.pdf"}
[2025-11-18T02:00:08.150Z] [DEBUG] 加载 PDF 文件: /path/to/doc.pdf
[2025-11-18T02:00:09.200Z] [INFO] PDF 加载成功 - 页数: 15
[2025-11-18T02:00:10.300Z] [INFO] 执行完成 - 结果大小: 125KB
[2025-11-18T02:00:10.305Z] [ERROR] 文件处理失败 - 错误: 无法解析加密的PDF
```

文件位置：`~/.prompt-manager/toolbox/{toolname}/run.log`

#### 6.3.2 日志记录实现
```javascript
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

class ToolLogger {
  constructor(toolName) {
    this.toolName = toolName;
    this.logFilePath = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName, 'run.log');
    this.logQueue = [];  // 日志队列，用于缓冲
    this.isWriting = false;  // 防止并发写入
    this.maxQueueSize = 1000;  // 最大队列大小
    this.maxLogAge = 3 * 60 * 60 * 1000;  // 最大日志保留时间：3小时（毫秒）
  }

  async log(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // 添加到队列
    this.logQueue.push(logEntry);
    
    // 如果队列过大，先写入文件
    if (this.logQueue.length >= this.maxQueueSize) {
      await this.flush();
    } else {
      // 延迟写入，提高性能
      setImmediate(() => this.flush());
    }
  }

  /**
   * 清理过期的日志行
   * @param {string} content - 原始日志内容
   * @returns {string} - 清理后的日志内容
   */
  filterExpiredLogs(content) {
    if (!content) return content;
    
    const lines = content.split('\n');
    const now = Date.now();
    const cutoffTime = now - this.maxLogAge;
    
    // 过滤掉超过3小时的日志
    const filteredLines = lines.filter(line => {
      if (!line.startsWith('[')) return true; // 非标准格式日志行保留
      
      try {
        // 提取时间戳部分 [2025-11-18T02:00:08.104Z]
        const timestampStrMatch = line.match(/^\[([^\]]+)\]/);
        if (!timestampStrMatch) return true; // 无法解析的行保留
        
        const timestampStr = timestampStrMatch[1];
        const logTime = new Date(timestampStr).getTime();
        
        // 保留未过期的日志
        return logTime >= cutoffTime;
      } catch (error) {
        // 解析错误的日志行保留
        return true;
      }
    });
    
    return filteredLines.join('\n');
  }

  async flush() {
    if (this.isWriting || this.logQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    try {
      // 确保目录存在
      const logDir = path.dirname(this.logFilePath);
      await fs.mkdir(logDir, { recursive: true });

      // 获取现有日志内容并进行清理
      let existingContent = '';
      try {
        const stats = await fs.stat(this.logFilePath);
        if (stats.size > 0) {
          existingContent = await fs.readFile(this.logFilePath, 'utf-8');
          
          // 清理过期日志
          existingContent = this.filterExpiredLogs(existingContent);
          
          // 进一步限制日志文件大小为10MB，保留最新的内容
          if (existingContent.length > 10 * 1024 * 1024) {
            const lines = existingContent.split('\n');
            // 保留后半部分
            const keepLines = lines.slice(Math.max(0, lines.length - 1000));
            existingContent = keepLines.join('\n');
          }
        }
      } catch (error) {
        // 文件不存在，从空开始
        if (error.code !== 'ENOENT') {
          console.error('读取日志文件失败:', error.message);
        }
      }

      // 合并新日志
      const newLogs = this.logQueue.join('\n') + '\n';
      const content = existingContent + newLogs;

      // 写入文件
      await fs.writeFile(this.logFilePath, content, 'utf-8');
      
      // 清空队列
      this.logQueue = [];
    } catch (error) {
      console.error('写入日志文件失败:', error.message);
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * 手动清理过期日志（外部调用）
   */
  async cleanupExpiredLogs() {
    try {
      const stats = await fs.stat(this.logFilePath);
      if (stats.size > 0) {
        let content = await fs.readFile(this.logFilePath, 'utf-8');
        const cleanedContent = this.filterExpiredLogs(content);
        
        if (cleanedContent !== content) {
          await fs.writeFile(this.logFilePath, cleanedContent, 'utf-8');
          console.log(`已清理过期日志: ${this.logFilePath}`);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('清理过期日志失败:', error.message);
      }
    }
  }

  // 便捷方法
  async info(message, context = {}) {
    await this.log('INFO', message, context);
  }

  async debug(message, context = {}) {
    await this.log('DEBUG', message, context);
  }

  async warn(message, context = {}) {
    await this.log('WARN', message, context);
  }

  async error(message, context = {}) {
    await this.log('ERROR', message, context);
  }
}

// 全局日志记录器缓存
const loggerCache = new Map();

function getLogger(toolName) {
  if (!loggerCache.has(toolName)) {
    loggerCache.set(toolName, new ToolLogger(toolName));
  }
  return loggerCache.get(toolName);
}

/**
 * 定期清理所有工具的过期日志
 */
async function scheduleLogCleanup() {
  // 每小时运行一次日志清理
  setInterval(async () => {
    try {
      const homedir = os.homedir();
      const toolboxDir = path.join(homedir, '.prompt-manager', 'toolbox');
      
      if (!fs.existsSync(toolboxDir)) {
        return;
      }
      
      const toolNames = await fs.readdir(toolboxDir);
      
      for (const toolName of toolNames) {
        const toolDir = path.join(toolboxDir, toolName);
        if ((await fs.stat(toolDir)).isDirectory()) {
          const logger = getLogger(toolName);
          await logger.cleanupExpiredLogs();
        }
      }
    } catch (error) {
      console.error('定期清理日志失败:', error.message);
    }
  }, 60 * 60 * 1000); // 每小时运行一次
}

// 启动日志清理定时任务
scheduleLogCleanup();
```

#### 6.3.3 沙箱中的日志集成
在工具沙箱执行器中，我们需要重定向 console 输出到日志文件：

```javascript
class ToolSandboxExecutor {
  async execute(toolName, params) {
    // 1. 确保依赖已安装
    await ensureToolDependencies(toolName);
    
    // 2. 加载工具环境变量
    const toolEnvVars = await loadToolEnvironment(toolName);
    
    // 3. 创建沙箱环境，合并环境变量
    const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
    const toolModulePath = path.join(toolDir, 'tool.js');
    
    // 4. 创建工具 API 接口，限制权限
    const toolApi = this.createSandboxedApi(toolName, params);
    
    // 5. 创建工具专用日志记录器
    const toolLogger = getLogger(toolName);
    
    // 6. 在 Node.js 沙箱中执行工具，传递环境变量和日志记录器
    const { runInNewContext } = require('vm');
    const fs = require('fs');
    const path = require('path');
    
    // 读取工具代码
    const toolCode = fs.readFileSync(toolModulePath, 'utf-8');
    
    // 定义沙箱上下文，包含环境变量和日志记录器
    const sandbox = {
      // Node.js 内置模块（受限）
      require: this.createSandboxedRequire(toolDir),
      // 重定向 console 到日志记录器
      console: {
        log: (...args) => toolLogger.info(args.join(' ')),
        info: (...args) => toolLogger.info(args.join(' ')),
        warn: (...args) => toolLogger.warn(args.join(' ')),
        error: (...args) => toolLogger.error(args.join(' ')),
        debug: (...args) => toolLogger.debug(args.join(' '))
      },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      Buffer: Buffer,
      // 工具 API
      api: toolApi,
      params: params,
      // 工具上下文
      __toolDir: toolDir,
      __toolName: toolName,
      // 环境变量
      process: {
        env: {
          ...process.env,  // 继承主进程环境变量
          ...toolEnvVars   // 合并工具特定环境变量
        }
      }
    };
    
    try {
      // 记录执行开始
      await toolLogger.info('工具执行开始', { 
        tool: toolName, 
        params: params 
      });
      
      // 执行工具代码
      const result = runInNewContext(`
        const module = { exports: {} };
        (function(exports, require, module, __filename, __dirname, api, params, console, process) {
          ${toolCode}
          return module.exports;
        })(module.exports, require, module, __filename, __dirname, api, params, console, process);
        module.exports.execute(params);
      `, sandbox, {
        filename: toolModulePath,
        timeout: this.getRuntimeConfig(toolName).maxExecutionTime * 1000
      });
      
      // 记录执行完成
      await toolLogger.info('工具执行完成', { 
        tool: toolName, 
        resultSize: typeof result === 'string' ? result.length : JSON.stringify(result).length
      });
      
      return result;
    } catch (error) {
      // 记录错误
      await toolLogger.error('工具执行失败', { 
        tool: toolName, 
        error: error.message,
        stack: error.stack
      });
      
      throw new Error(`工具执行失败: ${error.message}`);
    } finally {
      // 确保日志缓冲区被刷新
      await toolLogger.flush();
    }
  }
}
```

#### 6.3.4 日志清理机制
为了确保日志文件不会占用过多磁盘空间，系统提供了自动清理机制：

1. **基于时间的清理**：每个工具的日志记录器会自动清理超过3小时的旧日志
2. **基于大小的清理**：当日志文件超过10MB时，保留最新的1000行
3. **定期清理任务**：系统每小时运行一次全局日志清理，检查并清理所有工具的过期日志

通过这些机制，确保日志系统既能够保留足够的调试信息，又不会占用过多磁盘空间。

### 6.4 Python 工具沙箱（可选）
对于 Python 工具，可以使用类似机制：
```javascript
async function executePythonTool(toolName, params) {
  const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  const requirementsPath = path.join(toolDir, 'requirements.txt');
  
  // 检查并安装 Python 依赖
  if (fs.existsSync(requirementsPath)) {
    await ensurePythonDependencies(toolDir, requirementsPath);
  }
  
  // 加载工具环境变量
  const toolEnvVars = await loadToolEnvironment(toolName);
  
  // 使用子进程执行 Python 脚本
  const pythonScript = path.join(toolDir, 'tool.py');
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [pythonScript, JSON.stringify(params)], {
      cwd: toolDir,
      env: {
        ...process.env,
        ...toolEnvVars,  // 合并工具特定环境变量
        PYTHONPATH: path.join(toolDir, 'lib')
      }
    });
    
    let output = '';
    let error = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Python 工具执行失败: ${error}`));
      }
    });
  });
}
```

## 7. 工具加载器更新

### 7.1 工具发现机制
```javascript
function discoverTools() {
  const tools = [];
  
  // 扫描系统内置工具
  const builtinToolboxDir = path.join(__dirname, '..', 'resources', 'toolbox');
  const builtinTools = scanToolboxDirectory(builtinToolboxDir);
  tools.push(...builtinTools);
  
  // 扫描用户工具
  const userToolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
  if (fs.existsSync(userToolboxDir)) {
    const userTools = scanToolboxDirectory(userToolboxDir);
    tools.push(...userTools);
  }
  
  return tools;
}

function scanToolboxDirectory(toolboxDir) {
  const tools = [];
  
  if (!fs.existsSync(toolboxDir)) {
    return tools;
  }
  
  const directories = fs.readdirSync(toolboxDir).filter(file => {
    return fs.statSync(path.join(toolboxDir, file)).isDirectory();
  });
  
  for (const toolName of directories) {
    const toolDir = path.join(toolboxDir, toolName);
    const toolFile = path.join(toolDir, 'tool.js');
    
    if (fs.existsSync(toolFile)) {
      // 读取工具元数据
      try {
        const toolModule = require(toolFile);
        const metadata = toolModule.getMetadata ? toolModule.getMetadata() : {};
        tools.push({
          name: toolName,
          path: toolDir,
          metadata: metadata,
          module: toolModule
        });
      } catch (error) {
        console.error(`加载工具 ${toolName} 失败: ${error.message}`);
      }
    }
  }
  
  return tools;
}
```

## 8. 工具安装与管理

### 8.1 工具安装
```javascript
async function installTool(toolUrl) {
  const toolName = extractToolName(toolUrl);
  const targetDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  
  // 创建工具目录
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // 下载工具文件
  await downloadTool(toolUrl, targetDir);
  
  // 验证工具结构
  await validateToolStructure(targetDir);
  
  // 安装依赖
  await ensureToolDependencies(toolName);
  
  console.log(`工具 ${toolName} 安装成功`);
}
```

### 8.2 工具更新
```javascript
async function updateTool(toolName) {
  const toolDir = path.join(os.homedir(), '.prompt-manager', 'toolbox', toolName);
  
  // 备份当前版本
  const backupDir = `${toolDir}.backup`;
  await copyDir(toolDir, backupDir);
  
  try {
    // 更新工具文件（通过 URL 或本地路径）
    // ...
    
    // 重新安装依赖
    await ensureToolDependencies(toolName);
    
    // 验证更新后的工具
    await validateToolFunctionality(toolName);
    
    // 删除备份
    await removeDir(backupDir);
    
    console.log(`工具 ${toolName} 更新成功`);
  } catch (error) {
    // 回滚到备份
    await removeDir(toolDir);
    await moveDir(backupDir, toolDir);
    
    throw new Error(`工具更新失败，已回滚: ${error.message}`);
  }
}
```

## 9. 安全机制

### 9.1 权限控制
- 文件系统访问限制在允许的目录内
- 网络访问可配置控制
- 系统命令执行限制
- 内存和执行时间限制

### 9.2 沙箱隔离
- 每个工具在独立的 Node.js VM 上下文中运行
- 工具间无法直接访问彼此的数据
- 工具无法访问系统敏感信息

## 10. 向后兼容性

### 10.1 迁移路径
```javascript
// 迁移旧工具到新沙箱结构
async function migrateOldTools() {
  const oldToolsDir = path.join(os.homedir(), '.prompt-manager', 'tools');
  const newToolboxDir = path.join(os.homedir(), '.prompt-manager', 'toolbox');
  
  if (!fs.existsSync(oldToolsDir)) {
    return;
  }
  
  const oldTools = fs.readdirSync(oldToolsDir);
  
  for (const toolName of oldTools) {
    const oldToolDir = path.join(oldToolsDir, toolName);
    const newToolDir = path.join(newToolboxDir, toolName);
    
    // 检查是否已经是新格式
    if (fs.existsSync(path.join(oldToolDir, 'package.json'))) {
      // 如果旧工具已经有 package.json，直接迁移
      await moveDir(oldToolDir, newToolDir);
    } else {
      // 创建新的沙箱结构
      await createSandboxStructure(oldToolDir, newToolDir);
    }
  }
}

async function createSandboxStructure(oldToolDir, newToolDir) {
  // 创建新目录结构
  await fs.promises.mkdir(newToolDir, { recursive: true });
  await fs.promises.mkdir(path.join(newToolDir, 'data'), { recursive: true });
  await fs.promises.mkdir(path.join(newToolDir, 'logs'), { recursive: true });
  
  // 复制工具文件
  const toolFiles = await fs.promises.readdir(oldToolDir);
  for (const file of toolFiles) {
    if (file.endsWith('.js')) {
      await fs.promises.copyFile(
        path.join(oldToolDir, file),
        path.join(newToolDir, 'tool.js')
      );
    }
  }
  
  // 创建默认 package.json
  const packageJson = {
    name: path.basename(newToolDir),
    version: '1.0.0',
    description: 'Prompt Manager Tool',
    main: 'tool.js',
    dependencies: {},
    private: true
  };
  
  await fs.promises.writeFile(
    path.join(newToolDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}
```

## 11. 验证清单

在实现独立沙箱环境后，需要验证以下项目：

- [ ] 验证工具目录结构 `~/.prompt-manager/toolbox`
- [ ] 每个工具都有独立的 `package.json` 文件
- [ ] 工具依赖在执行前自动检查和安装
- [ ] 依赖安装超时机制正常工作
- [ ] 沙箱执行器正确限制工具权限
- [ ] 工具无法访问沙箱外的文件
- [ ] 工具无法执行危险系统命令
- [ ] 内存和时间限制正常工作
- [ ] 向后兼容性迁移脚本正常工作
- [ ] 现有工具可以正常运行在新环境中
- [ ] 新工具可以正确安装和执行
- [ ] 工具间依赖隔离有效
- [ ] 错误处理机制完善
- [ ] 日志记录功能正常

## 12. 实施计划

### 阶段 1：基础架构
1. 实现沙箱执行器
2. 更新工具发现和加载机制
3. 实现依赖检查和安装逻辑

### 阶段 2：安全机制
1. 实现权限控制
2. 实现资源限制
3. 实现错误处理

### 阶段 3：迁移支持
1. 实现向后兼容性
2. 实现迁移脚本
3. 测试现有工具兼容性

### 阶段 4：完善优化
1. 性能优化
2. 用户体验改进
3. 文档更新