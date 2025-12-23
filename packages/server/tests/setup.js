/**
 * Vitest 测试设置文件
 */

import { vi } from 'vitest';

// Mock node-pty 模块
vi.mock('node-pty', () => {
  const mockPty = {
    on: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
    cols: 80,
    rows: 24
  };

  return {
    default: {
      spawn: vi.fn(() => mockPty)
    },
    spawn: vi.fn(() => mockPty)
  };
});

// Mock fs-extra 的某些方法（如果需要）
vi.mock('fs-extra', async () => {
  const actual = await vi.importActual('fs-extra');
  return {
    ...actual,
    // 可以在这里添加特定的mock
  };
});

// 全局测试设置
global.console = {
  ...console,
  // 在测试中减少日志输出
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};