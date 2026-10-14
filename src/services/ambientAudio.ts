// Real Web Audio API ambient sound generator for Apple Books reading environment
// Synthesizes soothing rain, crackling fireplace, gentle cafe murmur, ocean waves, and quiet room white noise

export type SoundscapeType = 'off' | 'rain' | 'fireplace' | 'cafe' | 'waves' | 'library';

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private currentType: SoundscapeType = 'off';
  private gainNode: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private timer: number | null = null;
  private volume: number = 0.35;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentType(): SoundscapeType {
    return this.currentType;
  }

  public stop() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {}
      this.gainNode = null;
    }
    this.currentType = 'off';
  }

  public play(type: SoundscapeType) {
    this.stop();
    if (type === 'off') return;

    this.initContext();
    if (!this.ctx) return;

    this.currentType = type;
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);

    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds looped buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate specific noise curves based on selected soundscape
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'rain') {
        // Pink-ish filtered noise for continuous gentle rain
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      } else if (type === 'fireplace') {
        // Brown noise base with random intermittent pops
        lastOut = (lastOut + 0.015 * white) / 1.015;
        const pop = Math.random() > 0.998 ? (Math.random() * 2 - 1) * 2.5 : 0;
        data[i] = lastOut * 2.8 + pop;
      } else if (type === 'waves') {
        // Modulated brown noise
        lastOut = (lastOut + 0.03 * white) / 1.03;
        const t = i / this.ctx.sampleRate;
        const modulation = Math.sin(t * Math.PI * 0.5) * 0.5 + 0.5;
        data[i] = lastOut * 3.0 * modulation;
      } else {
        // Soft room / library gentle warm noise
        lastOut = (lastOut + 0.01 * white) / 1.01;
        data[i] = lastOut * 2.0;
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Apply lowpass/bandpass filter to shape the tone
    const filter = this.ctx.createBiquadFilter();
    if (type === 'rain') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    } else if (type === 'fireplace') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.2, this.ctx.currentTime);
    } else if (type === 'waves') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    }

    source.connect(filter);
    filter.connect(this.gainNode);
    source.start();
    this.noiseNode = source;
  }
}

export const ambientAudio = new AmbientAudioEngine();
