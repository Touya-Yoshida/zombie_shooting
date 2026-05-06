import { WEAPONS } from './Weapons.js';

export class WeaponSystem {
  constructor(audioBus, gunViewModel) {
    this.audio = audioBus;
    this.gunView = gunViewModel;
    this.current = 'pistol';
    this.ammo = {
      pistol: WEAPONS.pistol.magSize,
      rifle: WEAPONS.rifle.magSize
    };
    this.reloading = false;
    this.reloadEnds = 0;
    this.lastFireMs = 0;
    this.onFire = null;
    this.fireSoundOverride = null;
  }

  getCurrent() {
    return WEAPONS[this.current];
  }

  getAmmo() {
    return this.ammo[this.current];
  }

  getMagSize() {
    return WEAPONS[this.current].magSize;
  }

  isReloading() {
    return this.reloading;
  }

  switchTo(weapon, nowMs) {
    if (weapon === this.current) return;
    if (this.reloading) return;
    this.current = weapon;
    this.gunView.setWeapon(weapon);
    this.audio?.play('weaponSwap');
  }

  startReload(nowMs) {
    if (this.reloading) return;
    if (this.ammo[this.current] === this.getMagSize()) return;
    this.reloading = true;
    this.reloadEnds = nowMs + this.getCurrent().reloadMs;
    this.audio?.play('reload');
  }

  update(pose, nowMs) {
    if (this.reloading && nowMs >= this.reloadEnds) {
      this.ammo[this.current] = this.getMagSize();
      this.reloading = false;
    }

    if (pose.weapon && pose.weapon !== this.current) {
      this.switchTo(pose.weapon, nowMs);
    }

    if (pose.reloadRequested) {
      this.startReload(nowMs);
    }

    if (this.reloading) return;

    const w = this.getCurrent();
    const interval = 60000 / w.rpm;

    let shouldFire = false;
    if (w.auto) {
      if (pose.triggerHeld && nowMs - this.lastFireMs >= interval) {
        shouldFire = true;
      }
    } else {
      if (pose.triggerPulled && nowMs - this.lastFireMs >= interval) {
        shouldFire = true;
      }
    }

    if (shouldFire) {
      if (this.ammo[this.current] > 0) {
        this.ammo[this.current]--;
        this.lastFireMs = nowMs;
        this.gunView.fire();
        this.audio?.play(this.fireSoundOverride || (this.current === 'pistol' ? 'pistol' : 'rifle'));
        if (this.onFire) this.onFire(pose);
      } else {
        if (!w.auto || nowMs - this.lastFireMs > 200) {
          this.audio?.play('emptyClick');
          this.lastFireMs = nowMs;
        }
      }
    }
  }

  getReloadProgress(nowMs) {
    if (!this.reloading) return 1;
    const w = this.getCurrent();
    return 1 - (this.reloadEnds - nowMs) / w.reloadMs;
  }
}
