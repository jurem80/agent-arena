/** Shared Arena audio mute / unlock (from production `Zv` / `St`). */

const MUTE_KEY = 'agent-arena-mute-v1';

function lerpToward(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-4 * dt));
}

class ArenaAudio {
  ctx = null;
  master = null;
  engineGain = null;
  engineOsc = null;
  engineNoise = null;
  unlocked = false;
  muted = false;
  engineOn = false;
  lastGun = 0;
  lastEnemy = 0;
  unlockBound = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
    this.bindUnlock();
  }

  get isMuted() {
    return this.muted;
  }

  get isUnlocked() {
    return this.unlocked;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.value = muted ? 0 : 1;
    if (muted) this.stopEngine();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  bindUnlock() {
    if (this.unlockBound) return;
    this.unlockBound = true;
    const unlock = () => {
      this.unlock();
    };
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
  }

  async unlock() {
    if (this.unlocked && this.ctx?.state === 'running') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.unlocked = true;
    } catch {
      /* ignore */
    }
  }

  /** Flyer engine — kept for shared mute API compatibility. */
  updateEngine(on, throttle = 0.55) {
    if (!this.unlocked || this.muted || !this.ctx || !this.master) {
      this.stopEngine();
      return;
    }
    if (!on) {
      this.stopEngine();
      return;
    }
    if (!this.engineOn) this.startEngine();
    if (this.engineGain) {
      const target = 0.04 + throttle * 0.06;
      this.engineGain.gain.value = lerpToward(this.engineGain.gain.value, target, 4, 0.016);
    }
    if (this.engineOsc) this.engineOsc.frequency.value = 72 + throttle * 40;
  }

  startEngine() {
    if (!this.ctx || !this.master || this.engineOn) return;
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.02;
    this.engineGain.connect(this.master);
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 85;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.35;
    this.engineOsc.connect(lp);
    lp.connect(oscGain);
    oscGain.connect(this.engineGain);
    this.engineOsc.start();

    const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    this.engineNoise = ctx.createBufferSource();
    this.engineNoise.buffer = buf;
    this.engineNoise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 180;
    bp.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.25;
    this.engineNoise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(this.engineGain);
    this.engineNoise.start();
    this.engineOn = true;
  }

  stopEngine() {
    if (!this.engineOn) return;
    try {
      this.engineOsc?.stop();
      this.engineNoise?.stop();
    } catch {
      /* ignore */
    }
    this.engineOsc = null;
    this.engineNoise = null;
    this.engineGain = null;
    this.engineOn = false;
  }

  /**
   * @param {'gun'|'bombDrop'|'boom'|'enemyFire'|'hit'|'destroy'|'alert'|'flare'} kind
   */
  play(kind) {
    if (!this.unlocked || this.muted || !this.ctx || !this.master) return;
    const now = performance.now();
    if (kind === 'gun') {
      if (now - this.lastGun < 40) return;
      this.lastGun = now;
      this.noiseBurst(0.035, 1800, 0.12, 0.045);
      this.tone(320, 0.04, 'square', 0.04);
    } else if (kind === 'bombDrop') {
      this.sweep(420, 90, 0.35, 0.12);
    } else if (kind === 'boom') {
      this.noiseBurst(0.22, 400, 0.5, 0.28);
      this.tone(55, 0.35, 'sine', 0.35);
      this.tone(90, 0.2, 'triangle', 0.18);
    } else if (kind === 'enemyFire') {
      if (now - this.lastEnemy < 55) return;
      this.lastEnemy = now;
      this.noiseBurst(0.03, 2400, 0.1, 0.05);
      this.tone(520, 0.05, 'square', 0.035);
    } else if (kind === 'hit') {
      this.noiseBurst(0.08, 900, 0.25, 0.12);
      this.tone(140, 0.12, 'sawtooth', 0.1);
    } else if (kind === 'destroy') {
      this.noiseBurst(0.28, 350, 0.55, 0.32);
      this.tone(48, 0.45, 'sine', 0.4);
      this.sweep(200, 40, 0.4, 0.2);
    } else if (kind === 'alert') {
      this.tone(880, 0.12, 'square', 0.08);
      window.setTimeout(() => this.tone(660, 0.14, 'square', 0.07), 120);
    } else if (kind === 'flare') {
      this.noiseBurst(0.12, 2800, 0.35, 0.14);
      this.sweep(900, 280, 0.22, 0.1);
      this.tone(180, 0.08, 'sawtooth', 0.06);
    }
  }

  tone(freq, dur, type, gain) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  sweep(from, to, dur, gain) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noiseBurst(dur, freq, q, gain) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  dispose() {
    this.stopEngine();
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

let singleton = null;

/** @returns {ArenaAudio} */
export function getAudio() {
  if (!singleton) singleton = new ArenaAudio();
  return singleton;
}

export { ArenaAudio, MUTE_KEY };
