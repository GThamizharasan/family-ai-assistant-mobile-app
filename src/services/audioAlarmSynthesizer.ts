// High-Fidelity Web Audio API Sound Synthesizer for Alarms, Timers, and Vision Assistant
// Works completely offline without requiring external audio asset downloads.

import { AlarmSound } from '../types/clock';

class AudioAlarmSynthesizer {
  private ctx: AudioContext | null = null;
  private activeAlarmTimer: NodeJS.Timeout | null = null;
  private isRinging = false;

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play a single alarm sequence pattern based on sound type
   */
  public playAlarmPulse(sound: AlarmSound = 'radar', volume = 0.8) {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      switch (sound) {
        case 'radar': {
          // Radar beep: 2 rising pulses
          [0, 0.15].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now + offset);
            osc.frequency.exponentialRampToValueAtTime(1760, now + offset + 0.1);

            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(volume * 0.7, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.13);
          });
          break;
        }

        case 'gentle': {
          // Gentle Chime: E5, G#5, B5, E6 arpeggio chord
          const freqs = [659.25, 830.61, 987.77, 1318.51];
          freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);

            gain.gain.setValueAtTime(0, now + idx * 0.12);
            gain.gain.linearRampToValueAtTime(volume * 0.4, now + idx * 0.12 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.8);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.85);
          });
          break;
        }

        case 'cosmic': {
          // Cosmic ambient bell with harmonics
          const root = 528; // Solfeggio 528Hz Love/Transformation
          [root, root * 1.5, root * 2].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = idx === 0 ? 'sine' : 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime((volume * 0.5) / (idx + 1), now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 1.25);
          });
          break;
        }

        case 'dawn': {
          // Soothing dawn progression: C5 -> D5 -> G5
          const notes = [523.25, 587.33, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.18);

            gain.gain.setValueAtTime(0, now + idx * 0.18);
            gain.gain.linearRampToValueAtTime(volume * 0.5, now + idx * 0.18 + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.7);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.18);
            osc.stop(now + idx * 0.18 + 0.75);
          });
          break;
        }

        case 'digital':
        default: {
          // Classic Digital 3-beep alarm
          [0, 0.12, 0.24].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(1046.5, now + offset); // C6

            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(volume * 0.35, now + offset + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.09);
          });
          break;
        }
      }
    } catch (e) {
      console.warn('[AudioAlarmSynthesizer] Pulse error:', e);
    }
  }

  /**
   * Start looping an alarm sound continuously until stopped
   */
  public startAlarm(sound: AlarmSound = 'radar', volume = 0.85) {
    if (this.isRinging) return;
    this.isRinging = true;

    // Trigger immediate sound
    this.playAlarmPulse(sound, volume);

    // Haptic vibration pulse if supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch {}
    }

    // Interval to repeat the alarm pattern
    const intervalMs = sound === 'cosmic' || sound === 'gentle' ? 2200 : 1300;
    this.activeAlarmTimer = setInterval(() => {
      if (!this.isRinging) return;
      this.playAlarmPulse(sound, volume);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {}
      }
    }, intervalMs);
  }

  /**
   * Stop ringing alarm
   */
  public stopAlarm() {
    this.isRinging = false;
    if (this.activeAlarmTimer) {
      clearInterval(this.activeAlarmTimer);
      this.activeAlarmTimer = null;
    }
  }

  public getIsRinging(): boolean {
    return this.isRinging;
  }

  /**
   * Play Timer Completion fanfare
   */
  public playTimerFinishAlert() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 triumphant chime

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.14);

        gain.gain.setValueAtTime(0, now + idx * 0.14);
        gain.gain.linearRampToValueAtTime(0.5, now + idx * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.9);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.14);
        osc.stop(now + idx * 0.14 + 0.95);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 600]);
      }
    } catch (e) {
      console.warn('[AudioAlarmSynthesizer] Timer alert error:', e);
    }
  }

  /**
   * Audio Cues for Vision Assistant (obstacle alert, camera shutter, scan chime)
   */
  public playVisionShutterCue() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  public playObstacleAlertCue() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      // High urgency double warning beep
      [0, 0.12].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(950, now + offset);

        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.4, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.09);
      });
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([80, 40, 80]);
      }
    } catch {}
  }

  public playVisionReadyCue() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.12);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }
}

export const audioAlarmEngine = new AudioAlarmSynthesizer();
