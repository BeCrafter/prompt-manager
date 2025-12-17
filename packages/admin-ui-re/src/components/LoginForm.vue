<template>
  <div class="login-container">
    <div class="login-background">
      <div class="floating-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
      </div>
    </div>
    
    <div class="login-content">
      <div class="login-left">
        <div class="brand-info">
          <div class="logo-container">
            <div class="logo-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" fill="none"/>
              </svg>
            </div>
            <h1 class="brand-name">Prompt Manager</h1>
            <p class="brand-subtitle">智能提示词管理平台</p>
          </div>
          <div class="features">
            <div class="feature-item">
              <div class="feature-icon">🚀</div>
              <span>高效管理</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon">💡</div>
              <span>智能提示</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔒</div>
              <span>安全可靠</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="login-right">
        <a-form
          :model="formState"
          name="login"
          class="login-form"
          @finish="handleFinish"
          @finishFailed="handleFinishFailed"
        >
          <div class="login-box">
            <div class="login-header">
              <h2>欢迎回来</h2>
              <p>请登录您的账户以继续</p>
            </div>
            
            <a-form-item
              name="username"
              :rules="[{ required: true, message: '请输入用户名!' }]"
            >
              <a-input
                v-model:value="formState.username"
                placeholder="用户名"
                autocomplete="username"
                size="large"
                class="login-input"
              >
                <template #prefix>
                  <UserOutlined />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item
              name="password"
              :rules="[{ required: true, message: '请输入密码!' }]"
            >
              <a-input-password
                v-model:value="formState.password"
                placeholder="密码"
                autocomplete="current-password"
                size="large"
                class="login-input"
              >
                <template #prefix>
                  <LockOutlined />
                </template>
              </a-input-password>
            </a-form-item>

            <a-form-item>
              <a-button
                type="primary"
                html-type="submit"
                class="login-button"
                size="large"
                :loading="loading"
                block
              >
                <span v-if="!loading">登录</span>
                <span v-else>登录中...</span>
              </a-button>
            </a-form-item>

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
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue';
import { api } from '../services/api';

const emit = defineEmits(['login']);

const loading = ref(false);
const errorMessage = ref('');

const formState = reactive({
  username: '',
  password: '',
});

const handleFinish = async (values) => {
  loading.value = true;
  errorMessage.value = '';
  
  try {
    await api.login(values.username, values.password);
    message.success({
      content: '登录成功',
      duration: 2,
    });
    emit('login');
  } catch (error) {
    errorMessage.value = error.message || '登录失败';
    message.error({
      content: errorMessage.value,
      duration: 3,
    });
  } finally {
    loading.value = false;
  }
};

const handleFinishFailed = (errorInfo) => {
  console.log('Failed:', errorInfo);
  message.error('请检查输入信息');
};

onMounted(async () => {
  // 如果不需要认证，直接获取令牌并触发登录
  if (!api.requireAuth) {
    loading.value = true;
    try {
      await api.fetchToken();
      emit('login');
    } catch (error) {
      console.error('自动获取令牌失败:', error);
      errorMessage.value = '获取访问权限失败';
    } finally {
      loading.value = false;
    }
  }
});
</script>

<style scoped>
.login-container {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.login-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 1;
}

.floating-shapes {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 6s ease-in-out infinite;
}

.shape-1 {
  width: 80px;
  height: 80px;
  top: 20%;
  left: 10%;
  animation-delay: 0s;
}

.shape-2 {
  width: 120px;
  height: 120px;
  top: 60%;
  right: 10%;
  animation-delay: 2s;
}

.shape-3 {
  width: 60px;
  height: 60px;
  bottom: 20%;
  left: 30%;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
  }
}

.login-content {
  position: relative;
  z-index: 2;
  display: flex;
  width: 100%;
  max-width: 1200px;
  height: 600px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.login-left {
  flex: 1;
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: white;
}

.brand-info {
  text-align: center;
}

.logo-container {
  margin-bottom: 40px;
}

.logo-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.logo-icon svg {
  width: 40px;
  height: 40px;
  color: white;
}

.brand-name {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(45deg, #ffffff, #e6f7ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin: 0;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 40px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  opacity: 0.9;
}

.feature-icon {
  font-size: 20px;
}

.login-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.login-form {
  width: 100%;
  max-width: 400px;
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h2 {
  font-size: 28px;
  font-weight: 600;
  color: #262626;
  margin: 0 0 8px 0;
}

.login-header p {
  font-size: 14px;
  color: #8c8c8c;
  margin: 0;
}

.login-input {
  height: 48px;
  border-radius: 8px;
  border: 1px solid #d9d9d9;
  transition: all 0.3s ease;
}

.login-input:hover {
  border-color: #40a9ff;
}

.login-input:focus,
.login-input:focus-within {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.login-button {
  height: 48px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
  transition: all 0.3s ease;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(24, 144, 255, 0.4);
}

.login-button:active {
  transform: translateY(0);
}

.error-alert {
  margin-top: 16px;
  border-radius: 8px;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

:deep(.ant-form-item) {
  margin-bottom: 20px;
}

:deep(.ant-form-item-explain-error) {
  font-size: 12px;
}

:deep(.ant-input-prefix) {
  color: #8c8c8c;
}

:deep(.ant-input-affix-wrapper) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

:deep(.ant-input-affix-wrapper:hover) {
  border-color: #40a9ff;
}

:deep(.ant-input-affix-wrapper-focused) {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .login-content {
    flex-direction: column;
    height: auto;
    max-width: 400px;
    margin: 20px;
  }
  
  .login-left {
    padding: 30px 20px;
  }
  
  .login-right {
    padding: 30px 20px;
  }
  
  .brand-name {
    font-size: 24px;
  }
  
  .login-box {
    padding: 30px 20px;
  }
}

@media (max-width: 480px) {
  .login-content {
    margin: 10px;
    border-radius: 12px;
  }
  
  .login-left,
  .login-right {
    padding: 20px 15px;
  }
  
  .login-box {
    padding: 20px 15px;
  }
}
</style>