export class TemplateEditorModal {
  static getHTML() {
    return `
      <div id="templateEditorModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="templateEditorModalTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="templateEditorModalTitle">编辑模板</h3>
              <button type="button" id="templateEditorModalClose" class="modal-close" aria-label="关闭">×</button>
            </div>
            <div class="modal-body">
              <form id="templateForm">
                <div class="form-group">
                  <label for="templateName">名称 <span class="required">*</span></label>
                  <input type="text" id="templateName" class="form-control" required placeholder="请输入模板名称" />
                </div>
                <div class="form-group">
                  <label for="templateDescription">描述</label>
                  <textarea id="templateDescription" class="form-control" rows="3" placeholder="请输入模板描述"></textarea>
                </div>
                <div class="form-group">
                  <label for="templateContent">内容 <span class="required">*</span></label>
                  <textarea id="templateContent" class="form-control" rows="10" required placeholder="请输入模板内容，使用 {{prompt}} 作为提示词占位符"></textarea>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" id="cancelTemplateBtn" class="btn btn-light">取消</button>
              <button type="button" id="saveTemplateBtn" class="btn btn-primary">保存</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}