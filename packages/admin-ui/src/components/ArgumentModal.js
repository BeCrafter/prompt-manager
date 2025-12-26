export class ArgumentModal {
  static getHTML() {
    return `
      <div id="argumentModal" class="argument-modal hidden" role="dialog" aria-modal="true" aria-labelledby="argumentModalTitle">
        <div class="argument-modal-dialog">
          <div class="argument-modal-header">
            <h3 id="argumentModalTitle">新增参数</h3>
            <button type="button" id="argumentModalClose" class="argument-modal-close" aria-label="关闭">×</button>
          </div>
          <form id="argumentForm" class="argument-modal-form">
            <div class="argument-modal-body">
              <div class="argument-form-grid">
                <div class="form-field required-field">
                  <label for="argumentNameInput">参数名称 <span class="required">*</span></label>
                  <input type="text" id="argumentNameInput" name="argumentName" placeholder="例如：language" />
                </div>
                <div class="form-field">
                  <label for="argumentTypeInput">类型</label>
                  <input type="text" id="argumentTypeInput" name="argumentType" list="argumentTypeOptions" placeholder="例如：string" />
                </div>
                <div class="form-field">
                  <label for="argumentDefaultInput">默认值</label>
                  <input type="text" id="argumentDefaultInput" name="argumentDefault" placeholder="可选" />
                </div>
                <div class="form-field form-field-inline">
                  <label class="checkbox-field">
                    <input type="checkbox" id="argumentRequiredInput" />
                    <span>必填</span>
                  </label>
                </div>
                <div class="form-field full-width">
                  <label for="argumentDescriptionInput">参数说明</label>
                  <textarea id="argumentDescriptionInput" rows="3" placeholder="用于提示词中的描述"></textarea>
                </div>
              </div>
            </div>
            <div class="argument-modal-footer">
              <button type="button" class="btn btn-outline" id="argumentCancelBtn">取消</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>

      <datalist id="argumentTypeOptions">
        <option value="string">字符串</option>
        <option value="number">数字</option>
        <option value="boolean">布尔值</option>
      </datalist>
    `;
  }
}

