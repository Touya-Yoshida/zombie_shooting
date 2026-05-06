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
      case 'flame':
        this._flame();
        break;
      case 'snapPrime':
        this._snapPrime();
        break;
      case 'magicBolt':
        this._magicBolt();
        break;
      case 'lockOn':
        this._lockOn();
        break;
      case 'missile':
        this._missile();
        break;
      case 'repulsor':
        this._repulsor();
        break;
      case 'pistolShot':
        this._pistolShot();
        break;
      case 'slash':
        this._slash();
        break;
      default:
        break;
    }
  }

  _pistolShot() {
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.10);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4500;
    const g = this.ctx.createGain();
    noise.connect(hp).connect(lp).connect(g).connect(this.master);
    this._envelope(g, now, 0.001, 0.01, 0.4, 0.08, 0.7);
    noise.start(now);
    noise.stop(now + 0.15);

    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
    const og = this.ctx.createGain();
    osc.connect(og).connect(this.master);
    this._envelope(og, now, 0.001, 0.01, 0.3, 0.05, 0.55);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  _slash() {
    const now = this.ctx.currentTime;
    // Whoosh
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.4);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(700, now + 0.3);
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    noise.connect(bp).connect(g).connect(this.master);
    this._envelope(g, now, 0.005, 0.04, 0.55, 0.32, 0.45);
    noise.start(now);
    noise.stop(now + 0.4);

    // Metallic ping
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.18);
    const og = this.ctx.createGain();
    osc.connect(og).connect(this.master);
    this._envelope(og, now, 0.001, 0.02, 0.3, 0.18, 0.18);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  _magicBolt() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.18);
    const g = this.ctx.createGain();
    osc.connect(g).connect(this.master);
    this._envelope(g, now, 0.001, 0.02, 0.3, 0.18, 0.18);
    osc.start(now);
    osc.stop(now + 0.22);

    const sparkle = this.ctx.createOscillator();
    sparkle.type = 'sine';
    sparkle.frequency.setValueAtTime(2400, now);
    sparkle.frequency.exponentialRampToValueAtTime(1500, now + 0.1);
    const sg = this.ctx.createGain();
    sparkle.connect(sg).connect(this.master);
    this._envelope(sg, now, 0.001, 0.01, 0.2, 0.1, 0.08);
    sparkle.start(now);
    sparkle.stop(now + 0.12);
  }

  _lockOn() {
    const now = this.ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      osc.connect(g).connect(this.master);
      this._envelope(g, now + i * 0.04, 0.001, 0.01, 0, 0.03, 0.1);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.06);
    });
  }

  _missile() {
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.5);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1800, now);
    bp.frequency.exponentialRampToValueAtTime(450, now + 0.45);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    noise.connect(bp).connect(g).connect(this.master);
    this._envelope(g, now, 0.005, 0.05, 0.55, 0.4, 0.45);
    noise.start(now);
    noise.stop(now + 0.55);

    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    const tg = this.ctx.createGain();
    thump.connect(tg).connect(this.master);
    this._envelope(tg, now, 0.002, 0.04, 0.3, 0.15, 0.3);
    thump.start(now);
    thump.stop(now + 0.22);
  }

  _repulsor() {
    const now = this.ctx.currentTime;
    // Rising whoosh
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.5);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.35);
    bp.Q.value = 1.0;
    const g = this.ctx.createGain();
    noise.connect(bp).connect(g).connect(this.master);
    this._envelope(g, now, 0.002, 0.03, 0.55, 0.4, 0.35);
    noise.start(now);
    noise.stop(now + 0.5);

    // Boom
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, now + 0.08);
    boom.frequency.exponentialRampToValueAtTime(35, now + 0.4);
    const bg = this.ctx.createGain();
    boom.connect(bg).connect(this.master);
    this._envelope(bg, now + 0.08, 0.005, 0.06, 0.35, 0.3, 0.5);
    boom.start(now + 0.08);
    boom.stop(now + 0.5);

    // Electric zap
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
    const eg = this.ctx.createGain();
    osc.connect(eg).connect(this.master);
    this._envelope(eg, now, 0.002, 0.02, 0.2, 0.18, 0.2);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  _flame() {
    const now = this.ctx.currentTime;
    // Snap (tight click)
    const snapOsc = this.ctx.createOscillator();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(2400, now);
    snapOsc.frequency.exponentialRampToValueAtTime(900, now + 0.025);
    const snapGain = this.ctx.createGain();
    snapOsc.connect(snapGain).connect(this.master);
    this._envelope(snapGain, now, 0.001, 0.01, 0, 0.02, 0.18);
    snapOsc.start(now);
    snapOsc.stop(now + 0.04);

    // Whoosh (filtered noise burst)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.32);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, now + 0.02);
    bp.frequency.exponentialRampToValueAtTime(220, now + 0.32);
    bp.Q.value = 1.1;
    const wGain = this.ctx.createGain();
    noise.connect(bp).connect(wGain).connect(this.master);
    this._envelope(wGain, now + 0.015, 0.01, 0.06, 0.55, 0.26, 0.5);
    noise.start(now + 0.015);
    noise.stop(now + 0.4);

    // Sub thump
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now + 0.02);
    sub.frequency.exponentialRampToValueAtTime(55, now + 0.22);
    const subGain = this.ctx.createGain();
    sub.connect(subGain).connect(this.master);
    this._envelope(subGain, now + 0.02, 0.005, 0.05, 0.4, 0.18, 0.3);
    sub.start(now + 0.02);
    sub.stop(now + 0.28);
  }

  _snapPrime() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
    const g = this.ctx.createGain();
    osc.connect(g).connect(this.master);
    this._envelope(g, now, 0.005, 0.02, 0.2, 0.05, 0.08);
    osc.start(now);
    osc.stop(now + 0.1);
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
