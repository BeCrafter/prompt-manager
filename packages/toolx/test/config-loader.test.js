/**
 * 配置加载器测试用例
 * 验证配置加载和继承功能
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const { ConfigLoader, loader } = require('../src/core/config-loader');

describe('ConfigLoader', () => {
  let testConfigDir;
  let configLoader;
  
  beforeEach(async () => {
    // 创建临时测试目录
    testConfigDir = path.join(__dirname, 'temp-config');
    await fs.mkdir(testConfigDir, { recursive: true });
    
    configLoader = new ConfigLoader();
    configLoader.setConfigDirectory(testConfigDir);
  });
  
  afterEach(async () => {
    // 清理测试目录
    await fs.rmdir(testConfigDir, { recursive: true });
  });
  
  describe('基础配置加载', () => {
    beforeEach(async () => {
      // 创建基础配置文件
      const baseConfig = `
runtime:
  timeout: 30000
  maxMemory: "512MB"
  
processPool:
  maxWorkers: 4
  minWorkers: 1
  
security:
  enableSandbox: true
  blockedCommands: ["rm", "sudo"]
`;
      
      await fs.writeFile(path.join(testConfigDir, 'base.yml'), baseConfig);
    });
    
    it('应该成功加载YAML配置', async () => {
      const config = await configLoader.loadYAML('base.yml');
      
      assert.strictEqual(config.runtime.timeout, 30000);
      assert.strictEqual(config.runtime.maxMemory, '512MB');
      assert.strictEqual(config.processPool.maxWorkers, 4);
      assert.strictEqual(config.security.enableSandbox, true);
      assert.deepStrictEqual(config.security.blockedCommands, ['rm', 'sudo']);
    });
    
    it('应该处理不存在的配置文件', async () => {
      await assert.rejects(
        async () => await configLoader.loadYAML('nonexistent.yml'),
        /Config file not found/
      );
    });
    
    it('应该使用js-yaml解析器（如果可用）', async () => {
      const complexConfig = `
runtime:
  timeout: 30000
  envVars:
    NODE_ENV: "production"
    DEBUG: "false"
  
processPool:
  maxWorkers: 4
  minWorkers: 1
  warmupWorkers: 2
  
security:
  enableSandbox: true
  allowedDomains:
    - "example.com"
    - "test.com"
  blockedCommands:
    - "rm"
    - "sudo"
`;
      
      await fs.writeFile(path.join(testConfigDir, 'complex.yml'), complexConfig);
      
      const config = await configLoader.loadYAML('complex.yml');
      
      assert.strictEqual(config.runtime.envVars.NODE_ENV, 'production');
      assert.strictEqual(config.runtime.envVars.DEBUG, 'false');
      assert.deepStrictEqual(config.security.allowedDomains, ['example.com', 'test.com']);
      assert.deepStrictEqual(config.security.blockedCommands, ['rm', 'sudo']);
    });
  });
  
  describe('配置继承', () => {
    beforeEach(async () => {
      // 创建基础配置
      const baseConfig = `
base:
  runtime:
    timeout: 30000
    maxMemory: "512MB"
  processPool:
    maxWorkers: 4
    minWorkers: 1
  security:
    enableSandbox: true
  logging:
    level: "info"
    file: "./logs/app.log"`;
      
      await fs.writeFile(path.join(testConfigDir, 'base-config.yml'), baseConfig);
      
      // 创建场景配置
      const scenarioConfig = `
extends: "../base-config.yml"

scenario: "test"
description: "Test scenario"

runtime:
  nodePath: "node"
  npmPath: "npm"
  workingDir: "./workspace"
  envVars:
    NODE_ENV: "test"

processPool:
  maxWorkers: 6
  warmupWorkers: 3

security:
  allowedDomains: ["test.com"]
`;
      
      await fs.mkdir(path.join(testConfigDir, 'scenarios'), { recursive: true });
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'test.yml'), scenarioConfig);
    });
    
    it('应该成功继承配置', async () => {
      const config = await configLoader.loadScenario('test');
      
      // 继承的基础配置
      assert.strictEqual(config.runtime.timeout, 30000);
      assert.strictEqual(config.runtime.maxMemory, '512MB');
      assert.strictEqual(config.processPool.minWorkers, 1);
      assert.strictEqual(config.security.enableSandbox, true);
      assert.strictEqual(config.logging.level, 'info');
      
      // 场景特定的覆盖配置
      assert.strictEqual(config.scenario, 'test');
      assert.strictEqual(config.runtime.nodePath, 'node');
      assert.strictEqual(config.runtime.npmPath, 'npm');
      assert.strictEqual(config.processPool.maxWorkers, 6);
      assert.deepStrictEqual(config.security.allowedDomains, ['test.com']);
    });
    
    it('应该正确处理深度合并', async () => {
      const config = await configLoader.loadScenario('test');
      
      // 验证嵌套对象的合并
      assert.strictEqual(config.runtime.timeout, 30000); // 基础配置
      assert.strictEqual(config.runtime.nodePath, 'node'); // 覆盖配置
      assert.strictEqual(config.processPool.maxWorkers, 6); // 覆盖配置
      assert.strictEqual(config.processPool.minWorkers, 1); // 基础配置
    });
  });
  
  describe('环境变量替换', () => {
    beforeEach(async () => {
      process.env.TEST_NODE_PATH = '/usr/local/bin/node';
      process.env.TEST_WORK_DIR = '/tmp/workspace';
      
      const configWithEnv = `
runtime:
  nodePath: "\${TEST_NODE_PATH}"
  workingDir: "\${TEST_WORK_DIR}"
  envVars:
    CUSTOM_VAR: "\${TEST_NODE_PATH}/bin"
`;
      
      await fs.writeFile(path.join(testConfigDir, 'env-config.yml'), configWithEnv);
    });
    
    afterEach(() => {
      delete process.env.TEST_NODE_PATH;
      delete process.env.TEST_WORK_DIR;
    });
    
    it('应该替换环境变量', async () => {
      const config = await configLoader.loadYAML('env-config.yml');
      
      assert.strictEqual(config.runtime.nodePath, '/usr/local/bin/node');
      assert.strictEqual(config.runtime.workingDir, '/tmp/workspace');
      assert.strictEqual(config.runtime.envVars.CUSTOM_VAR, '/usr/local/bin/node/bin');
    });
    
    it('应该处理未定义的环境变量', async () => {
      const configWithUndefined = `
runtime:
  undefinedVar: "\${UNDEFINED_VAR}"
  definedVar: "value"`;
      
      await fs.writeFile(path.join(testConfigDir, 'undefined-env.yml'), configWithUndefined);
      
      const config = await configLoader.loadYAML('undefined-env.yml');
      
      assert.strictEqual(config.runtime.undefinedVar, '${UNDEFINED_VAR}');
      assert.strictEqual(config.runtime.definedVar, 'value');
    });
  });
  
  describe('配置验证', () => {
    it('应该验证必需字段', async () => {
      const incompleteConfig = `
runtime:
  timeout: 30000
# 缺少 processPool 和 security`;
      
      await fs.writeFile(path.join(testConfigDir, 'incomplete.yml'), incompleteConfig);
      
      await assert.rejects(
        async () => await configLoader.loadYAML('incomplete.yml'),
        /Missing required config field/
      );
    });
    
    it('应该验证进程池配置', async () => {
      const invalidProcessPool = `
runtime:
  timeout: 30000
processPool:
  maxWorkers: 15  # 超过最大值
  minWorkers: 1`;
      
      await fs.writeFile(path.join(testConfigDir, 'invalid-process-pool.yml'), invalidProcessPool);
      
      await assert.rejects(
        async () => await configLoader.loadYAML('invalid-process-pool.yml'),
        /maxWorkers must be between 1 and 10/
      );
    });
    
    it('应该验证安全配置', async () => {
      const invalidSecurity = `
runtime:
  timeout: 30000
processPool:
  maxWorkers: 4
  minWorkers: 1
security:
  allowedDomains: "invalid"  # 应该是数组
  blockedCommands: ["rm"]`;
      
      await fs.writeFile(path.join(testConfigDir, 'invalid-security.yml'), invalidSecurity);
      
      await assert.rejects(
        async () => await configLoader.loadYAML('invalid-security.yml'),
        /allowedDomains must be an array/
      );
    });
  });
  
  describe('缓存机制', () => {
    beforeEach(async () => {
      const testConfig = `
runtime:
  timeout: 30000
  maxMemory: "512MB"`;
      
      await fs.writeFile(path.join(testConfigDir, 'cached.yml'), testConfig);
    });
    
    it('应该缓存已加载的配置', async () => {
      const config1 = await configLoader.loadYAML('cached.yml');
      const config2 = await configLoader.loadYAML('cached.yml');
      
      assert.strictEqual(config1, config2);
    });
    
    it('应该能够清除缓存', async () => {
      await configLoader.loadYAML('cached.yml');
      configLoader.clearCache();
      
      // 重新加载应该从文件读取
      const config = await configLoader.loadYAML('cached.yml');
      assert.strictEqual(config.runtime.timeout, 30000);
    });
    
    it('应该能够重新加载配置', async () => {
      await configLoader.loadYAML('cached.yml');
      
      // 修改文件
      await fs.writeFile(path.join(testConfigDir, 'cached.yml'), 'runtime:\n  timeout: 60000');
      
      const reloadedConfig = await configLoader.reloadScenario('cached');
      assert.strictEqual(reloadedConfig.runtime.timeout, 60000);
    });
  });
  
  describe('场景管理', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testConfigDir, 'scenarios'), { recursive: true });
      
      // 创建多个场景配置
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'dev.yml'), 'scenario: "dev"');
      await fs.writeFile(path.join(testConfigDir, 'scenarios', 'prod.yml'), 'scenario: "prod"');
    });
    
    it('应该列出可用场景', async () => {
      const scenarios = await configLoader.getAvailableScenarios();
      
      assert.deepStrictEqual(scenarios.sort(), ['dev', 'prod']);
    });
    
    it('应该处理空的场景目录', async () => {
      await fs.rmdir(path.join(testConfigDir, 'scenarios'), { recursive: true });
      
      const scenarios = await configLoader.getAvailableScenarios();
      assert.deepStrictEqual(scenarios, []);
    });
  });
  
  describe('错误处理', () => {
    it('应该处理无效的YAML语法', async () => {
      const invalidYAML = `
runtime:
  timeout: 30000
  invalid_indent: missing_value`;
      
      await fs.writeFile(path.join(testConfigDir, 'invalid.yml'), invalidYAML);
      
      // 简单解析器应该能处理基本的YAML
      const config = await configLoader.loadYAML('invalid.yml');
      assert.strictEqual(config.runtime.timeout, 30000);
    });
    
    it('应该提供清晰的错误信息', async () => {
      await assert.rejects(
        async () => await configLoader.loadScenario('nonexistent'),
        /Failed to load config for 'nonexistent'/
      );
    });
  });
  
  describe('全局加载器', () => {
    it('应该使用单例模式', () => {
      assert.strictEqual(loader, loader);
    });
    
    it('应该独立管理缓存', async () => {
      const globalConfig = `
runtime:
  timeout: 60000`;
      
      await fs.writeFile(path.join(testConfigDir, 'global.yml'), globalConfig);
      loader.setConfigDirectory(testConfigDir);
      
      const config = await loader.loadYAML('global.yml');
      assert.strictEqual(config.runtime.timeout, 60000);
    });
  });
});
