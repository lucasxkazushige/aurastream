import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, CheckCircle, X, Sparkles } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
}

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; info: UpdateInfo }
  | { status: 'downloading'; progress: DownloadProgress }
  | { status: 'ready' };

export const UpdateNotification: React.FC = () => {
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as any).desktopAPI;
    if (!api?.onUpdateAvailable) return; // não é desktop ou não tem auto-update

    const cleanAvailable = api.onUpdateAvailable((info: UpdateInfo) => {
      setDismissed(false);
      setUpdate({ status: 'available', info });
    });

    const cleanProgress = api.onUpdateDownloadProgress((progress: DownloadProgress) => {
      setUpdate({ status: 'downloading', progress });
    });

    const cleanDownloaded = api.onUpdateDownloaded(() => {
      setUpdate({ status: 'ready' });
    });

    return () => {
      cleanAvailable?.();
      cleanProgress?.();
      cleanDownloaded?.();
    };
  }, []);

  const handleInstall = () => {
    const api = (window as any).desktopAPI;
    api?.installUpdateAndRestart?.();
  };

  if (dismissed || update.status === 'idle') return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[9999] max-w-xs w-full animate-slide-up">
      <div className="bg-[#111215] border border-white/15 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-red-600 to-amber-500 flex items-center justify-center shadow shadow-red-600/40">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-black text-white tracking-tight">AuraStream Update</span>
          </div>
          {update.status !== 'downloading' && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {update.status === 'available' && (
            <>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Nova versão{' '}
                <span className="font-bold text-emerald-400">v{update.info.version}</span>{' '}
                disponível! Baixando automaticamente em background…
              </p>
              <div className="flex items-center space-x-1.5 text-[10px] text-zinc-500">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                <span>Iniciando download…</span>
              </div>
            </>
          )}

          {update.status === 'downloading' && (
            <>
              <p className="text-xs text-zinc-300">
                Baixando atualização…{' '}
                <span className="font-bold text-white">{update.progress.percent}%</span>
              </p>
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${update.progress.percent}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500">
                {(update.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s
              </p>
            </>
          )}

          {update.status === 'ready' && (
            <>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-zinc-200 font-semibold">
                  Atualização pronta para instalar!
                </p>
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed">
                Será instalada automaticamente quando você fechar o app, ou clique abaixo para reiniciar agora.
              </p>
              <button
                onClick={handleInstall}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Reiniciar e Instalar Agora</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
