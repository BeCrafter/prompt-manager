/**
 * ToolX 测试入口文件
 * 
 * 运行所有测试用例
 */

const { spawn } = require('child_process');
const path = require('path');

async function runAllTests() {
  console.log('🧪 ToolX 测试套件');
  console.log('==================\n');
  
  const testFiles = [
    'security.test.js',
    'config-loader.test.js',
    'process-pool.test.js',
    'registry.test.js',
    'interfaces.test.js',
    'adapters.test.js',
    'monitoring.test.js',
    'performance.test.js',
    'e2e.test.js'
  ];
  
  const results = [];
  
  for (const testFile of testFiles) {
    console.log(`🔍 运行测试: ${testFile}`);
    const result = await runTestFile(testFile);
    results.push({ file: testFile, ...result });
    console.log('');
  }
  
  // 生成测试报告
  generateReport(results);
}

function runTestFile(testFile) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, testFile);
    const child = spawn('node', ['-r', 'esm', testPath], { 
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      const passed = code === 0;
      console.log(`   ${passed ? '✅' : '❌'} ${testFile} ${passed ? '通过' : '失败'} (退出码: ${code})`);
      
      if (!passed) {
        console.log(`   错误输出: ${stderr.trim()}`);
      }
      
      resolve({ passed, code, stdout, stderr });
    });
  });
}

function generateReport(results) {
  console.log('\n📊 测试报告');
  console.log('============');
  
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  
  console.log(`总测试数: ${total}`);
  console.log(`通过数: ${passed}`);
  console.log(`失败数: ${failed}`);
  console.log(`通过率: ${((passed / total) * 100).toFixed(2)}%`);
  
  if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.file}`);
    });
  }
  
  // 根据测试结果设置退出码
  process.exit(failed > 0 ? 1 : 0);
}

// 如果直接运行此文件，则执行所有测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };