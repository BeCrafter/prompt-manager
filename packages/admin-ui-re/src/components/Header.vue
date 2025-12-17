<template>
  <a-layout-header class="header">
    <div class="header-left">
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
            <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
        </div>
        <span class="logo-text">Prompt Manager</span>
        <span class="beta">Beta</span>
      </div>
    </div>
    
    <div class="header-right">
      <a-space>
        <a-tooltip title="主题切换">
          <a-button 
            type="text" 
            class="header-btn"
            @click="toggleTheme"
          >
            <BulbOutlined />
          </a-button>
        </a-tooltip>
        
        <a-tooltip title="通知">
          <a-badge :count="notificationCount" :offset="[-5, 5]">
            <a-button 
              type="text" 
              class="header-btn"
              @click="handleNotifications"
            >
              <BellOutlined />
            </a-button>
          </a-badge>
        </a-tooltip>
        
        <a-tooltip title="设置">
          <a-button 
            type="text" 
            class="header-btn"
            @click="handleSettings"
          >
            <SettingOutlined />
          </a-button>
        </a-tooltip>
        
        <a-dropdown :trigger="['click']" placement="bottomRight">
          <a-button 
            type="text" 
            class="avatar-btn"
            :class="{ 'no-auth': !api.requireAuth }"
          >
            <a-avatar 
              :src="userAvatar" 
              :size="36"
              class="user-avatar"
            >
              <template #icon>
                <UserOutlined />
              </template>
            </a-avatar>
            <span v-if="api.requireAuth" class="user-name">管理员</span>
            <DownOutlined />
          </a-button>
          
          <template #overlay v-if="api.requireAuth">
            <a-menu class="user-menu">
              <a-menu-item-group>
                <div class="user-info">
                  <a-avatar 
                    :src="userAvatar" 
                    :size="48"
                    class="user-avatar-large"
                  >
                    <template #icon>
                      <UserOutlined />
                    </template>
                  </a-avatar>
                  <div class="user-details">
                    <div class="user-name">管理员</div>
                    <div class="user-role">系统管理员</div>
                    <div class="user-email">admin@prompt-manager.com</div>
                  </div>
                </div>
              </a-menu-item-group>
              
              <a-menu-divider />
              
              <a-menu-item key="profile" @click="handleProfile">
                <UserOutlined />
                个人资料
              </a-menu-item>
              
              <a-menu-item key="preferences" @click="handlePreferences">
                <SettingOutlined />
                偏好设置
              </a-menu-item>
              
              <a-menu-divider />
              
              <a-menu-item key="help" @click="handleHelp">
                <QuestionCircleOutlined />
                帮助中心
              </a-menu-item>
              
              <a-menu-item key="about" @click="handleAbout">
                <InfoCircleOutlined />
                关于
              </a-menu-item>
              
              <a-menu-divider />
              
              <a-menu-item key="logout" @click="handleLogout" class="logout-item">
                <LogoutOutlined />
                退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </a-space>
    </div>
  </a-layout-header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { 
  UserOutlined, 
  LogoutOutlined,
  SearchOutlined,
  BellOutlined,
  SettingOutlined,
  DownOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
  BulbOutlined
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { api } from '../services/api';

const emit = defineEmits(['logout', 'search', 'notifications', 'settings', 'profile', 'preferences', 'help', 'about']);

const searchValue = ref('');
const promptCount = ref(0);
const groupCount = ref(0);
const notificationCount = ref(3);
const isDarkTheme = ref(false);

const userAvatar = computed(() => {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
});

const handleSearch = (value) => {
  emit('search', value);
};

const handleSearchChange = (e) => {
  if (!e.target.value) {
    emit('search', '');
  }
};

const handleNotifications = () => {
  emit('notifications');
  notificationCount.value = 0;
};

const handleSettings = () => {
  emit('settings');
};

const handleProfile = () => {
  emit('profile');
};

const handlePreferences = () => {
  emit('preferences');
};

const handleHelp = () => {
  emit('help');
  message.info('帮助中心开发中...');
};

const handleAbout = () => {
  emit('about');
  message.info('Prompt Manager v1.0.0');
};

const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;
  message.info(`切换到${isDarkTheme.value ? '深色' : '浅色'}主题`);
  // TODO: 实现主题切换逻辑
};

const handleLogout = () => {
  emit('logout');
};

const loadStats = async () => {
  try {
    const prompts = await api.getPrompts();
    const groups = await api.getGroups();
    promptCount.value = prompts.length;
    groupCount.value = groups.length;
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
};

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 24px;
  height: 64px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 1000;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 32px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-icon svg {
  width: 18px;
  height: 18px;
}

.logo-text {
  font-size: 20px;
  font-weight: 600;
  color: #262626;
}

.beta {
  font-size: 11px;
  color: #52c41a;
  background: #f6ffed;
  padding: 0px 9px;
  border-radius: 4px;
  font-weight: 300;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  height: 21px;
  line-height: 23px;
}

.header-stats {
  display: flex;
  align-items: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #262626;
  line-height: 1;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  max-width: 400px;
  margin: 0 32px;
}

.header-search {
  width: 100%;
}

.header-search :deep(.ant-input) {
  border-radius: 20px;
  padding-left: 40px;
  height: 36px;
  border: 1px solid #e8e8e8;
  background: #f5f5f5;
  transition: all 0.3s ease;
}

.header-search :deep(.ant-input:hover) {
  border-color: #d9d9d9;
  background: #fafafa;
}

.header-search :deep(.ant-input:focus) {
  border-color: #1890ff;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.header-search :deep(.ant-input-prefix) {
  left: 12px;
  color: #8c8c8c;
}

.header-right {
  display: flex;
  align-items: center;
}

.header-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  color: #595959;
  transition: all 0.3s ease;
  position: relative;
}

.header-btn:hover {
  background-color: #f5f5f5;
  color: #1890ff;
}

.avatar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  height: auto;
  border: 1px solid #e8e8e8;
  background: #fafafa;
  transition: all 0.3s ease;
}

.avatar-btn:hover {
  background-color: #f5f5f5;
  border-color: #d9d9d9;
}

.avatar-btn.no-auth {
  cursor: default;
  background: transparent;
  border: none;
}

.avatar-btn.no-auth:hover {
  background: transparent;
}

.user-avatar {
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.user-menu {
  width: 280px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #f0f0f0;
  overflow: hidden;
}

.user-info {
  display: flex;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%);
  border-bottom: 1px solid #f0f0f0;
}

.user-avatar-large {
  border: 3px solid #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.user-details {
  flex: 1;
  margin-left: 16px;
}

.user-details .user-name {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 4px;
}

.user-role {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 2px;
}

.user-email {
  font-size: 11px;
  color: #bfbfbf;
}

:deep(.ant-dropdown-menu-item-group-title) {
  padding: 0;
}

:deep(.ant-dropdown-menu-item-group) {
  padding: 0;
}

:deep(.ant-dropdown-menu-item) {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.3s ease;
}

:deep(.ant-dropdown-menu-item:hover) {
  background-color: #f8f9ff;
}

:deep(.ant-dropdown-menu-item.logout-item) {
  color: #ff4d4f;
}

:deep(.ant-dropdown-menu-item.logout-item:hover) {
  background-color: #fff2f0;
}

:deep(.ant-divider) {
  margin: 4px 0;
  background-color: #f0f0f0;
}

:deep(.ant-badge-count) {
  background: #ff4d4f;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(255, 77, 79, 0.3);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .header-stats {
    display: none;
  }
  
  .header-center {
    margin: 0 24px;
  }
}

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }
  
  .header-left {
    gap: 16px;
  }
  
  .logo-text {
    display: none;
  }
  
  .header-center {
    margin: 0 16px;
  }
  
  .header-right .ant-space {
    gap: 8px;
  }
  
  .user-name {
    display: none;
  }
  
  .avatar-btn {
    padding: 8px;
  }
}

@media (max-width: 480px) {
  .header {
    padding: 0 12px;
  }
  
  .header-center {
    position: absolute;
    left: 60px;
    right: 60px;
    max-width: none;
    margin: 0;
  }
  
  .header-search :deep(.ant-input) {
    height: 32px;
    font-size: 14px;
  }
  
  .beta {
    display: none;
  }
}
</style>