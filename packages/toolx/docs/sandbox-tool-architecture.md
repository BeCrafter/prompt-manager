# Node.js 沙箱工具库架构设计文档

## 目录

1. [概述](#概述)
2. [设计目标](#设计目标)
3. [核心架构](#核心架构)
4. [标准工具结构](#标准工具结构)
5. [工具枚举机制](#工具枚举机制)
6. [单测验证机制](#单测验证机制)
7. [环境隔离方案](#环境隔离方案)
8. [动态依赖安装](#动态依赖安装)
9. [三种推荐方案](#三种推荐方案)
10. [潜在问题与建议](#潜在问题与建议)
11. [实现计划](#实现计划)

## 概述

本文档旨在设计一个 Node.js 沙箱工具库，该库允许在隔离环境中执行 Node.js 脚本，支持动态安装依赖，并确保工具间的环境隔离。设计参考了现有的 `filesystem.tool.js` 架构，保持简洁性的同时便于扩展和理解。

## 设计目标

1. **环境隔离**：每个工具运行在独立的沙箱环境中，避免相互影响
2. **动态依赖**：支持在沙箱中动态安装和管理 npm 依赖
3. **简洁架构**：保持简单直观的架构，便于理解和维护
4. **易于扩展**：设计良好的接口，便于后续功能扩展
5. **小白友好**：文档和代码结构清晰，便于新手上手

## 核心架构

### 整体结构

```
@packages/toolx/
├── resources/           # 静态资源目录
│   └── tools/           # 工具脚本目录
│       ├── filesystem/  # 文件系统工具（示例）
│       │   └── filesystem.tool.js  # 注意：工具文件应使用 {name}.tool.js 命名格式
│       └── [new-tool]/  # 新的沙箱工具
│           ├── {new-tool}.tool.js  # 工具实现文件（必需，命名格式：{tool-name}.tool.js）
│           └── resources/          # 工具资源文件（可选）
│               ├── templates/      # 模板文件
│               └── assets/         # 静态资源
├── src/                 # 核心代码目录
│   ├── sandbox/         # 沙箱核心实现
│   │   ├── index.js     # 沙箱入口
│   │   ├── executor.js  # 脚本执行器
│   │   ├── installer.js # 依赖安装器
│   │   └── enumerator.js # 工具枚举器
│   ├── test/            # 测试目录
│   │   └── validator.js # 单测验证器
│   └── utils/           # 工具函数
└── docs/                # 文档目录
    └── sandbox-tool-architecture.md  # 本架构文档
```

## 工具枚举机制

工具枚举器是沙箱系统的重要组成部分，负责发现、加载和管理所有可用的工具。设计应遵循以下原则：

1. **自动化发现**：自动扫描 `resources/tools` 目录中的所有工具文件
2. **规范化命名**：仅识别符合 `{name}.tool.js` 命名规范的文件
3. **元数据提取**：从工具文件中提取元数据信息供外部查询
4. **按需加载**：仅在需要时才加载和初始化工具

### 枚举器接口

```javascript
class ToolEnumerator {
  /**
   * 扫描并发现所有可用工具
   * @param {string} toolsDir - 工具目录路径
   * @returns {Promise<Array>} 工具信息列表
   */
  async discoverTools(toolsDir) {
    // 实现扫描逻辑
  }

  /**
   * 获取工具列表
   * @returns {Array} 工具元数据列表
   */
  getToolList() {
    // 返回已发现的工具列表
  }

  /**
   * 获取特定工具信息
   * @param {string} toolName - 工具名称
   * @returns {Object} 工具元数据
   */
  getToolInfo(toolName) {
    // 返回指定工具的信息
  }

  /**
   * 加载工具实例
   * @param {string} toolName - 工具名称
   * @returns {Object} 工具实例
   */
  async loadTool(toolName) {
    // 动态加载并返回工具实例
  }
}
```

## 单测验证机制

为了确保沙箱工具库的稳定性和可靠性，需要实现全面的单测验证机制。验证机制应能够通过运行测试即可定位和解决异常问题：

1. **基础功能验证**：验证沙箱执行器的基本功能
2. **依赖安装验证**：验证动态依赖安装功能
3. **工具枚举验证**：验证工具发现和加载机制
4. **隔离性验证**：验证工具间的环境隔离
5. **错误处理验证**：验证异常情况下的错误处理机制
6. **回归测试**：验证已修复问题不再重现

### 验证器接口

```javascript
class TestValidator {
  /**
   * 运行所有验证测试
   * @returns {Object} 测试结果报告
   */
  async runAllTests() {
    // 运行所有测试并返回结果
  }

  /**
   * 验证沙箱执行功能
   * @returns {boolean} 是否通过验证
   */
  async validateSandboxExecution() {
    // 验证沙箱执行功能
  }

  /**
   * 验证动态依赖安装
   * @returns {boolean} 是否通过验证
   */
  async validateDependencyInstallation() {
    // 验证依赖安装功能
  }

  /**
   * 验证工具枚举功能
   * @returns {boolean} 是否通过验证
   */
  async validateToolEnumeration() {
    // 验证工具枚举功能
  }

  /**
   * 生成测试报告
   * @returns {Object} 详细的测试报告
   */
  generateReport() {
    // 生成测试报告
  }
}
```

## 标准工具结构

参考 `filesystem.tool.js` 的设计，每个沙箱工具应包含以下标准结构：

### 工具模块接口

```javascript
module.exports = {
  /**
   * 获取工具依赖
   * @returns {Object} 依赖列表，格式为 {packageName: version}
   */
  getDependencies() {
    return {
      // 示例：'lodash': '^4.17.21'
    };
  },

  /**
   * 获取工具元信息
   * @returns {Object} 工具元数据
   */
  getMetadata() {
    return {
      id: 'tool-id',
      name: 'Tool Name',
      description: 'Tool description',
      version: '1.0.0',
      category: 'utility',
      author: 'Author Name',
      tags: ['tag1', 'tag2']
    };
  },

  /**
   * 获取参数Schema
   * @returns {Object} 参数验证Schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          // 参数定义
        },
        required: []
      }
    };
  },

  /**
   * 获取业务错误定义
   * @returns {Array} 错误定义列表
   */
  getBusinessErrors() {
    return [
      {
        code: 'ERROR_CODE',
        description: '错误描述',
        match: /错误匹配正则/,
        solution: '解决方案',
        retryable: false
      }
    ];
  },

  /**
   * 执行工具
   * @param {Object} params 执行参数
   * @returns {Promise<any>} 执行结果
   */
  async execute(params) {
    // 工具执行逻辑
  }
};
```

### 工具目录结构

```
[new-tool]/
├── {new-tool}.tool.js  # 工具实现文件（必需，命名格式：{tool-name}.tool.js）
├── README.md           # 工具说明文档（可选）
└── resources/          # 工具资源文件（可选）
    ├── templates/      # 模板文件
    └── assets/         # 静态资源
```

## 环境隔离方案

### 隔离策略

1. **进程级隔离**：每个工具在独立的 Node.js 进程中运行
2. **文件系统隔离**：每个工具拥有独立的工作目录
3. **依赖隔离**：每个工具拥有独立的 node_modules 目录

### 实现方案

1. **使用 Node.js Worker Threads**：
   - 轻量级隔离
   - 共享内存空间
   - 适合计算密集型任务

2. **使用 Child Processes**：
   - 完全隔离
   - 独立内存空间
   - 适合IO密集型任务

3. **使用 VM2 沙箱库**：
   - 虚拟机级隔离
   - 可控制API访问
   - 适合执行不受信任代码

## 动态依赖安装

### 安装流程

1. **依赖解析**：从工具的 `getDependencies()` 方法获取依赖列表
2. **环境检查**：检查依赖是否已安装
3. **依赖安装**：使用内置 npm 安装缺失依赖，配置默认镜像源避免卡顿
4. **缓存管理**：缓存已安装依赖，避免重复安装

### 实现要点

1. **依赖定义**：依赖必须在工具文件的 `getDependencies()` 方法中定义，不使用 package.json
2. **镜像源配置**：默认配置 npm 镜像源（如淘宝镜像 registry.npmmirror.com），避免因网络问题导致安装卡顿
3. **使用内置工具**：使用软件内置的 node、npm、npx，不依赖系统默认安装，确保环境一致性
4. **安装隔离**：每个工具的依赖安装在独立目录中
5. **安装超时**：设置依赖安装超时时间，避免长时间阻塞
6. **错误处理**：处理依赖安装失败的情况

### 镜像源配置

为了提高依赖安装速度，特别是在中国地区，应默认配置以下镜像源：
- npm registry: https://registry.npmmirror.com
- yarn registry: https://registry.npmmirror.com

配置应通过环境变量或 npm 配置文件实现，确保不影响系统全局设置。

## 三种推荐方案

### 方案一：基于 Worker Threads 的轻量级沙箱

**特点**：
- 使用 Node.js Worker Threads 实现
- 共享进程内存，性能较好
- 实现相对简单

**适用场景**：
- 计算密集型任务
- 可信任的脚本执行
- 对性能要求较高的场景

**优缺点**：
- 优点：性能好，实现简单
- 缺点：隔离性较弱，安全性较低

### 方案二：基于 Child Processes 的完全隔离沙箱

**特点**：
- 使用 Node.js Child Processes 实现
- 完全独立的进程，隔离性强
- 支持复杂的依赖管理

**适用场景**：
- 执行不受信任的代码
- 需要完全隔离的环境
- IO密集型任务

**优缺点**：
- 优点：隔离性强，安全性高
- 缺点：资源消耗大，通信开销高

### 方案三：基于 VM2 的虚拟机沙箱

**特点**：
- 使用 VM2 库实现
- 虚拟机级别的隔离
- 可精细控制 API 访问权限

**适用场景**：
- 执行第三方脚本
- 需要精细权限控制的场景
- 教学或演示环境

**优缺点**：
- 优点：权限控制精细，隔离性好
- 缺点：实现复杂，可能存在绕过风险

## 潜在问题与建议

### 1. 安全性问题

**问题**：沙箱逃逸风险
**建议**：
- 使用多层隔离机制
- 限制文件系统访问权限
- 定期更新沙箱库

### 2. 性能问题

**问题**：频繁创建/销毁沙箱开销大
**建议**：
- 实现沙箱池化复用
- 异步预创建沙箱
- 监控沙箱资源使用情况

### 3. 依赖管理问题

**问题**：依赖冲突、版本不一致
**建议**：
- 每个工具独立的 node_modules
- 使用 package-lock.json 锁定版本
- 实现依赖缓存机制

### 4. 错误处理问题

**问题**：沙箱内错误难以捕获和处理
**建议**：
- 统一错误处理机制
- 实现详细的错误日志记录
- 提供错误恢复机制

### 5. npm镜像源问题

**问题**：因网络问题导致依赖安装卡顿或失败
**建议**：
- 默认配置国内镜像源（如淘宝镜像 registry.npmmirror.com）
- 实现镜像源自动切换机制
- 预配置npm配置避免网络问题

### 6. 环境一致性问题

**问题**：使用系统默认node/npm/npx导致环境不一致
**建议**：
- 使用软件内置的node、npm、npx工具
- 避免依赖系统环境变量
- 实现环境检测和自动配置机制

## 实现计划

### 第一阶段：核心框架搭建

1. 创建沙箱核心模块
2. 实现基础的脚本执行功能
3. 设计工具标准接口

### 第二阶段：环境隔离实现

1. 实现进程级隔离
2. 设计文件系统访问控制
3. 实现基础的依赖管理

### 第三阶段：功能完善

1. 实现动态依赖安装
2. 完善错误处理机制
3. 添加日志和监控功能
4. 实现工具枚举机制
5. 实现单测验证机制

### 第四阶段：优化与扩展

1. 性能优化
2. 安全性增强
3. 支持更多沙箱实现方案
4. 完善测试用例和验证机制
3. 支持更多沙箱实现方案