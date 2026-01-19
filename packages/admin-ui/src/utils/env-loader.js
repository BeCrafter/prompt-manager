
/**
 * 获取后端 URL
 * 优先使用环境变量 HTTP_PORT，否则使用当前页面的 origin
 * 这样可以正确处理开发环境前后端分离的情况
 */
export function getBackendUrl() {
  // 优先检查环境变量 HTTP_PORT（由 webpack-dev-server 传入）
  const httpPort = process.env.HTTP_PORT;

  // 如果环境变量存在且不为空，则使用它来构造后端 URL
  // 这样可以确保开发环境中前端能正确连接到后端
  if (httpPort && httpPort.trim() !== '') {
    // 使用本地主机 IP 和指定的端口
    // 在开发环境中，后端通常运行在不同的端口
    const backendUrl = `http://localhost:${httpPort}`;
    console.log('🔧 从环境变量 HTTP_PORT 构造后端 URL:', backendUrl);
    return backendUrl;
  }

  // 降级到原有的逻辑：使用当前页面的 origin
  // 这适用于生产环境或前后端部署在同一端口的情况
  const currentOrigin = window.location.origin;
  const backendUrl = currentOrigin;
  console.log('🏭 从 window.location.origin 构造后端 URL:', backendUrl);

  return backendUrl;
}
