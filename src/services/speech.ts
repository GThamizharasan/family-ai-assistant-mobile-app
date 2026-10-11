// Real-time Voice Recognition (STT) and Natural Empathetic Speech Synthesis (TTS)

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export class VoiceAssistantEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  public onTranscriptCallback?: (transcript: string, isFinal: boolean) => void;
  public onSpeakingChange?: (isSpeaking: boolean) => void;
  public onListeningChange?: (isListening: boolean) => void;
  public onErrorCallback?: (error: string) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.isListening = true;
          this.onListeningChange?.(true);
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            this.onTranscriptCallback?.(finalTranscript.trim(), true);
          } else if (interimTranscript) {
            this.onTranscriptCallback?.(interimTranscript.trim(), false);
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('Speech recognition status:', event.error);
          this.isListening = false;
          this.onListeningChange?.(false);
          this.onErrorCallback?.(event.error);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          this.onListeningChange?.(false);
        };
      }

      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }
    }
  }

  public isSupported(): boolean {
    return !!(this.recognition || ('speechSynthesis' in window));
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

  public startListening() {
    if (!this.recognition) {
      console.warn('Speech recognition is not supported in this browser environment.');
      return false;
    }
    try {
      this.stopSpeaking();
      this.recognition.start();
      return true;
    } catch (err) {
      console.warn('Speech recognition already started or busy:', err);
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.isListening = false;
      this.onListeningChange?.(false);
    }
  }

  public speak(
    text: string,
    options: {
      pitch?: number;
      rate?: number;
      emotion?: string;
      onEnd?: () => void;
    } = {}
  ) {
    if (!this.synth) {
      options.onEnd?.();
      return;
    }

    this.stopSpeaking();

    // Clean text of markdown formatting before speaking
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/`{1,3}.*?`{1,3}/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = options.pitch ?? 1.05; // Slightly warmer pitch
    utterance.rate = options.rate ?? 0.98; // Natural, measured conversational tempo

    // Attempt to pick a smooth, natural voice
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Daniel') ||
          v.name.includes('Victoria') ||
          v.name.includes('Serena'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      this.onSpeakingChange?.(true);
    };

    utterance.onend = () => {
      this.onSpeakingChange?.(false);
      options.onEnd?.();
    };

    utterance.onerror = () => {
      this.onSpeakingChange?.(false);
      options.onEnd?.();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.onSpeakingChange?.(false);
    }
  }
}

export const speechEngine = new VoiceAssistantEngine();
