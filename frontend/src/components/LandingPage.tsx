import React, { useState } from 'react';
import {
  Download,
  Tv,
  Monitor,
  Sparkles,
  Zap,
  ShieldCheck,
  Film,
  Play,
  Cpu,
  Volume2,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Layers,
  Radio,
  ExternalLink,
  Laptop,
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const currentHost = typeof window !== 'undefined' ? window.location.host : '151.247.210.55:7700';
  const stremioUrl = `stremio://${currentHost}/stremio/manifest.json`;

  const faqs = [
    {
      q: 'Por que usar o aplicativo ao invés do navegador?',
      a: 'Navegadores de internet (como Chrome e Edge) não suportam decodificação de codecs avançados de cinema como HEVC 10-bit, HDR10+, Dolby Vision e áudios multicanais (Dolby Atmos / DTS-HD). No aplicativo nativo do AuraStream, o vídeo é transmitido em bitstream original sem conversão e executado com aceleração de hardware pela sua placa de vídeo no VLC ou MPV.',
    },
    {
      q: 'O aplicativo do Windows abre o VLC ou MPV sozinho?',
      a: 'Sim! No AuraStream para Windows, basta selecionar seu player favorito (VLC, MPV, MPC-HC ou PotPlayer) e clicar em "Assistir". O aplicativo dispara o reprodutor automaticamente na tela em tela cheia com 1 clique.',
    },
    {
      q: 'Como funciona na Smart TV ou TV Box?',
      a: 'Basta baixar o nosso arquivo AuraStream-TV.apk e instalar em qualquer Smart TV com Android TV, TV Box, Fire TV Stick ou Chromecast com Google TV. Ele é compatível com controle remoto e se integra ao Nova Video Player e VLC for Android.',
    },
    {
      q: 'O que significa "Sem FFmpeg e Sem HLS"?',
      a: 'Significa que o servidor não reprocessa ou rebaixa a qualidade dos seus vídeos. O arquivo original baixado via torrent é transmitido intacto (bit-a-bit) para a sua tela, proporcionando 0% de sobrecarga de processador e a qualidade máxima de 4K HDR.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#090a0c] text-white selection:bg-red-600 selection:text-white flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#090a0c]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center space-x-1.5">
                <span>AuraStream</span>
                <span className="text-red-500 text-xs px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 uppercase font-black tracking-wider">
                  4K Pro
                </span>
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-zinc-400">
            <a href="#recursos" className="hover:text-white transition-colors">
              Recursos
            </a>
            <a href="#downloads" className="hover:text-white transition-colors">
              Downloads
            </a>
            <a href="#tv" className="hover:text-white transition-colors">
              Smart TV
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={onEnterApp}
              className="text-xs font-bold text-zinc-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/5 transition-all flex items-center space-x-1"
            >
              <span>Explorar Catálogo</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 text-red-500" />
            </button>

            <a
              href="/downloads/AuraStream-Windows.zip"
              download
              className="hidden sm:flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Baixar App Windows</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-red-600/15 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-red-500/10 border border-red-500/30 px-4 py-1.5 rounded-full text-xs font-bold text-red-400 mb-8 backdrop-blur-md shadow-lg shadow-red-950/40 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Streaming P2P de Alta Fidelidade • 100% Bitstream Original</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mx-auto drop-shadow-sm">
            4K HDR Nativo e Som de Cinema no Seu <span className="bg-gradient-to-r from-red-500 via-red-400 to-amber-500 bg-clip-text text-transparent">Player Favorito.</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal">
            Sem perdas de qualidade em navegadores, sem travamentos de conversão e sem FFmpeg.
            O AuraStream foi criado exclusivamente para rodar nos <strong>aplicativos de Windows, Smart TV e Android</strong> com 1-clique automático.
          </p>

          {/* Primary CTA Buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/downloads/AuraStream-Windows.zip"
              download
              className="flex items-center space-x-3 bg-red-600 hover:bg-red-700 text-white font-black px-8 py-4 rounded-2xl shadow-2xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all text-sm sm:text-base group"
            >
              <Monitor className="w-5 h-5 group-hover:rotate-6 transition-transform" />
              <div className="text-left">
                <span className="block text-xs uppercase font-bold text-red-200">Baixar para PC</span>
                <span className="text-sm font-black">AuraStream para Windows (.ZIP)</span>
              </div>
              <Download className="w-4 h-4 ml-1 text-red-200" />
            </a>

            <a
              href="/downloads/AuraStream-TV.apk"
              download
              className="flex items-center space-x-3 bg-zinc-900/90 hover:bg-zinc-800 text-white font-black px-8 py-4 rounded-2xl border border-white/10 hover:border-zinc-700 shadow-xl hover:scale-105 active:scale-95 transition-all text-sm sm:text-base group"
            >
              <Tv className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <span className="block text-xs uppercase font-bold text-zinc-400">Smart TV & Celular</span>
                <span className="text-sm font-black">Baixar APK para TV (.APK)</span>
              </div>
              <Download className="w-4 h-4 ml-1 text-zinc-400" />
            </a>
          </div>

          {/* Additional quick links */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
            <a
              href="/downloads/AuraStream-Linux.tar.gz"
              download
              className="hover:text-white flex items-center space-x-1.5 transition-colors"
            >
              <Laptop className="w-3.5 h-3.5 text-zinc-400" />
              <span>AuraStream para Linux (.tar.gz)</span>
            </a>

            <a
              href={stremioUrl}
              className="hover:text-purple-400 flex items-center space-x-1.5 text-purple-400 font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Instalar Addon no Stremio</span>
            </a>

            <button
              onClick={onEnterApp}
              className="hover:text-red-400 flex items-center space-x-1.5 text-zinc-300 font-medium transition-colors underline underline-offset-4"
            >
              <span>Ver Catálogo Web</span>
            </button>
          </div>

          {/* Mockup Card */}
          <div className="mt-16 relative max-w-4xl mx-auto rounded-3xl border border-white/10 bg-[#121316]/90 p-4 sm:p-6 shadow-2xl shadow-black/80 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-zinc-400 pl-2">AuraStream 4K Desktop Engine</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <Zap className="w-3.5 h-3.5" />
                <span>Modo Direto: 0% CPU da VPS</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="bg-black/50 p-3.5 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Bitstream</p>
                <p className="text-sm font-black text-white mt-1">4K HDR Original</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Sem compressão de navegador</p>
              </div>

              <div className="bg-black/50 p-3.5 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Decodificação</p>
                <p className="text-sm font-black text-white mt-1">GPU Hardware</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">NVDEC / Intel / AMD</p>
              </div>

              <div className="bg-black/50 p-3.5 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Player do Windows</p>
                <p className="text-sm font-black text-white mt-1">VLC & MPV</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Disparo em 1 clique nativo</p>
              </div>

              <div className="bg-black/50 p-3.5 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Áudio & Som</p>
                <p className="text-sm font-black text-white mt-1">7.1 / Atmos</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">Passthrough multicanal</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section id="recursos" className="py-20 bg-[#0d0e12] border-t border-b border-white/5 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-bold tracking-wider text-red-500">Por que o Aplicativo?</h2>
            <p className="text-3xl sm:text-4xl font-black text-white mt-2 tracking-tight">
              A Diferença Entre Tentar Assistir no Navegador e Usar o App Nativo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="bg-[#121316] p-6 rounded-3xl border border-white/5 hover:border-red-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Sem FFmpeg & Sem HLS</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2.5 leading-relaxed">
                Navegadores não conseguem ler arquivos brutos MKV com HEVC ou áudio TrueHD, obrigando o servidor a transcodificar e perder qualidade. O app nativo do AuraStream toca o arquivo bruto direto na sua máquina.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-[#121316] p-6 rounded-3xl border border-white/5 hover:border-amber-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Aceleração de GPU do Seu PC</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2.5 leading-relaxed">
                O reprodutor abre diretamente integrado à sua placa de vídeo (GeForce, Radeon ou Intel Iris), garantindo 60fps constantes sem travamentos, sem aquecer o processador e com HDR10+ ativado.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-[#121316] p-6 rounded-3xl border border-white/5 hover:border-blue-500/40 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-5 group-hover:scale-110 transition-transform">
                <Volume2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Som Surround e Multi-Áudio</h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2.5 leading-relaxed">
                Todas as faixas de áudio do arquivo original (Dublado PT-BR, Áudio Original em Inglês, comentários do diretor) e legendas sincronizadas ficam disponíveis instantaneamente para você escolher no player.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Downloads Section */}
      <section id="downloads" className="py-20 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs uppercase font-bold tracking-wider text-red-500">Central de Downloads</h2>
            <p className="text-3xl sm:text-4xl font-black text-white mt-2 tracking-tight">
              Instale o AuraStream no Seu Dispositivo
            </p>
            <p className="text-sm text-zinc-400 mt-2">
              Escolha seu sistema operacional abaixo. Downloads diretos e de alta velocidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Windows Card */}
            <div className="bg-gradient-to-b from-[#18191f] to-[#121316] p-6 rounded-3xl border border-red-500/30 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">
                    Mais Popular
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">Windows 10 / 11</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Aplicativo completo com suporte a <strong>VLC, MPV, MPC-HC e PotPlayer</strong> em 1 clique nativo.
                </p>
                <div className="mt-4 space-y-1.5 text-xs text-zinc-300">
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Aceleração de hardware 4K</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Lançamento automático de player</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Não requer instalação complexa</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                <a
                  href="/downloads/AuraStream-Windows.zip"
                  download
                  className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-red-600/30 transition-all text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar para Windows (222 MB)</span>
                </a>
                <p className="text-[10px] text-zinc-500 text-center">
                  Extraia o ZIP e clique duas vezes em <code>AuraStream 4K.exe</code>
                </p>
              </div>
            </div>

            {/* Smart TV / Android Card */}
            <div id="tv" className="bg-[#121316] p-6 rounded-3xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Tv className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Para TV Box
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">Smart TV & Android</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  APK otimizado para telas grandes, TV Box, Chromecast com Google TV e celular Android.
                </p>
                <div className="mt-4 space-y-1.5 text-xs text-zinc-300">
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Controle remoto D-Pad</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Integração com Nova Player e VLC</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Aplicativo ultraleve (3.6 MB)</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                <a
                  href="/downloads/AuraStream-TV.apk"
                  download
                  className="w-full flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-4 rounded-xl border border-zinc-700 transition-all text-xs"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Baixar APK Android / TV (3.6 MB)</span>
                </a>
                <p className="text-[10px] text-zinc-500 text-center">
                  Instale diretamente na TV via pen drive ou app Downloader
                </p>
              </div>
            </div>

            {/* Stremio & Linux Card */}
            <div className="bg-[#121316] p-6 rounded-3xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                    Multiplataforma
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">Stremio & Linux</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Conecte o catálogo AuraStream ao Stremio ou baixe a versão desktop para Linux.
                </p>
                <div className="mt-4 space-y-1.5 text-xs text-zinc-300">
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Catálogo sincronizado no Stremio</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pacote Linux standalone</span>
                  </p>
                  <p className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Suporte a streams diretos P2P</span>
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
                <a
                  href={stremioUrl}
                  className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-purple-600/30 transition-all text-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Instalar no Stremio (1-Clique)</span>
                </a>
                <a
                  href="/downloads/AuraStream-Linux.tar.gz"
                  download
                  className="w-full flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white py-2 px-3 rounded-xl border border-white/5 text-[11px] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar para Linux (.tar.gz)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-[#0d0e12] border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs uppercase font-bold tracking-wider text-red-500">Perguntas Frequentes</h2>
            <p className="text-3xl font-black text-white mt-2">Dúvidas Comuns</p>
          </div>

          <div className="space-y-3">
            {faqs.map((f, idx) => (
              <div
                key={idx}
                className="bg-[#121316] rounded-2xl border border-white/5 overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-bold text-white hover:text-red-400 transition-colors"
                >
                  <span>{f.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180 text-red-400' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/5 pt-3 animate-fade-in">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 py-10 bg-[#07080a] text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <p className="text-zinc-400 font-semibold">
            AuraStream 4K • Plataforma Universal de Streaming Nativo
          </p>
          <p className="text-zinc-400">
            Criado para reprodução cinematográfica direta no VLC, MPV e Smart TV sem conversão de vídeo.
          </p>
          <div className="pt-2">
            <button
              onClick={onEnterApp}
              className="text-red-400 hover:text-red-300 font-bold hover:underline"
            >
              Acessar Catálogo Web
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
