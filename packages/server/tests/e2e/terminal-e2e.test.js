/**
 * 终端E2E测试
 */

import { test, expect } from '@playwright/test';

test.describe('终端功能E2E测试', () => {
  test.beforeEach(async ({ page }) => {
    // 导航到管理员界面
    await page.goto('/admin/');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    // 点击终端导航
    await page.click('[data-nav="terminal"]');

    // 等待终端区域显示
    await page.waitForSelector('#terminalArea', { state: 'visible' });
  });

  test('应该显示终端界面', async ({ page }) => {
    // 验证终端区域存在
    await expect(page.locator('#terminalArea')).toBeVisible();

    // 验证终端标题
    await expect(page.locator('.terminal-title')).toContainText('终端');

    // 验证终端内容区域
    await expect(page.locator('.terminal-content')).toBeVisible();
  });

  test('应该建立WebSocket连接', async ({ page }) => {
    // 等待WebSocket连接建立
    await page.waitForSelector('.status-indicator.connected', { timeout: 10000 });

    // 验证连接状态显示
    await expect(page.locator('.status-text')).toContainText('已连接');
  });

  test('应该支持基本命令执行', async ({ page }) => {
    // 等待终端初始化
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 模拟输入命令
    await page.keyboard.type('echo "Hello, E2E Test!"');
    await page.keyboard.press('Enter');

    // 等待命令执行结果
    await page.waitForTimeout(2000);

    // 验证命令输出（这里需要根据实际终端实现调整）
    // 由于使用xterm.js，我们需要检查终端内容
    const terminalContent = await page.locator('.xterm-screen').textContent();
    expect(terminalContent).toContain('Hello, E2E Test!');
  });

  test('应该支持多个命令执行', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 执行多个命令
    const commands = ['pwd', 'ls -la', 'whoami'];

    for (const command of commands) {
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    // 验证所有命令都已执行
    const terminalContent = await page.locator('.xterm-screen').textContent();

    // 验证命令历史
    for (const command of commands) {
      expect(terminalContent).toContain(command);
    }
  });

  test('应该支持终端大小调整', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 获取初始终端大小
    const initialTerminal = page.locator('.xterm-screen');
    const initialBounds = await initialTerminal.boundingBox();

    // 调整浏览器窗口大小
    await page.setViewportSize({ width: 1200, height: 800 });

    // 等待终端适应新大小
    await page.waitForTimeout(1000);

    // 验证终端已调整大小
    const adjustedTerminal = page.locator('.xterm-screen');
    const adjustedBounds = await adjustedTerminal.boundingBox();

    // 终端应该适应新的窗口大小
    expect(adjustedBounds.width).toBeGreaterThan(initialBounds.width);
  });

  test('应该支持主题切换', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 获取初始主题
    const terminal = page.locator('.xterm');
    const initialBackground = await terminal.evaluate(el => getComputedStyle(el).getPropertyValue('background-color'));

    // 点击主题切换按钮
    await page.click('#themeBtn');

    // 等待主题切换
    await page.waitForTimeout(500);

    // 验证主题已改变
    const newBackground = await terminal.evaluate(el => getComputedStyle(el).getPropertyValue('background-color'));

    expect(newBackground).not.toBe(initialBackground);
  });

  test('应该支持搜索功能', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 输入一些文本
    await page.keyboard.type('echo "search test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // 点击搜索按钮
    await page.click('#searchBtn');

    // 输入搜索词
    const searchInput = await page.locator('.xterm-search input');
    await searchInput.fill('search test');

    // 验证搜索功能（这里需要根据实际搜索实现调整）
    expect(searchInput).toHaveValue('search test');
  });

  test('应该支持清除功能', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 输入一些内容
    await page.keyboard.type('echo "clear test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // 获取清除前的内容
    const contentBefore = await page.locator('.xterm-screen').textContent();
    expect(contentBefore).toContain('clear test');

    // 点击清除按钮
    await page.click('#clearBtn');

    // 等待清除完成
    await page.waitForTimeout(500);

    // 验证内容已清除（xterm.js清除后可能只保留提示符）
    const contentAfter = await page.locator('.xterm-screen').textContent();
    expect(contentAfter).not.toContain('clear test');
  });

  test('应该支持重连功能', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 等待连接建立
    await page.waitForSelector('.status-indicator.connected');

    // 点击重连按钮
    await page.click('#reconnectBtn');

    // 等待重连完成
    await page.waitForSelector('.status-indicator.connected', { timeout: 10000 });

    // 验证连接状态
    await expect(page.locator('.status-text')).toContainText('已连接');
  });

  test('应该处理连接断开', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 模拟WebSocket断开（通过页面上下文）
    await page.evaluate(() => {
      // 查找WebSocket连接并关闭
      const ws = window.terminalComponent?.websocket;
      if (ws) {
        ws.close();
      }
    });

    // 等待断开状态
    await page.waitForSelector('.status-indicator.disconnected', { timeout: 5000 });

    // 验证断开状态显示
    await expect(page.locator('.status-text')).toContainText('未连接');

    // 等待自动重连
    await page.waitForSelector('.status-indicator.connected', { timeout: 15000 });

    // 验证重连成功
    await expect(page.locator('.status-text')).toContainText('已连接');
  });

  test('应该支持键盘快捷键', async ({ page }) => {
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 测试Ctrl+C中断
    await page.keyboard.type('sleep 10');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 发送中断信号
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(1000);

    // 验证命令被中断（终端应该回到提示符状态）
    // 这里需要根据实际终端实现来验证

    // 测试Ctrl+V粘贴
    await page.evaluate(() => {
      navigator.clipboard.writeText('echo "paste test"');
    });

    await page.keyboard.press('Control+v');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // 验证粘贴内容被执行
    const terminalContent = await page.locator('.xterm-screen').textContent();
    expect(terminalContent).toContain('paste test');
  });
});

test.describe('终端性能测试', () => {
  test('应该在合理时间内建立连接', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/admin/');
    await page.click('[data-nav="terminal"]');
    await page.waitForSelector('.status-indicator.connected', { timeout: 10000 });

    const connectionTime = Date.now() - startTime;
    expect(connectionTime).toBeLessThan(5000); // 应该在5秒内连接
  });

  test('应该处理大量输出', async ({ page }) => {
    await page.goto('/admin/');
    await page.click('[data-nav="terminal"]');
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 10000 });

    // 生成大量输出的命令
    await page.keyboard.type('for i in {1..100}; do echo "Line $i"; done');
    await page.keyboard.press('Enter');

    // 等待命令执行完成
    await page.waitForTimeout(5000);

    // 验证终端仍然响应
    await page.keyboard.type('echo "Still responsive"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const terminalContent = await page.locator('.xterm-screen').textContent();
    expect(terminalContent).toContain('Still responsive');
  });
});

test.describe('跨浏览器兼容性', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`${browserName}: 应该正常工作`, async ({ page, browserName: currentBrowser }) => {
      test.skip(currentBrowser !== browserName, '跳过其他浏览器');

      await page.goto('/admin/');
      await page.click('[data-nav="terminal"]');
      await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 15000 });

      // 基本功能测试
      await page.keyboard.type('echo "Browser: $browserName"'.replace('$browserName', browserName));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      const terminalContent = await page.locator('.xterm-screen').textContent();
      expect(terminalContent).toContain(browserName);
    });
  });
});

test.describe('移动端适配', () => {
  test('应该在移动设备上正常显示', async ({ page }) => {
    // 设置移动设备视口
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/admin/');
    await page.click('[data-nav="terminal"]');
    await page.waitForSelector('.xterm-container', { state: 'visible', timeout: 15000 });

    // 验证移动端样式
    const toolbar = page.locator('.terminal-toolbar');
    await expect(toolbar).toBeVisible();

    // 验证终端仍然可用
    await page.keyboard.type('echo "Mobile test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const terminalContent = await page.locator('.xterm-screen').textContent();
    expect(terminalContent).toContain('Mobile test');
  });
});
