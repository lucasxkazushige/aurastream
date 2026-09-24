import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Plus } from 'lucide-react';
import { MediaItem } from '../types';
import { MediaCard } from './MediaCard';

interface MediaRowProps {
  title: string;
  items?: MediaItem[];
  fetchMore?: (nextPage: number) => Promise<MediaItem[]>;
  onSelect: (item: MediaItem) => void;
  onQuickPlay?: (item: MediaItem) => void;
}

export const MediaRow: React.FC<MediaRowProps> = ({
  title,
  items = [],
  fetchMore,
  onSelect,
  onQuickPlay,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowItems, setRowItems] = useState<MediaItem[]>(items);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(Boolean(fetchMore));

  // Mouse Drag-to-Scroll refs
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const dragDistance = useRef(0);

  // Synchronize when external items prop changes
  useEffect(() => {
    if (items && items.length > 0) {
      setRowItems(items);
      setPage(1);
      setHasMore(Boolean(fetchMore));
    }
  }, [items, fetchMore]);

  // Load next page of TMDB items
  const handleLoadMore = useCallback(async () => {
    if (!fetchMore || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const newItems = await fetchMore(nextPage);

      if (!newItems || newItems.length === 0 || nextPage >= 500) {
        setHasMore(false);
      } else {
        setRowItems((prev) => {
          const seen = new Set(prev.map((i) => `${i.mediaType}-${i.id}`));
          const unique = newItems.filter((i) => !seen.has(`${i.mediaType}-${i.id}`));
          return [...prev, ...unique];
        });
        setPage(nextPage);
      }
    } catch (err) {
      console.error(`Error loading more items for "${title}":`, err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMore, loadingMore, hasMore, page, title]);

  // Check scroll position to trigger auto-load before hitting the end
  const handleScroll = () => {
    if (!rowRef.current || !fetchMore || loadingMore || !hasMore) return;
    const { scrollLeft, clientWidth, scrollWidth } = rowRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 500) {
      handleLoadMore();
    }
  };

  // Button scroll with smooth animation and prefetch
  const scroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth, scrollWidth } = rowRef.current;
    const scrollAmount = clientWidth * 0.75;

    rowRef.current.scrollTo({
      left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
      behavior: 'smooth',
    });

    if (direction === 'right' && fetchMore && hasMore && !loadingMore) {
      if (scrollLeft + scrollAmount + clientWidth >= scrollWidth - 600) {
        handleLoadMore();
      }
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!rowRef.current) return;
    isMouseDown.current = true;
    dragDistance.current = 0;
    startX.current = e.pageX - rowRef.current.offsetLeft;
    scrollLeftStart.current = rowRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !rowRef.current) return;
    e.preventDefault();
    const x = e.pageX - rowRef.current.offsetLeft;
    const delta = x - startX.current;
    dragDistance.current = Math.abs(delta);
    rowRef.current.scrollLeft = scrollLeftStart.current - delta * 1.4;

    // Check if dragging near the end to auto-load
    const { scrollLeft, clientWidth, scrollWidth } = rowRef.current;
    if (scrollLeft + clientWidth >= scrollWidth - 500) {
      handleLoadMore();
    }
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
  };

  const handleItemSelect = (item: MediaItem) => {
    // If user dragged more than 8 pixels, treat it as a drag and don't open modal
    if (dragDistance.current > 8) return;
    onSelect(item);
  };

  const handleItemQuickPlay = (item: MediaItem) => {
    if (dragDistance.current > 8) return;
    if (onQuickPlay) onQuickPlay(item);
    else onSelect(item);
  };

  if (!rowItems || rowItems.length === 0) return null;

  return (
    <div className="space-y-2 px-4 md:px-12 my-6 relative group select-none">
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-black text-white tracking-wide flex items-center">
          <span className="w-1 h-5 bg-red-600 rounded-full mr-2" />
          <span>{title}</span>
          {rowItems.length > 20 && (
            <span className="text-[10px] text-zinc-500 font-bold ml-2.5 bg-zinc-900 border border-white/5 px-2 py-0.5 rounded-full">
              {rowItems.length}+ títulos
            </span>
          )}
        </h2>

        {fetchMore && (
          <span className="text-[11px] text-zinc-400 font-medium hidden sm:flex items-center space-x-1">
            <span>Arraste para o lado para ver mais</span>
          </span>
        )}
      </div>

      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md rounded-r-xl border-y border-r border-white/10 active:scale-95"
          title="Rolar para a esquerda"
        >
          <ChevronLeft className="w-6 h-6 text-zinc-200" />
        </button>

        {/* Scrollable & Draggable Container */}
        <div
          ref={rowRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-center space-x-3 md:space-x-4 overflow-x-auto scrollbar-none py-3 px-1 cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {rowItems.map((item) => (
            <MediaCard
              key={`${item.mediaType}-${item.id}`}
              item={item}
              onClick={() => handleItemSelect(item)}
              onQuickPlay={() => handleItemQuickPlay(item)}
            />
          ))}

          {/* Infinite Scroll Loading or Load-More Card */}
          {fetchMore && hasMore && (
            <div
              onClick={() => handleLoadMore()}
              className="flex-shrink-0 w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl border border-dashed border-zinc-700 hover:border-red-500 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer group/more"
            >
              {loadingMore ? (
                <div className="space-y-3 flex flex-col items-center">
                  <RefreshCw className="w-7 h-7 text-red-500 animate-spin" />
                  <p className="text-xs font-bold text-zinc-400">Carregando catálogo TMDB...</p>
                </div>
              ) : (
                <div className="space-y-2 flex flex-col items-center group-hover/more:scale-105 transition-transform">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
                    <Plus className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-white">Carregar Mais</p>
                  <p className="text-[10px] text-zinc-400">Mais produções do TMDB</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-30 w-10 md:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md rounded-l-xl border-y border-l border-white/10 active:scale-95"
          title="Rolar para a direita (carregar mais títulos)"
        >
          <ChevronRight className="w-6 h-6 text-zinc-200" />
        </button>
      </div>
    </div>
  );
};
