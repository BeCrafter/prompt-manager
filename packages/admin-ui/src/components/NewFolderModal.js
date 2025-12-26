export class NewFolderModal {
  static getHTML() {
    return `
      <div id="newFolderModal" class="modal hidden">
        <div class="modal-dialog">
          <div class="modal-content group-modal-content">
            <div class="modal-header">
              <h3>类目管理</h3>
              <button type="button" class="modal-close" onclick="window.toggleNewFolderModal()">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.67" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="group-modal-tabs">
                <button type="button" class="group-modal-tab active" data-tab="create">新增类目</button>
                <button type="button" class="group-modal-tab" data-tab="manage">管理类目</button>
              </div>
              <div class="group-modal-panel" data-panel="create">
                <div class="form-group">
                  <label>目录名称</label>
                  <input type="text" id="newFolderName" name="folderName" placeholder="请输入目录名称" onkeydown="window.handleNewFolderKeydown(event)">
                  <div class="group-modal-hint">名称仅支持字母、数字、下划线、短横线和中文，长度不超过64个字符。</div>
                </div>
                <div class="form-group">
                  <label>父级目录</label>
                  <select id="newFolderParent" class="form-control">
                    <option value="">根目录</option>
                  </select>
                  <div class="group-modal-hint">选择父级目录以创建子目录</div>
                </div>
              </div>
              <div class="group-modal-panel hidden" data-panel="manage">
                <div class="group-manage-toolbar">
                  <input type="text" id="groupManageSearch" placeholder="搜索类目..." />
                  <button type="button" class="btn btn-light btn-sm" id="groupManageRefreshBtn">刷新</button>
                </div>
                <div class="group-manage-list" id="groupManageList"></div>
                <div class="group-manage-empty hidden" id="groupManageEmpty">暂无类目信息</div>
              </div>
            </div>
            <div class="modal-footer">
              <div class="group-modal-footer group-modal-footer-create" id="groupModalCreateFooter">
                <button type="button" class="btn btn-light" onclick="window.toggleNewFolderModal()">取消</button>
                <button type="button" class="btn btn-dark" onclick="window.createNewFolder()">创建</button>
              </div>
              <div class="group-modal-footer group-modal-footer-manage hidden" id="groupModalManageFooter">
                <button type="button" class="btn btn-light" onclick="window.toggleNewFolderModal(false)">关闭</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

