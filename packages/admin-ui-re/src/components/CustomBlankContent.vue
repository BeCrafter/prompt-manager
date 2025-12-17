<template>
  <div class="custom-blank-content">
    <div class="blank-placeholder">
      <div class="blank-placeholder-body">
        <div class="blank-placeholder-emoji">📝</div>
        <p class="blank-placeholder-text">
          请选择左侧的 Prompt 或点击「
          <a-button type="link" @click="handleNewPrompt">
            新建 Prompt
          </a-button>
          」开始编辑
        </p>
      </div>
    </div>
    
    <!-- 推荐词卡片列表 -->
    <div class="recommended-prompts-section" v-if="recommendedPrompts.length">
      <div class="recommended-prompts-header">
        <h3>推荐提示词</h3>
        <div class="recommended-prompts-nav">
          <a-button 
            type="text" 
            :disabled="currentIndex === 0"
            @click="handlePrev"
          >
            <LeftOutlined />
          </a-button>
          <a-button 
            type="text" 
            :disabled="currentIndex >= recommendedPrompts.length - 1"
            @click="handleNext"
          >
            <RightOutlined />
          </a-button>
        </div>
      </div>
      
      <div class="recommended-prompts-container">
        <div class="recommended-prompts-list">
          <a-row :gutter="16">
            <a-col 
              v-for="prompt in visiblePrompts" 
              :key="prompt.id"
              :xs="24" 
              :sm="12" 
              :md="8" 
              :lg="6"
            >
              <a-card 
                class="prompt-card"
                :hoverable="true"
                @click="handlePromptClick(prompt)"
              >
                <template #cover>
                  <div class="prompt-card-cover">
                    <StarOutlined />
                  </div>
                </template>
                
                <a-card-meta
                  :title="prompt.name"
                  :description="prompt.description"
                />
                
                <template #actions>
                  <a-button 
                    type="primary" 
                    size="small"
                    @click.stop="handleSyncPrompt(prompt)"
                  >
                    同步
                  </a-button>
                </template>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { 
  LeftOutlined, 
  RightOutlined, 
  StarOutlined 
} from '@ant-design/icons-vue';
import { api } from '../services/api';

const emit = defineEmits(['new-prompt', 'select-prompt']);

const recommendedPrompts = ref([]);
const currentIndex = ref(0);

const visiblePrompts = computed(() => {
  const start = currentIndex.value;
  const end = start + 4; // 每页显示4个
  return recommendedPrompts.value.slice(start, end);
});

const handleNewPrompt = () => {
  emit('new-prompt');
};

const handlePrev = () => {
  if (currentIndex.value > 0) {
    currentIndex.value -= 4;
  }
};

const handleNext = () => {
  const nextIndex = currentIndex.value + 4;
  if (nextIndex < recommendedPrompts.value.length) {
    currentIndex.value = nextIndex;
  }
};

const handlePromptClick = (prompt) => {
  emit('select-prompt', prompt);
};

const handleSyncPrompt = async (prompt) => {
  try {
    // TODO: 实现同步提示词功能
    message.success('同步功能开发中');
  } catch (error) {
    message.error('同步失败');
  }
};

const loadRecommendedPrompts = async () => {
  try {
    // TODO: 从API加载推荐提示词
    // 模拟数据
    recommendedPrompts.value = [
      {
        id: 1,
        name: '代码审查助手',
        description: '帮助进行代码审查的专业提示词',
        content: '请审查以下代码...'
      },
      {
        id: 2,
        name: '文档生成器',
        description: '自动生成技术文档的提示词',
        content: '请为以下代码生成文档...'
      },
      {
        id: 3,
        name: 'Bug修复助手',
        description: '帮助定位和修复代码问题的提示词',
        content: '请分析以下错误...'
      },
      {
        id: 4,
        name: '代码重构助手',
        description: '提供代码重构建议的提示词',
        content: '请重构以下代码...'
      }
    ];
  } catch (error) {
    message.error('加载推荐提示词失败');
  }
};

onMounted(() => {
  loadRecommendedPrompts();
});
</script>

<style scoped>
.custom-blank-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
}

.blank-placeholder {
  text-align: center;
  margin-bottom: 60px;
}

.blank-placeholder-emoji {
  font-size: 64px;
  margin-bottom: 16px;
}

.blank-placeholder-text {
  font-size: 16px;
  color: #666;
  margin: 0;
}

.recommended-prompts-section {
  width: 100%;
  max-width: 1200px;
}

.recommended-prompts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.recommended-prompts-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.recommended-prompts-nav {
  display: flex;
  gap: 8px;
}

.prompt-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.prompt-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.prompt-card-cover {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 32px;
}

:deep(.ant-card-meta-title) {
  font-size: 14px;
  font-weight: 600;
}

:deep(.ant-card-meta-description) {
  font-size: 12px;
  color: #666;
  height: 40px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>