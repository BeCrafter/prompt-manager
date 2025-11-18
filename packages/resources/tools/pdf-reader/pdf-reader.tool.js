/**
 * PDF Reader - 纯 Node.js 实现的 PDF 分页阅读工具（带智能缓存）
 * 
 * 战略意义：
 * 1. 架构隔离性 - 专门的PDF读取工具，确保AI操作安全
 * 2. 平台独立性 - 不依赖特定AI平台的PDF读取能力
 * 3. 生态自主性 - 作为Prompt Manager生态的关键组件
 * 
 * 设计理念：
 * - 不传 pages：只返回 PDF 元信息（总页数、标题等）
 * - 传 pages：提取指定页的文本和图片
 * - 图片存储在 toolbox 目录，统一管理
 * - 使用 storage 缓存解析状态，避免重复解析
 * 
 * 生态定位：
 * 为 AI 提供高效的 PDF 分页阅读能力
 * 与 Claude Code 的 Read 工具无缝配合
 */

import path from 'path';
import os from 'os';

export default {
  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      'pdf-parse': '^2.1.10'
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'pdf-reader',
      name: 'PDF Reader',
      description: 'PDF 分页阅读工具，支持按页码提取文本和图片，智能缓存避免重复解析',
      version: '2.1.0',
      category: 'utility',
      author: '鲁班',
      tags: ['pdf', 'reader', 'text', 'image', 'mcp', 'utility'],
      scenarios: [
        'PDF文本提取',
        'PDF图片提取',
        '分页阅读PDF',
        '文档内容分析',
        'PDF元信息获取'
      ],
      limitations: [
        '需要有效的PDF文件路径',
        '仅支持PDF格式文件',
        '大文件可能需要较长时间处理',
        '图片提取依赖于PDF的图片存储格式'
      ]
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
            description: 'MCP方法名',
            enum: [
              'read_pdf'
            ]
          },
          pdfPath: {
            type: 'string',
            description: 'PDF 文件的绝对路径',
            minLength: 1
          },
          pages: {
            oneOf: [
              { type: 'number', minimum: 1 },
              { type: 'array', items: { type: 'number', minimum:  1 } }
            ],
            description: '要读取的页码（可选）。不传则只返回 PDF 元信息；传数字读取单页；传数组读取多页'
          },
          extractImages: {
            type: 'boolean',
            description: '是否提取图片（默认 true）',
            default: true
          },
          forceRefresh: {
            type: 'boolean',
            description: '强制重新解析，忽略缓存（默认 false）',
            default: false
          }
        },
        required: ['method', 'pdfPath']
      },
      environment: {
        type: 'object',
        properties: {
          ALLOWED_DIRECTORIES: {
            type: 'string',
            description: '允许访问的目录列表（JSON数组格式），默认为 ["~/.prompt-manager"]',
            default: '["~/.prompt-manager"]'
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
        code: 'PATH_OUTSIDE_SCOPE',
        description: '路径越权访问',
        match: /路径越权/,
        solution: '确保路径在允许的目录范围内',
        retryable: false
      },
      {
        code: 'FILE_NOT_FOUND',
        description: 'PDF文件不存在',
        match: /ENOENT|no such file|cannot find/i,
        solution: '检查PDF文件路径是否正确',
        retryable: false
      },
      {
        code: 'INVALID_PDF',
        description: '无效的PDF文件',
        match: /Invalid PDF/i,
        solution: '检查PDF文件是否损坏',
        retryable: false
      },
      {
        code: 'PERMISSION_DENIED',
        description: '权限不足',
        match: /EACCES|permission denied/i,
        solution: '检查文件或目录的访问权限',
        retryable: false
      },
      {
        code: 'PAGE_OUT_OF_RANGE',
        description: '页码超出范围',
        match: /页码.*超出范围/i,
        solution: '检查请求的页码是否在PDF总页数范围内',
        retryable: false
      }
    ];
  },

  /**
   * 获取允许的目录列表
   */
  getAllowedDirectories() {
    const { api } = this;

    // Try to get configuration from environment variable
    let allowedDirs = ['~/.prompt-manager'];  // Default value

    if (api && api.environment) {
      try {
        let configStr = api.environment.get('ALLOWED_DIRECTORIES');
        
        // 如果直接获取失败，尝试使用工具特定的环境变量名
        if (!configStr) {
          // 从 process.env 直接获取（可能是通过 configure 模式设置的）
          // 在 configure 模式中，键被设置为 ${toolName.toUpperCase()}_${key}
          // 工具名 'pdf-reader' 转换为 'PDF-READER'
          const toolSpecificKey = 'PDF-READER_ALLOWED_DIRECTORIES';
          configStr = process.env[toolSpecificKey];
        }
        
        if (configStr) {
          try {
            // 首先尝试作为 JSON 字符串解析（适用于通过 configure 模式设置的值）
            // Handle escaped quotes from .env file parsing
            // The ToolEnvironment escapes backslashes and quotes when saving to .env
            // We need to unescape them before parsing JSON
            let unescapedConfigStr = configStr.replace(/"/g, '"').replace(/\\/g, '\\');
            
            console.log('JSON.parse ALLOWED_DIRECTORIES config:', unescapedConfigStr);

            const parsed = JSON.parse(unescapedConfigStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              allowedDirs = parsed;
            }
          } catch (jsonError) {
            // 如果 JSON 解析失败，可能是一个简单的路径字符串（如 "/Users/mark"）
            // 在这种情况下，将字符串按逗号分割并处理为路径数组
            if (typeof configStr === 'string') {
              // 尝试简单地将字符串作为单个路径处理
              // 检查是否是 JSON 数组格式的字符串（带方括号）
              if (configStr.startsWith('[') && configStr.endsWith(']')) {
                // 这应该是一个 JSON 数组，但解析失败，可能是格式问题
                // 重新尝试修复格式
                let fixedConfigStr = configStr.replace(/'/g, '"'); // 将单引号替换为双引号
                try {
                  const parsed = JSON.parse(fixedConfigStr);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    allowedDirs = parsed;
                  }
                } catch {
                  // 如果仍然失败，将原始字符串作为单个路径
                  allowedDirs = [configStr];
                }
              } else {
                // 直接将字符串作为单个路径
                allowedDirs = [configStr];
              }
            }
          }
        }
      } catch (error) {
        // Fall back to default value if parsing fails
        api?.logger?.warn('Failed to parse ALLOWED_DIRECTORIES', { error: error.message });
      }
    }

    // Expand ~ to home directory and normalize paths
    return allowedDirs.map(dir => {
      const expanded = dir.replace(/^~/, os.homedir());
      return path.resolve(expanded);
    });
  },

  /**
   * 初始化文件系统
   */
  async initializeFilesystem() {
    if (!this._initialized) {
      // 获取允许的目录列表
      const allowedDirectories = this.getAllowedDirectories();
      this._allowedDirectories = allowedDirectories;
      this._initialized = true;
      
      // 记录日志
      const { api } = this;
      api?.logger?.info('PDF Reader filesystem initialized', { 
        allowedDirectories: this._allowedDirectories 
      });
    }
  },

  /**
   * PromptManager特定的路径处理
   * 将相对路径转换为绝对路径，并确保在允许的目录范围内
   */
  resolvePromptManagerPath(inputPath) {
    const { api } = this;
    
    // 获取允许的目录列表
    const allowedDirs = this._allowedDirectories || this.getAllowedDirectories();
    
    if (!inputPath) {
      // 没有路径时返回第一个允许的目录
      return allowedDirs[0];
    }
    
    // 处理 ~ 开头的路径
    const expandedPath = inputPath.replace(/^~/, os.homedir());
    
    // 如果是绝对路径
    if (path.isAbsolute(expandedPath)) {
      const resolved = path.resolve(expandedPath);
      
      // 检查是否在任何允许的目录内
      const isAllowed = allowedDirs.some(dir => resolved.startsWith(dir));
      
      if (!isAllowed) {
        const dirsStr = allowedDirs.join(', ');
        api?.logger?.warn('Path access denied', { path: resolved, allowedDirs });
        throw new Error(`路径越权: ${inputPath} 不在允许的目录范围内 [${dirsStr}]`);
      }
      
      return resolved;
    }
    
    // 相对路径，尝试在每个允许的目录中解析
    // 优先使用第一个允许的目录（通常是 ~/.prompt-manager）
    const baseDir = allowedDirs[0];
    const fullPath = path.join(baseDir, expandedPath);
    const resolved = path.resolve(fullPath);
    
    // 安全检查：确保解析后的路径在允许的目录内
    const isAllowed = allowedDirs.some(dir => resolved.startsWith(dir));
    
    if (!isAllowed) {
      const dirsStr = allowedDirs.join(', ');
      api?.logger?.warn('Path resolution failed', { path: inputPath, resolved, allowedDirs });
      throw new Error(`路径越权: ${inputPath} 解析后超出允许的目录范围 [${dirsStr}]`);
    }
    
    return resolved;
  },

  async execute(params) {
    const { api } = this;
    
    // 记录执行开始
    api?.logger?.info('Executing PDF Reader operation', { 
      method: params.method,
      pdfPath: params.pdfPath
    });
    
    // 参数验证由 ToolValidator 根据 getSchema() 自动处理
    // 这里进行 method 相关的业务验证
    const methodRequirements = {
      'read_pdf': ['pdfPath']
    };

    const required = methodRequirements[params.method];
    if (!required) {
      throw new Error(`不支持的方法: ${params.method}`);
    }

    const missing = required.filter(field => !params[field]);
    if (missing.length > 0) {
      throw new Error(`方法 ${params.method} 缺少必需参数: ${missing.join(', ')}`);
    }

    try {
      // 初始化文件系统
      await this.initializeFilesystem();
      
      // 使用安全路径解析
      const resolvedPdfPath = this.resolvePromptManagerPath(params.pdfPath);
      
      const { pdfPath, pages, extractImages = true, forceRefresh = false } = params;

      // 导入依赖
      const fs = await import('fs');
      const fsPromises = fs.promises;
      const crypto = await import('crypto');
      
      // 使用工具上下文的模块导入函数，从工具的 node_modules 导入
      let PDFParse;
      try {
        if (this.importToolModule) {
          // 使用工具上下文提供的导入函数
          const pdfParseModule = await this.importToolModule('pdf-parse');
          api?.logger?.debug('pdf-parse 模块导入结果', { 
            hasDefault: !!pdfParseModule.default,
            type: typeof pdfParseModule.default,
            keys: Object.keys(pdfParseModule)
          });
          
          // pdf-parse v2.x 导出 PDFParse 类
          // 首先尝试从模块中获取 PDFParse 类
          if (pdfParseModule.PDFParse && typeof pdfParseModule.PDFParse === 'function') {
            PDFParse = pdfParseModule.PDFParse;
          } else if (pdfParseModule.default && typeof pdfParseModule.default === 'function') {
            // 检查 default 是否是类
            const defaultExport = pdfParseModule.default;
            if (defaultExport.toString().startsWith('class') || defaultExport.prototype) {
              PDFParse = defaultExport;
            } else {
              // 可能是旧版本的函数导出
              PDFParse = defaultExport;
            }
          } else if (typeof pdfParseModule === 'function') {
            // 直接是函数（旧版本）
            PDFParse = pdfParseModule;
          } else {
            // 尝试从对象中查找 PDFParse
            PDFParse = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;
          }
        } else if (this.requireToolModule) {
          // 降级方案：使用 require
          const pdfParseModule = this.requireToolModule('pdf-parse');
          // pdf-parse v2.x 导出对象，包含 PDFParse 类
          PDFParse = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;
        } else {
          // 最后尝试：直接导入
          const pdfParseModule = await import('pdf-parse');
          PDFParse = pdfParseModule.PDFParse || pdfParseModule.default || pdfParseModule;
        }
        
        // 验证 PDFParse 是否存在
        if (!PDFParse || (typeof PDFParse !== 'function' && typeof PDFParse !== 'object')) {
          api?.logger?.error('pdf-parse 模块格式错误', {
            type: typeof PDFParse,
            isObject: typeof PDFParse === 'object',
            keys: PDFParse && typeof PDFParse === 'object' ? Object.keys(PDFParse).slice(0, 10) : []
          });
          throw new Error(`pdf-parse 模块格式错误：无法找到 PDFParse 类或函数。请检查模块导出格式。`);
        }
        
        api?.logger?.info('pdf-parse 模块加载成功', { 
          type: typeof PDFParse,
          isClass: typeof PDFParse === 'function' && PDFParse.toString().startsWith('class')
        });
      } catch (error) {
        api?.logger?.error('加载 pdf-parse 模块失败', { 
          error: error.message,
          stack: error.stack
        });
        throw new Error(`无法加载 pdf-parse 模块：${error.message}。请确保依赖已正确安装到工具的 node_modules 目录。`);
      }

      api.logger.info('开始处理 PDF', { pdfPath: resolvedPdfPath, pages, extractImages, forceRefresh });

      // 1. 读取 PDF 文件
      const pdfBuffer = await fsPromises.readFile(resolvedPdfPath);
      api.logger.info('PDF 文件读取成功', { size: pdfBuffer.length });

      // 2. 生成 PDF hash
      const hash = crypto.createHash('md5');
      hash.update(pdfBuffer);
      const pdfHash = hash.digest('hex');

      // 3. 构建 PDF 数据目录，使用安全路径
      const allowedDirs = this._allowedDirectories || this.getAllowedDirectories();
      const baseDir = allowedDirs[0];
      const pdfDir = path.join(baseDir, '.prompt-manager', 'pdf-cache', pdfHash);

      // 确保目录存在
      await fsPromises.mkdir(pdfDir, { recursive: true });

      api.logger.info('PDF 数据目录', { pdfDir });

      // 4. 检查 storage 中的 PDF 元信息缓存
      const allPdfs = api.storage.getItem('pdfs') || {};
      let pdfMetadata = allPdfs[pdfHash];

      api.logger.info('Storage 读取结果', {
        hasPdfs: !!allPdfs,
        pdfKeys: Object.keys(allPdfs),
        hasPdfMetadata: !!pdfMetadata,
        cachedPages: pdfMetadata ? Object.keys(pdfMetadata.parsedPages || {}) : []
      });

      if (!pdfMetadata || forceRefresh) {
        // 首次处理此 PDF，解析基本信息
        api.logger.info('首次处理此 PDF，解析元信息');
        
        // 使用 PDFParse 类解析 PDF
        let pdfData;
        let pdfParser = null;
        try {
          if (typeof PDFParse === 'function' && PDFParse.toString().startsWith('class')) {
            // pdf-parse v2.x: 使用类
            pdfParser = new PDFParse({ data: pdfBuffer });
            const textResult = await pdfParser.getText();
            const infoResult = await pdfParser.getInfo();
            pdfData = {
              text: textResult.text || '',
              info: infoResult.info || {},
              metadata: infoResult.metadata || {}
            };
          } else {
            // 旧版本: 直接调用函数
            pdfData = await PDFParse(pdfBuffer);
          }
        } finally {
          // 清理资源
          if (pdfParser && typeof pdfParser.destroy === 'function') {
            await pdfParser.destroy();
          }
        }
        
        const lines = pdfData.text.split('\n');
        const totalPages = (pdfData.info && pdfData.info.Pages) || this.estimatePages(lines);

        pdfMetadata = {
          totalPages: totalPages,
          title: pdfData.info?.Title || null,
          author: pdfData.info?.Author || null,
          pdfHash: pdfHash,
          pdfPath: resolvedPdfPath,
          createdAt: Date.now(),
          parsedPages: {}
        };

        allPdfs[pdfHash] = pdfMetadata;
        api.storage.setItem('pdfs', allPdfs);
        api.logger.info('PDF 元信息已缓存', { totalPages });
      } else {
        api.logger.info('使用缓存的 PDF 元信息', {
          totalPages: pdfMetadata.totalPages,
          cachedPages: Object.keys(pdfMetadata.parsedPages || {}).length
        });
      }

      const totalPages = pdfMetadata.totalPages;

      // 5. 如果没有传 pages，只返回元信息
      if (pages === undefined || pages === null) {
        return {
          success: true,
          metadata: {
            totalPages: pdfMetadata.totalPages,
            title: pdfMetadata.title,
            author: pdfMetadata.author,
            cachedPages: Object.keys(pdfMetadata.parsedPages || {}).length
          },
          message: '使用 pages 参数指定要读取的页码，例如：pages: 1 或 pages: [1,2,3]'
        };
      }

      // 6. 标准化 pages 为数组
      const pageNumbers = Array.isArray(pages) ? pages : [pages];

      // 验证页码范围
      for (const pageNum of pageNumbers) {
        if (pageNum < 1 || pageNum > totalPages) {
          throw new Error(`页码 ${pageNum} 超出范围（总页数：${totalPages}）`);
        }
      }

      api.logger.info('准备读取指定页面', { pageNumbers });

      // 7. 提取指定页面的内容（使用缓存）
      const pagesContent = [];
      const allImages = [];
      let fullText = '';
      let cacheHits = 0;
      let cacheMisses = 0;

      // 解析整个 PDF 以获取内容
      let pdfData;
      let pdfParser = null;
      try {
        if (typeof PDFParse === 'function' && PDFParse.toString().startsWith('class')) {
          // pdf-parse v2.x: 使用类
          pdfParser = new PDFParse({ data: pdfBuffer });
          const textResult = await pdfParser.getText();
          pdfData = {
            text: textResult.text || ''
          };
        } else {
          // 旧版本: 直接调用函数
          pdfData = await PDFParse(pdfBuffer);
        }
      } finally {
        // 清理资源
        if (pdfParser && typeof pdfParser.destroy === 'function') {
          await pdfParser.destroy();
        }
      }
      const allText = pdfData.text;
      const textByPage = this.splitTextByPages(allText, totalPages);

      for (const pageNum of pageNumbers) {
        api.logger.info(`处理第 ${pageNum} 页`);

        // 检查缓存
        const pageCache = pdfMetadata.parsedPages?.[pageNum];
        const shouldUseCache = pageCache && !forceRefresh;

        if (shouldUseCache && extractImages) {
          api.logger.info(`第 ${pageNum} 页使用缓存`, { 
            imageCount: pageCache.imageCount 
          });

          const pageImages = [];
          for (let i = 0; i < (pageCache.imageCount || 0); i++) {
            const imgPath = path.join(pdfDir, `page-${pageNum}-img-${i}.png`);

            pageImages.push({
              page: pageNum,
              index: i,
              path: imgPath,
              width: null,
              height: null
            });
            allImages.push(pageImages[pageImages.length - 1]);
          }

          pagesContent.push({
            page: pageNum,
            hasImages: pageImages.length > 0,
            imageCount: pageImages.length,
            images: pageImages,
            fromCache: true
          });

          // 从分割的文本中获取当前页内容
          const pageText = textByPage[pageNum - 1] || '';
          fullText += `\n=== 第 ${pageNum} 页 ===\n${pageText}\n`;

          cacheHits++;
          continue;
        }

        // 缓存未命中，需要处理
        cacheMisses++;
        api.logger.info(`第 ${pageNum} 页缓存未命中，开始解析`);

        const pageImages = [];
        
        // 从分割的文本中获取当前页内容
        const pageText = textByPage[pageNum - 1] || '';
        fullText += `\n=== 第 ${pageNum} 页 ===\n${pageText}\n`;

        // 缓存页面信息
        // 重新从 storage 读取以确保数据最新
        const currentPdfs = api.storage.getItem('pdfs') || {};
        const currentMetadata = currentPdfs[pdfHash] || pdfMetadata;

        if (!currentMetadata.parsedPages) {
          currentMetadata.parsedPages = {};
        }
        currentMetadata.parsedPages[pageNum] = {
          timestamp: Date.now(),
          imageCount: pageImages.length,
          hasText: true
        };

        currentPdfs[pdfHash] = currentMetadata;
        api.storage.setItem('pdfs', currentPdfs);

        // 更新本地引用
        pdfMetadata = currentMetadata;

        pagesContent.push({
          page: pageNum,
          hasImages: pageImages.length > 0,
          imageCount: pageImages.length,
          images: pageImages,
          fromCache: false
        });
      }

      // 9. 构建返回结果
      const result = {
        success: true,
        metadata: {
          totalPages: totalPages,
          title: pdfMetadata.title,
          author: pdfMetadata.author,
          requestedPages: pageNumbers
        },
        content: {
          text: fullText.trim(),
          pages: pagesContent,
          hasImages: allImages.length > 0,
          imageCount: allImages.length,
          imagesDirectory: pdfDir
        },
        cache: {
          hits: cacheHits,
          misses: cacheMisses,
          totalCachedPages: Object.keys(pdfMetadata.parsedPages || {}).length
        }
      };

      api.logger.info('PDF 分页读取完成', {
        readPages: pageNumbers.length,
        totalImages: allImages.length,
        cacheHits,
        cacheMisses
      });

      return result;

    } catch (error) {
      // 记录错误
      api?.logger?.error('PDF Reader operation failed', { 
        method: params.method,
        error: error.message 
      });
      throw error;
    }
  },

  /**
   * 根据页数分割文本
   * @param {string} text - 完整的PDF文本
   * @param {number} totalPages - 总页数
   * @returns {string[]} - 每页的文本数组
   */
  splitTextByPages(text, totalPages) {
    const lines = text.split('\n');
    const linesPerPaged = Math.ceil(lines.length / totalPages);
    const pages = [];

    for (let i = 0; i < totalPages; i++) {
      const start = i * linesPerPaged;
      const end = Math.min(start + linesPerPaged, lines.length);
      pages.push(lines.slice(start, end).join('\n'));
    }

    return pages;
  },

  /**
   * 估算页数（如果PDF元信息中没有页数）
   * @param {string[]} lines - PDF文本行数组
   * @returns {number} - 估算的页数
   */
  estimatePages(lines) {
    // 简单估算：基于文本长度和行数
    // 在实际应用中，可能需要更复杂的算法
    if (lines.length < 100) return 1;
    if (lines.length < 500) return Math.ceil(lines.length / 100);
    return Math.min(100, Math.ceil(lines.length / 50)); // 限制最大估算值
  }
};
