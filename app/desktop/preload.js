const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  sendAboutWindowClick: (data) => ipcRenderer.send('about-window-click', data),
  onAboutWindowClick: (callback) => ipcRenderer.on('about-window-click-response', callback)
});