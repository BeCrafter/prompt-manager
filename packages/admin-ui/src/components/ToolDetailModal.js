export class ToolDetailModal {
  static getHTML() {
    return `
      <div id="toolDetailModal" class="tool-detail-modal">
        <div class="tool-detail-content">
          <div class="tool-detail-header">
            <h2 class="tool-detail-title" id="toolDetailName">工具详情</h2>
            <button class="tool-detail-close" id="toolDetailClose" aria-label="关闭">×</button>
          </div>
          <div class="tool-detail-body">
            <div class="tool-detail-info" id="toolDetailInfo">
              <!-- 工具基本信息将通过JavaScript动态加载 -->
            </div>
            <div class="tool-detail-markdown" id="toolDetailContent">
              <div class="tool-detail-loading"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

