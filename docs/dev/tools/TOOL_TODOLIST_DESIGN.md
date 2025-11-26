# TodoList 工具设计文档

> **工具名称**：todolist  
> **版本**：1.0.0  
> **设计日期**：2025-01-XX  
> **设计者**：Sean (deepractice.ai)

## 📋 目录

1. [工具定位](#工具定位)
2. [数据模型设计](#数据模型设计)
3. [参数设计](#参数设计)
4. [技术实现规划](#技术实现规划)
5. [业务错误定义](#业务错误定义)
6. [使用场景示例](#使用场景示例)
7. [实现优先级](#实现优先级)

---

## 🎯 工具定位

### 核心定位

- **本地 TodoList 工具**：基于 SQLite 的本地存储，无需网络连接
- **项目分组**：支持多个项目（project），任务按项目分组管理
- **默认收件箱**：默认项目为 "inbox"，简化快速添加任务
- **精简参数设计**：聚焦 TodoList 核心场景，降低使用成本
- **批量操作支持**：支持一次调用完成多个操作，减少模型调用次数
- **快速查询**：支持今日任务、待办、已完成、逾期等快捷筛选

### 与现有工具的差异

| 特性 | Todoist MCP | 本工具 |
|------|------------|--------|
| 存储 | 云端（Todoist API） | 本地（SQLite） |
| 作用域 | 项目/标签 | 项目（project） |
| 参数复杂度 | 高（20+ 参数） | 低（核心 5-6 个） |
| 依赖 | 外部 API | 本地数据库 |
| 共享机制 | 云端同步 | 项目内共享 |
| 批量操作 | 不支持 | 支持 |
| 默认项目 | 无 | inbox |

---

## 📊 数据模型设计

### 数据库表结构

```sql
-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,              -- UUID
  content TEXT NOT NULL,            -- 任务内容
  description TEXT,                  -- 任务描述（可选）
  status TEXT DEFAULT 'pending',    -- pending | completed | archived
  priority INTEGER DEFAULT 2,       -- 1=低, 2=中, 3=高, 4=紧急
  project_id TEXT,                  -- 项目ID（NULL表示会话任务，有值表示项目任务）
  session_id TEXT,                  -- 会话ID（NULL表示项目任务，有值表示会话任务）
  sort INTEGER DEFAULT 0,           -- 排序值（数值越大越靠前）
  tags TEXT,                        -- 标签（JSON数组字符串）
  due_date TEXT,                    -- 截止日期 (ISO 8601)
  created_at TEXT NOT NULL,         -- 创建时间 (ISO 8601)
  updated_at TEXT NOT NULL,         -- 更新时间 (ISO 8601)
  completed_at TEXT                 -- 完成时间 (ISO 8601)
);

-- 索引
CREATE INDEX idx_project ON tasks(project_id);
CREATE INDEX idx_session ON tasks(session_id);
CREATE INDEX idx_status ON tasks(status);
CREATE INDEX idx_due_date ON tasks(due_date);
CREATE INDEX idx_sort_project ON tasks(project_id, sort);  -- 项目任务排序索引
CREATE INDEX idx_sort_session ON tasks(session_id, sort);  -- 会话任务排序索引
```

**数据存储规则**：
- **会话任务**：`project_id = NULL`, `session_id = 当前会话ID`
- **项目任务**：`project_id = 项目名`, `session_id = NULL`
- 两者互斥，不能同时有值

### 字段说明

#### 核心字段

- **id**：任务唯一标识符，使用 UUID v4 生成
- **content**：任务内容（必需）
- **description**：任务详细描述（可选）
- **status**：任务状态
  - `pending`：待处理（默认）
  - `completed`：已完成
  - `archived`：已归档（不显示在列表中，但保留记录）

#### 优先级字段

- **priority**：任务优先级
  - `1`：低优先级
  - `2`：中优先级（默认）
  - `3`：高优先级
  - `4`：紧急

#### 任务类型字段

- **project_id**：项目标识符
  - `NULL`：表示会话任务（临时，会话断开后失效）
  - 有值：表示项目任务（持久化，跨会话可用）
  - 用户自定义项目：如 `work`、`personal`、`prompt-manager-v2` 等
  - 项目自动创建：首次创建任务时自动创建项目
  - 项目自动删除：项目下没有任务时自动删除

- **session_id**：会话标识符
  - `NULL`：表示项目任务（持久化）
  - 有值：表示会话任务（临时）
  - 会话ID获取策略：
    1. 优先从 `api.context.sessionId` 获取
    2. 若无，生成临时会话ID并存储到 `api.storage`
    3. 存储键：`todolist_session_id`

**任务类型说明**：
- **会话任务**（默认）：不指定 `project_id` 时，自动使用当前会话ID创建会话任务
  - 特点：临时性，会话断开后数据失效（但数据库记录保留，只是不再关联到新会话）
  - 用途：快速记录临时待办事项
- **项目任务**：指定 `project_id` 时，创建项目任务
  - 特点：持久化，跨会话可用
  - 用途：长期项目任务管理

#### 排序和标签字段

- **sort**：排序值
  - 数值越大，排序越靠前（默认降序）
  - 会话任务：在同一会话内独立排序
  - 项目任务：在同一项目内独立排序
  - 新建任务时自动分配（最大值+1）
- **tags**：标签数组
  - 存储格式：JSON 数组字符串（如 `["urgent", "bug", "frontend"]`）
  - 支持多标签
  - 查询时使用 JSON 函数或字符串匹配

#### 时间字段

- **due_date**：截止日期（ISO 8601 格式或自然语言）
- **created_at**：创建时间（ISO 8601）
- **updated_at**：更新时间（ISO 8601）
- **completed_at**：完成时间（ISO 8601，仅 completed 状态有值）

---

## 🔧 参数设计

### 方法列表

1. **add_task** - 添加任务（核心）
2. **list_tasks** - 查询任务列表（核心，支持快捷筛选）
3. **update_task** - 更新任务
4. **complete_task** - 完成任务（核心）
5. **archive_task** - 归档任务（替代删除）
6. **batch_tasks** - 批量操作（辅助功能）
7. **reorder_tasks** - 调整排序（辅助功能）
8. **get_statistics** - 获取统计信息（新增）
9. **list_projects** - 列出项目（新增）

### 1. add_task - 添加任务

**用途**：添加单个任务（核心方法）

**参数**：
```javascript
{
  content: string,           // 必需：任务内容
  description?: string,      // 可选：任务描述
  priority?: 1|2|3|4,        // 可选：优先级（默认2）
  due_date?: string,         // 可选：截止日期（ISO 8601 或自然语言）
  project_id?: string,       // 可选：项目ID（不指定则创建会话任务，指定则创建项目任务）
  sort?: number,            // 可选：排序值（默认自动递增）
  tags?: string[]            // 可选：标签数组（如 ["urgent", "bug"]）
}
```

**任务类型判断**：
- 不指定 `project_id`：创建会话任务（`project_id = NULL`, `session_id = 当前会话ID`）
- 指定 `project_id`：创建项目任务（`project_id = 指定值`, `session_id = NULL`）

**返回值**：
```javascript
{
  task_id: string,           // 任务ID
  content: string,
  description?: string,
  priority: number,
  status: 'pending',
  project_id: string|null,    // NULL 表示会话任务
  session_id: string|null,   // NULL 表示项目任务
  sort: number,
  tags?: string[],
  due_date?: string,
  created_at: string
}
```

### 2. list_tasks - 查询任务

**用途**：查询任务列表，支持多种筛选和排序

**参数**：
```javascript
{
  project_id?: string,       // 可选：项目ID（不指定则查询当前会话任务，指定则查询项目任务）
  quick_filter?: 'today'|'pending'|'completed'|'overdue'|'all',  // 可选：快捷筛选
  status?: 'pending'|'completed'|'archived'|'all',  // 可选：状态筛选（与 quick_filter 互斥）
  priority?: 1|2|3|4,        // 可选：优先级筛选
  tags?: string[],           // 可选：标签筛选（包含任一标签即匹配）
  sort_by?: 'sort'|'created_at'|'due_date'|'priority',  // 可选：排序方式（默认created_at）
  sort_order?: 'asc'|'desc',  // 可选：排序方向（默认desc）
  limit?: number             // 可选：返回数量限制（默认50）
}
```

**查询类型判断**：
- 不指定 `project_id`：查询当前会话的任务（`session_id = 当前会话ID`）
- 指定 `project_id`：查询指定项目的任务（`project_id = 指定值`）

**快捷筛选说明**：
- `today`：今日任务（due_date = today && status = pending）
- `pending`：待办任务（status = pending）
- `completed`：已完成任务（status = completed）
- `overdue`：逾期任务（due_date < today && status = pending）
- `all`：所有任务（不筛选状态）

**返回值**：
```javascript
{
  total: number,             // 总任务数
  tasks: [
    {
      task_id: string,
      content: string,
      description?: string,
      status: string,
      priority: number,
      project_id: string|null,    // NULL 表示会话任务
      session_id: string|null,    // NULL 表示项目任务
      sort: number,
      tags?: string[],
      due_date?: string,
      created_at: string,
      updated_at: string,
      completed_at?: string
    }
    // ...
  ]
}
```

### 3. update_task - 更新任务

**用途**：更新单个任务的属性

**参数**：
```javascript
{
  task_id: string,           // 必需：任务ID
  content?: string,          // 可选：更新内容
  description?: string,      // 可选：更新描述
  priority?: 1|2|3|4,       // 可选：更新优先级
  due_date?: string,         // 可选：更新截止日期
      status?: 'pending'|'completed'|'archived',  // 可选：更新状态
  sort?: number,            // 可选：更新排序值
  tags?: string[]            // 可选：更新标签（替换整个标签数组）
}
```

**返回值**：
```javascript
{
  task_id: string,
  // ... 更新后的任务信息
}
```

### 4. complete_task - 完成任务

**用途**：标记任务为已完成

**参数**：
```javascript
{
  task_id: string            // 必需：任务ID
}
```

**返回值**：
```javascript
{
  task_id: string,
  status: 'completed',
  completed_at: string
}
```

### 5. archive_task - 归档任务

**用途**：归档任务（不显示在列表中，但保留记录）

**参数**：
```javascript
{
  task_id: string            // 必需：任务ID
}
```

**返回值**：
```javascript
{
  task_id: string,
  status: 'archived',
  updated_at: string
}
```

### 6. batch_tasks - 批量操作

**用途**：一次调用完成多个操作（添加、更新、归档、完成），减少模型调用次数

**参数**：
```javascript
{
  project_id?: string,       // 可选：项目ID（不指定则操作当前会话任务，指定则操作项目任务）
  operations: [               // 必需：操作数组
    {
      action: 'add'|'update'|'archive'|'complete',  // 操作类型
      // add 操作的参数
      task_id?: string,       // update/archive/complete 时必需
      content?: string,       // add/update 时使用
      description?: string,
      priority?: 1|2|3|4,
      due_date?: string,
      sort?: number,
      tags?: string[],
      status?: 'pending'|'completed'|'archived'
    },
    // ... 更多操作
  ],
  transaction?: boolean     // 可选：是否使用严格事务（默认false，部分成功模式）
}
```

**返回值**：
```javascript
{
  success: true,
  total: number,             // 总操作数
  succeeded: number,         // 成功数
  failed: number,           // 失败数
  results: [                // 每个操作的结果
    {
      index: number,        // 操作索引
      action: string,       // 操作类型
      success: boolean,     // 是否成功
      task_id?: string,     // 成功时返回任务ID（create/update/complete）
      error?: string        // 失败时的错误信息
    }
    // ...
  ]
}
```

**操作类型说明**：

- **add**：添加任务
  - 必需：`content`
  - 可选：`description`, `priority`, `due_date`, `sort`, `tags`, `project_id`
- **update**：更新任务
  - 必需：`task_id`
  - 可选：`content`, `description`, `priority`, `due_date`, `sort`, `tags`, `status`, `project_id`
- **archive**：归档任务
  - 必需：`task_id`
- **complete**：完成任务
  - 必需：`task_id`

**事务模式**：

- **部分成功模式**（`transaction: false`，默认）：
  - 逐个执行操作，记录每个操作的结果
  - 一个操作失败不影响其他操作
  - 返回详细的操作结果，包括成功和失败的

- **严格事务模式**（`transaction: true`）：
  - 使用数据库事务，全部成功或全部失败
  - 任何一个操作失败，所有操作回滚
  - 适合需要强一致性的场景

### 7. reorder_tasks - 调整排序

**用途**：批量调整任务的排序值（用于拖拽排序等场景）

**参数**：
```javascript
{
  project_id?: string,       // 可选：项目ID（不指定则调整当前会话任务，指定则调整项目任务）
  task_ids: string[]         // 必需：任务ID数组（按新顺序排列，sort值自动分配）
}
```

**返回值**：
```javascript
{
  success: true,
  total: number,             // 调整的任务数
  task_ids: string[]        // 调整后的任务ID列表（按新顺序）
}
```

**排序值分配策略**：
- 按 `task_ids` 数组顺序，从高到低分配排序值
- 第一个任务排序值最大，最后一个最小
- 例如：3个任务 -> sort值分配为 [2, 1, 0]

### 8. get_statistics - 获取统计信息

**用途**：获取任务的统计信息（完成率、按优先级统计、按标签统计等）

**参数**：
```javascript
{
  project_id?: string|null   // 可选：项目ID（不指定则统计当前会话任务，指定则统计项目任务，null 表示所有项目任务）
}
```

**统计范围说明**：
- 不指定 `project_id`：统计当前会话的任务
- 指定 `project_id`：统计指定项目的任务
- `project_id = null`：统计所有项目任务（不包括会话任务）

**返回值**：
```javascript
{
  total: number,             // 总任务数
  pending: number,           // 待办任务数
  completed: number,         // 已完成任务数
  archived: number,          // 已归档任务数
  overdue: number,           // 逾期任务数
  completion_rate: number,   // 完成率（0-1）
  by_priority: {              // 按优先级统计
    1: number,               // 低优先级任务数
    2: number,               // 中优先级任务数
    3: number,               // 高优先级任务数
    4: number                // 紧急任务数
  },
  by_tag: {                  // 按标签统计
    [tag: string]: number    // 每个标签的任务数
  }
}
```

### 9. list_projects - 列出项目

**用途**：列出所有项目（从 tasks 表中去重 project_id）

**参数**：
```javascript
{}  // 无参数
```

**返回值**：
```javascript
{
  projects: [
    {
      project_id: string,     // 项目ID
      task_count: number,    // 任务数量（仅统计 pending 和 completed）
      pending_count: number, // 待办任务数
      completed_count: number // 已完成任务数
    }
    // ...
  ],
  current_session: {          // 当前会话信息
    session_id: string,       // 会话ID
    task_count: number,       // 会话任务数量
    pending_count: number,    // 待办任务数
    completed_count: number   // 已完成任务数
  }
}
```

**说明**：
- 只列出项目任务的项目（`project_id IS NOT NULL`）
- 不包括会话任务（会话任务在 `current_session` 中单独显示）
- 项目自动创建：首次创建任务时自动创建项目
- 项目自动删除：项目下没有任务时自动删除（不显示在列表中）

---

## 🛠️ 技术实现规划

### 依赖管理

```javascript
getDependencies() {
  return {
    'better-sqlite3': '^9.0.0',  // SQLite 数据库（同步 API，适合工具场景）
    'uuid': '^9.0.0'             // 生成任务ID（UUID v4）
  };
}
```

### 数据库初始化

- **数据库文件位置**：`~/.prompt-manager/toolbox/todolist/tasks.db`
- **首次执行时**：自动创建表结构和索引
- **使用 `better-sqlite3`**：同步 API，适合工具场景，无需异步处理

### 会话和项目管理策略

#### 会话任务（默认）

- **默认行为**：不指定 `project_id` 时，自动创建会话任务
- **会话ID获取**：
  1. 优先从 `api.context.sessionId` 获取
  2. 若无，生成临时会话ID并存储到 `api.storage`
  3. 存储键：`todolist_session_id`
- **数据生命周期**：会话断开后，数据保留在数据库但不再关联到新会话（实际失效）
- **用途**：快速记录临时待办事项，会话内共享

#### 项目任务

- **创建方式**：指定 `project_id` 时，创建项目任务
- **项目自动管理**：
  1. **自动创建**：首次创建任务时，如果项目不存在，自动创建项目
  2. **自动删除**：项目下没有任务时（包括 archived 状态），自动从列表中移除
- **项目格式**：建议使用字母数字+连字符（如 `work`、`personal`、`prompt-manager-v2`）
- **数据生命周期**：持久化，跨会话可用
- **用途**：长期项目任务管理

### 排序值维护策略

#### 自动分配

```javascript
// 获取下一个排序值（自动递增）
async getNextSort(projectId, sessionId) {
  if (projectId) {
    // 项目任务
    const result = db.prepare(`
      SELECT MAX(sort) as max_sort 
      FROM tasks 
      WHERE project_id = ? AND session_id IS NULL
    `).get(projectId);
    return (result.max_sort ?? -1) + 1;
  } else {
    // 会话任务
    const result = db.prepare(`
      SELECT MAX(sort) as max_sort 
      FROM tasks 
      WHERE session_id = ? AND project_id IS NULL
    `).get(sessionId);
    return (result.max_sort ?? -1) + 1;
  }
}
```

#### 手动指定

- 用户可以在创建或更新任务时指定 `sort` 值
- 支持任意整数值（正数、负数、零）
- 数值越大，排序越靠前（默认降序）

### 标签存储和查询

#### 存储格式

- 使用 JSON 数组字符串：`["urgent", "bug", "frontend"]`
- 空标签存储为 `null`

#### 查询实现

**方案A：使用 JSON 函数（SQLite 3.38+）**
```sql
-- 查询包含 "urgent" 标签的项目任务
SELECT * FROM tasks 
WHERE json_extract(tags, '$') LIKE '%"urgent"%'
  AND project_id = ? AND session_id IS NULL;

-- 查询包含 "urgent" 标签的会话任务
SELECT * FROM tasks 
WHERE json_extract(tags, '$') LIKE '%"urgent"%'
  AND session_id = ? AND project_id IS NULL;
```

**方案B：字符串匹配（兼容旧版本）**
```sql
-- 查询包含 "urgent" 标签的项目任务
SELECT * FROM tasks 
WHERE tags LIKE '%"urgent"%'
  AND project_id = ? AND session_id IS NULL;

-- 查询包含 "urgent" 标签的会话任务
SELECT * FROM tasks 
WHERE tags LIKE '%"urgent"%'
  AND session_id = ? AND project_id IS NULL;
```

**实现策略**：
1. 检测 SQLite 版本是否支持 JSON 函数
2. 支持则使用 JSON 函数，否则使用字符串匹配
3. 标签查询使用 `LIKE` 匹配，支持多标签筛选（包含任一标签即匹配）

### 自然语言日期解析

- **支持格式**：
  - ISO 8601：`2025-01-15`、`2025-01-15T10:00:00Z`
  - 自然语言：`tomorrow`、`next Monday`、`in 3 days`
- **实现方式**：使用简单规则解析（不引入复杂库）
- **解析规则**：
  - `tomorrow` -> 明天
  - `next Monday` -> 下周一
  - `in N days` -> N天后

### 批量操作实现

#### 部分成功模式（默认）

```javascript
async batchOperationsPartial(params) {
  const results = [];
  let succeeded = 0;
  let failed = 0;
  
  for (let i = 0; i < params.operations.length; i++) {
    const op = params.operations[i];
    try {
      const result = await this.executeSingleOperation(op, params.project_id, params.session_id);
      results.push({
        index: i,
        action: op.action,
        success: true,
        task_id: result.task_id,
        error: null
      });
      succeeded++;
    } catch (error) {
      results.push({
        index: i,
        action: op.action,
        success: false,
        task_id: op.task_id || null,
        error: error.message
      });
      failed++;
    }
  }
  
  return {
    success: true,
    total: params.operations.length,
    succeeded,
    failed,
    results
  };
}
```

#### 严格事务模式

```javascript
async batchOperationsWithTransaction(params) {
  const db = this.getDatabase();
  
  return db.transaction(() => {
    const results = [];
    
    for (const op of params.operations) {
      const result = this.executeSingleOperation(op, params.project_id, params.session_id);
      results.push({
        index: results.length,
        action: op.action,
        success: true,
        task_id: result.task_id,
        error: null
      });
    }
    
    return {
      success: true,
      total: params.operations.length,
      succeeded: params.operations.length,
      failed: 0,
      results
    };
  })();
}
```

---

## ⚠️ 业务错误定义

```javascript
getBusinessErrors() {
  return [
    {
      code: 'TASK_NOT_FOUND',
      description: '任务不存在',
      match: /任务不存在|Task not found/i,
      solution: '请检查任务ID是否正确',
      retryable: false
    },
    {
      code: 'INVALID_SCOPE',
      description: '无效的作用域',
      match: /无效的作用域|Invalid scope/i,
      solution: 'project_id 格式不正确，请使用字母数字和连字符（如 work、personal）。不指定 project_id 则创建会话任务',
      retryable: false
    },
    {
      code: 'INVALID_SCOPE_ID',
      description: '无效的作用域ID',
      match: /无效的作用域ID|Invalid scope_id/i,
      solution: '项目ID格式不正确，请使用字母数字和连字符（如 prompt-manager-v2）',
      retryable: false
    },
    {
      code: 'DATABASE_ERROR',
      description: '数据库操作失败',
      match: /database|SQLite|数据库/i,
      solution: '请检查数据库文件权限，或查看日志获取详细信息',
      retryable: true
    },
    {
      code: 'INVALID_DATE_FORMAT',
      description: '日期格式错误',
      match: /日期格式|date format/i,
      solution: '请使用 ISO 8601 格式（如 2025-01-15）或自然语言（如 tomorrow）',
      retryable: false
    },
    {
      code: 'INVALID_OPERATION',
      description: '无效的操作类型',
      match: /无效的操作|Invalid operation/i,
      solution: '操作类型必须是 add、update、archive 或 complete',
      retryable: false
    },
    {
      code: 'MISSING_REQUIRED_PARAM',
      description: '缺少必需参数',
      match: /缺少必需参数|Missing required/i,
      solution: '请检查操作参数，确保必需参数已提供',
      retryable: false
    }
  ];
}
```

---

## 📝 使用场景示例

### 场景1：创建带标签的任务

```yaml
# 场景1a：创建会话任务（默认，不指定 project_id）
tool: tool://todolist
mode: execute
parameters:
  method: add_task
  content: "临时记录：检查代码"
  tags: ["quick"]
  priority: 2

# 场景1b：创建项目任务（指定 project_id）
tool: tool://todolist
mode: execute
parameters:
  method: add_task
  content: "修复登录bug"
  tags: ["bug", "urgent", "frontend"]
  priority: 4
  project_id: "prompt-manager-v2"
```

### 场景2：查询会话任务（默认）

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: list_tasks
  quick_filter: pending
```

### 场景3：查询项目任务

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: list_tasks
  project_id: "prompt-manager-v2"
  quick_filter: pending
  tags: ["bug"]
  sort_by: priority
  sort_order: desc
```

### 场景4：快速查询今日任务

```yaml
# 查询当前会话的今日任务
tool: tool://todolist
mode: execute
parameters:
  method: list_tasks
  quick_filter: today

# 查询项目的今日任务
tool: tool://todolist
mode: execute
parameters:
  method: list_tasks
  project_id: "work"
  quick_filter: today
```

### 场景5：批量添加任务

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: batch_tasks
  project_id: "prompt-manager-v2"
  operations:
    - action: add
      content: "设计数据库表结构"
      priority: 3
      tags: ["design", "database"]
    - action: add
      content: "实现任务创建接口"
      priority: 4
      tags: ["backend", "api"]
    - action: add
      content: "编写单元测试"
      priority: 2
      tags: ["test"]
```

### 场景6：混合批量操作（典型场景）

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: batch_tasks
  project_id: "prompt-manager-v2"
  operations:
    - action: add
      content: "新增批量操作接口"
      priority: 4
    - action: update
      task_id: "task-123"
      status: completed
    - action: archive
      task_id: "task-456"
    - action: update
      task_id: "task-789"
      sort: 100
      tags: ["urgent"]
```

### 场景7：调整任务顺序

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: reorder_tasks
  project_id: "prompt-manager-v2"
  task_ids: ["task-1", "task-3", "task-2"]  # 新顺序
```

### 场景8：获取统计信息

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: get_statistics
  project_id: "prompt-manager-v2"
```

### 场景9：列出所有项目

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: list_projects
```

---

## 🎯 实现优先级

### 阶段一（MVP）

1. ✅ 数据库初始化与表结构创建
2. ✅ `add_task` - 添加任务（支持会话任务和项目任务）
3. ✅ `list_tasks` - 查询任务（基础筛选）
4. ✅ 会话任务支持（默认行为）
5. ✅ 排序值自动分配

### 阶段二

6. ✅ `update_task` - 更新任务
7. ✅ `complete_task` - 完成任务
8. ✅ `archive_task` - 归档任务
9. ✅ 项目任务支持（持久化）
10. ✅ 项目自动管理（创建/删除）
11. ✅ 优先级与状态筛选
12. ✅ 标签存储和查询
13. ✅ 快捷筛选（today、pending、completed、overdue）

### 阶段三

13. ✅ `batch_tasks` - 批量操作（部分成功模式）
14. ✅ `batch_tasks` - 严格事务模式
15. ✅ `reorder_tasks` - 调整排序
16. ✅ `get_statistics` - 获取统计信息
17. ✅ `list_projects` - 列出项目
18. ✅ 自然语言日期解析增强

### 阶段四（可选）

19. 数据导出功能（JSON、CSV）
20. 任务关联功能（父子任务、依赖关系）

---

## 📚 工具元数据

```javascript
getMetadata() {
  return {
    id: 'todolist',
    name: 'TodoList',
    description: '基于 SQLite 的本地 TodoList 工具，默认创建会话任务（临时），也可指定项目创建持久化任务。支持快速查询、任务统计等功能，支持批量操作，减少模型调用次数。',
    version: '1.0.0',
    category: 'utility',
    tags: ['todo', 'todolist', 'task', 'management', 'sqlite', 'batch'],
    scenarios: [
      '快速添加会话任务（临时待办）',
      '创建项目任务（持久化）',
      '查询今日任务、待办、已完成',
      '批量创建和更新任务',
      '按标签和优先级筛选任务',
      '查看任务统计信息',
      '跨会话管理项目任务'
    ],
    limitations: [
      '仅支持本地存储，不支持云端同步',
      '会话任务在会话断开后失效（数据保留但不关联新会话）',
      '项目自动管理，无需手动创建/删除',
      '自然语言日期解析能力有限',
      '标签查询使用字符串匹配，性能略低于关联表'
    ]
  };
}
```

---

## 🔍 设计决策总结

### 为什么选择 SQLite？

- ✅ 本地存储，无需网络连接
- ✅ 轻量级，适合工具场景
- ✅ 支持事务和索引，性能好
- ✅ `better-sqlite3` 同步 API，代码简单

### 为什么支持会话任务和项目任务？

- ✅ **会话任务（默认）**：快速记录临时待办，符合对话场景
- ✅ **项目任务（可选）**：持久化任务管理，跨会话可用
- ✅ **灵活切换**：不指定 project_id 就是会话任务，指定就是项目任务
- ✅ **数据隔离**：会话任务和项目任务完全隔离，互不干扰

### 为什么使用 archived 而不是 deleted？

- ✅ TodoList 通常不直接删除任务，而是归档
- ✅ 归档保留历史记录，便于追溯
- ✅ 符合用户使用习惯

### 为什么使用 sort 字段而不是 position？

- ✅ `sort` 语义更清晰，表示排序用途
- ✅ 支持任意数值，不局限于连续整数
- ✅ 扩展性好，未来可实现更复杂的排序逻辑

### 为什么标签使用 JSON 数组而不是关联表？

- ✅ 简单高效，单表查询
- ✅ 满足工具场景需求
- ✅ 易于序列化/反序列化
- ✅ 如果未来需要复杂标签功能，可迁移到关联表

### 为什么支持批量操作？

- ✅ 减少模型调用次数，提高效率
- ✅ 减少网络往返和日志开销
- ✅ 支持事务，保证数据一致性
- ✅ 更符合实际使用场景

---

## 📖 参考资源

- **工具开发规范**：`docs/dev/TOOL_DEVELOPMENT_GUIDE_FOR_AI.md`
- **系统架构文档**：`docs/dev/TOOL_SANDBOX_DESIGN.md`
- **参考实现**：
  - [Todoist MCP Server](https://github.com/abhiz123/todoist-mcp-server)
  - [Todoist MCP Server Extended](https://github.com/Chrusic/todoist-mcp-server-extended)

---

**文档版本**：1.0.0  
**最后更新**：2025-01-XX  
**维护者**：Sean (deepractice.ai)

