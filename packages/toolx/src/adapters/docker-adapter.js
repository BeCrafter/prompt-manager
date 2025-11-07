/**
 * Docker运行时适配器 - 为Docker环境提供沙箱支持
 * 通过Docker容器提供最高级别的隔离
 */

import { spawn } from 'child_process';
import { ICommandExecutor } from '../core/interfaces/command-executor.js';
import { IDependencyManager } from '../core/interfaces/dependency-manager.js';
import { ISandboxManager } from '../core/interfaces/sandbox-manager.js';
import { BaseProcessPool } from '../core/base/process-pool.js';
import { SecurityPolicyValidator, SecurityError } from '../security/policy-validator.js';
import { ResourceLimiter, ResourceTracker } from '../security/resource-limiter.js';

class DockerRuntimeProvider {
  constructor(config) {
    
    this.config = config;
    this.runtime = config.runtime;
    this.security = config.security;
    this.limits = config.limits;
    this.docker = config.docker;
    
    // 验证Docker环境
    this.validateDockerEnvironment();
    
    // 初始化安全验证器
    this.securityValidator = new SecurityPolicyValidator(this.security);
    
    // 初始化资源限制器
    this.resourceLimiter = new ResourceLimiter(this.limits);
    
    // 进程池
    this.processPool = null;
    
    // 沙箱管理
    this.sandboxes = new Map();
    
    // 统计信息
    this.stats = {
      totalCommands: 0,
      totalDependencies: 0,
      totalSandboxes: 0,
      activeSandboxes: 0
    };
  }
  
  /**
   * 验证Docker环境
   */
  async validateDockerEnvironment() {
    try {
      // 检查Docker是否可用
      const result = await this.executeDockerCommand(['--version']);
      if (result.code !== 0) {
        throw new Error('Docker is not available or not properly configured');
      }
      
      this.dockerVersion = result.stdout.trim();
      
      // 验证运行时需求
      if (this.config.runtimeRequirements) {
        const result = this.securityValidator.validateRuntimeRequirements(this.config.runtimeRequirements);
        if (!result.valid) {
          throw new Error(`Runtime requirements validation failed: ${result.errors.join(', ')}`);
        }
      }
    } catch (error) {
      throw new Error(`Docker environment validation failed: ${error.message}`);
    }
  }
  
  /**
   * 初始化进程池
   */
  async initialize() {
    if (this.processPool) {
      return;
    }
    
    this.processPool = new DockerProcessPool(this, {
      maxWorkers: this.config.processPool.maxWorkers,
      minWorkers: this.config.processPool.minWorkers,
      warmupWorkers: this.config.processPool.warmupWorkers,
      maxIdleTime: this.config.processPool.maxIdleTime,
      healthCheckInterval: this.config.processPool.healthCheckInterval
    });
    
    await this.processPool.initialize();
  }
  
  // ICommandExecutor 接口实现
  
  /**
   * 执行命令
   * @param {string} command - 命令名称
   * @param {string[]} args - 命令参数
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 执行结果
   */
  async executeCommand(command, args, options = {}) {
    await this.initialize();
    
    const startTime = Date.now();
    let worker = null;
    let resourceTracker = null;
    
    try {
      // 安全验证
      this.securityValidator.validateCommand(command, args);
      
      // 获取工作进程
      worker = await this.processPool.acquireWorker(command);
      
      // 创建资源跟踪器
      resourceTracker = this.resourceLimiter.createResourceTracker(worker.id);
      
      // 构建Docker命令
      const dockerArgs = this.buildDockerCommand(command, args, options);
      
      // 执行命令
      const result = await this.executeDockerCommand(dockerArgs, options);
      
      // 记录统计
      this.stats.totalCommands++;
      const duration = Date.now() - startTime;
      
      return {
        ...result,
        duration,
        workerId: worker.id,
        success: result.code === 0
      };
      
    } catch (error) {
      // 记录错误
      if (resourceTracker) {
        resourceTracker.recordError(command, error);
      }
      
      throw error;
    } finally {
      // 清理资源
      if (worker) {
        this.processPool.releaseWorker(worker.id);
      }
      
      if (resourceTracker) {
        this.resourceLimiter.destroyResourceTracker(worker.id);
      }
    }
  }
  
  /**
   * 构建Docker命令
   * @param {string} command - 命令名称
   * @param {string[]} args - 命令参数
   * @param {object} options - 执行选项
   * @returns {string[]} Docker命令参数
   */
  buildDockerCommand(command, args, options) {
    const dockerArgs = [
      'run', '--rm',
      '--memory=' + this.formatMemory(this.limits.maxMemory),
      '--cpus=' + (this.limits.maxCPU / 100).toFixed(2),
      '--read-only',
      '--tmpfs /tmp',
      '--security-opt=no-new-privileges'
    ];
    
    // 用户配置
    if (this.security.user) {
      dockerArgs.push('--user=' + this.security.user);
    }
    
    // 网络配置
    if (this.docker.networkMode) {
      dockerArgs.push('--network=' + this.docker.networkMode);
    }
    
    // 卷挂载
    if (this.docker.volumeMounts) {
      this.docker.volumeMounts.forEach(mount => {
        dockerArgs.push('-v', mount);
      });
    }
    
    // 工作目录挂载
    const workDir = options.cwd || this.runtime.workingDir;
    dockerArgs.push('-v', `${workDir}:/app/workspace`);
    dockerArgs.push('-w', '/app/workspace');
    
    // 安全配置
    if (this.security.dropCapabilities) {
      this.security.dropCapabilities.forEach(cap => {
        dockerArgs.push(`--cap-drop=${cap}`);
      });
    }
    
    // 镜像和命令
    dockerArgs.push(this.docker.imageName);
    dockerArgs.push(command, ...args);
    
    return dockerArgs;
  }
  
  /**
   * 执行Docker命令
   * @param {string[]} args - Docker命令参数
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 执行结果
   */
  async executeDockerCommand(args, options = {}) {
    return await new Promise((resolve, reject) => {
      const child = spawn('docker', args, { stdio: 'pipe' });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr
        });
      });
      
      child.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  // IDependencyManager 接口实现
  
  /**
   * 安装依赖
   * @param {object} dependencies - 依赖配置
   * @param {string} targetDir - 目标目录
   * @returns {Promise<object>} 安装结果
   */
  async installDependencies(dependencies, targetDir) {
    await this.initialize();
    
    const startTime = Date.now();
    
    try {
      // 验证依赖配置
      if (!dependencies || Object.keys(dependencies).length === 0) {
        return { success: true, installed: [], duration: 0 };
      }
      
      // 构建安装命令
      const installArgs = ['install'];
      
      // 添加具体依赖
      Object.entries(dependencies).forEach(([name, version]) => {
        installArgs.push(`${name}@${version}`);
      });
      
      // 执行安装
      const result = await this.executeCommand('npm', installArgs, {
        cwd: targetDir
      });
      
      // 解析安装结果
      const installed = this.parseNpmInstallOutput(result.stdout);
      const failed = this.parseNpmInstallErrors(result.stderr);
      
      this.stats.totalDependencies++;
      
      return {
        success: result.code === 0 && failed.length === 0,
        installed,
        failed,
        duration: Date.now() - startTime,
        output: result.stdout
      };
      
    } catch (error) {
      throw new Error(`Dependency installation failed: ${error.message}`);
    }
  }
  
  /**
   * 检查依赖状态
   * @param {string} targetDir - 目标目录
   * @returns {Promise<DependencyStatus>} 依赖状态
   */
  async checkDependencies(targetDir) {
    try {
      // 在Docker环境中检查依赖状态 - 简化版实现
      // 执行npm ls命令检查依赖是否安装
      const result = await this.executeCommand('npm', ['ls', '--depth=0'], {
        cwd: targetDir
      });
      
      const lines = result.stdout.split('\n');
      const installed = {};
      const missing = [];
      const outdated = [];
      
      // 解析npm ls输出
      for (const line of lines) {
        if (line.includes('deduped') || line.includes('empty')) {
          continue;
        }
        
        const match = line.match(/├── ([^@]+)@(.+)/);
        if (match) {
          installed[match[1]] = match[2];
        }
      }
      
      return {
        satisfied: Object.keys(installed).length > 0,
        installed,
        missing,
        outdated
      };
    } catch (error) {
      // 如果npm ls失败，返回基本信息
      return {
        satisfied: false,
        installed: {},
        missing: ['unknown'],
        outdated: []
      };
    }
  }
  
  /**
   * 卸载依赖
   * @param {string[]} packages - 要卸载的包名
   * @param {string} targetDir - 目标目录
   * @returns {Promise<UninstallResult>} 卸载结果
   */
  async uninstallDependencies(packages, targetDir) {
    if (!packages || packages.length === 0) {
      return { success: true, uninstalled: [], failed: [], duration: 0 };
    }
    
    const startTime = Date.now();
    
    try {
      // 构建卸载命令
      const uninstallArgs = ['uninstall', ...packages];
      
      // 执行卸载
      const result = await this.executeCommand('npm', uninstallArgs, {
        cwd: targetDir
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: result.code === 0,
        uninstalled: result.code === 0 ? packages : [],
        failed: result.code !== 0 ? packages : [],
        duration
      };
    } catch (error) {
      throw new Error(`Dependency uninstallation failed: ${error.message}`);
    }
  }
  
  /**
   * 解析npm安装输出
   * @param {string} output - npm输出
   * @returns {string[]} 已安装的包列表
   */
  parseNpmInstallOutput(output) {
    const installed = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/added (\d+) package/);
      if (match) {
        installed.push(`npm-installed-${Date.now()}`);
      }
    }
    
    return installed;
  }
  
  /**
   * 解析npm安装错误
   * @param {string} output - 错误输出
   * @returns {string[]} 失败的包列表
   */
  parseNpmInstallErrors(output) {
    const failed = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('ERR!') || line.includes('error')) {
        failed.push(line.trim());
      }
    }
    
    return failed;
  }
  
  // ISandboxManager 接口实现
  
  /**
   * 创建沙箱
   * @param {object} config - 沙箱配置
   * @returns {Promise<object>} 沙箱实例
   */
  async createSandbox(config) {
    const sandboxId = `docker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 创建沙箱实例
      const sandbox = {
        id: sandboxId,
        directory: '/app/workspace',
        security: {
          enableSandbox: true,
          readOnlyRoot: this.security.readOnlyRoot || false,
          user: this.security.user || 'node'
        },
        runtime: this,
        config,
        createdAt: new Date(),
        status: 'ready'
      };
      
      // 存储沙箱
      this.sandboxes.set(sandboxId, sandbox);
      this.stats.totalSandboxes++;
      this.stats.activeSandboxes++;
      
      return sandbox;
      
    } catch (error) {
      throw new Error(`Sandbox creation failed: ${error.message}`);
    }
  }
  
  /**
   * 销毁沙箱
   * @param {string} sandboxId - 沙箱ID
   * @returns {Promise<void>}
   */
  async destroySandbox(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox '${sandboxId}' not found`);
    }
    
    // Docker容器自动清理，只需移除引用
    this.sandboxes.delete(sandboxId);
    this.stats.activeSandboxes--;
  }
  
  /**
   * 获取沙箱状态
   * @param {string} sandboxId - 沙箱ID
   * @returns {Promise<object>} 沙箱状态
   */
  async getSandboxStatus(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox '${sandboxId}' not found`);
    }
    
    return {
      id: sandbox.id,
      status: 'ready', // Docker容器状态由Docker管理
      directory: sandbox.directory,
      createdAt: sandbox.createdAt,
      uptime: Date.now() - sandbox.createdAt.getTime()
    };
  }
  
  /**
   * 列出所有沙箱
   * @returns {Promise<object[]>} 沙箱列表
   */
  async listSandboxes() {
    const sandboxes = [];
    
    for (const sandbox of this.sandboxes.values()) {
      const status = await this.getSandboxStatus(sandbox.id);
      sandboxes.push(status);
    }
    
    return sandboxes;
  }
  
  // 辅助方法
  
  /**
   * 格式化内存大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化的内存字符串
   */
  formatMemory(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size)}${units[unitIndex]}`;
  }
  
  /**
   * 验证工具运行时需求
   * @param {object} toolRuntimeRequirements - 工具运行时需求
   * @returns {Promise<object>} 验证结果
   */
  async validateToolRuntimeRequirements(toolRuntimeRequirements) {
    if (!toolRuntimeRequirements) {
      return { valid: true, errors: [] };
    }
    
    return this.securityValidator.validateRuntimeRequirements(toolRuntimeRequirements);
  }

  /**
   * 获取适配器统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      environment: {
        dockerVersion: this.dockerVersion,
        imageName: this.docker.imageName,
        networkMode: this.docker.networkMode
      },
      processPool: this.processPool ? this.processPool.getStatus() : null,
      security: this.securityValidator.getSecurityStats(),
      resources: this.resourceLimiter.getGlobalStats()
    };
  }
  
  /**
   * 关闭适配器
   * @returns {Promise<void>}
   */
  async shutdown() {
    // 销毁所有沙箱
    const sandboxIds = Array.from(this.sandboxes.keys());
    for (const sandboxId of sandboxIds) {
      await this.destroySandbox(sandboxId);
    }
    
    // 关闭进程池
    if (this.processPool) {
      await this.processPool.shutdown();
    }
    
    // 清理资源限制器
    this.resourceLimiter.cleanup();
  }
}

/**
 * Docker进程池实现
 */
class DockerProcessPool extends BaseProcessPool {
  constructor(runtimeProvider, options) {
    super(runtimeProvider, options);
  }
  
  /**
   * 创建工作进程
   * @param {string} workerId - 工作进程ID
   * @returns {Promise<object>} 工作进程
   */
  async doCreateWorker(workerId) {
    const worker = {
      id: workerId,
      process: null,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isHealthy: true
    };
    
    // 创建测试容器
    const testArgs = ['run', '--rm', this.runtimeProvider.docker.imageName, 'node', '--version'];
    
    worker.process = spawn('docker', testArgs, { stdio: 'pipe' });
    
    // 监听进程事件
    worker.process.on('exit', (code) => {
      worker.isHealthy = code === 0;
    });
    
    worker.process.on('error', (error) => {
      worker.isHealthy = false;
    });
    
    // 等待容器启动
    await new Promise((resolve) => {
      worker.process.on('exit', resolve);
      worker.process.on('error', resolve);
      
      // 设置超时
      setTimeout(() => {
        resolve();
      }, 5000);
    });
    
    return worker;
  }
  
  /**
   * 检查进程健康状态
   * @param {object} worker - 工作进程
   * @returns {Promise<boolean>} 是否健康
   */
  async isWorkerHealthy(worker) {
    return worker.isHealthy && worker.process && !worker.process.killed;
  }
  
  /**
   * 销毁工作进程
   * @param {object} worker - 工作进程
   * @returns {Promise<void>}
   */
  async doDestroyWorker(worker) {
    if (worker.process) {
      worker.process.kill();
      worker.process = null;
    }
    worker.isHealthy = false;
  }
}

export {
  DockerRuntimeProvider
};