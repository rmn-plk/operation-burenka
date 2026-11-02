/* Tiny procedural sound kit — no external audio assets. */

export class SoundKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.beamGain = null;
    this.ambienceGain = null;
    this.beamOsc = null;
    this.beamFilter = null;
    this.ready = false;
  }

  init() {
    if (this.ready) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);

      const ambient = this.ctx.createGain();
      ambient.gain.value = 0.035;
      ambient.connect(this.master);
      const drone = this.ctx.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 48;
      const drone2 = this.ctx.createOscillator();
      drone2.type = 'triangle';
      drone2.frequency.value = 55.6;
      const droneGain = this.ctx.createGain();
      droneGain.gain.value = 0.5;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.11;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 8;
      lfo.connect(lfoGain);
      lfoGain.connect(drone.frequency);
      drone.connect(droneGain);
      drone2.connect(droneGain);
      droneGain.connect(ambient);
      drone.start();
      drone2.start();
      lfo.start();
      this.ambienceGain = ambient;

      // continuous tractor beam tone, faded in and out
      const beamGain = this.ctx.createGain();
      beamGain.gain.value = 0;
      beamGain.connect(this.master);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 7;
      filter.connect(beamGain);
      const beamOsc = this.ctx.createOscillator();
      beamOsc.type = 'sawtooth';
      beamOsc.frequency.value = 146;
      const beamOsc2 = this.ctx.createOscillator();
      beamOsc2.type = 'triangle';
      beamOsc2.frequency.value = 219;
      const beamMix = this.ctx.createGain();
      beamMix.gain.value = 0.18;
      beamOsc.connect(beamMix);
      beamOsc2.connect(beamMix);
      beamMix.connect(filter);
      beamOsc.start();
      beamOsc2.start();
      this.beamGain = beamGain;
      this.beamOsc = beamOsc;
      this.beamFilter = filter;
      this.beamOsc2 = beamOsc2;

      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, now + 0.15);
  }

  setBeam(active, intensity = 1) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.beamGain.gain.cancelScheduledValues(now);
    this.beamGain.gain.linearRampToValueAtTime(active ? 0.15 * intensity : 0, now + 0.18);
    if (active) {
      this.beamOsc.frequency.cancelScheduledValues(now);
      this.beamOsc.frequency.linearRampToValueAtTime(132 + Math.sin(now * 2.3) * 26, now + 0.1);
      this.beamFilter.frequency.linearRampToValueAtTime(1100, now + 0.25);
    }
  }

  tone(freq, duration, type = 'sine', volume = 0.08, endFreq = null, delay = 0) {
    if (!this.ready || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  noise(duration = 0.35, volume = 0.06, frequency = 1200) {
    if (!this.ready || !this.ctx || this.muted) return;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  moo() {
    if (!this.ready || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.linearRampToValueAtTime(190, now + 0.12);
    osc.frequency.linearRampToValueAtTime(105, now + 0.72);
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 4;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.82);
  }

  abduct(combo = 1) {
    const base = 392 * Math.pow(1.0595, Math.min(combo - 1, 6) * 2);
    this.tone(base, 0.22, 'sine', 0.085, base * 1.5);
    this.tone(base * 1.5, 0.3, 'triangle', 0.055, base * 2.25, 0.07);
    this.noise(0.22, 0.025, 2400);
  }

  tick() {
    this.tone(880, 0.08, 'square', 0.025, 660);
  }

  win() {
    [523, 659, 784, 1046].forEach((freq, index) => {
      this.tone(freq, 0.5, 'triangle', 0.08, freq, index * 0.13);
    });
    this.tone(261, 1.0, 'sine', 0.06, 392, 0.1);
  }

  lose() {
    this.tone(220, 0.7, 'sawtooth', 0.06, 90);
    this.tone(165, 0.9, 'triangle', 0.05, 70, 0.16);
  }

  click() {
    this.tone(520, 0.06, 'square', 0.025, 620);
  }

  dispose() {
    try {
      this.setBeam(false);
      if (this.ctx) this.ctx.close();
    } catch {
      // no-op
    }
    this.ready = false;
  }
}
