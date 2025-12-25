import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testToolUpload() {
  console.log('开始测试工具上传接口...');
  
  // 创建一个简单的测试ZIP文件
  const zipPath = path.join(__dirname, 'test-tool.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // 设置压缩级别
  });

  archive.pipe(output);
  
  // 添加测试文件
  archive.append('console.log("Hello World");', { name: 'test.tool.js' });
  archive.append('# Test Tool\n\nThis is a test tool.', { name: 'README.md' });
  archive.append(JSON.stringify({
    "name": "test-tool",
    "version": "1.0.0",
    "dependencies": {}
  }, null, 2), { name: 'package.json' });
  
  await archive.finalize();
  console.log('已创建测试ZIP文件:', zipPath);
  
  // 等待文件写入完成
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });
  
  // 读取ZIP文件
  const fileBuffer = fs.readFileSync(zipPath);
  
  // 创建form data
  const formData = new FormData();
  formData.append('file', fileBuffer, { filename: 'test-tool.zip' });
  
  try {
    // 发送请求到服务器
    const response = await fetch('http://localhost:5621/tool/upload', {
      method: 'POST',
      body: formData
      // 如果需要认证，添加token
      // headers: {
      //   'Authorization': 'Bearer YOUR_TOKEN_HERE'
      // }
    });
    
    const result = await response.json();
    console.log('响应状态:', response.status);
    console.log('响应数据:', result);
    
    // 清理测试文件
    fs.unlinkSync(zipPath);
    
    if (response.status === 200 && result.success) {
      console.log('✅ 上传接口测试成功');
      return true;
    } else {
      console.log('❌ 上传接口测试失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    
    // 清理测试文件
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    return false;
  }
}

testToolUpload().then(success => {
  if (success) {
    console.log('工具上传接口测试通过！');
    process.exit(0);
  } else {
    console.log('工具上传接口测试失败！');
    process.exit(1);
  }
});