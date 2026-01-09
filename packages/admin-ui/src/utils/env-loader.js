
/**
 * 获取后端 URL
 * 从当前页面的 URL 动态获取协议、主机和端口
 * 这样可以正确处理任意端口，不需要依赖编译时的环境变量
 */
export function getBackendUrl() {
  // 从当前页面的 location 获取完整的 origin
  // 这样可以正确处理开发、测试、生产环境中的任何端口
  const currentOrigin = window.location.origin;
  const backendUrl = currentOrigin;
  console.log('从 window.location.origin 构造后端 URL:', backendUrl);
  
  return backendUrl;
}
