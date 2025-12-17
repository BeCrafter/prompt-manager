<template>
  <section class="arguments-section">
    <div class="arguments-header">
      <div class="arguments-title">
        <h3>
          <CodeOutlined />
          参数配置
        </h3>
        <span class="arguments-subtitle">配置提示词中的变量参数</span>
      </div>
      <div class="arguments-actions">
        <a-space>
          <a-button 
            type="text" 
            size="small"
            @click="handleImportArguments"
            title="导入参数"
          >
            <ImportOutlined />
          </a-button>
          <a-button 
            type="text" 
            size="small"
            @click="handleExportArguments"
            title="导出参数"
          >
            <ExportOutlined />
          </a-button>
          <a-divider type="vertical" />
          <a-button 
            type="primary" 
            @click="handleAddArgument"
            size="small"
          >
            <template #icon>
              <PlusOutlined />
            </template>
            新增参数
          </a-button>
        </a-space>
      </div>
    </div>
    
    <div class="arguments-content">
      <div v-if="!arguments.length" class="arguments-empty">
        <div class="empty-icon">
          <CodeOutlined />
        </div>
        <div class="empty-text">
          <h4>暂无参数</h4>
          <p>点击"新增参数"开始配置变量</p>
        </div>
        <a-button 
          type="primary" 
          @click="handleAddArgument"
          size="large"
        >
          <template #icon>
            <PlusOutlined />
          </template>
          新增参数
        </a-button>
      </div>
      
      <div v-else class="arguments-list">
        <div class="list-header">
          <div class="list-stats">
            <span class="stat-item">共 {{ arguments.length }} 个参数</span>
            <span class="stat-item">{{ unusedArguments.length }} 个未使用</span>
          </div>
          <div class="list-actions">
            <a-input-search
              v-model:value="searchValue"
              placeholder="搜索参数..."
              style="width: 200px"
              size="small"
              allow-clear
            />
          </div>
        </div>
        
        <div class="arguments-grid">
          <a-card
            v-for="(argument, index) in filteredArguments"
            :key="index"
            size="small"
            class="argument-card"
            :class="{ 
              'argument-card-unused': isArgumentUnused(argument.name),
              'argument-card-required': argument.required 
            }"
          >
            <template #title>
              <div class="argument-card-title">
                <div class="argument-name">
                  <CodeOutlined />
                  {{ argument.name || `参数 ${index + 1}` }}
                </div>
                <a-space size="small">
                  <a-tag 
                    v-if="argument.type" 
                    :color="getTypeColor(argument.type)"
                    class="argument-type-tag"
                  >
                    {{ getTypeLabel(argument.type) }}
                  </a-tag>
                  <a-tag 
                    v-if="argument.required" 
                    color="red"
                    class="argument-required-tag"
                  >
                    必填
                  </a-tag>
                  <a-tag 
                    v-if="argument.default" 
                    color="green"
                    class="argument-default-tag"
                  >
                    默认值
                  </a-tag>
                </a-space>
              </div>
            </template>
            
            <template #extra>
              <a-dropdown :trigger="['click']" placement="bottomRight">
                <a-button 
                  type="text" 
                  size="small"
                  class="argument-actions-btn"
                >
                  <MoreOutlined />
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="edit" @click="handleEditArgument(index)">
                      <EditOutlined />
                      编辑
                    </a-menu-item>
                    <a-menu-item key="duplicate" @click="handleDuplicateArgument(index)">
                      <CopyOutlined />
                      复制
                    </a-menu-item>
                    <a-menu-item key="delete" @click="handleDeleteArgument(index)" class="danger-item">
                      <DeleteOutlined />
                      删除
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
            
            <div class="argument-body">
              <div class="argument-description">
                {{ argument.description || '暂无说明' }}
              </div>
              <div v-if="argument.name" class="argument-placeholder">
                <span class="placeholder-label">变量占位：</span>
                <code class="placeholder-code">{{ getArgumentPlaceholder(argument.name) }}</code>
                <a-button 
                  type="text" 
                  size="small"
                  class="copy-btn"
                  @click="copyPlaceholder(argument.name)"
                  title="复制占位符"
                >
                  <CopyOutlined />
                </a-button>
              </div>
              <div v-if="argument.default" class="argument-default">
                <span class="default-label">默认值：</span>
                <span class="default-value">{{ argument.default }}</span>
              </div>
            </div>
          </a-card>
        </div>
      </div>
    </div>
    
    <!-- 参数编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingIndex !== null ? '编辑参数' : '新增参数'"
      width="600px"
      @ok="handleModalOk"
      @cancel="handleModalCancel"
      class="argument-modal"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="参数名称" name="name">
              <a-input
                v-model:value="formData.name"
                placeholder="例如：language"
                prefix="CodeOutlined"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="参数类型" name="type">
              <a-select v-model:value="formData.type" placeholder="选择类型">
                <a-select-option value="string">
                  <span class="option-content">
                    <span class="option-icon">📝</span>
                    字符串
                  </span>
                </a-select-option>
                <a-select-option value="number">
                  <span class="option-content">
                    <span class="option-icon">🔢</span>
                    数字
                  </span>
                </a-select-option>
                <a-select-option value="boolean">
                  <span class="option-content">
                    <span class="option-icon">☑️</span>
                    布尔值
                  </span>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        
        <a-form-item label="默认值" name="default">
          <a-input
            v-model:value="formData.default"
            placeholder="可选，当用户未提供值时使用"
          />
        </a-form-item>
        
        <a-form-item>
          <a-checkbox v-model:checked="formData.required">
            <span class="checkbox-label">必填参数</span>
            <span class="checkbox-desc">用户必须提供此参数的值</span>
          </a-checkbox>
        </a-form-item>
        
        <a-form-item label="参数说明" name="description">
          <a-textarea
            v-model:value="formData.description"
            :rows="3"
            placeholder="详细描述此参数的用途和格式要求..."
            show-count
            :maxlength="200"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { 
  CodeOutlined,
  ImportOutlined,
  ExportOutlined,
  PlusOutlined,
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  MoreOutlined
} from '@ant-design/icons-vue';

const props = defineProps({
  arguments: {
    type: Array,
    default: () => []
  },
  unusedArguments: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['change']);

const modalVisible = ref(false);
const editingIndex = ref(null);
const formRef = ref(null);
const searchValue = ref('');

const formData = reactive({
  name: '',
  type: 'string',
  default: '',
  required: false,
  description: ''
});

const formRules = {
  name: [
    { required: true, message: '请输入参数名称' },
    { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: '参数名称只能包含字母、数字和下划线，且不能以数字开头' }
  ],
  type: [
    { required: true, message: '请选择参数类型' }
  ]
};

const filteredArguments = computed(() => {
  if (!searchValue.value) return props.arguments;
  
  return props.arguments.filter(arg => 
    arg.name?.toLowerCase().includes(searchValue.value.toLowerCase()) ||
    arg.description?.toLowerCase().includes(searchValue.value.toLowerCase())
  );
});

const isArgumentUnused = (name) => {
  return props.unusedArguments.includes(name);
};

const getArgumentPlaceholder = (name) => {
  return `{{${name}}}`;
};

const getTypeColor = (type) => {
  const colors = {
    string: 'blue',
    number: 'green',
    boolean: 'orange'
  };
  return colors[type] || 'default';
};

const getTypeLabel = (type) => {
  const labels = {
    string: '字符串',
    number: '数字',
    boolean: '布尔值'
  };
  return labels[type] || type;
};

const resetFormData = () => {
  Object.assign(formData, {
    name: '',
    type: 'string',
    default: '',
    required: false,
    description: ''
  });
};

const handleAddArgument = () => {
  editingIndex.value = null;
  resetFormData();
  modalVisible.value = true;
};

const handleEditArgument = (index) => {
  editingIndex.value = index;
  const argument = props.arguments[index];
  Object.assign(formData, {
    name: argument.name || '',
    type: argument.type || 'string',
    default: argument.default || '',
    required: Boolean(argument.required),
    description: argument.description || ''
  });
  modalVisible.value = true;
};

const handleDuplicateArgument = (index) => {
  const argument = props.arguments[index];
  const duplicatedArgument = {
    ...argument,
    name: `${argument.name}_copy`
  };
  
  const newArguments = [...props.arguments];
  newArguments.push(duplicatedArgument);
  emit('change', newArguments);
  message.success('复制成功');
};

const handleDeleteArgument = (index) => {
  const argument = props.arguments[index];
  const argumentName = argument.name || `参数 ${index + 1}`;
  
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除参数 "${argumentName}" 吗？此操作不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const newArguments = [...props.arguments];
      newArguments.splice(index, 1);
      emit('change', newArguments);
      message.success('删除成功');
    }
  });
};

const handleImportArguments = () => {
  Modal.info({
    title: '导入参数',
    content: '导入功能开发中，敬请期待！',
    okText: '确定'
  });
};

const handleExportArguments = () => {
  if (!props.arguments.length) {
    message.warning('没有可导出的参数');
    return;
  }
  
  Modal.info({
    title: '导出参数',
    content: '导出功能开发中，敬请期待！',
    okText: '确定'
  });
};

const copyPlaceholder = async (name) => {
  const placeholder = getArgumentPlaceholder(name);
  
  try {
    await navigator.clipboard.writeText(placeholder);
    message.success('占位符已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
};

const handleModalOk = async () => {
  try {
    await formRef.value.validate();
    
    // 检查参数名称是否重复
    const existingNames = props.arguments
      .map((arg, idx) => ({ name: arg.name, idx }))
      .filter(item => item.idx !== editingIndex.value);
    
    if (existingNames.some(item => item.name === formData.name)) {
      message.error('参数名称已存在');
      return;
    }
    
    const newArguments = [...props.arguments];
    const argumentData = {
      name: formData.name,
      type: formData.type,
      default: formData.default,
      required: formData.required,
      description: formData.description
    };
    
    if (editingIndex.value !== null) {
      newArguments[editingIndex.value] = argumentData;
    } else {
      newArguments.push(argumentData);
    }
    
    emit('change', newArguments);
    modalVisible.value = false;
    message.success({
      content: editingIndex.value !== null ? '更新成功' : '添加成功',
      duration: 2,
    });
  } catch (error) {
    console.error('表单验证失败:', error);
  }
};

const handleModalCancel = () => {
  modalVisible.value = false;
  resetFormData();
};

// 监听弹窗关闭，重置表单
watch(modalVisible, (visible) => {
  if (!visible) {
    resetFormData();
    editingIndex.value = null;
  }
});
</script>

<style scoped>
.arguments-section {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.arguments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%);
  border-bottom: 1px solid #e8e8e8;
}

.arguments-title h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  display: flex;
  align-items: center;
  gap: 8px;
}

.arguments-subtitle {
  font-size: 12px;
  color: #8c8c8c;
}

.arguments-actions {
  display: flex;
  align-items: center;
}

.arguments-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.arguments-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  color: #d9d9d9;
  margin-bottom: 16px;
}

.empty-text h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #595959;
}

.empty-text p {
  margin: 0 0 24px 0;
  color: #8c8c8c;
  font-size: 14px;
}

.arguments-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.list-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  font-size: 12px;
  color: #8c8c8c;
}

.list-actions {
  display: flex;
  align-items: center;
}

.arguments-grid {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.argument-card {
  border-radius: 12px;
  border: 1px solid #f0f0f0;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.argument-card:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
  transform: translateY(-2px);
}

.argument-card-unused {
  opacity: 0.7;
  border-color: #ff7875;
  background: #fff2f0;
}

.argument-card-unused:hover {
  border-color: #ff4d4f;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.15);
}

.argument-card-required {
  border-left: 4px solid #1890ff;
}

.argument-card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.argument-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #262626;
  font-size: 14px;
}

.argument-type-tag,
.argument-required-tag,
.argument-default-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.argument-actions-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.3s ease;
}

.argument-card:hover .argument-actions-btn {
  opacity: 1;
}

.argument-body {
  margin-top: 12px;
}

.argument-description {
  color: #595959;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
  min-height: 20px;
}

.argument-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.placeholder-label {
  font-size: 12px;
  color: #8c8c8c;
}

.placeholder-code {
  background: #f5f5f5;
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #e74c3c;
  border: 1px solid #e8e8e8;
  flex: 1;
}

.copy-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 4px;
  color: #8c8c8c;
  opacity: 0;
  transition: all 0.3s ease;
}

.argument-placeholder:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  color: #1890ff;
  background-color: #f8f9ff;
}

.argument-default {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.default-label {
  color: #8c8c8c;
}

.default-value {
  color: #52c41a;
  font-weight: 500;
  background: #f6ffed;
  padding: 2px 6px;
  border-radius: 4px;
}

:deep(.ant-card-head) {
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

:deep(.ant-card-head-title) {
  padding: 12px 0;
}

:deep(.ant-card-body) {
  padding: 16px;
}

:deep(.ant-card-extra) {
  padding: 0;
}

/* 弹窗样式 */
:deep(.argument-modal .ant-modal-header) {
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%);
  border-bottom: 1px solid #e8e8e8;
}

:deep(.argument-modal .ant-modal-title) {
  font-weight: 600;
  color: #262626;
}

:deep(.argument-modal .ant-modal-body) {
  padding: 24px;
}

:deep(.ant-form-item-label > label) {
  font-weight: 500;
  color: #262626;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-icon {
  font-size: 16px;
}

.checkbox-label {
  font-weight: 500;
  color: #262626;
}

.checkbox-desc {
  font-size: 12px;
  color: #8c8c8c;
  margin-left: 8px;
}

:deep(.ant-checkbox-wrapper) {
  align-items: flex-start;
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

/* 自定义滚动条 */
.arguments-grid::-webkit-scrollbar {
  width: 6px;
}

.arguments-grid::-webkit-scrollbar-track {
  background: transparent;
}

.arguments-grid::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 3px;
}

.arguments-grid::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .arguments-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
  
  .list-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  
  .arguments-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }
  
  .argument-card {
    border-radius: 8px;
  }
  
  :deep(.argument-modal .ant-modal-body) {
    padding: 16px;
  }
}

/* 动画效果 */
.argument-card {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>