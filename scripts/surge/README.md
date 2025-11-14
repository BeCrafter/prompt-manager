# Prompt Manager Surge同步脚本

该脚本用于将本地提示词文件同步到Surge.sh静态托管服务，供Prompt Manager服务调用。

## 功能特性

1. 解析指定目录下的提示词YAML文件并生成JSON文件
2. 生成提示词索引文件
3. 发布到Surge.sh供外部访问

## 使用方法

### 安装依赖

```bash
npm install
```

### 同步文件

```bash
npm run build
# 或者
node sync-to-surge.js
```

### 同步并发布到Surge

```bash
npm run deploy
# 或者
node sync-to-surge.js --deploy
```

## 文件结构

```
dist/
└── assets/
    ├── prompts.json (提示词索引)
    └── prompts/ (提示词JSON文件，保持原有目录结构)
```

## API接口

- `/assets/prompts.json` - 获取所有提示词列表
- `/assets/prompts/{category}/{name}.json` - 获取JSON格式的提示词文件