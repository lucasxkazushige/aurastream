import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  Film,
  Settings,
  Tv2,
  Volume2,
  Subtitles,
  Sliders,
  Keyboard,
  Trash2,
  Cloud,
  Server,
  Radio,
  Bookmark,
  Play,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { storage, UserPreferences } from '../services/storage';
import { desktopService, AVAILABLE_PLAYERS, DesktopPlayerOption } from '../services/desktop';

interface SettingsModalProps {
  onClose: () => void;
  tvMode: boolean;
  setTvMode: (val: boolean) => void;
  onUserDataChanged?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  tvMode,
  setTvMode,
  onUserDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'playback' | 'tv' | 'data' | 'system'>('playback');
  const [prefs, setPrefs] = useState<UserPreferences>(storage.getPreferences());
  const [health, setHealth] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<DesktopPlayerOption[]>(AVAILABLE_PLAYERS);
  const [selectedPlayer, setSelectedPlayer] = useState<string>(
    prefs.defaultPlayer || desktopService.getPreferredPlayer() || 'internal'
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    api.getHealth().then(setHealth).catch(() => {});
    desktopService.getInstalledPlayers().then((players) => {
      setAvailablePlayers(players);
    });
  }, []);

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    storage.savePreferences(updated);
    showToast('Preferência salva com sucesso!');
  };

  const handleSelectPlayer = (id: string) => {
    setSelectedPlayer(id);
    updatePreference('defaultPlayer', id as any);
    desktopService.setPreferredPlayer(id);
  };

  const handleClearHistory = () => {
    if (window.confirm('Deseja realmente apagar todo o histórico de "Continuar Assistindo"?')) {
      storage.clearAllProgress();
      showToast('Histórico de Continuar Assistindo apagado!');
      if (onUserDataChanged) onUserDataChanged();
    }
  };

  const handleClearWatchlist = () => {
    if (window.confirm('Deseja realmente limpar todos os itens salvos em "Minha Lista"?')) {
      storage.clearWatchlist();
      showToast('Minha Lista esvaziada com sucesso!');
      if (onUserDataChanged) onUserDataChanged();
    }
  };

  const historyCount = storage.getProgressList().length;
  const watchlistCount = storage.getWatchlist().length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 border border-emerald-500/60 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-[#181818] border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-700 text-white shadow-lg">
              <Settings className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Configurações & Preferências</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Personalize áudio padrão, legendas, modo Smart TV e dados da conta
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-5 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('playback')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'playback'
                ? 'border-red-600 text-white font-bold bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Reprodução & Áudio</span>
          </button>

          <button
            onClick={() => setActiveTab('tv')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'tv'
                ? 'border-red-600 text-white font-bold bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tv2 className="w-3.5 h-3.5 text-red-500" />
            <span>Smart TV & Atalhos</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'data'
                ? 'border-red-600 text-white font-bold bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Dados & Histórico</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'system'
                ? 'border-red-600 text-white font-bold bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-blue-400" />
            <span>Sistema & Status</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: PLAYBACK PREFERENCES */}
          {activeTab === 'playback' && (
            <div className="space-y-4">
              {/* Preferred Windows / Desktop Player */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Play className="w-4 h-4 text-red-500 fill-red-500" />
                    <span className="font-bold text-sm text-white">Player de Vídeo Padrão</span>
                  </div>
                  {desktopService.isDesktop() ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      App Windows Ativo
                    </span>
                  ) : (
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                      Navegador Web / App
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Escolha qual reprodutor o AuraStream deve abrir automaticamente ao clicar no botão "Assistir":
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {availablePlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleSelectPlayer(player.id)}
                      className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                        selectedPlayer === player.id
                          ? 'border-red-500 bg-red-500/10 text-white font-bold shadow-md shadow-red-950/30'
                          : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-white truncate">{player.name}</p>
                          {player.badge && (
                            <span className="text-[9px] bg-red-600/30 text-red-300 border border-red-500/40 px-1 rounded font-bold">
                              {player.badge}
                            </span>
                          )}
                          {player.installed && player.id !== 'internal' && (
                            <span className="text-[9px] bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-1 rounded font-bold">
                              Detectado
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{player.description}</p>
                      </div>
                      {selectedPlayer === player.id && <CheckCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Audio */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-white">Preferência de Áudio</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Ao iniciar a reprodução, o player selecionará automaticamente esta faixa caso disponível no torrent:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => updatePreference('preferredAudio', 'pt-br')}
                    className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                      prefs.preferredAudio === 'pt-br'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-white">🇧🇷 Português (Dublado PT-BR)</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Prioriza áudio em português</p>
                    </div>
                    {prefs.preferredAudio === 'pt-br' && <CheckCircle className="w-4 h-4 text-red-500" />}
                  </button>

                  <button
                    onClick={() => updatePreference('preferredAudio', 'original')}
                    className={`p-3 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                      prefs.preferredAudio === 'original'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-white">🌐 Áudio Original (Inglês / Nativo)</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Mantém o idioma original da gravação</p>
                    </div>
                    {prefs.preferredAudio === 'original' && <CheckCircle className="w-4 h-4 text-red-500" />}
                  </button>
                </div>
              </div>

              {/* Automatic Subtitles */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <Subtitles className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-sm text-white">Legendas Automáticas</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Comportamento padrão para ativação de legendas em português:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => updatePreference('autoSubtitles', 'auto')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      prefs.autoSubtitles === 'auto'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <p className="font-semibold text-white">Automático</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Ativa se o áudio não for PT-BR</p>
                  </button>

                  <button
                    onClick={() => updatePreference('autoSubtitles', 'always')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      prefs.autoSubtitles === 'always'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <p className="font-semibold text-white">Sempre Ativadas</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Ativa legenda PT-BR sempre</p>
                  </button>

                  <button
                    onClick={() => updatePreference('autoSubtitles', 'never')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      prefs.autoSubtitles === 'never'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <p className="font-semibold text-white">Desativadas</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Iniciar vídeo sem legendas</p>
                  </button>
                </div>
              </div>

              {/* Max Quality */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <Film className="w-4 h-4 text-purple-400" />
                  <span className="font-bold text-sm text-white">Resolução Preferida</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Prioridade automática ao selecionar os torrents com o botão "Assistir Agora":
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => updatePreference('maxQuality', '4k')}
                    className={`p-2.5 rounded-lg border text-center text-xs transition-all ${
                      prefs.maxQuality === '4k'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold text-white block">4K Ultra HD</span>
                    <span className="text-[10px] text-zinc-500">2160p</span>
                  </button>

                  <button
                    onClick={() => updatePreference('maxQuality', '1080p')}
                    className={`p-2.5 rounded-lg border text-center text-xs transition-all ${
                      prefs.maxQuality === '1080p'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold text-white block">1080p Full HD</span>
                    <span className="text-[10px] text-zinc-500">Recomendado</span>
                  </button>

                  <button
                    onClick={() => updatePreference('maxQuality', '720p')}
                    className={`p-2.5 rounded-lg border text-center text-xs transition-all ${
                      prefs.maxQuality === '720p'
                        ? 'border-red-500 bg-red-500/10 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold text-white block">720p HD</span>
                    <span className="text-[10px] text-zinc-500">Mais Rápido</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SMART TV & SHORTCUTS */}
          {activeTab === 'tv' && (
            <div className="space-y-4">
              {/* TV Remote Mode Switch */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center">
                    <Tv2 className="w-4 h-4 mr-2 text-red-500" />
                    Modo Smart TV (Navegação D-Pad)
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5 max-w-sm">
                    Destaca botões com anel de foco visível para navegação usando controle remoto de TV ou setas do teclado.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTvMode(!tvMode);
                    showToast(tvMode ? 'Modo TV desativado' : 'Modo TV ativado!');
                  }}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                    tvMode
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {tvMode ? 'Ativado' : 'Desativado'}
                </button>
              </div>

              {/* Keyboard & Remote Shortcuts Reference */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                <h4 className="font-bold text-sm text-white flex items-center">
                  <Keyboard className="w-4 h-4 mr-2 text-purple-400" />
                  Atalhos de Teclado & Controle Remoto no Player
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Play / Pausar</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-white rounded font-mono text-[11px]">Espaço ou K</kbd>
                  </div>
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Voltar / Avançar 10s</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-white rounded font-mono text-[11px]">← / → ou J / L</kbd>
                  </div>
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Aumentar / Diminuir Volume</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-white rounded font-mono text-[11px]">↑ / ↓</kbd>
                  </div>
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Silenciar / Mudo</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-white rounded font-mono text-[11px]">M</kbd>
                  </div>
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Tela Cheia</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-white rounded font-mono text-[11px]">F</kbd>
                  </div>
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Menu de Áudios / Dublagem</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-red-400 font-bold rounded font-mono text-[11px]">A</kbd>
                  </div>
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Menu de Legendas</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-blue-400 font-bold rounded font-mono text-[11px]">S ou C</kbd>
                  </div>
                  <div className="p-2.5 bg-zinc-950/60 rounded-lg flex items-center justify-between border border-zinc-800/60">
                    <span className="text-zinc-400">Sair / Voltar</span>
                    <kbd className="px-2 py-0.5 bg-zinc-800 text-white rounded font-mono text-[11px]">Esc / Back</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USER DATA & HISTORY */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              {/* Continue Watching Section */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Play className="w-5 h-5 text-red-500 fill-red-500" />
                    <span className="font-bold text-sm text-white">Continuar Assistindo</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 bg-zinc-800 px-2.5 py-0.5 rounded-full">
                    {historyCount} {historyCount === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Seu histórico de progresso de filmes e séries assistidos recentemente.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleClearHistory}
                    disabled={historyCount === 0}
                    className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Histórico de Continuar Assistindo</span>
                  </button>
                </div>
              </div>

              {/* Watchlist Section */}
              <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bookmark className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm text-white">Minha Lista (Favoritos)</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-400 bg-zinc-800 px-2.5 py-0.5 rounded-full">
                    {watchlistCount} {watchlistCount === 1 ? 'título' : 'títulos'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Títulos que você marcou com o ícone de bookmark para assistir mais tarde.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleClearWatchlist}
                    disabled={watchlistCount === 0}
                    className="px-4 py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Esvaziar Minha Lista</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SYSTEM & STATUS */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cloudflare R2 Info */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cloud className="w-5 h-5 text-orange-400" />
                      <span className="font-semibold text-sm">Cloudflare R2 Bucket</span>
                    </div>
                    <span className="flex items-center text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Conectado
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1 pt-1">
                    <p>
                      Bucket: <span className="text-white font-mono">{health?.r2?.bucket || 'strem'}</span>
                    </p>
                    <p className="truncate">
                      Domínio CDN: <span className="text-white font-mono text-[11px]">{health?.r2?.publicUrl}</span>
                    </p>
                    <p className="text-[11px] text-zinc-500">Zero egress fees • CDN Global</p>
                  </div>
                </div>

                {/* TMDB Info */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Film className="w-5 h-5 text-blue-400" />
                      <span className="font-semibold text-sm">The Movie DB (TMDB)</span>
                    </div>
                    <span className="flex items-center text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Ativo (pt-BR)
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1 pt-1">
                    <p>Idioma Padrão: <span className="text-white">Português do Brasil</span></p>
                    <p>Catálogo: <span className="text-white">Capas, Sinopses, Elenco, Temporadas</span></p>
                    <p className="text-[11px] text-zinc-500">API Conectada & Autenticada</p>
                  </div>
                </div>

                {/* Transcoder Engine */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Server className="w-5 h-5 text-purple-400" />
                      <span className="font-semibold text-sm">Motor HLS & FFmpeg 6</span>
                    </div>
                    <span className="text-xs text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded">
                      Multi-Áudio
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1 pt-1">
                    <p>Preset: <span className="text-white font-mono">veryfast / zerolatency</span></p>
                    <p>Subtítulos: <span className="text-white">Conversão automática para WebVTT</span></p>
                    <p className="text-[11px] text-zinc-500">Container Docker isolado na porta 7700</p>
                  </div>
                </div>

                {/* Trackers Info */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Radio className="w-5 h-5 text-emerald-400" />
                      <span className="font-semibold text-sm">Rede BitTorrent P2P</span>
                    </div>
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      DHT / UDP
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1 pt-1">
                    <p>Trackers Públicos: <span className="text-white font-mono">11 anunciados</span></p>
                    <p>WebTorrent Trackers: <span className="text-white font-mono">wss:// (WebSocket)</span></p>
                    <p className="text-[11px] text-zinc-500">Conexão de alta velocidade com pares</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>AuraStream Plataforma • v2.0</span>
          </div>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-5 py-2 rounded-lg transition-colors shadow-lg shadow-red-600/30"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
