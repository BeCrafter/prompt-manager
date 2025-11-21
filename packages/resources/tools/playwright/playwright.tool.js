/**
 * Playwright Browser Automation Tool - 基于 Playwright 的浏览器自动化工具
 * 
 * 战略意义：
 * 1. 架构隔离性 - 专门的浏览器自动化工具，确保AI操作安全
 * 2. 平台独立性 - 不依赖特定AI平台的浏览器自动化能力
 * 3. 生态自主性 - 作为Prompt Manager生态的关键组件
 * 
 * 设计理念：
 * - 封装 Playwright 核心功能，提供简洁的浏览器自动化接口
 * - 支持多种浏览器（Chromium、Firefox、WebKit）
 * - 提供页面导航、元素操作、截图、内容提取等功能
 * - 智能管理浏览器生命周期（默认自动关闭，可通过 keepAlive 保持）
 * - 一个指令只使用一个窗口/页面实例，确保操作的可预测性
 * 
 * 生态定位：
 * 为 AI 提供强大的浏览器自动化能力，支持网页交互、数据抓取、自动化测试等场景
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
      page: null,
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
      'playwright': '^1.40.0'
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'playwright',
      name: 'Playwright Browser Automation',
      description: '基于 Playwright 的浏览器自动化工具，支持页面导航、元素操作、截图、内容提取等功能。支持 keepAlive 参数保持浏览器状态，便于连续操作和调试。工具数据存储在工具目录的 data 目录下（~/.prompt-manager/toolbox/playwright/data/）',
      version: '1.1.0',
      category: 'utility',
      author: 'Prompt Manager',
      tags: ['browser', 'automation', 'playwright', 'web', 'scraping', 'testing'],
      scenarios: [
        '网页自动化操作',
        '网页内容抓取',
        '表单自动填写',
        '页面截图',
        '网页交互测试',
        '数据采集',
        '连续多步骤操作（使用 keepAlive 保持浏览器状态）',
        '调试和测试（保持浏览器打开以便查看）'
      ],
      limitations: [
        '首次使用时需要安装 Playwright 浏览器（会自动安装，可能需要几分钟）',
        '浏览器二进制文件会下载到 ~/.cache/ms-playwright/ 目录',
        '工具数据存储在 ~/.prompt-manager/toolbox/playwright/data/ 目录下',
        '浏览器操作需要时间，大页面可能较慢',
        '某些网站可能有反爬虫机制',
        '无头模式可能无法处理某些需要真实浏览器的场景',
        '默认情况下操作完成后会自动关闭浏览器（可通过 keepAlive 参数控制）'
      ],
      dataStorage: {
        path: '~/.prompt-manager/toolbox/playwright/data/',
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
              'navigate', 'click', 'fill', 'screenshot', 'getContent',
              'waitForSelector', 'evaluate', 'getTitle', 'getUrl',
              'goBack', 'goForward', 'reload', 'close'
            ]
          },
          url: {
            type: 'string',
            description: '目标URL（navigate方法必需）'
          },
          selector: {
            type: 'string',
            description: 'CSS选择器（click、fill、waitForSelector等方法需要）'
          },
          text: {
            type: 'string',
            description: '要填写的文本（fill方法需要）'
          },
          screenshotPath: {
            type: 'string',
            description: '截图保存路径（screenshot方法可选）'
          },
          keepAlive: {
            type: 'boolean',
            description: '操作完成后是否保持浏览器打开（默认false，操作完成后自动关闭）。设置为true时，浏览器会保持打开状态，可用于连续操作或调试',
            default: false
          },
          options: {
            type: 'object',
            description: '操作选项',
            properties: {
              browser: {
                type: 'string',
                enum: ['chromium', 'firefox', 'webkit'],
                description: '浏览器类型',
                default: 'chromium'
              },
              headless: {
                type: 'boolean',
                description: '是否无头模式',
                default: true
              },
              timeout: {
                type: 'number',
                description: '超时时间（毫秒）',
                default: 30000
              },
              waitUntil: {
                type: 'string',
                enum: ['load', 'domcontentloaded', 'networkidle'],
                description: '等待页面加载状态',
                default: 'load'
              },
              keepAlive: {
                type: 'boolean',
                description: '操作完成后是否保持浏览器打开（默认false）',
                default: false
              }
            }
          },
          script: {
            type: 'string',
            description: '要执行的JavaScript代码（evaluate方法需要）'
          },
          fullPage: {
            type: 'boolean',
            description: '是否截取整页（screenshot方法）',
            default: false
          }
        },
        required: ['method']
      },
      environment: {
        type: 'object',
        properties: {
          PLAYWRIGHT_BROWSER: {
            type: 'string',
            description: '默认浏览器类型（chromium, firefox, webkit）',
            default: 'chromium'
          },
          PLAYWRIGHT_HEADLESS: {
            type: 'string',
            description: '是否无头模式（true/false）',
            default: 'true'
          },
          PLAYWRIGHT_TIMEOUT: {
            type: 'string',
            description: '默认超时时间（毫秒）',
            default: '30000'
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
        solution: '检查 Playwright 是否正确安装，尝试运行 npx playwright install',
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
        match: /element.*not found|selector.*not found|等待元素超时/i,
        solution: '检查选择器是否正确，元素是否存在，或增加等待时间',
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
        code: 'INVALID_SELECTOR',
        description: '无效的选择器',
        match: /invalid.*selector|选择器格式错误/i,
        solution: '检查CSS选择器语法是否正确',
        retryable: false
      },
      {
        code: 'TIMEOUT',
        description: '操作超时',
        match: /timeout|超时/i,
        solution: '增加超时时间或检查操作是否正常',
        retryable: true
      }
    ];
  },

  // --------------------------------------------------------------------------
  // 主执行方法
  // --------------------------------------------------------------------------

  /**
   * 执行工具
   * 
   * 重要说明：
   * - 一个指令（一个 execute 调用）中只会使用一个浏览器窗口/页面实例
   * - 即使需要访问多个 URL，也是在同一个页面中导航，不会创建多个窗口
   * - 这样可以确保操作的可预测性和一致性
   */
  async execute(params) {
    const { api } = this;
    
    api?.logger?.info('Playwright操作开始', { 
      method: params.method,
      url: params.url
    });
    
    try {
      // 1. 参数验证
      this.validateMethodParams(params);
      
      // 2. 导入 Playwright
      const playwright = await this.importToolModule('playwright');
      
      // 3. 确保浏览器已安装
      await this.ensureBrowsersInstalled(playwright, params.options);
      
      // 4. 获取浏览器实例（使用缓存或创建新实例）
      const browser = await this.getBrowser(playwright, params.options);
      const context = await this.getContext(browser, params.options);
      const page = await this.getPage(context);
      
      // 5. 记录当前使用的页面信息
      const currentUrl = page.url();
      const keepAlive = this.getKeepAlive(params);
      
      api?.logger?.info('使用页面实例', { 
        pageUrl: currentUrl,
        method: params.method,
        keepAlive: keepAlive,
        note: '一个指令中只使用一个页面实例，多个操作在同一页面中完成'
      });
      
      // 6. 执行操作方法
      const result = await this.executeMethod(page, params, browser, context);
      
      // 7. 根据 keepAlive 决定是否关闭浏览器
      if (params.method !== 'close') {
        if (!keepAlive) {
          api?.logger?.info('操作完成，自动关闭浏览器（keepAlive=false）');
          await this.cleanupBrowser();
        } else {
          api?.logger?.info('操作完成，保持浏览器打开（keepAlive=true）', {
            currentUrl: page.url(),
            note: '浏览器将保持打开状态，可在后续操作中继续使用'
          });
        }
      }
      
      api?.logger?.info('Playwright操作成功', { method: params.method });
      return result;
      
    } catch (error) {
      api?.logger?.error('Playwright操作失败', { 
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
        } else {
          api?.logger?.info('操作失败，保持浏览器打开（keepAlive=true）');
        }
      }
      
      throw error;
    }
  },

  // --------------------------------------------------------------------------
  // 辅助方法（参数处理、验证等）
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
   * 获取浏览器类型
   */
  getBrowserType(options = {}) {
    const { api } = this;
    return options.browser || 
           api.environment.get('PLAYWRIGHT_BROWSER') || 
           'chromium';
  },

  /**
   * 获取超时时间
   */
  getTimeout(options = {}) {
    const { api } = this;
    return options.timeout || 
           parseInt(api.environment.get('PLAYWRIGHT_TIMEOUT') || '30000', 10);
  },

  /**
   * 验证方法参数（业务层面）
   */
  validateMethodParams(params) {
    const methodRequirements = {
      'navigate': ['url'],
      'click': ['selector'],
      'fill': ['selector', 'text'],
      'screenshot': [], // 可选参数
      'getContent': [],
      'waitForSelector': ['selector'],
      'evaluate': ['script'],
      'getTitle': [],
      'getUrl': [],
      'goBack': [],
      'goForward': [],
      'reload': [],
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
   * 执行操作方法（路由到对应的处理方法）
   */
  async executeMethod(page, params, browser, context) {
    switch (params.method) {
      case 'navigate':
        return await this.handleNavigate(page, params);
      case 'click':
        return await this.handleClick(page, params);
      case 'fill':
        return await this.handleFill(page, params);
      case 'screenshot':
        return await this.handleScreenshot(page, params);
      case 'getContent':
        return await this.handleGetContent(page, params);
      case 'waitForSelector':
        return await this.handleWaitForSelector(page, params);
      case 'evaluate':
        return await this.handleEvaluate(page, params);
      case 'getTitle':
        return await this.handleGetTitle(page, params);
      case 'getUrl':
        return await this.handleGetUrl(page, params);
      case 'goBack':
        return await this.handleGoBack(page, params);
      case 'goForward':
        return await this.handleGoForward(page, params);
      case 'reload':
        return await this.handleReload(page, params);
      case 'close':
        return await this.handleClose(browser, context, page, params);
      default:
        throw new Error(`不支持的方法: ${params.method}`);
    }
  },

  // --------------------------------------------------------------------------
  // 浏览器安装和检查
  // --------------------------------------------------------------------------

  /**
   * 确保浏览器已安装（首次使用时自动安装）
   * 先检查系统是否已存在浏览器，存在则直接使用，不存在才安装
   */
  async ensureBrowsersInstalled(playwright, options = {}) {
    const { api } = this;
    const browserType = this.getBrowserType(options);
    
    // 步骤1：检查 storage 记录（快速检查）
    const browserInstalled = api.storage.getItem('browsers_installed');
    if (browserInstalled && browserInstalled.browserType === browserType) {
      api?.logger?.debug('根据 storage 记录，浏览器已安装，验证可用性...');
      const isAvailable = await this.checkBrowserAvailable(playwright, browserType);
      if (isAvailable) {
        api?.logger?.debug('浏览器验证通过，可直接使用');
        return;
      } else {
        api?.logger?.warn('storage 记录显示已安装，但浏览器不可用，将重新安装');
        api.storage.setItem('browsers_installed', null);
      }
    }
    
    // 步骤2：实际检查浏览器是否已安装（尝试启动浏览器）
    api?.logger?.info('检查系统是否已安装 Playwright 浏览器...', { browserType });
    const isAvailable = await this.checkBrowserAvailable(playwright, browserType);
    
    if (isAvailable) {
      api?.logger?.info('检测到系统已存在 Playwright 浏览器，直接使用', { browserType });
      api.storage.setItem('browsers_installed', {
        browserType,
        installedAt: Date.now(),
        source: 'system_existing'
      });
      return;
    }
    
    // 步骤3：浏览器不存在，执行安装
    api?.logger?.info('未检测到已安装的浏览器，开始安装 Playwright 浏览器...', { 
      browserType,
      note: '这可能需要几分钟时间，请耐心等待'
    });
    
    await this.installBrowser(browserType);
    
    // 验证安装是否成功
    const verifyAvailable = await this.checkBrowserAvailable(playwright, browserType);
    if (!verifyAvailable) {
      throw new Error('浏览器安装完成，但验证失败。请检查安装日志');
    }
    
    // 标记浏览器已安装
    api.storage.setItem('browsers_installed', {
      browserType,
      installedAt: Date.now(),
      source: 'auto_installed'
    });
    
    api?.logger?.info('浏览器安装完成并验证通过', { browserType });
  },

  /**
   * 检查浏览器是否可用（尝试启动浏览器进行验证）
   */
  async checkBrowserAvailable(playwright, browserType = 'chromium') {
    const { api } = this;
    
    try {
      api?.logger?.debug('验证浏览器是否可用', { browserType });
      
      // 获取对应的浏览器类型
      const browserLauncher = this.getBrowserLauncher(playwright, browserType);
      
      // 尝试启动浏览器（无头模式，快速验证）
      const browser = await browserLauncher.launch({ 
        headless: true,
        timeout: 10000 // 10秒超时，快速验证
      });
      
      // 如果能启动，说明浏览器已安装
      await browser.close();
      
      api?.logger?.debug('浏览器验证成功，已安装且可用', { browserType });
      return true;
      
    } catch (error) {
      api?.logger?.debug('浏览器验证失败', { 
        browserType,
        error: error.message,
        note: '浏览器可能未安装或不可用'
      });
      return false;
    }
  },

  /**
   * 获取浏览器启动器
   */
  getBrowserLauncher(playwright, browserType) {
    switch (browserType) {
      case 'firefox':
        return playwright.firefox;
      case 'webkit':
        return playwright.webkit;
      case 'chromium':
      default:
        return playwright.chromium;
    }
  },

  /**
   * 安装浏览器
   */
  async installBrowser(browserType) {
    const { api } = this;
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const fs = await import('fs/promises');
      
      const toolDir = this.__toolDir;
      const nodeModulesPath = path.join(toolDir, 'node_modules');
      const playwrightBinPath = path.join(nodeModulesPath, '.bin', 'playwright');
      
      // 构建脚本运行时环境
      const runtimeEnv = this.buildRuntimeEnvironment(toolDir);
      
      api?.logger?.info('使用脚本运行时环境安装浏览器', {
        cwd: toolDir,
        nodeModulesPath,
        note: '不继承用户环境变量，使用独立的运行时环境'
      });
      
      // 构建安装命令
      const installCommand = await this.buildInstallCommand(
        playwrightBinPath,
        nodeModulesPath,
        browserType,
        fs
      );
      
      // 执行安装命令
      const { stdout, stderr } = await execAsync(installCommand, {
        cwd: toolDir,
        timeout: 600000, // 10分钟超时
        env: runtimeEnv
      });
      
      if (stdout) {
        api?.logger?.info('浏览器安装输出', { stdout: stdout.substring(0, 500) });
      }
      if (stderr && !stderr.includes('warning')) {
        api?.logger?.warn('浏览器安装警告', { stderr: stderr.substring(0, 500) });
      }
      
    } catch (error) {
      api?.logger?.error('浏览器安装失败', { 
        error: error.message,
        note: '请手动运行: npx playwright install ' + browserType
      });
      throw new Error(`Playwright 浏览器未安装。请运行: npx playwright install ${browserType}\n错误详情: ${error.message}`);
    }
  },

  /**
   * 构建运行时环境变量
   */
  buildRuntimeEnvironment(toolDir) {
    const nodeModulesBinPath = path.join(toolDir, 'node_modules', '.bin');
    return {
      // 系统必需变量
      PATH: `${nodeModulesBinPath}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
      HOME: process.env.HOME || os.homedir(),
      USER: process.env.USER || 'user',
      // Node.js 相关
      NODE_PATH: path.join(toolDir, 'node_modules'),
      // Playwright 浏览器路径（使用默认路径）
      PLAYWRIGHT_BROWSERS_PATH: '0',
      // 确保使用工具目录的 node_modules
      npm_config_prefix: toolDir,
      // 平台相关
      ...(process.platform === 'win32' ? { 
        PATHEXT: process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM'
      } : {})
    };
  },

  /**
   * 构建安装命令
   */
  async buildInstallCommand(playwrightBinPath, nodeModulesPath, browserType, fs) {
    const { api } = this;
    
    // 优先：使用本地 playwright CLI
    try {
      await fs.access(playwrightBinPath);
      const installCommand = `"${playwrightBinPath}" install ${browserType}`;
      api?.logger?.info('使用本地 playwright CLI 安装浏览器', { 
        command: installCommand,
        playwrightPath: playwrightBinPath
      });
      return installCommand;
    } catch {
      // 其次：使用 playwright/cli.js
      const playwrightCliPath = path.join(nodeModulesPath, 'playwright', 'cli.js');
      try {
        await fs.access(playwrightCliPath);
        const nodePath = process.execPath;
        const installCommand = `"${nodePath}" "${playwrightCliPath}" install ${browserType}`;
        api?.logger?.info('使用 playwright/cli.js 安装浏览器', { 
          command: installCommand,
          nodePath,
          cliPath: playwrightCliPath
        });
        return installCommand;
      } catch {
        // 最后：使用 npx（回退方案）
        const nodePath = process.execPath;
        const installCommand = `"${nodePath}" -e "require('child_process').spawnSync('npx', ['--yes', 'playwright@latest', 'install', '${browserType}'], {stdio: 'inherit', env: process.env})"`;
        api?.logger?.warn('使用 npx 安装浏览器（回退方案，可能较慢）', { 
          command: installCommand,
          note: '建议确保 playwright 已正确安装到工具目录'
        });
        return installCommand;
      }
    }
  },

  // --------------------------------------------------------------------------
  // 浏览器实例管理
  // --------------------------------------------------------------------------

  /**
   * 获取浏览器实例（使用全局管理器，跨执行保持）
   */
  async getBrowser(playwright, options = {}) {
    const { api } = this;
    const manager = getBrowserManager(this.__toolName);
    
    // 如果已有浏览器实例且仍然连接，直接返回
    if (manager.browser && manager.browser.isConnected()) {
      api?.logger?.info('复用已存在的浏览器实例', {
        note: '使用之前创建的浏览器，保持会话状态（跨执行保持）'
      });
      manager.lastUsed = Date.now();
      return manager.browser;
    }
    
    // 创建新浏览器实例
    const browserType = this.getBrowserType(options);
    const headless = options.headless !== undefined 
                     ? options.headless 
                     : (api.environment.get('PLAYWRIGHT_HEADLESS') === 'true');
    
    api?.logger?.info('创建新浏览器实例', { 
      browserType, 
      headless,
      note: '首次创建浏览器实例'
    });
    
    const browserLauncher = this.getBrowserLauncher(playwright, browserType);
    const browser = await browserLauncher.launch({ headless });
    
    // 存储到全局管理器
    manager.browser = browser;
    manager.lastUsed = Date.now();
    
    return browser;
  },

  /**
   * 获取浏览器上下文（使用全局管理器，跨执行保持）
   */
  async getContext(browser, options = {}) {
    const { api } = this;
    const manager = getBrowserManager(this.__toolName);
    
    // 如果已有上下文且未关闭，直接返回
    if (manager.context) {
      try {
        if (!manager.context.isClosed()) {
          api?.logger?.info('复用已存在的浏览器上下文', {
            note: '使用之前创建的上下文，保持会话状态（跨执行保持）'
          });
          manager.lastUsed = Date.now();
          return manager.context;
        }
      } catch {
        // 上下文已关闭，继续创建新上下文
        manager.context = null;
      }
    }
    
    // 创建新上下文
    api?.logger?.info('创建新浏览器上下文', {
      note: '首次创建浏览器上下文'
    });
    const context = await browser.newContext();
    
    // 存储到全局管理器
    manager.context = context;
    manager.lastUsed = Date.now();
    
    return context;
  },

  /**
   * 获取页面实例（使用全局管理器，跨执行保持，确保一个指令只使用一个页面）
   */
  async getPage(context) {
    const { api } = this;
    const manager = getBrowserManager(this.__toolName);
    
    // 如果已有页面且未关闭，直接返回
    if (manager.page) {
      try {
        if (!manager.page.isClosed()) {
          const currentUrl = manager.page.url();
          api?.logger?.info('复用已存在的页面实例', { 
            url: currentUrl,
            note: '使用之前创建的页面，保持页面状态（跨执行保持）'
          });
          manager.lastUsed = Date.now();
          return manager.page;
        }
      } catch {
        // 页面已关闭，继续创建新页面
        manager.page = null;
      }
    }
    
    // 创建新页面
    api?.logger?.info('创建新页面实例', {
      note: '首次创建页面，一个指令中只创建一个页面实例'
    });
    const page = await context.newPage();
    
    // 存储到全局管理器
    manager.page = page;
    manager.lastUsed = Date.now();
    
    return page;
  },

  // --------------------------------------------------------------------------
  // 页面操作方法
  // --------------------------------------------------------------------------

  /**
   * 处理导航操作
   */
  async handleNavigate(page, params) {
    if (!params.url) {
      throw new Error('navigate方法需要url参数');
    }
    
    const { api } = this;
    const options = params.options || {};
    const timeout = this.getTimeout(options);
    const waitUntil = options.waitUntil || 'load';
    
    api?.logger?.info('导航到URL', { url: params.url, waitUntil, timeout });
    
    await page.goto(params.url, { waitUntil, timeout });
    
    return {
      success: true,
      url: page.url(),
      title: await page.title()
    };
  },

  /**
   * 处理点击操作
   */
  async handleClick(page, params) {
    if (!params.selector) {
      throw new Error('click方法需要selector参数');
    }
    
    const { api } = this;
    const timeout = this.getTimeout(params.options);
    
    api?.logger?.info('点击元素', { selector: params.selector });
    await page.click(params.selector, { timeout });
    
    return {
      success: true,
      selector: params.selector
    };
  },

  /**
   * 处理填写操作
   */
  async handleFill(page, params) {
    if (!params.selector) {
      throw new Error('fill方法需要selector参数');
    }
    if (params.text === undefined) {
      throw new Error('fill方法需要text参数');
    }
    
    const { api } = this;
    const timeout = this.getTimeout(params.options);
    
    api?.logger?.info('填写表单', { selector: params.selector });
    await page.fill(params.selector, params.text, { timeout });
    
    return {
      success: true,
      selector: params.selector,
      text: params.text
    };
  },

  /**
   * 处理截图操作
   */
  async handleScreenshot(page, params) {
    const { api } = this;
    
    // 检查是否需要导航
    const currentUrl = page.url();
    const needsNavigation = params.url && 
                           (currentUrl === 'about:blank' || currentUrl === '' || currentUrl !== params.url);
    
    if (needsNavigation) {
      await this.navigateForScreenshot(page, params);
    }
    
    // 处理截图路径
    const screenshotPath = await this.resolveScreenshotPath(params);
    
    // 验证页面状态
    const finalUrl = page.url();
    if (finalUrl === 'about:blank' || finalUrl === '') {
      throw new Error('无法截图：页面为空。请提供 url 参数或先调用 navigate 方法导航到目标页面');
    }
    
    // 执行截图
    const timeout = this.getTimeout(params.options);
    api?.logger?.info('准备截图', { 
      path: screenshotPath, 
      fullPage: params.fullPage, 
      currentUrl: finalUrl
    });
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: params.fullPage || false,
      timeout
    });
    
    api?.logger?.info('截图完成', { path: screenshotPath, url: finalUrl });
    
    return {
      success: true,
      path: screenshotPath,
      url: finalUrl
    };
  },

  /**
   * 为截图导航到URL
   */
  async navigateForScreenshot(page, params) {
    const { api } = this;
    const options = params.options || {};
    const timeout = this.getTimeout(options);
    const waitUntil = options.waitUntil || 'networkidle';
    
    api?.logger?.info('需要导航到URL', { 
      currentUrl: page.url(),
      targetUrl: params.url,
      note: '在同一页面中导航，不创建新页面'
    });
    
    // 导航并等待页面完全加载
    await page.goto(params.url, { waitUntil, timeout });
    
    // 额外等待网络空闲
    try {
      await page.waitForLoadState('networkidle', { timeout });
      api?.logger?.info('页面网络空闲，准备截图');
    } catch (waitError) {
      api?.logger?.warn('等待 networkidle 超时，使用 domcontentloaded', { 
        error: waitError.message 
      });
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    }
    
    // 再等待一小段时间，确保页面完全渲染
    await page.waitForTimeout(1000);
    
    api?.logger?.info('导航完成，页面已完全加载', { 
      url: page.url(),
      note: '准备截图'
    });
  },

  /**
   * 解析截图路径
   * 默认保存到工具目录的 data 子目录下
   */
  async resolveScreenshotPath(params) {
    let screenshotPath = params.screenshotPath;
    
    if (!screenshotPath) {
      // 默认保存到 data 目录
      const timestamp = Date.now();
      const dataDir = path.join(this.__toolDir, 'data');
      screenshotPath = path.join(dataDir, `screenshot-${timestamp}.png`);
    } else {
      // 初始化文件系统并解析路径（如果以~开头）
      await this.initializeFilesystem();
      screenshotPath = this.resolvePromptManagerPath(screenshotPath);
    }
    
    // 确保目录存在
    const fs = await import('fs/promises');
    const dir = path.dirname(screenshotPath);
    await fs.mkdir(dir, { recursive: true });
    
    return screenshotPath;
  },

  /**
   * 处理获取内容操作
   */
  async handleGetContent(page, params) {
    const { api } = this;
    
    api?.logger?.info('获取页面内容');
    const content = await page.content();
    
    return {
      success: true,
      content,
      length: content.length
    };
  },

  /**
   * 处理等待选择器操作
   */
  async handleWaitForSelector(page, params) {
    if (!params.selector) {
      throw new Error('waitForSelector方法需要selector参数');
    }
    
    const { api } = this;
    const timeout = this.getTimeout(params.options);
    
    api?.logger?.info('等待元素', { selector: params.selector, timeout });
    await page.waitForSelector(params.selector, { timeout });
    
    return {
      success: true,
      selector: params.selector
    };
  },

  /**
   * 处理执行脚本操作
   */
  async handleEvaluate(page, params) {
    if (!params.script) {
      throw new Error('evaluate方法需要script参数');
    }
    
    const { api } = this;
    
    api?.logger?.info('执行JavaScript', { scriptLength: params.script.length });
    const result = await page.evaluate(params.script);
    
    return {
      success: true,
      result
    };
  },

  /**
   * 处理获取标题操作
   */
  async handleGetTitle(page, params) {
    const { api } = this;
    
    api?.logger?.info('获取页面标题');
    const title = await page.title();
    
    return {
      success: true,
      title
    };
  },

  /**
   * 处理获取URL操作
   */
  async handleGetUrl(page, params) {
    const { api } = this;
    
    api?.logger?.info('获取页面URL');
    const url = page.url();
    
    return {
      success: true,
      url
    };
  },

  /**
   * 处理后退操作
   */
  async handleGoBack(page, params) {
    const { api } = this;
    
    api?.logger?.info('浏览器后退');
    await page.goBack();
    
    return {
      success: true,
      url: page.url()
    };
  },

  /**
   * 处理前进操作
   */
  async handleGoForward(page, params) {
    const { api } = this;
    
    api?.logger?.info('浏览器前进');
    await page.goForward();
    
    return {
      success: true,
      url: page.url()
    };
  },

  /**
   * 处理刷新操作
   */
  async handleReload(page, params) {
    const { api } = this;
    const options = params.options || {};
    const waitUntil = options.waitUntil || 'load';
    
    api?.logger?.info('刷新页面', { waitUntil });
    await page.reload({ waitUntil });
    
    return {
      success: true,
      url: page.url(),
      title: await page.title()
    };
  },

  /**
   * 处理关闭操作
   */
  async handleClose(browser, context, page, params) {
    const { api } = this;
    
    api?.logger?.info('关闭浏览器');
    await this.cleanupBrowser();
    
    return {
      success: true,
      message: '浏览器已关闭'
    };
  },

  // --------------------------------------------------------------------------
  // 资源清理
  // --------------------------------------------------------------------------

  /**
   * 清理浏览器资源（关闭页面、上下文和浏览器）
   */
  async cleanupBrowser() {
    const { api } = this;
    const manager = getBrowserManager(this.__toolName);
    
    // 关闭页面
    try {
      if (manager.page && !manager.page.isClosed()) {
        await manager.page.close();
        api?.logger?.info('页面已关闭');
      }
    } catch (error) {
      api?.logger?.warn('关闭页面时出错', { error: error.message });
    }
    
    // 关闭上下文
    try {
      if (manager.context && !manager.context.isClosed()) {
        await manager.context.close();
        api?.logger?.info('浏览器上下文已关闭');
      }
    } catch (error) {
      api?.logger?.warn('关闭上下文时出错', { error: error.message });
    }
    
    // 关闭浏览器
    try {
      if (manager.browser && manager.browser.isConnected()) {
        await manager.browser.close();
        api?.logger?.info('浏览器已关闭');
      }
    } catch (error) {
      api?.logger?.warn('关闭浏览器时出错', { error: error.message });
    }
    
    // 清理全局管理器
    clearBrowserManager(this.__toolName);
  }
};
