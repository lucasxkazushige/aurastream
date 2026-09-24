import { MediaItem } from '../types';

export interface WatchProgress {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  currentTime: number;
  duration: number;
  percentage: number;
  season?: number;
  episode?: number;
  episodeInfo?: string;
  infoHash?: string;
  updatedAt: number;
}

export interface UserPreferences {
  preferredAudio: 'pt-br' | 'original';
  autoSubtitles: 'auto' | 'always' | 'never';
  maxQuality: '4k' | '1080p' | '720p';
  defaultPlayer?: 'internal' | 'vlc' | 'mpv' | 'mpc' | 'potplayer';
}

const WATCHLIST_KEY = 'aurastream_watchlist';
const HISTORY_KEY = 'aurastream_history';
const PREFERENCES_KEY = 'aurastream_preferences';

export const storage = {
  // Watchlist
  getWatchlist(): MediaItem[] {
    try {
      const data = localStorage.getItem(WATCHLIST_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  isInWatchlist(id: number, mediaType: 'movie' | 'tv'): boolean {
    const list = this.getWatchlist();
    return list.some((item) => item.id === id && item.mediaType === mediaType);
  },

  toggleWatchlist(item: MediaItem): boolean {
    const list = this.getWatchlist();
    const index = list.findIndex((i) => i.id === item.id && i.mediaType === item.mediaType);
    if (index > -1) {
      list.splice(index, 1);
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
      return false;
    } else {
      list.unshift(item);
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
      return true;
    }
  },

  // Watch History & Progress
  getProgressList(): WatchProgress[] {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getItemProgress(mediaId: number, mediaType: 'movie' | 'tv', season?: number, episode?: number): WatchProgress | null {
    const list = this.getProgressList();
    return list.find((i) => {
      const matchMedia = i.mediaId === mediaId && i.mediaType === mediaType;
      if (mediaType === 'tv' && season && episode) {
        return matchMedia && i.season === season && i.episode === episode;
      }
      return matchMedia;
    }) || null;
  },

  saveProgress(params: {
    media: MediaItem;
    currentTime: number;
    duration: number;
    season?: number;
    episode?: number;
    episodeInfo?: string;
    infoHash?: string;
  }) {
    if (!params.duration || params.duration <= 0) return;

    const percentage = Math.round((params.currentTime / params.duration) * 100);
    // Don't save if watched less than 1% or more than 95%
    if (percentage > 95) {
      this.removeProgress(params.media.id, params.media.mediaType, params.season, params.episode);
      return;
    }

    const list = this.getProgressList();
    const existingIndex = list.findIndex((i) => {
      const matchMedia = i.mediaId === params.media.id && i.mediaType === params.media.mediaType;
      if (params.media.mediaType === 'tv') {
        return matchMedia && i.season === params.season && i.episode === params.episode;
      }
      return matchMedia;
    });

    const progressItem: WatchProgress = {
      mediaId: params.media.id,
      mediaType: params.media.mediaType,
      title: params.media.title || params.media.name || 'Título',
      posterPath: params.media.posterPath,
      backdropPath: params.media.backdropPath,
      currentTime: params.currentTime,
      duration: params.duration,
      percentage,
      season: params.season,
      episode: params.episode,
      episodeInfo: params.episodeInfo,
      infoHash: params.infoHash,
      updatedAt: Date.now(),
    };

    if (existingIndex > -1) {
      list.splice(existingIndex, 1);
    }
    list.unshift(progressItem);
    // Keep max 30 items
    if (list.length > 30) list.pop();

    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  },

  removeProgress(mediaId: number, mediaType: 'movie' | 'tv', season?: number, episode?: number) {
    const list = this.getProgressList().filter((i) => {
      const matchMedia = i.mediaId === mediaId && i.mediaType === mediaType;
      if (mediaType === 'tv' && season && episode) {
        return !(matchMedia && i.season === season && i.episode === episode);
      }
      return !matchMedia;
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  },

  clearAllProgress() {
    localStorage.removeItem(HISTORY_KEY);
  },

  clearWatchlist() {
    localStorage.removeItem(WATCHLIST_KEY);
  },

  getPreferences(): UserPreferences {
    try {
      const data = localStorage.getItem(PREFERENCES_KEY);
      return data
        ? JSON.parse(data)
        : { preferredAudio: 'pt-br', autoSubtitles: 'auto', maxQuality: '1080p' };
    } catch {
      return { preferredAudio: 'pt-br', autoSubtitles: 'auto', maxQuality: '1080p' };
    }
  },

  savePreferences(prefs: UserPreferences) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  },
};
