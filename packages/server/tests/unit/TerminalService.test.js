/**
 * TerminalService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalService, TerminalSession } from '../../services/TerminalService.js';
import pty from 'node-pty';

describe('TerminalService', () => {
  let terminalService;

  beforeEach(() => {
    // 重置mock
    vi.clearAllMocks();

    // 创建新的服务实例
    terminalService = new TerminalService({
      maxSessions: 5,
      timeout: 60000
    });
  });

  afterEach(async () => {
    // 清理服务
    if (terminalService) {
      await terminalService.shutdown();
    }
  });

  describe('constructor', () => {
    it('应该使用默认选项初始化', () => {
      const service = new TerminalService();
      expect(service.defaultOptions.maxSessions).toBe(10);
      expect(service.defaultOptions.timeout).toBe(300000);
      expect(service.sessions.size).toBe(0);
    });

    it('应该使用自定义选项初始化', () => {
      const customOptions = {
        maxSessions: 20,
        timeout: 60000,
        workingDirectory: '/custom/path'
      };
      const service = new TerminalService(customOptions);
      expect(service.defaultOptions.maxSessions).toBe(20);
      expect(service.defaultOptions.timeout).toBe(60000);
      expect(service.defaultOptions.workingDirectory).toBe('/custom/path');
    });
  });

  describe('createSession', () => {
    it('应该成功创建新的终端会话', async () => {
      // Mock PTY进程
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      const session = await terminalService.createSession();

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.pty).toBe(mockPty);
      expect(terminalService.sessions.has(session.id)).toBe(true);
      expect(pty.spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cols: 80,
          rows: 24
        })
      );
    });

    it('应该使用自定义选项创建会话', async () => {
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      const options = {
        size: { cols: 120, rows: 30 },
        workingDirectory: '/custom/path',
        shell: '/bin/bash'
      };

      const session = await terminalService.createSession(options);

      expect(session.size).toEqual({ cols: 120, rows: 30 });
      expect(session.workingDirectory).toBe('/custom/path');
      expect(pty.spawn).toHaveBeenCalledWith(
        '/bin/bash',
        expect.any(Array),
        expect.objectContaining({
          cols: 120,
          rows: 30,
          cwd: '/custom/path'
        })
      );
    });

    it('应该在超过最大会话数时抛出错误', async () => {
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      // 创建最大数量的会话
      for (let i = 0; i < 5; i++) {
        await terminalService.createSession();
      }

      // 尝试创建超出限制的会话
      await expect(terminalService.createSession()).rejects.toThrow('Maximum sessions limit reached');
    });

    it('应该在PTY创建失败时抛出错误', async () => {
      pty.spawn.mockImplementation(() => {
        throw new Error('PTY creation failed');
      });

      await expect(terminalService.createSession()).rejects.toThrow('PTY creation failed');
    });
  });

  describe('getSession', () => {
    it('应该返回存在的会话', async () => {
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      const session = await terminalService.createSession();
      const retrievedSession = terminalService.getSession(session.id);

      expect(retrievedSession).toBe(session);
    });

    it('应该返回undefined对于不存在的会话', () => {
      const session = terminalService.getSession('non-existent-id');
      expect(session).toBeUndefined();
    });
  });

  describe('getAllSessions', () => {
    it('应该返回所有会话', async () => {
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      const session1 = await terminalService.createSession();
      const session2 = await terminalService.createSession();

      const allSessions = terminalService.getAllSessions();
      expect(allSessions).toHaveLength(2);
      expect(allSessions).toContain(session1);
      expect(allSessions).toContain(session2);
    });

    it('应该返回空数组当没有会话时', () => {
      const allSessions = terminalService.getAllSessions();
      expect(allSessions).toHaveLength(0);
    });
  });

  describe('removeSession', () => {
    it('应该成功移除存在的会话', async () => {
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      const session = await terminalService.createSession();
      const result = await terminalService.removeSession(session.id);

      expect(result).toBe(true);
      expect(terminalService.sessions.has(session.id)).toBe(false);
      expect(mockPty.kill).toHaveBeenCalled();
    });

    it('应该返回false对于不存在的会话', async () => {
      const result = await terminalService.removeSession('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('executeCommand', () => {
    it('应该成功执行命令', async () => {
      const result = await terminalService.executeCommand('echo "test"');

      expect(result).toBeDefined();
      expect(typeof result.exitCode).toBe('number');
      expect(typeof result.stdout).toBe('string');
      expect(typeof result.stderr).toBe('string');
    });

    it('应该支持自定义工作目录', async () => {
      const options = {
        workingDirectory: '/tmp'
      };

      // 这里我们只验证调用了正确的参数，实际执行结果取决于系统环境
      await terminalService.executeCommand('pwd', options);
      // 由于使用了真实的spawn，我们主要验证不会抛出错误
    });

    it('应该支持超时设置', async () => {
      const options = {
        timeout: 1000
      };

      // 执行一个长时间运行的命令
      const promise = terminalService.executeCommand('sleep 2', options);

      await expect(promise).rejects.toThrow('Command execution timeout');
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的服务状态', () => {
      const status = terminalService.getStatus();

      expect(status).toHaveProperty('totalSessions');
      expect(status).toHaveProperty('activeSessions');
      expect(status).toHaveProperty('maxSessions');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('platform');
      expect(status).toHaveProperty('nodeVersion');
      expect(status.totalSessions).toBe(0);
      expect(status.activeSessions).toBe(0);
      expect(status.maxSessions).toBe(5);
    });
  });

  describe('cleanupInactiveSessions', () => {
    it('应该清理非活跃会话', async () => {
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      // 创建会话
      const session = await terminalService.createSession();
      expect(terminalService.sessions.size).toBe(1);

      // 手动设置会话为非活跃状态
      session.isActive = false;
      session.lastActivity = new Date(Date.now() - 400000); // 超过默认的 300000ms (5分钟) 超时时间

      // 手动调用清理方法
      terminalService.cleanupInactiveSessions();

      expect(terminalService.sessions.size).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('应该关闭所有会话并停止服务', async () => {
      const mockPty = {
        on: vi.fn(),
        write: vi.fn(),
        resize: vi.fn(),
        kill: vi.fn()
      };
      pty.spawn.mockReturnValue(mockPty);

      // 创建多个会话
      await terminalService.createSession();
      await terminalService.createSession();

      expect(terminalService.sessions.size).toBe(2);

      await terminalService.shutdown();

      expect(terminalService.sessions.size).toBe(0);
      expect(mockPty.kill).toHaveBeenCalledTimes(2);
    });
  });
});

describe('TerminalSession', () => {
  let mockPty;
  let session;

  beforeEach(() => {
    mockPty = {
      on: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn()
    };

    session = new TerminalSession('test-session', mockPty, {
      workingDirectory: '/test/path',
      size: { cols: 100, rows: 25 }
    });
  });

  afterEach(() => {
    if (session) {
      session.terminate();
    }
  });

  describe('constructor', () => {
    it('应该正确初始化会话', () => {
      expect(session.id).toBe('test-session');
      expect(session.pty).toBe(mockPty);
      expect(session.workingDirectory).toBe('/test/path');
      expect(session.size).toEqual({ cols: 100, rows: 25 });
      expect(session.isActive).toBe(true);
      expect(mockPty.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockPty.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });
  });

  describe('write', () => {
    it('应该向PTY写入数据', () => {
      session.write('test command\n');
      expect(mockPty.write).toHaveBeenCalledWith('test command\n');
    });

    it('应该在非活跃会话时抛出错误', () => {
      session.isActive = false;
      expect(() => session.write('test')).toThrow('Terminal session is not active');
    });
  });

  describe('resize', () => {
    it('应该调整PTY大小', () => {
      session.resize(120, 30);
      expect(mockPty.resize).toHaveBeenCalledWith(120, 30);
      expect(session.size).toEqual({ cols: 120, rows: 30 });
    });

    it('应该在非活跃会话时抛出错误', () => {
      session.isActive = false;
      expect(() => session.resize(120, 30)).toThrow('Terminal session is not active');
    });
  });

  describe('terminate', () => {
    it('应该终止PTY进程', () => {
      session.terminate();
      expect(mockPty.kill).toHaveBeenCalled();
      expect(session.isActive).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('应该返回会话信息', () => {
      const info = session.getInfo();

      expect(info).toHaveProperty('id', 'test-session');
      expect(info).toHaveProperty('workingDirectory', '/test/path');
      expect(info).toHaveProperty('size');
      expect(info).toHaveProperty('isActive', true);
      expect(info).toHaveProperty('createdAt');
      expect(info).toHaveProperty('lastActivity');
    });
  });

  describe('事件处理', () => {
    it('应该处理数据事件', () => {
      const dataCallback = vi.fn();
      session.on('data', dataCallback);

      // 模拟PTY数据事件
      const dataHandler = mockPty.on.mock.calls.find(call => call[0] === 'data')[1];
      dataHandler('test data');

      expect(dataCallback).toHaveBeenCalledWith('test data');
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it('应该处理退出事件', () => {
      const exitCallback = vi.fn();
      session.on('exit', exitCallback);

      // 模拟PTY退出事件
      const exitHandler = mockPty.on.mock.calls.find(call => call[0] === 'exit')[1];
      exitHandler(0, 'SIGTERM');

      expect(exitCallback).toHaveBeenCalledWith({ exitCode: 0, signal: 'SIGTERM' });
      expect(session.isActive).toBe(false);
    });
  });
});
