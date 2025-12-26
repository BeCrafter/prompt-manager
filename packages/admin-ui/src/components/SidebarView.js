export class SidebarView {
  static getHTML() {
    return `
      <aside id="promptsSidebar">
        <div class="sidebar-header">
          <button id="newPromptBtn" class="new-prompt-btn">
            新建 Prompt
          </button>
          <div class="search-container">
            <div class="search-box">
              <input type="text" id="searchInput" name="searchInput" placeholder="搜索提示词..." autocomplete="off" />
              <button type="button" class="clear-btn" title="清除搜索"></button>
            </div>
            <button id="newGroupBtn" class="folder-btn" title="新建目录">
            </button>
          </div>
        </div>
        
        <div id="groupList"></div>
      </aside>
    `;
  }
}

