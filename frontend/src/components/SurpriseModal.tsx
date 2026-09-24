import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Play,
  RotateCw,
  Star,
  Clock,
  Calendar,
  Plus,
  Check,
  Zap,
  Brain,
  Smile,
  Flame,
  Trophy,
  Rocket,
  Timer,
  Film,
  Tv,
} from 'lucide-react';
import { MediaItem } from '../types';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { useToast } from './Toast';

interface SurpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
  onSelect: (item: MediaItem) => void;
}

const VIBES = [
  {
    id: 'gems',
    label: 'Pérolas Escondidas',
    icon: Sparkles,
    desc: 'Filmes incríveis aclamados que quase ninguém conhece',
    color: 'from-amber-600 to-yellow-500',
  },
  {
    id: 'mind-bender',
    label: 'Fritar a Mente',
    icon: Brain,
    desc: 'Suspenses psicológicos com plot twists e reviravoltas chocantes',
    color: 'from-purple-600 to-indigo-600',
  },
  {
    id: 'adrenaline',
    label: 'Pura Adrenalina',
    icon: Zap,
    desc: 'Ação acelerada, perseguições e adrenalina do início ao fim',
    color: 'from-red-600 to-orange-600',
  },
  {
    id: 'relax',
    label: 'Para Relaxar',
    icon: Smile,
    desc: 'Comédias leves, diversão sem estresse e filmes reconfortantes',
    color: 'from-emerald-600 to-teal-500',
  },
  {
    id: 'scary',
    label: 'Roer as Unhas',
    icon: Flame,
    desc: 'Terror angustiante e suspense tenso de tirar o fôlego',
    color: 'from-rose-700 to-red-900',
  },
  {
    id: 'short',
    label: 'Menos de 90 Min',
    icon: Timer,
    desc: 'Filmes curtos e diretos ao ponto quando você tem pouco tempo',
    color: 'from-blue-600 to-cyan-500',
  },
  {
    id: 'scifi',
    label: 'Ficção & Futuro',
    icon: Rocket,
    desc: 'Espaço profundo, viagens temporais e universos paralelos',
    color: 'from-violet-600 to-purple-800',
  },
  {
    id: 'brazil',
    label: 'Cinema Brasileiro',
    icon: Trophy,
    desc: 'Grandes sucessos do cinema nacional premiados mundialmente',
    color: 'from-green-600 to-yellow-600',
  },
  {
    id: 'adult',
    label: '+18 Sem Censura',
    icon: Flame,
    desc: 'Conteúdo adulto, produções maduras e sem censura do catálogo',
    color: 'from-rose-600 to-pink-700',
  },
];

export const SurpriseModal: React.FC<SurpriseModalProps> = ({
  isOpen,
  onClose,
  onPlay,
  onSelect,
}) => {
  const [selectedVibe, setSelectedVibe] = useState('gems');
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [result, setResult] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleRollRoulette = async (vibe = selectedVibe, type = mediaType) => {
    setLoading(true);
    try {
      const item = await api.getSurprise(vibe, type);
      if (item) {
        setResult(item);
        setInWatchlist(storage.isInWatchlist(item.id, item.mediaType));
      } else {
        showToast('Não encontramos um título com este filtro. Tente outro humor!', 'error');
      }
    } catch (err) {
      showToast('Erro ao sortear título. Tente novamente!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!result) return;
    const added = storage.toggleWatchlist(result);
    setInWatchlist(added);
    showToast(
      added ? `"${result.title || result.name}" adicionado à Minha Lista` : 'Removido da Minha Lista',
      'success'
    );
  };

  const activeVibeObj = VIBES.find((v) => v.id === selectedVibe) || VIBES[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6 animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-[#141416] rounded-3xl overflow-hidden shadow-2xl border border-white/10 text-white my-6">
        {/* Close Button */}
        <button
          data-focusable="true"
          onClick={onClose}
          className="absolute top-4 right-4 z-40 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white hover:text-red-500 transition-all backdrop-blur-md border border-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-zinc-800/60 to-transparent border-b border-white/5 space-y-3">
          <div className="flex items-center space-x-2 text-red-500 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Roleta Mágica de Descoberta</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Não sabe o que assistir hoje?
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg">
            Escolha seu humor do momento e deixe a nossa inteligência de curadoria escolher a melhor obra para você sem perder tempo procurando!
          </p>

          {/* Media Type Selector (Filme vs Série) */}
          <div className="flex items-center space-x-2 pt-2">
            <button
              onClick={() => {
                setMediaType('movie');
                if (result) handleRollRoulette(selectedVibe, 'movie');
              }}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mediaType === 'movie'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Filmes</span>
            </button>
            <button
              onClick={() => {
                setMediaType('tv');
                if (result) handleRollRoulette(selectedVibe, 'tv');
              }}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mediaType === 'tv'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Séries</span>
            </button>
          </div>
        </div>

        {/* Vibe Grid Selection */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Qual é a sua vibe agora?
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {VIBES.map((v) => {
                const Icon = v.icon;
                const isSelected = selectedVibe === v.id;
                return (
                  <button
                    key={v.id}
                    data-focusable="true"
                    onClick={() => {
                      setSelectedVibe(v.id);
                      handleRollRoulette(v.id, mediaType);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                      isSelected
                        ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-red-500 shadow-lg shadow-red-950/40'
                        : 'bg-zinc-900/60 border-white/5 hover:border-zinc-700 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <div
                        className={`p-1.5 rounded-lg bg-gradient-to-br ${v.color} text-white shadow-sm`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold truncate text-white">
                        {v.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-2 leading-snug">
                      {v.desc}
                    </p>
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-bl-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Initial State / Roll Roulette Button */}
          {!result && !loading && (
            <div className="text-center py-8 space-y-4">
              <button
                data-focusable="true"
                onClick={() => handleRollRoulette()}
                className="inline-flex items-center space-x-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-base shadow-xl shadow-red-600/40 transform hover:scale-105 active:scale-95 transition-all"
              >
                <Sparkles className="w-5 h-5 animate-spin" />
                <span>Girar Roleta da Sorte ({activeVibeObj.label})</span>
              </button>
              <p className="text-xs text-zinc-500">
                Mais de 10.000 títulos curados com nota mínima de 7.5 no IMDb
              </p>
            </div>
          )}

          {/* Loading Animation */}
          {loading && (
            <div className="py-16 text-center space-y-4 animate-pulse">
              <div className="w-16 h-16 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto shadow-xl" />
              <div className="space-y-1">
                <p className="text-base font-bold text-white">Consultando oráculo cinematográfico...</p>
                <p className="text-xs text-zinc-400">Filtrando as melhores produções da categoria &quot;{activeVibeObj.label}&quot;</p>
              </div>
            </div>
          )}

          {/* Recommendation Result Card */}
          {result && !loading && (
            <div className="bg-zinc-900/90 rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-scale-up">
              <div className="relative aspect-video sm:h-64 w-full overflow-hidden">
                {result.backdropPath ? (
                  <img
                    src={result.backdropPath}
                    alt={result.title || result.name}
                    className="w-full h-full object-cover filter brightness-90"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-[#141416]/40 to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-4 left-4 flex items-center space-x-2">
                  <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase shadow-lg">
                    Recomendação Mágica
                  </span>
                  <span className="bg-black/70 backdrop-blur-md text-amber-400 text-xs font-bold px-2 py-0.5 rounded-lg flex items-center border border-white/10">
                    <Star className="w-3.5 h-3.5 fill-amber-400 mr-1" />
                    {result.voteAverage ? result.voteAverage.toFixed(1) : '7.8'}
                  </span>
                </div>

                {/* Bottom Title on Backdrop */}
                <div className="absolute bottom-4 inset-x-4 sm:inset-x-6">
                  <h3 className="text-xl sm:text-2xl font-black text-white drop-shadow-md truncate">
                    {result.title || result.name}
                  </h3>
                  <div className="flex items-center space-x-3 text-xs text-zinc-300 pt-1">
                    <span className="flex items-center text-zinc-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {(result.releaseDate || result.firstAirDate || '').split('-')[0]}
                    </span>
                    {result.runtime && (
                      <span className="flex items-center text-zinc-400">
                        <Clock className="w-3 h-3 mr-1" />
                        {Math.floor(result.runtime / 60)}h {result.runtime % 60}m
                      </span>
                    )}
                    <span className="text-emerald-400 font-semibold">🇧🇷 100% Dublado & Legendado</span>
                  </div>
                </div>
              </div>

              {/* Overview & Actions */}
              <div className="p-4 sm:p-6 space-y-4">
                <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed">
                  {result.overview || 'Sinopse não disponível para este título.'}
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    data-focusable="true"
                    onClick={() => {
                      onClose();
                      onPlay(result);
                    }}
                    className="flex-1 min-w-[160px] flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-2xl transition-all shadow-lg shadow-red-600/30 active:scale-95 text-xs sm:text-sm"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Assistir Agora</span>
                  </button>

                  <button
                    data-focusable="true"
                    onClick={() => handleRollRoulette()}
                    className="flex items-center space-x-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-4 rounded-2xl transition-all border border-white/10 active:scale-95 text-xs"
                    title="Sortear outro título nesta categoria"
                  >
                    <RotateCw className="w-4 h-4 text-zinc-400 group-hover:rotate-180 transition-transform" />
                    <span>Sortear Outro</span>
                  </button>

                  <button
                    data-focusable="true"
                    onClick={handleToggleWatchlist}
                    className={`p-3 rounded-2xl border transition-all ${
                      inWatchlist
                        ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10'
                    }`}
                    title={inWatchlist ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
                  >
                    {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>

                  <button
                    data-focusable="true"
                    onClick={() => {
                      onClose();
                      onSelect(result);
                    }}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1 font-semibold underline underline-offset-4"
                  >
                    Ver Detalhes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
