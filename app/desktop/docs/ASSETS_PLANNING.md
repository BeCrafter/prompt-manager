# HTML Assets 资源文件规划

## 当前结构

```
app/desktop/
├── assets/
│   ├── icon_16x16.png
│   ├── icon_24x24.png
│   ├── icon_32x32.png
│   ├── icon_48x48.png
│   ├── icon_64x64.png
│   ├── icon_96x96.png
│   ├── icon_128x128.png
│   ├── icon_256x256.png
│   ├── icon_512x512.png
│   ├── icon_1024x1024.png
│   ├── icon.png
│   ├── icon.ico
│   └── icon.icns
├── src/
│   ├── state-manager.js
│   ├── logger.js
│   ├── error-handler.js
│   ├── runtime-manager.js
│   ├── module-loader.js
│   ├── service-manager.js
│   ├── tray-manager.js
│   ├── update-manager.js
│   └── about-dialog-manager.js
├── about.html
├── preload.js
├── package.json
└── main.js
```

## 推荐重构结构

```
app/desktop/
├── assets/
│   ├── icons/                    # 图标资源
│   │   ├── icon_16x16.png
│   │   ├── icon_24x24.png
│   │   ├── icon_32x32.png
│   │   ├── icon_48x48.png
│   │   ├── icon_64x64.png
│   │   ├── icon_96x96.png
│   │   ├── icon_128x128.png
│   │   ├── icon_256x256.png
│   │   ├── icon_512x512.png
│   │   ├── icon_1024x1024.png
│   │   ├── icon.png
│   │   ├── icon.ico
│   │   └── icon.icns
│   └── templates/                # HTML模板
│       ├── about.html           # 关于页面模板
│       ├── update.html          # 更新页面模板（未来使用）
│       └── error.html           # 错误页面模板（未来使用）
├── src/
│   ├── core/                     # 核心管理器
│   │   ├── state-manager.js
│   │   ├── logger.js
│   │   └── error-handler.js
│   ├── services/                 # 服务层
│   │   ├── runtime-manager.js
│   │   ├── module-loader.js
│   │   ├── service-manager.js
│   │   └── update-manager.js
│   ├── ui/                       # UI层
│   │   ├── tray-manager.js
│   │   ├── about-dialog-manager.js
│   │   └── window-manager.js    # 窗口管理（未来使用）
│   └── utils/                    # 工具类
│       ├── version-utils.js     # 版本比较工具
│       ├── path-utils.js        # 路径工具
│       └── template-renderer.js # 模板渲染工具
├── preload.js
├── package.json
└── main.js
```

## HTML Assets 管理策略

### 1. 模板文件结构

```html
<!-- assets/templates/about.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <style>
    /* 内联样式，减少外部依赖 */
    {{styles}}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="data:image/png;base64,{{logoData}}" alt="{{appName}}" width="64" height="64">
    </div>
    
    <div class="version-info">
      <div class="version-item">
        <span class="label">服务版本:</span>
        <span class="value">{{version}}</span>
      </div>
      <div class="version-item">
        <span class="label">Electron:</span>
        <span class="value">{{electronVersion}}</span>
      </div>
      <div class="version-item">
        <span class="label">Node.js:</span>
        <span class="value">{{nodeVersion}}</span>
      </div>
    </div>
    
    {{#if debugLogEnabled}}
    <div class="notification">
      <div class="notification-title">调试日志已开启</div>
      <div class="notification-content">日志文件路径: {{logFilePath}}</div>
    </div>
    {{/if}}
    
    <div class="click-hint">
      连续点击此窗口 {{clickCount}} 次可{{#if debugLogEnabled}}关闭{{else}}开启{{/if}}调试日志
    </div>
  </div>
  
  <script>
    // 点击事件处理
    document.addEventListener('click', (event) => {
      const currentTime = Date.now();
      
      if (window.electronAPI) {
        window.electronAPI.sendAboutWindowClick({
          currentTime: currentTime
        });
      }
    });
  </script>
</body>
</html>
```

### 2. 模板渲染工具

```javascript
// src/utils/template-renderer.js
class TemplateRenderer {
  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  loadTemplates() {
    const templatesDir = path.join(__dirname, '..', '..', 'assets', 'templates');
    
    // 加载所有模板文件
    const templateFiles = fs.readdirSync(templatesDir);
    templateFiles.forEach(file => {
      if (file.endsWith('.html')) {
        const templateName = path.basename(file, '.html');
        const templatePath = path.join(templatesDir, file);
        this.templates.set(templateName, fs.readFileSync(templatePath, 'utf8'));
      }
    });
  }

  render(templateName, data) {
    let template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // 简单的模板替换逻辑
    // 支持 {{variable}} 和 {{#if condition}}...{{/if}}
    return this.processTemplate(template, data);
  }

  processTemplate(template, data) {
    // 处理条件语句
    template = this.processConditionals(template, data);
    
    // 处理变量替换
    template = this.processVariables(template, data);
    
    return template;
  }

  processConditionals(template, data) {
    // 处理 {{#if condition}}...{{/if}}
    const ifRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    return template.replace(ifRegex, (match, condition, content) => {
      return data[condition] ? content : '';
    });
  }

  processVariables(template, data) {
    // 处理 {{variable}}
    const varRegex = /\{\{(\w+)\}\}/g;
    return template.replace(varRegex, (match, variable) => {
      return data[variable] || '';
    });
  }
}
```

### 3. 图标管理器

```javascript
// src/utils/icon-manager.js
class IconManager {
  constructor() {
    this.iconCache = new Map();
    this.iconPaths = this.getIconPaths();
  }

  getIconPaths() {
    const basePath = path.join(__dirname, '..', '..', 'assets', 'icons');
    return {
      '16': path.join(basePath, 'icon_16x16.png'),
      '24': path.join(basePath, 'icon_24x24.png'),
      '32': path.join(basePath, 'icon_32x32.png'),
      '48': path.join(basePath, 'icon_48x48.png'),
      '64': path.join(basePath, 'icon_64x64.png'),
      '96': path.join(basePath, 'icon_96x96.png'),
      '128': path.join(basePath, 'icon_128x128.png'),
      '256': path.join(basePath, 'icon_256x256.png'),
      '512': path.join(basePath, 'icon_512x512.png'),
      '1024': path.join(basePath, 'icon_1024x1024.png'),
      'default': path.join(basePath, 'icon.png'),
      'ico': path.join(basePath, 'icon.ico'),
      'icns': path.join(basePath, 'icon.icns')
    };
  }

  getIcon(size = 'default') {
    if (this.iconCache.has(size)) {
      return this.iconCache.get(size);
    }

    const iconPath = this.iconPaths[size];
    if (!iconPath || !fs.existsSync(iconPath)) {
      return null;
    }

    const icon = nativeImage.createFromPath(iconPath);
    this.iconCache.set(size, icon);
    return icon;
  }

  getTrayIcon() {
    const platform = process.platform;
    let iconSize = '16';
    
    if (platform === 'darwin') {
      iconSize = '18';
    } else if (platform === 'win32') {
      iconSize = '16';
    } else {
      iconSize = '24';
    }

    return this.getIcon(iconSize) || this.getIcon('default');
  }

  getAboutDialogIcon() {
    return this.getIcon('64') || this.getIcon('default');
  }

  clearCache() {
    this.iconCache.clear();
  }
}
```

## 资源文件使用规范

### 1. 图标使用
```javascript
// 在 TrayManager 中使用
const iconManager = new IconManager();
const trayIcon = iconManager.getTrayIcon();
```

### 2. 模板使用
```javascript
// 在 AboutDialogManager 中使用
const templateRenderer = new TemplateRenderer();
const htmlContent = templateRenderer.render('about', {
  version: '1.0.0',
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  debugLogEnabled: false,
  clickCount: 3,
  logFilePath: '/path/to/log'
});
```

### 3. 资源路径管理
```javascript
// 集中管理所有资源路径
const ResourcePaths = {
  icons: {
    tray: path.join(__dirname, 'assets', 'icons', 'icon_16x16.png'),
    about: path.join(__dirname, 'assets', 'icons', 'icon_64x64.png'),
    main: path.join(__dirname, 'assets', 'icons', 'icon.png')
  },
  templates: {
    about: path.join(__dirname, 'assets', 'templates', 'about.html'),
    update: path.join(__dirname, 'assets', 'templates', 'update.html'),
    error: path.join(__dirname, 'assets', 'templates', 'error.html')
  }
};
```

## 打包配置更新

```json
// package.json build 配置
{
  "build": {
    "extraResources": [
      {
        "from": "assets",
        "to": "assets",
        "filter": [
          "**/*"
        ]
      }
    ],
    "files": [
      "**/*",
      "!assets/**/*.md",
      "!assets/**/*.psd"
    ]
  }
}
```

## 未来扩展规划

1. **主题支持**: 支持亮色/暗色主题切换
2. **国际化**: 支持多语言界面
3. **自定义样式**: 支持用户自定义CSS
4. **动态模板**: 支持运行时模板更新
5. **资源热重载**: 开发模式下支持资源热更新
6. **压缩优化**: 生产环境自动压缩资源文件