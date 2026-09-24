const { app, BrowserWindow, shell, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

// ─── Auto-Updater (electron-updater via GitHub Releases) ─────────────────────
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = true;          // baixa silenciosamente em background
  autoUpdater.autoInstallOnAppQuit = true;  // instala quando o usuário fechar
  autoUpdater.logger = require('electron').nativeTheme; // silencia logs no console
  autoUpdater.logger = null;
} catch {
  // electron-updater não disponível em dev/portable — ignora silenciosamente
}

// Enable GPU Hardware Acceleration for buttery smooth 4K/60fps playback
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,PlatformHEVCDecoderSupport');

let mainWindow;

function notifyFullscreenChanged() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('window-fullscreen-changed', mainWindow.isFullScreen());
  } catch {}
}

function setAppFullscreen(enabled) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  const next = Boolean(enabled);
  // Electron's OS-level fullscreen is required here. DOM fullscreen alone does
  // not reliably cover the Windows taskbar when a native VLC surface is used.
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setFullScreen(next);
  return next;
}

function formatHms(seconds) {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function queryWindowsRegistryPath(key, valueName = '') {
  if (process.platform !== 'win32') return null;
  try {
    const valArg = valueName ? `/v "${valueName}"` : '/ve';
    const out = execSync(`reg query "${key}" ${valArg}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 1000,
    });
    const match = out.match(/REG_SZ\s+(.*)/i);
    if (match && match[1]) {
      let p = match[1].trim();
      if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
      if (fs.existsSync(p)) return p;
      for (const exeName of ['vlc.exe', 'mpv.exe', 'mpc-hc64.exe', 'mpc-hc.exe', 'PotPlayer64.exe', 'PotPlayer.exe']) {
        const full = path.join(p, exeName);
        if (fs.existsSync(full)) return full;
      }
    }
  } catch {}
  return null;
}

// Player definitions for Windows, Linux, and macOS
function getPlayerDefinitions() {
  const isWin = process.platform === 'win32';
  const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA || '';
  const userProfile = process.env.USERPROFILE || '';

  return {
    system: {
      id: 'system',
      name: 'Player Padrão do Windows',
      paths: [],
      cmd: '',
      buildArgs: () => [],
    },
    vlc: {
      id: 'vlc',
      name: 'VLC Media Player',
      paths: isWin
        ? [
            path.join(progFiles, 'VideoLAN', 'VLC', 'vlc.exe'),
            path.join(progFilesX86, 'VideoLAN', 'VLC', 'vlc.exe'),
            path.join(localAppData, 'Programs', 'VideoLAN', 'VLC', 'vlc.exe'),
            'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
            'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
            'D:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
            'D:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
            'D:\\VideoLAN\\VLC\\vlc.exe',
            'C:\\VLC\\vlc.exe',
            'D:\\VLC\\vlc.exe',
          ]
        : ['/usr/bin/vlc', '/usr/local/bin/vlc', '/Applications/VLC.app/Contents/MacOS/VLC'],
      cmd: 'vlc.exe',
      buildArgs: (url, title, startTime) =>
        [
          url,
          '--fullscreen',
          title ? `--meta-title=${title}` : '',
          startTime && startTime > 5 ? `--start-time=${Math.floor(startTime)}` : '',
        ].filter(Boolean),
    },
    mpv: {
      id: 'mpv',
      name: 'MPV Player',
      paths: isWin
        ? [
            path.join(progFiles, 'mpv', 'mpv.exe'),
            path.join(progFiles, 'MPV', 'mpv.exe'),
            'C:\\mpv\\mpv.exe',
            'D:\\mpv\\mpv.exe',
            path.join(localAppData, 'Programs', 'mpv', 'mpv.exe'),
            path.join(userProfile, 'scoop', 'apps', 'mpv', 'current', 'mpv.exe'),
            path.join(userProfile, 'AppData', 'Local', 'Programs', 'mpv', 'mpv.exe'),
          ]
        : ['/usr/bin/mpv', '/usr/local/bin/mpv', '/Applications/mpv.app/Contents/MacOS/mpv'],
      cmd: 'mpv.exe',
      buildArgs: (url, title, startTime) =>
        [
          url,
          '--fs',
          title ? `--title=${title}` : '',
          '--force-window=yes',
          startTime && startTime > 5 ? `--start=${Math.floor(startTime)}` : '',
        ].filter(Boolean),
    },
    mpc: {
      id: 'mpc',
      name: 'Media Player Classic (MPC-HC)',
      paths: isWin
        ? [
            path.join(progFiles, 'MPC-HC', 'mpc-hc64.exe'),
            path.join(progFilesX86, 'MPC-HC', 'mpc-hc.exe'),
            path.join(progFiles, 'MPC-BE x64', 'mpc-be64.exe'),
            path.join(progFilesX86, 'MPC-BE', 'mpc-be.exe'),
            path.join(progFiles, 'K-Lite Codec Pack', 'MPC-HC64', 'mpc-hc64.exe'),
            path.join(progFilesX86, 'K-Lite Codec Pack', 'MPC-HC', 'mpc-hc.exe'),
          ]
        : [],
      cmd: 'mpc-hc64.exe',
      buildArgs: (url, title, startTime) =>
        [
          url,
          '/fullscreen',
          startTime && startTime > 5 ? `/startpos ${formatHms(startTime)}` : '',
        ].filter(Boolean),
    },
    potplayer: {
      id: 'potplayer',
      name: 'PotPlayer',
      paths: isWin
        ? [
            path.join(progFiles, 'DAUM', 'PotPlayer', 'PotPlayer64.exe'),
            path.join(progFilesX86, 'DAUM', 'PotPlayer', 'PotPlayer.exe'),
            path.join(progFiles, 'PotPlayer', 'PotPlayer64.exe'),
            path.join(progFilesX86, 'PotPlayer', 'PotPlayer.exe'),
          ]
        : [],
      cmd: 'PotPlayer64.exe',
      buildArgs: (url, title, startTime) =>
        [
          url,
          startTime && startTime > 5 ? `/seek=${formatHms(startTime)}` : '',
        ].filter(Boolean),
    },
  };
}

function findExecutable(def) {
  if (def.id === 'system') {
    return 'system';
  }

  // 1. Check predefined paths
  for (const p of def.paths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  // 2. Windows Registry lookup
  if (process.platform === 'win32') {
    const regKeys = [
      `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${def.cmd}`,
      `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${def.cmd}`,
      `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${def.cmd}`,
    ];
    if (def.id === 'vlc') {
      regKeys.push('HKLM\\SOFTWARE\\VideoLAN\\VLC');
      regKeys.push('HKLM\\SOFTWARE\\WOW6432Node\\VideoLAN\\VLC');
    }
    for (const key of regKeys) {
      const found = queryWindowsRegistryPath(key);
      if (found) return found;
      const foundVal = queryWindowsRegistryPath(key, 'InstallDir');
      if (foundVal) return foundVal;
    }
  }

  // 3. Check PATH via where (Windows) or which (Linux/macOS)
  try {
    const isWin = process.platform === 'win32';
    const checkCmd = isWin ? `where ${def.cmd}` : `which ${def.cmd}`;
    const output = execSync(checkCmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 1000 });
    const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && fs.existsSync(lines[0])) {
      return lines[0];
    }
  } catch {
    // Not found in PATH
  }

  return null;
}

function scanInstalledPlayers() {
  const definitions = getPlayerDefinitions();
  const results = [];

  for (const [id, def] of Object.entries(definitions)) {
    const foundPath = findExecutable(def);
    results.push({
      id,
      name: def.name,
      installed: Boolean(foundPath),
      path: foundPath || undefined,
    });
  }

  return results;
}

function launchPlayerExecutable(playerId, url, title, startTime) {
  // If user requested system default player
  if (playerId === 'system') {
    try {
      const tempM3u = path.join(app.getPath('temp'), `aurastream_${Date.now()}.m3u`);
      const m3uContent = `#EXTM3U\n#EXTINF:-1,${title || 'AuraStream 4K'}\n${url}\n`;
      fs.writeFileSync(tempM3u, m3uContent, 'utf8');
      shell.openPath(tempM3u);
      return { success: true, player: 'Player Padrão do Windows', path: tempM3u };
    } catch {
      shell.openExternal(url);
      return { success: true, player: 'Player Padrão', fallback: 'openExternal' };
    }
  }

  const definitions = getPlayerDefinitions();
  const def = definitions[playerId] || definitions.vlc;

  if (!def) {
    throw new Error(`Player "${playerId}" não é suportado.`);
  }

  const foundPath = findExecutable(def);
  const args = def.buildArgs(url, title, startTime);

  if (foundPath && foundPath !== 'system') {
    const child = spawn(foundPath, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return { success: true, player: def.name, path: foundPath };
  }

  // Fallback on Windows: try launching command via cmd shell
  if (process.platform === 'win32') {
    try {
      const child = spawn(def.cmd, args, {
        detached: true,
        stdio: 'ignore',
        shell: true,
      });
      child.unref();
      return { success: true, player: def.name, fallbackCmd: def.cmd };
    } catch {}
  }

  // Universal fallback: launch via temporary .m3u playlist in system default player
  try {
    const tempM3u = path.join(app.getPath('temp'), `aurastream_${Date.now()}.m3u`);
    const m3uContent = `#EXTM3U\n#EXTINF:-1,${title || 'AuraStream 4K'}\n${url}\n`;
    fs.writeFileSync(tempM3u, m3uContent, 'utf8');
    shell.openPath(tempM3u);
    return { success: true, player: 'Player Padrão do Windows', path: tempM3u };
  } catch {
    shell.openExternal(url);
    return { success: true, player: def.name, fallback: 'openExternal' };
  }
}

// IPC Handlers
ipcMain.handle('get-installed-players', async () => {
  return scanInstalledPlayers();
});

ipcMain.handle('toggle-window-fullscreen', async () => {
  return setAppFullscreen(!mainWindow?.isFullScreen());
});

ipcMain.handle('set-window-fullscreen', async (event, enabled) => {
  return setAppFullscreen(enabled);
});

ipcMain.handle('is-window-fullscreen', async () => {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen());
});

ipcMain.handle('launch-player', async (event, { player, url, title, startTime }) => {
  try {
    const result = launchPlayerExecutable(player, url, title, startTime);
    return result;
  } catch (err) {
    console.error('Failed to launch player:', err);
    return { success: false, error: err.message };
  }
});

let nativePlayerChild = null;
let nativePlayerSender = null;

function getLibVlcDir() {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'AuraPlayer') : null,
    path.join(__dirname, 'native-player', 'publish'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(path.join(p, 'libvlc.dll'))) || null;
}

function getEmbedPlayerPath() {
  const dir = getLibVlcDir();
  if (!dir) return null;
  const exe = path.join(dir, 'embedplayer.exe');
  return fs.existsSync(exe) ? exe : null;
}

function hwndToString() {
  if (!mainWindow) return '0';
  const buf = mainWindow.getNativeWindowHandle();
  if (Buffer.isBuffer(buf) && buf.length >= 8) {
    return buf.readBigUInt64LE(0).toString();
  }
  if (Buffer.isBuffer(buf) && buf.length >= 4) {
    return buf.readUInt32LE(0).toString();
  }
  return '0';
}

function displayScale() {
  try {
    if (!mainWindow) return 1;
    return screen.getDisplayMatching(mainWindow.getBounds()).scaleFactor || 1;
  } catch {
    return 1;
  }
}

function dipToScreen(bounds) {
  const scale = displayScale();
  const content = mainWindow ? mainWindow.getContentBounds() : { x: 0, y: 0, width: 1280, height: 720 };
  return {
    x: Math.round((content.x + (bounds?.x || 0)) * scale),
    y: Math.round((content.y + (bounds?.y || 0)) * scale),
    w: Math.max(8, Math.round((bounds?.w || content.width || 1280) * scale)),
    h: Math.max(8, Math.round((bounds?.h || content.height || 720) * scale)),
  };
}

function stopNativePlayer() {
  if (!nativePlayerChild) return;
  const child = nativePlayerChild;
  nativePlayerChild = null;
  try {
    if (child.stdin && !child.stdin.destroyed) {
      child.stdin.write(JSON.stringify({ cmd: 'quit' }) + '\n');
    }
  } catch {}
  setTimeout(() => {
    try { child.kill(); } catch {}
  }, 400);
}

function sendNativeEvent(data) {
  try {
    if (nativePlayerSender && !nativePlayerSender.isDestroyed()) {
      nativePlayerSender.send('native-player-event', data);
    }
  } catch {}
}

function sendNativeCommand(cmd) {
  if (!nativePlayerChild || !nativePlayerChild.stdin || nativePlayerChild.stdin.destroyed) return false;
  try {
    nativePlayerChild.stdin.write(JSON.stringify(cmd) + '\n');
    return true;
  } catch {
    return false;
  }
}

function startNativePlayer(opts, sender) {
  stopNativePlayer();
  nativePlayerSender = sender || null;
  const url = opts?.url;
  const startTime = opts?.startTime || 0;
  const preferAudio = opts?.preferAudio || 'pt-br';
  const autoSubs = opts?.autoSubs || 'auto';

  if (!url) {
    return { success: false, error: 'URL do vídeo não informada.' };
  }
  if (process.platform !== 'win32') {
    return { success: false, error: 'Player embutido disponível no aplicativo Windows.' };
  }

  const exe = getEmbedPlayerPath();
  const dir = getLibVlcDir();
  if (!exe || !dir) {
    return { success: false, error: 'Motor VLC embutido não encontrado no pacote do aplicativo.' };
  }

  const hwnd = hwndToString();
  const screenBox = dipToScreen(opts?.bounds || { x: 0, y: 72, w: 1280, h: 600 });
  const initX = screenBox.x;
  const initY = screenBox.y;
  const initW = Math.max(64, screenBox.w);
  const initH = Math.max(64, screenBox.h);

  const args = [
    '--url', String(url),
    '--parent-hwnd', hwnd,
    '--x', String(initX),
    '--y', String(initY),
    '--w', String(initW),
    '--h', String(initH),
    '--start', String(Math.floor(startTime)),
    '--prefer-audio', String(preferAudio),
    '--auto-subs', String(autoSubs),
    '--libvlc-dir', dir,
  ];

  const child = spawn(exe, args, {
    cwd: dir,
    env: {
      ...process.env,
      PATH: `${dir};${process.env.PATH || ''}`,
      VLC_PLUGIN_PATH: path.join(dir, 'plugins'),
      AURA_LIBVLC_DIR: dir,
    },
    detached: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  nativePlayerChild = child;

  let buf = '';
  const onData = (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('AURA ')) continue;
      try {
        sendNativeEvent(JSON.parse(trimmed.slice(5)));
      } catch {}
    }
  };
  if (child.stdout) child.stdout.on('data', onData);
  if (child.stderr) child.stderr.on('data', onData);
  child.on('exit', () => {
    if (nativePlayerChild === child) nativePlayerChild = null;
    sendNativeEvent({ type: 'stopped' });
  });
  child.on('error', (err) => {
    sendNativeEvent({ type: 'error', message: err.message });
  });
  console.log(`[Native Player] Embedded libVLC inside app HWND=${hwnd}`);
  return { success: true, engine: 'embed' };
}

ipcMain.handle('start-native-player', async (event, opts) => {
  try {
    return startNativePlayer(opts, event.sender);
  } catch (err) {
    console.error('Failed to start native player:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-native-player', async () => {
  stopNativePlayer();
  return { success: true };
});

ipcMain.handle('native-player-command', async (event, cmd) => {
  return { success: sendNativeCommand(cmd || {}) };
});

ipcMain.handle('native-player-bounds', async (event, bounds) => {
  const box = dipToScreen(bounds);
  sendNativeCommand({ cmd: 'bounds', x: box.x, y: box.y, w: box.w, h: box.h });
  return { success: true };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0c',
    title: 'AuraStream 4K',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const serverUrl = process.env.AURA_URL || 'http://151.247.210.55:7700/?app=true';
  mainWindow.loadURL(serverUrl);

  // Handle external links (e.g., VLC or Stremio protocol links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('vlc://') || url.startsWith('stremio://') || url.startsWith('intent://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Handle connection errors gracefully by auto-retrying
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[Desktop] Connection issue (${errorDescription}). Retrying in 2.5s...`);
    setTimeout(() => {
      if (mainWindow) mainWindow.loadURL(serverUrl);
    }, 2500);
  });

  // Keyboard navigation for Desktop / TV Mode
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') {
      setAppFullscreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'Escape' && mainWindow.isFullScreen()) {
      setAppFullscreen(false);
      event.preventDefault();
    }
  });

  const askReposition = () => sendNativeEvent({ type: 'reposition' });
  mainWindow.on('resize', askReposition);
  mainWindow.on('move', askReposition);
  mainWindow.on('enter-full-screen', () => {
    notifyFullscreenChanged();
    askReposition();
  });
  mainWindow.on('leave-full-screen', () => {
    notifyFullscreenChanged();
    askReposition();
  });
  mainWindow.on('minimize', () => sendNativeCommand({ cmd: 'bounds', x: 0, y: 0, w: 1, h: 1 }));
  mainWindow.on('restore', askReposition);

  mainWindow.on('closed', () => {
    stopNativePlayer();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // ─── Auto-Update: verifica nova versão 5 segundos após abrir ─────────────
  if (autoUpdater) {
    autoUpdater.on('update-available', (info) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes || '',
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    });

    autoUpdater.on('update-downloaded', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('update-downloaded');
    });

    autoUpdater.on('error', (err) => {
      // Ignora silenciosamente erros de update (sem internet, etc.)
      console.warn('[AutoUpdate] Erro ao verificar atualização:', err?.message || err);
    });

    // Verificar atualização 5 segundos depois de abrir (não trava o launch)
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 5000);

    // Verificar a cada 4 horas enquanto o app estiver aberto
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 4 * 60 * 60 * 1000);
  }

  // IPC: o renderer pede para instalar a atualização baixada e reiniciar
  ipcMain.handle('update-quit-and-install', () => {
    if (autoUpdater) autoUpdater.quitAndInstall(false, true);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
