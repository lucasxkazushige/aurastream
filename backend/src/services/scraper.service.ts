import axios from 'axios';
import { TorrentStream } from '../types/index.js';
import { r2Service } from './r2.service.js';

const TRACKERS = [
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

// All providers supported by Torrentio
const ALL_PROVIDERS = 'yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,nekobt,rutor,rutracker,comando,bludv,micoleaodublado,torrent9,ilcorsaronero,mejortorrent,wolfmax4k,cinecalidad,besttorrents';

// Strictly Portuguese / Brazilian Priority Providers (Excluded Spanish/Latino providers like Cinecalidad and Wolfmax4k)
const BR_PROVIDERS = 'comando,bludv,micoleaodublado';
const PT_PROVIDERS = 'comando,bludv,micoleaodublado,torrentgalaxy,1337x,thepiratebay,kickasstorrents,rarbg';

class ScraperService {
  async getStreams(params: {
    imdbId?: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
    title?: string;
    year?: string;
  }): Promise<TorrentStream[]> {
    const { imdbId, type, season, episode, title, year } = params;
    const streamMap = new Map<string, TorrentStream>();

    // Parallel fetch from multiple scrapers/indexers
    const promises: Promise<void>[] = [];

    // 1. Torrentio with Brazilian Priority (Dedicated BR query + PT-prioritized indexers + general catalog)
    if (imdbId) {
      promises.push(this.fetchTorrentio(imdbId, type, season, episode, BR_PROVIDERS, 'foreign_priority=portuguese', streamMap));
      promises.push(this.fetchTorrentio(imdbId, type, season, episode, PT_PROVIDERS, 'foreign_priority=portuguese', streamMap));
      promises.push(this.fetchTorrentio(imdbId, type, season, episode, ALL_PROVIDERS, '', streamMap));
    }

    // 2. ThePirateBay (Apibay) Direct Search for PT-BR and Original
    if (title) {
      const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
      const seasonEp = type === 'tv' && season && episode ? `S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}` : '';

      // Search Portuguese Dubbed and Subtitled releases
      promises.push(this.fetchApibay(`${cleanTitle} ${seasonEp} dublado`.trim(), streamMap));
      promises.push(this.fetchApibay(`${cleanTitle} ${seasonEp} pt-br`.trim(), streamMap));
      promises.push(this.fetchApibay(`${cleanTitle} ${seasonEp} dual audio`.trim(), streamMap));
      if (imdbId) {
        promises.push(this.fetchApibay(imdbId, streamMap));
      }

    }

    // 3. EZTV Direct API for TV Shows
    if (type === 'tv' && imdbId) {
      const numericId = imdbId.replace(/^tt/, '');
      promises.push(this.fetchEztv(numericId, season, episode, streamMap));
    }

    // Wait for all scrapers to settle (timeout handled per request)
    await Promise.allSettled(promises);

    const streams = Array.from(streamMap.values());

    // Check R2 cache in parallel for all unique streams
    await Promise.all(
      streams.map(async (stream) => {
        try {
          const r2PlaylistKey = `streams/${stream.infoHash.toLowerCase()}/master.m3u8`;
          stream.isCachedOnR2 = await r2Service.fileExists(r2PlaylistKey);
        } catch {
          stream.isCachedOnR2 = false;
        }
      })
    );

    // Smart Prioritization:
    // 1. R2 Cached + PT-BR Dubbed (+55000)
    // 2. Dublado / Dual Áudio PT-BR (+30000 + seeds)
    // 3. R2 Cached (+25000)
    // 4. Legendado PT-BR (+15000 + seeds)
    // 5. Outros por seeds
    streams.sort((a, b) => {
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      return scoreB - scoreA;
    });

    return streams;
  }

  private calculatePriorityScore(s: TorrentStream): number {
    let score = s.seeds || 0;

    // R2 Cached bonus
    if (s.isCachedOnR2) {
      score += 25000;
      if (s.hasPtBr && s.isDubbed) score += 30000;
    }

    // Dublado / Dual Áudio PT-BR bonus
    if (s.hasPtBr && s.isDubbed) {
      score += 30000;
    } else if (s.hasPtBr) {
      // Subtitled PT-BR bonus
      score += 15000;
    }

    // Resolution bonus
    if (s.resolution === '4K') score += 600;
    else if (s.resolution === '1080p') score += 500;
    else if (s.resolution === '720p') score += 200;

    return score;
  }

  public classifyStream(rawTitle: string, rawDetails: string = '', sourceProvider: string = ''): {
    hasPtBr: boolean;
    isDubbed: boolean;
    audioLanguage: string;
  } {
    const fullText = `${rawTitle} ${rawDetails} ${sourceProvider}`.toLowerCase();

    // Extract provider from details or sourceProvider
    let provider = sourceProvider.toLowerCase();
    const provMatch = rawDetails.match(/⚙️\s*([^\n\r]+)/);
    if (provMatch) provider = provMatch[1].trim().toLowerCase();

    // Known Provider Classifications
    const isBrProvider = ['comando', 'bludv', 'micoleao', 'micoleaodublado', 'lapumia', 'brazuca', 'brazucatorrents'].some(
      (p) => provider.includes(p) || fullText.includes(p)
    );
    const isLatinoProvider = ['cinecalidad'].some((p) => provider.includes(p) || fullText.includes(p));
    const isSpanishProvider = ['mejortorrent', 'wolfmax4k'].some((p) => provider.includes(p) || fullText.includes(p));
    const isFrenchProvider = ['torrent9', 'oxbitt'].some((p) => provider.includes(p) || fullText.includes(p));
    const isItalianProvider = ['ilcorsaronero'].some((p) => provider.includes(p) || fullText.includes(p));
    const isRussianProvider = ['rutor', 'rutracker'].some((p) => provider.includes(p) || fullText.includes(p));

    // Flag emojis in details (Torrentio line 3)
    const hasBrFlag = rawDetails.includes('🇧🇷');
    const hasPtFlag = rawDetails.includes('🇵🇹');
    const hasMexFlag = rawDetails.includes('🇲🇽');
    const hasSpaFlag = rawDetails.includes('🇪🇸');
    const hasFraFlag = rawDetails.includes('🇫🇷');
    const hasItaFlag = rawDetails.includes('🇮🇹');
    const hasRusFlag = rawDetails.includes('🇷🇺') || rawDetails.includes('🇺🇦');
    const hasHinFlag = rawDetails.includes('🇮🇳');
    const flagCount = [hasBrFlag, hasPtFlag, hasMexFlag, hasSpaFlag, hasFraFlag, hasItaFlag, hasRusFlag, hasHinFlag].filter(Boolean).length;

    // Non-PT markers (False positive disrupters)
    const hasLatinoKeyword = /\b(dual[-_\s.]*lat|audio[-_\s.]*latino|latino|sub[-_\s.]*lat|lat[-_\s.]*cinecalidad)\b/i.test(fullText);
    const hasSpanishKeyword = /\b(castellano|spa[-_\s.]*eng|eng[-_\s.]*spa|espanol|español|subtitulado|subtitulos)\b/i.test(fullText) || /\[esp\]/i.test(fullText);
    const hasHindiKeyword = /\b(hindi|telugu|tamil|malayalam|kannada|bengali|bollywood|potonmovies|tombdoc|desiremovies|katmoviehd|hdhub4u|cinevood)\b/i.test(fullText);
    const hasRussianKeyword = /\b(dvo|mvo|lostfilm|hdrezka|rus|ukr|napisy|lektor|звук|перевод|лицензия)\b/i.test(fullText);
    const hasFrenchKeyword = /\b(vff|vfq|truefrench|french|vostfr|multi[-_\s.]*vf)\b/i.test(fullText);
    const hasItalianKeyword = /\b(ita|italian|italiano)\b/i.test(fullText) && (provider.includes('ilcorsaronero') || fullText.includes('sub ita') || fullText.includes('ita.eng'));

    // Explicit Portuguese markers
    const hasPtDubWord = /\b(dublado|dublada|dublados|dubladas|dublagem)\b/i.test(fullText);
    const hasPtSubWord =
      /\b(legendado|legendada|legendados|legendadas|legenda\s*fixa|subpack\s*pt|softsub\s*pt)\b/i.test(fullText) ||
      /\b(legenda\s*pt[-_]?br|legendas?\s*pt[-_]?br|legendas?\s*pt)\b/i.test(fullText);
    const hasPtCode = /\b(pt[-_]?br|ptbr)\b/i.test(fullText);
    const hasPtLanguage = /\b(portugu[eê]s|portuguese)\b/i.test(fullText);
    const hasNacional = /\b(nacional|filme\s*nacional|cinema\s*nacional)\b/i.test(fullText);
    const hasPtAudioWord = /\b(audio\s*(em\s*)?portugu[eê]s|audio\s*pt[-_]?br|dual\s*audio\s*pt|dual\s*pt)\b/i.test(fullText);
    const hasPtPtCode = /\bpt[-_]?pt\b/i.test(fullText);

    // Subtitle detection in Torrentio details
    const isTorrentioSubsOnly =
      (rawDetails.includes('Multi Subs') || rawDetails.includes('💬')) &&
      !rawDetails.includes('Dual Audio') &&
      !rawDetails.includes('Multi Audio');

    // Portuguese Audio / Sub determination
    let hasPtAudio = false;
    let hasPtSub = false;

    if (isBrProvider) {
      if (hasPtSubWord && !hasPtDubWord && !fullText.includes('dual')) {
        hasPtSub = true;
      } else {
        hasPtAudio = true;
      }
    } else if (hasBrFlag) {
      if (isTorrentioSubsOnly || (hasPtSubWord && !hasPtDubWord)) {
        hasPtSub = true;
      } else {
        hasPtAudio = true;
      }
    } else if (hasPtFlag) {
      if (isTorrentioSubsOnly || (hasPtSubWord && !hasPtDubWord)) {
        hasPtSub = true;
      } else {
        hasPtAudio = true;
      }
    } else if (hasPtDubWord || hasPtAudioWord || (hasPtCode && !hasPtSubWord) || hasNacional) {
      hasPtAudio = true;
    } else if (hasPtSubWord || (hasPtCode && hasPtSubWord)) {
      hasPtSub = true;
    }

    // False Positive Quarantine:
    // If not a Brazilian provider and no PT flags, disqualify if tainted by foreign audio without explicit PT dub keywords
    if (!isBrProvider && !hasBrFlag && !hasPtFlag) {
      if (hasHindiKeyword && !hasPtDubWord && !hasPtCode) hasPtAudio = false;
      if ((isLatinoProvider || hasLatinoKeyword) && !hasPtDubWord && !hasPtCode) hasPtAudio = false;
      if (hasRussianKeyword && !hasPtDubWord && !hasPtCode) hasPtAudio = false;
      if ((isSpanishProvider || hasSpanishKeyword) && !hasPtDubWord && !hasPtCode) hasPtAudio = false;
      if ((isFrenchProvider || hasFrenchKeyword) && !hasPtDubWord && !hasPtCode) hasPtAudio = false;
    }

    // 1. Validated Portuguese Audio
    if (hasPtAudio) {
      const isPtPt =
        (hasPtFlag && !hasBrFlag && !isBrProvider && !hasPtCode && !hasPtDubWord && !hasPtLanguage) ||
        hasPtPtCode;
      const isMulti = rawDetails.includes('Multi Audio') || flagCount > 2;

      return {
        hasPtBr: true,
        isDubbed: true,
        audioLanguage: isPtPt
          ? '🇵🇹 Dublado (PT-PT)'
          : isMulti
          ? '🇧🇷 Dublado (Multi-Áudio)'
          : '🇧🇷 Dublado (PT-BR)',
      };
    }

    // 2. Validated Portuguese Subtitles
    if (hasPtSub) {
      return {
        hasPtBr: true,
        isDubbed: false,
        audioLanguage: '💬 Legendado (PT-BR)',
      };
    }

    // 3. Accurate Non-PT Classification
    let audioLanguage = '🌐 Áudio Original';
    if (flagCount > 1 || rawDetails.includes('Multi Audio') || fullText.includes('multi')) {
      audioLanguage = '🌐 Áudio Original / Multi';
    } else if (isLatinoProvider || hasLatinoKeyword || hasMexFlag) {
      audioLanguage = '🇲🇽 Dublado (Latino)';
    } else if (isSpanishProvider || hasSpanishKeyword || hasSpaFlag) {
      audioLanguage = '🇪🇸 Dublado (Castelhano)';
    } else if (hasHindiKeyword || hasHinFlag) {
      audioLanguage = '🇮🇳 Áudio Hindi';
    } else if (isFrenchProvider || hasFrenchKeyword || hasFraFlag) {
      audioLanguage = '🇫🇷 Áudio Francês';
    } else if (isRussianProvider || hasRussianKeyword || hasRusFlag) {
      audioLanguage = '🇷🇺 Áudio Russo';
    } else if (isItalianProvider || hasItalianKeyword || hasItaFlag) {
      audioLanguage = '🇮🇹 Áudio Italiano';
    }

    return {
      hasPtBr: false,
      isDubbed: false,
      audioLanguage,
    };
  }

  private async fetchTorrentio(
    imdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    providers?: string,
    extraOpts?: string,
    streamMap?: Map<string, TorrentStream>
  ) {
    try {
      const streamPath =
        type === 'movie'
          ? `movie/${imdbId}.json`
          : `series/${imdbId}:${season || 1}:${episode || 1}.json`;

      let config = `providers=${providers || ALL_PROVIDERS}`;
      if (extraOpts) config += `|${extraOpts}`;

      const url = `https://torrentio.strem.fun/${config}/stream/${streamPath}`;
      const response = await axios.get(url, {
        timeout: 6500,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });

      if (response.data && Array.isArray(response.data.streams)) {
        for (const item of response.data.streams) {
          const parsed = this.parseTorrentioItem(item);
          if (parsed && !streamMap?.has(parsed.infoHash)) {
            streamMap?.set(parsed.infoHash, parsed);
          }
        }
      }
    } catch {
      // ignore timeout
    }
  }

  private async fetchApibay(query: string, streamMap?: Map<string, TorrentStream>) {
    try {
      const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].name !== 'No results returned') {
        for (const item of response.data) {
          const seeds = parseInt(item.seeders || '0', 10);
          if (seeds <= 0) continue;

          const infoHash = (item.info_hash || '').toLowerCase();
          if (!infoHash || streamMap?.has(infoHash)) continue;

          const sizeBytes = parseInt(item.size || '0', 10);
          const sizeGB = (sizeBytes / (1024 * 1024 * 1024)).toFixed(2);
          const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
          const size = sizeBytes > 1024 * 1024 * 1024 ? `${sizeGB} GB` : `${sizeMB} MB`;

          const rawTitle = item.name || 'Vídeo Torrent';
          const fullText = rawTitle.toLowerCase();

          // Precise classification
          const { hasPtBr, isDubbed, audioLanguage } = this.classifyStream(rawTitle, '', 'ThePirateBay');

          let resolution: TorrentStream['resolution'] = 'Unknown';
          if (fullText.includes('4k') || fullText.includes('2160p')) resolution = '4K';
          else if (fullText.includes('1080p')) resolution = '1080p';
          else if (fullText.includes('720p')) resolution = '720p';
          else if (fullText.includes('480p')) resolution = '480p';

          const trackerParams = TRACKERS.map((t) => `tr=${encodeURIComponent(t)}`).join('&');
          const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(rawTitle)}&${trackerParams}`;

          streamMap?.set(infoHash, {
            id: infoHash,
            title: rawTitle,
            resolution,
            quality: resolution,
            size,
            sizeBytes,
            seeds,
            peers: parseInt(item.leechers || '0', 10),
            magnet,
            infoHash,
            source: 'ThePirateBay',
            hasPtBr,
            isDubbed,
            audioLanguage,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  private async fetchEztv(numericId: string, season?: number, episode?: number, streamMap?: Map<string, TorrentStream>) {
    try {
      const url = `https://eztvx.to/api/get-torrents?imdb_id=${numericId}`;
      const response = await axios.get(url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (response.data && Array.isArray(response.data.torrents)) {
        for (const item of response.data.torrents) {
          const epMatch = season && episode ? item.season === season && item.episode === episode : true;
          if (!epMatch) continue;

          const infoHash = (item.hash || '').toLowerCase();
          if (!infoHash || streamMap?.has(infoHash)) continue;

          const seeds = item.seeds || 0;
          if (seeds <= 0) continue;

          const sizeBytes = item.size_bytes || 0;
          const size =
            sizeBytes > 1024 * 1024 * 1024
              ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
              : `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

          const rawTitle = item.title || 'EZTV Torrent';
          const fullText = rawTitle.toLowerCase();

          const { hasPtBr, isDubbed, audioLanguage } = this.classifyStream(rawTitle, '', 'EZTV');

          let resolution: TorrentStream['resolution'] = 'Unknown';
          if (fullText.includes('1080p')) resolution = '1080p';
          else if (fullText.includes('720p')) resolution = '720p';
          else if (fullText.includes('2160p') || fullText.includes('4k')) resolution = '4K';
          else if (fullText.includes('480p')) resolution = '480p';

          const magnet = item.magnet_url || `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(rawTitle)}`;

          streamMap?.set(infoHash, {
            id: infoHash,
            title: rawTitle,
            resolution,
            quality: resolution,
            size,
            sizeBytes,
            seeds,
            peers: item.peers || 0,
            magnet,
            infoHash,
            source: 'EZTV',
            hasPtBr,
            isDubbed,
            audioLanguage,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  private parseTorrentioItem(item: any): TorrentStream | null {
    if (!item.infoHash) return null;

    const infoHash = item.infoHash.toLowerCase();
    const rawTitle = item.title || '';
    const rawName = item.name || '';
    const fullText = `${rawName} ${rawTitle}`.toLowerCase();

    // Source provider (e.g. ⚙️ Comando, ⚙️ BluDV, ⚙️ MicoLeao, ⚙️ 1337x, ⚙️ TorrentGalaxy)
    let source = 'P2P';
    const sourceMatch = rawTitle.match(/⚙️\s*([^\n\r]+)/);
    if (sourceMatch) {
      source = sourceMatch[1].trim();
    }

    // Clean title (first line)
    const cleanTitle = rawTitle.split('\n')[0] || rawName || 'Vídeo Torrent';

    // Rigorous language classification
    const { hasPtBr, isDubbed, audioLanguage } = this.classifyStream(cleanTitle, rawTitle, source);

    // Resolution detection
    let resolution: TorrentStream['resolution'] = 'Unknown';
    if (fullText.includes('4k') || fullText.includes('2160p') || rawName.toLowerCase().includes('4k')) {
      resolution = '4K';
    } else if (fullText.includes('1080p') || rawName.toLowerCase().includes('1080p')) {
      resolution = '1080p';
    } else if (fullText.includes('720p') || rawName.toLowerCase().includes('720p')) {
      resolution = '720p';
    } else if (fullText.includes('480p') || rawName.toLowerCase().includes('480p')) {
      resolution = '480p';
    }

    // Extract seeds (e.g., 👤 284)
    let seeds = 0;
    const seedMatch = rawTitle.match(/👤\s*(\d+)/);
    if (seedMatch) {
      seeds = parseInt(seedMatch[1], 10);
    }

    // Extract size (e.g., 💾 8.91 GB or 💾 950 MB)
    let size = 'Desconhecido';
    let sizeBytes = 0;
    const sizeMatch = rawTitle.match(/💾\s*([\d.]+)\s*(GB|MB|KB)/i);
    if (sizeMatch) {
      size = `${sizeMatch[1]} ${sizeMatch[2].toUpperCase()}`;
      const num = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      if (unit === 'GB') sizeBytes = num * 1024 * 1024 * 1024;
      else if (unit === 'MB') sizeBytes = num * 1024 * 1024;
      else if (unit === 'KB') sizeBytes = num * 1024;
    }

    // Build Magnet URL with trackers
    const trackerParams = TRACKERS.map((t) => `tr=${encodeURIComponent(t)}`).join('&');
    const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(cleanTitle)}&${trackerParams}`;

    return {
      id: infoHash,
      title: cleanTitle,
      resolution,
      quality: resolution,
      size,
      sizeBytes,
      seeds,
      peers: 0,
      magnet,
      infoHash,
      source,
      hasPtBr,
      isDubbed,
      audioLanguage,
    };
  }

  parseMagnetUri(magnetUri: string): TorrentStream {
    let infoHash = '';
    const match = magnetUri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    if (match) {
      infoHash = match[1].toLowerCase();
    } else {
      infoHash = `custom_${Date.now()}`;
    }

    let title = 'Torrent Personalizado';
    const dnMatch = magnetUri.match(/dn=([^&]+)/i);
    if (dnMatch) {
      title = decodeURIComponent(dnMatch[1]);
    }

    const { hasPtBr, isDubbed, audioLanguage } = this.classifyStream(title, '', 'Magnet Manual');

    return {
      id: infoHash,
      title,
      resolution: 'Unknown',
      quality: 'HD',
      size: 'Sob demanda',
      sizeBytes: 0,
      seeds: 1,
      peers: 0,
      magnet: magnetUri,
      infoHash,
      source: 'Magnet Manual',
      hasPtBr,
      isDubbed,
      audioLanguage,
    };
  }
}

export const scraperService = new ScraperService();
