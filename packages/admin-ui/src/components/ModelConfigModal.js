export class ModelConfigModal {
  static getHTML() {
    return `
      <div id="modelConfigModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="modelConfigModalTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="modelConfigModalTitle">模型配置</h3>
              <button type="button" id="modelConfigModalClose" class="modal-close" aria-label="关闭">×</button>
            </div>
            <div class="modal-body">
              <div class="model-list-header">
                <button type="button" id="createModelBtn" class="btn btn-primary">
                  + 新增模型
                </button>
              </div>
              <div id="modelList" class="model-list">
                <!-- 动态加载模型列表 -->
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" id="modelConfigCloseBtn" class="btn btn-light">关闭</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 模型编辑模态框（嵌套） -->
      <div id="modelEditorModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="modelEditorModalTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="modelEditorModalTitle">编辑模型</h3>
              <button type="button" id="modelEditorModalClose" class="modal-close" aria-label="关闭">×</button>
            </div>
            <div class="modal-body">
              <div class="form-info-box">
                <h4>ℹ️ OpenAPI 规范要求</h4>
                <p>模型配置需符合 OpenAI 兼容的 API 规范，确保请求和响应格式正确：</p>
                <ul>
                  <li><strong>API 端点</strong>：需指向 <code>/chat/completions</code> 接口</li>
                  <li><strong>请求格式</strong>：JSON 格式，包含 <code>model</code> 和 <code>messages</code> 字段</li>
                  <li><strong>响应格式</strong>：支持流式输出（SSE）或标准 JSON 响应</li>
                  <li><strong>认证方式</strong>：使用 Bearer Token（API Key）</li>
                </ul>
                <p class="form-info-example">
                  示例端点：<code>https://api.openai.com/v1/chat/completions</code>
                </p>
              </div>
              <form id="modelForm">
                <div class="form-group">
                  <label for="modelName">名称 <span class="required">*</span></label>
                  <input type="text" id="modelName" class="form-control" required placeholder="例如：OpenAI GPT-4" />
                </div>
                <div class="form-group">
                  <label for="modelProvider">提供商 <span class="required">*</span></label>
                  <input type="text" id="modelProvider" class="form-control" required placeholder="例如：openai" />
                </div>
                <div class="form-group">
                  <label for="modelModel">模型 <span class="required">*</span></label>
                  <input type="text" id="modelModel" class="form-control" required placeholder="例如：gpt-4" />
                </div>
                <div class="form-group">
                  <label for="modelApiEndpoint">API 端点 <span class="required">*</span></label>
                  <input type="url" id="modelApiEndpoint" class="form-control" required placeholder="https://api.openai.com/v1/chat/completions" />
                  <small class="form-text">必须指向 /chat/completions 接口</small>
                </div>
                <div class="form-group">
                  <label for="modelApiKey">API Key</label>
                  <input type="password" id="modelApiKey" class="form-control" placeholder="请输入 API Key" />
                  <small class="form-text">用于 Bearer Token 认证</small>
                </div>
                <div class="form-group">
                  <label class="checkbox-field">
                    <input type="checkbox" id="modelEnabled" checked />
                    <span>启用此模型</span>
                  </label>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" id="cancelModelBtn" class="btn btn-light">取消</button>
              <button type="button" id="saveModelBtn" class="btn btn-primary">保存</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}