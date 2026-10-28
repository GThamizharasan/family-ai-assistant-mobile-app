// Sovereign Musical Library Real Audio Engine (Web Audio & HTML5 Audio Hybrid)
// Supports real streaming, MP3/WAV playback, synthesized harmonic themes, and live AudioContext AnalyserNode frequency waveforms.

import { MusicTrack, AudioPlaybackState } from '../types/music';
import { getApiUrl } from './api';

export type AudioEngineListener = (state: AudioPlaybackState) => void;

class MusicAudioEngine {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private synthGainNode: GainNode | null = null;
  private synthInterval: number | null = null;
  private sleepTimerId: number | null = null;
  private retryStage: number = 0;
  private listeners: Set<AudioEngineListener> = new Set();

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
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
    }
  }

  private resolvePlayableUrl(track: MusicTrack): string {
    const token =
      (typeof localStorage !== 'undefined' &&
        (localStorage.getItem('aura_google_access_token') ||
          localStorage.getItem('google_access_token'))) ||
      '';
    const tokenParam = token ? `accessToken=${encodeURIComponent(token)}` : '';

    const url = track.audioUrl || '';

    // If already pointing to an internal API endpoint
    if (url.startsWith('/api/')) {
      let resolved = getApiUrl(url);
      if (tokenParam && !resolved.includes('accessToken=')) {
        resolved += (resolved.includes('?') ? '&' : '?') + tokenParam;
      }
      return resolved;
    }

    // If it's a blob URL (which is invalid after refresh) or Google Drive link or empty
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

    // If it's a direct data URI (base64)
    if (url.startsWith('data:audio/')) {
      return url;
    }

    // Default: use url, or fallback to SQLite audio endpoint
    return url;
  }

  private initAudioElement() {
    if (this.audioEl) return;
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.volume = this.state.volume;
    this.audioEl.playbackRate = this.state.playbackRate;

    this.audioEl.addEventListener('timeupdate', () => {
      if (this.audioEl) {
        this.state.currentTime = this.audioEl.currentTime;
        this.state.duration = this.audioEl.duration || this.state.currentTrack?.durationSeconds || 180;
        this.notify();
      }
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      if (this.audioEl) {
        this.state.duration = this.audioEl.duration || this.state.currentTrack?.durationSeconds || 180;
        this.notify();
      }
    });

    this.audioEl.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.notify();
    });

    this.audioEl.addEventListener('pause', () => {
      this.state.isPlaying = false;
      this.notify();
    });

    this.audioEl.addEventListener('ended', () => {
      if (this.state.repeatMode === 'one') {
        this.seek(0);
        this.play();
      } else {
        this.state.isPlaying = false;
        this.notify();
      }
    });

    this.audioEl.addEventListener('error', async (e) => {
      console.warn('[MusicAudioEngine] HTML5 Audio load notice:', e);
      const current = this.state.currentTrack;
      if (!current) return;

      // Retry step 1: If current src wasn't the SQLite stream endpoint, switch to it
      if (this.retryStage === 0 && this.audioEl) {
        this.retryStage = 1;
        const token =
          (typeof localStorage !== 'undefined' &&
            (localStorage.getItem('aura_google_access_token') ||
              localStorage.getItem('google_access_token'))) ||
          '';
        const sqliteUrl = getApiUrl(
          `/api/music/library/${current.id}/audio${token ? `?accessToken=${encodeURIComponent(token)}` : ''}`
        );
        if (this.audioEl.src !== sqliteUrl) {
          try {
            console.log('[MusicAudioEngine] Retrying playback with SQLite audio endpoint:', sqliteUrl);
            this.audioEl.src = sqliteUrl;
            await this.audioEl.play();
            return;
          } catch (rErr) {
            console.warn('[MusicAudioEngine] SQLite audio stream retry failed:', rErr);
          }
        }
      }

      // Retry step 2: If external URL exists and failed CORS, try audio proxy
      if (this.retryStage === 1 && current.audioUrl && current.audioUrl.startsWith('http') && this.audioEl) {
        this.retryStage = 2;
        try {
          const proxyUrl = getApiUrl(`/api/audio/proxy?url=${encodeURIComponent(current.audioUrl)}`);
          console.log('[MusicAudioEngine] Retrying playback via audio proxy:', proxyUrl);
          this.audioEl.src = proxyUrl;
          await this.audioEl.play();
          return;
        } catch (pErr) {
          console.warn('[MusicAudioEngine] Audio proxy retry failed:', pErr);
        }
      }

      // Fallback: If remote URL fails or is blocked by CORS/offline, start synthesized harmonic music
      if (this.state.isPlaying) {
        this.startHarmonicSynthesizer(this.state.currentTrack?.genre || 'Ambient');
      }
    });
  }

  private initAudioContext() {
    if (this.audioCtx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.8;

        if (this.audioEl && !this.sourceNode) {
          try {
            this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
            this.sourceNode.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
          } catch (connErr) {
            console.warn('[MusicAudioEngine] MediaElementSource connect notice:', connErr);
          }
        }
      }
    } catch (e) {
      console.warn('[MusicAudioEngine] AudioContext init notice:', e);
    }
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

  public async playTrack(track: MusicTrack) {
    this.stopSynthesizer();
    this.retryStage = 0;
    this.initAudioContext();
    if (this.audioCtx?.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {});
    }

    this.state.currentTrack = track;
    this.state.currentTime = 0;
    this.state.duration = track.durationSeconds || 180;
    this.initAudioElement();

    if (this.audioEl) {
      try {
        const playableUrl = this.resolvePlayableUrl(track);
        this.audioEl.src = playableUrl;
        this.audioEl.playbackRate = this.state.playbackRate;
        this.audioEl.volume = this.state.isMuted ? 0 : this.state.volume;
        await this.audioEl.play();
        this.state.isPlaying = true;
      } catch (err) {
        console.warn('[MusicAudioEngine] Playback start notice:', err);
        // Start harmonic synth playback for smooth listening experience
        this.startHarmonicSynthesizer(track.genre);
      }
    } else {
      this.startHarmonicSynthesizer(track.genre);
    }
    this.notify();
  }

  public async play() {
    this.initAudioContext();
    if (this.audioCtx?.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {});
    }

    if (this.audioEl && this.state.currentTrack) {
      try {
        await this.audioEl.play();
        this.state.isPlaying = true;
        this.notify();
        return;
      } catch {
        this.startHarmonicSynthesizer(this.state.currentTrack.genre);
      }
    }
    if (this.state.currentTrack) {
      this.startHarmonicSynthesizer(this.state.currentTrack.genre);
    }
  }

  public pause() {
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.stopSynthesizer();
    this.state.isPlaying = false;
    this.notify();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(seconds: number) {
    const target = Math.max(0, Math.min(seconds, this.state.duration || 180));
    this.state.currentTime = target;
    if (this.audioEl) {
      this.audioEl.currentTime = target;
    }
    this.notify();
  }

  public setVolume(volume: number) {
    const vol = Math.max(0, Math.min(1, volume));
    this.state.volume = vol;
    this.state.isMuted = vol === 0;
    if (this.audioEl) {
      this.audioEl.volume = vol;
    }
    if (this.synthGainNode && this.audioCtx) {
      this.synthGainNode.gain.setValueAtTime(vol * 0.25, this.audioCtx.currentTime);
    }
    this.notify();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    if (this.audioEl) {
      this.audioEl.volume = this.state.isMuted ? 0 : this.state.volume;
    }
    if (this.synthGainNode && this.audioCtx) {
      this.synthGainNode.gain.setValueAtTime(this.state.isMuted ? 0 : this.state.volume * 0.25, this.audioCtx.currentTime);
    }
    this.notify();
  }

  public setPlaybackRate(rate: number) {
    this.state.playbackRate = rate;
    if (this.audioEl) {
      this.audioEl.playbackRate = rate;
    }
    this.notify();
  }

  public toggleRepeat() {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(this.state.repeatMode) + 1) % modes.length;
    this.state.repeatMode = modes[nextIdx];
    this.notify();
  }

  public toggleShuffle() {
    this.state.shuffle = !this.state.shuffle;
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
        // Time expired: pause audio gracefully
        this.pause();
        this.setSleepTimer(null);
      }
    }, 1000);
  }

  /**
   * Returns current audio frequency data for dynamic waveform visualizations
   */
  public getVisualizerData(): Uint8Array {
    if (!this.analyser) {
      // Return simulated animated gentle wave if analyser not yet active
      const arr = new Uint8Array(64);
      if (this.state.isPlaying) {
        const t = Date.now() / 300;
        for (let i = 0; i < 64; i++) {
          const v = Math.sin(t + i * 0.2) * 50 + Math.cos(t * 0.5 + i * 0.4) * 35 + 110;
          arr[i] = Math.max(30, Math.min(240, v));
        }
      }
      return arr;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // -------------------------------------------------------------
  // Harmonic Musical Synthesizer Fallback (Web Audio API)
  // Generates soothing musical chords (C major / D minor / G maj)
  // -------------------------------------------------------------
  private startHarmonicSynthesizer(genre = 'Ambient') {
    this.stopSynthesizer();
    this.initAudioContext();
    if (!this.audioCtx) return;

    this.state.isPlaying = true;
    this.synthGainNode = this.audioCtx.createGain();
    this.synthGainNode.gain.setValueAtTime(this.state.isMuted ? 0 : this.state.volume * 0.2, this.audioCtx.currentTime);
    if (this.analyser) {
      this.synthGainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    } else {
      this.synthGainNode.connect(this.audioCtx.destination);
    }

    // Chords: C-E-G-B, A-C-E-G, F-A-C-E, G-B-D-F
    const chordProgressions = [
      [261.63, 329.63, 392.0, 493.88], // C maj 7
      [220.0, 261.63, 329.63, 392.0],  // A min 7
      [174.61, 220.0, 261.63, 329.63], // F maj 7
      [196.0, 246.94, 293.66, 349.23], // G 7
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.audioCtx || !this.synthGainNode) return;
      const notes = chordProgressions[chordIdx % chordProgressions.length];
      chordIdx++;

      notes.forEach((freq, idx) => {
        const osc = this.audioCtx!.createOscillator();
        const noteGain = this.audioCtx!.createGain();

        osc.type = genre.includes('Classical') ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx!.currentTime);

        const now = this.audioCtx!.currentTime + idx * 0.15;
        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.08, now + 0.3);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

        osc.connect(noteGain);
        noteGain.connect(this.synthGainNode!);

        osc.start(now);
        osc.stop(now + 3.5);
      });
    };

    playChord();
    this.synthInterval = window.setInterval(playChord, 3500);

    // Update simulated progress timer
    const progressTimer = window.setInterval(() => {
      if (this.state.isPlaying && !this.audioEl?.src) {
        this.state.currentTime = (this.state.currentTime + 1) % (this.state.duration || 180);
        this.notify();
      } else {
        window.clearInterval(progressTimer);
      }
    }, 1000);
  }

  private stopSynthesizer() {
    if (this.synthInterval) {
      window.clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.synthGainNode) {
      try {
        this.synthGainNode.disconnect();
      } catch {}
      this.synthGainNode = null;
    }
  }
}

export const musicAudioEngine = new MusicAudioEngine();
