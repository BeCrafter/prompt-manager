# TodoList Tool

基于本地 JSON 文件存储的 TodoList 工具，默认创建会话任务（临时），也可指定项目创建持久化任务。支持快速查询、任务统计、批量操作等功能。

## 功能特性

1. **任务管理** (`add_task`, `update_task`, `complete_task`, `archive_task`)
   - 添加任务（会话任务或项目任务）
   - 更新任务信息
   - 完成任务
   - 归档任务

2. **任务查询** (`list_tasks`)
   - 快速筛选：今日任务、待办、已完成、逾期
   - 按优先级、标签筛选
   - 支持排序和分页

3. **批量操作** (`batch_tasks`)
   - 批量创建、更新、完成、归档任务
   - 支持事务模式（全部成功或全部回滚）

4. **任务排序** (`reorder_tasks`)
   - 调整任务顺序

5. **统计信息** (`get_statistics`)
   - 任务完成率
   - 按优先级统计
   - 按标签统计

6. **项目管理** (`list_projects`)
   - 列出所有项目
   - 查看项目任务统计

## 环境变量配置

工具无需配置环境变量，但支持以下可选环境变量：

- `TODOLIST_SESSION_TTL_DAYS` (可选): 会话任务保留天数，默认 `7`
- `TODOLIST_MAX_ARCHIVED` (可选): 各作用域最多保留归档任务条数，默认 `200`

## 使用方法

### 1. 添加会话任务（临时）

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: add_task
  content: "完成项目文档"
  description: "编写项目README文档"  # 可选
  priority: 3  # 可选，1=低, 2=中, 3=高, 4=紧急
  due_date: "2025-01-15"  # 可选，ISO 8601 或自然语言（如 "tomorrow"）
  tags: ["工作", "文档"]  # 可选
  # 不指定 project_id，创建会话任务
```

### 2. 添加项目任务（持久化）

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: add_task
  content: "实现用户登录功能"
  project_id: "work"  # 指定项目ID，创建项目任务
  priority: 4
  tags: ["开发", "功能"]
```

### 3. 查询任务

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: list_tasks
  quick_filter: "today"  # today, pending, completed, overdue, all
  # 或使用 status: "pending"
  project_id: "work"  # 可选，指定项目ID
  limit: 50  # 可选，默认50
```

### 4. 更新任务

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: update_task
  task_id: "task-uuid"
  content: "更新后的任务内容"  # 可选
  priority: 2  # 可选
  status: "completed"  # 可选
  tags: ["新标签"]  # 可选
```

### 5. 完成任务

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: complete_task
  task_id: "task-uuid"
```

### 6. 批量操作

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: batch_tasks
  project_id: "work"  # 可选
  operations:
    - action: "add"
      content: "任务1"
      priority: 3
    - action: "add"
      content: "任务2"
      priority: 2
    - action: "update"
      task_id: "existing-task-id"
      status: "completed"
  transaction: false  # 可选，是否使用严格事务
```

### 7. 获取统计信息

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: get_statistics
  project_id: "work"  # 可选，不指定则统计会话任务
```

### 8. 列出项目

```yaml
tool: tool://todolist
mode: execute
parameters:
  method: list_projects
```

## 参数说明

### add_task 方法

- `method` (必需): 必须为 `"add_task"`
- `content` (必需): 任务内容
- `description` (可选): 任务描述
- `priority` (可选): 优先级（1=低, 2=中, 3=高, 4=紧急），默认 `2`
- `due_date` (可选): 截止日期（ISO 8601 或自然语言，如 "tomorrow", "in 3 days"）
- `project_id` (可选): 项目ID（不指定则创建会话任务，指定则创建项目任务）
- `tags` (可选): 标签数组
- `sort` (可选): 排序值（默认自动递增）

### list_tasks 方法

- `method` (必需): 必须为 `"list_tasks"`
- `quick_filter` (可选): 快捷筛选（today/pending/completed/overdue/all）
- `status` (可选): 状态筛选（pending/completed/archived/all，与 quick_filter 互斥）
- `project_id` (可选): 项目ID（不指定则查询会话任务）
- `priority` (可选): 优先级筛选（1/2/3/4）
- `tags` (可选): 标签筛选数组
- `sort_by` (可选): 排序方式（sort/created_at/due_date/priority），默认 `created_at`
- `sort_order` (可选): 排序方向（asc/desc），默认 `desc`
- `limit` (可选): 返回数量限制，默认 `50`

### update_task 方法

- `method` (必需): 必须为 `"update_task"`
- `task_id` (必需): 任务ID
- `content` (可选): 任务内容
- `description` (可选): 任务描述
- `priority` (可选): 优先级
- `due_date` (可选): 截止日期
- `status` (可选): 状态（pending/completed/archived）
- `sort` (可选): 排序值
- `tags` (可选): 标签数组

### complete_task 方法

- `method` (必需): 必须为 `"complete_task"`
- `task_id` (必需): 任务ID

### archive_task 方法

- `method` (必需): 必须为 `"archive_task"`
- `task_id` (必需): 任务ID

### batch_tasks 方法

- `method` (必需): 必须为 `"batch_tasks"`
- `operations` (必需): 操作数组，每个元素包含：
  - `action`: 操作类型（add/update/archive/complete）
  - `task_id`: 任务ID（update/archive/complete 需要）
  - 其他参数根据 action 类型而定
- `project_id` (可选): 项目ID（批量操作的项目上下文）
- `transaction` (可选): 是否使用严格事务（全部成功或全部回滚），默认 `false`

### reorder_tasks 方法

- `method` (必需): 必须为 `"reorder_tasks"`
- `task_ids` (必需): 任务ID数组（按新顺序排列）
- `project_id` (可选): 项目ID

### get_statistics 方法

- `method` (必需): 必须为 `"get_statistics"`
- `project_id` (可选): 项目ID（不指定则统计会话任务，传 `null` 则统计所有项目任务）

### list_projects 方法

- `method` (必需): 必须为 `"list_projects"`
- 无需其他参数

## 返回格式

### add_task 返回

```json
{
  "task_id": "uuid",
  "content": "完成项目文档",
  "description": "编写项目README文档",
  "priority": 3,
  "status": "pending",
  "project_id": null,
  "session_id": "session-uuid",
  "sort": 0,
  "tags": ["工作", "文档"],
  "due_date": "2025-01-15",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

### list_tasks 返回

```json
{
  "total": 10,
  "tasks": [
    {
      "task_id": "uuid",
      "content": "完成项目文档",
      "status": "pending",
      "priority": 3,
      "due_date": "2025-01-15",
      "tags": ["工作", "文档"],
      "created_at": "2025-01-01T00:00:00.000Z",
      "updated_at": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

### get_statistics 返回

```json
{
  "total": 20,
  "pending": 10,
  "completed": 8,
  "archived": 2,
  "overdue": 3,
  "completion_rate": 0.4,
  "by_priority": {
    "1": 2,
    "2": 5,
    "3": 10,
    "4": 3
  },
  "by_tag": {
    "工作": 8,
    "文档": 5,
    "开发": 7
  }
}
```

### list_projects 返回

```json
{
  "projects": [
    {
      "project_id": "work",
      "task_count": 10,
      "pending_count": 6,
      "completed_count": 4
    }
  ],
  "current_session": {
    "session_id": "session-uuid",
    "task_count": 5,
    "pending_count": 3,
    "completed_count": 2
  }
}
```

## 错误处理

工具定义了以下业务错误：

- `TASK_NOT_FOUND`: 任务不存在
- `INVALID_PROJECT_ID`: 无效的项目ID
- `DATABASE_ERROR`: 数据存储失败
- `INVALID_DATE_FORMAT`: 日期格式错误
- `INVALID_OPERATION`: 无效的操作类型
- `MISSING_REQUIRED_PARAM`: 缺少必需参数

## 注意事项

1. **服务器同步**: 新添加的工具需要重启服务器才能被加载
2. **会话任务**: 默认创建会话任务（临时），会话断开后数据保留但不关联新会话
3. **项目任务**: 指定 `project_id` 创建项目任务（持久化），跨会话可用
4. **数据隔离**: 会话任务和项目任务完全隔离
5. **自动清理**: 过期会话任务和超量归档任务会自动清理
6. **日期格式**: 支持 ISO 8601 格式（如 "2025-01-15"）或简单自然语言（如 "tomorrow", "in 3 days"）
7. **项目管理**: 项目自动管理，无需手动创建/删除
8. **数据存储**: 任务数据存储在工具目录的 `data/` 子目录下

## 测试步骤

1. **重启服务器**（如果服务器已在运行）

2. **查看工具手册**
   ```yaml
   tool: tool://todolist
   mode: manual
   ```

3. **测试添加会话任务**
   ```yaml
   tool: tool://todolist
   mode: execute
   parameters:
     method: add_task
     content: "测试任务"
     priority: 3
   ```

4. **测试查询任务**
   ```yaml
   tool: tool://todolist
   mode: execute
   parameters:
     method: list_tasks
     quick_filter: "pending"
   ```

5. **测试添加项目任务**
   ```yaml
   tool: tool://todolist
   mode: execute
   parameters:
     method: add_task
     content: "项目任务"
     project_id: "test-project"
   ```

6. **测试获取统计信息**
   ```yaml
   tool: tool://todolist
   mode: execute
   parameters:
     method: get_statistics
   ```

## 开发说明

工具基于纯 JavaScript JSON 文件存储，无需任何原生依赖，遵循 Prompt Manager 工具开发规范：

- 使用 ES6 模块格式 (`export default`)
- 实现必需方法 `execute()`
- 实现推荐方法：`getDependencies()`, `getMetadata()`, `getSchema()`, `getBusinessErrors()`
- 完整的错误处理和日志记录
- 自动数据清理机制
- 符合工具开发指南的所有要求

## 版本历史

- **1.0.0** (2025-01-01): 初始版本
  - 实现任务管理功能
  - 支持会话任务和项目任务
  - 实现快速查询和统计
  - 支持批量操作
  - 自动数据清理

