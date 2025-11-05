const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class RuntimeManager {
  constructor(logger, errorHandler) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.runtimeRoot = null;
    this.isPackaged = app.isPackaged;
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
    
    const packagedRoot = path.join(process.resourcesPath, 'prompt-manager');
    const runtimeRoot = path.join(app.getPath('userData'), 'prompt-manager');
    
    this.logger.debug('Environment paths', { packagedRoot, runtimeRoot });
    
    // 验证打包资源
    await this._validatePackagedResources(packagedRoot);
    
    // 设置运行时目录
    await this._setupRuntimeDirectory(packagedRoot, runtimeRoot);
    
    this.runtimeRoot = runtimeRoot;
    return runtimeRoot;
  }

  async _validateDevelopmentEnvironment(devRoot) {
    const requiredPaths = [
      path.join(devRoot, 'package.json'),
      path.join(devRoot, 'packages', 'server', 'server.js')
    ];

    for (const requiredPath of requiredPaths) {
      try {
        await fs.promises.access(requiredPath, fs.constants.F_OK);
      } catch (error) {
        throw new Error(`Development environment validation failed: ${requiredPath} not found`);
      }
    }
    
    this.logger.debug('Development environment validation passed');
  }

  async _validatePackagedResources(packagedRoot) {
    try {
      await fs.promises.access(packagedRoot, fs.constants.F_OK);
      this.logger.debug('Packaged root exists', { path: packagedRoot });
    } catch (error) {
      throw new Error(`Packaged resources not found: ${packagedRoot}`);
    }
  }

  async _setupRuntimeDirectory(packagedRoot, runtimeRoot) {
    try {
      await fs.promises.access(runtimeRoot, fs.constants.F_OK);
      this.logger.debug('Runtime root already exists');
    } catch (error) {
      this.logger.info('Creating runtime directory', { path: runtimeRoot });
      await fs.promises.mkdir(runtimeRoot, { recursive: true });
      
      this.logger.info('Copying packaged resources to runtime directory');
      await fs.promises.cp(packagedRoot, runtimeRoot, { recursive: true });
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
    if (!this.runtimeRoot) {
      throw new Error('Runtime environment not initialized');
    }
    
    const packagePath = path.join(this.runtimeRoot, 'package.json');
    
    try {
      const packageContent = fs.readFileSync(packagePath, 'utf8');
      return JSON.parse(packageContent);
    } catch (error) {
      this.logger.error('Failed to read package info', error);
      return { version: 'unknown' };
    }
  }

  async cleanup() {
    this.logger.info('Cleaning up runtime environment');
    this.runtimeRoot = null;
  }
}

module.exports = RuntimeManager;