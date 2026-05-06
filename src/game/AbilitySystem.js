import * as THREE from 'three';

const _aim = new THREE.Vector2();
const _fwd = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export class AbilitySystem {
  constructor({ audio, effects, gunView, camera, raycaster }) {
    this.audio = audio;
    this.effects = effects;
    this.gunView = gunView;
    this.camera = camera;
    this.raycaster = raycaster;
    this.character = 'flame_colonel';

    this.lastFireMs = 0;
    this.flameMinIntervalMs = 280;
    this.boltMinIntervalMs = 95;
    this.pistolMinIntervalMs = 350;
    this.slashMinIntervalMs = 480;

    this.onFire = null;
  }

  setCharacter(id) {
    if (this.character === id) return;
    this.lastFireMs = 0;
    this.character = id;
  }

  reset() {
    this.lastFireMs = 0;
  }

  update(pose, nowMs, dt, ctx) {
    if (this.character === 'flame_colonel') return this._updateFlame(pose, nowMs, ctx);
    if (this.character === 'pink_alchemist') return this._updatePink(pose, nowMs, ctx);
    if (this.character === 'special_forces') return this._updateSpecialForces(pose, nowMs, ctx);
    if (this.character === 'sword_kirito') return this._updateSword(pose, nowMs, ctx);
  }

  _firingDirAndOrigin(pose) {
    if (!pose.aimNDC) return null;
    _aim.set(pose.aimNDC.x, pose.aimNDC.y);
    this.raycaster.setFromCamera(_aim, this.camera);
    _fwd.copy(this.raycaster.ray.direction);
    const origin = this.gunView.getSparkWorldPosition(pose.aimNDC);
    return { origin, dir: _fwd.clone() };
  }

  _updateFlame(pose, nowMs, ctx) {
    if (!pose.snapFired) return;
    if (nowMs - this.lastFireMs < this.flameMinIntervalMs) return;
    const fa = this._firingDirAndOrigin(pose);
    if (!fa) return;
    this.lastFireMs = nowMs;

    this.audio?.play('flame');
    if (this.onFire) this.onFire('flame', pose);

    this.effects.spawnFireball(fa.origin, fa.dir, {
      speed: 36,
      radius: 0.42,
      hitRadius: 1.0,
      damage: 50,
      lifetime: 1.8,
      onHit: (zombie, dmg, point) => {
        this._applyHit(ctx, zombie, dmg, point, { ignite: true, igniteOnKill: true });
      }
    });
  }

  _updatePink(pose, nowMs, ctx) {
    if (!pose.openPalm) return;
    if (nowMs - this.lastFireMs < this.boltMinIntervalMs) return;
    const fa = this._firingDirAndOrigin(pose);
    if (!fa) return;
    this.lastFireMs = nowMs;

    this.audio?.play('magicBolt');
    if (this.onFire) this.onFire('magicBolt', pose);

    this.effects.spawnMagicBolt(fa.origin, fa.dir, {
      damage: 22,
      onHit: (zombie, dmg, point) => {
        this._applyHit(ctx, zombie, dmg, point, { ignite: false });
      }
    });
  }

  _updateSpecialForces(pose, nowMs, ctx) {
    // Fire requires pistol pose AND wrist snap up.
    if (!pose.pistolPose || !pose.wristSnapUp) return;
    if (nowMs - this.lastFireMs < this.pistolMinIntervalMs) return;
    const fa = this._firingDirAndOrigin(pose);
    if (!fa) return;
    this.lastFireMs = nowMs;

    this.audio?.play('pistolShot');
    if (this.onFire) this.onFire('pistolShot', pose);

    // Hitscan: raycast to find first zombie under aim
    const meshes = ctx.zombies.filter((z) => !z.isDead?.()).map((z) => z.mesh);
    let hitZombie = null;
    let hitPoint = null;
    if (meshes.length > 0) {
      const hits = this.raycaster.intersectObjects(meshes, true);
      if (hits.length > 0) {
        let cur = hits[0].object;
        while (cur) {
          if (cur.userData?.zombieRef) { hitZombie = cur.userData.zombieRef; break; }
          cur = cur.parent;
        }
        hitPoint = hits[0].point.clone();
      }
    }
    const target = hitPoint ?? fa.origin.clone().add(fa.dir.clone().multiplyScalar(60));

    this.effects.spawnBullet(fa.origin, target, {
      damage: 95,
      zombie: hitZombie,
      onHit: (zombie, dmg, point) => {
        this._applyHit(ctx, zombie, dmg, point, { ignite: false });
      }
    });
  }

  _updateSword(pose, nowMs, ctx) {
    if (!pose.swingDown) return;
    if (nowMs - this.lastFireMs < this.slashMinIntervalMs) return;
    const fa = this._firingDirAndOrigin(pose);
    if (!fa) return;
    this.lastFireMs = nowMs;

    this.audio?.play('slash');
    if (this.onFire) this.onFire('slash', pose);

    // Slash originates from a point in front of the camera (sword arc reach)
    _tmp.set(0, -0.2, -1.4).applyQuaternion(this.camera.quaternion);
    const origin = this.camera.position.clone().add(_tmp);

    this.effects.spawnSlash(origin, fa.dir, {
      speed: 30,
      damage: 60,
      lifetime: 0.85,
      width: 5.0,
      height: 1.8,
      hitWidth: 1.6,
      onHit: (zombie, dmg, point) => {
        this._applyHit(ctx, zombie, dmg, point, { ignite: false });
      }
    });
  }

  _applyHit(ctx, zombie, damage, point, opts = {}) {
    const killed = zombie.takeHit(damage, false);
    this.effects.spawnBlood(point);
    this.audio?.play('zombieHit');
    if (killed) ctx.gameState.registerKill();
    if (opts.ignite) {
      if (!killed) {
        this.effects.igniteZombie(zombie, {
          duration: 2.0,
          tickDamage: 12,
          tickInterval: 0.4,
          onKill: () => ctx.gameState.registerKill()
        });
      } else if (opts.igniteOnKill) {
        this.effects.igniteZombie(zombie, {
          duration: 1.2,
          tickDamage: 0,
          tickInterval: 1
        });
      }
    }
  }

  // Compatibility stubs (no longer used but referenced by HUD)
  getLockCount() { return 0; }
  getRepulsorCooldownPct() { return 1; }
}
