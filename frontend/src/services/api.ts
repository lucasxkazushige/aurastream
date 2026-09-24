import { MediaItem, TorrentStream, StreamSession, Episode, StorageOverview } from '../types';

const API_BASE = '/api';

export const api = {
  // TMDB
  async getTrending(type: 'all' | 'movie' | 'tv' = 'all', page: number = 1): Promise<MediaItem[]> {
    const res = await fetch(`${API_BASE}/tmdb/trending?type=${type}&timeWindow=week&page=${page}`);
    return res.json();
  },

  async getPopular(type: 'movie' | 'tv' = 'movie', page = 1): Promise<{ results: MediaItem[] }> {
    const res = await fetch(`${API_BASE}/tmdb/popular?type=${type}&page=${page}`);
    return res.json();
  },

  async getTopRated(type: 'movie' | 'tv' = 'movie', page = 1): Promise<{ results: MediaItem[] }> {
    const res = await fetch(`${API_BASE}/tmdb/top-rated?type=${type}&page=${page}`);
    return res.json();
  },

  async getByGenre(type: 'movie' | 'tv', genreId: number, page = 1): Promise<{ results: MediaItem[] }> {
    const res = await fetch(`${API_BASE}/tmdb/genre/${type}/${genreId}?page=${page}`);
    return res.json();
  },

  async getGenres(type: 'movie' | 'tv' = 'movie'): Promise<{ id: number; name: string }[]> {
    const res = await fetch(`${API_BASE}/tmdb/genres?type=${type}`);
    return res.json();
  },

  async discover(params: {
    type?: 'movie' | 'tv';
    genreId?: number;
    sortBy?: string;
    minRating?: number;
    maxRuntime?: number;
    minRuntime?: number;
    year?: number;
    fromYear?: number;
    toYear?: number;
    page?: number;
    vibe?: string;
  }): Promise<{ page: number; totalPages: number; totalResults: number; results: MediaItem[] }> {
    const q = new URLSearchParams();
    if (params.type) q.append('type', params.type);
    if (params.genreId) q.append('genreId', params.genreId.toString());
    if (params.sortBy) q.append('sortBy', params.sortBy);
    if (params.minRating) q.append('minRating', params.minRating.toString());
    if (params.maxRuntime) q.append('maxRuntime', params.maxRuntime.toString());
    if (params.minRuntime) q.append('minRuntime', params.minRuntime.toString());
    if (params.year) q.append('year', params.year.toString());
    if (params.fromYear) q.append('fromYear', params.fromYear.toString());
    if (params.toYear) q.append('toYear', params.toYear.toString());
    if (params.page) q.append('page', params.page.toString());
    if (params.vibe) q.append('vibe', params.vibe);

    const res = await fetch(`${API_BASE}/tmdb/discover?${q.toString()}`);
    return res.json();
  },

  async getSurprise(vibe?: string, type: 'movie' | 'tv' = 'movie'): Promise<MediaItem | null> {
    const q = new URLSearchParams();
    if (vibe) q.append('vibe', vibe);
    q.append('type', type);
    const res = await fetch(`${API_BASE}/tmdb/surprise?${q.toString()}`);
    return res.json();
  },

  async search(query: string, page = 1): Promise<{ page: number; totalPages: number; totalResults: number; results: MediaItem[] }> {
    const res = await fetch(`${API_BASE}/tmdb/search?q=${encodeURIComponent(query)}&page=${page}`);
    return res.json();
  },

  async getMovieDetails(id: number): Promise<MediaItem> {
    const res = await fetch(`${API_BASE}/tmdb/movie/${id}`);
    return res.json();
  },

  async getTvDetails(id: number): Promise<MediaItem> {
    const res = await fetch(`${API_BASE}/tmdb/tv/${id}`);
    return res.json();
  },

  async getSeasonDetails(tvId: number, seasonNumber: number): Promise<{ episodes: Episode[] }> {
    const res = await fetch(`${API_BASE}/tmdb/tv/${tvId}/season/${seasonNumber}`);
    return res.json();
  },

  // Stream & Sources
  async getSources(params: {
    imdbId?: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
    title?: string;
    year?: string;
  }): Promise<{ count: number; streams: TorrentStream[] }> {
    const q = new URLSearchParams();
    if (params.imdbId) q.append('imdbId', params.imdbId);
    q.append('type', params.type);
    if (params.season) q.append('season', params.season.toString());
    if (params.episode) q.append('episode', params.episode.toString());
    if (params.title) q.append('title', params.title);
    if (params.year) q.append('year', params.year);

    const res = await fetch(`${API_BASE}/stream/sources?${q.toString()}`);
    return res.json();
  },

  async startStream(params: {
    magnet: string;
    mediaId?: string;
    mediaType?: 'movie' | 'tv';
    title?: string;
  }): Promise<StreamSession> {
    const res = await fetch(`${API_BASE}/stream/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async getStreamStatus(infoHash: string): Promise<StreamSession> {
    const res = await fetch(`${API_BASE}/stream/status/${infoHash}`);
    return res.json();
  },

  async switchAudio(infoHash: string, audioIndex: number): Promise<StreamSession> {
    const res = await fetch(`${API_BASE}/stream/switch-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ infoHash, audioIndex }),
    });
    return res.json();
  },

  async getHealth(): Promise<any> {
    const res = await fetch(`${API_BASE}/stream/health`);
    return res.json();
  },

  async getSessions(): Promise<{ count: number; sessions: StreamSession[] }> {
    const res = await fetch(`${API_BASE}/stream/sessions`);
    return res.json();
  },

  async getStorageOverview(): Promise<StorageOverview> {
    const res = await fetch(`${API_BASE}/stream/storage`);
    return res.json();
  },

  async stopDownload(infoHash: string): Promise<{ success: boolean; session?: StreamSession }> {
    const res = await fetch(`${API_BASE}/stream/session/${infoHash}/stop`, {
      method: 'POST',
    });
    return res.json();
  },

  async deleteStream(infoHash: string, deleteR2 = true): Promise<{ success: boolean; deletedR2Count: number }> {
    const res = await fetch(`${API_BASE}/stream/session/${infoHash}?deleteR2=${deleteR2}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async deleteFromR2(infoHash: string): Promise<{ success: boolean; deletedCount: number }> {
    const res = await fetch(`${API_BASE}/stream/r2/${infoHash}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  async cleanAllR2(): Promise<{ success: boolean; deletedCount: number }> {
    const res = await fetch(`${API_BASE}/stream/r2/clean-all`, {
      method: 'POST',
    });
    return res.json();
  },

  async cleanAllLocal(): Promise<{ success: boolean; deletedCount: number }> {
    const res = await fetch(`${API_BASE}/stream/local/clean-all`, {
      method: 'POST',
    });
    return res.json();
  },
};
