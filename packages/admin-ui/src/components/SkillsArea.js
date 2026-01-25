// SkillsArea.js - 技能管理主界面组件（1:1 复刻效果图版）

// 内部状态
let allSkills = [];
let filteredSkills = [];
let currentSkillId = null;
let activeFileId = 'main';
let viewMode = 'editor'; 
let currentFiles = []; // 当前选中的技能文件列表
let activeFileIndex = 0; // 当前选中的文件索引
let renamingFileIndex = null; // 当前正在重命名的文件索引
let pendingDeleteSkillId = null; // 待删除的技能 ID
let pendingDeleteSkillName = null; // 待删除的技能名称
let skillCodeEditor = null; // CodeMirror 实例

// 文件树相关状态
let fileTreeData = []; // 文件树数据结构（支持文件夹）
let expandedFolders = new Set(); // 展开的文件夹集合
let contextMenu = null; // 右键菜单实例
let contextMenuTarget = null; // 右键菜单目标
let renamingFolderPath = null; // 当前正在重命名的文件夹路径
let renamingNewFileIndex = null; // 新创建的文件索引（自动进入重命名模式）

// 文件路径分隔符（使用 | 而不是 /，避免与文件名冲突）
const PATH_SEPARATOR = '|';

// SVG 图标
const ICONS = {
  Plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  Folder: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  FolderOpen: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><path d="M2 13h20"></path><path d="M2 17h20"></path></svg>`,
  ChevronRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  Search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  Code: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  FileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  Settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  Zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  CheckCircle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="16 12 12 16 8 12"></polyline></svg>`,
  AlertCircle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  Book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
    Send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    More: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`,
    Trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    Edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    Copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    Download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    Export: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`
  };

import { getBackendUrl } from '../utils/env-loader.js';
import jsyaml from 'js-yaml';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/juejin.css';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/mode/gfm/gfm';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/css/css';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/shell/shell';
import 'codemirror/mode/php/php';
import 'codemirror/mode/python/python';
import 'codemirror/mode/yaml/yaml';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';

// HTML 转义辅助函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 路径转换辅助函数
function toInternalPath(path) {
  // 将 / 转换为 | 作为内部路径分隔符
  return path.replace(/\//g, PATH_SEPARATOR);
}

function toDisplayPath(path) {
  // 将 | 转换为 / 作为显示路径
  return path.replace(/\|/g, '/');
}

function getApiBase() {
  const backendUrl = getBackendUrl();
  return `${backendUrl}/adminapi`;
}

export class SkillsArea {
  static getHTML() {
    return `
      <div class="skills-layout" id="skillsArea" style="display: none;">
        <!-- 侧边栏 -->
        <div class="skills-sidebar">
          <div class="skill-sidebar-header">
            <!-- 全宽主按钮 -->
            <button class="new-skill-btn-full" id="newSkillBtn">新建技能</button>

            <!-- 搜索区域 -->
            <div class="search-container">
              <div class="search-box">
                <input type="text" id="skillSearch" name="skillSearch" placeholder="搜索技能..." autocomplete="off" />
                <button type="button" class="clear-btn" id="skillSearchClear" title="清除搜索"></button>
              </div>
              <button class="folder-btn" id="uploadSkillBtn" title="导入技能"></button>
            </div>
          </div>
          <div class="skill-sidebar-list">
            <div class="skill-sidebar-list-title" id="skillsCount">我的技能清单 (0)</div>
            <div id="skillsList"></div>
          </div>
          <div class="skill-sidebar-footer">
            <a href="https://code.claude.com/docs/zh-CN/skills" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; gap: 0.5rem; color: inherit; text-decoration: none;">
              ${ICONS.Book} <span>查看文档</span>
            </a>
          </div>
        </div>

        <!-- 主内容 -->
        <div class="skills-main">
          <!-- 顶部导航 -->
          <div class="skill-editor-navbar" id="editorNavbar" style="display: none;">
            <div class="skill-navbar-left">
              <div class="skill-navbar-icon">${ICONS.Code}</div>
              <div class="skill-navbar-title" id="headerSkillName">未命名技能</div>
              <div class="skill-navbar-badge">草稿</div>
            </div>
            <div class="skill-navbar-center">
              <button class="nav-toggle-btn active" data-mode="editor">编辑器</button>
              <button class="nav-toggle-btn" data-mode="tester">触发模拟器</button>
            </div>
            <div class="skill-navbar-right">
              <button class="export-btn" id="exportSkillBtnTop" title="导出技能包">${ICONS.Export}</button>
              <button class="publish-btn" id="saveSkillBtn">发布技能</button>
            </div>
          </div>

          <!-- 编辑器主视图 -->
          <div class="skill-editor-body" id="editorView" style="display: none;">
            <!-- 主编辑区 -->
            <div class="main-pane">
              <div class="skill-meta-panel">
                <div class="meta-row-top">
                  <div class="skill-field-group" style="flex: 1;">
                    <label class="skill-field-label">技能名称</label>
                    <input type="text" id="skillName" class="skill-name-input" placeholder="例如：代码解释专家" />
                  </div>
                  <div class="skill-field-group">
                    <label class="skill-field-label">版本号</label>
                    <input type="text" id="skillVersion" class="version-input" value="0.0.1" />
                  </div>
                </div>

                <div class="skill-field-group">
                  <label class="skill-field-label">描述与触发逻辑</label>
                  <div class="desc-input-box">
                    <textarea id="skillDesc" class="desc-textarea" rows="2" placeholder="这个技能是做什么的？请具体说明，以帮助 Claude 了解何时触发此技能。"></textarea>
                  </div>
                </div>

                <div class="meta-row-bottom">
                  <label class="skill-checkbox-label">
                    <input type="checkbox" id="skillInvocable" checked />
                    允许用户通过 / 命令调用
                  </label>
                  <div class="skill-tools-area">
                    <div class="skill-tools-label">
                      <span style="color: #f59e0b;">${ICONS.Zap}</span> 工具权限
                    </div>
                    <div class="skill-tools-pill-box" id="toolsPills">
                      <div class="tool-pill active" data-tool="Read">Read</div>
                      <div class="tool-pill" data-tool="Write">Write</div>
                      <div class="tool-pill" data-tool="Grep">Grep</div>
                      <div class="tool-pill" data-tool="Glob">Glob</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 代码区 -->
              <div class="code-editor-area">
                <textarea id="skillCode" style="display: none;"></textarea>
              </div>

              <!-- 状态条 -->
              <div class="skill-status-bar">
                <div class="skill-status-left" id="validationStats">
                  <div class="skill-status-item error">${ICONS.AlertCircle} 0 个错误</div>
                  <div class="skill-status-item warning">${ICONS.AlertCircle} 0 个警告</div>
                </div>
                <div class="skill-status-right">
                  <div class="latest-issue" id="latestIssue">配置通过验证</div>
                  <div id="statusVersion">v0.0.1</div>
                </div>
              </div>
            </div>

            <!-- 文件树 -->
            <div class="skill-file-tree">
              <div class="skill-file-tree-header">
                <div style="display: flex; gap: 0.5rem;">
                  <button id="addFileBtn" class="add-file-btn" title="新增文件">${ICONS.Plus}</button>
                  <button id="addFolderBtn" class="add-file-btn" title="新建文件夹">${ICONS.Folder}</button>
                </div>
                <span>文件列表</span>
              </div>
              <div class="skill-file-list" id="fileListContainer">
                <!-- 动态渲染文件列表 -->
              </div>
            </div>
          </div>

          <!-- 模拟器视图 -->
          <div class="simulator-view" id="testerView" style="display: none;">
            <div style="margin-bottom: 1.5rem;">
              <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">触发模拟器</h2>
              <p style="font-size: 0.875rem; color: #6b7280;">在此测试您的技能描述是否能正确引导 AI 在合适的场景下触发此技能。</p>
            </div>
            <div class="chat-box" id="chatHistory">
              <div class="msg ai">你好！我是您的技能测试助手。您可以输入一段用户需求，看看当前配置的触发逻辑是否会激活您的技能。</div>
            </div>
            <div class="sim-input-wrapper">
              <input type="text" id="simInput" class="sim-input" placeholder="输入测试指令，例如：帮我审查这段代码..." />
              <button class="sim-send-btn" id="simSendBtn">${ICONS.Send}</button>
            </div>
          </div>

          <!-- 空状态 -->
          <div class="skills-blank" id="emptyState">
            <div class="blank-icon-wrapper">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <h2>技能编辑器</h2>
            <p>开始设计您的第一个 Skill。您可以从零开始新建，或者上传已有的技能文件进行优化。</p>
            <button class="primary-blue-btn" id="blankNewBtn">新建我的第一个技能</button>
          </div>
        </div>
      </div>
    `;
  }

  static async init() {
    if (this._initialized) return;
    this.bindEvents();
    this.initEditor();
    await this.loadSkills();
    this._initialized = true;
  }

  static initEditor() {
    if (skillCodeEditor) return; // 防止重复初始化
    const el = document.getElementById('skillCode');
    if (!el) return;

    skillCodeEditor = CodeMirror.fromTextArea(el, {
      mode: 'markdown',
      theme: 'xq-light',
      lineNumbers: true,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentUnit: 2,
      tabSize: 2
    });

    // 在 CodeMirror 初始化后插入 placeholder
    setTimeout(() => {
      const cmWrapper = skillCodeEditor.getWrapperElement();
      const placeholder = document.createElement('div');
      placeholder.className = 'code-editor-placeholder';
      placeholder.textContent = '在此输入技能指令...';
      cmWrapper.appendChild(placeholder);
    }, 100);

    skillCodeEditor.on('change', () => {
      this.validate();
      this.updatePlaceholder();
    });
  }

  static updatePlaceholder() {
    if (!skillCodeEditor) return;
    
    const cmWrapper = skillCodeEditor.getWrapperElement();
    const placeholder = cmWrapper.querySelector('.code-editor-placeholder');
    if (!placeholder) return;
    
    const content = skillCodeEditor.getValue().trim();
    if (content) {
      placeholder.style.opacity = '0';
    } else {
      placeholder.style.opacity = '1';
    }
  }

  static async loadSkills() {
    try {
      const res = await fetch(`${getApiBase()}/skills`);
      allSkills = await res.json();
      filteredSkills = [...allSkills];
      document.getElementById('skillsCount').textContent = `我的技能清单 (${allSkills.length})`;
      this.renderList();
    } catch (e) {
      console.error(e);
    }
  }

  static handleSearch(query) {
    if (!query || !query.trim()) {
      filteredSkills = [...allSkills];
    } else {
      const q = query.toLowerCase().trim();
      // 相似度匹配逻辑：名称匹配权重最高，描述匹配次之
      filteredSkills = allSkills
        .map(s => {
          const name = (s.name || '').toLowerCase();
          const desc = (s.description || '').toLowerCase();
          let score = 0;
          
          if (name === q) score += 100; // 完全匹配名称
          else if (name.startsWith(q)) score += 80; // 开头匹配名称
          else if (name.includes(q)) score += 60; // 包含名称
          
          if (desc.includes(q)) score += 40; // 包含描述
          
          return { skill: s, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.skill);
    }
    this.renderList();
  }

  static renderList() {
    const container = document.getElementById('skillsList');
    if (filteredSkills.length === 0) {
      container.innerHTML = `
        <div class="sidebar-empty-box">
          <div>当前没有技能</div>
          <div style="font-size: 11px; opacity: 0.8;">点击上方按钮开始创建或上传</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filteredSkills.map(s => `
      <div class="skill-item ${s.id === currentSkillId ? 'active' : ''}" onclick="window.SkillsArea.openSkill('${s.id}')">
        <div class="skill-item-icon-box">
          ${ICONS.Code}
        </div>
        <div class="skill-item-info">
          <div class="skill-item-name">
            <span>${s.name}</span>
            <span class="skill-item-version">v${s.version || '0.0.1'}</span>
          </div>
          <div class="skill-item-meta">${s.fileCount || 1} 个文件 · ${new Date(s.updatedAt).toLocaleDateString()}</div>
        </div>
        <div class="skill-item-actions">
          <button class="skill-delete-btn" onclick="event.stopPropagation(); window.SkillsArea.handleDeleteSkill('${s.id}', '${s.name}')" title="删除技能">
            ${ICONS.Trash}
          </button>
        </div>
        ${s.id === currentSkillId ? '<div class="active-dot"></div>' : ''}
      </div>
    `).join('');
  }

  static closeDeleteModal() {
    const modal = document.getElementById('deleteSkillModal');
    if (modal) modal.classList.add('hidden');
    pendingDeleteSkillId = null;
    pendingDeleteSkillName = null;
  }

  static async confirmDeleteSkill() {
    if (!pendingDeleteSkillId) return;

    try {
      const res = await fetch(`${getApiBase()}/skills/${pendingDeleteSkillId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '删除失败');

      if (window.showMessage) window.showMessage('技能删除成功');
      
      // 如果删除的是当前正在编辑的技能，关闭编辑器
      if (currentSkillId === pendingDeleteSkillId) {
        currentSkillId = null;
        document.getElementById('editorNavbar').style.display = 'none';
        document.getElementById('editorView').style.display = 'none';
        document.getElementById('testerView').style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
      }

      this.closeDeleteModal();
      await this.loadSkills();
    } catch (e) {
      if (window.showMessage) window.showMessage(e.message, 'error');
    }
  }

  static handleDeleteSkill(id, name) {
    pendingDeleteSkillId = id;
    pendingDeleteSkillName = name;
    
    document.getElementById('deleteSkillName').textContent = name;
    const modal = document.getElementById('deleteSkillModal');
    if (modal) modal.classList.remove('hidden');
  }

  static async openSkill(id) {
    currentSkillId = id;
    this.renderList();
    
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('editorNavbar').style.display = 'flex';
    this.switchMode('editor'); // 确保切换到编辑器模式

    const res = await fetch(`${getApiBase()}/skills/${id}`);
    const s = await res.json();
    
    document.getElementById('headerSkillName').textContent = s.name;
    document.getElementById('skillName').value = s.name;
    document.getElementById('skillVersion').value = s.version || '0.0.1';
    document.getElementById('skillDesc').value = s.description || '';
    document.getElementById('skillInvocable').checked = s.userInvocable !== false;
    if (skillCodeEditor) {
      skillCodeEditor.setValue(s.markdownContent || '');
    } else {
      document.getElementById('skillCode').value = s.markdownContent || '';
    }
    document.getElementById('statusVersion').textContent = `v${s.version || '0.0.1'}`;

    // 初始化文件列表
    if (s.files && s.files.length > 0) {
      currentFiles = s.files.map(f => ({
        name: f.name.replace(/\//g, PATH_SEPARATOR), // 转换路径分隔符，确保使用 |
        content: f.name === 'SKILL.md' ? (s.markdownContent || '') : f.content,
        status: 'synced'
      }));
    } else {
      // 降级处理
      currentFiles = [
        { name: 'SKILL.md', content: s.markdownContent || '', status: 'synced' }
      ];
    }
    
    // 初始化文件夹展开状态
    expandedFolders.clear();
    currentFiles.forEach(file => {
      const parts = file.name.split(PATH_SEPARATOR);
      if (parts.length > 1) {
        // 添加所有父文件夹路径（用于嵌套文件夹）
        for (let i = 1; i < parts.length; i++) {
          const folderPath = parts.slice(0, -i).join(PATH_SEPARATOR);
          expandedFolders.add(folderPath);
        }
      }
    });
    
    activeFileIndex = currentFiles.findIndex(f => f.name === 'SKILL.md');
    if (activeFileIndex === -1) activeFileIndex = 0;
    
    this.renderFiles();
    this.updateEditorView();

    this.renderTools(s.allowedTools || []);
    this.validate();
  }

  static renderTools(selected) {
    document.querySelectorAll('.tool-pill').forEach(p => {
      p.classList.toggle('active', selected.includes(p.dataset.tool));
    });
  }

  static bindEvents() {
    const newSkillBtn = document.getElementById('newSkillBtn');
    const blankNewBtn = document.getElementById('blankNewBtn');
    const saveSkillBtn = document.getElementById('saveSkillBtn');
    
    if (newSkillBtn) newSkillBtn.onclick = () => this.createNew();
    if (blankNewBtn) blankNewBtn.onclick = () => this.createNew();
    if (saveSkillBtn) saveSkillBtn.onclick = () => this.save();
    
    document.querySelectorAll('.nav-toggle-btn').forEach(b => {
      b.onclick = () => this.switchMode(b.dataset.mode);
    });

    document.querySelectorAll('.tool-pill').forEach(p => {
      p.onclick = () => {
        p.classList.toggle('active');
        this.validate();
      };
    });

    ['skillName', 'skillVersion', 'skillDesc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.oninput = () => {
          this.validate();
          if (id === 'skillName') {
            const headerSkillName = document.getElementById('headerSkillName');
            if (headerSkillName) headerSkillName.textContent = el.value;
          }
          if (id === 'skillVersion') {
            const statusVersion = document.getElementById('statusVersion');
            if (statusVersion) statusVersion.textContent = 'v' + el.value;
          }
        };
      }
    });

    const simSendBtn = document.getElementById('simSendBtn');
    const simInput = document.getElementById('simInput');
    
    if (simSendBtn) simSendBtn.onclick = () => this.runSim();
    if (simInput) simInput.onkeypress = (e) => { if(e.key === 'Enter' && !e.isComposing) this.runSim(); };

    // 搜索功能
    const searchInput = document.getElementById('skillSearch');
    const searchClear = document.getElementById('skillSearchClear');
    
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.handleSearch(e.target.value);
      };
    }

    if (searchClear) {
      searchClear.onclick = () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        this.handleSearch('');
      };
    }

    // 新增文件按钮
    const addFileBtn = document.getElementById('addFileBtn');
    if (addFileBtn) {
      addFileBtn.onclick = () => this.addFile();
    }

    // 新建文件夹按钮
    const addFolderBtn = document.getElementById('addFolderBtn');
    if (addFolderBtn) {
      addFolderBtn.onclick = () => this.addFolder();
    }

    // 上传技能按钮
    const uploadBtn = document.getElementById('uploadSkillBtn');
    if (uploadBtn) {
      uploadBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.showSkillsUploadModal) {
          window.showSkillsUploadModal();
        }
      };
    }

    // 绑定删除技能弹窗事件
    const deleteSkillCloseBtn = document.getElementById('deleteSkillCloseBtn');
    const deleteSkillCancelBtn = document.getElementById('deleteSkillCancelBtn');
    const deleteSkillConfirmBtn = document.getElementById('deleteSkillConfirmBtn');
    
    if (deleteSkillCloseBtn) deleteSkillCloseBtn.onclick = () => this.closeDeleteModal();
    if (deleteSkillCancelBtn) deleteSkillCancelBtn.onclick = () => this.closeDeleteModal();
    if (deleteSkillConfirmBtn) deleteSkillConfirmBtn.onclick = () => this.confirmDeleteSkill();

    // 绑定导出技能弹窗事件
    const exportSkillBtnTop = document.getElementById('exportSkillBtnTop');
    const exportSkillCloseBtn = document.getElementById('exportSkillCloseBtn');
    const exportSkillCancelBtn = document.getElementById('exportSkillCancelBtn');
    const exportSkillConfirmBtn = document.getElementById('exportSkillConfirmBtn');

    if (exportSkillBtnTop) exportSkillBtnTop.onclick = () => this.showExportConfirm();
    if (exportSkillCloseBtn) exportSkillCloseBtn.onclick = () => this.closeExportModal();
    if (exportSkillCancelBtn) exportSkillCancelBtn.onclick = () => this.closeExportModal();
    if (exportSkillConfirmBtn) exportSkillConfirmBtn.onclick = () => this.confirmExportSkill();
  }

  static showExportConfirm() {
    if (!currentSkillId) return;
    const skillName = document.getElementById('skillName').value || '未命名技能';
    document.getElementById('exportSkillName').textContent = skillName;
    const modal = document.getElementById('exportSkillModal');
    if (modal) modal.classList.remove('hidden');
  }

  static closeExportModal() {
    const modal = document.getElementById('exportSkillModal');
    if (modal) modal.classList.add('hidden');
  }

  static async confirmExportSkill() {
    if (!currentSkillId) return;

    const btn = document.getElementById('exportSkillConfirmBtn');
    const originalText = btn.textContent;
    btn.textContent = '导出中...';
    btn.disabled = true;

    try {
      const res = await fetch(`${getApiBase()}/skills/${currentSkillId}/export`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '导出失败');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = document.getElementById('skillName').value || 'skill';
      a.download = `${fileName}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (window.showMessage) window.showMessage('技能导出成功');
      this.closeExportModal();
    } catch (e) {
      if (window.showMessage) window.showMessage(e.message, 'error');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }

  static addFile() {
    // 获取当前选中文件的父目录
    const currentFile = currentFiles[activeFileIndex];
    let basePath = '';
    
    if (currentFile) {
      const parts = currentFile.name.split(PATH_SEPARATOR);
      if (parts.length > 1) {
        basePath = parts.slice(0, -1).join(PATH_SEPARATOR) + PATH_SEPARATOR;
      }
    }
    
    // 查找当前最大的未命名文件编号
    let maxId = 0;
    currentFiles.forEach(f => {
      const match = f.name.match(/^未命名文件(?:-(\d+))?\.md$/);
      if (match) {
        const id = match[1] ? parseInt(match[1]) : 0;
        if (id >= maxId) maxId = id + 1;
      }
    });
    
    const filename = maxId === 0 ? '未命名文件.md' : `未命名文件-${maxId}.md`;
    const fullPath = basePath + filename;

    // 保存当前正在编辑的文件内容
    if (currentFiles[activeFileIndex]) {
      currentFiles[activeFileIndex].content = skillCodeEditor ? skillCodeEditor.getValue() : document.getElementById('skillCode').value;
    }

    // 添加新文件
    currentFiles.push({
      name: fullPath,
      content: '',
      status: 'new'
    });

    // 如果在文件夹中，展开该文件夹
    if (basePath) {
      expandedFolders.add(basePath.replace(new RegExp(`\\${PATH_SEPARATOR}$`), ''));
    }

    // 切换到新文件并进入重命名模式
    activeFileIndex = currentFiles.length - 1;
    renamingNewFileIndex = activeFileIndex;
    renamingFileIndex = activeFileIndex;
    this.renderFiles();
    this.updateEditorView();
    this.validate();
  }

  // 添加文件夹
  static addFolder() {
    // 获取当前选中文件的父目录
    const currentFile = currentFiles[activeFileIndex];
    let basePath = '';
    
    if (currentFile) {
      const parts = currentFile.name.split(PATH_SEPARATOR);
      if (parts.length > 1) {
        basePath = parts.slice(0, -1).join(PATH_SEPARATOR) + PATH_SEPARATOR;
      }
    }
    
    // 查找当前最大的未命名文件夹编号
    let maxId = 0;
    currentFiles.forEach(f => {
      const match = f.name.match(new RegExp(`^未命名文件夹(?:-(\\d+))?\\${PATH_SEPARATOR}\\.gitkeep$`));
      if (match) {
        const id = match[1] ? parseInt(match[1]) : 0;
        if (id >= maxId) maxId = id + 1;
      }
    });
    
    const folderName = maxId === 0 ? '未命名文件夹' : `未命名文件夹-${maxId}`;
    const fullPath = basePath + folderName;
    
    // 添加一个 .gitkeep 文件以创建文件夹
    currentFiles.push({
      name: fullPath + PATH_SEPARATOR + '.gitkeep',
      content: '',
      status: 'new'
    });
    
    expandedFolders.add(fullPath);
    if (basePath) {
      expandedFolders.add(basePath.replace(new RegExp(`\\${PATH_SEPARATOR}$`), ''));
    }
    
    // 进入文件夹重命名模式
    renamingFolderPath = fullPath;
    
    this.renderFiles();
    this.validate();
  }

  static switchFile(index) {
    const nextFile = currentFiles[index];
    if (nextFile && nextFile.name.split(PATH_SEPARATOR).pop() === '.gitkeep') return;
    if (index === activeFileIndex) return;

    // 保存当前内容
    currentFiles[activeFileIndex].content = skillCodeEditor ? skillCodeEditor.getValue() : document.getElementById('skillCode').value;

    // 切换索引
    activeFileIndex = index;
    this.renderFiles();
    this.updateEditorView();
    this.validate();
  }

  static updateEditorView() {
    const file = currentFiles[activeFileIndex];
    const metaPanel = document.querySelector('.skill-meta-panel');
    const editorArea = document.querySelector('.code-editor-area');
    
    if (file.name === 'SKILL.md') {
      metaPanel.style.display = 'block';
      editorArea.style.borderTop = 'none';
    } else {
      metaPanel.style.display = 'none';
      // 当元数据面板隐藏时，给编辑器顶部增加边框或间距，使其看起来像“完整编辑器”
      editorArea.style.borderTop = 'none';
    }

    if (skillCodeEditor) {
      skillCodeEditor.setValue(file.content);
      // 尝试自动设置模式
      const ext = file.name.split('.').pop().toLowerCase();
      const modeMap = {
        'js': 'javascript',
        'json': 'application/json',
        'xml': 'xml',
        'css': 'css',
        'md': 'gfm',
        'sh': 'shell',
        'php': 'php',
        'py': 'python',
        'yaml': 'yaml',
        'yml': 'yaml'
      };
      skillCodeEditor.setOption('mode', modeMap[ext] || 'markdown');
      setTimeout(() => skillCodeEditor.refresh(), 1);
      // 延迟更新 placeholder，确保 setValue 已完成
      setTimeout(() => this.updatePlaceholder(), 10);
    } else {
      document.getElementById('skillCode').value = file.content;
    }
  }

  static renderFiles() {
    const container = document.getElementById('fileListContainer');
    if (!container) return;

    // .gitkeep 不允许编辑，避免被选中
    const activeFile = currentFiles[activeFileIndex];
    if (activeFile && activeFile.name.split(PATH_SEPARATOR).pop() === '.gitkeep') {
      const skillIndex = currentFiles.findIndex(f => f.name === 'SKILL.md');
      activeFileIndex = skillIndex !== -1 ? skillIndex : 0;
    }

    // 转换文件列表为树结构
    const tree = this.buildFileTree(currentFiles);
    
    container.innerHTML = this.renderTreeNodes(tree, 0);

    // 聚焦输入框
    const input = container.querySelector('.file-rename-input, .folder-rename-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  // 构建文件树结构
  static buildFileTree(files) {
    const root = { type: 'folder', children: [], folders: {} };
    
    files.forEach((file, idx) => {
      const parts = file.name.split(PATH_SEPARATOR);
      let current = root;
      
      // 处理目录层级
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        const folderPath = parts.slice(0, i + 1).join(PATH_SEPARATOR);
        
        if (!current.folders[folderName]) {
          const newFolder = {
            type: 'folder',
            name: folderName,
            path: folderPath,
            children: [],
            folders: {},
            expanded: expandedFolders.has(folderPath)
          };
          current.folders[folderName] = newFolder;
          current.children.push(newFolder);
        }
        current = current.folders[folderName];
      }
      
      // 添加文件
      current.children.push({
        type: 'file',
        index: idx,
        name: parts[parts.length - 1],
        data: file,
        fullPath: file.name
      });
    });
    
    // 递归排序
    const sortTree = (node) => {
      node.children.sort((a, b) => {
        // SKILL.md 始终排在第一位
        const aIsSkill = a.type === 'file' && a.name === 'SKILL.md';
        const bIsSkill = b.type === 'file' && b.name === 'SKILL.md';
        if (aIsSkill && !bIsSkill) return -1;
        if (!aIsSkill && bIsSkill) return 1;

        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(child => {
        if (child.type === 'folder') sortTree(child);
      });
    };
    
    sortTree(root);
    return root.children;
  }

  // 递归渲染树节点
  static renderTreeNodes(nodes, level) {
    return nodes.map(node => {
      if (node.type === 'folder') {
        return this.renderFolderNode(node, level);
      } else {
        return this.renderFileNode(node, level);
      }
    }).join('');
  }

  // 渲染文件夹节点
  static renderFolderNode(folder, level) {
    const isExpanded = folder.expanded;
    const hasChildren = folder.children && folder.children.length > 0;
    const paddingLeft = level * 1 + 0.75; // 增加每层缩进，从 0.5 改为 1
    const isRenaming = renamingFolderPath === folder.path;
    // HTML 属性值转义：转义 &、<、>、"、'
    const escapedPath = folder.path
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    return `
      <div class="skill-file-node">
        <div class="skill-folder-header ${isExpanded ? 'expanded' : ''} ${isRenaming ? 'renaming' : ''}"
             style="padding-left: ${paddingLeft}rem;"
             data-folder-path="${escapedPath}"
             onclick="window.SkillsArea.toggleFolder(this.dataset.folderPath)"
             oncontextmenu="event.preventDefault(); window.SkillsArea.showContextMenu(event, 'folder', this.dataset.folderPath)"
             tabindex="0"
             role="treeitem"
             aria-expanded="${isExpanded}"
             onkeydown="window.SkillsArea.handleFolderKeydown(event, this.dataset.folderPath)">
          <span class="folder-chevron ${isExpanded ? 'expanded' : ''}">${ICONS.ChevronRight}</span>
          <span class="skill-folder-icon">${isExpanded ? ICONS.FolderOpen : ICONS.Folder}</span>
          ${isRenaming ? `
            <input type="text" class="folder-rename-input"
              value="${escapeHtml(folder.name)}"
              onclick="event.stopPropagation()"
              oncompositionstart="this._isComposing = true; event.stopPropagation()"
              oncompositionend="this._isComposing = false; event.stopPropagation()"
              onblur="window.SkillsArea.handleRenameBlur(this, 'folder', this.closest('.skill-folder-header').dataset.folderPath)"
              onkeydown="event.stopPropagation(); if(event.key==='Enter'){ if(event.isComposing || this._isComposing || event.keyCode===229) return; event.preventDefault(); this.blur(); } if(event.key==='Escape'){ window.SkillsArea.cancelRenameFolder(); event.stopPropagation(); }"
              autoFocus
            />
          ` : `
            <span class="skill-folder-name" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
            <div class="skill-folder-actions">
              <button class="file-action-btn rename" onclick="event.stopPropagation(); window.SkillsArea.startRenameFolder(this.closest('.skill-folder-header').dataset.folderPath)" title="重命名" aria-label="重命名文件夹">${ICONS.Edit}</button>
              <button class="file-action-btn delete" onclick="event.stopPropagation(); window.SkillsArea.deleteFolder(this.closest('.skill-folder-header').dataset.folderPath)" title="删除" aria-label="删除文件夹">${ICONS.Trash}</button>
            </div>
          `}
        </div>
        ${hasChildren ? `
          <div class="skill-folder-children ${isExpanded ? 'expanded' : 'collapsed'}" role="group">
            ${this.renderTreeNodes(folder.children, level + 1)}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 渲染文件节点
  static renderFileNode(file, level) {
    const isActive = file.index === activeFileIndex;
    const filename = file.name.split(PATH_SEPARATOR).pop();
    const isGitKeep = filename === '.gitkeep';
    const canRename = file.data.name !== 'SKILL.md' && !isGitKeep;
    const isRenaming = renamingFileIndex === file.index;
    const paddingLeft = level * 1 + 0.75 + 1.25; // 增加每层缩进，对齐文件夹文字
    const fileIcon = this.getFileIcon(file.name);
    
    return `
      <div class="skill-file-item ${isActive ? 'active' : ''} ${isRenaming ? 'renaming' : ''} ${isGitKeep ? 'readonly' : ''}"
           style="padding-left: ${paddingLeft}rem;"
           onclick="${isGitKeep ? '' : `window.SkillsArea.switchFile(${file.index})`}"
           oncontextmenu="event.preventDefault(); window.SkillsArea.showContextMenu(event, 'file', ${file.index})"
           tabindex="0"
           role="treeitem"
           aria-selected="${isActive}"
           draggable="${!isGitKeep}"
           ondragstart="${isGitKeep ? '' : `window.SkillsArea.handleDragStart(event, ${file.index})`}"
           ondragover="${isGitKeep ? '' : 'window.SkillsArea.handleDragOver(event)'}"
           ondrop="${isGitKeep ? '' : `window.SkillsArea.handleDrop(event, ${file.index})`}"
           onkeydown="window.SkillsArea.handleFileKeydown(event, ${file.index})"
           ${canRename ? `ondblclick="event.stopPropagation(); window.SkillsArea.startRename(${file.index})"` : ''}>
        <span class="skill-file-item-icon skill-file-icon-${this.getFileExtension(file.name)}">${fileIcon}</span>
        ${isRenaming ? `
          <input type="text" class="file-rename-input"
            value="${escapeHtml(file.name.split(PATH_SEPARATOR).pop())}"
            onclick="event.stopPropagation()"
            oncompositionstart="this._isComposing = true; event.stopPropagation()"
            oncompositionend="this._isComposing = false; event.stopPropagation()"
            onblur="window.SkillsArea.handleRenameBlur(this, 'file', ${file.index})"
            onkeydown="event.stopPropagation(); if(event.key==='Enter'){ if(event.isComposing || this._isComposing || event.keyCode===229) return; event.preventDefault(); this.blur(); } if(event.key==='Escape'){ window.SkillsArea.cancelRename(); event.stopPropagation(); }"
            autoFocus
          />
        ` : `
          <span class="skill-file-item-name-label" title="${escapeHtml(file.name)}">${escapeHtml(filename)}</span>
          <div class="skill-file-item-actions">
            ${canRename ? `
              <button class="file-action-btn rename" onclick="event.stopPropagation(); window.SkillsArea.startRename(${file.index})" title="重命名" aria-label="重命名文件">${ICONS.Edit}</button>
              <button class="file-action-btn delete" onclick="event.stopPropagation(); window.SkillsArea.deleteFile(${file.index})" title="删除" aria-label="删除文件">${ICONS.Trash}</button>
            ` : `<span class="skill-file-item-status" aria-label="只读文件">${ICONS.CheckCircle}</span>`}
          </div>
        `}
      </div>
    `;
  }

  // 获取文件扩展名
  static getFileExtension(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ext;
  }

  // 根据文件类型获取图标
  static getFileIcon(filename) {
    const ext = this.getFileExtension(filename);
    const iconMap = {
      'js': ICONS.Code,
      'json': ICONS.Code,
      'md': ICONS.FileText,
      'html': ICONS.Code,
      'css': ICONS.Code,
      'py': ICONS.Code,
      'sh': ICONS.Code,
      'yaml': ICONS.FileText,
      'yml': ICONS.FileText,
      'xml': ICONS.Code,
      'php': ICONS.Code,
      'txt': ICONS.FileText
    };
    return iconMap[ext] || ICONS.FileText;
  }

  // 切换文件夹展开/折叠
  static toggleFolder(folderPath) {
    if (expandedFolders.has(folderPath)) {
      expandedFolders.delete(folderPath);
    } else {
      expandedFolders.add(folderPath);
    }
    this.renderFiles();
  }

  // 开始重命名文件夹
  static startRenameFolder(folderPath) {
    renamingFolderPath = folderPath;
    this.renderFiles();
  }

  // 处理重命名输入框失去焦点
  static handleRenameBlur(el, type, target) {
    if (el._isFinished) return;

    const finish = () => {
      if (el._isFinished || el._isComposing) return;
      el._isFinished = true;
      const val = el.value.trim();
      if (type === 'folder') {
        this.finishRenameFolder(target, val);
      } else {
        this.finishRename(target, val);
      }
    };

    // 给 IME 留出时间更新输入值
    setTimeout(finish, el._isComposing ? 200 : 100);
  }

  // 完成重命名文件夹
  static finishRenameFolder(folderPath, newName) {
    if (renamingFolderPath === null) return;
    
    newName = newName.trim();
    if (!newName) {
      this.cancelRenameFolder();
      return;
    }

    // 从 folderPath 中提取最后一部分作为 oldName
    const parts = folderPath.split(PATH_SEPARATOR);
    const oldName = parts[parts.length - 1];
    
    if (newName !== oldName) {
      // 检查新路径是否已存在
      const lastSepIndex = folderPath.lastIndexOf(PATH_SEPARATOR);
      const parentPath = lastSepIndex !== -1 ? folderPath.substring(0, lastSepIndex) : '';
      const newFolderPath = parentPath ? parentPath + PATH_SEPARATOR + newName : newName;
      
      if (currentFiles.some(f => f.name === newFolderPath || f.name.startsWith(newFolderPath + PATH_SEPARATOR))) {
        if (window.showMessage) window.showMessage('文件夹名称已存在', 'error');
        this.cancelRenameFolder();
        return;
      }

      // 1. 更新所有在该文件夹中的文件路径
      currentFiles.forEach(file => {
        if (file.name === folderPath || file.name.startsWith(folderPath + PATH_SEPARATOR)) {
          file.name = newFolderPath + file.name.substring(folderPath.length);
        }
      });
      
      // 2. 更新所有子文件夹的展开状态
      const updatedExpanded = new Set();
      expandedFolders.forEach(p => {
        if (p === folderPath || p.startsWith(folderPath + PATH_SEPARATOR)) {
          updatedExpanded.add(newFolderPath + p.substring(folderPath.length));
        } else {
          updatedExpanded.add(p);
        }
      });
      expandedFolders = updatedExpanded;
    }
    
    renamingFolderPath = null;
    this.renderFiles();
    this.updateEditorView();
    this.validate();
  }

  // 取消重命名文件夹
  static cancelRenameFolder() {
    renamingFolderPath = null;
    this.renderFiles();
  }

  // 重命名文件夹（保留用于键盘快捷键）
  static renameFolder(folderPath) {
    this.startRenameFolder(folderPath);
  }

  // 删除文件夹
  static deleteFolder(folderPath) {
    const displayName = toDisplayPath(folderPath);
    if (confirm(`确定要删除文件夹 "${displayName}" 及其所有内容吗？`)) {
      currentFiles = currentFiles.filter(file => !file.name.startsWith(folderPath + PATH_SEPARATOR));
      expandedFolders.delete(folderPath);
      
      // 如果删除的文件夹包含当前激活的文件，切换到第一个文件
      const activeFile = currentFiles[activeFileIndex];
      if (!activeFile || activeFile.name.startsWith(folderPath + PATH_SEPARATOR)) {
        activeFileIndex = 0;
      }
      
      this.renderFiles();
      this.updateEditorView();
      this.validate();
    }
  }

  // 显示右键菜单
  static showContextMenu(event, type, target) {
    event.preventDefault();
    event.stopPropagation();
    
    // 移除现有菜单
    this.hideContextMenu();
    
    contextMenu = document.createElement('div');
    contextMenu.className = 'skill-context-menu';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    
    contextMenuTarget = { type, target };
    
    let menuItems = [];
    
    if (type === 'folder') {
      menuItems = [
        { icon: ICONS.Plus, label: '新建文件', action: () => this.addFileToFolder(target) },
        { icon: ICONS.Folder, label: '新建子文件夹', action: () => this.addSubFolder(target) },
        { divider: true },
        { icon: ICONS.Edit, label: '重命名', action: () => this.startRenameFolder(target) },
        { icon: ICONS.Trash, label: '删除', action: () => this.deleteFolder(target), danger: true }
      ];
    } else {
      const file = currentFiles[target];
      const isGitKeep = file.name.split(PATH_SEPARATOR).pop() === '.gitkeep';
      if (isGitKeep) return;
      const canRename = file.name !== 'SKILL.md';
      
      // 获取文件所在目录
      const parts = file.name.split(PATH_SEPARATOR);
      const isInFolder = parts.length > 1;
      const folderPath = isInFolder ? parts.slice(0, -1).join(PATH_SEPARATOR) : null;
      
      if (isInFolder) {
        // 文件在文件夹中，显示在当前目录新建的选项
        menuItems = [
          { icon: ICONS.Plus, label: '在当前目录新建文件', action: () => this.addFileToFolder(folderPath) },
          { icon: ICONS.Folder, label: '在当前目录新建文件夹', action: () => this.addSubFolder(folderPath) },
          { divider: true },
          { icon: ICONS.Edit, label: '重命名', action: () => canRename && this.startRename(target), disabled: !canRename },
          { icon: ICONS.Copy, label: '复制', action: () => this.copyFile(target) },
          { divider: true },
          { icon: ICONS.Trash, label: '删除', action: () => this.deleteFile(target), danger: true }
        ];
      } else {
        // 根目录文件，显示基本选项
        menuItems = [
          { icon: ICONS.Edit, label: '重命名', action: () => canRename && this.startRename(target), disabled: !canRename },
          { icon: ICONS.Copy, label: '复制', action: () => this.copyFile(target) },
          { divider: true },
          { icon: ICONS.Trash, label: '删除', action: () => this.deleteFile(target), danger: true }
        ];
      }
    }
    
    contextMenu.innerHTML = menuItems.map(item => {
      if (item.divider) {
        return '<div class="context-menu-divider"></div>';
      }
      return `
        <div class="context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}"
             onclick="window.SkillsArea.handleContextMenuAction(${menuItems.indexOf(item)})">
          <span class="context-menu-item-icon">${item.icon}</span>
          <span>${item.label}</span>
        </div>
      `;
    }).join('');
    
    document.body.appendChild(contextMenu);
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
      document.addEventListener('click', this.hideContextMenu, { once: true });
    }, 0);
  }

  // 隐藏右键菜单
  static hideContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
      contextMenuTarget = null;
    }
  }

  // 处理右键菜单操作
  static handleContextMenuAction(index) {
    if (!contextMenuTarget) return;
    
    let menuItems = [];
    if (contextMenuTarget.type === 'folder') {
      menuItems = [
        { action: () => this.addFileToFolder(contextMenuTarget.target) },
        { action: () => this.addSubFolder(contextMenuTarget.target) },
        { divider: true },
        { action: () => this.startRenameFolder(contextMenuTarget.target) },
        { action: () => this.deleteFolder(contextMenuTarget.target) }
      ];
    } else {
      const file = currentFiles[contextMenuTarget.target];
      const parts = file.name.split(PATH_SEPARATOR);
      const isInFolder = parts.length > 1;
      const folderPath = isInFolder ? parts.slice(0, -1).join(PATH_SEPARATOR) : null;
      
      if (isInFolder) {
        menuItems = [
          { action: () => this.addFileToFolder(folderPath) },
          { action: () => this.addSubFolder(folderPath) },
          { divider: true },
          { action: () => this.startRename(contextMenuTarget.target) },
          { action: () => this.copyFile(contextMenuTarget.target) },
          { divider: true },
          { action: () => this.deleteFile(contextMenuTarget.target) }
        ];
      } else {
        menuItems = [
          { action: () => this.startRename(contextMenuTarget.target) },
          { action: () => this.copyFile(contextMenuTarget.target) },
          { divider: true },
          { action: () => this.deleteFile(contextMenuTarget.target) }
        ];
      }
    }
    
    const item = menuItems[index];
    if (item && !item.divider && item.action) {
      item.action();
    }
    
    this.hideContextMenu();
  }

  // 在文件夹中添加文件
  static addFileToFolder(folderPath) {
    // 查找当前最大的未命名文件编号
    let maxId = 0;
    currentFiles.forEach(f => {
      const match = f.name.match(/^未命名文件(?:-(\d+))?\.md$/);
      if (match) {
        const id = match[1] ? parseInt(match[1]) : 0;
        if (id >= maxId) maxId = id + 1;
      }
    });
    
    const filename = maxId === 0 ? '未命名文件.md' : `未命名文件-${maxId}.md`;
    const fullPath = folderPath + PATH_SEPARATOR + filename;
    
    currentFiles.push({
      name: fullPath,
      content: '',
      status: 'new'
    });
    
    expandedFolders.add(folderPath);
    
    // 切换到新文件并进入重命名模式
    activeFileIndex = currentFiles.length - 1;
    renamingNewFileIndex = activeFileIndex;
    renamingFileIndex = activeFileIndex;
    this.renderFiles();
    this.updateEditorView();
    this.validate();
  }

  // 添加子文件夹
  static addSubFolder(parentPath) {
    // 查找当前最大的未命名文件夹编号
    let maxId = 0;
    currentFiles.forEach(f => {
      const match = f.name.match(new RegExp(`^未命名文件夹(?:-(\\d+))?\\${PATH_SEPARATOR}\\.gitkeep$`));
      if (match) {
        const id = match[1] ? parseInt(match[1]) : 0;
        if (id >= maxId) maxId = id + 1;
      }
    });
    
    const folderName = maxId === 0 ? '未命名文件夹' : `未命名文件夹-${maxId}`;
    const newFolderPath = parentPath + PATH_SEPARATOR + folderName;
    
    expandedFolders.add(newFolderPath);
    expandedFolders.add(parentPath);
    
    // 添加一个默认文件到新文件夹
    currentFiles.push({
      name: newFolderPath + PATH_SEPARATOR + '.gitkeep',
      content: '',
      status: 'new'
    });
    
    // 进入文件夹重命名模式
    renamingFolderPath = newFolderPath;
    
    this.renderFiles();
    this.validate();
  }

  // 复制文件
  static copyFile(index) {
    const file = currentFiles[index];
    const ext = file.name.split('.').pop();
    const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
    let newName = baseName + '-copy.' + ext;
    let counter = 1;
    
    while (currentFiles.find(f => f.name === newName)) {
      newName = baseName + '-copy' + counter + '.' + ext;
      counter++;
    }
    
    currentFiles.push({
      name: newName,
      content: file.content,
      status: 'new'
    });
    
    this.renderFiles();
    this.validate();
  }

  // 拖拽开始
  static handleDragStart(event, index) {
    event.dataTransfer.setData('text/plain', index);
    event.target.classList.add('dragging');
  }

  // 拖拽经过
  static handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.target.closest('.skill-file-item')?.classList.add('drag-over');
  }

  // 拖拽放置
  static handleDrop(event, targetIndex) {
    event.preventDefault();
    event.target.closest('.skill-file-item')?.classList.remove('drag-over');
    
    const sourceIndex = parseInt(event.dataTransfer.getData('text/plain'));
    if (sourceIndex === targetIndex) return;
    
    // 移动文件
    const [movedFile] = currentFiles.splice(sourceIndex, 1);
    currentFiles.splice(targetIndex, 0, movedFile);
    
    // 更新激活索引
    if (activeFileIndex === sourceIndex) {
      activeFileIndex = targetIndex;
    } else if (sourceIndex < activeFileIndex && targetIndex >= activeFileIndex) {
      activeFileIndex--;
    } else if (sourceIndex > activeFileIndex && targetIndex <= activeFileIndex) {
      activeFileIndex++;
    }
    
    this.renderFiles();
  }

  // 键盘导航处理
  static handleFileKeydown(event, index) {
    const key = event.key;
    
    switch (key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.switchFile(index);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (index > 0) {
          this.switchFile(index - 1);
          this.focusFileItem(index - 1);
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (index < currentFiles.length - 1) {
          this.switchFile(index + 1);
          this.focusFileItem(index + 1);
        }
        break;
      case 'F2':
        event.preventDefault();
        const file = currentFiles[index];
        if (file.name !== 'SKILL.md') {
          this.startRename(index);
        }
        break;
      case 'Delete':
        event.preventDefault();
        const deleteFile = currentFiles[index];
        if (deleteFile.name !== 'SKILL.md') {
          this.deleteFile(index);
        }
        break;
      case 'Escape':
        if (renamingFileIndex !== null) {
          event.preventDefault();
          this.cancelRename();
        }
        this.hideContextMenu();
        break;
    }
  }

  // 聚焦文件项
  static focusFileItem(index) {
    const fileItems = document.querySelectorAll('.skill-file-item');
    if (fileItems[index]) {
      fileItems[index].focus();
    }
  }

  // 文件夹键盘导航处理
  static handleFolderKeydown(event, folderPath) {
    const key = event.key;
    
    switch (key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.toggleFolder(folderPath);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (!expandedFolders.has(folderPath)) {
          this.toggleFolder(folderPath);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (expandedFolders.has(folderPath)) {
          this.toggleFolder(folderPath);
        }
        break;
      case 'F2':
        event.preventDefault();
        this.renameFolder(folderPath);
        break;
      case 'Delete':
        event.preventDefault();
        this.deleteFolder(folderPath);
        break;
      case 'Escape':
        this.hideContextMenu();
        break;
    }
  }

  static startRename(index) {
    renamingFileIndex = index;
    this.renderFiles();
  }

  static finishRename(index, newName) {
    if (renamingFileIndex === null) return;
    
    const file = currentFiles[index];
    if (!file) return;
    
    const oldName = file.name;
    newName = newName.trim();
    
    if (newName && newName !== oldName.split(PATH_SEPARATOR).pop()) {
      // 如果文件在文件夹中，保持文件夹路径，只修改文件名
      const parts = oldName.split(PATH_SEPARATOR);
      let fullNewName;
      if (parts.length > 1) {
        const folderPath = parts.slice(0, -1).join(PATH_SEPARATOR);
        fullNewName = folderPath + PATH_SEPARATOR + newName;
      } else {
        fullNewName = newName;
      }
      
      // 检查冲突
      if (currentFiles.some((f, i) => i !== index && f.name === fullNewName)) {
        if (window.showMessage) window.showMessage('文件名已存在', 'error');
        this.cancelRename();
        return;
      }
      
      file.name = fullNewName;
    }
    
    renamingFileIndex = null;
    renamingNewFileIndex = null;
    this.renderFiles();
    this.validate();
  }

  static cancelRename() {
    renamingFileIndex = null;
    renamingNewFileIndex = null;
    this.renderFiles();
  }

  static deleteFile(index) {
    currentFiles.splice(index, 1);
    
    // 如果删除的是当前激活的文件，切换到第一个文件 (SKILL.md)
    if (activeFileIndex === index) {
      activeFileIndex = 0;
    } else if (activeFileIndex > index) {
      activeFileIndex--;
    }
    
    this.renderFiles();
    this.updateEditorView();
  }

  static createNew() {
    currentSkillId = null;
    this.renderList();
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('editorNavbar').style.display = 'flex';
    this.switchMode('editor'); // 确保切换到编辑器模式

    document.getElementById('skillName').value = '';
    document.getElementById('headerSkillName').textContent = '未命名技能';
    document.getElementById('skillVersion').value = '0.0.1';
    document.getElementById('statusVersion').textContent = 'v0.0.1';
    document.getElementById('skillDesc').value = '';

    if (skillCodeEditor) {
      skillCodeEditor.setValue('');
    } else {
      document.getElementById('skillCode').value = '';
    }

    // 初始化文件列表（包含默认文件夹结构）
    currentFiles = [
      { name: 'SKILL.md', content: '', status: 'new' },
      { name: 'script|.gitkeep', content: '', status: 'new' },
      { name: 'resource|.gitkeep', content: '', status: 'new' }
    ];
    expandedFolders.add('script');
    expandedFolders.add('resource');
    activeFileIndex = 0;
    this.renderFiles();
    this.updateEditorView();

    this.renderTools(['Read']);
    this.validate();
  }

  static validate() {
    const name = document.getElementById('skillName').value.trim();
    const desc = document.getElementById('skillDesc').value.trim();
    const code = skillCodeEditor ? skillCodeEditor.getValue().trim() : document.getElementById('skillCode').value.trim();
    
    let errors = 0;
    let warnings = 0;
    let latest = '配置通过验证';

    const nameRegex = /^[a-z0-9-\u4e00-\u9fa5]+$/i;
    if (!name) { errors++; latest = '技能名称不能为空'; }
    else if (!nameRegex.test(name)) { errors++; latest = '名称只能包含字母、数字、连字符和中文'; }
    if (!desc) { errors++; latest = '触发描述不能为空'; }
    else if (desc.length < 10) { warnings++; latest = '描述太短可能影响触发'; }
    if (code.length < 20) { errors++; latest = '指令内容过少'; }

    const stats = document.getElementById('validationStats');
    stats.innerHTML = `
      <div class="skill-status-item ${errors > 0 ? 'error' : ''}">${ICONS.AlertCircle} ${errors} 个错误</div>
      <div class="skill-status-item ${warnings > 0 ? 'warning' : ''}">${ICONS.AlertCircle} ${warnings} 个警告</div>
    `;
    document.getElementById('latestIssue').textContent = latest;
    document.getElementById('latestIssue').style.color = errors > 0 ? '#ef4444' : (warnings > 0 ? '#f59e0b' : '#10b981');
  }

  static switchMode(mode) {
    viewMode = mode;
    document.querySelectorAll('.nav-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    document.getElementById('editorView').style.display = mode === 'editor' ? 'flex' : 'none';
    document.getElementById('testerView').style.display = mode === 'tester' ? 'flex' : 'none';
    
    if (mode === 'editor' && skillCodeEditor) {
      skillCodeEditor.refresh();
    }
  }

  static _getNextVersion(currentVersion) {
    if (!currentVersion || typeof currentVersion !== 'string') return '1.0.1';
    const parts = currentVersion.split('.').map(v => parseInt(v, 10) || 0);
    while (parts.length < 3) parts.push(0);

    // 最右侧数字加 1
    parts[parts.length - 1]++;

    // 从右向左进位逻辑：若数值超过 50 则向左侧进 1，当前位归 0
    for (let i = parts.length - 1; i > 0; i--) {
      if (parts[i] > 50) {
        parts[i] = 0;
        parts[i - 1]++;
      }
    }
    return parts.join('.');
  }

  static async save() {
    // 确保当前编辑的文件内容已同步到 currentFiles
    if (currentFiles[activeFileIndex]) {
      currentFiles[activeFileIndex].content = skillCodeEditor ? skillCodeEditor.getValue() : document.getElementById('skillCode').value;
    }

    const currentName = document.getElementById('skillName').value;
    const currentDesc = document.getElementById('skillDesc').value;
    const currentVersion = document.getElementById('skillVersion').value;
    const currentInvocable = document.getElementById('skillInvocable').checked;
    const currentTools = Array.from(document.querySelectorAll('.tool-pill.active')).map(p => p.dataset.tool);

    // 如果是编辑已有技能，检查内容是否有变更
    let versionToSave = currentVersion;
    if (currentSkillId) {
      try {
        const res = await fetch(`${getApiBase()}/skills/${currentSkillId}`);
        const original = await res.json();
        
        // 检查元数据是否有变更
        const metaChanged = 
          original.name !== currentName ||
          original.description !== currentDesc ||
          original.userInvocable !== currentInvocable ||
          JSON.stringify(original.allowedTools || []) !== JSON.stringify(currentTools);

        // 检查文件内容是否有变更
        let filesChanged = false;
        if (original.files && original.files.length === currentFiles.length) {
          for (const file of currentFiles) {
            // 转换路径进行比较，服务器返回的是 / 分隔符
            const serverPath = toDisplayPath(file.name);
            const originalFile = original.files.find(f => f.name === serverPath);
            
            if (!originalFile) {
              filesChanged = true;
              break;
            }
            // 比较 SKILL.md 的内容（使用 markdownContent）和其他文件的内容
            if (file.name === 'SKILL.md') {
              if ((original.markdownContent || '').trim() !== (file.content || '').trim()) {
                filesChanged = true;
                break;
              }
            } else {
              if ((originalFile.content || '').trim() !== (file.content || '').trim()) {
                filesChanged = true;
                break;
              }
            }
          }
        } else {
          filesChanged = true;
        }

        if (metaChanged || filesChanged) {
          // 有变更，更新版本号
          versionToSave = this._getNextVersion(currentVersion);
          document.getElementById('skillVersion').value = versionToSave;
          document.getElementById('statusVersion').textContent = 'v' + versionToSave;
        } else {
          // 无变更，直接发布，不更新版本号
          versionToSave = currentVersion;
        }
      } catch (e) {
        console.error('检查变更失败:', e);
        // 失败时保守起见，继续增加版本号
        versionToSave = this._getNextVersion(currentVersion);
      }
    } else {
      // 新建技能，使用初始版本或当前输入的版本
      versionToSave = currentVersion || '0.0.1';
    }

    const btn = document.getElementById('saveSkillBtn');
    btn.textContent = '保存中...';
    
    const frontmatter = {
      name: currentName,
      description: currentDesc,
      version: versionToSave,
      userInvocable: currentInvocable,
      allowedTools: currentTools
    };

    // 找到 SKILL.md 文件并使用其内容作为 markdown 提交
    const skillMdFile = currentFiles.find(f => f.name === 'SKILL.md');
    const markdownContent = skillMdFile ? skillMdFile.content : (skillCodeEditor ? skillCodeEditor.getValue() : document.getElementById('skillCode').value);

    const payload = {
      name: frontmatter.name,
      frontmatter,
      markdown: markdownContent,
      files: currentFiles.map(f => {
        // 将内部路径转换回服务器路径
        const serverPath = toDisplayPath(f.name);
        if (f.name === 'SKILL.md') {
          // 重新构建带 frontmatter 的完整内容用于保存到磁盘
          const yamlContent = jsyaml.dump(frontmatter, { indent: 2 });
          return {
            name: serverPath,
            content: `---\n${yamlContent}---\n\n${f.content}`
          };
        }
        return { name: serverPath, content: f.content };
      })
    };

    try {
      const method = currentSkillId ? 'PUT' : 'POST';
      const url = currentSkillId ? `${getApiBase()}/skills/${currentSkillId}` : `${getApiBase()}/skills`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '发布失败');

      if (window.showMessage) window.showMessage('发布成功');
      // 如果 ID 发生了变化（例如重命名了技能），更新当前 ID
      if (data && data.id && data.id !== currentSkillId) {
        currentSkillId = data.id;
      }
      await this.loadSkills();
    } catch (e) {
      if (window.showMessage) window.showMessage(e.message, 'error');
    } finally {
      btn.textContent = '发布技能';
    }
  }

  static runSim() {
    const input = document.getElementById('simInput');
    const text = input.value.trim();
    if (!text) return;
    
    const code = skillCodeEditor ? skillCodeEditor.getValue().trim() : document.getElementById('skillCode').value.trim();
    if (!code) {
      if (window.showMessage) window.showMessage('请先编写指令', 'warning');
      return;
    }

    const history = document.getElementById('chatHistory');
    history.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = '';
    
    setTimeout(() => {
      const desc = document.getElementById('skillDesc').value.toLowerCase();
      const name = document.getElementById('skillName').value;
      if (text.toLowerCase().split(' ').some(w => desc.includes(w)) || text.includes('审查')) {
        history.innerHTML += `<div class="trigger-indicator">${ICONS.Zap} 技能已激活：${name}</div>`;
      }
      history.innerHTML += `<div class="msg ai">正在分析您的请求...</div>`;
      history.scrollTop = history.scrollHeight;
    }, 600);
  }
}
