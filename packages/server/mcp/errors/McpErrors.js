/**
 * 自定义错误类基类
 */
export class McpError extends Error {
  constructor(message, code = 'MCP_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

/**
 * 参数错误类
 */
export class ValidationError extends McpError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
  }
}

/**
 * 资源未找到错误类
 */
export class ResourceNotFoundError extends McpError {
  constructor(resourceType, resourceId) {
    super(`${resourceType} "${resourceId}" 未找到`, 'RESOURCE_NOT_FOUND');
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}