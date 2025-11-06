/**
 * 接口测试用例
 * 验证核心接口的定义和实现
 */

import assert from 'assert';
import { ICommandExecutor } from '../src/core/interfaces/command-executor.js';
import { IDependencyManager } from '../src/core/interfaces/dependency-manager.js';
import { ISandboxManager } from '../src/core/interfaces/sandbox-manager.js';

export default function runTests() {
  describe('接口测试', () => {
    describe('ICommandExecutor', () => {
      it('应该定义executeCommand方法', () => {
        const executor = new ICommandExecutor();
        
        assert.strictEqual(typeof executor.executeCommand, 'function');
        
        // 调用抽象方法应该抛出错误
        assert.throws(() => {
          executor.executeCommand('test', []);
        }, /executeCommand must be implemented by subclass/);
      });
      
      it('应该有正确的方法签名', () => {
        const executor = new ICommandExecutor();
        const descriptor = Object.getOwnPropertyDescriptor(executor, 'executeCommand');
        
        assert.strictEqual(descriptor.value.length, 3); // command, args, options
        assert.strictEqual(descriptor.enumerable, false);
        assert.strictEqual(descriptor.writable, true);
      });
    });
    
    describe('IDependencyManager', () => {
      it('应该定义所有必需的方法', () => {
        const manager = new IDependencyManager();
        
        assert.strictEqual(typeof manager.installDependencies, 'function');
        assert.strictEqual(typeof manager.checkDependencies, 'function');
        assert.strictEqual(typeof manager.uninstallDependencies, 'function');
        
        // 调用抽象方法应该抛出错误
        assert.throws(() => {
          manager.installDependencies({}, '/test');
        }, /installDependencies must be implemented by subclass/);
        
        assert.throws(() => {
          manager.checkDependencies('/test');
        }, /checkDependencies must be implemented by subclass/);
        
        assert.throws(() => {
          manager.uninstallDependencies([], '/test');
        }, /uninstallDependencies must be implemented by subclass/);
      });
      
      it('应该有正确的方法签名', () => {
        const manager = new IDependencyManager();
        
        assert.strictEqual(manager.installDependencies.length, 2); // dependencies, targetDir
        assert.strictEqual(manager.checkDependencies.length, 1); // targetDir
        assert.strictEqual(manager.uninstallDependencies.length, 2); // packages, targetDir
      });
    });
    
    describe('ISandboxManager', () => {
      it('应该定义所有必需的方法', () => {
        const manager = new ISandboxManager();
        
        assert.strictEqual(typeof manager.createSandbox, 'function');
        assert.strictEqual(typeof manager.destroySandbox, 'function');
        assert.strictEqual(typeof manager.getSandboxStatus, 'function');
        assert.strictEqual(typeof manager.listSandboxes, 'function');
        
        // 调用抽象方法应该抛出错误
        assert.throws(() => {
          manager.createSandbox({});
        }, /createSandbox must be implemented by subclass/);
        
        assert.throws(() => {
          manager.destroySandbox('test-id');
        }, /destroySandbox must be implemented by subclass/);
        
        assert.throws(() => {
          manager.getSandboxStatus('test-id');
        }, /getSandboxStatus must be implemented by subclass/);
        
        assert.throws(() => {
          manager.listSandboxes();
        }, /listSandboxes must be implemented by subclass/);
      });
      
      it('应该有正确的方法签名', () => {
        const manager = new ISandboxManager();
        
        assert.strictEqual(manager.createSandbox.length, 1); // config
        assert.strictEqual(manager.destroySandbox.length, 1); // sandboxId
        assert.strictEqual(manager.getSandboxStatus.length, 1); // sandboxId
        assert.strictEqual(manager.listSandboxes.length, 0); // no parameters
      });
    });
    
    describe('接口一致性', () => {
      it('应该遵循接口隔离原则', () => {
        // 每个接口应该只负责一个职责
        const executorMethods = Object.getOwnPropertyNames(ICommandExecutor.prototype);
        const managerMethods = Object.getOwnPropertyNames(IDependencyManager.prototype);
        const sandboxMethods = Object.getOwnPropertyNames(ISandboxManager.prototype);
        
        // 确保没有重复的方法名
        const allMethods = [...executorMethods, ...managerMethods, ...sandboxMethods];
        const uniqueMethods = [...new Set(allMethods)];
        
        assert.strictEqual(allMethods.length, uniqueMethods.length, '接口间不应该有重复的方法名');
        
        // 确保每个接口的方法数量合理（专一性）
        assert.ok(executorMethods.length <= 5, 'ICommandExecutor方法过多，违反ISP原则');
        assert.ok(managerMethods.length <= 5, 'IDependencyManager方法过多，违反ISP原则');
        assert.ok(sandboxMethods.length <= 5, 'ISandboxManager方法过多，违反ISP原则');
      });
    });
  });
}