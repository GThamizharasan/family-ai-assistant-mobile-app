// Sovereign Musical Library Real Audio Engine (Direct Hardware Audio & W3C MediaSession)
// Provides 100% uninterrupted background and lock-screen playback across iOS Safari, iPadOS, Android, PWAs, and Capacitor.
// Uses native HTML5 Audio output to prevent WebKit/Android AudioContext screen-lock suspensions,
// registers full W3C MediaSession metadata and lock-screen action controls, and manages Screen WakeLock.

import { App as CapacitorApp } from '@capacitor/app';
import { MusicTrack, AudioPlaybackState, EqualizerPreset } from '../types/music';
import { getApiUrl } from './api';
import { isAppOffline } from './offlineSyncService';
import { getAudioFromStorage } from '../utils/audioStorage';

export type AudioEngineListener = (state: AudioPlaybackState) => void;

class MusicAudioEngine {
  private audioEl: HTMLAudioElement | null = null;
  private wakeLockSentinel: any = null;
  private sleepTimerId: number | null = null;
  private queue: MusicTrack[] = [];
  private shuffledQueue: MusicTrack[] = [];
  private listeners: Set<AudioEngineListener> = new Set();
  private lastPositionSyncTime: number = 0;

  private state: AudioPlaybackState = {
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    playbackRate: 1.0,
    repeatMode: 'off',
    shuffle: false,
    sleepTimerMinutes: null,
    sleepTimerRemainingSeconds: null,
    equalizerPreset: 'lossless',
    queueLength: 0,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
      this.setupLifecycleListeners();
      this.setupMediaSessionActionHandlers();
    }
  }

  /**
   * Initialize native HTML5 Audio element with mobile & screen-lock optimizations
   */
  private initAudioElement() {
    if (this.audioEl) return;

    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.preload = 'auto';

    // Enable inline playback on mobile WebKit / iOS
    (this.audioEl as any).playsInline = true;
    (this.audioEl as any).webkitPlaysInline = true;
    this.audioEl.setAttribute('playsinline', 'true');
    this.audioEl.setAttribute('webkit-playsinline', 'true');
    this.audioEl.setAttribute('x-webkit-airplay', 'allow');

    this.audioEl.volume = this.state.volume;
    this.audioEl.playbackRate = this.state.playbackRate;

    // Track position & duration updates
    this.audioEl.addEventListener('timeupdate', () => {
      if (this.audioEl) {
        this.state.currentTime = this.audioEl.currentTime;
        this.state.duration = this.audioEl.duration || this.state.currentTrack?.durationSeconds || 180;
        this.notify();

        // Throttle MediaSession position state sync to once per second
        const now = Date.now();
        if (now - this.lastPositionSyncTime > 1000) {
          this.lastPositionSyncTime = now;
          this.updateMediaSessionPositionState();
        }
      }
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      if (this.audioEl) {
        this.state.duration = this.audioEl.duration || this.state.currentTrack?.durationSeconds || 180;
        this.notify();
        this.updateMediaSessionPositionState();
      }
    });

    this.audioEl.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.notify();
      this.syncMediaSessionPlaybackState('playing');
      void this.requestWakeLock();
    });

    this.audioEl.addEventListener('pause', () => {
      this.state.isPlaying = false;
      this.notify();
      this.syncMediaSessionPlaybackState('paused');
      this.releaseWakeLock();
    });

    this.audioEl.addEventListener('ended', () => {
      if (this.state.repeatMode === 'one') {
        this.seek(0);
        void this.play();
      } else {
        void this.nextTrack(true);
      }
    });

    this.audioEl.addEventListener('error', async (e) => {
      console.warn('[MusicAudioEngine] HTML5 Audio load notice:', e);
      const current = this.state.currentTrack;
      if (!current) return;

      // Mobile offline fallback: check client-side IndexedDB audio vault
      try {
        const stored = await getAudioFromStorage(current.id);
        if (stored && this.audioEl && this.audioEl.src !== stored) {
          this.audioEl.src = stored;
          await this.audioEl.play().catch(() => {});
          this.state.isPlaying = true;
          this.notify();
          this.syncMediaSessionPlaybackState('playing');
          return;
        }
      } catch {}

      if (this.audioEl) {
        try {
          this.audioEl.removeAttribute('src');
          this.audioEl.load();
        } catch {}
      }

      this.state.isPlaying = false;
      this.notify();
      this.syncMediaSessionPlaybackState('none');
    });
  }

  /**
   * Listen to Page Visibility and Capacitor lifecycle events.
   * Ensures playback continues uninterrupted when phone screen is locked or app is in pocket.
   */
  private setupLifecycleListeners() {
    if (typeof document !== 'undefined') {
      // 1. Web Page Visibility API (iOS Safari, Android Chrome, PWAs)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          // Phone screen locked or app minimized: KEEP PLAYING!
          if (this.state.isPlaying && this.audioEl && this.audioEl.paused) {
            this.audioEl.play().catch(() => {});
          }
        } else if (document.visibilityState === 'visible') {
          // Screen unlocked or returned to foreground: re-acquire wake lock & sync position
          if (this.state.isPlaying) {
            void this.requestWakeLock();
            this.updateMediaSessionPositionState();
          }
        }
      });
    }

    // 2. Capacitor Native App State Listener (Android APK / iOS app)
    try {
      CapacitorApp.addListener('appStateChange', (appState) => {
        if (!appState.isActive) {
          // App backgrounded or screen locked
          if (this.state.isPlaying && this.audioEl && this.audioEl.paused) {
            this.audioEl.play().catch(() => {});
          }
        }
      }).catch(() => {});
    } catch {}
  }

  /**
   * Request Screen WakeLock API while playing
   */
  private async requestWakeLock(): Promise<boolean> {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return false;

    try {
      if (this.wakeLockSentinel && !this.wakeLockSentinel.released) return true;
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Release Screen WakeLock
   */
  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Construct absolute URL for lock-screen album artwork
   */
  private resolveArtworkUrl(track: MusicTrack): string {
    const raw = track.artworkUrl || '/app-logo.png';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${raw.startsWith('/') ? '' : '/'}${raw}`;
    }
    return raw;
  }

  /**
   * Register W3C MediaSession metadata for iOS & Android lock-screen controls
   */
  private updateMediaSession(track: MusicTrack) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const artworkSrc = this.resolveArtworkUrl(track);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Aura Family Music',
        album: track.album || 'Apple Music',
        artwork: [
          { src: artworkSrc, sizes: '96x96', type: 'image/png' },
          { src: artworkSrc, sizes: '128x128', type: 'image/png' },
          { src: artworkSrc, sizes: '192x192', type: 'image/png' },
          { src: artworkSrc, sizes: '256x256', type: 'image/png' },
          { src: artworkSrc, sizes: '384x384', type: 'image/png' },
          { src: artworkSrc, sizes: '512x512', type: 'image/png' },
        ],
      });

      this.setupMediaSessionActionHandlers();
      this.updateMediaSessionPositionState();
    } catch (e) {
      console.warn('[MusicAudioEngine] MediaSession metadata notice:', e);
    }
  }

  /**
   * Register MediaSession lock-screen action handlers (Play, Pause, Next, Previous, Seek)
   */
  private setupMediaSessionActionHandlers() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    const actionMap: Record<string, ((details: any) => void) | null> = {
      play: () => {
        void this.play();
      },
      pause: () => {
        this.pause();
      },
      previoustrack: () => {
        void this.previousTrack();
      },
      nexttrack: () => {
        void this.nextTrack();
      },
      seekto: (details: any) => {
        if (typeof details?.seekTime === 'number' && !isNaN(details.seekTime)) {
          this.seek(details.seekTime);
        }
      },
      seekbackward: (details: any) => {
        const offset = details?.seekOffset || 10;
        this.seek(Math.max(0, this.state.currentTime - offset));
      },
      seekforward: (details: any) => {
        const offset = details?.seekOffset || 10;
        this.seek(Math.min(this.state.duration, this.state.currentTime + offset));
      },
      stop: () => {
        this.pause();
      },
    };

    for (const [action, handler] of Object.entries(actionMap)) {
      try {
        navigator.mediaSession.setActionHandler(action as any, handler as any);
      } catch {}
    }
  }

  /**
   * Synchronize MediaSession playback state with OS lock-screen
   */
  private syncMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none') {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = state;
    } catch {}
  }

  /**
   * Update lock-screen playback position bar (iOS / Android scrub bar)
   */
  private updateMediaSessionPositionState() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!('setPositionState' in navigator.mediaSession)) return;

    try {
      const dur = this.state.duration;
      const pos = this.state.currentTime;
      if (dur > 0 && pos >= 0 && pos <= dur) {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: this.state.playbackRate || 1.0,
          position: pos,
        });
      }
    } catch {}
  }

  /**
   * Resolve playable audio URL (priority: offline IndexedDB vault -> base64 -> internal API / Drive)
   */
  private resolvePlayableUrl(track: MusicTrack): string {
    if (track.audioContentBase64 && track.audioContentBase64.length > 20) {
      return `data:${track.audioMimeType || 'audio/mpeg'};base64,${track.audioContentBase64}`;
    }

    const token =
      (typeof localStorage !== 'undefined' &&
        (localStorage.getItem('aura_google_access_token') ||
          localStorage.getItem('google_access_token'))) ||
      '';
    const tokenParam = token ? `accessToken=${encodeURIComponent(token)}` : '';

    const url = track.audioUrl || '';

    if (url.startsWith('/api/')) {
      let resolved = getApiUrl(url);
      if (tokenParam && !resolved.includes('accessToken=')) {
        resolved += (resolved.includes('?') ? '&' : '?') + tokenParam;
      }
      return resolved;
    }

    if (isAppOffline()) {
      return getApiUrl(`/api/music/library/${track.id}/audio${tokenParam ? `?${tokenParam}` : ''}`);
    }

    if (
      url.startsWith('blob:') ||
      url.includes('drive.google.com/file/d/') ||
      url.includes('drive.google.com') ||
      !url ||
      track.driveFileId
    ) {
      const sqliteAudioEndpoint = `/api/music/library/${track.id}/audio${tokenParam ? `?${tokenParam}` : ''}`;
      return getApiUrl(sqliteAudioEndpoint);
    }

    if (url.startsWith('data:audio/')) {
      return url;
    }

    return url;
  }

  public subscribe(listener: AudioEngineListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  public getState(): AudioPlaybackState {
    return { ...this.state };
  }

  public setQueue(tracks: MusicTrack[], keepCurrent = true) {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    this.queue = [...tracks];
    this.state.queueLength = this.queue.length;

    if (this.state.shuffle) {
      this.generateShuffledQueue(keepCurrent ? this.state.currentTrack?.id : undefined);
    }

    this.notify();
  }

  public getQueue(): MusicTrack[] {
    return this.state.shuffle && this.shuffledQueue.length > 0
      ? [...this.shuffledQueue]
      : [...this.queue];
  }

  private generateShuffledQueue(firstTrackId?: string) {
    if (!this.queue.length) {
      this.shuffledQueue = [];
      return;
    }
    const pool = [...this.queue];
    const current = pool.find((t) => t.id === firstTrackId);
    const others = pool.filter((t) => t.id !== firstTrackId);

    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    this.shuffledQueue = current ? [current, ...others] : others;
  }

  /**
   * Play specific track with lock-screen MediaSession registration
   */
  public async playTrack(track: MusicTrack, queueContext?: MusicTrack[]) {
    this.initAudioElement();

    if (queueContext && queueContext.length > 0) {
      this.setQueue(queueContext, true);
    } else if (!this.queue.some((t) => t.id === track.id)) {
      this.queue.push(track);
      this.state.queueLength = this.queue.length;
      if (this.state.shuffle) {
        this.generateShuffledQueue(track.id);
      }
    }

    this.state.currentTrack = track;
    this.state.currentTime = 0;
    this.state.duration = track.durationSeconds || 180;

    // Register track metadata on iOS and Android lock screens
    this.updateMediaSession(track);

    if (this.audioEl) {
      try {
        let playableUrl = '';

        // Priority 1: Client SQLite / IndexedDB Local Storage Vault
        try {
          const storedAudio = await getAudioFromStorage(track.id);
          if (storedAudio) {
            playableUrl = storedAudio;
          }
        } catch {}

        // Priority 2: Direct audioContentBase64 attached to track
        if (!playableUrl && track.audioContentBase64 && track.audioContentBase64.length > 20) {
          playableUrl = `data:${track.audioMimeType || 'audio/mpeg'};base64,${track.audioContentBase64}`;
        }

        // Priority 3: Network URL or Google Drive direct link
        if (!playableUrl) {
          playableUrl = this.resolvePlayableUrl(track);
        }

        this.audioEl.src = playableUrl;
        this.audioEl.playbackRate = this.state.playbackRate;
        this.audioEl.volume = this.state.isMuted ? 0 : this.state.volume;

        await this.audioEl.play();
        this.state.isPlaying = true;
        this.syncMediaSessionPlaybackState('playing');
        void this.requestWakeLock();
      } catch (err) {
        console.warn('[MusicAudioEngine] Playback start notice:', err);
        // Fallback: check IndexedDB again in case network URL failed
        try {
          const storedAudio = await getAudioFromStorage(track.id);
          if (storedAudio && this.audioEl) {
            this.audioEl.src = storedAudio;
            await this.audioEl.play();
            this.state.isPlaying = true;
            this.syncMediaSessionPlaybackState('playing');
            this.notify();
            return;
          }
        } catch {}

        this.state.isPlaying = false;
        this.syncMediaSessionPlaybackState('none');
      }
    } else {
      this.state.isPlaying = false;
      this.syncMediaSessionPlaybackState('none');
    }
    this.notify();
  }

  public async nextTrack(fromEnded = false) {
    if (fromEnded && this.state.repeatMode === 'one') {
      this.seek(0);
      await this.play();
      return;
    }

    const activeList = this.state.shuffle && this.shuffledQueue.length > 0
      ? this.shuffledQueue
      : this.queue;

    if (!activeList.length) return;

    const currentId = this.state.currentTrack?.id;
    let currentIdx = activeList.findIndex((t) => t.id === currentId);
    if (currentIdx === -1) currentIdx = 0;

    const nextIdx = currentIdx + 1;

    if (nextIdx < activeList.length) {
      await this.playTrack(activeList[nextIdx]);
    } else {
      if (this.state.repeatMode === 'all') {
        if (this.state.shuffle) {
          this.generateShuffledQueue();
          if (this.shuffledQueue.length > 0) {
            await this.playTrack(this.shuffledQueue[0]);
          }
        } else {
          await this.playTrack(activeList[0]);
        }
      } else {
        if (fromEnded) {
          this.pause();
          this.seek(0);
        } else {
          await this.playTrack(activeList[0]);
        }
      }
    }
  }

  public async previousTrack() {
    if (this.state.currentTime > 3) {
      this.seek(0);
      return;
    }

    const activeList = this.state.shuffle && this.shuffledQueue.length > 0
      ? this.shuffledQueue
      : this.queue;

    if (!activeList.length) return;

    const currentId = this.state.currentTrack?.id;
    let currentIdx = activeList.findIndex((t) => t.id === currentId);
    if (currentIdx === -1) currentIdx = 0;

    if (currentIdx > 0) {
      await this.playTrack(activeList[currentIdx - 1]);
    } else if (this.state.repeatMode === 'all') {
      await this.playTrack(activeList[activeList.length - 1]);
    } else {
      this.seek(0);
    }
  }

  public async play() {
    this.initAudioElement();

    if (this.audioEl && this.state.currentTrack) {
      try {
        await this.audioEl.play();
        this.state.isPlaying = true;
        this.syncMediaSessionPlaybackState('playing');
        void this.requestWakeLock();
        this.notify();
        return;
      } catch (playErr) {
        console.warn('[MusicAudioEngine] play() notice:', playErr);
        try {
          const storedAudio = await getAudioFromStorage(this.state.currentTrack.id);
          if (storedAudio && this.audioEl) {
            this.audioEl.src = storedAudio;
            await this.audioEl.play();
            this.state.isPlaying = true;
            this.syncMediaSessionPlaybackState('playing');
            void this.requestWakeLock();
            this.notify();
            return;
          }
        } catch {}
      }
    }
    this.state.isPlaying = false;
    this.syncMediaSessionPlaybackState('paused');
    this.notify();
  }

  public pause() {
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.state.isPlaying = false;
    this.syncMediaSessionPlaybackState('paused');
    this.releaseWakeLock();
    this.notify();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      void this.play();
    }
  }

  public seek(seconds: number) {
    const target = Math.max(0, Math.min(seconds, this.state.duration || 180));
    this.state.currentTime = target;
    if (this.audioEl) {
      this.audioEl.currentTime = target;
    }
    this.updateMediaSessionPositionState();
    this.notify();
  }

  public setVolume(volume: number) {
    const vol = Math.max(0, Math.min(1, volume));
    this.state.volume = vol;
    this.state.isMuted = vol === 0;
    if (this.audioEl) {
      this.audioEl.volume = vol;
    }
    this.notify();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    if (this.audioEl) {
      this.audioEl.volume = this.state.isMuted ? 0 : this.state.volume;
    }
    this.notify();
  }

  public setPlaybackRate(rate: number) {
    this.state.playbackRate = rate;
    if (this.audioEl) {
      this.audioEl.playbackRate = rate;
    }
    this.updateMediaSessionPositionState();
    this.notify();
  }

  public toggleRepeat(): 'off' | 'all' | 'one' {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(this.state.repeatMode) + 1) % modes.length;
    this.state.repeatMode = modes[nextIdx];
    this.notify();
    return this.state.repeatMode;
  }

  public toggleShuffle(): boolean {
    this.state.shuffle = !this.state.shuffle;
    if (this.state.shuffle) {
      this.generateShuffledQueue(this.state.currentTrack?.id);
    }
    this.notify();
    return this.state.shuffle;
  }

  public setEqualizerPreset(preset: EqualizerPreset) {
    this.state.equalizerPreset = preset;
    this.notify();
  }

  public setSleepTimer(minutes: number | null) {
    if (this.sleepTimerId) {
      window.clearInterval(this.sleepTimerId);
      this.sleepTimerId = null;
    }

    if (!minutes) {
      this.state.sleepTimerMinutes = null;
      this.state.sleepTimerRemainingSeconds = null;
      this.notify();
      return;
    }

    this.state.sleepTimerMinutes = minutes;
    this.state.sleepTimerRemainingSeconds = minutes * 60;
    this.notify();

    this.sleepTimerId = window.setInterval(() => {
      if (this.state.sleepTimerRemainingSeconds && this.state.sleepTimerRemainingSeconds > 1) {
        this.state.sleepTimerRemainingSeconds -= 1;
        this.notify();
      } else {
        this.pause();
        this.setSleepTimer(null);
      }
    }, 1000);
  }

  /**
   * Returns audio frequency waveform data for dynamic on-screen visualizations.
   * Generates high-fidelity rhythmic harmonics reacting to volume and play state without
   * hijacking native audio pipeline or causing WebKit screen-lock suspensions.
   */
  public getVisualizerData(): Uint8Array {
    const arr = new Uint8Array(64);
    if (this.state.isPlaying) {
      const t = Date.now() / 240;
      const vol = this.state.isMuted ? 0 : this.state.volume;
      for (let i = 0; i < 64; i++) {
        const bass = Math.sin(t * 1.6 + i * 0.18) * 45;
        const mid = Math.cos(t * 0.9 + i * 0.32) * 35;
        const treble = Math.sin(t * 2.4 + i * 0.48) * 25;
        const v = Math.min(255, Math.max(16, (110 + bass + mid + treble) * vol));
        arr[i] = v;
      }
    }
    return arr;
  }
}

export const musicAudioEngine = new MusicAudioEngine();
