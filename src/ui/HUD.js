import { CONFIG } from '../config.js';

export class HUD {
  constructor() {
    this.weaponLabel = document.getElementById('weapon-label');
    this.timeSurvived = document.getElementById('time-survived');
    this.killsEl = document.getElementById('kills');
    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.ammoCurrent = document.getElementById('ammo-current');
    this.ammoDivider = document.getElementById('ammo-divider');
    this.ammoMax = document.getElementById('ammo-max');
    this.banner = document.getElementById('banner');
    this.handOverlay = document.getElementById('hand-overlay');
    this.handStatus = document.getElementById('hand-status');
    this.bannerTimeout = null;
    this.abilityLabel = 'FLAME';
  }

  setAbility(label) {
    this.abilityLabel = label || 'FLAME';
    if (this.weaponLabel) this.weaponLabel.textContent = this.abilityLabel;
  }

  update(state, abilitySystem, nowMs, pose) {
    if (this.weaponLabel) this.weaponLabel.textContent = this.abilityLabel;

    if (state.isTimed()) {
      this.timeSurvived.textContent = state.formatRemaining(nowMs);
      const remaining = state.remainingMs(nowMs);
      if (remaining < 30000) {
        this.timeSurvived.id = 'timer-warning';
      } else {
        this.timeSurvived.id = 'time-survived';
      }
    } else {
      this.timeSurvived.textContent = state.formatSurvived(nowMs);
      this.timeSurvived.id = 'time-survived';
    }
    this.killsEl.textContent = `Kills: ${state.kills}`;
    const hpRatio = state.hp / state.maxHp;
    this.hpBar.style.width = `${hpRatio * 100}%`;
    this.hpBar.classList.toggle('low', hpRatio < 0.3);
    this.hpText.textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;

    this.ammoCurrent.textContent = '∞';
    this.ammoCurrent.classList.remove('low');
    if (this.ammoDivider) this.ammoDivider.textContent = '/';
    this.ammoMax.textContent = '∞';

    const detected = pose && pose.present;
    this.handOverlay.classList.toggle('detected', detected);
    this.handOverlay.classList.toggle('calibrating', false);
    if (detected) {
      let label = 'TRACKING';
      if (pose.twoHandPush) label = '💥 PUSH';
      else if (pose.snapPrimed) label = '🔥 CHARGE';
      else if (pose.pistolPose) label = '🔫 AIM';
      else if (pose.gripPose) label = '⚔️ GRIP';
      else if (pose.openPalm) label = '✨ PALM';
      else if (pose.pointingIndex) label = '🎯 LOCK';
      this.handStatus.textContent = label;
    } else {
      const reloadIn = CONFIG.POSE.ABSENT_FRAMES_FOR_RELOAD - (pose?.absentFrames || 0);
      if (reloadIn > 0 && reloadIn < CONFIG.POSE.ABSENT_FRAMES_FOR_RELOAD) {
        this.handStatus.textContent = `クールダウン ${reloadIn}f`;
      } else {
        this.handStatus.textContent = '未検出';
      }
    }
  }

  showBanner(text, durationMs = 2000) {
    this.banner.textContent = text;
    this.banner.classList.add('show');
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      this.banner.classList.remove('show');
    }, durationMs);
  }

  flashDamage() {
    this.hpBar.style.background = 'linear-gradient(90deg, #ffffff, #ffaa44)';
    setTimeout(() => {
      this.hpBar.style.background = '';
    }, 80);
  }
}
