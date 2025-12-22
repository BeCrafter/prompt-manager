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
    
    const runtimeRoot = path.join(app.getPath('userData'), 'prompt-manager');
    
    this.logger.debug('Environment paths', { 
      runtimeRoot,
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath()
    });
    
    // 确保 runtimeRoot 存在
    await fs.promises.mkdir(runtimeRoot, { recursive: true });
    
    // 创建系统工具目录结构
    const toolsDir = path.join(runtimeRoot, 'tools');
    await fs.promises.mkdir(toolsDir, { recursive: true });
    
    // 检查并复制系统工具（如果存在）
    const appPath = app.getAppPath();
    const sourceToolsPath = path.join(appPath, 'runtime', 'toolbox');
    
    try {
      // 检查源工具目录是否存在
      const sourceExists = await this._pathExists(sourceToolsPath);
      if (sourceExists) {
        // 复制工具目录
        await fs.promises.cp(sourceToolsPath, toolsDir, { recursive: true });
        this.logger.info('Copied system tools to runtime directory');
      } else {
        this.logger.warn('System tools not found in packaged app, creating minimal directory structure');
        
        // 创建基本的工具目录结构
        const toolDirs = ['chrome-devtools', 'file-reader', 'filesystem', 'ollama-remote', 'pdf-reader', 'playwright', 'todolist'];
        for (const dir of toolDirs) {
          const dirPath = path.join(toolsDir, dir);
          await fs.promises.mkdir(dirPath, { recursive: true });
          
          // 在每个目录中创建一个空的 package.json 文件
          const packageJsonPath = path.join(dirPath, 'package.json');
          const emptyPackageJson = {
            name: `prompt-manager-${dir}`,
            version: "1.0.0",
            description: `Placeholder for ${dir} tool`
          };
          
          await fs.promises.writeFile(
            packageJsonPath,
            JSON.stringify(emptyPackageJson, null, 2),
            'utf8'
          );
        }
        
        this.logger.info('Created minimal system tools directory structure');
      }
    } catch (error) {
      this.logger.warn('Failed to setup system tools directory', { error: error.message });
      // 即使工具目录设置失败，也不影响主程序运行
    }
    
    // 复制必要的配置文件到运行时目录
    const packageJsonPath = path.join(appPath, 'package.json');
    const targetPackageJsonPath = path.join(runtimeRoot, 'package.json');
    
    try {
      await fs.promises.copyFile(packageJsonPath, targetPackageJsonPath);
      this.logger.debug('Copied package.json to runtime directory');
    } catch (error) {
      this.logger.warn('Failed to copy package.json, using fallback', { error: error.message });
      
      // 创建一个基本的 package.json
      const basicPackageJson = {
        name: 'prompt-manager-runtime',
        version: '1.0.0',
        dependencies: {
          '@becrafter/prompt-manager-core': '^0.0.19',
          '@modelcontextprotocol/sdk': '^1.20.2'
        }
      };
      
      await fs.promises.writeFile(
        targetPackageJsonPath, 
        JSON.stringify(basicPackageJson, null, 2), 
        'utf8'
      );
    }
    
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

  /**
   * 检查文件或目录是否存在
   * @param {string} targetPath - 目标路径
   * @returns {Promise<boolean>} - 是否存在
   */
  async _pathExists(targetPath) {
    const fs = require('fs/promises');
    const { constants } = require('fs');
    
    try {
      // 对于 ASAR 文件，使用多种方式验证存在性
      if (targetPath.includes('.asar')) {
        try {
          // 方法1：尝试使用 fs.stat
          const stats = await fs.stat(targetPath);
          return stats.isFile() || stats.isDirectory();
        } catch (statError) {
          // 如果 stat 失败，尝试其他方法
          this.logger.debug('ASAR stat failed', { 
            path: targetPath, 
            error: statError.message 
          });
        }
        
        try {
          // 方法2：尝试使用 fs.access
          await fs.access(targetPath, constants.F_OK);
          return true;
        } catch (accessError) {
          this.logger.debug('ASAR access failed', { 
            path: targetPath, 
            error: accessError.message 
          });
          return false;
        }
      }
      
      // 普通文件检查
      await fs.access(targetPath, constants.F_OK);
      return true;
    } catch (error) {
      this.logger.debug('File access check failed', { 
        path: targetPath, 
        error: error.message 
      });
      return false;
    }
  }

  async cleanup() {
    this.logger.info('Cleaning up runtime environment');
    this.runtimeRoot = null;
  }
}

module.exports = RuntimeManager;