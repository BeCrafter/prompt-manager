// src/index.js - 主应用入口文件

// 导入样式
import '../css/main.css';

// 导入 CodeMirror 相关功能
import { initCodeMirror } from './codemirror';

// 导入 CodeMirror 5 组件用于预览编辑器
import CodeMirror from 'codemirror';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';

// 应用状态
let currentToken = localStorage.getItem('prompt-admin-token');
let currentPrompt = null;
let currentPromptObject = null;
let descriptionInputEl = null;
let allPrompts = [];
let expandedGroups = new Set();
let editor = null;
let argumentsState = [];
let unusedArgumentNames = new Set();
let editingArgumentIndex = null;
let argumentModalEl = null;
let argumentFormEl = null;
let argumentModalTitleEl = null;
let argumentNameInput = null;
let argumentTypeInput = null;
let argumentRequiredInput = null;
let argumentDefaultInput = null;
let argumentDescriptionInput = null;
let deletePromptModalEl = null;
let deletePromptNameEl = null;
let deletePromptConfirmBtn = null;
let deletePromptCancelBtn = null;
let deletePromptCloseBtn = null;
let pendingDeletePromptName = null;
let pendingDeletePromptPath = null;
let promptGroupBtnEl = null;
let promptGroupLabelEl = null;
let promptGroupDropdownEl = null;
let promptGroupSearchInput = null;
let promptGroupCascaderEl = null;
let promptGroupSearchResultsEl = null;
let promptGroupEmptyEl = null;
let groupTreeState = [];
let cascaderActivePaths = [];
let isGroupDropdownOpen = false;
let groupModalActiveTab = 'create';
let groupManageListEl = null;
let groupManageEmptyEl = null;
let groupManageSearchInputEl = null;
let groupManageSearchValue = '';
let groupManageEditingPath = null;
const groupManageActionLoading = new Set();
// 是否需要认证（默认不需要，直到从服务器获取配置）
let requireAuth = false;

// API 基础配置
const API_BASE = 'http://localhost:5621/adminapi';

// 提示组件
function showMessage(message, type = 'success', options = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const normalizedType = ['success', 'error', 'info', 'warning'].includes(type) ? type : 'success';
  const titleMap = {
    success: '操作成功',
    error: '操作失败',
    info: '提示信息',
    warning: '注意'
  };
  const iconMap = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '!'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${normalizedType}`;
  toast.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', normalizedType === 'error' ? 'assertive' : 'polite');

  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  iconEl.textContent = options.icon || iconMap[normalizedType];

  const contentEl = document.createElement('div');
  contentEl.className = 'toast-content';

  const titleText = options.title || titleMap[normalizedType];
  if (titleText) {
    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = titleText;
    contentEl.appendChild(titleEl);
  }

  const messageEl = document.createElement('div');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  contentEl.appendChild(messageEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭提示');
  closeBtn.innerHTML = '&times;';

  toast.appendChild(iconEl);
  toast.appendChild(contentEl);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  let hideTimer;
  let removed = false;

  const removeToast = () => {
    if (removed) return;
    removed = true;
    toast.classList.add('toast-leave');
    toast.removeEventListener('mouseenter', pauseTimer);
    toast.removeEventListener('mouseleave', resumeTimer);
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 250);
  };

  const pauseTimer = () => clearTimeout(hideTimer);
  const resumeTimer = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(removeToast, Number(options.duration) || 5000);
  };

  closeBtn.addEventListener('click', () => {
    pauseTimer();
    removeToast();
  });

  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', resumeTimer);

  resumeTimer();
}

// API请求封装
async function apiCall(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  // 如果需要认证且有token，则添加认证头
  if (requireAuth && currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    if (response.status === 401 && requireAuth) {
      // Token 过期，重新登录
      localStorage.removeItem('prompt-admin-token');
      currentToken = null;
      showLogin();
      throw new Error('登录已过期，请重新登录');
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || '请求失败');
    }

    return await response.json();
  } catch (error) {
    // 区分网络错误和其他错误
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      // 网络错误
      console.error('网络请求失败:', error);
      showMessage('网络连接失败，请检查服务器是否运行', 'error');
      throw new Error('网络连接失败，请检查服务器是否运行');
    } else {
      const handledError = error instanceof Error ? error : new Error(error?.message || '请求失败');
      handledError.__shown = true;
      console.error('API请求错误:', handledError);
      showMessage(handledError.message, 'error');
      throw handledError;
    }
  }
}

// 登录功能
async function login(username, password) {
  try {
    const result = await apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    currentToken = result.token;
    localStorage.setItem('prompt-admin-token', currentToken);
    showMain();
    loadPrompts();
  } catch (error) {
    document.getElementById('loginError').textContent = error.message || '登录失败';
  }
}

// 获取或创建令牌（在不需要认证时使用）
async function fetchToken() {
  try {
    const result = await apiCall('/login', {
      method: 'POST',
      body: JSON.stringify({ username: '', password: '' })
    });
    
    currentToken = result.token;
    localStorage.setItem('prompt-admin-token', currentToken);
    showMain();
    loadPrompts();
    
    // 隐藏登录界面
    const loginElement = document.getElementById('login');
    if (loginElement) {
      loginElement.style.display = 'none';
    }
  } catch (error) {
    console.error('获取令牌失败:', error);
    showMessage('获取访问权限失败', 'error');
    // 即使获取令牌失败，也要确保显示主界面
    showMain();
    loadPrompts();
  }
}

// 检查是否需要认证
async function checkAuthRequirement() {
  try {
    // 尝试获取服务器配置来判断是否需要认证
    const response = await fetch(`${API_BASE}/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const config = await response.json();
      requireAuth = config.requireAuth !== false;
    } else {
      // 如果获取配置失败，默认不需要认证（降级处理）
      requireAuth = false;
    }
  } catch (error) {
    // 如果请求失败，默认不需要认证（降级处理）
    console.warn('无法获取服务器配置，使用默认认证设置:', error);
    requireAuth = false;
  }
  
  // 根据认证要求设置登录界面的显示
  updateLoginDisplay();
}

// 转义HTML
function escapeHtml(input) {
  if (input === null || input === undefined) {
    return '';
  }
  return String(input).replace(/[&<>"]/g, (match) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[match] || match;
  });
}

// 转义正则表达式
function escapeRegExp(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 退出登录
function logout() {
  localStorage.removeItem('prompt-admin-token');
  currentToken = null;
  showLogin();
}

// 更新登录界面显示状态
function updateLoginDisplay() {
  const loginElement = document.getElementById('login');
  if (loginElement) {
    loginElement.style.display = requireAuth ? 'flex' : 'none';
  }
  
  // 更新头像的状态
  const avatarBtn = document.getElementById('avatarBtn');
  if (avatarBtn) {
    if (requireAuth) {
      avatarBtn.classList.remove('no-auth');
      avatarBtn.setAttribute('aria-haspopup', 'true');
    } else {
      avatarBtn.classList.add('no-auth');
      avatarBtn.setAttribute('aria-haspopup', 'false');
    }
  }
}

// 显示登录界面
function showLogin() {
  // 如果不需要认证，直接获取令牌并显示主界面
  if (!requireAuth) {
    fetchToken().catch(error => {
      console.error('自动获取令牌失败:', error);
      // 即使获取令牌失败，也要确保显示主界面
      showMain();
      loadPrompts();
    });
    return;
  }
  document.getElementById('login').style.display = 'flex';
  document.getElementById('main').style.display = 'none';
}

// 显示主界面
function showMain() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('main').style.display = 'block';
}

// 显示加载中效果
function showLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
  }
}

// 隐藏加载中效果
function hideLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

// 加载prompt列表
async function loadPrompts(search = '', enabledOnly = false, group = null) {
  try {
    // 显示加载中效果
    showLoading();
    
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (enabledOnly) queryParams.append('enabled', 'true');
    if (group) queryParams.append('group', group);
    
    const prompts = await apiCall(`/prompts?${queryParams}`);
    allPrompts = prompts;
    await renderGroupList(prompts);
  } catch (error) {
    console.error('加载prompt列表失败:', error);
  } finally {
    // 隐藏加载中效果
    hideLoading();
  }
}

function createDefaultPromptObject() {
  return {
    name: 'new-prompt',
    description: '新prompt描述',
    enabled: true,
    messages: [
      {
        role: 'user',
        content: {
          text: `这是一个新的prompt模板\n{{variable1}}`
        }
      }
    ],
    arguments: [
      {
        name: 'variable1',
        type: 'string',
        required: false,
        default: '',
        description: '示例变量'
      }
    ],
    variables: [
      {
        name: 'variable1',
        type: 'string',
        required: false,
        default: '',
        description: '示例变量'
      }
    ]
  };
}

// 用户头像下拉菜单控制
function setupUserMenu() {
  const avatarBtn = document.getElementById('avatarBtn');
  const userMenu = document.getElementById('userMenu');
  
  // 根据是否需要认证设置头像的可点击状态
  if (avatarBtn) {
    if (requireAuth) {
      avatarBtn.classList.remove('no-auth');
      avatarBtn.setAttribute('aria-haspopup', 'true');
    } else {
      avatarBtn.classList.add('no-auth');
      avatarBtn.setAttribute('aria-haspopup', 'false');
    }
  }
  
  // 点击头像显示/隐藏下拉菜单，但仅在需要认证时才生效
  avatarBtn.addEventListener('click', (e) => {
    // 如果需要认证，则显示下拉菜单
    if (requireAuth) {
      e.stopPropagation();
      userMenu.classList.toggle('show');
      avatarBtn.setAttribute('aria-expanded', userMenu.classList.contains('show'));
    }
    // 如果不需要认证，则不执行任何操作
  });
  
  // 点击页面其他地方关闭下拉菜单（仅在需要认证时才生效）
  document.addEventListener('click', (e) => {
    if (requireAuth && !userMenu.contains(e.target) && !avatarBtn.contains(e.target)) {
      userMenu.classList.remove('show');
      avatarBtn.setAttribute('aria-expanded', 'false');
    }
  });
  
  // ESC 键关闭下拉菜单（仅在需要认证时才生效）
  document.addEventListener('keydown', (e) => {
    if (requireAuth && e.key === 'Escape' && userMenu.classList.contains('show')) {
      userMenu.classList.remove('show');
      avatarBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

function clonePromptObject(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : null;
}

function getFirstUserMessage(promptObj) {
  if (!promptObj || !Array.isArray(promptObj.messages)) return null;
  return promptObj.messages.find(message => message?.role !== '') || null;
}

function buildPromptObjectFromUI() {
  const nameInput = document.getElementById('promptName');
  const name = (nameInput?.value || '').trim() || 'new-prompt';
  const description = descriptionInputEl?.value || '';
  const markdown = editor ? editor.getValue() : '';

  const base = clonePromptObject(currentPromptObject) || createDefaultPromptObject();
  base.name = name;
  base.description = description;

  if (!Array.isArray(base.messages)) {
    base.messages = [];
  }

  let userMessage = getFirstUserMessage(base);
  if (!userMessage) {
    userMessage = { role: 'user', content: { text: '' } };
    base.messages.push(userMessage);
  }

  if (!userMessage.content || typeof userMessage.content !== 'object') {
    userMessage.content = {};
  }

  userMessage.content.text = markdown;

  const sanitizedArguments = Array.isArray(argumentsState)
    ? argumentsState
        .map(arg => {
          const nameValue = (arg.name || '').trim();
          if (!nameValue) return null;
          const typeValue = (arg.type || '').trim();
          const descriptionValue = (arg.description || '').trim();
          const defaultValue = arg.default;
          const argumentResult = {
            name: nameValue,
            type: typeValue || 'string',
            required: Boolean(arg.required)
          };
          if (descriptionValue) {
            argumentResult.description = descriptionValue;
          }
          if (defaultValue !== undefined && defaultValue !== null) {
            const defaultText = String(defaultValue).trim();
            if (defaultText) {
              argumentResult.default = defaultText;
            }
          }
          return argumentResult;
        })
        .filter(Boolean)
    : [];

  base.arguments = sanitizedArguments;

  return base;
}

function adjustDescriptionHeight() {
  if (!descriptionInputEl) return;

  const style = window.getComputedStyle(descriptionInputEl);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) || 0;
  const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) || 0;
  const maxHeight = lineHeight * 4 + padding + border;
  const baseHeight = lineHeight + padding + border;

  descriptionInputEl.style.height = 'auto';
  const contentHeight = descriptionInputEl.scrollHeight;
  const newHeight = Math.max(baseHeight, Math.min(maxHeight, contentHeight));
  descriptionInputEl.style.height = `${newHeight}px`;
  descriptionInputEl.style.overflowY = descriptionInputEl.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

function normalizeArgument(argument = {}) {
  return {
    name: argument?.name ? String(argument.name) : '',
    description: argument?.description ? String(argument.description) : '',
    type: argument?.type ? String(argument.type) : 'string',
    required: Boolean(argument?.required),
    default: argument?.default ?? ''
  };
}

function setArgumentsState(list = []) {
  argumentsState = Array.isArray(list) ? list.map(item => normalizeArgument(item)) : [];
  unusedArgumentNames = new Set();
  const section = document.getElementById('argumentsSection');
  if (section) {
    section.classList.remove('has-error');
  }
  renderArgumentsEditor();
}

function removeArgument(index) {
  if (index < 0 || index >= argumentsState.length) return;
  argumentsState.splice(index, 1);
  setUnusedArgumentHighlights([]);
}

function renderArgumentsEditor() {
  const listEl = document.getElementById('argumentsList');
  if (!listEl) return;

  listEl.innerHTML = '';

  if (!argumentsState.length) {
    listEl.innerHTML = '<div class="arguments-empty">暂无参数，点击"新增参数"开始配置</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  argumentsState.forEach((rawArgument, index) => {
    const argument = normalizeArgument(rawArgument);
    const displayName = argument.name?.trim() || `参数 ${index + 1}`;
    const normalizedName = argument.name?.trim() || '';
    const safeType = escapeHtml(argument.type || 'string');
    const safeDefault = argument.default ? escapeHtml(String(argument.default)) : '';
    const safeDescription = argument.description ? escapeHtml(argument.description) : '';

    const card = document.createElement('div');
    card.className = 'argument-card';
    card.dataset.index = index;

    if (normalizedName && unusedArgumentNames.has(normalizedName)) {
      card.classList.add('argument-card-unused');
    }

    const badgeParts = [`<span class="argument-badge">类型：${safeType || 'string'}</span>`];
    if (argument.required) {
      badgeParts.push('<span class="argument-badge argument-required">必填</span>');
    }
    if (safeDefault) {
      badgeParts.push(`<span class="argument-badge">默认：${safeDefault}</span>`);
    }

    const placeholderSnippet = normalizedName
      ? `<div>变量占位：<span class="argument-placeholder">{{${escapeHtml(normalizedName)}}}</span></div>`
      : '';

    card.innerHTML = `
      <div class="argument-card-header">
        <div class="argument-name">${escapeHtml(displayName)}</div>
        <div class="argument-badges">${badgeParts.join('')}</div>
      </div>
      <div class="argument-body">
        ${safeDescription ? `<div class="argument-description">${safeDescription}</div>` : '<div class="argument-description" style="color: var(--gray);">暂无说明</div>'}
        ${placeholderSnippet}
      </div>
      <div class="argument-actions">
        <button type="button" class="argument-action-btn edit" data-action="edit" data-index="${index}">编辑</button>
        <button type="button" class="argument-action-btn delete" data-action="delete" data-index="${index}">删除</button>
      </div>
    `;

    fragment.appendChild(card);
  });

  listEl.appendChild(fragment);
}

function setUnusedArgumentHighlights(names = []) {
  unusedArgumentNames = new Set(Array.isArray(names) ? names.map(name => String(name).trim()).filter(Boolean) : []);
  const section = document.getElementById('argumentsSection');
  if (section) {
    section.classList.toggle('has-error', unusedArgumentNames.size > 0);
  }
  renderArgumentsEditor();
}

function openDeletePromptModal(promptName, relativePath) {
  if (!deletePromptModalEl) return;
  pendingDeletePromptName = promptName;
  pendingDeletePromptPath = relativePath || null;
  if (deletePromptNameEl) {
    deletePromptNameEl.textContent = `“${promptName}”`;
  }
  deletePromptModalEl.classList.remove('hidden');
  deletePromptModalEl.setAttribute('aria-hidden', 'false');
  refreshModalOpenState();
  if (deletePromptConfirmBtn) {
    requestAnimationFrame(() => deletePromptConfirmBtn.focus());
  }
}

function closeDeletePromptModal() {
  if (!deletePromptModalEl) return;
  deletePromptModalEl.classList.add('hidden');
  deletePromptModalEl.setAttribute('aria-hidden', 'true');
  refreshModalOpenState();
  pendingDeletePromptName = null;
  pendingDeletePromptPath = null;
}

async function confirmDeletePrompt() {
  if (!pendingDeletePromptName) {
    closeDeletePromptModal();
    return;
  }
  const promptToDelete = pendingDeletePromptName;
  const pathToDelete = pendingDeletePromptPath;
  closeDeletePromptModal();
  await deletePrompt(promptToDelete, pathToDelete);
}

function openArgumentModal(index = null) {
  if (!argumentModalEl) return;
  editingArgumentIndex = Number.isInteger(index) && index >= 0 ? index : null;
  const isEdit = editingArgumentIndex !== null && argumentsState[editingArgumentIndex];
  const payload = isEdit ? normalizeArgument(argumentsState[editingArgumentIndex]) : normalizeArgument({ type: 'string' });

  if (argumentModalTitleEl) {
    argumentModalTitleEl.textContent = isEdit ? '编辑参数' : '新增参数';
  }
  if (argumentNameInput) {
    argumentNameInput.value = payload.name || '';
  }
  if (argumentTypeInput) {
    argumentTypeInput.value = payload.type || 'string';
  }
  if (argumentRequiredInput) {
    argumentRequiredInput.checked = Boolean(payload.required);
  }
  if (argumentDefaultInput) {
    const modalDefaultValue = payload.default;
    argumentDefaultInput.value = modalDefaultValue === undefined || modalDefaultValue === null ? '' : String(modalDefaultValue);
  }
  if (argumentDescriptionInput) {
    argumentDescriptionInput.value = payload.description || '';
  }

  argumentModalEl.classList.remove('hidden');
  argumentModalEl.setAttribute('aria-hidden', 'false');
  refreshModalOpenState();

  requestAnimationFrame(() => {
    if (argumentNameInput) {
      argumentNameInput.focus();
      argumentNameInput.select();
    }
  });
}

function closeArgumentModal() {
  if (!argumentModalEl) return;
  argumentModalEl.classList.add('hidden');
  argumentModalEl.setAttribute('aria-hidden', 'true');
  refreshModalOpenState();
  editingArgumentIndex = null;

  if (argumentFormEl) {
    argumentFormEl.reset();
  }
  if (argumentNameInput) {
    argumentNameInput.value = '';
  }
  if (argumentTypeInput) {
    argumentTypeInput.value = 'string';
  }
  if (argumentRequiredInput) {
    argumentRequiredInput.checked = false;
  }
  if (argumentDefaultInput) {
    argumentDefaultInput.value = '';
  }
  if (argumentDescriptionInput) {
    argumentDescriptionInput.value = '';
  }
}

function handleArgumentFormSubmit(event) {
  event.preventDefault();
  if (!argumentNameInput || !argumentTypeInput) return;

  const name = (argumentNameInput.value || '').trim();
  if (!name) {
    showMessage('请输入参数名称', 'error');
    argumentNameInput.focus();
    return;
  }

  const type = (argumentTypeInput.value || 'string').trim() || 'string';
  const required = argumentRequiredInput ? argumentRequiredInput.checked : false;
  const defaultValue = argumentDefaultInput ? argumentDefaultInput.value : '';
  const description = argumentDescriptionInput ? argumentDescriptionInput.value.trim() : '';

  const payload = normalizeArgument({
    name,
    type,
    required,
    default: defaultValue,
    description
  });

  if (editingArgumentIndex !== null && argumentsState[editingArgumentIndex]) {
    argumentsState[editingArgumentIndex] = payload;
  } else {
    argumentsState.push(payload);
  }

  closeArgumentModal();
  setUnusedArgumentHighlights([]);
}

function collectPromptTextContent(promptObject) {
  const segments = [];
  if (!promptObject || !Array.isArray(promptObject.messages)) {
    return '';
  }
  promptObject.messages.forEach(message => {
    if (!message) return;
    const content = message.content;
    if (Array.isArray(content)) {
      content.forEach(item => {
        if (typeof item === 'string') {
          segments.push(item);
        } else if (item && typeof item === 'object') {
          Object.values(item).forEach(value => {
            if (typeof value === 'string') {
              segments.push(value);
            }
          });
        }
      });
    } else if (typeof content === 'string') {
      segments.push(content);
    } else if (content && typeof content === 'object') {
      Object.values(content).forEach(value => {
        if (typeof value === 'string') {
          segments.push(value);
        }
      });
    }
  });
  return segments.join('\n');
}

function findUnusedArguments(promptObject) {
  const args = Array.isArray(promptObject?.arguments) ? promptObject.arguments : [];
  if (!args.length) return [];
  const combinedContent = collectPromptTextContent(promptObject);
  return args.filter(arg => {
    const name = arg?.name?.trim();
    if (!name) return false;
    const pattern = new RegExp(`{{\\s*${escapeRegExp(name)}\\s*}}`);
    return !pattern.test(combinedContent);
  });
}

function handleArgumentListClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index)) return;
  if (action === 'delete') {
    const argumentName = argumentsState[index]?.name || `参数 ${index + 1}`;
    const confirmed = window.confirm(`确定要删除参数 "${argumentName}" 吗？`);
    if (!confirmed) return;
    removeArgument(index);
  } else if (action === 'edit') {
    openArgumentModal(index);
  }
}

function sanitizeGroupId(pathValue = 'default') {
  return pathValue.replace(/[^a-zA-Z0-9-_]/g, '__') || 'default';
}

function collectAncestorPaths(pathValue) {
  if (!pathValue) return [];
  const segments = pathValue.split('/');
  const paths = [];
  let current = '';
  segments.forEach(segment => {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  });
  return paths;
}

function flattenGroupTree(nodes, depth = 0, accumulator = []) {
  if (!Array.isArray(nodes)) return accumulator;
  nodes.forEach(node => {
    const value = node?.path || 'default';
    const name = node?.name || value;
    accumulator.push({
      value,
      name,
      depth,
      path: value,
      enabled: node?.enabled !== false
    });
    if (Array.isArray(node?.children) && node.children.length) {
      flattenGroupTree(node.children, depth + 1, accumulator);
    }
  });
  return accumulator;
}

function findNodeByPath(nodes, targetPath) {
  if (!Array.isArray(nodes)) return null;
  for (const node of nodes) {
    if (!node) continue;
    const nodePath = node.path || 'default';
    if (nodePath === targetPath) {
      return node;
    }
    if (Array.isArray(node.children) && node.children.length) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function setCascaderActivePathsByValue(pathValue = 'default') {
  const target = pathValue || 'default';
  const candidates = collectAncestorPaths(target);
  const validated = [];
  candidates.forEach(path => {
    if (findNodeByPath(groupTreeState, path) || path === 'default') {
      validated.push(path);
    }
  });
  cascaderActivePaths = validated.length ? validated : ['default'];
}

function renderGroupDropdownContent(keyword = '') {
  const trimmed = (keyword || '').trim();
  if (!isGroupDropdownOpen) return;
  if (trimmed) {
    renderGroupSearchResults(trimmed);
  } else {
    renderGroupCascader();
  }
}

function renderGroupCascader() {
  if (!promptGroupCascaderEl) return;
  const selectEl = document.getElementById('promptGroup');
  const currentValue = selectEl?.value || 'default';

  promptGroupCascaderEl.innerHTML = '';
  promptGroupCascaderEl.style.display = 'flex';

  if (promptGroupSearchResultsEl) {
    promptGroupSearchResultsEl.classList.remove('show');
    promptGroupSearchResultsEl.innerHTML = '';
  }

  if (!Array.isArray(groupTreeState) || !groupTreeState.length) {
    promptGroupCascaderEl.innerHTML = '';
    promptGroupCascaderEl.style.display = 'none';
    if (promptGroupEmptyEl) {
      promptGroupEmptyEl.classList.remove('hidden');
      promptGroupEmptyEl.textContent = '暂未配置类目';
    }
    return;
  }

  if (promptGroupEmptyEl) {
    promptGroupEmptyEl.classList.add('hidden');
  }

  const columns = [];
  let depth = 0;
  let nodes = groupTreeState;
  columns.push({ depth, nodes, title: '全部类目' });

  while (true) {
    const activePath = cascaderActivePaths[depth];
    if (!activePath) break;
    const activeNode = findNodeByPath(nodes, activePath);
    if (activeNode && Array.isArray(activeNode.children) && activeNode.children.length) {
      depth += 1;
      nodes = activeNode.children;
      columns.push({
        depth,
        nodes,
        title: activeNode.name || activeNode.path || '子类目'
      });
    } else {
      break;
    }
  }

  columns.forEach(({ depth, nodes, title }) => {
    const columnEl = document.createElement('div');
    columnEl.className = 'group-cascader-column';

    const titleEl = document.createElement('div');
    titleEl.className = 'group-cascader-title';
    titleEl.textContent = title || '子类目';
    columnEl.appendChild(titleEl);

    const listEl = document.createElement('div');
    listEl.className = 'group-cascader-list';
    columnEl.appendChild(listEl);

    if (!Array.isArray(nodes) || !nodes.length) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'group-cascader-empty';
      emptyEl.textContent = '无子类目';
      listEl.appendChild(emptyEl);
    } else {
      nodes.forEach(node => {
        if (!node) return;
        const nodePath = node.path || 'default';
        const nodeName = node.name || nodePath;
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;
        const isActivePath = cascaderActivePaths[depth] === nodePath;
        const isSelected = currentValue === nodePath;

        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        let itemClass = 'group-cascader-item';
        if (hasChildren) itemClass += ' has-children';
        if (isActivePath) itemClass += ' active';
        if (isSelected) itemClass += ' selected';
        itemBtn.className = itemClass;

        const safeName = escapeHtml(nodeName);
        const safePath = escapeHtml(nodePath);
        let suffix = '';
        if (hasChildren) {
          suffix = '<span class="group-cascader-suffix">›</span>';
          if (isSelected) {
            suffix = `<span class="group-cascader-check">✓</span>${suffix}`;
          }
        } else if (isSelected) {
          suffix = '<span class="group-cascader-check">✓</span>';
        }
        const hint = nodePath.includes('/') ? `<span class="group-cascader-path-hint">${safePath}</span>` : '';

        itemBtn.innerHTML = `
          <span class="group-cascader-label">${safeName}${hint}</span>
          ${suffix}
        `;

        itemBtn.addEventListener('click', () => {
          handleCascaderItemClick(node, depth);
        });

        listEl.appendChild(itemBtn);
      });
    }

    promptGroupCascaderEl.appendChild(columnEl);
  });
}

function renderGroupSearchResults(keyword) {
  if (!promptGroupSearchResultsEl) return;
  const selectEl = document.getElementById('promptGroup');
  const currentValue = selectEl?.value || 'default';
  const options = getFilteredGroupOptions(keyword);

  if (promptGroupCascaderEl) {
    promptGroupCascaderEl.style.display = 'none';
  }

  promptGroupSearchResultsEl.innerHTML = '';

  if (!options.length) {
    promptGroupSearchResultsEl.classList.remove('show');
    if (promptGroupEmptyEl) {
      promptGroupEmptyEl.classList.remove('hidden');
      promptGroupEmptyEl.textContent = '没有匹配的类目';
    }
    return;
  }

  promptGroupSearchResultsEl.classList.add('show');
  if (promptGroupEmptyEl) {
    promptGroupEmptyEl.classList.add('hidden');
  }

  const fragment = document.createDocumentFragment();
  options.forEach(option => {
    const item = document.createElement('button');
    item.type = 'button';
    const isSelected = option.value === currentValue;
    item.className = `group-search-item${isSelected ? ' selected' : ''}`;
    const safeName = escapeHtml(option.name);
    const safePath = escapeHtml(option.path);
    item.innerHTML = `
      <span>${safeName}</span>
      <span class="group-search-path">${safePath}</span>
    `;
    item.addEventListener('click', () => {
      selectGroupValue(option.value);
      closeGroupDropdown();
    });
    fragment.appendChild(item);
  });

  promptGroupSearchResultsEl.appendChild(fragment);
}

function handleCascaderItemClick(node, depth) {
  const nodePath = node?.path || 'default';
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
  cascaderActivePaths = cascaderActivePaths.slice(0, depth);
  cascaderActivePaths[depth] = nodePath;
  selectGroupValue(nodePath, !hasChildren);
  if (hasChildren) {
    renderGroupCascader();
  }
}

function updatePromptGroupDisplay() {
  const selectEl = document.getElementById('promptGroup');
  if (!selectEl || !promptGroupLabelEl || !promptGroupBtnEl) return;
  const value = selectEl.value || 'default';
  const option = Array.from(selectEl.options || []).find(opt => opt.value === value);
  const displayText = option ? option.textContent.trim() : value;
  promptGroupLabelEl.textContent = displayText || value || 'default';
  promptGroupBtnEl.dataset.value = value;
}

function updateGroupSelectOptions(tree) {
  const selectEl = document.getElementById('promptGroup');
  if (!selectEl) return;
  const previousValue = selectEl.value || 'default';
  const optionsData = flattenGroupTree(tree || []);
  selectEl.innerHTML = '';
  optionsData.forEach(optionData => {
    const optionEl = document.createElement('option');
    optionEl.value = optionData.value;
    optionEl.textContent = optionData.path;
    selectEl.appendChild(optionEl);
  });
  const hasPrevious = optionsData.some(optionData => optionData.value === previousValue);
  selectEl.value = hasPrevious ? previousValue : (optionsData[0]?.value || 'default');
  updatePromptGroupDisplay();
  if (isGroupDropdownOpen) {
    setCascaderActivePathsByValue(selectEl.value || 'default');
    renderGroupDropdownContent(promptGroupSearchInput?.value || '');
  }
}

function getFilteredGroupOptions(keyword = '') {
  const normalized = keyword.trim().toLowerCase();
  let options = flattenGroupTree(groupTreeState || []);
  if (!options.length) {
    const selectEl = document.getElementById('promptGroup');
    if (selectEl) {
      options = Array.from(selectEl.options || []).map(opt => {
        const optionValue = opt.value || 'default';
        const text = opt.textContent?.trim() || optionValue;
        return {
          value: optionValue,
          name: text,
          depth: 0,
          path: optionValue
        };
      });
    }
  }
  if (!normalized) return options;
  return options.filter(option => {
    const name = option.name ? option.name.toLowerCase() : '';
    const path = option.path ? option.path.toLowerCase() : '';
    return name.includes(normalized) || path.includes(normalized);
  });
}

function selectGroupValue(value, closeAfterSelection = true) {
  const selectEl = document.getElementById('promptGroup');
  if (!selectEl) return;
  const exists = Array.from(selectEl.options || []).some(option => option.value === value);
  if (!exists) {
    const optionEl = document.createElement('option');
    optionEl.value = value;
    optionEl.textContent = value;
    selectEl.appendChild(optionEl);
  }
  selectEl.value = value;
  updatePromptGroupDisplay();
  setCascaderActivePathsByValue(value);
  if (isGroupDropdownOpen) {
    if (!closeAfterSelection) {
      renderGroupDropdownContent(promptGroupSearchInput?.value || '');
    } else {
      closeGroupDropdown(true);
    }
  }
}

function openGroupDropdown() {
  if (!promptGroupDropdownEl || isGroupDropdownOpen) return;
  isGroupDropdownOpen = true;
  promptGroupDropdownEl.classList.add('show');
  promptGroupBtnEl?.setAttribute('aria-expanded', 'true');
  const selectEl = document.getElementById('promptGroup');
  setCascaderActivePathsByValue(selectEl?.value || 'default');
  renderGroupDropdownContent('');
  if (promptGroupSearchInput) {
    promptGroupSearchInput.value = '';
    requestAnimationFrame(() => promptGroupSearchInput.focus());
  }
}

function closeGroupDropdown(focusButton = false) {
  if (!promptGroupDropdownEl || !isGroupDropdownOpen) return;
  isGroupDropdownOpen = false;
  promptGroupDropdownEl.classList.remove('show');
  promptGroupBtnEl?.setAttribute('aria-expanded', 'false');
  if (promptGroupSearchInput) {
    promptGroupSearchInput.value = '';
  }
  if (promptGroupCascaderEl) {
    promptGroupCascaderEl.style.display = 'flex';
  }
  if (promptGroupSearchResultsEl) {
    promptGroupSearchResultsEl.classList.remove('show');
    promptGroupSearchResultsEl.innerHTML = '';
  }
  if (promptGroupEmptyEl) {
    promptGroupEmptyEl.classList.add('hidden');
  }
  if (focusButton && promptGroupBtnEl) {
    promptGroupBtnEl.focus();
  }
}

function toggleGroupDropdown(force) {
  const shouldOpen = typeof force === 'boolean' ? force : !isGroupDropdownOpen;
  if (shouldOpen) {
    openGroupDropdown();
  } else {
    closeGroupDropdown();
  }
}

function setGroupModalTab(tab = 'create') {
  const nextTab = tab === 'manage' ? 'manage' : 'create';
  groupModalActiveTab = nextTab;
  const tabButtons = document.querySelectorAll('.group-modal-tab');
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === nextTab);
  });
  const panels = document.querySelectorAll('.group-modal-panel');
  panels.forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== nextTab);
  });
  const createFooter = document.getElementById('groupModalCreateFooter');
  const manageFooter = document.getElementById('groupModalManageFooter');
  if (createFooter) createFooter.classList.toggle('hidden', nextTab !== 'create');
  if (manageFooter) manageFooter.classList.toggle('hidden', nextTab !== 'manage');
  if (nextTab === 'create') {
    const input = document.getElementById('newFolderName');
    setTimeout(() => {
      input?.focus();
      populateParentFolderSelect(); // 填充父级目录选择框
    }, 120);
  } else {
    setTimeout(() => groupManageSearchInputEl?.focus(), 120);
    renderGroupManageList();
  }
}

function renderGroupManageList() {
  if (!groupManageListEl) return;
  const flattened = flattenGroupTree(groupTreeState || []);
  const keyword = (groupManageSearchValue || '').trim().toLowerCase();
  const filtered = flattened.filter(item => {
    if (!item) return false;
    if (!keyword) return true;
    const nameLower = (item.name || '').toLowerCase();
    const pathLower = (item.path || '').toLowerCase();
    return nameLower.includes(keyword) || pathLower.includes(keyword);
  });

  groupManageListEl.innerHTML = '';
  if (groupManageEmptyEl) {
    if (!filtered.length) {
      groupManageEmptyEl.textContent = keyword ? '未找到匹配的类目' : '暂无类目信息';
      groupManageEmptyEl.classList.remove('hidden');
    } else {
      groupManageEmptyEl.classList.add('hidden');
    }
  }
  if (!filtered.length) {
    return;
  }

  filtered.forEach(item => {
    const enabled = item.enabled !== false;
    const isDefault = item.path === 'default';
    const isEditing = groupManageEditingPath === item.path;
    const isBusy = groupManageActionLoading.has(item.path);
    const safeName = escapeHtml(item.name);
    const safePath = escapeHtml(item.path);
    const row = document.createElement('div');
    row.className = `group-manage-item${enabled ? '' : ' is-disabled'}`;
    row.dataset.path = item.path;
    row.style.setProperty('--depth', item.depth || 0);

    if (isEditing) {
      row.innerHTML = `
        <div class="group-manage-info">
          <div class="group-manage-edit">
            <input type="text" class="group-manage-rename-input" value="${safeName}" maxlength="64">
          </div>
          <div class="group-manage-path">${safePath}</div>
        </div>
        <div class="group-manage-actions">
          <button type="button" class="group-manage-action-btn" data-action="rename-confirm"${isBusy ? ' disabled' : ''}>保存</button>
          <button type="button" class="group-manage-action-btn" data-action="rename-cancel"${isBusy ? ' disabled' : ''}>取消</button>
        </div>
      `;
    } else {
      const statusBadge = `<span class="group-status-badge ${enabled ? 'enabled' : 'disabled'}">${enabled ? '启用中' : '已冻结'}</span>`;
      const defaultBadge = isDefault ? '<span class="group-status-badge default">默认</span>' : '';
      const toggleDisabled = isBusy || isDefault;
      const renameDisabled = isBusy || isDefault;
      const deleteDisabled = isBusy || isDefault;
      const toggleText = enabled ? '冻结' : '启用';
      row.innerHTML = `
        <div class="group-manage-info">
          <div class="group-manage-name">${safeName}${statusBadge}${defaultBadge}</div>
          <div class="group-manage-path">${safePath}</div>
        </div>
        <div class="group-manage-actions">
          <button type="button" class="group-manage-action-btn" data-action="toggle"${toggleDisabled ? ' disabled' : ''}>${toggleText}</button>
          <button type="button" class="group-manage-action-btn" data-action="rename"${renameDisabled ? ' disabled' : ''}>重命名</button>
          <button type="button" class="group-manage-action-btn danger" data-action="delete"${deleteDisabled ? ' disabled' : ''}>删除</button>
        </div>
      `;
    }

    groupManageListEl.appendChild(row);
  });
}

async function refreshGroupData() {
  try {
    // 显示加载中效果
    showLoading();
    
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput ? searchInput.value : '';
    await loadPrompts(searchValue);
    if (groupModalActiveTab === 'manage') {
      renderGroupManageList();
    } else if (groupModalActiveTab === 'create') {
      populateParentFolderSelect(); // 更新父级目录选择框
    }
  } catch (error) {
    console.error('刷新类目数据失败:', error);
  } finally {
    // 隐藏加载中效果
    hideLoading();
  }
}

function handleGroupManageSearchInput(event) {
  groupManageSearchValue = event.target.value || '';
  renderGroupManageList();
}

function resetGroupManageState() {
  groupManageSearchValue = '';
  groupManageEditingPath = null;
  groupManageActionLoading.clear();
  if (groupManageSearchInputEl) {
    groupManageSearchInputEl.value = '';
  }
  renderGroupManageList();
}

async function handleGroupRename(pathValue, newName) {
  if (!newName || !newName.trim()) {
    showMessage('请输入新的类目名称', 'error');
    return;
  }
  const trimmedName = newName.trim();
  if (!/^[a-zA-Z0-9-_一-龥]{1,64}$/.test(trimmedName)) {
    showMessage('名称格式无效，只能包含字母、数字、中划线、下划线和中文', 'error');
    return;
  }
  const currentSegments = pathValue.split('/');
  const currentName = currentSegments[currentSegments.length - 1] || pathValue;
  if (trimmedName === currentName) {
    groupManageEditingPath = null;
    renderGroupManageList();
    showMessage('类目名称未变更', 'info');
    return;
  }
  groupManageActionLoading.add(pathValue);
  renderGroupManageList();
  try {
    await apiCall('/groups/rename', {
      method: 'PATCH',
      body: JSON.stringify({ path: pathValue, newName: trimmedName })
    });
    showMessage('类目重命名成功');
    groupManageEditingPath = null;
    await refreshGroupData();
  } catch (error) {
    console.error('重命名类目失败:', error);
    showMessage(error?.message || '类目重命名失败', 'error');
  } finally {
    groupManageActionLoading.delete(pathValue);
    renderGroupManageList();
  }
}

async function handleGroupDelete(pathValue, displayName) {
  const confirmed = window.confirm(`确认删除「${displayName}」吗？该操作不可撤销。`);
  if (!confirmed) return;
  groupManageActionLoading.add(pathValue);
  renderGroupManageList();
  try {
    await apiCall(`/groups?path=${encodeURIComponent(pathValue)}`, {
      method: 'DELETE'
    });
    showMessage(`已删除 “${displayName}”`);
    await refreshGroupData();
  } catch (error) {
    console.error('删除类目失败:', error);
    showMessage(error?.message || '删除类目失败', 'error');
  } finally {
    groupManageActionLoading.delete(pathValue);
    renderGroupManageList();
  }
}

async function handleGroupStatusToggle(pathValue, displayName, nextEnabled) {
  groupManageActionLoading.add(pathValue);
  renderGroupManageList();
  try {
    const result = await apiCall('/groups/status', {
      method: 'PATCH',
      body: JSON.stringify({ path: pathValue, enabled: nextEnabled })
    });
    const finalEnabled = result?.enabled !== false;
    showMessage(`“${displayName}” 已${finalEnabled ? '启用' : '冻结'}`);
    await refreshGroupData();
  } catch (error) {
    console.error('更新类目状态失败:', error);
    showMessage(error?.message || '更新类目状态失败', 'error');
  } finally {
    groupManageActionLoading.delete(pathValue);
    renderGroupManageList();
  }
}

function handleGroupManageListClick(event) {
  const actionBtn = event.target.closest('[data-action]');
  if (!actionBtn) return;
  const item = actionBtn.closest('.group-manage-item');
  if (!item) return;
  const pathValue = item.dataset.path;
  if (!pathValue) return;
  if (groupManageActionLoading.has(pathValue) && actionBtn.dataset.action !== 'rename-cancel') {
    return;
  }

  if (actionBtn.dataset.action === 'rename') {
    groupManageEditingPath = pathValue;
    renderGroupManageList();
    const selectorPath = pathValue.replace(/"/g, '\\"');
    const nextRow = groupManageListEl?.querySelector(`[data-path="${selectorPath}"]`);
    const input = nextRow?.querySelector('.group-manage-rename-input');
    setTimeout(() => input?.focus(), 60);
    return;
  }

  if (actionBtn.dataset.action === 'rename-cancel') {
    groupManageEditingPath = null;
    renderGroupManageList();
    return;
  }

  if (actionBtn.dataset.action === 'rename-confirm') {
    const input = item.querySelector('.group-manage-rename-input');
    const nextName = input ? input.value : '';
    handleGroupRename(pathValue, nextName);
    return;
  }

  const safeName = item.querySelector('.group-manage-name')?.firstChild?.textContent?.trim() || pathValue;

  if (actionBtn.dataset.action === 'toggle') {
    const currentNode = findNodeByPath(groupTreeState, pathValue);
    const isCurrentlyEnabled = currentNode ? currentNode.enabled !== false : true;
    const nextEnabled = !isCurrentlyEnabled;
    handleGroupStatusToggle(pathValue, safeName, nextEnabled);
    return;
  }

  if (actionBtn.dataset.action === 'delete') {
    handleGroupDelete(pathValue, safeName);
  }
}

async function renderGroupList(prompts) {
  try {
    const groupTree = await apiCall('/groups');
    const container = document.getElementById('groupList');
    container.innerHTML = '';

    const promptMap = new Map();
    (Array.isArray(prompts) ? prompts : []).forEach(prompt => {
      const pathValue = prompt.groupPath || prompt.group || 'default';
      if (!promptMap.has(pathValue)) {
        promptMap.set(pathValue, []);
      }
      promptMap.get(pathValue).push(prompt);
    });

    if (currentPrompt) {
      const activePath = currentPrompt.groupPath || currentPrompt.group || 'default';
      collectAncestorPaths(activePath).forEach(pathValue => expandedGroups.add(pathValue));
    }

    const ensureDefaultNode = nodes => {
      const hasDefault = nodes.some(node => node.path === 'default');
      if (!hasDefault) {
        nodes.unshift({ name: 'default', path: 'default', children: [], enabled: true });
      }
    };

    ensureDefaultNode(groupTree);
    groupTreeState = Array.isArray(groupTree) ? groupTree : [];
    updateGroupSelectOptions(groupTreeState);

    const validPaths = new Set();
    const collectPaths = nodes => {
      nodes.forEach(node => {
        const nodePath = node.path || 'default';
        validPaths.add(nodePath);
        if (Array.isArray(node.children) && node.children.length) {
          collectPaths(node.children);
        }
      });
    };
    collectPaths(groupTree);
    expandedGroups = new Set([...expandedGroups].filter(pathValue => validPaths.has(pathValue)));

    const renderNode = (node, parentEl, depth = 0) => {
      const pathValue = node.path || 'default';
      const promptsInGroup = promptMap.get(pathValue) || [];

      const section = document.createElement('div');
      section.className = 'group-section';
      section.dataset.path = pathValue;
      section.dataset.depth = depth;

      const header = document.createElement('div');
      header.className = 'group-header';
      header.dataset.group = pathValue;
      let headerPadding = 16 + depth * 18;
      if (node.enabled === false) {
        headerPadding += 32;
      }
      header.style.paddingLeft = `${headerPadding}px`;

      const titleSpan = document.createElement('span');
      titleSpan.textContent = node.name;
      if (node.enabled === false) {
        section.classList.add('disabled');
      }
      header.appendChild(titleSpan);

      const headerActions = document.createElement('div');
      headerActions.style.display = 'flex';
      headerActions.style.alignItems = 'center';
      headerActions.style.gap = '6px';

      const countEl = document.createElement('span');
      countEl.className = 'group-count';
      countEl.id = `group-count-${sanitizeGroupId(pathValue)}`;
      countEl.textContent = promptsInGroup.length;

      const toggleEl = document.createElement('span');
      toggleEl.className = 'group-toggle';

      headerActions.appendChild(countEl);
      headerActions.appendChild(toggleEl);
      header.appendChild(headerActions);

      const content = document.createElement('div');
      content.className = 'group-content collapsed';

      const promptListEl = document.createElement('div');
      promptListEl.className = 'prompt-list';
      promptListEl.id = `promptList-${sanitizeGroupId(pathValue)}`;
      content.appendChild(promptListEl);

      renderGroupPromptList(promptListEl, pathValue, promptsInGroup);

      let totalCount = promptsInGroup.length;

      if (Array.isArray(node.children) && node.children.length) {
        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'group-children';
        node.children.forEach(child => {
          const childCount = renderNode(child, childrenWrap, depth + 1);
          totalCount += childCount;
        });
        if (childrenWrap.childNodes.length) {
          content.appendChild(childrenWrap);
        }
      }

      countEl.textContent = totalCount;

      const shouldExpandByDefault = expandedGroups.size === 0 && depth === 0;
      const isExpanded = expandedGroups.has(pathValue) || shouldExpandByDefault;
      if (shouldExpandByDefault) {
        expandedGroups.add(pathValue);
      }

      content.classList.toggle('expanded', isExpanded);
      content.classList.toggle('collapsed', !isExpanded);
      toggleEl.classList.toggle('collapsed', !isExpanded);

      header.addEventListener('click', (e) => {
        const isClickOnActions = e.target.closest('.toggle-btn') || e.target.closest('.delete-btn') || e.target.closest('.prompt-actions');
        if (!isClickOnActions) {
          const nextExpanded = !content.classList.contains('expanded');
          content.classList.toggle('expanded', nextExpanded);
          content.classList.toggle('collapsed', !nextExpanded);
          toggleEl.classList.toggle('collapsed', !nextExpanded);
          if (nextExpanded) {
            expandedGroups.add(pathValue);
          } else {
            expandedGroups.delete(pathValue);
          }
        }
      });

      section.appendChild(header);
      section.appendChild(content);
      parentEl.appendChild(section);
      return totalCount;
    };

    const fragment = document.createDocumentFragment();
    groupTree.forEach(node => renderNode(node, fragment, 0));
    container.appendChild(fragment);
    if (groupModalActiveTab === 'manage') {
      renderGroupManageList();
    }
  } catch (error) {
    console.error('渲染分组列表失败:', error);
  }
}

function renderGroupPromptList(container, groupPath, prompts) {
  container.innerHTML = '';

  const sortedPrompts = [...prompts].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'));

  if (!sortedPrompts.length) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'prompt-list-empty';
    emptyEl.innerHTML = `
      <span>该目录暂无 Prompt</span>
      请点击左上角"新建 Prompt"按钮创建。
    `;
    container.appendChild(emptyEl);
    return;
  }

  sortedPrompts.forEach(prompt => {
    const item = document.createElement('div');
    // 页面加载时不自动选中任何prompt，只有在用户点击后才设置为活动状态
    const isActive = false;
    item.className = `prompt-item ${prompt.enabled ? 'enabled' : ''} ${isActive ? 'active' : ''}`;
    const hasSubGroup = prompt.groupPath && prompt.groupPath.includes('/');
    const groupHint = hasSubGroup ? prompt.groupPath : (prompt.group || 'default');
    item.innerHTML = `
      <div class="prompt-info">
        <div class="prompt-name">${prompt.name}</div>
        <div class="prompt-desc" title="${prompt.description || ''}">${prompt.description || ''}</div>
        ${hasSubGroup ? `<div class="prompt-meta-hint">${groupHint}</div>` : ''}
      </div>
      <div class="prompt-meta">
        <div class="prompt-actions">
          <button class="action-btn toggle-btn" data-prompt="${prompt.name}" data-path="${prompt.relativePath || ''}">
            ${prompt.enabled ? '停用' : '启用'}
          </button>
          <button class="action-btn delete-btn" data-prompt="${prompt.name}" data-path="${prompt.relativePath || ''}" style="color: var(--danger);">
            删除
          </button>
        </div>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (!e.target.closest('.prompt-actions') && !e.target.classList.contains('toggle-btn') && !e.target.classList.contains('delete-btn')) {
        selectPrompt(prompt, e);
      }
    });

    const actions = item.querySelector('.prompt-actions');
    if (actions) {
      actions.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      const toggleBtn = item.querySelector('.toggle-btn');
      const deleteBtn = item.querySelector('.delete-btn');

      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const targetPath = toggleBtn.getAttribute('data-path');
          togglePrompt(prompt.name, targetPath);
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const targetPath = deleteBtn.getAttribute('data-path');
          openDeletePromptModal(prompt.name, targetPath);
        });
      }
    }

    container.appendChild(item);
  });
}

async function togglePrompt(promptName, relativePath) {
  try {
    const query = relativePath ? `?path=${encodeURIComponent(relativePath)}` : '';
    const result = await apiCall(`/prompts/${encodeURIComponent(promptName)}/toggle${query}`, {
      method: 'POST'
    });
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput ? searchInput.value : '';
    await loadPrompts(searchValue);
    const statusText = result?.enabled ? '已启用' : '已停用';
    showMessage(`"${promptName}" ${statusText}`, result?.enabled ? 'success' : 'info');
    if (currentPrompt?.relativePath === relativePath) {
      currentPrompt.enabled = result?.enabled;
      currentPromptObject = currentPromptObject ? { ...currentPromptObject, enabled: result?.enabled } : currentPromptObject;
    }
  } catch (error) {
    console.error('切换prompt状态失败:', error);
    showMessage('启用状态切换失败: ' + error.message, 'error');
  }
}

async function deletePrompt(promptName, relativePath) {
  try {
    const query = relativePath ? `?path=${encodeURIComponent(relativePath)}` : '';
    await apiCall(`/prompts/${encodeURIComponent(promptName)}${query}`, {
      method: 'DELETE'
    });
    if (currentPrompt?.relativePath === relativePath || (!currentPrompt?.relativePath && currentPrompt?.name === promptName)) {
      resetEditor();
    }
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput ? searchInput.value : '';
    await loadPrompts(searchValue);
    showMessage(`已删除 "${promptName}"`);
  } catch (error) {
    console.error('删除prompt失败:', error);
    showMessage('删除失败: ' + error.message, 'error');
  }
}

// 选择prompt
async function selectPrompt(prompt, triggerEvent) {
  try {
    // 显示加载中效果
    showLoading();
    
    // 显示prompt编辑区域
    showPromptEditorArea();
    
    const query = prompt.relativePath ? `?path=${encodeURIComponent(prompt.relativePath)}` : '';
    const promptData = await apiCall(`/prompts/${encodeURIComponent(prompt.name)}${query}`);
    currentPrompt = {
      ...promptData,
      relativePath: promptData.relativePath || prompt.relativePath || null,
      groupPath: promptData.groupPath || prompt.groupPath || null,
      group: promptData.group || prompt.group || null
    };

    let parsedPrompt = null;
    try {
      parsedPrompt = window.jsyaml?.load(promptData.yaml || '') || null;
    } catch (err) {
      console.error('解析提示词失败:', err);
    }

    currentPromptObject = parsedPrompt ? clonePromptObject(parsedPrompt) : createDefaultPromptObject();
    setArgumentsState(currentPromptObject.arguments || []);

    const nameInput = document.getElementById('promptName');
    if (nameInput) nameInput.value = currentPromptObject.name || promptData.name || '';
    const promptGroupSelect = document.getElementById('promptGroup');
    if (promptGroupSelect) {
      const resolvedGroup =
        promptData.groupPath ||
        promptData.group ||
        prompt.groupPath ||
        prompt.group ||
        'default';

      const optionExists = Array.from(promptGroupSelect.options || []).some(
        option => option.value === resolvedGroup
      );
      if (!optionExists) {
        const optionEl = document.createElement('option');
        optionEl.value = resolvedGroup;
        optionEl.textContent = resolvedGroup;
        promptGroupSelect.appendChild(optionEl);
      }

      promptGroupSelect.value = resolvedGroup;
      updatePromptGroupDisplay();
      setCascaderActivePathsByValue(resolvedGroup);
      if (isGroupDropdownOpen) {
        renderGroupDropdownContent(promptGroupSearchInput?.value || '');
      }
    }

    if (descriptionInputEl) {
      descriptionInputEl.value = currentPromptObject.description || '';
      adjustDescriptionHeight();
    }

    // 获取用户消息内容，使用更健壮的逻辑
    let messageText = '';
    
    // 首先尝试使用现有的getFirstUserMessage函数
    const userMessage = getFirstUserMessage(currentPromptObject);
    
    // 如果没找到，尝试其他方法获取内容
    if (!userMessage && currentPromptObject.messages && Array.isArray(currentPromptObject.messages)) {
      // 查找role为'user'的消息
      const userMsg = currentPromptObject.messages.find(msg => msg?.role === 'user');
      if (userMsg) {
        // 处理不同的content格式
        if (typeof userMsg.content === 'string') {
          messageText = userMsg.content;
        } else if (userMsg.content?.text) {
          messageText = userMsg.content.text;
        } else if (userMsg.content) {
          // 如果content是对象，尝试转换为字符串
          messageText = JSON.stringify(userMsg.content, null, 2);
        }
      }
    } else if (userMessage) {
      // 处理从getFirstUserMessage获取到的消息
      if (typeof userMessage.content === 'string') {
        messageText = userMessage.content;
      } else if (userMessage.content?.text) {
        messageText = userMessage.content.text;
      } else if (userMessage.content) {
        // 如果content是对象，尝试转换为字符串
        messageText = JSON.stringify(userMessage.content, null, 2);
      }
    }
    
    // 如果还是空，提供默认提示
    if (!messageText) {
      messageText = '';
    }
    
    if (editor) {
      editor.setValue(messageText);
      // 强制刷新编辑器以确保内容显示
      setTimeout(() => {
        if (editor && typeof editor.requestMeasure === 'function') {
          editor.requestMeasure();
        }
        // 再添加一个延迟刷新，确保内容显示
        setTimeout(() => {
          if (editor && typeof editor.dispatch === 'function') {
            editor.dispatch({
              selection: { anchor: 0 }
            });
          }
        }, 50);
      }, 10);
    }

    // 更新UI状态
    document.querySelectorAll('.prompt-item').forEach(el => el.classList.remove('active'));
    const targetItem = triggerEvent?.currentTarget || triggerEvent?.target?.closest('.prompt-item');
    if (targetItem) {
      targetItem.classList.add('active');
    }

    // 更新预览
    updatePreview(true);
  } catch (error) {
    console.error('加载prompt详情失败:', error);
  } finally {
    // 隐藏加载中效果
    hideLoading();
  }
}

// 切换工作区模式
function setWorkspaceMode(mode) {
  // 确保编辑区域是可见的
  showPromptEditorArea();
  
  const isPreview = mode === 'preview';
  const editorPane = document.getElementById('editorPane');
  const previewPane = document.getElementById('previewPane');
  const editModeBtn = document.getElementById('editModeBtn');
  const previewModeBtn = document.getElementById('previewModeBtn');
  const argumentsSection = document.getElementById('argumentsSection');

  if (!editorPane || !previewPane || !editModeBtn || !previewModeBtn) return;

  editModeBtn.classList.toggle('active', !isPreview);
  previewModeBtn.classList.toggle('active', isPreview);
  editorPane.classList.toggle('hidden', isPreview);
  previewPane.classList.toggle('hidden', !isPreview);
  
  // 在预览模式下隐藏参数配置区域，编辑模式下显示
  if (argumentsSection) {
    argumentsSection.style.display = isPreview ? 'none' : 'flex';
  }

  if (isPreview) {
    updatePreview(true);
  } else {
    // 在切换回编辑模式时清理预览编辑器
    if (previewEditor) {
      try {
        // 检查编辑器是否仍然连接到DOM
        if (previewEditor.getTextArea() && previewEditor.getTextArea().parentNode) {
          // 销毁预览编辑器实例
          previewEditor.toTextArea();
        }
      } catch (e) {
        console.warn('Error destroying preview editor:', e);
        // 如果销毁失败，尝试直接清除内容
        const previewContent = document.getElementById('previewContent');
        if (previewContent) {
          previewContent.innerHTML = '<p>切换到预览模式查看内容</p>';
        }
      }
      previewEditor = null;
    }
  }
}

// 更新预览
let previewEditor = null;

async function updatePreview(force = false) {
  if (!editor) return;

  const previewPane = document.getElementById('previewPane');
  if (!force && previewPane?.classList.contains('hidden')) {
    return;
  }

  try {
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    const content = editor.getValue();
    
    // 如果预览编辑器不存在，创建一个
    if (!previewEditor) {
      previewContent.innerHTML = '';
      // 创建 textarea 并转换为 CodeMirror 预览编辑器
      const textarea = document.createElement('textarea');
      textarea.value = content;
      previewContent.appendChild(textarea);
      
      // 使用 CodeMirror 5 创建只读预览
      previewEditor = CodeMirror.fromTextArea(textarea, {
        mode: 'markdown',
        theme: 'xq-light',
        lineNumbers: false,
        lineWrapping: true,
        readOnly: true,
        viewportMargin: Infinity
      });
    } else {
      // 更新预览内容
      previewEditor.setValue(content);
    }

  } catch (error) {
    console.error('预览更新失败:', error);
    document.getElementById('previewContent').innerHTML = '<p style="color: red;">预览生成失败</p>';
  }
}

// 保存prompt
async function savePrompt() {
  if (!editor) return;

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn?.disabled) return;

  const name = document.getElementById('promptName').value.trim();
  const group = document.getElementById('promptGroup').value.trim();

  if (!window.jsyaml) {
    showMessage('资源未准备就绪，请刷新重试', 'error');
    return;
  }

  if (!name) {
    showMessage('请输入prompt名称', 'error');
    return;
  }

  const promptObject = buildPromptObjectFromUI();
  const unusedArguments = findUnusedArguments(promptObject);
  if (unusedArguments.length > 0) {
    const missingNames = unusedArguments.map(arg => arg.name).filter(Boolean);
    if (missingNames.length) {
      setUnusedArgumentHighlights(missingNames);
      const argumentsSection = document.getElementById('argumentsSection');
      if (argumentsSection) {
        argumentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      showMessage(`以下参数未在内容中使用：${missingNames.join(', ')}`, 'error');
      const firstMissing = missingNames[0];
      requestAnimationFrame(() => {
        const listEl = document.getElementById('argumentsList');
        if (!listEl) return;
        const targetCard = Array.from(listEl.querySelectorAll('.argument-card')).find(card => {
          const idx = Number(card.dataset.index);
          const argName = argumentsState[idx]?.name?.trim();
          return argName === firstMissing;
        });
        if (targetCard) {
          const targetIndex = Number(targetCard.dataset.index);
          if (Number.isInteger(targetIndex)) {
            openArgumentModal(targetIndex);
          }
        }
      });
      return;
    }
  } else {
    setUnusedArgumentHighlights([]);
  }
  const yaml = window.jsyaml.dump(promptObject);

  let originalText = '';
  if (saveBtn) {
    originalText = (saveBtn.textContent || '保存').trim();
    saveBtn.disabled = true;
    saveBtn.classList.add('loading');
    saveBtn.textContent = '保存中...';
  }
  
  try {
    // 显示加载中效果
    showLoading();

    const result = await apiCall('/prompts', {
      method: 'POST',
      body: JSON.stringify({
        name,
        group,
        yaml,
        relativePath: currentPrompt?.relativePath || null
      })
    });
    
    showMessage('保存成功');
    currentPromptObject = clonePromptObject(promptObject);
    const updatedRelativePath = result?.relativePath || currentPrompt?.relativePath || null;
    const pathSegments = updatedRelativePath ? updatedRelativePath.split('/') : [];
    const updatedGroupPath = pathSegments.length > 1 ? pathSegments.slice(0, -1).join('/') : (pathSegments[0] || currentPrompt?.groupPath || group || 'default');
    currentPrompt = {
      ...(currentPrompt || {}),
      name,
      relativePath: updatedRelativePath,
      group: result?.group || group,
      groupPath: updatedGroupPath
    };
    // 重新加载列表，传递搜索参数
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput ? searchInput.value : '';
    await loadPrompts(searchValue);
  } catch (error) {
    console.error('保存失败:', error);
    if (!error?.__shown) {
      showMessage('保存失败: ' + (error?.message || '未知错误'), 'error');
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.classList.remove('loading');
      saveBtn.textContent = originalText;
    }
    // 隐藏加载中效果
    hideLoading();
  }
}

// 重置编辑器
function resetEditor() {
  document.getElementById('promptName').value = '';
  const groupSelect = document.getElementById('promptGroup');
  if (groupSelect) {
    groupSelect.value = 'default';
    updatePromptGroupDisplay();
    setCascaderActivePathsByValue('default');
    if (isGroupDropdownOpen) {
      renderGroupDropdownContent(promptGroupSearchInput?.value || '');
    }
  }
  if (editor) editor.setValue('');
  if (descriptionInputEl) {
    descriptionInputEl.value = '';
    adjustDescriptionHeight();
  }
  setArgumentsState([]);
  currentPrompt = null;
  currentPromptObject = null;
  document.getElementById('previewContent').innerHTML = '<p>选择或创建prompt开始编辑</p>';
  setWorkspaceMode('edit');
}

// 新建prompt
function newPrompt() {
  // 显示加载中效果
  showLoading();
  
  // 显示prompt编辑区域
  showPromptEditorArea();
  
  currentPrompt = null;
  currentPromptObject = createDefaultPromptObject();

  const nameInput = document.getElementById('promptName');
  if (nameInput) nameInput.value = currentPromptObject.name;
  const groupSelect = document.getElementById('promptGroup');
  if (groupSelect) {
    groupSelect.value = 'default';
    updatePromptGroupDisplay();
    setCascaderActivePathsByValue('default');
    if (isGroupDropdownOpen) {
      renderGroupDropdownContent(promptGroupSearchInput?.value || '');
    }
  }

  const defaultMessage = getFirstUserMessage(currentPromptObject);
  if (editor) {
    editor.setValue(defaultMessage?.content?.text || '');
  }

  setArgumentsState(currentPromptObject.arguments || []);

  if (descriptionInputEl) {
    descriptionInputEl.value = currentPromptObject.description || '';
    adjustDescriptionHeight();
  }

  document.getElementById('previewContent').innerHTML = '<p>选择或创建prompt开始编辑</p>';
  setWorkspaceMode('edit');

  document.querySelectorAll('.prompt-item').forEach(el => el.classList.remove('active'));
  updatePreview(true);
  
  // 隐藏加载中效果
  hideLoading();
}

// 打开/关闭新建目录弹窗
function toggleNewFolderModal(show) {
  const modal = document.getElementById('newFolderModal');
  const input = document.getElementById('newFolderName');
  const shouldShow = typeof show === 'boolean' ? show : modal.classList.contains('hidden');
  modal.classList.toggle('hidden', !shouldShow);

  if (shouldShow) {
    document.body.style.overflow = 'hidden';
    if (input) input.value = '';
    resetGroupManageState();
    setGroupModalTab('create');
    populateParentFolderSelect(); // 填充父级目录选择框
  } else {
    document.body.style.overflow = '';
    if (input) input.value = '';
    groupManageEditingPath = null;
    groupManageActionLoading.clear();
  }
}

// 将函数挂载到全局window对象，以便HTML中的内联事件可以访问
window.toggleNewFolderModal = toggleNewFolderModal;
window.handleNewFolderKeydown = handleNewFolderKeydown;
window.createNewFolder = createNewFolder;

// 处理目录名输入框的键盘事件
function handleNewFolderKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    createNewFolder();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    toggleNewFolderModal(false);
  }
}

// 填充父级目录选择框
function populateParentFolderSelect() {
  const select = document.getElementById('newFolderParent');
  if (!select) return;
  
  // 清空现有选项
  select.innerHTML = '<option value="">根目录</option>';
  
  // 添加所有现有目录作为选项
  const flattenedGroups = flattenGroupTree(groupTreeState || []);
  flattenedGroups.forEach(group => {
    if (group.path !== 'default') { // 排除默认组
      const option = document.createElement('option');
      option.value = group.path;
      option.textContent = group.path;
      select.appendChild(option);
    }
  });
}

// 创建新目录
async function createNewFolder() {
  const nameInput = document.getElementById('newFolderName');
  const parentSelect = document.getElementById('newFolderParent');
  const folderName = (nameInput?.value || '').trim();
  const parentPath = (parentSelect?.value || '').trim();
  
  if (!folderName) {
    showMessage('请输入目录名称', 'error');
    nameInput?.focus();
    return;
  }

  // 验证目录名称格式
  if (!/^[a-zA-Z0-9-_一-龥]{1,64}$/.test(folderName)) {
    showMessage('目录名称格式无效，只能包含字母、数字、中划线、下划线和中文', 'error');
    nameInput?.focus();
    return;
  }

  try {
    const requestData = { name: folderName };
    if (parentPath) {
      requestData.parent = parentPath;
    }
    
    await apiCall('/groups', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
    
    showMessage('类目创建成功');
    toggleNewFolderModal(false);
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput ? searchInput.value : '';
    await loadPrompts(searchValue);
  } catch (error) {
    console.error('创建目录失败:', error);
    showMessage(error.message || '创建类目失败', 'error');
  }
}

// 刷新模态框打开状态
function refreshModalOpenState() {
  const hasOpenModal =
    (argumentModalEl && !argumentModalEl.classList.contains('hidden')) ||
    (deletePromptModalEl && !deletePromptModalEl.classList.contains('hidden'));
  if (hasOpenModal) {
    document.body.classList.add('modal-open');
  } else {
    document.body.classList.remove('modal-open');
  }
}

// 初始化应用
async function initApp() {
  try {
    // 等待 CodeMirror 加载完成
    editor = await initCodeMirror();

    const editModeBtn = document.getElementById('editModeBtn');
    const previewModeBtn = document.getElementById('previewModeBtn');
    editModeBtn.addEventListener('click', () => setWorkspaceMode('edit'));
    previewModeBtn.addEventListener('click', () => setWorkspaceMode('preview'));
    setWorkspaceMode('edit');

    descriptionInputEl = document.getElementById('promptDescription');
    if (descriptionInputEl) {
      descriptionInputEl.addEventListener('input', adjustDescriptionHeight);
      adjustDescriptionHeight();
    }

    setArgumentsState([]);

    argumentModalEl = document.getElementById('argumentModal');
    argumentFormEl = document.getElementById('argumentForm');
    argumentModalTitleEl = document.getElementById('argumentModalTitle');
    argumentNameInput = document.getElementById('argumentNameInput');
    argumentTypeInput = document.getElementById('argumentTypeInput');
    argumentRequiredInput = document.getElementById('argumentRequiredInput');
    argumentDefaultInput = document.getElementById('argumentDefaultInput');
    argumentDescriptionInput = document.getElementById('argumentDescriptionInput');
    deletePromptModalEl = document.getElementById('deletePromptModal');
    deletePromptNameEl = document.getElementById('deletePromptName');
    deletePromptConfirmBtn = document.getElementById('deletePromptConfirmBtn');
    deletePromptCancelBtn = document.getElementById('deletePromptCancelBtn');
    deletePromptCloseBtn = document.getElementById('deletePromptCloseBtn');
    promptGroupBtnEl = document.getElementById('promptGroupBtn');
    promptGroupLabelEl = document.getElementById('promptGroupLabel');
    promptGroupDropdownEl = document.getElementById('promptGroupDropdown');
    promptGroupSearchInput = document.getElementById('promptGroupSearch');
    promptGroupCascaderEl = document.getElementById('promptGroupCascader');
    promptGroupSearchResultsEl = document.getElementById('promptGroupSearchResults');
    promptGroupEmptyEl = document.getElementById('promptGroupEmpty');
    groupManageListEl = document.getElementById('groupManageList');
    groupManageEmptyEl = document.getElementById('groupManageEmpty');
    groupManageSearchInputEl = document.getElementById('groupManageSearch');

    // 绑定参数表单事件
    if (argumentFormEl) {
      argumentFormEl.addEventListener('submit', handleArgumentFormSubmit);
    }

    // 绑定参数列表点击事件
    document.getElementById('argumentsList').addEventListener('click', handleArgumentListClick);

    // 绑定参数按钮事件
    document.getElementById('addArgumentBtn').addEventListener('click', () => openArgumentModal());

    // 绑定参数模态框事件
    document.getElementById('argumentModalClose').addEventListener('click', closeArgumentModal);
    document.getElementById('argumentCancelBtn').addEventListener('click', closeArgumentModal);

    // 绑定删除提示模态框事件
    document.getElementById('deletePromptConfirmBtn').addEventListener('click', confirmDeletePrompt);
    const closeDeleteHandlers = [deletePromptCancelBtn, deletePromptCloseBtn];
    closeDeleteHandlers.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', closeDeletePromptModal);
      }
    });
    if (deletePromptModalEl) {
      deletePromptModalEl.addEventListener('click', (event) => {
        if (event.target === deletePromptModalEl) {
          closeDeletePromptModal();
        }
      });
    }

    // 绑定组选择器事件
    promptGroupBtnEl.addEventListener('click', () => toggleGroupDropdown());
    if (promptGroupSearchInput) {
      promptGroupSearchInput.addEventListener('input', () => {
        renderGroupDropdownContent(promptGroupSearchInput.value);
      });
    }
    document.addEventListener('click', (event) => {
      if (!promptGroupDropdownEl.contains(event.target) && !promptGroupBtnEl.contains(event.target)) {
        closeGroupDropdown();
      }
    });

    // 绑定键盘事件
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (isGroupDropdownOpen) {
          closeGroupDropdown(true);
          return;
        }
        if (argumentModalEl && !argumentModalEl.classList.contains('hidden')) {
          closeArgumentModal();
          return;
        }
        if (deletePromptModalEl && !deletePromptModalEl.classList.contains('hidden')) {
          closeDeletePromptModal();
        }
      }
    });

    // 绑定管理类目列表事件
    if (groupManageListEl) {
      groupManageListEl.addEventListener('click', handleGroupManageListClick);
      groupManageSearchInputEl?.addEventListener('input', handleGroupManageSearchInput);
    }

    // 绑定新建目录模态框事件
    document.getElementById('groupManageRefreshBtn').addEventListener('click', () => {
      renderGroupManageList();
    });

    // 绑定标签页切换事件
    document.querySelectorAll('.group-modal-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        setGroupModalTab(tabName);
      });
    });

    // 绑定事件
    document.getElementById('loginBtn').addEventListener('click', () => {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();
      
      if (!username || !password) {
        document.getElementById('loginError').textContent = '请输入用户名和密码';
        return;
      }
      
      login(username, password);
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('newPromptBtn').addEventListener('click', newPrompt);
    document.getElementById('newGroupBtn').addEventListener('click', () => toggleNewFolderModal(true));
    document.getElementById('saveBtn').addEventListener('click', savePrompt);

    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      const searchBox = searchInput.closest('.search-box');
      const clearBtn = searchBox?.querySelector('.clear-btn');
      let searchTimeout;

      // 搜索输入事件
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          loadPrompts(searchInput.value);
        }, 300);
      });

      // 清除按钮点击事件
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          searchInput.focus();
          loadPrompts('');
        });
      }

      // ESC 键清除搜索
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          loadPrompts('');
        }
      });
    }

    // 设置用户菜单
    setupUserMenu();

    // 重新加载配置后，根据认证要求设置登录界面的显示
    updateLoginDisplay();

  } catch (err) {
    console.error('初始化错误:', err);
    document.getElementById('loginError').textContent = '资源加载失败，请刷新重试';
    throw err;
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkAuthRequirement();
    setupLoginEvents();
    
    // 检查登录状态
    if (currentToken || !requireAuth) {
      showMain();
      showLoading(); // 显示加载中效果
      loadPrompts(); // 先加载提示词列表
      await initApp(); // 然后初始化应用
      // 页面加载后显示自定义的空白内容区域，不显示编辑器
      showCustomBlankContent();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('应用初始化失败:', error);
    // 如果初始化失败，显示登录界面作为降级方案
    try {
      showLogin();
    } catch (showLoginError) {
      console.error('显示登录界面也失败:', showLoginError);
      // 作为最后的手段，直接显示主界面
      document.getElementById('login').style.display = 'none';
      document.getElementById('main').style.display = 'block';
    }
  } finally {
    // 隐藏加载中效果
    hideLoading();
  }
});

// 显示自定义空白内容区域
function showCustomBlankContent() {
  const customBlankContent = document.getElementById('customBlankContent');
  const promptEditorArea = document.getElementById('promptEditorArea');
  
  if (customBlankContent) {
    customBlankContent.style.display = 'flex';
  }
  
  if (promptEditorArea) {
    promptEditorArea.style.display = 'none';
  }
  
  // 清空编辑器内容
  if (editor) {
    editor.setValue('');
  }
  // 清空其他编辑区域
  const nameInput = document.getElementById('promptName');
  if (nameInput) nameInput.value = '';
  if (descriptionInputEl) {
    descriptionInputEl.value = '';
    adjustDescriptionHeight();
  }
  // 清除所有选中的prompt状态
  document.querySelectorAll('.prompt-item').forEach(el => el.classList.remove('active'));
  // 重置当前prompt状态
  currentPrompt = null;
  currentPromptObject = null;
  setArgumentsState([]);
}

// 显示prompt编辑区域
function showPromptEditorArea() {
  const customBlankContent = document.getElementById('customBlankContent');
  const promptEditorArea = document.getElementById('promptEditorArea');
  
  if (customBlankContent) {
    customBlankContent.style.display = 'none';
  }
  
  if (promptEditorArea) {
    promptEditorArea.style.display = 'flex';
  }
}

// 处理登录页面的回车事件和按钮点击
function setupLoginEvents() {
  const loginForm = document.getElementById('login');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');

  // 自动聚焦到用户名输入框
  if (usernameInput) {
    usernameInput.focus();
  }

  function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (username && password) {
      login(username, password);
    }
  }

  // 监听整个页面的回车事件
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && loginForm.style.display !== 'none') {
      e.preventDefault();
      handleLogin();
    }
  });

  // 登录按钮点击事件
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleLogin();
  });

  // Tab 键切换焦点时的优化
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!usernameInput.value.trim()) {
        usernameInput.focus();
      } else {
        passwordInput.focus();
      }
    }
  });

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!passwordInput.value) {
        passwordInput.focus();
      } else {
        handleLogin();
      }
    }
  });
}