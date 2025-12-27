export class TemplateListModal {
  static getHTML() {
    return `
      <div id="templateListModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="templateListModalTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="templateListModalTitle">提示词模板管理</h3>
              <button type="button" id="templateListModalClose" class="modal-close" aria-label="关闭">×</button>
            </div>
            <div class="modal-body">
              <div class="template-list-header">
                <input type="text" id="templateSearch" class="form-control" placeholder="搜索模板..." />
                <button type="button" id="createTemplateBtn" class="btn btn-primary">
                  + 新增模板
                </button>
              </div>
              <div id="templateList" class="template-list">
                <!-- 动态加载模板列表 -->
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" id="templateListCloseBtn" class="btn btn-light">关闭</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}