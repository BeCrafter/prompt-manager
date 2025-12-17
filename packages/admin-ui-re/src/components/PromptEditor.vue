<template>
  <div class="prompt-editor-area">
    <!-- 顶部工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <a-button 
          type="text" 
          @click="handleBack"
          class="back-btn"
          title="返回列表"
        >
          <ArrowLeftOutlined />
        </a-button>
        
        <div class="prompt-info">
          <a-input
            v-model:value="promptData.name"
            placeholder="输入 Prompt 名称..."
            class="prompt-name-input"
            size="large"
          />
          <a-tag v-if="promptData.name" color="blue" class="prompt-tag">
            {{ promptData.group === 'default' ? '默认分组' : promptData.group }}
          </a-tag>
        </div>
      </div>
      
      <div class="toolbar-center">
        <div class="group-selector">
          <a-select
            v-model:value="promptData.group"
            placeholder="选择分组"
            class="group-select"
            size="large"
          >
            <a-select-option value="default">默认分组</a-select-option>
            <a-select-option 
              v-for="group in groups" 
              :key="group.path" 
              :value="group.path"
            >
              <FolderOutlined />
              {{ group.name }}
            </a-select-option>
          </a-select>
        </div>
      </div>
      
      <div class="toolbar-right">
        <a-space>
          <a-button 
            type="primary" 
            @click="handleSave"
            :loading="saving"
            size="large"
            class="save-btn"
          >
            <template #icon>
              <SaveOutlined />
            </template>
            保存
          </a-button>
        </a-space>
      </div>
    </div>

    <!-- 描述区域 -->
    <div class="description-section">
      <a-textarea
        v-model:value="promptData.description"
        placeholder="添加 Prompt 描述，帮助理解其用途和功能..."
        :rows="2"
        class="prompt-description"
        show-count
        :maxlength="200"
      />
    </div>

    <!-- 主要内容区域 -->
    <div class="editor-content">
      <!-- 左侧参数配置 -->
      <div class="editor-sidebar">
        <ArgumentsSection 
          :arguments="promptData.arguments"
          @change="handleArgumentsChange"
        />
      </div>
      
      <!-- 右侧编辑器区域 -->
      <div class="editor-main">
        <div class="editor-tabs">
          <a-tabs v-model:activeKey="mode" type="card" size="large">
            <a-tab-pane key="edit">
              <template #tab>
                <span class="tab-title">
                  <EditOutlined />
                  编辑器
                </span>
              </template>
              <div class="editor-workspace">
                <div class="workspace-toolbar">
                  <a-space>
                    <a-select
                      v-model:value="editorTheme"
                      placeholder="主题"
                      class="theme-select"
                      size="small"
                    >
                      <a-select-option value="xq-light">浅色</a-select-option>
                      <a-select-option value="xq-dark">深色</a-select-option>
                      <a-select-option value="monokai">Monokai</a-select-option>
                    </a-select>
                    
                    <a-select
                      v-model:value="editorMode"
                      placeholder="语言"
                      class="mode-select"
                      size="small"
                    >
                      <a-select-option value="markdown">Markdown</a-select-option>
                      <a-select-option value="javascript">JavaScript</a-select-option>
                      <a-select-option value="python">Python</a-select-option>
                      <a-select-option value="yaml">YAML</a-select-option>
                    </a-select>
                    
                    <a-button 
                      type="text" 
                      size="small"
                      @click="toggleFullscreen"
                      title="全屏"
                    >
                      <FullscreenOutlined />
                    </a-button>
                    
                    <a-button 
                      type="text" 
                      size="small"
                      @click="formatCode"
                      title="格式化"
                    >
                      <AlignLeftOutlined />
                    </a-button>
                  </a-space>
                  
                  <div class="editor-stats">
                    <span class="stat-item">行数: {{ lineCount }}</span>
                    <span class="stat-item">字数: {{ wordCount }}</span>
                  </div>
                </div>
                
                <div class="editor-container">
                  <div ref="editorContainer" class="codemirror-container"></div>
                </div>
              </div>
            </a-tab-pane>
            
            <a-tab-pane key="preview">
              <template #tab>
                <span class="tab-title">
                  <EyeOutlined />
                  实时预览
                </span>
              </template>
              <div class="preview-workspace">
                <div class="preview-toolbar">
                  <a-space>
                    <a-button 
                      type="text" 
                      size="small"
                      @click="refreshPreview"
                      title="刷新预览"
                    >
                      <ReloadOutlined />
                    </a-button>
                    
                    <a-button 
                      type="text" 
                      size="small"
                      @click="togglePreviewMode"
                      title="切换预览模式"
                    >
                      <DesktopOutlined v-if="previewMode === 'desktop'" />
                      <MobileOutlined v-else />
                    </a-button>
                  </a-space>
                </div>
                
                <div class="preview-container" :class="previewMode">
                  <div class="preview-content" v-html="previewContent"></div>
                </div>
              </div>
            </a-tab-pane>
            
            <a-tab-pane key="variables">
              <template #tab>
                <span class="tab-title">
                  <CodeOutlined />
                  变量测试
                </span>
              </template>
              <div class="variables-workspace">
                <div class="variables-form">
                  <a-form layout="vertical">
                    <a-form-item 
                      v-for="arg in promptData.arguments" 
                      :key="arg.name"
                      :label="arg.description || arg.name"
                      :required="arg.required"
                    >
                      <a-input
                        v-if="arg.type === 'string'"
                        v-model:value="testValues[arg.name]"
                        :placeholder="`输入 ${arg.name}`"
                      />
                      <a-input-number
                        v-else-if="arg.type === 'number'"
                        v-model:value="testValues[arg.name]"
                        :placeholder="`输入 ${arg.name}`"
                        style="width: 100%"
                      />
                      <a-switch
                        v-else-if="arg.type === 'boolean'"
                        v-model:checked="testValues[arg.name]"
                      />
                    </a-form-item>
                  </a-form>
                  
                  <div class="test-result">
                    <h4>测试结果：</h4>
                    <div class="result-content">{{ processedContent }}</div>
                  </div>
                </div>
              </div>
            </a-tab-pane>
          </a-tabs>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, nextTick, computed } from 'vue';
import { message } from 'ant-design-vue';
import { 
  ArrowLeftOutlined,
  CopyOutlined,
  ExportOutlined,
  SettingOutlined,
  SaveOutlined,
  EditOutlined,
  EyeOutlined,
  CodeOutlined,
  FullscreenOutlined,
  AlignLeftOutlined,
  ReloadOutlined,
  DesktopOutlined,
  MobileOutlined,
  FolderOutlined
} from '@ant-design/icons-vue';
import { api } from '../services/api';
import ArgumentsSection from './ArgumentsSection.vue';
import { initCodeMirror } from '../utils/codemirror';

const props = defineProps({
  prompt: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['back']);

const mode = ref('edit');
const saving = ref(false);
const editorContainer = ref(null);
const editorInstance = ref(null);
const editorTheme = ref('xq-light');
const editorMode = ref('markdown');
const previewMode = ref('desktop');

const promptData = reactive({
  name: '',
  description: '',
  content: '',
  arguments: [],
  group: 'default'
});

const groups = ref([]);
const testValues = reactive({});

const lineCount = computed(() => {
  if (!promptData.content) return 0;
  return promptData.content.split('\n').length;
});

const wordCount = computed(() => {
  if (!promptData.content) return 0;
  return promptData.content.replace(/\s/g, '').length;
});

const previewContent = computed(() => {
  if (!promptData.content) return '<p class="empty-preview">请输入内容以预览效果</p>';
  
  // 简单的 Markdown 预览
  let html = promptData.content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  return html;
});

const processedContent = computed(() => {
  if (!promptData.content) return '请输入内容';
  
  let content = promptData.content;
  
  // 替换变量
  promptData.arguments.forEach(arg => {
    const value = testValues[arg.name] || (arg.default || '');
    const regex = new RegExp(`{{${arg.name}}}`, 'g');
    content = content.replace(regex, value);
  });
  
  return content;
});

const handleBack = () => {
  emit('back');
};

const handleCopy = () => {
  if (!promptData.content) {
    message.warning('没有内容可复制');
    return;
  }
  
  navigator.clipboard.writeText(promptData.content).then(() => {
    message.success('内容已复制到剪贴板');
  }).catch(() => {
    message.error('复制失败');
  });
};

const handleExport = () => {
  message.info('导出功能开发中...');
};

const handleSettings = () => {
  message.info('设置功能开发中...');
};

const handleArgumentsChange = (args) => {
  promptData.arguments = args;
  
  // 初始化测试值
  args.forEach(arg => {
    if (!(arg.name in testValues)) {
      testValues[arg.name] = arg.default || (arg.type === 'boolean' ? false : '');
    }
  });
};

const handleSave = async () => {
  if (!promptData.name.trim()) {
    message.error('请输入 Prompt 名称');
    return;
  }
  
  if (!promptData.content.trim()) {
    message.error('请输入 Prompt 内容');
    return;
  }
  
  saving.value = true;
  try {
    await api.savePrompt(promptData);
    message.success({
      content: '保存成功',
      duration: 2,
    });
  } catch (error) {
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const loadGroups = async () => {
  try {
    const groupList = await api.getGroups();
    groups.value = groupList;
  } catch (error) {
    message.error('加载分组失败');
  }
};

const initEditor = async () => {
  if (!editorContainer.value) return;
  
  await nextTick();
  editorInstance.value = initCodeMirror(editorContainer.value, {
    value: promptData.content,
    mode: editorMode.value,
    lineNumbers: true,
    lineWrapping: true,
    theme: editorTheme.value,
    autofocus: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false
  });
  
  editorInstance.value.on('change', () => {
    promptData.content = editorInstance.value.getValue();
  });
  
  editorInstance.value.on('cursorActivity', () => {
    // 更新行列信息
    const cursor = editorInstance.value.getCursor();
    // 可以在这里显示行列信息
  });
};

const toggleFullscreen = () => {
  const editor = editorContainer.value;
  if (!document.fullscreenElement) {
    editor.requestFullscreen().catch(() => {
      message.error('无法进入全屏模式');
    });
  } else {
    document.exitFullscreen();
  }
};

const formatCode = () => {
  message.info('格式化功能开发中...');
};

const refreshPreview = () => {
  message.success('预览已刷新');
};

const togglePreviewMode = () => {
  previewMode.value = previewMode.value === 'desktop' ? 'mobile' : 'desktop';
};

// 监听编辑器主题变化
watch(editorTheme, (newTheme) => {
  if (editorInstance.value) {
    editorInstance.value.setOption('theme', newTheme);
  }
});

// 监听编辑器模式变化
watch(editorMode, (newMode) => {
  if (editorInstance.value) {
    editorInstance.value.setOption('mode', newMode);
  }
});

// 监听 props.prompt 变化
watch(() => props.prompt, (newPrompt) => {
  if (newPrompt) {
    Object.assign(promptData, {
      name: newPrompt.name || '',
      description: newPrompt.description || '',
      content: newPrompt.content || '',
      arguments: newPrompt.arguments || [],
      group: newPrompt.group || 'default'
    });
    
    if (editorInstance.value) {
      editorInstance.value.setValue(promptData.content);
    }
    
    // 初始化测试值
    handleArgumentsChange(newPrompt.arguments || []);
  }
}, { immediate: true, deep: true });

onMounted(() => {
  loadGroups();
  initEditor();
});
</script>

<style scoped>
.prompt-editor-area {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.back-btn {
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

.back-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
  background-color: #f8f9ff;
}

.prompt-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  max-width: 500px;
}

.prompt-name-input {
  flex: 1;
}

.prompt-name-input :deep(.ant-input) {
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  font-size: 16px;
  font-weight: 500;
}

.prompt-name-input :deep(.ant-input:focus) {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.prompt-tag {
  border-radius: 12px;
  font-size: 12px;
  padding: 2px 8px;
}

.toolbar-center {
  flex: 0 0 auto;
}

.group-select {
  min-width: 200px;
}

.group-select :deep(.ant-select-selector) {
  border-radius: 8px;
  border: 1px solid #e8e8e8;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.toolbar-btn {
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

.toolbar-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
  background-color: #f8f9ff;
}

.save-btn {
  border-radius: 8px;
  height: 40px;
  margin-left: 16px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
  transition: all 0.3s ease;
}

.save-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

.description-section {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.prompt-description {
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  resize: none;
}

.prompt-description :deep(.ant-input) {
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  font-size: 14px;
}

.prompt-description :deep(.ant-input:focus) {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  gap: 16px;
  padding: 16px;
}

.editor-sidebar {
  width: 350px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.editor-main {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

:deep(.ant-tabs-nav) {
  margin-bottom: 0;
  padding: 0 24px;
  background: #fafafa;
}

:deep(.ant-tabs-tab) {
  border-radius: 8px 8px 0 0;
  margin-right: 4px;
}

:deep(.ant-tabs-tab-active) {
  background: #fff;
}

:deep(.ant-tabs-content-holder) {
  flex: 1;
  background: #fff;
}

:deep(.ant-tabs-tabpane) {
  height: 100%;
  padding: 0;
}

.editor-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.theme-select,
.mode-select {
  width: 120px;
}

.editor-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #8c8c8c;
}

.stat-item {
  display: flex;
  align-items: center;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.codemirror-container {
  height: 100%;
}

.codemirror-container :deep(.CodeMirror) {
  height: 100%;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
}

.codemirror-container :deep(.CodeMirror-gutters) {
  background: #fafafa;
  border-right: 1px solid #f0f0f0;
}

.codemirror-container :deep(.CodeMirror-linenumber) {
  color: #8c8c8c;
  font-size: 12px;
}

.preview-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-toolbar {
  padding: 12px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.preview-container {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.preview-container.desktop {
  max-width: 100%;
}

.preview-container.mobile {
  max-width: 375px;
  margin: 0 auto;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  background: #fff;
}

.preview-content {
  line-height: 1.8;
  color: #262626;
  font-size: 15px;
}

.preview-content :deep(h1),
.preview-content :deep(h2),
.preview-content :deep(h3) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
}

.preview-content :deep(h1) {
  font-size: 28px;
  color: #1890ff;
}

.preview-content :deep(h2) {
  font-size: 22px;
  color: #262626;
}

.preview-content :deep(h3) {
  font-size: 18px;
  color: #595959;
}

.preview-content :deep(p) {
  margin-bottom: 16px;
}

.preview-content :deep(code) {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: #e74c3c;
}

.preview-content :deep(pre) {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 16px;
}

.preview-content :deep(pre code) {
  background: none;
  padding: 0;
  color: #262626;
}

.empty-preview {
  text-align: center;
  color: #8c8c8c;
  font-style: italic;
  padding: 40px;
}

.variables-workspace {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
}

.variables-form {
  max-width: 600px;
  margin: 0 auto;
}

.test-result {
  margin-top: 32px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.test-result h4 {
  margin-bottom: 12px;
  color: #262626;
}

.result-content {
  background: #fff;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  white-space: pre-wrap;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  min-height: 100px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .editor-sidebar {
    width: 300px;
  }
}

@media (max-width: 768px) {
  .editor-toolbar {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  
  .toolbar-left,
  .toolbar-center,
  .toolbar-right {
    width: 100%;
  }
  
  .prompt-info {
    max-width: none;
  }
  
  .editor-content {
    flex-direction: column;
    gap: 16px;
  }
  
  .editor-sidebar {
    width: 100%;
  }
}

/* 全屏模式 */
.prompt-editor-area:fullscreen {
  background: #fff;
}

.prompt-editor-area:fullscreen .editor-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
}

.prompt-editor-area:fullscreen .editor-content {
  margin-top: 80px;
}

/* 动画效果 */
.codemirror-container :deep(.CodeMirror-cursor) {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>