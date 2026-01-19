/**
 * 核心库功能测试
 * 测试库是否能正确导入和使用
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取server包的index.js路径
const serverIndexPath = path.join(__dirname, '../../index.js');

describe('核心库导入测试', () => {
  let coreModules = {};

  beforeAll(async () => {
    // 动态导入所有导出的函数和对象
    coreModules = await import(serverIndexPath);
  });

  it('应该成功导入所有模块', () => {
    expect(coreModules).toBeDefined();
    expect(Object.keys(coreModules).length).toBeGreaterThan(0);
  });

  it('应该导出服务器相关函数', () => {
    expect(typeof coreModules.startServer).toBe('function');
    expect(typeof coreModules.stopServer).toBe('function');
    expect(typeof coreModules.getServerState).toBe('function');
    expect(typeof coreModules.getServerAddress).toBe('function');
    expect(typeof coreModules.isServerRunning).toBe('function');
  });

  it('应该导出核心对象', () => {
    expect(typeof coreModules.app).toBe('function');
    expect(typeof coreModules.config).toBe('object');
    expect(typeof coreModules.logger).toBe('object');
    expect(typeof coreModules.util).toBe('object');
    expect(typeof coreModules.promptManager).toBe('object');
  });

  it('应该导出MCP相关函数', () => {
    expect(typeof coreModules.getMcpServer).toBe('function');
    expect(typeof coreModules.handleGetPrompt).toBe('function');
    expect(typeof coreModules.handleSearchPrompts).toBe('function');
    expect(typeof coreModules.handleReloadPrompts).toBe('function');
  });

  it('应该导出路由相关对象', () => {
    expect(typeof coreModules.adminRouter).toBe('function');
    expect(typeof coreModules.openRouter).toBe('function');
    expect(typeof coreModules.adminAuthMiddleware).toBe('function');
  });

  it('配置对象应该有正确的方法', () => {
    expect(typeof coreModules.config.getPort).toBe('function');
    expect(typeof coreModules.config.getPromptsDir).toBe('function');
  });

  it('日志对象应该有正确的方法', () => {
    expect(typeof coreModules.logger.info).toBe('function');
    expect(typeof coreModules.logger.error).toBe('function');
    expect(typeof coreModules.logger.warn).toBe('function');
    expect(typeof coreModules.logger.debug).toBe('function');
  });

  it('工具对象应该正确导出', () => {
    expect(coreModules.util).toBeDefined();
    expect(typeof coreModules.util).toBe('object');
  });

  it('提示词管理器应该正确导出', () => {
    expect(coreModules.promptManager).toBeDefined();
    expect(typeof coreModules.promptManager).toBe('object');
  });

  it('服务器状态函数应该正常工作', async () => {
    expect(typeof coreModules.getServerAddress).toBe('function');
    expect(typeof coreModules.isServerRunning).toBe('function');

    // 测试函数调用
    const state = coreModules.getServerState();
    expect(typeof state).toBe('object');

    const address = coreModules.getServerAddress();
    expect(typeof address).toBe('string');

    const isRunning = await coreModules.isServerRunning();
    expect(typeof isRunning).toBe('boolean');
  });
});
