export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.unlocked = false;
    this.lastPlayMs = {};
  }

  unlock() {
    if (this.unlocked) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
  }

  setVolume(v) {
    if (this.master) this.master.gain.value = v;
  }

  _envelope(node, now, attackS, decayS, sustain, releaseS, peak) {
    const g = node.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(peak, now + attackS);
    g.linearRampToValueAtTime(peak * sustain, now + attackS + decayS);
    g.linearRampToValueAtTime(0, now + attackS + decayS + releaseS);
    return attackS + decayS + releaseS;
  }

  _noiseBuffer(durationS) {
    const sampleRate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sampleRate * durationS, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    return buf;
  }

  play(name) {
    if (!this.unlocked) return;
    const now = this.ctx.currentTime;
    if (this.lastPlayMs[name] && now - this.lastPlayMs[name] < 0.02) return;
    this.lastPlayMs[name] = now;

    switch (name) {
      case 'pistol':
        this._gunshot(450, 0.06, 0.6);
        break;
      case 'rifle':
        this._gunshot(180, 0.04, 0.45);
        break;
      case 'emptyClick':
        this._click();
        break;
      case 'reload':
        this._reload();
        break;
      case 'zombieGrowl':
        this._growl();
        break;
      case 'zombieHit':
        this._hit();
        break;
      case 'playerHurt':
        this._playerHurt();
        break;
      case 'weaponSwap':
        this._swap();
        break;
      case 'gameOver':
        this._gameOver();
        break;
      default:
        break;
    }
  }

  _gunshot(filterFreq, duration, volume) {
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(duration);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    noise.connect(filter).connect(gain).connect(this.master);
    this._envelope(gain, now, 0.001, 0.02, 0.4, duration, volume);
    noise.start(now);
    noise.stop(now + duration + 0.05);

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);
    const oscGain = this.ctx.createGain();
    osc.connect(oscGain).connect(this.master);
    this._envelope(oscGain, now, 0.001, 0.01, 0.3, 0.04, volume * 0.5);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  _click() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1800;
    const gain = this.ctx.createGain();
    osc.connect(gain).connect(this.master);
    this._envelope(gain, now, 0.001, 0.005, 0, 0.01, 0.15);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  _reload() {
    const now = this.ctx.currentTime;
    [0, 0.18, 0.4].forEach((delay, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 600 - i * 100;
      const gain = this.ctx.createGain();
      osc.connect(gain).connect(this.master);
      this._envelope(gain, now + delay, 0.005, 0.02, 0, 0.04, 0.18);
      osc.start(now + delay);
      osc.stop(now + delay + 0.08);
    });
  }

  _growl() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80 + Math.random() * 20, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = this.ctx.createGain();
    osc.connect(filter).connect(gain).connect(this.master);
    this._envelope(gain, now, 0.05, 0.1, 0.6, 0.3, 0.25);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  _hit() {
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    const gain = this.ctx.createGain();
    noise.connect(filter).connect(gain).connect(this.master);
    this._envelope(gain, now, 0.001, 0.02, 0.4, 0.06, 0.3);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  _playerHurt() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
    const gain = this.ctx.createGain();
    osc.connect(gain).connect(this.master);
    this._envelope(gain, now, 0.005, 0.05, 0.3, 0.15, 0.3);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  _swap() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 900;
    const gain = this.ctx.createGain();
    osc.connect(gain).connect(this.master);
    this._envelope(gain, now, 0.001, 0.005, 0, 0.02, 0.12);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  _gameOver() {
    const now = this.ctx.currentTime;
    [880, 660, 440, 220].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      osc.connect(gain).connect(this.master);
      this._envelope(gain, now + i * 0.18, 0.02, 0.05, 0.5, 0.15, 0.3);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.25);
    });
  }
}
