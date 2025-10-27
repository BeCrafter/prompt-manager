import { normalizeArgv } from '../support/argv.js';
import { registerSignalHandlers } from '../support/signals.js';

export async function startCommand(rawArgs, options = {}) {
  const { scriptPath } = options;
  process.argv = normalizeArgv(rawArgs, scriptPath);

  const { startServer, stopServer, getServerState } = await import('../../../packages/server/server.js');

  registerSignalHandlers(stopServer);

  await startServer();

  const state = getServerState();
  console.log(`Prompt Server 已启动：${state.address}`);

  return new Promise(() => {});
}

export default startCommand;
