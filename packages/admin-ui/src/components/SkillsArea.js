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

// SVG 图标
const ICONS = {
  Plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
  Folder: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
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
  Trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
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
                <button id="addFileBtn" class="add-file-btn" title="新增文件">${ICONS.Plus}</button>
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
        name: f.name,
        content: f.name === 'SKILL.md' ? (s.markdownContent || '') : f.content,
        status: 'synced'
      }));
    } else {
      // 降级处理
      currentFiles = [
        { name: 'SKILL.md', content: s.markdownContent || '', status: 'synced' }
      ];
    }
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
    const addFolderBtn = document.getElementById('addFolderBtn');
    const blankNewBtn = document.getElementById('blankNewBtn');
    const saveSkillBtn = document.getElementById('saveSkillBtn');
    
    if (newSkillBtn) newSkillBtn.onclick = () => this.createNew();
    if (addFolderBtn) addFolderBtn.onclick = () => this.createNewFolder();
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
    if (simInput) simInput.onkeypress = (e) => { if(e.key === 'Enter') this.runSim(); };

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
  }

  static addFile() {
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

    // 保存当前正在编辑的文件内容
    if (currentFiles[activeFileIndex]) {
      currentFiles[activeFileIndex].content = skillCodeEditor ? skillCodeEditor.getValue() : document.getElementById('skillCode').value;
    }

    // 添加新文件
    currentFiles.push({
      name: filename,
      content: '', // 移除默认内容
      status: 'new'
    });

    // 切换到新文件
    activeFileIndex = currentFiles.length - 1;
    this.renderFiles();
    this.updateEditorView();
    this.validate();
  }

  static switchFile(index) {
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

    container.innerHTML = currentFiles.map((file, idx) => {
      const isRenaming = renamingFileIndex === idx;
      const canRename = file.name !== 'SKILL.md';
      return `
        <div class="skill-file-item ${idx === activeFileIndex ? 'active' : ''} ${isRenaming ? 'renaming' : ''}" 
          onclick="window.SkillsArea.switchFile(${idx})"
          ${canRename ? `ondblclick="event.stopPropagation(); window.SkillsArea.startRename(${idx})"` : ''}
        >
          <span class="skill-file-item-icon">${ICONS.FileText}</span>
          ${isRenaming ? `
            <input type="text" class="file-rename-input" 
              value="${file.name}" 
              onclick="event.stopPropagation()" 
              onblur="window.SkillsArea.finishRename(${idx}, this.value)"
              onkeydown="if(event.key==='Enter') this.blur(); if(event.key==='Escape') { window.SkillsArea.cancelRename(); event.stopPropagation(); }"
              autoFocus
            />
          ` : `
            <span class="skill-file-item-name-label">${file.name}</span>
            <div class="skill-file-item-actions">
              ${canRename ? `
                <button class="file-action-btn rename" onclick="event.stopPropagation(); window.SkillsArea.startRename(${idx})" title="更名">${ICONS.More}</button>
                <button class="file-action-btn delete" onclick="event.stopPropagation(); window.SkillsArea.deleteFile(${idx})" title="删除">${ICONS.Trash}</button>
              ` : `<span class="skill-file-item-status">${ICONS.CheckCircle}</span>`}
            </div>
          `}
        </div>
      `;
    }).join('');

    // 聚焦输入框
    const input = container.querySelector('.file-rename-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  static startRename(index) {
    renamingFileIndex = index;
    this.renderFiles();
  }

  static finishRename(index, newName) {
    if (renamingFileIndex === null) return;
    
    const file = currentFiles[index];
    newName = newName.trim();
    
    if (newName && newName !== file.name) {
      // 检查冲突
      if (!currentFiles.find((f, i) => i !== index && f.name === newName)) {
        file.name = newName;
      }
    }
    
    renamingFileIndex = null;
    this.renderFiles();
  }

  static cancelRename() {
    renamingFileIndex = null;
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

    // 初始化文件列表
    currentFiles = [
      { name: 'SKILL.md', content: '', status: 'new' }
    ];
    activeFileIndex = 0;
    this.renderFiles();
    this.updateEditorView();

    this.renderTools(['Read']);
    this.validate();
  }

  static createNewFolder() {
    // TODO: 实现新建文件夹功能
    console.log('新建文件夹功能待实现');
    // 这里可以添加文件夹创建逻辑
    // 例如：显示模态框让用户输入文件夹名称
  }

  static validate() {
    const name = document.getElementById('skillName').value.trim();
    const desc = document.getElementById('skillDesc').value.trim();
    const code = skillCodeEditor ? skillCodeEditor.getValue().trim() : document.getElementById('skillCode').value.trim();
    
    let errors = 0;
    let warnings = 0;
    let latest = '配置通过验证';

    const nameRegex = /^[a-z0-9-]+$/;
    if (!name) { errors++; latest = '技能名称不能为空'; }
    else if (!nameRegex.test(name)) { errors++; latest = '名称只能包含小写字母、数字和连字符'; }
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
            const originalFile = original.files.find(f => f.name === file.name);
            const currentContent = file.name === 'SKILL.md' ? (original.markdownContent || '') : file.content;
            // 注意：SKILL.md 在编辑器里只有 markdownContent 部分
            if (!originalFile || (file.name === 'SKILL.md' ? original.markdownContent !== file.content : originalFile.content !== file.content)) {
              filesChanged = true;
              break;
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
          // 无变更，直接返回或提示
          if (window.showMessage) window.showMessage('内容无变更，无需发布', 'info');
          return;
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
        if (f.name === 'SKILL.md') {
          // 重新构建带 frontmatter 的完整内容用于保存到磁盘
          const yamlContent = jsyaml.dump(frontmatter, { indent: 2 });
          return {
            name: f.name,
            content: `---\n${yamlContent}---\n\n${f.content}`
          };
        }
        return { name: f.name, content: f.content };
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
