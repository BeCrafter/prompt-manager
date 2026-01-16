/**
 * agent-browser - AI 友好的浏览器自动化工具
 *
 * 战略意义：
 * 1. AI 优先设计 - 专为 Claude Code、Cursor 等智能体优化
 * 2. 上下文效率 - 93% 上下文节省，通过 Snapshot + Refs 机制
 * 3. 直接 API - 使用 BrowserManager 类，避免 CLI 解析开销
 * 4. 确定性选择 - 使用 @e1, @e2 引用代替易变的 CSS 选择器
 *
 * 注意：此工具将在独立沙箱环境中运行，依赖将自动安装到工具目录的 node_modules 中
 * 所有日志将输出到 ~/.prompt-manager/toolbox/agent-browser/run.log 文件中
 */

export default {
  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      'agent-browser': '^0.5.0'
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'agent-browser',
      name: 'agent-browser',
      description: 'AI 友好的浏览器自动化工具，使用 BrowserManager API 提供基于引用的确定性元素选择',
      version: '1.0.0',
      category: 'browser',
      author: 'Vercel Labs',
      tags: ['browser', 'automation', 'ai', 'playwright', 'headless'],
      scenarios: [
        '网页自动化测试',
        'AI 智能体浏览器控制',
        '网页数据抓取',
        '表单自动填充',
        '截图和快照'
      ],
      limitations: [
        '需要安装 agent-browser npm 包',
        '浏览器实例会在工具执行期间保持活跃',
        '复杂场景可能需要 headed 模式调试'
      ]
    };
  },

  /**
   * 获取参数 Schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: '执行的操作类型',
            enum: [
              // 核心命令
              'launch', 'navigate', 'click', 'type', 'fill',
              'check', 'uncheck', 'upload', 'dblclick', 'focus',
              'drag', 'screenshot', 'snapshot', 'evaluate', 'wait',
              'scroll', 'select', 'hover', 'content',
              'close', 'back', 'forward', 'reload',

              // 查找命令（语义定位器）
              'getbyrole', 'getbytext', 'getbylabel', 'getbyplaceholder',
              'getbyalttext', 'getbytitle', 'getbytestid', 'nth',

              // 获取信息
              'gettext', 'gethtml', 'getattribute', 'isvisible',
              'isenabled', 'ischecked', 'count', 'boundingbox',

              // 导航和控制
              'url', 'title', 'press', 'pause',

              // 标签页和窗口
              'tab_new', 'tab_list', 'tab_switch', 'tab_close',
              'window_new',

              // Cookie 和存储
              'cookies_get', 'cookies_set', 'cookies_clear',
              'storage_get', 'storage_set', 'storage_clear',

              // 网络和路由
              'route', 'unroute', 'requests', 'download',

              // 设置和模拟
              'viewport', 'device', 'geolocation', 'permissions',
              'useragent', 'timezone', 'locale', 'offline', 'headers',

              // 高级功能
              'dialog', 'pdf', 'tracing', 'har',
              'console', 'errors', 'video', 'screencast'
            ]
          },
          // 导航相关
          url: {
            type: 'string',
            description: '要导航的 URL（用于 navigate, tab_new 等操作）'
          },
          waitUntil: {
            type: 'string',
            description: '等待状态',
            enum: ['load', 'domcontentloaded', 'networkidle']
          },

          // 元素交互相关
          selector: {
            type: 'string',
            description: '元素选择器或引用（如 @e1, @e2）'
          },
          text: {
            type: 'string',
            description: '文本内容（用于 type, fill 等操作）'
          },
          value: {
            type: 'string',
            description: '值（用于 fill, select 等操作）'
          },
          values: {
            type: 'array',
            items: { type: 'string' },
            description: '多个值（用于 multiselect）'
          },
          button: {
            type: 'string',
            description: '鼠标按钮',
            enum: ['left', 'right', 'middle']
          },
          clickCount: {
            type: 'number',
            description: '点击次数'
          },
          delay: {
            type: 'number',
            description: '延迟时间（毫秒）'
          },
          clear: {
            type: 'boolean',
            description: '是否清除现有内容'
          },

          // 拖拽相关
          source: {
            type: 'string',
            description: '源元素选择器'
          },
          target: {
            type: 'string',
            description: '目标元素选择器'
          },

          // 上传相关
          files: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ],
            description: '文件路径或文件路径数组'
          },

          // 查找命令相关
          role: {
            type: 'string',
            description: 'ARIA 角色（如 button, link, textbox）'
          },
          name: {
            type: 'string',
            description: '元素名称'
          },
          label: {
            type: 'string',
            description: '元素标签'
          },
          placeholder: {
            type: 'string',
            description: '占位符文本'
          },
          altText: {
            type: 'string',
            description: 'alt 文本'
          },
          testId: {
            type: 'string',
            description: 'test-id'
          },
          subaction: {
            type: 'string',
            description: '子操作（click, fill, check, hover）',
            enum: ['click', 'fill', 'check', 'hover', 'text']
          },
          exact: {
            type: 'boolean',
            description: '是否精确匹配'
          },
          index: {
            type: 'number',
            description: '元素索引'
          },

          // 等待相关
          timeout: {
            type: 'number',
            description: '超时时间（毫秒）'
          },
          state: {
            type: 'string',
            description: '等待状态',
            enum: ['attached', 'detached', 'visible', 'hidden']
          },

          // 滚动相关
          direction: {
            type: 'string',
            description: '滚动方向',
            enum: ['up', 'down', 'left', 'right']
          },
          amount: {
            type: 'number',
            description: '滚动量（像素）'
          },
          x: {
            type: 'number',
            description: 'X 坐标'
          },
          y: {
            type: 'number',
            description: 'Y 坐标'
          },

          // Cookie 相关
          cookies: {
            type: 'array',
            description: 'Cookie 数组',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                url: { type: 'string' },
                domain: { type: 'string' },
                path: { type: 'string' },
                expires: { type: 'number' },
                httpOnly: { type: 'boolean' },
                secure: { type: 'boolean' },
                sameSite: { type: 'string' }
              }
            }
          },
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URL 数组'
          },
          key: {
            type: 'string',
            description: '存储键'
          },
          storageType: {
            type: 'string',
            description: '存储类型',
            enum: ['local', 'session']
          },

          // 网络相关
          routeUrl: {
            type: 'string',
            description: '路由 URL'
          },
          responseBody: {
            type: 'object',
            description: '响应体配置',
            properties: {
              status: { type: 'number' },
              body: { type: 'string' },
              contentType: { type: 'string' },
              headers: { type: 'object' }
            }
          },
          abort: {
            type: 'boolean',
            description: '是否中止请求'
          },
          filter: {
            type: 'string',
            description: '请求过滤器'
          },

          // 设置相关
          width: {
            type: 'number',
            description: '宽度'
          },
          height: {
            type: 'number',
            description: '高度'
          },
          viewport: {
            type: 'object',
            description: '视口尺寸',
            properties: {
              width: { type: 'number' },
              height: { type: 'number' }
            }
          },
          device: {
            type: 'string',
            description: '设备名称（如 "iPhone 14"）'
          },
          latitude: {
            type: 'number',
            description: '纬度'
          },
          longitude: {
            type: 'number',
            description: '经度'
          },
          accuracy: {
            type: 'number',
            description: '精度（米）'
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: '权限列表'
          },
          grant: {
            type: 'boolean',
            description: '是否授予权限'
          },
          userAgent: {
            type: 'string',
            description: '用户代理字符串'
          },
          timezone: {
            type: 'string',
            description: '时区（如 "America/New_York"）'
          },
          locale: {
            type: 'string',
            description: '区域设置（如 "en-US"）'
          },
          offline: {
            type: 'boolean',
            description: '是否离线模式'
          },
          headers: {
            type: 'object',
            description: 'HTTP 头部'
          },

          // 对话框相关
          dialogResponse: {
            type: 'string',
            description: '对话框响应',
            enum: ['accept', 'dismiss']
          },
          promptText: {
            type: 'string',
            description: '对话框提示文本'
          },

          // PDF 相关
          pdfPath: {
            type: 'string',
            description: 'PDF 保存路径'
          },
          format: {
            type: 'string',
            description: 'PDF 格式',
            enum: ['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']
          },

          // 录制相关
          screenshotPath: {
            type: 'string',
            description: '截图保存路径'
          },
          fullPage: {
            type: 'boolean',
            description: '是否截取整页'
          },
          screenshotFormat: {
            type: 'string',
            description: '截图格式',
            enum: ['png', 'jpeg']
          },
          quality: {
            type: 'number',
            description: '图片质量（1-100）'
          },
          videoPath: {
            type: 'string',
            description: '视频保存路径'
          },
          tracePath: {
            type: 'string',
            description: '追踪保存路径'
          },
          harPath: {
            type: 'string',
            description: 'HAR 保存路径'
          },
          statePath: {
            type: 'string',
            description: '状态保存路径'
          },

          // 高级功能
          script: {
            type: 'string',
            description: 'JavaScript 脚本'
          },
          scriptArgs: {
            type: 'array',
            description: '脚本参数数组'
          },
          attribute: {
            type: 'string',
            description: '属性名'
          },
          event: {
            type: 'string',
            description: '事件名称'
          },
          eventInit: {
            type: 'object',
            description: '事件初始化数据'
          },

          // screencast 相关
          screencastFormat: {
            type: 'string',
            enum: ['jpeg', 'png'],
            description: 'screencast 格式'
          },
          screencastMaxWidth: {
            type: 'number',
            description: 'screencast 最大宽度'
          },
          screencastMaxHeight: {
            type: 'number',
            description: 'screencast 最大高度'
          },
          everyNthFrame: {
            type: 'number',
            description: '每隔 N 帧捕获一次'
          },

          // 框架相关
          frameSelector: {
            type: 'string',
            description: '框架选择器'
          },
          frameName: {
            type: 'string',
            description: '框架名称'
          },
          frameUrl: {
            type: 'string',
            description: '框架 URL'
          },

          // 杂项
          clearConsole: {
            type: 'boolean',
            description: '是否清除控制台'
          },
          clearErrors: {
            type: 'boolean',
            description: '是否清除错误'
          },
          clearRequests: {
            type: 'boolean',
            description: '是否清除请求'
          },
          keys: {
            type: 'string',
            description: '按键（如 "Enter", "Ctrl+A"）'
          }
        }
      },
      environment: {
        type: 'object',
        properties: {
          AGENT_BROWSER_EXECUTABLE_PATH: {
            type: 'string',
            description: '浏览器可执行文件路径'
          },
          AGENT_BROWSER_HEADLESS: {
            type: 'string',
            description: '是否使用无头模式',
            default: 'true'
          }
        }
      }
    };
  },

  /**
   * 获取业务错误定义
   */
  getBusinessErrors() {
    return [
      {
        code: 'BROWSER_NOT_LAUNCHED',
        description: '浏览器未启动',
        match: /browser not launched/i,
        solution: '先调用 launch 操作启动浏览器',
        retryable: false
      },
      {
        code: 'ELEMENT_NOT_FOUND',
        description: '元素未找到',
        match: /element.*not found|selector.*invalid/i,
        solution: '使用 snapshot 获取有效的元素引用',
        retryable: false
      },
      {
        code: 'NAVIGATION_FAILED',
        description: '导航失败',
        match: /navigation.*failed|invalid url/i,
        solution: '检查 URL 是否有效',
        retryable: true
      },
      {
        code: 'BROWSER_LAUNCH_FAILED',
        description: '浏览器启动失败',
        match: /browser.*launch|Failed to launch/i,
        solution: '检查浏览器安装或使用 executablePath 指定路径',
        retryable: true
      },
      {
        code: 'TIMEOUT',
        description: '操作超时',
        match: /timeout|timed out/i,
        solution: '增加 timeout 参数或检查网络连接',
        retryable: true
      },
      {
        code: 'FRAME_NOT_FOUND',
        description: '框架未找到',
        match: /frame.*not found/i,
        solution: '检查框架选择器、名称或 URL 是否正确',
        retryable: false
      }
    ];
  },

  /**
   * 获取或创建浏览器管理器实例
   */
  async getBrowserManager(options = {}) {
    const { api } = this;

    if (!this.__browserManager) {
      try {
        const { BrowserManager } = await this.importToolModule('agent-browser');

        this.__browserManager = new BrowserManager();

        // 启动浏览器
        const launchOptions = {
          headless: options.headless !== false
        };

        if (options.executablePath) {
          launchOptions.executablePath = options.executablePath;
        }

        if (options.viewport) {
          launchOptions.viewport = options.viewport;
        }

        if (options.device) {
          launchOptions.device = options.device;
        }

        api?.logger?.info('启动浏览器', { launchOptions });
        await this.__browserManager.launch(launchOptions);

      } catch (error) {
        api?.logger?.error('浏览器启动失败', { error: error.message });
        throw error;
      }
    }

    return this.__browserManager;
  },

  /**
   * 关闭浏览器
   */
  async closeBrowser() {
    const { api } = this;

    if (this.__browserManager) {
      try {
        await this.__browserManager.close();
        this.__browserManager = null;
        api?.logger?.info('浏览器已关闭');
      } catch (error) {
        api?.logger?.error('关闭浏览器失败', { error: error.message });
        throw error;
      }
    }
  },

  /**
   * 解析通用选项
   */
  parseCommonOptions(params) {
    const { api } = this;
    const options = {};

    if (params.headless !== undefined) {
      options.headless = params.headless;
    } else {
      const headlessEnv = api?.environment?.get('AGENT_BROWSER_HEADLESS');
      options.headless = headlessEnv !== 'false';
    }

    if (params.executablePath) {
      options.executablePath = params.executablePath;
    } else {
      options.executablePath = api?.environment?.get('AGENT_BROWSER_EXECUTABLE_PATH');
    }

    if (params.viewport) {
      options.viewport = params.viewport;
    }

    if (params.device) {
      options.device = params.device;
    }

    return options;
  },

  /**
   * 执行浏览器操作
   */
  async execute(params) {
    const { api } = this;

    api?.logger?.info('执行操作', { action: params.action });

    try {
      // 确保 BrowserManager 已初始化
      const options = this.parseCommonOptions(params);
      await this.getBrowserManager(options);

      // 根据操作类型路由
      const result = await this.executeAction(params);

      return {
        success: true,
        action: params.action,
        data: result
      };

    } catch (error) {
      api?.logger?.error('操作执行失败', {
        action: params.action,
        error: error.message
      });

      // 检查业务错误
      const businessError = this.getBusinessErrors().find(err =>
        err.match.test(error.message)
      );

      if (businessError) {
        error.code = businessError.code;
        error.solution = businessError.solution;
        error.retryable = businessError.retryable;
      }

      return {
        success: false,
        action: params.action,
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          solution: error.solution,
          retryable: error.retryable || false
        }
      };
    }
  },

  /**
   * 执行具体操作
   */
  async executeAction(params) {
    const browser = this.__browserManager;
    const { api } = this;

    switch (params.action) {
      // ========== 核心命令 ==========

      case 'launch':
        return { message: '浏览器已启动', options: this.parseCommonOptions(params) };

      case 'navigate':
        await browser.navigate(params.url, { waitUntil: params.waitUntil });
        if (params.headers) {
          await browser.setExtraHeaders(params.headers);
        }
        const page = browser.getPage();
        return {
          url: params.url,
          title: await page.title()
        };

      case 'click':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          if (params.button || params.clickCount || params.delay) {
            await locator.click({
              button: params.button || 'left',
              clickCount: params.clickCount || 1,
              delay: params.delay || 0
            });
          } else {
            await locator.click();
          }
        }
        return { clicked: params.selector };

      case 'type':
        if (params.selector && params.text) {
          const locator = browser.getLocator(params.selector);
          const options = {};
          if (params.delay !== undefined) options.delay = params.delay;
          if (params.clear !== undefined) options.clear = params.clear;
          await locator.type(params.text, options);
        }
        return { typed: params.text, selector: params.selector };

      case 'fill':
        if (params.selector && params.value !== undefined) {
          const locator = browser.getLocator(params.selector);
          await locator.fill(params.value);
        }
        return { filled: params.value, selector: params.selector };

      case 'check':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          await locator.setChecked(true);
        }
        return { checked: params.selector };

      case 'uncheck':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          await locator.setChecked(false);
        }
        return { unchecked: params.selector };

      case 'upload':
        if (params.selector && params.files) {
          const locator = browser.getLocator(params.selector);
          const files = Array.isArray(params.files) ? params.files : [params.files];
          await locator.setInputFiles(files);
        }
        return { uploaded: files, selector: params.selector };

      case 'dblclick':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          await locator.dblclick();
        }
        return { dblclicked: params.selector };

      case 'focus':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          await locator.focus();
        }
        return { focused: params.selector };

      case 'drag':
        if (params.source && params.target) {
          const sourceLocator = browser.getLocator(params.source);
          const targetLocator = browser.getLocator(params.target);
          await sourceLocator.dragTo(targetLocator);
        }
        return { dragged: { from: params.source, to: params.target } };

      case 'screenshot':
        const page = browser.getPage();
        const screenshotOptions = {};
        if (params.fullPage) screenshotOptions.fullPage = true;
        if (params.screenshotFormat) screenshotOptions.type = params.screenshotFormat;
        if (params.quality) screenshotOptions.quality = params.quality;

        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const buffer = await locator.screenshot(screenshotOptions);
          return { buffer: buffer.toString('base64'), selector: params.selector };
        } else {
          const buffer = await page.screenshot(screenshotOptions);
          if (params.screenshotPath) {
            const fs = await import('fs');
            fs.writeFileSync(params.screenshotPath, buffer);
            return { path: params.screenshotPath, buffer: buffer.toString('base64') };
          }
          return { buffer: buffer.toString('base64') };
        }

      case 'snapshot':
        const snapshotOptions = {};
        if (params.interactive !== undefined) snapshotOptions.interactive = params.interactive;
        if (params.maxDepth !== undefined) snapshotOptions.maxDepth = params.maxDepth;
        if (params.compact !== undefined) snapshotOptions.compact = params.compact;
        if (params.selector) snapshotOptions.selector = params.selector;

        const snapshot = await browser.getSnapshot(snapshotOptions);
        return snapshot;

      case 'evaluate':
        const evalPage = browser.getPage();
        const result = await evalPage.evaluate(
          params.script,
          params.scriptArgs || []
        );
        return { result };

      case 'wait':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const waitOptions = {};
          if (params.timeout !== undefined) waitOptions.timeout = params.timeout;
          if (params.state) waitOptions.state = params.state;
          await locator.waitFor(waitOptions);
        } else if (params.timeout) {
          await new Promise(resolve => setTimeout(resolve, params.timeout));
        }
        return { waited: params.selector || params.timeout };

      case 'scroll':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          await locator.scrollIntoViewIfNeeded();
          return { scrolled: params.selector };
        } else if (params.direction || params.amount) {
          const scrollPage = browser.getPage();
          await scrollPage.evaluate((direction, amount) => {
            if (direction === 'up') window.scrollBy(0, -amount);
            else if (direction === 'down') window.scrollBy(0, amount);
            else if (direction === 'left') window.scrollBy(-amount, 0);
            else if (direction === 'right') window.scrollBy(amount, 0);
          }, [params.direction, params.amount]);
          return { scrolled: { direction: params.direction, amount: params.amount } };
        }
        return {};

      case 'select':
        if (params.selector && params.values) {
          const locator = browser.getLocator(params.selector);
          const values = Array.isArray(params.values) ? params.values : [params.values];
          await locator.selectOption(values);
        }
        return { selected: values, selector: params.selector };

      case 'hover':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          await locator.hover();
        }
        return { hovered: params.selector };

      case 'content':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const content = await locator.content();
          return { selector: params.selector, content };
        } else {
          const contentPage = browser.getPage();
          const content = await contentPage.content();
          return { content };
        }

      case 'close':
        await this.closeBrowser();
        return { closed: true };

      case 'back':
        await browser.getPage().goBack();
        return { navigated: 'back' };

      case 'forward':
        await browser.getPage().goForward();
        return { navigated: 'forward' };

      case 'reload':
        await browser.getPage().reload();
        return { reloaded: true };

      // ========== 查找命令（语义定位器） ==========

      case 'getbyrole':
        if (params.role && params.subaction) {
          const page = browser.getPage();
          const locator = page.getByRole(params.role, { name: params.name });
          await this.executeSubaction(locator, params.subaction, params.value);
        }
        return { role: params.role, name: params.name };

      case 'getbytext':
        if (params.text && params.subaction) {
          const page = browser.getPage();
          const options = {};
          if (params.exact !== undefined) options.exact = params.exact;
          const locator = page.getByText(params.text, options);
          await this.executeSubaction(locator, params.subaction);
        }
        return { text: params.text };

      case 'getbylabel':
        if (params.label && params.subaction) {
          const page = browser.getPage();
          const locator = page.getByLabel(params.label);
          await this.executeSubaction(locator, params.subaction, params.value);
        }
        return { label: params.label };

      case 'getbyplaceholder':
        if (params.placeholder && params.subaction) {
          const page = browser.getPage();
          const locator = page.getByPlaceholder(params.placeholder);
          await this.executeSubaction(locator, params.subaction, params.value);
        }
        return { placeholder: params.placeholder };

      case 'getbyalttext':
        if (params.altText && params.subaction) {
          const page = browser.getPage();
          const locator = page.getByAltText(params.altText);
          await this.executeSubaction(locator, params.subaction);
        }
        return { altText: params.altText };

      case 'getbytitle':
        if (params.name && params.subaction) {
          const page = browser.getPage();
          const options = {};
          if (params.exact !== undefined) options.exact = params.exact;
          const locator = page.getByTitle(params.name, options);
          await this.executeSubaction(locator, params.subaction);
        }
        return { title: params.name };

      case 'getbytestid':
        if (params.testId && params.subaction) {
          const page = browser.getPage();
          const locator = page.getByTestId(params.testId);
          await this.executeSubaction(locator, params.subaction, params.value);
        }
        return { testId: params.testId };

      case 'nth':
        if (params.selector && params.index !== undefined && params.subaction) {
          const locator = browser.getLocator(params.selector);
          const nthLocator = locator.nth(params.index);
          await this.executeSubaction(nthLocator, params.subaction, params.value);
        }
        return { selector: params.selector, index: params.index };

      // ========== 获取信息 ==========

      case 'gettext':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const text = await locator.textContent();
          return { text, selector: params.selector };
        }
        throw new Error('需要提供 selector 参数');

      case 'gethtml':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const html = await locator.innerHTML();
          return { html, selector: params.selector };
        }
        throw new Error('需要提供 selector 参数');

      case 'getattribute':
        if (params.selector && params.attribute) {
          const locator = browser.getLocator(params.selector);
          const value = await locator.getAttribute(params.attribute);
          return { attribute: params.attribute, value, selector: params.selector };
        }
        throw new Error('需要提供 selector 和 attribute 参数');

      case 'isvisible':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const visible = await locator.isVisible();
          return { visible, selector: params.selector };
        }
        throw new Error('需要提供 selector 参数');

      case 'isenabled':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const enabled = await locator.isEnabled();
          return { enabled, selector: params.selector };
        }
        throw new Error('需要提供 selector 参数');

      case 'ischecked':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const checked = await locator.isChecked();
          return { checked, selector: params.selector };
        }
        throw new Error('需要提供 selector 参数');

      case 'count':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const count = await locator.count();
          return { count, selector: params.selector };
        }
        throw new Error('需要提供 selector 参数');

      case 'boundingbox':
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          const box = await locator.boundingBox();
          return { box, selector: params.selector };
        }
        throw new Error('需要提供 selector 参数');

      // ========== 导航和控制 ==========

      case 'url':
        const urlPage = browser.getPage();
        return { url: urlPage.url() };

      case 'title':
        const titlePage = browser.getPage();
        return { title: await titlePage.title() };

      case 'press':
        const pressPage = browser.getPage();
        if (params.selector) {
          const locator = browser.getLocator(params.selector);
          await locator.press(params.keys);
        } else {
          await pressPage.keyboard.press(params.keys);
        }
        return { pressed: params.keys };

      case 'pause':
        await new Promise(resolve => setTimeout(resolve, 1000)); // 默认暂停 1 秒
        return { paused: true };

      // ========== 标签页和窗口 ==========

      case 'tab_new':
        const tabResult = await browser.newTab();
        return tabResult;

      case 'tab_list':
        const tabs = await browser.listTabs();
        return tabs;

      case 'tab_switch':
        const switchedTab = await browser.switchTo(params.index);
        return switchedTab;

      case 'tab_close':
        const closedTab = await browser.closeTab(params.index);
        return closedTab;

      case 'window_new':
        const windowResult = await browser.newWindow(params.viewport);
        return windowResult;

      // ========== Cookie 和存储 ==========

      case 'cookies_get':
        if (params.urls) {
          browser.getFrame().context().cookies();
        }
        const allCookies = await browser.getPage().context().cookies();
        return { cookies: allCookies };

      case 'cookies_set':
        if (params.cookies) {
          await browser.getPage().context().addCookies(params.cookies);
        }
        return { cookiesSet: params.cookies };

      case 'cookies_clear':
        await browser.getPage().context().clearCookies();
        return { cookiesCleared: true };

      case 'storage_get':
        const storagePage = browser.getPage();
        if (params.storageType === 'session') {
          if (params.key) {
            const value = await storagePage.evaluate(([key]) => {
              return sessionStorage.getItem(key);
            }, [params.key]);
            return { key: params.key, value };
          } else {
            const all = await storagePage.evaluate(() => {
              const data = {};
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                data[key] = sessionStorage.getItem(key);
              }
              return data;
            });
            return { storage: all, type: 'session' };
          }
        } else {
          if (params.key) {
            const value = await storagePage.evaluate(([key]) => {
              return localStorage.getItem(key);
            }, [params.key]);
            return { key: params.key, value };
          } else {
            const all = await storagePage.evaluate(() => {
              const data = {};
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                data[key] = localStorage.getItem(key);
              }
              return data;
            });
            return { storage: all, type: 'local' };
          }
        }

      case 'storage_set':
        const setPage = browser.getPage();
        if (params.storageType === 'session') {
          await setPage.evaluate(([key, value]) => {
            sessionStorage.setItem(key, value);
          }, [params.key, params.value]);
        } else {
          await setPage.evaluate(([key, value]) => {
            localStorage.setItem(key, value);
          }, [params.key, params.value]);
        }
        return { key: params.key, value: params.value, type: params.storageType || 'local' };

      case 'storage_clear':
        const clearStoragePage = browser.getPage();
        if (params.storageType === 'session') {
          await clearStoragePage.evaluate(() => {
            sessionStorage.clear();
          });
        } else {
          await clearStoragePage.evaluate(() => {
            localStorage.clear();
          });
        }
        return { cleared: true, type: params.storageType || 'local' };

      // ========== 网络和路由 ==========

      case 'route':
        if (params.routeUrl) {
          const routeOptions = {};
          if (params.responseBody) {
            routeOptions.response = params.responseBody;
          }
          if (params.abort) {
            routeOptions.abort = true;
          }
          await browser.addRoute(params.routeUrl, routeOptions);
        }
        return { routed: params.routeUrl };

      case 'unroute':
        await browser.removeRoute(params.routeUrl);
        return { unrouted: params.routeUrl };

      case 'requests':
        if (params.clearRequests) {
          browser.clearRequests();
          return { cleared: true };
        }
        const requests = browser.getRequests(params.filter);
        return { requests };

      case 'download':
        if (params.selector && params.downloadPath) {
          const locator = browser.getLocator(params.selector);
          const downloadPromise = page.waitForEvent('download');
          await locator.click();
          const download = await downloadPromise;
          await download.saveAs(params.downloadPath);
        }
        return { downloaded: params.downloadPath };

      // ========== 设置和模拟 ==========

      case 'viewport':
        if (params.width && params.height) {
          await browser.setViewport(params.width, params.height);
        }
        return { viewport: { width: params.width, height: params.height } };

      case 'device':
        if (params.device) {
          const deviceInfo = browser.getDevice(params.device);
          if (deviceInfo) {
            await browser.setViewport(deviceInfo.viewport.width, deviceInfo.viewport.height);
            await browser.getPage().setUserAgent(deviceInfo.userAgent);
          }
        }
        return { device: params.device };

      case 'geolocation':
        if (params.latitude !== undefined && params.longitude !== undefined) {
          await browser.setGeolocation(params.latitude, params.longitude, params.accuracy);
        }
        return { geolocation: { latitude: params.latitude, longitude: params.longitude } };

      case 'permissions':
        if (params.permissions && params.grant !== undefined) {
          await browser.setPermissions(params.permissions, params.grant);
        }
        return { permissions: params.permissions, granted: params.grant };

      case 'useragent':
        if (params.userAgent) {
          await browser.getPage().setUserAgent(params.userAgent);
        }
        return { userAgent: params.userAgent };

      case 'timezone':
        await browser.getPage().emulateTimezone(params.timezone);
        return { timezone: params.timezone };

      case 'locale':
        await browser.getPage().setLocale(params.locale);
        return { locale: params.locale };

      case 'offline':
        await browser.setOffline(params.offline);
        return { offline: params.offline };

      case 'headers':
        await browser.setExtraHeaders(params.headers);
        return { headers: params.headers };

      // ========== 高级功能 ==========

      case 'dialog':
        if (params.dialogResponse === 'accept') {
          browser.setDialogHandler('accept', params.promptText);
        } else {
          browser.setDialogHandler('dismiss');
        }
        return { handled: params.dialogResponse };

      case 'pdf':
        const pdfPage = browser.getPage();
        const pdfBuffer = await pdfPage.pdf({
          format: params.format || 'A4',
          path: params.pdfPath
        });
        return { saved: params.pdfPath, size: pdfBuffer.length };

      case 'console':
        if (params.clearConsole) {
          browser.clearConsoleMessages();
        } else {
          const messages = browser.getConsoleMessages();
          return { consoleMessages: messages };
        }
        return { cleared: params.clearConsole };

      case 'errors':
        if (params.clearErrors) {
          browser.clearPageErrors();
        } else {
          const errors = browser.getPageErrors();
          return { errors };
        }
        return { cleared: params.clearErrors };

      default:
        throw new Error(`未知操作: ${params.action}`);
    }
  },

  /**
   * 执行子操作（用于语义定位器）
   */
  async executeSubaction(locator, subaction, value) {
    switch (subaction) {
      case 'click':
        await locator.click();
        break;
      case 'fill':
        await locator.fill(value);
        break;
      case 'check':
        await locator.setChecked(true);
        break;
      case 'hover':
        await locator.hover();
        break;
      case 'text':
        await locator.textContent();
        break;
      default:
        throw new Error(`未知子操作: ${subaction}`);
    }
  },

  /**
   * 高级方法：获取带引用的快照
   */
  async getSnapshotWithRefs(options = {}) {
    const browser = await this.getBrowserManager(options);
    const snapshot = await browser.getSnapshot(options);
    return {
      success: true,
      snapshot: snapshot.snapshot,
      refs: snapshot.refs,
      metadata: {
        url: await browser.getPage().url(),
        title: await browser.getPage().title()
      }
    };
  },

  /**
   * 高级方法：导航到 URL
   */
  async navigate(url, options = {}) {
    const browser = await this.getBrowserManager(options);
    await browser.navigate(url);
    return {
      success: true,
      url: url
    };
  },

  /**
   * 高级方法：点击元素
   */
  async click(selector, options = {}) {
    const browser = await this.getBrowserManager(options);
    const locator = browser.getLocator(selector);
    await locator.click();
    return { success: true, clicked: selector };
  },

  /**
   * 高级方法：填充表单字段
   */
  async fill(selector, value, options = {}) {
    const browser = await this.getBrowserManager(options);
    const locator = browser.getLocator(selector);
    await locator.fill(value);
    return { success: true, filled: value };
  },

  /**
   * 高级方法：截取屏幕截图
   */
  async screenshot(path, options = {}) {
    const browser = await this.getBrowserManager(options);
    const page = browser.getPage();
    const buffer = await page.screenshot({
      path: path,
      fullPage: options.fullPage
    });
    return { success: true, path };
  }
};
