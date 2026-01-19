#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function getArgValues(flag) {
  const values = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1]) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
}

const targets = getArgValues('--target');
const defaultTargets = ['packages/server'];
const scanTargets = targets.length > 0 ? targets : defaultTargets;

const invalidNameRegex = /[\x00-\x1F\x7F]/;

function isInvalidName(name) {
  return invalidNameRegex.test(name) || name.includes('✓');
}

function safeUnlink(fullPath) {
  try {
    fs.unlinkSync(fullPath);
    return true;
  } catch (error) {
    return false;
  }
}

function scanDirectory(dirPath) {
  const removed = [];
  if (!fs.existsSync(dirPath)) {
    return removed;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    let stats;
    try {
      stats = fs.lstatSync(fullPath);
    } catch (error) {
      continue;
    }

    if (stats.isSymbolicLink()) {
      continue;
    }

    if (stats.isSocket()) {
      if (safeUnlink(fullPath)) {
        removed.push(fullPath);
      }
      continue;
    }

    if (isInvalidName(entry.name)) {
      if (safeUnlink(fullPath)) {
        removed.push(fullPath);
      }
      continue;
    }

    if (stats.isDirectory()) {
      removed.push(...scanDirectory(fullPath));
    }
  }

  return removed;
}

const removedFiles = [];
for (const target of scanTargets) {
  const fullTarget = path.resolve(projectRoot, target);
  removedFiles.push(...scanDirectory(fullTarget));
}

if (removedFiles.length === 0) {
  console.log('No invalid files found.');
} else {
  console.log('Removed invalid files:');
  removedFiles.forEach(file => console.log(`- ${file}`));
}
