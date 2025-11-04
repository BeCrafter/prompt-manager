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

// 图标文件路径
const sourceIcon = path.join(__dirname, '..', 'app', 'desktop', 'assets', 'icons', 'icon.png');
const assetsDir = path.join(__dirname, '..', 'app', 'desktop', 'assets', 'icons');

// 确保 assets 目录存在
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// macOS 图标尺寸
const macSizes = [16, 32, 64, 128, 256, 512, 1024];

// Windows 图标尺寸
const winSizes = [16, 24, 32, 48, 64, 96, 128, 256];

// 为 macOS 创建不同尺寸的图标
console.log('Creating macOS icons...');
const macIconDir = path.join(assetsDir, 'icon.iconset');
if (!fs.existsSync(macIconDir)) {
  fs.mkdirSync(macIconDir, { recursive: true });
}

for (const size of macSizes) {
  const filename = `icon_${size}x${size}.png`;
  const filepath = path.join(macIconDir, size === 512 ? 'icon_512x512@2x.png' : `icon_${size}x${size}.png`);
  console.log(`  - ${filename}`);
  // 对于 512x512@2x 实际上是 1024x1024
  const actualSize = size === 512 ? 1024 : size;
  await sharp(sourceIcon).resize(actualSize, actualSize).toFile(filepath);
}

// 为 Windows 创建不同尺寸的图标
console.log('Creating Windows icons...');
const winIconBuffers = [];
for (const size of winSizes) {
  const filename = `icon_${size}x${size}.png`;
  const filepath = path.join(assetsDir, filename);
  console.log(`  - ${filename}`);
  const buffer = await sharp(sourceIcon).resize(size, size).toBuffer();
  fs.writeFileSync(filepath, buffer);
  // 保存前几个尺寸用于创建 ICO 文件，现在包括 256x256
  if (size <= 256) {
    winIconBuffers.push(buffer);
  }
}

// 创建 ICNS 文件 (macOS) - 使用 iconutil 工具
console.log('Creating ICNS file for macOS...');
try {
  const icnsPath = path.join(assetsDir, 'icon.icns');
  
  // 使用 iconutil 创建 ICNS 文件
  const iconutil = spawn('iconutil', ['-c', 'icns', '-o', icnsPath, macIconDir]);
  
  iconutil.on('close', (code) => {
    if (code === 0) {
      console.log('  - icon.icns');
      // 清理临时文件
      fs.rmSync(macIconDir, { recursive: true, force: true });
    } else {
      console.log('  - Failed to create ICNS file with iconutil');
    }
  });
} catch (error) {
  console.log('  - Failed to create ICNS file:', error.message);
}

// 创建 ICO 文件 (Windows)
console.log('Creating ICO file for Windows...');
try {
  const icoBuffer = await toIco(winIconBuffers);
  const icoPath = path.join(assetsDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('  - icon.ico');
} catch (error) {
  console.log('  - Failed to create ICO file:', error.message);
}

console.log('Icon preparation completed.');