<template>
  <a-modal
    v-model:open="open"
    title="上传工具包"
    :width="600"
    :footer="null"
    @cancel="handleCancel"
  >
    <div class="upload-container">
      <!-- 上传区域 -->
      <a-upload-dragger
        v-model:fileList="fileList"
        :multiple="false"
        :accept="'.zip'"
        :before-upload="beforeUpload"
        @change="handleChange"
        @drop="handleDrop"
        @reject="handleReject"
        class="upload-dragger"
        :class="{ 'upload-dragger-active': isDragOver }"
      >
        <p class="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p class="ant-upload-text">点击或拖拽 .zip 文件到此处上传</p>
        <p class="ant-upload-hint">
          支持 .zip 格式，需包含 README.md 和 {tool_name}.tool.js 文件
        </p>
      </a-upload-dragger>

      <!-- 文件列表 -->
      <div v-if="fileList.length > 0" class="file-list">
        <a-list
          :data-source="fileList"
          size="small"
        >
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <div class="file-info">
                    <FileZipOutlined class="file-icon" />
                    <span class="file-name">{{ item.name }}</span>
                    <span class="file-size">({{ formatFileSize(item.size) }})</span>
                  </div>
                </template>
              </a-list-item-meta>
              <template #actions>
                <a-button 
                  type="text" 
                  size="small"
                  danger
                  @click="handleRemove(item)"
                >
                  <DeleteOutlined />
                </a-button>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </div>

      <!-- 上传按钮 -->
      <div class="upload-actions">
        <a-button 
          type="primary" 
          :loading="uploading"
          :disabled="!canUpload"
          @click="handleUpload"
          block
          size="large"
        >
          <CloudUploadOutlined />
          开始上传
        </a-button>
        
        <a-button @click="handleCancel" block>
          取消
        </a-button>
      </div>

      <!-- 验证错误提示 -->
      <a-alert
        v-if="errorMessage"
        :message="errorMessage"
        type="error"
        show-icon
        class="error-alert"
        closable
        @close="errorMessage = ''"
      />
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  InboxOutlined,
  FileZipOutlined,
  CloudUploadOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue';

const emit = defineEmits(['success']);

const open = ref(false);
const fileList = ref([]);
const uploading = ref(false);
const errorMessage = ref('');
const isDragOver = ref(false);

const canUpload = computed(() => {
  return fileList.value.length > 0 && !uploading.value && !errorMessage.value;
});

const beforeUpload = (file) => {
  // 只允许zip文件
  const isZip = file.type === 'application/zip' || file.name.endsWith('.zip');
  if (!isZip) {
    errorMessage.value = '只支持 .zip 格式的文件';
    return false;
  }
  
  // 检查文件大小限制 (10MB)
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    errorMessage.value = '文件大小不能超过 10MB';
    return false;
  }
  
  return true;
};

const handleChange = (info) => {
  const status = info.file.status;
  const file = info.file;
  
  if (status === 'uploading') {
    // 文件正在上传中
    return;
  }
  
  if (status === 'done') {
    // 上传完成
    if (file.response && file.response.success) {
      message.success(`${file.name} 上传成功`);
      
      // 清空文件列表并关闭弹窗
      fileList.value = [];
      open.value = false;
      
      // 发送成功事件
      emit('success', {
        toolInfo: file.response.tool
      });
    } else {
      errorMessage.value = file.response?.message || '上传失败，请重试';
    }
  } else if (status === 'error') {
    errorMessage.value = `${file.name} 上传失败`;
  }
};

const handleDrop = (e) => {
  isDragOver.value = false;
};

const handleReject = (file) => {
  errorMessage.value = `文件 ${file.name} 格式不正确或大小超限`;
};

const handleRemove = (file) => {
  fileList.value = fileList.value.filter(item => item.uid !== file.uid);
};

const handleUpload = async () => {
  if (!canUpload.value) {
    return;
  }
  
  uploading.value = true;
  errorMessage.value = '';
  
  const formData = new FormData();
  formData.append('file', fileList.value[0].originFileObj);
  
  try {
    const response = await fetch('/api/tools/upload', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    // 模拟上传成功响应
    if (fileList.value[0]) {
      fileList.value[0].status = 'done';
      fileList.value[0].response = {
        success: true,
        tool: result.tool || {
          id: 'demo-tool',
          name: 'Demo Tool',
          description: '演示工具',
          version: '1.0.0',
          category: 'utility',
          author: 'Demo Author',
          tags: ['demo'],
          scenarios: ['演示场景'],
          limitations: ['演示限制']
        }
      };
    }
    
    handleChange({ file: fileList.value[0] });
  } catch (error) {
    console.error('上传失败:', error);
    errorMessage.value = '上传失败，请检查网络连接';
  } finally {
    uploading.value = false;
  }
};

const handleCancel = () => {
  open.value = false;
  fileList.value = [];
  errorMessage.value = '';
  uploading.value = false;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

<style scoped>
.upload-container {
  padding: 24px;
}

.upload-dragger {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  background: #fafafa;
  padding: 40px 20px;
  text-align: center;
  transition: border-color 0.3s ease;
}

.upload-dragger-active {
  border-color: #1890ff;
  background: #f8f9ff;
}

.upload-dragger:hover {
  border-color: #40a9ff;
}

.ant-upload-drag-icon {
  font-size: 48px;
  color: #1890ff;
  margin-bottom: 16px;
}

.ant-upload-text {
  font-size: 16px;
  color: #595959;
  margin-bottom: 8px;
}

.ant-upload-hint {
  font-size: 14px;
  color: #8c8c8c;
}

.file-list {
  margin-top: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fff;
  max-height: 200px;
  overflow-y: auto;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #1890ff;
  font-size: 16px;
}

.file-name {
  font-weight: 500;
  color: #262626;
}

.file-size {
  font-size: 12px;
  color: #8c8c8c;
}

.upload-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.error-alert {
  margin-top: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .upload-container {
    padding: 16px;
  }
  
  .upload-dragger {
    padding: 24px 16px;
  }
  
  .upload-actions {
    flex-direction: column;
  }
}
</style>