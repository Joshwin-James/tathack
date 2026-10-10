// WebAudio Two-Tone Emergency Siren Synthesizer (No external audio files needed)
class EmergencySirenSynthesizer {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private timerId: any = null;
  private isHighTone = true;
  private muted = false;
  private running = false;

  public unlock(): boolean {
    if (typeof window === "undefined") return false;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return false;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return true;
    } catch (e) {
      console.warn("Could not unlock WebAudio context:", e);
      return false;
    }
  }

  public isUnlocked(): boolean {
    return !!this.ctx && this.ctx.state === "running";
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.gainNode && this.ctx) {
      const targetGain = muted ? 0.0 : 0.18;
      this.gainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public start() {
    if (this.running) return;
    this.unlock();
    if (!this.ctx) return;

    try {
      this.running = true;
      const now = this.ctx.currentTime;

      // Master Gain
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(this.muted ? 0.0 : 0.18, now);

      // Lowpass Filter for smooth horn timbre
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = "lowpass";
      this.filterNode.frequency.setValueAtTime(1800, now);

      // Oscillator
      this.osc = this.ctx.createOscillator();
      this.osc.type = "sawtooth";
      this.osc.frequency.setValueAtTime(960, now); // Tone 1: High (960 Hz)

      this.osc.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.osc.start(now);

      // Alternating 2-tone timer (European / Indian ambulance standard 960Hz / 770Hz)
      this.isHighTone = true;
      this.timerId = setInterval(() => {
        if (!this.osc || !this.ctx || !this.running) return;
        this.isHighTone = !this.isHighTone;
        const targetFreq = this.isHighTone ? 960 : 770;
        const curTime = this.ctx.currentTime;
        this.osc.frequency.cancelScheduledValues(curTime);
        this.osc.frequency.setValueAtTime(targetFreq, curTime);
      }, 550);
    } catch (err) {
      console.warn("Failed to start siren oscillator:", err);
    }
  }

  public stop() {
    this.running = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.osc) {
      try {
        this.osc.stop();
        this.osc.disconnect();
      } catch {
        // ignore
      }
      this.osc = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // ignore
      }
      this.gainNode = null;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }
}

export const sirenAudio = new EmergencySirenSynthesizer();
