import { CONFIG } from '../config.js';

export const STATE = {
  BOOTING: 'BOOTING',
  CALIBRATING: 'CALIBRATING',
  READY: 'READY',
  PLAYING: 'PLAYING',
  DEAD: 'DEAD',
  CLEARED: 'CLEARED'
};

export class GameState {
  constructor() {
    this.state = STATE.BOOTING;
    this.hp = CONFIG.PLAYER.MAX_HP;
    this.maxHp = CONFIG.PLAYER.MAX_HP;
    this.kills = 0;
    this.startTimeMs = 0;
    this.endTimeMs = 0;
    this.lastDamageTimeMs = 0;
    this.modeId = 'timed';
    this.timeLimitMs = CONFIG.GAME_MODES.TIMED.durationMs;
    this.onChange = null;
  }

  setMode(modeId) {
    const mode = modeId === 'endless' ? CONFIG.GAME_MODES.ENDLESS : CONFIG.GAME_MODES.TIMED;
    this.modeId = mode.id;
    this.timeLimitMs = mode.id === 'endless' ? 0 : mode.durationMs;
  }

  setState(next) {
    if (this.state !== next) {
      this.state = next;
      if (this.onChange) this.onChange(next);
    }
  }

  startGame(nowMs) {
    this.hp = this.maxHp;
    this.kills = 0;
    this.startTimeMs = nowMs;
    this.endTimeMs = 0;
    this.setState(STATE.PLAYING);
  }

  takeDamage(dmg, nowMs) {
    if (this.state !== STATE.PLAYING) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.lastDamageTimeMs = nowMs;
    if (this.hp <= 0) {
      this.endTimeMs = nowMs;
      this.setState(STATE.DEAD);
    }
  }

  registerKill() {
    this.kills++;
  }

  isTimed() {
    return this.modeId === 'timed' && this.timeLimitMs > 0;
  }

  isEndless() {
    return this.modeId === 'endless' || this.timeLimitMs <= 0;
  }

  remainingMs(nowMs) {
    if (!this.isTimed()) return Infinity;
    if (!this.startTimeMs) return this.timeLimitMs;
    const end = this.endTimeMs || nowMs;
    return Math.max(0, this.timeLimitMs - (end - this.startTimeMs));
  }

  checkTimeLimit(nowMs) {
    if (this.state !== STATE.PLAYING) return;
    if (this.isEndless()) return;
    if (!this.isTimed()) return;
    if (this.remainingMs(nowMs) <= 0) {
      this.endTimeMs = nowMs;
      this.setState(STATE.CLEARED);
    }
  }

  survivedMs(nowMs) {
    if (!this.startTimeMs) return 0;
    const end = this.endTimeMs || nowMs;
    return end - this.startTimeMs;
  }

  formatSurvived(nowMs) {
    const ms = this.survivedMs(nowMs);
    return GameState.formatMs(ms);
  }

  formatRemaining(nowMs) {
    if (!this.isTimed()) return '∞';
    return GameState.formatMs(this.remainingMs(nowMs));
  }

  static formatMs(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
}
