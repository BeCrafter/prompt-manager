#!/usr/bin/env node

/**
 * CLI入口脚本
 * 现在仅负责将请求转发到 app/cli 中的命令调度层
 */

import { fileURLToPath } from 'url';
import { runPromptServerCLI } from './index.js';

const scriptPath = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);

runPromptServerCLI(args, { scriptPath }).catch((error) => {
  process.stderr.write('启动失败: ' + (error?.message || error) + '\n');
  process.exit(1);
});
