import * as THREE from 'three';

const PALETTES = {
  flame_colonel:   { skin: 0xf4d6b6, cuff: 0x16243a, trim: 0xd4a948, glow: 0xffaa44 },
  pink_alchemist:  { skin: 0xffe1cd, cuff: 0xc8336c, trim: 0xfbf6ee, glow: 0xff66cc },
  special_forces:  { skin: 0x1a1a20, cuff: 0x2a2a32, trim: 0xff4433, glow: 0xff8844 },
  sword_kirito:    { skin: 0x14141a, cuff: 0x222228, trim: 0xa0a0a8, glow: 0x66ccff }
};

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function emissiveMat(color, intensity = 0.6) {
  return new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: intensity });
}

export class CharacterViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.t = 0;
    this.character = 'flame_colonel';
    this.snapPrimed = false;
    this.snapAnim = 0;
    this.recoilAnim = 0;
    this.swingAnim = 0;
    this.boltAnim = 0;

    this.hands = {
      flame_colonel: this._buildSnapHand(),
      pink_alchemist: this._buildPalmHand(),
      special_forces: this._buildPistolHand(),
      sword_kirito: this._buildSwordHand()
    };
    for (const id in this.hands) {
      this.group.add(this.hands[id]);
      this.hands[id].visible = false;
    }
    this.setCharacter(this.character);
  }

  _addCuff(g, p, opts = {}) {
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(opts.r2 ?? 0.05, opts.r1 ?? 0.045, opts.h ?? 0.07, 14),
      mat(p.cuff)
    );
    cuff.position.set(opts.x ?? 0.005, opts.y ?? -0.07, opts.z ?? 0);
    cuff.rotation.x = opts.rx ?? 0.35;
    g.add(cuff);
    // trim ring
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(opts.r2 ?? 0.05, 0.006, 8, 18),
      mat(p.trim)
    );
    trim.position.copy(cuff.position);
    trim.position.y += (opts.h ?? 0.07) / 2 - 0.01;
    trim.rotation.x = Math.PI / 2 + (opts.rx ?? 0.35);
    g.add(trim);
    return cuff;
  }

  _buildSnapHand() {
    const p = PALETTES.flame_colonel;
    const g = new THREE.Group();
    g.position.set(0.22, -0.20, -0.42);
    g.rotation.set(-0.25, -0.10, 0.30);
    g.userData.basePos = g.position.clone();
    g.userData.baseRot = g.rotation.clone();

    this._addCuff(g, p);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.035), mat(p.skin));
    g.add(palm);

    // Thumb (rotates outward)
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.030, 0.01, 0.005);
    g.add(thumbPivot);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.018), mat(p.skin));
    thumb.position.set(0, 0.025, 0);
    thumbPivot.add(thumb);
    thumbPivot.rotation.set(-0.3, 0, -0.6);
    g.userData.thumbPivot = thumbPivot;

    // Index extended forward-up
    const idx = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.018), mat(p.skin));
    idx.position.set(-0.020, 0.085, 0);
    g.add(idx);

    // Middle (touching thumb in primed pose)
    const midPivot = new THREE.Group();
    midPivot.position.set(0, 0.045, 0);
    g.add(midPivot);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.018), mat(p.skin));
    mid.position.set(0, 0.025, 0);
    midPivot.add(mid);
    midPivot.rotation.set(0.55, 0, 0);
    g.userData.midPivot = midPivot;

    // Ring & pinky curled
    const ringPivot = new THREE.Group();
    ringPivot.position.set(0.018, 0.045, 0);
    g.add(ringPivot);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.045, 0.018), mat(p.skin));
    ring.position.set(0, 0.022, 0);
    ringPivot.add(ring);
    ringPivot.rotation.set(1.0, 0, 0);

    const pinkyPivot = new THREE.Group();
    pinkyPivot.position.set(0.034, 0.043, 0);
    g.add(pinkyPivot);
    const pinky = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.015), mat(p.skin));
    pinky.position.set(0, 0.020, 0);
    pinkyPivot.add(pinky);
    pinkyPivot.rotation.set(1.0, 0, 0);

    // Spark glow at thumb-middle contact
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 10, 8),
      new THREE.MeshBasicMaterial({
        color: p.glow, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    spark.position.set(-0.005, 0.07, 0.01);
    g.add(spark);
    g.userData.spark = spark;
    g.userData.sparkLocal = new THREE.Vector3(-0.005, 0.10, 0);

    return g;
  }

  _buildPalmHand() {
    const p = PALETTES.pink_alchemist;
    const g = new THREE.Group();
    g.position.set(0.20, -0.22, -0.45);
    g.rotation.set(-0.45, -0.05, 0.20);
    g.userData.basePos = g.position.clone();
    g.userData.baseRot = g.rotation.clone();

    this._addCuff(g, p);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.035), mat(p.skin));
    g.add(palm);

    // 5 extended fingers
    const fingerData = [
      { x: -0.040, y: 0.015, len: 0.06, rotZ: -0.7, rotX: -0.1 },
      { x: -0.025, y: 0.075, len: 0.075, rotZ: 0, rotX: 0 },
      { x: -0.005, y: 0.075, len: 0.085, rotZ: 0, rotX: 0 },
      { x: 0.015, y: 0.075, len: 0.075, rotZ: 0, rotX: 0 },
      { x: 0.034, y: 0.072, len: 0.058, rotZ: 0.05, rotX: 0 }
    ];
    for (const f of fingerData) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.018, f.len, 0.018), mat(p.skin));
      fin.position.set(f.x, f.y + f.len / 2, 0);
      fin.rotation.z = f.rotZ;
      fin.rotation.x = f.rotX;
      g.add(fin);
    }

    // Pink palm glow
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 14, 10),
      new THREE.MeshBasicMaterial({
        color: p.glow, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    glow.position.set(0, 0.04, 0.025);
    g.add(glow);
    g.userData.glow = glow;
    g.userData.sparkLocal = new THREE.Vector3(0, 0.06, 0.025);
    return g;
  }

  _buildPistolHand() {
    const p = PALETTES.special_forces;
    const g = new THREE.Group();
    g.position.set(0.16, -0.22, -0.42);
    g.rotation.set(-0.10, -0.20, 0.40);
    g.userData.basePos = g.position.clone();
    g.userData.baseRot = g.rotation.clone();

    // Tactical sleeve (black with red trim)
    this._addCuff(g, p, { h: 0.08 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.035), mat(p.skin));
    g.add(palm);

    // Thumb up (vertical)
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.030, 0.01, 0);
    g.add(thumbPivot);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.018), mat(p.skin));
    thumb.position.set(0, 0.035, 0);
    thumbPivot.add(thumb);
    thumbPivot.rotation.set(0, 0, -1.2);

    // Index forward (gun barrel)
    const idx = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.10, 0.022), mat(p.skin));
    idx.position.set(-0.018, 0.10, 0);
    g.add(idx);

    // Tactical sight on tip
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.012), mat(p.trim));
    sight.position.set(-0.018, 0.155, 0);
    g.add(sight);

    // Curled middle/ring/pinky
    const offsets = [-0.005, 0.013, 0.030];
    for (const x of offsets) {
      const piv = new THREE.Group();
      piv.position.set(x, 0.035, 0.012);
      g.add(piv);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.045, 0.018), mat(p.skin));
      f.position.set(0, 0.022, 0);
      piv.add(f);
      piv.rotation.set(1.3, 0, 0);
    }

    // Muzzle flash placeholder
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffe49a, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    flash.position.set(-0.018, 0.18, 0);
    g.add(flash);
    g.userData.flash = flash;

    g.userData.sparkLocal = new THREE.Vector3(-0.018, 0.18, 0);
    return g;
  }

  _buildSwordHand() {
    const p = PALETTES.sword_kirito;
    const g = new THREE.Group();
    g.position.set(0.10, -0.20, -0.50);
    g.rotation.set(-0.35, -0.20, -0.40);
    g.userData.basePos = g.position.clone();
    g.userData.baseRot = g.rotation.clone();

    // Black coat sleeve
    this._addCuff(g, p, { h: 0.09, r1: 0.05, r2: 0.055 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.05), mat(p.skin));
    g.add(palm);

    // Curled fingers around grip (4 fingers)
    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group();
      piv.position.set(-0.024 + i * 0.016, 0.025, 0.022);
      g.add(piv);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.045, 0.018), mat(p.skin));
      f.position.set(0, 0.022, 0);
      piv.add(f);
      piv.rotation.set(1.5, 0, 0);
    }
    // Thumb wrapping
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.025, -0.005, -0.005);
    g.add(thumbPivot);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.018), mat(p.skin));
    thumb.position.set(0, 0.025, 0);
    thumbPivot.add(thumb);
    thumbPivot.rotation.set(-0.5, 0.2, -0.6);

    // SWORD assembly (parented so it swings with the hand)
    const sword = new THREE.Group();
    sword.rotation.x = -0.25;
    g.add(sword);
    g.userData.sword = sword;

    // Pommel
    const pommel = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 8),
      mat(0x44444c)
    );
    pommel.position.set(0, -0.02, 0);
    sword.add(pommel);
    // Grip wrap
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.085, 10),
      mat(0x18181c)
    );
    grip.position.set(0, 0.025, 0);
    sword.add(grip);
    // Crossguard
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.013, 0.025),
      mat(p.trim)
    );
    guard.position.set(0, 0.075, 0);
    sword.add(guard);
    // Blade
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.62, 0.012),
      emissiveMat(0x8590a8, 0.25)
    );
    blade.position.set(0, 0.395, 0);
    sword.add(blade);
    // Edge glow
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.62, 0.014),
      new THREE.MeshBasicMaterial({
        color: p.glow, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    edge.position.copy(blade.position);
    sword.add(edge);
    g.userData.edge = edge;
    // Tip glow (point light at sword tip)
    const tipLight = new THREE.PointLight(p.glow, 0.6, 1.2, 2);
    tipLight.position.set(0, 0.7, 0);
    sword.add(tipLight);
    g.userData.tipLight = tipLight;

    // Spark anchor at sword tip in world coords (computed via localToWorld)
    g.userData.sparkLocal = new THREE.Vector3(0, 0.7, 0);
    g.userData.sparkAnchor = sword;
    return g;
  }

  setCharacter(id) {
    if (!this.hands[id]) return;
    this.character = id;
    for (const cid in this.hands) {
      this.hands[cid].visible = (cid === id);
    }
  }

  setSnapPrimed(b) {
    this.snapPrimed = b;
  }

  triggerFire(kind) {
    if (kind === 'flame') {
      this.snapAnim = 0.22;
    } else if (kind === 'magicBolt') {
      this.boltAnim = 0.18;
    } else if (kind === 'pistolShot') {
      this.recoilAnim = 0.20;
    } else if (kind === 'slash') {
      this.swingAnim = 0.40;
    }
  }

  setVisible(v) { this.group.visible = v; }
  fire() { /* legacy compat */ }
  setWeapon() { /* legacy compat */ }
  getMuzzleWorldPosition() { return this.getSparkWorldPosition(); }

  getSparkWorldPosition(/* aimNDC */) {
    const hand = this.hands[this.character];
    const local = (hand.userData.sparkLocal || new THREE.Vector3()).clone();
    const anchor = hand.userData.sparkAnchor || hand;
    anchor.localToWorld(local);
    return local;
  }

  update(dt) {
    this.t += dt;
    if (this.snapAnim > 0) this.snapAnim = Math.max(0, this.snapAnim - dt);
    if (this.recoilAnim > 0) this.recoilAnim = Math.max(0, this.recoilAnim - dt);
    if (this.swingAnim > 0) this.swingAnim = Math.max(0, this.swingAnim - dt);
    if (this.boltAnim > 0) this.boltAnim = Math.max(0, this.boltAnim - dt);

    const active = this.hands[this.character];
    if (!active) return;
    const base = active.userData.basePos;
    const baseRot = active.userData.baseRot;

    // Gentle idle bob
    const bob = Math.sin(this.t * 1.6) * 0.004;
    active.position.y = base.y + bob;

    if (this.character === 'flame_colonel') {
      const midPiv = active.userData.midPivot;
      const thumbPiv = active.userData.thumbPivot;
      const spark = active.userData.spark;
      // Snap-primed: middle bent toward thumb, spark dims to bright
      const primed = this.snapPrimed ? 1 : 0;
      // Smoothly blend
      const smoothPrimed = (active.userData._smoothPrimed ?? 0) + (primed - (active.userData._smoothPrimed ?? 0)) * Math.min(1, dt * 12);
      active.userData._smoothPrimed = smoothPrimed;
      const fireU = this.snapAnim > 0 ? this.snapAnim / 0.22 : 0;
      // When firing, fingers spring open
      const openBoost = fireU;
      if (midPiv) midPiv.rotation.x = 0.55 + smoothPrimed * 0.25 - openBoost * 0.6;
      if (thumbPiv) thumbPiv.rotation.z = -0.6 - smoothPrimed * 0.15 - openBoost * 0.4;
      if (spark) {
        spark.material.opacity = Math.max(smoothPrimed * 0.55, fireU * 0.95);
        spark.scale.setScalar(0.7 + smoothPrimed * 0.4 + fireU * 1.0);
      }
      active.position.x = base.x;
      active.rotation.copy(baseRot);
    } else if (this.character === 'pink_alchemist') {
      const glow = active.userData.glow;
      if (glow) {
        const open = pose => 0; // placeholder
        const u = this.boltAnim > 0 ? this.boltAnim / 0.18 : 0;
        glow.material.opacity = 0.45 + u * 0.45 + Math.sin(this.t * 6) * 0.05;
        glow.scale.setScalar(1 + u * 0.4 + Math.sin(this.t * 8) * 0.05);
      }
      active.position.x = base.x;
      active.rotation.copy(baseRot);
    } else if (this.character === 'special_forces') {
      const u = this.recoilAnim > 0 ? this.recoilAnim / 0.20 : 0;
      // Wrist snaps up: rotate hand upward (negative X rotation), kick back (positive Z)
      active.rotation.x = baseRot.x - u * 0.55;
      active.rotation.z = baseRot.z + u * 0.10;
      active.position.y = base.y + bob + u * 0.03;
      active.position.z = base.z + u * 0.03;
      const flash = active.userData.flash;
      if (flash) flash.material.opacity = u;
    } else if (this.character === 'sword_kirito') {
      // Swing animation: rotate the sword down sharply, then return
      const u = this.swingAnim > 0 ? this.swingAnim / 0.40 : 0;
      // u=1 just fired; eases down
      const phase = 1 - u; // 0 → 1 over duration
      // Quick swing in first 30%, return slow
      let swing;
      if (phase < 0.30) swing = phase / 0.30;
      else swing = 1 - (phase - 0.30) / 0.70;
      swing = Math.max(0, Math.min(1, swing));
      // Rotate around X axis (downward swing)
      active.rotation.x = baseRot.x + swing * 1.6;
      active.rotation.z = baseRot.z - swing * 0.3;
      active.position.x = base.x + swing * 0.05;
      // Edge glow brightens during swing
      const edge = active.userData.edge;
      if (edge) edge.material.opacity = 0.35 + swing * 0.55;
      const tipLight = active.userData.tipLight;
      if (tipLight) tipLight.intensity = 0.6 + swing * 1.4;
    }
  }
}
