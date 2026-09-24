import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import WebTorrent from 'webtorrent';
import ffmpeg from 'fluent-ffmpeg';
import { EventEmitter } from 'events';
import { config } from '../config/index.js';
import { r2Service } from './r2.service.js';
import { StreamSession, SubtitleTrack, AudioTrackInfo, StorageOverview, StorageItem } from '../types/index.js';

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.leechers-paradise.org:6969',
  'udp://tracker.coppersurfer.tk:6969',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.fastcast.nz',
  'wss://tracker.openwebtorrent.com',
];

class StreamManager extends EventEmitter {
  private client: any;
  private sessions: Map<string, StreamSession> = new Map();
  private torrents: Map<string, any> = new Map();
  private ffmpegProcesses: Map<string, any> = new Map();
  private inputStreams: Map<string, any> = new Map();
  private uploadIntervals: Map<string, NodeJS.Timeout> = new Map();
  private videoFiles: Map<string, any> = new Map();

  constructor() {
    super();
    const WT = (WebTorrent as any).default || WebTorrent;
    this.client = new WT({
      tracker: {
        announce: DEFAULT_TRACKERS,
      },
    });

    this.client.on('error', (err: any) => {
      console.error('WebTorrent client error:', err);
    });

    if (!fs.existsSync(config.tempDir)) {
      fs.mkdirSync(config.tempDir, { recursive: true });
    }
  }

  async getSession(infoHash: string): Promise<StreamSession | null> {
    const cleanHash = infoHash.toLowerCase();

    // Check in-memory first
    const session = this.sessions.get(cleanHash);
    if (session) return session;

    // Check if raw video file is cached in R2 (new direct video cache)
    const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v'];
    let r2VideoKey: string | null = null;
    let r2VideoUrl: string | null = null;

    for (const ext of videoExtensions) {
      const key = `streams/${cleanHash}/video${ext}`;
      if (await r2Service.fileExists(key)) {
        r2VideoKey = key;
        r2VideoUrl = r2Service.getPublicUrl(key);
        break;
      }
    }

    if (r2VideoKey && r2VideoUrl) {
      const m3uKey = `streams/${cleanHash}/playlist.m3u`;
      const m3uExists = await r2Service.fileExists(m3uKey);
      const cachedSession: StreamSession = {
        sessionId: cleanHash,
        magnet: `magnet:?xt=urn:btih:${cleanHash}`,
        infoHash: cleanHash,
        mediaId: '',
        mediaType: 'movie',
        title: 'Cached Stream',
        status: 'completed',
        progress: 100,
        downloadSpeed: 0,
        seeds: 0,
        peers: 0,
        directStreamUrl: r2VideoUrl,
        playlistUrl: m3uExists ? r2Service.getPublicUrl(m3uKey) : r2VideoUrl,
        isR2Cached: true,
        totalSegments: 0,
        uploadedSegments: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.set(cleanHash, cachedSession);
      console.log(`[R2 Cache Hit ✅] ${cleanHash} found in R2 at ${r2VideoUrl}`);
      return cachedSession;
    }

    // Legacy: Check if HLS master.m3u8 is cached in R2 (old format)
    const r2Key = `streams/${cleanHash}/master.m3u8`;
    const isCached = await r2Service.fileExists(r2Key);
    if (isCached) {
      const cachedSession: StreamSession = {
        sessionId: cleanHash,
        magnet: `magnet:?xt=urn:btih:${cleanHash}`,
        infoHash: cleanHash,
        mediaId: '',
        mediaType: 'movie',
        title: 'Cached Stream',
        status: 'completed',
        progress: 100,
        downloadSpeed: 0,
        seeds: 0,
        peers: 0,
        playlistUrl: r2Service.getPublicUrl(r2Key),
        isR2Cached: true,
        totalSegments: 0,
        uploadedSegments: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.set(cleanHash, cachedSession);
      return cachedSession;
    }

    return null;
  }

  async startStream(params: {
    magnet: string;
    mediaId?: string;
    mediaType?: 'movie' | 'tv';
    title?: string;
  }): Promise<StreamSession> {
    let { magnet, mediaId = '', mediaType = 'movie', title = 'Streaming' } = params;

    // Extract infoHash from magnet
    let infoHash = '';
    const hashMatch = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    if (hashMatch) {
      infoHash = hashMatch[1].toLowerCase();
    } else {
      throw new Error('Magnet URI inválido ou sem infoHash');
    }

    // Ensure magnet has trackers
    if (!magnet.includes('&tr=')) {
      const trackerParams = DEFAULT_TRACKERS.map((t) => `tr=${encodeURIComponent(t)}`).join('&');
      magnet = `${magnet}&${trackerParams}`;
    }

    // Check if already active or cached in R2
    const existing = await this.getSession(infoHash);
    if (existing && (existing.status === 'ready' || existing.status === 'completed' || existing.status === 'transcoding')) {
      return existing;
    }

    // Check if R2 has the master.m3u8
    const r2Key = `streams/${infoHash}/master.m3u8`;
    const isCached = await r2Service.fileExists(r2Key);
    if (isCached) {
      const cachedSession: StreamSession = {
        sessionId: infoHash,
        magnet,
        infoHash,
        mediaId,
        mediaType,
        title,
        status: 'completed',
        progress: 100,
        downloadSpeed: 0,
        seeds: 0,
        peers: 0,
        playlistUrl: r2Service.getPublicUrl(r2Key),
        isR2Cached: true,
        totalSegments: 0,
        uploadedSegments: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.sessions.set(infoHash, cachedSession);
      return cachedSession;
    }

    // Create a new stream session
    const sessionDir = path.join(config.tempDir, infoHash);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const session: StreamSession = {
      sessionId: infoHash,
      magnet,
      infoHash,
      mediaId,
      mediaType,
      title,
      status: 'initializing',
      progress: 0,
      downloadSpeed: 0,
      seeds: 0,
      peers: 0,
      playlistUrl: `/api/stream/hls/${infoHash}/master.m3u8`,
      isR2Cached: false,
      totalSegments: 0,
      uploadedSegments: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subtitles: [],
      audioTracks: [],
    };

    this.sessions.set(infoHash, session);
    this.emit('session_updated', session);

    // Add torrent to client if not already added
    let torrent = this.torrents.get(infoHash);
    if (!torrent) {
      console.log(`[Adding Torrent] ${infoHash}`);
      torrent = this.client.add(magnet, {
        path: sessionDir,
        announce: DEFAULT_TRACKERS,
      });
      this.torrents.set(infoHash, torrent);

      // Handle torrent events
      torrent.on('download', () => {
        session.progress = Math.round(torrent.progress * 100);
        session.downloadSpeed = torrent.downloadSpeed;
        session.seeds = torrent.numPeers;
        session.peers = torrent.numPeers;
        session.updatedAt = Date.now();
        this.emit('session_updated', session);
      });

      torrent.on('ready', () => {
        console.log(`[Torrent Ready] ${torrent.name} (${torrent.files.length} files)`);

        // Find main video file (largest file)
        const videoFile = torrent.files.reduce((prev: any, curr: any) => {
          return prev.length > curr.length ? prev : curr;
        });

        this.videoFiles.set(infoHash, videoFile);
        session.fileName = videoFile.name;
        session.fileSize = videoFile.length;
        session.directStreamUrl = `/api/stream/direct/${infoHash}`;
        this.emit('session_updated', session);

        console.log(`[Video File Selected] ${videoFile.name} (${(videoFile.length / (1024 * 1024)).toFixed(1)} MB)`);

        // 1. Deselect all non-video files to maximize bandwidth and peer connections for the video
        torrent.files.forEach((file: any) => {
          if (file !== videoFile) {
            try { file.deselect(); } catch {}
          }
        });

        // 2. Prioritize key pieces (start pieces for fast playback + end pieces for MP4 moov atom / MKV index)
        try {
          const startPiece = (videoFile as any)._startPiece;
          const endPiece = (videoFile as any)._endPiece;
          if (typeof startPiece === 'number' && typeof endPiece === 'number') {
            const initialPieces = Math.min(startPiece + 35, endPiece);
            torrent.select(startPiece, initialPieces, 7); // Maximum WebTorrent priority

            const lastPieces = Math.max(startPiece, endPiece - 15);
            torrent.select(lastPieces, endPiece, 6);
          }
        } catch {}

        // Direct Native Bitstream Streaming (0% CPU, no FFmpeg, no HLS)
        session.status = 'ready';
        session.directStreamUrl = `/api/stream/direct/${infoHash}`;
        session.playlistUrl = `/api/stream/playlist/${infoHash}.m3u`;
        this.emit('session_updated', session);
        console.log(`[AuraStream Native Mode ⚡] Stream ${infoHash} is READY for 0% CPU direct streaming!`);
      });

      // When download is 100% complete → upload raw file to R2 for permanent CDN cache
      torrent.on('done', () => {
        const videoFile = this.videoFiles.get(infoHash);
        if (!videoFile) return;

        // Run upload in background — don't block playback
        this.uploadVideoToR2(infoHash, videoFile, sessionDir).catch((err) => {
          console.error(`[R2 Upload Error] ${infoHash}:`, err.message);
        });
      });

      torrent.on('error', (err: any) => {
        console.error(`[Torrent Error] ${infoHash}:`, err.message);
        session.status = 'error';
        session.error = err.message;
        this.emit('session_updated', session);
      });
    }

    return session;
  }

  /**
   * Uploads the raw downloaded video file to Cloudflare R2 using multipart upload.
   * After upload, updates the session directStreamUrl to point to R2 CDN URL.
   * Cleans up local temp files after successful upload.
   */
  private async uploadVideoToR2(infoHash: string, videoFile: any, sessionDir: string): Promise<void> {
    const session = this.sessions.get(infoHash);
    if (!session) return;

    const ext = path.extname(videoFile.name).toLowerCase();
    const r2Key = `streams/${infoHash}/video${ext}`;

    // Check if already uploaded
    const alreadyUploaded = await r2Service.fileExists(r2Key);
    if (alreadyUploaded) {
      console.log(`[R2 Cache Hit] ${infoHash} already in R2, skipping upload.`);
      const r2Url = r2Service.getPublicUrl(r2Key);
      session.directStreamUrl = r2Url;
      session.playlistUrl = r2Service.getPublicUrl(`streams/${infoHash}/playlist.m3u`);
      session.isR2Cached = true;
      session.status = 'completed';
      this.emit('session_updated', session);
      return;
    }

    const localFilePath = path.join(sessionDir, videoFile.path || videoFile.name);

    if (!fs.existsSync(localFilePath)) {
      console.warn(`[R2 Upload] Local file not found: ${localFilePath}, skipping R2 upload.`);
      return;
    }

    const mime = videoFile.name.endsWith('.mp4') ? 'video/mp4'
      : videoFile.name.endsWith('.mkv') ? 'video/x-matroska'
      : videoFile.name.endsWith('.avi') ? 'video/x-msvideo'
      : videoFile.name.endsWith('.mov') ? 'video/quicktime'
      : 'video/mp4';

    const fileSize = fs.statSync(localFilePath).size;
    console.log(`[R2 Upload ☁️] Starting upload of ${videoFile.name} (${(fileSize / 1e9).toFixed(2)} GB) to R2...`);

    session.status = 'transcoding'; // reuse status to indicate "uploading to R2"
    this.emit('session_updated', session);

    try {
      const r2Url = await r2Service.uploadLargeFile(
        r2Key,
        localFilePath,
        mime,
        (pct) => {
          session.uploadedSegments = pct; // reuse field as upload percentage
          session.totalSegments = 100;
          this.emit('session_updated', session);
        },
      );

      // Also generate and upload an M3U playlist pointing to R2 direct URL
      const m3uContent = `#EXTM3U\n#EXTINF:-1 tvg-name="${session.title}" group-title="AuraStream Direct",${session.title}\n${r2Url}\n`;
      const m3uKey = `streams/${infoHash}/playlist.m3u`;
      await r2Service.uploadBuffer(m3uKey, Buffer.from(m3uContent, 'utf-8'), 'audio/x-mpegurl');

      session.directStreamUrl = r2Url;
      session.playlistUrl = r2Service.getPublicUrl(m3uKey);
      session.isR2Cached = true;
      session.status = 'completed';
      session.progress = 100;
      this.emit('session_updated', session);

      console.log(`[R2 Upload ✅] ${infoHash} is now permanently cached in Cloudflare R2 at ${r2Url}`);

      // Clean up local files to free disk
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[Local Cleanup] Removed temp dir for ${infoHash} after R2 upload.`);
      } catch {}
    } catch (err: any) {
      // Revert to direct streaming if upload fails
      session.status = 'ready';
      session.directStreamUrl = `/api/stream/direct/${infoHash}`;
      this.emit('session_updated', session);
      console.error(`[R2 Upload Failed] ${infoHash}: ${err.message}. Falling back to direct stream.`);
    }
  }

  private probeMediaStreams(inputStream: any): Promise<{
    videoStreams: any[];
    audioStreams: any[];
    subtitleStreams: any[];
  }> {
    return new Promise((resolve) => {
      let resolved = false;
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=index,codec_type,codec_name,width,height,channels,pix_fmt,profile:stream_tags=language,title',
        '-of', 'json',
        'pipe:0',
      ]);

      const cleanup = (res: { videoStreams: any[]; audioStreams: any[]; subtitleStreams: any[] }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        try { inputStream.unpipe(); } catch {}
        try { inputStream.destroy(); } catch {}
        try { ffprobe.stdin?.destroy(); } catch {}
        try { ffprobe.kill('SIGKILL'); } catch {}
        resolve(res);
      };

      let data = '';
      const timer = setTimeout(() => {
        cleanup({ videoStreams: [], audioStreams: [], subtitleStreams: [] });
      }, 7000);

      // Prevent unhandled PREMATURE_CLOSE / closed stream errors
      inputStream.on('error', () => {
        // stream closed or aborted early, ignore
      });

      ffprobe.stdin.on('error', () => {
        // pipe closed early, ignore EPIPE
      });

      ffprobe.stdout.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      ffprobe.on('close', () => {
        try {
          const parsed = JSON.parse(data);
          const streams = parsed.streams || [];
          const videoStreams = streams.filter((s: any) => s.codec_type === 'video');
          const audioStreams = streams.filter((s: any) => s.codec_type === 'audio');
          const subtitleStreams = streams.filter((s: any) => s.codec_type === 'subtitle');
          cleanup({ videoStreams, audioStreams, subtitleStreams });
        } catch {
          cleanup({ videoStreams: [], audioStreams: [], subtitleStreams: [] });
        }
      });

      ffprobe.on('error', () => {
        cleanup({ videoStreams: [], audioStreams: [], subtitleStreams: [] });
      });

      try {
        inputStream.pipe(ffprobe.stdin);
      } catch {
        cleanup({ videoStreams: [], audioStreams: [], subtitleStreams: [] });
      }
    });
  }

  private formatAudioLabel(lang: string = '', title: string = '', channels: number = 2, index: number = 0): string {
    const l = (lang || '').toLowerCase().trim();
    let name = '';
    if (['por', 'pob', 'pt', 'pt-br', 'pt_br'].includes(l)) name = 'Português (Brasil)';
    else if (['eng', 'en'].includes(l)) name = 'Inglês (Original)';
    else if (['spa', 'es'].includes(l)) name = 'Espanhol';
    else if (['fre', 'fra', 'fr'].includes(l)) name = 'Francês';
    else if (['ita', 'it'].includes(l)) name = 'Italiano';
    else if (['ger', 'deu', 'de'].includes(l)) name = 'Alemão';
    else if (['jpn', 'ja'].includes(l)) name = 'Japonês';
    else if (['rus', 'ru'].includes(l)) name = 'Russo';
    else if (['hin', 'hi'].includes(l)) name = 'Hindi';
    else if (title) name = title;
    else name = index === 0 ? 'Áudio Principal' : `Áudio Faixa ${index + 1}`;

    if (title && !name.includes(title) && name !== title) {
      name += ` - ${title}`;
    }
    if (channels === 6) {
      name += ' [5.1]';
    } else if (channels === 8) {
      name += ' [7.1]';
    }
    return name;
  }

  private detectSubtitleLanguage(filename: string): { lang: string; label: string } {
    const lower = filename.toLowerCase();
    if (/\b(pt[-_]?br|pob|brazilian|ptbr|dublado)\b/i.test(lower) || lower.includes('portugues') || lower.includes('português')) {
      return { lang: 'pt-BR', label: 'Português (Brasil)' };
    }
    if (/\b(pt|por|portugal)\b/i.test(lower)) {
      return { lang: 'pt-PT', label: 'Português (Portugal)' };
    }
    if (/\b(en|eng|english|ingles|inglês)\b/i.test(lower)) {
      return { lang: 'en', label: 'Inglês' };
    }
    if (/\b(es|spa|spanish|espanol|español|latino)\b/i.test(lower)) {
      return { lang: 'es', label: 'Espanhol' };
    }
    if (/\b(fr|fre|fra|french|frances|francês)\b/i.test(lower)) {
      return { lang: 'fr', label: 'Francês' };
    }
    if (/\b(it|ita|italian|italiano)\b/i.test(lower)) {
      return { lang: 'it', label: 'Italiano' };
    }
    if (/\b(de|ger|deu|german|alemao|alemão)\b/i.test(lower)) {
      return { lang: 'de', label: 'Alemão' };
    }
    if (/\b(ru|rus|russian|russo)\b/i.test(lower)) {
      return { lang: 'ru', label: 'Russo' };
    }
    if (/\b(ja|jpn|japanese|japones|japonês)\b/i.test(lower)) {
      return { lang: 'ja', label: 'Japonês' };
    }
    if (/\b(ko|kor|korean|coreano)\b/i.test(lower)) {
      return { lang: 'ko', label: 'Coreano' };
    }

    const clean = path.basename(filename, path.extname(filename)).replace(/[._-]/g, ' ').trim();
    return { lang: 'und', label: clean || 'Legenda' };
  }

  private async processAllSubtitles(torrent: any, infoHash: string, sessionDir: string) {
    const session = this.sessions.get(infoHash);
    if (!session) return;

    const subFiles = torrent.files.filter((f: any) =>
      f.name.endsWith('.srt') || f.name.endsWith('.vtt') || f.name.endsWith('.sub')
    );

    const detectedSubs: SubtitleTrack[] = [];

    for (let i = 0; i < subFiles.length; i++) {
      const file = subFiles[i];
      try {
        const langInfo = this.detectSubtitleLanguage(file.name);
        const subId = `sub_${i}`;
        const subFilename = `${subId}.vtt`;
        const localVttPath = path.join(sessionDir, subFilename);

        const chunks: Buffer[] = [];
        const stream = file.createReadStream();
        await new Promise<void>((res) => {
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => res());
          stream.on('error', () => res());
        });

        const raw = Buffer.concat(chunks).toString('utf-8');
        if (!raw.trim()) continue;

        const vtt = 'WEBVTT\n\n' + raw.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        fs.writeFileSync(localVttPath, vtt, 'utf-8');

        // Upload to R2
        const r2Key = `streams/${infoHash}/${subFilename}`;
        await r2Service.uploadFile(r2Key, localVttPath, 'text/vtt', true).catch(() => {});

        const isDefault = langInfo.lang === 'pt-BR' || (!detectedSubs.some((s) => s.isDefault) && i === 0);

        detectedSubs.push({
          id: subId,
          label: langInfo.label,
          lang: langInfo.lang,
          url: `/api/stream/hls/${infoHash}/${subFilename}`,
          isDefault,
        });
      } catch (err: any) {
        console.error(`[Subtitle Error] ${file.name}:`, err.message);
      }
    }

    if (detectedSubs.length > 0) {
      session.subtitles = detectedSubs;
      this.emit('session_updated', session);
      console.log(`[Subtitles] Loaded ${detectedSubs.length} subtitle tracks for ${infoHash}`);
    }
  }

  private async startTranscoding(infoHash: string, file: any, sessionDir: string, selectedAudioIdx: number = 0) {
    const session = this.sessions.get(infoHash);
    if (!session) return;

    session.status = 'ready';
    session.directStreamUrl = `/api/stream/direct/${infoHash}`;
    session.playlistUrl = `/api/stream/playlist/${infoHash}.m3u`;
    this.emit('session_updated', session);
    console.log(`[AuraStream Native] Transcoding bypassed for ${infoHash}. Direct streaming active.`);
    return;
  }

  private async _legacyTranscodeDisabled(infoHash: string, file: any, sessionDir: string, selectedAudioIdx: number = 0) {
    const session = this.sessions.get(infoHash);
    if (!session) return;
    let videoStreams: any[] = [];
    let audioStreams: any[] = [];
    let subtitleStreams: any[] = [];
    try {
      const probeInput = file.createReadStream({ start: 0, end: 1024 * 1024 * 10 });
      const probed = await this.probeMediaStreams(probeInput);
      videoStreams = probed.videoStreams || [];
      audioStreams = probed.audioStreams || [];
      subtitleStreams = probed.subtitleStreams || [];
    } catch {
      // ignore
    }

    // Determine video codec optimization (direct stream copy vs multi-threaded transcode)
    const mainVideo = videoStreams[0];
    const isH264 = mainVideo && (mainVideo.codec_name === 'h264' || mainVideo.codec_name === 'avc1');
    const is10Bit = mainVideo?.pix_fmt && mainVideo.pix_fmt.includes('10');
    const is4K = Boolean(
      (mainVideo?.height && mainVideo.height > 1080) ||
      (mainVideo?.width && mainVideo.width > 1920)
    );
    // Only 1080p/720p 8-bit H264 is copied directly. 4K or non-H264 is scaled to 1080p for 2.0x real-time speed
    const canCopyVideo = Boolean(isH264 && !is10Bit && !is4K);

    session.isPassthrough = canCopyVideo;
    session.is4K = is4K;

    const videoCodecArgs = canCopyVideo
      ? ['-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb']
      : [
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-tune', 'zerolatency',
          '-threads', '0',
          '-vf', 'scale=-2:min(1080\\,ih):flags=fast_bilinear,format=yuv420p',
          '-x264-params', 'no-mbtree=1:rc-lookahead=10',
          '-crf', '22',
          '-maxrate', '5500k',
          '-bufsize', '11000k',
          '-g', '48',
          '-keyint_min', '48',
          '-sc_threshold', '0',
        ];

    if (canCopyVideo) {
      console.log(`[HLS Optimizer ⚡] Passthrough mode: H.264 detected (${mainVideo?.pix_fmt || '8-bit'}). Direct stream copy active for 500x+ speed & 0% CPU!`);
    } else if (is4K) {
      console.log(`[HLS 4K Turbo 🚀] 4K detected (${mainVideo?.width || 3840}x${mainVideo?.height || 2160}). Smart-scaling to 1080p Full HD at 2.0x real-time speed to ELIMINATE buffering!`);
    } else {
      console.log(`[HLS Optimizer 🚀] High-Performance Transcode: Converting ${mainVideo?.codec_name || 'unknown'} to H.264 (unlimited multithreading)...`);
    }

    // Populate session audio tracks
    if (audioStreams.length > 0) {
      session.audioTracks = audioStreams.map((s, idx) => ({
        id: idx,
        index: s.index,
        label: this.formatAudioLabel(s.tags?.language, s.tags?.title, s.channels, idx),
        language: s.tags?.language || (idx === 0 ? 'por' : 'eng'),
        channels: s.channels,
        isDefault: idx === selectedAudioIdx,
      }));
      this.emit('session_updated', session);
    }

    // Extract embedded text subtitles if present and not already present
    const textSubs = subtitleStreams.filter((s: any) =>
      ['subrip', 'ass', 'mov_text', 'webvtt'].includes(s.codec_name)
    );
    if (textSubs.length > 0) {
      const existingSubs = session.subtitles || [];
      for (let i = 0; i < textSubs.length; i++) {
        const sub = textSubs[i];
        const langInfo = this.detectSubtitleLanguage(sub.tags?.title || sub.tags?.language || `sub_${i}`);
        const subId = `embed_${i}`;
        const subFilename = `${subId}.vtt`;
        const localVttPath = path.join(sessionDir, subFilename);

        try {
          const subStream = file.createReadStream();
          subStream.on('error', () => {});
          const extractProc = ffmpeg(subStream)
            .outputOptions([`-map 0:${sub.index}`, '-f webvtt'])
            .output(localVttPath);

          extractProc.on('end', async () => {
            const r2Key = `streams/${infoHash}/${subFilename}`;
            await r2Service.uploadFile(r2Key, localVttPath, 'text/vtt', true).catch(() => {});
          });
          extractProc.on('error', () => {});
          extractProc.run();

          if (!existingSubs.some((s: any) => s.id === subId)) {
            existingSubs.push({
              id: subId,
              label: `${langInfo.label} (Embutida)`,
              lang: langInfo.lang,
              url: `/api/stream/hls/${infoHash}/${subFilename}`,
              isDefault: langInfo.lang === 'pt-BR',
            });
          }
        } catch {
          // ignore extraction error
        }
      }
      session.subtitles = existingSubs;
      this.emit('session_updated', session);
    }

    // Terminate any previous FFmpeg process and stream for this session
    const oldStream = this.inputStreams.get(infoHash);
    if (oldStream) {
      try { oldStream.destroy(); } catch {}
      this.inputStreams.delete(infoHash);
    }
    const oldProc = this.ffmpegProcesses.get(infoHash);
    if (oldProc) {
      try { oldProc.kill('SIGKILL'); } catch {}
      this.ffmpegProcesses.delete(infoHash);
    }

    const inputStream = file.createReadStream({ highWaterMark: 1024 * 1024 * 4 });
    inputStream.on('error', (err: any) => {
      // Ignore pipe abortion or premature close errors
    });
    this.inputStreams.set(infoHash, inputStream);
    console.log(`[Transcoder] Starting optimized HLS pipeline for ${file.name} (Audio Tracks: ${audioStreams.length})...`);

    const ffmpegProc = ffmpeg(inputStream);
    ffmpegProc.inputOptions([
      '-probesize', '10000000',
      '-analyzeduration', '10000000',
      '-fflags', '+genpts+discardcorrupt+nobuffer',
      '-flags', '+low_delay',
    ]);

    // Multi-Audio HLS if multiple audio tracks detected
    if (audioStreams.length >= 2) {
      const varStreamMapParts: string[] = ['v:0,agroup:audio'];
      const outputOptions: string[] = [
        '-map', '0:v:0',
        ...videoCodecArgs,
      ];

      const numTracks = Math.min(audioStreams.length, 3);
      for (let i = 0; i < numTracks; i++) {
        const stream = audioStreams[i];
        const lang = (stream.tags?.language || (i === 0 ? 'por' : 'eng')).slice(0, 3);
        const nameClean = (i === 0 ? 'Portugues' : i === 1 ? 'Ingles' : `Audio_${i + 1}`).replace(/[^a-zA-Z0-9]/g, '');
        const isDef = i === selectedAudioIdx ? 'yes' : 'no';
        const canCopyAudio = stream.codec_name === 'aac' && (!stream.channels || stream.channels <= 2);

        outputOptions.push('-map', `0:a:${i}`);
        if (canCopyAudio) {
          outputOptions.push(`-c:a:${i}`, 'copy');
        } else {
          outputOptions.push(
            `-c:a:${i}`, 'aac',
            `-b:a:${i}`, '160k',
            `-ac:${i}`, '2',
            `-ar:${i}`, '48000'
          );
        }

        varStreamMapParts.push(`a:${i},agroup:audio,language:${lang},name:${nameClean},default:${isDef}`);
      }

      outputOptions.push(
        '-var_stream_map', varStreamMapParts.join(' '),
        '-f', 'hls',
        '-hls_init_time', '2',
        '-hls_time', '3',
        '-hls_list_size', '0',
        '-hls_playlist_type', 'event',
        '-hls_flags', 'independent_segments+temp_file+split_by_time',
        '-max_muxing_queue_size', '4096',
        '-master_pl_name', 'master.m3u8',
        '-hls_segment_filename', path.join(sessionDir, 'seg_%v_%04d.ts')
      );

      ffmpegProc
        .outputOptions(outputOptions)
        .output(path.join(sessionDir, 'stream_%v.m3u8'));
    } else {
      // Single Audio HLS
      const audioMap = audioStreams.length > 0 ? `0:a:${selectedAudioIdx}` : '0:a:0?';
      const selectedAudio = audioStreams[selectedAudioIdx] || audioStreams[0];
      const canCopyAudio = selectedAudio && selectedAudio.codec_name === 'aac' && (!selectedAudio.channels || selectedAudio.channels <= 2);

      const audioCodecArgs = canCopyAudio
        ? ['-c:a', 'copy']
        : ['-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-ar', '48000'];

      const outputOptions = [
        '-map', '0:v:0',
        '-map', audioMap,
        ...videoCodecArgs,
        ...audioCodecArgs,
        '-f', 'hls',
        '-hls_init_time', '2',
        '-hls_time', '3',
        '-hls_list_size', '0',
        '-hls_playlist_type', 'event',
        '-hls_flags', 'independent_segments+temp_file+split_by_time',
        '-max_muxing_queue_size', '4096',
        '-hls_segment_filename', path.join(sessionDir, 'segment_%04d.ts'),
      ];

      ffmpegProc
        .outputOptions(outputOptions)
        .output(path.join(sessionDir, 'master.m3u8'));
    }

    ffmpegProc
      .on('start', () => {
        console.log(`[FFmpeg Started] ${infoHash}`);
      })
      .on('progress', (p) => {
        if (session.status === 'transcoding' && p.timemark) {
          this.checkReadyState(infoHash, sessionDir);
        }
      })
      .on('end', async () => {
        console.log(`[FFmpeg Complete] Finished HLS transcode for ${infoHash}`);
        await this.finalizeUpload(infoHash, sessionDir);
      })
      .on('error', (err: any) => {
        console.error(`[FFmpeg Error] ${infoHash}:`, err.message);
        if (session.status !== 'ready' && session.status !== 'completed') {
          session.status = 'error';
          session.error = `FFmpeg transcode error: ${err.message}`;
          this.emit('session_updated', session);
        }
      });

    ffmpegProc.run();
    this.ffmpegProcesses.set(infoHash, ffmpegProc);

    // Start background watcher to upload segments and playlists to Cloudflare R2
    this.startR2Sync(infoHash, sessionDir);
  }

  async switchAudioTrack(infoHash: string, audioIndex: number): Promise<StreamSession> {
    const cleanHash = infoHash.toLowerCase();
    const session = this.sessions.get(cleanHash);
    if (!session) throw new Error('Sessão não encontrada');

    const torrent = this.torrents.get(cleanHash);
    if (!torrent || !torrent.files || torrent.files.length === 0) {
      throw new Error('Torrent ainda carregando metadados');
    }

    const videoFile = torrent.files.reduce((prev: any, curr: any) =>
      prev.length > curr.length ? prev : curr
    );

    if (session.audioTracks) {
      session.audioTracks = session.audioTracks.map((t) => ({
        ...t,
        isDefault: t.id === audioIndex,
      }));
    }

    const sessionDir = path.join(config.tempDir, cleanHash);
    console.log(`[Switch Audio Track] Switching ${cleanHash} to audio index ${audioIndex}...`);
    this.startTranscoding(cleanHash, videoFile, sessionDir, audioIndex);
    return session;
  }

  private checkReadyState(infoHash: string, sessionDir: string) {
    const session = this.sessions.get(infoHash);
    if (!session || session.status === 'ready' || session.status === 'completed') return;

    try {
      const files = fs.readdirSync(sessionDir);
      const masterPath = path.join(sessionDir, 'master.m3u8');
      const hasM3u8 = fs.existsSync(masterPath) && fs.statSync(masterPath).size > 40;

      // Find all completed .ts segments (exclude .tmp files) with valid size (> 20KB)
      const validTsSegments = files
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.tmp'))
        .filter((f) => {
          try {
            return fs.statSync(path.join(sessionDir, f)).size > 20000;
          } catch {
            return false;
          }
        });

      // Passthrough is 500x speed so 1 segment is ready instantly.
      // Transcode buffers at least 3 segments (8-10 seconds buffer) so playback NEVER catches up to transcoding!
      const minSegmentsRequired = session.isPassthrough ? 1 : 3;

      if (hasM3u8 && validTsSegments.length >= minSegmentsRequired) {
        session.status = 'ready';
        session.updatedAt = Date.now();
        console.log(`[Stream Ready ⚡] ${infoHash} is now ready for playback! (${validTsSegments.length} segments buffered, buffer safety secured)`);
        this.emit('session_updated', session);
      }
    } catch {
      // directory might be transient
    }
  }

  private startR2Sync(infoHash: string, sessionDir: string) {
    const uploaded = new Set<string>();

    const interval = setInterval(async () => {
      try {
        if (!fs.existsSync(sessionDir)) return;
        const files = fs.readdirSync(sessionDir);

        // Upload all new .ts segments (immutable) in parallel with no batch limit
        const tsSegments = files
          .filter((f) => f.endsWith('.ts') && !f.endsWith('.tmp'))
          .sort();

        const pendingSegs = tsSegments.filter((seg) => !uploaded.has(seg));
        if (pendingSegs.length > 0) {
          await Promise.allSettled(
            pendingSegs.map(async (seg) => {
              const segPath = path.join(sessionDir, seg);
              const r2Key = `streams/${infoHash}/${seg}`;
              try {
                const stat = fs.statSync(segPath);
                if (stat.size > 15000) {
                  await r2Service.uploadFile(r2Key, segPath, 'video/MP2T', true);
                  uploaded.add(seg);
                }
              } catch {}
            })
          );

          const session = this.sessions.get(infoHash);
          if (session) {
            session.uploadedSegments = uploaded.size;
            session.totalSegments = Math.max(session.totalSegments, tsSegments.length);
          }
        }

        // Upload all .m3u8 playlists
        const m3u8Files = files.filter((f) => f.endsWith('.m3u8') && !f.endsWith('.tmp'));
        for (const pl of m3u8Files) {
          const plPath = path.join(sessionDir, pl);
          const r2Key = `streams/${infoHash}/${pl}`;
          try {
            if (fs.statSync(plPath).size > 40) {
              await r2Service.uploadFile(r2Key, plPath, 'application/vnd.apple.mpegurl', false).catch(() => {});
            }
          } catch {}
        }

        // Upload any .vtt subtitle files
        const vttFiles = files.filter((f) => f.endsWith('.vtt') && !f.endsWith('.tmp'));
        for (const vtt of vttFiles) {
          const vttPath = path.join(sessionDir, vtt);
          const r2Key = `streams/${infoHash}/${vtt}`;
          await r2Service.uploadFile(r2Key, vttPath, 'text/vtt', true).catch(() => {});
        }

        this.checkReadyState(infoHash, sessionDir);
      } catch (err: any) {
        console.error(`[R2 Sync Error] ${infoHash}:`, err.message);
      }
    }, 3000);

    this.uploadIntervals.set(infoHash, interval);
  }

  private async finalizeUpload(infoHash: string, sessionDir: string) {
    const interval = this.uploadIntervals.get(infoHash);
    if (interval) {
      clearInterval(interval);
      this.uploadIntervals.delete(infoHash);
    }

    try {
      const files = fs.readdirSync(sessionDir);
      for (const file of files) {
        const filePath = path.join(sessionDir, file);
        const r2Key = `streams/${infoHash}/${file}`;
        const isTs = file.endsWith('.ts');
        const isVtt = file.endsWith('.vtt');
        const contentType = file.endsWith('.m3u8')
          ? 'application/vnd.apple.mpegurl'
          : isTs
          ? 'video/MP2T'
          : isVtt
          ? 'text/vtt'
          : 'application/octet-stream';

        await r2Service.uploadFile(r2Key, filePath, contentType, isTs || isVtt);
      }

      const session = this.sessions.get(infoHash);
      if (session) {
        session.status = 'completed';
        session.progress = 100;
        session.isR2Cached = true;
        session.playlistUrl = r2Service.getPublicUrl(`streams/${infoHash}/master.m3u8`);
        this.emit('session_updated', session);
      }

      console.log(`[R2 Sync Completed] Stream ${infoHash} is now 100% stored in Cloudflare R2!`);
    } catch (err: any) {
      console.error(`[Finalize Error] ${infoHash}:`, err.message);
    }
  }

  getAllSessions(): StreamSession[] {
    return Array.from(this.sessions.values());
  }

  async stopStream(infoHash: string): Promise<StreamSession | null> {
    const cleanHash = infoHash.toLowerCase();
    const session = this.sessions.get(cleanHash);

    // 1. Clear upload interval
    const interval = this.uploadIntervals.get(cleanHash);
    if (interval) {
      clearInterval(interval);
      this.uploadIntervals.delete(cleanHash);
    }

    // 2. Kill FFmpeg process
    const proc = this.ffmpegProcesses.get(cleanHash);
    if (proc) {
      try { proc.kill('SIGKILL'); } catch {}
      this.ffmpegProcesses.delete(cleanHash);
    }

    // 3. Destroy input stream
    const inputStream = this.inputStreams.get(cleanHash);
    if (inputStream) {
      try { inputStream.destroy(); } catch {}
      this.inputStreams.delete(cleanHash);
    }

    // 4. Stop and destroy torrent
    const torrent = this.torrents.get(cleanHash);
    if (torrent) {
      try {
        torrent.pause();
        torrent.destroy({ destroyStore: false });
      } catch {}
      this.torrents.delete(cleanHash);
    }
    this.videoFiles.delete(cleanHash);

    if (session) {
      session.status = 'stopped';
      session.downloadSpeed = 0;
      session.updatedAt = Date.now();
      this.emit('session_updated', session);
    }

    console.log(`[Stream Stopped] Successfully paused/stopped download & transcode for ${cleanHash}`);
    return session || null;
  }

  async deleteStream(infoHash: string, deleteFromR2 = true): Promise<{ success: boolean; deletedR2Count: number }> {
    const cleanHash = infoHash.toLowerCase();

    // 1. Stop active processes
    await this.stopStream(cleanHash);

    // 2. Delete local directory
    const sessionDir = path.join(config.tempDir, cleanHash);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[Delete Local] Removed local cache directory for ${cleanHash}`);
      } catch (err: any) {
        console.error(`[Delete Local Error] ${cleanHash}:`, err.message);
      }
    }

    // 3. Delete from Cloudflare R2 if requested
    let deletedR2Count = 0;
    if (deleteFromR2) {
      try {
        deletedR2Count = await r2Service.deleteFolder(`streams/${cleanHash}/`);
        console.log(`[Delete R2] Removed ${deletedR2Count} files from Cloudflare R2 for ${cleanHash}`);
      } catch (err: any) {
        console.error(`[Delete R2 Error] ${cleanHash}:`, err.message);
      }
    }

    // 4. Remove session from memory
    this.sessions.delete(cleanHash);
    this.emit('session_deleted', { infoHash: cleanHash });

    return { success: true, deletedR2Count };
  }

  getDiskUsage(): { totalBytes: number; sessions: { infoHash: string; totalBytes: number; fileCount: number }[] } {
    let totalBytes = 0;
    const sessions: { infoHash: string; totalBytes: number; fileCount: number }[] = [];
    try {
      if (fs.existsSync(config.tempDir)) {
        const entries = fs.readdirSync(config.tempDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const dirPath = path.join(config.tempDir, entry.name);
            let dirBytes = 0;
            let count = 0;
            try {
              const files = fs.readdirSync(dirPath);
              for (const f of files) {
                try {
                  const stat = fs.statSync(path.join(dirPath, f));
                  dirBytes += stat.size;
                  count++;
                } catch {}
              }
            } catch {}
            totalBytes += dirBytes;
            sessions.push({
              infoHash: entry.name.toLowerCase(),
              totalBytes: dirBytes,
              fileCount: count,
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Error calculating disk usage:', err.message);
    }
    return { totalBytes, sessions };
  }

  async getStorageOverview(): Promise<StorageOverview> {
    const disk = this.getDiskUsage();
    const r2 = await r2Service.getStorageUsage();

    // Map existing sessions for titles
    const titleMap = new Map<string, string>();
    this.sessions.forEach((s) => {
      if (s.title) titleMap.set(s.infoHash.toLowerCase(), s.title);
    });

    const itemMap = new Map<string, StorageItem>();

    // Add local items
    for (const d of disk.sessions) {
      const hash = d.infoHash.toLowerCase();
      const title = titleMap.get(hash) || `Download ${hash.slice(0, 8)}`;
      const activeSession = this.sessions.get(hash);
      itemMap.set(hash, {
        infoHash: hash,
        title,
        fileCount: d.fileCount,
        totalBytes: d.totalBytes,
        sizeFormatted: formatBytes(d.totalBytes),
        isLocal: true,
        isR2: false,
        status: activeSession?.status || 'local',
        progress: activeSession?.progress || (d.totalBytes > 0 ? 100 : 0),
      });
    }

    // Add or merge R2 items
    for (const r of r2.streams) {
      const hash = r.infoHash.toLowerCase();
      const existing = itemMap.get(hash);
      const title = titleMap.get(hash) || existing?.title || `Stream ${hash.slice(0, 8)}`;
      const activeSession = this.sessions.get(hash);

      if (existing) {
        existing.isR2 = true;
        existing.fileCount += r.fileCount;
        existing.totalBytes += r.totalBytes;
        existing.sizeFormatted = formatBytes(existing.totalBytes);
        existing.lastModified = r.lastModified;
        if (activeSession) {
          existing.status = activeSession.status;
          existing.progress = activeSession.progress;
        }
      } else {
        itemMap.set(hash, {
          infoHash: hash,
          title,
          fileCount: r.fileCount,
          totalBytes: r.totalBytes,
          sizeFormatted: formatBytes(r.totalBytes),
          isLocal: false,
          isR2: true,
          status: activeSession?.status || 'r2_cached',
          progress: 100,
          lastModified: r.lastModified,
        });
      }
    }

    return {
      local: {
        totalBytes: disk.totalBytes,
        sizeFormatted: formatBytes(disk.totalBytes),
        path: config.tempDir,
        sessionsCount: disk.sessions.length,
      },
      r2: {
        totalBytes: r2.totalBytes,
        totalFiles: r2.totalFiles,
        sizeFormatted: formatBytes(r2.totalBytes),
        bucket: config.r2.bucket,
        publicUrl: config.r2.publicUrl,
        connected: true,
      },
      items: Array.from(itemMap.values()),
    };
  }

  async cleanAllR2(): Promise<number> {
    return r2Service.deleteFolder('streams/');
  }

  async cleanAllLocal(): Promise<number> {
    let deleted = 0;
    try {
      if (fs.existsSync(config.tempDir)) {
        const dirs = fs.readdirSync(config.tempDir);
        for (const dir of dirs) {
          const dirPath = path.join(config.tempDir, dir);
          try {
            await this.stopStream(dir);
            fs.rmSync(dirPath, { recursive: true, force: true });
            deleted++;
          } catch {}
        }
      }
    } catch (err: any) {
      console.error('Error cleaning local temp:', err.message);
    }
    return deleted;
  }

  async getVideoSource(infoHash: string, magnet?: string): Promise<{
    name: string;
    size: number;
    createStream: (range?: { start: number; end: number }) => NodeJS.ReadableStream;
  } | null> {
    const cleanHash = infoHash.toLowerCase();

    // 1. Check in-memory videoFile
    const existingFile = this.videoFiles.get(cleanHash);
    if (existingFile) {
      return {
        name: existingFile.name,
        size: existingFile.length,
        createStream: (range) => (range ? existingFile.createReadStream(range) : existingFile.createReadStream()),
      };
    }

    // 2. Check in-memory torrent
    let torrent = this.torrents.get(cleanHash);
    if (torrent) {
      if (torrent.files && torrent.files.length > 0) {
        const videoFile = torrent.files.reduce((prev: any, curr: any) => (prev.length > curr.length ? prev : curr));
        this.videoFiles.set(cleanHash, videoFile);
        return {
          name: videoFile.name,
          size: videoFile.length,
          createStream: (range) => (range ? videoFile.createReadStream(range) : videoFile.createReadStream()),
        };
      } else {
        // Wait up to 15 seconds for torrent to be ready
        await new Promise<void>((resolve) => {
          const onReady = () => { cleanup(); resolve(); };
          const timer = setTimeout(() => { cleanup(); resolve(); }, 15000);
          const cleanup = () => { torrent.removeListener('ready', onReady); clearTimeout(timer); };
          torrent.once('ready', onReady);
        });
        if (torrent.files && torrent.files.length > 0) {
          const videoFile = torrent.files.reduce((prev: any, curr: any) => (prev.length > curr.length ? prev : curr));
          this.videoFiles.set(cleanHash, videoFile);
          return {
            name: videoFile.name,
            size: videoFile.length,
            createStream: (range) => (range ? videoFile.createReadStream(range) : videoFile.createReadStream()),
          };
        }
      }
    }

    // 3. Check on disk in sessionDir
    const sessionDir = path.join(config.tempDir, cleanHash);
    const diskVideo = this.findLargestVideoOnDisk(sessionDir);
    if (diskVideo) {
      return {
        name: diskVideo.name,
        size: diskVideo.size,
        createStream: (range) => (range ? fs.createReadStream(diskVideo.path, range) : fs.createReadStream(diskVideo.path)),
      };
    }

    // 4. If magnet is supplied and not running, start stream session on-demand
    if (magnet) {
      console.log(`[Direct Stream On-Demand ⚡] Starting torrent ${cleanHash} from magnet query...`);
      await this.startStream({
        magnet,
        mediaId: cleanHash,
        mediaType: 'movie',
        title: 'Direct Stream Video',
      });

      torrent = this.torrents.get(cleanHash);
      if (torrent) {
        await new Promise<void>((resolve) => {
          if (torrent.files && torrent.files.length > 0) return resolve();
          const onReady = () => { cleanup(); resolve(); };
          const timer = setTimeout(() => { cleanup(); resolve(); }, 20000);
          const cleanup = () => { torrent.removeListener('ready', onReady); clearTimeout(timer); };
          torrent.once('ready', onReady);
        });

        if (torrent.files && torrent.files.length > 0) {
          const videoFile = torrent.files.reduce((prev: any, curr: any) => (prev.length > curr.length ? prev : curr));
          this.videoFiles.set(cleanHash, videoFile);
          return {
            name: videoFile.name,
            size: videoFile.length,
            createStream: (range) => (range ? videoFile.createReadStream(range) : videoFile.createReadStream()),
          };
        }
      }
    }

    return null;
  }

  private findLargestVideoOnDisk(dir: string): { path: string; name: string; size: number } | null {
    if (!fs.existsSync(dir)) return null;
    let largest: { path: string; name: string; size: number } | null = null;

    const walk = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const isVideoExt = ['.mkv', '.mp4', '.avi', '.mov', '.webm', '.ts', '.m4v'].includes(ext);
            const isHlsSegment = entry.name.endsWith('.ts') && currentDir === dir;
            if (isVideoExt && !isHlsSegment) {
              const stat = fs.statSync(fullPath);
              if (stat.size > 20 * 1024 * 1024 && (!largest || stat.size > largest.size)) {
                largest = { path: fullPath, name: entry.name, size: stat.size };
              }
            }
          }
        }
      } catch {}
    };

    walk(dir);
    return largest;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

export const streamManager = new StreamManager();
