#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import sharp from 'sharp';
import toIco from 'to-ico';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 图标源文件路径
const appSourceIcon = path.join(__dirname, '..', 'app', 'desktop', 'assets', 'app.png');
const traySourceIcon = path.join(__dirname, '..', 'app', 'desktop', 'assets', 'tray.png');
const assetsDir = path.join(__dirname, '..', 'app', 'desktop', 'assets', 'icons');

// 确保 assets 目录存在
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 检查源文件是否存在
if (!fs.existsSync(appSourceIcon)) {
  console.error(`Error: App source icon not found at ${appSourceIcon}`);
  process.exit(1);
}

if (!fs.existsSync(traySourceIcon)) {
  console.error(`Error: Tray source icon not found at ${traySourceIcon}`);
  process.exit(1);
}

async function buildIcons() {
  try {
    console.log('Found source icons:');
    console.log(`  - App icon: ${appSourceIcon}`);
    console.log(`  - Tray icon: ${traySourceIcon}`);

    // macOS 图标尺寸
    const macSizes = [16, 32, 64, 128, 256, 512, 1024];

    // 创建托盘图标 (24x24)
    console.log('Creating tray icon...');
    const filename = `tray.png`;
    const trayIconPath = path.join(assetsDir, filename);
    console.log(`  - ${filename}`);
    await sharp(traySourceIcon).resize(24, 24).toFile(trayIconPath);


    // 创建 PNG 图标
    console.log('Creating PNG file for default...');
    const iconFilename = `icon.png`;
    const appIconPath = path.join(assetsDir, iconFilename);
    console.log(`  - ${iconFilename}`);
    await sharp(appSourceIcon).resize(512, 512).toFile(appIconPath);


    // 为 macOS 创建不同尺寸的应用图标
    console.log('Creating macOS app icons...');
    const macIconDir = path.join(assetsDir, 'app.iconset');
    if (!fs.existsSync(macIconDir)) {
      fs.mkdirSync(macIconDir, { recursive: true });
    }

    for (const size of macSizes) {
      const filename = `icon_${size}x${size}.png`;
      const filepath = path.join(macIconDir, size === 512 ? 'icon_512x512@2x.png' : `icon_${size}x${size}.png`);
      console.log(`  - ${filename}`);
      // 对于 512x512@2x 实际上是 1024x1024
      const actualSize = size === 512 ? 1024 : size;
      await sharp(appSourceIcon).resize(actualSize, actualSize).toFile(filepath);
    }

    // 创建 ICNS 文件 (macOS) - 使用 iconutil 工具
    console.log('Creating ICNS file for macOS...');
    try {
      const icnsPath = path.join(assetsDir, 'icon.icns');
      
      // 使用 iconutil 创建 ICNS 文件
      await new Promise((resolve, reject) => {
        const iconutil = spawn('iconutil', ['-c', 'icns', '-o', icnsPath, macIconDir]);
        
        iconutil.on('close', (code) => {
          if (code === 0) {
            console.log('  - icon.icns');
            // 清理临时文件
            fs.rmSync(macIconDir, { recursive: true, force: true });
            resolve();
          } else {
            console.log('  - Failed to create ICNS file with iconutil');
            resolve(); // 继续执行，不阻止其他图标生成
          }
        });
        
        iconutil.on('error', (error) => {
          console.log('  - Failed to create ICNS file:', error.message);
          resolve(); // 继续执行，不阻止其他图标生成
        });
      });
    } catch (error) {
      console.log('  - Failed to create ICNS file:', error.message);
    }


    // 创建 ICO 文件 (Windows)
    console.log('Creating ICO file for Windows...');
    // Windows 图标常用尺寸
    const winSizes = [16, 32, 48, 64, 128, 256];
    const winIconBuffers = [];

    for (const size of winSizes) {
      const buffer = await sharp(appSourceIcon).resize(size, size).png().toBuffer();
      winIconBuffers.push(buffer);
    }

    if (winIconBuffers.length > 0) {
      console.log('  - icon.ico');
      const icoBuffer = await toIco(winIconBuffers);
      const icoPath = path.join(assetsDir, 'icon.ico');
      fs.writeFileSync(icoPath, icoBuffer);
    } else {
      console.log('  - No valid buffers for ICO creation');
    }


    console.log('Icon preparation completed.');
  } catch (error) {
    console.error('Error building icons:', error);
    process.exit(1);
  }
}

buildIcons();