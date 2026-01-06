import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

// 解析路径中的环境变量和 ~
function expandPath(inputPath) {
  if (!inputPath) return inputPath;

  // 展开 ~ 为用户主目录
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  // 展开环境变量（支持 ${VAR} 和 $VAR 格式）
  return inputPath.replace(/\$(\w+)|\$\{(\w+)\}/g, (match, varName1, varName2) => {
    const varName = varName1 || varName2;
    return process.env[varName] || match; // 如果环境变量不存在，保留原值
  });
}

// 加载 .env 文件
const configHome = path.join(os.homedir(), '.prompt-manager');
dotenv.config({ path: path.join(configHome, '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_HOME_DIR = path.join(os.homedir(), '.prompt-manager');
const DEFAULT_PROMPTS_DIR = path.join(DEFAULT_HOME_DIR, 'prompts');

/**
 * 解析命令行参数
 */
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--prompts-dir' || arg === '-p') {
      options.promptsDir = args[i + 1];
      i++; // 跳过下一个参数
    } else if (arg === '--port' || arg === '-P') {
      options.port = args[i + 1];
      i++; // 跳过下一个参数
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg.startsWith('--')) {
      // 处理 --key=value 格式
      const [key, value] = arg.slice(2).split('=');
      options[key] = value;
    }
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  process.stderr.write(`
MCP Prompt Server - 智能 Prompt 管理服务器

用法:
  node packages/server/server.js [选项]

选项:
  -p, --prompts-dir <目录>    指定 prompts 文件所在目录
  -P, --port <端口>           指定服务器端口 (默认: 5621)
  -h, --help                 显示此帮助信息
  -v, --version              显示版本信息

环境变量:
  MCP_SERVER_NAME            服务器名称 (默认: prompt-manager)
  SERVER_PORT                服务器端口 (默认: 5621)
  PROMPTS_DIR                Prompts目录路径
  MCP_SERVER_VERSION         服务器版本
  LOG_LEVEL                  日志级别 (默认: info)
  MAX_PROMPTS                最大prompt数量限制 (默认: 1000)
  RECURSIVE_SCAN             是否启用递归扫描子目录 (默认: true)
  ADMIN_ENABLE               是否启用管理员功能 (默认: true)
  ADMIN_REQUIRE_AUTH         是否需要登录认证 (默认: true)
  ADMIN_USERNAME             管理员用户名 (默认: admin)
  ADMIN_PASSWORD             管理员密码 (默认: admin)

示例:
  node packages/server/server.js --prompts-dir /path/to/prompts
  node packages/server/server.js -p ./examples/prompts -P 8080
  LOG_LEVEL=debug node packages/server/server.js -p /custom/prompts
  ADMIN_REQUIRE_AUTH=false node packages/server/server.js  # 禁用登录认证
`);
}

/**
 * 配置管理类
 */
export class Config {
  constructor() {
    const cliArgs = parseCommandLineArgs();

    // 处理帮助和版本信息
    if (cliArgs.help) {
      showHelp();
      process.exit(0);
    }

    // 确定prompts目录
    this.promptsDir = expandPath(cliArgs.promptsDir) ||
      expandPath(process.env.PROMPTS_DIR) ||
      DEFAULT_PROMPTS_DIR;
    this.configHome = path.dirname(this.promptsDir);

    // 服务器端口
    this.port = cliArgs.port || process.env.SERVER_PORT || 5621;

    // 其他配置
    this.serverName = process.env.MCP_SERVER_NAME || 'prompt-manager';
    this.serverVersion = process.env.MCP_SERVER_VERSION || '0.1.20';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.maxPrompts = parseInt(process.env.MAX_PROMPTS) || 1000;
    this.recursiveScan = process.env.RECURSIVE_SCAN !== 'false'; // 默认启用递归扫描

    // Surge 静态资源代理配置
    this.surgeTarget = process.env.SURGE_TARGET || 'https://becrafter.surge.sh';

    // 管理员配置
    this.adminEnable = process.env.ADMIN_ENABLE !== 'false'; // 默认启用管理员功能
    this.adminPath = process.env.ADMIN_PATH || '/admin';
    this.exportToken = process.env.EXPORT_TOKEN || crypto.randomBytes(32).toString('hex');
    // 是否需要认证（默认需要）
    this.adminRequireAuth = process.env.ADMIN_REQUIRE_AUTH !== 'false';

    // 管理员账户（从环境变量或默认值）
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    this.admins = [
      {
        username: adminUsername,
        // 在实际应用中，这里应该是哈希值而不是明文密码
        password: adminPassword,
        token: process.env.ADMIN_TOKEN || crypto.randomBytes(32).toString('hex')
      }
    ];

    if (cliArgs.version) {
      process.stderr.write(this.serverVersion + '\n');
      process.exit(0);
    }

    // 存储CLI参数
    this.cliArgs = cliArgs;
  }

  /**
   * 允许在运行时覆盖部分配置（用于桌面应用等非CLI场景）
   */
  applyOverrides(overrides = {}) {
    if (!overrides || typeof overrides !== 'object') {
      return;
    }

    const {
      promptsDir,
      port,
      serverName,
      serverVersion,
      logLevel,
      maxPrompts,
      recursiveScan,
      adminEnable,
      adminPath,
      adminRequireAuth,
      admins,
      exportToken,
      surgeTarget
    } = overrides;

    if (promptsDir) {
      this.promptsDir = expandPath(promptsDir);
      this.configHome = path.dirname(this.promptsDir);
    }
    if (port) {
      this.port = port;
    }
    if (serverName) {
      this.serverName = serverName;
    }
    if (serverVersion) {
      this.serverVersion = serverVersion;
    }
    if (logLevel) {
      this.logLevel = logLevel;
    }
    if (typeof maxPrompts === 'number') {
      this.maxPrompts = maxPrompts;
    }
    if (typeof recursiveScan === 'boolean') {
      this.recursiveScan = recursiveScan;
    }
    if (typeof adminEnable === 'boolean') {
      this.adminEnable = adminEnable;
    }
    if (adminPath) {
      this.adminPath = adminPath;
    }
    if (typeof adminRequireAuth === 'boolean') {
      this.adminRequireAuth = adminRequireAuth;
    }
    if (Array.isArray(admins) && admins.length) {
      this.admins = admins;
    }
    if (exportToken) {
      this.exportToken = exportToken;
    }
    if (surgeTarget) {
      this.surgeTarget = surgeTarget;
    }
  }


  /**
   * 确保prompts目录存在
   */
  async ensurePromptsDir() {
    try {
      await fs.ensureDir(this.promptsDir);
      return true;
    } catch (error) {
      process.stderr.write('Failed to create prompts directory: ' + error.message + '\n');
      return false;
    }
  }

  /**
   * 获取prompts目录路径
   */
  getPromptsDir() {
    return this.promptsDir;
  }

  getConfigHome() {
    return this.configHome || DEFAULT_HOME_DIR;
  }

  /**
   * 获取服务器端口
   */
  getPort() {
    return this.port;
  }

  /**
   * 设置服务器端口（用于动态端口分配）
   */
  setPort(port) {
    this.port = port;
  }

  /**
   * 获取服务器名称
   */
  getServerName() {
    return this.serverName;
  }

  /**
   * 获取服务器版本
   */
  getServerVersion() {
    return this.serverVersion;
  }

  /**
   * 获取日志级别
   */
  getLogLevel() {
    return this.logLevel;
  }

  /**
   * 获取最大prompt数量限制
   */
  getMaxPrompts() {
    return this.maxPrompts;
  }

  /**
   * 验证配置
   */
  async validate() {
    try {
      // 检查prompts目录是否存在
      const exists = await fs.pathExists(this.promptsDir);
      if (!exists) {
        throw new Error(`Prompts目录不存在: ${this.promptsDir}`);
      }

      // 检查目录是否可读
      await fs.access(this.promptsDir, fs.constants.R_OK);

      return true;
    } catch (error) {
      throw new Error(`配置验证失败: ${error.message}`);
    }
  }

  /**
   * 显示当前配置（输出到 stderr，不干扰 MCP 通信）
   */
  showConfig() {
    process.stderr.write('===================================== 服务器配置 =====================================\n');
    process.stderr.write(`   服务名称: ${this.serverName}\n`);
    process.stderr.write(`   服务版本: ${this.serverVersion}\n`);
    process.stderr.write(`   服务端口: ${this.port}\n`);
    process.stderr.write(`   日志级别: ${this.logLevel}\n`);
    process.stderr.write(`   递归扫描: ${this.recursiveScan ? '启用' : '禁用'}\n`);
    process.stderr.write(`   Prompts目录: ${this.promptsDir}\n`);
    process.stderr.write(`   最大Prompt数量: ${this.maxPrompts}\n`);
    process.stderr.write(`   管理员功能: ${this.adminEnable ? '启用' : '禁用'}\n`);
    if (this.adminEnable) {
      process.stderr.write(`   登录认证: ${this.adminRequireAuth ? '需要' : '不需要'}\n`);
    }
    process.stderr.write(`   Surge代理目标: ${this.surgeTarget}\n`);
    process.stderr.write('======================================================================================\n\n');
  }
}

export const config = new Config();
