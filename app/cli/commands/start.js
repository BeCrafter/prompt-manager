import { registerSignalHandlers } from '../support/signals.js';

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

  const { startServer, stopServer, getServerState } = await import('../../../packages/server/server.js');

  registerSignalHandlers(stopServer);

  await startServer(cliOptions);

  const state = getServerState();
  console.log(`Prompt Server 已启动：${state.address}`);

  return new Promise(() => {});
}

export default startCommand;
