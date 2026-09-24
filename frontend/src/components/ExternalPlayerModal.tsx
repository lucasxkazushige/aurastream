import React, { useState } from 'react';
import { X, Play, Tv, Download, Copy, Check, ExternalLink, Sparkles, FileText, Monitor, HelpCircle, Zap } from 'lucide-react';
import { desktopService } from '../services/desktop';

interface ExternalPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  infoHash: string;
  magnet: string;
  title: string;
}

export const ExternalPlayerModal: React.FC<ExternalPlayerModalProps> = ({
  isOpen,
  onClose,
  infoHash,
  magnet,
  title,
}) => {
  const [copied, setCopied] = useState(false);
  const [showVlcHelp, setShowVlcHelp] = useState(false);
  const [launchingPlayer, setLaunchingPlayer] = useState<string | null>(null);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const directStreamUrl = `${currentOrigin}/api/stream/direct/${infoHash}?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`;
  const vlcProtocolUrl = `vlc://${window.location.host}/api/stream/direct/${infoHash}?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`;
  const m3uUrl = `${currentOrigin}/api/stream/playlist/${infoHash}.m3u?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`;
  const strmUrl = `${currentOrigin}/api/stream/playlist/${infoHash}.strm?magnet=${encodeURIComponent(magnet)}&title=${encodeURIComponent(title)}`;
  const downloadUrl = `${currentOrigin}/api/stream/download/${infoHash}?magnet=${encodeURIComponent(magnet)}`;
  const vlcRegUrl = `${currentOrigin}/downloads/ativar-vlc-windows.reg`;

  // Android Intent for VLC and Nova Video Player
  const androidNovaIntent = `intent://${window.location.host}/api/stream/direct/${infoHash}?magnet=${encodeURIComponent(magnet)}#Intent;scheme=http;type=video/*;package=org.courville.nova;end`;

  const handleCopy = () => {
    navigator.clipboard.writeText(directStreamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleLaunchExternal = async (playerId: string) => {
    setLaunchingPlayer(playerId);
    setLaunchMessage(`Iniciando ${playerId.toUpperCase()} no Windows...`);
    const res = await desktopService.launchExternalPlayer(playerId, directStreamUrl, title);
    if (res.success) {
      setLaunchMessage(`Reproduzindo no ${res.player || playerId.toUpperCase()}!`);
      setTimeout(() => {
        setLaunchMessage(null);
        setLaunchingPlayer(null);
        onClose();
      }, 1500);
    } else {
      setLaunchMessage(res.error || `Não foi possível encontrar ${playerId.toUpperCase()}`);
      setTimeout(() => {
        setLaunchMessage(null);
        setLaunchingPlayer(null);
      }, 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-lg bg-[#121316] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Assistir no VLC ou TV</h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-xs">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3.5 flex items-start space-x-3">
            <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200 leading-relaxed">
              <strong>4K HDR Nativo (0% CPU da VPS):</strong> O arquivo original toca direto no reprodutor com som multicanal e aceleração gráfica da sua máquina!
            </p>
          </div>

          {/* Desktop 1-Click Direct Player Launch */}
          {desktopService.isDesktop() && (
            <div className="bg-purple-950/40 border border-purple-500/40 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center space-x-2 text-purple-300 font-bold text-xs">
                <Zap className="w-4 h-4 text-purple-400" />
                <span>Disparar Player do Windows com 1-Clique:</span>
              </div>
              {launchMessage && (
                <p className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 p-2 rounded-xl border border-emerald-500/30">
                  {launchMessage}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleLaunchExternal('vlc')}
                  disabled={Boolean(launchingPlayer)}
                  className="flex items-center space-x-2.5 p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Abrir no VLC</span>
                </button>

                <button
                  onClick={() => handleLaunchExternal('mpv')}
                  disabled={Boolean(launchingPlayer)}
                  className="flex items-center space-x-2.5 p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Abrir no MPV</span>
                </button>

                <button
                  onClick={() => handleLaunchExternal('mpc')}
                  disabled={Boolean(launchingPlayer)}
                  className="flex items-center space-x-2.5 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all border border-zinc-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Abrir no MPC-HC</span>
                </button>

                <button
                  onClick={() => handleLaunchExternal('potplayer')}
                  disabled={Boolean(launchingPlayer)}
                  className="flex items-center space-x-2.5 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all border border-zinc-700 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Abrir no PotPlayer</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {/* 1. Abrir no VLC via Playlist M3U (Infalível no Windows) */}
            <a
              href={m3uUrl}
              download={`${title}.m3u`}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 transition-all group shadow-lg shadow-amber-950/20"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-black font-black text-xs shadow">
                  VLC
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Abrir no VLC (Recomendado para Windows)
                    </p>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">1-Clique</span>
                  </div>
                  <p className="text-[10px] text-zinc-400">Baixa a lista de reprodução que o Windows abre no VLC na hora</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </a>

            {/* 2. Link direto de protocolo vlc:// */}
            <a
              href={vlcProtocolUrl}
              className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 border border-white/5 transition-all text-zinc-400 hover:text-white"
            >
              <div className="flex items-center space-x-2.5 text-xs">
                <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                <span>Iniciar protocolo direto vlc://</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVlcHelp(!showVlcHelp);
                }}
                className="text-[10px] text-amber-400 hover:underline flex items-center space-x-1"
              >
                <HelpCircle className="w-3 h-3" />
                <span>O Windows não encontrou o VLC?</span>
              </button>
            </a>

            {/* VLC Windows Protocol Helper */}
            {showVlcHelp && (
              <div className="bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-2.5 animate-fade-in text-zinc-300">
                <p className="font-bold text-amber-400 flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Por que o Windows disse que não encontrou o VLC?</span>
                </p>
                <p className="text-[11px] leading-relaxed text-zinc-300">
                  Por padrão, o Windows não associa o link <code className="text-amber-300">vlc://</code> automaticamente. Você tem 3 opções fáceis:
                </p>
                <ul className="text-[11px] space-y-1.5 list-disc list-inside text-zinc-400">
                  <li><strong className="text-white">Opção 1 (Mais fácil):</strong> Use o botão laranja acima <strong>"Abrir no VLC (Recomendado para Windows)"</strong>. O Windows já abre o VLC automaticamente com ele!</li>
                  <li><strong className="text-white">Opção 2:</strong> Abra o VLC no seu PC, tecle <strong className="text-white">Ctrl + N</strong> e cole o link de rede abaixo.</li>
                  <li><strong className="text-white">Opção 3:</strong> <a href={vlcRegUrl} download="ativar-vlc-windows.reg" className="text-emerald-400 underline font-bold">Baixar ativador .REG do VLC</a> (dê dois cliques nele e o protocolo direto vlc:// funcionará no Windows para sempre).</li>
                </ul>
              </div>
            )}

            {/* 3. Android TV Box (Nova Video Player) */}
            <a
              href={androidNovaIntent}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 hover:border-blue-500/50 transition-all group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black text-xs">
                  TV
                </div>
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors">
                    Nova Player / Android TV Box
                  </p>
                  <p className="text-[10px] text-zinc-400">Dispara reprodução em tela cheia na TV ou celular Android</p>
                </div>
              </div>
              <Play className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </a>

            {/* 4. Baixar STRM (Kodi) ou Download Bruto */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={strmUrl}
                download
                className="flex items-center justify-center space-x-1.5 p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 text-xs font-bold text-zinc-300 hover:text-white transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Baixar .STRM (Kodi)</span>
              </a>

              <a
                href={downloadUrl}
                className="flex items-center justify-center space-x-1.5 p-3 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 text-xs font-bold text-zinc-300 hover:text-white transition-all"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download .MKV Bruto</span>
              </a>
            </div>
          </div>

          {/* Direct link copy box */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Link de Rede Direto (Para colar no VLC com Ctrl+N):</label>
              <span className="text-[10px] text-zinc-500">VLC &gt; Mídia &gt; Abrir Fluxo de Rede</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={directStreamUrl}
                className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none select-all"
              />
              <button
                onClick={handleCopy}
                className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 flex-shrink-0 shadow-md shadow-amber-600/30"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
