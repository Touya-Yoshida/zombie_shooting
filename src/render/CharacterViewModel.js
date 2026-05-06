import * as THREE from 'three';

const PALETTES = {
  flame_colonel:   { skin: 0xf4d6b6, cuff: 0x16243a, trim: 0xd4a948, glow: 0xffaa44 },
  pink_alchemist:  { skin: 0xffe1cd, cuff: 0xc8336c, trim: 0xfbf6ee, glow: 0xff66cc },
  martial_artist:  { skin: 0xf4d2a8, cuff: 0xf4f0e6, trim: 0x1a1410, glow: 0xa8e8ff },
  sword_kirito:    { skin: 0x14141a, cuff: 0x222228, trim: 0xa0a0a8, glow: 0x66ccff }
};

// Lambert material with double-sided rendering — required so the mirrored
// (left-side) hand still renders correctly when scale.x = -1 inverts winding.
function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, ...opts });
}

function emissiveMat(color, intensity = 0.6) {
  return new THREE.MeshLambertMaterial({
    color, emissive: color, emissiveIntensity: intensity, side: THREE.DoubleSide
  });
}

const CHARS = ['flame_colonel', 'pink_alchemist', 'martial_artist', 'sword_kirito'];

export class CharacterViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.t = 0;

    this.characters = { left: 'flame_colonel', right: 'flame_colonel' };

    // Two parallel hand collections — one mounted on each side of the screen.
    // Mirroring is achieved by negating the outer group's x-position and
    // applying scale.x = -1 (so geometry & rotations look mirrored).
    this.handsBySlot = { left: {}, right: {} };
    for (const id of CHARS) {
      this.handsBySlot.right[id] = this._buildHandFor(id, 'right');
      this.handsBySlot.left[id] = this._buildHandFor(id, 'left');
      this.group.add(this.handsBySlot.right[id]);
      this.group.add(this.handsBySlot.left[id]);
      this.handsBySlot.right[id].visible = false;
      this.handsBySlot.left[id].visible = false;
    }

    this.anim = {
      left: this._newAnimState(),
      right: this._newAnimState()
    };

    this.setCharacters({ left: 'flame_colonel', right: 'flame_colonel' });
  }

  _newAnimState() {
    return {
      snapPrimed: false,
      snapAnim: 0,
      recoilAnim: 0,
      swingAnim: 0,
      boltAnim: 0,
      smoothPrimed: 0
    };
  }

  _buildHandFor(id, slot) {
    let g;
    if (id === 'flame_colonel') g = this._buildSnapHand();
    else if (id === 'pink_alchemist') g = this._buildPalmHand();
    else if (id === 'martial_artist') g = this._buildFistHand();
    else if (id === 'sword_kirito') g = this._buildSwordHand();
    else g = new THREE.Group();

    if (slot === 'left') {
      // Mount on the opposite side and mirror the geometry via negative x-scale.
      g.position.x = -g.position.x;
      if (g.userData.basePos) g.userData.basePos.x = -g.userData.basePos.x;
      g.scale.x = -1;
    }
    g.userData.slot = slot;
    return g;
  }

  _addCuff(g, p, opts = {}) {
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(opts.r2 ?? 0.05, opts.r1 ?? 0.045, opts.h ?? 0.07, 14),
      mat(p.cuff)
    );
    cuff.position.set(opts.x ?? 0.005, opts.y ?? -0.07, opts.z ?? 0);
    cuff.rotation.x = opts.rx ?? 0.35;
    g.add(cuff);
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

    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.030, 0.01, 0.005);
    g.add(thumbPivot);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.018), mat(p.skin));
    thumb.position.set(0, 0.025, 0);
    thumbPivot.add(thumb);
    thumbPivot.rotation.set(-0.3, 0, -0.6);
    g.userData.thumbPivot = thumbPivot;

    const idx = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.018), mat(p.skin));
    idx.position.set(-0.020, 0.085, 0);
    g.add(idx);

    const midPivot = new THREE.Group();
    midPivot.position.set(0, 0.045, 0);
    g.add(midPivot);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.018), mat(p.skin));
    mid.position.set(0, 0.025, 0);
    midPivot.add(mid);
    midPivot.rotation.set(0.55, 0, 0);
    g.userData.midPivot = midPivot;

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

  _buildFistHand() {
    const p = PALETTES.martial_artist;
    const g = new THREE.Group();
    g.position.set(0.18, -0.18, -0.40);
    g.rotation.set(-0.10, -0.05, 0.10);
    g.userData.basePos = g.position.clone();
    g.userData.baseRot = g.rotation.clone();

    this._addCuff(g, p, { h: 0.10, r1: 0.052, r2: 0.058 });
    const cuffStripe = new THREE.Mesh(
      new THREE.TorusGeometry(0.058, 0.008, 8, 18),
      mat(p.trim)
    );
    cuffStripe.position.set(0.005, -0.04, 0);
    cuffStripe.rotation.x = Math.PI / 2 + 0.35;
    g.add(cuffStripe);

    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.085, 0.075),
      mat(p.skin)
    );
    palm.position.set(0, 0.04, 0);
    g.add(palm);

    const knuckleY = 0.06;
    for (let i = 0; i < 4; i++) {
      const k = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 10, 8),
        mat(p.skin)
      );
      k.position.set(-0.030 + i * 0.020, knuckleY, -0.040);
      g.add(k);
    }

    const thumb = new THREE.Mesh(
      new THREE.BoxGeometry(0.020, 0.040, 0.020),
      mat(p.skin)
    );
    thumb.position.set(-0.040, 0.040, -0.020);
    thumb.rotation.set(0, 0, 0.4);
    g.add(thumb);

    const shade = new THREE.Mesh(
      new THREE.BoxGeometry(0.080, 0.005, 0.04),
      mat(0xc89868)
    );
    shade.position.set(0, 0.058, -0.020);
    g.add(shade);

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 14, 10),
      new THREE.MeshBasicMaterial({
        color: p.glow, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    aura.position.set(-0.005, 0.06, -0.06);
    g.add(aura);
    g.userData.aura = aura;

    g.userData.sparkLocal = new THREE.Vector3(-0.005, 0.06, -0.10);
    return g;
  }

  _buildSwordHand() {
    const p = PALETTES.sword_kirito;
    const g = new THREE.Group();
    g.position.set(0.10, -0.20, -0.50);
    g.rotation.set(-0.35, -0.20, -0.40);
    g.userData.basePos = g.position.clone();
    g.userData.baseRot = g.rotation.clone();

    this._addCuff(g, p, { h: 0.09, r1: 0.05, r2: 0.055 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.05), mat(p.skin));
    g.add(palm);

    for (let i = 0; i < 4; i++) {
      const piv = new THREE.Group();
      piv.position.set(-0.024 + i * 0.016, 0.025, 0.022);
      g.add(piv);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.045, 0.018), mat(p.skin));
      f.position.set(0, 0.022, 0);
      piv.add(f);
      piv.rotation.set(1.5, 0, 0);
    }
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(-0.025, -0.005, -0.005);
    g.add(thumbPivot);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.018), mat(p.skin));
    thumb.position.set(0, 0.025, 0);
    thumbPivot.add(thumb);
    thumbPivot.rotation.set(-0.5, 0.2, -0.6);

    const sword = new THREE.Group();
    sword.rotation.x = -0.25;
    g.add(sword);
    g.userData.sword = sword;

    const pommel = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 8),
      mat(0x44444c)
    );
    pommel.position.set(0, -0.02, 0);
    sword.add(pommel);
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.085, 10),
      mat(0x18181c)
    );
    grip.position.set(0, 0.025, 0);
    sword.add(grip);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.013, 0.025),
      mat(p.trim)
    );
    guard.position.set(0, 0.075, 0);
    sword.add(guard);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.62, 0.012),
      emissiveMat(0x8590a8, 0.25)
    );
    blade.position.set(0, 0.395, 0);
    sword.add(blade);
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
    const tipLight = new THREE.PointLight(p.glow, 0.6, 1.2, 2);
    tipLight.position.set(0, 0.7, 0);
    sword.add(tipLight);
    g.userData.tipLight = tipLight;

    g.userData.sparkLocal = new THREE.Vector3(0, 0.7, 0);
    g.userData.sparkAnchor = sword;
    return g;
  }

  // ---------- Public API ----------

  // Back-compat — set both slots to the same character.
  setCharacter(id) {
    this.setCharacters({ left: id, right: id });
  }

  setCharacters({ left, right }) {
    this.characters.left = left ?? this.characters.left;
    this.characters.right = right ?? this.characters.right;
    for (const slot of ['left', 'right']) {
      const activeId = this.characters[slot];
      for (const id of CHARS) {
        const g = this.handsBySlot[slot][id];
        if (!g) continue;
        g.visible = (id === activeId);
      }
    }
  }

  setSnapPrimed(b, slot = null) {
    if (slot) {
      this.anim[slot].snapPrimed = !!b;
    } else {
      this.anim.left.snapPrimed = !!b;
      this.anim.right.snapPrimed = !!b;
    }
  }

  triggerFire(kind, slot = 'right') {
    const a = this.anim[slot];
    if (!a) return;
    if (kind === 'flame') a.snapAnim = 0.22;
    else if (kind === 'magicBolt') a.boltAnim = 0.18;
    else if (kind === 'fistAir') a.recoilAnim = 0.24;
    else if (kind === 'slash') a.swingAnim = 0.40;
  }

  setVisible(v) { this.group.visible = v; }
  fire() { /* legacy compat */ }
  setWeapon() { /* legacy compat */ }

  getMuzzleWorldPosition(slot = 'right') {
    return this.getSparkWorldPosition(slot);
  }

  getSparkWorldPosition(slot = 'right' /*, aimNDC */) {
    // Back-compat: if first arg looks like NDC ({x,y}) instead of slot string,
    // treat it as the legacy single-slot call and use the right hand.
    if (typeof slot === 'object') slot = 'right';
    const id = this.characters[slot];
    const hand = this.handsBySlot[slot]?.[id];
    if (!hand) return new THREE.Vector3();
    const local = (hand.userData.sparkLocal || new THREE.Vector3()).clone();
    const anchor = hand.userData.sparkAnchor || hand;
    anchor.localToWorld(local);
    return local;
  }

  update(dt) {
    this.t += dt;
    for (const slot of ['left', 'right']) {
      const a = this.anim[slot];
      if (a.snapAnim > 0) a.snapAnim = Math.max(0, a.snapAnim - dt);
      if (a.recoilAnim > 0) a.recoilAnim = Math.max(0, a.recoilAnim - dt);
      if (a.swingAnim > 0) a.swingAnim = Math.max(0, a.swingAnim - dt);
      if (a.boltAnim > 0) a.boltAnim = Math.max(0, a.boltAnim - dt);

      const id = this.characters[slot];
      const active = this.handsBySlot[slot]?.[id];
      if (!active || !active.visible) continue;
      this._animateHand(id, active, a, dt);
    }
  }

  _animateHand(id, active, a, dt) {
    const base = active.userData.basePos;
    const baseRot = active.userData.baseRot;
    if (!base || !baseRot) return;

    const bob = Math.sin(this.t * 1.6) * 0.004;
    active.position.y = base.y + bob;

    if (id === 'flame_colonel') {
      const midPiv = active.userData.midPivot;
      const thumbPiv = active.userData.thumbPivot;
      const spark = active.userData.spark;
      const primed = a.snapPrimed ? 1 : 0;
      a.smoothPrimed += (primed - a.smoothPrimed) * Math.min(1, dt * 12);
      const fireU = a.snapAnim > 0 ? a.snapAnim / 0.22 : 0;
      const openBoost = fireU;
      if (midPiv) midPiv.rotation.x = 0.55 + a.smoothPrimed * 0.25 - openBoost * 0.6;
      if (thumbPiv) thumbPiv.rotation.z = -0.6 - a.smoothPrimed * 0.15 - openBoost * 0.4;
      if (spark) {
        spark.material.opacity = Math.max(a.smoothPrimed * 0.55, fireU * 0.95);
        spark.scale.setScalar(0.7 + a.smoothPrimed * 0.4 + fireU * 1.0);
      }
      active.position.x = base.x;
      active.rotation.copy(baseRot);
    } else if (id === 'pink_alchemist') {
      const glow = active.userData.glow;
      if (glow) {
        const u = a.boltAnim > 0 ? a.boltAnim / 0.18 : 0;
        glow.material.opacity = 0.45 + u * 0.45 + Math.sin(this.t * 6) * 0.05;
        glow.scale.setScalar(1 + u * 0.4 + Math.sin(this.t * 8) * 0.05);
      }
      active.position.x = base.x;
      active.rotation.copy(baseRot);
    } else if (id === 'martial_artist') {
      const u = a.recoilAnim > 0 ? a.recoilAnim / 0.24 : 0;
      const phase = 1 - u;
      let thrust;
      if (phase < 0.30) thrust = phase / 0.30;
      else thrust = 1 - (phase - 0.30) / 0.70;
      thrust = Math.max(0, Math.min(1, thrust));
      active.position.x = base.x;
      active.position.y = base.y + bob;
      active.position.z = base.z - thrust * 0.18;
      active.rotation.x = baseRot.x + thrust * 0.05;
      active.rotation.z = baseRot.z - thrust * 0.05;
      const aura = active.userData.aura;
      if (aura) {
        aura.material.opacity = 0.25 + thrust * 0.65;
        aura.scale.setScalar(0.7 + thrust * 1.6);
      }
    } else if (id === 'sword_kirito') {
      const u = a.swingAnim > 0 ? a.swingAnim / 0.40 : 0;
      const phase = 1 - u;
      let swing;
      if (phase < 0.30) swing = phase / 0.30;
      else swing = 1 - (phase - 0.30) / 0.70;
      swing = Math.max(0, Math.min(1, swing));
      active.rotation.x = baseRot.x + swing * 1.6;
      active.rotation.z = baseRot.z - swing * 0.3;
      active.position.x = base.x + swing * 0.05;
      const edge = active.userData.edge;
      if (edge) edge.material.opacity = 0.35 + swing * 0.55;
      const tipLight = active.userData.tipLight;
      if (tipLight) tipLight.intensity = 0.6 + swing * 1.4;
    }
  }
}
