const { dialog, shell, clipboard } = require('electron');
const fs = require('fs');
const path = require('path');
const tar = require('tar');
const os = require('os');
const VersionUtils = require('../utils/version-utils');
const ResourcePaths = require('../utils/resource-paths');

class UpdateManager {
  constructor(logger, errorHandler, runtimeManager) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.runtimeManager = runtimeManager;
    this.packageName = '@becrafter/prompt-manager';
  }

  async checkForUpdates() {
    this.logger.info('Starting update check');
    
    try {
      const currentVersion = await this.getCurrentVersion();
      const latestVersion = await this.fetchLatestVersion();
      
      this.logger.info('Version comparison', { currentVersion, latestVersion });
      
      if (this.compareVersions(latestVersion, currentVersion) <= 0) {
        await this.showAlreadyLatestDialog(currentVersion);
        return false;
      }
      
      const shouldUpdate = await this.showUpdateAvailableDialog(latestVersion, currentVersion);
      
      if (shouldUpdate) {
        await this.performUpdate(latestVersion);
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.logger.error('Update check failed', error);
      this.errorHandler.handleError('UPDATE_CHECK_FAILED', error);
      return false;
    }
  }

  async getCurrentVersion() {
    try {
      const packageInfo = this.runtimeManager.getPackageInfo();
      return packageInfo.version || 'unknown';
    } catch (error) {
      this.logger.error('Failed to get current version', error);
      return 'unknown';
    }
  }

  async fetchLatestVersion() {
    this.logger.info('Fetching latest version from npm registry');
    
    try {
      const response = await fetch(`https://registry.npmjs.org/${this.packageName}`);
      
      if (!response.ok) {
        throw new Error(`NPM registry request failed: ${response.status} ${response.statusText}`);
      }
      
      const metadata = await response.json();
      const latestVersion = metadata?.['dist-tags']?.latest;
      
      if (!latestVersion) {
        throw new Error('Could not parse latest version from npm registry response');
      }
      
      this.logger.info('Latest version fetched', { latestVersion });
      return latestVersion;
      
    } catch (error) {
      this.logger.error('Failed to fetch latest version', error);
      throw new Error(`无法获取最新版本信息: ${error.message}`);
    }
  }

  compareVersions(a, b) {
    return VersionUtils.compareVersions(a, b);
  }

  async showAlreadyLatestDialog(currentVersion) {
    await dialog.showMessageBox({
      type: 'info',
      title: '已是最新版本',
      message: '已是最新版本',
      detail: `服务当前版本：${currentVersion}`
    });
  }

  async showUpdateAvailableDialog(latestVersion, currentVersion) {
    const installCommand = "curl -fsSL 'http://iskill.site/scripts/becrafter-installer.sh' | bash -s prompt-manager";
    
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${latestVersion}`,
      detail: `当前版本：${currentVersion}\n可前往发布页下载并手动更新，或使用安装命令快速更新。`,
      buttons: ['打开发布页', '复制安装命令', '取消'],
      defaultId: 0,
      cancelId: 2
    });

    if (response === 0) {
      shell.openExternal('https://github.com/BeCrafter/prompt-manager/releases/latest');
    } else if (response === 1) {
      clipboard.writeText(installCommand);
      await dialog.showMessageBox({
        type: 'info',
        title: '已复制',
        message: '安装命令已复制到剪贴板',
        detail: installCommand
      });
    }

    return false;
  }

  async performUpdate(version) {
    this.logger.info('Starting update process', { version });
    
    try {
      const wasRunning = await this.stopServiceIfNeeded();
      
      await this.downloadAndInstallUpdate(version);
      
      await this.showUpdateSuccessDialog(version);
      
      if (wasRunning) {
        await this.startService();
      }
      
      this.logger.info('Update completed successfully', { version });
      
    } catch (error) {
      this.logger.error('Update failed', error);
      this.errorHandler.handleError('UPDATE_FAILED', error, { version });
      throw error;
    }
  }

  async stopServiceIfNeeded() {
    // TODO: 需要与服务管理器集成
    // 暂时假设服务未运行
    return false;
  }

  async startService() {
    // TODO: 需要与服务管理器集成
    this.logger.info('Service restart requested after update');
  }

  async downloadAndInstallUpdate(version) {
    this.logger.info('Downloading update', { version });
    
    const tarballUrl = `https://registry.npmjs.org/${this.packageName}/-/${this.packageName}-${version}.tgz`;
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'prompt-manager-update-'));
    const tarballPath = path.join(tmpDir, `${version}.tgz`);
    
    try {
      // 下载更新包
      await this.downloadTarball(tarballUrl, tarballPath);
      
      // 解压更新包
      const extractedPath = await this.extractTarball(tarballPath, tmpDir);
      
      // 执行原地升级
      await this.performInPlaceUpgrade(extractedPath, version);
      
    } finally {
      // 清理临时文件
      this.logger.info('Cleaning up temporary files', { tmpDir });
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  }

  async downloadTarball(url, targetPath) {
    this.logger.info('Downloading tarball', { url, targetPath });
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download tarball: ${response.status} ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(targetPath, buffer);
    
    this.logger.info('Tarball downloaded successfully', { targetPath });
  }

  async extractTarball(tarballPath, targetDir) {
    this.logger.info('Extracting tarball', { tarballPath, targetDir });
    
    await tar.x({ file: tarballPath, cwd: targetDir });
    const extractedPath = path.join(targetDir, 'package');
    
    this.logger.info('Tarball extracted successfully', { extractedPath });
    return extractedPath;
  }

  async performInPlaceUpgrade(extractedPath, version) {
    this.logger.info('Performing in-place upgrade', { extractedPath, version });
    
    const serverRoot = this.runtimeManager.getServerRoot();
    const examplesDir = path.join(serverRoot, 'examples', 'prompts');
    const examplesBackup = path.join(os.tmpdir(), 'prompt-manager-examples-backup');
    
    try {
      // 备份示例文件
      if (await ResourcePaths.pathExists(examplesDir)) {
        this.logger.info('Backing up examples directory', { examplesDir });
        await ResourcePaths.copyDir(examplesDir, examplesBackup);
      }
      
      // 删除旧版本
      this.logger.info('Removing old version', { serverRoot });
      await ResourcePaths.safeRemoveDir(serverRoot);
      
      // 复制新版本
      this.logger.info('Copying new version', { extractedPath, serverRoot });
      await ResourcePaths.ensureDir(serverRoot);
      await ResourcePaths.copyDir(extractedPath, serverRoot);
      
      // 恢复示例文件
      if (await ResourcePaths.pathExists(examplesBackup)) {
        this.logger.info('Restoring examples directory', { examplesBackup });
        const targetExamples = path.join(serverRoot, 'examples', 'prompts');
        await ResourcePaths.ensureDir(path.dirname(targetExamples));
        await ResourcePaths.copyDir(examplesBackup, targetExamples);
      }
      
      // 重新安装依赖
      await this.reinstallDependencies(serverRoot);
      
      // 清理模块缓存
      this.moduleLoader?.clearCache(serverRoot);
      
    } finally {
      // 清理备份文件
      if (await ResourcePaths.pathExists(examplesBackup)) {
        await ResourcePaths.safeRemoveDir(examplesBackup);
      }
    }
  }

  async reinstallDependencies(serverRoot) {
    this.logger.info('Reinstalling dependencies', { serverRoot });
    
    const ModuleLoader = require('./module-loader');
    const moduleLoader = new ModuleLoader(this.logger, this.errorHandler);
    
    await moduleLoader.installDependencies(serverRoot);
    
    this.logger.info('Dependencies reinstalled successfully');
  }

  async showUpdateSuccessDialog(version) {
    await dialog.showMessageBox({
      type: 'info',
      title: '升级成功',
      message: '升级成功',
      detail: `服务已升级到 ${version}`
    });
  }

  async pathExists(targetPath) {
    return ResourcePaths.pathExists(targetPath);
  }
}

module.exports = UpdateManager;