import * as THREE from 'three';

const _aim = new THREE.Vector2();
const _fwd = new THREE.Vector3();
const _tmp = new THREE.Vector3();

const MIN_INTERVAL = {
  flame_colonel: 280,
  pink_alchemist: 95,
  martial_artist: 380,
  sword_kirito: 480
};

export class AbilitySystem {
  constructor({ audio, effects, gunView, camera, raycaster }) {
    this.audio = audio;
    this.effects = effects;
    this.gunView = gunView;
    this.camera = camera;
    this.raycaster = raycaster;

    this.characters = { left: 'flame_colonel', right: 'flame_colonel' };
    this.lastFireMs = { left: 0, right: 0 };

    this.onFire = null;
  }

  // Back-compat — sets both slots to the same character.
  setCharacter(id) {
    this.setCharacters({ left: id, right: id });
  }

  setCharacters({ left, right }) {
    if (this.characters.left !== left) this.lastFireMs.left = 0;
    if (this.characters.right !== right) this.lastFireMs.right = 0;
    this.characters.left = left ?? this.characters.left;
    this.characters.right = right ?? this.characters.right;
  }

  reset() {
    this.lastFireMs.left = 0;
    this.lastFireMs.right = 0;
  }

  update(pose, nowMs, dt, ctx) {
    if (!pose) return;
    // Run each slot independently with its own character + pose data.
    const slots = ['left', 'right'];
    for (const slot of slots) {
      const handPose = pose[slot];
      if (!handPose || !handPose.present) continue;
      const character = this.characters[slot];
      if (!character) continue;
      this._runCharacter(character, slot, handPose, nowMs, ctx);
    }
  }

  _runCharacter(character, slot, handPose, nowMs, ctx) {
    const minInterval = MIN_INTERVAL[character] ?? 280;
    if (nowMs - this.lastFireMs[slot] < minInterval) return;

    if (character === 'flame_colonel') return this._fireFlame(slot, handPose, nowMs, ctx);
    if (character === 'pink_alchemist') return this._firePink(slot, handPose, nowMs, ctx);
    if (character === 'martial_artist') return this._fireFist(slot, handPose, nowMs, ctx);
    if (character === 'sword_kirito') return this._fireSlash(slot, handPose, nowMs, ctx);
  }

  _firingDirAndOrigin(slot, handPose) {
    if (!handPose.aimNDC) return null;
    _aim.set(handPose.aimNDC.x, handPose.aimNDC.y);
    this.raycaster.setFromCamera(_aim, this.camera);
    _fwd.copy(this.raycaster.ray.direction);
    const origin = this.gunView.getSparkWorldPosition(slot, handPose.aimNDC);
    return { origin, dir: _fwd.clone() };
  }

  _fireFlame(slot, handPose, nowMs, ctx) {
    if (!handPose.snapFired) return;
    const fa = this._firingDirAndOrigin(slot, handPose);
    if (!fa) return;
    this.lastFireMs[slot] = nowMs;
    this.audio?.play('flame');
    if (this.onFire) this.onFire('flame', slot, handPose);
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

  _firePink(slot, handPose, nowMs, ctx) {
    if (!handPose.openPalm) return;
    const fa = this._firingDirAndOrigin(slot, handPose);
    if (!fa) return;
    this.lastFireMs[slot] = nowMs;
    this.audio?.play('magicBolt');
    if (this.onFire) this.onFire('magicBolt', slot, handPose);
    this.effects.spawnMagicBolt(fa.origin, fa.dir, {
      damage: 22,
      onHit: (zombie, dmg, point) => {
        this._applyHit(ctx, zombie, dmg, point, { ignite: false });
      }
    });
  }

  _fireFist(slot, handPose, nowMs, ctx) {
    if (!handPose.punchFired) return;
    const fa = this._firingDirAndOrigin(slot, handPose);
    if (!fa) return;
    this.lastFireMs[slot] = nowMs;
    this.audio?.play('flame');
    if (this.onFire) this.onFire('fistAir', slot, handPose);
    this.effects.spawnFistAir(fa.origin, fa.dir, {
      speed: 44,
      damage: 60,
      lifetime: 1.4,
      hitRadius: 0.95,
      onHit: (zombie, dmg, point) => {
        this._applyHit(ctx, zombie, dmg, point, { ignite: false });
      }
    });
  }

  _fireSlash(slot, handPose, nowMs, ctx) {
    if (!handPose.swingDown) return;
    const fa = this._firingDirAndOrigin(slot, handPose);
    if (!fa) return;
    this.lastFireMs[slot] = nowMs;
    this.audio?.play('slash');
    if (this.onFire) this.onFire('slash', slot, handPose);
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
