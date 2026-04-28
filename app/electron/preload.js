const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  sendNotification: (opts) => ipcRenderer.invoke('send-notification', opts),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
})
