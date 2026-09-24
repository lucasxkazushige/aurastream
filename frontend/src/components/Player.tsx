import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  Settings,
  Subtitles,
  Loader2,
  Radio,
  Server,
  Cloud,
  CheckCircle2,
  PictureInPicture2,
  Gauge,
  HelpCircle,
  X,
  SkipForward,
  List,
  Headphones,
  Check,
  Languages,
  Tv,
  AlertTriangle,
} from 'lucide-react';
import { StreamSession, MediaItem, Episode, SubtitleTrack, AudioTrackInfo } from '../types';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { desktopService } from '../services/desktop';
import { ExternalPlayerModal } from './ExternalPlayerModal';

interface PlayerProps {
  session: StreamSession;
  media: MediaItem;
  episodeInfo?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  onBack: () => void;
  onSelectNextEpisode?: () => void;
}

export const Player: React.FC<PlayerProps> = ({
  session: initialSession,
  media,
  episodeInfo,
  episodeNumber,
  seasonNumber,
  onBack,
  onSelectNextEpisode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<StreamSession>(initialSession);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [centerAction, setCenterAction] = useState<'play' | 'pause' | 'forward' | 'rewind' | null>(null);
  const [playbackError, setPlaybackError] = useState<{ code: number; message: string } | null>(null);

  // Multi-Audio and Multi-Subtitle states
  const [selectedSubId, setSelectedSubId] = useState<string>('off');
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [selectedAudioId, setSelectedAudioId] = useState<number>(0);
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [nativeEngine, setNativeEngine] = useState<string | null>(null);
  const [nativeStarting, setNativeStarting] = useState(false);
  const [html5Fallback, setHtml5Fallback] = useState(false);
  const [nativeAudio, setNativeAudio] = useState<{ id: number; label: string }[]>([]);
  const [nativeSubs, setNativeSubs] = useState<{ id: number; label: string }[]>([]);
  const hostRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef(false);

  const controlsTimeoutRef = useRef<any>(null);
  const lastMousePosRef = useRef({ x: -1, y: -1 });
  const isHoveringControlsRef = useRef(false);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const showSpeedMenuRef = useRef(showSpeedMenu);
  showSpeedMenuRef.current = showSpeedMenu;
  const showHelpRef = useRef(showHelp);
  showHelpRef.current = showHelp;
  const showSubMenuRef = useRef(showSubMenu);
  showSubMenuRef.current = showSubMenu;
  const showAudioMenuRef = useRef(showAudioMenu);
  showAudioMenuRef.current = showAudioMenu;

  const title = media.title || media.name || session.title;

  // Keep the player isolated from the catalogue and mirror the real fullscreen
  // state instead of guessing after a request (fullscreen transitions are async).
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const syncFullscreenState = () => {
      if (!desktopService.isDesktop()) {
        setIsFullscreen(Boolean(document.fullscreenElement));
      }
    };
    const unsubscribeDesktop = desktopService.onFullscreenChange((enabled) => {
      setIsFullscreen(enabled);
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    });
    document.addEventListener('fullscreenchange', syncFullscreenState);
    void desktopService.isFullscreen().then(setIsFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      unsubscribeDesktop();
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // Poll session status until ready or completed
  useEffect(() => {
    let interval: any = null;

    const pollStatus = async () => {
      try {
        const updated = await api.getStreamStatus(session.infoHash);
        if (updated) {
          setSession(updated);
        }
      } catch (err) {
        // Session might still be spinning up
      }
    };

    if (session.status !== 'completed' && session.status !== 'ready') {
      interval = setInterval(pollStatus, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session.infoHash, session.status]);

  // Compute all available subtitles
  const allSubtitles: SubtitleTrack[] = useMemo(() => {
    if (nativeSubs.length > 0) {
      return nativeSubs.map((t) => ({
        id: String(t.id),
        label: t.label,
        lang: '',
        url: '',
      }));
    }
    return session.subtitles || [];
  }, [nativeSubs, session.subtitles]);

  const allAudioTracks = useMemo(() => {
    if (nativeAudio.length > 0) {
      return nativeAudio.map((t) => ({
        id: t.id,
        label: t.label,
        lang: '',
      }));
    }
    if (session.audioTracks && session.audioTracks.length > 0) {
      return session.audioTracks.map((t) => ({
        id: t.id,
        label: t.label,
        lang: t.language,
      }));
    }
    return [];
  }, [nativeAudio, session.audioTracks]);

  // Auto select default subtitle when subtitles are detected
  useEffect(() => {
    if (allSubtitles.length > 0 && selectedSubId === 'off') {
      const def = allSubtitles.find((s) => s.isDefault);
      if (def) {
        setSelectedSubId(def.id);
      }
    }
  }, [allSubtitles, selectedSubId]);

  // Apply subtitle selection to video textTracks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timer = setTimeout(() => {
      const textTracks = video.textTracks;
      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        const match = allSubtitles.find((s) => s.id === selectedSubId);
        if (selectedSubId === 'off') {
          track.mode = 'disabled';
        } else if (match && track.label === match.label) {
          track.mode = 'showing';
        } else {
          track.mode = 'disabled';
        }
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [selectedSubId, allSubtitles]);

  const streamUrl = session.directStreamUrl
    ? (session.directStreamUrl.startsWith('http') ? session.directStreamUrl : `${window.location.origin}${session.directStreamUrl}`)
    : `${window.location.origin}/api/stream/direct/${session.infoHash}?magnet=${encodeURIComponent(session.magnet)}`;

  const timeRef = useRef({ t: 0, d: 0 });

  const flushProgress = useCallback((t?: number, d?: number) => {
    const cur = typeof t === 'number' && t > 0 ? t : timeRef.current.t;
    const dur = typeof d === 'number' && d > 0 ? d : timeRef.current.d;
    if (dur > 15 && cur > 8) {
      storage.saveProgress({
        media,
        currentTime: cur,
        duration: dur,
        season: seasonNumber,
        episode: episodeNumber,
        episodeInfo,
        infoHash: session.infoHash,
      });
    }
  }, [media, seasonNumber, episodeNumber, episodeInfo, session.infoHash]);

  const handleBack = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    flushProgress();
    if (desktopService.isDesktop()) {
      void desktopService.setFullscreen(false);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    desktopService.stopNativePlayer();
    onBack();
  }, [onBack, flushProgress]);

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  // Desktop: play the original file with an embedded VLC engine (audio tracks + subtitles).
  useEffect(() => {
    if (!desktopService.isDesktop()) return;

    const savedProgress = storage.getItemProgress(media.id, media.mediaType, seasonNumber, episodeNumber);
    const startPosition = savedProgress && savedProgress.currentTime > 10 ? savedProgress.currentTime : 0;
    const prefs = storage.getPreferences();
    let cancelled = false;
    let started = false;
    let unsub: (() => void) | undefined;

    const launch = async () => {
      if (cancelled || started) return;
      started = true;
      setNativeStarting(true);
      setPlaybackError(null);
      const res = await desktopService.startNativePlayer({
        url: streamUrl,
        title: `${title}${episodeInfo ? ` - ${episodeInfo}` : ''}`,
        startTime: startPosition,
        preferAudio: prefs.preferredAudio,
        autoSubs: prefs.autoSubtitles,
      });
      if (cancelled) {
        desktopService.stopNativePlayer();
        return;
      }
      if (!res.success) {
        setNativeEngine(null);
        setNativeStarting(false);
        setHtml5Fallback(true);
        return;
      }
      setNativeEngine(res.engine || 'embed');
      setNativeStarting(false);
      setIsBuffering(false);
      unsub = desktopService.onNativePlayerEvent((ev) => {
        if (!ev || cancelled) return;
        if (ev.type === 'playing') {
          setIsPlaying(true);
          setIsBuffering(false);
        } else if (ev.type === 'paused') {
          setIsPlaying(false);
        } else if (ev.type === 'time') {
          const t = Number(ev.t) || 0;
          const d = Number(ev.d) || 0;
          timeRef.current = { t, d };
          setCurrentTime(t);
          setDuration(d);
          if (ev.playing === true && !isPlayingRef.current) setIsPlaying(true);
          if (d > 15 && Math.floor(t) % 5 === 0) {
            storage.saveProgress({
              media,
              currentTime: t,
              duration: d,
              season: seasonNumber,
              episode: episodeNumber,
              episodeInfo,
              infoHash: session.infoHash,
            });
          }
        } else if (ev.type === 'tracks') {
          const audio = Array.isArray(ev.audio)
            ? ev.audio.map((t: any) => ({ id: Number(t.id), label: String(t.name || `Faixa ${t.id}`) }))
            : [];
          const subs = Array.isArray(ev.subs)
            ? ev.subs.map((t: any) => ({ id: Number(t.id), label: String(t.name || `Legenda ${t.id}`) }))
            : [];
          setNativeAudio(audio);
          setNativeSubs(subs);
          if (ev.audioId !== undefined) setSelectedAudioId(Number(ev.audioId));
          if (ev.subId !== undefined) setSelectedSubId(Number(ev.subId) < 0 ? 'off' : String(ev.subId));
        } else if (ev.type === 'reposition') {
          window.dispatchEvent(new Event('resize'));
        } else if (ev.type === 'closed' || ev.type === 'stopped') {
          flushProgress(Number(ev.t), Number(ev.d));
          handleBackRef.current();
        } else if (ev.type === 'error') {
          setPlaybackError({
            code: 4,
            message: ev.message || 'Falha ao abrir o arquivo original no motor VLC.',
          });
        }
      });
    };

    const tryStart = () => {
      if (cancelled || started) return;
      const ready = session.status === 'ready' || session.status === 'completed' || session.status === 'transcoding';
      if (ready) {
        launch();
      }
    };

    tryStart();
    const interval = setInterval(async () => {
      if (cancelled || started) return;
      try {
        const updated = await api.getStreamStatus(session.infoHash);
        if (updated && (updated.status === 'ready' || updated.status === 'completed' || updated.status === 'transcoding')) {
          await launch();
        }
      } catch {
        tryStart();
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      unsub?.();
      desktopService.stopNativePlayer();
    };
  }, [session.infoHash, session.magnet, media.id, seasonNumber, episodeNumber]);

  useEffect(() => {
    if (!nativeEngine || !desktopService.isDesktop()) return;
    const onWin = () => {
      void desktopService.isFullscreen().then(setIsFullscreen);
      window.requestAnimationFrame(() => {
        const el = hostRef.current;
        if (!el) return;
        const bounds = el.getBoundingClientRect();
        void desktopService.nativeBounds({
          x: Math.round(bounds.left),
          y: Math.round(bounds.top),
          w: Math.max(16, Math.round(bounds.width)),
          h: Math.max(16, Math.round(bounds.height)),
        });
      });
    };
    window.addEventListener('resize', onWin);
    onWin();
    return () => window.removeEventListener('resize', onWin);
  }, [nativeEngine]);

  // Browser / HTML5 fallback (Chromium cannot switch MKV audio/subtitles)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (desktopService.isDesktop() && !html5Fallback) return;

    const savedProgress = storage.getItemProgress(media.id, media.mediaType, seasonNumber, episodeNumber);
    const startPosition = savedProgress && savedProgress.currentTime > 10 ? savedProgress.currentTime : 0;

    setPlaybackError(null);

    if (!video.src || !video.src.includes(`/api/stream/direct/${session.infoHash}`)) {
      video.src = streamUrl;
      video.load();
    }

    const onLoadedMetadata = () => {
      setIsBuffering(false);
      setDuration(video.duration || 0);
      if (startPosition > 0 && Math.abs(video.currentTime - startPosition) > 2) {
        try {
          video.currentTime = startPosition;
        } catch {}
      }
      video.play().catch((err) => {
        console.log('[Direct Player] Autoplay deferred:', err?.message || err);
      });
    };

    const onCanPlay = () => {
      setIsBuffering(false);
    };

    const onWaiting = () => {
      setIsBuffering(true);
    };

    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onError = () => {
      const err = video.error;
      console.warn('[Direct Player] Native video error:', err);
      setPlaybackError({
        code: err?.code || 4,
        message: 'Este formato contém codecs de alta fidelidade (como contêiner MKV ou áudio Dolby AC-3/DTS) transmitidos sem compressão pelo servidor.',
      });
      setIsBuffering(false);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('error', onError);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('error', onError);
    };
  }, [session.infoHash, session.directStreamUrl, media.id, seasonNumber, episodeNumber, html5Fallback]);

  // Controls Visibility Logic
  const hideControls = useCallback(() => {
    if (
      isPlayingRef.current &&
      !isHoveringControlsRef.current &&
      !showSpeedMenuRef.current &&
      !showHelpRef.current &&
      !showSubMenuRef.current &&
      !showAudioMenuRef.current
    ) {
      setShowControls(false);
    }
  }, []);

  const resetControlsTimer = useCallback((delay = 3000) => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      hideControls();
    }, delay);
  }, [hideControls]);

  // When playback state changes: auto-hide if playing, keep visible if paused
  const prevIsPlayingRef = useRef(isPlaying);
  useEffect(() => {
    if (isPlaying !== prevIsPlayingRef.current) {
      prevIsPlayingRef.current = isPlaying;
      if (isPlaying) {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
          hideControls();
        }, 3000);
      } else {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      }
    }
  }, [isPlaying, hideControls]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Handle real mouse movement (ignores synthetic events & sub-pixel jitter)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const last = lastMousePosRef.current;

    // Ignore synthetic mousemove events where the cursor didn't actually move
    // and ignore tiny jitter (< 4 pixels)
    if (last.x !== -1 && Math.abs(clientX - last.x) < 4 && Math.abs(clientY - last.y) < 4) {
      return;
    }

    lastMousePosRef.current = { x: clientX, y: clientY };
    resetControlsTimer(3000);
  }, [resetControlsTimer]);

  const handleMouseLeave = useCallback(() => {
    lastMousePosRef.current = { x: -1, y: -1 };
    isHoveringControlsRef.current = false;
    if (isPlayingRef.current) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        hideControls();
      }, 1000);
    }
  }, [hideControls]);

  // Trigger Center Action Badge
  const triggerCenterAction = (action: 'play' | 'pause' | 'forward' | 'rewind') => {
    setCenterAction(action);
    setTimeout(() => setCenterAction(null), 500);
  };

  const togglePlay = () => {
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'toggle' });
      triggerCenterAction(isPlaying ? 'pause' : 'play');
      return;
    }
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      triggerCenterAction('pause');
    } else {
      videoRef.current.play().catch(() => {});
      triggerCenterAction('play');
    }
  };

  const seek = (seconds: number) => {
    const base = nativeEngine === 'embed' ? currentTime : (videoRef.current?.currentTime || 0);
    const newTime = Math.max(0, Math.min(duration, base + seconds));
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'seek', ms: Math.floor(newTime * 1000) });
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    } else {
      return;
    }
    triggerCenterAction(seconds > 0 ? 'forward' : 'rewind');
    resetControlsTimer();
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'seek', ms: Math.floor(newTime * 1000) });
    } else if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    resetControlsTimer();
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'mute', muted: nextMuted });
    } else if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    } else {
      return;
    }
    setIsMuted(nextMuted);
    resetControlsTimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'volume', value: Math.round(val * 100) });
      desktopService.nativeCommand({ cmd: 'mute', muted: val === 0 });
    } else if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    resetControlsTimer();
  };

  const changeVolume = (delta: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'volume', value: Math.round(nextVolume * 100) });
      desktopService.nativeCommand({ cmd: 'mute', muted: nextVolume === 0 });
    } else if (videoRef.current) {
      videoRef.current.volume = nextVolume;
      videoRef.current.muted = nextVolume === 0;
    }
  };

  const setSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'rate', value: speed });
    } else if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    resetControlsTimer();
  };

  const handleSelectSubtitle = (subId: string) => {
    setSelectedSubId(subId);
    setShowSubMenu(false);
    resetControlsTimer();
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'spu', id: subId === 'off' ? -1 : parseInt(subId, 10) });
    }
  };

  const handleSelectAudio = (trackId: number) => {
    setSelectedAudioId(trackId);
    setShowAudioMenu(false);
    resetControlsTimer();
    if (nativeEngine === 'embed') {
      desktopService.nativeCommand({ cmd: 'audio', id: trackId });
      return;
    }
    const video = videoRef.current as any;
    if (video && video.audioTracks && video.audioTracks.length > 1) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = i === trackId;
      }
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP Error:', err);
    }
  };

  const syncVideoSlot = useCallback(() => {
    const el = hostRef.current;
    if (!el || nativeEngine !== 'embed') return;
    const r = el.getBoundingClientRect();
    desktopService.nativeBounds({
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.max(16, Math.round(r.width)),
      h: Math.max(16, Math.round(r.height)),
    });
  }, [nativeEngine]);

  const toggleFullscreen = async () => {
    resetControlsTimer();
    if (desktopService.isDesktop()) {
      try {
        const on = await desktopService.toggleFullscreen();
        setIsFullscreen(on);
        window.setTimeout(syncVideoSlot, 30);
        window.setTimeout(syncVideoSlot, 120);
        window.setTimeout(syncVideoSlot, 320);
      } catch (err) {
        console.error('Fullscreen desktop error:', err);
      }
      return;
    }
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen({ navigationUI: 'hide' });
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);

    if (videoRef.current.buffered.length > 0) {
      setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }

    // Save playback progress to localStorage every ~5 seconds
    if (Math.floor(curr) % 5 === 0 && dur > 0) {
      storage.saveProgress({
        media,
        currentTime: curr,
        duration: dur,
        season: seasonNumber,
        episode: episodeNumber,
        episodeInfo,
        infoHash: session.infoHash,
      });
    }
  };

  // Keyboard Shortcuts & Smart TV Remote Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetControlsTimer();
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          seek(-10);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          seek(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
        case 's':
        case 'c':
          e.preventDefault();
          setShowSubMenu((prev) => !prev);
          setShowAudioMenu(false);
          setShowSpeedMenu(false);
          break;
        case 'a':
          e.preventDefault();
          setShowAudioMenu((prev) => !prev);
          setShowSubMenu(false);
          setShowSpeedMenu(false);
          break;
        case '?':
          setShowHelp((prev) => !prev);
          break;
        case 'Escape':
        case 'Backspace':
          if (showSubMenu) {
            setShowSubMenu(false);
          } else if (showAudioMenu) {
            setShowAudioMenu(false);
          } else if (showSpeedMenu) {
            setShowSpeedMenu(false);
          } else if (showHelp) {
            setShowHelp(false);
          } else if (isFullscreen || document.fullscreenElement) {
            if (desktopService.isDesktop()) {
              void desktopService.setFullscreen(false).then(() => {
                setIsFullscreen(false);
                window.setTimeout(syncVideoSlot, 80);
              });
            } else {
              document.exitFullscreen().catch(() => {});
              setIsFullscreen(false);
            }
          } else {
            handleBack();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, isMuted, showHelp, showSubMenu, showAudioMenu, showSpeedMenu, handleBack, resetControlsTimer, isFullscreen, nativeEngine, syncVideoSlot]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Hide the HTML controls throughout the native-player handoff. Without this,
  // React and the GDI/VLC chrome can overlap for the first fullscreen frames.
  const nativeUI = (desktopService.isWails() && !html5Fallback) || Boolean(nativeEngine) || nativeStarting;
  const isPreparing = (session.status === 'initializing' || session.status === 'downloading') && !isPlaying && !playbackError && !nativeEngine;
  const bufferPercentage = duration > 0 ? (bufferedEnd / duration) * 100 : 0;
  const currentPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleLaunchExternal = async (playerId = 'vlc') => {
    const streamUrl = `${window.location.origin}/api/stream/direct/${session.infoHash}?magnet=${encodeURIComponent(session.magnet)}`;
    const fullTitle = `${title}${episodeInfo ? ` - ${episodeInfo}` : ''}`;
    const startTime = currentTime > 10 ? currentTime : 0;

    if (desktopService.isDesktop()) {
      const res = await desktopService.launchExternalPlayer(playerId, streamUrl, fullTitle, startTime);
      if (res.success && videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      setShowExternalModal(true);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={() => resetControlsTimer(3000)}
      onMouseLeave={handleMouseLeave}
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden ${
        !showControls && isPlaying ? 'cursor-none' : 'cursor-default'
      }`}
      role="application"
      aria-label={`Reproduzindo ${title}`}
    >
      {/* HTML5 Video Element */}
      <div
        ref={hostRef}
        className="absolute inset-0 bg-black z-0"
      />
      <video
        ref={videoRef}
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => { setIsBuffering(false); setIsPlaying(true); }}
        onPause={() => setIsPlaying(false)}
        className={`w-full h-full object-contain ${nativeEngine === 'embed' ? 'opacity-0 pointer-events-none' : ''}`}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      >
        {allSubtitles.map((sub) => (
          <track
            key={sub.id}
            kind="subtitles"
            label={sub.label}
            srcLang={sub.lang}
            src={sub.url}
            default={selectedSubId === sub.id}
          />
        ))}
      </video>

      {/* Double Tap Seek Gesture Zones (Mobile/Touch) — HTML only; native GDI handles this */}
      {!nativeUI && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-1/4 z-10"
            onDoubleClick={(e) => { e.stopPropagation(); seek(-10); }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/4 z-10"
            onDoubleClick={(e) => { e.stopPropagation(); seek(10); }}
          />
        </>
      )}

      {/* Central Animated Action Badge */}
      {centerAction && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-ping duration-300">
          <div className="w-20 h-20 rounded-full bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl">
            {centerAction === 'play' && <Play className="w-10 h-10 fill-white ml-1" />}
            {centerAction === 'pause' && <Pause className="w-10 h-10 fill-white" />}
            {centerAction === 'forward' && <RotateCw className="w-10 h-10 text-white" />}
            {centerAction === 'rewind' && <RotateCcw className="w-10 h-10 text-white" />}
          </div>
        </div>
      )}

      {/* Codec Error Fallback Overlay */}
      {playbackError && (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
            Formato com Codec Especial (MKV / AC-3)
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-lg mb-6 leading-relaxed">
            O fluxo direto está ativo com <strong className="text-emerald-400">0% de CPU</strong>. Como este vídeo usa contêiner MKV ou áudio Dolby multicanal, você pode continuar assistindo instantaneamente em 1 clique no seu player favorito:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 max-w-md w-full">
            <button
              onClick={() => handleLaunchExternal('vlc')}
              className="flex-1 min-w-[200px] flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-5 rounded-2xl transition-all shadow-lg shadow-red-600/30 active:scale-95 text-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Continuar no VLC</span>
            </button>

            <button
              onClick={() => handleLaunchExternal('mpv')}
              className="flex-1 min-w-[200px] flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 px-5 rounded-2xl transition-all border border-white/10 active:scale-95 text-sm"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Continuar no MPV</span>
            </button>

            <button
              onClick={() => {
                const streamUrl = `${window.location.origin}/api/stream/direct/${session.infoHash}?magnet=${encodeURIComponent(session.magnet)}`;
                window.open(streamUrl, '_blank');
              }}
              className="w-full flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold py-2.5 px-4 rounded-xl transition-all border border-white/5 text-xs"
            >
              <span>Abrir URL Direta no Player do Windows</span>
            </button>

            <button
              onClick={handleBack}
              className="w-full text-zinc-400 hover:text-white text-xs pt-2 underline underline-offset-4"
            >
              Voltar ao Catálogo
            </button>
          </div>
        </div>
      )}

      {/* Preparing Status Overlay */}
      {isPreparing && (
        <div className="absolute inset-0 bg-[#0d0d0d]/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center z-30 space-y-6 animate-fade-in">
          {/* Backdrop preview with blur */}
          {media.backdropPath && (
            <img
              src={media.backdropPath}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover filter blur-3xl opacity-25 scale-110 pointer-events-none"
            />
          )}

          <div className="relative">
            <div className="w-20 h-20 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin shadow-lg shadow-red-600/30" />
            <Radio className="w-8 h-8 text-red-500 absolute inset-0 m-auto animate-pulse" />
          </div>

          <div className="space-y-2 max-w-lg z-10">
            <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
            {episodeInfo && <p className="text-sm font-semibold text-red-400">{episodeInfo}</p>}
            <p className="text-xs sm:text-sm text-zinc-400">
              {session.status === 'initializing' && 'Conectando ao enxame BitTorrent e localizando vídeo direto...'}
              {session.status === 'downloading' && 'Buffer inicializando... sequenciando blocos para reprodução nativa sem conversão'}
              {session.status === 'ready' && 'Pronto! Carregando reprodução nativa em alta resolução...'}
            </p>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono bg-zinc-900/80 border border-white/10 px-5 py-2.5 rounded-2xl backdrop-blur-md z-10 shadow-xl">
            <span className="flex items-center text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
              {session.seeds} seeds
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-300">
              {(session.downloadSpeed / (1024 * 1024)).toFixed(2)} MB/s
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-emerald-400 font-bold">
              0% CPU • Bitstream Original
            </span>
            {session.fileSize && (
              <>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-300">
                  {(session.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Buffering Spinner (during playback) */}
      {isBuffering && !isPreparing && !playbackError && !nativeEngine && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-14 h-14 border-4 border-white/20 border-t-red-600 rounded-full animate-spin shadow-2xl" />
        </div>
      )}

      {/* Top Bar Controls (HTML5 / fallback). Native GDI draws its own Netflix chrome. */}
      <div
        onMouseEnter={() => { isHoveringControlsRef.current = true; resetControlsTimer(60000); }}
        onMouseLeave={() => { isHoveringControlsRef.current = false; resetControlsTimer(2500); }}
        className={`absolute top-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent z-20 flex items-center justify-between transition-opacity duration-300 ${
          nativeUI
            ? 'opacity-0 pointer-events-none'
            : showControls || !isPlaying
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-4">
          <button
            data-focusable="true"
            onClick={handleBack}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md border border-white/10"
            title="Voltar (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white drop-shadow truncate max-w-xs sm:max-w-md md:max-w-lg">
              {title}
            </h1>
            {episodeInfo && (
              <p className="text-xs text-red-400 font-semibold drop-shadow">{episodeInfo}</p>
            )}
          </div>
        </div>

        {/* Status Indicators & Help */}
        <div className="flex items-center space-x-2">
          {session.isR2Cached ? (
            <span className="hidden sm:flex items-center text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">
              <Cloud className="w-3 h-3 mr-1" />
              Cloudflare R2
            </span>
          ) : (
            <span className="hidden sm:flex items-center text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
              <Radio className="w-3 h-3 mr-1 animate-pulse" />
              Bitstream Direto ({session.seeds} seeds)
            </span>
          )}

          <button
            data-focusable="true"
            onClick={() => handleLaunchExternal('vlc')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-2xl bg-purple-600/80 hover:bg-purple-600 text-white transition-all backdrop-blur-md border border-purple-400/30 font-bold text-xs shadow-lg shadow-purple-600/30"
            title="Abrir no VLC / Player do Windows (4K Nativo)"
          >
            <Tv className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">VLC / Windows</span>
          </button>

          <button
            data-focusable="true"
            onClick={() => setShowHelp(true)}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md border border-white/10"
            title="Atalhos do Teclado (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Control Bar (HTML5 / fallback). Native GDI draws its own Netflix chrome. */}
      <div
        onMouseEnter={() => { isHoveringControlsRef.current = true; resetControlsTimer(60000); }}
        onMouseLeave={() => { isHoveringControlsRef.current = false; resetControlsTimer(2500); }}
        className={`absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-20 space-y-3 transition-opacity duration-300 ${
          nativeUI
            ? 'opacity-0 pointer-events-none'
            : showControls || !isPlaying
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Slider */}
        <div className="space-y-1">
          <div
            onClick={handleTimelineClick}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') seek(-10);
              if (event.key === 'ArrowRight') seek(10);
            }}
            role="slider"
            tabIndex={0}
            aria-label="Progresso da reprodução"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            className="player-timeline group relative h-2 hover:h-3 focus:h-3 w-full bg-white/20 rounded-full cursor-pointer transition-all flex items-center outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-black"
          >
            {/* Buffer Progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none transition-all"
              style={{ width: `${bufferPercentage}%` }}
            />
            {/* Playback Progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-red-600 rounded-full pointer-events-none"
              style={{ width: `${currentPercentage}%` }}
            />
            {/* Scrubber Knob */}
            <div
              className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md transform -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform pointer-events-none"
              style={{ left: `${currentPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? `-${formatTime(Math.max(0, duration - currentTime))}` : '00:00'}</span>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          {/* Left Controls: Play, Seek, Episodes, Volume */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            {/* Play / Pause */}
            <button
              data-focusable="true"
              onClick={togglePlay}
              className="p-2 sm:p-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white transition-all shadow-md shadow-red-600/30"
              title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            {/* Seek Back 10s */}
            <button
              data-focusable="true"
              onClick={() => seek(-10)}
              className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors relative"
              title="Voltar 10s (← / J)"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="absolute text-[8px] font-black bottom-1 right-1">10</span>
            </button>

            {/* Seek Forward 10s */}
            <button
              data-focusable="true"
              onClick={() => seek(10)}
              className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors relative"
              title="Avançar 10s (→ / L)"
            >
              <RotateCw className="w-5 h-5" />
              <span className="absolute text-[8px] font-black bottom-1 right-1">10</span>
            </button>

            {/* Next Episode (if series) */}
            {onSelectNextEpisode && (
              <button
                data-focusable="true"
                onClick={onSelectNextEpisode}
                className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors"
                title="Próximo Episódio"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            )}

            {/* Volume */}
            <div className="flex items-center space-x-2 group/volume pl-1">
              <button
                data-focusable="true"
                onClick={toggleMute}
                className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors"
                title="Mudo (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                className="player-volume w-16 sm:w-24 h-1.5 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none focus:ring-2 focus:ring-white/70"
              />
            </div>
          </div>

          {/* Right Controls: Audio Tracks, Subtitles, Speed, PiP, Fullscreen */}
          <div className="flex items-center space-x-1 sm:space-x-2 relative">
            {/* 1. Audio Track Selector Button */}
            <div className="relative">
              <button
                data-focusable="true"
                onClick={() => {
                  setShowAudioMenu(!showAudioMenu);
                  setShowSubMenu(false);
                  setShowSpeedMenu(false);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs font-bold ${
                  showAudioMenu || (session.audioTracks && session.audioTracks.length > 1)
                    ? 'text-red-400 bg-white/5'
                    : 'text-zinc-300'
                }`}
                title="Selecionar Faixa de Áudio (A)"
              >
                <Headphones className="w-4 h-4" />
                <span className="hidden sm:inline">Áudio</span>
                {allAudioTracks.length > 1 && (
                  <span className="bg-red-600/90 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono">
                    {allAudioTracks.length}
                  </span>
                )}
              </button>

              {/* Audio Menu Dropdown */}
              {showAudioMenu && (
                <div className="absolute bottom-12 right-0 bg-[#181818]/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl shadow-2xl p-2 w-64 space-y-1 z-50 animate-scale-up">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10">
                    <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider flex items-center">
                      <Headphones className="w-3.5 h-3.5 mr-1.5 text-red-500" />
                      Faixas de Áudio
                    </span>
                    <button onClick={() => setShowAudioMenu(false)} className="text-zinc-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                    {allAudioTracks.length > 0 ? (
                      allAudioTracks.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => handleSelectAudio(track.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                            selectedAudioId === track.id
                              ? 'bg-red-600 text-white font-bold'
                              : 'text-zinc-300 hover:bg-zinc-800/80'
                          }`}
                        >
                          <span className="truncate pr-2">{track.label}</span>
                          {selectedAudioId === track.id && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-zinc-400">
                        Áudio Principal do Torrent
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Subtitles Selector Button */}
            <div className="relative">
              <button
                data-focusable="true"
                onClick={() => {
                  setShowSubMenu(!showSubMenu);
                  setShowAudioMenu(false);
                  setShowSpeedMenu(false);
                }}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs font-bold ${
                  selectedSubId !== 'off'
                    ? 'text-sky-400 bg-white/5'
                    : 'text-zinc-400'
                }`}
                title="Selecionar Legendas (S / C)"
              >
                <Subtitles className="w-4 h-4" />
                <span className="hidden sm:inline">Legendas</span>
                {allSubtitles.length > 0 && (
                  <span className="bg-sky-600/90 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono">
                    {allSubtitles.length}
                  </span>
                )}
              </button>

              {/* Subtitles Menu Dropdown */}
              {showSubMenu && (
                <div className="absolute bottom-12 right-0 bg-[#181818]/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl shadow-2xl p-2 w-64 space-y-1 z-50 animate-scale-up">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10">
                    <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider flex items-center">
                      <Subtitles className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                      Legendas
                    </span>
                    <button onClick={() => setShowSubMenu(false)} className="text-zinc-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                    {/* Desativadas */}
                    <button
                      onClick={() => handleSelectSubtitle('off')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                        selectedSubId === 'off'
                          ? 'bg-zinc-700 text-white font-bold'
                          : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                      }`}
                    >
                      <span>Desativadas</span>
                      {selectedSubId === 'off' && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>

                    {allSubtitles.length > 0 ? (
                      allSubtitles.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => handleSelectSubtitle(sub.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left ${
                            selectedSubId === sub.id
                              ? 'bg-sky-600 text-white font-bold'
                              : 'text-zinc-300 hover:bg-zinc-800/80'
                          }`}
                        >
                          <span className="truncate pr-2">{sub.label}</span>
                          {selectedSubId === sub.id && <Check className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-zinc-500">
                        Nenhuma legenda no torrent
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Speed Selector Button */}
            <div className="relative">
              <button
                data-focusable="true"
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowAudioMenu(false);
                  setShowSubMenu(false);
                }}
                className="px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white text-xs font-bold font-mono transition-colors"
                title="Velocidade de Reprodução"
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-12 right-0 bg-[#181818]/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl shadow-2xl p-1.5 w-28 space-y-1 z-50">
                  <p className="text-[10px] uppercase font-bold text-zinc-400 px-2 py-1">Velocidade</p>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                        playbackSpeed === s ? 'bg-red-600 text-white font-bold' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Picture in Picture */}
            <button
              data-focusable="true"
              onClick={togglePiP}
              className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors hidden sm:block"
              title="Mini Player / PiP (P)"
            >
              <PictureInPicture2 className="w-5 h-5" />
            </button>

            {/* 5. Fullscreen */}
            <button
              data-focusable="true"
              onClick={toggleFullscreen}
              className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors"
              title={isFullscreen ? 'Sair da Tela Cheia (F)' : 'Tela Cheia (F)'}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Overlay Modal */}
      {showHelp && !nativeUI && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-base flex items-center">
                <HelpCircle className="w-5 h-5 text-red-500 mr-2" />
                Atalhos do Reprodutor & Controle
              </h3>
              <button onClick={() => setShowHelp(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">Espaço / K</strong>: Play / Pause
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">F</strong>: Tela Cheia
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">← / J</strong>: Voltar 10s
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">→ / L</strong>: Avançar 10s
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">A</strong>: Menu de Áudio
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">S / C</strong>: Menu de Legendas
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">↑ / ↓</strong>: Volume
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">M</strong>: Silenciar / Mudo
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">P</strong>: Mini Player (PiP)
              </div>
              <div className="p-2 bg-zinc-900 rounded-xl">
                <strong className="text-red-400">Esc</strong>: Sair do Player
              </div>
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 font-bold rounded-xl text-xs transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* External Player / Smart TV Modal */}
      <ExternalPlayerModal
        isOpen={showExternalModal}
        onClose={() => setShowExternalModal(false)}
        infoHash={session.infoHash}
        magnet={session.magnet}
        title={title}
      />
    </div>
  );
};
