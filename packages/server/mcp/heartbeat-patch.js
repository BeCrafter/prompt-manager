import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// 为 StreamableHTTPServerTransport 添加 SSE 心跳，避免客户端/中间层在长时间空闲后断开。
// 通过环境变量 MCP_HEARTBEAT_INTERVAL_MS 配置心跳间隔（默认 30s）。
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.MCP_HEARTBEAT_INTERVAL_MS || '30000', 10);
let patched = false;

function attachHeartbeat(res) {
  if (!res || res.__mcpHeartbeatAttached) return;

  // 仅对 SSE 响应启用心跳
  const ct = res.getHeader && res.getHeader('Content-Type');
  if (!ct || !String(ct).includes('text/event-stream')) return;

  // 配置底层 socket 的 keep-alive
  if (res.socket) {
    res.socket.setKeepAlive(true, HEARTBEAT_INTERVAL_MS);
    res.socket.setTimeout(0);
  }

  const interval = setInterval(() => {
    if (res.writableEnded || res.destroyed) {
      clearInterval(interval);
      return;
    }
    try {
      res.write(': keep-alive\n\n'); // SSE 注释行，客户端忽略但可维持连接
    } catch (error) {
      clearInterval(interval);
    }
  }, HEARTBEAT_INTERVAL_MS);

  res.on('close', () => clearInterval(interval));
  res.on('error', () => clearInterval(interval));
  res.__mcpHeartbeatAttached = true;
}

/**
 * 给 StreamableHTTPServerTransport 打补丁，自动为 SSE 连接添加心跳
 */
export function patchStreamableHTTPHeartbeat() {
  if (patched) return;
  patched = true;

  const proto = StreamableHTTPServerTransport.prototype;

  const wrap = original => {
    return async function wrapped(...args) {
      const res = args[1];
      try {
        return await original.apply(this, args);
      } finally {
        try {
          // 尝试给当前响应以及现有流映射里的响应绑定心跳
          if (res) attachHeartbeat(res);
          if (this._streamMapping && typeof this._streamMapping.values === 'function') {
            for (const r of this._streamMapping.values()) {
              attachHeartbeat(r);
            }
          }
        } catch {
          // 安全兜底，避免影响主流程
        }
      }
    };
  };

  proto.handleGetRequest = wrap(proto.handleGetRequest);
  proto.handlePostRequest = wrap(proto.handlePostRequest);
  proto.replayEvents = wrap(proto.replayEvents);
}
