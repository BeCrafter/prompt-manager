export class DeletePromptModal {
  static getHTML() {
    return `
      <div id="deletePromptModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="deletePromptTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="deletePromptTitle">删除 Prompt</h3>
              <button type="button" class="modal-close" id="deletePromptCloseBtn" aria-label="关闭">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <p style="font-size: 14px; color: var(--gray); line-height: 1.6;">
                确认删除 <span id="deletePromptName" style="color: var(--dark); font-weight: 600;"></span> 吗？该操作不可撤销。
              </p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" id="deletePromptCancelBtn">取消</button>
              <button type="button" class="btn btn-danger" id="deletePromptConfirmBtn">删除</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

