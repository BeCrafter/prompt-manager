<template>
  <div 
    class="tool-card" 
    @click="handleCardClick"
    :class="{ 'tool-card-compact': compact }"
  >
    <!-- 工具头部 -->
    <div class="tool-header">
      <div class="tool-icon">
        <ToolOutlined />
      </div>
      <div class="tool-title">
        <h3 class="tool-name">{{ tool.name }}</h3>
        <a-tag size="small" color="blue" class="tool-version">
          {{ tool.version }}
        </a-tag>
      </div>
    </div>

    <!-- 工具描述 -->
    <div class="tool-description">
      {{ tool.description }}
    </div>

    <!-- 工具元信息 -->
    <div class="tool-meta">
      <!-- 分类 -->
      <div class="meta-item">
        <AppstoreOutlined class="meta-icon" />
        <span class="meta-label">{{ getCategoryLabel(tool.category) }}</span>
      </div>

      <!-- 作者 -->
      <div class="meta-item">
        <UserOutlined class="meta-icon" />
        <span class="meta-label">{{ tool.author }}</span>
      </div>
    </div>

    <!-- 标签 -->
    <div class="tool-tags" v-if="tool.tags && tool.tags.length">
      <a-tag
        v-for="tag in tool.tags.slice(0, maxTags)"
        :key="tag"
        size="small"
        color="green"
        class="tool-tag"
      >
        {{ tag }}
      </a-tag>
      <span v-if="tool.tags.length > maxTags" class="more-tags">
        +{{ tool.tags.length - maxTags }}
      </span>
    </div>

    <!-- 场景和限制 -->
    <div class="tool-extra" v-if="showExtra">
      <!-- 场景 -->
      <div class="extra-section" v-if="tool.scenarios && tool.scenarios.length">
        <div class="extra-title">
          <BulbOutlined class="extra-icon" />
          <span>适用场景</span>
        </div>
        <ul class="extra-list">
          <li v-for="scenario in tool.scenarios.slice(0, 3)" :key="scenario">
            {{ scenario }}
          </li>
        </ul>
      </div>

      <!-- 限制 -->
      <div class="extra-section" v-if="tool.limitations && tool.limitations.length">
        <div class="extra-title">
          <ExclamationCircleOutlined class="extra-icon" />
          <span>使用限制</span>
        </div>
        <ul class="extra-list">
          <li v-for="limitation in tool.limitations.slice(0, 2)" :key="limitation">
            {{ limitation }}
          </li>
        </ul>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="tool-actions">
      <a-button 
        type="text" 
        size="small"
        @click.stop="handleViewDocumentation"
        :disabled="!hasDocumentation"
      >
        <FileTextOutlined />
        {{ hasDocumentation ? '查看文档' : '暂无文档' }}
      </a-button>
      
      <a-button 
        type="text" 
        size="small"
        @click.stop="handleViewDetails"
      >
        <InfoCircleOutlined />
        详情
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  ToolOutlined,
  AppstoreOutlined,
  UserOutlined,
  BulbOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue';

const props = defineProps({
  tool: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  maxTags: {
    type: Number,
    default: 3
  },
  showExtra: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['click', 'view-doc', 'view-details']);

const hasDocumentation = computed(() => {
  return props.tool.hasDocumentation !== false;
});

const getCategoryLabel = (category) => {
  const labels = {
    'utility': '实用工具',
    'development': '开发工具',
    'automation': '自动化',
    'analysis': '分析工具',
    'productivity': '生产力',
    'debugging': '调试工具',
    'monitoring': '监控工具'
  };
  return labels[category] || category;
};

const handleCardClick = () => {
  emit('click', props.tool);
};

const handleViewDocumentation = () => {
  if (hasDocumentation.value) {
    emit('view-doc', props.tool);
  }
};

const handleViewDetails = () => {
  emit('view-details', props.tool);
};
</script>

<style scoped>
.tool-card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tool-card:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
  transform: translateY(-2px);
}

.tool-card-compact {
  padding: 16px;
}

.tool-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.tool-icon {
  font-size: 24px;
  color: #1890ff;
  flex-shrink: 0;
  margin-top: 2px;
}

.tool-title {
  flex: 1;
  min-width: 0;
}

.tool-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  line-height: 1.4;
}

.tool-version {
  font-size: 12px;
}

.tool-description {
  color: #595959;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 16px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tool-card-compact .tool-description {
  -webkit-line-clamp: 2;
  margin-bottom: 12px;
}

.tool-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #8c8c8c;
}

.meta-icon {
  font-size: 12px;
}

.meta-label {
  font-weight: 500;
}

.tool-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 16px;
  align-items: center;
}

.tool-tag {
  font-size: 11px;
}

.more-tags {
  font-size: 11px;
  color: #8c8c8c;
  margin-left: 4px;
}

.tool-extra {
  margin-bottom: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.extra-section {
  margin-bottom: 12px;
}

.extra-section:last-child {
  margin-bottom: 0;
}

.extra-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #262626;
  margin-bottom: 6px;
}

.extra-icon {
  font-size: 14px;
  color: #faad14;
}

.extra-list {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: #595959;
  line-height: 1.4;
}

.extra-list li {
  margin-bottom: 2px;
}

.tool-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.tool-actions .ant-btn {
  font-size: 12px;
  height: 28px;
  padding: 0 8px;
  color: #8c8c8c;
  border-color: #f0f0f0;
}

.tool-actions .ant-btn:hover:not(:disabled) {
  color: #1890ff;
  border-color: #1890ff;
}

.tool-actions .ant-btn:disabled {
  color: #bfbfbf;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tool-card {
    padding: 16px;
  }
  
  .tool-name {
    font-size: 15px;
  }
  
  .tool-description {
    font-size: 13px;
  }
  
  .tool-meta {
    gap: 12px;
  }
  
  .tool-actions {
    flex-direction: column;
    gap: 4px;
  }
  
  .tool-actions .ant-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>