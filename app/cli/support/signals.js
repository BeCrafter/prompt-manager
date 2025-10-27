let isStopping = false;

export function registerSignalHandlers(stopServer) {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];

  const handle = async (signal) => {
    if (isStopping) return;
    isStopping = true;
    try {
      await stopServer();
    } catch (error) {
      console.error(`停止服务时发生错误: ${error?.message || error}`);
    } finally {
      if (signal) {
        console.log(`收到 ${signal} 信号，准备退出...`);
      }
      process.exit(0);
    }
  };

  signals.forEach((signal) => {
    process.on(signal, () => handle(signal));
  });

  process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    handle('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('未处理的 Promise 拒绝:', reason);
    handle('unhandledRejection');
  });
}
