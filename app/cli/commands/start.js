import { registerSignalHandlers } from '../support/signals.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 同步环境配置文件（从 postinstall 脚本移到这里）
async function syncEnvExample() {
  try {
    const projectRoot = path.resolve(__dirname, '../../..');
    const exampleEnvPath = path.join(projectRoot, 'env.example');
    const homeDir = os.homedir();
    const configRoot = path.join(homeDir, '.prompt-manager');
    const targetEnvPath = path.join(configRoot, '.env');

    const exampleContent = await fs.readFile(exampleEnvPath, 'utf8');
    await fs.mkdir(configRoot, { recursive: true });

    try {
      await fs.access(targetEnvPath);
      // 如果用户已经有自定义配置，则不覆盖
      return;
    } catch (error) {
      // 文件不存在，继续写入
    }

    await fs.writeFile(targetEnvPath, exampleContent, 'utf8');
    console.log(`已将默认环境变量写入 ${targetEnvPath}`);
  } catch (error) {
    // 静默失败，不影响启动
  }
}

// 简单的 CLI 参数解析
function parseCLIArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--prompts-dir' || arg === '-p') {
      options.promptsDir = args[i + 1];
      i++;
    } else if (arg === '--port' || arg === '-P') {
      options.port = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    }
  }
  return options;
}

export async function startCommand(rawArgs, options = {}) {
  const cliOptions = parseCLIArgs(rawArgs);

  // 如果请求帮助，显示 CLI 帮助
  if (cliOptions.help) {
    console.log(`Prompt Server CLI\n\n用法:\n  prompt-manager [command] [options]\n\n可用命令:\n  start  启动服务 (默认)\n  run    启动服务 (同 start)\n\n选项:\n  -p, --prompts-dir <目录>    指定 prompts 文件所在目录\n  -P, --port <端口>          指定服务器端口 (默认: 5621)\n  -h, --help                 显示此帮助信息\n\n示例:\n  prompt-manager --port 6000\n  prompt-manager start --prompts-dir ./examples/prompts`);
    return;
  }

  // 同步环境配置文件
  await syncEnvExample();

  const { startServer, stopServer, getServerState } = await import('../../../packages/server/server.js');

  registerSignalHandlers(stopServer);

  await startServer(cliOptions);

  const state = getServerState();
  console.log(`Prompt Server 已启动：${state.address}`);

  return new Promise(() => {});
}

export default startCommand;
