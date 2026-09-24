import { Router } from 'express';
import { scraperService } from '../services/scraper.service.js';

export const stremioRouter = Router();

// Stremio Addon Manifest
stremioRouter.get('/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  res.json({
    id: 'community.aurastream.vps',
    version: '1.0.0',
    name: 'AuraStream 4K (Sua VPS)',
    description: 'Streaming Direto em 4K HDR Nativo sem travamentos, tocando no player nativo da sua TV ou PC sem usar a CPU da VPS!',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: [],
    background: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1280&q=80',
    logo: 'https://img.icons8.com/fluency/512/aurora.png',
  });
});

// Stremio Stream Handler
stremioRouter.get('/stream/:type/:id', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const { type, id } = req.params;
    const cleanId = id.replace('.json', '');
    let imdbId = cleanId;
    let season: number | undefined;
    let episode: number | undefined;

    if (type === 'series' && cleanId.includes(':')) {
      const parts = cleanId.split(':');
      imdbId = parts[0];
      season = parseInt(parts[1], 10);
      episode = parseInt(parts[2], 10);
    }

    console.log(`[Stremio Addon 🎬] Querying streams for ${type} ${imdbId} (S:${season || '-'} E:${episode || '-'})`);

    const rawStreams = await scraperService.getStreams({
      imdbId,
      type: type === 'series' ? 'tv' : 'movie',
      season,
      episode,
    });

    const host = req.get('host') || '151.247.210.55:7700';
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';

    const streams = rawStreams.map((s) => {
      const directUrl = `${proto}://${host}/api/stream/direct/${s.infoHash}?magnet=${encodeURIComponent(s.magnet)}&title=${encodeURIComponent(s.title)}`;
      const is4K = s.resolution === '4K';
      const resBadge = is4K ? '👑 [4K HDR DIRECT]' : `⚡ [${s.resolution}]`;
      const audioBadge = s.hasPtBr && s.isDubbed ? '🇧🇷 Dublado PT-BR' : s.hasPtBr ? '💬 Legendado PT-BR' : '🌐 Áudio Original';

      return {
        name: `AuraStream\n${resBadge}`,
        title: `${s.title}\n💾 ${s.size} | 👤 ${s.seeds} seeds | ${audioBadge}\n⚡ Direct Stream 4K Nativo (0% CPU VPS)`,
        url: directUrl,
        behaviorHints: {
          bingeGroup: `aurastream-${s.resolution}`,
          notWebReady: false,
        },
      };
    });

    res.json({ streams });
  } catch (err: any) {
    console.error('[Stremio Error]:', err.message);
    res.json({ streams: [] });
  }
});
