/**
 * TerminalService - 终端服务管理类
 * 
 * 提供跨平台终端会话管理，支持PTY（伪终端）和实时交互
 * 支持Windows、macOS和Linux系统的原生终端命令
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import path from 'path';
import os from 'os';

// 延迟加载 node-pty，避免编译错误
let pty = null;
let PTY_AVAILABLE = false;
let PTY_LOAD_ERROR = null;

/**
 * 尝试加载 node-pty 模块，如果失败则尝试自动修复
 */
async function tryLoadNodePty() {
  logger.info('开始尝试加载 node-pty 模块...');
  try {
    const ptyModule = await import('node-pty');
    pty = ptyModule;
    // 测试模块是否真正可用
    if (pty && pty.default && pty.default.spawn) {
      PTY_AVAILABLE = true;
      logger.info('node-pty 模块加载成功');
      return true;
    }
  } catch (error) {
    logger.info('node-pty 模块加载失败，准备自动修复...');
    PTY_LOAD_ERROR = error;
    PTY_AVAILABLE = false;
    logger.warn('node-pty 模块不可用，尝试自动修复...');

    // 尝试自动修复
    try {
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(spawn);

      logger.info('正在重新编译 node-pty...');
      const rebuildProcess = spawn('npm', ['rebuild', 'node-pty'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      await new Promise((resolve, reject) => {
        rebuildProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`npm rebuild 失败，退出码: ${code}`));
          }
        });
        rebuildProcess.on('error', reject);
      });

      // 重新尝试加载
      try {
        const ptyModule = await import('node-pty');
        pty = ptyModule;
        if (pty && pty.default && pty.default.spawn) {
          PTY_AVAILABLE = true;
          logger.info('node-pty 模块修复成功！');
          return true;
        }
      } catch (retryError) {
        logger.error('自动修复失败，请手动运行: npm rebuild node-pty');
      }
    } catch (fixError) {
      logger.error('自动修复过程失败:', fixError.message);
      logger.error('请手动运行: npm rebuild node-pty');
    }

    logger.warn('终端功能将被禁用，请修复 node-pty 后再重启服务');
    return false;
  }
  return false;
}

/**
 * 终端会话类
 */
class TerminalSession {
  constructor(id, ptyProcess, options = {}) {
    this.id = id;
    this.pty = ptyProcess;
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.workingDirectory = options.workingDirectory || os.homedir();
    this.shell = options.shell || this.getDefaultShell();
    this.platform = options.platform || process.platform;
    this.size = options.size || { cols: 80, rows: 24 };
    this.environment = options.environment || process.env;
    this.isActive = true;
    this.isFallback = options.isFallback || false; // 标记是否使用回退方案
    
    // 绑定PTY事件
    this.setupPtyEvents();
  }

  /**
   * 获取默认Shell
   */
  getDefaultShell() {
    switch (process.platform) {
      case 'win32':
        return process.env.COMSPEC || 'cmd.exe';
      case 'darwin':
        return process.env.SHELL || '/bin/bash';
      case 'linux':
        return process.env.SHELL || '/bin/bash';
      default:
        return '/bin/sh';
    }
  }

  /**
   * 设置PTY事件监听
   */
  setupPtyEvents() {
    if (!this.pty) return;

    this.pty.on('data', (data) => {
      this.lastActivity = new Date();
      this.emit('data', data);
    });

    this.pty.on('exit', (exitCode, signal) => {
      this.isActive = false;
      this.emit('exit', { exitCode, signal });
    });
  }

  /**
   * 写入数据到终端
   */
  write(data) {
    if (!this.isActive || !this.pty) {
      throw new Error('Terminal session is not active');
    }
    this.pty.write(data);
    this.lastActivity = new Date();
  }

  /**
   * 调整终端大小
   */
  resize(cols, rows) {
    if (!this.isActive || !this.pty) {
      throw new Error('Terminal session is not active');
    }
    this.pty.resize(cols, rows);
    this.size = { cols, rows };
  }

  /**
   * 终止会话
   */
  terminate() {
    if (this.pty) {
      this.pty.kill();
    }
    this.isActive = false;
  }

  /**
   * 获取会话信息
   */
  getInfo() {
    return {
      id: this.id,
      shell: this.shell,
      workingDirectory: this.workingDirectory,
      platform: this.platform,
      size: this.size,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      isActive: this.isActive
    };
  }

  /**
   * 简单的事件发射器实现
   */
  emit(event, ...args) {
    if (this._events && this._events[event]) {
      this._events[event].forEach(callback => callback(...args));
    }
  }

  /**
   * 事件监听器
   */
  on(event, callback) {
    if (!this._events) this._events = {};
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (!this._events || !this._events[event]) return;
    const index = this._events[event].indexOf(callback);
    if (index > -1) {
      this._events[event].splice(index, 1);
    }
  }
}

/**
 * TerminalService 主类
 */
export class TerminalService {
  constructor(options = {}) {
    this.sessions = new Map();
    this.defaultOptions = {
      shell: null, // 自动检测
      workingDirectory: os.homedir(),
      size: { cols: 80, rows: 24 },
      timeout: 300000, // 5分钟超时
      maxSessions: 10, // 最大会话数
      ...options
    };
    
    // 定期清理非活跃会话
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // 每分钟检查一次
    
    logger.info('TerminalService initialized');
    
    // 修复 node-pty 二进制文件权限
    this.fixNodePtyPermissions();
  }
  
  /**
   * 修复 node-pty 二进制文件权限
   * 这是解决 posix_spawnp failed 错误的关键
   */
  async fixNodePtyPermissions() {
    try {
      const { execSync } = await import('child_process');
      const platform = process.platform;
      
      // 只在 Unix-like 系统上修复权限（macOS, Linux）
      if (platform !== 'win32') {
        logger.info('🔧 检查并修复 node-pty 二进制文件权限...');
        
        // 尝试多个可能的 node-pty 路径
        const possiblePaths = [
          // 路径1: 在包的 node_modules 中（开发环境）
          path.join(path.dirname(path.dirname(new URL(import.meta.url).pathname)), 'node_modules', 'node-pty', 'prebuilds'),
          // 路径2: 在根 node_modules 中（npm 安装环境）
          path.join(process.cwd(), 'node_modules', 'node-pty', 'prebuilds'),
          // 路径3: 相对于当前工作目录
          path.join(process.cwd(), 'node_modules', '@becrafter', 'prompt-manager', 'node_modules', 'node-pty', 'prebuilds')
        ];
        
        let ptyPath = null;
        const fs = await import('fs');
        
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            ptyPath = possiblePath;
            break;
          }
        }
        
        if (ptyPath) {
          try {
            // 添加执行权限 - 使用 find 命令来处理所有平台
            execSync(`find ${ptyPath} -type f -name "*.node" -o -name "spawn-helper" | xargs chmod +x 2>/dev/null || true`, {
              stdio: 'pipe',
              timeout: 5000
            });
            logger.info('✅ node-pty 权限修复完成');
          } catch (error) {
            // 静默失败，不影响服务启动
            logger.debug('node-pty 权限修复失败:', error.message);
          }
        } else {
          logger.debug('未找到 node-pty prebuilds 目录，跳过权限修复');
        }
      }
    } catch (error) {
      // 静默失败，不影响服务启动
      logger.debug('node-pty 权限修复失败:', error.message);
    }
  }

  /**
   * 创建新的终端会话
   */
  async createSession(options = {}) {
    // 首次使用时尝试加载 node-pty
    if (pty === null && PTY_AVAILABLE === false) {
      await tryLoadNodePty();
    }

    // 检查PTY是否可用
    if (!PTY_AVAILABLE) {
      throw new Error('Terminal functionality is disabled - node-pty module is not available. Run "npm rebuild node-pty" to fix this.');
    }

    const sessionId = options.id || randomUUID();
    const sessionOptions = { ...this.defaultOptions, ...options };
    
    // 检查会话数限制
    if (this.sessions.size >= sessionOptions.maxSessions) {
      throw new Error(`Maximum sessions limit reached: ${sessionOptions.maxSessions}`);
    }

    // 检查会话ID是否已存在
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session with ID ${sessionId} already exists`);
    }

    try {
      const ptyProcess = await this.createPtyProcess(sessionOptions);
      const session = new TerminalSession(sessionId, ptyProcess, sessionOptions);
      
      // 添加事件监听
      session.on('data', (data) => {
        this.handleSessionData(sessionId, data);
      });
      
      session.on('exit', (info) => {
        this.handleSessionExit(sessionId, info);
      });
      
      // 存储会话
      this.sessions.set(sessionId, session);
      
      logger.info(`Terminal session created: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to create terminal session: ${error.message}`);
      throw error;
    }
  }

  /**
   * 创建PTY进程
   */
  async createPtyProcess(options) {
    const shell = options.shell || this.getDefaultShellForPlatform();
    const args = this.getShellArgs(shell);
    const cwd = options.workingDirectory || os.homedir();

    // 确保环境变量正确，特别是 PATH
    const env = {
      ...process.env,
      ...options.environment,
      // 确保 SHELL 环境变量正确设置
      SHELL: shell,
      // 确保 LANG 和 LC_* 变量设置
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || process.env.LANG || 'en_US.UTF-8',
      LC_CTYPE: process.env.LC_CTYPE || process.env.LANG || 'en_US.UTF-8',
      // 确保 TERM 变量设置
      TERM: process.env.TERM || 'xterm-256color'
    };

    logger.info(`🔧 创建终端会话 - Shell: ${shell}, Args: [${args.join(', ')}], CWD: ${cwd}`);
    logger.info(`🔧 环境变量 - SHELL: ${env.SHELL}, TERM: ${env.TERM}, LANG: ${env.LANG}`);
    logger.info(`🔧 Shell 可执行性检查: ${shell} ${args.join(' ')}`);

    // 检查 shell 是否可执行
    try {
      const fs = await import('fs');
      if (!fs.existsSync(shell)) {
        throw new Error(`Shell 不存在: ${shell}`);
      }

      const stats = fs.statSync(shell);
      if (!stats.isFile()) {
        throw new Error(`Shell 不是文件: ${shell}`);
      }

      if (!(stats.mode & parseInt('111', 8))) {
        throw new Error(`Shell 没有执行权限: ${shell}`);
      }

      logger.info(`✅ Shell 验证通过: ${shell}`);
    } catch (error) {
      logger.error(`❌ Shell 验证失败:`, error.message);
      throw error;
    }

    // 创建 PTY 进程 - 使用多级回退机制
    logger.info(`🔧 尝试创建 PTY 进程...`);

    // 定义尝试策略的优先级
    const strategies = [
      // 策略 1: 使用用户指定的 shell 和 xterm-256color
      {
        name: 'User shell with xterm-256color',
        shell: shell,
        args: args,
        term: 'xterm-256color'
      },
      // 策略 2: 使用用户指定的 shell 和 xterm
      {
        name: 'User shell with xterm',
        shell: shell,
        args: args,
        term: 'xterm'
      },
      // 策略 3: 使用 /bin/sh 和 xterm-256color
      {
        name: '/bin/sh with xterm-256color',
        shell: '/bin/sh',
        args: [],
        term: 'xterm-256color'
      },
      // 策略 4: 使用 /bin/sh 和 xterm
      {
        name: '/bin/sh with xterm',
        shell: '/bin/sh',
        args: [],
        term: 'xterm'
      },
      // 策略 5: 使用 /bin/sh 和 ansi
      {
        name: '/bin/sh with ansi',
        shell: '/bin/sh',
        args: [],
        term: 'ansi'
      }
    ];

    let lastError = null;

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      
      try {
        logger.info(`🔄 尝试策略 ${i + 1}/${strategies.length}: ${strategy.name}`);
        
        const ptyProcess = pty.default.spawn(strategy.shell, strategy.args, {
          name: strategy.term,
          cols: options.size.cols,
          rows: options.size.rows,
          cwd: cwd,
          env: {
            ...env,
            TERM: strategy.term,
            SHELL: strategy.shell
          }
        });

        logger.info(`✅ PTY 进程创建成功，PID: ${ptyProcess.pid}`);
        logger.info(`✅ 使用策略: ${strategy.name}`);
        
        // 更新会话选项以反映实际使用的 shell
        options.shell = strategy.shell;
        
        return ptyProcess;

      } catch (error) {
        lastError = error;
        logger.warn(`❌ 策略 ${i + 1} 失败: ${error.message}`);
        
        // 继续尝试下一个策略
        continue;
      }
    }

    // 所有策略都失败了
    logger.error(`❌ 所有 PTY 创建策略都失败了`);
    logger.error(`❌ 最后一个错误: ${lastError?.message}`);
    logger.error(`❌ 系统信息 - 平台: ${process.platform}, Node: ${process.version}`);
    logger.error(`❌ 环境信息 - SHELL: ${env.SHELL}, TERM: ${env.TERM}`);
    logger.error(`❌ 原始 Shell 路径: ${shell}, 参数: [${args.join(', ')}]`);
    logger.error(`❌ 工作目录: ${cwd}`);

    // 提供用户友好的错误信息
    const error = new Error(
      `终端创建失败：所有 PTY 创建策略都失败了。\n` +
      `最后一个错误: ${lastError?.message}\n` +
      `建议解决方案:\n` +
      `1. 运行: npm rebuild node-pty\n` +
      `2. 检查系统权限和 macOS 安全设置\n` +
      `3. 确认 shell 路径正确: ${shell}\n` +
      `4. 重启系统后再试\n` +
      `5. 检查是否有其他进程占用了 PTY 资源`
    );
    error.code = 'TERMINAL_CREATION_FAILED';
    error.originalError = lastError;
    throw error;
  }

  /**
   * 获取平台对应的默认Shell
   */
  getDefaultShellForPlatform() {
    switch (process.platform) {
      case 'win32':
        return process.env.COMSPEC || 'cmd.exe';
      case 'darwin':
        return process.env.SHELL || '/bin/bash';
      case 'linux':
        return process.env.SHELL || '/bin/bash';
      default:
        return '/bin/sh';
    }
  }

  /**
   * 获取Shell启动参数
   */
  getShellArgs(shell) {
    if (process.platform === 'win32') {
      if (shell.includes('powershell') || shell.includes('pwsh')) {
        return ['-NoLogo', '-ExecutionPolicy', 'Bypass', '-NoExit'];
      }
      return ['/c'];
    }
    // 不使用 -l 参数，避免 login shell 导致的 posix_spawnp 失败
    // 如果需要交互式 shell，可以通过环境变量或 shell 配置来实现
    return [];
  }

  /**
   * 获取会话
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取所有会话
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * 会话是否存在
   */
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * 删除会话
   */
  async removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.terminate();
      this.sessions.delete(sessionId);
      logger.info(`Terminal session removed: ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * 处理会话数据
   */
  handleSessionData(sessionId, data) {
    // 这里可以添加数据处理逻辑，如日志记录、过滤等
    logger.debug(`Session ${sessionId} data: ${data.length} bytes`);
  }

  /**
   * 处理会话退出
   */
  handleSessionExit(sessionId, exitInfo) {
    logger.info(`Terminal session ${sessionId} exited: ${JSON.stringify(exitInfo)}`);
    this.sessions.delete(sessionId);
  }

  /**
   * 清理非活跃会话
   */
  cleanupInactiveSessions() {
    const now = new Date();
    const timeoutMs = this.defaultOptions.timeout;
    
    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive || (now - session.lastActivity) > timeoutMs) {
        logger.info(`Cleaning up inactive session: ${sessionId}`);
        this.removeSession(sessionId);
      }
    }
  }

  /**
   * 执行命令（非交互式）
   */
  async executeCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const shell = this.getDefaultShellForPlatform();
      const args = process.platform === 'win32' ? ['/c', command] : ['-c', command];
      const cwd = options.workingDirectory || this.defaultOptions.workingDirectory;
      
      const child = spawn(shell, args, {
        cwd: cwd,
        env: { ...process.env, ...options.environment },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout,
          stderr: stderr
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // 超时处理
      if (options.timeout) {
        setTimeout(() => {
          child.kill();
          reject(new Error(`Command execution timeout: ${command}`));
        }, options.timeout);
      }
    });
  }

  /**
   * 获取工作目录
   */
  async getWorkingDirectory(sessionId) {
    const session = this.getSession(sessionId);
    if (session) {
      return session.workingDirectory;
    }
    
    // 如果没有会话，返回默认工作目录
    return this.defaultOptions.workingDirectory;
  }

  /**
   * 设置工作目录
   */
  async setWorkingDirectory(sessionId, directory) {
    const session = this.getSession(sessionId);
    if (session) {
      session.workingDirectory = directory;
      // 发送cd命令到终端
      session.write(`cd "${directory}"\n`);
      return true;
    }
    return false;
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    const activeSessions = this.getAllSessions().filter(s => s.isActive);
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      maxSessions: this.defaultOptions.maxSessions,
      uptime: process.uptime(),
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  /**
   * 关闭服务
   */
  async shutdown() {
    // 清理所有会话
    for (const [sessionId, session] of this.sessions) {
      session.terminate();
    }
    this.sessions.clear();
    
    // 清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    logger.info('TerminalService shutdown');
  }
}

/**
 * 获取 PTY 状态信息
 */
export function getPtyStatus() {
  return {
    available: PTY_AVAILABLE,
    loadError: PTY_LOAD_ERROR ? PTY_LOAD_ERROR.message : null,
    nodeVersion: process.version,
    platform: process.platform
  };
}

/**
 * 尝试重新加载 PTY 模块
 */
export async function reloadPty() {
  PTY_AVAILABLE = false;
  PTY_LOAD_ERROR = null;
  pty = null;
  return await tryLoadNodePty();
}

// 创建单例实例
export const terminalService = new TerminalService();

// 导出类型定义
export { TerminalSession };