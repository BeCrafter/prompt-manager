const fs = require('fs');
const path = require('path');

async function chmodRecursive(targetPath) {
  const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      await chmodRecursive(entryPath);
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.node') || entry.name === 'spawn-helper')) {
      try {
        await fs.promises.chmod(entryPath, 0o755);
      } catch (error) {
        console.warn(`[afterPack] chmod failed: ${entryPath} - ${error.message}`);
      }
    }
  }
}

function getResourcesPath(context) {
  const { appOutDir, packager } = context;
  if (context.electronPlatformName === 'darwin') {
    const appName = packager.appInfo.productFilename;
    return path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
  }
  return path.join(appOutDir, 'resources');
}

function getCandidatePaths(resourcesPath) {
  return [
    path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'node-pty', 'prebuilds'),
    path.join(resourcesPath, 'app.asar.unpacked', 'app', 'node_modules', 'node-pty', 'prebuilds'),
    path.join(resourcesPath, 'node_modules', 'node-pty', 'prebuilds'),
    path.join(resourcesPath, 'app', 'node_modules', 'node-pty', 'prebuilds')
  ];
}

module.exports = async context => {
  const resourcesPath = getResourcesPath(context);
  const candidatePaths = getCandidatePaths(resourcesPath);

  let fixedAny = false;
  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) continue;
    try {
      await chmodRecursive(candidatePath);
      fixedAny = true;
      console.log(`[afterPack] fixed node-pty permissions: ${candidatePath}`);
    } catch (error) {
      console.warn(`[afterPack] failed to fix permissions: ${candidatePath} - ${error.message}`);
    }
  }

  if (!fixedAny) {
    console.warn('[afterPack] node-pty prebuilds directory not found, skipped permission fix');
  }
};
