import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Play,
  Star,
  Clock,
  Users,
  Zap,
  Link as LinkIcon,
  Film,
  Video,
  Plus,
  Check,
  Sparkles,
  ChevronRight,
  Tv,
  ChevronDown,
  Monitor,
} from 'lucide-react';
import { MediaItem, TorrentStream, Episode } from '../types';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { useToast } from './Toast';
import { ExternalPlayerModal } from './ExternalPlayerModal';
import { desktopService, AVAILABLE_PLAYERS, DesktopPlayerOption } from '../services/desktop';

interface MediaModalProps {
  item: MediaItem;
  onClose: () => void;
  onPlayStream: (stream: TorrentStream, media: MediaItem, episodeInfo?: string, episodeNumber?: number, seasonNumber?: number) => void;
  onSelectSimilar?: (item: MediaItem) => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
  item,
  onClose,
  onPlayStream,
  onSelectSimilar,
}) => {
  const [details, setDetails] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'episodes' | 'sources' | 'similar'>('overview');

  // Streams
  const [streams, setStreams] = useState<TorrentStream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [filterLang, setFilterLang] = useState<'all' | 'dubbed' | 'subbed' | 'hd'>('all');

  // TV Episodes
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Extras
  const [showTrailer, setShowTrailer] = useState(false);
  const [customMagnet, setCustomMagnet] = useState('');
  const [inWatchlist, setInWatchlist] = useState(false);
  const [externalStreamTarget, setExternalStreamTarget] = useState<TorrentStream | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    setInWatchlist(storage.isInWatchlist(item.id, item.mediaType));
  }, [item.id, item.mediaType]);

  const handleToggleWatchlist = () => {
    const current = details || item;
    const added = storage.toggleWatchlist(current);
    setInWatchlist(added);
    showToast(
      added ? `Adicionado à Minha Lista!` : `Removido da Minha Lista`,
      'success'
    );
  };

  // Load Full Details
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const d = item.mediaType === 'tv'
          ? await api.getTvDetails(item.id)
          : await api.getMovieDetails(item.id);

        if (isMounted) {
          setDetails(d);
          setLoading(false);
          // Auto switch to episodes tab if series has seasons
          if (item.mediaType === 'tv') {
            setSelectedSeason(1);
          }
        }
      } catch (err) {
        console.error('Error fetching details:', err);
        if (isMounted) {
          setDetails(item);
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [item.id, item.mediaType]);

  // Load TV Episodes if series
  useEffect(() => {
    if (item.mediaType === 'tv' && selectedSeason) {
      setLoadingEpisodes(true);
      api.getSeasonDetails(item.id, selectedSeason)
        .then((res) => {
          setEpisodes(res.episodes || []);
          setSelectedEpisode(1);
        })
        .catch(console.error)
        .finally(() => setLoadingEpisodes(false));
    }
  }, [item.id, item.mediaType, selectedSeason]);

  // Load Torrent Streams
  useEffect(() => {
    if (!details) return;
    setLoadingStreams(true);

    const year = (details.releaseDate || details.firstAirDate || '').split('-')[0];
    const cleanTitle = details.title || details.name || '';

    api.getSources({
      imdbId: details.imdbId,
      type: details.mediaType,
      season: details.mediaType === 'tv' ? selectedSeason : undefined,
      episode: details.mediaType === 'tv' ? selectedEpisode : undefined,
      title: cleanTitle,
      year,
    }).then((res) => {
      const results = res.streams || [];
      setStreams(results);
      setLoadingStreams(false);
    }).catch((err) => {
      console.error('Error fetching streams:', err);
      setLoadingStreams(false);
    });
  }, [details, selectedSeason, selectedEpisode]);

  const currentTitle = details?.title || details?.name || item.title || item.name || '';
  const year = (details?.releaseDate || details?.firstAirDate || item.releaseDate || item.firstAirDate || '').split('-')[0];
  const episodeLabel = details?.mediaType === 'tv' ? `S${selectedSeason.toString().padStart(2, '0')}E${selectedEpisode.toString().padStart(2, '0')}` : undefined;

  // Best stream recommendation (prefers PT-BR Dubbed, then PT-BR Subtitled, then highest score)
  const bestStream = useMemo(() => {
    if (streams.length === 0) return null;
    const ptDubbed = streams.find((s) => s.hasPtBr && s.isDubbed);
    if (ptDubbed) return ptDubbed;
    const ptSub = streams.find((s) => s.hasPtBr);
    if (ptSub) return ptSub;
    return streams[0];
  }, [streams]);

  // Player Selection (Integrated, VLC, MPV, MPC-HC, PotPlayer)
  const [selectedPlayer, setSelectedPlayer] = useState<string>(() => {
    return storage.getPreferences().defaultPlayer || desktopService.getPreferredPlayer() || 'internal';
  });
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<DesktopPlayerOption[]>(AVAILABLE_PLAYERS);

  useEffect(() => {
    desktopService.getInstalledPlayers().then(setAvailablePlayers);
  }, []);

  const handleSelectPlayer = (id: string) => {
    setSelectedPlayer(id);
    desktopService.setPreferredPlayer(id);
    const prefs = storage.getPreferences();
    storage.savePreferences({ ...prefs, defaultPlayer: id as any });
    setShowPlayerDropdown(false);
    const found = AVAILABLE_PLAYERS.find((p) => p.id === id);
    showToast(`Player selecionado: ${found?.name || id}`, 'success');
  };

  // Saved Progress for Resume feature
  const savedProgress = useMemo(() => {
    return storage.getItemProgress(
      item.id,
      item.mediaType,
      item.mediaType === 'tv' ? selectedSeason : undefined,
      item.mediaType === 'tv' ? selectedEpisode : undefined
    );
  }, [item.id, item.mediaType, selectedSeason, selectedEpisode]);

  const hasResume = Boolean(savedProgress && savedProgress.currentTime > 25 && savedProgress.percentage < 95);
  const resumeMinutes = savedProgress ? Math.floor(savedProgress.currentTime / 60) : 0;

  const [externalPlaying, setExternalPlaying] = useState<{
    player: string;
    titleText: string;
    directStreamUrl: string;
    stream: TorrentStream;
  } | null>(null);

  const executePlayStream = async (
    stream: TorrentStream,
    epInfo?: string,
    epNum?: number,
    seasonNum?: number,
    fromBeginning = false
  ) => {
    if (selectedPlayer === 'internal') {
      onPlayStream(stream, details || item, epInfo, epNum, seasonNum);
      return;
    }

    const match = stream.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    const infoHash = stream.infoHash || (match ? match[1].toLowerCase() : '');
    const titleText = `${currentTitle}${epInfo ? ` - ${epInfo}` : ''}`;
    const directStreamUrl = `${window.location.origin}/api/stream/direct/${infoHash}?magnet=${encodeURIComponent(stream.magnet)}&title=${encodeURIComponent(titleText)}`;
    const startTime = fromBeginning ? 0 : (hasResume && savedProgress ? savedProgress.currentTime : 0);

    if (desktopService.isDesktop()) {
      const playerObj = AVAILABLE_PLAYERS.find((p) => p.id === selectedPlayer);
      const pName = playerObj?.name || selectedPlayer.toUpperCase();

      showToast(
        startTime > 10
          ? `Iniciando ${pName} continuando em ${Math.floor(startTime / 60)}m...`
          : `Iniciando ${pName}... O vídeo abrirá no Windows!`,
        'info'
      );

      // Record in progress list for Continue Watching
      storage.saveProgress({
        media: details || item,
        currentTime: startTime > 0 ? startTime : 30,
        duration: (details?.runtime || 120) * 60,
        season: seasonNum,
        episode: epNum,
        episodeInfo: epInfo,
        infoHash,
      });

      const res = await desktopService.launchExternalPlayer(selectedPlayer, directStreamUrl, titleText, startTime);
      if (res.success) {
        showToast(`Tocando no ${res.player || pName} com aceleração de GPU!`, 'success');
        setExternalPlaying({ player: res.player || pName, titleText, directStreamUrl, stream });
      } else {
        showToast(res.error || `Não foi possível abrir o ${pName}`, 'error');
        setExternalStreamTarget(stream);
      }
    } else {
      // In web browser: prompt external modal
      setExternalStreamTarget(stream);
    }
  };

  const handleQuickPlay = (fromBeginning = false) => {
    if (bestStream) {
      executePlayStream(bestStream, episodeLabel, selectedEpisode, selectedSeason, fromBeginning);
    } else {
      // Switch to sources tab
      setActiveTab('sources');
    }
  };

  const handleCustomMagnet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMagnet.trim()) return;

    const customStream: TorrentStream = {
      id: `custom_${Date.now()}`,
      title: `${currentTitle} (Magnet Personalizado)`,
      resolution: 'Unknown',
      quality: 'Personalizado',
      size: 'Sob demanda',
      sizeBytes: 0,
      seeds: 1,
      peers: 0,
      magnet: customMagnet.trim(),
      infoHash: '',
      source: 'Magnet Manual',
    };

    onPlayStream(customStream, details || item, episodeLabel, selectedEpisode, selectedSeason);
  };

  const dubbedCount = streams.filter((s) => s.hasPtBr && s.isDubbed).length;
  const subbedCount = streams.filter((s) => s.hasPtBr && !s.isDubbed).length;

  // Filter streams
  const filteredStreams = streams.filter((s) => {
    if (filterLang === 'dubbed') return s.hasPtBr && s.isDubbed;
    if (filterLang === 'subbed') return s.hasPtBr && !s.isDubbed;
    if (filterLang === 'hd') return s.resolution === '1080p' || s.resolution === '4K';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in select-none">
      <div className="relative w-full max-w-4xl bg-[#141414] rounded-3xl overflow-hidden shadow-2xl border border-white/10 text-white my-6">
        {/* Close Button */}
        <button
          data-focusable="true"
          onClick={onClose}
          className="absolute top-4 right-4 z-40 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white hover:text-red-500 transition-all backdrop-blur-md border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Header */}
        <div className="relative aspect-video sm:h-96 w-full overflow-hidden">
          {item.backdropPath ? (
            <img
              src={item.backdropPath}
              alt={currentTitle}
              className="w-full h-full object-cover filter brightness-90"
            />
          ) : (
            <div className="w-full h-full bg-zinc-900" />
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/60 to-transparent w-full sm:w-2/3" />

          {/* Title & Primary Action Area */}
          <div className="absolute bottom-6 left-6 right-6 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="bg-red-600 text-white px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wide shadow">
                  {item.mediaType === 'tv' ? 'Série' : 'Filme'}
                </span>
                {year && <span className="bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm text-zinc-300">{year}</span>}
                {item.voteAverage > 0 && (
                  <span className="flex items-center text-amber-400 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
                    <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                    {item.voteAverage.toFixed(1)}
                  </span>
                )}
                {details?.runtime && (
                  <span className="flex items-center text-zinc-300 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {details.runtime} min
                  </span>
                )}
                {streams.some((s) => s.hasPtBr && s.isDubbed) ? (
                  <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold">
                    🇧🇷 Dublado PT-BR
                  </span>
                ) : streams.some((s) => s.hasPtBr) ? (
                  <span className="bg-sky-950/90 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-md font-bold">
                    💬 Legendado PT-BR
                  </span>
                ) : streams.length > 0 ? (
                  <span className="bg-zinc-800/80 text-zinc-300 border border-zinc-700 px-2 py-0.5 rounded-md font-medium">
                    🌐 Áudio Original
                  </span>
                ) : null}
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-lg leading-tight">
                {currentTitle}
              </h1>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {/* Assistir Agora with Player Selector */}
              <div className="relative flex items-center shadow-xl shadow-red-600/30">
                <button
                  data-focusable="true"
                  onClick={() => handleQuickPlay(false)}
                  disabled={loadingStreams && streams.length === 0}
                  className="flex items-center space-x-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-l-xl hover:scale-[1.02] active:scale-95 transition-all text-sm sm:text-base border-r border-red-500/30"
                >
                  <Play className="w-5 h-5 fill-white" />
                  <span>
                    {loadingStreams
                      ? 'Buscando Fonte Ideal...'
                      : hasResume
                      ? `Continuar (${resumeMinutes}m) no ${selectedPlayer !== 'internal' ? selectedPlayer.toUpperCase() : 'App'}`
                      : selectedPlayer !== 'internal'
                      ? `Assistir no ${AVAILABLE_PLAYERS.find((p) => p.id === selectedPlayer)?.name || 'Player'}`
                      : bestStream
                      ? `Assistir Agora ${bestStream.hasPtBr ? '(Dublado)' : ''}`
                      : 'Assistir'}
                  </span>
                </button>

                {/* Do Início (if has saved progress) */}
                {hasResume && (
                  <button
                    data-focusable="true"
                    onClick={() => handleQuickPlay(true)}
                    title="Assistir do início (0:00)"
                    className="flex items-center space-x-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-2.5 py-3.5 transition-all text-xs border-r border-zinc-700 font-semibold"
                  >
                    <span>Do Início</span>
                  </button>
                )}

                {/* Player Switcher Dropdown Trigger */}
                <button
                  data-focusable="true"
                  onClick={() => setShowPlayerDropdown(!showPlayerDropdown)}
                  title="Escolher reprodutor (Player Integrado, VLC, MPV, MPC-HC, PotPlayer)"
                  className="flex items-center space-x-1 bg-red-700 hover:bg-red-800 text-white font-bold px-3 py-3.5 rounded-r-xl transition-all border-l border-red-500/20"
                >
                  <span className="text-[11px] uppercase font-black tracking-wider hidden sm:inline">
                    {selectedPlayer === 'internal' ? 'NO APP' : selectedPlayer.toUpperCase()}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* Player Dropdown Menu */}
                {showPlayerDropdown && (
                  <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-[#16171a] border border-white/10 rounded-2xl shadow-2xl p-2 space-y-1 animate-fade-in backdrop-blur-2xl">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center justify-between border-b border-white/5 mb-1">
                      <span>Escolher Player do Windows</span>
                      {desktopService.isDesktop() && (
                        <span className="text-emerald-400 font-bold">1-Clique Nativo</span>
                      )}
                    </div>
                    {availablePlayers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPlayer(p.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-all ${
                          selectedPlayer === p.id
                            ? 'bg-red-600 text-white font-bold shadow-md shadow-red-600/30'
                            : 'hover:bg-white/5 text-zinc-300 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="truncate">{p.name}</span>
                            {p.badge && (
                              <span
                                className={`text-[8px] px-1 py-0.2 rounded font-bold ${
                                  selectedPlayer === p.id ? 'bg-white/20 text-white' : 'bg-red-600/20 text-red-300'
                                }`}
                              >
                                {p.badge}
                              </span>
                            )}
                            {p.installed && p.id !== 'internal' && (
                              <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold">
                                Detectado
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-[10px] truncate ${
                              selectedPlayer === p.id ? 'text-red-100' : 'text-zinc-500'
                            }`}
                          >
                            {p.description}
                          </p>
                        </div>
                        {selectedPlayer === p.id && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assistir no App / TV (4K Nativo) */}
              {bestStream && (
                <button
                  data-focusable="true"
                  onClick={() => setExternalStreamTarget(bestStream)}
                  className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white font-bold backdrop-blur-md border border-purple-400/30 transition-all text-sm sm:text-base hover:scale-105 active:scale-95 shadow-xl shadow-purple-600/30"
                  title="Assistir em 4K nativo no VLC, Smart TV ou App Dedicado"
                >
                  <Tv className="w-4 h-4 text-white" />
                  <span>App / TV (4K)</span>
                </button>
              )}

              {/* Minha Lista */}
              <button
                data-focusable="true"
                onClick={handleToggleWatchlist}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl backdrop-blur-md border transition-all text-sm font-semibold hover:scale-105 active:scale-95 ${
                  inWatchlist
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-200 hover:text-white'
                }`}
              >
                {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{inWatchlist ? 'Na Minha Lista' : 'Minha Lista'}</span>
              </button>

              {/* Ver Trailer */}
              {details?.trailerUrl && (
                <button
                  data-focusable="true"
                  onClick={() => setShowTrailer(!showTrailer)}
                  className="flex items-center space-x-2 bg-zinc-800/80 hover:bg-zinc-700/80 text-white px-4 py-3 rounded-xl text-sm font-semibold border border-zinc-700 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
                >
                  <Video className="w-4 h-4 text-red-500" />
                  <span>{showTrailer ? 'Fechar Trailer' : 'Trailer'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Embedded Trailer Frame */}
        {showTrailer && details?.trailerUrl && (
          <div className="p-4 bg-black border-b border-zinc-800 aspect-video animate-fade-in">
            <iframe
              src={details.trailerUrl.replace('watch?v=', 'embed/')}
              title="Trailer"
              className="w-full h-full rounded-xl"
              allowFullScreen
            />
          </div>
        )}

        {/* Active External Playback Card */}
        {externalPlaying && (
          <div className="mx-6 my-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-xl shadow-emerald-950/20">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <Play className="w-4 h-4 fill-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <span>Reproduzindo no {externalPlaying.player}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </p>
                <p className="text-[10px] text-zinc-400 truncate">4K HDR nativo ativo com 0% CPU da VPS</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  storage.saveProgress({
                    media: details || item,
                    currentTime: (details?.runtime || 120) * 60,
                    duration: (details?.runtime || 120) * 60,
                    season: item.mediaType === 'tv' ? selectedSeason : undefined,
                    episode: item.mediaType === 'tv' ? selectedEpisode : undefined,
                    episodeInfo: episodeLabel,
                  });
                  setExternalPlaying(null);
                  showToast('Marcado como assistido!', 'success');
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition-colors border border-white/5"
              >
                ✓ Concluído
              </button>
              <button
                onClick={() => executePlayStream(externalPlaying.stream, episodeLabel, selectedEpisode, selectedSeason, false)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-colors shadow"
              >
                Reabrir Player
              </button>
              <button
                onClick={() => setExternalPlaying(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex items-center space-x-2 px-6 pt-4 border-b border-white/5 bg-zinc-950/40 text-sm font-semibold overflow-x-auto scrollbar-none">
          <button
            data-focusable="true"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'overview'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Visão Geral</span>
          </button>

          {details?.mediaType === 'tv' && (
            <button
              data-focusable="true"
              onClick={() => setActiveTab('episodes')}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'episodes'
                  ? 'border-red-600 text-white font-bold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Film className="w-4 h-4 text-red-500" />
              <span>Episódios</span>
            </button>
          )}

          <button
            data-focusable="true"
            onClick={() => setActiveTab('sources')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'sources'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Fontes ({streams.length})</span>
          </button>

          {details?.recommendations && details.recommendations.length > 0 && (
            <button
              data-focusable="true"
              onClick={() => setActiveTab('similar')}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === 'similar'
                  ? 'border-red-600 text-white font-bold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Semelhantes</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="p-6 space-y-6 max-h-[55vh] overflow-y-auto">
          {/* 1. Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Synopsis */}
              <div className="space-y-2">
                <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Sinopse</h3>
                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal">
                  {details?.overview || item.overview || 'Sinopse não disponível em português.'}
                </p>
              </div>

              {/* Genres */}
              {details?.genres && details.genres.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Gêneros</h3>
                  <div className="flex flex-wrap gap-2">
                    {details.genres.map((g) => (
                      <span
                        key={g.id}
                        className="bg-zinc-800/80 text-zinc-200 text-xs px-3 py-1 rounded-full border border-zinc-700/80"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cast */}
              {details?.cast && details.cast.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Elenco Principal</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {details.cast.slice(0, 8).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center space-x-3 bg-zinc-900/70 border border-white/5 p-2 rounded-xl"
                      >
                        {c.profilePath ? (
                          <img
                            src={c.profilePath}
                            alt={c.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-500">
                            <Users className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{c.name}</p>
                          <p className="text-[10px] text-zinc-400 truncate">{c.character}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. TV Episodes Tab */}
          {activeTab === 'episodes' && details?.mediaType === 'tv' && (
            <div className="space-y-6">
              {/* Season Selection Pills */}
              <div className="space-y-2">
                <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Selecione a Temporada</h3>
                <div className="flex flex-wrap gap-2">
                  {(details.seasons || [])
                    .filter((s) => s.seasonNumber > 0)
                    .map((s) => (
                      <button
                        key={s.id}
                        data-focusable="true"
                        onClick={() => setSelectedSeason(s.seasonNumber)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          selectedSeason === s.seasonNumber
                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {s.name || `Temporada ${s.seasonNumber}`} ({s.episodeCount} eps)
                      </button>
                    ))}
                </div>
              </div>

              {/* Episode List */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">
                  Episódios da Temporada {selectedSeason}
                </h3>

                {loadingEpisodes ? (
                  <div className="p-8 text-center text-zinc-500 animate-pulse">Carregando episódios...</div>
                ) : episodes.length > 0 ? (
                  <div className="space-y-2">
                    {episodes.map((ep) => (
                      <div
                        key={ep.id}
                        onClick={() => {
                          setSelectedEpisode(ep.episodeNumber);
                          handleQuickPlay();
                        }}
                        className={`group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          selectedEpisode === ep.episodeNumber
                            ? 'bg-red-950/30 border-red-500/80 shadow-lg'
                            : 'bg-zinc-900/60 border-white/5 hover:bg-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Thumbnail */}
                          <div className="w-24 sm:w-28 aspect-video bg-zinc-800 rounded-lg overflow-hidden relative flex-shrink-0">
                            {ep.stillPath ? (
                              <img src={ep.stillPath} alt={ep.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">
                                Ep. {ep.episodeNumber}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-5 h-5 fill-white text-white" />
                            </div>
                            <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.2 rounded text-[9px] font-bold text-white">
                              {ep.runtime ? `${ep.runtime}m` : `Ep ${ep.episodeNumber}`}
                            </span>
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-red-500 font-bold text-xs">#{ep.episodeNumber}</span>
                              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">
                                {ep.name || `Episódio ${ep.episodeNumber}`}
                              </h4>
                            </div>
                            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                              {ep.overview || 'Sinopse do episódio não disponível.'}
                            </p>
                          </div>
                        </div>

                        <button
                          data-focusable="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEpisode(ep.episodeNumber);
                            handleQuickPlay();
                          }}
                          className="self-end sm:self-center flex items-center space-x-1.5 bg-red-600/90 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow flex-shrink-0"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Assistir</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 py-4">Nenhum episódio encontrado para esta temporada.</p>
                )}
              </div>
            </div>
          )}

          {/* 3. Sources & Torrents Tab */}
          {activeTab === 'sources' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center">
                    <Zap className="w-4 h-4 text-amber-400 mr-1.5" />
                    Fontes Disponíveis {episodeLabel && `(${episodeLabel})`}
                  </h3>
                  <p className="text-xs text-zinc-400">Priorizadas por áudio em Português e número de seeds</p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-1">
                  <button
                    data-focusable="true"
                    onClick={() => setFilterLang('all')}
                    className={`px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                      filterLang === 'all'
                        ? 'bg-red-600 border-red-500 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Todos ({streams.length})
                  </button>
                  <button
                    data-focusable="true"
                    onClick={() => setFilterLang('dubbed')}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                      filterLang === 'dubbed'
                        ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span>🇧🇷 Dublado</span>
                    {dubbedCount > 0 && <span className="bg-emerald-700 px-1 rounded-full text-[10px]">{dubbedCount}</span>}
                  </button>
                  <button
                    data-focusable="true"
                    onClick={() => setFilterLang('subbed')}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                      filterLang === 'subbed'
                        ? 'bg-sky-600 border-sky-500 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <span>💬 Legendado</span>
                    {subbedCount > 0 && <span className="bg-sky-700 px-1 rounded-full text-[10px]">{subbedCount}</span>}
                  </button>
                  <button
                    data-focusable="true"
                    onClick={() => setFilterLang('hd')}
                    className={`px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                      filterLang === 'hd'
                        ? 'bg-blue-600 border-blue-500 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    1080p / 4K
                  </button>
                </div>
              </div>

              {loadingStreams ? (
                <div className="p-12 text-center space-y-3 bg-zinc-900/40 rounded-2xl border border-white/5 animate-pulse">
                  <div className="inline-block w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-zinc-400">Consultando enxames BitTorrent e provedores nacionais...</p>
                </div>
              ) : filteredStreams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredStreams.map((stream, idx) => (
                    <button
                      key={stream.id}
                      data-focusable="true"
                      onClick={() => executePlayStream(stream, episodeLabel, selectedEpisode, selectedSeason)}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${
                        stream.hasPtBr && stream.isDubbed
                          ? 'bg-zinc-900/90 border-emerald-600/50 hover:border-emerald-400 shadow-sm shadow-emerald-950/30'
                          : stream.hasPtBr
                          ? 'bg-zinc-900/90 border-sky-600/50 hover:border-sky-400 shadow-sm shadow-sky-950/30'
                          : 'bg-zinc-900/70 border-white/5 hover:bg-zinc-800/80 hover:border-zinc-600'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Recommended Tag */}
                          {idx === 0 && (
                            <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase shadow">
                              Recomendado
                            </span>
                          )}

                          {/* Audio Language Badge */}
                          {stream.audioLanguage && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center ${
                                stream.hasPtBr && stream.isDubbed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : stream.hasPtBr
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : stream.audioLanguage.includes('Latino') || stream.audioLanguage.includes('Castelhano')
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : stream.audioLanguage.includes('Hindi') || stream.audioLanguage.includes('Russo')
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              }`}
                            >
                              {stream.audioLanguage}
                            </span>
                          )}

                          {/* Resolution Badge */}
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                              stream.resolution === '4K'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : stream.resolution === '1080p'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                : 'bg-zinc-700/40 text-zinc-300'
                            }`}
                          >
                            {stream.resolution}
                          </span>

                          {/* R2 Cached Badge */}
                          {stream.isCachedOnR2 && (
                            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">
                              ⚡ R2 CDN
                            </span>
                          )}

                          <span className="text-[11px] text-zinc-400 font-medium">
                            {stream.size}
                          </span>
                        </div>

                        <p className="text-xs text-white font-medium truncate group-hover:text-red-400 transition-colors">
                          {stream.title}
                        </p>

                        <div className="flex items-center space-x-3 text-[10px] text-zinc-400">
                          <span className="flex items-center text-emerald-400 font-semibold">
                            👤 {stream.seeds} seeds
                          </span>
                          <span>Provedor: {stream.source}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExternalStreamTarget(stream);
                          }}
                          title="Assistir em 4K no App ou Smart TV"
                          className="w-9 h-9 rounded-full bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white flex items-center justify-center transition-all border border-purple-500/40 cursor-pointer"
                        >
                          <Tv className="w-4 h-4" />
                        </span>

                        <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-red-600/40">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center space-y-1 bg-zinc-900/40 rounded-2xl border border-white/5">
                  <p className="text-xs text-zinc-400">Nenhuma fonte encontrada com o filtro selecionado.</p>
                  <p className="text-[11px] text-zinc-500">Tente selecionar o filtro "Todos" ou use o campo de magnet link abaixo.</p>
                </div>
              )}

              {/* Custom Magnet Link */}
              <form onSubmit={handleCustomMagnet} className="pt-2 flex items-center space-x-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    data-focusable="true"
                    type="text"
                    value={customMagnet}
                    onChange={(e) => setCustomMagnet(e.target.value)}
                    placeholder="Ou cole um magnet link personalizado (magnet:?xt=...)"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                </div>
                <button
                  data-focusable="true"
                  type="submit"
                  disabled={!customMagnet.trim()}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl border border-zinc-700 transition-colors"
                >
                  Tocar Magnet
                </button>
              </form>
            </div>
          )}

          {/* 4. Similar Titles Tab */}
          {activeTab === 'similar' && details?.recommendations && (
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Títulos Semelhantes Recomendados</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {details.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onSelectSimilar ? onSelectSimilar(rec) : null}
                    className="cursor-pointer group rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-zinc-700 transition-all hover:scale-105"
                  >
                    <div className="aspect-[2/3] w-full bg-zinc-800 relative">
                      {rec.posterPath ? (
                        <img src={rec.posterPath} alt={rec.title || rec.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 p-2 text-center">
                          {rec.title || rec.name}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold text-white truncate group-hover:text-red-400">{rec.title || rec.name}</p>
                      <p className="text-[10px] text-zinc-400">{(rec.releaseDate || rec.firstAirDate || '').split('-')[0]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* External Player / TV Modal */}
      {externalStreamTarget && (
        <ExternalPlayerModal
          isOpen={Boolean(externalStreamTarget)}
          onClose={() => setExternalStreamTarget(null)}
          infoHash={externalStreamTarget.infoHash}
          magnet={externalStreamTarget.magnet}
          title={`${currentTitle} (${externalStreamTarget.resolution})`}
        />
      )}
    </div>
  );
};
