const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class RuntimeManager {
  constructor(logger, errorHandler) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.runtimeRoot = null;
    // 更准确地判断是否为打包应用
    // 在开发模式下，即使 app.isPackaged 为 true，我们的项目目录结构也不同于打包应用
    this.isPackaged = this._checkIfActuallyPackaged();
  }

  _checkIfActuallyPackaged() {
    // 简化环境检测逻辑
    const appPath = app.getAppPath();
    const isDev = appPath.includes('node_modules/electron') || 
                 process.env.NODE_ENV === 'development' ||
                 process.defaultApp;
    
    return !isDev && app.isPackaged;
  }

  async ensureRuntimeEnvironment() {
    if (this.runtimeRoot) {
      this.logger.debug('Using cached runtime root', { path: this.runtimeRoot });
      return this.runtimeRoot;
    }

    try {
      if (this.isPackaged) {
        this.runtimeRoot = await this._setupPackagedEnvironment();
      } else {
        this.runtimeRoot = await this._setupDevelopmentEnvironment();
      }

      this.logger.info('Runtime environment ensured', { 
        root: this.runtimeRoot,
        isPackaged: this.isPackaged 
      });

      return this.runtimeRoot;
    } catch (error) {
      this.logger.error('Failed to ensure runtime environment', error);
      throw error;
    }
  }

  async _setupDevelopmentEnvironment() {
    this.logger.info('Setting up development environment');
    
    // Go from app/desktop/src/services -> project root
    const devRoot = path.resolve(__dirname, '..', '..', '..', '..');
    
    // 验证开发环境
    await this._validateDevelopmentEnvironment(devRoot);
    
    this.runtimeRoot = devRoot;
    return devRoot;
  }

  async _setupPackagedEnvironment() {
    this.logger.info('Setting up packaged environment');
    
    // 在打包的 Electron 应用中，资源文件位于 app.asar 中
    const packagedRoot = path.join(process.resourcesPath, 'app.asar');
    const runtimeRoot = path.join(app.getPath('userData'), 'prompt-manager');
    
    this.logger.debug('Environment paths', { 
      packagedRoot, 
      runtimeRoot,
      resourcesPath: process.resourcesPath,
      isMountedVolume: process.resourcesPath.includes('/Volumes/')
    });
    
    // 简化逻辑：仅检查是否是挂载卷
    const isFromMountedVolume = process.resourcesPath.includes('/Volumes/');
    
    if (isFromMountedVolume) {
      this.logger.debug('Detected mounted volume, attempting to find appropriate path');
      
      // 尝试主要路径
      try {
        await this._validatePackagedResources(packagedRoot);
        this.logger.debug('Validated packaged resources from mounted volume path', { path: packagedRoot });
      } catch (error) {
        // 在挂载卷中，即使验证失败，我们也要继续执行
        // 因为文件可能存在于挂载卷中，但由于权限问题无法验证
        this.logger.warn('Could not validate packaged resources from mounted volume, continuing anyway', {
          error: error.message
        });
      }
    } else {
      // 非挂载卷，使用正常验证流程
      await this._validatePackagedResources(packagedRoot);
    }
    
    // 设置运行时目录（仅复制必要的文件，不包括 ASAR 包）
    await this._setupRuntimeDirectory(packagedRoot, runtimeRoot);
    
    this.runtimeRoot = runtimeRoot;
    return runtimeRoot;
  }

  async _validateDevelopmentEnvironment(devRoot) {
    const requiredPaths = [
      path.join(devRoot, 'package.json')
    ];

    for (const requiredPath of requiredPaths) {
      try {
        await fs.promises.access(requiredPath, fs.constants.F_OK);
      } catch (error) {
        throw new Error(`Development environment validation failed: ${requiredPath} not found`);
      }
    }
    
    // 检查 @becrafter/prompt-manager-core 在 node_modules 中是否存在
    const coreLibPath = path.join(devRoot, 'node_modules', '@becrafter', 'prompt-manager-core', 'index.js');
    try {
      await fs.promises.access(coreLibPath, fs.constants.F_OK);
    } catch (error) {
      this.logger.debug('Core library not found in node_modules, checking for local packages/server');
      // 如果 node_modules 中不存在，检查 local packages/server 目录
      const localServerPath = path.join(devRoot, 'packages', 'server', 'server.js');
      try {
        await fs.promises.access(localServerPath, fs.constants.F_OK);
      } catch (localError) {
        throw new Error(`Development environment validation failed: neither core library nor local server found (${coreLibPath}, ${localServerPath})`);
      }
    }
    
    this.logger.debug('Development environment validation passed');
  }

  async _validatePackagedResources(packagedRoot) {
    this.logger.debug('Validating packaged resources', { packagedRoot });
    
    // 检查 app.asar 文件是否存在
    if (packagedRoot.endsWith('.asar')) {
      // 在 Electron 中，当代码在 ASAR 包内运行时，对 ASAR 文件的访问方式不同
      // 我们需要检查文件是否存在，但不能依赖 stats.isFile()
      try {
        // 首先尝试使用 fs.access 来检查文件是否存在和可访问
        await fs.promises.access(packagedRoot, fs.constants.F_OK);
        this.logger.debug('Packaged ASAR is accessible via fs.access', { path: packagedRoot });
        return; // Found ASAR file, validation passed
      } catch (accessError) {
        // 如果 fs.access 失败，尝试使用 fs.stat 并检查错误类型
        try {
          const stats = await fs.promises.stat(packagedRoot);
          // 在 ASAR 环境中，即使文件存在，stats.isFile() 也可能返回 false
          // 我们只检查是否存在错误，而不检查文件类型
          this.logger.debug('Packaged ASAR exists via fs.stat', { 
            path: packagedRoot, 
            isFile: stats.isFile(), 
            isDirectory: stats.isDirectory() 
          });
          return; // Found ASAR file, validation passed
        } catch (statError) {
          // 如果两种方法都失败，记录详细信息然后抛出错误
          this.logger.error('Failed to validate packaged resources', {
            path: packagedRoot,
            accessError: accessError.message,
            accessCode: accessError.code,
            statError: statError.message,
            statCode: statError.code,
            processResourcesPath: process.resourcesPath,
            appPath: app.getAppPath()
          });
          throw new Error(`Packaged resources not found: ${packagedRoot} (access: ${accessError.message}, stat: ${statError.message})`);
        }
      }
    } else {
      try {
        const stats = await fs.promises.stat(packagedRoot);
        if (stats.isDirectory() || stats.isFile()) {
          this.logger.debug('Packaged root exists', { path: packagedRoot });
        }
      } catch (error) {
        this.logger.error('Packaged root not found or not accessible', { packagedRoot, error: error.message });
        throw new Error(`Packaged resources not found: ${packagedRoot}`);
      }
    }
  }
  
  // 移除了无用的 _generateVolumePaths 方法

  async _setupRuntimeDirectory(packagedRoot, runtimeRoot) {
    try {
      await fs.promises.access(runtimeRoot, fs.constants.F_OK);
      this.logger.debug('Runtime root already exists');
    } catch (error) {
      this.logger.info('Creating runtime directory', { path: runtimeRoot });
      await fs.promises.mkdir(runtimeRoot, { recursive: true });
      
      this.logger.info('Copying packaged resources to runtime directory');
      
      // 检查是否是 ASAR 文件
      if (packagedRoot.endsWith('.asar')) {
        // 对于 ASAR 文件，我们不需要解压整个包，只需要复制它
        // 但我们需要确保文件存在且可访问
        try {
          await fs.promises.access(packagedRoot, fs.constants.F_OK);
          this.logger.debug('ASAR file exists, copying to runtime directory');
          
          // 复制 ASAR 文件到运行时目录
          const targetAsarPath = path.join(runtimeRoot, 'app.asar');
          await fs.promises.copyFile(packagedRoot, targetAsarPath);
          this.logger.debug('Copied ASAR file to runtime directory', { source: packagedRoot, target: targetAsarPath });
        } catch (copyError) {
          this.logger.error('Failed to copy ASAR file to runtime directory', { 
            source: packagedRoot, 
            error: copyError.message 
          });
          
          // 如果复制失败，记录错误但继续执行
          // 应用程序可能仍然可以运行，因为它可以直接从原始位置访问 ASAR 文件
          this.logger.warn('Continuing without copying ASAR file to runtime directory');
        }
      } else {
        // 如果是普通目录，直接复制
        await fs.promises.cp(packagedRoot, runtimeRoot, { recursive: true });
      }
    }
  }

  async _installDependencies(runtimeRoot) {
    this.logger.info('Installing dependencies in runtime directory');
    
    const ModuleLoader = require('./module-loader');
    const moduleLoader = new ModuleLoader(this.logger, this.errorHandler);
    
    try {
      await moduleLoader.installDependencies(runtimeRoot);
      this.logger.info('Dependencies installed successfully');
    } catch (error) {
      this.logger.error('Failed to install dependencies', error);
      throw error;
    }
  }

  getServerRoot() {
    if (!this.runtimeRoot) {
      throw new Error('Runtime environment not initialized');
    }
    return this.runtimeRoot;
  }

  getPackageInfo() {
    // 优先从 app.asar 压缩包中读取 package.json
    const asarPackagePath = path.join(process.resourcesPath, 'app.asar', 'package.json');
    
    // 尝试从 app.asar 中读取
    try {
      const packageContent = fs.readFileSync(asarPackagePath, 'utf8');
      this.logger.debug('Read package.json from app.asar', { path: asarPackagePath });
      return JSON.parse(packageContent);
    } catch (asarError) {
      // 如果从 app.asar 读取失败，尝试从 app.getAppPath() 读取（开发环境或备用方案）
      try {
        const appPathPackagePath = path.join(app.getAppPath(), 'package.json');
        const packageContent = fs.readFileSync(appPathPackagePath, 'utf8');
        this.logger.debug('Read package.json from app path', { path: appPathPackagePath });
        return JSON.parse(packageContent);
      } catch (appPathError) {
        // 最后尝试从 runtimeRoot 读取（向后兼容）
        if (this.runtimeRoot) {
          try {
            const runtimePackagePath = path.join(this.runtimeRoot, 'package.json');
            const packageContent = fs.readFileSync(runtimePackagePath, 'utf8');
            this.logger.debug('Read package.json from runtime root', { path: runtimePackagePath });
            return JSON.parse(packageContent);
          } catch (runtimeError) {
            this.logger.error('Failed to read package info from all locations', {
              asarError: asarError.message,
              appPathError: appPathError.message,
              runtimeError: runtimeError.message
            });
          }
        } else {
          this.logger.error('Failed to read package info from app.asar and app path', {
            asarError: asarError.message,
            appPathError: appPathError.message
          });
        }
      }
    }
    
    // 所有尝试都失败，返回默认值
    return { version: 'unknown' };
  }

  async cleanup() {
    this.logger.info('Cleaning up runtime environment');
    this.runtimeRoot = null;
  }
}

module.exports = RuntimeManager;