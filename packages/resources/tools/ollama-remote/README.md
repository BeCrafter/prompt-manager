# Ollama Remote Tool

远程 Ollama 服务器交互工具，支持列出模型和发送对话请求。

## 功能特性

1. **列出模型** (`list_models`)
   - 列出远程 Ollama 服务器上所有可用的模型
   - 支持过滤只显示云端模型
   - 显示模型大小、更新时间等信息

2. **对话功能** (`chat`)
   - 向远程 Ollama 服务器发送对话请求
   - 支持自定义系统提示词
   - 支持调整模型温度参数
   - 返回完整的对话响应

## 环境变量配置

工具需要配置以下环境变量：

- `OLLAMA_BASE_URL` (必需): Ollama 服务器基础 URL
  - 默认值: `http://localhost:11434`
  - 示例: `http://192.168.1.100:11434`

- `OLLAMA_API_KEY` (可选): API 密钥，用于 Bearer Token 认证
  - 默认值: 空字符串
  - 如果配置，会通过 `Authorization: Bearer {API_KEY}` 方式传递

## 使用方法

### 1. 配置环境变量

```yaml
tool: tool://ollama-remote
mode: configure
parameters:
  OLLAMA_BASE_URL: "http://localhost:11434"
  OLLAMA_API_KEY: "your-api-key-here"  # 可选
```

### 2. 列出可用模型

```yaml
tool: tool://ollama-remote
mode: execute
parameters:
  method: list_models
  only_remote: false  # 可选，只显示云端模型
```

### 3. 与模型对话

```yaml
tool: tool://ollama-remote
mode: execute
parameters:
  method: chat
  model: "llama3"
  message: "你好，请介绍一下你自己"
  system_prompt: "你是一个有用的AI助手"  # 可选
  temperature: 0.7  # 可选，0-1之间
```

## 参数说明

### list_models 方法

- `method` (必需): 必须为 `"list_models"`
- `only_remote` (可选): 布尔值，是否只显示云端模型，默认 `false`

### chat 方法

- `method` (必需): 必须为 `"chat"`
- `model` (必需): 模型名称，例如 `"llama3"`, `"deepseek-coder"`
- `message` (必需): 发送给模型的提示词或问题
- `system_prompt` (可选): 系统级指令
- `temperature` (可选): 模型温度，0-1之间，默认 `0.7`

## 返回格式

### list_models 返回

```json
{
  "success": true,
  "total": 5,
  "displayed": 5,
  "only_remote": false,
  "models": [
    {
      "index": 1,
      "name": "llama3:latest",
      "size": "4.7 GB",
      "modifiedAt": "2024-01-01T00:00:00Z",
      "type": "💾 本地"
    }
  ]
}
```

### chat 返回

```json
{
  "success": true,
  "model": "llama3",
  "reply": "你好！我是...",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  },
  "finishReason": "stop"
}
```

## 错误处理

工具定义了以下业务错误：

- `CONNECTION_FAILED`: 连接远程服务器失败
- `API_ERROR`: Ollama API 返回错误
- `INVALID_RESPONSE`: 无效的 API 响应
- `MISSING_PARAMETER`: 缺少必需参数
- `NO_MODELS_AVAILABLE`: 没有可用的模型

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **网络连接**: 确保可以访问配置的 Ollama 服务器地址
3. **API 兼容性**: 工具使用 Ollama 的 `/api/tags` 和 `/v1/chat/completions` 端点
4. **流式响应**: 当前实现不支持流式响应，返回完整结果
5. **认证方式**: API Key 通过 Bearer Token 方式传递

## 测试步骤

1. **重启服务器**（如果服务器已在运行）
   ```bash
   # 停止当前服务器，然后重新启动
   ```

2. **查看工具手册**
   ```yaml
   tool: tool://ollama-remote
   mode: manual
   ```

3. **配置环境变量**
   ```yaml
   tool: tool://ollama-remote
   mode: configure
   parameters:
     OLLAMA_BASE_URL: "http://localhost:11434"
   ```

4. **测试列出模型**
   ```yaml
   tool: tool://ollama-remote
   mode: execute
   parameters:
     method: list_models
   ```

5. **测试对话功能**（需要确保有可用的模型）
   ```yaml
   tool: tool://ollama-remote
   mode: execute
   parameters:
     method: chat
     model: "llama3"
     message: "Hello, world!"
   ```

## 开发说明

工具基于参考实现 [ollama-remote-mcp](https://github.com/yangweijie/ollama-remote-mcp) 开发，遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 符合工具开发指南的所有要求

## 版本历史

- **1.0.0** (2025-12-01): 初始版本
  - 实现列出模型功能
  - 实现对话功能
  - 支持环境变量配置
  - 完整的错误处理

