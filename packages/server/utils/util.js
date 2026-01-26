import crypto from 'crypto';
import { logger } from './logger.js';
import fse from 'fs-extra';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { config } from './config.js';

// 允许中文、空格、emoji 等字符，禁止路径分隔符及常见非法文件名字符
export const GROUP_NAME_REGEX = /^(?![.]{1,2}$)[^\\/:*?"<>|\r\n]{1,64}$/;
export const GROUP_META_FILENAME = 'group.meta.json';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const examplesPromptsRoot = path.join(projectRoot, 'examples', 'prompts');
const promptsDir = config.getPromptsDir();

let _promptManager;

export class Util {
  /**
   * 检查并初始化prompts目录，如果目录为空则从示例目录复制内容
   * @returns {Promise<void>}
   */
  async seedPromptsIfEmpty() {
    try {
      const entries = await fse.readdir(promptsDir);
      if (entries.length > 0) {
        return;
      }
    } catch (error) {
      logger.warn('读取Prompts目录失败，尝试同步示例数据:', error.message);
    }

    try {
      const exists = await fse.pathExists(examplesPromptsRoot);
      if (!exists) {
        return;
      }
      await fse.copy(examplesPromptsRoot, promptsDir, {
        overwrite: false,
        errorOnExist: false,
        recursive: true
      });
      logger.info(`已将示例Prompts同步到 ${promptsDir}`);
    } catch (error) {
      logger.warn('同步示例Prompts失败:', error.message);
    }
  }

  /**
   * 初始化内置配置（如果不存在）
   * 同步内置的模型配置和模板到用户配置目录
   */
  async seedBuiltInConfigsIfEmpty() {
    try {
      const userConfigDir = config.getConfigsDir();
      const builtInConfigsDir = this.getBuiltInConfigsDir();

      // 检查内置配置目录是否存在
      const builtInExists = await fse.pathExists(builtInConfigsDir);
      if (!builtInExists) {
        logger.debug('内置配置目录不存在，跳过同步');
        return;
      }

      // 确保用户配置目录存在
      await fse.ensureDir(userConfigDir);

      // 同步模型配置
      const modelsSrc = path.join(builtInConfigsDir, 'models');
      const modelsDst = path.join(userConfigDir, 'models');
      if (await fse.pathExists(modelsSrc)) {
        await fse.copy(modelsSrc, modelsDst, {
          overwrite: false,
          errorOnExist: false,
          recursive: true
        });
        logger.info(`已同步内置模型配置到 ${modelsDst}`);
      }

      // 同步模板配置
      const templatesSrc = path.join(builtInConfigsDir, 'templates');
      const templatesDst = path.join(userConfigDir, 'templates');
      if (await fse.pathExists(templatesSrc)) {
        await fse.copy(templatesSrc, templatesDst, {
          overwrite: false,
          errorOnExist: false,
          recursive: true
        });
        logger.info(`已同步内置模板配置到 ${templatesDst}`);
      }
    } catch (error) {
      logger.warn('同步内置配置失败:', error.message);
    }
  }

  /**
   * 生成文件唯一标识码
   * @param {string} relativePath
   * @returns {string}
   */
  generateUniqueId(relativePath) {
    const hash = crypto.createHash('sha256');
    hash.update(relativePath);
    const hashHex = hash.digest('hex');
    return hashHex.substring(0, 8);
  }

  /**
   * 从文件中读取提示词
   * @returns {Array<Object>}
   */
  getPromptsFromFiles() {
    const prompts = [];

    const traverseDir = (currentPath, relativeDir = '', inheritedEnabled = true) => {
      let currentEnabled = inheritedEnabled;
      if (relativeDir) {
        const meta = this.readGroupMeta(currentPath);
        currentEnabled = currentEnabled && meta.enabled !== false;
      }

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            const childRelativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
            traverseDir(fullPath, childRelativePath, currentEnabled);
          } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
            try {
              const fileContent = fs.readFileSync(fullPath, 'utf8');
              const prompt = yaml.load(fileContent);
              if (prompt && prompt.name) {
                const relativePath = path.relative(promptsDir, fullPath);
                const normalizedRelativePath = relativePath.split(path.sep).join('/');
                const relativeDirForFile = path.dirname(normalizedRelativePath);
                const topLevelGroup =
                  relativeDirForFile && relativeDirForFile !== '.'
                    ? relativeDirForFile.split('/')[0]
                    : prompt.group || 'default';
                const groupPath = relativeDirForFile && relativeDirForFile !== '.' ? relativeDirForFile : topLevelGroup;
                prompts.push({
                  ...prompt,
                  uniqueId: this.generateUniqueId(`${prompt.name}.yaml`),
                  fileName: entry.name,
                  relativePath: normalizedRelativePath,
                  group: topLevelGroup,
                  groupPath,
                  groupEnabled: currentEnabled
                });
              }
            } catch (error) {
              logger.error(`Error processing file ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        logger.error(`Error reading directory ${currentPath}:`, error);
      }
    };

    traverseDir(promptsDir);
    return prompts;
  }

  /**
   * 计算搜索关键词与prompt的相似度得分
   * @param {string} searchTerm - 搜索关键词
   * @param {Object} prompt - prompt对象
   * @returns {number} 相似度得分 (0-100)
   */
  calculateSimilarityScore(searchTerm, prompt) {
    let totalScore = 0;
    const searchLower = searchTerm ? searchTerm.toLowerCase() : '';

    // 搜索字段权重配置（专注于内容搜索，不包含ID检索）
    const fieldWeights = {
      name: 60, // 名称权重高，是主要匹配字段
      description: 40 // 描述权重适中，是辅助匹配字段
    };

    // 计算name匹配得分
    if (prompt && prompt.name && typeof prompt.name === 'string') {
      const nameScore = util.getStringMatchScore(searchLower, prompt.name.toLowerCase());
      totalScore += nameScore * fieldWeights.name;
    }

    // 计算description匹配得分
    if (prompt.description) {
      const descScore = util.getStringMatchScore(searchLower, prompt.description.toLowerCase());
      totalScore += descScore * fieldWeights.description;
    }

    // 标准化得分到0-100范围
    const maxPossibleScore = Object.values(fieldWeights).reduce((sum, weight) => sum + weight, 0);
    return Math.round((totalScore / maxPossibleScore) * 100);
  }

  /**
   * 计算两个字符串的匹配得分
   * @param {string} search - 搜索词 (已转小写)
   * @param {string} target - 目标字符串 (已转小写)
   * @returns {number} 匹配得分 (0-1)
   */
  getStringMatchScore(search, target) {
    if (!search || !target) return 0;

    // 完全匹配得分最高
    if (target === search) return 1.0;

    // 完全包含得分较高
    if (target.includes(search)) return 0.8;

    // 部分词匹配
    const searchWords = search.split(/\s+/).filter(word => word.length > 0);
    const targetWords = target.split(/\s+/).filter(word => word.length > 0);

    let matchedWords = 0;
    for (const searchWord of searchWords) {
      for (const targetWord of targetWords) {
        if (targetWord.includes(searchWord) || searchWord.includes(targetWord)) {
          matchedWords++;
          break;
        }
      }
    }

    if (searchWords.length > 0) {
      const wordMatchRatio = matchedWords / searchWords.length;
      return wordMatchRatio * 0.6; // 部分词匹配得分
    }

    return 0;
  }

  /**
   * 更新目录元数据
   * @param {*} dir
   * @param {*} meta
   */
  writeGroupMeta(dir, meta = {}) {
    const metaPath = this.getGroupMetaPath(dir);
    const data = {
      enabled: meta.enabled !== false
    };
    fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * 验证目录名称是否有效
   * @param {string} name
   * @returns {boolean}
   */
  isValidGroupName(name) {
    if (typeof name !== 'string') return false;
    return GROUP_NAME_REGEX.test(name);
  }

  /**
   * 验证目录名称
   * @param {string} relativePath
   * @returns {Array<string>|null}
   */
  validateGroupPath(relativePath) {
    if (!relativePath || typeof relativePath !== 'string') {
      return null;
    }
    const segments = relativePath.split('/').filter(Boolean);
    if (!segments.length) {
      return null;
    }
    for (const segment of segments) {
      if (!this.isValidGroupName(segment)) {
        return null;
      }
    }
    return segments;
  }

  /**
   *
   * @param {string} relativePath
   * @returns {Object|null}
   */
  resolveGroupDir(relativePath) {
    const segments = this.validateGroupPath(relativePath);
    if (!segments) return null;
    const targetPath = path.resolve(promptsDir, ...segments);
    const normalizedPromptsDir = path.resolve(promptsDir);
    if (!targetPath.startsWith(normalizedPromptsDir)) {
      return null;
    }
    return { dir: targetPath, segments };
  }

  /**
   * 获取目录元数据文件路径
   * @param {string} dir
   * @returns {string}
   */
  getGroupMetaPath(dir) {
    return path.join(dir, GROUP_META_FILENAME);
  }

  /**
   * 读取目录元数据
   * @param {string} dir
   * @returns {Object}
   */
  readGroupMeta(dir) {
    try {
      const metaPath = this.getGroupMetaPath(dir);
      if (!fs.existsSync(metaPath)) {
        return { enabled: true };
      }
      const raw = fs.readFileSync(metaPath, 'utf8');
      const data = JSON.parse(raw);
      return {
        enabled: data.enabled !== false
      };
    } catch (error) {
      logger.warn('读取类目元数据失败:', error);
      return { enabled: true };
    }
  }

  /**
   * 获取所有分组（直接从目录读取）
   * @param {string} baseDir
   * @param {string} relativePath
   * @returns {Array<Object>}
   */
  buildGroupTree(baseDir, relativePath = '') {
    const nodes = [];
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        const childRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const childDir = path.join(baseDir, entry.name);
        const children = this.buildGroupTree(childDir, childRelativePath);
        const meta = this.readGroupMeta(childDir);
        nodes.push({
          name: entry.name,
          path: childRelativePath,
          children,
          enabled: meta.enabled !== false
        });
      }
    } catch (error) {
      logger.error('读取分组目录失败:', error);
    }
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    return nodes;
  }

  async processPromptContent(prompt, args) {
    let content = '';

    if (prompt.messages && Array.isArray(prompt.messages)) {
      const userMessages = prompt.messages.filter(msg => msg.role === 'user');

      for (const message of userMessages) {
        if (message.content && typeof message.content.text === 'string') {
          let text = message.content.text;

          // Replace arguments
          if (args) {
            for (const [key, value] of Object.entries(args)) {
              const placeholder = new RegExp(`{{${key}}}`, 'g');
              text = text.replace(placeholder, String(value));
            }
          }

          content += `${text}\n\n`;
        }
      }
    }

    return content.trim();
  }

  getWebUiRoot() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    console.log('🔍 getWebUiRoot() called from:', __dirname);

    // 检查是否在 Electron 环境中运行
    const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;

    // 检查是否是打包应用
    if (isElectron && process.resourcesPath) {
      const resourcesWebPath = path.join(process.resourcesPath, 'web');
      if (this._pathExistsSync(resourcesWebPath)) {
        console.log('📦 Using Electron resources path:', resourcesWebPath);
        return resourcesWebPath;
      }

      const ourAppAsar = path.join(process.resourcesPath, 'app.asar');
      const asarWebPath = path.join(process.resourcesPath, 'app.asar', 'web');
      if (fs.existsSync(ourAppAsar) && this._pathExistsSync(asarWebPath)) {
        console.log('📦 Using Electron ASAR path:', asarWebPath);
        return asarWebPath;
      }
    }

    // 在开发环境中，web UI 位于项目目录中的 packages/web
    const devWebPath = path.join(__dirname, '..', '..', 'web');
    console.log('🔍 Checking dev path:', devWebPath);
    if (this._pathExistsSync(devWebPath)) {
      console.log('✅ Using dev environment path:', devWebPath);
      return devWebPath;
    }

    // 在 npm 包环境中，查找 packages/web
    // 从当前文件位置向上查找可能的包根目录
    let currentDir = __dirname;
    let searchDepth = 0;
    const maxDepth = 5;

    while (searchDepth < maxDepth) {
      // 检查 packages/web
      const webPath = path.join(currentDir, 'packages', 'web');
      console.log('🔍 Checking npm package path:', webPath);
      if (this._pathExistsSync(webPath)) {
        console.log('✅ Found web UI in npm package:', webPath);
        return webPath;
      }

      // 检查直接的 web 目录（某些打包场景）
      const altWebPath = path.join(currentDir, 'web');
      console.log('🔍 Checking alternative path:', altWebPath);
      if (this._pathExistsSync(altWebPath)) {
        console.log('✅ Found web UI in alternative path:', altWebPath);
        return altWebPath;
      }

      // 向上查找
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // 已经到达根目录
        break;
      }
      currentDir = parentDir;
      searchDepth++;
    }

    // 如果都找不到，使用当前工作目录作为最后尝试
    const cwdWebPath = path.join(process.cwd(), 'packages', 'web');
    console.log('🔍 Checking CWD path:', cwdWebPath);
    if (this._pathExistsSync(cwdWebPath)) {
      console.log('✅ Found web UI in CWD:', cwdWebPath);
      return cwdWebPath;
    }

    // 最后的fallback
    console.error('❌ Web UI not found in any location. This will cause blank pages.');
    console.error('Current directory:', __dirname);
    console.error('Working directory:', process.cwd());
    console.error('Checked paths:');
    console.error('  - Dev path:', devWebPath);
    console.error('  - CWD path:', cwdWebPath);

    return devWebPath; // 返回开发路径作为fallback，虽然它不存在
  }

  /**
   * 获取内置配置文件目录
   * 兼容开发环境和打包后的环境
   * @returns {string} 配置目录路径
   */
  getBuiltInConfigsDir() {
    // 检查是否是打包应用
    // 在 macOS 打包应用中，process.resourcesPath 存在
    if (process.resourcesPath) {
      // 在打包应用中，内置配置位于 Resources/runtime/configs/
      const packagedConfigPath = path.join(process.resourcesPath, 'runtime', 'configs');
      if (this._pathExistsSync(packagedConfigPath)) {
        return packagedConfigPath;
      }
    }

    // 在 npm 包环境中，配置位于 node_modules 中的包目录
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const npmConfigPath = path.resolve(__dirname, '../configs');
    if (this._pathExistsSync(npmConfigPath)) {
      return npmConfigPath;
    }

    // 在开发环境中，配置位于 packages/server/configs/
    return path.resolve(__dirname, '../configs');
  }

  /**
   * 获取默认用户配置文件路径
   * @returns {string} 用户配置文件路径
   */
  getDefaultUserConfigPath() {
    return path.join(this.getBuiltInConfigsDir(), 'authors.json');
  }

  _pathExistsSync(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getPromptManager() {
    if (!_promptManager) {
      try {
        // 首先尝试相对路径导入
        const serviceModule = await import('../services/manager.js');
        _promptManager = serviceModule.promptManager;
      } catch (error) {
        // 如果相对路径导入失败，尝试使用绝对路径
        try {
          const path = await import('path');
          const { fileURLToPath } = await import('url');
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const managerPath = path.join(__dirname, '..', 'services', 'manager.js');
          const serviceModule = await import(managerPath);
          _promptManager = serviceModule.promptManager;
        } catch (absolutePathError) {
          // 如果绝对路径也失败，记录错误并重新抛出
          console.error('Failed to import promptManager with both relative and absolute paths:', absolutePathError);
          throw absolutePathError;
        }
      }
    }
    return _promptManager;
  }
}

export const util = new Util();
