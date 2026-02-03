# 技能管理系统开发文档

> **版本**: v0.2.5  
> **最后更新**: 2026-02-03  
> **状态**: 生产就绪

---

## 📋 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [核心服务](#核心服务)
- [API 接口](#api-接口)
- [数据结构](#数据结构)
- [同步机制](#同步机制)
- [开发指南](#开发指南)
- [使用场景](#使用场景)
- [故障排除](#故障排除)

---

## 概述

Prompt Manager 的技能管理系统是一个**中心化、可同步、易管理**的技能库，旨在解决多 AI 工具环境下的"配置熵增"问题。

### 核心目标

1. **统一管理** - 所有技能集中存储，统一视图
2. **多目标同步** - 一处修改，自动同步到多个工具目录
3. **在线编辑** - Web 界面直接编辑，无需手动操作
4. **导入导出** - 支持技能包的分享和迁移

### 解决的问题

| 问题 | 传统方案 | Prompt Manager |
|------|----------|---------------|
| 冗余存储 | 同一技能在多个目录重复 | 单一存储源 |
| 版本不一致 | 修改一处，其他地方未同步 | 自动同步所有目标 |
| 管理盲区 | 技能散落各处，无统一视图 | 集中管理界面 |
| 分享困难 | 手动复制文件，容易出错 | 一键导入导出 |

---

## 架构设计

### 双服务架构

```
┌─────────────────────────────────────────────────────────┐
│                    SkillsManager                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  • 加载技能（内置 + 自定义）                      │  │
│  │  • 解析 SKILL.md（YAML + Markdown）               │  │
│  │  • CRUD 操作（创建、更新、删除、复制）             │  │
│  │  • 导出 ZIP 包                                    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  SkillSyncService                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  • 管理同步配置（目标目录列表）                   │  │
│  │  • 智能同步（符号链接优先，降级到复制）           │  │
│  │  • 实时监听（目录变更自动同步）                   │  │
│  │  • 手动同步接口                                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    目标目录                              │
│  ~/.cursor/rules                                        │
│  ~/.claude/skills                                       │
│  ~/projects/xxx/.opencode/skills                        │
└─────────────────────────────────────────────────────────┘
```

### 目录结构

```
packages/server/configs/skills/
├── built-in/              # 内置技能（不可修改）
│   ├── frontend-design/
│   │   └── SKILL.md
│   └── skill-creator/
│       └── SKILL.md
└── [自定义目录]           # 自定义技能

~/.prompt-manager/skills/  # 用户自定义技能目录
├── code-review/
│   ├── SKILL.md
│   └── utils.js
└── git-workflow/
    └── SKILL.md
```

---

## 核心服务

### 1. SkillsManager

**位置**: `packages/server/services/skills.service.js`

#### 职责

- 扫描和加载技能（内置 + 自定义）
- 解析 SKILL.md 文件（YAML 前置 + Markdown）
- 技能 CRUD 操作
- 导出技能为 ZIP 包

#### 关键方法

##### 加载技能

```javascript
async loadSkills() {
  await this.ensureDirectories();
  this.loadedSkills.clear();
  
  // 加载内置技能
  await this.loadSkillsFromDir(this.builtInDir, true);
  
  // 加载自定义技能
  await this.loadSkillsFromDir(this.customDir, false);
}
```

##### 解析 SKILL.md

严格遵循 Claude 官方格式：

```markdown
---
name: code-review
description: 代码审查助手
version: 1.0.0
allowedTools:
  - codebase-analyzer
  - git-diff
model: claude-3-5-sonnet
---

# 代码审查助手

这是一个专业的代码审查技能...
```

##### Zod Schema 验证

```javascript
const SkillFrontmatterSchema = z.object({
  name: z.string().min(1).max(64)
        .regex(/^[a-z0-9-\u4e00-\u9fa5]+$/i),
  description: z.string().min(1).max(1024),
  version: z.string().optional().default('0.0.1'),
  allowedTools: z.array(z.string()).optional(),
  model: z.string().optional(),
  context: z.enum(['fork', 'shared']).optional(),
  agent: z.string().optional(),
  userInvocable: z.boolean().optional().default(true),
  disableModelInvocation: z.boolean().optional().default(false),
  hooks: z.object({
    PreToolUse: z.array(...).optional(),
    PostToolUse: z.array(...).optional(),
    Stop: z.array(...).optional()
  }).optional()
});
```

#### CRUD 操作

| 操作 | 方法 | 说明 |
|------|------|------|
| 创建 | `createSkill(skillData)` | 创建新技能目录和 SKILL.md |
| 更新 | `updateSkill(id, skillData)` | 更新技能内容，支持重命名 |
| 删除 | `deleteSkill(id)` | 删除整个技能目录 |
| 复制 | `duplicateSkill(id, newName)` | 复制技能并修改名称 |
| 导出 | `exportSkill(id)` | 导出为 ZIP 包 |

#### 限制

- 单个文件最大 10MB
- 每个技能最多 50 个文件
- 技能总大小最大 100MB

---

### 2. SkillSyncService

**位置**: `packages/server/services/skill-sync.service.js`

#### 职责

- 管理同步配置（目标目录列表）
- 智能同步（符号链接优先，降级到复制）
- 实时监听（目录变更自动同步）
- 手动同步接口

#### 配置文件

```json
// ~/.prompt-manager/configs/skill-sync.json
{
  "enabled": true,
  "targets": [
    "~/.cursor/rules",
    "~/.claude/skills",
    "~/projects/my-project/.opencode/skills"
  ],
  "lastSyncTime": "2026-02-03T10:30:00.000Z",
  "lastSyncMethod": "link",
  "error": null
}
```

#### 智能同步策略

```javascript
async startWatching() {
  const targets = this.getResolvedTargets();
  
  this.watcher = createSyncer(this.skillsDir, targets, {
    preferLink: true,        // 优先符号链接
    fallbackToCopy: true,    // 降级到文件复制
    deleteOrphaned: false,   // 不删除孤立文件
    ignorePatterns: ['**/.*']
  });
  
  const method = await this.watcher.sync();
  
  if (method !== 'link') {
    this.watcher.watch();  // 符号链接模式无需监听
  }
}
```

#### 同步方法检测

| 场景 | 同步方式 | 说明 |
|------|----------|------|
| 目标目录为空 | 符号链接 | 零成本，实时同步 |
| 目标已存在文件 | 文件复制 | 降级方案，保证兼容 |
| 跨文件系统 | 文件复制 | 符号链接不支持 |

---

## API 接口

### 技能管理 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/adminapi/skills` | 获取技能列表（支持过滤、搜索） |
| GET | `/adminapi/skills/:id` | 获取单个技能详情 |
| POST | `/adminapi/skills` | 创建新技能 |
| PUT | `/adminapi/skills/:id` | 更新技能 |
| DELETE | `/adminapi/skills/:id` | 删除技能 |
| POST | `/adminapi/skills/:id/duplicate` | 复制技能 |
| GET | `/adminapi/skills/:id/export` | 导出技能 ZIP |
| POST | `/adminapi/skills/upload` | 上传技能包 |
| POST | `/adminapi/skills/validate` | 验证技能格式 |
| POST | `/adminapi/skills/reload` | 重新加载技能 |

### 同步管理 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/adminapi/skills/sync/config` | 获取同步配置 |
| PUT | `/adminapi/skills/sync/config` | 更新同步配置 |
| POST | `/adminapi/skills/sync/run` | 手动执行同步 |

---

## 数据结构

### 完整技能对象

```javascript
{
  id: "a1b2c3d4",              // 8位哈希ID
  name: "code-review",         // 技能名称
  description: "代码审查助手",  // 描述
  version: "1.0.0",            // 版本
  
  // 权限配置
  allowedTools: ["git-diff"],  // 允许使用的工具
  model: "claude-3-5-sonnet",  // 推荐模型
  context: "fork",             // 上下文模式
  agent: "frontend-developer", // 代理类型
  userInvocable: true,         // 用户可调用
  disableModelInvocation: false, // 禁用模型调用
  
  // 钩子配置
  hooks: {
    PreToolUse: [...],
    PostToolUse: [...],
    Stop: [...]
  },
  
  // 元数据
  type: "custom",              // built-in | custom
  filePath: "/path/to/SKILL.md",
  skillDir: "/path/to/skill/",
  relativePath: "code-review/SKILL.md",
  
  // 内容
  yamlContent: "---\nname: ...\n",
  markdownContent: "# 技能说明...",
  fullContent: "---\n...\n---\n\n# ...",
  
  // 文件列表
  files: [
    { name: "SKILL.md", content: "..." },
    { name: "utils.js", content: "..." }
  ],
  
  updatedAt: "2026-02-03T10:30:00.000Z"
}
```

---

## 同步机制

### 工作流程

```
修改技能内容
    ↓
SkillsManager 更新 SKILL.md
    ↓
文件系统变更监听
    ↓
SkillSyncService 检测变更
    ↓
根据同步方式执行
    ├── 符号链接：无操作（实时生效）
    └── 文件复制：复制变更的文件
    ↓
目标目录更新
    ↓
AI 工具自动检测到变更
```

### 路径变量支持

```json
{
  "targets": [
    "~/.cursor/rules",           // 展开为 /home/user/.cursor/rules
    "$HOME/.claude/skills",      // 展开环境变量
    "$PROJECT_DIR/skills"        // 自定义变量
  ]
}
```

---

## 开发指南

### 创建技能

1. **定义 SKILL.md**

```markdown
---
name: my-skill
description: 我的自定义技能
version: 1.0.0
allowedTools: []
model: claude-3-5-sonnet
---

# 我的技能

技能描述...
```

2. **通过 API 创建**

```bash
curl -X POST http://localhost:5621/adminapi/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-skill",
    "frontmatter": {
      "name": "my-skill",
      "description": "我的自定义技能",
      "version": "1.0.0"
    },
    "markdown": "# 我的技能\n\n技能描述..."
  }'
```

3. **或通过 Web 界面**

访问 `http://localhost:5621/admin` → 技能管理 → 创建技能

### 配置同步

```bash
# 更新同步配置
curl -X PUT http://localhost:5621/adminapi/skills/sync/config \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "targets": [
      "~/.cursor/rules",
      "~/.claude/skills"
    ]
  }'

# 手动执行同步
curl -X POST http://localhost:5621/adminapi/skills/sync/run
```

### 导出技能

```bash
# 通过 API
curl -X GET http://localhost:5621/adminapi/skills/{id}/export \
  --output skill-name.zip

# 或通过 Web 界面
访问 `http://localhost:5621/admin` → 技能管理 → 导出
```

---

## 使用场景

### 1. 个人开发者

```json
{
  "enabled": true,
  "targets": [
    "~/.cursor/rules",
    "~/.claude/skills"
  ]
}
```

- 一处修改，两处同步
- 统一管理个人技能库

### 2. 团队协作

```json
{
  "enabled": true,
  "targets": [
    "~/team-shared/skills",
    "~/.cursor/rules",
    "~/.claude/skills"
  ]
}
```

- 团队共享技能库
- 每个成员自动同步

### 3. 项目隔离

```json
{
  "enabled": true,
  "targets": [
    "~/projects/project-a/.opencode/skills",
    "~/projects/project-b/.claude/skills"
  ]
}
```

- 不同项目使用不同技能集
- 项目技能自动部署

---

## 故障排除

### 同步失败

**症状**: 技能修改后目标目录未更新

**解决方案**:
```bash
# 检查同步配置
curl http://localhost:5621/adminapi/skills/sync/config

# 手动执行同步
curl -X POST http://localhost:5621/adminapi/skills/sync/run

# 查看日志
tail -f ~/.prompt-manager/logs/skill-sync.log
```

### 技能加载失败

**症状**: 技能列表中缺少某些技能

**解决方案**:
```bash
# 重新加载技能
curl -X POST http://localhost:5621/adminapi/skills/reload

# 检查技能文件格式
curl http://localhost:5621/adminapi/skills/validate \
  -H "Content-Type: application/json" \
  -d '{"content": "..."}'
```

### 导入失败

**症状**: 上传技能包后提示错误

**解决方案**:
1. 确认 ZIP 包包含 `SKILL.md` 文件
2. 检查 YAML 前置格式是否正确
3. 验证文件大小不超过限制
4. 查看服务器日志获取详细错误信息

---

## 相关资源

- [Claude Code Skills 文档](https://code.claude.com/docs/zh-CN/skills)
- [技能管理文章](../../技能管理文章.md)
- [技能上传功能](./DEV_SKILL_UPLOAD.md)

---

**维护者**: BeCrafter Team  
**许可证**: MIT