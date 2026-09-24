export interface DesktopPlayerOption {
  id: string; // 'internal' | 'vlc' | 'mpv' | 'mpc' | 'potplayer'
  name: string;
  installed?: boolean;
  description: string;
  badge?: string;
}

export const AVAILABLE_PLAYERS: DesktopPlayerOption[] = [
  {
    id: 'internal',
    name: 'Player Integrado (Motor VLC)',
    description: 'Toca o arquivo original no app, com troca de idioma e legendas como no VLC',
    badge: 'Padrão',
  },
  {
    id: 'system',
    name: 'Player Padrão do Windows',
    description: 'Abre automaticamente no reprodutor de mídia padrão do seu sistema',
    badge: 'Universal',
  },
  {
    id: 'vlc',
    name: 'VLC Media Player',
    description: 'Decodificação de hardware GPU, som surround 5.1/7.1 e 4K HDR nativo',
    badge: 'Recomendado',
  },
  {
    id: 'mpv',
    name: 'MPV Player',
    description: 'Ultra veloz, renderizador OpenGL/Vulkan e latência zero em 60fps',
  },
  {
    id: 'mpc',
    name: 'Media Player Classic (MPC-HC)',
    description: 'Clássico leve com filtros DirectShow, LAV Filters e madVR',
  },
  {
    id: 'potplayer',
    name: 'PotPlayer',
    description: 'Aceleração DXVA/CUDA e filtros avançados de pós-processamento',
  },
];

function wailsApp(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).go?.main?.App || null;
}

class DesktopService {
  isWails(): boolean {
    return Boolean(wailsApp()?.PlayNative);
  }

  isDesktop(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).desktopAPI?.isDesktop || this.isWails());
  }

  getPlatform(): string {
    return (window as any).desktopAPI?.platform || 'web';
  }

  async getInstalledPlayers(): Promise<DesktopPlayerOption[]> {
    if (!this.isDesktop()) {
      return AVAILABLE_PLAYERS;
    }

    try {
      const scanned = await (window as any).desktopAPI.getInstalledPlayers();
      if (Array.isArray(scanned)) {
        return AVAILABLE_PLAYERS.map((player) => {
          if (player.id === 'internal') {
            return { ...player, installed: true };
          }
          const found = scanned.find((s: any) => s.id === player.id);
          return {
            ...player,
            installed: found ? found.installed : false,
          };
        });
      }
    } catch (err) {
      console.warn('[DesktopService] Error scanning players:', err);
    }

    return AVAILABLE_PLAYERS;
  }

  async startNativePlayer(opts: {
    url: string;
    title?: string;
    startTime?: number;
    preferAudio?: string;
    autoSubs?: string;
  }): Promise<{ success: boolean; engine?: string; player?: string; error?: string }> {
    try {
      const wails = wailsApp();
      if (wails?.PlayNative) {
        const b = (opts as any).bounds || { x: 0, y: 80, w: 1280, h: 640 };
        const err = await wails.PlayNative(
          opts.url,
          opts.title || 'AuraStream 4K',
          opts.startTime || 0,
          Math.round(b.x || 0),
          Math.round(b.y || 0),
          Math.round(b.w || 1280),
          Math.round(b.h || 640)
        );
        if (err) return { success: false, error: String(err) };
        return { success: true, engine: 'embed' };
      }
      if (!(window as any).desktopAPI?.startNativePlayer) {
        return { success: false, error: 'Player nativo indisponível neste cliente.' };
      }
      return await (window as any).desktopAPI.startNativePlayer(opts);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao iniciar o player integrado.' };
    }
  }

  async stopNativePlayer(): Promise<void> {
    try {
      const wails = wailsApp();
      if (wails?.StopPlayer) {
        await wails.StopPlayer();
        return;
      }
      if ((window as any).desktopAPI?.stopNativePlayer) {
        await (window as any).desktopAPI.stopNativePlayer();
      }
    } catch {}
  }

  async nativeCommand(cmd: Record<string, any>): Promise<void> {
    try {
      const wails = wailsApp();
      if (wails?.PlayerPause) {
        switch (cmd.cmd) {
          case 'toggle':
          case 'pause':
            await wails.PlayerPause();
            break;
          case 'seek':
            await wails.PlayerSeek(cmd.ms ?? cmd.value ?? 0);
            break;
          case 'volume':
            await wails.PlayerVolume(cmd.value ?? 90);
            break;
          case 'mute':
            await wails.PlayerMute(Boolean(cmd.muted));
            break;
          case 'audio':
            await wails.PlayerSetAudio(Number(cmd.id) || 0);
            break;
          case 'spu':
            await wails.PlayerSetSpu(Number(cmd.id) ?? -1);
            break;
        }
        return;
      }
      if ((window as any).desktopAPI?.nativePlayerCommand) {
        await (window as any).desktopAPI.nativePlayerCommand(cmd);
      }
    } catch {}
  }

  async toggleFullscreen(): Promise<boolean> {
    const wails = wailsApp();
    if (wails?.ToggleFullscreen) {
      return Boolean(await wails.ToggleFullscreen());
    }
    const api = (window as any).desktopAPI;
    if (api?.toggleFullscreen) {
      return Boolean(await api.toggleFullscreen());
    }
    return false;
  }

  async setFullscreen(on: boolean): Promise<boolean> {
    const wails = wailsApp();
    if (wails?.SetFullscreen) {
      return Boolean(await wails.SetFullscreen(on));
    }
    const api = (window as any).desktopAPI;
    if (api?.setFullscreen) {
      return Boolean(await api.setFullscreen(on));
    }
    return false;
  }

  async isFullscreen(): Promise<boolean> {
    const wails = wailsApp();
    if (wails?.IsFullscreen) {
      return Boolean(await wails.IsFullscreen());
    }
    const api = (window as any).desktopAPI;
    if (api?.isFullscreen) {
      return Boolean(await api.isFullscreen());
    }
    return Boolean(document.fullscreenElement);
  }

  onFullscreenChange(cb: (enabled: boolean) => void): () => void {
    const api = typeof window !== 'undefined' ? (window as any).desktopAPI : null;
    if (api?.onFullscreenChange) {
      const unsubscribe = api.onFullscreenChange(cb);
      return typeof unsubscribe === 'function' ? unsubscribe : () => {};
    }
    return () => {};
  }

  async nativeBounds(bounds: { x: number; y: number; w: number; h: number }): Promise<void> {
    try {
      const wails = wailsApp();
      if (wails?.PlayerSetBounds) {
        await wails.PlayerSetBounds(bounds.x, bounds.y, bounds.w, bounds.h);
        return;
      }
      if ((window as any).desktopAPI?.nativePlayerBounds) {
        await (window as any).desktopAPI.nativePlayerBounds(bounds);
      }
    } catch {}
  }

  onNativePlayerEvent(cb: (ev: any) => void): () => void {
    const runtime = typeof window !== 'undefined' ? (window as any).runtime : null;
    if (runtime?.EventsOn) {
      const handler = (ev: any) => cb(ev && ev.type ? ev : { type: 'closed', ...ev });
      runtime.EventsOn('player:event', handler);
      runtime.EventsOn('player:closed', () => cb({ type: 'closed' }));
      return () => {
        try {
          runtime.EventsOff?.('player:event');
          runtime.EventsOff?.('player:closed');
        } catch {}
      };
    }
    if (!this.isDesktop() || !(window as any).desktopAPI?.onNativePlayerEvent) {
      return () => {};
    }
    (window as any).desktopAPI.onNativePlayerEvent(cb);
    return () => {
      try {
        (window as any).desktopAPI.removeNativePlayerListeners();
      } catch {}
    };
  }

  async launchExternalPlayer(
    playerId: string,
    url: string,
    title?: string,
    startTime?: number
  ): Promise<{ success: boolean; player?: string; error?: string }> {
    if (!this.isDesktop()) {
      return {
        success: false,
        error: 'Recurso exclusivo do aplicativo Desktop AuraStream para Windows.',
      };
    }

    try {
      const res = await (window as any).desktopAPI.launchPlayer(playerId, url, title, startTime);
      return res;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Falha ao executar o player de vídeo.',
      };
    }
  }

  getPreferredPlayer(): string {
    try {
      const saved = localStorage.getItem('aurastream_preferred_player');
      if (saved) return saved;
    } catch {}
    return 'internal';
  }

  setPreferredPlayer(playerId: string): void {
    try {
      localStorage.setItem('aurastream_preferred_player', playerId);
    } catch {}
  }
}

export const desktopService = new DesktopService();
