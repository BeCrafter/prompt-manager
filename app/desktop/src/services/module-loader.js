const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

class ModuleLoader {
  constructor(logger, errorHandler) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.moduleCache = new Map();
    this.loadingPromises = new Map();
  }

  async loadServerModule(serverRoot, forceReload = false) {
    const cacheKey = serverRoot;
    
    // 如果正在加载，返回现有promise
    if (this.loadingPromises.has(cacheKey) && !forceReload) {
      this.logger.debug('Returning existing module loading promise');
      return this.loadingPromises.get(cacheKey);
    }

    // 强制重新加载时清理缓存
    if (forceReload) {
      this.logger.debug('Force reloading server module');
      this.moduleCache.delete(cacheKey);
    }

    // 检查缓存
    if (this.moduleCache.has(cacheKey)) {
      this.logger.debug('Returning cached server module');
      return this.moduleCache.get(cacheKey);
    }

    const loadingPromise = this._loadModuleInternal(serverRoot);
    this.loadingPromises.set(cacheKey, loadingPromise);

    try {
      const module = await loadingPromise;
      this.moduleCache.set(cacheKey, module);
      return module;
    } catch (error) {
      this.logger.error('Failed to load server module', error);
      throw error;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  async _loadModuleInternal(serverRoot) {
    this.logger.info('Loading server module', { serverRoot });
    
    const serverEntry = path.join(serverRoot, 'packages', 'server', 'server.js');
    
    // 验证入口文件存在
    await this._validateServerEntry(serverEntry);
    
    // 生成带版本号的URL
    const entryUrl = pathToFileURL(serverEntry);
    entryUrl.searchParams.set('v', Date.now().toString());
    
    this.logger.debug('Importing server module', { entryUrl: entryUrl.href });
    
    try {
      const module = await import(entryUrl.href);
      
      // 验证模块结构
      this._validateServerModule(module);
      
      this.logger.info('Server module loaded successfully');
      return module;
    } catch (error) {
      this.logger.error('Failed to import server module', error);
      throw new Error(`Failed to load server module: ${error.message}`);
    }
  }

  async _validateServerEntry(serverEntry) {
    try {
      await fs.promises.access(serverEntry, fs.constants.F_OK);
      this.logger.debug('Server entry file exists', { serverEntry });
    } catch (error) {
      this.logger.error('Server entry file does not exist', error);
      throw new Error(`Server entry file not found: ${serverEntry}`);
    }
  }

  _validateServerModule(module) {
    if (!module || typeof module.startServer !== 'function') {
      throw new Error('Invalid server module: missing startServer function');
    }
    
    this.logger.debug('Server module validation passed');
  }

  async installDependencies(targetDir) {
    this.logger.info('Installing server dependencies', { targetDir });
    
    // 验证 package.json 存在
    await this._validatePackageJson(targetDir);
    
    // 检查并添加缺失的依赖
    await this._ensureRequiredDependencies(targetDir);
    
    return new Promise((resolve, reject) => {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const args = ['install', '--omit=dev', '--no-audit', '--no-fund'];
      
      this.logger.debug('Running npm install', { command: npmCommand, args });
      
      const child = spawn(npmCommand, args, {
        cwd: targetDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString().trim();
        stdout += output;
        this.logger.debug(`[npm stdout] ${output}`);
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString().trim();
        stderr += output;
        this.logger.warn(`[npm stderr] ${output}`);
      });

      child.on('error', (error) => {
        this.logger.error('npm process error', error);
        reject(new Error(`Failed to start npm process: ${error.message}`));
      });

      child.on('close', (code) => {
        this.logger.debug('npm process exited', { code });
        
        if (code === 0) {
          this.logger.info('Dependencies installed successfully');
          resolve();
        } else {
          const errorMsg = `npm install failed with exit code ${code}`;
          this.logger.error(errorMsg, new Error(stderr));
          reject(new Error(errorMsg));
        }
      });
    });
  }

  async _validatePackageJson(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    
    try {
      await fs.promises.access(pkgPath, fs.constants.F_OK);
      this.logger.debug('package.json found in target directory');
    } catch (error) {
      this.logger.error('package.json not found in target directory', { pkgPath });
      throw new Error(`package.json not found in ${targetDir}`);
    }
  }

  async _ensureRequiredDependencies(targetDir) {
    const pkgPath = path.join(targetDir, 'package.json');
    
    try {
      const pkgContent = await fs.promises.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgContent);
      
      pkg.dependencies = pkg.dependencies || {};
      
      // 检查并添加 @modelcontextprotocol/sdk
      if (!pkg.dependencies['@modelcontextprotocol/sdk']) {
        pkg.dependencies['@modelcontextprotocol/sdk'] = '^1.20.2';
        await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        this.logger.info('Added @modelcontextprotocol/sdk to dependencies');
      }
    } catch (error) {
      this.logger.error('Error checking/adding dependencies', error);
      throw error;
    }
  }

  clearCache(serverRoot) {
    const cacheKey = serverRoot;
    if (this.moduleCache.has(cacheKey)) {
      this.moduleCache.delete(cacheKey);
      this.logger.debug('Cleared module cache', { serverRoot });
    }
  }
}

module.exports = ModuleLoader;