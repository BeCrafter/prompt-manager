/**
 * 模板渲染器
 * 提供HTML模板渲染功能
 */

const fs = require('fs');
const path = require('path');

class TemplateRenderer {
  constructor(templatesDir = null) {
    this.templatesDir = templatesDir || path.join(__dirname, '..', '..', 'assets', 'templates');
    this.templates = new Map();
    this.loadTemplates();
  }

  /**
   * 加载所有模板文件
   */
  loadTemplates() {
    try {
      if (!fs.existsSync(this.templatesDir)) {
        this.logger?.warn('Templates directory not found', { dir: this.templatesDir });
        return;
      }

      const templateFiles = fs.readdirSync(this.templatesDir);
      
      templateFiles.forEach(file => {
        if (file.endsWith('.html')) {
          const templateName = path.basename(file, '.html');
          const templatePath = path.join(this.templatesDir, file);
          
          try {
            const content = fs.readFileSync(templatePath, 'utf8');
            this.templates.set(templateName, content);
          } catch (error) {
            console.error(`Failed to load template ${templateName}:`, error);
          }
        }
      });
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  /**
   * 渲染模板
   * @param {string} templateName - 模板名称
   * @param {object} data - 渲染数据
   * @returns {string} - 渲染后的HTML
   */
  render(templateName, data = {}) {
    let template = this.templates.get(templateName);
    
    if (!template) {
      // 如果没有找到模板，返回基本HTML
      return this.renderBasicHTML(templateName, data);
    }

    try {
      // 处理条件语句
      template = this.processConditionals(template, data);
      
      // 处理变量替换
      template = this.processVariables(template, data);
      
      // 处理logo数据
      template = this.processLogoData(template, data);
      
      return template;
    } catch (error) {
      console.error(`Template rendering failed for ${templateName}:`, error);
      return this.renderBasicHTML(templateName, data);
    }
  }

  /**
   * 处理条件语句 {{#if condition}}...{{/if}}
   */
  processConditionals(template, data) {
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(ifRegex, (match, condition, content) => {
      return data[condition] ? content : '';
    });
  }

  /**
   * 处理变量替换 {{variable}}
   */
  processVariables(template, data) {
    const varRegex = /\{\{(\w+)\}\}/g;
    
    return template.replace(varRegex, (match, variable) => {
      return data[variable] !== undefined ? String(data[variable]) : '';
    });
  }

  /**
   * 处理logo数据
   */
  processLogoData(template, data) {
    if (data.logoData) {
      template = template.replace(/\{\{logoData\}\}/g, data.logoData);
    }
    return template;
  }

  /**
   * 渲染基本HTML（备用方案）
   */
  renderBasicHTML(templateName, data) {
    const basicTemplates = {
      about: this.getBasicAboutHTML(data),
      error: this.getBasicErrorHTML(data)
    };
    
    return basicTemplates[templateName] || this.getBasicFallbackHTML(data);
  }

  /**
   * 基本关于页面HTML
   */
  getBasicAboutHTML(data) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>关于 Prompt Manager</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 300px;
      margin: 0 auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .title {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .label {
      color: #666;
    }
    .value {
      color: #333;
      font-weight: 500;
    }
    .hint {
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 15px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="title">Prompt Manager</div>
    <div class="info-item">
      <span class="label">服务版本:</span>
      <span class="value">${data.version || 'unknown'}</span>
    </div>
    <div class="info-item">
      <span class="label">Electron:</span>
      <span class="value">${data.electronVersion || 'unknown'}</span>
    </div>
    <div class="info-item">
      <span class="label">Node.js:</span>
      <span class="value">${data.nodeVersion || 'unknown'}</span>
    </div>
    ${data.debugLogEnabled ? '<div class="hint">调试日志已开启</div>' : ''}
    <div class="hint">连续点击此窗口 ${data.clickCount || 3} 次可${data.debugLogEnabled ? '关闭' : '开启'}调试日志</div>
  </div>
</body>
</html>`;
  }

  /**
   * 基本错误页面HTML
   */
  getBasicErrorHTML(data) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>错误 - Prompt Manager</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fff5f5;
      color: #c53030;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 400px;
      margin: 0 auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .error-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .error-message {
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-title">发生错误</div>
    <div class="error-message">${data.message || '未知错误'}</div>
  </div>
</body>
</html>`;
  }

  /**
   * 基本备用HTML
   */
  getBasicFallbackHTML(data) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Prompt Manager</title>
</head>
<body>
  <h1>Prompt Manager</h1>
  <p>版本: ${data.version || 'unknown'}</p>
  <p>Electron: ${data.electronVersion || 'unknown'}</p>
  <p>Node.js: ${data.nodeVersion || 'unknown'}</p>
</body>
</html>`;
  }

  /**
   * 获取可用模板列表
   */
  getAvailableTemplates() {
    return Array.from(this.templates.keys());
  }

  /**
   * 检查模板是否存在
   */
  hasTemplate(templateName) {
    return this.templates.has(templateName);
  }

  /**
   * 重新加载模板
   */
  reloadTemplates() {
    this.templates.clear();
    this.loadTemplates();
  }
}

module.exports = TemplateRenderer;