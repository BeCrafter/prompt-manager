import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const exampleEnvPath = path.join(projectRoot, 'env.example');
const homeDir = os.homedir();
const configRoot = path.join(homeDir, '.prompt-manager');
const targetEnvPath = path.join(configRoot, '.env');

async function syncEnvExample() {
  try {
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
    console.warn('同步 env.example 到 ~/.prompt-manager/.env 失败:', error.message);
  }
}

syncEnvExample();
