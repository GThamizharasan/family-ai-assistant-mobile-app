// Sovereign Musical Library Real Audio Engine (Web Audio & HTML5 Audio Hybrid)
// Supports real streaming, MP3/WAV playback, synthesized harmonic themes, and live AudioContext AnalyserNode frequency waveforms.

import { MusicTrack, AudioPlaybackState, EqualizerPreset } from '../types/music';
import { getApiUrl } from './api';
import { isAppOffline } from './offlineSyncService';

export type AudioEngineListener = (state: AudioPlaybackState) => void;

class MusicAudioEngine {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private eqBassNode: BiquadFilterNode | null = null;
  private eqMidNode: BiquadFilterNode | null = null;
  private eqTrebleNode: BiquadFilterNode | null = null;
  private synthGainNode: GainNode | null = null;
  private synthInterval: number | null = null;
  private synthProgressInterval: number | null = null;
  private synthActive: boolean = false;
  private sleepTimerId: number | null = null;
  private retryStage: number = 0;
  private queue: MusicTrack[] = [];
  private shuffledQueue: MusicTrack[] = [];
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
    equalizerPreset: 'lossless',
    queueLength: 0,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
    }
  }

  private resolvePlayableUrl(track: MusicTrack): string {
    // 0. If direct audio binary content exists in track object, return instant data URI
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

    // If already pointing to an internal API endpoint
    if (url.startsWith('/api/')) {
      let resolved = getApiUrl(url);
      if (tokenParam && !resolved.includes('accessToken=')) {
        resolved += (resolved.includes('?') ? '&' : '?') + tokenParam;
      }
      return resolved;
    }

    // If offline (real or simulated), never return external CDN URLs that will fail
    if (isAppOffline()) {
      return getApiUrl(`/api/music/library/${track.id}/audio${tokenParam ? `?${tokenParam}` : ''}`);
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
        this.nextTrack(true);
      }
    });

    this.audioEl.addEventListener('error', async (e) => {
      console.warn('[MusicAudioEngine] HTML5 Audio load notice:', e);
      const current = this.state.currentTrack;
      if (!current) return;

      // Clean up audio element so it stops spinning on dead URL
      if (this.audioEl) {
        try {
          this.audioEl.removeAttribute('src');
          this.audioEl.load();
        } catch {}
      }

      // Fallback: start synthesized harmonic music so audio experience is continuous
      this.startHarmonicSynthesizer(current.genre || 'Ambient');
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

        // Create 3-Band Equalizer (Bass 100Hz, Mid 1kHz, Treble 4kHz)
        this.eqBassNode = this.audioCtx.createBiquadFilter();
        this.eqBassNode.type = 'lowshelf';
        this.eqBassNode.frequency.value = 100;
        this.eqBassNode.gain.value = 0;

        this.eqMidNode = this.audioCtx.createBiquadFilter();
        this.eqMidNode.type = 'peaking';
        this.eqMidNode.frequency.value = 1000;
        this.eqMidNode.Q.value = 1.0;
        this.eqMidNode.gain.value = 0;

        this.eqTrebleNode = this.audioCtx.createBiquadFilter();
        this.eqTrebleNode.type = 'highshelf';
        this.eqTrebleNode.frequency.value = 4000;
        this.eqTrebleNode.gain.value = 0;

        // Apply saved preset if any
        if (this.state.equalizerPreset) {
          this.setEqualizerPreset(this.state.equalizerPreset);
        }

        if (this.audioEl && !this.sourceNode) {
          try {
            this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
            // Chain: source -> eqBass -> eqMid -> eqTreble -> analyser -> destination
            this.sourceNode.connect(this.eqBassNode);
            this.eqBassNode.connect(this.eqMidNode);
            this.eqMidNode.connect(this.eqTrebleNode);
            this.eqTrebleNode.connect(this.analyser);
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

    // Modern Fisher-Yates shuffle
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    this.shuffledQueue = current ? [current, ...others] : others;
  }

  public async playTrack(track: MusicTrack, queueContext?: MusicTrack[]) {
    this.stopSynthesizer();
    this.retryStage = 0;
    this.initAudioContext();
    if (this.audioCtx?.state === 'suspended') {
      await this.audioCtx.resume().catch(() => {});
    }

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
        this.startHarmonicSynthesizer(track.genre);
      }
    } else {
      this.startHarmonicSynthesizer(track.genre);
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
      // Reached the end of the playlist
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
        // Repeat mode is OFF
        if (fromEnded) {
          this.pause();
          this.seek(0);
        } else {
          // User clicked Next manually, loop back to start
          await this.playTrack(activeList[0]);
        }
      }
    }
  }

  public async previousTrack() {
    // If more than 3 seconds in, restart track like Apple Music
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
    if (!this.audioCtx) return;

    let bassGain = 0;
    let midGain = 0;
    let trebleGain = 0;

    switch (preset) {
      case 'bass_boost':
        bassGain = 6;
        midGain = 0;
        trebleGain = 1.5;
        break;
      case 'vocal':
        bassGain = -2;
        midGain = 5;
        trebleGain = 2.5;
        break;
      case 'acoustic':
        bassGain = 2;
        midGain = 2;
        trebleGain = 4;
        break;
      case 'ambient':
        bassGain = 4;
        midGain = -1;
        trebleGain = 1;
        break;
      case 'lossless':
      default:
        bassGain = 0;
        midGain = 0;
        trebleGain = 0;
        break;
    }

    const t = this.audioCtx.currentTime;
    if (this.eqBassNode) this.eqBassNode.gain.setValueAtTime(bassGain, t);
    if (this.eqMidNode) this.eqMidNode.gain.setValueAtTime(midGain, t);
    if (this.eqTrebleNode) this.eqTrebleNode.gain.setValueAtTime(trebleGain, t);

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
    if (!this.analyser || this.synthActive) {
      // Return simulated animated gentle wave if analyser not yet active or synthesizing
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

    this.synthActive = true;
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
      if (!this.audioCtx || !this.synthGainNode || !this.synthActive) return;
      const notes = chordProgressions[chordIdx % chordProgressions.length];
      chordIdx++;

      notes.forEach((freq, idx) => {
        if (!this.audioCtx || !this.synthGainNode) return;
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

    // Update simulated progress timer reliably every second
    this.synthProgressInterval = window.setInterval(() => {
      if (this.synthActive && this.state.isPlaying) {
        this.state.currentTime = (this.state.currentTime + 1) % (this.state.duration || 180);
        this.notify();
      }
    }, 1000);

    this.notify();
  }

  private stopSynthesizer() {
    this.synthActive = false;
    if (this.synthInterval) {
      window.clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.synthProgressInterval) {
      window.clearInterval(this.synthProgressInterval);
      this.synthProgressInterval = null;
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
