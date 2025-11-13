/**
 * 环境配置同步工具
 * 负责在用户目录下创建 .prompt-manager 配置目录和 .env 配置文件
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class EnvSync {
  /**
   * 同步环境配置文件
   * 检查并创建 ~/.prompt-manager 目录和 .env 配置文件
   */
  static async syncEnvConfig() {
    try {
      // 获取用户主目录
      const homeDir = os.homedir();
      const configRoot = path.join(homeDir, '.prompt-manager');
      const envFilePath = path.join(configRoot, '.env');
      
      // 检查并创建配置目录
      const dirExists = await this.pathExists(configRoot);
      if (!dirExists) {
        await fs.mkdir(configRoot, { recursive: true });
        console.log(`已创建配置目录: ${configRoot}`);
      }
      
      // 检查并创建 .env 文件
      const envFileExists = await this.pathExists(envFilePath);
      if (!envFileExists) {
        await this.createEnvFile(envFilePath);
        console.log(`已创建默认环境配置文件: ${envFilePath}`);
      }
      
      return { success: true, configRoot, envFilePath };
    } catch (error) {
      console.error('环境配置同步失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 创建默认的 .env 配置文件
   */
  static async createEnvFile(envFilePath) {
    const defaultEnvContent = `# 环境变量配置示例
# 复制此文件为 .env 并根据需要修改
SERVER_PORT=5621

# Prompts目录路径 (默认: ~/.prompt-manager/prompts，可通过命令行覆盖)
PROMPTS_DIR=$HOME/.prompt-manager/prompts

# MCP服务器配置
MCP_SERVER_NAME=prompt-manager
MCP_SERVER_VERSION=0.0.19

# 日志级别 (error, warn, info, debug)
LOG_LEVEL=info

# 最大prompt数量限制
MAX_PROMPTS=1000

# 管理员功能配置

# 是否启用管理员功能
ADMIN_ENABLE=true
# 是否需要登录认证
ADMIN_REQUIRE_AUTH=false
# 管理员用户名
ADMIN_USERNAME=admin
# 理员密码
ADMIN_PASSWORD=admin
# 管理员路径
ADMIN_PATH=/admin
`;
    
    await fs.writeFile(envFilePath, defaultEnvContent, 'utf8');
  }
  
  /**
   * 检查路径是否存在
   */
  static async pathExists(targetPath) {
    try {
      await fs.access(targetPath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = EnvSync;