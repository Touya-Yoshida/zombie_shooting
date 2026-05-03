import { CONFIG } from '../config.js';

export class HUD {
  constructor() {
    this.weaponLabel = document.getElementById('weapon-label');
    this.timeSurvived = document.getElementById('time-survived');
    this.killsEl = document.getElementById('kills');
    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.ammoCurrent = document.getElementById('ammo-current');
    this.ammoMax = document.getElementById('ammo-max');
    this.banner = document.getElementById('banner');
    this.handOverlay = document.getElementById('hand-overlay');
    this.handStatus = document.getElementById('hand-status');
    this.bannerTimeout = null;
  }

  update(state, weaponSys, nowMs, pose) {
    this.weaponLabel.textContent = weaponSys.getCurrent().name;
    this.timeSurvived.textContent = state.formatSurvived(nowMs);
    this.killsEl.textContent = `Kills: ${state.kills}`;
    const hpRatio = state.hp / state.maxHp;
    this.hpBar.style.width = `${hpRatio * 100}%`;
    this.hpBar.classList.toggle('low', hpRatio < 0.3);
    this.hpText.textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;

    const ammo = weaponSys.getAmmo();
    const mag = weaponSys.getMagSize();
    if (weaponSys.isReloading()) {
      const progress = weaponSys.getReloadProgress(nowMs);
      this.ammoCurrent.textContent = '⟳';
      this.ammoMax.textContent = `${Math.round(progress * 100)}%`;
    } else {
      this.ammoCurrent.textContent = ammo;
      this.ammoMax.textContent = mag;
    }
    this.ammoCurrent.classList.toggle('low', ammo === 0 && !weaponSys.isReloading());

    const detected = pose && pose.present;
    const calibratingClass = false;
    this.handOverlay.classList.toggle('detected', detected);
    this.handOverlay.classList.toggle('calibrating', calibratingClass);
    if (detected) {
      this.handStatus.textContent = pose.weapon
        ? `${pose.weapon.toUpperCase()}`
        : '検出中（ポーズ未一致）';
    } else {
      const reloadIn = CONFIG.POSE.ABSENT_FRAMES_FOR_RELOAD - (pose?.absentFrames || 0);
      if (reloadIn > 0 && reloadIn < CONFIG.POSE.ABSENT_FRAMES_FOR_RELOAD) {
        this.handStatus.textContent = `リロード予約 ${reloadIn}f`;
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
