// Auro Vision Assistant Service for Visually Impaired & Blind Users
// Provides real-time camera spatial orientation, obstacle safety alerts,
// instant text OCR, currency recognition, object finding, and continuous spoken guidance.

import { getApiUrl } from './api';
import { audioAlarmEngine } from './audioAlarmSynthesizer';
import { speechEngine } from './speech';

export type VisionMode = 'describe' | 'text' | 'currency' | 'objects' | 'colors' | 'custom';

export interface VisionAnalysisResult {
  spokenText: string;
  detailedDescription: string;
  safetyAlerts: string[];
  detectedText: string | null;
  currencyDetected: string | null;
  detectedObjects: string[];
  safeToStep: boolean;
  modelUsed?: string;
  timestamp: string;
}

export class VisionAssistEngine {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private continuousTimer: NodeJS.Timeout | null = null;
  private isAnalyzing = false;
  private isTorchOn = false;

  /**
   * Start camera stream
   */
  public async startCamera(
    videoEl: HTMLVideoElement,
    facingMode: 'environment' | 'user' = 'environment'
  ): Promise<boolean> {
    this.stopCamera();
    this.videoElement = videoEl;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = this.mediaStream;
      await videoEl.play();
      return true;
    } catch (err) {
      console.warn('[VisionAssist] Camera start failed:', err);
      return false;
    }
  }

  /**
   * Stop camera stream
   */
  public stopCamera() {
    this.stopContinuousGuidance();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
    this.isTorchOn = false;
  }

  /**
   * Toggle Torch / Flashlight if supported by hardware
   */
  public async toggleTorch(): Promise<boolean> {
    if (!this.mediaStream) return false;
    const track = this.mediaStream.getVideoTracks()[0];
    if (!track) return false;

    const capabilities: any = track.getCapabilities?.() || {};
    if (!capabilities.torch) {
      return false;
    }

    try {
      this.isTorchOn = !this.isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: this.isTorchOn }],
      });
      return this.isTorchOn;
    } catch (e) {
      console.warn('Torch toggle error:', e);
      return false;
    }
  }

  public getIsTorchOn(): boolean {
    return this.isTorchOn;
  }

  /**
   * Capture single video frame as base64 JPEG
   */
  public captureFrameBase64(maxWidth = 1024, maxHeight = 768): string | null {
    if (!this.videoElement || this.videoElement.readyState < 2) return null;

    const video = this.videoElement;
    const canvas = document.createElement('canvas');
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;

    // Maintain aspect ratio while bounding size for fast Gemini Vision transmission
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * Analyze the live camera frame with Gemini Vision
   */
  public async analyzeFrame(
    mode: VisionMode = 'describe',
    userPrompt = '',
    language = 'en-US',
    speakResult = true
  ): Promise<VisionAnalysisResult | null> {
    if (this.isAnalyzing) return null;
    this.isAnalyzing = true;

    try {
      const frameBase64 = this.captureFrameBase64();
      if (!frameBase64) {
        throw new Error('Camera feed not ready');
      }

      // Auditory cue to alert the blind user that snapshot was taken
      audioAlarmEngine.playVisionShutterCue();

      const response = await fetch(getApiUrl('/api/ai/vision-assist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: frameBase64,
          mimeType: 'image/jpeg',
          mode,
          userPrompt,
          language,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Vision analysis failed (${response.status}): ${errText}`);
      }

      const data: VisionAnalysisResult = await response.json();

      // If urgent safety alerts are detected, sound urgent obstacle alert chime first
      if (data.safetyAlerts && data.safetyAlerts.length > 0) {
        audioAlarmEngine.playObstacleAlertCue();
      } else {
        audioAlarmEngine.playVisionReadyCue();
      }

      // Speak response aloud to the user
      if (speakResult && data.spokenText) {
        speechEngine.speak(data.spokenText);
      }

      return data;
    } catch (err: any) {
      console.error('[VisionAssist] Error analyzing frame:', err);
      const fallbackMsg = 'Unable to analyze the camera view right now. Please try again.';
      if (speakResult) {
        speechEngine.speak(fallbackMsg);
      }
      return null;
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Start hands-free continuous exploration mode (e.g. scans every 5 seconds)
   */
  public startContinuousGuidance(
    onResult: (result: VisionAnalysisResult) => void,
    intervalMs = 5000,
    mode: VisionMode = 'describe',
    language = 'en-US'
  ) {
    this.stopContinuousGuidance();
    // Immediate first scan
    void this.analyzeFrame(mode, '', language, true).then((res) => {
      if (res) onResult(res);
    });

    this.continuousTimer = setInterval(() => {
      if (this.isAnalyzing) return;
      void this.analyzeFrame(mode, '', language, true).then((res) => {
        if (res) onResult(res);
      });
    }, intervalMs);
  }

  /**
   * Stop continuous exploration mode
   */
  public stopContinuousGuidance() {
    if (this.continuousTimer) {
      clearInterval(this.continuousTimer);
      this.continuousTimer = null;
    }
  }

  public getIsContinuousActive(): boolean {
    return !!this.continuousTimer;
  }

  public getIsAnalyzing(): boolean {
    return this.isAnalyzing;
  }
}

export const visionEngine = new VisionAssistEngine();
