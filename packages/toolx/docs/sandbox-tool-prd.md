# Node.js 沙箱工具库产品需求文档 (PRD)

## 1. 文档信息

- **文档版本**: 1.0
- **创建日期**: 2025年11月6日
- **作者**: Prompt Manager 团队
- **文档类型**: 产品需求文档 (PRD)
- **项目名称**: Node.js 沙箱工具库

## 2. 产品概述

### 2.1 产品背景
Node.js 沙箱工具库是为 PromptX 生态系统设计的一个核心组件，采用**通用库设计理念**，通过运行时注入机制适配不同场景。允许在隔离环境中执行 Node.js 脚本，支持动态安装依赖，并确保工具间的环境隔离。

### 2.2 产品目标
- 设计一个**场景无关**的通用沙箱系统，通过运行时注入适配不同环境
- 支持工具在运行时动态安装所需依赖，依赖安装与宿主环境隔离
- 实现工具间的环境隔离，避免相互影响
- 提供标准化的工具接口，便于工具开发和管理
- 支持多种运行时环境：Electron、Node.js、Docker等

### 2.3 设计理念
- **通用性优先**：核心逻辑与具体运行时解耦，通过接口抽象实现场景适配
- **运行时注入**：不同场景只需注入对应的运行时配置，无需修改核心代码
- **接口标准化**：统一的工具接口和运行时接口，确保跨场景一致性

## 3. 需求详情

### 3.1 功能需求

#### 3.1.1 沙箱执行功能
- **需求ID**: F001
- **需求描述**: 在隔离环境中安全执行 Node.js 脚本，支持多运行时环境
- **优先级**: 高
- **验收标准**:
  - 脚本在独立环境中执行
  - 不影响主系统稳定性
  - 支持常见 Node.js API
  - 实现资源使用限制
  - 支持运行时注入，可适配不同场景
  - 提供统一的执行接口，屏蔽底层差异

#### 3.1.2 动态依赖管理
- **需求ID**: F002
- **需求描述**: 支持工具动态安装和管理 npm 依赖，依赖管理与运行时环境解耦
- **优先级**: 高
- **验收标准**:
  - 工具可声明所需依赖
  - 支持运行时安装依赖
  - 依赖安装不影响其他工具
  - 支持依赖版本管理
  - 支持不同运行时环境的npm路径配置
  - 依赖安装使用注入的npm工具，确保环境一致性

#### 3.1.3 工具环境隔离
- **需求ID**: F003
- **需求描述**: 确保工具间完全隔离，避免相互影响
- **优先级**: 高
- **验收标准**:
  - 每个工具在独立进程/环境中运行
  - 文件系统访问隔离
  - 依赖环境隔离
  - 内存和计算资源隔离

#### 3.1.4 工具枚举与管理
- **需求ID**: F004
- **需求描述**: 自动发现、加载和管理工具
- **优先级**: 中
- **验收标准**:
  - 支持自动扫描工具目录
  - 识别符合命名规范的工具文件
  - 提取工具元数据信息
  - 按需加载工具实例

#### 3.1.5 测试验证机制
- **需求ID**: F005
- **需求描述**: 实现全面的测试验证机制
- **优先级**: 中
- **验收标准**:
  - 支持基础功能验证
  - 支持依赖安装验证
  - 支持工具枚举验证
  - 支持隔离性验证
  - 支持错误处理验证

### 3.2 非功能需求

#### 3.2.1 性能需求
- **需求ID**: NF001
- **需求描述**: 沙箱创建和销毁的性能要求
- **优先级**: 中
- **验收标准**:
  - 单个沙箱创建时间 < 500ms
  - 单个沙箱销毁时间 < 200ms
  - 支持并发执行多个沙箱实例

#### 3.2.2 安全需求
- **需求ID**: NF002
- **需求描述**: 沙箱安全性和隔离性要求
- **优先级**: 高
- **验收标准**:
  - 防止沙箱逃逸
  - 限制文件系统访问权限
  - 限制网络访问权限
  - 防止资源耗尽攻击

#### 3.2.3 可用性需求
- **需求ID**: NF003
- **需求描述**: 系统可用性和易用性要求
- **优先级**: 中
- **验收标准**:
  - 系统稳定性 > 99%
  - 提供清晰的错误信息
  - 支持热更新和动态加载
  - 兼容主流 Node.js 版本

## 4. 设计规范

### 4.1 工具命名规范
- **规范要求**: 工具文件必须以 `{new-tool}.tool.js` 命名格式定义
- **示例**: `calculator.tool.js`, `data-parser.tool.js`
- **说明**: 这种命名方式便于系统识别和管理工具文件

### 4.2 依赖定义规范
- **规范要求**: 依赖必须在工具文件的 `getDependencies()` 方法中定义
- **示例**:
  ```javascript
  getDependencies() {
    return {
      'lodash': '^4.17.21',
      'axios': '^1.0.0'
    };
  }
  ```
- **说明**: 不使用独立的 `package.json` 文件管理依赖

### 4.3 工具接口规范
- **规范要求**: 每个工具必须实现标准接口
- **接口定义**:
  - `getDependencies()` - 获取工具依赖
  - `getMetadata()` - 获取工具元信息
  - `getSchema()` - 获取参数Schema
  - `getBusinessErrors()` - 获取业务错误定义
  - `getRuntimeRequirements()` - 获取运行时需求声明（新增）
  - `execute(params)` - 执行工具

#### 4.3.1 运行时需求声明接口
```javascript
getRuntimeRequirements() {
  return {
    nodeVersion: '>=14.0.0',        // Node.js版本要求
    platform: ['win32', 'darwin', 'linux'], // 支持平台
    requiredCommands: ['node', 'npm'], // 必需命令
    optionalCommands: ['npx'],        // 可选命令
    maxMemory: '512MB',               // 最大内存限制
    maxExecutionTime: 30000,          // 最大执行时间(ms)
    isolatedEnv: true,                // 是否需要隔离环境
    allowedModules: ['lodash', 'axios'] // 允许的模块白名单
  };
}
```

### 4.4 目录结构规范 (优化后)
```
@packages/toolx/
├── resources/           # 静态资源目录
│   └── tools/           # 工具脚本目录
│       ├── [tool-name]/ # 工具目录
│       │   └── {tool-name}.tool.js  # 工具文件
│       └── resources/   # 工具资源文件（可选）
├── src/                 # 核心代码目录
│   ├── core/            # 核心抽象层
│   │   ├── interfaces/              # 专一接口定义
│   │   │   ├── command-executor.js  # 命令执行接口
│   │   │   ├── dependency-manager.js # 依赖管理接口
│   │   │   └── sandbox-manager.js   # 沙箱管理接口
│   │   ├── base/                   # 公共基类
│   │   │   ├── process-pool.js      # 进程池基类
│   │   │   └── runtime-provider.js  # 运行时提供者基类
│   │   ├── registry.js             # 适配器注册表
│   │   ├── tool-loader.js          # 工具加载器
│   │   └── config-loader.js        # 配置加载器
│   ├── adapters/        # 场景适配器
│   │   ├── electron-adapter.js     # Electron适配器
│   │   ├── nodejs-adapter.js       # Node.js适配器
│   │   └── docker-adapter.js       # Docker适配器
│   ├── sandbox/         # 沙箱核心实现
│   ├── security/        # 安全模块
│   │   ├── policy-validator.js     # 安全策略验证
│   │   └── resource-limiter.js     # 资源限制器
│   ├── monitoring/      # 监控模块
│   │   ├── metrics-collector.js    # 指标收集器
│   │   └── performance-tracker.js  # 性能跟踪器
│   ├── test/            # 测试目录
│   └── utils/           # 工具函数
├── config/              # 配置文件目录
│   ├── base-config.yml              # 基础配置模板
│   └── scenarios/                   # 场景配置
│       ├── electron.yml
│       ├── nodejs.yml
│       └── docker.yml
└── docs/                # 文档目录
```

## 5. 技术方案

### 5.1 通用沙箱抽象层设计

#### 5.1.1 专一接口设计 (ISP原则)

**命令执行接口**
```javascript
interface ICommandExecutor {
  /**
   * 执行命令
   * @param {string} command - 命令名称
   * @param {string[]} args - 命令参数
   * @param {object} options - 执行选项
   * @returns {Promise<ExecutionResult>} 执行结果
   */
  executeCommand(command, args, options = {});
}
```

**依赖管理接口**
```javascript
interface IDependencyManager {
  /**
   * 安装依赖
   * @param {object} dependencies - 依赖配置
   * @param {string} targetDir - 目标目录
   * @returns {Promise<InstallResult>} 安装结果
   */
  installDependencies(dependencies, targetDir);
}
```

**沙箱管理接口**
```javascript
interface ISandboxManager {
  /**
   * 创建沙箱环境
   * @param {object} config - 沙箱配置
   * @returns {Promise<Sandbox>} 沙箱实例
   */
  createSandbox(config);
  
  /**
   * 销毁沙箱环境
   * @param {string} sandboxId - 沙箱ID
   * @returns {Promise<void>}
   */
  destroySandbox(sandboxId);
}
```

#### 5.1.2 适配器注册机制 (OCP原则)

**适配器注册表**
```javascript
class AdapterRegistry {
  static adapters = new Map();
  static instances = new Map();
  
  /**
   * 注册适配器
   * @param {string} name - 适配器名称
   * @param {class} adapterClass - 适配器类
   */
  static register(name, adapterClass) {
    this.adapters.set(name, adapterClass);
  }
  
  /**
   * 创建适配器实例
   * @param {string} name - 适配器名称
   * @param {object} config - 配置参数
   * @returns {object} 适配器实例
   */
  static create(name, config) {
    const AdapterClass = this.adapters.get(name);
    if (!AdapterClass) {
      throw new Error(`Unknown adapter: ${name}`);
    }
    
    // 单例模式缓存实例
    const cacheKey = `${name}_${JSON.stringify(config)}`;
    if (!this.instances.has(cacheKey)) {
      this.instances.set(cacheKey, new AdapterClass(config));
    }
    
    return this.instances.get(cacheKey);
  }
  
  /**
   * 获取已注册的适配器列表
   * @returns {string[]} 适配器名称列表
   */
  static getRegisteredAdapters() {
    return Array.from(this.adapters.keys());
  }
}

// 内置适配器注册
AdapterRegistry.register('electron', ElectronRuntimeProvider);
AdapterRegistry.register('nodejs', NodeJSRuntimeProvider);
AdapterRegistry.register('docker', DockerRuntimeProvider);

// 支持插件化扩展
// AdapterRegistry.register('kubernetes', KubernetesAdapter);
```

#### 5.1.3 公共进程池基类 (DRY原则)

**基础进程池**
```javascript
class BaseProcessPool {
  constructor(runtimeProvider, options = {}) {
    this.runtimeProvider = runtimeProvider;
    this.maxWorkers = options.maxWorkers || 4;
    this.minWorkers = options.minWorkers || 1;
    this.warmupWorkers = options.warmupWorkers || 2;
    this.maxIdleTime = options.maxIdleTime || 300000; // 5分钟
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30秒
    this.recycleThreshold = options.recycleThreshold || 100;
    
    this.workers = new Map();
    this.availableWorkers = [];
    this.busyWorkers = new Set();
    this.usageCount = new Map();
    
    this.initialize();
  }
  
  /**
   * 初始化进程池
   */
  async initialize() {
    // 预热进程
    for (let i = 0; i < this.warmupWorkers; i++) {
      await this.createWorker();
    }
    
    // 启动健康检查
    this.startHealthCheck();
  }
  
  /**
   * 获取可用工作进程
   * @param {string} toolName - 工具名称
   * @returns {Promise<object>} 工作进程
   */
  async acquireWorker(toolName) {
    // 负载均衡：选择使用次数最少的进程
    let worker = this.availableWorkers
      .sort((a, b) => (this.usageCount.get(a.id) || 0) - (this.usageCount.get(b.id) || 0))[0];
    
    if (!worker && this.workers.size < this.maxWorkers) {
      worker = await this.createWorker();
    }
    
    if (!worker) {
      throw new Error('No available workers in pool');
    }
    
    // 更新状态
    this.availableWorkers = this.availableWorkers.filter(w => w.id !== worker.id);
    this.busyWorkers.add(worker.id);
    this.usageCount.set(worker.id, (this.usageCount.get(worker.id) || 0) + 1);
    
    // 检查是否需要回收进程
    if (this.usageCount.get(worker.id) > this.recycleThreshold) {
      await this.recycleWorker(worker.id);
      return await this.acquireWorker(toolName);
    }
    
    return worker;
  }
  
  /**
   * 释放工作进程
   * @param {string} workerId - 进程ID
   */
  releaseWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (worker) {
      this.busyWorkers.delete(workerId);
      this.availableWorkers.push(worker);
    }
  }
  
  /**
   * 启动健康检查
   */
  startHealthCheck() {
    setInterval(() => {
      this.workers.forEach(async (worker) => {
        if (!await this.isWorkerHealthy(worker)) {
          await this.destroyWorker(worker.id);
        }
      });
    }, this.healthCheckInterval);
  }
  
  /**
   * 抽象方法：创建工作进程
   * @returns {Promise<object>} 工作进程
   */
  async createWorker() {
    throw new Error('Must be implemented by subclass');
  }
  
  /**
   * 抽象方法：检查进程健康状态
   * @param {object} worker - 工作进程
   * @returns {Promise<boolean>} 是否健康
   */
  async isWorkerHealthy(worker) {
    throw new Error('Must be implemented by subclass');
  }
}
```

### 5.2 场景适配层实现

#### 5.2.1 Electron适配器 (实现专一接口)
```javascript
class ElectronRuntimeProvider implements ICommandExecutor, IDependencyManager, ISandboxManager {
  constructor(config) {
    this.config = config;
    this.nodePath = config.runtime.nodePath;
    this.npmPath = config.runtime.npmPath;
    this.npxPath = config.runtime.npxPath;
    this.workingDir = config.runtime.workingDir;
    this.envVars = config.runtime.envVars || {};
  }
  
  // 实现命令执行接口
  async executeCommand(command, args, options = {}) {
    const security = this.config.security;
    
    // 安全检查：验证命令是否被阻止
    if (security.blockedCommands.includes(command)) {
      throw new Error(`Command '${command}' is blocked by security policy`);
    }
    
    // 使用Electron的UtilityProcess执行
    return await utilityProcess.execute(this.nodePath, [command, ...args], {
      env: { ...this.envVars, ...options.env },
      cwd: options.cwd || this.workingDir,
      stdio: 'pipe'
    });
  }
  
  // 实现依赖管理接口
  async installDependencies(dependencies, targetDir) {
    const installArgs = ['install'];
    
    // 添加镜像源配置
    const registry = this.selectRegistry();
    if (registry) {
      installArgs.push(`--registry=${registry}`);
    }
    
    // 添加具体依赖
    Object.entries(dependencies).forEach(([name, version]) => {
      installArgs.push(`${name}@${version}`);
    });
    
    return await this.executeCommand(this.npmPath, installArgs, {
      cwd: targetDir
    });
  }
  
  // 实现沙箱管理接口
  async createSandbox(toolConfig) {
    const sandboxId = `electron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建隔离的工作目录
    const sandboxDir = path.join(this.workingDir, 'sandboxes', sandboxId);
    await fs.ensureDir(sandboxDir);
    
    // 安全配置
    const securityConfig = {
      enableSandbox: this.config.security.enableSandbox,
      contextIsolation: this.config.security.contextIsolation,
      nodeIntegration: this.config.security.nodeIntegration
    };
    
    return {
      id: sandboxId,
      directory: sandboxDir,
      security: securityConfig,
      runtime: this
    };
  }
  
  async destroySandbox(sandboxId) {
    const sandboxDir = path.join(this.workingDir, 'sandboxes', sandboxId);
    await fs.remove(sandboxDir);
  }
  
  // 简化的镜像源选择
  selectRegistry() {
    // 简化逻辑：优先使用中国镜像源
    return 'https://registry.npmmirror.com';
  }
}
```

#### 5.2.2 Node.js适配器 (继承公共基类)
```javascript
class NodeJSRuntimeProvider implements ICommandExecutor, IDependencyManager, ISandboxManager {
  constructor(config) {
    this.config = config;
    this.nodePath = config.runtime.nodePath;
    this.npmPath = config.runtime.npmPath;
    this.npxPath = config.runtime.npxPath;
    this.workingDir = config.runtime.workingDir;
    this.envVars = config.runtime.envVars || {};
  }
  
  async executeCommand(command, args, options = {}) {
    const security = this.config.security;
    
    // 安全检查
    if (security.blockedCommands.includes(command)) {
      throw new Error(`Command '${command}' is blocked by security policy`);
    }
    
    // 资源限制检查
    const limits = this.config.limits;
    const startTime = Date.now();
    
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        env: { ...this.envVars, ...options.env },
        cwd: options.cwd || this.workingDir,
        stdio: 'pipe'
      });
      
      // 超时控制
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timeout after ${limits.maxExecutionTime}ms`));
      }, limits.maxExecutionTime);
      
      // 收集输出
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code, stdout, stderr, duration: Date.now() - startTime });
      });
    });
  }
  
  async installDependencies(dependencies, targetDir) {
    const installArgs = ['install'];
    
    // 添加镜像源
    const registry = this.selectRegistry();
    if (registry) {
      installArgs.push(`--registry=${registry}`);
    }
    
    Object.entries(dependencies).forEach(([name, version]) => {
      installArgs.push(`${name}@${version}`);
    });
    
    return await this.executeCommand(this.npmPath, installArgs, {
      cwd: targetDir
    });
  }
  
  async createSandbox(toolConfig) {
    const sandboxId = `nodejs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sandboxDir = path.join(this.workingDir, 'sandboxes', sandboxId);
    await fs.ensureDir(sandboxDir);
    
    return {
      id: sandboxId,
      directory: sandboxDir,
      security: {
        enableSandbox: this.config.security.enableSandbox
      },
      runtime: this
    };
  }
  
  async destroySandbox(sandboxId) {
    const sandboxDir = path.join(this.workingDir, 'sandboxes', sandboxId);
    await fs.remove(sandboxDir);
  }
  
  selectRegistry() {
    // 简化的镜像源选择
    return 'https://registry.npmmirror.com';
  }
}
```

#### 5.2.3 Docker适配器 (增强安全配置)
```javascript
class DockerRuntimeProvider implements ICommandExecutor, IDependencyManager, ISandboxManager {
  constructor(config) {
    this.config = config;
    this.imageName = config.docker.imageName;
    this.nodePath = 'node';
    this.npmPath = 'npm';
    this.npxPath = 'npx';
  }
  
  async executeCommand(command, args, options = {}) {
    const security = this.config.security;
    
    // 构建Docker命令
    const dockerArgs = [
      'run', '--rm',
      '--memory=' + this.config.limits.maxMemory,
      '--cpus=0.5', // 限制CPU使用
      '--read-only', // 只读文件系统
      '--tmpfs /tmp',
      '--user=node', // 非root用户
      '--security-opt=no-new-privileges',
      `--network=${this.config.docker.networkMode || 'bridge'}`
    ];
    
    // 卷挂载
    if (this.config.docker.volumeMounts) {
      this.config.docker.volumeMounts.forEach(mount => {
        dockerArgs.push('-v', mount);
      });
    }
    
    // 安全配置
    if (security.dropCapabilities) {
      security.dropCapabilities.forEach(cap => {
        dockerArgs.push(`--cap-drop=${cap}`);
      });
    }
    
    dockerArgs.push(this.imageName, command, ...args);
    
    return await new Promise((resolve, reject) => {
      const docker = spawn('docker', dockerArgs, { stdio: 'pipe' });
      
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        docker.kill('SIGTERM');
        reject(new Error('Docker command timeout'));
      }, this.config.limits.maxExecutionTime);
      
      let stdout = '';
      let stderr = '';
      
      docker.stdout.on('data', (data) => stdout += data.toString());
      docker.stderr.on('data', (data) => stderr += data.toString());
      
      docker.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code, stdout, stderr, duration: Date.now() - startTime });
      });
    });
  }
  
  async installDependencies(dependencies, targetDir) {
    const installArgs = ['install'];
    
    Object.entries(dependencies).forEach(([name, version]) => {
      installArgs.push(`${name}@${version}`);
    });
    
    return await this.executeCommand(this.npmPath, installArgs);
  }
  
  async createSandbox(toolConfig) {
    const sandboxId = `docker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: sandboxId,
      directory: '/app/workspace',
      security: {
        enableSandbox: true,
        readOnlyRoot: this.config.security.readOnlyRoot,
        user: 'node'
      },
      runtime: this
    };
  }
  
  async destroySandbox(sandboxId) {
    // Docker容器自动清理，无需手动销毁
  }
}
```

### 5.3 依赖管理方案

#### 5.3.1 镜像源配置 (YAGNI原则简化)
- **要求**: 使用统一的镜像源配置，简化复杂度
- **默认镜像源**: https://registry.npmmirror.com（中国用户优化）
- **备选镜像源**: https://registry.npmjs.org（备用方案）
- **目的**: 避免因网络问题导致依赖安装卡顿
- **实现**: 在适配器中直接配置，避免复杂的地理位置检测

#### 5.3.2 运行时工具使用
- **要求**: 使用注入的 node、npm、npx 路径
- **目的**: 确保环境一致性，避免使用系统默认工具
- **实现**: 通过RuntimeProvider统一管理工具路径

### 5.4 工具加载与执行流程

#### 5.4.1 工具加载流程
1. 扫描工具目录，识别符合命名规范的工具文件
2. 加载工具模块，验证接口实现
3. 获取工具元数据和运行时需求
4. 根据运行时需求选择合适的适配器
5. 注册工具到工具注册表

#### 5.4.2 工具执行流程
1. 接收工具执行请求
2. 从进程池获取可用工作进程
3. 在隔离环境中安装工具依赖
4. 执行工具逻辑
5. 收集执行结果并清理环境
6. 回收工作进程到进程池

## 6. 配置管理

### 6.1 运行时配置结构

#### 6.1.1 基础配置文件 (base-config.yml)
```yaml
# 基础配置模板，支持继承
base:
  # 通用运行时配置
  runtime:
    timeout: 30000
    maxMemory: "512MB"
    maxFileSize: "10MB"
    
  # 进程池基础配置
  processPool:
    maxWorkers: 4
    minWorkers: 1
    warmupWorkers: 2
    maxIdleTime: 300000  # 5分钟
    healthCheckInterval: 30000  # 30秒
    recycleThreshold: 100
    
  # 基础安全配置
  security:
    enableSandbox: true
    allowedDomains: ["registry.npmjs.org", "registry.npmmirror.com"]
    blockedCommands: ["rm", "sudo", "chmod", "kill", "reboot"]
    fileAccessWhitelist: ["./workspace", "./temp"]
    blockedModules: ["fs", "child_process", "cluster"]
    
  # 资源限制
  limits:
    maxCPU: "50%"
    maxMemory: "512MB"
    maxExecutionTime: 30000
    maxNetworkRequests: 10

# 日志配置
logging:
  level: "info"
  file: "./logs/toolx.log"
  maxFileSize: "10MB"
  maxFiles: 5

# 性能监控配置
performance:
  metrics:
    enabled: true
    interval: 60000  # 1分钟
    retention: 86400000  # 24小时
  alerts:
    memoryThreshold: 80  # 80%
    cpuThreshold: 90     # 90%
    responseTimeThreshold: 5000  # 5秒
```

#### 6.1.2 场景配置示例 (配置继承)

**Electron场景配置 (scenarios/electron.yml)**
```yaml
# 继承基础配置
extends: "../base-config.yml"

scenario: "electron"
description: "Electron环境配置"

# 仅覆盖差异部分
runtime:
  nodePath: "${ELECTRON_RESOURCES}/node"
  npmPath: "${ELECTRON_RESOURCES}/npm"
  npxPath: "${ELECTRON_RESOURCES}/npx"
  workingDir: "${ELECTRON_USER_DATA}/toolx-workspace"
  envVars:
    ELECTRON_RUN_AS_NODE: "1"
    NODE_ENV: "production"

processPool:
  type: "utility-process"
  maxWorkers: 2  # Electron中建议较少worker

# Electron特定的安全配置
security:
  contextIsolation: true
  nodeIntegration: false
  enableRemoteModule: false
```

**Node.js场景配置 (scenarios/nodejs.yml)**
```yaml
# 继承基础配置
extends: "../base-config.yml"

scenario: "nodejs"
description: "标准Node.js环境配置"

runtime:
  nodePath: "node"
  npmPath: "npm"
  npxPath: "npx"
  workingDir: "./workspace"
  envVars:
    NODE_ENV: "development"

processPool:
  type: "child-process"
  maxWorkers: 4
  minWorkers: 1

# Node.js环境的安全配置
security:
  enableSandbox: false  # 使用Child Process隔离
```

**Docker场景配置 (scenarios/docker.yml)**
```yaml
# 继承基础配置
extends: "../base-config.yml"

scenario: "docker"
description: "Docker容器环境配置"

runtime:
  nodePath: "node"  # 容器内路径
  npmPath: "npm"
  npxPath: "npx"
  workingDir: "/app/workspace"
  envVars:
    NODE_ENV: "production"

docker:
  imageName: "node:18-alpine"
  networkMode: "bridge"
  volumeMounts:
    - "${HOST_WORKSPACE}:/app/workspace"

processPool:
  type: "docker-container"
  maxWorkers: 6  # Docker可以支持更多容器

# Docker特定的安全配置
security:
  readOnlyRoot: false
  dropCapabilities: ["ALL"]
  addCapabilities: []
  user: "node"  # 非root用户运行
```

### 6.2 配置注入机制

#### 6.2.1 配置加载器 (支持继承)

```javascript
class ConfigLoader {
  static configCache = new Map();
  
  /**
   * 加载场景配置（支持继承）
   * @param {string} scenarioName - 场景名称
   * @returns {Promise<object>} 合并后的配置
   */
  static async loadScenario(scenarioName) {
    const cacheKey = `scenario_${scenarioName}`;
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }
    
    const scenarioConfig = await this.loadYAML(`scenarios/${scenarioName}.yml`);
    let finalConfig = {};
    
    // 处理配置继承
    if (scenarioConfig.extends) {
      const baseConfig = await this.loadYAML(scenarioConfig.extends);
      finalConfig = this.deepMerge(baseConfig, scenarioConfig);
    } else {
      finalConfig = scenarioConfig;
    }
    
    // 环境变量替换
    finalConfig = this.replaceEnvVars(finalConfig);
    
    // 配置验证
    this.validateConfig(finalConfig);
    
    this.configCache.set(cacheKey, finalConfig);
    return finalConfig;
  }
  
  /**
   * 深度合并配置对象
   * @param {object} base - 基础配置
   * @param {object} override - 覆盖配置
   * @returns {object} 合并后的配置
   */
  static deepMerge(base, override) {
    const result = { ...base };
    
    for (const key in override) {
      if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.deepMerge(result[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    
    return result;
  }
  
  /**
   * 配置验证
   * @param {object} config - 配置对象
   */
  static validateConfig(config) {
    const required = ['runtime', 'processPool', 'security'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }
    
    // 验证进程池配置
    if (config.processPool.maxWorkers < 1 || config.processPool.maxWorkers > 10) {
      throw new Error('maxWorkers must be between 1 and 10');
    }
    
    // 验证安全配置
    if (config.security.allowedDomains && !Array.isArray(config.security.allowedDomains)) {
      throw new Error('allowedDomains must be an array');
    }
  }
  
  /**
   * 清除配置缓存
   */
  static clearCache() {
    this.configCache.clear();
  }
}
```

#### 6.2.2 环境变量替换 (简化版)
```javascript
class EnvReplacer {
  static replaceEnvVars(config) {
    const jsonStr = JSON.stringify(config);
    const replaced = jsonStr.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
    return JSON.parse(replaced);
  }
}
```

### 6.3 配置验证

#### 6.3.1 配置Schema定义
```javascript
const configSchema = {
  type: "object",
  required: ["runtime", "processPool"],
  properties: {
    runtime: {
      type: "object",
      required: ["nodePath", "npmPath", "workingDir"],
      properties: {
        nodePath: { type: "string" },
        npmPath: { type: "string" },
        npxPath: { type: "string" },
        workingDir: { type: "string" },
        envVars: { type: "object" }
      }
    },
    processPool: {
      type: "object",
      required: ["type", "maxWorkers"],
      properties: {
        type: { enum: ["child-process", "utility-process", "docker-container"] },
        maxWorkers: { type: "number", minimum: 1, maximum: 10 }
      }
    }
  }
};
```

## 7. 实现计划

### 7.1 第一阶段：核心抽象层搭建
- **时间**: 2-3周
- **任务**:
  - 创建RuntimeProvider抽象接口
  - 实现进程池管理模块
  - 设计工具加载器和注册表
  - 实现配置加载和验证机制

### 7.2 第二阶段：场景适配器实现
- **时间**: 2-3周
- **任务**:
  - 实现Electron适配器（UtilityProcess）
  - 实现Node.js适配器（Child Process）
  - 实现Docker适配器（容器）
  - 设计配置注入机制

### 7.3 第三阶段：沙箱核心功能
- **时间**: 3-4周
- **任务**:
  - 实现动态依赖安装
  - 完善错误处理和超时机制
  - 添加日志和监控功能
  - 实现工具枚举和发现机制
  - 实现单测验证机制

### 7.4 第四阶段：优化与扩展
- **时间**: 2-3周
- **任务**:
  - 性能优化和进程池调优
  - 安全性增强和权限控制
  - 支持更多场景适配器
  - 完善测试用例和验证机制
  - 编写完整的文档和示例

## 8. 风险评估

### 8.1 技术风险
- **沙箱逃逸风险**: 实现多层隔离机制，定期更新沙箱库
- **性能问题**: 实现沙箱池化复用，监控资源使用情况
- **依赖冲突**: 每个工具使用独立的 node_modules
- **接口复杂性**: 通过专一接口设计降低复杂度
- **配置管理**: 通过继承机制减少重复配置

### 8.2 项目风险
- **开发周期**: 合理分配开发任务，优先完成核心功能
- **测试覆盖**: 建立全面的测试体系，确保质量
- **安全风险**: 增强安全配置，细化权限控制

### 8.3 缓解措施
- **代码质量**: 遵循SOLID原则，确保代码可维护性
- **性能监控**: 实现详细的性能指标收集
- **安全审计**: 定期进行安全漏洞扫描

## 9. 质量要求

### 9.1 测试要求
- 单元测试覆盖率 > 80%
- 集成测试覆盖核心功能
- 性能测试验证系统响应时间
- 安全测试验证沙箱隔离性
- **场景适配测试**：验证在不同运行时环境下的兼容性
- **配置注入测试**：验证配置加载和环境变量替换功能
- **进程池测试**：验证进程创建、销毁和回收机制

### 9.2 文档要求
- 详细的设计文档
- 完整的 API 文档
- 清晰的使用示例
- 故障排除指南
- **场景配置指南**：不同环境的配置说明
- **适配器开发指南**：如何开发新的场景适配器
- **最佳实践文档**：工具开发和部署的最佳实践

## 10. 验收标准

### 10.1 功能验收
- 所有核心功能正常运行
- 工具可正常执行并返回预期结果
- 依赖可正常安装和使用
- 工具间完全隔离无相互影响
- **运行时注入功能**：可成功注入不同场景的运行时配置
- **适配器切换功能**：可无缝切换不同场景适配器
- **配置加载功能**：可正确加载和验证配置文件

### 10.2 性能验收
- 沙箱创建和销毁时间满足要求
- 并发执行无资源冲突
- 内存使用合理
- **进程池性能**：进程复用率 > 70%，创建时间 < 500ms
- **配置加载性能**：配置加载时间 < 100ms
- **适配器切换性能**：场景切换时间 < 50ms

### 10.3 安全验收
- 无沙箱逃逸漏洞
- 文件系统访问权限控制正常
- 资源使用限制生效
- **配置安全**：敏感信息不会被泄露到配置文件中
- **环境隔离**：不同场景的环境变量完全隔离
- **权限控制**：工具只能访问授权的资源

### 10.4 通用性验收
- **Electron场景**：可在Electron环境中正常运行
- **Node.js场景**：可在标准Node.js环境中正常运行
- **Docker场景**：可在Docker容器中正常运行
- **配置兼容性**：现有配置文件向后兼容
- **接口一致性**：不同场景下的API接口保持一致

## 11. 后续计划

### 11.1 持续优化
- 根据使用反馈持续优化性能
- 增加更多安全防护措施
- 扩展沙箱功能
- **适配器生态**：支持更多运行时环境（Kubernetes、Serverless等）
- **配置模板库**：提供更多场景的配置模板
- **性能监控**：增加详细的性能指标监控

### 11.2 维护计划
- 定期更新依赖包
- 监控系统运行状态
- 及时处理安全漏洞
- **配置版本管理**：支持配置文件的版本控制和回滚
- **兼容性维护**：保持与不同Node.js版本的兼容性
- **文档更新**：及时更新文档和示例

### 11.3 扩展方向
- **可视化配置**：提供Web界面进行配置管理
- **工具市场**：建立工具分享和发现机制
- **插件系统**：支持第三方适配器插件
- **云原生支持**：支持Kubernetes等云原生环境