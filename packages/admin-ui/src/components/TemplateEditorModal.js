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
                <div class="form-row">
                  <div class="form-group col-6">
                    <label for="templateType">适用场景 <span class="required">*</span></label>
                    <select id="templateType" class="form-control" required>
                      <option value="optimize">系统提示词 (用于初始优化)</option>
                      <option value="iterate">迭代提示词 (用于继续优化)</option>
                    </select>
                  </div>
                  <div class="form-group col-6">
                    <label for="templateFormat">模板格式 <span class="required">*</span></label>
                    <select id="templateFormat" class="form-control" required>
                      <option value="simple">简单模板 (单文本)</option>
                      <option value="advanced">高级模板 (多角色消息)</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label for="templateName">名称 <span class="required">*</span></label>
                  <input type="text" id="templateName" class="form-control" required placeholder="请输入模板名称" />
                </div>
                <div class="form-group">
                  <label for="templateDescription">描述</label>
                  <textarea id="templateDescription" class="form-control" rows="2" placeholder="请输入模板描述"></textarea>
                </div>
                
                <!-- 简单模板内容 -->
                <div id="simpleContentSection" class="form-group">
                  <label for="templateContent">内容 <span class="required">*</span></label>
                  <textarea id="templateContent" class="form-control" rows="8" placeholder="请输入模板内容"></textarea>
                  <div class="template-help-text">
                    <p>💡 可用变量：</p>
                    <ul id="variableList">
                      <li><code>{{prompt}}</code> - 原始输入的提示词</li>
                    </ul>
                  </div>
                </div>

                <!-- 高级模板内容 -->
                <div id="advancedContentSection" class="form-group hidden">
                  <label>多消息配置 <span class="required">*</span></label>
                  <div id="advancedMessageList" class="advanced-message-list">
                    <!-- 消息列表 -->
                  </div>
                  <button type="button" id="addMessageBtn" class="btn btn-outline btn-sm" style="margin-top: 10px;">
                    + 添加消息
                  </button>
                  <div class="template-help-text">
                    <p>💡 高级模板说明：</p>
                    <p>您可以定义多轮对话，系统会自动替换 <code>{{prompt}}</code> 等变量。支持的角色：system, user, assistant。</p>
                  </div>
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