/**
 * Vitest 配置文件
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测试环境
    environment: 'node',

    // 全局配置
    globals: true,

    // 设置文件
    setupFiles: ['./tests/setup.js'],

    // 测试文件匹配模式
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],

    // 排除文件
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'tests', '**/*.test.js', '**/*.spec.js'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },

    // 测试超时
    testTimeout: 10000,

    // 钩子超时
    hookTimeout: 10000,

    // 并发测试
    threads: true,

    // 监听模式配置
    watch: false,

    // 报告器
    reporter: ['verbose', 'html']
  },

  // 解析配置
  resolve: {
    alias: {
      '@': '/Users/mark/code/GitHub/BeCrafter/prompt-manager/packages/server'
    }
  }
});
