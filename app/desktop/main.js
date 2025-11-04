const electron = require('electron');
const { app, BrowserWindow, Tray, Menu, clipboard, dialog, nativeImage, shell, ipcMain } = electron;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const tar = require('tar');
const { spawn } = require('child_process');

// 设置日志文件
const logFilePath = path.join(app.getPath('userData'), 'prompt-manager-desktop.log');
let logStream;

// 初始化日志流
function initLogStream() {
  try {
    // 确保日志目录存在
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // 创建或追加到日志文件
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    console.log = function(...args) {
      const message = `[${new Date().toISOString()}] [INFO] ${args.join(' ')}\n`;
      process.stdout.write(message);
      if (logStream && (debugLogEnabled || args.some(arg => typeof arg === 'string' && arg.toLowerCase().includes('error')))) {
        logStream.write(message);
      }
    };
    
    console.error = function(...args) {
      const message = `[${new Date().toISOString()}] [ERROR] ${args.join(' ')}\n`;
      process.stderr.write(message);
      if (logStream) { // 错误日志始终记录
        logStream.write(message);
      }
    };
    
    console.warn = function(...args) {
      const message = `[${new Date().toISOString()}] [WARN] ${args.join(' ')}\n`;
      process.stdout.write(message);
      if (logStream && debugLogEnabled) {
        logStream.write(message);
      }
    };
    
    console.debug = function(...args) {
      const message = `[${new Date().toISOString()}] [DEBUG] ${args.join(' ')}\n`;
      process.stdout.write(message);
      if (logStream && debugLogEnabled) {
        logStream.write(message);
      }
    };
    
    console.log(`Logging initialized. Log file: ${logFilePath}`);
    console.log(`Debug logging is ${debugLogEnabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Failed to initialize logging:', error);
  }
}

let tray = null;
let adminWindow = null;
let serviceState = 'stopped';
let currentServerState = null;
let serverModule = null;
let serverModuleVersion = 0;
let serverModuleLoading = null;
let isQuitting = false;
let runtimeServerRoot = null;
let startFailureCount = 0;
let aboutClickCount = 0; // 用于跟踪关于服务按钮的点击次数
let lastAboutClickTime = 0; // 用于跟踪上次点击时间，实现超时重置
let debugLogEnabled = false; // 调试日志开关状态
let aboutWindowClickCount = 0; // 用于跟踪关于窗口内的点击次数
let lastWindowClickTime = 0; // 用于跟踪窗口内上次点击时间，实现超时重置

const desktopPackageJson = JSON.parse(
  console.log('1111', path.join(__dirname, 'package.json'));
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

function resolveBaseServerRoot() {
  return path.resolve(__dirname, '..', '..');
}

async function ensureRuntimeServerRoot() {
  if (runtimeServerRoot) {
    console.log('Using cached runtimeServerRoot:', runtimeServerRoot);
    return runtimeServerRoot;
  }

  if (!app.isPackaged) {
    console.log('App is not packaged, using development server root');
    runtimeServerRoot = resolveBaseServerRoot();
    console.log('Development server root:', runtimeServerRoot);
    return runtimeServerRoot;
  }

  console.log('App is packaged, setting up runtime server root');
  console.log('process.resourcesPath:', process.resourcesPath);
  console.log('app.getPath("userData"):', app.getPath('userData'));
  
  const packagedRoot = path.join(process.resourcesPath, 'prompt-manager');
  const runtimeRoot = path.join(app.getPath('userData'), 'prompt-manager');
  
  console.log('packagedRoot:', packagedRoot);
  console.log('runtimeRoot:', runtimeRoot);

  try {
    // 检查打包的资源目录是否存在
    try {
      await fs.promises.access(packagedRoot, fs.constants.F_OK);
      console.log('Packaged root exists');
    } catch (error) {
      console.error('Packaged root does not exist:', packagedRoot);
      throw new Error(`Packaged root not found: ${packagedRoot}`);
    }
    
    // 检查运行时目录是否存在
    let needsInstall = false;
    try {
      await fs.promises.access(runtimeRoot, fs.constants.F_OK);
      console.log('Runtime root already exists');
      
      // 检查是否需要安装依赖
      try {
        await fs.promises.access(path.join(runtimeRoot, 'node_modules'), fs.constants.F_OK);
        console.log('node_modules already exists in runtime root');
      } catch (error) {
        console.log('node_modules not found in runtime root, will install dependencies');
        needsInstall = true;
      }
    } catch (error) {
      console.log('Runtime root does not exist, creating and copying files');
      await fs.promises.mkdir(runtimeRoot, { recursive: true });
      console.log('Created runtime root directory');
      
      // 复制文件并显示进度
      console.log('Copying files from packaged root to runtime root...');
      await fs.promises.cp(packagedRoot, runtimeRoot, { recursive: true });
      console.log('File copy completed');
      needsInstall = true;
    }
    
    // 如果需要安装依赖
    if (needsInstall) {
      console.log('Installing dependencies in runtime root');
      try {
        await installServerDependencies(runtimeRoot);
        console.log('Dependencies installed successfully');
      } catch (error) {
        console.error('Failed to install dependencies:', error);
        dialog.showErrorBox('依赖安装失败', `无法安装服务器依赖: ${error.message}\n\n请查看日志文件: ${logFilePath}`);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in ensureRuntimeServerRoot:', error);
    dialog.showErrorBox('服务器初始化失败', `无法设置服务器运行环境: ${error.message}\n\n请查看日志文件: ${logFilePath}`);
    throw error;
  }

  runtimeServerRoot = runtimeRoot;
  console.log('Final runtimeServerRoot:', runtimeServerRoot);
  return runtimeServerRoot;
}

async function loadServerModule(options = {}) {
  console.log('loadServerModule called with options:', options);
  console.log('Current serviceState:', serviceState);
  console.log('serverModule exists:', !!serverModule);
  console.log('serverModuleLoading exists:', !!serverModuleLoading);
  
  // 如果强制重新加载或服务状态异常，则清理缓存
  if (options.forceReload || serviceState === 'error' || serviceState === 'stopped') {
    console.log('Forcing module reload, clearing cache');
    serverModule = null;
    serverModuleVersion += 1;
    serverModuleLoading = null;
  }

  if (serverModule) {
    console.log('Returning cached server module');
    return serverModule;
  }

  if (serverModuleLoading) {
    console.log('Module loading in progress, returning promise');
    return serverModuleLoading;
  }

  try {
    const serverRoot = await ensureRuntimeServerRoot();
    console.log('Server root resolved to:', serverRoot);
    
    const serverEntry = path.join(serverRoot, 'packages', 'server', 'server.js');
    console.log('Server entry file:', serverEntry);
    
    // 检查入口文件是否存在
    try {
      await fs.promises.access(serverEntry, fs.constants.F_OK);
      console.log('Server entry file exists');
    } catch (error) {
      console.error('Server entry file does not exist:', serverEntry);
      throw new Error(`Server entry file not found: ${serverEntry}`);
    }
    
    const entryUrl = pathToFileURL(serverEntry);
    entryUrl.searchParams.set('v', String(serverModuleVersion));
    console.log('Entry URL:', entryUrl.href);
    
    serverModuleLoading = import(entryUrl.href)
      .then((mod) => {
        console.log('Module loaded successfully');
        serverModule = mod;
        return mod;
      })
      .catch((error) => {
        console.error('Module loading failed:', error);
        // 清理加载状态，以便下次重试
        serverModuleLoading = null;
        serverModule = null;
        throw new Error(`Failed to load server module: ${error.message}`);
      })
      .finally(() => {
        serverModuleLoading = null;
      });
      
    return serverModuleLoading;
  } catch (error) {
    console.error('Error in loadServerModule:', error);
    dialog.showErrorBox('模块加载失败', error.message);
    throw error;
  }
}

function getServerStatusLabel() {
  switch (serviceState) {
    case 'running':
      return '运行中';
    case 'starting':
      return '启动中';
    case 'stopping':
      return '停止中';
    case 'error':
      return '启动失败';
    default:
      return '已停止';
  }
}

async function startService() {
  console.log('startService called');
  // 如果正在运行或正在启动，直接返回
  if (serviceState === 'running' || serviceState === 'starting') {
    console.log('Service is already running or starting, returning');
    return;
  }

  serviceState = 'starting';
  console.log('Service state set to starting');
  refreshTrayMenu();

  try {
    console.log('Loading server module with force reload');
    // 强制重新加载模块以确保获取最新状态
    const module = await loadServerModule({ forceReload: true });
    console.log('Server module loaded, starting server');
    
    if (!module || typeof module.startServer !== 'function') {
      throw new Error('Invalid server module or missing startServer function');
    }
    
    // 在启动服务器之前，确保停止任何可能的旧服务器实例
    if (typeof module.stopServer === 'function') {
      try {
        await module.stopServer();
        console.log('Any existing server instance stopped');
      } catch (error) {
        console.log('No existing server instance to stop or error stopping it:', error.message);
      }
    }
    
    await module.startServer();
    console.log('Server started successfully');
    currentServerState = module.getServerState();
    serviceState = 'running';
    startFailureCount = 0; // 重置失败计数
    console.log('Service state set to running');
  } catch (error) {
    serviceState = 'error';
    currentServerState = null;
    startFailureCount++;
    
    console.error('服务启动失败:', error);
    console.error('Error stack:', error.stack);
    
    // 如果连续失败3次，提示用户重启应用
    if (startFailureCount >= 3) {
      console.log('Too many start failures, prompting for restart');
      await promptForRestart();
    } else {
      dialog.showErrorBox('服务启动失败', `${error?.message || String(error)}\n\n请查看控制台日志获取更多信息。`);
    }
  } finally {
    console.log('Refreshing tray menu');
    refreshTrayMenu();
  }
}

async function stopService() {
  // 如果服务未运行或正在停止，直接返回
  if (serviceState !== 'running' && serviceState !== 'error') {
    return;
  }

  serviceState = 'stopping';
  refreshTrayMenu();

  try {
    const module = await loadServerModule();
    if (module && typeof module.stopServer === 'function') {
      await module.stopServer();
    }
    currentServerState = null;
    serviceState = 'stopped';
    
    // 清理MCP会话和传输
    console.log('Clearing MCP sessions and transports');
    
    // 清理模块缓存，确保下次启动时重新加载
    serverModule = null;
    serverModuleVersion += 1;
    serverModuleLoading = null;
  } catch (error) {
    console.error('停止服务失败:', error);
    dialog.showErrorBox('停止服务失败', error?.message || String(error));
    serviceState = 'error';
  } finally {
    refreshTrayMenu();
  }
}

function ensureTray() {
  if (tray) {
    return tray;
  }

  // 尝试多种可能的图标路径
  const possiblePaths = [
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(process.resourcesPath, 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png')
  ];

  let iconPath = null;
  let icon = null;
  
  console.log('App is packaged:', app.isPackaged);
  console.log('__dirname:', __dirname);
  console.log('process.resourcesPath:', process.resourcesPath);
  
  for (const possiblePath of possiblePaths) {
    console.log('Checking icon path:', possiblePath);
    console.log('File exists:', fs.existsSync(possiblePath));
    if (fs.existsSync(possiblePath)) {
      iconPath = possiblePath;
      break;
    }
  }
  
  if (!iconPath) {
    console.error('Icon file not found in any of the expected locations');
    // 创建一个简单的文本托盘作为后备
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip('Prompt Server - Icon Missing');
    refreshTrayMenu();
    return tray;
  }
  
  console.log('Attempting to load icon from:', iconPath);
  
  try {
    icon = nativeImage.createFromPath(iconPath);
    console.log('Icon loaded successfully');
    console.log('Icon is empty:', icon.isEmpty());
    console.log('Icon size:', icon.getSize());
    
    if (process.platform === 'darwin') {
      icon = icon.resize({ width: 18, height: 18 });
      icon.setTemplateImage(true);
      console.log('Icon resized and set as template image');
    }

    tray = new Tray(icon);
    tray.setToolTip('Prompt Server');
    console.log('Tray created successfully');
    refreshTrayMenu();
    return tray;
  } catch (error) {
    console.error('Failed to create tray:', error);
    // 创建一个简单的文本托盘作为后备
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip('Prompt Server - Error');
    refreshTrayMenu();
    return tray;
  }
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const address = currentServerState?.address ?? 'http://127.0.0.1:5621';
  const adminUrl = currentServerState?.adminPath ? `${address}${currentServerState.adminPath}` : `${address}/admin`;

  const template = [
    { label: `状态：${getServerStatusLabel()}`, enabled: false },
    { type: 'separator' },
    {
      label: serviceState === 'running' ? '停止服务' : '启动服务',
      click: () => (serviceState === 'running' ? stopService() : startService())
    },
    {
      label: '复制服务地址',
      enabled: serviceState === 'running',
      click: () => clipboard.writeText(`${address}/mcp`)
    },
    {
      label: '打开管理后台',
      enabled: serviceState === 'running',
      click: () => openAdminWindow(adminUrl)
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => checkForUpdates()
    },
    {
      label: '关于服务',
      click: () => showAboutDialog()
    },
    { type: 'separator' },
    {
      label: '退出服务',
      click: async () => {
        isQuitting = true;
        await stopService();
        if (logStream) {
          logStream.end();
        }
        app.quit();
      }
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  tray.setContextMenu(menu);
}

function openAdminWindow(url) {
  if (adminWindow) {
    adminWindow.focus();
    return;
  }

  adminWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Prompt Server 管理后台',
    webPreferences: {
      contextIsolation: true,
      preload: undefined
    }
  });

  adminWindow.loadURL(url);
  adminWindow.on('closed', () => {
    adminWindow = null;
  });
}

async function getCurrentServiceVersion() {
  try {
    const serverRoot = await ensureRuntimeServerRoot();
    const pkgRaw = await fs.promises.readFile(path.join(serverRoot, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);
    return pkg.version;
  } catch (error) {
    return 'unknown';
  }
}

function compareVersions(a, b) {
  const toNumbers = (value = '') => value.split('.').map((part) => parseInt(part, 10) || 0);
  const [a1, a2, a3] = toNumbers(a);
  const [b1, b2, b3] = toNumbers(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

async function checkForUpdates() {
  try {
    const currentVersion = await getCurrentServiceVersion();

    const response = await fetch('https://registry.npmjs.org/@becrafter/prompt-manager');
    if (!response.ok) {
      throw new Error('无法获取最新版本信息');
    }

    const metadata = await response.json();
    const latestVersion = metadata?.['dist-tags']?.latest;

    if (!latestVersion) {
      throw new Error('未能解析最新版本号');
    }

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      await dialog.showMessageBox({
        type: 'info',
        message: '已是最新版本',
        detail: `服务当前版本：${currentVersion}`
      });
      return;
    }

    const { response: action } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['立即升级', '打开发布页', '取消'],
      defaultId: 0,
      cancelId: 2,
      message: `发现新版本 ${latestVersion}`,
      detail: '升级期间服务会短暂停止，是否继续？'
    });

    if (action === 1) {
      shell.openExternal('https://github.com/BeCrafter/prompt-manager/releases/latest');
      return;
    }

    if (action !== 0) {
      return;
    }

    const wasRunning = serviceState === 'running';
    if (wasRunning) {
      await stopService();
    }

    await performInPlaceUpgrade(latestVersion);

    await dialog.showMessageBox({
      type: 'info',
      message: '升级成功',
      detail: `服务已升级到 ${latestVersion}`
    });

    if (wasRunning) {
      await startService();
    }
  } catch (error) {
    dialog.showErrorBox('检查更新失败', error?.message || String(error));
  }
}

async function performInPlaceUpgrade(version) {
  console.log('Performing in-place upgrade to version:', version);
  const tarballUrl = `https://registry.npmjs.org/@becrafter/prompt-manager/-/@becrafter/prompt-manager-${version}.tgz`;
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'prompt-manager-upgrade-'));
  const tarballPath = path.join(tmpDir, `${version}.tgz`);
  
  console.log('Temporary directory:', tmpDir);

  try {
    console.log('Downloading tarball from:', tarballUrl);
    const response = await fetch(tarballUrl);
    if (!response.ok) {
      throw new Error(`Failed to download tarball: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(tarballPath, buffer);
    console.log('Tarball downloaded to:', tarballPath);

    await tar.x({ file: tarballPath, cwd: tmpDir });
    const extractedPath = path.join(tmpDir, 'package');
    console.log('Tarball extracted to:', extractedPath);

    const serverRoot = await ensureRuntimeServerRoot();
    const examplesDir = path.join(serverRoot, 'examples', 'prompts');
    const examplesBackup = path.join(tmpDir, 'examples-prompts');

    if (await pathExists(examplesDir)) {
      console.log('Backing up examples directory');
      await fs.promises.cp(examplesDir, examplesBackup, { recursive: true });
    }

    console.log('Removing old server root');
    await fs.promises.rm(serverRoot, { recursive: true, force: true });
    await fs.promises.mkdir(serverRoot, { recursive: true });
    
    console.log('Copying extracted package to server root');
    await fs.promises.cp(extractedPath, serverRoot, { recursive: true });

    if (await pathExists(examplesBackup)) {
      console.log('Restoring examples directory');
      const targetExamples = path.join(serverRoot, 'examples', 'prompts');
      await fs.promises.mkdir(path.dirname(targetExamples), { recursive: true });
      await fs.promises.cp(examplesBackup, targetExamples, { recursive: true });
    }

    console.log('Installing server dependencies');
    await installServerDependencies(serverRoot);
    
    console.log('Reloading server module');
    await loadServerModule({ forceReload: true });
    
    console.log('Upgrade completed successfully');
  } catch (error) {
    console.error('Upgrade failed:', error);
    throw error;
  } finally {
    console.log('Cleaning up temporary directory');
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

async function pathExists(targetPath) {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

async function installServerDependencies(targetDir) {
  console.log('Installing server dependencies in:', targetDir);
  
  // 检查 targetDir 是否存在 package.json
  const pkgPath = path.join(targetDir, 'package.json');
  try {
    await fs.promises.access(pkgPath, fs.constants.F_OK);
    console.log('package.json found in target directory');
  } catch (error) {
    console.error('package.json not found in target directory:', pkgPath);
    throw new Error(`package.json not found in ${targetDir}`);
  }
  
  // 检查 @modelcontextprotocol/sdk 是否在 dependencies 中
  try {
    const pkgContent = await fs.promises.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgContent);
    if (!pkg.dependencies || !pkg.dependencies['@modelcontextprotocol/sdk']) {
      console.warn('@modelcontextprotocol/sdk not found in dependencies, adding it');
      pkg.dependencies = pkg.dependencies || {};
      pkg.dependencies['@modelcontextprotocol/sdk'] = '^1.20.2';
      await fs.promises.writeFile(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error checking/adding @modelcontextprotocol/sdk to package.json:', error);
  }
  
  // 在生产环境中，我们不需要重新安装依赖，因为它们应该已经打包在应用中
  // 只在开发环境中尝试安装依赖
  if (!app.isPackaged) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = ['install', '--omit=dev', '--no-audit', '--no-fund'];
    
    console.log('Running npm install with args:', args);

    await new Promise((resolve, reject) => {
      const child = spawn(npmCommand, args, {
        cwd: targetDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const output = data.toString().trim();
        stdout += output;
        console.log(`[npm stdout] ${output}`);
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString().trim();
        stderr += output;
        console.error(`[npm stderr] ${output}`);
      });

      child.on('error', (error) => {
        console.error('npm process error:', error);
        reject(new Error(`Failed to start npm process: ${error.message}`));
      });

      child.on('close', (code) => {
        console.log('npm process exited with code:', code);
        if (code === 0) {
          console.log('npm install completed successfully');
          resolve();
        } else {
          const errorMsg = `npm install failed with exit code ${code}: ${stderr}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });
    });
  } else {
    console.log('App is packaged, skipping npm install');
    // 在生产环境中，检查 node_modules 是否存在
    const nodeModulesPath = path.join(targetDir, 'node_modules');
    try {
      await fs.promises.access(nodeModulesPath, fs.constants.F_OK);
      console.log('node_modules found in packaged app');
    } catch (error) {
      console.warn('node_modules not found in packaged app, this may cause issues');
    }
  }
}

async function promptForRestart() {
  const { response } = await dialog.showMessageBox({
    type: 'error',
    buttons: ['重启应用', '取消'],
    defaultId: 0,
    cancelId: 1,
    message: '服务启动失败',
    detail: '多次尝试启动服务均失败，建议重启应用以恢复正常状态。'
  });

  if (response === 0) {
    app.relaunch();
    app.exit(0);
  }
}


let aboutWindow = null;

// 渲染关于页面模板
function renderAboutPage(options = {}) {
  const {
    version = desktopPackageJson.version,
    electronVersion = process.versions.electron,
    nodeVersion = process.versions.node,
    debugLogEnabled = false,
    clickCount = 3,
    logFilePath = ''
  } = options;
  
  // 读取HTML模板文件
  const templatePath = path.join(__dirname, 'about.html');
  let htmlContent = fs.readFileSync(templatePath, 'utf8');
  
  // 读取logo图片并转换为base64
  const logoPath = path.join(__dirname, 'assets', 'icon_64x64.png');
  let logoData = '';
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoData = logoBuffer.toString('base64');
  }
  
  // 简单的模板替换
  htmlContent = htmlContent
    .replace('{{version}}', version)
    .replace('{{electronVersion}}', electronVersion)
    .replace('{{nodeVersion}}', nodeVersion)
    .replace('{{clickCount}}', clickCount)
    .replace('{{logFilePath}}', logFilePath)
    .replace('{{logoData}}', logoData)
    // 处理完整的条件渲染块（非贪婪匹配）
    .replace(/\{\{#if debugLogEnabled\}\}([\s\S]*?)\{\{\/if\}\}/g, debugLogEnabled ? '$1' : '')
    // 处理内联的条件值
    .replace(/\{\{#if debugLogEnabled\}\}([^}]+)\{\{else\}\}([^}]+)\{\{\/if\}\}/g, debugLogEnabled ? '$1' : '$2');
  
  return htmlContent;
}

function showAboutDialog() {
  // 如果窗口已存在，直接聚焦
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  // 创建关于服务窗口
  aboutWindow = new BrowserWindow({
    width: 400,
    height: 320,
    title: '关于 Prompt Manager',
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // 设置为false以允许preload脚本运行
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 生成关于信息内容
  const infoContent = renderAboutPage({
    debugLogEnabled: debugLogEnabled,
    clickCount: 3 - aboutWindowClickCount
  });

  aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(infoContent)}`);

  // 监听窗口内的点击事件
  aboutWindow.webContents.on('did-finish-load', () => {
    aboutWindow.webContents.executeJavaScript(`
      document.addEventListener('click', (event) => {
        const currentTime = Date.now();
        
        // 发送点击信息到主进程
        if (window.electronAPI) {
          window.electronAPI.sendAboutWindowClick({
            currentTime: currentTime
          });
        }
      });
    `);
  });

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

app.whenReady().then(async () => {
  // 初始化日志
  initLogStream();
  console.log('App is packaged:', app.isPackaged);
  console.log('App data path:', app.getPath('userData'));
  console.log('Resources path:', process.resourcesPath);
  console.log('__dirname:', __dirname);
  console.log('Process platform:', process.platform);
  console.log('Process version:', process.version);
  console.log('Electron version:', process.versions.electron);
  
  Menu.setApplicationMenu(null);
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  try {
    await ensureRuntimeServerRoot();
    console.log('Runtime server root ensured successfully');
    ensureTray();
    console.log('System tray ensured successfully');
    await startService();
    console.log('Service started successfully');
  } catch (error) {
    console.error('Error during app initialization:', error);
    dialog.showErrorBox('应用初始化失败', `启动过程中发生错误: ${error.message}\n\n请查看日志文件: ${logFilePath}`);
  }
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

app.on('before-quit', async (event) => {
  if (isQuitting) {
    return;
  }
  event.preventDefault();
  isQuitting = true;
  await stopService();
  if (logStream) {
    logStream.end();
  }
  app.quit();
});

// 监听关于窗口的点击事件
ipcMain.on('about-window-click', (event, data) => {
  const currentTime = Date.now();
  
  // 如果距离上次点击超过3秒，重置计数器
  if (currentTime - lastWindowClickTime > 3000) {
    aboutWindowClickCount = 0;
  }
  
  // 更新点击时间和计数器
  lastWindowClickTime = currentTime;
  aboutWindowClickCount++;
  
  // 如果点击了3次，切换调试日志状态
  if (aboutWindowClickCount >= 3) {
    aboutWindowClickCount = 0; // 重置计数器
    debugLogEnabled = !debugLogEnabled;
    
    // 显示状态变更消息
    if (aboutWindow) {
      const infoContent = renderAboutPage({
        debugLogEnabled: debugLogEnabled,
        clickCount: 3 - aboutWindowClickCount,
        logFilePath: logFilePath
      });
      
      aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(infoContent)}`);
    }
    
    // 如果开启了调试日志，显示日志文件路径
    // if (debugLogEnabled) {
    //   dialog.showMessageBox({
    //     type: 'info',
    //     title: '调试日志已开启',
    //     message: '调试日志已开启',
    //     detail: `日志文件路径: ${logFilePath}\n\n现在将记录更多详细信息。`
    //   });
    // }
  } else {
    // 更新窗口内容显示剩余点击次数
    if (aboutWindow) {
      const infoContent = renderAboutPage({
        debugLogEnabled: debugLogEnabled,
        clickCount: 3 - aboutWindowClickCount,
        logFilePath: logFilePath
      });
      
      aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(infoContent)}`);
    }
  }
});

app.on('activate', () => {
  if (!tray) {
    ensureTray();
  }
});
