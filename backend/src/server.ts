import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { tmdbRouter } from './routes/tmdb.routes.js';
import { streamRouter } from './routes/stream.routes.js';
import { stremioRouter } from './routes/stremio.routes.js';
import { streamManager } from './services/streamManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err: any) => {
  if (err?.code === 'PREMATURE_CLOSE' || err?.message?.includes('Writable stream closed')) {
    return;
  }
  console.error('[Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[Unhandled Rejection]:', reason);
});

const app = express();
const server = http.createServer(app);

// WebSocket server for real-time streaming progress
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Streaming Orchestrator' }));
});

// Broadcast session updates to all connected clients
streamManager.on('session_updated', (session) => {
  const msg = JSON.stringify({ type: 'session_update', data: session });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// API Routes
app.use('/api/tmdb', tmdbRouter);
app.use('/api/stream', streamRouter);
app.use('/stremio', stremioRouter);

// Static downloads directory (APK, fallbacks locais)
const downloadsDir = process.env.DOWNLOADS_DIR || path.resolve(__dirname, '../../downloads');
if (fs.existsSync(downloadsDir)) {
  console.log(`[Downloads] Serving local files from ${downloadsDir}`);
  app.use('/downloads', express.static(downloadsDir));
}

// ─── GitHub Releases — download sempre da versão mais recente ────────────────
// Cache do último release para não bater na API do GitHub toda requisição
const GITHUB_OWNER = 'lucasxkazushige';
const GITHUB_REPO  = 'aurastream';
const GITHUB_API   = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

interface ReleaseCache {
  fetchedAt: number;
  assets: Record<string, string>; // nome parcial → download_url
}

let releaseCache: ReleaseCache | null = null;

async function getLatestReleaseAssets(): Promise<Record<string, string>> {
  const now = Date.now();
  if (releaseCache && now - releaseCache.fetchedAt < CACHE_TTL_MS) {
    return releaseCache.assets;
  }

  try {
    const headers: Record<string, string> = { 'User-Agent': 'AuraStream-Backend' };
    const ghToken = process.env.GH_TOKEN;
    if (ghToken) headers['Authorization'] = `token ${ghToken}`;

    const resp = await fetch(GITHUB_API, { headers });
    if (!resp.ok) throw new Error(`GitHub API: ${resp.status}`);

    const data = await resp.json() as { assets: { name: string; browser_download_url: string }[] };
    const assets: Record<string, string> = {};
    for (const asset of data.assets) {
      assets[asset.name.toLowerCase()] = asset.browser_download_url;
    }

    releaseCache = { fetchedAt: now, assets };
    console.log(`[GitHub] Release cache atualizado: ${Object.keys(assets).join(', ')}`);
    return assets;
  } catch (err) {
    console.warn('[GitHub] Falha ao buscar release, usando fallback local:', err);
    return {}; // fallback: usa arquivos locais
  }
}

function makeGithubDownloadHandler(assetPattern: RegExp, localFallback: string) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const assets = await getLatestReleaseAssets();
      const key = Object.keys(assets).find((name) => assetPattern.test(name));
      if (key) {
        res.redirect(302, assets[key]);
        return;
      }
    } catch {}
    // Fallback: serve arquivo local se GitHub não estiver disponível
    res.redirect(localFallback);
  };
}

// Convenient direct short links — sempre a versão mais recente
app.get('/app.apk', (req, res) => { res.redirect('/downloads/AuraStream-TV.apk'); });
app.get('/tv',      (req, res) => { res.redirect('/downloads/AuraStream-TV.apk'); });

// Windows: instalador NSIS — busca do GitHub Releases automaticamente
app.get('/windows-setup.exe', makeGithubDownloadHandler(
  /setup.*\.exe$/i,
  '/downloads/AuraStream-Setup.exe'  // fallback local
));

// Linux: AppImage — busca do GitHub Releases automaticamente
app.get('/linux.AppImage', makeGithubDownloadHandler(
  /\.AppImage$/i,
  '/downloads/AuraStream-Linux.tar.gz'
));

// Linux legacy .tar.gz (fallback local)
app.get('/linux.tar.gz', (req, res) => { res.redirect('/downloads/AuraStream-Linux.tar.gz'); });

// Windows zip legado (fallback local)
app.get('/windows.zip', (req, res) => { res.redirect('/downloads/AuraStream-Windows.zip'); });

// Endpoint de status da versão atual (usado pela UI para mostrar versão)
app.get('/api/app/latest-version', async (req, res) => {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'AuraStream-Backend' };
    const ghToken = process.env.GH_TOKEN;
    if (ghToken) headers['Authorization'] = `token ${ghToken}`;

    const resp = await fetch(GITHUB_API, { headers });
    if (!resp.ok) throw new Error(`GitHub API: ${resp.status}`);
    const data = await resp.json() as { tag_name: string; published_at: string; body: string };
    res.json({ version: data.tag_name, publishedAt: data.published_at, notes: data.body });
  } catch {
    res.json({ version: 'unknown', publishedAt: null, notes: '' });
  }
});


// Serve Frontend build in production
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  console.log(`[Frontend] Serving static files from ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send({
      name: 'Universal Streaming API',
      status: 'Running',
      docs: '/api/stream/health',
    });
  });
}

// Start Server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Universal Streaming Server running on port ${config.port}`);
  console.log(`📡 Cloudflare R2 Bucket: ${config.r2.bucket}`);
  console.log(`🌐 Public R2 CDN: ${config.r2.publicUrl}`);
  console.log(`🎬 TMDB API: Connected`);
  console.log(`⚡ WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`====================================================`);
});
