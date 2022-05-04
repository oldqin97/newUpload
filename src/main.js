import { createApp } from 'vue';
import App from './App.vue';
import ElementPlus, { ElMessage } from 'element-plus';
import 'element-plus/dist/index.css';
import local from 'element-plus/lib/locale/lang/zh-cn';

const app = createApp(App);
// app.config.globalProperties.$message = ElMessage;
app.use(ElementPlus, { size: 'small', local });
app.mount('#app');
