import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue';
import { ConfigProvider, theme } from 'ant-design-vue';

// 导入样式
import '../css/vue-app.css';
import '../css/recommended-prompts.css';

const app = createApp(App);

// 注册Ant Design Vue
app.use(Antd);

// 全局主题配置
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
  algorithm: theme.defaultAlgorithm,
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

app.provide('themeConfig', themeConfig);

// 添加错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue应用错误:', err, info);
};

// 添加警告处理
app.config.warnHandler = (msg, vm, trace) => {
  console.warn('Vue应用警告:', msg, trace);
};

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
});

console.log('Vue应用准备挂载...');
app.mount('#app');
console.log('Vue应用已挂载');