<template>
  <a-config-provider :theme="themeConfig">
    <div id="app">
      <LoginForm v-if="!isAuthenticated" @login="handleLogin" />
      <MainLayout v-else @logout="handleLogout" />
    </div>
  </a-config-provider>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import LoginForm from './components/LoginForm.vue';
import MainLayout from './components/MainLayout.vue';
import { api } from './services/api';

const isAuthenticated = ref(false);
const themeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',
    borderRadius: 6,
    wireframe: false,
  },
  algorithm: undefined,
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#ffffff',
      bodyBg: '#f5f5f5',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#e6f7ff',
      itemHoverBg: '#f5f5f5',
    },
    Button: {
      borderRadius: 4,
    },
    Input: {
      borderRadius: 4,
    },
    Card: {
      borderRadius: 6,
    },
  },
};

const handleLogin = () => {
  isAuthenticated.value = true;
};

const handleLogout = () => {
  isAuthenticated.value = false;
  localStorage.removeItem('prompt-admin-token');
};

onMounted(async () => {
  // 检查是否需要认证
  try {
    await api.checkAuthRequirement();
    const token = localStorage.getItem('prompt-admin-token');
    if (token) {
      isAuthenticated.value = true;
    }
  } catch (error) {
    console.error('检查认证要求失败:', error);
  }
});
</script>

<style>
#app {
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif, 'Apple Color Emoji',
    'Segoe UI Emoji', 'Segoe UI Symbol';
}

/* 全局样式重置 */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>