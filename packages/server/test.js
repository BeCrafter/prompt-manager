// 测试文件，用于验证库是否能正确导入和使用
import assert from 'assert';

// 测试导入
try {
  // 动态导入所有导出的函数和对象
  const {
    startServer,
    stopServer,
    getServerState,
    getServerAddress,
    isServerRunning,
    app,
    config,
    logger,
    util,
    promptManager,
    getMcpServer,
    handleGetPrompt,
    handleSearchPrompts,
    handleReloadPrompts,
    adminRouter,
    openRouter,
    adminAuthMiddleware
  } = await import('./index.js');

  console.log('✓ 所有模块成功导入');

  // 测试配置对象
  assert(typeof config !== 'undefined', 'Config should be defined');
  assert(typeof config.getPort === 'function', 'Config should have getPort method');
  console.log('✓ 配置对象测试通过');

  // 测试日志对象
  assert(typeof logger !== 'undefined', 'Logger should be defined');
  assert(typeof logger.info === 'function', 'Logger should have info method');
  console.log('✓ 日志对象测试通过');

  // 测试工具对象
  assert(typeof util !== 'undefined', 'Util should be defined');
  assert(typeof util.getPromptsFromFiles === 'function', 'Util should have getPromptsFromFiles method');
  console.log('✓ 工具对象测试通过');

  // 测试提示词管理器
  assert(typeof promptManager !== 'undefined', 'PromptManager should be defined');
  assert(typeof promptManager.getPrompts === 'function', 'PromptManager should have getPrompts method');
  console.log('✓ 提示词管理器测试通过');

  // 测试服务器状态函数
  assert(typeof getServerState === 'function', 'getServerState should be a function');
  assert(typeof getServerAddress === 'function', 'getServerAddress should be a function');
  assert(typeof isServerRunning === 'function', 'isServerRunning should be a function');
  console.log('✓ 服务器状态函数测试通过');

  console.log('\n🎉 所有测试通过！库已正确封装。');
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  process.exit(1);
}