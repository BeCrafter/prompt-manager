// SkillSyncModal.js - 技能同步配置弹窗

import { getBackendUrl } from '../utils/env-loader.js';

function getApiBase() {
  const backendUrl = getBackendUrl();
  return `${backendUrl}/adminapi`;
}

export class SkillSyncModal {
  constructor() {
    this.config = {
      enabled: false,
      targets: [],
      lastSyncTime: null,
      error: null
    };
    this.modal = null;
  }

  static getHTML() {
    return `
      <div class="modal hidden" id="skillSyncModal">
        <div class="modal-content skill-sync-modal">
          <div class="modal-header">
            <h3>同步配置</h3>
            <button class="modal-close" id="closeSkillSyncModal" aria-label="关闭">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="config-section">
              <div class="sync-description-text">
                将 <code>~/.prompt-manager/skills</code> 目录同步到以下位置。
              </div>

              <div class="form-group inline-group" id="autoSyncRow">
                <label for="syncEnabled">启用自动同步</label>
                <label class="toggle-switch" for="syncEnabled">
                  <input type="checkbox" id="syncEnabled">
                  <span class="slider"></span>
                </label>
              </div>

              <div class="form-group">
                <label class="section-label">同步目的地</label>
                <div class="target-list-container">
                  <div id="targetList" class="target-list">
                    <!-- 目录项将在这里动态生成 -->
                  </div>
                  <div class="add-target-box">
                    <input type="text" id="newTargetPath" placeholder="输入目标目录路径 (例如: ~/my-project/skills)">
                    <button class="btn btn-secondary" id="addTargetBtn">添加</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="sync-status-bar-mini" id="syncStatusCard">
              <span class="status-label">最近同步:</span>
              <span class="status-value" id="lastSyncTime">-</span>
              <span id="syncErrorItem" style="display: none; margin-left: 8px;">
                <span class="error-text" id="syncErrorText"></span>
              </span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" id="runSyncBtn">立即同步</button>
            <button class="btn btn-success" id="saveSyncConfigBtn">保存配置</button>
          </div>
        </div>
      </div>
    `;
  }

  static async init() {
    const modal = document.getElementById('skillSyncModal');
    if (!modal) return;

    const closeBtn = document.getElementById('closeSkillSyncModal');
    const saveBtn = document.getElementById('saveSyncConfigBtn');
    const runBtn = document.getElementById('runSyncBtn');
    const addBtn = document.getElementById('addTargetBtn');
    const newPathInput = document.getElementById('newTargetPath');
    const enabledCheckbox = document.getElementById('syncEnabled');
    const autoSyncRow = document.getElementById('autoSyncRow');

    // 加载配置
    await this.loadConfig();

    closeBtn.onclick = () => this.hide();
    
    addBtn.onclick = () => {
      const path = newPathInput.value.trim();
      if (path) {
        this.addTarget(path);
        newPathInput.value = '';
      }
    };

    saveBtn.onclick = async () => {
      await this.saveConfig();
      this.hide();
    };

    runBtn.onclick = async () => {
      await this.runSync();
    };

    // 监听回车添加
    newPathInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        addBtn.click();
      }
    };
  }

  static async loadConfig() {
    try {
      const res = await fetch(`${getApiBase()}/skill-sync/config`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      this.config = await res.json();
      this.render();
    } catch (error) {
      console.error('加载同步配置失败:', error);
      alert('加载同步配置失败');
    }
  }

  static render() {
    const enabledCheckbox = document.getElementById('syncEnabled');
    const lastSyncTime = document.getElementById('lastSyncTime');
    const errorItem = document.getElementById('syncErrorItem');
    const errorText = document.getElementById('syncErrorText');
    const targetList = document.getElementById('targetList');

    if (enabledCheckbox) enabledCheckbox.checked = this.config.enabled;
    if (lastSyncTime) lastSyncTime.textContent = this.config.lastSyncTime ? new Date(this.config.lastSyncTime).toLocaleString() : '从未同步';

    if (autoSyncRow) {
      if (!this.config.targets || this.config.targets.length === 0) {
        autoSyncRow.style.display = 'none';
      } else if (this.config.effectiveSyncMethod === 'link') {
        autoSyncRow.style.display = 'none';
      } else {
        autoSyncRow.style.display = 'flex';
      }
    }
    
    if (this.config.error) {
      errorItem.style.display = 'flex';
      errorText.textContent = this.config.error;
    } else {
      errorItem.style.display = 'none';
    }

    targetList.innerHTML = '';
    this.config.targets.forEach((target, index) => {
      const item = document.createElement('div');
      item.className = 'target-item';
      item.innerHTML = `
        <span class="target-path" title="${target}">${target}</span>
        <button class="remove-target-btn" data-index="${index}">&times;</button>
      `;
      targetList.appendChild(item);
    });

    // 绑定删除按钮
    targetList.querySelectorAll('.remove-target-btn').forEach(btn => {
      btn.onclick = (e) => {
        const index = parseInt(e.target.dataset.index);
        this.removeTarget(index);
      };
    });
  }

  static addTarget(path) {
    if (!this.config.targets.includes(path)) {
      this.config.targets.push(path);
      this.render();
    }
  }

  static removeTarget(index) {
    this.config.targets.splice(index, 1);
    this.render();
  }

  static async saveConfig() {
    try {
      this.config.enabled = document.getElementById('syncEnabled').checked;
      const res = await fetch(`${getApiBase()}/skill-sync/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(this.config)
      });
      if (res.ok) {
        if (window.showMessage) window.showMessage('配置已保存');
      } else {
        const err = await res.json();
        if (window.showMessage) window.showMessage('保存失败: ' + err.error, 'error');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      if (window.showMessage) window.showMessage('保存配置失败', 'error');
    }
  }

  static async runSync() {
    const runBtn = document.getElementById('runSyncBtn');
    const originalText = runBtn.textContent;
    runBtn.disabled = true;
    runBtn.textContent = '同步中...';

    try {
      const res = await fetch(`${getApiBase()}/skill-sync/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
      });
      const result = await res.json();
      if (res.ok) {
        if (window.showMessage) window.showMessage('同步完成');
        await this.loadConfig(); // 刷新状态
      } else {
        if (window.showMessage) window.showMessage('同步失败: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('手动同步失败:', error);
      if (window.showMessage) window.showMessage('同步失败', 'error');
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = originalText;
    }
  }

  static show() {
    const modal = document.getElementById('skillSyncModal');
    if (modal) {
      modal.classList.remove('hidden');
      this.loadConfig();
    }
  }

  static hide() {
    const modal = document.getElementById('skillSyncModal');
    if (modal) modal.classList.add('hidden');
  }
}
