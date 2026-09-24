import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { MediaRow } from './components/MediaRow';
import { Top10Row } from './components/Top10Row';
import { SurpriseModal } from './components/SurpriseModal';
import { MediaModal } from './components/MediaModal';
import { Player } from './components/Player';
import { SettingsModal } from './components/SettingsModal';
import { DownloadsModal } from './components/DownloadsModal';
import { AppsModal } from './components/AppsModal';
import { UpdateNotification } from './components/UpdateNotification';
import { ToastProvider, useToast } from './components/Toast';
import { LandingPage } from './components/LandingPage';
import { desktopService } from './services/desktop';
import { MediaItem, TorrentStream, StreamSession } from './types';
import { api } from './services/api';
import { storage, WatchProgress } from './services/storage';
import { useTVNavigation } from './hooks/useTVNavigation';
import { MediaCard } from './components/MediaCard';
import {
  Film,
  Tv,
  Bookmark,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  X,
  Trash2,
  Brain,
  Zap,
  Smile,
  Flame,
  Trophy,
  Rocket,
  Timer,
  Star,
  Compass,
} from 'lucide-react';

const GENRES_LIST = [
  { id: 28, name: 'Ação' },
  { id: 12, name: 'Aventura' },
  { id: 16, name: 'Animação' },
  { id: 35, name: 'Comédia' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentário' },
  { id: 18, name: 'Drama' },
  { id: 14, name: 'Fantasia' },
  { id: 27, name: 'Terror' },
  { id: 878, name: 'Ficção Científica' },
  { id: 53, name: 'Suspense' },
];

const MOODS_LIST = [
  { id: 'mind-bender', label: 'Fritar a Mente', icon: Brain, color: 'text-purple-400 border-purple-500/30 hover:border-purple-400 bg-purple-500/10' },
  { id: 'adrenaline', label: 'Adrenalina', icon: Zap, color: 'text-red-400 border-red-500/30 hover:border-red-400 bg-red-500/10' },
  { id: 'gems', label: 'Pérolas Ocultas', icon: Sparkles, color: 'text-amber-400 border-amber-500/30 hover:border-amber-400 bg-amber-500/10' },
  { id: 'relax', label: 'Para Relaxar', icon: Smile, color: 'text-emerald-400 border-emerald-500/30 hover:border-emerald-400 bg-emerald-500/10' },
  { id: 'scary', label: 'Roer as Unhas', icon: Flame, color: 'text-rose-400 border-rose-500/30 hover:border-rose-400 bg-rose-500/10' },
  { id: 'short', label: '< 90 Minutos', icon: Timer, color: 'text-blue-400 border-blue-500/30 hover:border-blue-400 bg-blue-500/10' },
  { id: 'scifi', label: 'Ficção & Futuro', icon: Rocket, color: 'text-indigo-400 border-indigo-500/30 hover:border-indigo-400 bg-indigo-500/10' },
  { id: 'brazil', label: 'Cinema Nacional', icon: Trophy, color: 'text-yellow-400 border-yellow-500/30 hover:border-yellow-400 bg-yellow-500/10' },
  { id: 'adult', label: '+18 Conteúdo Adulto', icon: Flame, color: 'text-rose-500 border-rose-500/40 hover:border-rose-400 bg-rose-500/10' },
];

interface AppContentProps {
  onBackToLanding?: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ onBackToLanding }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'movies' | 'tv' | 'watchlist'>('home');
  const [activeModal, setActiveModal] = useState<'downloads' | 'settings' | 'apps' | null>(null);
  const [showSurpriseModal, setShowSurpriseModal] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodItems, setMoodItems] = useState<MediaItem[]>([]);
  const [loadingMood, setLoadingMood] = useState(false);

  // Comprehensive Media Collections
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [popularTv, setPopularTv] = useState<MediaItem[]>([]);
  const [actionMovies, setActionMovies] = useState<MediaItem[]>([]);
  const [comedyMovies, setComedyMovies] = useState<MediaItem[]>([]);
  const [mindBenders, setMindBenders] = useState<MediaItem[]>([]);
  const [adrenaline, setAdrenaline] = useState<MediaItem[]>([]);
  const [hiddenGems, setHiddenGems] = useState<MediaItem[]>([]);
  const [sciFi, setSciFi] = useState<MediaItem[]>([]);
  const [shortMovies, setShortMovies] = useState<MediaItem[]>([]);
  const [scary, setScary] = useState<MediaItem[]>([]);
  const [brazilian, setBrazilian] = useState<MediaItem[]>([]);
  const [animation, setAnimation] = useState<MediaItem[]>([]);
  const [becauseYouWatched, setBecauseYouWatched] = useState<{ sourceTitle: string; items: MediaItem[] } | null>(null);
  const [genreFiltered, setGenreFiltered] = useState<MediaItem[]>([]);
  const [loadingGenre, setLoadingGenre] = useState(false);
  const [genrePage, setGenrePage] = useState(1);
  const [hasMoreGenre, setHasMoreGenre] = useState(true);
  const [loadingMoreGenre, setLoadingMoreGenre] = useState(false);

  const [moodPage, setMoodPage] = useState(1);
  const [hasMoreMood, setHasMoreMood] = useState(true);
  const [loadingMoreMood, setLoadingMoreMood] = useState(false);

  // Watchlist & History
  const [watchlist, setWatchlist] = useState<MediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [loadingMoreSearch, setLoadingMoreSearch] = useState(false);

  // Modals and Player
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [activePlayer, setActivePlayer] = useState<{
    session: StreamSession;
    media: MediaItem;
    episodeInfo?: string;
    episodeNumber?: number;
    seasonNumber?: number;
  } | null>(null);

  const { showToast } = useToast();

  // Enable Spatial Navigation for TV Remote
  useTVNavigation(tvMode);

  // Refresh Watchlist and Progress
  const refreshUserData = useCallback(() => {
    setWatchlist(storage.getWatchlist());
    setContinueWatching(storage.getProgressList());
  }, []);

  const handleRemoveProgress = (e: React.MouseEvent, item: WatchProgress) => {
    e.stopPropagation();
    storage.removeProgress(item.mediaId, item.mediaType, item.season, item.episode);
    refreshUserData();
  };

  const handleClearAllProgress = () => {
    if (window.confirm('Deseja realmente limpar todo o histórico de Continuar Assistindo?')) {
      storage.clearAllProgress();
      refreshUserData();
    }
  };

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData, activeTab, activePlayer]);

  // Load Catalog & Discovery Collections
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [trend, popM, topM, popT, action, comedy] = await Promise.all([
          api.getTrending('all'),
          api.getPopular('movie'),
          api.getTopRated('movie'),
          api.getPopular('tv'),
          api.getByGenre('movie', 28), // Action
          api.getByGenre('movie', 35), // Comedy
        ]);

        setTrending(trend || []);
        setPopularMovies(popM.results || []);
        setTopRated(topM.results || []);
        setPopularTv(popT.results || []);
        setActionMovies(action.results || []);
        setComedyMovies(comedy.results || []);
      } catch (err) {
        console.error('Failed to load base catalog:', err);
      }

      // Load Smart Mood & Discovery Collections in parallel
      try {
        const [benders, adren, gems, sci, short, sca, br, anim] = await Promise.all([
          api.discover({ vibe: 'mind-bender' }).catch(() => ({ results: [] })),
          api.discover({ vibe: 'adrenaline' }).catch(() => ({ results: [] })),
          api.discover({ vibe: 'gems' }).catch(() => ({ results: [] })),
          api.discover({ vibe: 'scifi' }).catch(() => ({ results: [] })),
          api.discover({ vibe: 'short' }).catch(() => ({ results: [] })),
          api.discover({ vibe: 'scary' }).catch(() => ({ results: [] })),
          api.discover({ vibe: 'brazil' }).catch(() => ({ results: [] })),
          api.discover({ vibe: 'animation' }).catch(() => ({ results: [] })),
        ]);

        setMindBenders(benders.results || []);
        setAdrenaline(adren.results || []);
        setHiddenGems(gems.results || []);
        setSciFi(sci.results || []);
        setShortMovies(short.results || []);
        setScary(sca.results || []);
        setBrazilian(br.results || []);
        setAnimation(anim.results || []);
      } catch (err) {
        console.error('Failed to load discovery vibes:', err);
      }
    };

    loadCatalog();
  }, []);

  // Personalized recommendation based on user history or watchlist ("Porque você assistiu X...")
  useEffect(() => {
    const fetchPersonalizedRecs = async () => {
      try {
        let targetId: number | null = null;
        let targetType: 'movie' | 'tv' = 'movie';
        let targetTitle = '';

        if (continueWatching.length > 0) {
          const item = continueWatching[0];
          targetId = typeof item.mediaId === 'number' ? item.mediaId : parseInt(item.mediaId as string, 10);
          targetType = item.mediaType;
          targetTitle = item.title;
        } else if (watchlist.length > 0) {
          const item = watchlist[0];
          targetId = item.id;
          targetType = item.mediaType;
          targetTitle = item.title || item.name || '';
        }

        if (targetId && !isNaN(targetId)) {
          const details = targetType === 'tv'
            ? await api.getTvDetails(targetId)
            : await api.getMovieDetails(targetId);

          if (details?.recommendations && details.recommendations.length > 0) {
            setBecauseYouWatched({
              sourceTitle: targetTitle || details.title || details.name || '',
              items: details.recommendations,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching personalized recommendations:', err);
      }
    };

    fetchPersonalizedRecs();
  }, [continueWatching, watchlist]);

  // Handle Mood Selection
  const handleSelectMood = async (moodId: string) => {
    if (selectedMood === moodId) {
      setSelectedMood(null);
      setMoodItems([]);
      setMoodPage(1);
      setHasMoreMood(true);
      return;
    }

    setSelectedMood(moodId);
    setLoadingMood(true);
    setMoodPage(1);
    setHasMoreMood(true);
    try {
      const res = await api.discover({
        vibe: moodId,
        type: activeTab === 'tv' ? 'tv' : 'movie',
        page: 1,
      });
      setMoodItems(res.results || []);
      if (!res.results || res.results.length === 0) setHasMoreMood(false);
    } catch (err) {
      console.error('Error fetching mood items:', err);
    } finally {
      setLoadingMood(false);
    }
  };

  const handleLoadMoreMood = async () => {
    if (!selectedMood || loadingMoreMood || !hasMoreMood) return;
    setLoadingMoreMood(true);
    try {
      const nextPage = moodPage + 1;
      const res = await api.discover({
        vibe: selectedMood,
        type: activeTab === 'tv' ? 'tv' : 'movie',
        page: nextPage,
      });
      const newItems = res.results || [];
      if (newItems.length === 0 || nextPage >= 500) {
        setHasMoreMood(false);
      } else {
        setMoodItems((prev) => {
          const seen = new Set(prev.map((i) => `${i.mediaType}-${i.id}`));
          return [...prev, ...newItems.filter((i) => !seen.has(`${i.mediaType}-${i.id}`))];
        });
        setMoodPage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more mood items:', err);
    } finally {
      setLoadingMoreMood(false);
    }
  };

  // Filter by Genre
  useEffect(() => {
    if (!selectedGenre) {
      setGenreFiltered([]);
      setGenrePage(1);
      setHasMoreGenre(true);
      return;
    }

    setLoadingGenre(true);
    setGenrePage(1);
    setHasMoreGenre(true);
    const mediaType = activeTab === 'tv' ? 'tv' : 'movie';
    api.getByGenre(mediaType, selectedGenre, 1)
      .then((res) => {
        setGenreFiltered(res.results || []);
        if (!res.results || res.results.length === 0) setHasMoreGenre(false);
      })
      .catch(console.error)
      .finally(() => setLoadingGenre(false));
  }, [selectedGenre, activeTab]);

  const handleLoadMoreGenre = async () => {
    if (!selectedGenre || loadingMoreGenre || !hasMoreGenre) return;
    setLoadingMoreGenre(true);
    try {
      const nextPage = genrePage + 1;
      const mediaType = activeTab === 'tv' ? 'tv' : 'movie';
      const res = await api.getByGenre(mediaType, selectedGenre, nextPage);
      const newItems = res.results || [];
      if (newItems.length === 0 || nextPage >= 500) {
        setHasMoreGenre(false);
      } else {
        setGenreFiltered((prev) => {
          const seen = new Set(prev.map((i) => `${i.mediaType}-${i.id}`));
          return [...prev, ...newItems.filter((i) => !seen.has(`${i.mediaType}-${i.id}`))];
        });
        setGenrePage(nextPage);
      }
    } catch (err) {
      console.error('Error loading more genre items:', err);
    } finally {
      setLoadingMoreGenre(false);
    }
  };

  // Search Handler
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setSearchPage(1);
    setHasMoreSearch(true);
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const res = await api.search(query, 1);
      const items = res.results || [];
      setSearchResults(items);
      if (res.totalPages && res.totalPages <= 1) {
        setHasMoreSearch(false);
      } else if (items.length === 0) {
        setHasMoreSearch(false);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleLoadMoreSearch = async () => {
    if (loadingMoreSearch || !hasMoreSearch || !searchQuery.trim()) return;
    const nextPage = searchPage + 1;
    setLoadingMoreSearch(true);
    try {
      const res = await api.search(searchQuery, nextPage);
      const newItems = res.results || [];
      if (newItems.length === 0) {
        setHasMoreSearch(false);
      } else {
        setSearchResults((prev) => {
          const existingIds = new Set(prev.map((i) => `${i.mediaType}-${i.id}`));
          const unique = newItems.filter((i) => !existingIds.has(`${i.mediaType}-${i.id}`));
          return [...prev, ...unique];
        });
        setSearchPage(nextPage);
        if (res.totalPages && nextPage >= Math.min(res.totalPages, 500)) {
          setHasMoreSearch(false);
        }
      }
    } catch (err) {
      console.error('Error loading more search items:', err);
    } finally {
      setLoadingMoreSearch(false);
    }
  };

  // Play Stream Handler
  const handlePlayStream = async (
    stream: TorrentStream,
    media: MediaItem,
    episodeInfo?: string,
    episodeNumber?: number,
    seasonNumber?: number
  ) => {
    try {
      showToast(`Iniciando transmissão de "${media.title || media.name}"...`, 'info');
      const session = await api.startStream({
        magnet: stream.magnet,
        mediaId: media.id.toString(),
        mediaType: media.mediaType,
        title: `${media.title || media.name}${episodeInfo ? ` - ${episodeInfo}` : ''}`,
      });

      setSelectedMedia(null);
      setActivePlayer({
        session,
        media,
        episodeInfo,
        episodeNumber,
        seasonNumber,
      });
    } catch (err: any) {
      showToast(`Erro ao iniciar stream: ${err.message}`, 'error');
    }
  };

  // Quick Play best stream directly from card or hero
  const handleQuickPlay = async (media: MediaItem) => {
    setSelectedMedia(media);
  };

  // Next episode handler for TV shows
  const handleNextEpisode = async () => {
    if (!activePlayer || activePlayer.media.mediaType !== 'tv') return;
    const nextEpNum = (activePlayer.episodeNumber || 1) + 1;
    const season = activePlayer.seasonNumber || 1;
    const nextEpInfo = `S${season.toString().padStart(2, '0')}E${nextEpNum.toString().padStart(2, '0')}`;

    try {
      showToast(`Carregando próximo episódio (${nextEpInfo})...`, 'info');
      const sourcesRes = await api.getSources({
        imdbId: activePlayer.media.imdbId,
        type: 'tv',
        season,
        episode: nextEpNum,
        title: activePlayer.media.title || activePlayer.media.name,
      });

      if (sourcesRes.streams && sourcesRes.streams.length > 0) {
        const nextStream = sourcesRes.streams[0];
        handlePlayStream(nextStream, activePlayer.media, nextEpInfo, nextEpNum, season);
      } else {
        showToast('Não foram encontradas fontes para o próximo episódio.', 'error');
      }
    } catch (err: any) {
      showToast(`Erro ao buscar próximo episódio: ${err.message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Web Mode notice banner for non-desktop browsers */}
      {!desktopService.isDesktop() && (
        <div className="bg-gradient-to-r from-red-950 via-zinc-900 to-amber-950 border-b border-red-500/20 px-4 py-2 text-xs flex items-center justify-between z-40">
          <div className="flex items-center space-x-2 truncate">
            <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
              Catálogo Web
            </span>
            <span className="text-zinc-300 truncate text-[11px]">
              Para reproduzir em 4K HDR nativo com VLC ou MPV sem sobrecarga de navegador, use o Aplicativo Desktop do Windows.
            </span>
          </div>
          <div className="flex items-center space-x-2.5 flex-shrink-0 ml-3">
            <a
              href="/downloads/AuraStream-Setup.exe"
              download
              className="text-red-400 hover:text-white font-bold underline text-[11px]"
            >
              Baixar App Windows (Instalador .EXE)
            </a>
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className="text-zinc-400 hover:text-white text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Voltar à Página Inicial
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedGenre(null);
          setSelectedMood(null);
          setMoodItems([]);
        }}
        activeModal={activeModal}
        onOpenDownloads={() => setActiveModal((prev) => (prev === 'downloads' ? null : 'downloads'))}
        onOpenSettings={() => setActiveModal((prev) => (prev === 'settings' ? null : 'settings'))}
        onOpenApps={() => setActiveModal((prev) => (prev === 'apps' ? null : 'apps'))}
        onOpenSurprise={() => setShowSurpriseModal(true)}
        onSearch={handleSearch}
        onSelectMedia={(item) => setSelectedMedia(item)}
        tvMode={tvMode}
        setTvMode={setTvMode}
      />

      {/* Main View */}
      <main className="flex-1 pb-20 sm:pb-16">
        {/* Search View */}
        {searchQuery ? (
          <div className="pt-24 px-4 md:px-12 space-y-6">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center">
              <span>Resultados para "{searchQuery}"</span>
              <span className="text-xs text-zinc-400 ml-3 font-normal">({searchResults.length} encontrados)</span>
            </h2>

            {searching ? (
              <div className="p-16 text-center text-zinc-500 animate-pulse flex items-center justify-center space-x-2">
                <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                <span>Buscando no catálogo TMDB...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {searchResults.map((item) => (
                    <MediaCard
                      key={`${item.mediaType}-${item.id}`}
                      item={item}
                      onClick={() => setSelectedMedia(item)}
                      onQuickPlay={() => handleQuickPlay(item)}
                    />
                  ))}
                </div>

                {hasMoreSearch && (
                  <div className="flex justify-center pt-6 pb-8">
                    <button
                      onClick={handleLoadMoreSearch}
                      disabled={loadingMoreSearch}
                      className="px-6 py-3 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-xl border border-white/10 hover:border-zinc-500 font-semibold text-sm transition-all flex items-center space-x-2 shadow-lg hover:shadow-red-600/10 active:scale-95 disabled:opacity-50"
                    >
                      {loadingMoreSearch ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                          <span>Carregando Mais Resultados...</span>
                        </>
                      ) : (
                        <>
                          <span>+ Carregar Mais Resultados ({searchResults.length} exibidos)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-20 text-center text-zinc-500 space-y-2">
                <p className="text-base font-semibold text-zinc-400">Nenhum resultado encontrado.</p>
                <p className="text-xs">Tente buscar por título original, ator ou termos semelhantes.</p>
              </div>
            )}
          </div>
        ) : activeTab === 'watchlist' ? (
          /* Watchlist View */
          <div className="pt-24 px-4 md:px-12 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center">
                  <Bookmark className="w-6 h-6 text-red-500 mr-2" />
                  Minha Lista
                </h2>
                <p className="text-xs text-zinc-400 mt-1">Seus filmes e séries salvos para assistir</p>
              </div>
              <span className="text-xs font-bold text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-xl border border-white/5">
                {watchlist.length} {watchlist.length === 1 ? 'título' : 'títulos'}
              </span>
            </div>

            {watchlist.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {watchlist.map((item) => (
                  <MediaCard
                    key={`${item.mediaType}-${item.id}`}
                    item={item}
                    onClick={() => setSelectedMedia(item)}
                    onQuickPlay={() => handleQuickPlay(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-20 text-center text-zinc-500 space-y-4">
                <Bookmark className="w-12 h-12 text-zinc-700 mx-auto" />
                <div className="space-y-1">
                  <p className="text-base font-bold text-zinc-300">Sua lista está vazia</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Adicione filmes e séries clicando no ícone de "+" em qualquer card ou banner para encontrá-los facilmente aqui.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('home')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-colors"
                >
                  Explorar Catálogo
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Catalog View (Home / Movies / TV) */
          <div>
            {/* Hero Carousel */}
            <HeroBanner
              items={activeTab === 'movies' ? popularMovies : activeTab === 'tv' ? popularTv : trending}
              onPlay={handleQuickPlay}
              onMoreInfo={(item) => setSelectedMedia(item)}
            />

            {/* Genre Filter Pills (For Movies & TV tabs) */}
            {(activeTab === 'movies' || activeTab === 'tv') && (
              <div className="px-4 md:px-12 pt-6 flex items-center space-x-2 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setSelectedGenre(null)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedGenre === null
                      ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  Todos os Gêneros
                </button>
                {GENRES_LIST.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGenre(g.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedGenre === g.id
                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Mood Selector Pills & Roulette Button (Anti-Decision Fatigue Bar) */}
            {!selectedGenre && (
              <div className="px-4 md:px-12 pt-6 pb-2">
                <div className="flex items-center space-x-2.5 overflow-x-auto scrollbar-none py-1">
                  <button
                    onClick={() => setShowSurpriseModal(true)}
                    className="flex-shrink-0 flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95 transition-all border border-red-400/30 group"
                    title="Girar a Roleta Mágica de Descoberta"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-180 transition-transform duration-500" />
                    <span>🎲 O Que Assistir?</span>
                    <span className="hidden sm:inline text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full text-zinc-200">
                      Roleta
                    </span>
                  </button>

                  <div className="h-6 w-[1px] bg-zinc-800 mx-1 flex-shrink-0" />

                  {MOODS_LIST.map((mood) => {
                    const Icon = mood.icon;
                    const isActive = selectedMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        onClick={() => handleSelectMood(mood.id)}
                        className={`flex-shrink-0 flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                          isActive
                            ? 'bg-white text-black border-white shadow-xl shadow-white/10 scale-105'
                            : `${mood.color} hover:bg-zinc-800/80`
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : ''}`} />
                        <span>{mood.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* If Genre Filter is active */}
            {selectedGenre && (
              <div className="px-4 md:px-12 pt-6 space-y-4">
                <h2 className="text-xl font-black text-white flex items-center">
                  <Sparkles className="w-5 h-5 text-red-500 mr-2" />
                  {GENRES_LIST.find((g) => g.id === selectedGenre)?.name}
                </h2>
                {loadingGenre ? (
                  <div className="p-12 text-center text-zinc-500 animate-pulse">Filtrando títulos...</div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                      {genreFiltered.map((item) => (
                        <MediaCard
                          key={`${item.mediaType}-${item.id}`}
                          item={item}
                          onClick={() => setSelectedMedia(item)}
                          onQuickPlay={() => handleQuickPlay(item)}
                        />
                      ))}
                    </div>

                    {hasMoreGenre && genreFiltered.length > 0 && (
                      <div className="pt-8 pb-4 text-center">
                        <button
                          onClick={handleLoadMoreGenre}
                          disabled={loadingMoreGenre}
                          className="px-8 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs border border-white/10 hover:border-red-500 shadow-xl transition-all flex items-center space-x-2 mx-auto disabled:opacity-50 hover:scale-105 active:scale-95"
                        >
                          {loadingMoreGenre ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                              <span>Carregando mais do catálogo TMDB...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 text-red-500" />
                              <span>Carregar Mais Títulos ({genreFiltered.length} exibidos)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* If Mood Filter is active */}
            {!selectedGenre && selectedMood && (
              <div className="px-4 md:px-12 pt-4 pb-12 space-y-6">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-black border border-white/10">
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const m = MOODS_LIST.find((item) => item.id === selectedMood);
                      if (!m) return null;
                      const Icon = m.icon;
                      return (
                        <div className="p-2.5 rounded-xl bg-zinc-800 border border-white/10">
                          <Icon className="w-5 h-5 text-red-400" />
                        </div>
                      );
                    })()}
                    <div>
                      <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                        <span>Explorando por Humor: {MOODS_LIST.find((m) => m.id === selectedMood)?.label}</span>
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Seleção especial curada com base em notas altas da crítica e relevância
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMood(null);
                      setMoodItems([]);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Limpar Filtro</span>
                  </button>
                </div>

                {loadingMood ? (
                  <div className="p-16 text-center text-zinc-500 animate-pulse flex items-center justify-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                    <span>Curando os melhores títulos para este humor...</span>
                  </div>
                ) : moodItems.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                      {moodItems.map((item) => (
                        <MediaCard
                          key={`${item.mediaType}-${item.id}`}
                          item={item}
                          onClick={() => setSelectedMedia(item)}
                          onQuickPlay={() => handleQuickPlay(item)}
                        />
                      ))}
                    </div>

                    {hasMoreMood && moodItems.length > 0 && (
                      <div className="pt-8 pb-4 text-center">
                        <button
                          onClick={handleLoadMoreMood}
                          disabled={loadingMoreMood}
                          className="px-8 py-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs border border-white/10 hover:border-red-500 shadow-xl transition-all flex items-center space-x-2 mx-auto disabled:opacity-50 hover:scale-105 active:scale-95"
                        >
                          {loadingMoreMood ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                              <span>Carregando mais produções deste humor...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 text-red-500" />
                              <span>Carregar Mais Títulos ({moodItems.length} exibidos)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-16 text-center text-zinc-500">
                    Nenhum título encontrado para este humor no momento.
                  </div>
                )}
              </div>
            )}

            {/* Main Catalog Rows */}
            {!selectedGenre && !selectedMood && (
              <div className="-mt-14 sm:-mt-20 md:-mt-24 relative z-20 space-y-4">
                {/* Top 10 Row (Netflix-Style Giant Ranking) */}
                <Top10Row
                  items={activeTab === 'movies' ? popularMovies : activeTab === 'tv' ? popularTv : trending}
                  onSelect={(item) => setSelectedMedia(item)}
                  onPlay={handleQuickPlay}
                />

                {/* Continue Watching Row (if any) */}
                {activeTab === 'home' && continueWatching.length > 0 && (
                  <div className="space-y-3 px-4 md:px-12 my-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg md:text-xl font-bold text-white tracking-wide flex items-center">
                        <span className="w-1.5 h-5 bg-red-600 rounded-full mr-2" />
                        Continuar Assistindo ({continueWatching.length})
                      </h2>
                      <button
                        data-focusable="true"
                        onClick={handleClearAllProgress}
                        className="text-xs text-zinc-400 hover:text-red-400 transition-colors flex items-center space-x-1 px-3 py-1.5 rounded-lg hover:bg-white/5 border border-white/5"
                        title="Limpar todo o histórico de Continuar Assistindo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Limpar Histórico</span>
                      </button>
                    </div>

                    <div className="flex space-x-3 md:space-x-4 overflow-x-auto py-2 scrollbar-none">
                      {continueWatching.map((item) => (
                        <div
                          key={`${item.mediaType}-${item.mediaId}-${item.season || 0}-${item.episode || 0}`}
                          onClick={() => {
                            setSelectedMedia({
                              id: item.mediaId,
                              mediaType: item.mediaType,
                              title: item.title,
                              name: item.title,
                              overview: '',
                              posterPath: item.posterPath,
                              backdropPath: item.backdropPath,
                              voteAverage: 0,
                            });
                          }}
                          className="group relative flex-shrink-0 w-48 sm:w-56 cursor-pointer rounded-xl overflow-hidden bg-zinc-900 border border-white/5 hover:border-zinc-700 transition-all hover:scale-[1.03]"
                        >
                          <div className="aspect-video w-full bg-zinc-800 relative">
                            {item.backdropPath || item.posterPath ? (
                              <img
                                src={item.backdropPath || item.posterPath || ''}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                                {item.title}
                              </div>
                            )}

                            {/* Overlay with Play Button */}
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                <Play className="w-5 h-5 fill-white ml-0.5" />
                              </div>
                            </div>

                            {/* Floating Delete button on top right of thumbnail */}
                            <button
                              data-focusable="true"
                              onClick={(e) => handleRemoveProgress(e, item)}
                              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/80 hover:bg-red-600 text-zinc-300 hover:text-white flex items-center justify-center transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 shadow-xl backdrop-blur-md border border-white/10"
                              title="Remover de Continuar Assistindo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>

                            {/* Progress bar */}
                            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-zinc-800">
                              <div className="h-full bg-red-600" style={{ width: `${item.percentage}%` }} />
                            </div>
                          </div>

                          <div className="p-2.5 flex items-center justify-between">
                            <div className="min-w-0 flex-1 pr-1">
                              <p className="text-xs font-bold text-white truncate group-hover:text-red-400">{item.title}</p>
                              <p className="text-[10px] text-zinc-400">
                                {item.episodeInfo ? item.episodeInfo : `${item.percentage}% concluído`}
                              </p>
                            </div>
                            <button
                              data-focusable="true"
                              onClick={(e) => handleRemoveProgress(e, item)}
                              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
                              title="Remover este item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contextual AI Recommendation: Porque você assistiu... */}
                {activeTab === 'home' && becauseYouWatched && becauseYouWatched.items.length > 0 && (
                  <MediaRow
                    title={`Porque você assistiu "${becauseYouWatched.sourceTitle}"`}
                    items={becauseYouWatched.items}
                    onSelect={(item) => setSelectedMedia(item)}
                  />
                )}

                {/* Anti-Decision Fatigue Callout Banner */}
                {activeTab === 'home' && (
                  <div className="px-4 md:px-12 my-8">
                    <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-purple-950/40 via-red-950/30 to-amber-950/20 border border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl backdrop-blur-md">
                      <div className="space-y-2 text-center md:text-left">
                        <div className="inline-flex items-center space-x-2 bg-red-600/20 border border-red-500/30 px-3 py-1 rounded-full text-red-400 text-xs font-black uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Fim da Indecisão</span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-white">
                          Passando muito tempo escolhendo o que assistir?
                        </h3>
                        <p className="text-xs md:text-sm text-zinc-300 max-w-xl">
                          Nossa Roleta Inteligente sorteia títulos consagrados pela crítica (&gt; 7.8 no IMDb) com base no seu humor de hoje para você dar o play sem estresse.
                        </p>
                      </div>
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <button
                          onClick={() => setShowSurpriseModal(true)}
                          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm shadow-xl shadow-red-600/30 hover:scale-105 active:scale-95 transition-all flex items-center space-x-2.5"
                        >
                          <Brain className="w-5 h-5 text-purple-200" />
                          <span>🎲 Sortear Agora</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Home Rows with Rich Curated Discoveries & Endless Pagination */}
                {activeTab === 'home' && (
                  <>
                    {mindBenders.length > 0 && (
                      <MediaRow
                        title="🧠 Fritar a Mente: Suspenses Psicológicos & Plot Twists"
                        items={mindBenders}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'mind-bender', page: p })).results || []}
                      />
                    )}
                    {hiddenGems.length > 0 && (
                      <MediaRow
                        title="✨ Pérolas Ocultas da Crítica (Nota 7.8+)"
                        items={hiddenGems}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'gems', page: p })).results || []}
                      />
                    )}
                    {shortMovies.length > 0 && (
                      <MediaRow
                        title="⏱️ Menos de 90 Minutos: Direto ao Ponto"
                        items={shortMovies}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'short', page: p })).results || []}
                      />
                    )}
                    <MediaRow
                      title="Em Alta Nesta Semana"
                      items={trending}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => api.getTrending('all', p)}
                    />
                    {adrenaline.length > 0 && (
                      <MediaRow
                        title="⚡ Pura Adrenalina & Ação Sem Parar"
                        items={adrenaline}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'adrenaline', page: p })).results || []}
                      />
                    )}
                    <MediaRow
                      title="Filmes Populares"
                      items={popularMovies}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getPopular('movie', p)).results || []}
                    />
                    {sciFi.length > 0 && (
                      <MediaRow
                        title="🚀 Ficção Científica & Futuro"
                        items={sciFi}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'scifi', page: p })).results || []}
                      />
                    )}
                    <MediaRow
                      title="Séries em Destaque"
                      items={popularTv}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getPopular('tv', p)).results || []}
                    />
                    {scary.length > 0 && (
                      <MediaRow
                        title="😱 De Arrepiar: Terror & Suspense"
                        items={scary}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'scary', page: p })).results || []}
                      />
                    )}
                    {brazilian.length > 0 && (
                      <MediaRow
                        title="🏆 O Melhor do Cinema Nacional"
                        items={brazilian}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'brazil', page: p })).results || []}
                      />
                    )}
                    {animation.length > 0 && (
                      <MediaRow
                        title="🎨 Animações Épicas para Toda a Família"
                        items={animation}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'animation', page: p })).results || []}
                      />
                    )}
                    <MediaRow
                      title="Mais Bem Avaliados de Todos os Tempos"
                      items={topRated}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getTopRated('movie', p)).results || []}
                    />
                    <MediaRow
                      title="Comédias para Rir e Descontrair"
                      items={comedyMovies}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getByGenre('movie', 35, p)).results || []}
                    />
                  </>
                )}

                {/* Movies Tab with Curated Discoveries & Endless Pagination */}
                {activeTab === 'movies' && (
                  <>
                    {hiddenGems.length > 0 && (
                      <MediaRow
                        title="✨ Pérolas Ocultas do Cinema"
                        items={hiddenGems}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'gems', type: 'movie', page: p })).results || []}
                      />
                    )}
                    {mindBenders.length > 0 && (
                      <MediaRow
                        title="🧠 Suspenses Psicológicos & Reviravoltas"
                        items={mindBenders}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'mind-bender', type: 'movie', page: p })).results || []}
                      />
                    )}
                    {shortMovies.length > 0 && (
                      <MediaRow
                        title="⏱️ Filmes Curtos (< 90 Minutos)"
                        items={shortMovies}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'short', type: 'movie', page: p })).results || []}
                      />
                    )}
                    <MediaRow
                      title="Filmes Populares no Momento"
                      items={popularMovies}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getPopular('movie', p)).results || []}
                    />
                    <MediaRow
                      title="Mais Bem Avaliados de Todos os Tempos"
                      items={topRated}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getTopRated('movie', p)).results || []}
                    />
                    <MediaRow
                      title="Filmes de Ação & Explosão"
                      items={adrenaline.length > 0 ? adrenaline : actionMovies}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getByGenre('movie', 28, p)).results || []}
                    />
                    {sciFi.length > 0 && (
                      <MediaRow
                        title="Ficção Científica & Universo"
                        items={sciFi}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'scifi', type: 'movie', page: p })).results || []}
                      />
                    )}
                    {scary.length > 0 && (
                      <MediaRow
                        title="Terror & Suspense Sombrio"
                        items={scary}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'scary', type: 'movie', page: p })).results || []}
                      />
                    )}
                    {brazilian.length > 0 && (
                      <MediaRow
                        title="Cinema Nacional Brasileiro"
                        items={brazilian}
                        onSelect={(item) => setSelectedMedia(item)}
                        onQuickPlay={handleQuickPlay}
                        fetchMore={async (p) => (await api.discover({ vibe: 'brazil', type: 'movie', page: p })).results || []}
                      />
                    )}
                    <MediaRow
                      title="Comédias em Alta"
                      items={comedyMovies}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getByGenre('movie', 35, p)).results || []}
                    />
                  </>
                )}

                {/* TV Series Tab & Endless Pagination */}
                {activeTab === 'tv' && (
                  <>
                    <MediaRow
                      title="Séries Populares no Momento"
                      items={popularTv}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => (await api.getPopular('tv', p)).results || []}
                    />
                    <MediaRow
                      title="Tendências em Séries"
                      items={trending.filter((t) => t.mediaType === 'tv')}
                      onSelect={(item) => setSelectedMedia(item)}
                      onQuickPlay={handleQuickPlay}
                      fetchMore={async (p) => api.getTrending('tv', p)}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-4 md:px-12 text-center text-xs text-zinc-500 space-y-2">
        <p className="font-bold text-zinc-400">AuraStream Universal Platform</p>
        <p>Catálogo TMDB • BitTorrent P2P • FFmpeg Transcoder • Cloudflare R2 Storage (Zero Egress CDN)</p>
        <p className="text-[11px] text-zinc-600">Otimizado para Celular, Web, Desktop e Smart TVs</p>
      </footer>

      {/* Details & Episodes Modal */}
      {selectedMedia && (
        <MediaModal
          item={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onPlayStream={handlePlayStream}
          onSelectSimilar={(item) => setSelectedMedia(item)}
        />
      )}

      {/* Surprise Roulette & Smart Discovery Modal */}
      <SurpriseModal
        isOpen={showSurpriseModal}
        onClose={() => setShowSurpriseModal(false)}
        onPlay={handleQuickPlay}
        onSelect={(item) => setSelectedMedia(item)}
      />

      {/* Downloads & Cloudflare R2 Management Modal */}
      {activeModal === 'downloads' && (
        <DownloadsModal
          onClose={() => setActiveModal(null)}
          onPlaySession={(session) => {
            const dummyMedia: MediaItem = {
              id: typeof session.mediaId === 'number' ? session.mediaId : 999999,
              title: session.title,
              overview: '',
              posterPath: null,
              backdropPath: null,
              voteAverage: 0,
              mediaType: session.mediaType,
            };
            setActivePlayer({
              session,
              media: dummyMedia,
            });
            setActiveModal(null);
          }}
        />
      )}

      {/* Platform Settings & Preferences Modal */}
      {activeModal === 'settings' && (
        <SettingsModal
          onClose={() => setActiveModal(null)}
          tvMode={tvMode}
          setTvMode={setTvMode}
          onUserDataChanged={refreshUserData}
        />
      )}

      {/* Smart TV & Dedicated Apps Modal */}
      {activeModal === 'apps' && (
        <AppsModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Fullscreen Video Player */}
      {activePlayer && (
        <Player
          session={activePlayer.session}
          media={activePlayer.media}
          episodeInfo={activePlayer.episodeInfo}
          episodeNumber={activePlayer.episodeNumber}
          seasonNumber={activePlayer.seasonNumber}
          onBack={() => {
            setActivePlayer(null);
            refreshUserData();
          }}
          onSelectNextEpisode={handleNextEpisode}
        />
      )}
      {/* Auto-Update Notification (desktop only, no-op no browser) */}
      <UpdateNotification />
    </div>
  );
};

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'landing' | 'app'>(() => {
    if (typeof window !== 'undefined') {
      const isDesktop = desktopService.isDesktop();
      const urlParams = new URLSearchParams(window.location.search);
      if (isDesktop || urlParams.has('app') || window.location.pathname.startsWith('/app')) {
        return 'app';
      }
    }
    return 'landing';
  });

  return (
    <ToastProvider>
      {viewMode === 'landing' ? (
        <LandingPage onEnterApp={() => setViewMode('app')} />
      ) : (
        <AppContent onBackToLanding={() => setViewMode('landing')} />
      )}
    </ToastProvider>
  );
};
