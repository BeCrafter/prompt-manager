// src/index.js - 主应用入口文件

// 导入样式
import '../css/main.css';
import '../css/terminal.css';
import '../css/recommended-prompts.css';
import '../css/markdown.css';
import '../css/optimization.css';
import '../css/skills.css';
import 'highlight.js/styles/github.css';

// 导入组件
import { LoginView } from './components/LoginView';
import { HeaderView } from './components/HeaderView';
import { PrimaryNav } from './components/PrimaryNav';
import { SidebarView } from './components/SidebarView';
import { ToolsArea } from './components/ToolsArea';
import { TerminalView } from './components/TerminalView';
import { PromptsArea } from './components/PromptsArea';
import { NewFolderModal } from './components/NewFolderModal';
import { ArgumentModal } from './components/ArgumentModal';
import { DeletePromptModal } from './components/DeletePromptModal';
import { ToolsUploadModal } from './components/ToolsUploadModal';
import { ToolDetailModal } from './components/ToolDetailModal';
import { RecommendedPromptModal } from './components/RecommendedPromptModal';
import { SyncPromptModal } from './components/SyncPromptModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { OptimizationDrawer } from './components/OptimizationDrawer';
import { TemplateListModal } from './components/TemplateListModal';
import { TemplateEditorModal } from './components/TemplateEditorModal';
import { SkillsArea } from './components/SkillsArea';
import { SkillsUploadModal } from './components/SkillsUploadModal';
import { DeleteSkillModal } from './components/DeleteSkillModal';
import { ModelConfigModal } from './components/ModelConfigModal';
import { OptimizationConfigModal } from './components/OptimizationConfigModal';

// 暴露到全局，让内联 onclick 可以访问
window.SkillsArea = SkillsArea;

// 导入 CodeMirror 相关功能
import { initCodeMirror } from './codemirror';
import { getBackendUrl } from './utils/env-loader.js';

// 导入终端组件
import { TerminalComponent } from './components/TerminalComponent.js';

// 导入 CodeMirror 5 组件用于预览编辑器
import CodeMirror from 'codemirror';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';

// 导入 markdown 渲染相关库
import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

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
// 优化功能状态
let optimizationSessionId = null;
let optimizationResult = '';
let isOptimizing = false;
let currentTemplates = [];
let currentModels = [];
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
// 当前激活的导航项
let currentNav = 'prompts';

// 终端组件实例
let terminalComponent = null;

// 初始化后端URL
const API_HOST = getBackendUrl();
console.log('🚀 前端应用启动调试信息:');
console.log('  API_HOST:', API_HOST);
console.log('  window.location.origin:', window.location.origin);
console.log('  process.env.HTTP_PORT:', process.env.HTTP_PORT);

// API 基础配置
const API_BASE = `${API_HOST}/adminapi`;
const API_SURGE = `${API_HOST}/surge/`;
console.log('  API_BASE:', API_BASE);

// 测试后端连接
async function testBackendConnection() {
  try {
    console.log('🔍 测试后端连接...');
    const response = await fetch(`${API_BASE}/config/public`);
    const data = await response.json();
    console.log('✅ 后端连接成功:', data);
    return true;
  } catch (error) {
    console.error('❌ 后端连接失败:', error);
    return false;
  }
}

// 页面加载完成后测试连接
window.addEventListener('load', () => {
  setTimeout(testBackendConnection, 1000);
});

/**
 * 初始化 DOM 组件
 * 将拆分的 HTML 片段注入到页面中，并替换挂载点以保持原有 DOM 层级
 */
function initDOMComponents() {
  const mountComponent = (wrapperId, html) => {
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
      const fragment = document.createRange().createContextualFragment(html);
      wrapper.replaceWith(fragment);
    }
  };

  mountComponent('login-wrapper', LoginView.getHTML());
  mountComponent('header-wrapper', HeaderView.getHTML());
  mountComponent('primary-nav-wrapper', PrimaryNav.getHTML());
  mountComponent('sidebar-wrapper', SidebarView.getHTML());
  mountComponent('tools-area-wrapper', ToolsArea.getHTML());
  mountComponent('terminal-area-wrapper', TerminalView.getHTML());
  mountComponent('prompts-area-wrapper', PromptsArea.getHTML());
  mountComponent('skills-area-wrapper', SkillsArea.getHTML());

  // 注入弹窗和覆盖层到 body 末尾
  const modalContainer = document.createElement('div');
  modalContainer.id = 'modal-container';
  modalContainer.innerHTML = `
    ${NewFolderModal.getHTML()}
    ${ArgumentModal.getHTML()}
    ${DeletePromptModal.getHTML()}
    ${ToolsUploadModal.getHTML()}
    ${ToolDetailModal.getHTML()}
    ${RecommendedPromptModal.getHTML()}
    ${SyncPromptModal.getHTML()}
    ${SkillsUploadModal.getHTML()}
    ${DeleteSkillModal.getHTML()}
    ${LoadingOverlay.getHTML()}
    ${OptimizationDrawer.getHTML()}
    ${TemplateListModal.getHTML()}
    ${TemplateEditorModal.getHTML()}
    ${ModelConfigModal.getHTML()}
    ${OptimizationConfigModal.getHTML()}
  `;
  document.body.appendChild(modalContainer);
}

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
  console.log('[showMain] Called');
  document.getElementById('login').style.display = 'none';
  document.getElementById('main').style.display = 'block';
  // 初始化技能管理区域
  console.log('[showMain] typeof SkillsArea:', typeof SkillsArea);
  if (typeof SkillsArea !== 'undefined' && SkillsArea.init) {
    console.log('[showMain] Calling SkillsArea.init()');
    SkillsArea.init().catch(error => {
      console.error('初始化技能管理区域失败:', error);
    });
  }
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
async function loadPrompts(search = '', enabledOnly = false, group = null, showLoadingIndicator = true) {
  try {
    // 只在需要时显示加载中效果（初始加载时）
    if (showLoadingIndicator) {
      showLoading();
    }
    
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
    // 只在显示了加载效果时才隐藏
    if (showLoadingIndicator) {
      hideLoading();
    }
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
      userMenu.parentElement.classList.remove('hidden');
      avatarBtn.classList.remove('no-auth');
      avatarBtn.setAttribute('aria-haspopup', 'true');
    } else {
      userMenu.parentElement.classList.add('hidden');
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

  // 更新参数计数
  const countEl = document.getElementById('argumentsCount');
  if (countEl) {
    countEl.textContent = `(${argumentsState.length})`;
  }

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
  if (!/^(?![.]{1,2}$)[^\\/:*?"<>|\r\n]{1,64}$/.test(trimmedName)) {
    showMessage('名称格式无效，不能包含 / \\ : * ? \" < > | 或换行，长度需在1-64字符', 'error');
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
    // 不显示加载动画，避免闪动
    await loadPrompts(searchValue, false, null, false);
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
    // 不显示加载动画，避免闪动
    await loadPrompts(searchValue, false, null, false);
    showMessage(`已删除 "${promptName}"`);
  } catch (error) {
    console.error('删除prompt失败:', error);
    showMessage('删除失败: ' + error.message, 'error');
  }
}

// 选择prompt
async function selectPrompt(prompt, triggerEvent) {
  try {
    // 显示prompt编辑区域（不显示全屏加载效果，避免闪动）
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
    showMessage('加载提示词失败', 'error');
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
  const descriptionEl = document.getElementById('promptDescription');

  if (!editorPane || !previewPane || !editModeBtn || !previewModeBtn) return;

  editModeBtn.classList.toggle('active', !isPreview);
  previewModeBtn.classList.toggle('active', isPreview);
  editorPane.classList.toggle('hidden', isPreview);
  previewPane.classList.toggle('hidden', !isPreview);
  
  // 在预览模式下隐藏参数配置区域和描述信息，编辑模式下显示
  if (argumentsSection) {
    argumentsSection.style.display = isPreview ? 'none' : 'flex';
  }

  // 描述信息不隐藏，保持显示
  // if (descriptionEl) {
  //   descriptionEl.style.display = isPreview ? 'none' : 'block';
  // }

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
    // saveBtn.textContent = '保存中...';
  }
  
  try {
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
    // 重新加载列表，传递搜索参数，不显示加载动画
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput ? searchInput.value : '';
    await loadPrompts(searchValue, false, null, false);
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

// 切换工具卡片meta tab
function switchMetaTab(toolId, tabType, triggerTab = null) {
  const triggeringCard =
    triggerTab && triggerTab.closest ? triggerTab.closest('.tool-card') : null;
  const cardElement =
    triggeringCard || document.querySelector(`.tool-card[data-tool-id="${toolId}"]`);
  if (!cardElement) {
    console.warn('Tool card not found for', toolId);
    return;
  }

  const tabsContainer = cardElement.querySelector('.tool-card-meta-tabs');
  const panelsContainer = cardElement.querySelector('.tool-card-meta-content');

  if (!tabsContainer || !panelsContainer) {
    console.warn('Containers not found for toolId:', toolId);
    return;
  }
  
  // 切换tab状态
  const tabs = tabsContainer.querySelectorAll('.tool-card-meta-tab');
  tabs.forEach((tab, index) => {
    tab.classList.remove('active');
    
    if (tab.classList.contains(`${tabType}-tab`)) {
      tab.classList.add('active');
    }
  });
  
  // 切换面板状态
  const panels = panelsContainer.querySelectorAll('.tool-card-meta-panel');
  panels.forEach((panel, index) => {
    panel.classList.remove('active');
    
    if (panel.classList.contains(tabType)) {
      panel.classList.add('active');
    }
  });
}

// 将函数挂载到全局window对象，以便HTML中的内联事件可以访问
window.toggleNewFolderModal = toggleNewFolderModal;
window.handleNewFolderKeydown = handleNewFolderKeydown;
window.createNewFolder = createNewFolder;
window.switchMetaTab = switchMetaTab;

// 处理目录名输入框的键盘事件
function handleNewFolderKeydown(event) {
  if (event.key === 'Enter' && !event.isComposing) {
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
  if (!/^(?![.]{1,2}$)[^\\/:*?"<>|\r\n]{1,64}$/.test(folderName)) {
    showMessage('目录名称格式无效，不能包含 / \\ : * ? \" < > | 或换行，长度需在1-64字符', 'error');
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

    // 绑定参数配置区域折叠事件
    const argumentsHeaderToggle = document.getElementById('argumentsHeaderToggle');
    const argumentsSection = document.getElementById('argumentsSection');
    const argumentsToggleBtn = document.getElementById('argumentsToggleBtn');
    if (argumentsHeaderToggle && argumentsSection) {
      argumentsHeaderToggle.addEventListener('click', (e) => {
        // 如果点击的是"新增"按钮，不触发折叠
        if (e.target.closest('#addArgumentBtn')) {
          return;
        }
        const isCollapsed = argumentsSection.classList.toggle('collapsed');
        if (argumentsToggleBtn) {
          argumentsToggleBtn.setAttribute('aria-expanded', !isCollapsed);
        }
      });
    }

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
    document.getElementById('newPromptBtnInBlankArea').addEventListener('click', newPrompt);
    document.getElementById('newGroupBtn').addEventListener('click', () => toggleNewFolderModal(true));
    document.getElementById('saveBtn').addEventListener('click', savePrompt);
    
    // 返回列表按钮事件处理
    const backToListBtn = document.getElementById('backToListBtn');
    if (backToListBtn) {
      backToListBtn.addEventListener('click', () => {
        showCustomBlankContent();
        currentPrompt = null;
        currentPromptObject = null;
      });
    }

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

    // 初始化优化功能
    initOptimization();

  } catch (err) {
    console.error('初始化错误:', err);
    document.getElementById('loginError').textContent = '资源加载失败，请刷新重试';
    throw err;
  }
}

// ==================== 优化功能初始化 ====================

function initOptimization() {
  // 绑定 AI 优化按钮事件
  const aiOptimizeBtn = document.getElementById('aiOptimizeBtn');
  if (aiOptimizeBtn) {
    aiOptimizeBtn.addEventListener('click', openOptimizationDrawer);
  }

  // 绑定优化抽屉事件
  setupOptimizationDrawerEvents();

  // 加载模板和模型列表
  loadTemplates();
  loadModels();
}

// ==================== 优化抽屉事件 ====================

function setupOptimizationDrawerEvents() {
  // 关闭抽屉
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const drawerOverlay = document.querySelector('.drawer-overlay');

  [closeDrawerBtn, cancelBtn, drawerOverlay].forEach(el => {
    if (el) {
      el.addEventListener('click', closeOptimizationDrawer);
    }
  });

  // 配置模型按钮（在下拉列表中）
  const configModelAction = document.getElementById('configModelAction');
  if (configModelAction) {
    configModelAction.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllCustomSelects();
      openModelConfigModal();
    });
  }

  // 配置模板按钮（在下拉列表中）
  const configTemplateAction = document.getElementById('configTemplateAction');
  if (configTemplateAction) {
    configTemplateAction.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllCustomSelects();
      openTemplateListModal();
    });
  }

  // 开始优化按钮
  const startOptimizeBtn = document.getElementById('startOptimizeBtn');
  if (startOptimizeBtn) {
    startOptimizeBtn.addEventListener('click', startOptimization);
  }

  // 继续优化按钮
  const iterateBtn = document.getElementById('iterateBtn');
  if (iterateBtn) {
    iterateBtn.addEventListener('click', iterateOptimization);
  }

  // 迭代优化指导弹窗事件
  const iterationGuideModalClose = document.getElementById('iterationGuideModalClose');
  const cancelIterationBtn = document.getElementById('cancelIterationBtn');
  const confirmIterationBtn = document.getElementById('confirmIterationBtn');
  const iterationGuide = document.getElementById('iterationGuide');

  if (iterationGuideModalClose) {
    iterationGuideModalClose.onclick = closeIterationGuideModal;
  }

  if (cancelIterationBtn) {
    cancelIterationBtn.onclick = closeIterationGuideModal;
  }

  if (confirmIterationBtn) {
    confirmIterationBtn.onclick = performIterationOptimization;
  }

  if (iterationGuide) {
    // 当有输入时启用确认按钮
    iterationGuide.addEventListener('input', () => {
      const btn = document.getElementById('confirmIterationBtn');
      if (btn) {
        btn.disabled = false;
      }
    });
  }

  // 应用优化按钮
  const applyOptimizationBtn = document.getElementById('applyOptimizationBtn');
  if (applyOptimizationBtn) {
    applyOptimizationBtn.addEventListener('click', applyOptimization);
  }

  // 自定义下拉菜单交互
  setupCustomSelect('model');
  setupCustomSelect('template');
  setupCustomSelect('iterationTemplate');

  // 原始提示词输入
  const originalEditor = document.getElementById('originalEditor');
  if (originalEditor) {
    originalEditor.addEventListener('input', updateOptimizeButtonState);
  }

  // 绑定模态框事件
  bindUploadModalEvents();
  bindSkillsUploadModalEvents();
  bindToolDetailModalEvents();
}

// ==================== 自定义下拉菜单 ====================

function setupCustomSelect(type) {
  const wrapper = document.getElementById(`${type}SelectWrapper`);
  const trigger = document.getElementById(`${type}SelectTrigger`);
  const options = document.getElementById(`${type}SelectOptions`);

  if (!wrapper || !trigger || !options) return;

  // 点击触发器
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCustomSelect(type);
  });

  // 点击选项
  options.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-select-option');
    if (option && !option.classList.contains('disabled')) {
      const value = option.dataset.value;
      const text = option.querySelector('span').textContent;
      selectCustomOption(type, value, text);
    }
  });

  // 点击外部关闭
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      closeCustomSelect(type);
    }
  });
}

function toggleCustomSelect(type) {
  const trigger = document.getElementById(`${type}SelectTrigger`);
  const options = document.getElementById(`${type}SelectOptions`);

  if (!trigger || !options) return;

  const isOpen = options.classList.contains('show');
  
  // 关闭所有下拉菜单
  closeAllCustomSelects();

  // 如果之前是关闭的，则打开
  if (!isOpen) {
    trigger.classList.add('active');
    options.classList.add('show');
  }
}

function closeCustomSelect(type) {
  const trigger = document.getElementById(`${type}SelectTrigger`);
  const options = document.getElementById(`${type}SelectOptions`);

  if (trigger) {
    trigger.classList.remove('active');
  }
  if (options) {
    options.classList.remove('show');
  }
}

function closeAllCustomSelects() {
  closeCustomSelect('model');
  closeCustomSelect('template');
  closeCustomSelect('iterationTemplate');
}

function selectCustomOption(type, value, text) {
  const trigger = document.getElementById(`${type}SelectTrigger`);
  const options = document.getElementById(`${type}SelectOptions`);

  if (!trigger || !options) return;

  // 更新触发器显示
  const span = trigger.querySelector('span');
  if (span) {
    let defaultText = '请选择';
    if (type === 'model') defaultText += '模型';
    else if (type === 'template') defaultText += '模板';
    else if (type === 'iterationTemplate') defaultText = '选择迭代模板';
    
    span.textContent = text || defaultText;
  }

  // 更新选中状态
  if (value) {
    trigger.classList.remove('placeholder');
    trigger.classList.add('has-value');
  } else {
    trigger.classList.add('placeholder');
    trigger.classList.remove('has-value');
  }

  // 更新选项选中状态
  const optionElements = options.querySelectorAll('.custom-select-option');
  optionElements.forEach(option => {
    if (option.dataset.value === value) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });

  // 保存选中值（用于后续获取）
  trigger.dataset.value = value;

  // 关闭下拉菜单
  closeCustomSelect(type);

  // 更新按钮状态
  if (type === 'model' || type === 'template') {
    updateOptimizeButtonState();
  } else if (type === 'iterationTemplate') {
    updateIterationConfirmButtonState();
  }
}

function updateIterationConfirmButtonState() {
  const confirmBtn = document.getElementById('confirmIterationBtn');
  const templateId = getCustomSelectValue('iterationTemplate');
  if (confirmBtn) {
    confirmBtn.disabled = !templateId || isOptimizing;
  }
}

function getCustomSelectValue(type) {
  const trigger = document.getElementById(`${type}SelectTrigger`);
  return trigger ? trigger.dataset.value || '' : '';
}

// ==================== 优化抽屉操作 ====================

function openOptimizationDrawer() {
  const drawer = document.getElementById('optimizationDrawer');
  if (drawer) {
    drawer.classList.remove('hidden');

    // 将当前编辑器内容填充到原始提示词
    const originalEditor = document.getElementById('originalEditor');
    const currentContent = editor ? editor.getValue() : '';
    if (originalEditor) {
      originalEditor.value = currentContent;
    }

    // 生成新的会话 ID
    optimizationSessionId = 'session-' + Date.now();
    optimizationResult = '';
    isOptimizing = false;

    // 重置优化结果区域
    const optimizedOutput = document.getElementById('optimizedOutput');
    if (optimizedOutput) {
      optimizedOutput.innerHTML = '<p class="placeholder-text">优化结果将在这里显示...</p>';
    }

    // 更新按钮状态
    updateOptimizeButtonState();
    updateIterateButtonState();
    updateApplyButtonState();
  }
}

function closeOptimizationDrawer() {
  const drawer = document.getElementById('optimizationDrawer');
  if (drawer) {
    drawer.classList.add('hidden');

    // 清除会话信息
    if (optimizationSessionId) {
      clearOptimizationSession(optimizationSessionId);
      optimizationSessionId = null;
    }

    // 重置状态
    optimizationResult = '';
    isOptimizing = false;
  }
}

// ==================== 优化操作 ====================

async function startOptimization() {
  const prompt = document.getElementById('originalEditor').value;
  const templateId = getCustomSelectValue('template');
  const modelId = getCustomSelectValue('model');

  if (!prompt || !templateId || !modelId) {
    showMessage('请填写所有必填项', 'error');
    return;
  }

  isOptimizing = true;
  updateOptimizeButtonState();

  const optimizedOutput = document.getElementById('optimizedOutput');
  optimizedOutput.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/prompts/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({
        prompt,
        templateId,
        modelId,
        sessionId: optimizationSessionId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`优化请求失败 (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    optimizationResult = '';
    let hasError = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.chunk) {
              optimizationResult += parsed.chunk;
              optimizedOutput.textContent = optimizationResult;
              optimizedOutput.scrollTop = optimizedOutput.scrollHeight;
            } else if (parsed.error) {
              hasError = true;
              throw new Error(parsed.error);
            }
          } catch (error) {
            if (hasError) {
              throw error; // 重新抛出已识别的错误
            }
            console.warn('解析数据失败:', error);
          }
        }
      }
      
      // 如果已经发生错误，停止读取流
      if (hasError) break;
    }

    // 检查是否发生了错误
    if (hasError) {
      return; // 错误已在 catch 块中处理
    }

    // 优化完成
    isOptimizing = false;
    updateOptimizeButtonState();
    updateIterateButtonState();
    updateApplyButtonState();

    showMessage('优化完成', 'success');
  } catch (error) {
    console.error('优化失败:', error);
    isOptimizing = false;
    updateOptimizeButtonState();
    updateIterateButtonState();
    updateApplyButtonState();

    // 在优化结果区域显示错误信息
    optimizedOutput.innerHTML = `<div class="error-message">
      <h4>❌ 优化失败</h4>
      <p>${escapeHtml(error.message)}</p>
    </div>`;

    showMessage('优化失败: ' + error.message, 'error');
  }
}

// ==================== 迭代优化功能 ====================

function openIterationGuideModal() {
  const modal = document.getElementById('iterationGuideModal');
  if (modal) {
    modal.classList.remove('hidden');
    
    // 清空输入框
    const iterationGuide = document.getElementById('iterationGuide');
    if (iterationGuide) {
      iterationGuide.value = '';
    }
    
    // 渲染迭代模板选项
    renderIterationTemplateOptions();
    
    // 更新确认按钮状态
    updateIterationConfirmButtonState();
  }
}

function closeIterationGuideModal() {
  const modal = document.getElementById('iterationGuideModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function iterateOptimization() {
  // 先打开指导弹窗
  openIterationGuideModal();
}

async function performIterationOptimization() {
  const iterationGuide = document.getElementById('iterationGuide');
  const guideText = iterationGuide ? iterationGuide.value.trim() : '';
  
  const modelId = getCustomSelectValue('model');

  if (!modelId) {
    showMessage('请选择模型', 'error');
    return;
  }

  if (!optimizationResult) {
    showMessage('请先进行初始优化', 'error');
    return;
  }

  // 关闭弹窗
  closeIterationGuideModal();

  isOptimizing = true;
  updateIterateButtonState();

  const optimizedOutput = document.getElementById('optimizedOutput');
  optimizedOutput.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/prompts/optimize/iterate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({
        currentResult: optimizationResult,
        templateId: getCustomSelectValue('iterationTemplate'),
        modelId: modelId,
        sessionId: optimizationSessionId,
        guideText: guideText // 添加优化指导参数
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`迭代优化请求失败 (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    optimizationResult = '';
    let hasError = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.chunk) {
              optimizationResult += parsed.chunk;
              optimizedOutput.textContent = optimizationResult;
              optimizedOutput.scrollTop = optimizedOutput.scrollHeight;
            } else if (parsed.error) {
              hasError = true;
              throw new Error(parsed.error);
            }
          } catch (error) {
            if (hasError) {
              throw error; // 重新抛出已识别的错误
            }
            console.warn('解析数据失败:', error);
          }
        }
      }

      // 如果已经发生错误，停止读取流
      if (hasError) break;
    }

    // 检查是否发生了错误
    if (hasError) {
      return; // 错误已在 catch 块中处理
    }

    // 迭代优化完成
    isOptimizing = false;
    updateIterateButtonState();
    updateApplyButtonState();

    showMessage('迭代优化完成', 'success');
  } catch (error) {
    console.error('迭代优化失败:', error);
    isOptimizing = false;
    updateIterateButtonState();

    // 在优化结果区域显示错误信息
    optimizedOutput.innerHTML = `<div class="error-message">
      <h4>❌ 迭代优化失败</h4>
      <p>${escapeHtml(error.message)}</p>
    </div>`;

    showMessage('迭代优化失败: ' + error.message, 'error');
  }
}

function applyOptimization() {
  if (!optimizationResult) {
    showMessage('没有可应用的优化结果', 'error');
    return;
  }

  if (editor) {
    editor.setValue(optimizationResult);
    showMessage('优化已应用', 'success');
    closeOptimizationDrawer();
  }
}

async function clearOptimizationSession(sessionId) {
  try {
    await fetch(`${API_BASE}/prompts/optimize/session/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });
  } catch (error) {
    console.warn('清除会话失败:', error);
  }
}

// ==================== 按钮状态更新 ====================

function updateOptimizeButtonState() {
  const startOptimizeBtn = document.getElementById('startOptimizeBtn');
  const prompt = document.getElementById('originalEditor').value;
  const templateId = getCustomSelectValue('template');
  const modelId = getCustomSelectValue('model');

  const canOptimize = prompt && templateId && modelId && !isOptimizing;
  startOptimizeBtn.disabled = !canOptimize;
  startOptimizeBtn.textContent = isOptimizing ? '优化中...' : '开始优化 →';
}

function updateIterateButtonState() {
  const iterateBtn = document.getElementById('iterateBtn');
  if (iterateBtn) {
    const canIterate = optimizationResult && !isOptimizing;
    iterateBtn.disabled = !canIterate;
  }
}

function updateApplyButtonState() {
  const applyOptimizationBtn = document.getElementById('applyOptimizationBtn');
  const canApply = optimizationResult && !isOptimizing;
  applyOptimizationBtn.disabled = !canApply;
}

// ==================== 模板管理 ====================

async function loadTemplates() {
  try {
    const response = await fetch(`${API_BASE}/optimization/templates`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      throw new Error('加载模板失败');
    }

    currentTemplates = await response.json();
    renderTemplateOptions();
    renderIterationTemplateOptions();
  } catch (error) {
    console.error('加载模板失败:', error);
    showMessage('加载模板失败', 'error');
  }
}

function renderTemplateOptions() {
  const templateSelectTrigger = document.getElementById('templateSelectTrigger');
  const templateSelectOptions = document.getElementById('templateSelectOptions');
  if (!templateSelectTrigger || !templateSelectOptions) return;

  // 清空选项
  templateSelectOptions.innerHTML = '';

  // 过滤系统提示词模板
  const optimizeTemplates = currentTemplates.filter(t => (t.type || 'optimize') === 'optimize');

  // 添加模板选项
  optimizeTemplates.forEach(template => {
    const option = document.createElement('div');
    option.className = 'custom-select-option';
    option.dataset.value = template.id;
    option.innerHTML = `<span>${template.name}${template.isBuiltIn ? ' (内置)' : ''}</span><span class="check-icon">✓</span>`;

    // 点击选项
    option.addEventListener('click', () => {
      selectCustomOption('template', template.id, template.name + (template.isBuiltIn ? ' (内置)' : ''));
    });

    templateSelectOptions.appendChild(option);
  });

  // 如果没有模板，添加默认选项
  if (optimizeTemplates.length === 0) {
    const defaultOption = document.createElement('div');
    defaultOption.className = 'custom-select-option disabled';
    defaultOption.dataset.value = '';
    defaultOption.innerHTML = '<span>无可用系统提示词模板</span><span class="check-icon">✓</span>';
    templateSelectOptions.appendChild(defaultOption);
  }

  // 添加分隔线和配置按钮
  const divider = document.createElement('div');
  divider.className = 'custom-select-divider';
  templateSelectOptions.appendChild(divider);

  const action = document.createElement('div');
  action.className = 'custom-select-action';
  action.id = 'configTemplateAction';
  action.innerHTML = '<span>⚙️ 配置模板</span>';
  action.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllCustomSelects();
    openTemplateListModal();
  });
  templateSelectOptions.appendChild(action);

  // 如果有模板，默认选中第一条
  if (optimizeTemplates.length > 0) {
    const firstTemplate = optimizeTemplates[0];
    selectCustomOption('template', firstTemplate.id, firstTemplate.name + (firstTemplate.isBuiltIn ? ' (内置)' : ''));
  }
}

function renderIterationTemplateOptions() {
  const trigger = document.getElementById('iterationTemplateSelectTrigger');
  const options = document.getElementById('iterationTemplateSelectOptions');
  if (!trigger || !options) return;

  // 清空选项
  options.innerHTML = '';

  // 过滤迭代提示词模板
  const iterateTemplates = currentTemplates.filter(t => t.type === 'iterate');

  // 添加模板选项
  iterateTemplates.forEach(template => {
    const option = document.createElement('div');
    option.className = 'custom-select-option';
    option.dataset.value = template.id;
    option.innerHTML = `<span>${template.name}${template.isBuiltIn ? ' (内置)' : ''}</span><span class="check-icon">✓</span>`;

    options.appendChild(option);
  });

  // 如果没有模板，添加提示信息
  if (iterateTemplates.length === 0) {
    const emptyTip = document.createElement('div');
    emptyTip.className = 'custom-select-option disabled';
    emptyTip.innerHTML = '<span style="color: #999; font-size: 13px;">暂无迭代模板，请先配置</span>';
    options.appendChild(emptyTip);
  }

  // 添加分隔线和配置按钮
  const divider = document.createElement('div');
  divider.className = 'custom-select-divider';
  options.appendChild(divider);

  const action = document.createElement('div');
  action.className = 'custom-select-action';
  action.innerHTML = '<span>⚙️ 配置迭代模板</span>';
  action.style.color = '#3b82f6';
  action.style.fontWeight = '500';
  action.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllCustomSelects();
    openTemplateListModal();
  });
  options.appendChild(action);

  // 如果有模板，默认选中第一条
  if (iterateTemplates.length > 0) {
    const firstTemplate = iterateTemplates[0];
    selectCustomOption('iterationTemplate', firstTemplate.id, firstTemplate.name + (firstTemplate.isBuiltIn ? ' (内置)' : ''));
  } else {
    // 重置触发器显示
    trigger.querySelector('span').textContent = '选择迭代模板';
    trigger.classList.add('placeholder');
    trigger.classList.remove('has-value');
    trigger.dataset.value = '';
  }
}

// ==================== 模型管理 ====================

async function loadModels() {
  try {
    const response = await fetch(`${API_BASE}/optimization/models`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      throw new Error('加载模型失败');
    }

    currentModels = await response.json();
    renderModelOptions();
  } catch (error) {
    console.error('加载模型失败:', error);
    showMessage('加载模型失败', 'error');
  }
}

function renderModelOptions() {
  const modelSelectTrigger = document.getElementById('modelSelectTrigger');
  const modelSelectOptions = document.getElementById('modelSelectOptions');
  if (!modelSelectTrigger || !modelSelectOptions) return;

  // 清空选项
  modelSelectOptions.innerHTML = '';

  // 添加模型选项
  const enabledModels = currentModels.filter(model => model.enabled);
  enabledModels.forEach(model => {
    const option = document.createElement('div');
    option.className = 'custom-select-option';
    option.dataset.value = model.id;
    option.innerHTML = `<span>${model.name}${model.isBuiltIn ? ' (内置)' : ''}</span><span class="check-icon">✓</span>`;

    // 点击选项
    option.addEventListener('click', () => {
      selectCustomOption('model', model.id, model.name + (model.isBuiltIn ? ' (内置)' : ''));
    });

    modelSelectOptions.appendChild(option);
  });

  // 如果没有启用的模型，添加默认选项
  if (enabledModels.length === 0) {
    const defaultOption = document.createElement('div');
    defaultOption.className = 'custom-select-option disabled';
    defaultOption.dataset.value = '';
    defaultOption.innerHTML = '<span>请选择模型</span><span class="check-icon">✓</span>';
    modelSelectOptions.appendChild(defaultOption);
  }

  // 添加分隔线和配置按钮
  const divider = document.createElement('div');
  divider.className = 'custom-select-divider';
  modelSelectOptions.appendChild(divider);

  const action = document.createElement('div');
  action.className = 'custom-select-action';
  action.id = 'configModelAction';
  action.innerHTML = '<span>⚙️ 配置模型</span>';
  action.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllCustomSelects();
    openModelConfigModal();
  });
  modelSelectOptions.appendChild(action);

  // 如果有启用的模型，默认选中第一条
  if (enabledModels.length > 0) {
    const firstModel = enabledModels[0];
    selectCustomOption('model', firstModel.id, firstModel.name + (firstModel.isBuiltIn ? ' (内置)' : ''));
  }
}

// ==================== 模板列表模态框 ====================

function openTemplateListModal() {
  const modal = document.getElementById('templateListModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderTemplateList();
  }

  // 绑定事件
  const createTemplateBtn = document.getElementById('createTemplateBtn');
  const templateSearch = document.getElementById('templateSearch');
  const templateListCloseBtn = document.getElementById('templateListCloseBtn');
  const templateListModalClose = document.getElementById('templateListModalClose');

  if (createTemplateBtn) {
    createTemplateBtn.onclick = () => openTemplateEditorModal();
  }

  if (templateSearch) {
    templateSearch.oninput = () => renderTemplateList(templateSearch.value);
  }

  [templateListCloseBtn, templateListModalClose].forEach(btn => {
    if (btn) {
      btn.onclick = closeTemplateListModal;
    }
  });
}

function closeTemplateListModal() {
  const modal = document.getElementById('templateListModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function renderTemplateList(search = '') {
  const templateList = document.getElementById('templateList');
  if (!templateList) return;

  const filteredTemplates = currentTemplates.filter(template =>
    template.name.toLowerCase().includes(search.toLowerCase())
  );

  if (filteredTemplates.length === 0) {
    templateList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">暂无模板</p>';
    return;
  }

  templateList.innerHTML = filteredTemplates.map(template => `
    <div class="template-item">
      <div class="template-item-info">
        <div class="template-item-name">
          ${template.name}
          ${template.isBuiltIn ? '<span class="template-item-badge built-in">内置</span>' : '<span class="template-item-badge custom">自定义</span>'}
          <span class="template-item-badge ${template.type === 'iterate' ? 'iterate' : 'optimize'}">
            ${template.type === 'iterate' ? '迭代' : '优化'}
          </span>
          <span class="template-item-badge ${template.format === 'advanced' ? 'advanced' : 'simple'}">
            ${template.format === 'advanced' ? '高级' : '简单'}
          </span>
        </div>
        <div class="template-item-description">${template.description || '暂无描述'}</div>
      </div>
      <div class="template-item-actions">
        ${template.isBuiltIn ? `
          <button class="btn btn-outline btn-sm" onclick="viewTemplate('${template.id}')">查看</button>
        ` : `
          <button class="btn btn-outline btn-sm" onclick="editTemplate('${template.id}')">编辑</button>
          <button class="btn btn-outline btn-sm" onclick="deleteTemplate('${template.id}')">删除</button>
        `}
      </div>
    </div>
  `).join('');
}

// ==================== 模板查看模态框 ====================

function viewTemplate(templateId) {
  const template = currentTemplates.find(t => t.id === templateId);
  if (!template) {
    showMessage('模板不存在', 'error');
    return;
  }

  openTemplateEditorModal(templateId);

  // 禁用所有输入字段
  const fields = ['templateName', 'templateDescription', 'templateContent', 'templateType', 'templateFormat', 'addMessageBtn'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  // 禁用高级消息列表中的所有输入
  document.querySelectorAll('#advancedMessageList .form-control, #advancedMessageList .btn-remove-message').forEach(el => {
    el.disabled = true;
    if (el.tagName === 'BUTTON') el.style.display = 'none';
  });

  const saveTemplateBtn = document.getElementById('saveTemplateBtn');
  if (saveTemplateBtn) {
    saveTemplateBtn.disabled = true;
    saveTemplateBtn.textContent = '内置模板只读';
  }
}

// ==================== 模板编辑模态框 ====================

let advancedMessages = [];

function updateVariableList(type, format = 'simple') {
  const variableList = document.getElementById('variableList');
  const advancedHelpText = document.querySelector('#advancedContentSection .template-help-text');
  if (!variableList) return;

  if (format === 'advanced') {
    if (type === 'iterate') {
      const advancedVars = `
        <p>💡 高级模板变量：</p>
        <ul id="variableList">
          <li><code>{{originalPrompt}}</code> - 最初输入的原始提示词</li>
          <li><code>{{lastOptimizedPrompt}}</code> - 当前界面显示的待优化内容</li>
          <li><code>{{iterateInput}}</code> - 用户的本次优化指导意见</li>
          <li><code>{{iterationCount}}</code> - 当前是第几次优化</li>
        </ul>
      `;
      variableList.innerHTML = advancedVars;
      if (advancedHelpText) advancedHelpText.innerHTML = advancedVars;
    } else {
      const advancedVars = `
        <p>💡 高级模板变量：</p>
        <ul id="variableList">
          <li><code>{{originalPrompt}}</code> - 原始输入的提示词</li>
        </ul>
      `;
      variableList.innerHTML = advancedVars;
      if (advancedHelpText) advancedHelpText.innerHTML = advancedVars;
    }
  } else {
    // 简单模板
    if (type === 'iterate') {
      variableList.innerHTML = `
        <li><code>{{prompt}}</code> - 本次优化的输入内容</li>
        <li><code>{{previousResult}}</code> - 上一次的优化结果</li>
        <li><code>{{guideText}}</code> - 用户的优化指导意见</li>
      `;
    } else {
      variableList.innerHTML = `
        <li><code>{{prompt}}</code> - 原始输入的提示词</li>
      `;
    }
  }
}

function renderAdvancedMessages() {
  const list = document.getElementById('advancedMessageList');
  if (!list) return;

  if (advancedMessages.length === 0) {
    advancedMessages = [{ role: 'system', content: '' }, { role: 'user', content: '{{originalPrompt}}' }];
  }

  list.innerHTML = advancedMessages.map((msg, index) => `
    <div class="advanced-message-item" data-index="${index}">
      <div class="message-header">
        <select class="form-control message-role" onchange="updateAdvancedMessage(${index}, 'role', this.value)">
          <option value="system" ${msg.role === 'system' ? 'selected' : ''}>System</option>
          <option value="user" ${msg.role === 'user' ? 'selected' : ''}>User</option>
          <option value="assistant" ${msg.role === 'assistant' ? 'selected' : ''}>Assistant</option>
        </select>
        <button type="button" class="btn-remove-message" onclick="removeAdvancedMessage(${index})">×</button>
      </div>
      <textarea class="form-control message-content" rows="3" oninput="updateAdvancedMessage(${index}, 'content', this.value)" placeholder="请输入消息内容...">${msg.content}</textarea>
    </div>
  `).join('');
}

window.updateAdvancedMessage = (index, field, value) => {
  advancedMessages[index][field] = value;
};

window.removeAdvancedMessage = (index) => {
  advancedMessages.splice(index, 1);
  renderAdvancedMessages();
};

function openTemplateEditorModal(templateId = null) {
  const modal = document.getElementById('templateEditorModal');
  const title = document.getElementById('templateEditorModalTitle');
  if (modal) {
    modal.classList.remove('hidden');
    title.textContent = templateId ? '编辑模板' : '新增模板';
  }

  // 填充表单
  const templateName = document.getElementById('templateName');
  const templateDescription = document.getElementById('templateDescription');
  const templateContent = document.getElementById('templateContent');
  const templateType = document.getElementById('templateType');
  const templateFormat = document.getElementById('templateFormat');
  const simpleSection = document.getElementById('simpleContentSection');
  const advancedSection = document.getElementById('advancedContentSection');

  if (templateId) {
    const template = currentTemplates.find(t => t.id === templateId);
    if (template) {
      templateName.value = template.name;
      templateDescription.value = template.description || '';
      templateType.value = template.type || 'optimize';
      templateFormat.value = template.format || 'simple';
      
      if (template.format === 'advanced') {
        advancedMessages = Array.isArray(template.content) ? [...template.content] : [];
        templateContent.value = '';
      } else {
        templateContent.value = template.content;
        advancedMessages = [];
      }
    }
  } else {
    templateName.value = '';
    templateDescription.value = '';
    templateType.value = 'optimize';
    templateFormat.value = 'simple';
    templateContent.value = '';
    advancedMessages = [];
  }

  // 更新 UI 状态
  updateVariableList(templateType.value, templateFormat.value);
  if (templateFormat.value === 'advanced') {
    simpleSection.classList.add('hidden');
    advancedSection.classList.remove('hidden');
    renderAdvancedMessages();
  } else {
    simpleSection.classList.remove('hidden');
    advancedSection.classList.add('hidden');
  }

  // 绑定事件
  templateType.onchange = (e) => updateVariableList(e.target.value, templateFormat.value);
  templateFormat.onchange = (e) => {
    updateVariableList(templateType.value, e.target.value);
    if (e.target.value === 'advanced') {
      simpleSection.classList.add('hidden');
      advancedSection.classList.remove('hidden');
      renderAdvancedMessages();
    } else {
      simpleSection.classList.remove('hidden');
      advancedSection.classList.add('hidden');
    }
  };

  const addMessageBtn = document.getElementById('addMessageBtn');
  if (addMessageBtn) {
    addMessageBtn.onclick = () => {
      advancedMessages.push({ role: 'user', content: '' });
      renderAdvancedMessages();
    };
  }

  // 启用所有输入字段
  templateName.disabled = false;
  templateDescription.disabled = false;
  templateContent.disabled = false;
  templateType.disabled = false;
  templateFormat.disabled = false;

  // 绑定事件
  const cancelTemplateBtn = document.getElementById('cancelTemplateBtn');
  const saveTemplateBtn = document.getElementById('saveTemplateBtn');
  const templateEditorModalClose = document.getElementById('templateEditorModalClose');

  if (cancelTemplateBtn) {
    cancelTemplateBtn.onclick = closeTemplateEditorModal;
  }

  if (templateEditorModalClose) {
    templateEditorModalClose.onclick = closeTemplateEditorModal;
  }

  if (saveTemplateBtn) {
    saveTemplateBtn.disabled = false;
    saveTemplateBtn.textContent = '保存';
    saveTemplateBtn.onclick = () => saveTemplate(templateId);
  }
}

function closeTemplateEditorModal() {
  const modal = document.getElementById('templateEditorModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function saveTemplate(templateId = null) {
  const templateName = document.getElementById('templateName').value;
  const templateDescription = document.getElementById('templateDescription').value;
  const templateType = document.getElementById('templateType').value;
  const templateFormat = document.getElementById('templateFormat').value;
  
  let templateContent;
  if (templateFormat === 'advanced') {
    templateContent = advancedMessages;
    if (templateContent.length === 0) {
      showMessage('请至少添加一条消息', 'error');
      return;
    }
    if (templateContent.some(msg => !msg.content.trim())) {
      showMessage('消息内容不能为空', 'error');
      return;
    }
  } else {
    templateContent = document.getElementById('templateContent').value;
    if (!templateContent) {
      showMessage('请输入模板内容', 'error');
      return;
    }
  }

  if (!templateName) {
    showMessage('请填写模板名称', 'error');
    return;
  }

  try {
    const url = templateId
      ? `${API_BASE}/optimization/templates/${templateId}`
      : `${API_BASE}/optimization/templates`;

    const method = templateId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({
        name: templateName,
        description: templateDescription,
        type: templateType,
        format: templateFormat,
        content: templateContent
      })
    });

    if (!response.ok) {
      throw new Error('保存模板失败');
    }

    showMessage('模板保存成功', 'success');
    closeTemplateEditorModal();
    closeTemplateListModal();
    await loadTemplates();
    renderTemplateOptions();
  } catch (error) {
    console.error('保存模板失败:', error);
    showMessage('保存模板失败: ' + error.message, 'error');
  }
}

async function deleteTemplate(templateId) {
  if (!confirm('确定要删除此模板吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/optimization/templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      throw new Error('删除模板失败');
    }

    showMessage('模板删除成功', 'success');
    renderTemplateList();
    await loadTemplates();
    renderTemplateOptions();
  } catch (error) {
    console.error('删除模板失败:', error);
    showMessage('删除模板失败: ' + error.message, 'error');
  }
}

// ==================== 模型配置模态框 ====================

function openModelConfigModal() {
  const modal = document.getElementById('modelConfigModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderModelList();
  }

  // 绑定事件
  const createModelBtn = document.getElementById('createModelBtn');
  const modelConfigCloseBtn = document.getElementById('modelConfigCloseBtn');
  const modelConfigModalClose = document.getElementById('modelConfigModalClose');

  if (createModelBtn) {
    createModelBtn.onclick = () => openModelEditorModal();
  }

  [modelConfigCloseBtn, modelConfigModalClose].forEach(btn => {
    if (btn) {
      btn.onclick = closeModelConfigModal;
    }
  });
}

function closeModelConfigModal() {
  const modal = document.getElementById('modelConfigModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function renderModelList() {
  const modelList = document.getElementById('modelList');
  if (!modelList) return;

  if (currentModels.length === 0) {
    modelList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 20px;">暂无模型</p>';
    return;
  }

  modelList.innerHTML = currentModels.map(model => `
    <div class="model-item">
      <div class="model-item-info">
        <div class="model-item-name">
          <span class="model-item-status ${model.enabled ? 'enabled' : 'disabled'}"></span>
          ${model.name}
          ${model.isBuiltIn ? '<span class="template-item-badge built-in">内置</span>' : '<span class="template-item-badge custom">自定义</span>'}
        </div>
        <div class="model-item-details">${model.provider} - ${model.model}</div>
      </div>
      <div class="model-item-actions">
        <button class="btn btn-outline btn-sm" onclick="editModel('${model.id}')">编辑</button>
        ${!model.isBuiltIn ? `<button class="btn btn-outline btn-sm" onclick="deleteModel('${model.id}')">删除</button>` : ''}
      </div>
    </div>
  `).join('');
}

// ==================== 模型编辑模态框 ====================

// 加载模型提供商选项
async function loadModelProviders() {
  try {
    const response = await fetch(`${API_BASE}/optimization/models/providers`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      throw new Error('加载提供商列表失败');
    }

    const providers = await response.json();
    console.log('加载到的提供商列表:', providers);
    return providers;
  } catch (error) {
    console.error('加载提供商列表失败:', error);
    return [];
  }
}

// 根据提供商键名获取默认配置
async function getProviderDefaults(providerKey) {
  try {
    const response = await fetch(`${API_BASE}/optimization/models/providers/${providerKey}`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('获取提供商默认配置失败:', error);
    return null;
  }
}

// 填充提供商下拉框
async function populateProviderDropdown(selectedValue = '') {
  const providerSelect = document.getElementById('modelProvider');
  if (!providerSelect) {
    console.warn('找不到提供商下拉框元素');
    return;
  }

  const providers = await loadModelProviders();
  console.log('开始填充提供商下拉框，提供商数量:', providers.length);

  // 清空并重新填充选项
  providerSelect.innerHTML = '<option value="">请选择提供商</option>';

  providers.forEach(provider => {
    const option = document.createElement('option');
    option.value = provider.name; // 使用名称作为值
    option.textContent = provider.name;
    option.dataset.key = provider.key; // 存储键名用于获取默认配置
    option.dataset.defaultModel = provider.defaultModel || '';
    option.dataset.defaultEndpoint = provider.defaultEndpoint || '';
    option.dataset.models = JSON.stringify(provider.models || []);
    providerSelect.appendChild(option);
  });

  // 恢复之前选中的值
  if (selectedValue) {
    providerSelect.value = selectedValue;
  }

  console.log('提供商下拉框填充完成');

  // 绑定选择变更事件
  providerSelect.onchange = async (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const providerKey = selectedOption?.dataset.key;
    const providerName = selectedOption?.value;

    console.log('选择提供商:', { providerKey, providerName });

    if (!providerKey) {
      // 清空配置提示和模型列表
      clearModelOptions();
      const apiEndpointInput = document.getElementById('modelApiEndpoint');
      if (apiEndpointInput) {
        apiEndpointInput.value = '';
      }
      return;
    }

    // 如果选择的是"自定义"提供商，清空所有输入框
    if (providerKey === 'custom') {
      // 清空名称
      const nameInput = document.getElementById('modelName');
      if (nameInput) {
        nameInput.value = '';
      }

      // 清空 API 端点
      const apiEndpointInput = document.getElementById('modelApiEndpoint');
      if (apiEndpointInput) {
        apiEndpointInput.value = '';
      }

      // 清空 API Key
      const apiKeyInput = document.getElementById('modelApiKey');
      if (apiKeyInput) {
        apiKeyInput.value = '';
      }

      // 隐藏模型下拉框，显示自定义输入框
      const modelSelect = document.getElementById('modelModelSelect');
      const customModelInput = document.getElementById('customModelInput');
      const modelModelCustom = document.getElementById('modelModelCustom');
      const modelModelHint = document.getElementById('modelModelHint');

      if (modelSelect) {
        modelSelect.innerHTML = '<option value="">请选择模型</option>';
        modelSelect.style.display = 'none';
      }

      if (customModelInput) {
        customModelInput.style.display = 'block';
      }

      if (modelModelCustom) {
        modelModelCustom.value = '';
      }

      if (modelModelHint) {
        modelModelHint.style.display = 'none';
      }

      console.log('已清空所有输入框（自定义提供商）');
      return;
    }

    const defaults = await getProviderDefaults(providerKey);
    console.log('提供商默认配置:', defaults);

    if (defaults) {
      // 自动填充 API 端点
      const apiEndpointInput = document.getElementById('modelApiEndpoint');
      if (apiEndpointInput && defaults.apiEndpoint) {
        apiEndpointInput.value = defaults.apiEndpoint;
      }

      // 填充模型下拉框
      populateModelDropdown(defaults.models || [], defaults.model);
    }
  };
}

// 填充模型下拉框
function populateModelDropdown(models = [], defaultModel = '') {
  const modelSelect = document.getElementById('modelModelSelect');
  const customModelInput = document.getElementById('customModelInput');
  const modelModelCustom = document.getElementById('modelModelCustom');
  const modelModelHint = document.getElementById('modelModelHint');
  const useCustomModel = document.getElementById('useCustomModel');

  if (!modelSelect) {
    console.warn('找不到模型下拉框元素');
    return;
  }

  console.log('开始填充模型下拉框，模型数量:', models.length);

  // 清空并重新填充选项
  modelSelect.innerHTML = '<option value="">请选择模型</option>';

  if (models && models.length > 0) {
    // 显示下拉框，隐藏自定义输入
    modelSelect.style.display = 'block';
    customModelInput.style.display = 'none';
    modelModelHint.style.display = 'block';

    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });

    // 设置默认值
    if (defaultModel) {
      modelSelect.value = defaultModel;
    }

    // 显示"使用自定义模型"链接
    if (useCustomModel) {
      useCustomModel.onclick = (e) => {
        e.preventDefault();
        showCustomModelInput(models, modelSelect.value);
      };
    }
  } else {
    // 没有模型列表，直接显示自定义输入
    showCustomModelInput([], '');
  }

  console.log('模型下拉框填充完成');
}

// 显示自定义模型输入
function showCustomModelInput(models = [], currentValue = '') {
  const modelSelect = document.getElementById('modelModelSelect');
  const customModelInput = document.getElementById('customModelInput');
  const modelModelCustom = document.getElementById('modelModelCustom');
  const modelModelHint = document.getElementById('modelModelHint');

  if (!modelSelect || !customModelInput) return;

  // 隐藏下拉框，显示自定义输入
  modelSelect.style.display = 'none';
  customModelInput.style.display = 'block';
  modelModelHint.style.display = 'none';

  // 设置当前值
  modelModelCustom.value = currentValue;

  // 绑定返回下拉框的事件
  if (models && models.length > 0) {
    modelModelCustom.onblur = () => {
      // 如果输入为空，显示下拉框
      if (!modelModelCustom.value.trim()) {
        populateModelDropdown(models, models[0]);
      }
    };
  }
}

// 清空模型选项
function clearModelOptions() {
  const modelSelect = document.getElementById('modelModelSelect');
  const customModelInput = document.getElementById('customModelInput');
  const modelModelCustom = document.getElementById('modelModelCustom');
  const modelModelHint = document.getElementById('modelModelHint');

  if (modelSelect) {
    modelSelect.innerHTML = '<option value="">请选择模型</option>';
  }

  if (customModelInput) {
    customModelInput.style.display = 'none';
  }

  if (modelModelCustom) {
    modelModelCustom.value = '';
  }

  if (modelModelHint) {
    modelModelHint.style.display = 'none';
  }
}

// 获取当前选择的模型值
function getSelectedModel() {
  const modelSelect = document.getElementById('modelModelSelect');
  const customModelInput = document.getElementById('customModelInput');
  const modelModelCustom = document.getElementById('modelModelCustom');

  if (modelSelect && modelSelect.style.display !== 'none') {
    return modelSelect.value;
  }

  if (modelModelCustom && customModelInput.style.display !== 'none') {
    return modelModelCustom.value;
  }

  return '';
}

function openModelEditorModal(modelId = null) {
  const modal = document.getElementById('modelEditorModal');
  const title = document.getElementById('modelEditorModalTitle');
  if (modal) {
    modal.classList.remove('hidden');
    title.textContent = modelId ? '编辑模型' : '新增模型';
  }

  // 填充表单
  const modelName = document.getElementById('modelName');
  const modelProvider = document.getElementById('modelProvider');
  const modelApiEndpoint = document.getElementById('modelApiEndpoint');
  const modelApiKey = document.getElementById('modelApiKey');
  const modelEnabled = document.getElementById('modelEnabled');

  if (modelId) {
    const model = currentModels.find(m => m.id === modelId);
    if (model) {
      // 检查是否为内置模型
      const isBuiltIn = model.isBuiltIn === true;

      // 先填充提供商下拉框
      populateProviderDropdown(model.provider).then(async () => {
        // 设置提供商值
        modelProvider.value = model.provider;

        // 获取选中的提供商选项
        const selectedOption = modelProvider.options[modelProvider.selectedIndex];
        const providerKey = selectedOption?.dataset.key;

        // 手动填充模型列表，不触发 change 事件
        if (providerKey && providerKey !== 'custom') {
          const defaults = await getProviderDefaults(providerKey);
          if (defaults) {
            populateModelDropdown(defaults.models || [], defaults.model);
          }
        } else if (providerKey === 'custom') {
          // 自定义提供商，显示输入框
          clearModelOptions();
          const modelSelect = document.getElementById('modelModelSelect');
          const customModelInput = document.getElementById('customModelInput');
          const modelModelCustom = document.getElementById('modelModelCustom');
          if (modelSelect) modelSelect.style.display = 'none';
          if (customModelInput && modelModelCustom) {
            customModelInput.style.display = 'block';
          }
        }

        // 现在设置所有字段值
        modelName.value = model.name;
        modelApiEndpoint.value = model.apiEndpoint;
        // 如果是内置模型，显示假的 apiKey
        modelApiKey.value = isBuiltIn ? '******' : (model.apiKey || '');
        modelEnabled.checked = model.enabled !== false;

        // 如果是内置模型，禁用所有输入字段和保存按钮
        const saveModelBtn = document.getElementById('saveModelBtn');
        if (isBuiltIn) {
          modelName.disabled = true;
          modelProvider.disabled = true;
          modelApiEndpoint.disabled = true;
          modelApiKey.disabled = true;
          modelEnabled.disabled = true;
          // 禁用模型选择
          const modelSelect = document.getElementById('modelModelSelect');
          const modelModelCustom = document.getElementById('modelModelCustom');
          if (modelSelect) modelSelect.disabled = true;
          if (modelModelCustom) modelModelCustom.disabled = true;
          // 禁用保存按钮
          if (saveModelBtn) {
            saveModelBtn.disabled = true;
            saveModelBtn.textContent = '内置模型不可编辑';
          }
        } else {
          // 启用所有输入字段和保存按钮
          modelName.disabled = false;
          modelProvider.disabled = false;
          modelApiEndpoint.disabled = false;
          modelApiKey.disabled = false;
          modelEnabled.disabled = false;
          // 启用模型选择
          const modelSelect = document.getElementById('modelModelSelect');
          const modelModelCustom = document.getElementById('modelModelCustom');
          if (modelSelect) modelSelect.disabled = false;
          if (modelModelCustom) modelModelCustom.disabled = false;
          // 启用保存按钮
          if (saveModelBtn) {
            saveModelBtn.disabled = false;
            saveModelBtn.textContent = '保存';
          }
        }

        // 设置模型值
        setTimeout(() => {
          const modelSelect = document.getElementById('modelModelSelect');
          const modelModelCustom = document.getElementById('modelModelCustom');
          if (modelSelect && modelSelect.style.display !== 'none') {
            modelSelect.value = model.model;
          } else if (modelModelCustom) {
            modelModelCustom.value = model.model;
          }
        }, 50);
      });
    }
  } else {
    modelName.value = '';
    modelApiEndpoint.value = '';
    modelApiKey.value = '';
    modelEnabled.checked = true;
    // 加载提供商选项
    populateProviderDropdown();
  }

  // 绑定事件
  const cancelModelBtn = document.getElementById('cancelModelBtn');
  const saveModelBtn = document.getElementById('saveModelBtn');
  const modelEditorModalClose = document.getElementById('modelEditorModalClose');

  if (cancelModelBtn) {
    cancelModelBtn.onclick = closeModelEditorModal;
  }

  if (modelEditorModalClose) {
    modelEditorModalClose.onclick = closeModelEditorModal;
  }

  if (saveModelBtn) {
    saveModelBtn.onclick = () => saveModel(modelId);
  }
}

function closeModelEditorModal() {
  const modal = document.getElementById('modelEditorModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function saveModel(modelId = null) {
  const modelName = document.getElementById('modelName').value;
  const modelProviderSelect = document.getElementById('modelProvider');
  const modelApiEndpoint = document.getElementById('modelApiEndpoint').value;
  const modelApiKey = document.getElementById('modelApiKey').value;
  const modelEnabled = document.getElementById('modelEnabled').checked;
  
  // 获取选择的模型值（从下拉框或自定义输入）
  const modelModel = getSelectedModel();

  if (!modelName || !modelProviderSelect.value || !modelModel || !modelApiEndpoint) {
    showMessage('请填写必填项', 'error');
    return;
  }

  // 使用选中的提供商名称
  const modelProvider = modelProviderSelect.value;

  try {
    const url = modelId
      ? `${API_BASE}/optimization/models/${modelId}`
      : `${API_BASE}/optimization/models`;

    const method = modelId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({
        name: modelName,
        provider: modelProvider,
        model: modelModel,
        apiEndpoint: modelApiEndpoint,
        apiKey: modelApiKey,
        enabled: modelEnabled
      })
    });

    if (!response.ok) {
      throw new Error('保存模型失败');
    }

    showMessage('模型保存成功', 'success');
    closeModelEditorModal();
    closeModelConfigModal();
    await loadModels();
    renderModelOptions();
  } catch (error) {
    console.error('保存模型失败:', error);
    showMessage('保存模型失败: ' + error.message, 'error');
  }
}

async function deleteModel(modelId) {
  if (!confirm('确定要删除此模型吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/optimization/models/${modelId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    if (!response.ok) {
      throw new Error('删除模型失败');
    }

    showMessage('模型删除成功', 'success');
    renderModelList();
    await loadModels();
    renderModelOptions();
  } catch (error) {
    console.error('删除模型失败:', error);
    showMessage('删除模型失败: ' + error.message, 'error');
  }
}

// 将全局函数暴露给 window 对象，以便在 HTML onclick 中调用
window.viewTemplate = viewTemplate;
window.editTemplate = openTemplateEditorModal;
window.deleteTemplate = deleteTemplate;
window.editModel = openModelEditorModal;
window.deleteModel = deleteModel;

// 启动应用
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化 DOM 组件
  initDOMComponents();

  try {
    await checkAuthRequirement();
    setupLoginEvents();
    
    // 检查登录状态
    if (currentToken || !requireAuth) {
      showMain();
      showLoading(); // 显示加载中效果
      loadPrompts(); // 先加载提示词列表
      await initApp(); // 然后初始化应用
      // 设置导航事件
      setupNavigation();
      // 页面加载后显示自定义的空白内容区域，不显示编辑器
      showCustomBlankContent();
      
      
            // 初始化推荐词功能（内联函数定义）
      let recommendedPrompts = [];
      let currentRecommendedPromptIndex = 0;
      let recommendedPromptsPerPage = 4;
      let currentCardWidth = '25%';
      
      // 根据容器宽度动态计算每页显示的卡片数量和宽度
      function calculatePromptsLayout() {
        const container = document.getElementById('recommendedPromptsList');
        if (!container) return { count: 4, cardWidth: '25%' };
        
        const containerWidth = container.offsetWidth;
        const minCardWidth = 240; // 卡片最小宽度
        const maxCardWidth = 320; // 卡片最大宽度
        const gap = 12; // 卡片间隙
        
        // 计算可以显示的卡片数量（最小2列，最大4列）
        let count = Math.floor((containerWidth + gap) / (minCardWidth + gap));
        count = Math.max(2, Math.min(4, count));
        
        // 计算卡片宽度，确保均匀分布
        const totalGap = gap * (count - 1);
        const cardWidth = (containerWidth - totalGap) / count;
        
        // 确保卡片宽度在最小和最大值之间
        const clampedCardWidth = Math.max(minCardWidth, Math.min(maxCardWidth, cardWidth));
        
        // 如果卡片宽度被限制，重新计算实际能显示的卡片数量
        if (clampedCardWidth !== cardWidth) {
          const actualCount = Math.floor((containerWidth + gap) / (clampedCardWidth + gap));
          return { count: Math.max(2, Math.min(4, actualCount)), cardWidth: `${clampedCardWidth}px` };
        }
        
        // 返回百分比宽度以实现均匀分布
        return { count, cardWidth: `${100 / count * (1 - gap / containerWidth * (count - 1))}%` };
      }
      
      // 加载推荐词数据
      async function loadRecommendedPrompts() {
        try {
          // 尝试从API端点获取推荐词数据
          let data = null;
          let apiUrl = null;
          
          // 使用单个API端点 - 使用API_BASE确保请求发送到正确的后端服务器
          const endpoint = '/prompts.json';
          
          try {
            console.log(`尝试从 ${API_SURGE}${endpoint} 加载推荐词数据...`);
            const response = await fetch(`${API_SURGE}${endpoint}`);
            if (response.ok) {
              data = await response.json();
              apiUrl = endpoint;
              console.log(`成功从 ${API_SURGE}${endpoint} 获取数据`);
            }
          } catch (e) {
            console.log(`从 ${API_SURGE}${endpoint} 获取数据失败:`, e.message);
          }
          
          if (data === null) {
            throw new Error('无法从任何API端点获取推荐词数据');
          }
          
          // 确保返回的数据是数组
          if (!Array.isArray(data)) {
            // 如果返回的是对象（如包含prompts数组的对象），尝试提取
            if (data.prompts && Array.isArray(data.prompts)) {
              data = data.prompts;
            } else {
              throw new Error('API返回的数据格式不正确');
            }
          }
          
          // 转换数据格式以匹配现有结构
          // API返回的数据格式: {name, description, tags, path}
          recommendedPrompts = data.map(prompt => ({
            name: prompt.name || prompt.title || '未命名提示词',
            description: prompt.description || prompt.desc || '暂无描述',
            content: prompt.content || '', // 如果没有content字段，后续可以动态加载
            tags: Array.isArray(prompt.tags) ? prompt.tags : (typeof prompt.tags === 'string' ? [prompt.tags] : []),
            group: prompt.group || prompt.category || 'default',
            path: prompt.path // 保留路径信息，用于后续加载完整内容
          }));
          
          console.log('成功加载推荐词数据:', recommendedPrompts);
          const layout = calculatePromptsLayout();
          recommendedPromptsPerPage = layout.count;
          currentCardWidth = layout.cardWidth;
          renderRecommendedPrompts();
          updateRecommendedPromptsNavigation();
        } catch (error) {
          console.error('加载推荐词失败:', error);
          // 如果API调用失败，将推荐提示词数据置空
          recommendedPrompts = [];
          
          // 不展示推荐区域
          const section = document.getElementById('recommendedPromptsSection');
          const blankContent = document.getElementById('customBlankContent');
          if (section) {
            section.classList.add('hidden');
          }
          if (blankContent) {
            blankContent.classList.add('no-recommendation');
          }
        }
      }

      // 渲染推荐词卡片
      function renderRecommendedPrompts() {
        const container = document.getElementById('recommendedPromptsList');
        const section = document.getElementById('recommendedPromptsSection');
        const blankContent = document.getElementById('customBlankContent');
        if (!container) return;
        
        const hasData = recommendedPrompts.length > 0;
        
        if (section) {
          section.classList.toggle('hidden', !hasData);
        }
        if (blankContent) {
          blankContent.classList.toggle('no-recommendation', !hasData);
        }
        
        // 清空容器
        container.innerHTML = '';
        
        if (!hasData) {
          return;
        }
        
        // 根据容器宽度动态计算每页显示的卡片数量和宽度
        const layout = calculatePromptsLayout();
        recommendedPromptsPerPage = layout.count;
        currentCardWidth = layout.cardWidth;
        
        // 确保当前页索引有效
        const maxIndex = Math.max(Math.ceil(recommendedPrompts.length / recommendedPromptsPerPage) - 1, 0);
        if (currentRecommendedPromptIndex > maxIndex) {
          currentRecommendedPromptIndex = 0;
        }
        
        // 计算当前页的推荐词
        const startIndex = currentRecommendedPromptIndex * recommendedPromptsPerPage;
        const endIndex = Math.min(startIndex + recommendedPromptsPerPage, recommendedPrompts.length);
        const currentPrompts = recommendedPrompts.slice(startIndex, endIndex);
        
        // 创建卡片元素
        currentPrompts.forEach((prompt, index) => {
          const card = document.createElement('div');
          card.className = 'recommended-prompt-card';
          card.style.width = currentCardWidth;
          card.style.marginRight = '12px';
          if (index === currentPrompts.length - 1) {
            card.style.marginRight = '0';
          }
          
          const hasTags = Array.isArray(prompt.tags) && prompt.tags.length > 0;
          const tagsHtml = hasTags
            ? `
            <div class="card-tags">
              ${prompt.tags.map(tag => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
          `
            : '';
          card.innerHTML = `
            <div class="card-header">
              <div class="card-title">${escapeHtml(prompt.name)}</div>
            </div>
            <div class="card-description">${escapeHtml(prompt.description)}</div>
            ${tagsHtml}
          `;
          
          // 添加点击事件
          card.addEventListener('click', () => {
            console.log('Card clicked:', prompt);
            showRecommendedPromptDetail(prompt);
          });
          
          container.appendChild(card);
        });
      }

      // 更新推荐词导航按钮状态
      function updateRecommendedPromptsNavigation() {
        const leftBtn = document.getElementById('recommendedPromptsLeft');
        const rightBtn = document.getElementById('recommendedPromptsRight');
        
        if (leftBtn) {
          leftBtn.classList.toggle('disabled', currentRecommendedPromptIndex <= 0);
        }
        
        if (rightBtn) {
          const maxIndex = Math.ceil(recommendedPrompts.length / recommendedPromptsPerPage) - 1;
          rightBtn.classList.toggle('disabled', currentRecommendedPromptIndex >= maxIndex);
        }
      }

      // 推荐词导航事件
      function navigateRecommendedPrompts(direction) {
        const maxIndex = Math.ceil(recommendedPrompts.length / recommendedPromptsPerPage) - 1;
        
        if (direction === 'left' && currentRecommendedPromptIndex > 0) {
          currentRecommendedPromptIndex--;
        } else if (direction === 'right' && currentRecommendedPromptIndex < maxIndex) {
          currentRecommendedPromptIndex++;
        }
        
        // 添加滑动动画
        const container = document.getElementById('recommendedPromptsList');
        if (container) {
          container.classList.add('sliding');
          setTimeout(() => {
            renderRecommendedPrompts();
            updateRecommendedPromptsNavigation();
            container.classList.remove('sliding');
          }, 10);
        } else {
          renderRecommendedPrompts();
          updateRecommendedPromptsNavigation();
        }
      }

      // 显示推荐词详情
      async function showRecommendedPromptDetail(prompt) {
        console.log('Showing recommended prompt detail:', prompt);
        // 保存当前推荐提示词数据，供同步弹窗使用
        window.currentRecommendedPromptData = prompt;
        
        const modal = document.getElementById('recommendedPromptModal');
        const titleEl = document.getElementById('recommendedPromptTitle');
        const descEl = document.getElementById('recommendedPromptDescription');
        const contentEl = document.getElementById('recommendedPromptContent');
        
        if (modal) {
          console.log('Modal element found, showing modal');
          modal.classList.remove('hidden');
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        } else {
          console.error('Modal element not found');
          return;
        }
        
        // 更新标题文本
        const titleTextEl = titleEl?.querySelector('.modal-title-text');
        if (titleTextEl) {
          console.log('Updating title text to:', prompt.name);
          titleTextEl.textContent = prompt.name;
        } else {
          console.warn('Title text element not found');
        }
        
        if (descEl) {
          console.log('Updating description to:', prompt.description);
          descEl.textContent = prompt.description;
        } else {
          console.warn('Description element not found');
        }
        
        // 如果prompt有完整内容，则直接显示
        if (prompt.content && prompt.content.trim() !== '') {
          if (contentEl) {
            console.log('Displaying direct content');
            contentEl.textContent = prompt.content;
          }
        } else {
          // 如果没有完整内容，则尝试从API动态加载
          if (contentEl) {
            console.log('Loading content from API');
            contentEl.textContent = '正在加载内容...';
            
            try {
              // 如果prompt有路径信息，尝试从surge端点加载完整内容
              if (prompt.path) {
                // 尝试从surge端点获取完整提示词内容
                console.log('Fetching content from surge endpoint:', `${API_SURGE}/${prompt.path}`);
                const surgeResponse = await fetch(`${API_SURGE}/${prompt.path}`);
                if (surgeResponse.ok) {
                  const fullPrompt = await surgeResponse.json();
                  console.log('Received full prompt from surge:', fullPrompt);
                  if (fullPrompt && fullPrompt.messages && Array.isArray(fullPrompt.messages)) {
                    // 获取所有消息内容，不区分role
                    const allContent = fullPrompt.messages.map(msg => {
                      if (typeof msg.content === 'string') {
                        return msg.content;
                      } else if (msg.content?.text) {
                        return msg.content.text;
                      } else {
                        return JSON.stringify(msg.content, null, 2);
                      }
                    }).join('\n\n---\n\n'); // 用分隔符连接不同消息
                    
                    contentEl.textContent = allContent;
                  }
                }
              } else {
                contentEl.textContent = '暂无详细内容';
              }
            } catch (error) {
              console.error('加载提示词内容失败:', error);
              contentEl.textContent = '加载内容失败: ' + error.message;
            }
          }
        }
        
        console.log('Finished showing recommended prompt detail');
      }

      // 隐藏推荐词详情
      function hideRecommendedPromptDetail() {
        console.log('Hiding recommended prompt detail');
        const modal = document.getElementById('recommendedPromptModal');
        if (modal) {
          console.log('Modal element found, hiding modal');
          modal.classList.remove('active');
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        } else {
          console.error('Modal element not found when trying to hide');
        }
      }

      // 显示同步到我的提示词弹窗
      function showSyncPromptModal() {
        const modal = document.getElementById('syncPromptModal');
        const groupSelect = document.getElementById('syncPromptGroup');
        const nameInput = document.getElementById('syncPromptName');
        
        if (nameInput && window.currentRecommendedPromptData) {
          // 设置默认名称为推荐提示词的名称
          nameInput.value = window.currentRecommendedPromptData.name || '';
        }
        
        if (groupSelect) {
          // 清空现有选项
          groupSelect.innerHTML = '<option value="">请选择目录</option>';
          
          // 获取现有目录并填充选项
          const flattenedGroups = flattenGroupTree(groupTreeState || []);
          flattenedGroups.forEach(group => {
            if (group.path !== 'default') { // 排除默认组，因为默认组可以作为目标
              const option = document.createElement('option');
              option.value = group.path;
              option.textContent = group.path;
              groupSelect.appendChild(option);
            }
          });
          
          // 添加默认选项
          const defaultOption = document.createElement('option');
          defaultOption.value = 'default';
          defaultOption.textContent = 'default';
          groupSelect.insertBefore(defaultOption, groupSelect.firstChild);
          
          // 默认选中 default 目录
          groupSelect.value = 'default';
        }
        
        if (modal) {
          modal.classList.remove('hidden');
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      }

      // 隐藏同步到我的提示词弹窗
      function hideSyncPromptModal() {
        const modal = document.getElementById('syncPromptModal');
        if (modal) {
          modal.classList.remove('active');
          modal.classList.add('hidden');
          document.body.style.overflow = '';
        }
      }

      // 同步推荐词到我的提示词
      async function syncRecommendedPrompt() {
        const groupSelect = document.getElementById('syncPromptGroup');
        const nameInput = document.getElementById('syncPromptName');
        const selectedGroup = groupSelect ? groupSelect.value : '';
        const customName = nameInput ? nameInput.value.trim() : '';
        
        if (!customName) {
          showMessage('请输入提示词名称', 'error');
          return;
        }
        
        if (!selectedGroup) {
          showMessage('请选择目录', 'error');
          return;
        }
        
        const promptData = window.currentRecommendedPromptData;
        if (!promptData) {
          showMessage('没有选择要同步的提示词', 'error');
          return;
        }
        
        try {
          // 显示加载中效果
          showLoading();
          
          // 获取完整的提示词数据
          let fullPromptData = null;
          
          // 如果有路径信息，从surge端点获取完整数据
          if (promptData.path) {
            try {
              const surgeResponse = await fetch(`${API_SURGE}/${promptData.path}`);
              if (surgeResponse.ok) {
                fullPromptData = await surgeResponse.json();
              }
            } catch (error) {
              console.warn('从surge端点获取完整数据失败:', error);
            }
          }
          
          // 如果没有从surge获取到数据，尝试从本地API获取
          if (!fullPromptData) {
            try {
              const localResponse = await apiCall(`/prompts/${encodeURIComponent(promptData.name)}`);
              if (localResponse && localResponse.yaml) {
                fullPromptData = window.jsyaml.load(localResponse.yaml);
              }
            } catch (error) {
              console.warn('从本地API获取完整数据失败:', error);
            }
          }
          
          // 如果仍然没有获取到完整数据，则使用推荐词数据作为基础
          if (!fullPromptData) {
            fullPromptData = {
              name: promptData.name,
              description: promptData.description || '',
              enabled: true,
              messages: [
                {
                  role: 'user',
                  content: {
                    text: promptData.content || promptData.description || ''
                  }
                }
              ],
              arguments: promptData.arguments || []
            };
          }
          
          // 使用用户自定义的名称和目录覆盖原数据
          fullPromptData.name = customName;
          
          // 创建包含所有必要信息的提示词对象
          const promptObject = {
            name: customName,
            description: fullPromptData.description || '',
            enabled: fullPromptData.enabled !== false, // 默认启用
            messages: fullPromptData.messages || [],
            arguments: fullPromptData.arguments || []
          };
          
          // 转换为YAML格式
          let yaml;
          try {
            yaml = window.jsyaml.dump(promptObject);
          } catch (error) {
            console.error('生成YAML失败:', error);
            showMessage('生成提示词数据失败', 'error');
            return;
          }
          
          // 调用API保存提示词
          const result = await apiCall('/prompts', {
            method: 'POST',
            body: JSON.stringify({
              name: customName,
              group: selectedGroup,
              yaml: yaml
            })
          });
          
          showMessage('同步成功');
          
          // 隐藏弹窗
          hideSyncPromptModal();
          hideRecommendedPromptDetail();
          
          // 重新加载提示词列表以显示新添加的提示词
          const searchInput = document.getElementById('searchInput');
          const searchValue = searchInput ? searchInput.value : '';
          await loadPrompts(searchValue);
        } catch (error) {
          console.error('同步推荐词失败:', error);
          showMessage('同步失败: ' + (error?.message || '未知错误'), 'error');
        } finally {
          // 隐藏加载中效果
          hideLoading();
        }
      }

      // 绑定推荐词相关事件
      function bindRecommendedPromptsEvents() {
        // 左右导航按钮事件
        const leftBtn = document.getElementById('recommendedPromptsLeft');
        const rightBtn = document.getElementById('recommendedPromptsRight');
        
        if (leftBtn) {
          leftBtn.addEventListener('click', () => {
            if (!leftBtn.classList.contains('disabled')) {
              navigateRecommendedPrompts('left');
            }
          });
        }
        
        if (rightBtn) {
          rightBtn.addEventListener('click', () => {
            if (!rightBtn.classList.contains('disabled')) {
              navigateRecommendedPrompts('right');
            }
          });
        }
        
        // 推荐词详情弹窗关闭事件
        const detailCloseBtn = document.getElementById('recommendedPromptClose');
        if (detailCloseBtn) {
          detailCloseBtn.addEventListener('click', hideRecommendedPromptDetail);
        }
        
        // 推荐词详情弹窗背景点击关闭
        const detailModal = document.getElementById('recommendedPromptModal');
        if (detailModal) {
          detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
              hideRecommendedPromptDetail();
            }
          });
        }
        
        // 同步到我的提示词按钮
        const syncBtn = document.getElementById('syncToMyPromptsBtn');
        if (syncBtn) {
          syncBtn.addEventListener('click', showSyncPromptModal);
        }
        
        // 同步弹窗关闭事件
        const syncCloseBtn = document.getElementById('syncPromptClose');
        const syncCancelBtn = document.getElementById('syncPromptCancel');
        
        if (syncCloseBtn) {
          syncCloseBtn.addEventListener('click', hideSyncPromptModal);
        }
        
        if (syncCancelBtn) {
          syncCancelBtn.addEventListener('click', hideSyncPromptModal);
        }
        
        // 同步弹窗背景点击关闭
        const syncModal = document.getElementById('syncPromptModal');
        if (syncModal) {
          syncModal.addEventListener('click', (e) => {
            if (e.target === syncModal) {
              hideSyncPromptModal();
            }
          });
        }
        
        // 确认同步按钮
        const syncConfirmBtn = document.getElementById('syncPromptConfirm');
        if (syncConfirmBtn) {
          syncConfirmBtn.addEventListener('click', syncRecommendedPrompt);
        }
        
        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            if (detailModal && detailModal.classList.contains('active')) {
              hideRecommendedPromptDetail();
            } else if (syncModal && syncModal.classList.contains('active')) {
              hideSyncPromptModal();
            }
          }
        });
        
        // 窗口大小改变时重新计算每页显示的卡片数量
        let resizeTimeout;
        window.addEventListener('resize', () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            const layout = calculatePromptsLayout();
            recommendedPromptsPerPage = layout.count;
            currentCardWidth = layout.cardWidth;
            // 确保当前页索引有效
            const maxIndex = Math.max(Math.ceil(recommendedPrompts.length / recommendedPromptsPerPage) - 1, 0);
            if (currentRecommendedPromptIndex > maxIndex) {
              currentRecommendedPromptIndex = maxIndex;
            }
            renderRecommendedPrompts();
            updateRecommendedPromptsNavigation();
          }, 300);
        });
      }
      
      // 获取推荐词数据
      loadRecommendedPrompts();
      // 绑定推荐词相关事件
      bindRecommendedPromptsEvents();
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
}

// 切换导航
function switchNav(navType) {
  console.log('[switchNav] Called with navType:', navType, ', currentNav:', currentNav);
  if (currentNav === navType) {
    console.log('[switchNav] Same nav, returning early');
    return;
  }

  currentNav = navType;
  console.log('[switchNav] Updated currentNav to:', navType);
  
  // 更新导航按钮状态
  document.querySelectorAll('.primary-nav-item').forEach(item => {
    if (item.dataset.nav === navType) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // 切换显示区域
  const promptsSidebar = document.getElementById('promptsSidebar');
  const promptsArea = document.getElementById('promptsArea');
  const toolsArea = document.getElementById('toolsArea');
  const terminalArea = document.getElementById('terminalArea');
  const skillsArea = document.getElementById('skillsArea');
  if (navType === 'prompts') {
    // 显示提示词区域
    if (promptsSidebar) promptsSidebar.style.display = 'flex';
    if (promptsArea) promptsArea.style.display = 'flex';
    if (toolsArea) toolsArea.style.display = 'none';
    if (terminalArea) terminalArea.style.display = 'none';
    if (skillsArea) skillsArea.style.display = 'none';
  } else if (navType === 'skills') {
    // 显示技能区域
    if (promptsSidebar) promptsSidebar.style.display = 'none';
    if (promptsArea) promptsArea.style.display = 'none';
    if (toolsArea) toolsArea.style.display = 'none';
    if (terminalArea) terminalArea.style.display = 'none';
    if (skillsArea) skillsArea.style.display = 'flex';

    // 初始化技能页面
    initSkillsPage();
  } else if (navType === 'tools') {
    // 显示工具区域
    if (promptsSidebar) promptsSidebar.style.display = 'none';
    if (promptsArea) promptsArea.style.display = 'none';
    if (toolsArea) toolsArea.style.display = 'flex';
    if (terminalArea) terminalArea.style.display = 'none';
    if (skillsArea) skillsArea.style.display = 'none';

    // 初始化工具页面
    initToolsPage();
  } else if (navType === 'terminal') {
    // 显示终端区域
    if (promptsSidebar) promptsSidebar.style.display = 'none';
    if (promptsArea) promptsArea.style.display = 'none';
    if (toolsArea) toolsArea.style.display = 'none';
    if (terminalArea) terminalArea.style.display = 'flex';
    if (skillsArea) skillsArea.style.display = 'none';

    // 初始化终端页面
    initTerminalPage();
  }
}

// 终端管理相关代码
// 终端状态
let terminalHistory = [];
let terminalHistoryIndex = -1;
let terminalCwd = '/';

// 初始化终端页面
async function initTerminalPage() {
  // 如果已经初始化过，不再重复初始化
  if (document.querySelector('.terminal-initialized')) return;

  // 标记已初始化
  document.querySelector('.terminal-area').classList.add('terminal-initialized');

  // 获取终端容器
  const terminalContainer = document.querySelector('.terminal-content');
  if (!terminalContainer) {
    console.error('Terminal container not found');
    return;
  }

  console.log('开始初始化新的终端组件...');

  // 创建新的终端组件
  try {
    // 清空现有内容
    terminalContainer.innerHTML = '';
    
    // 创建终端容器
    const terminalElement = document.createElement('div');
    terminalElement.className = 'xterm-container';
    terminalContainer.appendChild(terminalElement);

    console.log('终端容器已创建，正在初始化TerminalComponent...');

    // 显示加载消息
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = 'color: blue; padding: 10px; background: #e3f2fd; border-radius: 4px; margin: 10px 0;';
    loadingMsg.textContent = '正在加载新版终端组件...';
    terminalContainer.appendChild(loadingMsg);

    // 初始化终端组件
    const savedTheme = localStorage.getItem('terminal-theme') || 'dark';
    
    // 等待一小段时间让加载消息显示
    await new Promise(resolve => setTimeout(resolve, 100));
    
    terminalComponent = new TerminalComponent(terminalElement, {
      theme: savedTheme,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 1000
    });

    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 500));

    // 移除加载消息
    loadingMsg.remove();

    console.log('Terminal component initialized successfully');
    
    // 显示成功消息
    const successMsg = document.createElement('div');
    successMsg.style.cssText = 'color: green; padding: 10px; background: #e8f5e8; border-radius: 4px; margin: 10px 0;';
    successMsg.textContent = '✓ 新版终端已加载，支持实时交互功能';
    terminalContainer.appendChild(successMsg);
    
    // 3秒后移除成功消息
    setTimeout(() => {
      if (successMsg.parentNode) {
        successMsg.remove();
      }
    }, 3000);
    
  } catch (error) {
    console.error('Failed to initialize terminal component:', error);
    console.error('Error stack:', error.stack);
    
    // 移除加载消息（如果存在）
    const loadingMsg = terminalContainer.querySelector('div[style*="color: blue"]');
    if (loadingMsg) loadingMsg.remove();
    
    // 显示错误信息
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = 'color: red; padding: 10px; background: #ffeaea; border-radius: 4px; margin: 10px 0;';
    errorMsg.textContent = `✗ 新版终端初始化失败: ${error.message}，回退到旧版终端`;
    terminalContainer.appendChild(errorMsg);
    
    // 回退到旧的终端实现
    setTimeout(() => {
      if (errorMsg.parentNode) {
        errorMsg.remove();
      }
      initLegacyTerminal();
    }, 3000); // 延迟3秒让用户看到错误信息
  }
}

// 回退到旧的终端实现
function initLegacyTerminal() {
  const terminalContainer = document.querySelector('.terminal-content');
  if (terminalContainer) {
    // 恢复原始的HTML结构
    terminalContainer.innerHTML = `
      <div class="terminal-output" id="terminalOutput">
        <div class="terminal-welcome">
          <div>欢迎使用终端！输入 "help" 查看可用命令。</div>
        </div>
      </div>
      <div class="terminal-input-area">
        <div class="terminal-prompt">
          <span class="prompt-symbol">$</span>
          <span class="prompt-path">~</span>
          <span class="prompt-separator">›</span>
        </div>
        <input type="text" id="terminalInput" placeholder="输入命令..." autocomplete="off" />
      </div>
    `;
    
    // 绑定旧的事件监听器
    bindTerminalEvents();
    
    // 获取初始工作目录
    getTerminalCwd();
  }
}

// 获取终端工作目录
async function getTerminalCwd() {
  try {
    const cwdInfo = await apiCall('/terminal/cwd');
    terminalCwd = cwdInfo.cwd;
  } catch (error) {
    console.warn('获取工作目录失败，使用默认值:', error);
    terminalCwd = '/';
  }
  
  // 更新提示符
  updateTerminalPrompt();
  
  // 添加欢迎信息
  appendToTerminalOutput(`当前工作目录: ${terminalCwd}`);
}

// 绑定终端事件
function bindTerminalEvents() {
  const terminalInput = document.getElementById('terminalInput');
  const terminalClearBtn = document.getElementById('terminalClearBtn');

  if (terminalInput) {
    terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const command = terminalInput.value.trim();
        if (command) {
          executeTerminalCommand(command);
          terminalInput.value = '';
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateTerminalHistory('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateTerminalHistory('down');
      }
    });

    // 自动聚焦到输入框
    terminalInput.focus();
  }

  if (terminalClearBtn) {
    terminalClearBtn.addEventListener('click', clearTerminalOutput);
  }
}

// 执行终端命令
async function executeTerminalCommand(command) {
  // 添加命令到输出
  appendToTerminalOutput(`$ ${command}`);

  // 添加到历史记录
  terminalHistory.push(command);
  terminalHistoryIndex = terminalHistory.length;

  // 处理本地命令（不需要网络请求的）
  const args = command.split(' ');
  const cmd = args[0].toLowerCase();

  // 本地处理一些简单的命令
  switch (cmd) {
    case 'help':
      showTerminalHelp();
      return;
    case 'clear':
      clearTerminalOutput();
      return;
    case 'history':
      showTerminalHistory();
      return;
    case 'pwd':
      appendToTerminalOutput(terminalCwd);
      return;
    case 'ls':
      await showTerminalLs(args.slice(1));
      return;
  }

  // 其他命令通过API执行
  try {
    const response = await apiCall('/terminal/execute', {
      method: 'POST',
      body: JSON.stringify({
        command: command,
        cwd: terminalCwd
      })
    });

    // 显示标准输出
    if (response.output) {
      appendToTerminalOutput(response.output);
    }

    // 显示错误输出
    if (response.errorOutput) {
      appendToTerminalOutput(response.errorOutput, 'error');
    }

    // 显示退出状态
    if (response.exitCode !== 0) {
      appendToTerminalOutput(`命令执行失败，退出代码: ${response.exitCode}`, 'error');
    }

    // 更新当前工作目录（如果命令改变了它）
    if (response.cwd && response.cwd !== terminalCwd) {
      terminalCwd = response.cwd;
      updateTerminalPrompt();
    }

  } catch (error) {
    console.error('执行终端命令失败:', error);
    appendToTerminalOutput(`命令执行失败: ${error.message}`, 'error');
  }
}

// 显示帮助信息
function showTerminalHelp() {
  const helpText = `
可用的命令：
  help     - 显示此帮助信息
  clear    - 清空终端输出
  pwd      - 显示当前工作目录
  ls       - 列出目录内容
  echo     - 输出文本
  date     - 显示当前日期和时间
  whoami   - 显示当前用户
  history  - 显示命令历史

快捷键：
  ↑/↓     - 导航命令历史
  Enter   - 执行命令
  `;
  appendToTerminalOutput(helpText);
}

// 显示命令历史
function showTerminalHistory() {
  if (terminalHistory.length === 0) {
    appendToTerminalOutput('命令历史为空');
    return;
  }

  terminalHistory.forEach((cmd, index) => {
    appendToTerminalOutput(`${(index + 1).toString().padStart(3, ' ')}  ${cmd}`);
  });
}

// 导航命令历史
function navigateTerminalHistory(direction) {
  const terminalInput = document.getElementById('terminalInput');

  if (terminalHistory.length === 0) return;

  if (direction === 'up') {
    if (terminalHistoryIndex > 0) {
      terminalHistoryIndex--;
      terminalInput.value = terminalHistory[terminalHistoryIndex];
    }
  } else if (direction === 'down') {
    if (terminalHistoryIndex < terminalHistory.length - 1) {
      terminalHistoryIndex++;
      terminalInput.value = terminalHistory[terminalHistoryIndex];
    } else {
      terminalHistoryIndex = terminalHistory.length;
      terminalInput.value = '';
    }
  }

  // 将光标移到末尾
  setTimeout(() => {
    terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
  }, 0);
}

// 更新终端提示符
function updateTerminalPrompt() {
  const terminalPrompt = document.querySelector('.terminal-prompt');
  if (terminalPrompt) {
    const promptSymbol = terminalPrompt.querySelector('.prompt-symbol');
    if (promptSymbol) {
      const cwdDisplay = terminalCwd === '/' ? '/' : terminalCwd.split('/').pop() || terminalCwd;
      promptSymbol.textContent = `${cwdDisplay}$ `;
    }
  }
}

// 显示目录内容（通过API）
async function showTerminalLs(args) {
  try {
    const targetPath = args[0] || '.';
    const response = await apiCall(`/terminal/ls?path=${encodeURIComponent(targetPath)}`);

    if (response.success && response.items) {
      const output = response.items.map(item => {
        const type = item.type === 'directory' ? 'd' : '-';
        const size = item.type === 'file' ? formatFileSize(item.size) : '';
        const name = item.type === 'directory' ? `${item.name}/` : item.name;
        return `${type} ${name}${size ? ` (${size})` : ''}`;
      }).join('\n');

      appendToTerminalOutput(output || '目录为空');
    } else {
      appendToTerminalOutput('无法读取目录内容', 'error');
    }
  } catch (error) {
    appendToTerminalOutput(`ls: ${error.message}`, 'error');
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 添加内容到终端输出
function appendToTerminalOutput(content, type = 'normal') {
  const terminalOutput = document.getElementById('terminalOutput');

  if (!terminalOutput) return;

  const outputLine = document.createElement('div');
  outputLine.className = `terminal-line terminal-${type}`;

  // 处理多行内容
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) {
      outputLine.appendChild(document.createElement('br'));
    }
    outputLine.appendChild(document.createTextNode(line));
  });

  terminalOutput.appendChild(outputLine);

  // 自动滚动到底部
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// 清空终端输出
function clearTerminalOutput() {
  // 优先使用新的 TerminalComponent
  if (terminalComponent && terminalComponent.clear) {
    terminalComponent.clear();
    return;
  }

  // 回退到旧的终端实现
  const terminalOutput = document.getElementById('terminalOutput');
  if (terminalOutput) {
    // 保留欢迎信息
    const welcomeMessage = `
      <div class="terminal-welcome">
        <div class="welcome-icon">🚀</div>
        <div class="welcome-text">终端已清空</div>
        <div class="welcome-hint">输入命令并按回车键执行</div>
      </div>
    `;
    terminalOutput.innerHTML = welcomeMessage;
  }
}

// 工具管理相关代码
// 工具数据状态
let toolsData = [];
let currentFilter = 'all';
let currentSearch = '';
let selectedTag = null;

// 初始化工具页面
function initToolsPage() {
  // 如果已经初始化过，不再重复初始化
  if (document.querySelector('.tools-initialized')) return;
  
  // 标记已初始化
  document.querySelector('.tools-area').classList.add('tools-initialized');
  
  // 绑定事件监听器
  bindToolsEvents();
  
  // 加载工具数据
  loadToolsData();
}

// 绑定工具页面事件
function bindToolsEvents() {
  // 搜索功能
  const searchInput = document.getElementById('toolsSearchInput');
  const searchClear = document.getElementById('toolsSearchClear');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      searchClear.style.display = currentSearch ? 'flex' : 'none';
      
      // 如果有搜索内容且当前不在"全部"视图，自动切换到"全部"视图
      if (currentSearch && currentFilter !== 'all') {
        currentFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
        switchToolsView('all');
      } else {
        filterAndRenderTools();
      }
    });
  }
  
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      currentSearch = '';
      searchClear.style.display = 'none';
      filterAndRenderTools();
    });
  }
  
  // 过滤器按钮
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      if (currentFilter === filter) return;
      
      // 更新按钮状态
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 切换过滤器和视图
      currentFilter = filter;
      switchToolsView(filter);
    });
  });
  
  // 上传按钮
  const uploadBtn = document.getElementById('toolsUploadBtn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', showUploadModal);
  }
}

// 绑定上传弹窗事件
function bindUploadModalEvents() {
  const modal = document.getElementById('toolsUploadModal');
  const closeBtn = document.getElementById('toolsUploadCloseBtn');
  const cancelBtn = document.getElementById('toolsUploadCancelBtn');
  const confirmBtn = document.getElementById('toolsUploadConfirmBtn');
  const selectFileBtn = document.getElementById('selectFileBtn');
  const fileInput = document.getElementById('fileInput');
  const uploadArea = document.getElementById('uploadArea');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', hideUploadModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', hideUploadModal);
  }
  
  if (selectFileBtn) {
    selectFileBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        validateAndPreviewFile(file);
      }
    });
  }
  
  // 拖拽上传
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        validateAndPreviewFile(files[0]);
      }
    });
  }
}

// 绑定技能上传弹窗事件
function bindSkillsUploadModalEvents() {
  const modal = document.getElementById('skillsUploadModal');
  const closeBtn = document.getElementById('skillsUploadCloseBtn');
  const cancelBtn = document.getElementById('skillsUploadCancelBtn');
  const confirmBtn = document.getElementById('skillsUploadConfirmBtn');
  const selectFileBtn = document.getElementById('skillsSelectFileBtn');
  const fileInput = document.getElementById('skillsFileInput');
  const uploadArea = document.getElementById('skillsUploadArea');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideSkillsUploadModal();
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideSkillsUploadModal();
    });
  }
  
  // 点击弹窗外部关闭
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideSkillsUploadModal();
      }
    });
  }

  // 绑定 ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      hideSkillsUploadModal();
    }
  });
  
  if (selectFileBtn) {
    selectFileBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        validateAndPreviewSkillFile(file);
      }
    });
  }
  
  // 拖拽上传
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        validateAndPreviewSkillFile(files[0]);
      }
    });
  }
}

// 绑定工具详情弹窗事件
function bindToolDetailModalEvents() {
  const modal = document.getElementById('toolDetailModal');
  const closeBtn = document.getElementById('toolDetailClose');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', hideToolDetailModal);
  }
  
  // 点击弹窗外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideToolDetailModal();
    }
  });
}

// 加载工具数据
async function loadToolsData() {
  try {
    // 显示加载状态
    const toolsGrid = document.getElementById('toolsGrid');
    const toolsEmpty = document.getElementById('toolsEmpty');
    
    if (toolsGrid) toolsGrid.style.display = 'none';
    if (toolsEmpty) toolsEmpty.style.display = 'flex';
    if (toolsEmpty) {
      toolsEmpty.innerHTML = `
        <div class="tools-empty-icon">⏳</div>
        <div class="tools-empty-text">正在加载工具数据...</div>
        <div class="tools-empty-hint">请稍候</div>
      `;
    }
    
    let data;
    try {
      // 尝试从API获取数据
      const response = await fetch(`${API_HOST}/tool/list`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const apiData = await response.json();
      data = apiData.tools || apiData;
    } catch (apiError) {
      console.warn('API调用失败，使用模拟数据:', apiError);
      // 使用模拟数据
      data = [];
    }
    
    // 处理数据，确保格式一致
    toolsData = data.map(tool => ({
      id: tool.id || tool.name,
      name: tool.name || '未知工具',
      description: tool.description || '暂无描述',
      version: tool.version || '1.0.0',
      category: tool.category || 'utility',
      author: tool.author || 'Unknown',
      author_info: tool.author_info || {},
      tags: Array.isArray(tool.tags) ? tool.tags : [],
      scenarios: Array.isArray(tool.scenarios) ? tool.scenarios : [],
      limitations: Array.isArray(tool.limitations) ? tool.limitations : []
    }));
    
    filterAndRenderTools();
  } catch (error) {
    console.error('加载工具数据失败:', error);
    showMessage('加载工具数据失败: ' + error.message, 'error');
    
    // 显示错误状态
    const toolsEmpty = document.getElementById('toolsEmpty');
    if (toolsEmpty) {
      toolsEmpty.innerHTML = `
        <div class="tools-empty-icon">❌</div>
        <div class="tools-empty-text">加载失败</div>
        <div class="tools-empty-hint">无法连接到服务器，请检查网络连接</div>
      `;
    }
  }
}

// 切换工具视图
function switchToolsView(filter) {
  const toolsGrid = document.getElementById('toolsGrid');
  const aggregatedView = document.getElementById('toolsAggregatedView');
  const toolsEmpty = document.getElementById('toolsEmpty');
  
  // 隐藏所有视图
  if (toolsGrid) toolsGrid.style.display = 'none';
  if (aggregatedView) aggregatedView.style.display = 'none';
  if (toolsEmpty) toolsEmpty.style.display = 'none';
  
  // 隐藏所有聚合视图
  document.querySelectorAll('.aggregated-view').forEach(view => {
    view.style.display = 'none';
  });
  
  if (filter === 'all') {
    // 显示网格视图
    if (toolsGrid) toolsGrid.style.display = 'grid';
    filterAndRenderTools();
  } else {
    // 显示聚合视图
    if (aggregatedView) aggregatedView.style.display = 'block';
    
    if (filter === 'category') {
      showCategoryView();
    } else if (filter === 'tag') {
      showTagView();
    } else if (filter === 'author') {
      showAuthorView();
    }
  }
}

// 过滤和渲染工具
function filterAndRenderTools() {
  const toolsGrid = document.getElementById('toolsGrid');
  const toolsEmpty = document.getElementById('toolsEmpty');
  
  if (!toolsGrid || !toolsData.length) {
    if (toolsEmpty) toolsEmpty.style.display = 'flex';
    return;
  }
  
  // 过滤工具
  let filteredTools = toolsData.filter(tool => {
    const matchesSearch = !currentSearch || 
      tool.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
      tool.description.toLowerCase().includes(currentSearch.toLowerCase());
    
    return matchesSearch;
  });
  
  if (filteredTools.length === 0) {
    toolsGrid.style.display = 'none';
    if (toolsEmpty) toolsEmpty.style.display = 'flex';
  } else {
    toolsGrid.style.display = 'grid';
    if (toolsEmpty) toolsEmpty.style.display = 'none';
    renderToolsGrid(filteredTools);
  }
}

// 渲染工具网格
function renderToolsGrid(tools) {
  const toolsGrid = document.getElementById('toolsGrid');
  if (!toolsGrid) return;
  
  toolsGrid.innerHTML = tools.map(tool => createToolCard(tool)).join('');
  
  // 绑定卡片点击事件
  toolsGrid.querySelectorAll('.tool-card').forEach(card => {
    const toolId = card.dataset.toolId;
    
    card.addEventListener('click', () => {
      showToolDetail(toolId);
    });
    
    const detailBtn = card.querySelector('.tool-card-action');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showToolDetail(toolId);
      });
    }
    
    const metaTabs = card.querySelectorAll('.tool-card-meta-tab');
    metaTabs.forEach(tab => {
      const tabType = tab.classList.contains('scenarios-tab') ? 'scenarios' : 'limitations';
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        switchMetaTab(toolId, tabType, tab);
      });
    });
  });
}

// 创建工具卡片
function createToolCard(tool) {
  const hasScenarios = !!(tool.scenarios && tool.scenarios.length > 0);
  const hasLimitations = !!(tool.limitations && tool.limitations.length > 0);

  const metaHtml = hasScenarios || hasLimitations ? `
    <div class="tool-card-meta">
      <div class="tool-card-meta-tabs ${(tool.scenarios && tool.scenarios.length > 0 && tool.limitations && tool.limitations.length > 0) ? '' : 'single-tab ' + 
        (tool.scenarios && tool.scenarios.length > 0 ? 'scenarios-only' : 'limitations-only')}">
        ${tool.scenarios && tool.scenarios.length > 0 ? `
          <button class="tool-card-meta-tab scenarios-tab active">
            🎯 使用场景
          </button>
        ` : ''}
        ${tool.limitations && tool.limitations.length > 0 ? `
          <button class="tool-card-meta-tab limitations-tab ${!tool.scenarios || tool.scenarios.length === 0 ? 'active' : ''}">
            ⚠️ 使用限制
          </button>
        ` : ''}
      </div>
      <div class="tool-card-meta-content">
        ${tool.scenarios && tool.scenarios.length > 0 ? `
          <div class="tool-card-meta-panel scenarios active" id="meta-scenarios-${tool.id}">
            <div class="tool-card-meta-list">
              ${tool.scenarios.map(scenario => `<span class="tool-card-meta-item">${scenario}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        ${tool.limitations && tool.limitations.length > 0 ? `
          <div class="tool-card-meta-panel limitations ${!tool.scenarios || tool.scenarios.length === 0 ? 'active' : ''}" id="meta-limitations-${tool.id}">
            <div class="tool-card-meta-list">
              ${tool.limitations.map(limitation => `<span class="tool-card-meta-item">${limitation}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  const tagsHtml = tool.tags && tool.tags.length > 0 ? `
    <div class="tool-card-tags-row" data-tool-id="${tool.id}">
      <div class="tool-card-tags-container">
        ${tool.tags.map(tag => `<span class="tool-card-tag">${tag}</span>`).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div class="tool-card" data-tool-id="${tool.id}">
      <div class="tool-card-header">
        <h3 class="tool-card-title">
          ${tool.name}
        </h3>
        <span class="tool-card-version">v${tool.version}</span>
      </div>
      
      <div class="tool-card-description-wrapper">
        <p class="tool-card-description"><span class="tool-card-category-badge">${tool.category}</span>${tool.description}</p>
      </div>
      
      ${tagsHtml}
      
      ${metaHtml}
      
      <div class="tool-card-footer">
        <div class="tool-card-author">
          ${tool.author_info && tool.author_info.avatar_url ? `
            <div class="tool-card-author-avatar">
              <img src="${tool.author_info.avatar_url}" 
                   alt="${tool.author}"
                   onerror="this.onerror=null;this.parentElement.innerHTML='${tool.author.charAt(0)}'">
            </div>
          ` : `
            <div class="tool-card-author-avatar tool-card-author-avatar-default">${tool.author.charAt(0)}</div>
          `}
          <span>${tool.author}</span>
        </div>
        <div class="tool-card-actions">
          <button class="tool-card-action">详情</button>
        </div>
      </div>
    </div>
  `;
}

// 当前选中的类别和作者
let selectedCategory = null;
let selectedAuthor = null;

// 显示类别视图
function showCategoryView() {
  const categoryView = document.getElementById('categoryView');
  const categorySidebar = document.getElementById('categorySidebar');
  const categoryContentHeader = document.getElementById('categoryContentHeader');
  const categoryContentGrid = document.getElementById('categoryContentGrid');
  
  if (!categoryView || !categorySidebar) return;
  
  categoryView.style.display = 'flex';
  
  // 按类别分组
  const categories = {};
  toolsData.forEach(tool => {
    if (!categories[tool.category]) {
      categories[tool.category] = [];
    }
    categories[tool.category].push(tool);
  });
  
  // 渲染侧边栏类别列表
  categorySidebar.innerHTML = Object.entries(categories).map(([category, tools]) => `
    <div class="sidebar-item ${selectedCategory === category ? 'active' : ''}" data-category="${category}">
      <div class="sidebar-item-icon">${getCategoryIcon(category)}</div>
      <div class="sidebar-item-content">
        <div class="sidebar-item-name">${category}</div>
        <div class="sidebar-item-count">${tools.length} 个工具</div>
      </div>
    </div>
  `).join('');
  
  // 绑定侧边栏项目点击事件
  categorySidebar.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const category = item.dataset.category;
      selectCategory(category);
    });
  });
  
  // 如果有选中的类别，显示对应的工具
  if (selectedCategory && categories[selectedCategory]) {
    categoryContentHeader.innerHTML = `<h3>${selectedCategory}</h3>`;
    categoryContentGrid.innerHTML = categories[selectedCategory].map(tool => createToolCard(tool)).join('');
    
    // 绑定卡片点击事件
    categoryContentGrid.querySelectorAll('.tool-card').forEach(card => {
      const toolId = card.dataset.toolId;
      
      card.addEventListener('click', () => {
        showToolDetail(toolId);
      });
      
      // 绑定详情按钮事件
      const detailBtn = card.querySelector('.tool-card-action');
      if (detailBtn) {
        detailBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showToolDetail(toolId);
        });
      }
      
      // 绑定 meta tab 切换事件
      const metaTabs = card.querySelectorAll('.tool-card-meta-tab');
      metaTabs.forEach(tab => {
        const tabType = tab.classList.contains('scenarios-tab') ? 'scenarios' : 'limitations';
        
        tab.addEventListener('click', (e) => {
          e.stopPropagation();
          switchMetaTab(toolId, tabType, tab);
        });
      });
    });
  } else {
    categoryContentHeader.innerHTML = '<h3>请选择类别</h3>';
    categoryContentGrid.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 60px 20px;">请从左侧选择一个类别查看工具</div>';
  }
}

// 选择类别
function selectCategory(category) {
  selectedCategory = category;
  showCategoryView();
}

// 显示标签视图
function showTagView() {
  const tagView = document.getElementById('tagView');
  const tagCloud = document.getElementById('tagCloud');
  const tagToolsList = document.getElementById('tagToolsList');
  
  if (!tagView || !tagCloud || !tagToolsList) return;
  
  tagView.style.display = 'block';
  tagView.style.margin = '20px';
  
  // 收集所有标签
  const allTags = new Set();
  toolsData.forEach(tool => {
    tool.tags.forEach(tag => allTags.add(tag));
  });
  
  // 渲染标签云
  tagCloud.innerHTML = Array.from(allTags).map(tag => `
    <span class="tag-item ${selectedTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</span>
  `).join('');
  
  // 绑定标签点击事件
  tagCloud.querySelectorAll('.tag-item').forEach(item => {
    item.addEventListener('click', () => {
      const tag = item.dataset.tag;
      selectTag(tag);
    });
  });
  
  // 如果有选中的标签，显示对应的工具
  if (selectedTag) {
    const tagTools = toolsData.filter(tool => tool.tags.includes(selectedTag));
    tagToolsList.innerHTML = tagTools.map(tool => createToolCard(tool)).join('');
    
    // 绑定卡片点击事件
    tagToolsList.querySelectorAll('.tool-card').forEach(card => {
      const toolId = card.dataset.toolId;
      
      card.addEventListener('click', () => {
        showToolDetail(toolId);
      });
      
      // 绑定详情按钮事件
      const detailBtn = card.querySelector('.tool-card-action');
      if (detailBtn) {
        detailBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showToolDetail(toolId);
        });
      }
      
      // 绑定 meta tab 切换事件
      const metaTabs = card.querySelectorAll('.tool-card-meta-tab');
      metaTabs.forEach(tab => {
        const tabType = tab.classList.contains('scenarios-tab') ? 'scenarios' : 'limitations';
        tab.addEventListener('click', (e) => {
          e.stopPropagation();
          switchMetaTab(toolId, tabType, tab);
        });
      });
    });
  } else {
    tagToolsList.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 40px;">请选择一个标签查看相关工具</div>';
  }
}

// 显示作者视图
function showAuthorView() {
  const authorView = document.getElementById('authorView');
  const authorSidebar = document.getElementById('authorSidebar');
  const authorContentHeader = document.getElementById('authorContentHeader');
  const authorContentGrid = document.getElementById('authorContentGrid');
  
  if (!authorView || !authorSidebar) return;
  
  authorView.style.display = 'flex';
  
  const authors = {};
  toolsData.forEach(tool => {
    if (!authors[tool.author]) {
      const authorInfo = tool.author_info || {};
      authors[tool.author] = {
        name: tool.author,
        tools: [],
        author_info: authorInfo
      };
    }
    authors[tool.author].tools.push(tool);
  });
  
  const sortedAuthors = Object.values(authors).sort((a, b) => {
    const aInfo = a.author_info || {};
    const bInfo = b.author_info || {};
    return (aInfo.sort_order || 999) - (bInfo.sort_order || 999);
  });
  
  authorSidebar.innerHTML = sortedAuthors.map(author => {
    const authorInfo = author.author_info || {};
    const hasGitHubAvatar = authorInfo.avatar_url && authorInfo.avatar_url.length > 0;
    
    const avatarHtml = hasGitHubAvatar
      ? `<img src="${authorInfo.avatar_url}" 
           alt="${authorInfo.name}"
           class="sidebar-item-avatar-img"
           onload="this.classList.add('loaded')"
           onerror="this.classList.add('hidden')">
        <span class="sidebar-item-avatar-fallback">${authorInfo.name ? authorInfo.name.charAt(0) : author.name.charAt(0)}</span>`
      : `<span class="sidebar-item-avatar-fallback">${authorInfo.name ? authorInfo.name.charAt(0) : author.name.charAt(0)}</span>`;

    return `
      <div class="sidebar-item ${selectedAuthor === author.name ? 'active' : ''}" data-author="${author.name}">
        <div class="sidebar-item-avatar">${avatarHtml}</div>
        <div class="sidebar-item-content">
          <div class="sidebar-item-name">
            ${author.name}
            ${authorInfo.featured ? '<span class="featured-badge">⭐</span>' : ''}
          </div>
          <div class="sidebar-item-count">${author.tools.length} 个工具</div>
        </div>
      </div>
    `;
  }).join('');
  
  // 绑定侧边栏项目点击事件
  authorSidebar.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const authorName = item.dataset.author;
      selectAuthor(authorName);
    });
  });
  
  // 如果有选中的作者，显示对应的工具
  if (selectedAuthor && authors[selectedAuthor]) {
    const author = authors[selectedAuthor];
    const authorInfo = author.author_info || {};

    const avatarHtml = authorInfo.avatar_url && authorInfo.avatar_url.length > 0
      ? `<img src="${authorInfo.avatar_url}" 
           alt="${authorInfo.name}"
           class="author-header-avatar-img"
           onload="this.classList.add('loaded')"
           onerror="this.classList.add('hidden')">
        <span class="author-header-avatar-fallback">${authorInfo.name ? authorInfo.name.charAt(0) : author.name.charAt(0)}</span>`
      : `<span class="author-header-avatar-fallback">${authorInfo.name ? authorInfo.name.charAt(0) : author.name.charAt(0)}</span>`;

    const githubLink = authorInfo.github 
      ? `<a href="${authorInfo.github}" target="_blank" class="author-header-github-link" title="GitHub">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="#6c757d">
             <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
           </svg>
         </a>`
      : '';

    const homepageLink = authorInfo.homepage && authorInfo.homepage !== authorInfo.github
      ? `<a href="${authorInfo.homepage}" target="_blank" class="author-header-homepage-link" title="主页">
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="" stroke-width="2">
             <circle cx="12" cy="12" r="10"/>
             <line x1="2" y1="12" x2="22" y2="12"/>
             <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
           </svg>
         </a>`
      : '';

    authorContentHeader.innerHTML = `
      <div class="author-header">
        <div class="author-header-avatar-wrapper">
          <div class="author-header-avatar">
            ${avatarHtml}
          </div>
        </div>
        <div class="author-header-info">
          <div class="author-header-title-row">
            <h3>
              ${author.name}
              ${githubLink ? `<span class="author-header-github-inline">${githubLink}</span>` : ''}
            </h3>
          </div>
          <div class="author-header-bio">${authorInfo.bio || author.role || '开发者'}</div>
          <!--<div class="author-header-stats">
            <span class="author-header-tool-count">${author.tools.length} 个工具</span>
            ${homepageLink ? `<span class="author-header-homepage-inline">${homepageLink}</span>` : ''}
          </div>-->
        </div>
      </div>
    `;
    authorContentGrid.innerHTML = author.tools.map(tool => createToolCard(tool)).join('');
    
    // 绑定卡片点击事件
    authorContentGrid.querySelectorAll('.tool-card').forEach(card => {
      const toolId = card.dataset.toolId;
      
      card.addEventListener('click', () => {
        showToolDetail(toolId);
      });
      
      // 绑定详情按钮事件
      const detailBtn = card.querySelector('.tool-card-action');
      if (detailBtn) {
        detailBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showToolDetail(toolId);
        });
      }
      
      // 绑定 meta tab 切换事件
      const metaTabs = card.querySelectorAll('.tool-card-meta-tab');
      metaTabs.forEach(tab => {
        const tabType = tab.classList.contains('scenarios-tab') ? 'scenarios' : 'limitations';
        tab.addEventListener('click', (e) => {
          e.stopPropagation();
          switchMetaTab(toolId, tabType, tab);
        });
      });
    });
  } else {
    authorContentHeader.innerHTML = '<h3>请选择作者</h3>';
    authorContentGrid.innerHTML = '<div style="text-align: center; color: var(--gray); padding: 60px 20px;">请从左侧选择一个作者查看工具</div>';
  }
}

// 选择作者
function selectAuthor(author) {
  selectedAuthor = author;
  showAuthorView();
}

function getCategoryIcon(category) {
  const icons = {
    'utility': '🔧',
    'file': '📁',
    'document': '📄',
    'network': '🌐',
    'development': '💻',
    'automation': '⚡'
  };
  return icons[category] || '📦';
}

// 获取总下载量（模拟数据）
function getTotalDownloads(tools) {
  return Math.floor(Math.random() * 10000) + 1000;
}

// 选择标签
function selectTag(tag) {
  selectedTag = selectedTag === tag ? null : tag;
  showTagView();
}

// 显示类别工具（保持兼容性）
function showCategoryTools(category) {
  selectCategory(category);
}

// 显示作者工具（保持兼容性）
function showAuthorTools(author) {
  selectAuthor(author);
}

// 将函数暴露到全局作用域
window.showCategoryTools = showCategoryTools;
window.showAuthorTools = showAuthorTools;
window.selectTag = selectTag;
window.selectCategory = selectCategory;
window.selectAuthor = selectAuthor;

// 显示上传弹窗
function showUploadModal() {
  const modal = document.getElementById('toolsUploadModal');
  if (modal) {
    modal.classList.remove('hidden');
    resetUploadModal();
  }
}

// 隐藏上传弹窗
function hideUploadModal() {
  const modal = document.getElementById('toolsUploadModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// 显示技能上传弹窗
function showSkillsUploadModal() {
  const modal = document.getElementById('skillsUploadModal');
  if (modal) {
    modal.classList.remove('hidden');
    resetSkillsUploadModal();
  }
}

// 隐藏技能上传弹窗
function hideSkillsUploadModal() {
  const modal = document.getElementById('skillsUploadModal');
  if (modal) {
    modal.classList.add('hidden');
    // 使用 setTimeout 确保在动画结束后重置状态，或者直接重置
    resetSkillsUploadModal();
  }
}

// 重置技能上传弹窗
function resetSkillsUploadModal() {
  const fileInput = document.getElementById('skillsFileInput');
  const confirmBtn = document.getElementById('skillsUploadConfirmBtn');
  const uploadProgress = document.getElementById('skillsUploadProgress');
  const progressFill = document.getElementById('skillsProgressFill');
  const progressText = document.getElementById('skillsProgressText');
  const uploadContent = document.querySelector('#skillsUploadModal .upload-content');
  const uploadTitle = document.querySelector('#skillsUploadModal .upload-title');
  const uploadSubtitle = document.querySelector('#skillsUploadModal .upload-subtitle');
  
  if (fileInput) fileInput.value = '';
  if (confirmBtn) confirmBtn.disabled = true;
  if (uploadProgress) uploadProgress.style.display = 'none';
  if (progressFill) progressFill.style.width = '0%';
  if (progressText) progressText.textContent = '上传中...';
  if (uploadContent) uploadContent.style.display = 'flex';
  if (uploadTitle) uploadTitle.textContent = '拖拽ZIP文件到此处或点击选择';
  if (uploadSubtitle) uploadSubtitle.textContent = '支持包含 SKILL.md 和相关文件的ZIP格式技能包';
}

// 验证并预览技能文件
function validateAndPreviewSkillFile(file) {
  const confirmBtn = document.getElementById('skillsUploadConfirmBtn');
  const uploadTitle = document.querySelector('#skillsUploadModal .upload-title');
  const uploadSubtitle = document.querySelector('#skillsUploadModal .upload-subtitle');
  
  // 验证文件类型
  if (!file.name.endsWith('.zip')) {
    showMessage('请选择ZIP格式的文件', 'error');
    return;
  }
  
  // 验证文件大小（限制为10MB）
  if (file.size > 10 * 1024 * 1024) {
    showMessage('文件大小不能超过10MB', 'error');
    return;
  }
  
  // 更新UI
  if (uploadTitle) uploadTitle.textContent = `已选择: ${file.name}`;
  if (uploadSubtitle) uploadSubtitle.textContent = `大小: ${(file.size / 1024).toFixed(2)} KB`;
  if (confirmBtn) confirmBtn.disabled = false;
  
  // 绑定确认上传事件
  if (confirmBtn) {
    confirmBtn.onclick = () => uploadSkillFile(file);
  }
}

// 上传技能文件
async function uploadSkillFile(file) {
  const confirmBtn = document.getElementById('skillsUploadConfirmBtn');
  const uploadProgress = document.getElementById('skillsUploadProgress');
  const progressFill = document.getElementById('skillsProgressFill');
  const progressText = document.getElementById('skillsProgressText');
  const uploadContent = document.querySelector('#skillsUploadModal .upload-content');
  
  try {
    // 禁用按钮
    if (confirmBtn) confirmBtn.disabled = true;
    
    // 显示进度条
    if (uploadContent) uploadContent.style.display = 'none';
    if (uploadProgress) uploadProgress.style.display = 'block';
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', file);
    
    // 获取后端URL
    const backendUrl = window.getBackendUrl ? window.getBackendUrl() : 'http://localhost:5621';
    
    // 创建XMLHttpRequest对象进行上传
    const xhr = new XMLHttpRequest();
    
    // 监听上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        if (progressFill) progressFill.style.width = `${percentComplete}%`;
        if (progressText) progressText.textContent = `上传中... ${Math.round(percentComplete)}%`;
      }
    });
    
    // 处理响应
    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        // 上传成功
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '上传完成！';
        
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (response.success) {
            showMessage(`技能 ${response.skillName} 上传成功！`, 'success');
            hideSkillsUploadModal();
            // 重新加载技能数据
            if (window.SkillsArea && window.SkillsArea.loadSkills) {
              await window.SkillsArea.loadSkills();
            }
          } else {
            showMessage(`上传失败: ${response.error}`, 'error');
            setTimeout(() => {
              hideSkillsUploadModal();
            }, 2000);
          }
        } catch (parseError) {
          showMessage('服务器返回格式错误', 'error');
          setTimeout(() => {
            hideSkillsUploadModal();
          }, 2000);
        }
      } else if (xhr.status === 409) {
        // 技能已存在，需要确认是否覆盖
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (response.error && response.canOverwrite) {
            const shouldOverwrite = confirm(`技能 "${response.skillName}" 已存在，是否要覆盖？\n\n覆盖将删除原有文件并替换为新的技能包。`);
            
            if (shouldOverwrite) {
              // 用户确认覆盖，重新上传并添加覆盖参数
              const formDataWithOverwrite = new FormData();
              formDataWithOverwrite.append('file', file);
              formDataWithOverwrite.append('overwrite', 'true');
              
              const xhrOverwrite = new XMLHttpRequest();
              xhrOverwrite.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  const percentComplete = (e.loaded / e.total) * 100;
                  if (progressFill) progressFill.style.width = `${percentComplete}%`;
                  if (progressText) progressText.textContent = `覆盖中... ${Math.round(percentComplete)}%`;
                }
              });
              
              xhrOverwrite.addEventListener('load', () => {
                if (xhrOverwrite.status === 200) {
                  const response = JSON.parse(xhrOverwrite.responseText);
                  if (response.success) {
                    showMessage(`技能 ${response.skillName} 覆盖成功！`, 'success');
                    hideSkillsUploadModal();
                    if (window.SkillsArea && window.SkillsArea.loadSkills) {
                      window.SkillsArea.loadSkills();
                    }
                  } else {
                    showMessage(`覆盖失败: ${response.error}`, 'error');
                    setTimeout(() => {
                      hideSkillsUploadModal();
                    }, 2000);
                  }
                } else {
                  showMessage('上传失败，请重试', 'error');
                  setTimeout(() => {
                    hideSkillsUploadModal();
                  }, 2000);
                }
              });
              
              xhrOverwrite.addEventListener('error', () => {
                showMessage('网络错误，请检查连接', 'error');
                setTimeout(() => {
                  hideSkillsUploadModal();
                }, 2000);
              });
              
              xhrOverwrite.open('POST', `${backendUrl}/adminapi/skills/upload`);
              xhrOverwrite.send(formDataWithOverwrite);
            } else {
              // 用户取消覆盖
              hideSkillsUploadModal();
            }
          } else {
            showMessage(`上传失败: ${response.error}`, 'error');
            setTimeout(() => {
              hideSkillsUploadModal();
            }, 2000);
          }
        } catch (parseError) {
          showMessage('服务器返回格式错误', 'error');
          setTimeout(() => {
            hideSkillsUploadModal();
          }, 2000);
        }
      } else {
        showMessage('上传失败，请重试', 'error');
        setTimeout(() => {
          hideSkillsUploadModal();
        }, 2000);
      }
    });
    
    xhr.addEventListener('error', () => {
      showMessage('网络错误，请检查连接', 'error');
      setTimeout(() => {
        hideSkillsUploadModal();
      }, 2000);
    });
    
    // 发送请求
    xhr.open('POST', `${backendUrl}/adminapi/skills/upload`);
    xhr.send(formData);
    
  } catch (error) {
    console.error('上传技能文件时出错:', error);
    showMessage('上传失败，请重试', 'error');
    setTimeout(() => {
      hideSkillsUploadModal();
    }, 2000);
  }
}

// 重置上传弹窗
function resetUploadModal() {
  const fileInput = document.getElementById('fileInput');
  const confirmBtn = document.getElementById('toolsUploadConfirmBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadContent = document.querySelector('.upload-content');
  
  if (fileInput) fileInput.value = '';
  if (confirmBtn) confirmBtn.disabled = true;
  if (uploadProgress) uploadProgress.style.display = 'none';
  if (uploadContent) uploadContent.style.display = 'flex';
}

// 验证并预览文件
function validateAndPreviewFile(file) {
  const confirmBtn = document.getElementById('toolsUploadConfirmBtn');
  const uploadTitle = document.querySelector('.upload-title');
  const uploadSubtitle = document.querySelector('.upload-subtitle');
  
  // 验证文件类型
  if (!file.name.endsWith('.zip')) {
    showMessage('请选择ZIP格式的文件', 'error');
    return;
  }
  
  // 验证文件大小（限制为10MB）
  if (file.size > 10 * 1024 * 1024) {
    showMessage('文件大小不能超过10MB', 'error');
    return;
  }
  
  // 更新UI
  if (uploadTitle) uploadTitle.textContent = `已选择: ${file.name}`;
  if (uploadSubtitle) uploadSubtitle.textContent = `大小: ${(file.size / 1024).toFixed(2)} KB`;
  if (confirmBtn) confirmBtn.disabled = false;
  
  // 绑定确认上传事件
  if (confirmBtn) {
    confirmBtn.onclick = () => uploadFile(file);
  }
}

// 上传文件
async function uploadFile(file) {
  const confirmBtn = document.getElementById('toolsUploadConfirmBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const uploadContent = document.querySelector('.upload-content');
  
  try {
    // 禁用按钮
    if (confirmBtn) confirmBtn.disabled = true;
    
    // 显示进度条
    if (uploadContent) uploadContent.style.display = 'none';
    if (uploadProgress) uploadProgress.style.display = 'block';
    
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', file);
    
    // 创建XMLHttpRequest对象进行上传
    const xhr = new XMLHttpRequest();
    
    // 监听上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        if (progressFill) progressFill.style.width = `${percentComplete}%`;
        if (progressText) progressText.textContent = `上传中... ${Math.round(percentComplete)}%`;
      }
    });
    
    // 处理响应
    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        // 上传成功
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '上传完成！';
        
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (response.success) {
            showMessage(`工具 ${response.toolName} 上传成功！`, 'success');
            hideUploadModal();
            // 重新加载工具数据
            loadToolsData();
          } else {
            showMessage(`上传失败: ${response.error}`, 'error');
            setTimeout(() => {
              hideUploadModal();
            }, 2000);
          }
        } catch (parseError) {
          showMessage('服务器返回格式错误', 'error');
          setTimeout(() => {
            hideUploadModal();
          }, 2000);
        }
      } else if (xhr.status === 409) {
        // 工具已存在，需要确认是否覆盖
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (response.error && response.canOverwrite) {
            const shouldOverwrite = confirm(`工具 "${response.toolName}" 已存在，是否要覆盖？\n\n覆盖将删除原有文件并替换为新的工具包。`);
            
            if (shouldOverwrite) {
              // 用户确认覆盖，重新上传并添加覆盖参数
              formData.append('overwrite', 'true');
              
              const overwriteXhr = new XMLHttpRequest();
              
              overwriteXhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                  const percentComplete = (e.loaded / e.total) * 100;
                  if (progressFill) progressFill.style.width = `${percentComplete}%`;
                  if (progressText) progressText.textContent = `覆盖上传中... ${Math.round(percentComplete)}%`;
                }
              });
              
              overwriteXhr.addEventListener('load', () => {
                if (overwriteXhr.status === 200) {
                  try {
                    const overwriteResponse = JSON.parse(overwriteXhr.responseText);
                    
                    if (overwriteResponse.success) {
                      showMessage(`工具 ${overwriteResponse.toolName} 覆盖上传成功！`, 'success');
                      hideUploadModal();
                      // 重新加载工具数据
                      loadToolsData();
                    } else {
                      showMessage(`覆盖上传失败: ${overwriteResponse.error}`, 'error');
                      setTimeout(() => {
                        hideUploadModal();
                      }, 2000);
                    }
                  } catch (parseError) {
                    showMessage('服务器返回格式错误', 'error');
                    setTimeout(() => {
                      hideUploadModal();
                    }, 2000);
                  }
                } else {
                  // 覆盖失败
                  try {
                    const errorResponse = JSON.parse(overwriteXhr.responseText);
                    showMessage(`覆盖上传失败: ${errorResponse.error || '未知错误'}`, 'error');
                  } catch {
                    showMessage('覆盖上传失败', 'error');
                  }
                  setTimeout(() => {
                    hideUploadModal();
                  }, 2000);
                }
              });
              
              overwriteXhr.addEventListener('error', () => {
                showMessage('覆盖上传请求失败', 'error');
                setTimeout(() => {
                  hideUploadModal();
                }, 2000);
              });
              
              overwriteXhr.open('POST', `${API_HOST}/tool/upload`);
              overwriteXhr.setRequestHeader('Authorization', `Bearer ${currentToken}`);
              overwriteXhr.send(formData);
            } else {
              // 用户取消覆盖
              showMessage('上传已取消', 'info');
              setTimeout(() => {
                hideUploadModal();
              }, 2000);
            }
          }
        } catch (error) {
          showMessage('处理响应失败', 'error');
          setTimeout(() => {
            hideUploadModal();
          }, 2000);
        }
      } else {
        // 上传失败
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          showMessage(`上传失败: ${errorResponse.error || '未知错误'}`, 'error');
        } catch {
          showMessage(`上传失败: HTTP ${xhr.status}`, 'error');
        }
        setTimeout(() => {
          hideUploadModal();
        }, 2000);
      }
    });
    
    xhr.addEventListener('error', () => {
      showMessage('上传请求失败', 'error');
      setTimeout(() => {
        hideUploadModal();
      }, 2000);
    });
    
    // 发送请求
    xhr.open('POST', `${API_HOST}/tool/upload`);
    if (currentToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${currentToken}`);
    }
    xhr.send(formData);
    
  } catch (error) {
    console.error('上传失败:', error);
    showMessage('上传失败，请重试', 'error');
    setTimeout(() => {
      hideUploadModal();
    }, 2000);
  }
}

// 验证ZIP文件内容（已通过后端处理，这里不再需要模拟验证）
async function validateZipContent(file) {
  // 此函数已不再需要，后端会处理验证
  return true;
}

// 显示工具详情
async function showToolDetail(toolId) {
  const tool = toolsData.find(t => t.id === toolId);
  if (!tool) return;
  
  const modal = document.getElementById('toolDetailModal');
  const toolName = document.getElementById('toolDetailName');
  const toolInfo = document.getElementById('toolDetailInfo');
  const toolContent = document.getElementById('toolDetailContent');
  
  if (!modal || !toolName || !toolInfo || !toolContent) return;
  
  // 设置工具名称（带版本号）
  toolName.innerHTML = `
    <div style="display: flex; align-items: flex-start; justify-content: space-between; width: 100%; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 28px;">🛠️</span>
        <span style="font-size: 24px; font-weight: 600;">${escapeHtml(tool.name)}</span>
      </div>
      <span style="background: rgba(255, 255, 255, 0.25); color: white; padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 500;">v${escapeHtml(tool.version)}</span>
    </div>
  `;
  
  // 设置工具基本信息
  const tags = Array.isArray(tool.tags) ? tool.tags : [];
  toolInfo.innerHTML = `
    <div style="display: flex; align-items: center; gap: 42px; margin-bottom: 16px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #667eea; font-size: 18px;">👤</span>
        <div>
          <div style="font-size: 12px; color: #6c757d; margin-bottom: 2px;">作者</div>
          <strong style="font-size: 14px;">${escapeHtml(tool.author)}</strong>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #667eea; font-size: 18px;">📂</span>
        <div>
          <div style="font-size: 12px; color: #6c757d; margin-bottom: 2px;">类别</div>
          <strong style="font-size: 14px;">${escapeHtml(tool.category)}</strong>
        </div>
      </div>
      ${tags.length > 0 ? `
      <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
        <span style="color: #667eea; font-size: 18px;">🏷️</span>
        <div style="flex: 1;">
          <div style="font-size: 12px; color: #6c757d; margin-bottom: 6px;">标签</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${tags.map(tag => `<span style="background: #e7f0ff; color: #0969da; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      </div>
      ` : ''}
    </div>
    ${tool.description ? `
    <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;">
      <div style="font-size: 12px; color: #6c757d; margin-bottom: 6px;">描述</div>
      <div style="font-size: 14px; line-height: 1.6; color: #24292f;">${escapeHtml(tool.description)}</div>
    </div>
    ` : ''}
  `;
  
  // 检查是否有README文件
  const hasReadme = await checkToolReadme(toolId);
  
  if (hasReadme) {
    // 加载README内容
    toolContent.innerHTML = '<div class="tool-detail-loading"></div>';
    try {
      const readmeContent = await loadToolReadme(toolId);
      await renderMarkdownContent(toolContent, readmeContent);
    } catch (error) {
      toolContent.innerHTML = `
        <div class="markdown-error">
          <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
          <h3>文档加载失败</h3>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    }
  } else {
    // 显示无文档提示
    toolContent.innerHTML = `
      <div style="text-align: center; padding: 80px 20px; color: #6c757d;">
        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📄</div>
        <h3 style="font-size: 20px; margin-bottom: 12px; color: #24292f;">暂无文档</h3>
        <p style="font-size: 14px; color: #6c757d;">该工具暂未提供详细的说明文档</p>
      </div>
    `;
  }
  
  // 显示弹窗
  modal.classList.add('show');
}

// 将 showToolDetail 暴露到全局作用域
window.showToolDetail = showToolDetail;

// 隐藏工具详情弹窗
function hideToolDetailModal() {
  const modal = document.getElementById('toolDetailModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// 将 hideToolDetailModal 暴露到全局作用域
window.hideToolDetailModal = hideToolDetailModal;

// 将 showSkillsUploadModal 暴露到全局作用域
window.showSkillsUploadModal = showSkillsUploadModal;

// 将 hideSkillsUploadModal 暴露到全局作用域
window.hideSkillsUploadModal = hideSkillsUploadModal;

// 检查工具README文件
async function checkToolReadme(toolId) {
  try {
    const response = await fetch(`${API_HOST}/tool/readme/${toolId}`);
    return response.ok;
  } catch (error) {
    console.error('检查README文件失败:', error);
    return false;
  }
}

// 加载工具README内容
async function loadToolReadme(toolId) {
  try {
    const response = await fetch(`${API_HOST}/tool/readme/${toolId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // 读取接口返回的content字段
    const readmeContent = data.content || data;
    
    // 如果content是字符串，直接返回；如果是对象，尝试转换为字符串
    if (typeof readmeContent === 'string') {
      return readmeContent;
    } else if (typeof readmeContent === 'object') {
      return JSON.stringify(readmeContent, null, 2);
    } else {
      return String(readmeContent);
    }
  } catch (error) {
    console.error('加载README内容失败:', error);
    return `# ${toolId}

## 文档加载失败
无法加载工具文档，请稍后重试。

**错误信息**: ${error.message}

---
*如果您是工具开发者，请确保工具目录中包含README.md文件。*
`;
  }
}

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
});

// 配置 marked 渲染器
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('代码高亮失败:', err);
      }
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// 自定义渲染器以支持 mermaid
const renderer = new marked.Renderer();
const originalCodeRenderer = renderer.code.bind(renderer);

renderer.code = function(code, language) {
  if (language === 'mermaid') {
    const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
    return `<div class="mermaid-wrapper"><pre class="mermaid" id="${id}">${code}</pre></div>`;
  }
  return originalCodeRenderer(code, language);
};

// 渲染Markdown内容
async function renderMarkdownContent(container, markdown) {
  try {
    // 使用 marked 渲染 markdown
    const html = await marked.parse(markdown, { renderer });
    container.innerHTML = `<div class="markdown-body">${html}</div>`;
    
    // 代码高亮
    container.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    
    // 渲染 Mermaid 图表
    const mermaidElements = container.querySelectorAll('.mermaid');
    if (mermaidElements.length > 0) {
      for (const element of mermaidElements) {
        try {
          const { svg } = await mermaid.render(element.id, element.textContent);
          element.innerHTML = svg;
        } catch (err) {
          console.error('Mermaid 渲染失败:', err);
          element.innerHTML = `<div class="mermaid-error">图表渲染失败: ${err.message}</div>`;
        }
      }
    }
  } catch (error) {
    console.error('Markdown 渲染失败:', error);
    container.innerHTML = `<div class="markdown-error">文档渲染失败: ${error.message}</div>`;
  }
}

// 设置导航事件
function setupNavigation() {
  console.log('[setupNavigation] Called');
  const navItems = document.querySelectorAll('.primary-nav-item');
  console.log('[setupNavigation] Found nav items:', navItems.length);
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const navType = item.dataset.nav;
      console.log('[setupNavigation] Clicked nav item:', navType);
      if (navType) {
        switchNav(navType);
      }
    });
  });
}

// ==================== 技能管理相关代码 ====================

// 初始化技能页面
function initSkillsPage() {
  console.log('[initSkillsPage] called');
  // 获取技能区域元素
  const skillsArea = document.getElementById('skillsArea');
  if (!skillsArea) {
    console.error('Skills area element not found');
    return;
  }

  // 使用 SkillsArea 类的初始化方法
  if (window.SkillsArea && window.SkillsArea.init) {
    if (!skillsArea.dataset.initialized) {
      window.SkillsArea.init().catch(error => {
        console.error('初始化技能管理区域失败:', error);
      });
      skillsArea.dataset.initialized = "true";
    }
  }
}

// 暴露函数
window.openSkillEditor = (id) => { if (window.SkillsArea) window.SkillsArea.openSkill(id); };
