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

/**
 * 获取或创建浏览器实例管理器
 */
function getBrowserManager(toolName) {
  if (!browserInstances.has(toolName)) {
    browserInstances.set(toolName, {
      browser: null,
      context: null,
      lastUsed: null
    });
  }
  return browserInstances.get(toolName);
}

/**
 * 清理浏览器实例管理器
 */
function clearBrowserManager(toolName) {
  browserInstances.delete(toolName);
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
              'click', 'fill', 'hover', 'pressKey', 'drag', 'uploadFile', 'handleDialog', 'fillForm',
              // 导航自动化
              'navigate', 'newPage', 'closePage', 'listPages', 'selectPage', 'waitFor',
              // 网络监控
              'listNetworkRequests', 'getNetworkRequest',
              // 性能分析
              'startPerformanceTrace', 'stopPerformanceTrace', 'analyzePerformance',
              // 调试
              'evaluateScript', 'getConsoleMessage', 'listConsoleMessages',
              'takeScreenshot', 'takeSnapshot',
              // 模拟
              'emulate', 'resizePage',
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
            description: '文件路径（uploadFile 方法）'
          },
          key: {
            type: 'string',
            description: '按键或组合键（pressKey 方法，如 "Enter", "Control+A"）'
          },
          action: {
            type: 'string',
            description: '对话框操作（handleDialog 方法：accept/dismiss）',
            enum: ['accept', 'dismiss']
          },
          promptText: {
            type: 'string',
            description: '提示框文本（handleDialog 方法，action=accept 时）'
          },
          elements: {
            type: 'array',
            description: '表单元素数组（fillForm 方法）',
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
            description: '目标URL（navigate、newPage 方法）'
          },
          type: {
            type: 'string',
            description: '导航类型（navigate 方法：url/back/forward/reload）',
            enum: ['url', 'back', 'forward', 'reload'],
            default: 'url'
          },
          pageIdx: {
            type: 'number',
            description: '页面索引（selectPage、closePage 方法）'
          },
          text: {
            type: 'string',
            description: '要等待的文本（waitFor 方法）'
          },
          // 网络监控参数
          includePreservedRequests: {
            type: 'boolean',
            description: '是否包含保留的请求（listNetworkRequests 方法）',
            default: false
          },
          resourceTypes: {
            type: 'array',
            description: '资源类型过滤（listNetworkRequests 方法）',
            items: { type: 'string' }
          },
          reqid: {
            type: 'number',
            description: '网络请求ID（getNetworkRequest 方法）'
          },
          // 性能分析参数
          reload: {
            type: 'boolean',
            description: '是否重新加载页面（startPerformanceTrace 方法）',
            default: false
          },
          autoStop: {
            type: 'boolean',
            description: '是否自动停止追踪（startPerformanceTrace 方法）',
            default: false
          },
          insightName: {
            type: 'string',
            description: '性能洞察名称（analyzePerformance 方法）'
          },
          // 调试参数
          function: {
            type: 'string',
            description: '要执行的JavaScript函数（evaluateScript 方法）'
          },
          args: {
            type: 'array',
            description: '函数参数（evaluateScript 方法）'
          },
          msgid: {
            type: 'number',
            description: '控制台消息ID（getConsoleMessage 方法）'
          },
          includePreservedMessages: {
            type: 'boolean',
            description: '是否包含保留的消息（listConsoleMessages 方法）',
            default: false
          },
          types: {
            type: 'array',
            description: '消息类型过滤（listConsoleMessages 方法）',
            items: { type: 'string', enum: ['error', 'warning', 'info', 'log'] }
          },
          verbose: {
            type: 'boolean',
            description: '是否详细模式（takeSnapshot 方法）',
            default: false
          },
          // 模拟参数
          device: {
            type: 'string',
            description: '设备名称（emulate 方法，如 "iPhone 12"）'
          },
          width: {
            type: 'number',
            description: '视口宽度（resizePage 方法）'
          },
          height: {
            type: 'number',
            description: '视口高度（resizePage 方法）'
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
        solution: '请先调用 takeSnapshot 获取页面快照，然后使用快照中的 uid',
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
        solution: '请先调用 takeSnapshot 获取页面快照，然后使用快照中的 uid',
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
        solution: '页面已被关闭，请调用 listPages 查看可用页面',
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
      
      // 4. 获取工具 handler
      const tool = await this.getToolHandler(params.method, chromeDevToolsMcp);
      if (!tool) {
        throw new Error(`不支持的方法: ${params.method}。请检查 chrome-devtools-mcp 是否正确安装，或该方法是否存在于工具库中。`);
      }
      
      // 5. 转换参数格式
      const transformedParams = this.transformParams(params.method, params);
      
      // 6. 创建请求和响应对象
      const request = { params: transformedParams };
      const response = this.createMcpResponse();
      
      // 7. 调用工具 handler
      await tool.handler(request, response, context);
      
      // 8. 处理响应
      const content = await response.handle(params.method, context);
      
      // 9. 格式化返回结果
      const result = this.formatResponse(content, params.method);
      
      // 10. 根据 keepAlive 决定是否关闭浏览器
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
      'pressKey': ['key'],
      'drag': ['from_uid', 'to_uid'],
      'uploadFile': ['uid', 'filePath'],
      'handleDialog': ['action'],
      'fillForm': ['elements'],
      'navigate': ['url'],
      'newPage': ['url'],
      'closePage': ['pageIdx'],
      'selectPage': ['pageIdx'],
      'waitFor': ['text'],
      'listNetworkRequests': [],
      'getNetworkRequest': ['reqid'],
      'startPerformanceTrace': [],
      'stopPerformanceTrace': [],
      'analyzePerformance': ['insightName'],
      'evaluateScript': ['function'],
      'getConsoleMessage': ['msgid'],
      'listConsoleMessages': [],
      'takeScreenshot': [],
      'takeSnapshot': [],
      'emulate': ['device'],
      'resizePage': ['width', 'height'],
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
      'pressKey': 'input',
      'drag': 'input',
      'uploadFile': 'input',
      'handleDialog': 'input',
      'fillForm': 'input',
      // 导航自动化
      'navigate': 'pages',
      'newPage': 'pages',
      'closePage': 'pages',
      'listPages': 'pages',
      'selectPage': 'pages',
      'waitFor': 'pages',
      // 网络监控
      'listNetworkRequests': 'network',
      'getNetworkRequest': 'network',
      // 性能分析
      'startPerformanceTrace': 'performance',
      'stopPerformanceTrace': 'performance',
      'analyzePerformance': 'performance',
      // 调试
      'evaluateScript': 'script',
      'getConsoleMessage': 'console',
      'listConsoleMessages': 'console',
      'takeScreenshot': 'screenshot',
      'takeSnapshot': 'snapshot',
      // 模拟
      'emulate': 'emulation',
      'resizePage': 'emulation'
    };
    return categoryMap[method];
  },

  /**
   * 获取工具名称（chrome-devtools-mcp 中的实际名称）
   */
  getToolName(method) {
    const nameMap = {
      'navigate': 'navigatePage',
      'pressKey': 'pressKey',
      'startPerformanceTrace': 'performanceStartTrace',
      'stopPerformanceTrace': 'performanceStopTrace',
      'analyzePerformance': 'performanceAnalyzeInsight',
      'evaluateScript': 'evaluateScript',
      'takeScreenshot': 'takeScreenshot',
      'takeSnapshot': 'takeSnapshot'
    };
    return nameMap[method] || method;
  },


  /**
   * 获取或创建 McpContext
   */
  async getMcpContext(options = {}) {
    const { api } = this;
    const manager = getBrowserManager(this.__toolName);
    
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
      case 'pressKey':
        transformed.key = params.key;
        break;
      case 'drag':
        transformed.from_uid = params.from_uid;
        transformed.to_uid = params.to_uid;
        break;
      case 'uploadFile':
        transformed.uid = params.uid;
        transformed.filePath = params.filePath;
        break;
      case 'handleDialog':
        transformed.action = params.action;
        if (params.promptText) {
          transformed.promptText = params.promptText;
        }
        break;
      case 'fillForm':
        transformed.elements = params.elements;
        break;
      case 'navigate':
        transformed.type = params.type || 'url';
        if (params.url) {
          transformed.url = params.url;
        }
        if (params.timeout) {
          transformed.timeout = params.timeout;
        }
        break;
      case 'newPage':
        transformed.url = params.url;
        if (params.timeout) {
          transformed.timeout = params.timeout;
        }
        break;
      case 'closePage':
        transformed.pageIdx = params.pageIdx;
        break;
      case 'selectPage':
        transformed.pageIdx = params.pageIdx;
        break;
      case 'waitFor':
        transformed.text = params.text;
        if (params.timeout) {
          transformed.timeout = params.timeout;
        }
        break;
      case 'listNetworkRequests':
        if (params.includePreservedRequests !== undefined) {
          transformed.includePreservedRequests = params.includePreservedRequests;
        }
        if (params.resourceTypes) {
          transformed.resourceTypes = params.resourceTypes;
        }
        break;
      case 'getNetworkRequest':
        transformed.reqid = params.reqid;
        break;
      case 'startPerformanceTrace':
        if (params.reload !== undefined) {
          transformed.reload = params.reload;
        }
        if (params.autoStop !== undefined) {
          transformed.autoStop = params.autoStop;
        }
        break;
      case 'analyzePerformance':
        transformed.insightName = params.insightName;
        break;
      case 'evaluateScript':
        transformed.function = params.function;
        if (params.args) {
          transformed.args = params.args;
        }
        break;
      case 'getConsoleMessage':
        transformed.msgid = params.msgid;
        break;
      case 'listConsoleMessages':
        if (params.includePreservedMessages !== undefined) {
          transformed.includePreservedMessages = params.includePreservedMessages;
        }
        if (params.types) {
          transformed.types = params.types;
        }
        break;
      case 'takeSnapshot':
        if (params.verbose !== undefined) {
          transformed.verbose = params.verbose;
        }
        break;
      case 'emulate':
        transformed.device = params.device;
        break;
      case 'resizePage':
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
            mimeType: image.mimeType
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
    if (!content || content.length === 0) {
      return { success: true, method };
    }
    
    // 提取文本内容
    const texts = content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
    
    // 提取图片
    const images = content
      .filter(item => item.type === 'image')
      .map(item => ({
        data: item.data,
        mimeType: item.mimeType
      }));
    
    const result = {
      success: true,
      method,
      text: texts || undefined,
      images: images.length > 0 ? images : undefined
    };
    
    // 对于特定方法，提取结构化数据
    if (method === 'listPages') {
      result.pages = this.extractPagesFromText(texts);
    } else if (method === 'listNetworkRequests') {
      result.requests = this.extractRequestsFromText(texts);
    } else if (method === 'listConsoleMessages') {
      result.messages = this.extractMessagesFromText(texts);
    } else if (method === 'takeSnapshot') {
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
   * 清理浏览器资源
   */
  async cleanupBrowser() {
    const { api } = this;
    const manager = getBrowserManager(this.__toolName);
    
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
      // 清理全局管理器
      clearBrowserManager(this.__toolName);
    }
  }
};