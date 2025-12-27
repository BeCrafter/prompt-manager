export class PromptsArea {
  static getHTML() {
    return `
      <div class="editor-container" id="promptsArea">
        <!-- 自定义空白内容区域 -->
        <div class="custom-blank-content" id="customBlankContent">
          <div class="blank-placeholder">
            <div class="blank-placeholder-body">
              <div class="blank-placeholder-emoji">📝</div>
              <p class="blank-placeholder-text">请选择左侧的 Prompt 或点击「<button type="button" id="newPromptBtnInBlankArea" class="blank-area-new-prompt-btn">新建 Prompt</button>」开始编辑</p>
            </div>
          </div>
          
          <!-- 推荐词卡片列表 -->
          <div class="recommended-prompts-section hidden" id="recommendedPromptsSection">
            <div class="recommended-prompts-header">
              <h3>推荐提示词</h3>
              <div class="recommended-prompts-nav">
                <button class="nav-arrow arrow-left disabled" id="recommendedPromptsLeft">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <button class="nav-arrow arrow-right" id="recommendedPromptsRight">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            <div class="recommended-prompts-container">
              <div class="recommended-prompts-list" id="recommendedPromptsList">
                <!-- 推荐词卡片将通过JavaScript动态加载 -->
              </div>
            </div>
          </div>
        </div>
        
        <!-- Prompt 编辑区域（默认隐藏） -->
        <div id="promptEditorArea" style="display: none;">
          <div class="editor-header">
            <div class="editor-header-top">
              <button id="backToListBtn" class="btn btn-outline btn-icon" title="返回列表">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <input type="text" id="promptName" name="promptName" placeholder="Prompt 名称" />
              <div class="group-selector">
                <button type="button" id="promptGroupBtn" class="group-selector-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="promptGroupDropdown">
                  <span class="group-selector-label" style="display: none;">关联类目</span>
                  <span class="group-selector-value" id="promptGroupLabel">default</span>
                  <span class="group-selector-icon" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                      <path d="M5 8L10 13L15 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                </button>
                <select id="promptGroup" class="group-selector-input" aria-hidden="true" tabindex="-1">
                  <!-- 选项将通过后端接口动态加载 -->
                </select>
                <div class="group-dropdown" id="promptGroupDropdown" role="dialog" aria-modal="false">
                  <div class="group-dropdown-search">
                    <input type="text" id="promptGroupSearch" placeholder="搜索类目..." autocomplete="off" />
                  </div>
                  <div class="group-dropdown-body">
                    <div class="group-cascader" id="promptGroupCascader"></div>
                    <div class="group-search-results" id="promptGroupSearchResults"></div>
                    <div class="group-dropdown-empty hidden" id="promptGroupEmpty">暂无匹配的类目</div>
                  </div>
                </div>
              </div>
              <div class="editor-controls">
                <div class="mode-toggle">
                  <button id="editModeBtn" class="mode-btn active" data-mode="edit">编辑</button>
                  <button id="previewModeBtn" class="mode-btn" data-mode="preview">预览</button>
                </div>
                <button id="aiOptimizeBtn" class="btn btn-outline btn-sm" title="AI 优化">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                  </svg>
                  AI 优化
                </button>
                <button id="saveBtn" class="btn btn-primary btn-sm">
                  保存
                </button>
              </div>
            </div>
          </div>

          <div class="editor-content">
            <textarea id="promptDescription" class="prompt-description" placeholder="Prompt 描述"></textarea>

            <section class="arguments-section collapsed" id="argumentsSection">
              <div class="arguments-header" id="argumentsHeaderToggle">
                <div class="arguments-title">
                  <button type="button" class="arguments-toggle" id="argumentsToggleBtn" aria-expanded="false">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  <span>参数配置</span>
                  <span class="arguments-count" id="argumentsCount">(0)</span>
                </div>
                <div class="arguments-actions">
                  <button id="addArgumentBtn" class="btn btn-outline btn-sm" type="button">
                    新增
                  </button>
                </div>
              </div>
              <div class="arguments-list" id="argumentsList">
                <div class="arguments-empty">暂无参数，点击"新增"开始配置</div>
              </div>
            </section>
            <div class="editor-body" id="editorWorkspace">
              <div class="workspace-pane" id="editorPane">
                <div class="pane-header">编辑器</div>
                <div class="pane-content">
                  <textarea id="editor"></textarea>
                </div>
              </div>
              <div class="workspace-pane hidden" id="previewPane">
                <div class="pane-header">实时预览</div>
                <div class="pane-content preview">
                  <div class="preview-content" id="previewContent">
                    <p>选择或创建prompt开始编辑</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

