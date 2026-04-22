import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onMenuEvent: (callback: (event: string) => void) => {
    ipcRenderer.on('menu-event', (_event, value) => callback(value));
    return () => {
      ipcRenderer.removeAllListeners('menu-event');
    };
  }
});
