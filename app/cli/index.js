import startCommand from './commands/start.js';

const COMMANDS = {
  start: startCommand,
  run: startCommand
};

function printUsage() {
  console.log(`Prompt Server CLI\n\n用法:\n  prompt-manager [command] [options]\n\n可用命令:\n  start  启动服务 (默认)\n  run    启动服务 (同 start)\n\n示例:\n  prompt-manager --port 6000\n  prompt-manager start --prompts-dir ./examples/prompts`);
}

function isOptionToken(token) {
  return token?.startsWith('-');
}

export async function runPromptServerCLI(rawArgs = process.argv.slice(2), options = {}) {
  const args = Array.isArray(rawArgs) ? [...rawArgs] : [];

  const [firstToken] = args;
  const commandKey = firstToken && !isOptionToken(firstToken) ? firstToken.toLowerCase() : null;

  if (!commandKey) {
    return startCommand(args, options);
  }

  const command = COMMANDS[commandKey];
  if (!command) {
    console.error(`未知命令: ${firstToken}\n`);
    printUsage();
    process.exit(1);
  }

  const commandArgs = args.slice(1);
  return command(commandArgs, options);
}

export default runPromptServerCLI;
