const fs = require('fs/promises');
const path = require('path');
const { app } = require('electron');

/**
 * 应用启动自检功能
 * 在应用启动时检查关键资源和环境配置
 */
class SelfCheck {
  constructor(logger) {
    this.logger = logger;
    this.checkResults = [];
  }
  
  /**
   * 运行所有自检项目
   * @returns {Promise<boolean>} - 是否所有检查都通过
   */
  async run() {
    this.logger.info('Running application self-check...');
    
    const checks = [
      this.checkAppResources(),
      this.checkRuntimeDirectory(),
      this.checkPortAvailability(),
      this.checkDependencies(),
      this.checkSystemTools()
    ];
    
    const results = await Promise.allSettled(checks);
    
    // 记录检查结果
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.checkResults.push({
          name: this.getCheckName(index),
          status: 'passed',
          message: result.value
        });
        this.logger.debug(`Self-check passed: ${this.getCheckName(index)}`);
      } else {
        this.checkResults.push({
          name: this.getCheckName(index),
          status: 'failed',
          message: result.reason?.message || 'Unknown error',
          error: result.reason
        });
        this.logger.warn(`Self-check failed: ${this.getCheckName(index)}`, { 
          error: result.reason?.message 
        });
      }
    });
    
    const passedCount = this.checkResults.filter(r => r.status === 'passed').length;
    const totalCount = this.checkResults.length;
    
    this.logger.info(`Self-check completed: ${passedCount}/${totalCount} checks passed`);
    
    // 输出详细结果
    if (this.checkResults.some(r => r.status === 'failed')) {
      this.logger.warn('Self-check found potential issues:', {
        results: this.checkResults
      });
    }
    
    return passedCount === totalCount;
  }
  
  /**
   * 获取检查项目名称
   */
  getCheckName(index) {
    const names = [
      'App Resources',
      'Runtime Directory',
      'Port Availability',
      'Dependencies',
      'System Tools'
    ];
    return names[index] || `Check ${index + 1}`;
  }
  
  /**
   * 检查应用资源文件
   */
  async checkAppResources() {
    const resourcesPath = process.resourcesPath;
    const appAsarPath = path.join(resourcesPath, 'app.asar');
    
    try {
      await fs.access(appAsarPath);
      return 'ASAR file found and accessible';
    } catch (error) {
      throw new Error(`ASAR file not found or inaccessible at ${appAsarPath}: ${error.message}`);
    }
  }
  
  /**
   * 检查运行时目录
   */
  async checkRuntimeDirectory() {
    const runtimeRoot = path.join(app.getPath('userData'), 'prompt-manager');
    
    try {
      await fs.mkdir(runtimeRoot, { recursive: true });
      
      // 检查目录权限
      const testFile = path.join(runtimeRoot, '.test-write');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return `Runtime directory created and writable: ${runtimeRoot}`;
    } catch (error) {
      throw new Error(`Failed to create or write to runtime directory: ${error.message}`);
    }
  }
  
  /**
   * 检查端口可用性
   */
  async checkPortAvailability() {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const server = net.createServer();
      
      // 设置超时
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Port check timeout'));
      }, 3000);
      
      server.listen(5621, () => {
        clearTimeout(timeout);
        server.close();
        resolve('Port 5621 is available');
      });
      
      server.on('error', (error) => {
        clearTimeout(timeout);
        if (error.code === 'EADDRINUSE') {
          reject(new Error('Port 5621 is already in use'));
        } else {
          reject(new Error(`Port check failed: ${error.message}`));
        }
      });
    });
  }
  
  /**
   * 检查依赖项
   */
  async checkDependencies() {
    // 检查关键依赖是否存在
    const criticalDeps = [
      '@becrafter/prompt-manager-core',
      '@modelcontextprotocol/sdk',
      'express',
      'cors',
      'ws'
    ];
    
    const missingDeps = [];
    
    for (const dep of criticalDeps) {
      try {
        // 尝试动态导入依赖
        if (dep === '@becrafter/prompt-manager-core') {
          // 特殊处理核心包
          const corePath = path.join(process.resourcesPath, 'app.asar', 'node_modules', dep, 'index.js');
          if (await this._pathExists(corePath)) {
            continue;
          }
        }
        
        // 尝试使用 require（CommonJS）或 import（ESM）
        try {
          require(dep);
        } catch (requireError) {
          if (requireError.code === 'MODULE_NOT_FOUND') {
            // 尝试其他方式
            try {
              await import(dep);
            } catch (importError) {
              if (importError.code === 'ERR_MODULE_NOT_FOUND') {
                missingDeps.push(dep);
              }
            }
          }
        }
      } catch (error) {
        // 忽略检查错误，依赖可能在运行时才加载
        this.logger.debug(`Dependency check for ${dep} failed:`, { error: error.message });
      }
    }
    
    if (missingDeps.length > 0) {
      this.logger.warn(`Missing critical dependencies: ${missingDeps.join(', ')}`);
      return `Some dependencies may be missing: ${missingDeps.join(', ')}`;
    }
    
    return 'All critical dependencies appear to be available';
  }
  
  /**
   * 检查文件或目录是否存在
   */
  async _pathExists(targetPath) {
    try {
      await fs.access(targetPath);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 检查系统工具
   */
  async checkSystemTools() {
    const runtimeRoot = path.join(app.getPath('userData'), 'prompt-manager');
    const toolsDir = path.join(runtimeRoot, 'tools');
    
    try {
      await fs.mkdir(toolsDir, { recursive: true });
      
      // 检查工具目录结构
      const expectedDirs = ['chrome-devtools', 'file-reader', 'filesystem', 'ollama-remote', 'pdf-reader', 'playwright', 'todolist'];
      const missingDirs = [];
      
      for (const dir of expectedDirs) {
        const dirPath = path.join(toolsDir, dir);
        try {
          await fs.access(dirPath);
        } catch {
          missingDirs.push(dir);
        }
      }
      
      if (missingDirs.length > 0) {
        return `System tools directory created, but some subdirectories are missing: ${missingDirs.join(', ')}`;
      }
      
      return 'System tools directory structure is complete';
    } catch (error) {
      throw new Error(`Failed to check system tools: ${error.message}`);
    }
  }
  
  /**
   * 获取检查结果摘要
   */
  getSummary() {
    const passed = this.checkResults.filter(r => r.status === 'passed').length;
    const failed = this.checkResults.filter(r => r.status === 'failed').length;
    const total = this.checkResults.length;
    
    return {
      passed,
      failed,
      total,
      percentage: total > 0 ? Math.round((passed / total) * 100) : 0,
      results: this.checkResults
    };
  }
  
  /**
   * 获取详细的检查报告
   */
  getReport() {
    const summary = this.getSummary();
    
    let report = `=== Application Self-Check Report ===\n`;
    report += `Overall: ${summary.passed}/${summary.total} passed (${summary.percentage}%)\n\n`;
    
    this.checkResults.forEach((result, index) => {
      report += `${index + 1}. ${result.name}: ${result.status.toUpperCase()}\n`;
      report += `   Message: ${result.message}\n`;
      if (result.status === 'failed' && result.error) {
        report += `   Error: ${result.error}\n`;
      }
      report += '\n';
    });
    
    return report;
  }
}

module.exports = SelfCheck;