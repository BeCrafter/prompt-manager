export class ToolsArea {
  static getHTML() {
    return `
      <div id="toolsArea" class="tools-area" style="display: none;">
        <!-- 工具页面头部 -->
        <div class="tools-header">
          <div class="tools-header-left">
            <h2 class="tools-title">工具管理</h2>
            <div class="tools-search">
              <input type="text" id="toolsSearchInput" placeholder="搜索工具名称或描述..." />
              <button type="button" class="search-clear-btn" id="toolsSearchClear" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div class="tools-header-right">
            <button type="button" class="btn btn-outline" id="toolsUploadBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              上传工具包
            </button>
            <div class="tools-filter">
              <button type="button" class="filter-btn active" data-filter="all">
                全部
              </button>
              <button type="button" class="filter-btn" data-filter="category">
                类别
              </button>
              <button type="button" class="filter-btn" data-filter="tag">
                标签
              </button>
              <button type="button" class="filter-btn" data-filter="author">
                作者
              </button>
            </div>
          </div>
        </div>

        <!-- 工具内容区域 -->
        <div class="tools-content">
          <!-- 工具网格视图 -->
          <div class="tools-grid" id="toolsGrid">
            <!-- 工具卡片将通过JavaScript动态加载 -->
          </div>
          
          <!-- 聚合视图（类别、标签、作者） -->
          <div class="tools-aggregated-view" id="toolsAggregatedView" style="display: none;">
            <!-- 类别聚合视图 -->
            <div class="aggregated-view" id="categoryView" style="display: none;">
              <div class="aggregated-sidebar">
                <div class="aggregated-sidebar-header">
                  <h3>类别列表</h3>
                </div>
                <div class="aggregated-sidebar-list" id="categorySidebar">
                  <!-- 类别列表将通过JavaScript动态加载 -->
                </div>
              </div>
              <div class="aggregated-content">
                <div class="aggregated-content-header" id="categoryContentHeader">
                  <h3>请选择类别</h3>
                </div>
                <div class="aggregated-content-grid" id="categoryContentGrid">
                  <!-- 选中类别的工具将通过JavaScript动态加载 -->
                </div>
              </div>
            </div>

            <!-- 标签聚合视图 -->
            <div class="aggregated-view" id="tagView" style="display: none;">
              <div class="aggregated-header">
                <h3>按标签浏览</h3>
              </div>
              <div class="tag-cloud" id="tagCloud">
                <!-- 标签将通过JavaScript动态加载 -->
              </div>
              <div class="tag-tools-list" id="tagToolsList">
                <!-- 标签对应的工具列表将通过JavaScript动态加载 -->
              </div>
            </div>

            <!-- 作者聚合视图 -->
            <div class="aggregated-view" id="authorView" style="display: none;">
              <div class="aggregated-sidebar">
                <div class="aggregated-sidebar-header">
                  <h3>作者列表</h3>
                </div>
                <div class="aggregated-sidebar-list" id="authorSidebar">
                  <!-- 作者列表将通过JavaScript动态加载 -->
                </div>
              </div>
              <div class="aggregated-content">
                <div class="aggregated-content-header" id="authorContentHeader">
                  <h3>请选择作者</h3>
                </div>
                <div class="aggregated-content-grid" id="authorContentGrid">
                  <!-- 选中作者的工具将通过JavaScript动态加载 -->
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div class="tools-empty" id="toolsEmpty" style="display: none;">
            <div class="tools-empty-icon">🔧</div>
            <div class="tools-empty-text">暂无工具</div>
            <div class="tools-empty-hint">请上传工具包或添加工具</div>
          </div>
        </div>
      </div>
    `;
  }
}

