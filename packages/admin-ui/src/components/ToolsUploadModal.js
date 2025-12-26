export class ToolsUploadModal {
  static getHTML() {
    return `
      <div id="toolsUploadModal" class="modal hidden">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3>上传工具包</h3>
              <button type="button" class="modal-close" id="toolsUploadCloseBtn">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="upload-area" id="uploadArea">
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
                    <p class="upload-subtitle">支持包含 README.md 和 {tool_name}.tool.js 的ZIP格式工具包</p>
                  </div>
                  <input type="file" id="fileInput" accept=".zip" style="display: none;" />
                  <button type="button" class="btn btn-outline" id="selectFileBtn">选择文件</button>
                </div>
                <div class="upload-progress" id="uploadProgress" style="display: none;">
                  <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                  </div>
                  <div class="progress-text" id="progressText">上传中...</div>
                </div>
              </div>
              <div class="upload-requirements">
                <h4>工具包要求：</h4>
                <ul>
                  <li>文件格式：.zip</li>
                  <li>必须包含：README.md 文件</li>
                  <li>必须包含：{tool_name}.tool.js 文件</li>
                  <li>文件名不支持中文和特殊字符</li>
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-light" id="toolsUploadCancelBtn">取消</button>
              <button type="button" class="btn btn-primary" id="toolsUploadConfirmBtn" disabled>上传</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

