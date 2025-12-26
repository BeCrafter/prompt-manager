export class LoadingOverlay {
  static getHTML() {
    return `
      <div id="loadingOverlay" class="loading-overlay hidden">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载中...</div>
        <div class="loading-subtext">请稍候，正在获取数据</div>
      </div>
    `;
  }
}

