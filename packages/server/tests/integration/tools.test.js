/**
 * 工具系统测试文件
 *
 * 用于验证工具加载、工具管理等功能是否正常工作
 */

import { toolLoaderService } from './tool-loader.service.js';
import { handleToolM } from './tool-manager.handler.js';

// 测试工具加载服务
async function testToolLoader() {
  console.log('\n========== 测试工具加载服务 ==========\n');

  try {
    // 初始化工具加载器
    console.log('1. 初始化工具加载器...');
    await toolLoaderService.initialize();
    console.log('✓ 工具加载器初始化成功');

    // 获取所有工具列表
    console.log('\n2. 获取所有工具列表...');
    const tools = toolLoaderService.getAllTools();
    console.log(`✓ 共加载 ${tools.length} 个工具:`);
    tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.metadata.description || '无描述'}`);
    });

    // 检查 filesystem 工具是否存在
    console.log('\n3. 检查 filesystem 工具是否存在...');
    const hasFilesystem = toolLoaderService.hasTool('filesystem');
    if (hasFilesystem) {
      console.log('✓ filesystem 工具已加载');

      // 获取 filesystem 工具详情
      const filesystemTool = toolLoaderService.getTool('filesystem');
      console.log('  - 元数据:', filesystemTool.metadata);
    } else {
      console.log('✗ filesystem 工具未找到');
    }

    return true;
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 测试手册模式
async function testManualMode() {
  console.log('\n========== 测试手册模式 (manual) ==========\n');

  try {
    const yamlInput = `tool: tool://filesystem
mode: manual`;

    console.log('YAML 输入:');
    console.log(yamlInput);
    console.log('\n执行 handleToolM...');

    const result = await handleToolM({ yaml: yamlInput });

    console.log('\n✓ 手册模式执行成功');
    console.log('返回结果类型:', result.content[0].type);
    console.log('手册内容长度:', result.content[0].text.length, '字符');
    console.log('\n手册内容预览（前 500 字符）:');
    console.log(result.content[0].text.substring(0, 500));
    console.log('...\n');

    return true;
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 测试执行模式
async function testExecuteMode() {
  console.log('\n========== 测试执行模式 (execute) ==========\n');

  try {
    const yamlInput = `tool: tool://filesystem
mode: execute
parameters:
  method: list_allowed_directories`;

    console.log('YAML 输入:');
    console.log(yamlInput);
    console.log('\n执行 handleToolM...');

    const result = await handleToolM({ yaml: yamlInput });

    console.log('\n✓ 执行模式测试成功');
    console.log('返回结果:');
    console.log(result.content[0].text);

    return true;
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 测试配置模式
async function testConfigureMode() {
  console.log('\n========== 测试配置模式 (configure) ==========\n');

  try {
    const yamlInput = `tool: tool://filesystem
mode: configure
parameters:
  ALLOWED_DIRECTORIES: '["~/.prompt-manager", "/tmp"]'`;

    console.log('YAML 输入:');
    console.log(yamlInput);
    console.log('\n执行 handleToolM...');

    const result = await handleToolM({ yaml: yamlInput });

    console.log('\n✓ 配置模式测试成功');
    console.log('返回结果:');
    console.log(result.content[0].text);

    return true;
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 测试日志模式
async function testLogMode() {
  console.log('\n========== 测试日志模式 (log) ==========\n');

  try {
    const yamlInput = `tool: tool://filesystem
mode: log
parameters:
  action: tail
  lines: 50`;

    console.log('YAML 输入:');
    console.log(yamlInput);
    console.log('\n执行 handleToolM...');

    const result = await handleToolM({ yaml: yamlInput });

    console.log('\n✓ 日志模式测试成功');
    console.log('返回结果:');
    console.log(result.content[0].text);

    return true;
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 测试错误处理
async function testErrorHandling() {
  console.log('\n========== 测试错误处理 ==========\n');

  try {
    console.log('1. 测试不存在的工具...');
    try {
      const yamlInput = `tool: tool://nonexistent
mode: execute`;
      await handleToolM({ yaml: yamlInput });
      console.log('✗ 应该抛出错误但没有');
      return false;
    } catch (error) {
      console.log('✓ 正确抛出错误:', error.message.split('\n')[0]);
    }

    console.log('\n2. 测试缺少必需参数...');
    try {
      await handleToolM({});
      console.log('✗ 应该抛出错误但没有');
      return false;
    } catch (error) {
      console.log('✓ 正确抛出错误:', error.message);
    }

    console.log('\n3. 测试无效的工具格式...');
    try {
      const yamlInput = `tool: filesystem
mode: execute`;
      await handleToolM({ yaml: yamlInput });
      console.log('✗ 应该抛出错误但没有');
      return false;
    } catch (error) {
      console.log('✓ 正确抛出错误:', error.message.split('\n')[0]);
    }

    return true;
  } catch (error) {
    console.error('✗ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 主测试函数
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     Prompt Manager 工具系统测试套件           ║');
  console.log('╚════════════════════════════════════════════════╝');

  const results = [];

  // 运行所有测试
  results.push({ name: '工具加载服务', passed: await testToolLoader() });
  results.push({ name: '手册模式', passed: await testManualMode() });
  results.push({ name: '执行模式', passed: await testExecuteMode() });
  results.push({ name: '配置模式', passed: await testConfigureMode() });
  results.push({ name: '日志模式', passed: await testLogMode() });
  results.push({ name: '错误处理', passed: await testErrorHandling() });

  // 输出测试总结
  console.log('\n');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║              测试结果总结                      ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} - ${result.name}`);
  });

  console.log('\n');
  console.log(`总计: ${results.length} 个测试`);
  console.log(`通过: ${passed} 个`);
  console.log(`失败: ${failed} 个`);
  console.log('\n');

  if (failed === 0) {
    console.log('🎉 所有测试通过！工具系统运行正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查错误信息。');
  }

  return failed === 0;
}

// 运行测试
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
