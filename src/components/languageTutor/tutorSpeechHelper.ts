// Shared bilingual TTS playback & local Capacitor/Web SpeechRecognition capture helper
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { speechEngine } from '../../services/speech';
import { TutorLanguage } from '../../types/languageTutor';

export function speakTutorUtterance(
  text: string,
  options: {
    language: TutorLanguage;
    slow?: boolean;
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  const cleaned = (text || '').trim();
  if (!cleaned) {
    options.onEnd?.();
    return;
  }

  options.onStart?.();
  const baseRate = options.language === 'tamil' ? 0.90 : 0.98;
  const rate = options.slow ? Math.max(0.68, baseRate - 0.2) : baseRate;

  speechEngine.speak(cleaned, {
    rate,
    pitch: options.language === 'tamil' ? 1.02 : 1.04,
    onEnd: () => {
      options.onEnd?.();
    },
  });
}

export interface SpeechCaptureHandle {
  stop: () => void;
}

export async function startTutorSpeechCapture(params: {
  speechLang: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  onNotice: (msg: string | null) => void;
}): Promise<SpeechCaptureHandle> {
  const { speechLang, onInterim, onFinal, onListeningChange, onNotice } = params;
  // Always stop TTS before opening microphone to prevent echo loop
  speechEngine.stopSpeaking();
  onNotice(null);

  let disposed = false;
  let webRec: any = null;
  let nativeRunning = false;
  let latestText = '';

  const stop = () => {
    if (disposed) return;
    disposed = true;
    onListeningChange(false);
    if (webRec) {
      try {
        webRec.stop();
      } catch {}
      webRec = null;
    }
    if (nativeRunning) {
      nativeRunning = false;
      SpeechRecognition.stop().catch(() => {});
      SpeechRecognition.removeAllListeners().catch(() => {});
    }
  };

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== 'granted') {
        onNotice('Microphone permission is needed for live speaking practice.');
        onListeningChange(false);
        return { stop };
      }

      nativeRunning = true;
      onListeningChange(true);
      await SpeechRecognition.removeAllListeners();
      await SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
        if (disposed) return;
        const m = data.matches?.[0];
        if (m) {
          latestText = m;
          onInterim(m);
        }
      });

      const res = await SpeechRecognition.start({
        language: speechLang,
        maxResults: 3,
        partialResults: true,
        popup: false,
      });

      nativeRunning = false;
      onListeningChange(false);
      if (!disposed) {
        const finalText = res?.matches?.[0] || latestText;
        if (finalText && finalText.trim()) {
          onFinal(finalText.trim());
        }
      }
    } catch (err: any) {
      nativeRunning = false;
      onListeningChange(false);
      if (!disposed) {
        onNotice(err?.message || 'Could not start native microphone recognition.');
      }
    }
    return { stop };
  }

  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    onNotice('Live browser Speech Recognition is unavailable here; you can type directly anytime!');
    onListeningChange(false);
    return { stop };
  }

  try {
    webRec = new SpeechRec();
    webRec.lang = speechLang;
    webRec.continuous = false;
    webRec.interimResults = true;

    webRec.onresult = (event: any) => {
      if (disposed) return;
      let interim = '';
      let finalSeg = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalSeg += t + ' ';
        else interim += t;
      }
      if (interim) {
        latestText = interim.trim();
        onInterim(latestText);
      }
      if (finalSeg.trim()) {
        onListeningChange(false);
        onFinal(finalSeg.trim());
      }
    };

    webRec.onerror = (ev: any) => {
      if (disposed) return;
      if (ev.error === 'not-allowed') {
        onNotice('Microphone permission blocked. Allow mic access or type below.');
      } else if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
        onNotice(`Mic notice: ${ev.error}`);
      }
      onListeningChange(false);
    };

    webRec.onend = () => {
      if (!disposed) onListeningChange(false);
    };

    webRec.start();
    onListeningChange(true);
  } catch (err: any) {
    onNotice(err?.message || 'Unable to start speech capture.');
    onListeningChange(false);
  }

  return { stop };
}

