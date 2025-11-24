/**
 * Chrome DevTools MCP Tool - 基于 chrome-devtools-mcp 的浏览器自动化工具
 * 
 * 战略意义：
 * 1. 完全复用官方实现 - 直接使用 chrome-devtools-mcp 的工具实现，避免重复维护代码
 * 2. 功能完整性 - 支持 chrome-devtools-mcp 的所有功能（性能分析、网络监控、控制台监控等）
 * 3. 生态一致性 - 与官方代码库保持同步，官方更新时只需更新依赖版本
 * 
 * 设计理念：
 * - 直接导入 chrome-devtools-mcp 的工具模块（inputTools, pagesTools, networkTools 等）
 * - 使用 McpContext 管理浏览器实例和状态
 * - 创建适配层，将我们的工具接口路由到 chrome-devtools-mcp 的工具 handler
 * - 智能管理浏览器生命周期（默认自动关闭，可通过 keepAlive 保持）
 * 
 * 生态定位：
 * 为 AI 提供完整的 Chrome DevTools Protocol 能力，包括性能分析、网络监控、控制台监控等高级功能
 */

import path from 'path';
import os from 'os';

// ============================================================================
// 全局浏览器实例管理器（模块级别，跨执行保持）
// ============================================================================

const browserInstances = new Map();

// 固定工具名称，确保跨执行复用浏览器实例
const FIXED_TOOL_NAME = 'chrome-devtools';

/**
 * 获取或创建浏览器实例管理器
 * 使用固定的工具名称，确保跨执行复用
 */
function getBrowserManager() {
  if (!browserInstances.has(FIXED_TOOL_NAME)) {
    browserInstances.set(FIXED_TOOL_NAME, {
      browser: null,
      context: null,
      lastUsed: null,
      lastNavigationUrl: null  // 记录最后导航的 URL，用于检测页面变化
    });
  }
  return browserInstances.get(FIXED_TOOL_NAME);
}

/**
 * 清理浏览器实例管理器
 */
function clearBrowserManager() {
  browserInstances.delete(FIXED_TOOL_NAME);
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 规范化图片 MIME 类型
 * 确保返回有效的图片 MIME 类型，避免 "image/undefined" 等问题
 * 
 * @param {string|undefined} mimeType - 原始 MIME 类型
 * @param {string} defaultType - 默认类型，默认为 'image/png'
 * @returns {string} 规范化后的 MIME 类型
 */
function normalizeImageMimeType(mimeType, defaultType = 'image/png') {
  // 如果 mimeType 无效，返回默认值
  if (!mimeType || 
      typeof mimeType !== 'string' || 
      mimeType.trim() === '' ||
      mimeType === 'undefined' ||
      mimeType.toLowerCase() === 'undefined' ||
      mimeType.toLowerCase() === 'image/undefined') {
    return defaultType;
  }
  
  const trimmed = mimeType.trim();
  
  // 如果已经是完整的 MIME 类型（如 "image/png"），直接使用
  if (trimmed.startsWith('image/')) {
    return trimmed;
  }
  
  // 如果只是类型名（如 "png"），添加 "image/" 前缀
  const typeName = trimmed.toLowerCase();
  if (typeName && typeName !== 'undefined') {
    return `image/${typeName}`;
  }
  
  return defaultType;
}

/**
 * 检查是否是 stale snapshot 错误
 * 
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否是 stale snapshot 错误
 */
function isStaleSnapshotError(error) {
  if (!error?.message) {
    return false;
  }
  
  const message = error.message;
  return message.includes('stale snapshot') || 
         message.includes('stale') ||
         message.includes('This uid is coming from a stale snapshot') ||
         message.includes('Assignment to constant variable');
}

// ============================================================================
// 工具接口定义
// ============================================================================

export default {
  // --------------------------------------------------------------------------
  // 工具元信息接口
  // --------------------------------------------------------------------------

  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      'chrome-devtools-mcp': '^0.10.2',
      'puppeteer': '^24.31.0'
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'chrome-devtools',
      name: 'Chrome DevTools MCP',
      description: '基于 chrome-devtools-mcp 的浏览器自动化工具，完全复用官方实现。支持页面导航、元素操作、性能分析、网络监控、控制台监控等功能。支持 keepAlive 参数保持浏览器状态，便于连续操作和调试。',
      version: '1.0.0',
      category: 'utility',
      author: 'Prompt Manager',
      tags: ['browser', 'automation', 'chrome-devtools', 'performance', 'network', 'debugging'],
      scenarios: [
        '网页自动化操作',
        '性能分析和优化',
        '网络请求监控',
        '控制台消息监控',
        '页面截图和快照',
        '设备模拟',
        '连续多步骤操作（使用 keepAlive 保持浏览器状态）',
        '调试和测试（保持浏览器打开以便查看）'
      ],
      limitations: [
        '仅支持 Chrome/Chromium 浏览器',
        '首次使用时需要安装 Chrome 浏览器（会自动安装）',
        '浏览器二进制文件会下载到 ~/.cache/chrome-devtools-mcp/ 目录',
        '工具数据存储在 ~/.prompt-manager/toolbox/chrome-devtools/data/ 目录下',
        '浏览器操作需要时间，大页面可能较慢',
        '某些网站可能有反爬虫机制',
        '无头模式可能无法处理某些需要真实浏览器的场景',
        '默认情况下操作完成后会自动关闭浏览器（可通过 keepAlive 参数控制）'
      ],
      dataStorage: {
        path: '~/.prompt-manager/toolbox/chrome-devtools/data/',
        description: '工具数据存储目录，包括浏览器安装状态、截图文件等数据',
        note: '数据存储在工具所在目录的 data 子目录下'
      }
    };
  },

  /**
   * 获取参数Schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: '操作方法',
            enum: [
              // 输入自动化
              'click', 'fill', 'hover', 'press_key', 'drag', 'upload_file', 'handle_dialog', 'fill_form',
              // 导航自动化
              'navigate_page', 'new_page', 'close_page', 'list_pages', 'select_page', 'wait_for',
              // 网络监控
              'list_network_requests', 'get_network_request',
              // 性能分析
              'performance_start_trace', 'performance_stop_trace', 'performance_analyze_insight',
              // 调试
              'evaluate_script', 'get_console_message', 'list_console_messages',
              'take_screenshot', 'take_snapshot',
              // 模拟
              'emulate', 'resize_page',
              // 管理
              'close'
            ]
          },
          // 输入自动化参数
          uid: {
            type: 'string',
            description: '元素的唯一标识符（从页面快照中获取）'
          },
          dblClick: {
            type: 'boolean',
            description: '是否双击（click 方法）',
            default: false
          },
          value: {
            type: 'string',
            description: '要填写的值（fill 方法）'
          },
          from_uid: {
            type: 'string',
            description: '拖拽源元素的 uid（drag 方法）'
          },
          to_uid: {
            type: 'string',
            description: '拖拽目标元素的 uid（drag 方法）'
          },
          filePath: {
            type: 'string',
            description: '文件路径（upload_file 方法）'
          },
          key: {
            type: 'string',
            description: '按键或组合键（press_key 方法，如 "Enter", "Control+A"）'
          },
          action: {
            type: 'string',
            description: '对话框操作（handle_dialog 方法：accept/dismiss）',
            enum: ['accept', 'dismiss']
          },
          promptText: {
            type: 'string',
            description: '提示框文本（handle_dialog 方法，action=accept 时）'
          },
          elements: {
            type: 'array',
            description: '表单元素数组（fill_form 方法）',
            items: {
              type: 'object',
              properties: {
                uid: { type: 'string' },
                value: { type: 'string' }
              }
            }
          },
          // 导航参数
          url: {
            type: 'string',
            description: '目标URL（navigate_page、new_page 方法）。对于 navigate_page 方法，当 type 为 back/forward/reload 时可选'
          },
          type: {
            type: 'string',
            description: '导航类型（navigate_page 方法：url/back/forward/reload）',
            enum: ['url', 'back', 'forward', 'reload'],
            default: 'url'
          },
          ignoreCache: {
            type: 'boolean',
            description: '是否忽略缓存（navigate_page 方法）',
            default: false
          },
          pageIdx: {
            type: 'number',
            description: '页面索引（select_page、close_page 方法）'
          },
          text: {
            type: 'string',
            description: '要等待的文本（wait_for 方法）'
          },
          // 网络监控参数
          includePreservedRequests: {
            type: 'boolean',
            description: '是否包含保留的请求（list_network_requests 方法）',
            default: false
          },
          resourceTypes: {
            type: 'array',
            description: '资源类型过滤（list_network_requests 方法）',
            items: { type: 'string' }
          },
          pageSize: {
            type: 'number',
            description: '最大返回数量（list_network_requests、list_console_messages 方法）'
          },
          reqid: {
            type: 'number',
            description: '网络请求ID（get_network_request 方法，可选，省略时返回当前选中的请求）'
          },
          // 性能分析参数
          reload: {
            type: 'boolean',
            description: '是否重新加载页面（performance_start_trace 方法，必需）'
          },
          autoStop: {
            type: 'boolean',
            description: '是否自动停止追踪（performance_start_trace 方法，必需）'
          },
          insightName: {
            type: 'string',
            description: '性能洞察名称（performance_analyze_insight 方法，必需）'
          },
          insightSetId: {
            type: 'string',
            description: '性能洞察集合ID（performance_analyze_insight 方法，必需）'
          },
          // 调试参数
          function: {
            type: 'string',
            description: '要执行的JavaScript函数（evaluate_script 方法）'
          },
          args: {
            type: 'array',
            description: '函数参数（evaluate_script 方法）'
          },
          msgid: {
            type: 'number',
            description: '控制台消息ID（get_console_message 方法）'
          },
          includePreservedMessages: {
            type: 'boolean',
            description: '是否包含保留的消息（list_console_messages 方法）',
            default: false
          },
          types: {
            type: 'array',
            description: '消息类型过滤（list_console_messages 方法）',
            items: { type: 'string', enum: ['error', 'warning', 'info', 'log'] }
          },
          verbose: {
            type: 'boolean',
            description: '是否详细模式（take_snapshot 方法）',
            default: false
          },
          // 截图参数
          format: {
            type: 'string',
            description: '截图格式（take_screenshot 方法：png/jpeg/webp）',
            enum: ['png', 'jpeg', 'webp'],
            default: 'png'
          },
          fullPage: {
            type: 'boolean',
            description: '是否截取整页（take_screenshot 方法，与 uid 不兼容）',
            default: false
          },
          quality: {
            type: 'number',
            description: '压缩质量（take_screenshot 方法，0-100，仅用于 JPEG 和 WebP）',
            minimum: 0,
            maximum: 100
          },
          // 模拟参数
          device: {
            type: 'string',
            description: '设备名称（emulate 方法，如 "iPhone 12"，注意：官方文档中未包含此参数）'
          },
          cpuThrottlingRate: {
            type: 'number',
            description: 'CPU 降速因子（emulate 方法，设置为 1 禁用降速）'
          },
          networkConditions: {
            type: 'string',
            description: '网络条件（emulate 方法）',
            enum: ['No emulation', 'Offline', 'Slow 3G', 'Fast 3G', 'Slow 4G', 'Fast 4G']
          },
          width: {
            type: 'number',
            description: '视口宽度（resize_page 方法）'
          },
          height: {
            type: 'number',
            description: '视口高度（resize_page 方法）'
          },
          // 通用参数
          keepAlive: {
            type: 'boolean',
            description: '操作完成后是否保持浏览器打开（默认false，操作完成后自动关闭）。设置为true时，浏览器会保持打开状态，可用于连续操作或调试',
            default: false
          },
          timeout: {
            type: 'number',
            description: '超时时间（毫秒）',
            default: 30000
          },
          options: {
            type: 'object',
            description: '操作选项',
            properties: {
              headless: {
                type: 'boolean',
                description: '是否无头模式',
                default: true
              },
              channel: {
                type: 'string',
                enum: ['stable', 'canary', 'beta', 'dev'],
                description: 'Chrome 渠道',
                default: 'stable'
              },
              isolated: {
                type: 'boolean',
                description: '是否使用隔离的用户数据目录',
                default: false
              },
              keepAlive: {
                type: 'boolean',
                description: '操作完成后是否保持浏览器打开',
                default: false
              }
            }
          }
        },
        required: ['method']
      },
      environment: {
        type: 'object',
        properties: {
          CHROME_HEADLESS: {
            type: 'string',
            description: '是否无头模式（true/false）',
            default: 'true'
          },
          CHROME_CHANNEL: {
            type: 'string',
            description: 'Chrome 渠道（stable/canary/beta/dev）',
            default: 'stable'
          },
          CHROME_ISOLATED: {
            type: 'string',
            description: '是否使用隔离的用户数据目录（true/false）',
            default: 'false'
          }
        },
        required: []
      }
    };
  },

  /**
   * 获取业务错误定义
   */
  getBusinessErrors() {
    return [
      {
        code: 'BROWSER_LAUNCH_FAILED',
        description: '浏览器启动失败',
        match: /browser.*launch|无法启动浏览器|Browser launch failed/i,
        solution: '检查 Chrome 是否正确安装，尝试重新安装 Chrome',
        retryable: true
      },
      {
        code: 'NAVIGATION_FAILED',
        description: '页面导航失败',
        match: /navigation.*failed|页面加载失败|Navigation timeout/i,
        solution: '检查URL是否正确，网络是否正常，或增加超时时间',
        retryable: true
      },
      {
        code: 'ELEMENT_NOT_FOUND',
        description: '元素未找到',
        match: /element.*not found|uid.*not found|No such element|stale snapshot/i,
        solution: '请先调用 take_snapshot 获取页面快照，然后使用快照中的 uid',
        retryable: false
      },
      {
        code: 'SCREENSHOT_FAILED',
        description: '截图失败',
        match: /screenshot.*failed|无法保存截图/i,
        solution: '检查保存路径是否有效，是否有写入权限',
        retryable: false
      },
      {
        code: 'NETWORK_ERROR',
        description: '网络错误',
        match: /network.*error|连接失败|ECONNREFUSED|ETIMEDOUT/i,
        solution: '检查网络连接，URL是否可访问',
        retryable: true
      },
      {
        code: 'INVALID_UID',
        description: '无效的元素标识符',
        match: /invalid.*uid|uid.*invalid|No snapshot found/i,
        solution: '请先调用 take_snapshot 获取页面快照，然后使用快照中的 uid',
        retryable: false
      },
      {
        code: 'TIMEOUT',
        description: '操作超时',
        match: /timeout|超时/i,
        solution: '增加超时时间或检查操作是否正常',
        retryable: true
      },
      {
        code: 'PAGE_CLOSED',
        description: '页面已关闭',
        match: /page.*closed|The selected page has been closed/i,
        solution: '页面已被关闭，请调用 list_pages 查看可用页面',
        retryable: false
      }
    ];
  },

  // --------------------------------------------------------------------------
  // 主执行方法
  // --------------------------------------------------------------------------

  /**
   * 执行工具
   */
  async execute(params) {
    const { api } = this;
    
    api?.logger?.info('Chrome DevTools操作开始', { 
      method: params.method,
      url: params.url
    });
    
    try {
      // 1. 参数验证
      this.validateMethodParams(params);
      
      // 2. 导入 chrome-devtools-mcp 模块
      const chromeDevToolsMcp = await this.importToolModule('chrome-devtools-mcp');
      
      // 3. 获取或创建 McpContext
      const context = await this.getMcpContext(params.options);
      
      // 4. 处理页面导航后的 snapshot 失效问题
      // 如果执行的是 navigate_page 操作，清除旧的 snapshot（页面已改变）
      if (params.method === 'navigate_page' && params.url) {
        await this.clearSnapshotIfNeeded(context, params.url);
      }
      
      // 5. 对于需要 snapshot 的操作，如果 snapshot 不存在，自动创建一个
      // 注意：即使没有提供 uid，我们也应该确保 snapshot 存在，因为后续操作可能需要
      if (this.requiresSnapshot(params.method)) {
        await this.ensureSnapshot(context, chromeDevToolsMcp);
      }
      
      // 6. 获取工具 handler
      const tool = await this.getToolHandler(params.method, chromeDevToolsMcp);
      if (!tool) {
        throw new Error(`不支持的方法: ${params.method}。请检查 chrome-devtools-mcp 是否正确安装，或该方法是否存在于工具库中。`);
      }
      
      // 7. 转换参数格式
      const transformedParams = this.transformParams(params.method, params);
      
      // 8. 创建请求和响应对象
      const request = { params: transformedParams };
      const response = this.createMcpResponse();

      // 9. 调用工具 handler（带重试机制处理 stale snapshot）
      const finalResponse = await this.executeWithRetry(
        tool.handler.bind(tool),
        request,
        response,
        context,
        chromeDevToolsMcp,
        () => this.createMcpResponse()
      );
      
      // 10. 处理响应
      const content = await finalResponse.handle(params.method, context);
      
      // 调试：检查截图响应内容
      if (params.method === 'take_screenshot') {
        api?.logger?.debug('截图响应内容', {
          contentLength: content.length,
          contentTypes: content.map(item => item.type),
          hasImages: content.some(item => item.type === 'image'),
          responseImagesCount: response.images.length
        });
      }
      
      // 11. 格式化返回结果
      const result = this.formatResponse(content, params.method);
      
      // 12. 根据 keepAlive 决定是否关闭浏览器
      if (params.method !== 'close') {
        const keepAlive = this.getKeepAlive(params);
        if (!keepAlive) {
          api?.logger?.info('操作完成，自动关闭浏览器（keepAlive=false）');
          await this.cleanupBrowser();
        } else {
          api?.logger?.info('操作完成，保持浏览器打开（keepAlive=true）');
        }
      }
      
      api?.logger?.info('Chrome DevTools操作成功', { method: params.method });
      return result;
      
    } catch (error) {
      api?.logger?.error('Chrome DevTools操作失败', { 
        method: params.method,
        error: error.message,
        stack: error.stack
      });
      
      // 错误时也尝试清理浏览器（如果 keepAlive=false）
      if (params.method !== 'close') {
        const keepAlive = this.getKeepAlive(params);
        if (!keepAlive) {
          try {
            api?.logger?.info('操作失败，自动关闭浏览器（keepAlive=false）');
            await this.cleanupBrowser();
          } catch (cleanupError) {
            api?.logger?.warn('清理浏览器时出错', { error: cleanupError.message });
          }
        }
      }
      
      throw error;
    }
  },

  // --------------------------------------------------------------------------
  // 辅助方法
  // --------------------------------------------------------------------------

  /**
   * 获取 keepAlive 参数值
   */
  getKeepAlive(params) {
    return params.options?.keepAlive !== undefined 
         ? params.options.keepAlive 
         : (params.keepAlive !== undefined ? params.keepAlive : false);
  },

  /**
   * 验证方法参数（业务层面）
   */
  validateMethodParams(params) {
    const methodRequirements = {
      'click': ['uid'],
      'fill': ['uid', 'value'],
      'hover': ['uid'],
      'press_key': ['key'],
      'drag': ['from_uid', 'to_uid'],
      'upload_file': ['uid', 'filePath'],
      'handle_dialog': ['action'],
      'fill_form': ['elements'],
      // navigate_page: url 在 type 为 back/forward/reload 时可选
      'navigate_page': (() => {
        const type = params.type || 'url';
        return ['back', 'forward', 'reload'].includes(type) ? [] : ['url'];
      })(),
      'new_page': ['url'],
      'close_page': ['pageIdx'],
      'select_page': ['pageIdx'],
      'wait_for': ['text'],
      'list_network_requests': [],
      // get_network_request: reqid 可选
      'get_network_request': [],
      // performance_start_trace: autoStop 和 reload 必需
      'performance_start_trace': ['autoStop', 'reload'],
      'performance_stop_trace': [],
      // performance_analyze_insight: insightName 和 insightSetId 必需
      'performance_analyze_insight': ['insightName', 'insightSetId'],
      'evaluate_script': ['function'],
      'get_console_message': ['msgid'],
      'list_console_messages': [],
      'take_screenshot': [],
      'take_snapshot': [],
      // emulate: device 不是官方参数，但保留以兼容；官方参数是 cpuThrottlingRate 和 networkConditions（可选）
      'emulate': [],
      'resize_page': ['width', 'height'],
      'close': []
    };
    
    const required = methodRequirements[params.method];
    if (!required) {
      throw new Error(`不支持的方法: ${params.method}`);
    }
    
    const missing = required.filter(field => params[field] === undefined || params[field] === null);
    if (missing.length > 0) {
      throw new Error(`方法 ${params.method} 缺少必需参数: ${missing.join(', ')}`);
    }
  },

  /**
   * 获取工具 handler
   */
  async getToolHandler(method, chromeDevToolsMcp) {
    // 根据方法名确定工具类别
    const toolCategory = this.getToolCategory(method);
    if (!toolCategory) {
      return null;
    }
    
    // 获取工具名称（chrome-devtools-mcp 中的实际名称）
    const toolName = this.getToolName(method);
    
    try {
      // 尝试从 build/src/tools 导入工具模块
      const toolModulePath = `chrome-devtools-mcp/build/src/tools/${toolCategory}.js`;
      const toolModule = await this.importToolModule(toolModulePath);
      
      if (toolModule && (toolModule[toolName] || toolModule[method])) {
        return toolModule[toolName] || toolModule[method];
      }
    } catch (error) {
      this.api?.logger?.debug('无法从 build/src/tools 导入，尝试其他路径', { 
        method, 
        error: error.message 
      });
    }
    
    // 备用方案：尝试从主模块获取
    try {
      if (chromeDevToolsMcp && chromeDevToolsMcp.tools) {
        const categoryTools = chromeDevToolsMcp.tools[toolCategory];
        if (categoryTools && (categoryTools[toolName] || categoryTools[method])) {
          return categoryTools[toolName] || categoryTools[method];
        }
      }
    } catch (error) {
      this.api?.logger?.warn('无法从主模块获取工具', { 
        method, 
        error: error.message 
      });
    }
    
    return null;
  },

  /**
   * 获取工具类别
   */
  getToolCategory(method) {
    const categoryMap = {
      // 输入自动化
      'click': 'input',
      'fill': 'input',
      'hover': 'input',
      'press_key': 'input',
      'drag': 'input',
      'upload_file': 'input',
      'fill_form': 'input',
      // 导航自动化
      'navigate_page': 'pages',
      'new_page': 'pages',
      'close_page': 'pages',
      'list_pages': 'pages',
      'select_page': 'pages',
      'handle_dialog': 'pages',  // handle_dialog 在 pages.js 中导出
      'resize_page': 'pages',  // resize_page 在 pages.js 中导出
      // 网络监控
      'list_network_requests': 'network',
      'get_network_request': 'network',
      // 性能分析
      'performance_start_trace': 'performance',
      'performance_stop_trace': 'performance',
      'performance_analyze_insight': 'performance',
      // 调试
      'evaluate_script': 'script',
      'get_console_message': 'console',
      'list_console_messages': 'console',
      'take_screenshot': 'screenshot',
      'take_snapshot': 'snapshot',
      'wait_for': 'snapshot',  // wait_for 在 snapshot.js 中导出
      // 模拟
      'emulate': 'emulation'
    };
    return categoryMap[method];
  },

  /**
   * 获取工具名称（chrome-devtools-mcp 中的实际名称）
   * 注意：现在方法名已经是官方格式（下划线命名），但 chrome-devtools-mcp 内部使用的是驼峰命名
   */
  getToolName(method) {
    const nameMap = {
      'navigate_page': 'navigatePage',
      'new_page': 'newPage',
      'close_page': 'closePage',
      'list_pages': 'listPages',
      'select_page': 'selectPage',
      'press_key': 'pressKey',
      'upload_file': 'uploadFile',
      'handle_dialog': 'handleDialog',
      'fill_form': 'fillForm',
      'wait_for': 'waitFor',
      'performance_start_trace': 'startTrace',  // chrome-devtools-mcp 导出的是 'startTrace'
      'performance_stop_trace': 'stopTrace',  // chrome-devtools-mcp 导出的是 'stopTrace'
      'performance_analyze_insight': 'analyzeInsight',  // chrome-devtools-mcp 导出的是 'analyzeInsight'
      'evaluate_script': 'evaluateScript',
      'get_console_message': 'getConsoleMessage',
      'list_console_messages': 'listConsoleMessages',
      'take_screenshot': 'screenshot',  // chrome-devtools-mcp 导出的是 'screenshot'
      'take_snapshot': 'takeSnapshot',  // chrome-devtools-mcp 导出的是 'takeSnapshot'
      'get_network_request': 'getNetworkRequest',
      'list_network_requests': 'listNetworkRequests',
      'resize_page': 'resizePage'
    };
    return nameMap[method] || method;
  },


  /**
   * 获取或创建 McpContext
   */
  async getMcpContext(options = {}) {
    const { api } = this;
    const manager = getBrowserManager();
    
    // 如果已有上下文且浏览器仍然连接，直接返回
    if (manager.context && manager.context.browser && manager.context.browser.isConnected()) {
      api?.logger?.info('复用已存在的浏览器上下文', {
        note: '使用之前创建的上下文，保持会话状态（跨执行保持）'
      });
      manager.lastUsed = Date.now();
      return manager.context;
    }
    
    // 导入 chrome-devtools-mcp 的浏览器和上下文模块
    const chromeDevToolsMcp = await this.importToolModule('chrome-devtools-mcp');
    
    // 获取浏览器启动选项
    const headless = options.headless !== undefined 
                     ? options.headless 
                     : (api.environment.get('CHROME_HEADLESS') === 'true');
    const channel = options.channel || api.environment.get('CHROME_CHANNEL') || 'stable';
    const isolated = options.isolated !== undefined 
                     ? options.isolated 
                     : (api.environment.get('CHROME_ISOLATED') === 'true');
    
    api?.logger?.info('创建新的浏览器实例', { 
      headless, 
      channel,
      isolated,
      note: '首次创建浏览器实例'
    });
    
    // 导入浏览器启动函数和上下文模块
    const browserModule = await this.importBrowserModule(chromeDevToolsMcp);
    const contextModule = await this.importContextModule(chromeDevToolsMcp);
    
    const { ensureBrowserLaunched } = browserModule;
    const { McpContext } = contextModule;
    
    // 启动浏览器
    const browser = await ensureBrowserLaunched({
      headless,
      channel,
      isolated,
      devtools: false
    });
    
    // 创建上下文
    const context = await McpContext.from(browser, (msg) => api?.logger?.debug(msg), {
      experimentalDevToolsDebugging: false,
      experimentalIncludeAllPages: false
    });
    
    // 存储到全局管理器
    manager.browser = browser;
    manager.context = context;
    manager.lastUsed = Date.now();
    
    return context;
  },

  /**
   * 导入浏览器模块
   */
  async importBrowserModule(chromeDevToolsMcp) {
    try {
      // 尝试从 build/src/browser.js 导入
      return await this.importToolModule('chrome-devtools-mcp/build/src/browser.js');
    } catch {
      // 如果失败，尝试从主模块获取
      if (chromeDevToolsMcp && chromeDevToolsMcp.browser) {
        return chromeDevToolsMcp.browser;
      }
      throw new Error('无法导入浏览器模块，请检查 chrome-devtools-mcp 是否正确安装');
    }
  },

  /**
   * 导入上下文模块
   */
  async importContextModule(chromeDevToolsMcp) {
    try {
      // 尝试从 build/src/McpContext.js 导入
      return await this.importToolModule('chrome-devtools-mcp/build/src/McpContext.js');
    } catch {
      // 如果失败，尝试从主模块获取
      if (chromeDevToolsMcp && chromeDevToolsMcp.McpContext) {
        return { McpContext: chromeDevToolsMcp.McpContext };
      }
      throw new Error('无法导入上下文模块，请检查 chrome-devtools-mcp 是否正确安装');
    }
  },

  /**
   * 转换参数格式
   */
  transformParams(method, params) {
    const transformed = {};
    
    switch (method) {
      case 'click':
        transformed.uid = params.uid;
        transformed.dblClick = params.dblClick ?? false;
        break;
      case 'fill':
        transformed.uid = params.uid;
        transformed.value = params.value;
        break;
      case 'hover':
        transformed.uid = params.uid;
        break;
      case 'press_key':
        transformed.key = params.key;
        break;
      case 'drag':
        transformed.from_uid = params.from_uid;
        transformed.to_uid = params.to_uid;
        break;
      case 'upload_file':
        transformed.uid = params.uid;
        transformed.filePath = params.filePath;
        break;
      case 'handle_dialog':
        transformed.action = params.action;
        if (params.promptText) {
          transformed.promptText = params.promptText;
        }
        break;
      case 'fill_form':
        transformed.elements = params.elements;
        break;
      case 'navigate_page':
        transformed.type = params.type || 'url';
        if (params.url) {
          transformed.url = params.url;
        }
        if (params.timeout) {
          transformed.timeout = params.timeout;
        }
        if (params.ignoreCache !== undefined) {
          transformed.ignoreCache = params.ignoreCache;
        }
        break;
      case 'new_page':
        transformed.url = params.url;
        if (params.timeout) {
          transformed.timeout = params.timeout;
        }
        break;
      case 'close_page':
        transformed.pageIdx = params.pageIdx;
        break;
      case 'select_page':
        transformed.pageIdx = params.pageIdx;
        break;
      case 'wait_for':
        transformed.text = params.text;
        if (params.timeout) {
          transformed.timeout = params.timeout;
        }
        break;
      case 'list_network_requests':
        if (params.includePreservedRequests !== undefined) {
          transformed.includePreservedRequests = params.includePreservedRequests;
        }
        if (params.resourceTypes) {
          transformed.resourceTypes = params.resourceTypes;
        }
        if (params.pageIdx !== undefined) {
          transformed.pageIdx = params.pageIdx;
        }
        if (params.pageSize !== undefined) {
          transformed.pageSize = params.pageSize;
        }
        break;
      case 'get_network_request':
        // reqid 可选，如果提供则传递
        if (params.reqid !== undefined) {
          transformed.reqid = params.reqid;
        }
        break;
      case 'performance_start_trace':
        if (params.reload !== undefined) {
          transformed.reload = params.reload;
        }
        if (params.autoStop !== undefined) {
          transformed.autoStop = params.autoStop;
        }
        break;
      case 'performance_analyze_insight':
        transformed.insightName = params.insightName;
        transformed.insightSetId = params.insightSetId;
        break;
      case 'evaluate_script':
        // chrome-devtools-mcp 期望的是一个函数字符串，它会用 (${function}) 包装
        // 如果用户传入的是立即执行的函数表达式，需要转换为函数声明
        let functionStr = params.function;
        
        // 检查是否是立即执行的函数表达式 (function() {...})() 或 (() => {...})()
        functionStr = functionStr.trim();
        
        // 匹配立即执行函数：以 ( 开头，以 )() 结尾
        if (functionStr.startsWith('(') && functionStr.endsWith(')()')) {
          // 移除开头的 ( 和结尾的 ()
          functionStr = functionStr.slice(1, -2);
        } else if (functionStr.endsWith('()')) {
          // 只移除结尾的 ()
          functionStr = functionStr.slice(0, -2);
        }
        
        // 确保结果是有效的函数表达式
        // chrome-devtools-mcp 会用 (${function}) 包装，所以我们需要确保传入的是函数体
        transformed.function = functionStr;
        if (params.args) {
          transformed.args = params.args;
        }
        break;
      case 'get_console_message':
        transformed.msgid = params.msgid;
        break;
      case 'list_console_messages':
        if (params.includePreservedMessages !== undefined) {
          transformed.includePreservedMessages = params.includePreservedMessages;
        }
        if (params.types) {
          transformed.types = params.types;
        }
        if (params.pageIdx !== undefined) {
          transformed.pageIdx = params.pageIdx;
        }
        if (params.pageSize !== undefined) {
          transformed.pageSize = params.pageSize;
        }
        break;
      case 'take_screenshot':
        if (params.filePath) {
          transformed.filePath = params.filePath;
        }
        if (params.format) {
          transformed.format = params.format;
        }
        if (params.fullPage !== undefined) {
          transformed.fullPage = params.fullPage;
        }
        if (params.quality !== undefined) {
          transformed.quality = params.quality;
        }
        if (params.uid) {
          transformed.uid = params.uid;
        }
        break;
      case 'take_snapshot':
        if (params.verbose !== undefined) {
          transformed.verbose = params.verbose;
        }
        if (params.filePath) {
          transformed.filePath = params.filePath;
        }
        break;
      case 'emulate':
        // 保留 device 参数以兼容，但优先使用官方参数
        if (params.device) {
          transformed.device = params.device;
        }
        if (params.cpuThrottlingRate !== undefined) {
          transformed.cpuThrottlingRate = params.cpuThrottlingRate;
        }
        if (params.networkConditions) {
          transformed.networkConditions = params.networkConditions;
        }
        break;
      case 'resize_page':
        transformed.width = params.width;
        transformed.height = params.height;
        break;
      default:
        // 对于其他方法，直接传递所有参数
        Object.assign(transformed, params);
        delete transformed.method;
        delete transformed.keepAlive;
        delete transformed.options;
    }
    
    return transformed;
  },

  /**
   * 创建 McpResponse 对象
   */
  createMcpResponse() {
    // 创建一个简单的响应对象，模拟 chrome-devtools-mcp 的 McpResponse
    const response = {
      lines: [],
      includePages: false,
      includeNetworkRequests: false,
      includeConsoleData: false,
      snapshotParams: null,
      images: [],
      networkRequestIds: [],
      consoleMessageIds: [],
      devToolsData: null,
      
      appendResponseLine(value) {
        this.lines.push(value);
      },
      
      setIncludePages(value) {
        this.includePages = value;
      },
      
      setIncludeNetworkRequests(value, options) {
        this.includeNetworkRequests = true;
        this.networkRequestOptions = options;
      },
      
      setIncludeConsoleData(value, options) {
        this.includeConsoleData = true;
        this.consoleDataOptions = options;
      },
      
      includeSnapshot(params) {
        this.snapshotParams = params || {};
      },
      
      attachImage(value) {
        this.images.push(value);
      },
      
      attachNetworkRequest(reqid) {
        this.networkRequestIds.push(reqid);
      },
      
      attachConsoleMessage(msgid) {
        this.consoleMessageIds.push(msgid);
      },
      
      attachDevToolsData(data) {
        this.devToolsData = data;
      },
      
      // 处理响应并返回内容
      async handle(toolName, context) {
        const content = [];
        
        // 添加响应行
        for (const line of this.lines) {
          content.push({
            type: 'text',
            text: line
          });
        }
        
        // 包含页面列表
        if (this.includePages) {
          const pages = context.getPages();
          const selectedPage = context.getSelectedPage();
          let pagesText = 'Pages:\n';
          pages.forEach((page, idx) => {
            const isSelected = context.isPageSelected(page);
            const title = page.title() || page.url();
            pagesText += `${idx}: ${title}${isSelected ? ' (selected)' : ''}\n`;
          });
          content.push({
            type: 'text',
            text: pagesText.trim()
          });
        }
        
        // 包含网络请求
        if (this.includeNetworkRequests) {
          const requests = context.getNetworkRequests(
            this.networkRequestOptions?.includePreservedRequests
          );
          let requestsText = 'Network Requests:\n';
          requests.forEach((request, idx) => {
            const reqid = context.getNetworkRequestStableId(request);
            const method = request.method();
            const url = request.url();
            const status = request.response()?.status() || 'pending';
            requestsText += `[reqid=${reqid}] ${method} ${url} (${status})\n`;
          });
          if (requests.length > 0) {
            content.push({
              type: 'text',
              text: requestsText.trim()
            });
          }
        }
        
        // 包含控制台数据
        if (this.includeConsoleData) {
          const messages = context.getConsoleData(
            this.consoleDataOptions?.includePreservedMessages
          );
          let messagesText = 'Console Messages:\n';
          messages.forEach((message) => {
            const msgid = context.getConsoleMessageStableId(message);
            const level = message.level || 'log';
            const text = message.text || message.message || String(message);
            messagesText += `[msgid=${msgid}] ${level}: ${text}\n`;
          });
          if (messages.length > 0) {
            content.push({
              type: 'text',
              text: messagesText.trim()
            });
          }
        }
        
        // 包含快照
        if (this.snapshotParams !== null) {
          await context.createTextSnapshot(
            this.snapshotParams.verbose || false,
            this.devToolsData
          );
          const snapshot = context.getTextSnapshot();
          if (snapshot) {
            content.push({
              type: 'text',
              text: this.formatSnapshot(snapshot)
            });
          }
        }

        // 附加图片
        for (const image of this.images) {
          content.push({
            type: 'image',
            data: image.data,
            mimeType: normalizeImageMimeType(image.mimeType)
          });
        }
        
        // 附加网络请求详情
        for (const reqid of this.networkRequestIds) {
          const request = context.getNetworkRequestById(reqid);
          if (request) {
            content.push({
              type: 'text',
              text: this.formatNetworkRequest(request)
            });
          }
        }
        
        // 附加控制台消息详情
        for (const msgid of this.consoleMessageIds) {
          const message = context.getConsoleMessageById(msgid);
          if (message) {
            content.push({
              type: 'text',
              text: this.formatConsoleMessage(message)
            });
          }
        }
        
        return content;
      },
      
      // 格式化快照
      formatSnapshot(snapshot) {
        if (!snapshot || !snapshot.root) {
          return 'No snapshot available';
        }
        
        let text = 'Page Snapshot:\n';
        const formatNode = (node, indent = 0) => {
          const prefix = '  '.repeat(indent);
          const role = node.role || 'unknown';
          const name = node.name || '';
          const value = node.value || '';
          text += `${prefix}[${node.id}] ${role}${name ? `: ${name}` : ''}${value ? ` = ${value}` : ''}\n`;
          if (node.children) {
            node.children.forEach(child => formatNode(child, indent + 1));
          }
        };
        
        formatNode(snapshot.root);
        return text;
      },
      
      // 格式化网络请求
      formatNetworkRequest(request) {
        const method = request.method();
        const url = request.url();
        const status = request.response()?.status() || 'pending';
        const headers = request.headers();
        const postData = request.postData();
        
        let text = `Network Request:\n`;
        text += `  Method: ${method}\n`;
        text += `  URL: ${url}\n`;
        text += `  Status: ${status}\n`;
        if (headers) {
          text += `  Headers: ${JSON.stringify(headers, null, 2)}\n`;
        }
        if (postData) {
          text += `  Post Data: ${postData}\n`;
        }
        return text;
      },
      
      // 格式化控制台消息
      formatConsoleMessage(message) {
        const level = message.level || 'log';
        const text = message.text || message.message || String(message);
        const location = message.location || {};
        const stack = message.stack || '';
        
        let result = `Console Message [${level}]:\n`;
        result += `  Text: ${text}\n`;
        if (location.url) {
          result += `  Location: ${location.url}:${location.lineNumber || '?'}\n`;
        }
        if (stack) {
          result += `  Stack: ${stack}\n`;
        }
        return result;
      }
    };
    
    return response;
  },

  /**
   * 格式化响应结果
   */
  formatResponse(content, method) {
    const { api } = this;
    
    if (!content || content.length === 0) {
      return { success: true, method };
    }
    
    // 提取文本内容
    const texts = content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    
    // 提取图片
    let images = content
      .filter(item => item.type === 'image')
      .map(item => ({
        data: item.data,
        mimeType: normalizeImageMimeType(item.mimeType)
      }));
    
    // 对于截图方法，如果响应中没有图片，尝试从文本中提取 base64 图片数据
    if (method === 'take_screenshot' && images.length === 0 && texts) {
      // 尝试匹配 base64 图片数据（data:image/...;base64,... 或纯 base64 字符串）
      const base64Pattern = /data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/g;
      const matches = [...texts.matchAll(base64Pattern)];
      
      if (matches.length > 0) {
        api?.logger?.debug('从文本中提取 base64 图片数据', { matchesCount: matches.length });
        images = matches.map(match => ({
          data: match[2], // base64 数据部分
          mimeType: `image/${match[1]}` // 图片类型
        }));
      } else {
        // 尝试匹配纯 base64 字符串（可能是截图工具返回的）
        const pureBase64Pattern = /^[A-Za-z0-9+/=]{100,}$/m; // 至少100个字符的 base64 字符串
        const base64Match = texts.match(pureBase64Pattern);
        if (base64Match) {
          api?.logger?.debug('从文本中提取纯 base64 图片数据');
          images = [{
            data: base64Match[0],
            mimeType: 'image/png' // 默认 PNG
          }];
        }
      }
    }
    
    // 调试：检查截图结果
    if (method === 'take_screenshot') {
      api?.logger?.debug('格式化截图响应', {
        imagesCount: images.length,
        hasImages: images.length > 0,
        contentItems: content.map(item => ({ type: item.type, hasData: !!item.data })),
        extractedFromText: images.length > 0 && content.filter(item => item.type === 'image').length === 0
      });
    }
    
    const result = {
      success: true,
      method,
      text: texts || undefined,
      images: images.length > 0 ? images : undefined
    };
    
    // 对于特定方法，提取结构化数据
    if (method === 'list_pages') {
      result.pages = this.extractPagesFromText(texts);
    } else if (method === 'list_network_requests') {
      result.requests = this.extractRequestsFromText(texts);
    } else if (method === 'list_console_messages') {
      result.messages = this.extractMessagesFromText(texts);
    } else if (method === 'take_snapshot') {
      result.snapshot = texts;
    }
    
    return result;
  },

  /**
   * 从文本中提取页面信息
   */
  extractPagesFromText(text) {
    const pages = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\d+):\s+(.+?)(\s+\(selected\))?$/);
      if (match) {
        pages.push({
          index: parseInt(match[1], 10),
          title: match[2],
          selected: !!match[3]
        });
      }
    }
    return pages;
  },

  /**
   * 从文本中提取网络请求信息
   */
  extractRequestsFromText(text) {
    const requests = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/^\[reqid=(\d+)\]\s+(\w+)\s+(.+?)\s+\((\d+|pending)\)$/);
      if (match) {
        requests.push({
          reqid: parseInt(match[1], 10),
          method: match[2],
          url: match[3],
          status: match[4] === 'pending' ? null : parseInt(match[4], 10)
        });
      }
    }
    return requests;
  },

  /**
   * 从文本中提取控制台消息信息
   */
  extractMessagesFromText(text) {
    const messages = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/^\[msgid=(\d+)\]\s+(\w+):\s+(.+)$/);
      if (match) {
        messages.push({
          msgid: parseInt(match[1], 10),
          level: match[2],
          text: match[3]
        });
      }
    }
    return messages;
  },

  /**
   * 检查操作是否需要 snapshot
   */
  requiresSnapshot(method) {
    const methodsRequiringSnapshot = ['click', 'fill', 'hover', 'drag', 'upload_file'];
    return methodsRequiringSnapshot.includes(method);
  },

  /**
   * 确保 snapshot 存在（如果不存在则创建）
   */
  async ensureSnapshot(context, chromeDevToolsMcp) {
    const { api } = this;
    
    try {
      // 优先通过工具 handler 创建 snapshot，这是最可靠的方式
      api?.logger?.debug('通过工具 handler 创建 snapshot');
      const snapshotTool = await this.getToolHandler('take_snapshot', chromeDevToolsMcp);
      if (snapshotTool) {
        const request = { params: { verbose: false } };
        const response = this.createMcpResponse();
        response.includeSnapshot({ verbose: false });
        await snapshotTool.handler(request, response, context);
        // 处理响应以创建 snapshot
        await response.handle('take_snapshot', context);
        api?.logger?.debug('Snapshot 创建成功');
        return;
      }
      
      // 备用方案：如果 context 有 createTextSnapshot 方法，使用它
      if (context.createTextSnapshot && typeof context.createTextSnapshot === 'function') {
        await context.createTextSnapshot(false, null);
        api?.logger?.debug('通过 createTextSnapshot 创建 snapshot');
        return;
      }
      
      api?.logger?.warn('无法创建 snapshot：找不到可用的方法');
    } catch (error) {
      // 如果创建 snapshot 失败，记录警告但不抛出错误
      // 让原始操作继续执行，chrome-devtools-mcp 可能会在需要时自动创建
      api?.logger?.warn('自动创建 snapshot 失败，将继续执行操作', { error: error.message });
    }
  },

  /**
   * 执行工具 handler，带重试机制处理 stale snapshot 错误
   * 
   * @param {Function} handler - 工具 handler 函数
   * @param {object} request - 请求对象
   * @param {object} response - 响应对象
   * @param {object} context - MCP 上下文
   * @param {object} chromeDevToolsMcp - chrome-devtools-mcp 模块
   * @param {Function} createResponse - 创建新响应对象的函数
   * @returns {object} 最终的响应对象
   */
  async executeWithRetry(handler, request, response, context, chromeDevToolsMcp, createResponse) {
    const { api } = this;
    const maxRetries = 1;
    let retryCount = 0;
    let currentResponse = response;
    
    while (retryCount <= maxRetries) {
      try {
        await handler(request, currentResponse, context);
        return currentResponse; // 成功则返回响应对象
      } catch (handlerError) {
        // 检查是否是 stale snapshot 错误
        if (isStaleSnapshotError(handlerError) && retryCount < maxRetries) {
          api?.logger?.warn('检测到 stale snapshot 错误，重新创建 snapshot 后重试', {
            error: handlerError.message,
            retryCount: retryCount + 1
          });
          
          // 重新创建 snapshot
          await this.ensureSnapshot(context, chromeDevToolsMcp);
          
          // 重新创建响应对象
          currentResponse = createResponse();
          
          retryCount++;
          continue;
        }
        
        // 不是 stale snapshot 错误，或者已经重试过，抛出错误
        throw handlerError;
      }
    }
  },

  /**
   * 在页面导航后清除旧的 snapshot
   */
  async clearSnapshotIfNeeded(context, newUrl) {
    const { api } = this;
    const manager = getBrowserManager();
    
    // 如果 URL 发生变化，清除旧的 snapshot
    if (manager.lastNavigationUrl && manager.lastNavigationUrl !== newUrl) {
      api?.logger?.info('检测到页面导航，清除旧的 snapshot', {
        oldUrl: manager.lastNavigationUrl,
        newUrl: newUrl
      });
      
      // 清除 snapshot（通过重新创建来清除旧的）
      try {
        if (context.clearTextSnapshot && typeof context.clearTextSnapshot === 'function') {
          context.clearTextSnapshot();
        } else if (context.getTextSnapshot) {
          // 如果 context 没有 clearTextSnapshot 方法，尝试通过设置 null 来清除
          // 这取决于 chrome-devtools-mcp 的实现
          const snapshot = context.getTextSnapshot();
          if (snapshot) {
            // 导航后 snapshot 会自动失效，这里只是记录日志
            api?.logger?.debug('旧的 snapshot 将在下次操作时自动失效');
          }
        }
      } catch (error) {
        api?.logger?.warn('清除 snapshot 时出错', { error: error.message });
      }
    }
    
    // 更新最后导航的 URL
    manager.lastNavigationUrl = newUrl;
  },

  /**
   * 清理浏览器资源
   */
  async cleanupBrowser() {
    const { api } = this;
    const manager = getBrowserManager();
    
    try {
      // 清理上下文
      if (manager.context && typeof manager.context.dispose === 'function') {
        manager.context.dispose();
        api?.logger?.info('浏览器上下文已清理');
      }
      
      // 关闭浏览器
      if (manager.browser && manager.browser.isConnected()) {
        await manager.browser.close();
        api?.logger?.info('浏览器已关闭');
      }
    } catch (error) {
      api?.logger?.warn('清理浏览器时出错', { error: error.message });
    } finally {
      clearBrowserManager();
    }
  }
};