import React, { useState, useEffect } from 'react';
import { Star, Play, Plus, Check, Info } from 'lucide-react';
import { MediaItem } from '../types';
import { storage } from '../services/storage';
import { useToast } from './Toast';

interface MediaCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
  onQuickPlay?: (item: MediaItem) => void;
  progressPercentage?: number;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onClick, onQuickPlay, progressPercentage }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const { showToast } = useToast();

  const title = item.title || item.name || 'Título Desconhecido';
  const year = (item.releaseDate || item.firstAirDate || '').split('-')[0];

  useEffect(() => {
    setInWatchlist(storage.isInWatchlist(item.id, item.mediaType));
  }, [item.id, item.mediaType]);

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = storage.toggleWatchlist(item);
    setInWatchlist(added);
    showToast(
      added ? `"${title}" adicionado à Minha Lista` : `Removido da Minha Lista`,
      'success'
    );
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickPlay) {
      onQuickPlay(item);
    } else {
      onClick(item);
    }
  };

  return (
    <div
      data-focusable="true"
      onClick={() => onClick(item)}
      className="group relative flex-shrink-0 w-36 sm:w-44 md:w-52 cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5 hover:scale-[1.03] rounded-xl overflow-hidden bg-zinc-900/90 border border-white/5 hover:border-zinc-700/80 shadow-md hover:shadow-2xl hover:shadow-black/80 focus:outline-none select-none"
    >
      {/* Poster Image Container */}
      <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-800 relative">
        {/* Shimmer Placeholder while loading */}
        {!imageLoaded && item.posterPath && (
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 animate-pulse" />
        )}

        {item.posterPath ? (
          <img
            src={item.posterPath}
            alt={title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 filter ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center text-xs text-zinc-500 bg-zinc-800">
            {title}
          </div>
        )}

        {/* Hover Action Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <span className="bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                {item.mediaType === 'tv' ? 'SÉRIE' : 'FILME'}
              </span>
              {item.adult && (
                <span className="bg-rose-700 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow">
                  +18
                </span>
              )}
            </div>
            <button
              onClick={handleToggleWatchlist}
              className={`p-1.5 rounded-full backdrop-blur-md border transition-all ${
                inWatchlist
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-black/60 border-zinc-600 text-white hover:bg-white/20'
              }`}
              title={inWatchlist ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
            >
              {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={handlePlayClick}
              className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/50 transform hover:scale-110 active:scale-95 transition-all"
              title="Assistir"
            >
              <Play className="w-5 h-5 fill-white ml-0.5" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-300">
            <span className="text-emerald-400 font-semibold">🇧🇷 PT-BR</span>
            <span className="flex items-center text-zinc-400 hover:text-white">
              <Info className="w-3.5 h-3.5 mr-1" />
              Info
            </span>
          </div>
        </div>

        {/* Top Badges (Visible Always) */}
        {item.adult && (
          <div className="absolute top-2 left-2 bg-rose-600/95 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-black text-white shadow border border-rose-400/30">
            +18
          </div>
        )}
        {item.voteAverage > 0 && (
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[11px] font-bold text-amber-400 flex items-center shadow border border-white/5">
            <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
            {item.voteAverage.toFixed(1)}
          </div>
        )}

        {/* Watch Progress Bar (if available) */}
        {progressPercentage !== undefined && progressPercentage > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-zinc-800">
            <div
              className="h-full bg-red-600 transition-all"
              style={{ width: `${Math.min(100, progressPercentage)}%` }}
            />
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="p-2.5 space-y-1">
        <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">
          {title}
        </h3>
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>{year || 'Lançamento'}</span>
          <span className="text-[10px] text-emerald-400/90 font-medium">4K HDR • Direto</span>
        </div>
      </div>
    </div>
  );
};
