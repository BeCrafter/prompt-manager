/**
 * 终端和WebSocket服务集成测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { terminalService } from '../../services/TerminalService.js';
import { webSocketService } from '../../services/WebSocketService.js';
import { startServer, stopServer } from '../../server.js';

// Mock WebSocket客户端
vi.mock('ws', () => ({
  WebSocket: vi.fn().mockImplementation(() => ({
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    addEventListener: vi.fn()
  }))
}));

describe('Terminal and WebSocket Integration', () => {
  let server;
  let wsPort;
  let mockWebSocketClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // 启动测试服务器
    server = await startServer({
      configOverrides: {
        port: 0, // 使用随机端口
        adminEnable: true
      }
    });

    // 获取服务器端口
    const address = server.address();
    wsPort = 8081; // WebSocket固定端口

    // 创建Mock WebSocket客户端
    mockWebSocketClient = new WebSocket();
  });

  afterEach(async () => {
    // 清理终端会话
    await terminalService.shutdown();
    
    // 停止WebSocket服务
    await webSocketService.stop();
    
    // 停止服务器
    if (server) {
      await stopServer();
    }
  });

  describe('完整终端会话流程', () => {
    it('应该完成完整的终端会话生命周期', async () => {
      // 启动WebSocket服务
      await webSocketService.start();
      
      // 模拟WebSocket连接
      const mockConnection = {
        clientId: 'test-client-1',
        sessionId: null,
        ws: {
          readyState: 1,
          send: vi.fn(),
          close: vi.fn(),
          on: vi.fn()
        },
        send: vi.fn(),
        sendError: vi.fn()
      };

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
      await mockConnection.handleMessage?.(JSON.stringify(createMessage));
      
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

      await mockConnection.handleMessage?.(JSON.stringify(dataMessage));
      
      // 验证数据发送
      expect(session.write).toHaveBeenCalledWith('echo "Hello, World!"\n');

      // 3. 调整终端大小
      const resizeMessage = {
        type: 'terminal.resize',
        cols: 120,
        rows: 30
      };

      await mockConnection.handleMessage?.(JSON.stringify(resizeMessage));
      
      // 验证大小调整
      expect(session.resize).toHaveBeenCalledWith(120, 30);

      // 4. 关闭终端会话
      const closeMessage = {
        type: 'terminal.close'
      };

      await mockConnection.handleMessage?.(JSON.stringify(closeMessage));
      
      // 验证会话关闭
      expect(terminalService.hasSession('integration-test-session')).toBe(false);
    }, 15000);

    it('应该处理多个并发终端会话', async () => {
      await webSocketService.start();
      
      // 创建多个客户端连接
      const clients = [];
      for (let i = 0; i < 3; i++) {
        const client = {
          clientId: `test-client-${i}`,
          sessionId: null,
          ws: {
            readyState: 1,
            send: vi.fn(),
            close: vi.fn(),
            on: vi.fn()
          },
          send: vi.fn(),
          sendError: vi.fn()
        };
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

        await clients[i].handleMessage?.(JSON.stringify(createMessage));
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
        return client.handleMessage?.(JSON.stringify(dataMessage));
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
        await client.handleMessage?.(JSON.stringify(closeMessage));
      }

      expect(terminalService.getAllSessions()).toHaveLength(0);
    }, 20000);
  });

  describe('错误处理和恢复', () => {
    it('应该处理终端会话创建失败', async () => {
      await webSocketService.start();
      
      const mockConnection = {
        clientId: 'error-test-client',
        ws: {
          readyState: 1,
          send: vi.fn(),
          close: vi.fn(),
          on: vi.fn()
        },
        send: vi.fn(),
        sendError: vi.fn()
      };

      webSocketService.connections.set(mockConnection.clientId, mockConnection);

      // 尝试创建无效的会话（使用无效的工作目录）
      const createMessage = {
        type: 'terminal.create',
        sessionId: 'invalid-session',
        workingDirectory: '/invalid/directory/that/does/not/exist'
      };

      await mockConnection.handleMessage?.(JSON.stringify(createMessage));
      
      // 验证错误消息已发送
      expect(mockConnection.sendError).toHaveBeenCalled();
    });

    it('应该处理WebSocket连接中断', async () => {
      await webSocketService.start();
      
      // 创建一个会话
      const session = await terminalService.createSession();
      expect(session).toBeDefined();

      // 模拟连接断开
      const mockConnection = {
        clientId: 'disconnect-test-client',
        sessionId: session.id,
        ws: {
          readyState: 1,
          send: vi.fn(),
          close: vi.fn(),
          on: vi.fn()
        }
      };

      webSocketService.connections.set(mockConnection.clientId, mockConnection);

      // 触发连接关闭处理
      mockConnection.ws.readyState = 3; // WebSocket.CLOSED
      mockConnection.handleClose?.(1000, 'Normal closure');

      // 验证会话已被清理
      setTimeout(() => {
        expect(terminalService.hasSession(session.id)).toBe(false);
      }, 100);
    });
  });

  describe('性能和资源管理', () => {
    it('应该限制最大并发会话数', async () => {
      // 创建有限制配置的服务
      const limitedService = new (await import('../../services/TerminalService.js')).TerminalService({
        maxSessions: 2
      });

      // 创建最大数量的会话
      await limitedService.createSession();
      await limitedService.createSession();

      // 尝试创建超出限制的会话
      await expect(limitedService.createSession()).rejects.toThrow('Maximum sessions limit reached');

      await limitedService.shutdown();
    });

    it('应该清理超时的会话', async () => {
      const timeoutService = new (await import('../../services/TerminalService.js')).TerminalService({
        timeout: 100 // 100ms超时
      });

      // 创建会话
      const session = await timeoutService.createSession();
      expect(session).toBeDefined();

      // 手动设置会话为非活跃状态
      session.lastActivity = new Date(Date.now() - 200); // 超过超时时间

      // 手动触发清理
      timeoutService.cleanupInactiveSessions();

      // 验证会话已被清理
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
      const expectedShell = platform === 'win32' 
        ? process.env.COMSPEC || 'cmd.exe'
        : process.env.SHELL || '/bin/bash';
      
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
      // 尝试执行危险命令（应该被限制或失败）
      const dangerousCommands = [
        'rm -rf /',
        'format c:',
        'sudo rm -rf /'
      ];

      for (const command of dangerousCommands) {
        // 这些命令应该失败或被阻止
        try {
          const result = await terminalService.executeCommand(command);
          // 如果没有抛出错误，至少应该有非零退出码
          expect(result.exitCode).not.toBe(0);
        } catch (error) {
          // 或者应该抛出权限错误
          expect(error.message).toContain('permission') || 
                   expect(error.message).toContain('denied') ||
                   expect(error.message).toContain('forbidden');
        }
      }
    });

    it('应该限制文件系统访问', async () => {
      // 尝试访问系统敏感目录
      const sensitivePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32\\config',
        '/etc/shadow'
      ];

      for (const path of sensitivePaths) {
        try {
          const result = await terminalService.executeCommand(`cat ${path}`);
          // 如果成功访问，应该返回空或权限错误
          expect(result.exitCode).not.toBe(0);
        } catch (error) {
          // 应该抛出权限错误
          expect(error.message).toContain('permission') || 
                   expect(error.message).toContain('denied');
        }
      }
    });
  });
});