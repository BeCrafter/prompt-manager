/**
 * 适配器注册表测试用例
 * 验证适配器注册机制的正确性
 */

const assert = require('assert');
const { AdapterRegistry, registry } = require('../src/core/registry');
const { ICommandExecutor } = require('../src/core/interfaces/command-executor');
const { IDependencyManager } = require('../src/core/interfaces/dependency-manager');
const { ISandboxManager } = require('../src/core/interfaces/sandbox-manager');

// 测试适配器类
class TestAdapter {
  constructor(config) {
    this.config = config;
    this.name = 'TestAdapter';
  }
  
  async executeCommand(command, args, options) {
    return { code: 0, stdout: 'test output', stderr: '' };
  }
  
  async installDependencies(dependencies, targetDir) {
    return { success: true, installed: Object.keys(dependencies) };
  }
  
  async createSandbox(config) {
    return { id: 'test-sandbox', directory: '/test' };
  }
  
  async destroySandbox(sandboxId) {
    // Mock implementation
  }
  
  async getSandboxStatus(sandboxId) {
    return { id: sandboxId, status: 'ready' };
  }
  
  async listSandboxes() {
    return [];
  }
}

// 不完整的测试适配器类
class IncompleteAdapter {
  constructor(config) {
    this.config = config;
  }
  
  async executeCommand(command, args, options) {
    return { code: 0, stdout: 'test', stderr: '' };
  }
  
  // 缺少其他必需的方法
}

describe('AdapterRegistry', () => {
  let testRegistry;
  
  beforeEach(() => {
    testRegistry = new AdapterRegistry();
  });
  
  afterEach(() => {
    testRegistry.clearInstances();
  });
  
  describe('注册适配器', () => {
    it('应该成功注册有效的适配器', () => {
      testRegistry.register('test', TestAdapter);
      
      assert.ok(testRegistry.isRegistered('test'));
      assert.deepStrictEqual(testRegistry.getRegisteredAdapters(), ['test']);
    });
    
    it('应该拒绝注册重复的适配器', () => {
      testRegistry.register('test', TestAdapter);
      
      assert.throws(() => {
        testRegistry.register('test', TestAdapter);
      }, /Adapter 'test' is already registered/);
    });
    
    it('应该拒绝注册不完整的适配器', () => {
      assert.throws(() => {
        testRegistry.register('incomplete', IncompleteAdapter);
      }, /must implement required interfaces/);
    });
    
    it('应该拒绝注册非函数类型', () => {
      assert.throws(() => {
        testRegistry.register('invalid', {});
      }, /must implement required interfaces/);
    });
  });
  
  describe('创建适配器实例', () => {
    beforeEach(() => {
      testRegistry.register('test', TestAdapter);
    });
    
    it('应该成功创建适配器实例', () => {
      const config = { test: 'value' };
      const adapter = testRegistry.create('test', config);
      
      assert.ok(adapter instanceof TestAdapter);
      assert.deepStrictEqual(adapter.config, config);
    });
    
    it('应该复用相同配置的实例', () => {
      const config = { test: 'value' };
      const adapter1 = testRegistry.create('test', config);
      const adapter2 = testRegistry.create('test', config);
      
      assert.strictEqual(adapter1, adapter2);
    });
    
    it('应该为不同配置创建不同实例', () => {
      const adapter1 = testRegistry.create('test', { test: 'value1' });
      const adapter2 = testRegistry.create('test', { test: 'value2' });
      
      assert.notStrictEqual(adapter1, adapter2);
    });
    
    it('应该拒绝创建未注册的适配器', () => {
      assert.throws(() => {
        testRegistry.create('nonexistent', {});
      }, /Unknown adapter: 'nonexistent'/);
    });
  });
  
  describe('适配器信息管理', () => {
    beforeEach(() => {
      testRegistry.register('test', TestAdapter);
    });
    
    it('应该返回正确的适配器信息', () => {
      const info = testRegistry.getAdapterInfo('test');
      
      assert.strictEqual(info.name, 'test');
      assert.strictEqual(info.className, 'TestAdapter');
      assert.strictEqual(info.instanceCount, 0);
      assert.ok(Array.isArray(info.requiredInterfaces));
    });
    
    it('应该正确统计实例数量', () => {
      testRegistry.create('test', { test: 'value1' });
      testRegistry.create('test', { test: 'value2' });
      
      const info = testRegistry.getAdapterInfo('test');
      assert.strictEqual(info.instanceCount, 2);
    });
    
    it('应该拒绝获取未注册适配器的信息', () => {
      assert.throws(() => {
        testRegistry.getAdapterInfo('nonexistent');
      }, /Unknown adapter: 'nonexistent'/);
    });
  });
  
  describe('适配器注销', () => {
    beforeEach(() => {
      testRegistry.register('test', TestAdapter);
    });
    
    it('应该成功注销已注册的适配器', () => {
      testRegistry.unregister('test');
      
      assert.ok(!testRegistry.isRegistered('test'));
      assert.deepStrictEqual(testRegistry.getRegisteredAdapters(), []);
    });
    
    it('应该清理相关实例', () => {
      testRegistry.create('test', { test: 'value' });
      testRegistry.unregister('test');
      
      assert.throws(() => {
        testRegistry.create('test', { test: 'value' });
      }, /Unknown adapter: 'test'/);
    });
    
    it('应该拒绝注销未注册的适配器', () => {
      assert.throws(() => {
        testRegistry.unregister('nonexistent');
      }, /Adapter 'nonexistent' is not registered/);
    });
  });
  
  describe('实例缓存管理', () => {
    beforeEach(() => {
      testRegistry.register('test', TestAdapter);
    });
    
    it('应该清除所有实例缓存', () => {
      testRegistry.create('test', { test: 'value1' });
      testRegistry.create('test', { test: 'value2' });
      
      let info = testRegistry.getAdapterInfo('test');
      assert.strictEqual(info.instanceCount, 2);
      
      testRegistry.clearInstances();
      
      info = testRegistry.getAdapterInfo('test');
      assert.strictEqual(info.instanceCount, 0);
    });
    
    it('应该保持适配器注册状态', () => {
      testRegistry.create('test', { test: 'value' });
      testRegistry.clearInstances();
      
      assert.ok(testRegistry.isRegistered('test'));
    });
  });
  
  describe('全局注册表', () => {
    it('应该使用单例模式', () => {
      assert.strictEqual(registry, registry);
    });
    
    it('应该独立管理实例', () => {
      registry.register('global-test', TestAdapter);
      const adapter = registry.create('global-test', {});
      
      assert.ok(adapter instanceof TestAdapter);
    });
  });
  
  describe('接口验证逻辑', () => {
    it('应该正确验证接口实现', () => {
      // TestAdapter实现了所有必需接口，应该通过验证
      assert.doesNotThrow(() => {
        testRegistry.register('valid', TestAdapter);
      });
    });
    
    it('应该检测缺失的方法', () => {
      // IncompleteAdapter缺少必需方法，应该失败
      assert.throws(() => {
        testRegistry.register('invalid', IncompleteAdapter);
      }, /must implement required interfaces/);
    });
  });
  
  describe('错误处理', () => {
    it('应该处理适配器创建失败', () => {
      class FailingAdapter {
        constructor() {
          throw new Error('Construction failed');
        }
        
        async executeCommand() {}
        async installDependencies() {}
        async createSandbox() {}
        async destroySandbox() {}
        async getSandboxStatus() {}
        async listSandboxes() {}
      }
      
      testRegistry.register('failing', FailingAdapter);
      
      assert.throws(() => {
        testRegistry.create('failing', {});
      }, /Failed to create adapter 'failing'/);
    });
  });
});