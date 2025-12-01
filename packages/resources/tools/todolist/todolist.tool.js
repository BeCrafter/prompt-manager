/**
 * TodoList Tool - 基于本地 JSON 文件的轻量任务管理工具
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
 *
 * 技术说明：
 * - 使用纯 JavaScript JSON 文件存储，无需任何原生依赖
 * - 文件分离：活跃任务存储在 tasks.json，归档任务存储在 archived.json
 * - 所有写操作都会立即刷新到磁盘，确保数据安全
 * - 自动数据清理：过期会话任务和超量归档任务自动清理
 */

import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';

const DEFAULT_LIMIT = 50;
const DEFAULT_PRIORITY = 2;
const DATA_DIR_NAME = 'data';
const TASK_FILE_NAME = 'tasks.json';
const ARCHIVED_FILE_NAME = 'archived.json';
const DAY_MS = 24 * 60 * 60 * 1000;

const getEnvNumber = (value, fallback, min = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

const SESSION_TTL_DAYS = getEnvNumber(process.env?.TODOLIST_SESSION_TTL_DAYS, 7, 1); // 会话任务保留天数
const MAX_ARCHIVED_PER_SCOPE = getEnvNumber(process.env?.TODOLIST_MAX_ARCHIVED, 200, 50); // 各作用域最多保留归档任务条数

class TaskStore {
  constructor(activeFilePath, archivedFilePath, activeTasks, archivedTasks, logger) {
    this.activeFilePath = activeFilePath;
    this.archivedFilePath = archivedFilePath;
    this.activeTasks = activeTasks;
    this.archivedTasks = archivedTasks;
    this.logger = logger;
    this.activeModified = false;
    this.archivedModified = false;
  }

  static async load(toolDir, logger) {
    const dataDir = path.join(toolDir, DATA_DIR_NAME);
    const activePath = path.join(dataDir, TASK_FILE_NAME);
    const archivedPath = path.join(dataDir, ARCHIVED_FILE_NAME);
    await fs.mkdir(dataDir, { recursive: true });

    let activeTasks = [];
    let archivedTasks = [];

    try {
      const content = await fs.readFile(activePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.tasks)) {
        activeTasks = parsed.tasks.map(task => TaskStore.normalizeTask(task)).filter(Boolean);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // 如果是 JSON 解析错误，尝试备份文件
        if (error instanceof SyntaxError) {
          try {
            const backupPath = activePath + '.backup.' + Date.now();
            await fs.copyFile(activePath, backupPath);
            logger?.error('活跃任务文件 JSON 格式错误，已备份', {
              error: error.message,
              backup: backupPath
            });
          } catch (backupError) {
            logger?.error('读取活跃任务文件失败且备份失败', {
              error: error.message,
              backupError: backupError.message
            });
          }
        } else {
          logger?.warn('读取活跃任务文件失败，使用空任务列表', {
            error: error.message
          });
        }
      }
    }

    try {
      const content = await fs.readFile(archivedPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.tasks)) {
        archivedTasks = parsed.tasks.map(task => TaskStore.normalizeTask(task)).filter(Boolean);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        // 如果是 JSON 解析错误，尝试备份文件
        if (error instanceof SyntaxError) {
          try {
            const backupPath = archivedPath + '.backup.' + Date.now();
            await fs.copyFile(archivedPath, backupPath);
            logger?.error('归档任务文件 JSON 格式错误，已备份', {
              error: error.message,
              backup: backupPath
            });
          } catch (backupError) {
            logger?.error('读取归档任务文件失败且备份失败', {
              error: error.message,
              backupError: backupError.message
            });
          }
        } else {
          logger?.warn('读取归档任务文件失败，使用空任务列表', {
            error: error.message
          });
        }
      }
    }

    const store = new TaskStore(activePath, archivedPath, activeTasks, archivedTasks, logger);
    store.pruneExpiredData();
    if (store.activeModified || store.archivedModified) {
      await store.save(true);
    }
    return store;
  }

  getAllTasks() {
    return [...this.activeTasks, ...this.archivedTasks];
  }

  getActiveTasks() {
    return this.activeTasks;
  }

  getArchivedTasks() {
    return this.archivedTasks;
  }

  findTask(taskId) {
    let task = this.activeTasks.find(t => t.id === taskId);
    if (!task) {
      task = this.archivedTasks.find(t => t.id === taskId);
    }
    return task;
  }

  addTask(task) {
    if (task.status === 'archived') {
      this.archivedTasks.push(task);
      this.archivedModified = true;
    } else {
      this.activeTasks.push(task);
      this.activeModified = true;
    }
  }

  updateTask(taskId, updates) {
    let task = this.activeTasks.find(t => t.id === taskId);
    let isArchived = false;

    if (!task) {
      task = this.archivedTasks.find(t => t.id === taskId);
      isArchived = true;
    }

    if (!task) {
      return false;
    }

    const wasArchived = task.status === 'archived';
    Object.assign(task, updates);
    const isNowArchived = task.status === 'archived';

    if (wasArchived !== isNowArchived) {
      if (isNowArchived) {
        this.activeTasks = this.activeTasks.filter(t => t.id !== taskId);
        this.archivedTasks.push(task);
        this.activeModified = true;
        this.archivedModified = true;
      } else {
        this.archivedTasks = this.archivedTasks.filter(t => t.id !== taskId);
        this.activeTasks.push(task);
        this.activeModified = true;
        this.archivedModified = true;
      }
    } else {
      if (isArchived || isNowArchived) {
        this.archivedModified = true;
      } else {
        this.activeModified = true;
      }
    }

    return true;
  }

  removeTask(taskId) {
    const activeIndex = this.activeTasks.findIndex(t => t.id === taskId);
    if (activeIndex !== -1) {
      this.activeTasks.splice(activeIndex, 1);
      this.activeModified = true;
      return true;
    }

    const archivedIndex = this.archivedTasks.findIndex(t => t.id === taskId);
    if (archivedIndex !== -1) {
      this.archivedTasks.splice(archivedIndex, 1);
      this.archivedModified = true;
      return true;
    }

    return false;
  }

  static normalizeTask(task) {
    if (!task || typeof task !== 'object') {
      return null;
    }

    const normalized = { ...task };

    if (typeof normalized.tags === 'string') {
      try {
        normalized.tags = JSON.parse(normalized.tags);
      } catch {
        normalized.tags = [];
      }
    }

    if (!Array.isArray(normalized.tags)) {
      normalized.tags = [];
    }

    if (normalized.session_id === undefined) {
      normalized.session_id = null;
    }

    if (normalized.project_id === undefined) {
      normalized.project_id = null;
    }

    if (typeof normalized.priority !== 'number') {
      normalized.priority = DEFAULT_PRIORITY;
    }

    if (typeof normalized.sort !== 'number') {
      normalized.sort = 0;
    }

    return normalized;
  }

  markActiveModified() {
    this.activeModified = true;
  }

  markArchivedModified() {
    this.archivedModified = true;
  }

  async save(force = false) {
    if (this.activeModified || force) {
      const payload = {
        tasks: this.activeTasks
      };
      await fs.mkdir(path.dirname(this.activeFilePath), { recursive: true });
      // 使用临时文件+重命名确保原子性写入
      const tempPath = this.activeFilePath + '.tmp';
      try {
        await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
        await fs.rename(tempPath, this.activeFilePath);
      } catch (error) {
        // 如果重命名失败，尝试清理临时文件
        await fs.unlink(tempPath).catch(() => {});
        throw error;
      }
      this.activeModified = false;
    }

    if (this.archivedModified || force) {
      const payload = {
        tasks: this.archivedTasks
      };
      await fs.mkdir(path.dirname(this.archivedFilePath), { recursive: true });
      // 使用临时文件+重命名确保原子性写入
      const tempPath = this.archivedFilePath + '.tmp';
      try {
        await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
        await fs.rename(tempPath, this.archivedFilePath);
      } catch (error) {
        // 如果重命名失败，尝试清理临时文件
        await fs.unlink(tempPath).catch(() => {});
        throw error;
      }
      this.archivedModified = false;
    }
  }

  pruneExpiredData() {
    const beforeActive = this.activeTasks.length;
    const cutoff = Date.now() - SESSION_TTL_DAYS * DAY_MS;

    this.activeTasks = this.activeTasks.filter(task => {
      if (!task) return false;
      if (task.project_id || !task.session_id) {
        return true;
      }
      const lastActive = Date.parse(task.updated_at || task.created_at || '');
      if (Number.isNaN(lastActive)) {
        return false;
      }
      return lastActive >= cutoff;
    });

    if (this.activeTasks.length !== beforeActive) {
      this.logger?.info?.('已清理过期会话任务', {
        removed: beforeActive - this.activeTasks.length,
        session_ttl_days: SESSION_TTL_DAYS
      });
      this.activeModified = true;
    }

    const archivedByScope = new Map();
    this.archivedTasks.forEach(task => {
      if (!task) return;
      const scopeKey = task.project_id
        ? `project:${task.project_id}`
        : `session:${task.session_id || 'null'}`;
      if (!archivedByScope.has(scopeKey)) {
        archivedByScope.set(scopeKey, []);
      }
      archivedByScope.get(scopeKey).push(task);
    });

    archivedByScope.forEach((items, scopeKey) => {
      if (items.length <= MAX_ARCHIVED_PER_SCOPE) {
        return;
      }
      const sorted = [...items].sort((a, b) => {
        const timeA = Date.parse(a.updated_at || a.created_at || 0);
        const timeB = Date.parse(b.updated_at || b.created_at || 0);
        return timeB - timeA;
      });
      const toRemove = new Set(
        sorted.slice(MAX_ARCHIVED_PER_SCOPE).map(task => task.id)
      );
      const beforeCount = this.archivedTasks.length;
      this.archivedTasks = this.archivedTasks.filter(task => !toRemove.has(task.id));
      if (beforeCount !== this.archivedTasks.length) {
        this.logger?.info?.('归档任务达到上限，已清理旧数据', {
          scope: scopeKey,
          removed: beforeCount - this.archivedTasks.length,
          max_archived_per_scope: MAX_ARCHIVED_PER_SCOPE
        });
        this.archivedModified = true;
      }
    });
  }
}

export default {
  /**
   * 获取工具依赖
   */
  getDependencies() {
    return {
      uuid: '^9.0.0'
    };
  },

  /**
   * 获取工具元信息
   */
  getMetadata() {
    return {
      id: 'todolist',
      name: 'TodoList',
      description:
        '基于本地 JSON 文件存储的 TodoList 工具，默认创建会话任务（临时），也可指定项目创建持久化任务。支持快速查询、任务统计、批量操作等功能。',
      version: '1.0.0',
      category: 'utility',
      tags: ['todo', 'todolist', 'task', 'management', 'json', 'batch'],
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
        '自然语言日期解析能力有限'
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
          content: { type: 'string', description: '任务内容' },
          description: { type: 'string', description: '任务描述（可选）' },
          priority: {
            type: 'number',
            enum: [1, 2, 3, 4],
            description: '优先级：1=低, 2=中, 3=高, 4=紧急'
          },
          due_date: { type: 'string', description: '截止日期（ISO 8601 或自然语言）' },
          project_id: {
            type: 'string',
            description: '项目ID（不指定则创建会话任务，指定则创建项目任务）'
          },
          sort: { type: 'number', description: '排序值（默认自动递增）' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
          quick_filter: {
            type: 'string',
            enum: ['today', 'pending', 'completed', 'overdue', 'all'],
            description: '快捷筛选'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'archived', 'all'],
            description: '状态筛选（与 quick_filter 互斥）'
          },
          sort_by: {
            type: 'string',
            enum: ['sort', 'created_at', 'due_date', 'priority'],
            description: '排序方式（默认created_at）'
          },
          sort_order: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: '排序方向（默认desc）'
          },
          limit: { type: 'number', description: '返回数量限制（默认50）' },
          task_id: { type: 'string', description: '任务ID' },
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
          task_ids: {
            type: 'array',
            items: { type: 'string' },
            description: '任务ID数组（按新顺序排列）'
          }
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
        description: '数据存储失败',
        match: /database|存储|保存/i,
        solution: '请检查工具目录读写权限，或查看日志获取详细信息',
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
      const store = await this.initializeDatabase();

      switch (params.method) {
        case 'add_task':
          return await this.addTask(store, params);
        case 'list_tasks':
          return await this.listTasks(store, params);
        case 'update_task':
          return await this.updateTask(store, params);
        case 'complete_task':
          return await this.completeTask(store, params);
        case 'archive_task':
          return await this.archiveTask(store, params);
        case 'batch_tasks':
          return await this.batchTasks(store, params);
        case 'reorder_tasks':
          return await this.reorderTasks(store, params);
        case 'get_statistics':
          return await this.getStatistics(store, params);
        case 'list_projects':
          return await this.listProjects(store, params);
        default:
          throw new Error(`不支持的方法: ${params.method}`);
      }
    } catch (error) {
      const errorMessage = error?.message || String(error) || '未知错误';
      const errorStack = error?.stack || '无堆栈信息';

      api?.logger?.error('TodoList 工具执行失败', {
        error: errorMessage,
        stack: errorStack,
        method: params.method,
        errorType: error?.constructor?.name
      });

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * 初始化数据库
   */
  async initializeDatabase() {
    const toolDir = this.__toolDir || path.join(os.homedir(), '.prompt-manager', 'toolbox', this.__toolName || 'todolist');
    const store = await TaskStore.load(toolDir, this.api?.logger);
    return store;
  },

  /**
   * 保存数据库到文件
   */
  async saveDatabase(store) {
    await store.save();
  },

  /**
   * 解析日期（支持 ISO 8601 和简单自然语言）
   */
  parseDate(dateString) {
    if (!dateString) return null;

    const isoDate = new Date(dateString);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString().split('T')[0];
    }

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
        if (!isNaN(days)) {
          const future = new Date(today);
          future.setDate(future.getDate() + days);
          return future.toISOString().split('T')[0];
        }
      }
    }

    // 无法解析时返回 null，而不是原字符串
    return null;
  },

  /**
   * 获取当前会话ID
   */
  async getCurrentSessionId() {
    const { api } = this;

    if (api?.context?.sessionId) {
      return api.context.sessionId;
    }

    const storedSessionId = api?.storage?.getItem('todolist_session_id');
    if (storedSessionId) {
      return storedSessionId;
    }

    const newSessionId = randomUUID();
    if (api?.storage) {
      api.storage.setItem('todolist_session_id', newSessionId);
    }

    return newSessionId;
  },

  /**
   * 获取下一个排序值
   */
  getNextSort(store, projectId, sessionId) {
    const allTasks = store.getAllTasks();
    const scopedTasks = allTasks.filter(task => this.isSameScope(task, projectId, sessionId));
    if (scopedTasks.length === 0) {
      return 0;
    }

    const maxSort = scopedTasks.reduce((max, task) => Math.max(max, typeof task.sort === 'number' ? task.sort : 0), -1);
    return maxSort + 1;
  },

  isSameScope(task, projectId, sessionId) {
    if (projectId) {
      return task.project_id === projectId && !task.session_id;
    }

    return task.session_id === sessionId && !task.project_id;
  },

  normalizeTagsInput(tags) {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return [];
    }

    return Array.from(new Set(tags.filter(tag => typeof tag === 'string' && tag.trim() !== '').map(tag => tag.trim())));
  },

  formatTask(task) {
    return {
      task_id: task.id,
      content: task.content,
      description: task.description || undefined,
      status: task.status,
      priority: task.priority,
      project_id: task.project_id || null,
      session_id: task.session_id || null,
      sort: task.sort,
      tags: task.tags && task.tags.length > 0 ? [...task.tags] : undefined,
      due_date: task.due_date || undefined,
      created_at: task.created_at,
      updated_at: task.updated_at,
      completed_at: task.completed_at || undefined
    };
  },

  /**
   * 添加任务
   */
  async addTask(store, params, options = {}) {
    if (!params.content) {
      throw new Error('缺少必需参数: content');
    }

    const taskId = randomUUID();
    const now = new Date().toISOString();
    const projectId = params.project_id || null;
    const sessionId = projectId ? null : await this.getCurrentSessionId();
    const sort = params.sort !== undefined ? params.sort : this.getNextSort(store, projectId, sessionId);
    const dueDate = params.due_date ? this.parseDate(params.due_date) : null;
    const tags = this.normalizeTagsInput(params.tags);

    const task = {
      id: taskId,
      content: params.content,
      description: params.description || null,
      status: 'pending',
      priority: params.priority || DEFAULT_PRIORITY,
      project_id: projectId,
      session_id: sessionId,
      sort,
      tags,
      due_date: dueDate,
      created_at: now,
      updated_at: now,
      completed_at: null
    };

    store.addTask(task);

    if (!options.skipSave) {
      await this.saveDatabase(store);
    }

    this.api?.logger?.info('任务添加成功', { taskId, projectId, sessionId });

    return {
      task_id: taskId,
      content: params.content,
      description: params.description,
      priority: task.priority,
      status: 'pending',
      project_id: projectId,
      session_id: sessionId,
      sort,
      tags: tags.length > 0 ? [...tags] : undefined,
      due_date: dueDate,
      created_at: now
    };
  },

  /**
   * 查询任务列表
   */
  async listTasks(store, params) {
    const projectId = params.project_id || null;
    const sessionId = projectId ? null : await this.getCurrentSessionId();

    const allTasks = store.getAllTasks();
    let scopedTasks = allTasks.filter(task => this.isSameScope(task, projectId, sessionId));

    const today = new Date().toISOString().split('T')[0];

    if (params.quick_filter) {
      scopedTasks = scopedTasks.filter(task => {
        switch (params.quick_filter) {
          case 'today':
            return task.status === 'pending' && task.due_date === today;
          case 'pending':
            return task.status === 'pending';
          case 'completed':
            return task.status === 'completed';
          case 'overdue':
            return task.status === 'pending' && task.due_date && task.due_date < today;
          case 'all':
            return true;
          default:
            return true;
        }
      });
    } else if (params.status) {
      if (params.status !== 'all') {
        scopedTasks = scopedTasks.filter(task => task.status === params.status);
      }
    } else {
      scopedTasks = scopedTasks.filter(task => task.status === 'pending');
    }

    if (params.priority) {
      scopedTasks = scopedTasks.filter(task => task.priority === params.priority);
    }

    if (params.tags && Array.isArray(params.tags) && params.tags.length > 0) {
      scopedTasks = scopedTasks.filter(task => {
        if (!task.tags || task.tags.length === 0) {
          return false;
        }
        return params.tags.some(tag => task.tags.includes(tag));
      });
    }

    const sortBy = params.sort_by || 'created_at';
    const sortOrder = params.sort_order === 'asc' ? 1 : -1;

    scopedTasks.sort((a, b) => {
      const valueA = a[sortBy] ?? null;
      const valueB = b[sortBy] ?? null;

      if (valueA === valueB) {
        return 0;
      }

      if (valueA === null) {
        return 1 * sortOrder;
      }

      if (valueB === null) {
        return -1 * sortOrder;
      }

      if (valueA > valueB) {
        return 1 * sortOrder;
      }

      return -1 * sortOrder;
    });

    const total = scopedTasks.length;
    const limit = params.limit || DEFAULT_LIMIT;
    const tasks = scopedTasks.slice(0, limit).map(task => this.formatTask(task));

    this.api?.logger?.info('任务查询成功', {
      total,
      count: tasks.length,
      projectId,
      sessionId
    });

    return {
      total,
      tasks
    };
  },

  /**
   * 更新任务
   */
  async updateTask(store, params, options = {}) {
    if (!params.task_id) {
      throw new Error('缺少必需参数: task_id');
    }

    const task = store.findTask(params.task_id);
    if (!task) {
      throw new Error('任务不存在');
    }

    const updates = {};
    const now = new Date().toISOString();

    if (params.content !== undefined) {
      updates.content = params.content;
    }

    if (params.description !== undefined) {
      updates.description = params.description || null;
    }

    if (params.priority !== undefined) {
      updates.priority = params.priority;
    }

    if (params.due_date !== undefined) {
      updates.due_date = params.due_date ? this.parseDate(params.due_date) : null;
    }

    if (params.status !== undefined) {
      updates.status = params.status;
      if (params.status === 'completed' && task.status !== 'completed') {
        updates.completed_at = now;
      } else if (params.status !== 'completed' && task.status === 'completed') {
        updates.completed_at = null;
      }
    }

    if (params.sort !== undefined) {
      updates.sort = params.sort;
    }

    if (params.tags !== undefined) {
      updates.tags = this.normalizeTagsInput(params.tags);
    }

    if (Object.keys(updates).length === 0) {
      return this.formatTask(task);
    }

    updates.updated_at = now;
    const updated = store.updateTask(params.task_id, updates);
    if (!updated) {
      throw new Error('任务不存在');
    }

    if (!options.skipSave) {
      await this.saveDatabase(store);
    }

    this.api?.logger?.info('任务更新成功', { task_id: params.task_id });

    const updatedTask = store.findTask(params.task_id);
    return this.formatTask(updatedTask);
  },

  /**
   * 完成任务
   */
  async completeTask(store, params, options = {}) {
    if (!params.task_id) {
      throw new Error('缺少必需参数: task_id');
    }

    const task = store.findTask(params.task_id);
    if (!task) {
      throw new Error('任务不存在');
    }

    const now = new Date().toISOString();
    const updated = store.updateTask(params.task_id, {
      status: 'completed',
      completed_at: now,
      updated_at: now
    });

    if (!updated) {
      throw new Error('任务不存在');
    }

    if (!options.skipSave) {
      await this.saveDatabase(store);
    }

    this.api?.logger?.info('任务完成', { task_id: params.task_id });

    return {
      task_id: params.task_id,
      status: 'completed',
      completed_at: now
    };
  },

  /**
   * 归档任务
   */
  async archiveTask(store, params, options = {}) {
    if (!params.task_id) {
      throw new Error('缺少必需参数: task_id');
    }

    const task = store.findTask(params.task_id);
    if (!task) {
      throw new Error('任务不存在');
    }

    const now = new Date().toISOString();
    const updated = store.updateTask(params.task_id, {
      status: 'archived',
      updated_at: now
    });

    if (!updated) {
      throw new Error('任务不存在');
    }

    if (!options.skipSave) {
      await this.saveDatabase(store);
    }

    this.api?.logger?.info('任务归档', { task_id: params.task_id });

    return {
      task_id: params.task_id,
      status: 'archived',
      updated_at: now
    };
  },

  /**
   * 批量操作
   */
  async batchTasks(store, params) {
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
      const snapshot = {
        active: JSON.parse(JSON.stringify(store.getActiveTasks())),
        archived: JSON.parse(JSON.stringify(store.getArchivedTasks()))
      };

      try {
        for (let i = 0; i < params.operations.length; i++) {
          const op = params.operations[i];
          const result = await this.performBatchOperation(store, op, {
            projectId,
            sessionId,
            skipSave: true
          });

          results.push({
            index: i,
            action: op.action,
            success: true,
            task_id: result?.task_id || result?.task?.id || null,
            error: null
          });

          succeeded++;
        }

        await this.saveDatabase(store);
      } catch (error) {
        const normalizedActive = snapshot.active.map(task => TaskStore.normalizeTask(task)).filter(Boolean);
        const normalizedArchived = snapshot.archived.map(task => TaskStore.normalizeTask(task)).filter(Boolean);
        
        store.activeTasks = normalizedActive;
        store.archivedTasks = normalizedArchived;
        store.activeModified = true;
        store.archivedModified = true;
        await this.saveDatabase(store);

        for (let i = 0; i < params.operations.length; i++) {
          results.push({
            index: i,
            action: params.operations[i].action,
            success: false,
            task_id: params.operations[i].task_id || null,
            error: error.message
          });
        }

        failed = params.operations.length;

        return {
          success: false,
          total: params.operations.length,
          succeeded: 0,
          failed,
          results
        };
      }
    } else {
      for (let i = 0; i < params.operations.length; i++) {
        const op = params.operations[i];

        try {
          const result = await this.performBatchOperation(store, op, {
            projectId,
            sessionId,
            skipSave: false
          });

          results.push({
            index: i,
            action: op.action,
            success: true,
            task_id: result?.task_id || result?.task?.id || null,
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

    this.api?.logger?.info('批量操作完成', {
      total: params.operations.length,
      succeeded,
      failed
    });

    return {
      success: failed === 0,
      total: params.operations.length,
      succeeded,
      failed,
      results
    };
  },

  async performBatchOperation(store, op, options) {
    const payload = { ...op };

    if (op.action === 'add') {
      payload.project_id = op.project_id || options.projectId;
      return await this.addTask(store, payload, { skipSave: options.skipSave });
    }

    if (op.action === 'update') {
      return await this.updateTask(store, payload, { skipSave: options.skipSave });
    }

    if (op.action === 'complete') {
      return await this.completeTask(store, payload, { skipSave: options.skipSave });
    }

    if (op.action === 'archive') {
      return await this.archiveTask(store, payload, { skipSave: options.skipSave });
    }

    throw new Error(`无效的操作类型: ${op.action}`);
  },

  /**
   * 调整排序
   */
  async reorderTasks(store, params) {
    if (!params.task_ids || !Array.isArray(params.task_ids) || params.task_ids.length === 0) {
      throw new Error('缺少必需参数: task_ids');
    }

    const projectId = params.project_id || null;
    const sessionId = projectId ? null : await this.getCurrentSessionId();
    const now = new Date().toISOString();

    const total = params.task_ids.length;
    params.task_ids.forEach((taskId, index) => {
      const task = store.findTask(taskId);
      if (task && this.isSameScope(task, projectId, sessionId)) {
        store.updateTask(taskId, {
          sort: total - index - 1,
          updated_at: now
        });
      }
    });

    await this.saveDatabase(store);

    this.api?.logger?.info('排序调整完成', { total, projectId, sessionId });

    return {
      success: true,
      total,
      task_ids: params.task_ids
    };
  },

  /**
   * 获取统计信息
   */
  async getStatistics(store, params) {
    const allTasks = store.getAllTasks();
    let scopedTasks;

    if (params.project_id === null) {
      scopedTasks = allTasks.filter(task => task.project_id && !task.session_id);
    } else if (params.project_id) {
      scopedTasks = allTasks.filter(task => task.project_id === params.project_id && !task.session_id);
    } else {
      const sessionId = await this.getCurrentSessionId();
      scopedTasks = allTasks.filter(task => task.session_id === sessionId && !task.project_id);
    }

    const pending = scopedTasks.filter(task => task.status === 'pending').length;
    const completed = scopedTasks.filter(task => task.status === 'completed').length;
    const archived = scopedTasks.filter(task => task.status === 'archived').length;
    const overdue = scopedTasks.filter(task => task.status === 'pending' && task.due_date && task.due_date < new Date().toISOString().split('T')[0]).length;

    const byPriority = { 1: 0, 2: 0, 3: 0, 4: 0 };
    scopedTasks.forEach(task => {
      if (byPriority[task.priority] !== undefined) {
        byPriority[task.priority] += 1;
      }
    });

    const byTag = {};
    scopedTasks.forEach(task => {
      if (!task.tags) return;
      task.tags.forEach(tag => {
        byTag[tag] = (byTag[tag] || 0) + 1;
      });
    });

    const total = scopedTasks.length;
    const completionRate = total > 0 ? completed / total : 0;

    this.api?.logger?.info('统计信息获取成功', {
      total,
      project_id: params.project_id
    });

    return {
      total,
      pending,
      completed,
      archived,
      overdue,
      completion_rate: completionRate,
      by_priority: byPriority,
      by_tag: byTag
    };
  },

  /**
   * 列出项目
   */
  async listProjects(store) {
    const projectMap = new Map();
    const allTasks = store.getAllTasks();

    allTasks.forEach(task => {
      if (task.project_id && !task.session_id) {
        const stats = projectMap.get(task.project_id) || {
          project_id: task.project_id,
          task_count: 0,
          pending_count: 0,
          completed_count: 0
        };

        if (task.status === 'pending' || task.status === 'completed') {
          stats.task_count += 1;
          if (task.status === 'pending') {
            stats.pending_count += 1;
          } else if (task.status === 'completed') {
            stats.completed_count += 1;
          }
        }

        projectMap.set(task.project_id, stats);
      }
    });

    const projects = Array.from(projectMap.values()).filter(project => project.task_count > 0).sort((a, b) => a.project_id.localeCompare(b.project_id));

    const sessionId = await this.getCurrentSessionId();
    const sessionTasks = allTasks.filter(task => task.session_id === sessionId && !task.project_id);

    const sessionStats = {
      session_id: sessionId,
      task_count: sessionTasks.length,
      pending_count: sessionTasks.filter(task => task.status === 'pending').length,
      completed_count: sessionTasks.filter(task => task.status === 'completed').length
    };

    this.api?.logger?.info('项目列表获取成功', {
      projectCount: projects.length,
      sessionId
    });

    return {
      projects,
      current_session: sessionStats
    };
  }
};
