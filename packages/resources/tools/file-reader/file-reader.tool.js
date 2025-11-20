/**
 * File Reader - 统一文件读取工具（本地+远程，支持多种格式转换）
 * 
 * 战略意义：
 * 1. 架构隔离性 - 统一的文件读取接口，确保AI操作安全
 * 2. 平台独立性 - 支持本地和远程文件，不依赖特定平台
 * 3. 生态自主性 - 作为Prompt Manager生态的关键组件
 * 
 * 核心能力：
 * - 自动识别本地/远程文件（file://, http://, https://）
 * - 智能识别文件类型（文本、JSON、XML、图片、视频等）
 * - 转换为模型友好格式（结构化数据、文本描述、base64等）
 * - 支持多种编码格式（UTF-8, GBK等）
 * 
 * 设计理念：
 * - 统一接口：一个方法处理所有文件类型
 * - 智能转换：根据文件类型自动选择最佳转换策略
 * - 模型友好：输出格式便于AI模型理解和处理
 * - 可扩展性：易于添加新的文件类型支持
 */

import path from 'path';
import os from 'os';
import { URL } from 'url';

export default {
  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      'axios': '^1.6.0',           // HTTP请求
      'mime-types': '^2.1.35',      // MIME类型检测
      'iconv-lite': '^0.6.3',        // 编码转换（支持GBK等）
      'yaml': '^2.3.4'               // YAML解析（可选，用于YAML文件）
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'file-reader',
      name: 'File Reader',
      description: '统一文件读取工具，支持本地和远程文件，自动识别文件类型并转换为模型友好格式',
      version: '1.0.0',
      category: 'utility',
      author: 'Prompt Manager',
      tags: ['file', 'reader', 'http', 'local', 'remote', 'converter', 'mcp', 'utility'],
      scenarios: [
        '读取本地文本文件',
        '下载并读取远程文件',
        '解析JSON/XML/YAML文件',
        '处理图片文件（转换为base64+描述）',
        '处理视频/音频文件（提取元信息）',
        '读取代码文件（保留格式）',
        '批量读取多个文件'
      ],
      limitations: [
        '远程文件大小限制为10MB',
        '视频文件仅提取元信息，不提取完整内容',
        '需要配置URL白名单才能访问远程文件',
        '大文件处理可能较慢'
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
            description: '操作方法',
            enum: ['read_file'],
            default: 'read_file'
          },
          url: {
            type: 'string',
            description: '文件URL或路径（支持 file://, http://, https:// 或本地路径）',
            minLength: 1
          },
          encoding: {
            type: 'string',
            description: '文本文件编码（默认自动检测，支持 utf-8, gbk, gb2312等）',
            default: 'auto'
          },
          convertTo: {
            type: 'string',
            description: '转换目标格式（auto=自动, text=纯文本, json=JSON对象, xml=XML对象, image=图片base64, video=视频元信息）',
            enum: ['auto', 'text', 'json', 'xml', 'image', 'video', 'audio'],
            default: 'auto'
          },
          includeMetadata: {
            type: 'boolean',
            description: '是否包含文件元信息（大小、类型、修改时间等）',
            default: true
          },
          maxSize: {
            type: 'number',
            description: '最大文件大小（字节），默认10MB',
            default: 10485760
          },
          timeout: {
            type: 'number',
            description: '远程文件下载超时时间（毫秒），默认30秒',
            default: 30000
          },
          basePath: {
            type: 'string',
            description: '基础路径（用于解析相对路径，通常是当前文件所在目录）'
          },
          extractLinks: {
            type: 'boolean',
            description: '是否提取并读取文本中的嵌套链接（默认false）',
            default: false
          },
          maxDepth: {
            type: 'number',
            description: '递归读取链接的最大深度（防止无限递归，默认3）',
            default: 3,
            minimum: 1,
            maximum: 10
          },
          cacheTimeout: {
            type: 'number',
            description: '缓存超时时间（毫秒），默认10分钟（600000）',
            default: 600000
          },
          useCache: {
            type: 'boolean',
            description: '是否使用缓存（默认true）',
            default: true
          }
        },
        required: ['method', 'url']
      },
      environment: {
        type: 'object',
        properties: {
          ALLOWED_DIRECTORIES: {
            type: 'string',
            description: '允许访问的本地目录列表（JSON数组格式）',
            default: '["~/.prompt-manager"]'
          },
          ALLOWED_URLS: {
            type: 'string',
            description: '允许访问的远程URL白名单（JSON数组格式，支持通配符）',
            default: '["https://*", "http://*"]'
          },
          MAX_FILE_SIZE: {
            type: 'string',
            description: '最大文件大小（字节）',
            default: '10485760'
          },
          DEFAULT_TIMEOUT: {
            type: 'string',
            description: '默认超时时间（毫秒）',
            default: '30000'
          },
          DEFAULT_CACHE_TIMEOUT: {
            type: 'string',
            description: '默认缓存超时时间（毫秒）',
            default: '600000'
          },
          MAX_RECURSION_DEPTH: {
            type: 'string',
            description: '最大递归深度',
            default: '3'
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
        code: 'INVALID_URL',
        description: '无效的URL格式',
        match: /invalid url|Invalid URL|URL格式错误/i,
        solution: '请检查URL格式是否正确（支持 file://, http://, https:// 或本地路径）',
        retryable: false
      },
      {
        code: 'URL_NOT_ALLOWED',
        description: 'URL不在白名单中',
        match: /URL.*not allowed|不在白名单|URL.*blocked/i,
        solution: '请将URL添加到环境变量 ALLOWED_URLS 白名单中',
        retryable: false
      },
      {
        code: 'FILE_NOT_FOUND',
        description: '文件不存在',
        match: /ENOENT|no such file|404|Not Found|cannot find/i,
        solution: '请检查文件路径或URL是否正确',
        retryable: false
      },
      {
        code: 'FILE_TOO_LARGE',
        description: '文件过大',
        match: /File too large|文件过大|exceeds.*size|413/i,
        solution: '文件大小超过限制，请使用较小的文件或增加 MAX_FILE_SIZE 配置',
        retryable: false
      },
      {
        code: 'NETWORK_ERROR',
        description: '网络错误',
        match: /network error|ECONNREFUSED|ETIMEDOUT|timeout|网络错误/i,
        solution: '请检查网络连接，稍后重试',
        retryable: true
      },
      {
        code: 'PERMISSION_DENIED',
        description: '权限不足',
        match: /EACCES|permission denied|403|Forbidden|权限不足/i,
        solution: '请检查文件权限或URL访问权限',
        retryable: false
      },
      {
        code: 'UNSUPPORTED_ENCODING',
        description: '不支持的编码格式',
        match: /unsupported encoding|不支持的编码|encoding.*error/i,
        solution: '请指定正确的编码格式（如 utf-8, gbk）',
        retryable: false
      },
      {
        code: 'PARSE_ERROR',
        description: '文件解析失败',
        match: /parse error|解析失败|Invalid JSON|Invalid XML|格式错误/i,
        solution: '文件格式可能不正确，请检查文件内容',
        retryable: false
      },
      {
        code: 'PATH_OUTSIDE_SCOPE',
        description: '路径越权访问',
        match: /路径越权|不在允许的目录范围内/i,
        solution: '请使用允许的目录范围内的路径',
        retryable: false
      }
    ];
  },

  /**
   * 执行工具
   */
  async execute(params) {
    const { api } = this;
    
    api?.logger?.info('执行文件读取', { 
      method: params.method,
      url: params.url
    });
    
    try {
      // 参数验证
      if (params.method !== 'read_file') {
        throw new Error(`不支持的方法: ${params.method}`);
      }
      
      if (!params.url) {
        throw new Error('缺少必需参数: url');
      }

      // 解析相对路径（如果有basePath）
      const resolvedUrl = this.resolveRelativeUrl(params.url, params.basePath);
      api?.logger?.info('URL解析', { 
        original: params.url,
        resolved: resolvedUrl,
        basePath: params.basePath
      });

      // 识别URL类型
      const urlInfo = this.parseUrl(resolvedUrl);
      api?.logger?.info('URL解析结果', urlInfo);

      // 检查缓存
      const cacheKey = this.getCacheKey(resolvedUrl, params);
      const useCache = params.useCache !== false;
      let cachedData = null;
      let fileData = null;
      let fileType = null;
      let converted = null;
      
      if (useCache) {
        cachedData = this.getCachedData(cacheKey, params);
        if (cachedData) {
          api?.logger?.info('使用缓存数据', { cacheKey });
          // 如果不需要提取链接，直接返回缓存
          if (!params.extractLinks) {
            return cachedData;
          }
          // 如果需要提取链接，使用缓存的内容作为基础
          if (params.extractLinks && cachedData.content) {
            converted = { content: cachedData.content, format: cachedData.format };
            fileType = { type: cachedData.file?.type || 'text', mimeType: cachedData.file?.mimeType || 'text/plain' };
          }
        }
      }

      // 如果没有缓存或需要重新读取，读取文件内容
      if (!cachedData || !converted) {
        // 读取文件内容
        if (urlInfo.isLocal) {
          fileData = await this.readLocalFile(urlInfo.path, params);
        } else {
          fileData = await this.readRemoteFile(urlInfo.url, params);
        }

        // 检测文件类型
        fileType = await this.detectFileType(urlInfo.path || urlInfo.url, fileData);
        api?.logger?.info('文件类型检测', { fileType });

        // 转换文件内容为模型友好格式
        converted = await this.convertToModelFormat(fileData, fileType, params);
      }
      
      // 提取并读取嵌套链接（如果需要）
      let finalContent = converted.content;
      let nestedLinks = [];
      
      if (params.extractLinks && typeof converted.content === 'string') {
        const maxDepth = params.maxDepth || parseInt(api.environment.get('MAX_RECURSION_DEPTH') || '3', 10);
        const currentDepth = params._currentDepth || 0;
        
        if (currentDepth < maxDepth) {
          nestedLinks = await this.extractAndReadLinks(
            converted.content, 
            resolvedUrl, 
            params,
            currentDepth + 1
          );
          
          // 将嵌套链接内容嵌入到原文本中
          if (nestedLinks.length > 0) {
            finalContent = this.embedLinksInContent(converted.content, nestedLinks);
          }
        } else {
          api?.logger?.warn('达到最大递归深度，停止提取链接', { maxDepth });
        }
      }
      
      // 构建返回结果
      const result = {
        success: true,
        source: {
          url: params.url,
          resolvedUrl: resolvedUrl,
          type: urlInfo.isLocal ? 'local' : 'remote',
          path: urlInfo.path || urlInfo.url
        },
        file: {
          type: fileType.type,
          mimeType: fileType.mimeType,
          encoding: fileType.encoding || 'utf-8',
          size: fileData ? fileData.buffer.length : (cachedData?.file?.size || 0)
        },
        content: finalContent,
        format: converted.format
      };

      // 添加嵌套链接信息
      if (nestedLinks.length > 0) {
        result.nestedLinks = nestedLinks.map(link => ({
          url: link.url,
          resolvedUrl: link.resolvedUrl,
          type: link.type,
          size: link.size,
          depth: link.depth
        }));
      }

      // 添加元信息（如果需要）
      if (params.includeMetadata !== false) {
        result.metadata = {
          detectedType: fileType.type,
          conversion: converted.conversion || 'none',
          originalSize: fileData ? fileData.buffer.length : (cachedData?.file?.size || 0),
          convertedSize: typeof finalContent === 'string' 
            ? finalContent.length 
            : JSON.stringify(finalContent).length,
          fromCache: !!cachedData,
          nestedLinksCount: nestedLinks.length
        };
      }

      // 保存到缓存
      if (useCache && !cachedData) {
        this.setCachedData(cacheKey, result, params);
      }

      // 清理过期缓存
      this.cleanExpiredCache();

      api?.logger?.info('文件读取完成', { 
        type: fileType.type,
        size: fileData ? fileData.buffer.length : (cachedData?.file?.size || 0),
        fromCache: !!cachedData,
        nestedLinks: nestedLinks.length
      });

      return result;

    } catch (error) {
      api?.logger?.error('文件读取失败', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },

  /**
   * 内部文件读取方法（避免递归调用execute）
   */
  async readFileInternal(params) {
    const { api } = this;
    
    try {
      // 解析相对路径（如果有basePath）
      const resolvedUrl = this.resolveRelativeUrl(params.url, params.basePath);

      // 识别URL类型
      const urlInfo = this.parseUrl(resolvedUrl);

      // 检查缓存
      const cacheKey = this.getCacheKey(resolvedUrl, params);
      const useCache = params.useCache !== false;
      let cachedData = null;
      let fileData = null;
      let fileType = null;
      let converted = null;
      
      if (useCache) {
        cachedData = this.getCachedData(cacheKey, params);
        // 如果有缓存且不需要提取链接，直接返回
        if (cachedData && !params.extractLinks) {
          return cachedData;
        }
        // 如果有缓存且需要提取链接，使用缓存的内容作为基础
        if (cachedData && params.extractLinks && cachedData.content) {
          converted = { content: cachedData.content, format: cachedData.format };
          fileType = { type: cachedData.file?.type || 'text', mimeType: cachedData.file?.mimeType || 'text/plain' };
        }
      }

      // 如果没有缓存或需要重新读取，读取文件内容
      if (!cachedData || !converted) {
        if (urlInfo.isLocal) {
          fileData = await this.readLocalFile(urlInfo.path, params);
        } else {
          fileData = await this.readRemoteFile(urlInfo.url, params);
        }

        // 检测文件类型
        fileType = await this.detectFileType(urlInfo.path || urlInfo.url, fileData);

        // 转换文件内容为模型友好格式
        converted = await this.convertToModelFormat(fileData, fileType, params);
      }
      
      // 提取并读取嵌套链接（如果需要）
      let finalContent = converted.content;
      let nestedLinks = [];
      
      if (params.extractLinks && typeof converted.content === 'string') {
        const maxDepth = params.maxDepth || parseInt(api.environment.get('MAX_RECURSION_DEPTH') || '3', 10);
        const currentDepth = params._currentDepth || 0;
        
        if (currentDepth < maxDepth) {
          nestedLinks = await this.extractAndReadLinks(
            converted.content, 
            resolvedUrl, 
            params,
            currentDepth + 1
          );
          
          // 将嵌套链接内容嵌入到原文本中
          if (nestedLinks.length > 0) {
            finalContent = this.embedLinksInContent(converted.content, nestedLinks);
          }
        }
      }
      
      // 构建返回结果
      const result = {
        success: true,
        source: {
          url: params.url,
          resolvedUrl: resolvedUrl,
          type: urlInfo.isLocal ? 'local' : 'remote',
          path: urlInfo.path || urlInfo.url
        },
        file: {
          type: fileType.type,
          mimeType: fileType.mimeType,
          encoding: fileType.encoding || 'utf-8',
          size: fileData.buffer.length
        },
        content: finalContent,
        format: converted.format
      };

      // 添加嵌套链接信息
      if (nestedLinks.length > 0) {
        result.nestedLinks = nestedLinks.map(link => ({
          url: link.url,
          resolvedUrl: link.resolvedUrl,
          type: link.type,
          size: link.size,
          depth: link.depth
        }));
      }

      // 添加元信息
      if (params.includeMetadata !== false) {
        result.metadata = {
          detectedType: fileType.type,
          conversion: converted.conversion || 'none',
          originalSize: fileData ? fileData.buffer.length : (cachedData?.file?.size || 0),
          convertedSize: typeof finalContent === 'string' 
            ? finalContent.length 
            : JSON.stringify(finalContent).length,
          fromCache: !!cachedData,
          nestedLinksCount: nestedLinks.length
        };
      }

      // 保存到缓存
      if (useCache && !cachedData) {
        this.setCachedData(cacheKey, result, params);
      }

      return result;
    } catch (error) {
      api?.logger?.error('内部文件读取失败', { 
        error: error.message
      });
      throw error;
    }
  },

  /**
   * 解析URL，识别本地/远程
   */
  parseUrl(urlString) {
    try {
      // 处理 file:// 协议
      if (urlString.startsWith('file://')) {
        const url = new URL(urlString);
        // Windows路径处理：file:///C:/path -> C:/path
        let filePath = url.pathname;
        if (process.platform === 'win32' && filePath.startsWith('/')) {
          filePath = filePath.slice(1);
        }
        return {
          isLocal: true,
          path: filePath,
          url: urlString
        };
      }

      // 处理 http:// 或 https://
      if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
        return {
          isLocal: false,
          url: urlString,
          path: null
        };
      }

      // 处理本地路径（相对路径或绝对路径）
      // 如果以 ~ 开头，需要展开
      let localPath = urlString;
      if (localPath.startsWith('~')) {
        localPath = path.join(os.homedir(), localPath.slice(1));
      }

      return {
        isLocal: true,
        path: localPath,
        url: `file://${localPath}`
      };
    } catch (error) {
      throw new Error(`无效的URL格式: ${urlString}`);
    }
  },

  /**
   * 读取本地文件
   */
  async readLocalFile(filePath, params) {
    const { api } = this;
    
    // 初始化文件系统
    await this.initializeFilesystem();
    
    // 解析并验证路径
    const safePath = this.resolvePromptManagerPath(filePath);
    
    // 读取文件
    const fs = await import('fs');
    const fsPromises = fs.promises;
    
    const buffer = await fsPromises.readFile(safePath);
    
    // 检查文件大小
    const maxSize = params.maxSize || parseInt(this.api.environment.get('MAX_FILE_SIZE') || '10485760', 10);
    if (buffer.length > maxSize) {
      throw new Error(`文件过大: ${buffer.length} 字节，超过限制 ${maxSize} 字节`);
    }

    return {
      buffer,
      path: safePath,
      size: buffer.length
    };
  },

  /**
   * 读取远程文件
   */
  async readRemoteFile(url, params) {
    const { api } = this;
    
    // 检查URL白名单
    await this.validateRemoteUrl(url);
    
      // 导入axios
      const axiosModule = await this.importToolModule('axios');
      const axios = axiosModule.default || axiosModule;
      
      // 配置请求参数
      const timeout = params.timeout || parseInt(this.api.environment.get('DEFAULT_TIMEOUT') || '30000', 10);
      const maxSize = params.maxSize || parseInt(this.api.environment.get('MAX_FILE_SIZE') || '10485760', 10);
      
      api?.logger?.info('开始下载远程文件', { url, timeout, maxSize });
      
      try {
        const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'arraybuffer',
        timeout: timeout,
        maxContentLength: maxSize,
        maxBodyLength: maxSize,
        headers: {
          'User-Agent': 'Prompt-Manager-File-Reader/1.0.0'
        }
      });

      const buffer = Buffer.from(response.data);
      
      api?.logger?.info('远程文件下载成功', { 
        size: buffer.length,
        contentType: response.headers['content-type']
      });

      return {
        buffer,
        url: url,
        size: buffer.length,
        contentType: response.headers['content-type']
      };
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error(`下载超时: ${url}`);
      }
      if (error.response?.status === 404) {
        throw new Error(`文件不存在: ${url}`);
      }
      if (error.response?.status === 403) {
        throw new Error(`访问被拒绝: ${url}`);
      }
      if (error.response?.status === 413 || error.message.includes('maxContentLength')) {
        throw new Error(`文件过大: 超过 ${maxSize} 字节限制`);
      }
      throw new Error(`下载失败: ${error.message}`);
    }
  },

  /**
   * 验证远程URL是否在白名单中
   */
  async validateRemoteUrl(url) {
    const { api } = this;
    
    // 获取配置的白名单，如果没有配置则默认为允许所有 http/https
    const allowedUrlsValue = api.environment.get('ALLOWED_URLS');
    let allowedUrls;
    
    // 处理环境变量的不同格式
    if (!allowedUrlsValue) {
      // 没有配置，默认允许所有 http/https 链接
      allowedUrls = ['https://*', 'http://*'];
    } else if (Array.isArray(allowedUrlsValue)) {
      // 如果已经是数组（从 .env 文件解析后的格式），直接使用
      allowedUrls = allowedUrlsValue.length > 0 ? allowedUrlsValue : ['https://*', 'http://*'];
    } else if (typeof allowedUrlsValue === 'string') {
      // 如果是字符串，尝试解析 JSON
      const trimmed = allowedUrlsValue.trim();
      if (!trimmed || trimmed === '') {
        allowedUrls = ['https://*', 'http://*'];
      } else {
        try {
          allowedUrls = JSON.parse(trimmed);
          // 如果解析后为空数组，也使用默认值
          if (!Array.isArray(allowedUrls) || allowedUrls.length === 0) {
            allowedUrls = ['https://*', 'http://*'];
          }
        } catch {
          // 解析失败，使用默认值
          allowedUrls = ['https://*', 'http://*'];
        }
      }
    } else {
      // 其他类型，使用默认值
      allowedUrls = ['https://*', 'http://*'];
    }

    // 检查URL是否匹配白名单
    try {
      const urlObj = new URL(url);
      
      // 检查协议是否为 http 或 https
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error(`不支持的协议: ${urlObj.protocol}，仅支持 http:// 和 https://`);
      }
      
      const isAllowed = allowedUrls.some(pattern => {
        // 处理通配符模式
        // https://* 或 http://* 应该匹配所有对应协议的 URL
        if (pattern === 'https://*' || pattern === 'http://*') {
          return url.startsWith(pattern.replace('*', ''));
        }
        
        // 处理带主机名的通配符：https://example.com/* 或 https://*.example.com/*
        if (pattern.includes('://')) {
          // 如果模式以 /* 结尾，匹配该域名下的所有路径
          if (pattern.endsWith('/*')) {
            const baseUrl = pattern.slice(0, -2); // 移除 '/*'
            return url.startsWith(baseUrl + '/') || url === baseUrl;
          }
          
          // 如果模式包含 * 在主机名中，转换为正则表达式
          if (pattern.includes('*')) {
            // 转义特殊字符，但保留 * 和 ?
            const regexPattern = pattern
              .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
              .replace(/\*/g, '.*')  // * 匹配任意字符
              .replace(/\?/g, '.');   // ? 匹配单个字符
            
            const regex = new RegExp(`^${regexPattern}`);
            return regex.test(url);
          }
          
          // 精确匹配或前缀匹配
          return url === pattern || url.startsWith(pattern + '/');
        }
        
        // 处理其他模式：转换为正则表达式
        // 转义特殊字符，但保留 * 和 ?
        const regexPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
          .replace(/\*/g, '.*')  // * 匹配任意字符
          .replace(/\?/g, '.');  // ? 匹配单个字符
        
        const regex = new RegExp(`^${regexPattern}`);
        return regex.test(url);
      });

      if (!isAllowed) {
        throw new Error(`URL不在白名单中: ${url}。请添加到环境变量 ALLOWED_URLS`);
      }
    } catch (error) {
      if (error.message.includes('不在白名单') || error.message.includes('不支持的协议')) {
        throw error;
      }
      throw new Error(`无效的URL格式: ${url}`);
    }
  },

  /**
   * 检测文件类型
   */
  async detectFileType(filePathOrUrl, fileData) {
    // 从URL或路径获取扩展名
    let ext = '';
    try {
      const url = new URL(filePathOrUrl);
      ext = path.extname(url.pathname).toLowerCase();
    } catch {
      ext = path.extname(filePathOrUrl).toLowerCase();
    }

    // 检测MIME类型
    let mimeType = fileData.contentType || 'application/octet-stream';
    try {
      const mimeTypes = await this.importToolModule('mime-types');
      const detectedMime = mimeTypes.default?.lookup?.(filePathOrUrl) || mimeTypes.lookup?.(filePathOrUrl);
      if (detectedMime) {
        mimeType = detectedMime;
      }
    } catch (error) {
      // mime-types 不可用，使用默认值
    }
    
    // 根据扩展名和MIME类型判断文件类型
    const typeMap = {
      // 文本类型
      text: ['.txt', '.md', '.markdown', '.log', '.csv', '.text'],
      code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd'],
      config: ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'],
      markup: ['.html', '.htm', '.xml', '.svg', '.xhtml'],
      css: ['.css', '.scss', '.sass', '.less'],
      
      // 图片类型
      image: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg'],
      
      // 视频类型
      video: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'],
      
      // 音频类型
      audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'],
      
      // 文档类型
      document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
      
      // 压缩文件
      archive: ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2']
    };

    // 查找文件类型
    let detectedType = 'binary';
    for (const [type, extensions] of Object.entries(typeMap)) {
      if (extensions.includes(ext)) {
        detectedType = type;
        break;
      }
    }

    // 根据MIME类型进一步确认
    if (mimeType.startsWith('text/')) {
      detectedType = 'text';
    } else if (mimeType.startsWith('image/')) {
      detectedType = 'image';
    } else if (mimeType.startsWith('video/')) {
      detectedType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      detectedType = 'audio';
    } else if (mimeType.includes('json')) {
      detectedType = 'json';
    } else if (mimeType.includes('xml')) {
      detectedType = 'xml';
    }

    return {
      type: detectedType,
      mimeType: mimeType,
      extension: ext
    };
  },

  /**
   * 转换为模型友好格式
   */
  async convertToModelFormat(fileData, fileType, params) {
    const { api } = this;
    const convertTo = params.convertTo || 'auto';
    
    api?.logger?.info('开始转换文件格式', { 
      fileType: fileType.type,
      convertTo 
    });

    // 根据文件类型和转换目标选择转换策略
    const targetFormat = convertTo === 'auto' 
      ? this.getDefaultConversionFormat(fileType.type)
      : convertTo;

    switch (targetFormat) {
      case 'text':
        return await this.convertToText(fileData, fileType, params);
      
      case 'json':
        return await this.convertToJson(fileData, fileType, params);
      
      case 'xml':
        return await this.convertToXml(fileData, fileType, params);
      
      case 'image':
        return await this.convertToImage(fileData, fileType, params);
      
      case 'video':
      case 'audio':
        return await this.convertToMedia(fileData, fileType, params);
      
      default:
        // 二进制文件或未知类型
        return await this.convertToBinary(fileData, fileType, params);
    }
  },

  /**
   * 获取默认转换格式
   */
  getDefaultConversionFormat(fileType) {
    const formatMap = {
      'text': 'text',
      'code': 'text',
      'config': 'json',  // JSON/YAML等配置文件
      'markup': 'text',  // HTML/XML等标记语言
      'css': 'text',
      'image': 'image',
      'video': 'video',
      'audio': 'audio',
      'document': 'text',  // PDF等文档（需要特殊处理）
      'archive': 'binary',
      'binary': 'binary'
    };
    
    return formatMap[fileType] || 'text';
  },

  /**
   * 转换为文本格式
   */
  async convertToText(fileData, fileType, params) {
    const { api } = this;
    
    // 检测编码
    let encoding = params.encoding || 'auto';
    if (encoding === 'auto') {
      encoding = this.detectEncoding(fileData.buffer);
    }

    // 解码文本
    let text;
    if (encoding === 'utf-8') {
      text = fileData.buffer.toString('utf-8');
    } else {
      // 使用iconv-lite进行编码转换
      const iconvModule = await this.importToolModule('iconv-lite');
      const iconv = iconvModule.default || iconvModule;
      text = iconv.decode(fileData.buffer, encoding);
    }

    return {
      content: text,
      format: 'text',
      conversion: 'text_decode',
      encoding: encoding
    };
  },

  /**
   * 转换为JSON格式
   */
  async convertToJson(fileData, fileType, params) {
    const { api } = this;
    
    // 先转换为文本
    const textResult = await this.convertToText(fileData, fileType, params);
    const text = textResult.content;

    try {
      // 尝试解析JSON
      const json = JSON.parse(text);
      
      return {
        content: json,
        format: 'json',
        conversion: 'json_parse',
        originalText: text
      };
    } catch (error) {
      // 如果不是有效的JSON，尝试解析YAML
      if (fileType.extension === '.yaml' || fileType.extension === '.yml') {
        try {
          const yamlModule = await this.importToolModule('yaml');
          const yaml = yamlModule.default || yamlModule;
          const json = yaml.parse?.(text) || yaml.parse(text);
          
          return {
            content: json,
            format: 'json',
            conversion: 'yaml_to_json',
            originalText: text
          };
        } catch (yamlError) {
          throw new Error(`无法解析为JSON或YAML: ${error.message}`);
        }
      }
      
      throw new Error(`无效的JSON格式: ${error.message}`);
    }
  },

  /**
   * 转换为XML格式
   */
  async convertToXml(fileData, fileType, params) {
    const { api } = this;
    
    // 先转换为文本
    const textResult = await this.convertToText(fileData, fileType, params);
    const text = textResult.content;

    try {
      // 简单的XML解析（转换为对象）
      // 注意：这里使用简单的正则解析，复杂XML可能需要专门的库
      const xmlObject = this.parseXmlToObject(text);
      
      return {
        content: xmlObject,
        format: 'xml',
        conversion: 'xml_parse',
        originalText: text
      };
    } catch (error) {
      throw new Error(`无效的XML格式: ${error.message}`);
    }
  },

  /**
   * 转换为图片格式（base64 + 描述）
   */
  async convertToImage(fileData, fileType, params) {
    const { api } = this;
    
    // 转换为base64
    const base64 = fileData.buffer.toString('base64');
    const dataUrl = `data:${fileType.mimeType};base64,${base64}`;
    
    // 获取图片基本信息
    const size = fileData.buffer.length;
    const dimensions = await this.getImageDimensions(fileData.buffer, fileType);
    
    return {
      content: {
        dataUrl: dataUrl,
        base64: base64,
        mimeType: fileType.mimeType,
        dimensions: dimensions,
        size: size,
        description: `图片文件，格式: ${fileType.mimeType}，大小: ${(size / 1024).toFixed(2)}KB${dimensions ? `，尺寸: ${dimensions.width}x${dimensions.height}` : ''}`
      },
      format: 'image',
      conversion: 'image_base64'
    };
  },

  /**
   * 转换为媒体格式（视频/音频元信息）
   */
  async convertToMedia(fileData, fileType, params) {
    const { api } = this;
    
    // 对于视频和音频，我们只提取元信息，不提取完整内容
    const size = fileData.buffer.length;
    
    return {
      content: {
        type: fileType.type,
        mimeType: fileType.mimeType,
        size: size,
        sizeFormatted: this.formatFileSize(size),
        description: `${fileType.type === 'video' ? '视频' : '音频'}文件，格式: ${fileType.mimeType}，大小: ${this.formatFileSize(size)}。注意：此工具仅提取元信息，不提取完整内容。`
      },
      format: fileType.type,
      conversion: 'media_metadata'
    };
  },

  /**
   * 转换为二进制格式
   */
  async convertToBinary(fileData, fileType, params) {
    const { api } = this;
    
    // 对于二进制文件，转换为base64
    const base64 = fileData.buffer.toString('base64');
    
    return {
      content: {
        base64: base64,
        mimeType: fileType.mimeType,
        size: fileData.buffer.length,
        description: `二进制文件，格式: ${fileType.mimeType}，大小: ${this.formatFileSize(fileData.buffer.length)}`
      },
      format: 'binary',
      conversion: 'binary_base64'
    };
  },

  /**
   * 检测文本编码
   */
  detectEncoding(buffer) {
    // 简单的UTF-8检测
    // 检查BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf-8';
    }
    
    // 尝试UTF-8解码
    try {
      const text = buffer.toString('utf-8');
      // 检查是否包含无效字符
      if (!/[^\x00-\x7F]/.test(text) || buffer.toString('utf-8').length === buffer.length) {
        return 'utf-8';
      }
    } catch {
      // UTF-8解码失败
    }
    
    // 默认返回utf-8，如果失败可以在convertToText中处理
    return 'utf-8';
  },

  /**
   * 简单的XML解析（转换为对象）
   */
  parseXmlToObject(xmlString) {
    // 这是一个简化的XML解析器
    // 对于复杂XML，建议使用专门的库如xml2js
    const result = {};
    
    // 移除XML声明和注释
    xmlString = xmlString.replace(/<\?xml[^>]*\?>/g, '');
    xmlString = xmlString.replace(/<!--[\s\S]*?-->/g, '');
    
    // 简单的标签提取
    const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
    let match;
    
    while ((match = tagRegex.exec(xmlString)) !== null) {
      const tagName = match[1];
      const content = match[3].trim();
      
      if (!result[tagName]) {
        result[tagName] = [];
      }
      
      result[tagName].push(content);
    }
    
    return result;
  },

  /**
   * 获取图片尺寸
   */
  async getImageDimensions(buffer, fileType) {
    // 这是一个简化的实现
    // 对于生产环境，建议使用专门的图片处理库如sharp或jimp
    try {
      // PNG: 前8字节是签名，然后4字节宽度，4字节高度
      if (fileType.mimeType === 'image/png') {
        if (buffer.length >= 24) {
          const width = buffer.readUInt32BE(16);
          const height = buffer.readUInt32BE(20);
          return { width, height };
        }
      }
      
      // JPEG: 更复杂，需要查找SOF标记
      if (fileType.mimeType === 'image/jpeg') {
        // 简化实现：返回null，表示无法获取
        return null;
      }
    } catch (error) {
      // 解析失败，返回null
    }
    
    return null;
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  },

  /**
   * 解析相对路径URL
   */
  resolveRelativeUrl(url, basePath) {
    // 如果URL已经是绝对路径（http://, https://, file://, /开头），直接返回
    if (url.startsWith('http://') || url.startsWith('https://') || 
        url.startsWith('file://') || 
        (process.platform === 'win32' && /^[A-Za-z]:/.test(url))) {
      return url;
    }

    // 如果没有basePath，无法解析相对路径
    if (!basePath) {
      return url;
    }

    try {
      // 解析basePath，获取目录路径
      const baseUrlInfo = this.parseUrl(basePath);
      
      if (baseUrlInfo.isLocal && baseUrlInfo.path) {
        // 本地文件：获取文件所在目录
        const baseDir = path.dirname(baseUrlInfo.path);
        // 解析相对路径
        const resolvedPath = path.resolve(baseDir, url);
        return resolvedPath;
      } else if (baseUrlInfo.url && (baseUrlInfo.url.startsWith('http://') || baseUrlInfo.url.startsWith('https://'))) {
        // 远程URL：使用URL对象解析相对路径
        const baseUrlObj = new URL(baseUrlInfo.url);
        // 获取基础目录（去掉文件名）
        const basePathname = baseUrlObj.pathname;
        const baseDir = basePathname.substring(0, basePathname.lastIndexOf('/') + 1);
        // 解析相对路径（URL风格的路径拼接）
        const resolvedPathname = this.resolveUrlPath(baseDir, url);
        // 构建完整的URL
        const resolvedUrl = new URL(resolvedPathname, baseUrlObj);
        return resolvedUrl.toString();
      } else {
        // 无法解析，返回原始URL
        return url;
      }
    } catch (error) {
      // 解析失败，返回原始URL
      return url;
    }
  },

  /**
   * 解析URL路径（类似path.resolve，但用于URL路径）
   */
  resolveUrlPath(basePath, relativePath) {
    // 规范化basePath（确保以/结尾）
    if (!basePath.endsWith('/')) {
      const lastSlash = basePath.lastIndexOf('/');
      if (lastSlash >= 0) {
        basePath = basePath.substring(0, lastSlash + 1);
      } else {
        basePath = '/';
      }
    }
    
    // 处理相对路径
    const parts = [];
    const baseParts = basePath.split('/').filter(p => p && p !== '.');
    const relParts = relativePath.split('/').filter(p => p);
    
    // 从basePath开始
    parts.push(...baseParts);
    
    // 处理相对路径的每个部分
    for (const part of relParts) {
      if (part === '.') {
        // 当前目录，忽略
        continue;
      } else if (part === '..') {
        // 上级目录，移除最后一个部分
        if (parts.length > 0) {
          parts.pop();
        }
      } else {
        // 普通路径部分
        parts.push(part);
      }
    }
    
    // 构建最终路径（确保以/开头）
    return '/' + parts.join('/');
  },

  /**
   * 生成缓存键
   */
  getCacheKey(url, params) {
    // 使用URL和关键参数生成缓存键
    const keyParts = [
      url,
      params.convertTo || 'auto',
      params.encoding || 'auto',
      params.extractLinks ? '1' : '0'
    ];
    return `file-reader:${keyParts.join(':')}`;
  },

  /**
   * 获取缓存数据
   */
  getCachedData(cacheKey, params) {
    const { api } = this;
    
    try {
      const cacheData = api.storage.getItem(cacheKey);
      if (!cacheData) {
        return null;
      }

      // 检查是否过期
      const cacheTimeout = params.cacheTimeout || 
        parseInt(api.environment.get('DEFAULT_CACHE_TIMEOUT') || '600000', 10);
      const now = Date.now();
      const cacheAge = now - (cacheData.timestamp || 0);

      if (cacheAge > cacheTimeout) {
        // 缓存已过期，删除
        api.storage.setItem(cacheKey, null);
        api?.logger?.debug('缓存已过期', { cacheKey, cacheAge, cacheTimeout });
        return null;
      }

      // 返回缓存数据（不包含timestamp）
      const { timestamp, ...cachedResult } = cacheData;
      api?.logger?.debug('缓存命中', { cacheKey, cacheAge });
      return cachedResult;
    } catch (error) {
      api?.logger?.warn('读取缓存失败', { cacheKey, error: error.message });
      return null;
    }
  },

  /**
   * 设置缓存数据
   */
  setCachedData(cacheKey, data, params) {
    const { api } = this;
    
    try {
      const cacheData = {
        ...data,
        timestamp: Date.now()
      };
      api.storage.setItem(cacheKey, cacheData);
      api?.logger?.debug('缓存已保存', { cacheKey });
    } catch (error) {
      api?.logger?.warn('保存缓存失败', { cacheKey, error: error.message });
    }
  },

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const { api } = this;
    
    try {
      // 获取所有缓存键（这里需要遍历storage，但Storage API可能不支持）
      // 简化实现：在每次读取时检查过期，这里只记录最后清理时间
      const lastCleanTime = api.storage.getItem('file-reader:last-clean-time') || 0;
      const now = Date.now();
      
      // 每5分钟清理一次
      if (now - lastCleanTime > 5 * 60 * 1000) {
        api.storage.setItem('file-reader:last-clean-time', now);
        api?.logger?.debug('缓存清理完成');
      }
    } catch (error) {
      api?.logger?.warn('清理缓存失败', { error: error.message });
    }
  },

  /**
   * 从文本中提取链接
   */
  extractLinksFromText(text) {
    const links = [];
    
    // 匹配Markdown链接: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(text)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        type: 'markdown'
      });
    }
    
    // 匹配HTML链接: <a href="url">text</a>
    const htmlLinkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    while ((match = htmlLinkRegex.exec(text)) !== null) {
      links.push({
        text: match[2],
        url: match[1],
        type: 'html'
      });
    }
    
    // 匹配直接URL: http://, https://, file://
    const urlRegex = /(https?:\/\/[^\s<>"']+|file:\/\/[^\s<>"']+)/g;
    while ((match = urlRegex.exec(text)) !== null) {
      links.push({
        text: match[1],
        url: match[1],
        type: 'direct'
      });
    }
    
    // 匹配相对路径: ./path, ../path (在特定上下文中)
    // 注意：不匹配以/开头的绝对路径，因为可能是URL路径的一部分
    const relativePathRegex = /(?:^|\s|\(|\[)(\.\.?\/[^\s<>"')]+)/g;
    while ((match = relativePathRegex.exec(text)) !== null) {
      const url = match[1].trim();
      // 过滤掉明显不是文件路径的内容
      if (!url.includes('://') && (url.includes('.') || url.includes('/'))) {
        // 移除可能的括号
        const cleanUrl = url.replace(/^[(\[]/, '').replace(/[)\]]$/, '');
        links.push({
          text: cleanUrl,
          url: cleanUrl,
          type: 'relative'
        });
      }
    }
    
    return links;
  },

  /**
   * 提取并读取嵌套链接
   */
  async extractAndReadLinks(content, baseUrl, params, currentDepth) {
    const { api } = this;
    
    if (typeof content !== 'string') {
      return [];
    }

    // 提取链接
    const links = this.extractLinksFromText(content);
    api?.logger?.info('提取到链接', { count: links.length, depth: currentDepth });

    if (links.length === 0) {
      return [];
    }

    // 读取每个链接的内容
    const nestedLinks = [];
    const maxDepth = params.maxDepth || parseInt(api.environment.get('MAX_RECURSION_DEPTH') || '3', 10);

    for (const link of links) {
      try {
        // 解析相对路径
        const resolvedUrl = this.resolveRelativeUrl(link.url, baseUrl);
        
        // 递归读取（使用内部方法，避免递归调用execute）
        const nestedResult = await this.readFileInternal({
          url: resolvedUrl,
          basePath: resolvedUrl, // 更新basePath为当前文件路径
          convertTo: params.convertTo,
          encoding: params.encoding,
          includeMetadata: params.includeMetadata,
          extractLinks: true, // 继续提取嵌套链接
          maxDepth: params.maxDepth,
          _currentDepth: currentDepth, // 传递当前深度
          useCache: true, // 使用缓存避免重复读取
          cacheTimeout: params.cacheTimeout
        });
        
        nestedLinks.push({
          url: link.url,
          resolvedUrl: resolvedUrl,
          text: link.text,
          type: link.type,
          content: nestedResult.content,
          format: nestedResult.format,
          size: nestedResult.file?.size || 0,
          depth: currentDepth,
          nestedLinks: nestedResult.nestedLinks || []
        });

        api?.logger?.info('嵌套链接读取成功', { 
          url: link.url,
          resolvedUrl: resolvedUrl,
          depth: currentDepth
        });
      } catch (error) {
        api?.logger?.warn('读取嵌套链接失败', { 
          url: link.url,
          error: error.message
        });
        // 继续处理其他链接，不中断
      }
    }

    return nestedLinks;
  },

  /**
   * 将链接内容嵌入到原文本中
   */
  embedLinksInContent(originalContent, nestedLinks) {
    let embeddedContent = originalContent;
    
    // 为每个链接创建嵌入内容
    for (const link of nestedLinks) {
      const linkPlaceholder = `[${link.text}](${link.url})`;
      const linkContent = typeof link.content === 'string' 
        ? link.content 
        : JSON.stringify(link.content, null, 2);
      
      // 创建嵌入块
      const embedBlock = `\n\n---\n**链接内容: ${link.text}** (${link.url})\n---\n${linkContent}\n---\n`;
      
      // 替换链接为嵌入内容
      // 处理Markdown链接
      const markdownPattern = new RegExp(`\\[${this.escapeRegex(link.text)}\\]\\(${this.escapeRegex(link.url)}\\)`, 'g');
      embeddedContent = embeddedContent.replace(markdownPattern, embedBlock);
      
      // 处理HTML链接
      const htmlPattern = new RegExp(`<a[^>]*href=["']${this.escapeRegex(link.url)}["'][^>]*>${this.escapeRegex(link.text)}<\\/a>`, 'gi');
      embeddedContent = embeddedContent.replace(htmlPattern, embedBlock);
      
      // 处理直接URL
      if (link.type === 'direct' || link.type === 'relative') {
        const urlPattern = new RegExp(this.escapeRegex(link.url), 'g');
        embeddedContent = embeddedContent.replace(urlPattern, embedBlock);
      }
    }
    
    return embeddedContent;
  },

  /**
   * 转义正则表达式特殊字符
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};

