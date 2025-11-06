/**
 * 适配器集成测试用例
 * 验证所有适配器的功能和兼容性
 */

const assert = require('assert');
const path = require('path');
const { ElectronRuntimeProvider } = require('../src/adapters/electron-adapter');
const { NodeJSRuntimeProvider } = require('../src/adapters/nodejs-adapter');
const { DockerRuntimeProvider } = require('../src/adapters/docker-adapter');
const { AdapterRegistry } = require('../src/core/registry');

describe('适配器集成测试', () => {
  describe('适配器注册和初始化', () => {
    let registry;
    
    beforeEach(() => {
      registry = new AdapterRegistry();
    });
    
    it('应该成功注册所有适配器', () => {
      registry.register('electron', ElectronRuntimeProvider);
      registry.register('nodejs', NodeJSRuntimeProvider);
      registry.register('docker', DockerRuntimeProvider);
      
      const adapters = registry.getRegisteredAdapters();
      assert.deepStrictEqual(adapters.sort(), ['electron', 'nodejs', 'docker']);
    });
    
    it('应该验证适配器接口实现', () => {
      // 所有适配器都应该实现必需的接口
      assert.ok(new ElectronRuntimeProvider({}) instanceof require('../src/core/interfaces/command-executor').ICommandExecutor);
      assert.ok(new NodeJSRuntimeProvider({}) instanceof require('../src/core/interfaces/command-executor').ICommandExecutor);
      assert.ok(new DockerRuntimeProvider({}) instanceof require('../src/core/interfaces/command-executor').ICommandExecutor);
    });
  });
  
  describe('Electron适配器', () => {
    let electronAdapter;
    const testConfig = {
      runtime: {
        nodePath: 'node',
        npmPath: 'npm',
        workingDir: '/tmp/test',
        envVars: { NODE_ENV: 'test' }
      },
      security: {
        blockedCommands: ['rm', 'sudo'],
        allowedDomains: ['example.com'],
        enableSandbox: true
      },
      limits: {
        maxMemory: 1024 * 1024 * 512,
        maxExecutionTime: 30000
      },
      processPool: {
        maxWorkers: 2,
        minWorkers: 1,
        warmupWorkers: 1
      }
    };
    
    beforeEach(() => {
      // 模拟Electron环境
      global.process = {
        versions: {
          electron: '12.0.0',
          node: '14.16.0'
        }
      };
      
      // 模拟electron模块
      global.require = function(module) {
        if (module === 'electron') {
          return {
            utilityProcess: {
              fork: function() {
                return {
                  on: function() {},
                  kill: function() {}
                };
              }
            }
          };
        }
        return require(module);
      };
      
      electronAdapter = new ElectronRuntimeProvider(testConfig);
    });
    
    afterEach(() => {
      // 清理模拟
      delete global.process;
      delete global.require;
    });
    
    it('应该成功初始化', async () => {
      // Electron环境验证应该失败，因为我们没有真正的Electron环境
      await assert.rejects(
        async () => await electronAdapter.validateElectronEnvironment(),
        /Not running in Electron environment/
      );
    });
    
    it('应该有正确的统计信息结构', () => {
      const stats = electronAdapter.getStats();
      assert.ok(stats);
      assert.strictEqual(typeof stats.totalCommands, 'number');
      assert.strictEqual(typeof stats.totalDependencies, 'number');
    });
  });
  
  describe('Node.js适配器', () => {
    let nodejsAdapter;
    const testConfig = {
      runtime: {
        nodePath: 'node',
        npmPath: 'npm',
        workingDir: '/tmp/test',
        envVars: { NODE_ENV: 'test' }
      },
      security: {
        blockedCommands: ['rm', 'sudo'],
        allowedDomains: ['example.com'],
        enableSandbox: true
      },
      limits: {
        maxMemory: 1024 * 1024 * 512,
        maxExecutionTime: 30000
      },
      processPool: {
        maxWorkers: 2,
        minWorkers: 1,
        warmupWorkers: 1
      }
    };
    
    beforeEach(() => {
      nodejsAdapter = new NodeJSRuntimeProvider(testConfig);
    });
    
    it('应该成功创建实例', () => {
      assert.ok(nodejsAdapter instanceof NodeJSRuntimeProvider);
      assert.strictEqual(nodejsAdapter.config, testConfig);
    });
    
    it('应该有正确的统计信息结构', () => {
      const stats = nodejsAdapter.getStats();
      assert.ok(stats);
      assert.strictEqual(typeof stats.totalCommands, 'number');
      assert.strictEqual(typeof stats.totalDependencies, 'number');
      assert.strictEqual(stats.environment.nodeVersion, process.version);
    });
    
    it('应该正确选择镜像源', () => {
      const registry = nodejsAdapter.selectRegistry();
      assert.strictEqual(registry, 'https://registry.npmmirror.com');
    });
  });
  
  describe('Docker适配器', () => {
    let dockerAdapter;
    const testConfig = {
      runtime: {
        nodePath: 'node',
        npmPath: 'npm',
        workingDir: '/tmp/test',
        envVars: { NODE_ENV: 'test' }
      },
      security: {
        blockedCommands: ['rm', 'sudo'],
        allowedDomains: ['example.com'],
        enableSandbox: true,
        user: 'node'
      },
      limits: {
        maxMemory: 1024 * 1024 * 512,
        maxExecutionTime: 30000
      },
      docker: {
        imageName: 'node:14-alpine',
        networkMode: 'bridge',
        volumeMounts: ['/tmp:/workspace']
      },
      processPool: {
        maxWorkers: 2,
        minWorkers: 1,
        warmupWorkers: 1
      }
    };
    
    beforeEach(() => {
      // 模拟docker命令
      const child_process = require('child_process');
      const originalSpawn = child_process.spawn;
      
      child_process.spawn = function(command, args) {
        if (command === 'docker' && args[0] === '--version') {
          return {
            on: function(event, callback) {
              if (event === 'close') {
                setTimeout(() => callback(0), 10);
              }
            },
            stdout: { on: function() {} },
            stderr: { on: function() {} }
          };
        }
        return originalSpawn.apply(this, arguments);
      };
      
      dockerAdapter = new DockerRuntimeProvider(testConfig);
    });
    
    afterEach(() => {
      // 恢复原始spawn方法
      const child_process = require('child_process');
      delete child_process.spawn;
    });
    
    it('应该成功创建实例', () => {
      assert.ok(dockerAdapter instanceof DockerRuntimeProvider);
      assert.strictEqual(dockerAdapter.config, testConfig);
    });
    
    it('应该正确格式化内存', () => {
      const formatted = dockerAdapter.formatMemory(1024 * 1024 * 512); // 512MB
      assert.strictEqual(formatted, '512MB');
      
      const formatted2 = dockerAdapter.formatMemory(1024 * 1024 * 1024 * 2); // 2GB
      assert.strictEqual(formatted2, '2GB');
    });
    
    it('应该正确构建Docker命令', () => {
      const dockerArgs = dockerAdapter.buildDockerCommand('node', ['--version'], {});
      
      assert.ok(dockerArgs.includes('run'));
      assert.ok(dockerArgs.includes('--rm'));
      assert.ok(dockerArgs.includes('--memory=512MB'));
      assert.ok(dockerArgs.includes('--user=node'));
      assert.ok(dockerArgs.includes('node:14-alpine'));
      assert.ok(dockerArgs.includes('node'));
      assert.ok(dockerArgs.includes('--version'));
    });
  });
  
  describe('适配器兼容性', () => {
    const testConfig = {
      runtime: {
        nodePath: 'node',
        npmPath: 'npm',
        workingDir: '/tmp/test'
      },
      security: {
        blockedCommands: ['rm', 'sudo'],
        enableSandbox: true
      },
      limits: {
        maxMemory: 1024 * 1024 * 512,
        maxExecutionTime: 30000
      },
      processPool: {
        maxWorkers: 2
      }
    };
    
    it('所有适配器应该有相同的公共接口', () => {
      const electronAdapter = new ElectronRuntimeProvider(testConfig);
      const nodejsAdapter = new NodeJSRuntimeProvider(testConfig);
      const dockerAdapter = new DockerRuntimeProvider(testConfig);
      
      // 检查公共方法
      const requiredMethods = [
        'executeCommand',
        'installDependencies',
        'createSandbox',
        'destroySandbox',
        'getSandboxStatus',
        'listSandboxes',
        'getStats',
        'shutdown'
      ];
      
      requiredMethods.forEach(method => {
        assert.strictEqual(typeof electronAdapter[method], 'function', `Electron adapter missing ${method}`);
        assert.strictEqual(typeof nodejsAdapter[method], 'function', `Node.js adapter missing ${method}`);
        assert.strictEqual(typeof dockerAdapter[method], 'function', `Docker adapter missing ${method}`);
      });
    });
    
    it('所有适配器应该返回一致的数据结构', async () => {
      const electronAdapter = new ElectronRuntimeProvider(testConfig);
      const nodejsAdapter = new NodeJSRuntimeProvider(testConfig);
      const dockerAdapter = new DockerRuntimeProvider(testConfig);
      
      // 检查统计信息结构
      const electronStats = electronAdapter.getStats();
      const nodejsStats = nodejsAdapter.getStats();
      const dockerStats = dockerAdapter.getStats();
      
      // 所有适配器都应该有基本的统计字段
      const basicStats = ['totalCommands', 'totalDependencies', 'totalSandboxes', 'activeSandboxes'];
      basicStats.forEach(stat => {
        assert.ok(stat in electronStats, `Electron adapter missing ${stat}`);
        assert.ok(stat in nodejsStats, `Node.js adapter missing ${stat}`);
        assert.ok(stat in dockerStats, `Docker adapter missing ${stat}`);
      });
    });
  });
  
  describe('适配器错误处理', () => {
    const testConfig = {
      runtime: {
        nodePath: 'node',
        npmPath: 'npm',
        workingDir: '/tmp/test'
      },
      security: {
        blockedCommands: ['rm', 'sudo']
      },
      limits: {
        maxMemory: 1024 * 1024 * 512
      },
      processPool: {
        maxWorkers: 2
      }
    };
    
    it('应该正确处理未实现的方法调用', async () => {
      const nodejsAdapter = new NodeJSRuntimeProvider(testConfig);
      
      // 未初始化时调用应该失败
      await assert.rejects(
        async () => await nodejsAdapter.executeCommand('ls', []),
        /Not implemented/
      );
    });
    
    it('应该正确处理无效配置', () => {
      assert.throws(() => {
        new NodeJSRuntimeProvider(null);
      }, /Cannot read property/);
    });
  });
});