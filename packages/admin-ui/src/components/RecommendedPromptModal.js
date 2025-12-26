export class RecommendedPromptModal {
  static getHTML() {
    return `
      <div id="recommendedPromptModal" class="recommended-prompt-modal hidden">
        <div class="recommended-prompt-modal-content">
          <div class="recommended-prompt-modal-header">
            <h3 id="recommendedPromptTitle">
              <svg class="modal-title-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span class="modal-title-text">推荐提示词</span>
            </h3>
            <button class="recommended-prompt-modal-close" id="recommendedPromptClose">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="recommended-prompt-modal-body">
            <div class="prompt-detail-description" id="recommendedPromptDescription"></div>
            <div class="prompt-detail-content" id="recommendedPromptContent"></div>
          </div>
          <div class="recommended-prompt-modal-footer">
            <button class="sync-to-my-prompts-btn" id="syncToMyPromptsBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
              </svg>
              一键同步
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

