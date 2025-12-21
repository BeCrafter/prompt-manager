/**
 * TerminalService - 终端服务管理类
 * 
 * 提供跨平台终端会话管理，支持PTY（伪终端）和实时交互
 * 支持Windows、macOS和Linux系统的原生终端命令
 */

import pty from 'node-pty';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import path from 'path';
import os from 'os';

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
  }

  /**
   * 创建新的终端会话
   */
  async createSession(options = {}) {
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
    const env = { ...process.env, ...options.environment };

    logger.debug(`Creating PTY with shell: ${shell}, args: ${args.join(' ')}, cwd: ${cwd}`);

    return pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: options.size.cols,
      rows: options.size.rows,
      cwd: cwd,
      env: env
    });
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
    return ['-l'];
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

// 创建单例实例
export const terminalService = new TerminalService();

// 导出类型定义
export { TerminalSession };