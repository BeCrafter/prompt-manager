<template>
  <div class="tool-detail">
    <!-- 返回按钮 -->
    <div class="detail-header">
      <a-button 
        type="text" 
        class="back-btn"
        @click="handleBack"
      >
        <ArrowLeftOutlined />
        返回工具列表
      </a-button>
      
      <div class="tool-title">
        <h1 v-if="tool">{{ tool.name }}</h1>
        <div v-else class="loading-placeholder">
          <a-skeleton active :paragraph="{ rows: 1, width: '60%' }" />
        </div>
      </div>
    </div>

    <!-- 工具信息卡片 -->
    <div class="tool-info-card" v-if="tool">
      <a-card :bordered="false" class="info-card">
        <template #title>
          <div class="card-title">
            <div class="tool-meta">
              <a-tag :color="getCategoryColor(tool.category)" class="category-tag">
                {{ getCategoryName(tool.category) }}
              </a-tag>
              <a-tag color="blue" class="version-tag">
                v{{ tool.version }}
              </a-tag>
            </div>
            <div class="tool-actions">
              <a-button 
                type="primary" 
                size="small"
                @click="handleOpenManual"
              >
                <BookOutlined />
                使用手册
              </a-button>
              <a-button 
                size="small"
                @click="handleOpenReadme"
              >
                <FileTextOutlined />
                说明文档
              </a-button>
            </div>
          </div>
        </template>
        
        <div class="tool-description">
          <p>{{ tool.description }}</p>
        </div>
        
        <!-- 标签 -->
        <div v-if="tool.tags && tool.tags.length > 0" class="tool-tags">
          <h3>标签</h3>
          <div class="tags-container">
            <a-tag 
              v-for="tag in tool.tags" 
              :key="tag"
              color="processing"
              class="tool-tag"
            >
              {{ tag }}
            </a-tag>
          </div>
        </div>
        
        <!-- 使用场景 -->
        <div v-if="tool.scenarios && tool.scenarios.length > 0" class="tool-scenarios">
          <h3>使用场景</h3>
          <ul class="scenarios-list">
            <li v-for="scenario in tool.scenarios" :key="scenario">
              <CheckCircleOutlined class="scenario-icon" />
              {{ scenario }}
            </li>
          </ul>
        </div>
        
        <!-- 限制说明 -->
        <div v-if="tool.limitations && tool.limitations.length > 0" class="tool-limitations">
          <h3>使用限制</h3>
          <ul class="limitations-list">
            <li v-for="limitation in tool.limitations" :key="limitation">
              <WarningOutlined class="limitation-icon" />
              {{ limitation }}
            </li>
          </ul>
        </div>
        
        <!-- 作者信息 -->
        <div v-if="tool.author" class="tool-author">
          <h3>作者</h3>
          <div class="author-info">
            <a-avatar :size="40" :style="{ backgroundColor: '#1890ff' }">
              <template #icon>
                <UserOutlined />
              </template>
            </a-avatar>
            <div class="author-details">
              <div class="author-name">{{ tool.author }}</div>
              <div class="author-id">ID: {{ tool.id }}</div>
            </div>
          </div>
        </div>
      </a-card>
    </div>

    <!-- 文档内容区域 -->
    <div class="document-content">
      <a-card :bordered="false" class="document-card">
        <template #title>
          <div class="document-title">
            <span v-if="activeTab === 'readme'">README.md</span>
            <span v-else-if="activeTab === 'manual'">使用手册</span>
            <span v-else>文档</span>
          </div>
        </template>
        
        <template #extra>
          <a-radio-group 
            v-model:value="activeTab" 
            button-style="solid"
            size="small"
          >
            <a-radio-button value="readme" v-if="hasReadme">README</a-radio-button>
            <a-radio-button value="manual">使用手册</a-radio-button>
          </a-radio-group>
        </template>
        
        <div class="document-body">
          <!-- 加载状态 -->
          <div v-if="loading" class="loading-container">
            <a-spin size="large" />
            <p>正在加载文档...</p>
          </div>
          
          <!-- 错误状态 -->
          <div v-else-if="error" class="error-container">
            <a-result
              status="404"
              title="文档不存在"
              :sub-title="activeTab === 'readme' ? '该工具暂无 README.md 文件' : '该工具暂无使用手册'"
            >
              <template #extra>
                <a-button type="primary" @click="handleBack">返回</a-button>
              </template>
            </a-result>
          </div>
          
          <!-- README 内容 -->
          <div v-else-if="activeTab === 'readme' && readmeContent" class="markdown-content">
            <div v-html="readmeContent"></div>
          </div>
          
          <!-- 使用手册内容 -->
          <div v-else-if="activeTab === 'manual' && manualContent" class="manual-content">
            <div v-html="manualContent"></div>
          </div>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { 
  ArrowLeftOutlined, 
  BookOutlined, 
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  UserOutlined
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Mermaid } from 'mermaid';

const props = defineProps({
  toolId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['back']);

const tool = ref(null);
const loading = ref(true);
const error = ref(false);
const activeTab = ref('manual');
const readmeContent = ref('');
const manualContent = ref('');

const hasReadme = computed(() => {
  return tool.value && tool.value.hasReadme;
});

const getCategoryColor = (category) => {
  const colors = {
    'system': 'red',
    'utility': 'green',
    'ai': 'purple',
    'file': 'orange',
    'network': 'cyan',
    'database': 'blue',
    'security': 'magenta',
    'monitoring': 'gold'
  };
  return colors[category] || 'default';
};

const getCategoryName = (category) => {
  const names = {
    'system': '系统工具',
    'utility': '实用工具',
    'ai': 'AI工具',
    'file': '文件工具',
    'network': '网络工具',
    'database': '数据库工具',
    'security': '安全工具',
    'monitoring': '监控工具'
  };
  return names[category] || '其他';
};

const handleBack = () => {
  emit('back');
};

const handleOpenManual = () => {
  activeTab.value = 'manual';
  if (!manualContent.value) {
    loadManualContent();
  }
};

const handleOpenReadme = () => {
  if (!hasReadme.value) {
    message.warning('该工具暂无 README.md 文件');
    return;
  }
  activeTab.value = 'readme';
  if (!readmeContent.value) {
    loadReadmeContent();
  }
};

const loadToolData = async () => {
  loading.value = true;
  error.value = false;
  
  try {
    // 模拟获取工具数据，实际应该从API获取
    const response = await fetch(`/api/tools/${props.toolId}`);
    const data = await response.json();
    
    if (data.success) {
      tool.value = data.tool;
    } else {
      throw new Error(data.message || '获取工具信息失败');
    }
    
    // 检查是否有README文件
    if (tool.value) {
      checkReadmeExistence();
    }
  } catch (err) {
    console.error('加载工具数据失败:', err);
    error.value = true;
  } finally {
    loading.value = false;
  }
};

const checkReadmeExistence = async () => {
  try {
    const response = await fetch(`/api/tools/${props.toolId}/readme`);
    tool.value.hasReadme = response.ok;
  } catch {
    tool.value.hasReadme = false;
  }
};

const loadReadmeContent = async () => {
  if (!hasReadme.value) {
    return;
  }
  
  try {
    const response = await fetch(`/api/tools/${props.toolId}/readme`);
    const markdown = await response.text();
    
    // 解析Markdown并渲染Mermaid图表
    const html = marked.parse(markdown, {
      highlight: (code, lang) => {
        return `<pre><code class="language-${lang}">${code}</code></pre>`;
      }
    });
    
    // 清理HTML
    const cleanHtml = DOMPurify.sanitize(html);
    
    // 渲染Mermaid图表
    const mermaidContent = extractMermaidDiagrams(markdown);
    if (mermaidContent.length > 0) {
      const mermaidHtml = await renderMermaidDiagrams(mermaidContent);
      readmeContent.value = cleanHtml.replace(/<mermaid>([\s\S]*?)<\/mermaid>/g, mermaidHtml);
    } else {
      readmeContent.value = cleanHtml;
    }
  } catch (err) {
    console.error('加载README失败:', err);
    error.value = true;
  }
};

const loadManualContent = async () => {
  try {
    // 生成使用手册内容
    const manual = generateManualContent(tool.value);
    
    // 解析Markdown并渲染Mermaid图表
    const html = marked.parse(manual, {
      highlight: (code, lang) => {
        return `<pre><code class="language-${lang}">${code}</code></pre>`;
      }
    });
    
    // 清理HTML
    const cleanHtml = DOMPurify.sanitize(html);
    
    // 渲染Mermaid图表
    const mermaidContent = extractMermaidDiagrams(manual);
    if (mermaidContent.length > 0) {
      const mermaidHtml = await renderMermaidDiagrams(mermaidContent);
      manualContent.value = cleanHtml.replace(/<mermaid>([\s\S]*?)<\/mermaid>/g, mermaidHtml);
    } else {
      manualContent.value = cleanHtml;
    }
  } catch (err) {
    console.error('生成使用手册失败:', err);
    error.value = true;
  }
};

const extractMermaidDiagrams = (markdown) => {
  const mermaidRegex = /<mermaid>([\s\S]*?)<\/mermaid>/g;
  const matches = [];
  let match;
  
  while ((match = mermaidRegex.exec(markdown)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
};

const renderMermaidDiagrams = async (diagrams) => {
  const renderedDiagrams = [];
  
  for (const diagram of diagrams) {
    try {
      const { svg } = await Mermaid.render(diagram, {
        theme: 'default',
        backgroundColor: '#ffffff'
      });
      renderedDiagrams.push(svg);
    } catch (err) {
      console.error('渲染Mermaid图表失败:', err);
      renderedDiagrams.push(`<div class="mermaid-error">图表渲染失败: ${err.message}</div>`);
    }
  }
  
  return renderedDiagrams.join('');
};

const generateManualContent = (tool) => {
  let content = `# ${tool.name} 使用手册\n\n`;
  
  // 基本信息
  content += `## 基本信息\n\n`;
  content += `- **工具ID**: ${tool.id}\n`;
  content += `- **版本**: ${tool.version}\n`;
  content += `- **类别**: ${getCategoryName(tool.category)}\n`;
  content += `- **作者**: ${tool.author}\n\n`;
  
  // 描述
  content += `## 工具描述\n\n`;
  content += `${tool.description}\n\n`;
  
  // 标签
  if (tool.tags && tool.tags.length > 0) {
    content += `## 标签\n\n`;
    tool.tags.forEach(tag => {
      content += `- \`${tag}\`\n`;
    });
    content += '\n';
  }
  
  // 使用场景
  if (tool.scenarios && tool.scenarios.length > 0) {
    content += `## 使用场景\n\n`;
    tool.scenarios.forEach((scenario, index) => {
      content += `${index + 1}. ${scenario}\n`;
    });
    content += '\n';
  }
  
  // 限制说明
  if (tool.limitations && tool.limitations.length > 0) {
    content += `## 使用限制\n\n`;
    tool.limitations.forEach((limitation, index) => {
      content += `${index + 1}. ${limitation}\n`;
    });
    content += '\n';
  }
  
  // 参数说明（如果有Schema）
  if (tool.schema) {
    content += `## 参数说明\n\n`;
    content += `### 必需参数\n\n`;
    if (tool.schema.parameters && tool.schema.parameters.required) {
      tool.schema.parameters.required.forEach(param => {
        const prop = tool.schema.parameters.properties[param];
        content += `- **${param}** (${prop.type}): ${prop.description}\n`;
      });
    }
    content += '\n';
    
    content += `### 可选参数\n\n`;
    Object.entries(tool.schema.parameters.properties).forEach(([param, prop]) => {
      if (!tool.schema.parameters.required.includes(param)) {
        content += `- **${param}** (${prop.type}): ${prop.description}\n`;
        if (prop.default) {
          content += `  - 默认值: ${prop.default}\n`;
        }
        if (prop.enum) {
          content += `  - 可选值: ${prop.enum.join(', ')}\n`;
        }
      }
    });
    content += '\n';
  }
  
  // 使用示例
  content += `## 使用示例\n\n`;
  content += `\`\`\`yaml\n`;
  content += `tool: tool://${tool.id}\n`;
  content += `mode: execute\n`;
  content += `parameters:\n`;
  content += `  # 参数示例\n`;
  content += `  param1: "value1"\n`;
  content += `  param2: "value2"\n`;
  content += `\`\`\`\n\n`;
  
  // 错误处理
  content += `## 错误处理\n\n`;
  if (tool.businessErrors && tool.businessErrors.length > 0) {
    tool.businessErrors.forEach(error => {
      content += `### ${error.code}\n`;
      content += `- **描述**: ${error.description}\n`;
      content += `- **解决方案**: ${error.solution}\n`;
      content += `- **可重试**: ${error.retryable ? '是' : '否'}\n`;
      content += '\n';
    });
  } else {
    content += `暂无特定错误处理说明。\n\n`;
  }
  
  // 注意事项
  content += `## 注意事项\n\n`;
  content += `1. 确保工具已正确安装并配置\n`;
  content += `2. 检查参数是否符合要求\n`;
  content += `3. 如遇问题，请查看错误日志\n\n`;
  
  return content;
};

onMounted(() => {
  loadToolData();
});
</script>

<style scoped>
.tool-detail {
  height: 100vh;
  overflow-y: auto;
  background: #f5f5f5;
}

.detail-header {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: #f8f9ff;
  color: #1890ff;
}

.tool-title {
  flex: 1;
}

.tool-title h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #262626;
}

.loading-placeholder {
  height: 32px;
}

.tool-info-card {
  margin: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.info-card {
  background: #fff;
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.tool-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.category-tag {
  font-weight: 500;
}

.version-tag {
  font-weight: 500;
}

.tool-actions {
  display: flex;
  gap: 8px;
}

.tool-description {
  margin: 16px 0;
  color: #595959;
  line-height: 1.6;
  font-size: 14px;
}

.tool-tags,
.tool-scenarios,
.tool-limitations,
.tool-author {
  margin-top: 24px;
}

.tool-tags h3,
.tool-scenarios h3,
.tool-limitations h3,
.tool-author h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tool-tag {
  font-size: 12px;
}

.scenarios-list,
.limitations-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.scenarios-list li,
.limitations-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  color: #595959;
  line-height: 1.5;
}

.scenario-icon,
.limitation-icon {
  color: #52c41a;
  flex-shrink: 0;
  margin-top: 2px;
}

.limitation-icon {
  color: #faad14;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-details {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-weight: 600;
  color: #262626;
  font-size: 14px;
}

.author-id {
  font-size: 12px;
  color: #8c8c8c;
}

.document-content {
  margin: 0 24px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.document-card {
  background: #fff;
  min-height: 400px;
}

.document-title {
  font-size: 18px;
  font-weight: 600;
  color: #262626;
}

.document-body {
  min-height: 300px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: #8c8c8c;
}

.loading-container p {
  margin-top: 16px;
  font-size: 14px;
}

.error-container {
  padding: 40px;
  text-align: center;
}

.markdown-content,
.manual-content {
  padding: 24px;
  color: #262626;
  line-height: 1.6;
  font-size: 14px;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  color: #262626;
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
}

.markdown-content :deep(h1:first-child),
.manual-content :deep(h1:first-child) {
  margin-top: 0;
}

.markdown-content :deep(p),
.manual-content :deep(p) {
  margin-bottom: 16px;
}

.markdown-content :deep(pre),
.manual-content :deep(pre) {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-content :deep(code),
.manual-content :deep(code) {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: #e83e8c;
}

.markdown-content :deep(blockquote),
.manual-content :deep(blockquote) {
  border-left: 4px solid #d9d9d9;
  padding: 0 16px;
  margin: 16px 0;
  color: #595959;
  font-style: italic;
}

.markdown-content :deep(table),
.manual-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
  font-size: 13px;
}

.markdown-content :deep(th),
.markdown-content :deep(td),
.manual-content :deep(th),
.manual-content :deep(td) {
  border: 1px solid #e8e8e8;
  padding: 8px 12px;
  text-align: left;
}

.markdown-content :deep(th),
.manual-content :deep(th) {
  background: #fafafa;
  font-weight: 600;
}

.markdown-content :deep(ul),
.manual-content :deep(ol),
.manual-content :deep(ul),
.manual-content :deep(ol) {
  padding-left: 24px;
  margin-bottom: 16px;
}

.markdown-content :deep(li),
.manual-content :deep(li) {
  margin-bottom: 4px;
}

.mermaid-error {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 6px;
  padding: 16px;
  color: #ff4d4f;
  text-align: center;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .detail-header {
    padding: 12px 16px;
  }
  
  .tool-info-card,
  .document-content {
    margin: 16px;
  }
  
  .card-title {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .tool-actions {
    justify-content: flex-start;
  }
  
  .author-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>