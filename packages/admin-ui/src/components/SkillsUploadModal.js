export class SkillsUploadModal {
  static getHTML() {
    return `
      <div id="skillsUploadModal" class="modal hidden">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3>上传技能包</h3>
              <button type="button" class="modal-close" id="skillsUploadCloseBtn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="upload-area" id="skillsUploadArea">
                <div class="upload-content">
                  <div class="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <div class="upload-text">
                    <p class="upload-title">拖拽ZIP文件到此处或点击选择</p>
                    <p class="upload-subtitle">支持包含 SKILL.md 和相关文件的ZIP格式技能包</p>
                  </div>
                  <input type="file" id="skillsFileInput" accept=".zip" style="display: none;" />
                  <button type="button" class="btn btn-outline" id="skillsSelectFileBtn">选择文件</button>
                </div>
                <div class="upload-progress" id="skillsUploadProgress" style="display: none;">
                  <div class="progress-bar">
                    <div class="progress-fill" id="skillsProgressFill"></div>
                  </div>
                  <div class="progress-text" id="skillsProgressText">上传中...</div>
                </div>
              </div>
              <div class="upload-requirements">
                <h4>技能包要求：</h4>
                <ul>
                  <li>文件格式：.zip</li>
                  <li>必须包含：SKILL.md 文件（包含技能元数据和指令）</li>
                  <li>可选包含：其他支持文件（如 JS 脚本、配置文件等）</li>
                  <li>文件名不支持中文和特殊字符</li>
                  <li>文件大小限制：10MB</li>
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" id="skillsUploadCancelBtn">取消</button>
              <button type="button" class="btn btn-primary" id="skillsUploadConfirmBtn" disabled>上传</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}