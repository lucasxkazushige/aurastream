import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { scraperService } from '../services/scraper.service.js';
import { streamManager } from '../services/streamManager.js';
import { r2Service } from '../services/r2.service.js';
import { config } from '../config/index.js';

export const streamRouter = Router();

// Search torrent sources
streamRouter.get('/sources', async (req, res) => {
  try {
    const imdbId = req.query.imdbId as string;
    const type = ((req.query.type as string) || 'movie') as 'movie' | 'tv';
    const season = req.query.season ? parseInt(req.query.season as string, 10) : undefined;
    const episode = req.query.episode ? parseInt(req.query.episode as string, 10) : undefined;
    const title = req.query.title as string;
    const year = req.query.year as string;

    const streams = await scraperService.getStreams({
      imdbId,
      type,
      season,
      episode,
      title,
      year,
    });

    res.json({ count: streams.length, streams });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start or retrieve stream session
streamRouter.post('/start', async (req, res) => {
  try {
    const { magnet, mediaId, mediaType, title } = req.body;

    if (!magnet) {
      return res.status(400).json({ error: 'Magnet URI é obrigatório' });
    }

    const session = await streamManager.startStream({
      magnet,
      mediaId,
      mediaType,
      title,
    });

    res.json(session);
  } catch (err: any) {
    console.error('Error starting stream:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stream session status
streamRouter.get('/status/:infoHash', async (req, res) => {
  try {
    const infoHash = req.params.infoHash.toLowerCase();
    const session = await streamManager.getSession(infoHash);
    if (!session) {
      return res.status(404).json({ error: 'Sessão de streaming não encontrada' });
    }
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Switch audio track
streamRouter.post('/switch-audio', async (req, res) => {
  try {
    const { infoHash, audioIndex } = req.body;
    if (!infoHash || audioIndex === undefined) {
      return res.status(400).json({ error: 'infoHash e audioIndex são obrigatórios' });
    }
    const session = await streamManager.switchAudioTrack(infoHash, parseInt(audioIndex, 10));
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// All sessions
streamRouter.get('/sessions', (req, res) => {
  try {
    const sessions = streamManager.getAllSessions();
    res.json({ count: sessions.length, sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stop / Pause download & transcoding
streamRouter.post('/session/:infoHash/stop', async (req, res) => {
  try {
    const { infoHash } = req.params;
    const session = await streamManager.stopStream(infoHash);
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete stream session (local and optionally R2)
streamRouter.delete('/session/:infoHash', async (req, res) => {
  try {
    const { infoHash } = req.params;
    const deleteFromR2 = req.query.deleteR2 !== 'false';
    const result = await streamManager.deleteStream(infoHash, deleteFromR2);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Storage Overview (Local disk + Cloudflare R2 + active downloads)
streamRouter.get('/storage', async (req, res) => {
  try {
    const overview = await streamManager.getStorageOverview();
    res.json(overview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete stream files specifically from Cloudflare R2
streamRouter.delete('/r2/:infoHash', async (req, res) => {
  try {
    const { infoHash } = req.params;
    const count = await r2Service.deleteFolder(`streams/${infoHash.toLowerCase()}/`);
    // Update local session if exists
    const session = streamManager.getAllSessions().find((s) => s.infoHash.toLowerCase() === infoHash.toLowerCase());
    if (session) {
      session.isR2Cached = false;
    }
    res.json({ success: true, deletedCount: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clean all Cloudflare R2 stream files
streamRouter.post('/r2/clean-all', async (req, res) => {
  try {
    const deletedCount = await streamManager.cleanAllR2();
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clean all local temp files
streamRouter.post('/local/clean-all', async (req, res) => {
  try {
    const deletedCount = await streamManager.cleanAllLocal();
    res.json({ success: true, deletedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// HLS file handler (delivers local chunk or redirects to Cloudflare R2 CDN)
streamRouter.get('/hls/:infoHash/:file', async (req, res) => {
  const { infoHash, file } = req.params;
  const cleanHash = infoHash.toLowerCase();
  const localFilePath = path.join(config.tempDir, cleanHash, file);

  // If file exists locally on disk, serve it immediately
  if (fs.existsSync(localFilePath)) {
    const contentType = file.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : file.endsWith('.ts')
      ? 'video/MP2T'
      : file.endsWith('.vtt')
      ? 'text/vtt'
      : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (file.endsWith('.ts')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    return res.sendFile(path.resolve(localFilePath), { acceptRanges: true }, (err) => {
      if (err && !res.headersSent) {
        res.status(404).end();
      }
    });
  }

  // Otherwise redirect to Cloudflare R2 public URL
  const r2Key = `streams/${cleanHash}/${file}`;
  const r2Url = r2Service.getPublicUrl(r2Key);
  return res.redirect(302, r2Url);
});

// Health check endpoint
streamRouter.get('/health', async (req, res) => {
  try {
    const r2Ok = await r2Service.fileExists('healthcheck-test');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      r2: {
        bucket: config.r2.bucket,
        publicUrl: config.r2.publicUrl,
        connected: true,
      },
      tmdb: {
        configured: Boolean(config.tmdb.readToken),
      },
      tempDir: config.tempDir,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Direct original video stream (HTTP 206 Partial Content for 4K MKV/MP4 native playback with 0% CPU)
streamRouter.get('/direct/:infoHash', async (req, res) => {
  try {
    const { infoHash } = req.params;
    const cleanHash = infoHash.toLowerCase();
    const magnet = req.query.magnet as string | undefined;

    const source = await streamManager.getVideoSource(cleanHash, magnet);
    if (!source) {
      return res.status(404).json({ error: 'Arquivo de vídeo não encontrado para este torrent' });
    }

    const mimeType = (mime.lookup(source.name) as string) || 'video/x-matroska';
    const range = req.headers.range;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (!range) {
      res.writeHead(200, {
        'Content-Length': source.size,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(source.name)}"`,
      });
      return source.createStream().pipe(res);
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : source.size - 1;

    if (start >= source.size || end >= source.size || start < 0) {
      res.status(416).set({
        'Content-Range': `bytes */${source.size}`,
      }).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${source.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(source.name)}"`,
    });

    const stream = source.createStream({ start, end });
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Download original raw video file
streamRouter.get('/download/:infoHash', async (req, res) => {
  try {
    const { infoHash } = req.params;
    const cleanHash = infoHash.toLowerCase();
    const magnet = req.query.magnet as string | undefined;

    const source = await streamManager.getVideoSource(cleanHash, magnet);
    if (!source) {
      return res.status(404).json({ error: 'Arquivo não encontrado para download' });
    }

    const mimeType = (mime.lookup(source.name) as string) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(source.name)}"`);
    res.setHeader('Content-Length', source.size);

    const stream = source.createStream();
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Generate M3U playlist file for VLC / Smart TV / Kodi
streamRouter.get('/playlist/:infoHash.m3u', async (req, res) => {
  const { infoHash } = req.params;
  const cleanHash = infoHash.toLowerCase();
  const magnet = req.query.magnet as string | undefined;
  const title = (req.query.title as string) || 'AuraStream 4K Direct Video';
  const host = req.get('host') || '151.247.210.55:7700';
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const streamUrl = `${proto}://${host}/api/stream/direct/${cleanHash}${magnet ? `?magnet=${encodeURIComponent(magnet)}` : ''}`;

  const m3u = `#EXTM3U\n#EXTINF:-1 tvg-name="${title}" group-title="AuraStream 4K Direct",${title}\n${streamUrl}\n`;
  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.m3u"`);
  res.send(m3u);
});

// Generate STRM file for Kodi / Emby / Jellyfin
streamRouter.get('/playlist/:infoHash.strm', async (req, res) => {
  const { infoHash } = req.params;
  const cleanHash = infoHash.toLowerCase();
  const magnet = req.query.magnet as string | undefined;
  const title = (req.query.title as string) || 'stream';
  const host = req.get('host') || '151.247.210.55:7700';
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const streamUrl = `${proto}://${host}/api/stream/direct/${cleanHash}${magnet ? `?magnet=${encodeURIComponent(magnet)}` : ''}`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.strm"`);
  res.send(streamUrl);
});

