/**
 * Electron运行时适配器 - 为Electron环境提供沙箱支持
 * 利用Electron内置的Node.js运行时，避免依赖系统Node.js
 * 通过UtilityProcess提供更安全的进程隔离
 */

import { ICommandExecutor } from '../core/interfaces/command-executor.js';
import { IDependencyManager } from '../core/interfaces/dependency-manager.js';
import { ISandboxManager } from '../core/interfaces/sandbox-manager.js';
import { BaseProcessPool } from '../core/base/process-pool.js';
import { SecurityPolicyValidator, SecurityError } from '../security/policy-validator.js';
import { ResourceLimiter, ResourceTracker } from '../security/resource-limiter.js';
import fs from 'fs';

class ElectronRuntimeProvider {
  constructor(config) {
    
    this.config = config;
    this.runtime = config.runtime;
    this.security = config.security;
    this.limits = config.limits;
    
    // 验证必需的Electron环境
    this.validateElectronEnvironment();
    
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
   * 验证Electron环境
   */
  async validateElectronEnvironment() {
    try {
      // 检查是否在Electron环境中运行
      if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
        this.electronVersion = process.versions.electron;
        this.nodeVersion = process.versions.node;
      } else {
        throw new Error('Not running in Electron environment');
      }
      
      // 检查是否支持UtilityProcess
      let utilityProcess;
      try {
        const electronModule = await import('electron');
        utilityProcess = electronModule.utilityProcess;
      } catch (error) {
        throw new Error('Electron is not available in this environment');
      }
      
      if (!utilityProcess) {
        throw new Error('UtilityProcess is not available in this Electron version');
      }
      
      // 验证运行时需求
      if (this.config.runtimeRequirements) {
        const result = this.securityValidator.validateRuntimeRequirements(this.config.runtimeRequirements);
        if (!result.valid) {
          throw new Error(`Runtime requirements validation failed: ${result.errors.join(', ')}`);
        }
      }
    } catch (error) {
      throw new Error(`Electron environment validation failed: ${error.message}`);
    }
  }
  
  /**
   * 初始化进程池
   */
  async initialize() {
    if (this.processPool) {
      return;
    }
    
    this.processPool = new ElectronProcessPool(this, {
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
      
      // 设置超时
      const timeout = this.resourceLimiter.createTimeout(() => {
        throw new Error(`Command execution timeout: ${command}`);
      }, options.timeout || this.limits.maxExecutionTime);
      
      // 执行命令
      const result = await this.executeInUtilityProcess(worker, command, args, options);
      
      // 清理超时
      clearTimeout(timeout);
      
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
   * 在UtilityProcess中执行命令
   * @param {object} worker - 工作进程
   * @param {string} command - 命令名称
   * @param {string[]} args - 命令参数
   * @param {object} options - 执行选项
   * @returns {Promise<object>} 执行结果
   */
  async executeInUtilityProcess(worker, command, args, options) {
    // 动态导入electron模块获取utilityProcess
    const electronModule = await import('electron');
    const utilityProcess = electronModule.utilityProcess;
    
    const execOptions = {
      env: { ...this.runtime.envVars, ...options.env },
      cwd: options.cwd || this.runtime.workingDir,
      stdio: 'pipe'
    };
    
    return await new Promise((resolve, reject) => {
      const child = utilityProcess.fork(
        this.runtime.nodePath,
        [command, ...args],
        execOptions
      );
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('exit', (code) => {
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
      
      // 添加镜像源
      const registry = this.selectRegistry();
      if (registry) {
        installArgs.push(`--registry=${registry}`);
      }
      
      // 添加具体依赖
      Object.entries(dependencies).forEach(([name, version]) => {
        installArgs.push(`${name}@${version}`);
      });
      
      // 执行安装
      const result = await this.executeCommand(this.runtime.npmPath, installArgs, {
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
      // 检查 node_modules 目录是否存在
      const fs = require('fs').promises;
      const nodeModulesPath = `${targetDir}/node_modules`;
      
      let installed = {};
      let missing = [];
      let outdated = [];
      
      try {
        await fs.access(nodeModulesPath);
        
        // 尝试读取 package.json 和 package-lock.json
        const packagePath = `${targetDir}/package.json`;
        const lockPath = `${targetDir}/package-lock.json`;
        
        try {
          const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
          
          // 简单的检查，实际实现可能需要更复杂的逻辑
          for (const [name, version] of Object.entries(dependencies)) {
            try {
              const depPath = `${nodeModulesPath}/${name}/package.json`;
              await fs.access(depPath);
              installed[name] = version;
            } catch (error) {
              missing.push(name);
            }
          }
        } catch (error) {
          // 如果没有 package.json 或 package-lock.json，返回基本信息
          installed = { basic: 'check completed' };
        }
      } catch (error) {
        // node_modules 不存在，所有依赖都缺失
        missing = ['all'];
      }
      
      return {
        satisfied: missing.length === 0,
        installed,
        missing,
        outdated
      };
    } catch (error) {
      throw new Error(`Dependency check failed: ${error.message}`);
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
      const result = await this.executeCommand(this.runtime.npmPath, uninstallArgs, {
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
        // 简化处理，实际应该解析具体的包名
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
        // 简化处理，实际应该解析具体的包名
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
    const sandboxId = `electron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 创建安全的工作目录
      const workDir = this.securityValidator.createSecureWorkingDirectory(
        this.runtime.workingDir,
        config.toolName || 'unknown'
      );
      
      // 创建沙箱实例
      const sandbox = {
        id: sandboxId,
        directory: workDir,
        security: {
          enableSandbox: this.security.enableSandbox,
          contextIsolation: this.security.contextIsolation,
          nodeIntegration: this.security.nodeIntegration
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
    
    try {
      // 清理工作目录
      await fs.promises.rmdir(sandbox.directory, { recursive: true });
      
      // 移除沙箱
      this.sandboxes.delete(sandboxId);
      this.stats.activeSandboxes--;
      
    } catch (error) {
      // 记录错误但不抛出，确保沙箱被移除
      console.error(`Error cleaning up sandbox '${sandboxId}':`, error.message);
      this.sandboxes.delete(sandboxId);
      this.stats.activeSandboxes--;
    }
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
    
    let exists = false;
    
    try {
      await fs.promises.access(sandbox.directory);
      exists = true;
    } catch {
      exists = false;
    }
    
    return {
      id: sandbox.id,
      status: exists ? 'ready' : 'error',
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
   * 选择镜像源
   * @returns {string} 镜像源URL
   */
  selectRegistry() {
    // 简化逻辑：优先使用中国镜像源
    return 'https://registry.npmmirror.com';
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
        electronVersion: this.electronVersion,
        nodeVersion: this.nodeVersion
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
 * Electron进程池实现
 */
class ElectronProcessPool extends BaseProcessPool {
  constructor(runtimeProvider, options) {
    super(runtimeProvider, options);
    // utilityProcess will be imported dynamically when needed
  }
  
  /**
   * 创建工作进程
   * @param {string} workerId - 工作进程ID
   * @returns {Promise<object>} 工作进程
   */
  async doCreateWorker(workerId) {
    // 动态导入electron模块获取utilityProcess
    const electronModule = await import('electron');
    const utilityProcess = electronModule.utilityProcess;
    
    const worker = {
      id: workerId,
      process: null,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isHealthy: true
    };
    
    // 创建UtilityProcess
    worker.process = utilityProcess.fork(
      this.runtimeProvider.runtime.nodePath,
      ['--version'], // 简单的测试命令
      {
        env: this.runtimeProvider.runtime.envVars,
        stdio: 'pipe'
      }
    );
    
    // 监听进程事件
    worker.process.on('exit', (code) => {
      worker.isHealthy = false;
    });
    
    worker.process.on('error', (error) => {
      worker.isHealthy = false;
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
  ElectronRuntimeProvider,
  ElectronProcessPool
};