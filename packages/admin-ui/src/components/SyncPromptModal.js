export class SyncPromptModal {
  static getHTML() {
    return `
      <div id="syncPromptModal" class="sync-prompt-modal hidden">
        <div class="sync-prompt-modal-content">
          <div class="sync-prompt-modal-header">
            <h3>
              <svg class="modal-title-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span class="modal-title-text">同步到我的提示词</span>
            </h3>
            <button class="sync-prompt-modal-close" id="syncPromptClose">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="sync-prompt-modal-body">
            <form class="sync-prompt-form" id="syncPromptForm">
              <div class="form-group">
                <label for="syncPromptName">提示词名称</label>
                <input type="text" id="syncPromptName" name="name" placeholder="请输入提示词名称" required>
              </div>
              <div class="form-group">
                <label for="syncPromptGroup">选择目录</label>
                <select id="syncPromptGroup" name="group" required>
                  <option value="">请选择目录</option>
                  <!-- 目录选项将通过JavaScript动态加载 -->
                </select>
              </div>
            </form>
          </div>
          <div class="sync-prompt-modal-footer">
            <button class="btn btn-light" id="syncPromptCancel">取消</button>
            <button class="btn btn-primary" id="syncPromptConfirm">同步</button>
          </div>
        </div>
      </div>
    `;
  }
}

