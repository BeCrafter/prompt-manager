import net from 'net';

/**
 * 检查指定端口是否可用
 * @param {number} port - 要检查的端口号
 * @returns {Promise<boolean>} - 端口是否可用
 */
export async function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * 在指定范围内查找可用端口
 * @param {number} startPort - 起始端口号
 * @param {number} maxAttempts - 最大尝试次数
 * @returns {Promise<number>} - 可用的端口号
 */
export async function findAvailablePort(startPort, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await checkPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`无法在 ${startPort} 到 ${startPort + maxAttempts - 1} 范围内找到可用端口`);
}

/**
 * 检查端口是否被特定进程占用
 * @param {number} port - 端口号
 * @returns {Promise<Object>} - 端口占用信息
 */
export async function getPortInfo(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close();
      resolve({ available: true, process: null });
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve({ available: false, error: '端口已被占用' });
      } else {
        resolve({ available: false, error: error.message });
      }
    });
  });
}