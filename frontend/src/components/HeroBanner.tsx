import React, { useState, useEffect } from 'react';
import { Play, Info, Star, Plus, Check, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { MediaItem } from '../types';
import { storage } from '../services/storage';
import { useToast } from './Toast';

interface HeroBannerProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onMoreInfo: (item: MediaItem) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ items, onPlay, onMoreInfo }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);
  const { showToast } = useToast();

  const activeItems = items.slice(0, 5);
  const currentItem = activeItems[currentIndex] || items[0];

  // Check watchlist state
  useEffect(() => {
    if (currentItem) {
      setInWatchlist(storage.isInWatchlist(currentItem.id, currentItem.mediaType));
    }
  }, [currentItem]);

  // Auto rotate banner every 9 seconds
  useEffect(() => {
    if (activeItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeItems.length);
    }, 9000);
    return () => clearInterval(interval);
  }, [activeItems.length]);

  const handleToggleWatchlist = () => {
    if (!currentItem) return;
    const added = storage.toggleWatchlist(currentItem);
    setInWatchlist(added);
    showToast(
      added ? `"${currentItem.title || currentItem.name}" adicionado à Minha Lista!` : `Removido da Minha Lista`,
      'success'
    );
  };

  if (!currentItem) {
    return (
      <div className="h-[65vh] md:h-[80vh] w-full bg-[#121212] animate-pulse flex items-center justify-center">
        <div className="text-zinc-600 text-sm flex items-center space-x-2">
          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          <span>Carregando destaques...</span>
        </div>
      </div>
    );
  }

  const title = currentItem.title || currentItem.name || 'Título';
  const year = (currentItem.releaseDate || currentItem.firstAirDate || '').split('-')[0];

  return (
    <div className="relative h-[70vh] sm:h-[75vh] md:h-[82vh] w-full overflow-hidden select-none">
      {/* Backdrop Image with Smooth Crossfade */}
      <div className="absolute inset-0 transition-opacity duration-1000 ease-in-out">
        {currentItem.backdropPath ? (
          <img
            key={currentItem.backdropPath}
            src={currentItem.backdropPath}
            alt={title}
            className="w-full h-full object-cover object-center filter brightness-[0.85] contrast-[1.05] animate-fade-in transform scale-[1.02] transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950" />
        )}
      </div>

      {/* Cinematic Vignette Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-[#0f0f0f]/70 to-transparent w-full md:w-3/4" />
      <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/80 to-transparent" />

      {/* Hero Content */}
      <div className="absolute bottom-16 sm:bottom-20 md:bottom-24 left-4 md:left-12 right-4 md:right-12 max-w-3xl z-10 space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="bg-red-600 text-white px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center shadow-md shadow-red-600/30">
            <Flame className="w-3.5 h-3.5 mr-1 fill-white" />
            Top {currentIndex + 1} Hoje
          </span>

          <span className="bg-zinc-800/90 text-zinc-200 px-2 py-0.5 rounded-md border border-zinc-700">
            {currentItem.mediaType === 'tv' ? 'Série de TV' : 'Filme'}
          </span>

          {year && <span className="text-zinc-300 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">{year}</span>}

          {currentItem.voteAverage > 0 && (
            <span className="flex items-center text-amber-400 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
              <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
              {currentItem.voteAverage.toFixed(1)}
            </span>
          )}

          <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md font-bold text-[11px]">
            🇧🇷 Dublado / PT-BR
          </span>

          <span className="bg-zinc-800/60 text-zinc-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">
            4K Ultra HD
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-2xl leading-none">
          {title}
        </h1>

        {/* Overview */}
        <p className="text-xs sm:text-sm md:text-base text-zinc-300 line-clamp-3 leading-relaxed drop-shadow max-w-2xl">
          {currentItem.overview || 'Sinopse completa disponível nos detalhes da produção.'}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Assistir Agora */}
          <button
            data-focusable="true"
            onClick={() => onPlay(currentItem)}
            className="flex items-center space-x-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold px-6 py-3 rounded-xl shadow-xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all text-sm sm:text-base"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>Assistir Agora</span>
          </button>

          {/* Mais Informações */}
          <button
            data-focusable="true"
            onClick={() => onMoreInfo(currentItem)}
            className="flex items-center space-x-2 bg-zinc-800/90 hover:bg-zinc-700/90 text-white font-semibold px-5 py-3 rounded-xl backdrop-blur-md border border-zinc-700/80 hover:border-zinc-500 hover:scale-105 active:scale-95 transition-all text-sm sm:text-base"
          >
            <Info className="w-5 h-5 text-zinc-300" />
            <span>Detalhes</span>
          </button>

          {/* Minha Lista */}
          <button
            data-focusable="true"
            onClick={handleToggleWatchlist}
            className={`p-3 rounded-xl backdrop-blur-md border transition-all hover:scale-105 active:scale-95 ${
              inWatchlist
                ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400'
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
            title={inWatchlist ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
          >
            {inWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Carousel Navigation Dots on Bottom Right */}
      {activeItems.length > 1 && (
        <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-12 z-20 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + activeItems.length) % activeItems.length)}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex space-x-1.5">
            {activeItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx ? 'w-6 bg-red-600' : 'w-1.5 bg-zinc-600 hover:bg-zinc-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % activeItems.length)}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
