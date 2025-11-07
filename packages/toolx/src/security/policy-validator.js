/**
 * 安全策略验证器 - 提供多层安全验证
 * 确保沙箱环境的安全性，防止恶意操作
 */

import fs from 'fs';
import path from 'path';

class SecurityPolicyValidator {
  constructor(securityConfig) {
    this.blockedCommands = securityConfig.blockedCommands || [];
    this.allowedDomains = securityConfig.allowedDomains || [];
    this.blockedModules = securityConfig.blockedModules || [];
    this.allowedPaths = securityConfig.fileAccessWhitelist || [];
    this.maxExecutionTime = securityConfig.maxExecutionTime || 30000;
    this.enableSandbox = securityConfig.enableSandbox !== false;
    
    // 安全统计
    this.stats = {
      totalValidations: 0,
      blockedCommands: 0,
      blockedNetworkRequests: 0,
      blockedModules: 0,
      blockedPaths: 0
    };
  }
  
  /**
   * 验证命令安全性
   * @param {string} command - 命令名称
   * @param {string[]} args - 命令参数
   * @returns {boolean} 是否安全
   * @throws {SecurityError} 如果命令被阻止
   */
  validateCommand(command, args = []) {
    this.stats.totalValidations++;
    
    // 检查阻止的命令
    if (this.blockedCommands.includes(command)) {
      this.stats.blockedCommands++;
      throw new SecurityError(`Command '${command}' is blocked by security policy`);
    }
    
    // 检查危险的命令组合
    const dangerousPatterns = [
      { pattern: /rm\s+-rf/i, description: 'dangerous file deletion' },
      { pattern: /sudo/i, description: 'privilege escalation' },
      { pattern: /chmod\s+777/i, description: 'excessive permission change' },
      { pattern: /curl.*\|.*sh/i, description: 'pipe to shell' },
      { pattern: /wget.*\|.*bash/i, description: 'download and execute' }
    ];
    
    const fullCommand = `${command} ${args.join(' ')}`;
    for (const { pattern, description } of dangerousPatterns) {
      if (pattern.test(fullCommand)) {
        this.stats.blockedCommands++;
        throw new SecurityError(`Command blocked: ${description}`);
      }
    }
    
    return true;
  }
  
  /**
   * 验证网络请求
   * @param {string} url - 请求URL
   * @param {string} method - HTTP方法
   * @returns {boolean} 是否允许
   * @throws {SecurityError} 如果请求被阻止
   */
  validateNetworkRequest(url, method = 'GET') {
    this.stats.totalValidations++;
    
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname;
      
      // 检查域名白名单
      if (this.allowedDomains.length > 0 && !this.allowedDomains.includes(domain)) {
        this.stats.blockedNetworkRequests++;
        throw new SecurityError(`Network request to '${domain}' is not allowed`);
      }
      
      // 检查危险的协议
      const dangerousProtocols = ['file:', 'ftp:', 'gopher:'];
      if (dangerousProtocols.includes(parsedUrl.protocol)) {
        this.stats.blockedNetworkRequests++;
        throw new SecurityError(`Protocol '${parsedUrl.protocol}' is not allowed`);
      }
      
      // 检查本地地址
      if (this.isLocalAddress(parsedUrl.hostname)) {
        this.stats.blockedNetworkRequests++;
        throw new SecurityError(`Access to local address '${parsedUrl.hostname}' is not allowed`);
      }
      
      return true;
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      // URL解析错误
      this.stats.blockedNetworkRequests++;
      throw new SecurityError(`Invalid URL: ${url}`);
    }
  }
  
  /**
   * 验证模块加载
   * @param {string} moduleName - 模块名称
   * @returns {boolean} 是否允许
   * @throws {SecurityError} 如果模块被阻止
   */
  validateModule(moduleName) {
    this.stats.totalValidations++;
    
    // 检查阻止的模块
    if (this.blockedModules.includes(moduleName)) {
      this.stats.blockedModules++;
      throw new SecurityError(`Module '${moduleName}' is blocked by security policy`);
    }
    
    // 检查危险的系统模块
    const dangerousModules = [
      'fs', 'child_process', 'cluster', 'worker_threads',
      'vm', 'v8', 'inspector', 'debugger', 'repl'
    ];
    
    if (dangerousModules.includes(moduleName)) {
      this.stats.blockedModules++;
      throw new SecurityError(`System module '${moduleName}' access is blocked`);
    }
    
    return true;
  }
  
  /**
   * 验证文件路径访问
   * @param {string} filePath - 文件路径
   * @param {string} mode - 访问模式 ('read', 'write', 'execute')
   * @returns {boolean} 是否允许
   * @throws {SecurityError} 如果路径被阻止
   */
  validateFilePath(filePath, mode = 'read') {
    this.stats.totalValidations++;
    
    const normalizedPath = path.resolve(filePath);
    
    // 检查路径白名单
    if (this.allowedPaths.length > 0) {
      const isAllowed = this.allowedPaths.some(allowedPath => {
        const resolvedAllowed = path.resolve(allowedPath);
        return normalizedPath.startsWith(resolvedAllowed);
      });
      
      if (!isAllowed) {
        this.stats.blockedPaths++;
        throw new SecurityError(`Access to path '${normalizedPath}' is not allowed`);
      }
    }
    
    // 检查危险的路径模式
    const dangerousPaths = [
      /\/etc\//,           // 系统配置
      /\/proc\//,          // 进程信息
      /\/sys\//,           // 系统信息
      /\/dev\//,           // 设备文件
      /\/boot\//,          // 启动文件
      /\/root\//,          // root目录
      /\/home\/[^\/]+\/\.ssh\//, // SSH密钥
      /\/var\/log\//,      // 系统日志
      /\/tmp\/\.X11/       // X11套接字
    ];
    
    for (const pattern of dangerousPaths) {
      if (pattern.test(normalizedPath)) {
        this.stats.blockedPaths++;
        throw new SecurityError(`Access to system path '${normalizedPath}' is blocked`);
      }
    }
    
    // 检查写入权限的额外限制
    if (mode === 'write') {
      const writeRestrictedPaths = [
        /\.env$/,
        /\.config$/,
        /\.json$/,
        /\.js$/,
        /\.ts$/,
        /package\.json/,
        /yarn\.lock/,
        /package-lock\.json/
      ];
      
      for (const pattern of writeRestrictedPaths) {
        if (pattern.test(normalizedPath)) {
          this.stats.blockedPaths++;
          throw new SecurityError(`Write access to '${normalizedPath}' is blocked`);
        }
      }
    }
    
    return true;
  }
  
  /**
   * 验证执行时间限制
   * @param {number} startTime - 开始时间
   * @returns {boolean} 是否超时
   * @throws {SecurityError} 如果超时
   */
  validateExecutionTime(startTime) {
    const elapsed = Date.now() - startTime;
    if (elapsed > this.maxExecutionTime) {
      throw new SecurityError(`Execution timeout after ${elapsed}ms (limit: ${this.maxExecutionTime}ms)`);
    }
    return true;
  }
  
  /**
   * 验证环境变量
   * @param {object} envVars - 环境变量对象
   * @returns {boolean} 是否安全
   * @throws {SecurityError} 如果环境变量不安全
   */
  validateEnvironmentVariables(envVars) {
    const blockedEnvVars = [
      'PATH', 'HOME', 'USER', 'SHELL', 'EDITOR',
      'SSH_AUTH_SOCK', 'SSH_AGENT_PID', 'GNUPGHOME'
    ];
    
    const dangerousEnvPatterns = [
      /LD_PRELOAD/i,
      /LD_LIBRARY_PATH/i,
      /DYLD_INSERT_LIBRARIES/i,
      /NODE_OPTIONS/i
    ];
    
    for (const [key, value] of Object.entries(envVars)) {
      // 检查阻止的环境变量
      if (blockedEnvVars.includes(key)) {
        throw new SecurityError(`Environment variable '${key}' is not allowed`);
      }
      
      // 检查危险的环境变量模式
      for (const pattern of dangerousEnvPatterns) {
        if (pattern.test(key)) {
          throw new SecurityError(`Environment variable '${key}' matches dangerous pattern`);
        }
      }
      
      // 检查值中的危险内容
      if (typeof value === 'string') {
        if (value.includes('..') || value.includes('~')) {
          throw new SecurityError(`Environment variable '${key}' contains dangerous characters`);
        }
      }
    }
    
    return true;
  }
  
  /**
   * 创建安全的工作目录
   * @param {string} baseDir - 基础目录
   * @param {string} toolName - 工具名称
   * @returns {string} 安全的工作目录路径
   */
  createSecureWorkingDirectory(baseDir, toolName) {
    // 生成安全的目录名
    const safeToolName = toolName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirName = `${safeToolName}_${timestamp}_${random}`;
    
    const workDir = path.join(baseDir, 'workspaces', dirName);
    
    // 确保目录存在
    fs.mkdirSync(workDir, { recursive: true });
    
    // 设置目录权限（仅所有者可读写）
    try {
      fs.chmodSync(workDir, 0o700);
    } catch (error) {
      // 在某些系统上可能不支持chmod
    }
    
    return workDir;
  }
  
  /**
   * 检查是否为本地地址
   * @param {string} hostname - 主机名
   * @returns {boolean} 是否为本地地址
   */
  isLocalAddress(hostname) {
    const localAddresses = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0'
    ];
    
    if (localAddresses.includes(hostname)) {
      return true;
    }
    
    // 检查私有IP地址范围
    const privateIpRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // link-local
      /^fc00:/,       // IPv6 unique local
      /^fe80:/        // IPv6 link-local
    ];
    
    return privateIpRanges.some(range => range.test(hostname));
  }
  
  /**
   * 验证工具运行时需求
   * @param {object} runtimeRequirements - 运行时需求
   * @returns {Promise<object>} 验证结果
   */
  async validateRuntimeRequirements(runtimeRequirements) {
    this.stats.totalValidations++;
    
    const result = {
      valid: true,
      errors: []
    };
    
    // 验证Node.js版本
    if (runtimeRequirements.nodeVersion) {
      const nodeVersion = process.version;
      if (!this.satisfiesVersion(nodeVersion, runtimeRequirements.nodeVersion)) {
        result.errors.push(`Node.js version ${nodeVersion} does not satisfy requirement ${runtimeRequirements.nodeVersion}`);
      }
    }
    
    // 验证平台
    if (runtimeRequirements.platform && !runtimeRequirements.platform.includes(process.platform)) {
      result.errors.push(`Platform ${process.platform} is not supported`);
    }
    
    // 验证必需命令
    if (runtimeRequirements.requiredCommands) {
      for (const command of runtimeRequirements.requiredCommands) {
        if (!await this.commandExists(command)) {
          result.errors.push(`Required command '${command}' is not available`);
        }
      }
    }
    
    if (result.errors.length > 0) {
      result.valid = false;
      this.stats.blockedCommands++; // 计入阻止的命令统计
    }
    
    return result;
  }
  
  /**
   * 检查版本是否满足要求
   * @param {string} currentVersion - 当前版本
   * @param {string} requiredVersion - 要求版本（支持 >=14.0.0, >= 14.0.0, >14.0.0, > 14.0.0 等格式）
   * @returns {boolean} 是否满足要求
   */
  satisfiesVersion(currentVersion, requiredVersion) {
    // 解析当前版本
    const current = this.parseVersion(currentVersion);
    if (!current) return false;
    
    // 解析要求版本 - 处理各种格式
    if (requiredVersion.startsWith('>= ')) {
      const required = this.parseVersion(requiredVersion.substring(3));
      if (!required) return false;
      return this.compareVersions(current, required) >= 0;
    } else if (requiredVersion.startsWith('>=')) {
      // Handle format like '>=14.0.0' (without space)
      const required = this.parseVersion(requiredVersion.substring(2));
      if (!required) return false;
      return this.compareVersions(current, required) >= 0;
    } else if (requiredVersion.startsWith('> ')) {
      const required = this.parseVersion(requiredVersion.substring(2));
      if (!required) return false;
      return this.compareVersions(current, required) > 0;
    } else if (requiredVersion.startsWith('>')) {
      // Handle format like '>14.0.0' (without space)
      const required = this.parseVersion(requiredVersion.substring(1));
      if (!required) return false;
      return this.compareVersions(current, required) > 0;
    } else if (requiredVersion.startsWith('<= ')) {
      const required = this.parseVersion(requiredVersion.substring(3));
      if (!required) return false;
      return this.compareVersions(current, required) <= 0;
    } else if (requiredVersion.startsWith('<=')) {
      // Handle format like '<=14.0.0' (without space)
      const required = this.parseVersion(requiredVersion.substring(2));
      if (!required) return false;
      return this.compareVersions(current, required) <= 0;
    } else if (requiredVersion.startsWith('< ')) {
      const required = this.parseVersion(requiredVersion.substring(2));
      if (!required) return false;
      return this.compareVersions(current, required) < 0;
    } else if (requiredVersion.startsWith('<')) {
      // Handle format like '<14.0.0' (without space)
      const required = this.parseVersion(requiredVersion.substring(1));
      if (!required) return false;
      return this.compareVersions(current, required) < 0;
    } else {
      // Default case: check if current version is greater than or equal to required
      const required = this.parseVersion(requiredVersion);
      if (!required) return false;
      return this.compareVersions(current, required) >= 0;
    }
  }
  
  /**
   * 解析版本字符串
   * @param {string} version - 版本字符串
   * @returns {object|null} 解析后的版本对象，格式：{ major, minor, patch }
   */
  parseVersion(version) {
    // 移除可能的前缀v
    const cleanVersion = version.replace(/^v/, '');
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    };
  }
  
  /**
   * 比较两个版本
   * @param {object} a - 第一个版本
   * @param {object} b - 第二个版本
   * @returns {number} 比较结果：1表示a>b，0表示a=b，-1表示a<b
   */
  compareVersions(a, b) {
    if (a.major !== b.major) return a.major > b.major ? 1 : -1;
    if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
    if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
    return 0;
  }
  
  /**
   * 检查命令是否存在
   * @param {string} command - 命令名称
   * @returns {boolean} 命令是否存在
   */
  async commandExists(command) {
    try {
      // Use dynamic import for ES modules compatibility
      const child_process = await import('child_process');
      const { spawnSync } = child_process;
      const result = spawnSync(command, ['--version'], { stdio: 'pipe' });
      return result.error ? false : true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 获取安全统计信息
   * @returns {object} 安全统计
   */
  getSecurityStats() {
    return {
      ...this.stats,
      config: {
        blockedCommandsCount: this.blockedCommands.length,
        allowedDomainsCount: this.allowedDomains.length,
        blockedModulesCount: this.blockedModules.length,
        allowedPathsCount: this.allowedPaths.length,
        maxExecutionTime: this.maxExecutionTime,
        sandboxEnabled: this.enableSandbox
      }
    };
  }
  
  /**
   * 重置安全统计
   */
  resetStats() {
    this.stats = {
      totalValidations: 0,
      blockedCommands: 0,
      blockedNetworkRequests: 0,
      blockedModules: 0,
      blockedPaths: 0
    };
  }
}

/**
 * 安全错误类
 */
export class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
    this.code = 'SECURITY_VIOLATION';
  }
}

export {
  SecurityPolicyValidator
};