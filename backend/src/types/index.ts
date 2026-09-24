export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage: number;
  mediaType: 'movie' | 'tv';
  genres?: { id: number; name: string }[];
  runtime?: number;
  trailerUrl?: string;
  seasonsCount?: number;
  episodesCount?: number;
  imdbId?: string;
  adult?: boolean;
}

export interface TorrentStream {
  id: string;
  title: string;
  resolution: '4K' | '1080p' | '720p' | '480p' | 'Unknown';
  quality: string;
  size: string;
  sizeBytes: number;
  seeds: number;
  peers: number;
  magnet: string;
  infoHash: string;
  source: string;
  isCachedOnR2?: boolean;
  hasPtBr?: boolean;
  isDubbed?: boolean;
  audioLanguage?: string;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  lang: string;
  url: string;
  isDefault?: boolean;
}

export interface AudioTrackInfo {
  id: number;
  index: number;
  label: string;
  language: string;
  channels?: number;
  codec?: string;
  isDefault?: boolean;
}

export interface StreamSession {
  sessionId: string;
  magnet: string;
  infoHash: string;
  mediaId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  status: 'initializing' | 'downloading' | 'transcoding' | 'ready' | 'completed' | 'error' | 'stopped';
  progress: number;
  downloadSpeed: number;
  seeds: number;
  peers: number;
  playlistUrl: string;
  isR2Cached: boolean;
  totalSegments: number;
  uploadedSegments: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrackInfo[];
  isPassthrough?: boolean;
  is4K?: boolean;
  directStreamUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface StorageItem {
  infoHash: string;
  title: string;
  fileCount: number;
  totalBytes: number;
  sizeFormatted: string;
  isLocal: boolean;
  isR2: boolean;
  status?: string;
  progress?: number;
  lastModified?: string;
}

export interface StorageOverview {
  local: {
    totalBytes: number;
    sizeFormatted: string;
    path: string;
    sessionsCount: number;
  };
  r2: {
    totalBytes: number;
    totalFiles: number;
    sizeFormatted: string;
    bucket: string;
    publicUrl: string;
    connected: boolean;
  };
  items: StorageItem[];
}
