export class OptimizationDrawer {
  static getHTML() {
    return `
      <div id="optimizationDrawer" class="optimization-drawer hidden">
        <div class="drawer-overlay"></div>
        <div class="drawer-content">
          <div class="drawer-header">
            <h3>AI 优化</h3>
            <button type="button" id="closeDrawerBtn" class="drawer-close" aria-label="关闭">×</button>
          </div>
          <div class="drawer-body">
            <!-- 原始提示词 -->
            <div class="original-prompt-section">
              <h4>原始提示词</h4>
              <textarea id="originalEditor" class="form-control" rows="8" placeholder="输入要优化的提示词..."></textarea>
            </div>
            
            <!-- 优化控制区域 -->
            <div class="optimization-controls">
              <div class="optimization-controls-row">
                <!-- 模型选择 -->
                <div class="control-group model-selector">
                  <div class="custom-select" id="modelSelectWrapper">
                    <div class="custom-select-trigger placeholder" id="modelSelectTrigger">
                      <span>优化模型</span>
                      <svg class="custom-select-arrow" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <div class="custom-select-options" id="modelSelectOptions">
                      <div class="custom-select-option" data-value="">请选择模型</div>
                      <div class="custom-select-divider"></div>
                      <div class="custom-select-action" id="configModelAction">
                        <span>⚙️ 配置模型</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 模板选择 -->
                <div class="control-group template-selector">
                  <div class="custom-select" id="templateSelectWrapper">
                    <div class="custom-select-trigger placeholder" id="templateSelectTrigger">
                      <span>优化提示词</span>
                      <svg class="custom-select-arrow" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <div class="custom-select-options" id="templateSelectOptions">
                      <div class="custom-select-option" data-value="">请选择模板</div>
                      <div class="custom-select-divider"></div>
                      <div class="custom-select-action" id="configTemplateAction">
                        <span>⚙️ 配置模板</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 开始优化按钮 -->
                <button type="button" id="startOptimizeBtn" class="btn btn-primary" disabled>
                  开始优化 →
                </button>
              </div>
            </div>
            
            <!-- 优化结果（流式输出） -->
            <div class="optimized-result-section">
              <div class="result-header">
                <h4>优化后的提示词</h4>
                <button type="button" id="iterateBtn" class="btn btn-outline btn-sm" disabled>
                  继续优化
                </button>
              </div>
              <div id="optimizedOutput" class="optimized-output">
                <p class="placeholder-text">优化结果将在这里显示...</p>
              </div>
            </div>
          </div>
          <div class="drawer-footer">
            <button type="button" id="cancelBtn" class="btn btn-outline">取消</button>
            <button type="button" id="applyOptimizationBtn" class="btn btn-primary" disabled>应用优化</button>
          </div>
        </div>
      </div>
      
      <!-- 迭代优化指导弹窗 -->
      <div id="iterationGuideModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="iterationGuideModalTitle">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="iterationGuideModalTitle">继续优化 - 输入优化指导</h3>
              <button type="button" id="iterationGuideModalClose" class="modal-close" aria-label="关闭">×</button>
            </div>
            <div class="modal-body">
              <div class="form-info-box">
                <h4>💡 优化指导说明</h4>
                <p>请输入您希望本次迭代优化的具体方向或要求，例如：</p>
                <ul>
                  <li>让提示词更加简洁明了</li>
                  <li>增加对输出格式的详细要求</li>
                  <li>优化角色定义的专业性</li>
                  <li>增强提示词的容错能力</li>
                  <li>调整语气和风格</li>
                </ul>
              </div>
              <div class="form-group">
                <label for="iterationTemplate">迭代模板 <span class="required">*</span></label>
                <div class="custom-select" id="iterationTemplateSelectWrapper">
                  <div class="custom-select-trigger placeholder" id="iterationTemplateSelectTrigger">
                    <span>选择迭代模板</span>
                    <svg class="custom-select-arrow" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="custom-select-options" id="iterationTemplateSelectOptions">
                    <!-- 迭代模板选项 -->
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label for="iterationGuide">优化指导 <span class="optional">(可选)</span></label>
                <textarea id="iterationGuide" class="form-control" rows="4" placeholder="请输入您希望优化的具体方向或要求..."></textarea>
                <small class="form-text">如果不输入，将基于上一次的优化结果自动继续优化</small>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" id="cancelIterationBtn" class="btn btn-outline">取消</button>
              <button type="button" id="confirmIterationBtn" class="btn btn-primary" disabled>开始迭代优化</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}