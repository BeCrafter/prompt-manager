# 环境清理脚本使用指南

## 概述

此脚本用于一键清理项目环境，解决因npm缓存、依赖冲突或构建产物导致的问题。

## 快速开始

### 完整清理（推荐）
```bash
npm run clean
```
执行完整的环境清理流程，包括缓存清理、依赖重装、构建产物清理等。

### 选择性清理

#### 仅清理缓存
```bash
npm run clean:cache
```
仅清理npm和yarn缓存，不删除node_modules。

#### 仅清理依赖
```bash
npm run clean:deps
```
删除所有node_modules和锁定文件，然后重新安装所有依赖。

#### 仅清理构建产物
```bash
npm run clean:build
```
删除所有构建产物和临时文件。

#### 快速重装
```bash
npm run clean:reinstall
```
组合命令：先清理后重装。

## 脚本功能详解

### 清理内容

1. **缓存清理**
   - npm缓存
   - yarn缓存

2. **依赖清理**
   - 所有node_modules目录
   - package-lock.json文件
   - yarn.lock文件
   - pnpm-lock.yaml文件

3. **构建产物清理**
   - dist目录
   - packages/web目录
   - packages/server/dist目录
   - app/desktop/dist目录

4. **临时文件清理**
   - npm调试日志
   - 各种临时文件
   - 构建缓存

### 依赖重装

脚本会按正确的顺序重新安装依赖：
1. 根目录依赖
2. 桌面应用依赖
3. admin-ui依赖
4. server依赖

### 安装验证

清理完成后会自动验证安装是否成功。

## 使用场景

### 场景1: 构建失败
```bash
npm run clean
npm run build:desktop
```

### 场景2: 依赖冲突
```bash
npm run clean:deps
```

### 场景3: 缓存问题
```bash
npm run clean:cache
npm install
```

### 场景4: 仅清理构建产物
```bash
npm run clean:build
npm run build
```

## 故障排除

### 清理后仍出现问题
如果清理后仍有问题，请尝试：
1. 手动删除所有相关目录
2. 检查网络连接
3. 验证Node.js和npm版本

### 权限问题
如果遇到权限问题，请使用sudo（不推荐）或检查文件权限。

### 网络问题
如果依赖安装失败，请检查网络连接或更换npm镜像源。

## 高级用法

### 直接运行脚本
```bash
# 完整清理
bash scripts/clean-environment.sh

# 仅清理缓存
bash scripts/clean-environment.sh cache-only

# 仅清理依赖
bash scripts/clean-environment.sh deps-only

# 查看帮助
bash scripts/clean-environment.sh help
```

## 注意事项

- 清理过程会删除所有node_modules，请确保没有重要的本地修改
- 清理完成后建议运行`npm run verify`验证环境
- 大型项目清理可能需要较长时间，请耐心等待
- 建议在非工作时间执行清理操作