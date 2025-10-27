const electron = require('electron');
const { app, BrowserWindow, Tray, Menu, clipboard, dialog, nativeImage, shell } = electron;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const tar = require('tar');
const { spawn } = require('child_process');

let tray = null;
let adminWindow = null;
let serviceState = 'stopped';
let currentServerState = null;
let serverModule = null;
let serverModuleVersion = 0;
let serverModuleLoading = null;
let isQuitting = false;
let runtimeServerRoot = null;

const desktopPackageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

function resolveBaseServerRoot() {
  return path.resolve(__dirname, '..', '..');
}

async function ensureRuntimeServerRoot() {
  if (runtimeServerRoot) {
    return runtimeServerRoot;
  }

  if (!app.isPackaged) {
    runtimeServerRoot = resolveBaseServerRoot();
    return runtimeServerRoot;
  }

  const packagedRoot = path.join(process.resourcesPath, 'prompt-server');
  const runtimeRoot = path.join(app.getPath('userData'), 'prompt-server');

  try {
    await fs.promises.access(runtimeRoot, fs.constants.F_OK);
  } catch (error) {
    await fs.promises.mkdir(runtimeRoot, { recursive: true });
    await fs.promises.cp(packagedRoot, runtimeRoot, { recursive: true });
  }

  runtimeServerRoot = runtimeRoot;
  return runtimeServerRoot;
}

async function loadServerModule(options = {}) {
  if (options.forceReload) {
    serverModule = null;
    serverModuleVersion += 1;
  }

  if (serverModule) {
    return serverModule;
  }

  if (serverModuleLoading) {
    return serverModuleLoading;
  }

  const serverRoot = await ensureRuntimeServerRoot();
  const serverEntry = path.join(serverRoot, 'packages', 'server', 'server.js');
  const entryUrl = pathToFileURL(serverEntry);
  entryUrl.searchParams.set('v', String(serverModuleVersion));
  serverModuleLoading = import(entryUrl.href)
    .then((mod) => {
      serverModule = mod;
      return mod;
    })
    .finally(() => {
      serverModuleLoading = null;
    });
  return serverModuleLoading;
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
  if (serviceState === 'running' || serviceState === 'starting') {
    return;
  }

  serviceState = 'starting';
  refreshTrayMenu();

  try {
    const module = await loadServerModule();
    await module.startServer();
    currentServerState = module.getServerState();
    serviceState = 'running';
  } catch (error) {
    serviceState = 'error';
    currentServerState = null;
    dialog.showErrorBox('服务启动失败', error?.message || String(error));
  } finally {
    refreshTrayMenu();
  }
}

async function stopService() {
  if (serviceState !== 'running') {
    return;
  }

  serviceState = 'stopping';
  refreshTrayMenu();

  try {
    const module = await loadServerModule();
    await module.stopServer();
    currentServerState = null;
    serviceState = 'stopped';
  } catch (error) {
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

  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') {
    icon = icon.resize({ width: 18, height: 18 });
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Prompt Server');
  refreshTrayMenu();
  return tray;
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const address = currentServerState?.address ?? 'http://127.0.0.1:5621';
  const adminUrl = currentServerState?.adminPath ? `${address}${currentServerState.adminPath}` : `${address}/admin`;

  const template = [
    { label: `服务状态：${getServerStatusLabel()}`, enabled: false },
    { type: 'separator' },
    {
      label: serviceState === 'running' ? '停止服务' : '启动服务',
      click: () => (serviceState === 'running' ? stopService() : startService())
    },
    {
      label: '复制服务地址',
      enabled: serviceState === 'running',
      click: () => clipboard.writeText(address)
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

    const response = await fetch('https://registry.npmjs.org/@becrafter/prompt-server');
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
      shell.openExternal('https://github.com/BeCrafter/prompt-server/releases/latest');
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
  const tarballUrl = `https://registry.npmjs.org/@becrafter/prompt-server/-/@becrafter/prompt-server-${version}.tgz`;
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'prompt-server-upgrade-'));
  const tarballPath = path.join(tmpDir, `${version}.tgz`);

  try {
    const response = await fetch(tarballUrl);
    if (!response.ok) {
      throw new Error('无法下载升级包');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(tarballPath, buffer);

    await tar.x({ file: tarballPath, cwd: tmpDir });
    const extractedPath = path.join(tmpDir, 'package');

    const serverRoot = await ensureRuntimeServerRoot();
    const examplesDir = path.join(serverRoot, 'examples', 'prompts');
    const examplesBackup = path.join(tmpDir, 'examples-prompts');

    if (await pathExists(examplesDir)) {
      await fs.promises.cp(examplesDir, examplesBackup, { recursive: true });
    }

    await fs.promises.rm(serverRoot, { recursive: true, force: true });
    await fs.promises.mkdir(serverRoot, { recursive: true });
    await fs.promises.cp(extractedPath, serverRoot, { recursive: true });

    if (await pathExists(examplesBackup)) {
      const targetExamples = path.join(serverRoot, 'examples', 'prompts');
      await fs.promises.mkdir(path.dirname(targetExamples), { recursive: true });
      await fs.promises.cp(examplesBackup, targetExamples, { recursive: true });
    }

    await installServerDependencies(serverRoot);
    await loadServerModule({ forceReload: true });
  } finally {
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
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['install', '--omit=dev'];

  await new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      cwd: targetDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stdout.on('data', (data) => {
      console.log(`[npm] ${data.toString().trim()}`);
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[npm] ${data.toString().trim()}`);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm install failed with exit code ${code}: ${stderr}`));
      }
    });
  });
}

async function showAboutDialog() {
  const serviceVersion = await getCurrentServiceVersion();
  const lines = [
    `桌面应用版本：${desktopPackageJson.version}`,
    `服务版本：${serviceVersion}`,
    `Electron：${process.versions.electron}`,
    `Chromium：${process.versions.chrome}`,
    `Node.js：${process.versions.node}`
  ];

  await dialog.showMessageBox({
    type: 'info',
    title: '关于 Prompt Server',
    message: '组件版本信息',
    detail: lines.join('\n')
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  await ensureRuntimeServerRoot();
  ensureTray();
  await startService();
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
  app.quit();
});

app.on('activate', () => {
  if (!tray) {
    ensureTray();
  }
});
