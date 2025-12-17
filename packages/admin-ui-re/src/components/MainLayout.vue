<template>
  <a-layout style="height: 100vh;">
    <!-- 顶部导航 -->
    <Header 
      @logout="handleLogout"
      @search="handleSearch"
      @notifications="handleNotifications"
      @settings="handleSettings"
      @profile="handleProfile"
      @preferences="handlePreferences"
      @help="handleHelp"
      @about="handleAbout"
    />
    
    <!-- 主体内容 -->
    <a-layout>
      <!-- 左侧边栏 -->
      <Sidebar 
        @new-prompt="handleNewPrompt"
        @select-prompt="handleSelectPrompt"
        @edit-prompt="handleEditPrompt"
        @search="handleSearch"
      />
      
      <!-- 右侧内容区域 -->
      <a-layout-content class="editor-container">
        <CustomBlankContent 
          v-if="!currentPrompt" 
          @new-prompt="handleNewPrompt"
          @select-prompt="handleSelectPrompt"
        />
        <PromptEditor 
          v-else 
          :prompt="currentPrompt" 
          @back="handleBackToList" 
        />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref } from 'vue';
import { message } from 'ant-design-vue';
import Header from './Header.vue';
import Sidebar from './Sidebar.vue';
import CustomBlankContent from './CustomBlankContent.vue';
import PromptEditor from './PromptEditor.vue';

const emit = defineEmits(['logout']);

const currentPrompt = ref(null);

const handleLogout = () => {
  emit('logout');
};

const handleNewPrompt = () => {
  currentPrompt.value = {
    name: '',
    description: '',
    content: '',
    arguments: [],
    group: 'default'
  };
};

const handleSelectPrompt = (prompt) => {
  if (prompt.type === 'all') {
    message.info('显示全部提示词');
  } else if (prompt.type === 'recent') {
    message.info('显示最近使用的提示词');
  } else if (prompt.type === 'favorites') {
    message.info('显示收藏的提示词');
  } else {
    currentPrompt.value = prompt;
  }
};

const handleEditPrompt = (prompt) => {
  currentPrompt.value = { ...prompt };
};

const handleBackToList = () => {
  currentPrompt.value = null;
};

const handleSearch = (value) => {
  console.log('搜索:', value);
  // TODO: 实现搜索功能
};

const handleNotifications = () => {
  message.info('通知中心开发中...');
};

const handleSettings = () => {
  message.info('设置页面开发中...');
};

const handleProfile = () => {
  message.info('个人资料页面开发中...');
};

const handlePreferences = () => {
  message.info('偏好设置页面开发中...');
};

const handleHelp = () => {
  message.info('帮助中心开发中...');
};

const handleAbout = () => {
  message.info('关于页面开发中...');
};
</script>

<style scoped>
.editor-container {
  background: #fff;
  overflow: hidden;
}
</style>