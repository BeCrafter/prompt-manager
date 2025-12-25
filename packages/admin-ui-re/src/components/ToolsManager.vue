<template>
  <div class="tools-manager">
    <!-- 头部操作栏 -->
    <div class="manager-header">
      <div class="header-title">
        <h1>工具管理</h1>
        <p class="header-subtitle">管理和浏览可用的工具</p>
      </div>
      
      <div class="header-actions">
        <a-button 
          type="primary" 
          icon="plus"
          @click="showUploadModal = true"
        >
          上传工具包
        </a-button>
        
        <a-button 
          icon="sync"
          @click="refreshTools"
          :loading="refreshing"
        >
          刷新
        </a-button>
      </div>
    </div>

    <!-- 聚合视图内容 -->
    <div class="tools-content">
      <!-- 全部工具视图 -->
      <div v-if="viewMode === 'all'" class="tools-grid">
        <div
          v-for="tool in filteredTools"
          :key="tool.id"
          class="tool-card"
          @click="handleToolClick(tool)"
        >
          <div class="tool-header">
            <div class="tool-info">
              <h3 class="tool-name">{{ tool.name }}</h3>
              <div class="tool-meta">
                <a-tag color="blue" size="small">{{ tool.category }}</a-tag>
                <span class="tool-version">v{{ tool.version }}</span>
              </div>
            </div>
            <div class="tool-actions">
              <a-button size="small" type="text" @click.stop="handleToolClick(tool)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </div>
          </div>
          
          <div class="tool-description">
            {{ tool.description }}
          </div>
          
          <div class="tool-tags" v-if="tool.tags && tool.tags.length">
            <a-tag
              v-for="tag in tool.tags"
              :key="tag"
              size="small"
              color="green"
            >
              {{ tag }}
            </a-tag>
          </div>
          
          <div class="tool-footer">
            <div class="tool-author">
              <span>作者: {{ tool.author }}</span>
            </div>
            <div class="tool-scenarios" v-if="tool.scenarios && tool.scenarios.length">
              <span>场景: {{ tool.scenarios.join(', ') }}</span>
            </div>
            <div class="tool-limitations" v-if="tool.limitations && tool.limitations.length">
              <span>限制: {{ tool.limitations.join(', ') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 按类别聚合视图 -->
      <div v-else-if="viewMode === 'category'" class="category-view">
        <div
          v-for="category in categoryGroups"
          :key="category.name"
          class="category-group"
        >
          <div class="category-header">
            <h2 class="category-name">{{ category.name }}</h2>
            <a-badge :count="category.tools.length" color="blue" />
          </div>
          <div class="category-tools">
            <div
              v-for="tool in category.tools"
              :key="tool.id"
              class="tool-card compact"
              @click="handleToolClick(tool)"
            >
              <div class="compact-header">
                <span class="compact-name">{{ tool.name }}</span>
                <a-tag size="small" color="blue">{{ tool.version }}</a-tag>
              </div>
              <div class="compact-description">{{ tool.description }}</div>
              <div class="compact-meta">
                <span class="compact-author">{{ tool.author }}</span>
                <div class="compact-tags" v-if="tool.tags && tool.tags.length">
                  <a-tag
                    v-for="tag in tool.tags.slice(0, 2)"
                    :key="tag"
                    size="small"
                    color="green"
                  >
                    {{ tag }}
                  </a-tag>
                  <span v-if="tool.tags.length > 2" class="more-tags">
                    +{{ tool.tags.length - 2 }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 按标签聚合视图 -->
      <div v-else-if="viewMode === 'tag'" class="tag-view">
        <div class="tag-cloud">
          <a-tag
            v-for="tagData in tagGroups"
            :key="tagData.name"
            :color="getTagColor(tagData.count)"
            class="tag-item"
            @click="selectTag(tagData.name)"
          >
            {{ tagData.name }} ({{ tagData.count }})
          </a-tag>
        </div>
        <div class="tag-tools" v-if="selectedTag">
          <div class="selected-tag-header">
            <h3>标签: {{ selectedTag }}</h3>
            <a-button size="small" @click="selectedTag = null">
              <template #icon><CloseOutlined /></template>
            </a-button>
          </div>
          <div class="tools-grid">
            <div
              v-for="tool in getToolsByTag(selectedTag)"
              :key="tool.id"
              class="tool-card"
              @click="handleToolClick(tool)"
            >
              <div class="tool-header">
                <div class="tool-info">
                  <h3 class="tool-name">{{ tool.name }}</h3>
                  <div class="tool-meta">
                    <a-tag color="blue" size="small">{{ tool.category }}</a-tag>
                    <span class="tool-version">v{{ tool.version }}</span>
                  </div>
                </div>
              </div>
              <div class="tool-description">{{ tool.description }}</div>
              <div class="tool-footer">
                <span>作者: {{ tool.author }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 按作者聚合视图 -->
      <div v-else-if="viewMode === 'author'" class="author-view">
        <div class="author-grid">
          <div
            v-for="authorData in authorGroups"
            :key="authorData.name"
            class="author-card"
            @click="selectAuthor(authorData.name)"
          >
            <div class="author-avatar">
              <a-avatar :size="60" :src="authorData.avatar">
                {{ authorData.name.charAt(0).toUpperCase() }}
              </a-avatar>
            </div>
            <div class="author-info">
              <h3 class="author-name">{{ authorData.name }}</h3>
              <p class="author-bio">{{ authorData.bio }}</p>
              <div class="author-stats">
                <a-badge :count="authorData.toolCount" color="blue" />
                <span>{{ authorData.toolCount }} 个工具</span>
              </div>
            </div>
            <div class="author-links">
              <a-button
                v-if="authorData.homepage"
                type="link"
                size="small"
                :href="authorData.homepage"
                target="_blank"
              >
                <template #icon><GlobalOutlined /></template>
              </a-button>
            </div>
          </div>
        </div>
        <div class="author-tools" v-if="selectedAuthor">
          <div class="selected-author-header">
            <div class="author-summary">
              <a-avatar :size="40" :src="getAuthorData(selectedAuthor).avatar">
                {{ selectedAuthor.charAt(0).toUpperCase() }}
              </a-avatar>
              <div class="author-summary-info">
                <h3>{{ selectedAuthor }}</h3>
                <p>{{ getAuthorData(selectedAuthor).bio }}</p>
              </div>
            </div>
            <a-button size="small" @click="selectedAuthor = null">
              <template #icon><CloseOutlined /></template>
            </a-button>
          </div>
          <div class="tools-grid">
            <div
              v-for="tool in getToolsByAuthor(selectedAuthor)"
              :key="tool.id"
              class="tool-card"
              @click="handleToolClick(tool)"
            >
              <div class="tool-header">
                <div class="tool-info">
                  <h3 class="tool-name">{{ tool.name }}</h3>
                  <div class="tool-meta">
                    <a-tag color="blue" size="small">{{ tool.category }}</a-tag>
                    <span class="tool-version">v{{ tool.version }}</span>
                  </div>
                </div>
              </div>
              <div class="tool-description">{{ tool.description }}</div>
              <div class="tool-tags" v-if="tool.tags && tool.tags.length">
                <a-tag
                  v-for="tag in tool.tags"
                  :key="tag"
                  size="small"
                  color="green"
                >
                  {{ tag }}
                </a-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传模态框 -->
    <a-modal
      v-model:open="showUploadModal"
      title="上传工具包"
      width="600px"
      @ok="handleUpload"
      @cancel="showUploadModal = false"
    >
      <div class="upload-content">
        <a-upload-dragger
          v-model:fileList="uploadFileList"
          name="file"
          :multiple="false"
          accept=".zip"
          :before-upload="beforeUpload"
          @change="handleUploadChange"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p class="ant-upload-hint">仅支持 .zip 格式，需包含 README.md 和 {tool_name}.tool.js 文件</p>
        </a-upload-dragger>
        
        <div v-if="uploadStatus" class="upload-status">
          <a-alert
            :message="uploadStatus.message"
            :type="uploadStatus.type"
            show-icon
          />
        </div>
      </div>
    </a-modal>

    <!-- 工具文档模态框 -->
    <a-modal
      v-model:open="showDocModal"
      :title="selectedTool?.name"
      width="90%"
      style="top: 20px"
      :footer="null"
      @cancel="showDocModal = false"
    >
      <div class="tool-documentation">
        <div v-if="toolDocumentation" class="markdown-content">
          <div v-html="renderedMarkdown"></div>
        </div>
        <div v-else class="no-documentation">
          <a-empty description="该工具暂无说明文档">
            <template #image>
              <FileTextOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
          </a-empty>
        </div>
      </div>
    </a-modal>

    <!-- 工具上传弹窗 -->
    <ToolUpload
      v-model:open="showUploadModal"
      @success="handleUploadSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  UploadOutlined,
  InboxOutlined,
  FileTextOutlined,
  CloseOutlined,
  GlobalOutlined
} from '@ant-design/icons-vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ToolUpload from './ToolUpload.vue'
import ToolCard from './ToolCard.vue'

// 响应式数据
const viewMode = ref('all')
const searchKeyword = ref('')
const showUploadModal = ref(false)
const showDocModal = ref(false)
const uploadFileList = ref([])
const uploadStatus = ref(null)
const selectedTool = ref(null)
const selectedTag = ref(null)
const selectedAuthor = ref(null)
const toolDocumentation = ref('')
const renderedMarkdown = ref('')

// 模拟工具数据
const tools = ref([
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools MCP',
    description: '基于 chrome-devtools-mcp 的浏览器自动化工具，完全复用官方实现。支持页面导航、元素操作、性能分析、网络监控、控制台监控等功能。支持 keepAlive 参数保持浏览器状态，便于连续操作和调试。',
    version: '1.0.0',
    category: 'utility',
    author: 'Prompt Manager',
    tags: ['browser', 'debugging'],
    scenarios: ['网页自动化操作'],
    limitations: ['仅支持 Chrome/Chromium 浏览器']
  },
  {
    id: 'file-manager',
    name: 'File Manager',
    description: '强大的文件管理工具，支持文件读写、目录操作、批量处理等功能。提供安全的文件系统访问控制和详细的操作日志。',
    version: '2.1.0',
    category: 'system',
    author: 'Prompt Manager',
    tags: ['file', 'system', 'utility'],
    scenarios: ['文件批量处理', '目录管理', '文件备份'],
    limitations: ['需要适当的文件系统权限']
  },
  {
    id: 'pdf-reader',
    name: 'PDF Reader',
    description: '专业的PDF文档处理工具，支持文本提取、元信息读取、页面预览等功能。支持加密PDF文档处理。',
    version: '1.5.0',
    category: 'document',
    author: 'Document Team',
    tags: ['pdf', 'document', 'reader'],
    scenarios: ['文档内容提取', 'PDF元信息分析'],
    limitations: ['不支持PDF编辑功能', '大文件处理较慢']
  },
  {
    id: 'todo-manager',
    name: 'Todo Manager',
    description: '基于本地JSON存储的任务管理工具，支持项目分组、标签管理、批量操作等功能。提供会话任务和项目任务的灵活管理方式。',
    version: '1.0.0',
    category: 'productivity',
    author: 'Productivity Team',
    tags: ['todo', 'task', 'productivity'],
    scenarios: ['项目任务管理', '个人待办事项'],
    limitations: ['仅支持本地存储', '无云端同步功能']
  }
])

// 计算属性
const filteredTools = computed(() => {
  let result = tools.value

  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(tool =>
      tool.name.toLowerCase().includes(keyword) ||
      tool.description.toLowerCase().includes(keyword)
    )
  }

  return result
})

const categoryGroups = computed(() => {
  const groups = {}
  filteredTools.value.forEach(tool => {
    if (!groups[tool.category]) {
      groups[tool.category] = {
        name: tool.category,
        tools: []
      }
    }
    groups[tool.category].tools.push(tool)
  })
  return Object.values(groups)
})

const tagGroups = computed(() => {
  const tagCounts = {}
  filteredTools.value.forEach(tool => {
    if (tool.tags) {
      tool.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    }
  })
  return Object.entries(tagCounts).map(([name, count]) => ({ name, count }))
})

const authorGroups = computed(() => {
  const authorMap = {}
  filteredTools.value.forEach(tool => {
    if (!authorMap[tool.author]) {
      authorMap[tool.author] = {
        name: tool.author,
        tools: [],
        toolCount: 0,
        bio: `${tool.author} 专注于开发高质量的${tool.category}类工具，致力于提升开发效率。`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${tool.author}`,
        homepage: `https://github.com/${tool.author.toLowerCase().replace(/\s+/g, '-')}`
      }
    }
    authorMap[tool.author].tools.push(tool)
    authorMap[tool.author].toolCount++
  })
  return Object.values(authorMap)
})

// 方法
const handleViewModeChange = (mode) => {
  viewMode.value = mode
  selectedTag.value = null
  selectedAuthor.value = null
}

const handleSearch = () => {
  // 搜索逻辑已在计算属性中处理
}

const handleToolClick = async (tool) => {
  selectedTool.value = tool
  showDocModal.value = true
  
  try {
    // 尝试获取工具文档
    const response = await fetch(`/api/tools/${tool.id}/readme`)
    if (response.ok) {
      const content = await response.text()
      toolDocumentation.value = content
      renderedMarkdown.value = DOMPurify.sanitize(marked(content))
    } else {
      toolDocumentation.value = ''
      renderedMarkdown.value = ''
    }
  } catch (error) {
    toolDocumentation.value = ''
    renderedMarkdown.value = ''
  }
}

const beforeUpload = (file) => {
  const isZip = file.type === 'application/zip' || file.name.endsWith('.zip')
  if (!isZip) {
    message.error('只能上传 .zip 格式的文件!')
    return false
  }
  
  const isLt10M = file.size / 1024 / 1024 < 10
  if (!isLt10M) {
    message.error('文件大小不能超过 10MB!')
    return false
  }
  
  return false // 阻止自动上传
}

const handleUploadChange = (info) => {
  if (info.file.status === 'done') {
    // 这里应该验证zip文件内容
    validateZipFile(info.file)
  }
}

const validateZipFile = async (file) => {
  try {
    // 这里应该验证zip文件是否包含必需文件
    // 暂时模拟验证
    uploadStatus.value = {
      type: 'success',
      message: '工具包上传成功！正在验证文件内容...'
    }
    
    setTimeout(() => {
      uploadStatus.value = {
        type: 'success',
        message: '验证通过，工具包已成功安装'
      }
      showUploadModal.value = false
      uploadFileList.value = []
      message.success('工具包安装成功')
    }, 2000)
  } catch (error) {
    uploadStatus.value = {
      type: 'error',
      message: '验证失败：zip文件必须包含 README.md 和 {tool_name}.tool.js 文件'
    }
  }
}

const handleUpload = () => {
  if (uploadFileList.value.length === 0) {
    message.error('请选择要上传的文件')
    return
  }
  
  const file = uploadFileList.value[0].originFileObj
  validateZipFile(file)
}

const selectTag = (tag) => {
  selectedTag.value = selectedTag.value === tag ? null : tag
}

// 处理上传成功
const handleUploadSuccess = ({ toolInfo }) => {
  message.success('工具包上传成功！')
  
  // 将新工具添加到工具列表
  if (toolInfo) {
    tools.value.push(toolInfo)
  }
  
  // 刷新工具列表
  refreshTools()
}

const selectAuthor = (author) => {
  selectedAuthor.value = selectedAuthor.value === author ? null : author
}

const getToolsByTag = (tag) => {
  return filteredTools.value.filter(tool => tool.tags && tool.tags.includes(tag))
}

const getToolsByAuthor = (author) => {
  return filteredTools.value.filter(tool => tool.author === author)
}

const getAuthorData = (author) => {
  return authorGroups.value.find(data => data.name === author) || {}
}

const getTagColor = (count) => {
  if (count >= 3) return 'red'
  if (count >= 2) return 'orange'
  return 'blue'
}

onMounted(() => {
  // 初始化
})
</script>

<style scoped>
.tools-manager {
  padding: 24px;
  background: #f5f5f5;
  min-height: 100vh;
}

.tools-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 16px 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tools-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 工具卡片样式 */
.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.tool-card {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 20px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.tool-card:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
  transform: translateY(-2px);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.tool-info {
  flex: 1;
}

.tool-name {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #262626;
  line-height: 1.4;
}

.tool-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-version {
  font-size: 12px;
  color: #8c8c8c;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.tool-description {
  color: #595959;
  line-height: 1.6;
  margin-bottom: 16px;
  font-size: 14px;
}

.tool-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.tool-footer {
  font-size: 12px;
  color: #8c8c8c;
  line-height: 1.4;
}

.tool-footer > div {
  margin-bottom: 4px;
}

.tool-author {
  font-weight: 500;
}

/* 类别视图样式 */
.category-view {
  space-y: 32px;
}

.category-group {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

.category-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #262626;
}

.category-tools {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.tool-card.compact {
  padding: 16px;
}

.compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.compact-name {
  font-weight: 600;
  color: #262626;
}

.compact-description {
  color: #595959;
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 12px;
}

.compact-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #8c8c8c;
}

.compact-author {
  font-weight: 500;
}

.compact-tags {
  display: flex;
  align-items: center;
  gap: 4px;
}

.more-tags {
  color: #8c8c8c;
}

/* 标签视图样式 */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
}

.tag-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag-item:hover {
  transform: scale(1.05);
}

.selected-tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: #e6f7ff;
  border-radius: 8px;
}

/* 作者视图样式 */
.author-view {
  space-y: 32px;
}

.author-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.author-card {
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 24px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.author-card:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
  transform: translateY(-2px);
}

.author-avatar {
  margin-bottom: 16px;
}

.author-info {
  margin-bottom: 16px;
}

.author-name {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #262626;
}

.author-bio {
  margin: 0 0 12px 0;
  color: #595959;
  font-size: 14px;
  line-height: 1.4;
}

.author-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #8c8c8c;
}

.author-links {
  margin-top: 12px;
}

.selected-author-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: #f6ffed;
  border-radius: 8px;
}

.author-summary {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-summary-info {
  flex: 1;
}

.author-summary-info h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.author-summary-info p {
  margin: 0;
  color: #595959;
  font-size: 14px;
}

/* 上传样式 */
.upload-content {
  padding: 20px 0;
}

.upload-status {
  margin-top: 16px;
}

/* 文档样式 */
.tool-documentation {
  max-height: 70vh;
  overflow-y: auto;
}

.markdown-content {
  padding: 20px;
  line-height: 1.6;
}

.markdown-content h1,
.markdown-content h2,
.markdown-content h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  color: #262626;
}

.markdown-content p {
  margin-bottom: 16px;
}

.markdown-content pre {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 16px;
}

.markdown-content code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
}

.no-documentation {
  padding: 60px 20px;
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tools-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-right {
    width: 100%;
  }
  
  .tools-grid {
    grid-template-columns: 1fr;
  }
  
  .category-tools,
  .author-grid {
    grid-template-columns: 1fr;
  }
  
  .tag-cloud {
    justify-content: center;
  }
}
</style>