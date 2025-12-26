const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const { constants } = require('fs');

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
    
    // 判断是否为打包环境
    const isPackaged = this._isPackagedEnvironment();
    this.logger.debug('Environment check', { isPackaged, serverRoot });
    
    // 根据环境类型决定路径优先级
    let pathsToCheck;
    
    if (isPackaged) {
      // 打包环境：优先从 ASAR 包中加载
      pathsToCheck = [
        // 1. 优先从 app.asar 包中的 node_modules 加载
        path.join(process.resourcesPath, 'app.asar', 'node_modules', '@becrafter', 'prompt-manager-core', 'index.js'),
        // 2. 尝试从 app.asar 直接加载
        path.join(process.resourcesPath, 'app.asar', 'packages', 'server', 'index.js'),
        // 3. 尝试从应用目录的 packages/server 加载
        path.join(process.resourcesPath, 'packages', 'server', 'index.js'),
        // 4. 备用：从 serverRoot 加载
        path.join(serverRoot, 'packages', 'server', 'index.js'),
      ];
    } else {
      // 开发环境：优先从项目目录加载
      pathsToCheck = [
        // 1. 优先从 serverRoot 的 packages/server 加载（开发环境）
        path.join(serverRoot, 'packages', 'server', 'index.js'),
        // 2. 尝试从 serverRoot 的 node_modules 加载
        path.join(serverRoot, 'node_modules', '@becrafter', 'prompt-manager-core', 'index.js'),
        // 3. 尝试从当前目录的 node_modules 加载
        path.join(__dirname, '..', '..', '..', 'node_modules', '@becrafter', 'prompt-manager-core', 'index.js'),
        // 4. 最后尝试从 ASAR 路径（以防万一）
        path.join(process.resourcesPath, 'app.asar', 'node_modules', '@becrafter', 'prompt-manager-core', 'index.js'),
      ];
    }
    
    let lastError = null;
    
    for (const libPath of pathsToCheck) {
      try {
        if (await this._pathExists(libPath)) {
          this.logger.info('Found server module at path', { path: libPath });
          
          const entryUrl = pathToFileURL(libPath);
          // 添加版本参数以防止缓存
          entryUrl.searchParams.set('v', Date.now().toString());
          
          this.logger.debug('Attempting to import module', { url: entryUrl.href });
          const module = await import(entryUrl.href);
          this.logger.debug('Module imported successfully', { moduleKeys: Object.keys(module) });
          this._validateServerModule(module);
          this.logger.info('Server module loaded successfully');
          return module;
        }
      } catch (error) {
        lastError = error;
        this.logger.error('Failed to load from path', { 
          path: libPath, 
          error: error.message,
          stack: error.stack 
        });
        continue;
      }
    }
    
    // 所有路径都失败，抛出详细的错误信息
    const errorMsg = `Could not find core library in any of the expected paths: ${pathsToCheck.join(', ')}`;
    this.logger.error(errorMsg, { lastError: lastError?.message });
    throw new Error(errorMsg);
  }

  /**
   * 判断是否为打包环境
   */
  _isPackagedEnvironment() {
    // 优先检查开发环境标志
    const isDevelopment = process.env.NODE_ENV === 'development' ||
                         process.env.ELECTRON_IS_DEV === '1' ||
                         __dirname.includes('node_modules') ||
                         process.defaultApp === true;
    
    // 如果是开发环境，直接返回 false
    if (isDevelopment) {
      return false;
    }
    
    // 检查是否在 Electron 的打包环境中
    const appPath = process.resourcesPath || '';
    const isElectronPackaged = appPath.includes('app.asar') ||
                              !appPath.includes('Electron.app');
    
    return isElectronPackaged;
  }

  async _pathExists(targetPath) {
    try {
      this.logger.debug('Checking if path exists', { path: targetPath });
      
      // 对于 ASAR 文件，使用多种方式验证存在性
      if (targetPath.includes('.asar')) {
        try {
          // 方法1：尝试使用 fs.stat（最可靠的方式）
          const stats = await fs.promises.stat(targetPath);
          if (stats.isFile() || stats.isDirectory()) {
            return true;
          }
        } catch (statError) {
          // 如果 stat 失败，尝试其他方法
          this.logger.debug('ASAR stat failed, trying alternative methods', { 
            path: targetPath, 
            error: statError.message 
          });
        }
        
        try {
          // 方法2：尝试读取文件的前几个字节
          const buffer = Buffer.alloc(1);
          const fd = await fs.promises.open(targetPath, 'r');
          await fd.read(buffer, 0, 1, 0);
          await fd.close();
          return true;
        } catch (readError) {
          // 如果读取失败，尝试最后的方法
          this.logger.debug('ASAR read failed', { 
            path: targetPath, 
            error: readError.message 
          });
        }
        
        try {
          // 方法3：尝试使用 fs.access（标准方法）
          await fs.promises.access(targetPath, constants.F_OK);
          return true;
        } catch (accessError) {
          this.logger.debug('ASAR access failed', { 
            path: targetPath, 
            error: accessError.message 
          });
          return false;
        }
      }
      
      // 普通文件检查 - 使用 fs.stat 而不是 fs.access
      const stats = await fs.promises.stat(targetPath);
      this.logger.debug('File check successful', { path: targetPath, isFile: stats.isFile() });
      return stats.isFile();
    } catch (error) {
      this.logger.debug('File access check failed', { 
        path: targetPath, 
        error: error.message 
      });
      return false;
    }
  }

  async _validateServerEntry(serverEntry) {
    try {
      // 验证库的 package.json 存在
      const packageJsonPath = path.join(serverEntry, 'package.json');
      await fs.promises.access(packageJsonPath, fs.constants.F_OK);
      this.logger.debug('Server module package.json exists', { serverEntry });
    } catch (error) {
      this.logger.error('Server module not found', error);
      throw new Error(`Server module not found: ${serverEntry}`);
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
      
      // 确保 @becrafter/prompt-manager-core 依赖存在
      if (!pkg.dependencies['@becrafter/prompt-manager-core']) {
        pkg.dependencies['@becrafter/prompt-manager-core'] = '^0.0.19';
        await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
        this.logger.info('Added @becrafter/prompt-manager-core to dependencies');
      }
      
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