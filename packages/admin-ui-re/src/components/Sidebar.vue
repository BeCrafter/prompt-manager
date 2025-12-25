<template>
  <a-layout-sider 
    :width="300" 
    class="sidebar"
    :trigger="null"
    collapsible
    v-model:collapsed="collapsed"
    :collapsed-width="80"
  >
    <div class="sidebar-header">
      <div v-if="!collapsed" class="header-content">
        <a-button 
          type="primary" 
          class="new-prompt-btn"
          @click="handleNewPrompt"
          block
          size="large"
        >
          <template #icon>
            <PlusOutlined />
          </template>
          新建 Prompt
        </a-button>
        
        <div class="search-container">
          <a-input
            v-model:value="searchValue"
            placeholder="搜索提示词..."
            @pressEnter="handleSearch"
            @change="handleSearchChange"
            allow-clear
          >
          <template #prefix>
            <SearchOutlined />
          </template>
          </a-input>
          
          <a-dropdown :trigger="['click']" placement="bottomLeft">
            <a-button 
              type="text" 
              class="action-btn"
              title="更多操作"
            >
              <FolderOutlined />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="folder" @click="handleNewFolder">
                  <FolderOutlined />
                  新建目录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
      
      <div v-else class="collapsed-header">
        <a-button 
          type="primary" 
          class="collapsed-new-btn"
          @click="handleNewPrompt"
          title="新建 Prompt"
        >
          <PlusOutlined />
        </a-button>
        
        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-button 
            type="text" 
            class="collapsed-action-btn"
            title="更多操作"
          >
            <MoreOutlined />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="folder" @click="handleNewFolder">
                <FolderOutlined />
                新建目录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>
    
    <div class="group-list">
      <a-menu
        v-model:selectedKeys="selectedKeys"
        mode="inline"
        :open-keys="openKeys"
        @openChange="handleOpenChange"
        @select="handleMenuSelect"
        class="sidebar-menu"
      >
        <a-menu-item key="all" class="menu-item-all">
          <template #icon>
            <AppstoreOutlined />
          </template>
          <span>全部提示词</span>
          <a-badge 
            :count="totalCount" 
            :show-zero="false" 
            class="prompt-count"
          />
        </a-menu-item>
        
        <a-menu-item key="recent" class="menu-item-recent">
          <template #icon>
            <ClockCircleOutlined />
          </template>
          <span>最近使用</span>
        </a-menu-item>
        
        <a-menu-item key="favorites" class="menu-item-favorites">
          <template #icon>
            <StarOutlined />
          </template>
          <span>我的收藏</span>
        </a-menu-item>
        
        <a-menu-item key="tools" class="menu-item-tools">
          <template #icon>
            <ToolOutlined />
          </template>
          <span>工具管理</span>
        </a-menu-item>
        
        <a-menu-divider />
        
        <a-sub-menu
          v-for="group in groups"
          :key="group.path"
          :title="group.name"
          class="group-submenu"
        >
          <template #icon>
            <FolderOutlined />
          </template>
          
          <template #title>
            <span class="group-title">
              {{ group.name }}
              <a-badge 
                :count="group.prompts.length" 
                :show-zero="false" 
                size="small"
                class="group-count"
              />
            </span>
          </template>
          
          <a-menu-item
            v-for="prompt in group.prompts"
            :key="prompt.name"
            class="prompt-item"
            @click="handlePromptClick(prompt)"
          >
            <div class="prompt-item-content">
              <FileTextOutlined class="prompt-icon" />
              <a-tooltip :title="prompt.name" placement="right">
                <span class="prompt-name">{{ prompt.name }}</span>
              </a-tooltip>
              <div class="prompt-actions">
                <a-dropdown 
                  trigger="['click']" 
                  placement="bottomRight"
                  @click.stop
                >
                  <a-button 
                    type="text" 
                    size="small"
                    class="prompt-more-btn"
                  >
                    <MoreOutlined />
                  </a-button>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item key="toggle" @click="handleTogglePrompt(prompt)">
                        <CheckCircleOutlined v-if="prompt.enabled" />
                        <StopOutlined v-else />
                        {{ prompt.enabled ? '停用' : '启用' }}
                      </a-menu-item>
                      <a-menu-item key="edit" @click="handleEditPrompt(prompt)">
                        <EditOutlined />
                        编辑
                      </a-menu-item>
                      <a-menu-item key="duplicate" @click="handleDuplicatePrompt(prompt)">
                        <CopyOutlined />
                        复制
                      </a-menu-item>
                      <a-menu-item key="delete" @click="handleDeletePrompt(prompt)" class="danger-item">
                        <DeleteOutlined />
                        删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>
            </div>
          </a-menu-item>
        </a-sub-menu>
      </a-menu>
    </div>
    
    <!-- 折叠/展开按钮 -->
    <div class="sidebar-footer">
      <a-button 
        type="text" 
        class="collapse-btn"
        @click="toggleCollapse"
        :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
      >
        <MenuFoldOutlined v-if="!collapsed" />
        <MenuUnfoldOutlined v-else />
      </a-button>
    </div>
  </a-layout-sider>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  FolderOutlined,
  FileTextOutlined,
  SearchOutlined,
  MoreOutlined,
  ImportOutlined,
  ExportOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  StarOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ToolOutlined
} from '@ant-design/icons-vue';import { api } from '../services/api';

const emit = defineEmits(['new-prompt', 'select-prompt', 'edit-prompt', 'tools-manager']);

const collapsed = ref(false);
const searchValue = ref('');
const selectedKeys = ref(['all']);
const openKeys = ref([]);

const groups = ref([]);
const totalCount = ref(0);

const handleNewPrompt = () => {
  emit('new-prompt');
};

const handleNewFolder = () => {
  Modal.info({
    title: '新建目录',
    content: '新建目录功能开发中，敬请期待！',
    okText: '确定'
  });
};

const handleImport = () => {
  Modal.info({
    title: '导入提示词',
    content: '导入功能开发中，敬请期待！',
    okText: '确定'
  });
};

const handleExport = () => {
  Modal.info({
    title: '导出提示词',
    content: '导出功能开发中，敬请期待！',
    okText: '确定'
  });
};

const handleSearch = (value) => {
  emit('search', value);
  // TODO: 实现搜索功能
  console.log('搜索:', value);
};

const handleSearchChange = (e) => {
  if (!e.target.value) {
    loadGroups();
    emit('search', '');
  }
};

const handleOpenChange = (keys) => {
  openKeys.value = keys;
};

const handleMenuSelect = ({ key }) => {
  selectedKeys.value = [key];
  
  if (key === 'all') {
    emit('select-prompt', { type: 'all' });
  } else if (key === 'recent') {
    emit('select-prompt', { type: 'recent' });
  } else if (key === 'favorites') {
    emit('select-prompt', { type: 'favorites' });
  } else if (key === 'tools') {
    emit('tools-manager');
  }
};

const handlePromptClick = (prompt) => {
  emit('select-prompt', prompt);
};

const handleEditPrompt = (prompt) => {
  emit('edit-prompt', prompt);
};

const handleDuplicatePrompt = (prompt) => {
  Modal.info({
    title: '复制提示词',
    content: `确定要复制提示词 "${prompt.name}" 吗？`,
    okText: '确定',
    onOk() {
      // TODO: 实现复制功能
      message.success('复制功能开发中');
    }
  });
};

const handleDeletePrompt = (prompt) => {
  Modal.confirm({
    title: '删除提示词',
    content: `确定要删除提示词 "${prompt.name}" 吗？此操作不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      // TODO: 实现删除功能
      message.success('删除功能开发中');
    }
  });
};

const handleTogglePrompt = async (prompt) => {
  try {
    await api.togglePrompt(prompt.name, prompt.path);
    message.success({
      content: `提示词 "${prompt.name}" 已${prompt.enabled ? '启用' : '禁用'}`,
      duration: 2,
    });
  } catch (error) {
    message.error('状态更新失败');
    // 恢复原状态
    prompt.enabled = !prompt.enabled;
  }
};

const toggleCollapse = () => {
  collapsed.value = !collapsed.value;
};

const loadGroups = async () => {
  try {
    const prompts = await api.getPrompts();
    totalCount.value = prompts.length;
    
    // 将提示词按分组组织
    const groupMap = new Map();
    
    prompts.forEach(prompt => {
      const groupPath = prompt.group || 'default';
      if (!groupMap.has(groupPath)) {
        groupMap.set(groupPath, {
          path: groupPath,
          name: groupPath === 'default' ? '默认分组' : groupPath,
          prompts: []
        });
      }
      groupMap.get(groupPath).prompts.push(prompt);
    });
    
    groups.value = Array.from(groupMap.values()).sort((a, b) => {
      // 默认分组排在最前面
      if (a.name === '默认分组') return -1;
      if (b.name === '默认分组') return 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  } catch (error) {
    message.error('加载分组失败');
  }
};

onMounted(() => {
  loadGroups();
});
</script>

<style scoped>
.sidebar {
  background: #fff;
  border-right: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.new-prompt-btn {
  height: 40px;
  font-weight: 500;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
  transition: all 0.3s ease;
}

.new-prompt-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.search-container {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e6e6e6;
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.search-container:hover {
  border-color: #d9d9d9;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.search-container:focus-within {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
}

.sidebar-search {
  flex: 1;
}

.sidebar-search :deep(.ant-input-search) {
  background: transparent;
  border: none;
  box-shadow: none;
}

.sidebar-search :deep(.ant-input) {
  background: transparent;
  border: none;
  height: 32px;
  padding: 0 12px;
  font-size: 14px;
  color: #262626;
  transition: all 0.3s ease;
}

.sidebar-search :deep(.ant-input::placeholder) {
  color: #bfbfbf;
  font-weight: 400;
}

.sidebar-search :deep(.ant-input:focus) {
  background: transparent;
  border: none;
  box-shadow: none;
  outline: none;
}

.sidebar-search :deep(.ant-input-search .ant-input-group) {
  background: transparent;
}

.sidebar-search :deep(.ant-input-search .ant-input-group .ant-input-affix-wrapper) {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.sidebar-search :deep(.ant-input-search .ant-input-search-button) {
  display: none !important;
}

.sidebar-search :deep(.ant-input-search .ant-input-group-addon) {
  display: none !important;
}

.sidebar-search :deep(.ant-input-search-button) {
  display: none !important;
}

.sidebar-search :deep(.ant-input-group-addon) {
  display: none !important;
}

.sidebar-search :deep(.ant-input-suffix) {
  display: none !important;
}

.sidebar-search :deep(.ant-input-prefix) {
  display: none !important;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  color: #8c8c8c;
  background: transparent;
  transition: all 0.2s ease;
  cursor: pointer;
}

.action-btn:hover {
  color: #595959;
  background: #f5f5f5;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  color: #595959;
  transition: all 0.3s ease;
}

.action-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
  background-color: #f8f9ff;
}

.collapsed-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.collapsed-new-btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
}

.collapsed-action-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  color: #595959;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.sidebar-menu {
  border: none;
  background: transparent;
}

.menu-item-all,
.menu-item-recent,
.menu-item-favorites,
.menu-item-tools {
  margin: 4px 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
}

.menu-item-all:hover,
.menu-item-recent:hover,
.menu-item-favorites:hover,
.menu-item-tools:hover,
:deep(.ant-menu-item:hover) {
  background-color: #f8f9ff !important;
}

:deep(.ant-menu-item-selected) {
  background-color: #e6f7ff !important;
  color: #1890ff !important;
}

:deep(.ant-menu-item-selected .anticon) {
  color: #1890ff !important;
}

.prompt-count {
  margin-left: auto;
}

.group-submenu {
  margin: 4px 12px;
  border-radius: 8px;
}

:deep(.ant-menu-submenu > .ant-menu-submenu-title) {
  height: 40px;
  border-radius: 8px;
  margin: 0;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.ant-menu-submenu .ant-menu-item) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-title {
  display: flex;
  align-items: center;
  flex: 1;
}

.group-count {
  margin-left: 8px;
}

.prompt-item {
  margin: 2px 12px;
  border-radius: 6px;
  height: 36px;
  padding: 0 !important;
  min-width: 0;
}

.prompt-item-content {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 8px 0 16px;
  gap: 8px;
}

.prompt-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: #1890ff;
}

.prompt-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.prompt-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.prompt-more-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.3s ease;
}

.prompt-item:hover .prompt-more-btn {
  opacity: 1;
}

:deep(.ant-switch) {
  margin-left: 4px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  display: flex;
  justify-content: center;
}

.collapse-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e8e8e8;
  color: #595959;
  transition: all 0.3s ease;
}

.collapse-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
  background-color: #f8f9ff;
}

/* 自定义滚动条 */
.group-list::-webkit-scrollbar {
  width: 4px;
}

.group-list::-webkit-scrollbar-track {
  background: transparent;
}

.group-list::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 2px;
}

.group-list::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* 折叠状态样式 */
.sidebar:deep(.ant-layout-sider-collapsed) {
  .sidebar-header {
    padding: 12px 8px;
  }
  
  .group-list {
    padding: 8px 0;
  }
  
  .menu-item-all,
  .menu-item-recent,
  .menu-item-favorites,
  .menu-item-tools {
    margin: 4px 8px;
    padding-left: 24px !important;
  }
  
  .group-submenu {
    margin: 4px 8px;
  }
  
  .prompt-item {
    margin: 2px 8px;
    padding-left: 24px !important;
  }
  
  .prompt-actions {
    display: none;
  }
}

/* 下拉菜单样式 */
:deep(.ant-dropdown-menu) {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #f0f0f0;
  overflow: hidden;
}

:deep(.ant-dropdown-menu-item) {
  padding: 8px 16px;
  transition: all 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.ant-dropdown-menu-item:hover) {
  background-color: #f8f9ff;
}

:deep(.ant-dropdown-menu-item.danger-item) {
  color: #ff4d4f;
}

:deep(.ant-dropdown-menu-item.danger-item:hover) {
  background-color: #fff2f0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 64px;
    height: calc(100vh - 64px);
    z-index: 999;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar.mobile-open {
    transform: translateX(0);
  }
  
  .sidebar:deep(.ant-layout-sider-collapsed) {
    transform: translateX(-100%);
  }
  
  .sidebar:deep(.ant-layout-sider-collapsed).mobile-open {
    transform: translateX(0);
  }
}
</style>