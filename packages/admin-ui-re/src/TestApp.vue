<template>
  <div class="test-app">
    <h1>Vue应用测试</h1>
    <p>如果你能看到这个页面，说明Vue应用已经成功加载。</p>
    <a-button type="primary" @click="showMessage">点击测试</a-button>
  </div>
</template>

<script setup>
import { message } from 'ant-design-vue';

const showMessage = () => {
  message.success('Vue和Ant Design Vue工作正常！');
};
</script>

<style scoped>
.test-app {
  padding: 20px;
  text-align: center;
}
</style>