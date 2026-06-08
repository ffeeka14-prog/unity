/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private activeOscillators: Map<number, { osc: OscillatorNode; gain: GainNode }> = new Map();
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    this.init();
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(mute ? 0 : 0.8, this.ctx.currentTime);
    }
  }

  getMuted() {
    return this.isMuted;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playTriggerSound(frequency: number) {
    this.resume();
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.7);
    } catch (e) {}
  }

  playSwitchSound() {
    this.playTriggerSound(330); // Note E4
    setTimeout(() => this.playTriggerSound(392), 80); // Note G4
  }

  playDropSound() {
    const pitches = [180, 150, 120];
    pitches.forEach((f, i) => {
      setTimeout(() => this.playTriggerSound(f), i * 100);
    });
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
