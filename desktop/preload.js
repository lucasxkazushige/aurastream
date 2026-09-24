const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  launchPlayer: (player, url, title, startTime) =>
    ipcRenderer.invoke('launch-player', { player, url, title, startTime }),
  getInstalledPlayers: () => ipcRenderer.invoke('get-installed-players'),
  startNativePlayer: (opts) => ipcRenderer.invoke('start-native-player', opts),
  stopNativePlayer: () => ipcRenderer.invoke('stop-native-player'),
  nativePlayerCommand: (cmd) => ipcRenderer.invoke('native-player-command', cmd),
  nativePlayerBounds: (bounds) => ipcRenderer.invoke('native-player-bounds', bounds),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-window-fullscreen'),
  setFullscreen: (enabled) => ipcRenderer.invoke('set-window-fullscreen', enabled),
  isFullscreen: () => ipcRenderer.invoke('is-window-fullscreen'),
  onFullscreenChange: (cb) => {
    const listener = (_event, enabled) => cb(Boolean(enabled));
    ipcRenderer.on('window-fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window-fullscreen-changed', listener);
  },
  onNativePlayerEvent: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('native-player-event', listener);
  },
  removeNativePlayerListeners: () => {
    ipcRenderer.removeAllListeners('native-player-event');
  },

  // ─── Auto-Update API ───────────────────────────────────────────────────────
  onUpdateAvailable: (cb) => {
    const listener = (_event, info) => cb(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateDownloadProgress: (cb) => {
    const listener = (_event, progress) => cb(progress);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  onUpdateDownloaded: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  installUpdateAndRestart: () => ipcRenderer.invoke('update-quit-and-install'),
});

