import { fileURLToPath } from 'url';

export function normalizeArgv(rawArgs, scriptPathOverride) {
  const execPath = process.execPath || 'node';
  const scriptPath = scriptPathOverride ?? fileURLToPath(new URL('../index.js', import.meta.url));
  return [execPath, scriptPath, ...(rawArgs || [])];
}
