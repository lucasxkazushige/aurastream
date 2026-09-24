import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  CheckCircle,
  Cloud,
  HardDrive,
  RefreshCw,
  Download,
  Trash2,
  Pause,
  Play,
  AlertTriangle,
  Database,
  Activity,
  Check,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { StreamSession, StorageOverview } from '../types';

interface DownloadsModalProps {
  onClose: () => void;
  onPlaySession?: (session: StreamSession) => void;
}

export const DownloadsModal: React.FC<DownloadsModalProps> = ({
  onClose,
  onPlaySession,
}) => {
  const [activeTab, setActiveTab] = useState<'downloads' | 'storage'>('downloads');
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [storage, setStorage] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    infoHash: string;
    title: string;
    deleteR2: boolean;
  } | null>(null);
  const [confirmCleanAll, setConfirmCleanAll] = useState<'r2' | 'local' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [sessData, storageData] = await Promise.all([
        api.getSessions().catch(() => ({ count: 0, sessions: [] })),
        api.getStorageOverview().catch(() => null),
      ]);
      if (sessData?.sessions) setSessions(sessData.sessions);
      if (storageData) setStorage(storageData);
    } catch (err) {
      console.error('Error loading downloads data:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    pollTimerRef.current = setInterval(() => {
      loadData(true);
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleStopDownload = async (infoHash: string) => {
    setActionLoading(`stop_${infoHash}`);
    try {
      await api.stopDownload(infoHash);
      showToast('Download pausado com sucesso!');
      await loadData(true);
    } catch (err: any) {
      showToast(`Erro ao pausar: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteStream = async (infoHash: string, deleteR2: boolean) => {
    setActionLoading(`delete_${infoHash}`);
    try {
      const res = await api.deleteStream(infoHash, deleteR2);
      showToast(
        deleteR2
          ? `Download removido do servidor e ${res.deletedR2Count} arquivos apagados do R2!`
          : 'Download e arquivos temporários removidos do servidor!'
      );
      setConfirmDelete(null);
      await loadData(true);
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteFromR2 = async (infoHash: string) => {
    setActionLoading(`r2_${infoHash}`);
    try {
      const res = await api.deleteFromR2(infoHash);
      showToast(`${res.deletedCount} arquivos de streaming excluídos da nuvem Cloudflare R2!`);
      await loadData(true);
    } catch (err: any) {
      showToast(`Erro ao remover do R2: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanAllR2 = async () => {
    setActionLoading('clean_all_r2');
    try {
      const res = await api.cleanAllR2();
      showToast(`Cache do Cloudflare R2 zerado com sucesso! (${res.deletedCount} arquivos apagados)`);
      setConfirmCleanAll(null);
      await loadData(true);
    } catch (err: any) {
      showToast(`Erro ao limpar R2: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanAllLocal = async () => {
    setActionLoading('clean_all_local');
    try {
      const res = await api.cleanAllLocal();
      showToast(`Arquivos temporários do servidor limpos! (${res.deletedCount} pastas removidas)`);
      setConfirmCleanAll(null);
      await loadData(true);
    } catch (err: any) {
      showToast(`Erro ao limpar temporários: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  };

  const activeDownloadsCount = sessions.filter(
    (s) => s.status === 'downloading' || s.status === 'transcoding' || s.status === 'initializing'
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 border border-emerald-500/60 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#202020] border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-base">Confirmar Exclusão</h3>
            </div>
            <p className="text-xs text-zinc-300">
              Deseja realmente remover o download de{' '}
              <strong className="text-white">"{confirmDelete.title}"</strong>?
            </p>
            {confirmDelete.deleteR2 ? (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-[11px] text-red-200">
                ⚠️ <strong>Atenção:</strong> Isso irá interromper a reprodução, limpar os dados do servidor local e <strong>apagar permanentemente todos os arquivos do Cloudflare R2</strong>.
              </div>
            ) : (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[11px] text-zinc-400">
                Isso irá parar o download e remover os arquivos temporários do servidor local, preservando o que já estiver salvo na nuvem R2.
              </div>
            )}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteStream(confirmDelete.infoHash, confirmDelete.deleteR2)}
                disabled={Boolean(actionLoading)}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-lg shadow-red-600/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clean All */}
      {confirmCleanAll && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-[#202020] border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-bold text-base">
                {confirmCleanAll === 'r2' ? 'Zerar Todo o Cache do R2?' : 'Limpar Arquivos Temporários do Servidor?'}
              </h3>
            </div>
            <p className="text-xs text-zinc-300">
              {confirmCleanAll === 'r2'
                ? 'Esta ação apagará todos os fragmentos de vídeo HLS e legendas armazenados na nuvem Cloudflare R2.'
                : 'Esta ação removerá todos os downloads ativos e arquivos temporários em disco (/app/temp) no servidor.'}
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmCleanAll(null)}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmCleanAll === 'r2' ? handleCleanAllR2 : handleCleanAllLocal}
                disabled={Boolean(actionLoading)}
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center space-x-1.5 shadow-lg shadow-amber-600/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{actionLoading ? 'Limpando...' : 'Sim, Limpar Tudo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-[#181818] border border-zinc-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-600/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Gerenciador de Downloads & Nuvem R2</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Controle de downloads torrent, taxas P2P e arquivos em cache no Cloudflare R2
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => loadData(false)}
              className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Atualizar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-5 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('downloads')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'downloads'
                ? 'border-red-600 text-white font-bold bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Downloads & Sessões</span>
            {sessions.length > 0 && (
              <span
                className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeDownloadsCount > 0
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {sessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'storage'
                ? 'border-red-600 text-white font-bold bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-orange-400" />
            <span>Nuvem R2 & Armazenamento</span>
            {storage && (
              <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded-full">
                {storage.r2.sizeFormatted}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: DOWNLOADS & ACTIVE SESSIONS */}
          {activeTab === 'downloads' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-red-500" />
                    Sessões de Download & Transcodificação ({sessions.length})
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Acompanhe a taxa de download e o status dos torrents no servidor.
                  </p>
                </div>
                {sessions.length > 0 && (
                  <button
                    onClick={() => setConfirmCleanAll('local')}
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Todas</span>
                  </button>
                )}
              </div>

              {sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map((session) => {
                    const isCompleted = session.status === 'completed' || session.isR2Cached;
                    const isStopped = session.status === 'stopped';
                    const isTranscoding = session.status === 'transcoding' || session.status === 'initializing';
                    const isReady = session.status === 'ready';

                    return (
                      <div
                        key={session.sessionId}
                        className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition-colors shadow-md"
                      >
                        {/* Title and Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-white truncate">{session.title}</h4>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                              Hash: {session.infoHash}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            {isCompleted && (
                              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" /> Salvo no R2
                              </span>
                            )}
                            {isReady && (
                              <span className="bg-green-500/20 text-green-400 border border-green-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center animate-pulse">
                                <Play className="w-3 h-3 mr-1 fill-green-400" /> Pronto
                              </span>
                            )}
                            {isTranscoding && (
                              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center animate-pulse">
                                <Activity className="w-3 h-3 mr-1 animate-spin" /> Baixando / Transcodificando
                              </span>
                            )}
                            {isStopped && (
                              <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                                <Pause className="w-3 h-3 mr-1" /> Pausado
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <span>Progresso do Download:</span>
                            <span className="font-bold text-white font-mono">{session.progress}%</span>
                          </div>
                          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                isCompleted
                                  ? 'bg-emerald-500'
                                  : isStopped
                                  ? 'bg-amber-500'
                                  : 'bg-red-600'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(2, session.progress))}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-400 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-800/60">
                          <div>
                            <span className="text-zinc-500 block text-[10px]">Velocidade</span>
                            <span className="font-semibold text-white font-mono">
                              {formatSpeed(session.downloadSpeed)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[10px]">Seeds / Peers</span>
                            <span className="font-semibold text-white font-mono">
                              {session.seeds} seeds / {session.peers} peers
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[10px]">Segmentos HLS</span>
                            <span className="font-semibold text-white font-mono">
                              {session.uploadedSegments || 0} enviados
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[10px]">Áudios & Subs</span>
                            <span className="font-semibold text-white">
                              {session.audioTracks?.length || 1} áudios • {session.subtitles?.length || 0} subs
                            </span>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <div className="flex items-center space-x-2">
                            {/* Stop/Pause Button */}
                            {!isStopped && !isCompleted && (
                              <button
                                onClick={() => handleStopDownload(session.infoHash)}
                                disabled={actionLoading === `stop_${session.infoHash}`}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors flex items-center space-x-1 border border-zinc-700"
                                title="Pausar download"
                              >
                                <Pause className="w-3.5 h-3.5 text-amber-400" />
                                <span>Pausar</span>
                              </button>
                            )}

                            {/* Play Button */}
                            {onPlaySession && (isReady || isCompleted) && (
                              <button
                                onClick={() => {
                                  onPlaySession(session);
                                  onClose();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors flex items-center space-x-1 shadow-md shadow-red-600/30"
                              >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Assistir</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Delete Local Only */}
                            <button
                              onClick={() =>
                                setConfirmDelete({
                                  infoHash: session.infoHash,
                                  title: session.title,
                                  deleteR2: false,
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-[11px]"
                              title="Excluir apenas arquivos temporários do servidor local"
                            >
                              Parar & Limpar Local
                            </button>

                            {/* Delete Everything (Local + R2) */}
                            <button
                              onClick={() =>
                                setConfirmDelete({
                                  infoHash: session.infoHash,
                                  title: session.title,
                                  deleteR2: true,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-semibold transition-colors flex items-center space-x-1"
                              title="Excluir completamente do servidor e da nuvem R2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir (Local + R2)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
                    <Download className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-300">Nenhum download ativo no momento</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Ao reproduzir qualquer filme ou série pelo catálogo, o download e o status aparecerão aqui em tempo real.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLOUDFLARE R2 & STORAGE MANAGEMENT */}
          {activeTab === 'storage' && (
            <div className="space-y-5">
              {/* Storage Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cloudflare R2 Card */}
                <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cloud className="w-5 h-5 text-orange-400" />
                      <span className="font-bold text-sm text-white">Cloudflare R2 CDN</span>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center">
                      <Check className="w-3 h-3 mr-1" /> Conectado
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl font-black text-white font-mono tracking-tight">
                      {storage?.r2.sizeFormatted || '0 B'}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {storage?.r2.totalFiles || 0} arquivos salvos • Bucket:{' '}
                      <span className="text-white font-mono">{storage?.r2.bucket || 'strem'}</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                    <a
                      href={storage?.r2.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center space-x-1"
                    >
                      <span>Abrir CDN</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => setConfirmCleanAll('r2')}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1 rounded-lg transition-colors border border-red-500/20"
                    >
                      Zerar Cache R2
                    </button>
                  </div>
                </div>

                {/* Local Disk Storage Card */}
                <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-5 h-5 text-blue-400" />
                      <span className="font-bold text-sm text-white">Disco Local do Servidor</span>
                    </div>
                    <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      /app/temp
                    </span>
                  </div>

                  <div>
                    <div className="text-2xl font-black text-white font-mono tracking-tight">
                      {storage?.local.sizeFormatted || '0 B'}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {storage?.local.sessionsCount || 0} pastas temporárias em disco
                    </p>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">Transcodificação ativa</span>
                    <button
                      onClick={() => setConfirmCleanAll('local')}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1 rounded-lg transition-colors border border-red-500/20"
                    >
                      Limpar Temporários
                    </button>
                  </div>
                </div>
              </div>

              {/* Items Stored in Storage Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center">
                  <Database className="w-4 h-4 text-purple-400 mr-2" />
                  Mídias em Cache no R2 & Servidor ({storage?.items.length || 0})
                </h4>

                {storage && storage.items.length > 0 ? (
                  <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800 bg-zinc-900/40">
                    {storage.items.map((item) => (
                      <div
                        key={item.infoHash}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-800/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-white truncate">{item.title}</span>
                            {item.isR2 && (
                              <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-orange-500/30">
                                R2
                              </span>
                            )}
                            {item.isLocal && (
                              <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-blue-500/30">
                                Local
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3 text-[11px] text-zinc-400 font-mono">
                            <span>Hash: {item.infoHash.slice(0, 10)}...</span>
                            <span>•</span>
                            <span>{item.fileCount} arquivos</span>
                            <span>•</span>
                            <span className="text-white font-bold">{item.sizeFormatted}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {item.isR2 && (
                            <button
                              onClick={() => handleDeleteFromR2(item.infoHash)}
                              disabled={actionLoading === `r2_${item.infoHash}`}
                              className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold transition-colors flex items-center space-x-1"
                              title="Excluir apenas da nuvem Cloudflare R2"
                            >
                              <Cloud className="w-3.5 h-3.5" />
                              <span>Excluir do R2</span>
                            </button>
                          )}

                          <button
                            onClick={() =>
                              setConfirmDelete({
                                infoHash: item.infoHash,
                                title: item.title,
                                deleteR2: true,
                              })
                            }
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
                            title="Excluir completamente (Local + R2)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-zinc-900/30 rounded-xl border border-zinc-800 text-xs text-zinc-500">
                    Nenhuma mídia armazenada no cache do Cloudflare R2 ou disco no momento.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>AuraStream Downloads • Cloudflare R2</span>
          </div>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-5 py-2 rounded-lg transition-colors shadow-lg shadow-red-600/30"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
