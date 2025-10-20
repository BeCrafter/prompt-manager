import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  node src/server.js [选项]

选项:
  -p, --prompts-dir <目录>    指定 prompts 文件所在目录
  -P, --port <端口>           指定服务器端口 (默认: 3000)
  -h, --help                 显示此帮助信息
  -v, --version              显示版本信息

环境变量:
  MCP_SERVER_NAME            服务器名称 (默认: prompt-server)
  SERVER_PORT                服务器端口 (默认: 3000)
  PROMPTS_DIR                Prompts目录路径
  MCP_SERVER_VERSION         服务器版本 (默认: 0.1.0)
  LOG_LEVEL                  日志级别 (默认: info)
  MAX_PROMPTS                最大prompt数量限制 (默认: 100)
  RECURSIVE_SCAN             是否启用递归扫描子目录 (默认: true)

示例:
  node src/server.js --prompts-dir /path/to/prompts
  node src/server.js -p ./my-prompts -P 8080
  LOG_LEVEL=debug node src/server.js -p /custom/prompts
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
    this.promptsDir = cliArgs.promptsDir || 
                     process.env.PROMPTS_DIR || 
                     path.join(__dirname, '..', 'prompts');
    
    // 远程服务器配置
    this.remoteUrl = cliArgs.remoteUrl || process.env.REMOTE_URL || null;
    this.remoteHeaders = cliArgs.headers || 
                        (process.env.REMOTE_HEADERS ? JSON.parse(process.env.REMOTE_HEADERS) : null);
    
    // 服务器端口
    this.port = cliArgs.port || process.env.SERVER_PORT || 3000;
    
    // 其他配置
    this.serverName = process.env.MCP_SERVER_NAME || 'prompt-server';
    this.serverVersion = process.env.MCP_SERVER_VERSION || '0.0.2';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.maxPrompts = parseInt(process.env.MAX_PROMPTS) || 100;
    this.recursiveScan = process.env.RECURSIVE_SCAN !== 'false'; // 默认启用递归扫描
    
    if (cliArgs.version) {
      process.stderr.write(this.serverVersion + '\n');
      process.exit(0);
    }

    // 存储CLI参数
    this.cliArgs = cliArgs;
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

  /**
   * 获取服务器端口
   */
  getPort() {
    return this.port;
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
    process.stderr.write('===== 服务器配置 =====\n');
    process.stderr.write(`服务名称: ${this.serverName}\n`);
    process.stderr.write(`服务版本: ${this.serverVersion}\n`);
    process.stderr.write(`服务端口: ${this.port}\n`);
    process.stderr.write(`日志级别: ${this.logLevel}\n`);
    process.stderr.write(`递归扫描: ${this.recursiveScan ? '启用' : '禁用'}\n`);
    process.stderr.write(`Prompts目录: ${this.promptsDir}\n`);
    process.stderr.write(`最大Prompt数量: ${this.maxPrompts}\n`);
    process.stderr.write('=====================\n');
  }
}

export const config = new Config();
