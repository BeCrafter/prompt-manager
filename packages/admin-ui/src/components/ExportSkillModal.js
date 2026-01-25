export class ExportSkillModal {
  static getHTML() {
    return `
      <div id="exportSkillModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="exportSkillTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="exportSkillTitle">导出技能</h3>
              <button type="button" class="modal-close" id="exportSkillCloseBtn" aria-label="关闭">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 1rem 0;">
                <div style="width: 48px; height: 48px; background-color: #e0f2fe; color: #0ea5e9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </div>
                <p style="font-size: 15px; color: #374151; font-weight: 600; margin-bottom: 0.5rem;">确定要导出这个技能吗？</p>
                <p style="font-size: 14px; color: #6b7280; line-height: 1.5;">
                  技能 "<span id="exportSkillName" style="color: #111827; font-weight: 700;"></span>" 将被打包为 ZIP 文件并下载到您的电脑。
                </p>
              </div>
            </div>
            <div class="modal-footer" style="background-color: #f9fafb; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
              <button type="button" class="btn btn-light" id="exportSkillCancelBtn" style="border: 1px solid #e5e7eb; background: white;">取消</button>
              <button type="button" class="btn btn-primary" id="exportSkillConfirmBtn" style="background-color: #0ea5e9; color: white; border: none;">确认导出</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
