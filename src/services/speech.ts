// Real-time Voice Recognition (STT), Web Audio Engine & Natural Empathetic Speech Synthesis (TTS)
import { transcribeAudioApi } from './api';

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

export class VoiceAssistantEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private currentBufferSource: AudioBufferSourceNode | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];

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

  // Callbacks
  public onTranscriptCallback?: (transcript: string, isFinal: boolean) => void;
  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onListeningChange?: (isListening: boolean) => void;
  public onErrorCallback?: (error: string) => void;
  public onAudioVolume?: (volume: number) => void;

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
      this.recognition.lang = 'en-US';

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
            // User finished this sentence: commit after short natural pause (400ms)
            this.silenceTimer = setTimeout(() => {
              if (!this.isCommitted && this.latestTranscript.trim().length > 0) {
                this.commitCurrentSpeech();
              }
            }, 400);
          } else {
            // Interim continuous speech: auto-commit after 850ms of quiet pause
            this.silenceTimer = setTimeout(() => {
              if (!this.isCommitted && this.latestTranscript.trim().length > 1) {
                this.commitCurrentSpeech();
              }
            }, 850);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        if (event.error === 'no-speech') {
          // Normal silence, keep listening
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
          this.isListening = false;
          this.onListeningChange?.(false);
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
    clearTimeout(this.silenceTimer);

    // Prefer native Web Speech Recognition for instantaneous zero-latency streaming
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
          return;
        }

        try {
          this.onTranscriptCallback?.('Transcribing your voice with Gemini...', false);
          const base64 = await blobToBase64(recordedBlob);
          const result = await transcribeAudioApi(base64, recordedBlob.type);
          if (result && result.text && result.text.trim()) {
            this.onTranscriptCallback?.(result.text.trim(), true);
          } else {
            this.onTranscriptCallback?.('', false);
          }
        } catch (transcribeErr: any) {
          console.warn('Gemini audio transcription error:', transcribeErr);
          this.onErrorCallback?.('Failed to transcribe voice. Please try again or type.');
        }
      };

      recorder.start(250);
      return true;
    } catch (err: any) {
      console.warn('getUserMedia mic error:', err);
      this.isListening = false;
      this.onListeningChange?.(false);
      this.onErrorCallback?.('Microphone permission denied or device busy');
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
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  public stopListening() {
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
        this.onSpeakingChange?.(true);

        source.onended = () => {
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

      audio.onplay = () => this.onSpeakingChange?.(true);
      audio.onended = () => {
        this.onSpeakingChange?.(false);
        this.currentAudioElement = null;
        URL.revokeObjectURL(blobUrl);
        onEnd?.();
      };
      audio.onerror = () => {
        this.onSpeakingChange?.(false);
        this.currentAudioElement = null;
        URL.revokeObjectURL(blobUrl);
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

    // 1. If high-fidelity Gemini 3.8 TTS audio was provided, play it
    if (options.audioBase64) {
      this.playAudioBase64(options.audioBase64, options.onEnd).then((success) => {
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
      options.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = options.pitch ?? 1.04;
    utterance.rate = options.rate ?? 1.0;

    // Pick best English voice available
    const voices = this.cachedVoices.length > 0 ? this.cachedVoices : this.synth.getVoices();
    const preferredVoice =
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

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    let hasEnded = false;
    const finish = () => {
      if (hasEnded) return;
      hasEnded = true;
      this.onSpeakingChange?.(false);
      this.currentUtterance = null;
      if (typeof window !== 'undefined') {
        window.__activeAuroUtterance = null;
      }
      options.onEnd?.();
    };

    // Watchdog to prevent Chrome from stalling utterances
    const maxDuration = Math.max(3000, cleanText.length * 90);
    const watchdogTimer = setTimeout(() => {
      if (!hasEnded && this.synth) {
        if (this.synth.speaking) {
          try {
            this.synth.pause();
            this.synth.resume();
          } catch (e) {}
        } else {
          finish();
        }
      }
    }, maxDuration);

    const safeFinish = () => {
      clearTimeout(watchdogTimer);
      finish();
    };

    utterance.onstart = () => {
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
