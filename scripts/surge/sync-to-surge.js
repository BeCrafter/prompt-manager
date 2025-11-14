#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

// 源目录和目标目录
const SOURCE_DIR = path.join(__dirname, '../../examples/prompts');
const DIST_DIR = path.join(__dirname, './dist');
const ASSETS_DIR = path.join(DIST_DIR, './assets');
const PROMPTS_DIR = path.join(ASSETS_DIR, 'prompts');

/**
 * 读取YAML文件并解析为JSON对象
 * @param {string} filePath - YAML文件路径
 * @returns {object} 解析后的对象
 */
function readYamlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

/**
 * 递归遍历目录，查找所有YAML文件
 * @param {string} dir - 目录路径
 * @param {string[]} fileList - 文件列表
 * @returns {string[]} YAML文件路径列表
 */
function walkDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDirectory(filePath, fileList);
    } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath - 目录路径
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 从源文件路径计算出相对于源目录的目标路径
 * @param {string} sourceFilePath - 源文件路径
 * @param {string} sourceDir - 源目录
 * @param {string} targetDir - 目标目录
 * @returns {string} 目标文件路径
 */
function getTargetPath(sourceFilePath, sourceDir, targetDir) {
  const relativePath = path.relative(sourceDir, sourceFilePath);
  const fileName = path.basename(sourceFilePath, path.extname(sourceFilePath));
  return path.join(targetDir, relativePath.replace(path.basename(sourceFilePath), `${fileName}.json`));
}

console.log('开始同步Prompt文件到Surge...');

// 创建assets目录
ensureDirectoryExists(ASSETS_DIR);
ensureDirectoryExists(PROMPTS_DIR);

// 查找所有YAML文件
const yamlFiles = walkDirectory(SOURCE_DIR);
console.log(`找到 ${yamlFiles.length} 个YAML文件`);

// 解析YAML文件并转换为JSON
const indexData = [];

for (const yamlFile of yamlFiles) {
  try {
    console.log(`正在处理: ${yamlFile}`);
    
    // 读取并解析YAML文件
    const yamlData = readYamlFile(yamlFile);
    
    // 提取必要字段
    const { name, description, tags = [] } = yamlData;
    
    // 计算目标JSON文件路径
    const targetPath = getTargetPath(yamlFile, SOURCE_DIR, PROMPTS_DIR);
    
    // 确保目标目录存在
    ensureDirectoryExists(path.dirname(targetPath));
    
    // 写入JSON文件
    fs.writeFileSync(targetPath, JSON.stringify(yamlData, null, 2), 'utf8');
    
    // 添加到索引数据
    const relativePath = path.relative(ASSETS_DIR, targetPath);
    indexData.push({
      name: name || path.basename(yamlFile, path.extname(yamlFile)),
      description: description || '',
      tags,
      path: relativePath
    });
    
    console.log(`已生成: ${targetPath}`);
  } catch (error) {
    console.error(`处理文件 ${yamlFile} 时出错:`, error.message);
  }
}

// 生成索引文件
const indexPath = path.join(ASSETS_DIR, 'prompts.json');
fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf8');
console.log(`已生成索引文件: ${indexPath}`);

console.log('YAML文件解析和转换完成');

// 检查是否需要发布到Surge
const shouldDeploy = process.argv.includes('--deploy') || process.argv.includes('-d');

if (shouldDeploy) {
  try {
    console.log('开始发布到Surge...');
    
    // 检查是否安装了surge
    try {
      execSync('which surge', { stdio: 'ignore' });
    } catch (error) {
      console.error('错误: 未找到surge命令，请先安装surge: npm install -g surge');
      process.exit(1);
    }
    
    // 发布到Surge
    const deployCommand = `surge ${DIST_DIR}`;
    console.log(`执行命令: ${deployCommand}`);
    execSync(deployCommand, { stdio: 'inherit' });
    
    console.log('发布完成!');
  } catch (error) {
    console.error('发布到Surge时出错:', error.message);
    process.exit(1);
  }
} else {
  console.log('同步完成。使用 --deploy 或 -d 参数发布到Surge。');
}