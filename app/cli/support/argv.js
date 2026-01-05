import { fileURLToPath } from 'url';

export function normalizeArgv(rawArgs, scriptPathOverride) {
  const execPath = process.execPath || 'node';

  // 如果是全局安装的包，不需要修改 argv，因为 process.argv 已经正确设置
  if (process.env.npm_config_global || process.env.npm_config_prefix) {
    return [execPath, process.argv[1], ...(rawArgs || [])];
  }

  const scriptPath = scriptPathOverride ?? fileURLToPath(new URL('../index.js', import.meta.url));
  return [execPath, scriptPath, ...(rawArgs || [])];
}
