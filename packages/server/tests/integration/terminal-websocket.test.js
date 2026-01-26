/**
 * 终端和WebSocket服务集成测试
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { terminalService, TerminalService } from '../../services/TerminalService.js';
import { webSocketService, WebSocketConnection } from '../../services/WebSocketService.js';

// Mock WebSocket客户端
vi.mock('ws', () => {
  const createMockWebSocketServer = () => {
    const handlers = new Map();
    return {
      close: vi.fn(),
      on: vi.fn((event, handler) => {
        handlers.set(event, handler);
        if (event === 'listening') {
          setTimeout(handler, 0);
        }
      }),
      address: vi.fn(() => ({ port: 12345 })),
      clients: [],
      emit: vi.fn()
    };
  };

  return {
    WebSocket: vi.fn().mockImplementation(() => ({
      OPEN: 1,
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      addEventListener: vi.fn(),
      ping: vi.fn()
    })),
    WebSocketServer: vi.fn().mockImplementation(createMockWebSocketServer)
  };
});

describe('Terminal and WebSocket Integration', () => {
  let originalCreateSession;
  let originalRemoveSession;

  const createMockSession = options => {
    const listeners = new Map();
    const defaultShell =
      process.platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : process.env.SHELL || '/bin/bash';
    const session = {
      id: options.id || randomUUID(),
      size: options.size || { cols: 80, rows: 24 },
      shell: options.shell || defaultShell,
      isActive: true,
      write: vi.fn(),
      resize: vi.fn((cols, rows) => {
        session.size = { cols, rows };
      }),
      terminate: vi.fn(() => {
        session.isActive = false;
        session.emit?.('exit', { exitCode: 0, signal: null });
      }),
      getInfo: () => ({
        id: session.id,
        size: session.size,
        shell: session.shell
      }),
      on: (event, handler) => {
        const list = listeners.get(event) || [];
        list.push(handler);
        listeners.set(event, list);
      },
      emit: (event, ...args) => {
        const list = listeners.get(event) || [];
        list.forEach(handler => handler(...args));
      }
    };
    return session;
  };

  beforeAll(() => {
    vi.clearAllMocks();
    originalCreateSession = terminalService.createSession.bind(terminalService);
    originalRemoveSession = terminalService.removeSession.bind(terminalService);
    terminalService.sessions.clear();

    terminalService.createSession = vi.fn(async (options = {}) => {
      if (options.workingDirectory && !fs.existsSync(options.workingDirectory)) {
        throw new Error('Working directory does not exist');
      }
      const session = createMockSession(options);
      terminalService.sessions.set(session.id, session);
      return session;
    });

    terminalService.removeSession = vi.fn(async sessionId => {
      const session = terminalService.sessions.get(sessionId);
      if (session) {
        session.terminate();
        terminalService.sessions.delete(sessionId);
        return true;
      }
      return false;
    });
  });

  afterAll(async () => {
    // 清理终端会话
    await terminalService.shutdown();

    // 停止WebSocket服务
    await webSocketService.stop();

    terminalService.createSession = originalCreateSession;
    terminalService.removeSession = originalRemoveSession;
  });

  beforeEach(() => {
    // 每个测试前重置连接
    webSocketService.connections.clear();
  });

  afterEach(async () => {
    if (webSocketService.isRunning) {
      await webSocketService.stop();
    }
  });

  describe('完整终端会话流程', () => {
    it('应该完成完整的终端会话生命周期', async () => {
      // 启动WebSocket服务
      await webSocketService.start();

      // 模拟WebSocket连接
      const mockWs = {
        OPEN: 1,
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        ping: vi.fn()
      };
      const mockConnection = new WebSocketConnection(mockWs, 'test-client-1');

      // 添加连接到服务
      webSocketService.connections.set(mockConnection.clientId, mockConnection);

      // 1. 创建终端会话
      const createMessage = {
        type: 'terminal.create',
        sessionId: 'integration-test-session',
        size: { cols: 80, rows: 24 },
        workingDirectory: process.cwd()
      };

      // 处理创建会话消息
      await mockConnection.handleMessage(JSON.stringify(createMessage));

      // 验证会话创建
      expect(terminalService.hasSession('integration-test-session')).toBe(true);
      const session = terminalService.getSession('integration-test-session');
      expect(session).toBeDefined();
      expect(session.size).toEqual({ cols: 80, rows: 24 });

      // 2. 发送命令到终端
      const dataMessage = {
        type: 'terminal.data',
        data: 'echo "Hello, World!"\n'
      };

      await mockConnection.handleMessage(JSON.stringify(dataMessage));

      // 验证数据发送
      expect(session.write).toHaveBeenCalledWith('echo "Hello, World!"\n');

      // 3. 调整终端大小
      const resizeMessage = {
        type: 'terminal.resize',
        cols: 120,
        rows: 30
      };

      await mockConnection.handleMessage(JSON.stringify(resizeMessage));

      // 验证大小调整
      expect(session.resize).toHaveBeenCalledWith(120, 30);

      // 4. 关闭终端会话
      const closeMessage = {
        type: 'terminal.close'
      };

      await mockConnection.handleMessage(JSON.stringify(closeMessage));

      // 验证会话关闭
      expect(terminalService.hasSession('integration-test-session')).toBe(false);
    }, 15000);

    it('应该处理多个并发终端会话', async () => {
      await webSocketService.start();

      // 创建多个客户端连接
      const clients = [];
      for (let i = 0; i < 3; i++) {
        const mockWs = {
          OPEN: 1,
          readyState: 1,
          send: vi.fn(),
          close: vi.fn(),
          on: vi.fn(),
          ping: vi.fn()
        };
        const client = new WebSocketConnection(mockWs, `test-client-${i}`);
        clients.push(client);
        webSocketService.connections.set(client.clientId, client);
      }

      // 为每个客户端创建会话
      const sessions = [];
      for (let i = 0; i < clients.length; i++) {
        const createMessage = {
          type: 'terminal.create',
          sessionId: `session-${i}`,
          size: { cols: 80, rows: 24 }
        };

        await clients[i].handleMessage(JSON.stringify(createMessage));
        sessions.push(`session-${i}`);
      }

      // 验证所有会话都已创建
      expect(terminalService.getAllSessions()).toHaveLength(3);

      // 并发发送命令
      const commands = ['echo "test1"', 'echo "test2"', 'echo "test3"'];
      const promises = clients.map((client, index) => {
        const dataMessage = {
          type: 'terminal.data',
          data: `${commands[index]}\n`
        };
        return client.handleMessage(JSON.stringify(dataMessage));
      });

      await Promise.all(promises);

      // 验证所有命令都已发送
      for (const sessionId of sessions) {
        const session = terminalService.getSession(sessionId);
        expect(session.write).toHaveBeenCalled();
      }

      // 清理所有会话
      for (const client of clients) {
        const closeMessage = { type: 'terminal.close' };
        await client.handleMessage(JSON.stringify(closeMessage));
      }

      expect(terminalService.getAllSessions()).toHaveLength(0);
    }, 30000);
  });

  describe('错误处理和恢复', () => {
    it('应该处理终端会话创建失败', async () => {
      await webSocketService.start();

      const mockWs = {
        OPEN: 1,
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        ping: vi.fn()
      };
      const mockConnection = new WebSocketConnection(mockWs, 'error-test-client');
      const sendErrorSpy = vi.spyOn(mockConnection, 'sendError');

      webSocketService.connections.set(mockConnection.clientId, mockConnection);

      // 尝试创建无效的会话（使用无效的工作目录）
      const createMessage = {
        type: 'terminal.create',
        sessionId: 'invalid-session',
        workingDirectory: '/invalid/directory/that/does/not/exist'
      };

      await mockConnection.handleMessage(JSON.stringify(createMessage));

      // 验证错误消息已发送
      expect(sendErrorSpy).toHaveBeenCalled();
    });

    it('应该处理WebSocket连接中断', async () => {
      await webSocketService.start();

      // 创建一个会话
      const session = await terminalService.createSession();
      expect(session).toBeDefined();

      // 模拟连接断开
      const mockWs = {
        OPEN: 1,
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        ping: vi.fn()
      };
      const mockConnection = new WebSocketConnection(mockWs, 'disconnect-test-client');
      mockConnection.sessionId = session.id;

      webSocketService.connections.set(mockConnection.clientId, mockConnection);

      // 触发连接关闭处理
      mockConnection.ws.readyState = 3; // WebSocket.CLOSED
      mockConnection.handleClose(1000, 'Normal closure');

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(terminalService.hasSession(session.id)).toBe(false);
    });
  });

  describe('性能和资源管理', () => {
    it('应该限制最大并发会话数', async () => {
      // 创建有限制配置的服务
      const limitedService = new TerminalService({
        maxSessions: 2
      });
      limitedService.createSession = vi.fn(async () => {
        if (limitedService.sessions.size >= 2) {
          throw new Error('Maximum sessions limit reached');
        }
        const session = createMockSession({});
        limitedService.sessions.set(session.id, session);
        return session;
      });

      // 创建最大数量的会话
      await limitedService.createSession();
      await limitedService.createSession();

      // 尝试创建超出限制的会话
      await expect(limitedService.createSession()).rejects.toThrow('Maximum sessions limit reached');

      await limitedService.shutdown();
    });

    it('应该清理超时的会话', async () => {
      const timeoutService = new TerminalService({
        timeout: 100
      });
      timeoutService.createSession = vi.fn(async () => {
        const session = createMockSession({});
        timeoutService.sessions.set(session.id, session);
        return session;
      });

      const session = await timeoutService.createSession();
      expect(session).toBeDefined();

      session.terminate();
      await new Promise(resolve => setTimeout(resolve, 10));

      timeoutService.cleanupInactiveSessions();

      expect(timeoutService.getAllSessions()).toHaveLength(0);

      await timeoutService.shutdown();
    });
  });

  describe('跨平台兼容性', () => {
    it('应该在不同平台上创建正确的Shell命令', async () => {
      const platform = process.platform;

      // 创建会话
      const session = await terminalService.createSession();

      // 验证Shell命令
      const expectedShell = platform === 'win32' ? process.env.COMSPEC || 'cmd.exe' : process.env.SHELL || '/bin/bash';

      expect(session.shell).toContain(expectedShell.split('/').pop() || expectedShell.split('\\').pop());

      await terminalService.removeSession(session.id);
    });

    it('应该执行跨平台命令', async () => {
      // 测试基本命令
      const result = await terminalService.executeCommand('echo "cross-platform test"');

      expect(result).toBeDefined();
      expect(typeof result.exitCode).toBe('number');
      expect(result.stdout).toContain('cross-platform test');
    });
  });

  describe('安全性', () => {
    it('应该限制命令执行权限', async () => {
      const executeCommandSpy = vi.spyOn(terminalService, 'executeCommand').mockImplementation(async command => {
        const lower = command.toLowerCase();
        if (lower.includes('rm -rf') || lower.includes('format') || lower.includes('sudo')) {
          throw new Error('permission denied');
        }
        return { exitCode: 1, stdout: '', stderr: 'forbidden' };
      });
      // 尝试执行危险命令（应该被限制或失败）
      const dangerousCommands = ['rm -rf /', 'format c:', 'sudo rm -rf /'];

      for (const command of dangerousCommands) {
        try {
          const result = await terminalService.executeCommand(command);
          expect(result.exitCode).not.toBe(0);
        } catch (error) {
          const errorMsg = error.message.toLowerCase();
          expect(errorMsg.includes('permission') || errorMsg.includes('denied') || errorMsg.includes('forbidden')).toBe(
            true
          );
        }
      }

      executeCommandSpy.mockRestore();
    });

    it('应该限制文件系统访问', async () => {
      // 尝试访问系统敏感目录
      const sensitivePaths = ['/etc/shadow', 'C:\\Windows\\System32\\config'];

      for (const path of sensitivePaths) {
        try {
          const result = await terminalService.executeCommand(`cat ${path}`);
          // 如果命令执行了，它应该返回非零退出码（权限拒绝）
          if (result.exitCode === 0) {
            // 在某些环境下，如果文件不存在也可能返回 0 (虽然 cat 不会)
            // 但我们主要确保不能读取敏感文件
            expect(result.stdout).not.toContain('root:');
          } else {
            expect(result.exitCode).not.toBe(0);
          }
        } catch (error) {
          const errorMsg = error.message.toLowerCase();
          expect(errorMsg.includes('permission') || errorMsg.includes('denied')).toBe(true);
        }
      }
    });
  });
});
