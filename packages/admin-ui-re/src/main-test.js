import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import TestApp from './TestApp.vue';

console.log('开始加载测试应用...');

const app = createApp(TestApp);
app.use(Antd);

app.config.errorHandler = (err, vm, info) => {
  console.error('Vue错误:', err, info);
};

app.mount('#app');

console.log('测试应用已挂载');