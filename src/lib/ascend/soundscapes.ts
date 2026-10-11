// Ascend Focus Ambient Sound Engine & Custom Music Player
// Supports Web Audio API synthesis (Binaural Beats, Rain, Stream, Ocean, White/Pink Noise)
// + Custom Audio File Upload (Blob URL) + Custom Web Audio Stream URL.

export type SoundPresetKey =
  | "off"
  | "alpha_binaural"
  | "rain"
  | "stream"
  | "ocean"
  | "pink_noise"
  | "custom_file"
  | "custom_url";

export interface SoundTrackInfo {
  key: SoundPresetKey;
  label: string;
  category: "binaural" | "nature" | "noise" | "custom";
  description: string;
  iconName: string;
}

export const SOUND_PRESETS: SoundTrackInfo[] = [
  {
    key: "alpha_binaural",
    label: "10Hz Alpha Binaural Beats",
    category: "binaural",
    description: "210Hz / 220Hz dual frequency inducing calm, deep focus",
    iconName: "Waves",
  },
  {
    key: "rain",
    label: "Gentle Rain & Storm",
    category: "nature",
    description: "Filtered soothing rain sounds masking background chatter",
    iconName: "CloudRain",
  },
  {
    key: "ocean",
    label: "Ocean Tides",
    category: "nature",
    description: "Rhythmic rolling waves for breath and rhythm pacing",
    iconName: "Compass",
  },
  {
    key: "stream",
    label: "Forest Brook",
    category: "nature",
    description: "Gentle rippling water in a quiet woodland canopy",
    iconName: "Trees",
  },
  {
    key: "pink_noise",
    label: "Deep Pink Noise",
    category: "noise",
    description: "Balanced frequency spectrum proven to enhance cognitive endurance",
    iconName: "Radio",
  },
];

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentKey: SoundPresetKey = "off";
  private isPlaying = false;
  private volume = 0.4;

  // Synthesis nodes
  private noiseSource: AudioBufferSourceNode | null = null;
  private oscLeft: OscillatorNode | null = null;
  private oscRight: OscillatorNode | null = null;
  private lfoNode: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  // Custom audio element
  private customAudio: HTMLAudioElement | null = null;
  private customFileUrl: string | null = null;
  private customStreamUrl: string | null = null;
  private customFileName: string | null = null;

  // Listeners for UI state reactivity
  private listeners: Set<() => void> = new Set();

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (e) {
      console.warn("AudioContext unavailable:", e);
      return null;
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public getState() {
    return {
      currentKey: this.currentKey,
      isPlaying: this.isPlaying,
      volume: this.volume,
      customFileName: this.customFileName,
      customStreamUrl: this.customStreamUrl,
    };
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    if (this.customAudio) {
      this.customAudio.volume = clamped;
    }
    this.notify();
  }

  public setCustomFile(file: File) {
    if (this.customFileUrl) {
      URL.revokeObjectURL(this.customFileUrl);
    }
    this.customFileUrl = URL.createObjectURL(file);
    this.customFileName = file.name;
    this.currentKey = "custom_file";
    if (this.isPlaying) {
      this.play("custom_file");
    } else {
      this.notify();
    }
  }

  public setCustomStreamUrl(url: string) {
    this.customStreamUrl = url;
    this.currentKey = "custom_url";
    if (this.isPlaying) {
      this.play("custom_url");
    } else {
      this.notify();
    }
  }

  public play(key?: SoundPresetKey) {
    const targetKey = key ?? (this.currentKey === "off" ? "alpha_binaural" : this.currentKey);
    this.stopNodes();

    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.currentKey = targetKey;
    this.isPlaying = true;

    // Master gain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    if (targetKey === "alpha_binaural") {
      this.startBinaural(ctx, 210, 220);
    } else if (targetKey === "rain") {
      this.startRain(ctx);
    } else if (targetKey === "stream") {
      this.startStream(ctx);
    } else if (targetKey === "ocean") {
      this.startOcean(ctx);
    } else if (targetKey === "pink_noise") {
      this.startPinkNoise(ctx);
    } else if (targetKey === "custom_file" && this.customFileUrl) {
      this.startCustomAudio(this.customFileUrl);
    } else if (targetKey === "custom_url" && this.customStreamUrl) {
      this.startCustomAudio(this.customStreamUrl);
    } else {
      // Fallback
      this.startBinaural(ctx, 210, 220);
    }

    this.notify();
  }

  public pause() {
    this.stopNodes();
    this.isPlaying = false;
    this.notify();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public selectTrack(key: SoundPresetKey) {
    this.currentKey = key;
    if (key === "off") {
      this.pause();
    } else {
      this.play(key);
    }
  }

  private startBinaural(ctx: AudioContext, leftFreq: number, rightFreq: number) {
    if (!this.masterGain) return;
    const merger = ctx.createChannelMerger(2);

    this.oscLeft = ctx.createOscillator();
    this.oscLeft.type = "sine";
    this.oscLeft.frequency.setValueAtTime(leftFreq, ctx.currentTime);
    this.oscLeft.connect(merger, 0, 0);

    this.oscRight = ctx.createOscillator();
    this.oscRight.type = "sine";
    this.oscRight.frequency.setValueAtTime(rightFreq, ctx.currentTime);
    this.oscRight.connect(merger, 0, 1);

    merger.connect(this.masterGain);
    this.oscLeft.start();
    this.oscRight.start();
  }

  private startRain(ctx: AudioContext) {
    if (!this.masterGain) return;
    const buffer = this.createNoiseBuffer(ctx, 2.5);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter to sound like soft rain
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();
    this.noiseSource = noise;
  }

  private startStream(ctx: AudioContext) {
    if (!this.masterGain) return;
    const buffer = this.createNoiseBuffer(ctx, 2.0);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(650, ctx.currentTime);
    filter.Q.setValueAtTime(2.2, ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();
    this.noiseSource = noise;
  }

  private startOcean(ctx: AudioContext) {
    if (!this.masterGain) return;
    const buffer = this.createNoiseBuffer(ctx, 4.0);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    // LFO for wave swelling
    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.5, ctx.currentTime);

    this.lfoNode = ctx.createOscillator();
    this.lfoNode.type = "sine";
    this.lfoNode.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8 sec wave cycle

    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.setValueAtTime(0.35, ctx.currentTime);

    this.lfoNode.connect(this.lfoGain);
    this.lfoGain.connect(waveGain.gain);

    noise.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.masterGain);

    this.lfoNode.start();
    noise.start();
    this.noiseSource = noise;
  }

  private startPinkNoise(ctx: AudioContext) {
    if (!this.masterGain) return;
    const buffer = this.createNoiseBuffer(ctx, 3.0, "pink");
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.masterGain);
    noise.start();
    this.noiseSource = noise;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number, type: "pink" | "white" = "white") {
    const bufferSize = ctx.sampleRate * seconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === "pink") {
        data[i] = (lastOut + 0.03 * white) / 1.03;
        lastOut = data[i] ?? 0;
      } else {
        data[i] = (lastOut + 0.05 * white) / 1.05;
        lastOut = data[i] ?? 0;
      }
    }
    return buffer;
  }

  private startCustomAudio(src: string) {
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio = null;
    }
    const audio = new Audio();
    audio.src = src;
    audio.loop = true;
    audio.volume = this.volume;
    audio.crossOrigin = "anonymous";
    audio.play().catch(() => {
      // Autoplay permissions or invalid stream
    });
    this.customAudio = audio;
  }

  public playFocusEndChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const vol = Math.max(0.15, this.volume || 0.4);
      // Multi-harmonic Tibetan singing bowl / crystal chime (528Hz Solfeggio, 792Hz, 1056Hz)
      const freqs = [528, 792, 1056, 1584];
      const gains = [0.22, 0.12, 0.07, 0.03];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime((gains[idx] || 0.1) * vol, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 2.9);
      });
    } catch {
      // Audio playback failsafe
    }
  }

  public playBreakEndChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const vol = Math.max(0.15, this.volume || 0.4);
      // Gentle 3-note ascending morning sunrise chime (D5 -> A5 -> D6)
      const notes = [
        { freq: 587.33, start: 0, dur: 0.7 },
        { freq: 880.0, start: 0.16, dur: 0.8 },
        { freq: 1174.66, start: 0.34, dur: 1.8 },
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.18 * vol, now + start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.1);
      });
    } catch {
      // Audio playback failsafe
    }
  }

  public playReminderChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const vol = Math.max(0.18, this.volume || 0.4);
      // Gentle double-harmonic reminder bell (E5 -> B5)
      const bells = [
        { freq: 659.25, start: 0, dur: 0.9 },
        { freq: 987.77, start: 0.22, dur: 1.6 },
      ];

      bells.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.2 * vol, now + start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur + 0.1);
      });
    } catch {
      // Audio playback failsafe
    }
  }

  private stopNodes() {
    try {
      if (this.noiseSource) {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
        this.noiseSource = null;
      }
      if (this.oscLeft) {
        this.oscLeft.stop();
        this.oscLeft.disconnect();
        this.oscLeft = null;
      }
      if (this.oscRight) {
        this.oscRight.stop();
        this.oscRight.disconnect();
        this.oscRight = null;
      }
      if (this.lfoNode) {
        this.lfoNode.stop();
        this.lfoNode.disconnect();
        this.lfoNode = null;
      }
      if (this.customAudio) {
        this.customAudio.pause();
        this.customAudio = null;
      }
    } catch {
      // Clean cleanup
    }
  }
}

export const soundscapeEngine = new SoundscapeEngine();
