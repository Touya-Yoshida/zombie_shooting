import { CONFIG } from '../config.js';

export const STATE = {
  BOOTING: 'BOOTING',
  CALIBRATING: 'CALIBRATING',
  READY: 'READY',
  PLAYING: 'PLAYING',
  DEAD: 'DEAD'
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
    this.onChange = null;
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

  survivedMs(nowMs) {
    if (!this.startTimeMs) return 0;
    const end = this.endTimeMs || nowMs;
    return end - this.startTimeMs;
  }

  formatSurvived(nowMs) {
    const ms = this.survivedMs(nowMs);
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
}
