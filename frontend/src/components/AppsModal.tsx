import React, { useState } from 'react';
import { X, Tv, Monitor, Smartphone, Check, Copy, ExternalLink, Play, Sparkles, ShieldCheck, Download, Laptop, HelpCircle } from 'lucide-react';

interface AppsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppsModal: React.FC<AppsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'downloads' | 'stremio' | 'tv_guide'>('downloads');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const stremioManifestUrl = `${currentOrigin}/stremio/manifest.json`;
  const stremioProtocolUrl = `stremio://${window.location.host}/stremio/manifest.json`;
  const apkDownloadUrl = `${currentOrigin}/app.apk`;
  const windowsInstallerUrl = `${currentOrigin}/windows-setup.exe`;
  const linuxDownloadUrl = `${currentOrigin}/linux.tar.gz`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-3xl bg-[#111215] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/5 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center space-x-2">
                <span>Central de Download dos Aplicativos</span>
                <span className="text-[10px] bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  DOWNLOAD DIRETO
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Baixe o aplicativo para seu PC, Celular ou Smart TV com apenas 1 clique</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 bg-black/30 px-6 pt-3 space-x-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('downloads')}
            className={`flex items-center space-x-2 px-4 py-3 rounded-t-2xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'downloads'
                ? 'border-red-500 text-white bg-zinc-900/80'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Downloads Diretos (Windows, Android, Linux)</span>
          </button>

          <button
            onClick={() => setActiveTab('stremio')}
            className={`flex items-center space-x-2 px-4 py-3 rounded-t-2xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'stremio'
                ? 'border-red-500 text-white bg-zinc-900/80'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Smart TV (Samsung / LG / Stremio)</span>
          </button>

          <button
            onClick={() => setActiveTab('tv_guide')}
            className={`flex items-center space-x-2 px-4 py-3 rounded-t-2xl text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'tv_guide'
                ? 'border-red-500 text-white bg-zinc-900/80'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-blue-400" />
            <span>Como Instalar na TV Box / Firestick</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-zinc-300 text-sm">
          {/* 1. DIRECT DOWNLOADS TAB */}
          {activeTab === 'downloads' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900/70 to-zinc-900/40 border border-emerald-500/30 rounded-2xl p-4 space-y-1">
                <p className="text-xs text-emerald-300 font-semibold flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Todos os pacotes abaixo já vêm configurados para se conectar ao seu servidor AuraStream automaticamente!</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. WINDOWS CARD */}
                <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-red-500/50 transition-all shadow-lg group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                          <Laptop className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Windows PC & Notebook</h3>
                          <span className="text-[10px] text-zinc-400">Windows 10 / 11 (64-bit)</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">AUTO-UPDATE ✓</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Instalador nativo com aceleração total da GPU para rodar 4K HDR sem travamentos. O app atualiza sozinho quando sair nova versão!
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      💡 <strong>Como usar:</strong> Baixe o instalador, clique em <strong>Instalar</strong> e pronto — atalho criado no Desktop e Menu Iniciar.
                    </p>
                  </div>

                  <a
                    href={windowsInstallerUrl}
                    download="AuraStream-Setup.exe"
                    className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Instalador Windows (.exe)</span>
                  </a>
                </div>

                {/* 2. ANDROID / TV BOX CARD */}
                <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition-all shadow-lg group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Android & Smart TV Box</h3>
                          <span className="text-[10px] text-zinc-400">Android TV, Mi Box, Celular</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-bold">3.6 MB</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Aplicativo instalável (.APK) em tela cheia com suporte ao controle remoto da TV e celulares.
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      📺 <strong>Link curto para Downloader da TV:</strong> <code className="text-emerald-300 font-mono">{apkDownloadUrl}</code>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <a
                      href={apkDownloadUrl}
                      download="AuraStream-TV.apk"
                      className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Aplicativo APK (.apk)</span>
                    </a>

                    <button
                      onClick={() => handleCopy(apkDownloadUrl, 'apk')}
                      className="w-full flex items-center justify-center space-x-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] py-1.5 rounded-lg border border-white/5 transition-colors"
                    >
                      {copiedUrl === 'apk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl === 'apk' ? 'Link Copiado!' : 'Copiar Link para a TV'}</span>
                    </button>
                  </div>
                </div>

                {/* 3. LINUX CARD */}
                <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-amber-500/50 transition-all shadow-lg group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <Monitor className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Linux Desktop</h3>
                          <span className="text-[10px] text-zinc-400">Ubuntu, Debian, Fedora</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-bold">102 MB</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Pacote Linux com executável standalone para rodar o AuraStream sem precisar de navegador.
                    </p>
                  </div>

                  <a
                    href={linuxDownloadUrl}
                    download="AuraStream-Linux.tar.gz"
                    className="flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white py-3 px-4 rounded-xl font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Baixar para Linux (.tar.gz)</span>
                  </a>
                </div>

                {/* 4. SMART TV VIA STREMIO */}
                <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-purple-500/50 transition-all shadow-lg group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                          <Tv className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">Smart TV Samsung / LG</h3>
                          <span className="text-[10px] text-zinc-400">Sem baixar arquivos</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">1-Clique</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Instale o Addon oficial no Stremio da sua TV. Não precisa de pen drive nem de instalar APK!
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('stremio')}
                    className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white py-3 px-4 rounded-xl font-bold text-xs shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Ver Como Conectar no Stremio</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. STREMIO TAB */}
          {activeTab === 'stremio' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-purple-950/40 border border-purple-500/30 rounded-2xl p-4.5 space-y-2">
                <h3 className="font-bold text-white text-base flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Addon Oficial do AuraStream para o Stremio</span>
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  O Stremio possui aplicativos oficiais gratuitos para <strong className="text-white">Samsung TV (Tizen)</strong>, <strong className="text-white">LG TV (webOS)</strong>, <strong className="text-white">Android TV / Google TV</strong>, <strong className="text-white">Fire TV Stick</strong>, Windows, Mac e Celulares.
                </p>
              </div>

              {/* Install links */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Link do Addon para Adicionar no Stremio:</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-4 py-3 font-mono text-xs text-purple-300 select-all overflow-x-auto">
                    {stremioManifestUrl}
                  </div>
                  <button
                    onClick={() => handleCopy(stremioManifestUrl, 'stremio')}
                    className="flex items-center space-x-1.5 bg-purple-600 hover:bg-purple-500 text-white px-4 py-3 rounded-2xl font-bold text-xs transition-colors shadow-lg shadow-purple-600/30"
                  >
                    {copiedUrl === 'stremio' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedUrl === 'stremio' ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                <div className="pt-1">
                  <a
                    href={stremioProtocolUrl}
                    className="inline-flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Instalar direto no Stremio deste dispositivo (1-Clique)</span>
                  </a>
                </div>
              </div>

              {/* Steps */}
              <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4.5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Passo a Passo na sua Smart TV:</h4>
                <ol className="text-xs space-y-2.5 list-decimal list-inside text-zinc-300 leading-relaxed">
                  <li>Abra o aplicativo <strong>Stremio</strong> na sua Smart TV (Samsung, LG ou Android TV).</li>
                  <li>Vá no menu lateral e clique no ícone de quebra-cabeça (<strong>Addons / Extensões</strong>).</li>
                  <li>No campo de busca de Addon ou no celular/PC com a mesma conta do Stremio, cole o link acima.</li>
                  <li>Clique em <strong>Instalar</strong>. Pronto! As opções <strong>"AuraStream [4K DIRECT]"</strong> aparecerão em todos os filmes e séries!</li>
                </ol>
              </div>
            </div>
          )}

          {/* 3. TV GUIDE TAB */}
          {activeTab === 'tv_guide' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-4.5 space-y-2">
                <h3 className="font-bold text-white text-base flex items-center space-x-2">
                  <Tv className="w-4 h-4 text-blue-400" />
                  <span>Como Instalar o APK na sua Smart TV Box ou Fire TV Stick</span>
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  O aplicativo oficial <strong>Downloader</strong> permite baixar e instalar o AuraStream na sua TV em menos de 2 minutos usando apenas o controle remoto.
                </p>
              </div>

              <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4.5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Passo a Passo:</h4>
                <ol className="text-xs space-y-3 list-decimal list-inside text-zinc-300 leading-relaxed">
                  <li>
                    Na sua TV Box ou Firestick, abra a loja de aplicativos (Google Play Store ou Amazon Store) e instale o aplicativo gratuito chamado <strong>Downloader</strong> (ícone laranja).
                  </li>
                  <li>
                    Abra o <strong>Downloader</strong> e na barra de endereço digite o link curto:
                    <div className="mt-1.5 p-2.5 bg-black/60 border border-white/10 rounded-xl font-mono text-emerald-400 text-xs select-all">
                      {apkDownloadUrl}
                    </div>
                  </li>
                  <li>
                    O aplicativo baixará o instalador <strong>AuraStream-TV.apk</strong> e perguntará se deseja instalar. Clique em <strong>Instalar</strong>.
                  </li>
                  <li>
                    Pronto! O aplicativo aparecerá na tela inicial da sua TV com suporte completo a navegação pelo controle remoto.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-white/5 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Servidor AuraStream online em 4K nativo</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-red-600/30"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
