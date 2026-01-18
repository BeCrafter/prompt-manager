/**
 * 工具系统测试文件
 *
 * 用于验证工具加载、工具管理等功能是否正常工作
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { toolLoaderService } from '../../toolm/tool-loader.service.js';
import { handleToolM } from '../../toolm/tool-manager.handler.js';

describe('工具系统集成测试', () => {
  beforeAll(async () => {
    // 初始化工具加载器
    await toolLoaderService.initialize();
  }, 30000); // 增加超时时间

  describe('工具加载服务', () => {
    it('应该成功初始化工具加载器', async () => {
      await expect(toolLoaderService.initialize()).resolves.toBeUndefined();
    });

    it('应该能够获取所有工具列表', () => {
      const tools = toolLoaderService.getAllTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('应该包含filesystem工具', () => {
      const hasFilesystem = toolLoaderService.hasTool('filesystem');
      expect(hasFilesystem).toBe(true);

      const filesystemTool = toolLoaderService.getTool('filesystem');
      expect(filesystemTool).toBeDefined();
      expect(filesystemTool.metadata).toBeDefined();
    });
  });

  describe('工具管理器 - 手册模式', () => {
    it('应该能够执行手册模式', async () => {
      const yamlInput = `tool: tool://filesystem
mode: manual`;

      const result = await handleToolM({ yaml: yamlInput });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBeDefined();
      expect(result.content[0].text.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('工具管理器 - 执行模式', () => {
    it('应该能够执行list_allowed_directories方法', async () => {
      const yamlInput = `tool: tool://filesystem
mode: execute
parameters:
  method: list_allowed_directories`;

      const result = await handleToolM({ yaml: yamlInput });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].text).toBeDefined();
    }, 30000);
  });

  describe('工具管理器 - 配置模式', () => {
    it('应该能够执行配置模式', async () => {
      const yamlInput = `tool: tool://filesystem
mode: configure
parameters:
  ALLOWED_DIRECTORIES: '["~/.prompt-manager", "/tmp"]'`;

      const result = await handleToolM({ yaml: yamlInput });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    }, 30000);
  });

  describe('工具管理器 - 日志模式', () => {
    it('应该能够执行日志模式', async () => {
      const yamlInput = `tool: tool://filesystem
mode: log
parameters:
  action: tail
  lines: 50`;

      const result = await handleToolM({ yaml: yamlInput });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    }, 30000);
  });

  describe('工具管理器 - 错误处理', () => {
    it('应该在不存在的工具时抛出错误', async () => {
      const yamlInput = `tool: tool://nonexistent
mode: execute`;

      await expect(handleToolM({ yaml: yamlInput })).rejects.toThrow();
    });

    it('应该在缺少必需参数时抛出错误', async () => {
      await expect(handleToolM({})).rejects.toThrow();
    });

    it('应该在无效的工具格式时抛出错误', async () => {
      const yamlInput = `tool: filesystem
mode: execute`;

      await expect(handleToolM({ yaml: yamlInput })).rejects.toThrow();
    });
  });
});
