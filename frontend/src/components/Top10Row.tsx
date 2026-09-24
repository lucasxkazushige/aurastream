import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Flame, Play, Star } from 'lucide-react';
import { MediaItem } from '../types';

interface Top10RowProps {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
}

export const Top10Row: React.FC<Top10RowProps> = ({ items, onSelect, onPlay }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const top10 = (items || []).slice(0, 10);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
    const scrollAmount = clientWidth * 0.75;
    rowRef.current.scrollTo({
      left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: 'smooth',
    });
  };

  if (top10.length === 0) return null;

  return (
    <div className="space-y-3 px-4 md:px-12 my-6 select-none relative group/row">
      <div className="flex items-center space-x-2">
        <div className="p-1 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30">
          <Flame className="w-4 h-4 fill-red-500 animate-pulse" />
        </div>
        <h2 className="text-lg md:text-xl font-black text-white tracking-wide flex items-center">
          Top 10 Produções Mais Procuradas no Brasil
        </h2>
        <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline">
          Hoje
        </span>
      </div>

      <div className="relative">
        {/* Scroll Left Button */}
        <button
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-30 w-10 h-24 bg-black/80 hover:bg-black/95 text-white flex items-center justify-center rounded-r-xl border-y border-r border-white/10 opacity-0 group-hover/row:opacity-100 transition-all backdrop-blur-md hover:scale-105 active:scale-95"
          title="Rolar para a esquerda"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Top 10 Horizontal Scroll Container */}
        <div
          ref={rowRef}
          className="flex space-x-6 md:space-x-8 overflow-x-auto py-4 scrollbar-none scroll-smooth pl-2"
        >
          {top10.map((item, index) => {
            const rank = index + 1;
            const title = item.title || item.name || 'Título';

            return (
              <div
                key={`${item.mediaType}-${item.id}`}
                data-focusable="true"
                onClick={() => onSelect(item)}
                className="group/card relative flex-shrink-0 flex items-end cursor-pointer transition-all duration-300 transform hover:-translate-y-2 hover:scale-[1.04]"
              >
                {/* Giant Stylized Rank Number (1 to 10) */}
                <div className="relative -mr-6 sm:-mr-8 z-0 pointer-events-none select-none">
                  <span
                    className="text-[100px] sm:text-[130px] md:text-[150px] font-black leading-none tracking-tighter"
                    style={{
                      WebkitTextStroke: '4px #333338',
                      color: '#121214',
                      textShadow: '0 0 20px rgba(0,0,0,0.9)',
                      fontFamily: 'impact, sans-serif',
                    }}
                  >
                    {rank}
                  </span>
                </div>

                {/* Poster Card */}
                <div className="relative z-10 w-32 sm:w-40 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 group-hover/card:border-red-500/80 shadow-2xl shadow-black">
                  {item.posterPath ? (
                    <img
                      src={item.posterPath}
                      alt={title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105 filter brightness-95"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 text-center text-xs text-zinc-500 bg-zinc-800">
                      {title}
                    </div>
                  )}

                  {/* Rating Badge */}
                  {item.voteAverage > 0 && (
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[10px] font-bold text-amber-400 flex items-center shadow border border-white/5">
                      <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                      {item.voteAverage.toFixed(1)}
                    </div>
                  )}

                  {/* Top-left Top 10 Mini Badge */}
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                    TOP {rank}
                  </div>

                  {/* Hover Action Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 space-y-2">
                    <p className="text-xs font-bold text-white line-clamp-1 drop-shadow">
                      {title}
                    </p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onPlay) onPlay(item);
                          else onSelect(item);
                        }}
                        className="flex-1 flex items-center justify-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs shadow-lg shadow-red-600/50"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Assistir</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 w-10 h-24 bg-black/80 hover:bg-black/95 text-white flex items-center justify-center rounded-l-xl border-y border-l border-white/10 opacity-0 group-hover/row:opacity-100 transition-all backdrop-blur-md hover:scale-105 active:scale-95"
          title="Rolar para a direita"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
