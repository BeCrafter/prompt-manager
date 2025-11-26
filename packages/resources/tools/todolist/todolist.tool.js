/**
 * TodoList Tool - 基于 SQLite 的本地 TodoList 工具
 * 
 * 核心功能：
 * - 支持会话任务（临时，默认）和项目任务（持久化）
 * - 快速查询：今日任务、待办、已完成、逾期
 * - 批量操作：减少模型调用次数
 * - 任务统计：完成率、按优先级/标签统计
 * 
 * 设计理念：
 * - 默认创建会话任务，快速记录临时待办
 * - 指定 project_id 创建项目任务，跨会话可用
 * - 数据隔离：会话任务和项目任务完全隔离
 */

import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export default {
  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      'better-sqlite3': '^11.7.0',  // SQLite 数据库（同步 API）
      'uuid': '^9.0.0'             // 生成任务ID（UUID v4）
    };
  },

  /**
   * 获取工具元信息
   */
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
  },

  /**
   * 获取参数 Schema
   */
  getSchema() {
    return {
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            description: '操作方法',
            enum: [
              'add_task',
              'list_tasks',
              'update_task',
              'complete_task',
              'archive_task',
              'batch_tasks',
              'reorder_tasks',
              'get_statistics',
              'list_projects'
            ]
          },
          // add_task 参数
          content: { type: 'string', description: '任务内容' },
          description: { type: 'string', description: '任务描述（可选）' },
          priority: { type: 'number', enum: [1, 2, 3, 4], description: '优先级：1=低, 2=中, 3=高, 4=紧急' },
          due_date: { type: 'string', description: '截止日期（ISO 8601 或自然语言）' },
          project_id: { type: 'string', description: '项目ID（不指定则创建会话任务，指定则创建项目任务）' },
          sort: { type: 'number', description: '排序值（默认自动递增）' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
          // list_tasks 参数
          quick_filter: { type: 'string', enum: ['today', 'pending', 'completed', 'overdue', 'all'], description: '快捷筛选' },
          status: { type: 'string', enum: ['pending', 'completed', 'archived', 'all'], description: '状态筛选（与 quick_filter 互斥）' },
          sort_by: { type: 'string', enum: ['sort', 'created_at', 'due_date', 'priority'], description: '排序方式（默认created_at）' },
          sort_order: { type: 'string', enum: ['asc', 'desc'], description: '排序方向（默认desc）' },
          limit: { type: 'number', description: '返回数量限制（默认50）' },
          // update_task 参数
          task_id: { type: 'string', description: '任务ID' },
          // batch_tasks 参数
          operations: {
            type: 'array',
            description: '操作数组',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['add', 'update', 'archive', 'complete'] },
                task_id: { type: 'string' },
                content: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'number', enum: [1, 2, 3, 4] },
                due_date: { type: 'string' },
                sort: { type: 'number' },
                tags: { type: 'array', items: { type: 'string' } },
                status: { type: 'string', enum: ['pending', 'completed', 'archived'] },
                project_id: { type: 'string' }
              }
            }
          },
          transaction: { type: 'boolean', description: '是否使用严格事务（默认false）' },
          // reorder_tasks 参数
          task_ids: { type: 'array', items: { type: 'string' }, description: '任务ID数组（按新顺序排列）' }
        },
        required: ['method']
      },
      environment: {
        type: 'object',
        properties: {},
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
        code: 'TASK_NOT_FOUND',
        description: '任务不存在',
        match: /任务不存在|Task not found/i,
        solution: '请检查任务ID是否正确',
        retryable: false
      },
      {
        code: 'INVALID_PROJECT_ID',
        description: '无效的项目ID',
        match: /无效的项目|Invalid project_id/i,
        solution: '项目ID格式不正确，请使用字母数字和连字符（如 work、personal）。不指定 project_id 则创建会话任务',
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
  },

  /**
   * 执行工具
   */
  async execute(params) {
    const { api } = this;
    
    api?.logger?.info('TodoList 工具执行开始', { 
      method: params.method,
      tool: this.__toolName
    });
    
    try {
      // 初始化数据库
      const db = await this.initializeDatabase();
      
      // 根据方法路由到对应的处理函数
      switch (params.method) {
        case 'add_task':
          return await this.addTask(db, params);
        case 'list_tasks':
          return await this.listTasks(db, params);
        case 'update_task':
          return await this.updateTask(db, params);
        case 'complete_task':
          return await this.completeTask(db, params);
        case 'archive_task':
          return await this.archiveTask(db, params);
        case 'batch_tasks':
          return await this.batchTasks(db, params);
        case 'reorder_tasks':
          return await this.reorderTasks(db, params);
        case 'get_statistics':
          return await this.getStatistics(db, params);
        case 'list_projects':
          return await this.listProjects(db, params);
        default:
          throw new Error(`不支持的方法: ${params.method}`);
      }
    } catch (error) {
      api?.logger?.error('TodoList 工具执行失败', { 
        error: error.message,
        stack: error.stack,
        method: params.method
      });
      throw error;
    }
  },

  /**
   * 初始化数据库
   */
  async initializeDatabase() {
    const { api } = this;
    const DatabaseModule = await this.importToolModule('better-sqlite3');
    
    // 数据库文件路径
    const dbPath = path.join(this.__toolDir, 'tasks.db');
    
    // better-sqlite3 可能是 default 导出或直接导出
    const Database = DatabaseModule.default || DatabaseModule;
    
    // 打开数据库
    const db = new Database(dbPath);
    
    // 创建表结构
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 2,
        project_id TEXT,
        session_id TEXT,
        sort INTEGER DEFAULT 0,
        tags TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_session ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_sort_project ON tasks(project_id, sort);
      CREATE INDEX IF NOT EXISTS idx_sort_session ON tasks(session_id, sort);
    `);
    
    api?.logger?.info('数据库初始化完成', { dbPath });
    
    return db;
  },

  /**
   * 获取当前会话ID
   */
  async getCurrentSessionId() {
    const { api } = this;
    
    // 优先从 api.context.sessionId 获取
    if (api?.context?.sessionId) {
      return api.context.sessionId;
    }
    
    // 从 storage 获取已存储的会话ID
    const storedSessionId = api?.storage?.getItem('todolist_session_id');
    if (storedSessionId) {
      return storedSessionId;
    }
    
    // 生成新的会话ID
    const newSessionId = randomUUID();
    
    // 存储到 storage
    if (api?.storage) {
      api.storage.setItem('todolist_session_id', newSessionId);
    }
    
    return newSessionId;
  },

  /**
   * 解析日期（支持 ISO 8601 和简单自然语言）
   */
  parseDate(dateString) {
    if (!dateString) return null;
    
    // ISO 8601 格式
    const isoDate = new Date(dateString);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString().split('T')[0];
    }
    
    // 简单自然语言解析
    const today = new Date();
    const lower = dateString.toLowerCase().trim();
    
    if (lower === 'today' || lower === '今天') {
      return today.toISOString().split('T')[0];
    }
    if (lower === 'tomorrow' || lower === '明天') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    if (lower.startsWith('in ')) {
      const match = lower.match(/in (\d+) days?/);
      if (match) {
        const days = parseInt(match[1], 10);
        const future = new Date(today);
        future.setDate(future.getDate() + days);
        return future.toISOString().split('T')[0];
      }
    }
    
    // 无法解析，返回原值
    return dateString;
  },

  /**
   * 获取下一个排序值
   */
  getNextSort(db, projectId, sessionId) {
    if (projectId) {
      // 项目任务
      const result = db.prepare(`
        SELECT MAX(sort) as max_sort 
        FROM tasks 
        WHERE project_id = ? AND session_id IS NULL
      `).get(projectId);
      return (result?.max_sort ?? -1) + 1;
    } else {
      // 会话任务
      const result = db.prepare(`
        SELECT MAX(sort) as max_sort 
        FROM tasks 
        WHERE session_id = ? AND project_id IS NULL
      `).get(sessionId);
      return (result?.max_sort ?? -1) + 1;
    }
  },

  /**
   * 检查 JSON 支持
   */
  checkJsonSupport(db) {
    try {
      db.prepare("SELECT json('[\"test\"]')").get();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 标签查询条件
   */
  buildTagCondition(db, tags, projectId, sessionId) {
    if (!tags || tags.length === 0) return '';
    
    const hasJson = this.checkJsonSupport(db);
    const conditions = tags.map(tag => {
      const escapedTag = `%"${tag}"%`;
      if (hasJson) {
        return `json_extract(tags, '$') LIKE '${escapedTag}'`;
      } else {
        return `tags LIKE '${escapedTag}'`;
      }
    });
    
    return `AND (${conditions.join(' OR ')})`;
  },

  /**
   * 任务对象转换（数据库行 -> 返回对象）
   */
  taskRowToObject(row) {
    return {
      task_id: row.id,
      content: row.content,
      description: row.description || undefined,
      status: row.status,
      priority: row.priority,
      project_id: row.project_id || null,
      session_id: row.session_id || null,
      sort: row.sort,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      due_date: row.due_date || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at || undefined
    };
  },

  /**
   * 添加任务
   */
  async addTask(db, params) {
    const { api } = this;
    
    if (!params.content) {
      throw new Error('缺少必需参数: content');
    }
    
    const taskId = randomUUID();
    const now = new Date().toISOString();
    
    // 判断任务类型
    const projectId = params.project_id || null;
    const sessionId = projectId ? null : await this.getCurrentSessionId();
    
    // 获取排序值
    const sort = params.sort !== undefined ? params.sort : this.getNextSort(db, projectId, sessionId);
    
    // 解析日期
    const dueDate = params.due_date ? this.parseDate(params.due_date) : null;
    
    // 标签序列化
    const tags = params.tags && params.tags.length > 0 ? JSON.stringify(params.tags) : null;
    
    // 插入任务
    db.prepare(`
      INSERT INTO tasks (
        id, content, description, status, priority,
        project_id, session_id, sort, tags, due_date,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      params.content,
      params.description || null,
      'pending',
      params.priority || 2,
      projectId,
      sessionId,
      sort,
      tags,
      dueDate,
      now,
      now
    );
    
    api?.logger?.info('任务添加成功', { taskId, projectId, sessionId });
    
    return {
      task_id: taskId,
      content: params.content,
      description: params.description,
      priority: params.priority || 2,
      status: 'pending',
      project_id: projectId,
      session_id: sessionId,
      sort,
      tags: params.tags,
      due_date: dueDate,
      created_at: now
    };
  },

  /**
   * 查询任务列表
   */
  async listTasks(db, params) {
    const { api } = this;
    
    // 判断查询类型
    const projectId = params.project_id || null;
    const sessionId = projectId ? null : await this.getCurrentSessionId();
    
    // 构建 WHERE 条件
    let whereConditions = [];
    let queryParams = [];
    
    if (projectId) {
      whereConditions.push('project_id = ? AND session_id IS NULL');
      queryParams.push(projectId);
    } else {
      whereConditions.push('session_id = ? AND project_id IS NULL');
      queryParams.push(sessionId);
    }
    
    // 快捷筛选
    if (params.quick_filter) {
      const today = new Date().toISOString().split('T')[0];
      switch (params.quick_filter) {
        case 'today':
          whereConditions.push('due_date = ?');
          whereConditions.push("status = 'pending'");
          queryParams.push(today);
          break;
        case 'pending':
          whereConditions.push("status = 'pending'");
          break;
        case 'completed':
          whereConditions.push("status = 'completed'");
          break;
        case 'overdue':
          whereConditions.push('due_date < ?');
          whereConditions.push("status = 'pending'");
          queryParams.push(today);
          break;
        case 'all':
          // 不添加状态筛选
          break;
      }
    } else if (params.status) {
      if (params.status !== 'all') {
        whereConditions.push('status = ?');
        queryParams.push(params.status);
      }
    } else {
      // 默认只查询待办
      whereConditions.push("status = 'pending'");
    }
    
    // 优先级筛选
    if (params.priority) {
      whereConditions.push('priority = ?');
      queryParams.push(params.priority);
    }
    
    // 标签筛选
    const tagCondition = this.buildTagCondition(db, params.tags, projectId, sessionId);
    
    // 排序
    const sortBy = params.sort_by || 'created_at';
    const sortOrder = params.sort_order || 'desc';
    const orderBy = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
    
    // 限制数量
    const limit = params.limit || 50;
    
    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM tasks WHERE ${whereConditions.join(' AND ')} ${tagCondition}`;
    const totalResult = db.prepare(countSql).get(...queryParams);
    const total = totalResult.total;
    
    // 查询任务
    const sql = `
      SELECT * FROM tasks 
      WHERE ${whereConditions.join(' AND ')} ${tagCondition}
      ${orderBy}
      LIMIT ?
    `;
    const rows = db.prepare(sql).all(...queryParams, limit);
    
    const tasks = rows.map(row => this.taskRowToObject(row));
    
    api?.logger?.info('任务查询成功', { total, count: tasks.length, projectId, sessionId });
    
    return {
      total,
      tasks
    };
  },

  /**
   * 更新任务
   */
  async updateTask(db, params) {
    const { api } = this;
    
    if (!params.task_id) {
      throw new Error('缺少必需参数: task_id');
    }
    
    // 查询任务是否存在
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(params.task_id);
    if (!existing) {
      throw new Error('任务不存在');
    }
    
    // 构建更新字段
    const updates = [];
    const values = [];
    
    if (params.content !== undefined) {
      updates.push('content = ?');
      values.push(params.content);
    }
    if (params.description !== undefined) {
      updates.push('description = ?');
      values.push(params.description || null);
    }
    if (params.priority !== undefined) {
      updates.push('priority = ?');
      values.push(params.priority);
    }
    if (params.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(params.due_date ? this.parseDate(params.due_date) : null);
    }
    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);
      if (params.status === 'completed' && existing.status !== 'completed') {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
      } else if (params.status !== 'completed' && existing.status === 'completed') {
        updates.push('completed_at = NULL');
      }
    }
    if (params.sort !== undefined) {
      updates.push('sort = ?');
      values.push(params.sort);
    }
    if (params.tags !== undefined) {
      updates.push('tags = ?');
      values.push(params.tags && params.tags.length > 0 ? JSON.stringify(params.tags) : null);
    }
    
    if (updates.length === 0) {
      // 没有要更新的字段，直接返回
      return this.taskRowToObject(existing);
    }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(params.task_id);
    
    // 执行更新
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    // 查询更新后的任务
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(params.task_id);
    
    api?.logger?.info('任务更新成功', { task_id: params.task_id });
    
    return this.taskRowToObject(updated);
  },

  /**
   * 完成任务
   */
  async completeTask(db, params) {
    const { api } = this;
    
    if (!params.task_id) {
      throw new Error('缺少必需参数: task_id');
    }
    
    const now = new Date().toISOString();
    
    // 更新任务状态
    const result = db.prepare(`
      UPDATE tasks 
      SET status = 'completed', completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, params.task_id);
    
    if (result.changes === 0) {
      throw new Error('任务不存在');
    }
    
    api?.logger?.info('任务完成', { task_id: params.task_id });
    
    return {
      task_id: params.task_id,
      status: 'completed',
      completed_at: now
    };
  },

  /**
   * 归档任务
   */
  async archiveTask(db, params) {
    const { api } = this;
    
    if (!params.task_id) {
      throw new Error('缺少必需参数: task_id');
    }
    
    const now = new Date().toISOString();
    
    // 更新任务状态
    const result = db.prepare(`
      UPDATE tasks 
      SET status = 'archived', updated_at = ?
      WHERE id = ?
    `).run(now, params.task_id);
    
    if (result.changes === 0) {
      throw new Error('任务不存在');
    }
    
    api?.logger?.info('任务归档', { task_id: params.task_id });
    
    return {
      task_id: params.task_id,
      status: 'archived',
      updated_at: now
    };
  },

  /**
   * 批量操作
   */
  async batchTasks(db, params) {
    const { api } = this;
    
    if (!params.operations || !Array.isArray(params.operations) || params.operations.length === 0) {
      throw new Error('缺少必需参数: operations');
    }
    
    const projectId = params.project_id || null;
    const sessionId = projectId ? null : await this.getCurrentSessionId();
    const useTransaction = params.transaction === true;
    
    const results = [];
    let succeeded = 0;
    let failed = 0;
    
    if (useTransaction) {
      // 严格事务模式
      try {
        const transaction = db.transaction(() => {
          for (let i = 0; i < params.operations.length; i++) {
            const op = params.operations[i];
            try {
              const result = this.executeSingleOperation(db, op, projectId, sessionId);
              results.push({
                index: i,
                action: op.action,
                success: true,
                task_id: result.task_id,
                error: null
              });
              succeeded++;
            } catch (error) {
              throw error; // 事务中抛出错误会回滚
            }
          }
        });
        transaction();
      } catch (error) {
        // 事务失败，所有操作都失败
        for (let i = 0; i < params.operations.length; i++) {
          results.push({
            index: i,
            action: params.operations[i].action,
            success: false,
            task_id: params.operations[i].task_id || null,
            error: error.message
          });
          failed++;
        }
      }
    } else {
      // 部分成功模式
      for (let i = 0; i < params.operations.length; i++) {
        const op = params.operations[i];
        try {
          let result;
          if (op.action === 'add') {
            result = await this.addTask(db, { ...op, project_id: op.project_id || projectId });
          } else if (op.action === 'update') {
            result = await this.updateTask(db, op);
          } else if (op.action === 'complete') {
            result = await this.completeTask(db, op);
          } else if (op.action === 'archive') {
            result = await this.archiveTask(db, op);
          } else {
            throw new Error(`无效的操作类型: ${op.action}`);
          }
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
    }
    
    api?.logger?.info('批量操作完成', { total: params.operations.length, succeeded, failed });
    
    return {
      success: true,
      total: params.operations.length,
      succeeded,
      failed,
      results
    };
  },

  /**
   * 执行单个操作（用于批量操作的事务模式）
   */
  executeSingleOperation(db, op, projectId, sessionId) {
    switch (op.action) {
      case 'add':
        // addTask 是 async，但在事务中需要同步执行
        // 这里直接执行数据库操作，不调用 addTask
        const taskId = randomUUID();
        const now = new Date().toISOString();
        const addProjectId = op.project_id || projectId;
        const addSessionId = addProjectId ? null : sessionId;
        const addSort = op.sort !== undefined ? op.sort : this.getNextSort(db, addProjectId, addSessionId);
        const addDueDate = op.due_date ? this.parseDate(op.due_date) : null;
        const addTags = op.tags && op.tags.length > 0 ? JSON.stringify(op.tags) : null;
        
        if (!op.content) {
          throw new Error('缺少必需参数: content');
        }
        
        db.prepare(`
          INSERT INTO tasks (
            id, content, description, status, priority,
            project_id, session_id, sort, tags, due_date,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          taskId,
          op.content,
          op.description || null,
          'pending',
          op.priority || 2,
          addProjectId,
          addSessionId,
          addSort,
          addTags,
          addDueDate,
          now,
          now
        );
        
        return { task_id: taskId };
      case 'update':
        return this.updateTaskSync(db, op);
      case 'complete':
        const completeNow = new Date().toISOString();
        const completeResult = db.prepare(`
          UPDATE tasks 
          SET status = 'completed', completed_at = ?, updated_at = ?
          WHERE id = ?
        `).run(completeNow, completeNow, op.task_id);
        if (completeResult.changes === 0) {
          throw new Error('任务不存在');
        }
        return { task_id: op.task_id };
      case 'archive':
        const archiveNow = new Date().toISOString();
        const archiveResult = db.prepare(`
          UPDATE tasks 
          SET status = 'archived', updated_at = ?
          WHERE id = ?
        `).run(archiveNow, op.task_id);
        if (archiveResult.changes === 0) {
          throw new Error('任务不存在');
        }
        return { task_id: op.task_id };
      default:
        throw new Error(`无效的操作类型: ${op.action}`);
    }
  },

  /**
   * 同步版本的更新任务（用于事务）
   */
  updateTaskSync(db, params) {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(params.task_id);
    if (!existing) {
      throw new Error('任务不存在');
    }
    
    const updates = [];
    const values = [];
    
    if (params.content !== undefined) {
      updates.push('content = ?');
      values.push(params.content);
    }
    if (params.description !== undefined) {
      updates.push('description = ?');
      values.push(params.description || null);
    }
    if (params.priority !== undefined) {
      updates.push('priority = ?');
      values.push(params.priority);
    }
    if (params.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(params.due_date ? this.parseDate(params.due_date) : null);
    }
    if (params.status !== undefined) {
      updates.push('status = ?');
      values.push(params.status);
      if (params.status === 'completed' && existing.status !== 'completed') {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
      } else if (params.status !== 'completed' && existing.status === 'completed') {
        updates.push('completed_at = NULL');
      }
    }
    if (params.sort !== undefined) {
      updates.push('sort = ?');
      values.push(params.sort);
    }
    if (params.tags !== undefined) {
      updates.push('tags = ?');
      values.push(params.tags && params.tags.length > 0 ? JSON.stringify(params.tags) : null);
    }
    
    if (updates.length === 0) {
      return { task_id: params.task_id };
    }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(params.task_id);
    
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    return { task_id: params.task_id };
  },

  /**
   * 调整排序
   */
  async reorderTasks(db, params) {
    const { api } = this;
    
    if (!params.task_ids || !Array.isArray(params.task_ids) || params.task_ids.length === 0) {
      throw new Error('缺少必需参数: task_ids');
    }
    
    const projectId = params.project_id || null;
    const sessionId = projectId ? null : await this.getCurrentSessionId();
    const now = new Date().toISOString();
    
    // 按新顺序分配排序值
    const total = params.task_ids.length;
    const updateStmt = db.prepare(`
      UPDATE tasks 
      SET sort = ?, updated_at = ?
      WHERE id = ? AND (project_id = ? OR session_id = ?)
    `);
    
    db.transaction(() => {
      params.task_ids.forEach((taskId, index) => {
        const sort = total - index - 1;
        updateStmt.run(sort, now, taskId, projectId, sessionId);
      });
    })();
    
    api?.logger?.info('排序调整完成', { total, projectId, sessionId });
    
    return {
      success: true,
      total,
      task_ids: params.task_ids
    };
  },

  /**
   * 获取统计信息
   */
  async getStatistics(db, params) {
    const { api } = this;
    
    let whereCondition = '';
    let queryParams = [];
    
    if (params.project_id === null) {
      // 统计所有项目任务
      whereCondition = 'project_id IS NOT NULL AND session_id IS NULL';
    } else if (params.project_id) {
      // 统计指定项目
      whereCondition = 'project_id = ? AND session_id IS NULL';
      queryParams.push(params.project_id);
    } else {
      // 统计当前会话
      const sessionId = await this.getCurrentSessionId();
      whereCondition = 'session_id = ? AND project_id IS NULL';
      queryParams.push(sessionId);
    }
    
    // 基础统计
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN due_date < date('now') AND status = 'pending' THEN 1 ELSE 0 END) as overdue
      FROM tasks
      WHERE ${whereCondition}
    `).get(...queryParams);
    
    // 按优先级统计
    const priorityStats = db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM tasks
      WHERE ${whereCondition}
      GROUP BY priority
    `).all(...queryParams);
    
    const byPriority = { 1: 0, 2: 0, 3: 0, 4: 0 };
    priorityStats.forEach(row => {
      byPriority[row.priority] = row.count;
    });
    
    // 按标签统计
    const tagRows = db.prepare(`
      SELECT tags
      FROM tasks
      WHERE ${whereCondition} AND tags IS NOT NULL
    `).all(...queryParams);
    
    const byTag = {};
    tagRows.forEach(row => {
      try {
        const tags = JSON.parse(row.tags);
        tags.forEach(tag => {
          byTag[tag] = (byTag[tag] || 0) + 1;
        });
      } catch (e) {
        // 忽略解析错误
      }
    });
    
    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const completionRate = total > 0 ? completed / total : 0;
    
    api?.logger?.info('统计信息获取成功', { total, project_id: params.project_id });
    
    return {
      total,
      pending: stats.pending || 0,
      completed,
      archived: stats.archived || 0,
      overdue: stats.overdue || 0,
      completion_rate: completionRate,
      by_priority: byPriority,
      by_tag: byTag
    };
  },

  /**
   * 列出项目
   */
  async listProjects(db, params) {
    const { api } = this;
    
    // 查询所有项目
    const projects = db.prepare(`
      SELECT 
        project_id,
        COUNT(*) as task_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM tasks
      WHERE project_id IS NOT NULL AND session_id IS NULL
      GROUP BY project_id
      HAVING SUM(CASE WHEN status IN ('pending', 'completed') THEN 1 ELSE 0 END) > 0
      ORDER BY project_id
    `).all();
    
    // 查询当前会话信息
    const sessionId = await this.getCurrentSessionId();
    const sessionStats = db.prepare(`
      SELECT 
        COUNT(*) as task_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM tasks
      WHERE session_id = ? AND project_id IS NULL
    `).get(sessionId);
    
    api?.logger?.info('项目列表获取成功', { 
      projectCount: projects.length,
      sessionId 
    });
    
    return {
      projects: projects.map(p => ({
        project_id: p.project_id,
        task_count: p.task_count,
        pending_count: p.pending_count || 0,
        completed_count: p.completed_count || 0
      })),
      current_session: {
        session_id: sessionId,
        task_count: sessionStats?.task_count || 0,
        pending_count: sessionStats?.pending_count || 0,
        completed_count: sessionStats?.completed_count || 0
      }
    };
  }
};

