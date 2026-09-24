import React, { useState, useEffect, useRef } from 'react';
import { Play, Search, Film, Tv, Settings, X, Tv2, Bookmark, Star, ArrowRight, Download, Sparkles } from 'lucide-react';
import { MediaItem } from '../types';
import { api } from '../services/api';
import { desktopService } from '../services/desktop';

interface NavbarProps {
  activeTab: 'home' | 'movies' | 'tv' | 'watchlist';
  setActiveTab: (tab: 'home' | 'movies' | 'tv' | 'watchlist') => void;
  activeModal?: 'downloads' | 'settings' | 'apps' | null;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  onOpenApps?: () => void;
  onOpenSurprise?: () => void;
  onSearch: (query: string) => void;
  onSelectMedia: (item: MediaItem) => void;
  tvMode: boolean;
  setTvMode: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeModal,
  onOpenDownloads,
  onOpenSettings,
  onOpenApps,
  onOpenSurprise,
  onSearch,
  onSelectMedia,
  tvMode,
  setTvMode,
}) => {
  const [query, setQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [quickResults, setQuickResults] = useState<MediaItem[]>([]);
  const [loadingQuick, setLoadingQuick] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close quick search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setQuickResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick instant search as user types
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setQuickResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingQuick(true);
      try {
        const res = await api.search(query.trim());
        setQuickResults((res.results || []).slice(0, 6));
      } catch (err) {
        console.error('Quick search error:', err);
      } finally {
        setLoadingQuick(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setQuickResults([]);
    }
  };

  const handleClear = () => {
    setQuery('');
    setQuickResults([]);
    onSearch('');
    setShowSearch(false);
  };

  const handleSelectQuick = (item: MediaItem) => {
    setQuickResults([]);
    setShowSearch(false);
    onSelectMedia(item);
  };

  return (
    <>
      {/* Top Navbar for Desktop & Tablet */}
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 px-4 md:px-12 py-3 flex items-center justify-between ${
          isScrolled
            ? 'bg-[#0f0f0f]/95 backdrop-blur-xl shadow-xl shadow-black/70 border-b border-white/5'
            : 'bg-gradient-to-b from-black/90 via-black/50 to-transparent'
        }`}
      >
        <div className="flex items-center space-x-6 md:space-x-8">
          {/* Brand Logo */}
          <button
            data-focusable="true"
            onClick={() => { setActiveTab('home'); handleClear(); }}
            className="flex items-center space-x-2.5 focus:outline-none group select-none"
          >
            <div className="w-9 h-9 bg-gradient-to-tr from-red-700 via-red-600 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:scale-105 transition-all">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xl md:text-2xl font-black tracking-tight text-white group-hover:text-red-400 transition-colors">
                Aura<span className="text-red-600">Stream</span>
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-medium">
            <button
              data-focusable="true"
              onClick={() => { setActiveTab('home'); handleClear(); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'home'
                  ? 'bg-white/10 text-white font-bold shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Início
            </button>
            <button
              data-focusable="true"
              onClick={() => { setActiveTab('movies'); handleClear(); }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'movies'
                  ? 'bg-white/10 text-white font-bold shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Filmes</span>
            </button>
            <button
              data-focusable="true"
              onClick={() => { setActiveTab('tv'); handleClear(); }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'tv'
                  ? 'bg-white/10 text-white font-bold shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>Séries</span>
            </button>
            <button
              data-focusable="true"
              onClick={() => { setActiveTab('watchlist'); handleClear(); }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'watchlist'
                  ? 'bg-white/10 text-white font-bold shadow-inner'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Minha Lista</span>
            </button>
            {onOpenSurprise && (
              <button
                data-focusable="true"
                onClick={onOpenSurprise}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all bg-gradient-to-r from-red-600/30 via-purple-600/30 to-amber-600/30 border border-red-500/40 hover:border-red-400 text-white font-black text-xs shadow-md shadow-red-950/40 transform hover:scale-105"
                title="Roleta Mágica / Não sabe o que assistir?"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>O Que Assistir?</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          {/* Search Box with Instant Results Dropdown */}
          <div ref={searchContainerRef} className="relative">
            <form onSubmit={handleSearchSubmit} className="flex items-center">
              <div
                className={`flex items-center bg-zinc-900/90 border transition-all duration-300 ${
                  showSearch || query
                    ? 'w-56 sm:w-72 border-zinc-700 rounded-2xl px-3 py-1.5 shadow-lg shadow-black/40'
                    : 'w-9 h-9 justify-center rounded-full bg-transparent border-transparent hover:bg-white/10'
                }`}
              >
                <button
                  type="button"
                  data-focusable="true"
                  onClick={() => {
                    setShowSearch(!showSearch);
                    if (!showSearch) {
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }
                  }}
                  className="text-zinc-300 hover:text-white focus:outline-none flex-shrink-0"
                >
                  <Search className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                {(showSearch || query) && (
                  <input
                    ref={searchInputRef}
                    data-focusable="true"
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                    }}
                    placeholder="Filmes, séries, atores..."
                    className="bg-transparent border-none text-xs sm:text-sm text-white focus:outline-none ml-2 w-full placeholder-zinc-500"
                  />
                )}
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-zinc-400 hover:text-white ml-1 flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Instant Search Dropdown */}
            {quickResults.length > 0 && (
              <div className="absolute top-12 right-0 w-72 sm:w-80 bg-[#161616] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in backdrop-blur-xl">
                <div className="p-2 border-b border-zinc-800/80 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Resultados Rápidos</span>
                  {loadingQuick && <span className="text-zinc-500 animate-pulse">Buscando...</span>}
                </div>
                <div className="divide-y divide-zinc-800/60 max-h-80 overflow-y-auto">
                  {quickResults.map((item) => (
                    <button
                      key={`${item.mediaType}-${item.id}`}
                      onClick={() => handleSelectQuick(item)}
                      className="w-full p-2.5 flex items-center space-x-3 hover:bg-zinc-800/80 text-left transition-colors group"
                    >
                      <div className="w-10 h-14 bg-zinc-800 rounded-md overflow-hidden flex-shrink-0">
                        {item.posterPath ? (
                          <img src={item.posterPath} alt={item.title || item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-500">Sem pôster</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-red-400 transition-colors">
                          {item.title || item.name}
                        </p>
                        <div className="flex items-center space-x-2 text-[10px] text-zinc-400 mt-0.5">
                          <span className="bg-zinc-800 px-1.5 py-0.2 rounded uppercase font-bold text-zinc-300">
                            {item.mediaType === 'tv' ? 'Série' : 'Filme'}
                          </span>
                          <span>{(item.releaseDate || item.firstAirDate || '').split('-')[0]}</span>
                          {item.voteAverage > 0 && (
                            <span className="flex items-center text-amber-400">
                              <Star className="w-2.5 h-2.5 fill-amber-400 mr-0.5" />
                              {item.voteAverage.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSearchSubmit}
                  className="w-full p-2 bg-zinc-900 text-center text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-zinc-800/80 transition-colors border-t border-zinc-800"
                >
                  Ver todos os resultados para "{query}"
                </button>
              </div>
            )}
          </div>

          {/* TV Remote Mode Toggle */}
          <button
            data-focusable="true"
            onClick={() => setTvMode(!tvMode)}
            title={tvMode ? 'Modo TV Ativo (Navegação D-Pad)' : 'Ativar Modo Controle Remoto (TV)'}
            className={`p-2 rounded-xl border transition-all ${
              tvMode
                ? 'bg-red-600/20 border-red-500 text-red-400 shadow-lg shadow-red-500/30'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
          >
            <Tv2 className="w-4 h-4" />
          </button>

          {/* Downloads & Storage Central button */}
          <button
            data-focusable="true"
            onClick={onOpenDownloads}
            className={`p-2 rounded-xl border transition-all relative ${
              activeModal === 'downloads'
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700/80'
            }`}
            title="Gerenciador de Downloads & Nuvem Cloudflare R2"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Desktop App Mode Indicator */}
          {desktopService.isDesktop() && (
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Windows 4K HDR</span>
            </div>
          )}

          {/* Baixar Apps / Smart TV button */}
          {onOpenApps && (
            <button
              data-focusable="true"
              onClick={onOpenApps}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border transition-all relative ${
                activeModal === 'apps'
                  ? 'bg-gradient-to-r from-red-600 to-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30 font-bold'
                  : 'bg-zinc-800/90 border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-700/80 font-semibold'
              }`}
              title={desktopService.isDesktop() ? "Conectar Smart TV ou Stremio" : "Baixar Aplicativos para PC, Celular ou Smart TV"}
            >
              {desktopService.isDesktop() ? (
                <>
                  <Tv className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs hidden sm:inline">Conectar TV</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs hidden sm:inline">Baixar Apps</span>
                </>
              )}
            </button>
          )}

          {/* Settings button */}
          <button
            data-focusable="true"
            onClick={onOpenSettings}
            className={`p-2 rounded-xl border transition-all ${
              activeModal === 'settings'
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700/80'
            }`}
            title="Configurações & Preferências da Plataforma"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Bottom Navigation Bar for Mobile Phones */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f0f0f]/95 backdrop-blur-2xl border-t border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => { setActiveTab('home'); handleClear(); }}
          className={`flex flex-col items-center space-y-1 p-1 ${activeTab === 'home' && !activeModal ? 'text-red-500 font-bold' : 'text-zinc-400'}`}
        >
          <Play className="w-5 h-5" />
          <span className="text-[10px]">Início</span>
        </button>
        <button
          onClick={() => { setActiveTab('movies'); handleClear(); }}
          className={`flex flex-col items-center space-y-1 p-1 ${activeTab === 'movies' && !activeModal ? 'text-red-500 font-bold' : 'text-zinc-400'}`}
        >
          <Film className="w-5 h-5" />
          <span className="text-[10px]">Filmes</span>
        </button>
        <button
          onClick={() => { setActiveTab('tv'); handleClear(); }}
          className={`flex flex-col items-center space-y-1 p-1 ${activeTab === 'tv' && !activeModal ? 'text-red-500 font-bold' : 'text-zinc-400'}`}
        >
          <Tv className="w-5 h-5" />
          <span className="text-[10px]">Séries</span>
        </button>
        <button
          onClick={() => { setActiveTab('watchlist'); handleClear(); }}
          className={`flex flex-col items-center space-y-1 p-1 ${activeTab === 'watchlist' && !activeModal ? 'text-red-500 font-bold' : 'text-zinc-400'}`}
        >
          <Bookmark className="w-5 h-5" />
          <span className="text-[10px]">Minha Lista</span>
        </button>
        <button
          onClick={() => { onOpenDownloads(); handleClear(); }}
          className={`flex flex-col items-center space-y-1 p-1 ${activeModal === 'downloads' ? 'text-red-500 font-bold' : 'text-zinc-400'}`}
        >
          <Download className="w-5 h-5" />
          <span className="text-[10px]">Downloads</span>
        </button>
        <button
          onClick={() => { onOpenSettings(); handleClear(); }}
          className={`flex flex-col items-center space-y-1 p-1 ${activeModal === 'settings' ? 'text-red-500 font-bold' : 'text-zinc-400'}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Ajustes</span>
        </button>
      </div>
    </>
  );
};
