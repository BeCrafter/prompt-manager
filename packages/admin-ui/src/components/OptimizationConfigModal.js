export class OptimizationConfigModal {
  static getHTML() {
    return `
      <div id="optimizationConfigModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="optimizationConfigModalTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="optimizationConfigModalTitle">优化配置</h3>
              <button type="button" id="optimizationConfigModalClose" class="modal-close" aria-label="关闭">×</button>
            </div>
            <div class="modal-body">
              <form id="optimizationConfigForm">
                <div class="form-group">
                  <label for="maxIterations">最大迭代次数</label>
                  <input type="number" id="maxIterations" class="form-control" min="1" max="20" value="10" />
                  <small class="form-text">单次会话中允许的最大迭代优化次数</small>
                </div>
                <div class="form-group">
                  <label class="checkbox-field">
                    <input type="checkbox" id="encryptionEnabled" checked disabled />
                    <span>启用 API Key 加密</span>
                  </label>
                  <small class="form-text">API Key 将使用 AES-256 加密存储</small>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" id="optimizationConfigCloseBtn" class="btn btn-light">关闭</button>
              <button type="button" id="saveOptimizationConfigBtn" class="btn btn-primary">保存</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}