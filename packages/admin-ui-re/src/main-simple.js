import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import SimpleApp from './SimpleApp.vue';

console.log('加载简单应用...');

const app = createApp(SimpleApp);
app.use(Antd);

app.mount('#app');

console.log('简单应用已挂载');