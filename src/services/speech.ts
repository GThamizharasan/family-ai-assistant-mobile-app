// Real-time Voice Recognition (STT), Web Audio Engine & Natural Empathetic Speech Synthesis (TTS)
import { transcribeAudioApi } from './api';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    __activeAuroUtterance?: SpeechSynthesisUtterance | null;
  }
}

export function isIOSChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS && /CriOS/.test(ua);
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function blobToBase64(blob: Blob | null | undefined): Promise<string> {
  if (!blob || !(blob instanceof Blob) || blob.size === 0) {
    return Promise.resolve('');
  }
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result;
        if (typeof res === 'string') {
          const commaIndex = res.indexOf(',');
          resolve(commaIndex !== -1 ? res.slice(commaIndex + 1).trim() : res.trim());
        } else {
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.onabort = () => resolve('');
      reader.readAsDataURL(blob);
    } catch {
      resolve('');
    }
  });
}

export type VoiceLanguage = 'ta-IN' | 'en-US' | 'en-IN' | 'hi-IN';

export const SUPPORTED_VOICE_LANGUAGES = [
  { code: 'ta-IN', label: 'தமிழ் & English (Auto)', flag: '🇮🇳', nativeName: 'தமிழ் / Auto' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸', nativeName: 'English (US)' },
  { code: 'en-IN', label: 'English (India)', flag: '🇮🇳', nativeName: 'Indian English' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '🇮🇳', nativeName: 'हिन्दी' },
] as const;

export class VoiceAssistantEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentBufferSource: AudioBufferSourceNode | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  // Active voice language (defaults to Tamil ta-IN for bilingual Tamil/English flow)
  private currentLanguage: string =
    (typeof window !== 'undefined' && localStorage.getItem('aura_voice_language')) || 'ta-IN';

  // Selected specific Tamil voice URI & tuned audio parameters
  private selectedTamilVoiceURI: string =
    (typeof window !== 'undefined' && localStorage.getItem('aura_tamil_voice_uri')) || '';
  private tamilSpeechRate: number =
    (typeof window !== 'undefined' && parseFloat(localStorage.getItem('aura_tamil_speech_rate') || '0.90')) || 0.90;
  private tamilSpeechPitch: number =
    (typeof window !== 'undefined' && parseFloat(localStorage.getItem('aura_tamil_speech_pitch') || '1.0')) || 1.0;

  // Real-time silence debounce for hands-free natural speaking
  private silenceTimer: any = null;
  private latestTranscript: string = '';
  private isCommitted: boolean = false;

  // Web Audio Context for low-latency decoded playback and visualizer
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isAudioUnlocked: boolean = false;

  // MediaRecorder microphone fallback for iframes/browsers where Web Speech API is blocked
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private vadInterval: any = null;
  private speechDetectedDuringRecord: boolean = false;
  private recordSilenceTimer: any = null;
  private isUsingMediaRecorderFallback: boolean = false;
  private nativeRecognitionSession = 0;
  private isNativeRecognitionActive = false;

  // Continuous conversation loop state
  private isContinuousMode: boolean = true;
  private isSpeakingNow: boolean = false;
  private isThinkingNow: boolean = false;
  private restartTimeout: any = null;
  private consecutiveErrorCount: number = 0;

  // Callbacks
  public onTranscriptCallback?: (transcript: string, isFinal: boolean) => void;
  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onListeningChange?: (isListening: boolean) => void;
  public onErrorCallback?: (error: string) => void;
  public onAudioVolume?: (volume: number) => void;

  public setLanguage(lang: string) {
    this.currentLanguage = lang || 'ta-IN';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('aura_voice_language', this.currentLanguage);
      } catch {}
    }
    if (this.recognition) {
      try {
        this.recognition.lang = this.currentLanguage;
      } catch {}
    }
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  public getTamilVoices(): { uri: string; name: string; lang: string; isDefault: boolean }[] {
    if (!this.synth) return [];
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : this.synth.getVoices();
    return voices
      .filter((v) => {
        const lang = v.lang.toLowerCase().replace('_', '-');
        const name = v.name.toLowerCase();
        return lang.startsWith('ta') || name.includes('tamil') || name.includes('தமிழ்');
      })
      .map((v) => ({
        uri: v.voiceURI,
        name: v.name,
        lang: v.lang,
        isDefault: v.default,
      }));
  }

  public setSelectedTamilVoice(uri: string) {
    this.selectedTamilVoiceURI = uri || '';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('aura_tamil_voice_uri', this.selectedTamilVoiceURI);
      } catch {}
    }
  }

  public getSelectedTamilVoice(): string {
    return this.selectedTamilVoiceURI;
  }

  public setTamilSpeechRate(rate: number) {
    this.tamilSpeechRate = Math.max(0.6, Math.min(1.5, rate));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('aura_tamil_speech_rate', this.tamilSpeechRate.toString());
      } catch {}
    }
  }

  public getTamilSpeechRate(): number {
    return this.tamilSpeechRate;
  }

  public setTamilSpeechPitch(pitch: number) {
    this.tamilSpeechPitch = Math.max(0.6, Math.min(1.5, pitch));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('aura_tamil_speech_pitch', this.tamilSpeechPitch.toString());
      } catch {}
    }
  }

  public getTamilSpeechPitch(): number {
    return this.tamilSpeechPitch;
  }

  public setContinuousMode(enabled: boolean) {
    this.isContinuousMode = enabled;
    if (!enabled) {
      clearTimeout(this.restartTimeout);
    }
  }

  public setThinkingState(isThinking: boolean) {
    this.isThinkingNow = isThinking;
    if (isThinking) {
      clearTimeout(this.restartTimeout);
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeakingNow;
  }

  private scheduleAutoRestart(delayMs = 600) {
    clearTimeout(this.restartTimeout);
    if (!this.isContinuousMode || this.isSpeakingNow || this.isThinkingNow) return;

    this.restartTimeout = setTimeout(() => {
      if (!this.isContinuousMode || this.isSpeakingNow || this.isThinkingNow) return;
      if (Capacitor.isNativePlatform()) {
        void this.startNativeSpeechRecognition();
      } else if (this.recognition && !isIOSChrome()) {
        try {
          this.recognition.start();
        } catch {
          // already started or retry later
        }
      }
    }, delayMs);
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebSpeechRecognition();

      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => {
            this.loadVoices();
          };
        }
      }

      // Proactively unlock audio on user interactions
      const unlockAudio = () => {
        this.unlockAudio();
      };
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  private loadVoices() {
    if (this.synth) {
      try {
        const v = this.synth.getVoices();
        if (v && v.length > 0) {
          this.cachedVoices = v;
        }
      } catch (e) {}
    }
  }

  /**
   * Unlocks both AudioContext and SpeechSynthesis on user gesture
   */
  public async unlockAudio() {
    if (typeof window === 'undefined') return;

    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.isAudioUnlocked = true;
    } catch (e) {
      console.warn('AudioContext unlock notice:', e);
    }

    try {
      if (this.synth) {
        this.synth.resume();
      }
    } catch (e) {}
  }

  private initWebSpeechRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.isCommitted = false;
        this.latestTranscript = '';
        this.onListeningChange?.(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const combined = (finalTranscript + ' ' + interimTranscript).trim();
        if (combined) {
          this.latestTranscript = combined;
          this.onTranscriptCallback?.(combined, false);

          clearTimeout(this.silenceTimer);

          // If Web Speech already produced final finalized sentence segments:
          if (finalTranscript.trim().length > 0 && interimTranscript.trim().length === 0) {
            // User finished this sentence: commit after natural pause (500ms)
            this.silenceTimer = setTimeout(() => {
              if (!this.isCommitted && this.latestTranscript.trim().length > 0) {
                this.commitCurrentSpeech();
              }
            }, 500);
          } else {
            // Interim continuous speech: auto-commit after 1000ms of quiet pause
            this.silenceTimer = setTimeout(() => {
              if (!this.isCommitted && this.latestTranscript.trim().length > 1) {
                this.commitCurrentSpeech();
              }
            }, 1000);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        if (event.error === 'no-speech') {
          // Normal silence, keep listening smoothly
          return;
        }

        // If Web Speech API fails due to iframe permissions or network, trigger MediaRecorder fallback
        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed' ||
          event.error === 'network' ||
          event.error === 'audio-capture'
        ) {
          console.info('Switching to MediaRecorder + Gemini Transcribe fallback for voice input...');
          this.stopWebSpeech();
          this.startMediaRecorderListening().catch((err) => {
            console.warn('Fallback error:', err);
            this.isListening = false;
            this.onListeningChange?.(false);
            this.onErrorCallback?.(event.error);
          });
          return;
        }

        this.isListening = false;
        this.onListeningChange?.(false);
        this.onErrorCallback?.(event.error);
      };

      this.recognition.onend = () => {
        clearTimeout(this.silenceTimer);
        // If there was uncommitted speech when recognition ended, commit it now!
        if (!this.isCommitted && this.latestTranscript.trim().length > 0) {
          this.commitCurrentSpeech();
        } else {
          if (this.isContinuousMode && !this.isSpeakingNow && !this.isThinkingNow) {
            this.scheduleAutoRestart(800);
          } else {
            this.isListening = false;
            this.onListeningChange?.(false);
          }
        }
      };
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      this.recognition = null;
    }
  }

  public isSupported(): boolean {
    return !!(
      this.recognition ||
      (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) ||
      (typeof window !== 'undefined' && 'speechSynthesis' in window)
    );
  }

  public async requestMicPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const permission = await SpeechRecognition.requestPermissions();
        return permission.speechRecognition === 'granted';
      } catch (err) {
        console.warn('Native speech permission request failed:', err);
        return false;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (err) {
        console.warn('Microphone permission request failed or rejected:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Immediately commits the spoken text and triggers the real-time callback
   */
  public commitCurrentSpeech() {
    clearTimeout(this.silenceTimer);
    clearTimeout(this.recordSilenceTimer);

    if (this.isUsingMediaRecorderFallback) {
      this.stopMediaRecorderListening();
      return;
    }

    if (this.latestTranscript.trim()) {
      this.isCommitted = true;
      const textToDeliver = this.latestTranscript.trim();
      this.latestTranscript = '';
      this.stopListening();
      try {
        this.onTranscriptCallback?.(textToDeliver, true);
      } catch (cbErr) {
        console.error('Error invoking onTranscriptCallback:', cbErr);
      }
    }
  }

  public startListening(): boolean {
    this.stopSpeaking();
    this.isCommitted = false;
    this.latestTranscript = '';
    this.consecutiveErrorCount = 0;
    clearTimeout(this.silenceTimer);
    clearTimeout(this.restartTimeout);

    if (Capacitor.isNativePlatform()) {
      void this.startNativeSpeechRecognition();
      return true;
    }

    // Prefer browser speech recognition for immediate, streaming transcripts.
    if (this.recognition && !isIOSChrome()) {
      try {
        this.isUsingMediaRecorderFallback = false;
        this.recognition.start();
        return true;
      } catch (err: any) {
        // If already started or failed, fallback to MediaRecorder
        console.warn('Web Speech start error, trying MediaRecorder fallback:', err);
      }
    }

    // MediaRecorder Fallback with AudioContext VAD
    this.startMediaRecorderListening().catch((err) => {
      console.warn('MediaRecorder voice capture failed:', err);
      this.onErrorCallback?.(err?.message || 'Mic access failed');
    });
    return true;
  }

  private async startNativeSpeechRecognition(): Promise<void> {
    clearTimeout(this.restartTimeout);
    if (this.isSpeakingNow || this.isThinkingNow) return;

    const session = ++this.nativeRecognitionSession;

    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        console.warn('Native speech recognition is unavailable, switching to MediaRecorder voice capture...');
        void this.startMediaRecorderListening();
        return;
      }

      const permission = await SpeechRecognition.requestPermissions();
      if (permission.speechRecognition !== 'granted') {
        this.isContinuousMode = false;
        this.onErrorCallback?.('not-allowed');
        return;
      }
      if (session !== this.nativeRecognitionSession) return;

      if (this.isNativeRecognitionActive) {
        try {
          await SpeechRecognition.stop();
        } catch {}
        await new Promise((r) => setTimeout(r, 120));
      }
      if (session !== this.nativeRecognitionSession) return;

      this.isNativeRecognitionActive = true;
      this.isListening = true;
      this.onListeningChange?.(true);
      this.onTranscriptCallback?.('Listening (speak now)...', false);

      const { matches } = await SpeechRecognition.start({
        language: this.currentLanguage,
        maxResults: 2,
        partialResults: false,
        popup: false,
      });

      if (session !== this.nativeRecognitionSession) return;
      const transcript = matches?.[0]?.trim();
      if (transcript) {
        this.consecutiveErrorCount = 0;
        this.latestTranscript = transcript;
        this.isNativeRecognitionActive = false;
        this.onTranscriptCallback?.(transcript, true);
        return;
      } else {
        // Native recognition ended without matches (silence)
        if (this.isContinuousMode && !this.isSpeakingNow && !this.isThinkingNow) {
          this.isNativeRecognitionActive = false;
          this.consecutiveErrorCount++;
          // Generous human pause so Android AudioRecord session is never thrashed
          const restartDelay = Math.min(2500, 1000 + this.consecutiveErrorCount * 400);
          this.scheduleAutoRestart(restartDelay);
          return;
        } else {
          this.onErrorCallback?.('no-speech');
        }
      }
    } catch (err) {
      if (session !== this.nativeRecognitionSession) return;
      const message = err instanceof Error ? err.message : String(err);
      console.warn('Native speech recognition status/notice:', message);

      if (/permission|denied/i.test(message)) {
        this.isContinuousMode = false;
        this.onErrorCallback?.('not-allowed');
      } else if (/not available|recognition service not/i.test(message)) {
        console.warn('Speech Services by Google not available, falling back to MediaRecorder...');
        void this.startMediaRecorderListening();
      } else if (/no match|no speech|timeout/i.test(message)) {
        // Natural pause/silence from user in hands-free mode -> gentle re-arm without audio glitching
        this.consecutiveErrorCount++;
        if (this.isContinuousMode && !this.isSpeakingNow && !this.isThinkingNow) {
          this.isNativeRecognitionActive = false;
          const restartDelay = Math.min(2500, 1000 + this.consecutiveErrorCount * 400);
          this.scheduleAutoRestart(restartDelay);
          return;
        }
        this.onErrorCallback?.('no-speech');
      } else if (/busy|audio recording/i.test(message)) {
        // Audio focus collision or device busy -> wait for audio focus release and retry
        this.isNativeRecognitionActive = false;
        if (this.isContinuousMode && !this.isSpeakingNow && !this.isThinkingNow) {
          this.consecutiveErrorCount++;
          const retryDelay = Math.min(3000, 1500 + this.consecutiveErrorCount * 500);
          this.scheduleAutoRestart(retryDelay);
          return;
        }
        this.onErrorCallback?.('device-busy');
      } else {
        this.isNativeRecognitionActive = false;
        this.consecutiveErrorCount++;
        if (this.isContinuousMode && !this.isSpeakingNow && !this.isThinkingNow) {
          if (this.consecutiveErrorCount <= 4) {
            const retryDelay = Math.min(2500, 1000 + this.consecutiveErrorCount * 400);
            this.scheduleAutoRestart(retryDelay);
            return;
          } else {
            console.warn('Native speech failed repeatedly, switching to MediaRecorder fallback...');
            void this.startMediaRecorderListening();
            return;
          }
        }
        this.onErrorCallback?.(`Speech recognition notice: ${message}`);
      }
    } finally {
      if (session === this.nativeRecognitionSession && !this.restartTimeout) {
        this.isNativeRecognitionActive = false;
        this.isListening = false;
        this.onListeningChange?.(false);
      }
    }
  }

  private async startMediaRecorderListening(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.onErrorCallback?.('Microphone not supported on this device');
      return false;
    }

    try {
      this.isUsingMediaRecorderFallback = true;
      this.audioChunks = [];
      this.speechDetectedDuringRecord = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      // AudioContext for live volume tracking and visualizer
      try {
        if (!this.audioContext) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) this.audioContext = new AudioCtx();
        }
        if (this.audioContext) {
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }
          const source = this.audioContext.createMediaStreamSource(stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          source.connect(this.analyser);

          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          clearInterval(this.vadInterval);
          this.vadInterval = setInterval(() => {
            if (!this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avgVolume = Math.min(100, Math.round((sum / dataArray.length) * 1.5));
            this.onAudioVolume?.(avgVolume);

            // Voice Activity Detection (VAD)
            if (avgVolume > 15) {
              this.speechDetectedDuringRecord = true;
              clearTimeout(this.recordSilenceTimer);
              // Set timer to auto-stop when silence resumes after speaking
              this.recordSilenceTimer = setTimeout(() => {
                if (this.speechDetectedDuringRecord && this.isListening) {
                  this.stopMediaRecorderListening();
                }
              }, 1100);
            }
          }, 100);
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext volume tracker notice:', audioCtxErr);
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      recorder.onstart = () => {
        this.isListening = true;
        this.onListeningChange?.(true);
        this.onTranscriptCallback?.('Listening (speak now)...', false);
      };

      recorder.onstop = async () => {
        this.isListening = false;
        this.onListeningChange?.(false);
        this.cleanupMediaStream();

        if (this.audioChunks.length === 0) return;
        const recordedBlob = new Blob(this.audioChunks, { type: recorder.mimeType || 'audio/webm' });
        this.audioChunks = [];

        if (recordedBlob.size < 1000) {
          this.onErrorCallback?.('No clear speech was captured. Please try speaking again.');
          return;
        }

        try {
          this.onTranscriptCallback?.('Transcribing your voice with Gemini...', false);
          const base64 = await blobToBase64(recordedBlob);
          const result = await transcribeAudioApi(base64, recordedBlob.type);
          if (result && result.text && result.text.trim()) {
            this.onTranscriptCallback?.(result.text.trim(), true);
          } else {
            this.onErrorCallback?.('No speech was recognized. Please try speaking again.');
          }
        } catch (transcribeErr: any) {
          console.warn('Gemini audio transcription error:', transcribeErr);
          const message =
            transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr);
          this.onErrorCallback?.(`Voice transcription failed: ${message}`);
        }
      };

      recorder.start(250);
      return true;
    } catch (err: any) {
      console.warn('getUserMedia mic error:', err);
      this.isListening = false;
      this.onListeningChange?.(false);
      if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(err?.name)) {
        this.onErrorCallback?.('not-allowed');
      } else if (['NotFoundError', 'DevicesNotFoundError'].includes(err?.name)) {
        this.onErrorCallback?.('audio-capture');
      } else if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(err?.name)) {
        this.onErrorCallback?.('device-busy');
      } else {
        this.onErrorCallback?.(err?.message || 'Microphone capture failed');
      }
      return false;
    }
  }

  private stopWebSpeech() {
    clearTimeout(this.silenceTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  private stopMediaRecorderListening() {
    clearTimeout(this.recordSilenceTimer);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    this.cleanupMediaStream();
  }

  private cleanupMediaStream() {
    clearInterval(this.vadInterval);
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  public stopListening(userInitiated = false) {
    if (userInitiated) {
      this.isContinuousMode = false;
    }
    clearTimeout(this.restartTimeout);
    clearTimeout(this.silenceTimer);
    clearTimeout(this.recordSilenceTimer);

    if (Capacitor.isNativePlatform()) {
      this.nativeRecognitionSession++;
      const wasActive = this.isNativeRecognitionActive;
      this.isNativeRecognitionActive = false;
      this.isListening = false;
      this.onListeningChange?.(false);
      if (wasActive) {
        void SpeechRecognition.stop().catch((err) => {
          console.warn('Unable to stop native speech recognition:', err);
        });
      }
      return;
    }

    clearTimeout(this.silenceTimer);
    clearTimeout(this.recordSilenceTimer);
    this.stopWebSpeech();
    this.stopMediaRecorderListening();
    this.isListening = false;
    this.onListeningChange?.(false);
  }

  /**
   * Decodes and plays base64 WAV audio via Web Audio API AudioContext
   * Returns true on success, false if decoding or playback fails.
   */
  public async playAudioBase64(base64: string, onEnd?: () => void): Promise<boolean> {
    try {
      await this.unlockAudio();
      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Web Audio API decodes WAV PCM cleanly in browser
        const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer.slice(0));
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        this.currentBufferSource = source;
        this.isSpeakingNow = true;
        this.onSpeakingChange?.(true);

        source.onended = () => {
          this.isSpeakingNow = false;
          this.onSpeakingChange?.(false);
          this.currentBufferSource = null;
          onEnd?.();
        };

        source.start(0);
        return true;
      }
    } catch (webAudioErr) {
      console.warn('Web Audio API playback notice, falling back to Blob HTMLAudio:', webAudioErr);
    }

    // HTMLAudioElement Fallback with Blob URL
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);
      this.currentAudioElement = audio;

      audio.onplay = () => {
        this.isSpeakingNow = true;
        this.onSpeakingChange?.(true);
      };
      audio.onended = () => {
        this.isSpeakingNow = false;
        this.onSpeakingChange?.(false);
        this.currentAudioElement = null;
        URL.revokeObjectURL(blobUrl);
        onEnd?.();
      };
      audio.onerror = () => {
        this.isSpeakingNow = false;
        this.onSpeakingChange?.(false);
        this.currentAudioElement = null;
        URL.revokeObjectURL(blobUrl);
        onEnd?.();
      };

      await audio.play();
      return true;
    } catch (htmlAudioErr) {
      console.warn('HTML Audio playback error:', htmlAudioErr);
      return false;
    }
  }

  /**
   * Natural Empathetic Speech Synthesis (TTS)
   * 1. Plays Gemini 3.8 Flash Lite TTS audio if provided via Web Audio API.
   * 2. Seamlessly falls back to resilient browser SpeechSynthesis.
   */
  public speak(
    text: string,
    options: {
      pitch?: number;
      rate?: number;
      emotion?: string;
      audioBase64?: string | null;
      onEnd?: () => void;
    } = {}
  ) {
    this.stopSpeaking();
    // CRITICAL: Stop microphone so AI voice does not feed back into mic and cause glitches/echo
    this.stopListening(false);
    this.isSpeakingNow = true;
    clearTimeout(this.restartTimeout);

    // 1. If high-fidelity Gemini 3.8 TTS audio was provided, play it
    if (options.audioBase64) {
      this.playAudioBase64(options.audioBase64, () => {
        this.isSpeakingNow = false;
        options.onEnd?.();
      }).then((success) => {
        if (!success) {
          this.speakBrowserSynthesis(text, options);
        }
      });
      return;
    }

    // 2. Otherwise, use responsive browser SpeechSynthesis
    this.speakBrowserSynthesis(text, options);
  }

  private speakBrowserSynthesis(
    text: string,
    options: {
      pitch?: number;
      rate?: number;
      onEnd?: () => void;
    } = {}
  ) {
    if (!this.synth) {
      this.isSpeakingNow = false;
      options.onEnd?.();
      return;
    }

    // Clean text of markdown formatting before speaking
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/`{1,3}.*?`{1,3}/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .trim();

    if (!cleanText) {
      this.isSpeakingNow = false;
      options.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Pick best voice: detect if text is Tamil or language is Tamil
    const isTamilText = /[\u0B80-\u0BFF]/.test(cleanText) || this.currentLanguage.startsWith('ta');
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : this.synth.getVoices();

    let preferredVoice: SpeechSynthesisVoice | undefined;
    if (isTamilText) {
      utterance.pitch = options.pitch ?? this.tamilSpeechPitch;
      utterance.rate = options.rate ?? this.tamilSpeechRate;

      // 1. If user selected a specific voice URI in settings, prioritize it
      if (this.selectedTamilVoiceURI) {
        preferredVoice = voices.find((v) => v.voiceURI === this.selectedTamilVoiceURI);
      }

      // 2. Otherwise pick the highest quality natural/Google/neural Tamil voice
      if (!preferredVoice) {
        preferredVoice =
          voices.find((v) => {
            const lang = v.lang.toLowerCase().replace('_', '-');
            const name = v.name.toLowerCase();
            return (
              (lang.startsWith('ta') || name.includes('tamil') || name.includes('தமிழ்')) &&
              (name.includes('natural') || name.includes('neural') || name.includes('google') || name.includes('network') || name.includes('cloud'))
            );
          }) ||
          voices.find((v) => {
            const lang = v.lang.toLowerCase().replace('_', '-');
            const name = v.name.toLowerCase();
            return lang.startsWith('ta') || name.includes('tamil') || name.includes('தமிழ்');
          });
      }
      utterance.lang = preferredVoice?.lang || 'ta-IN';
    } else {
      utterance.pitch = options.pitch ?? 1.04;
      utterance.rate = options.rate ?? 1.0;

      preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Karen') ||
              v.name.includes('Daniel') ||
              v.name.includes('Victoria') ||
              v.name.includes('Serena') ||
              v.name.includes('Ava') ||
              v.name.includes('Zira'))
        ) || voices.find((v) => v.lang.startsWith('en'));
      utterance.lang = preferredVoice?.lang || 'en-US';
    }

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    let hasEnded = false;
    const finish = () => {
      if (hasEnded) return;
      hasEnded = true;
      this.isSpeakingNow = false;
      this.onSpeakingChange?.(false);
      this.currentUtterance = null;
      if (typeof window !== 'undefined') {
        window.__activeAuroUtterance = null;
      }
      options.onEnd?.();
    };

    // Watchdog to prevent Chrome/Android WebView from stalling utterances
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const maxDuration = Math.max(2500, Math.min(30000, wordCount * 500 + 1800));
    const watchdogTimer = setTimeout(() => {
      if (!hasEnded) {
        if (this.synth) {
          try {
            this.synth.cancel();
          } catch (e) {}
        }
        finish();
      }
    }, maxDuration);

    const safeFinish = () => {
      clearTimeout(watchdogTimer);
      finish();
    };

    utterance.onstart = () => {
      this.isSpeakingNow = true;
      this.onSpeakingChange?.(true);
    };

    utterance.onend = safeFinish;
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      safeFinish();
    };

    // Prevent garbage collection in Chromium browsers
    this.currentUtterance = utterance;
    if (typeof window !== 'undefined') {
      window.__activeAuroUtterance = utterance;
    }

    try {
      // In Chrome, avoid immediate cancel() before speak() which triggers cancellation bugs
      if (this.synth.speaking || this.synth.pending) {
        this.synth.cancel();
        setTimeout(() => {
          if (this.synth) {
            this.synth.resume();
            this.synth.speak(utterance);
          }
        }, 50);
      } else {
        this.synth.resume();
        this.synth.speak(utterance);
      }
    } catch (speakErr) {
      console.warn('SpeechSynthesis speak failed:', speakErr);
      safeFinish();
    }
  }

  public testVoiceOutput(onEnd?: () => void) {
    this.unlockAudio();
    const greeting = "Hello Thamizh! My voice channel is active. I am ready to converse in real-time.";
    this.speak(greeting, { onEnd });
  }

  public stopSpeaking() {
    this.isSpeakingNow = false;
    if (this.currentBufferSource) {
      try {
        this.currentBufferSource.stop();
        this.currentBufferSource.disconnect();
      } catch (e) {}
      this.currentBufferSource = null;
    }

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch (e) {}
      this.currentAudioElement = null;
    }

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }
    this.currentUtterance = null;
    this.onSpeakingChange?.(false);
  }
}

export const speechEngine = new VoiceAssistantEngine();
