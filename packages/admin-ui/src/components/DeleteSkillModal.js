export class DeleteSkillModal {
  static getHTML() {
    return `
      <div id="deleteSkillModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="deleteSkillTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="deleteSkillTitle">删除技能</h3>
              <button type="button" class="modal-close" id="deleteSkillCloseBtn" aria-label="关闭">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1rem 0;">
                <div style="width: 48px; height: 48px; background-color: #fee2e2; color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 3 21 3 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </div>
                <p style="font-size: 15px; color: #374151; font-weight: 600; margin-bottom: 0.5rem;">确定要删除这个技能吗？</p>
                <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
                  技能 "<span id="deleteSkillName" style="color: #111827; font-weight: 700;"></span>" 及其所有关联文件将被永久删除。该操作不可撤销。
                </p>
              </div>
            </div>
            <div class="modal-footer" style="background-color: #f9fafb; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
              <button type="button" class="btn btn-light" id="deleteSkillCancelBtn" style="border: 1px solid #e5e7eb; background: white;">取消</button>
              <button type="button" class="btn btn-danger" id="deleteSkillConfirmBtn" style="background-color: #ef4444; color: white;">确认删除</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
