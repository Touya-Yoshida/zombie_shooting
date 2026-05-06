import * as THREE from 'three';

const _vTmp = new THREE.Vector3();
const _vTmp2 = new THREE.Vector3();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracerPool = [];
    this.bloodParticles = [];
    this.fireballs = [];
    this.bursts = [];
    this.burns = [];
    this.missiles = [];
    this.repulsors = [];
    this.lockMarkers = [];
    this.slashes = [];
    this.bullets = [];
    this.maxTracers = 32;
    this._initTracerPool();
  }

  spawnSlash(origin, forward, opts = {}) {
    const speed = opts.speed ?? 32;
    const damage = opts.damage ?? 55;
    const lifetime = opts.lifetime ?? 0.7;
    const width = opts.width ?? 4.0;
    const height = opts.height ?? 1.6;
    const hitWidth = opts.hitWidth ?? width * 0.5;
    const onHit = opts.onHit;

    const group = new THREE.Group();
    group.position.copy(origin);
    const dir = forward.clone();
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
    dir.normalize();
    group.lookAt(_vTmp.copy(origin).add(dir));

    // Curved slash plane (use a bent ribbon — multiple stacked planes for illusion of arc)
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height, 12, 1),
      new THREE.MeshBasicMaterial({
        color: 0xb0e8ff,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    // Curve the plane vertices
    const pos = blade.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const u = x / (width / 2);
      pos.setZ(i, -Math.cos(u * Math.PI / 2) * 0.45);
    }
    pos.needsUpdate = true;
    blade.geometry.computeVertexNormals();
    group.add(blade);

    // Edge highlight (thinner, brighter)
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height * 0.35, 12, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    const epos = edge.geometry.attributes.position;
    for (let i = 0; i < epos.count; i++) {
      const x = epos.getX(i);
      const u = x / (width / 2);
      epos.setZ(i, -Math.cos(u * Math.PI / 2) * 0.45);
    }
    epos.needsUpdate = true;
    group.add(edge);

    const light = new THREE.PointLight(0x66ccff, 2.5, 10, 2);
    group.add(light);

    this.scene.add(group);

    this.slashes.push({
      group, blade, edge, light,
      velocity: dir.clone().multiplyScalar(speed),
      forward: dir,
      damage,
      hitWidth,
      lifetime, maxLife: lifetime,
      onHit,
      hitZombies: new Set(),
      _t: 0
    });
  }

  spawnBullet(origin, target, opts = {}) {
    // Hitscan-like instant tracer + impact, with damage applied immediately.
    const damage = opts.damage ?? 80;
    const onHit = opts.onHit;
    const tracerColor = opts.tracerColor ?? 0xffd066;
    const tracerLen = opts.tracerLen ?? 1.4;

    const dir = target.clone().sub(origin);
    const dist = dir.length();
    if (dist < 0.01) return;
    dir.normalize();

    // Tracer line
    const segments = Math.min(8, Math.ceil(dist / tracerLen));
    for (let i = 0; i < segments; i++) {
      const a = origin.clone().add(dir.clone().multiplyScalar(dist * i / segments));
      const b = origin.clone().add(dir.clone().multiplyScalar(dist * (i + 1) / segments));
      this.spawnTracer(a, b);
    }

    // Muzzle flash
    const flashGeom = new THREE.SphereGeometry(0.16, 8, 6);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe49a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flash = new THREE.Mesh(flashGeom, flashMat);
    flash.position.copy(origin);
    this.scene.add(flash);
    this.bursts.push({ mesh: flash, lifetime: 0.10, maxLife: 0.10, scaleEnd: 2.6 });

    if (opts.zombie) {
      this.spawnBurst(target.clone(), { count: 16, radius: 0.3, speed: 5, lifetime: 0.4 });
      if (onHit) onHit(opts.zombie, damage, target.clone());
    }
  }

  _initTracerPool() {
    const mat = new THREE.LineBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    for (let i = 0; i < this.maxTracers; i++) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
      const line = new THREE.Line(geom, mat.clone());
      line.visible = false;
      line.userData.lifetime = 0;
      this.scene.add(line);
      this.tracerPool.push(line);
    }
  }

  spawnTracer(from, to) {
    const line = this.tracerPool.find((l) => !l.visible) || this.tracerPool[0];
    const positions = line.geometry.attributes.position.array;
    positions[0] = from.x;
    positions[1] = from.y;
    positions[2] = from.z;
    positions[3] = to.x;
    positions[4] = to.y;
    positions[5] = to.z;
    line.geometry.attributes.position.needsUpdate = true;
    line.material.opacity = 1;
    line.visible = true;
    line.userData.lifetime = 0.08;
  }

  spawnFireball(origin, direction, opts = {}) {
    const speed = opts.speed ?? 36;
    const radius = opts.radius ?? 0.42;
    const damage = opts.damage ?? 70;
    const lifetime = opts.lifetime ?? 1.8;
    const hitRadius = opts.hitRadius ?? 1.0;
    const colors = opts.colors || { core: 0xfff2b0, halo: 0xff8024, outer: 0xff3a08, light: 0xff9040 };
    const lightIntensity = opts.lightIntensity ?? 2.4;
    const lightRange = opts.lightRange ?? 8;
    const burstColors = opts.burstColors || { hot: 0xfff5b0, cold: 0xff5018 };
    const burstFlash = opts.burstFlash ?? 0xfff0c0;
    const burstScale = opts.burstScale ?? 1.0;
    const trailColors = opts.trailColors || { hot: 0xfff0a0, cold: 0xff6020 };
    const onHit = opts.onHit;
    const onMiss = opts.onMiss;

    const group = new THREE.Group();
    group.position.copy(origin);

    const coreMat = new THREE.MeshBasicMaterial({
      color: colors.core,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), coreMat);
    group.add(core);

    const haloMat = new THREE.MeshBasicMaterial({
      color: colors.halo,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.7, 14, 10), haloMat);
    group.add(halo);

    const outerMat = new THREE.MeshBasicMaterial({
      color: colors.outer,
      transparent: true,
      opacity: 0.30,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const outer = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.6, 12, 8), outerMat);
    group.add(outer);

    const light = new THREE.PointLight(colors.light, lightIntensity, lightRange, 2);
    group.add(light);
    this.scene.add(group);

    const dir = direction.clone();
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
    dir.normalize();

    this.fireballs.push({
      group, core, halo, outer, light,
      velocity: dir.multiplyScalar(speed),
      radius, hitRadius, damage,
      lifetime, maxLife: lifetime,
      trailTimer: 0, hit: false,
      onHit, onMiss,
      burstColors, burstFlash, burstScale,
      trailColors,
      _t: 0
    });
  }

  spawnFistAir(origin, direction, opts = {}) {
    const speed = opts.speed ?? 44;
    const damage = opts.damage ?? 55;
    const lifetime = opts.lifetime ?? 1.4;
    const hitRadius = opts.hitRadius ?? 0.85;
    const onHit = opts.onHit;

    const dir = direction.clone();
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
    dir.normalize();

    const group = new THREE.Group();
    group.position.copy(origin);
    group.lookAt(_vTmp.copy(origin).add(dir));

    // Fist body — a stout box rounded by a sphere overlay
    const fistMat = new THREE.MeshBasicMaterial({
      color: 0xeaf6ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.32), fistMat);
    group.add(palm);
    const palmCap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), fistMat);
    palmCap.position.set(0, 0, -0.14);
    group.add(palmCap);

    // Knuckle row on the leading face
    for (let i = 0; i < 4; i++) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), fistMat);
      k.position.set(-0.15 + i * 0.10, 0.06, -0.22);
      group.add(k);
    }

    // Thumb wrap
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.20, 0.12), fistMat);
    thumb.position.set(-0.22, -0.04, -0.10);
    group.add(thumb);

    // Air swirl halo (large, faint)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xa8e8ff,
      transparent: true,
      opacity: 0.40,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 10), haloMat);
    group.add(halo);

    // Outer pressure wave ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x66c8ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 10, 24), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.05;
    group.add(ring);

    const light = new THREE.PointLight(0xa8d8ff, 1.6, 6, 2);
    group.add(light);

    this.scene.add(group);

    this.fistAirs = this.fistAirs || [];
    this.fistAirs.push({
      group, palm, palmCap, halo, ring, light,
      velocity: dir.clone().multiplyScalar(speed),
      forward: dir.clone(),
      damage, hitRadius,
      lifetime, maxLife: lifetime,
      onHit,
      hit: false,
      _t: 0
    });
  }

  spawnMagicBolt(origin, direction, opts = {}) {
    this.spawnFireball(origin, direction, {
      speed: 56,
      radius: 0.18,
      damage: 22,
      lifetime: 1.0,
      hitRadius: 0.7,
      colors: {
        core: 0xffe6ff,
        halo: 0xff66cc,
        outer: 0xa01e88,
        light: 0xff44aa
      },
      lightIntensity: 1.4,
      lightRange: 5,
      burstColors: { hot: 0xffe0ff, cold: 0xa01e88 },
      burstFlash: 0xffd0f0,
      burstScale: 0.5,
      trailColors: { hot: 0xffd6ff, cold: 0xb02288 },
      ...opts
    });
  }

  spawnMissile(origin, targetZombie, opts = {}) {
    const speed = opts.speed ?? 30;
    const damage = opts.damage ?? 55;
    const lifetime = opts.lifetime ?? 3.0;
    const turnRate = opts.turnRate ?? 6.0;
    const hitRadius = opts.hitRadius ?? 0.85;
    const onHit = opts.onHit;

    const group = new THREE.Group();
    group.position.copy(origin);

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.06, 0.42, 10),
      new THREE.MeshLambertMaterial({ color: 0x9aa4b6 })
    );
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.16, 10),
      new THREE.MeshBasicMaterial({ color: 0xff5022 })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -0.28;
    group.add(nose);

    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xc0d0e0 })
    );
    fin.position.z = 0.16;
    group.add(fin);

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffd266,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    flame.position.z = 0.30;
    flame.scale.set(0.9, 0.9, 1.6);
    group.add(flame);

    const light = new THREE.PointLight(0xff9050, 1.4, 5, 2);
    light.position.z = 0.2;
    group.add(light);

    this.scene.add(group);

    const initialDir = new THREE.Vector3();
    if (targetZombie?.mesh) {
      initialDir.copy(targetZombie.mesh.position).add(_vTmp.set(0, 1.0, 0)).sub(origin).normalize();
    } else {
      initialDir.set(0, 0, -1);
    }

    this.missiles.push({
      group, body, nose, fin, flame, light,
      velocity: initialDir.multiplyScalar(speed),
      speed,
      target: targetZombie,
      lastTargetPos: targetZombie?.mesh
        ? new THREE.Vector3(
            targetZombie.mesh.position.x,
            targetZombie.mesh.position.y + 1.0,
            targetZombie.mesh.position.z
          )
        : new THREE.Vector3(0, 1.5, -10),
      damage,
      hitRadius,
      lifetime,
      maxLife: lifetime,
      turnRate,
      onHit,
      trailTimer: 0,
      hit: false,
      _t: 0
    });
  }

  spawnRepulsorWave(origin, forwardDir, opts = {}) {
    const maxRadius = opts.maxRadius ?? 9;
    const damage = opts.damage ?? 38;
    const angle = opts.angle ?? Math.PI * 0.66;
    const duration = opts.duration ?? 0.5;
    const onHit = opts.onHit;
    const color = opts.color ?? 0x66ddff;
    const innerColor = opts.innerColor ?? 0xaaeeff;

    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.18, 12, 36),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    torus.position.copy(origin);
    torus.lookAt(_vTmp.copy(origin).add(forwardDir));
    this.scene.add(torus);

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 12, 10),
      new THREE.MeshBasicMaterial({
        color: innerColor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    inner.position.copy(origin);
    this.scene.add(inner);

    const light = new THREE.PointLight(color, 3.5, 12, 2);
    light.position.copy(origin);
    this.scene.add(light);

    this.repulsors.push({
      torus, inner, light,
      origin: origin.clone(),
      forward: forwardDir.clone().normalize(),
      maxRadius,
      duration, maxDuration: duration,
      angle, damage,
      onHit,
      hitZombies: new Set()
    });
  }

  spawnLockMarker(zombie) {
    if (!zombie || !zombie.mesh) return;
    // Don't double-attach
    for (const lm of this.lockMarkers) {
      if (lm.zombie === zombie) return;
    }
    const grp = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.55, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff3344,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      })
    );
    grp.add(ring);

    // 4 small corner brackets rotating
    const bracketMat = new THREE.MeshBasicMaterial({
      color: 0xff5566,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
    const corners = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.04), bracketMat);
      const a = (i / 4) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0);
      b.rotation.z = a;
      corners.add(b);
    }
    grp.add(corners);

    grp.position.set(0, 2.3, 0);
    grp.userData.corners = corners;
    grp.userData.ring = ring;
    zombie.mesh.add(grp);

    this.lockMarkers.push({ marker: grp, zombie, _t: 0 });
  }

  removeLockMarker(zombie) {
    for (let i = this.lockMarkers.length - 1; i >= 0; i--) {
      const lm = this.lockMarkers[i];
      if (lm.zombie === zombie) {
        if (lm.zombie?.mesh) lm.zombie.mesh.remove(lm.marker);
        lm.marker.traverse((n) => {
          if (n.geometry) n.geometry.dispose();
          if (n.material) n.material.dispose();
        });
        this.lockMarkers.splice(i, 1);
      }
    }
  }

  _spawnTrailPuff(position, baseRadius, colors) {
    const cFrom = new THREE.Color(colors?.hot ?? 0xfff0a0);
    const cTo = new THREE.Color(colors?.cold ?? 0xff6020);
    const count = 4;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const cArr = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x + (Math.random() - 0.5) * baseRadius * 0.4;
      positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * baseRadius * 0.4;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * baseRadius * 0.4;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 1.2 + 0.3,
        (Math.random() - 0.5) * 1.5
      ));
      const t = Math.random();
      const c = cFrom.clone().lerp(cTo, t);
      cArr[i * 3] = c.r;
      cArr[i * 3 + 1] = c.g;
      cArr[i * 3 + 2] = c.b;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
    const mat = new THREE.PointsMaterial({
      size: baseRadius * 1.4,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.bursts.push({ mesh: points, velocities, lifetime: 0.45, maxLife: 0.45, gravity: 0 });
  }

  _spawnSmokeTrailPuff(position) {
    const count = 3;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const cArr = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.18;
      positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.18;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.18;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        Math.random() * 0.3 + 0.05,
        (Math.random() - 0.5) * 0.6
      ));
      const g = 0.6 + Math.random() * 0.3;
      cArr[i * 3] = g;
      cArr[i * 3 + 1] = g;
      cArr[i * 3 + 2] = g;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.32,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.bursts.push({ mesh: points, velocities, lifetime: 0.55, maxLife: 0.55, gravity: -0.4 });
  }

  spawnBurst(position, opts = {}) {
    const count = opts.count ?? 28;
    const baseRadius = opts.radius ?? 0.5;
    const speed = opts.speed ?? 6;
    const lifetime = opts.lifetime ?? 0.55;
    const colors = opts.colors || { hot: 0xfff5b0, cold: 0xff5018 };
    const flashColor = opts.flashColor ?? 0xfff0c0;
    const cHot = new THREE.Color(colors.hot);
    const cCold = new THREE.Color(colors.cold);

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const cArr = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const s = (0.3 + Math.random() * 0.7) * speed;
      velocities.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * s,
        Math.cos(phi) * s + 1.5,
        Math.sin(phi) * Math.sin(theta) * s
      ));
      const t = Math.random();
      const c = cHot.clone().lerp(cCold, t);
      cArr[i * 3] = c.r;
      cArr[i * 3 + 1] = c.g;
      cArr[i * 3 + 2] = c.b;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
    const mat = new THREE.PointsMaterial({
      size: baseRadius * 1.2,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.bursts.push({ mesh: points, velocities, lifetime, maxLife: lifetime, gravity: 2.5 });

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 1.6, 12, 10),
      new THREE.MeshBasicMaterial({
        color: flashColor,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    flash.position.copy(position);
    this.scene.add(flash);
    this.bursts.push({ mesh: flash, lifetime: 0.18, maxLife: 0.18, scaleEnd: 2.4 });
  }

  igniteZombie(zombie, opts = {}) {
    if (!zombie || !zombie.mesh || zombie.isDead?.()) return;
    const duration = opts.duration ?? 2.6;
    const tickDmg = opts.tickDamage ?? 12;
    const tickInterval = opts.tickInterval ?? 0.4;
    const onKill = opts.onKill;

    const PARTICLES = 24;
    const positions = new Float32Array(PARTICLES * 3);
    const colors = new Float32Array(PARTICLES * 3);
    const meta = [];
    const colHot = new THREE.Color(0xfff2b0);
    const colMid = new THREE.Color(0xff7a20);
    const colCool = new THREE.Color(0x801800);
    for (let i = 0; i < PARTICLES; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = Math.random() * 1.0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      const c = colHot.clone().lerp(colMid, Math.random());
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      meta.push({
        life: Math.random() * 0.6,
        maxLife: 0.6 + Math.random() * 0.3,
        vy: 1.4 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.6,
        vz: (Math.random() - 0.5) * 0.6,
        baseX: (Math.random() - 0.5) * 0.4,
        baseZ: (Math.random() - 0.5) * 0.35
      });
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.42,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geom, mat);
    points.position.set(0, 0.6, 0);
    zombie.mesh.add(points);

    const light = new THREE.PointLight(0xff7030, 1.6, 4, 2);
    light.position.set(0, 1.2, 0);
    zombie.mesh.add(light);

    const originalColors = [];
    zombie.mesh.traverse((n) => {
      if (n.isMesh && n.material && n.material.color) {
        originalColors.push({ mat: n.material, color: n.material.color.clone() });
        n.material.color.lerp(new THREE.Color(0xff5020), 0.35);
      }
    });

    this.burns.push({
      zombie, points, meta, light, originalColors,
      duration, maxDuration: duration,
      tickDmg, tickInterval, tickAccum: 0,
      onKill,
      colHot, colMid, colCool
    });
  }

  spawnBlood(at) {
    const count = 10;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = at.x;
      positions[i * 3 + 1] = at.y;
      positions[i * 3 + 2] = at.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2 + 1,
        (Math.random() - 0.5) * 3
      ));
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaa1010,
      size: 0.08,
      transparent: true,
      opacity: 1,
      depthWrite: false
    });
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    this.bloodParticles.push({ points, velocities, lifetime: 0.6, maxLife: 0.6 });
  }

  update(dt, ctx = {}) {
    const zombies = ctx.zombies || [];
    const camera = ctx.camera || null;

    for (const line of this.tracerPool) {
      if (!line.visible) continue;
      line.userData.lifetime -= dt;
      if (line.userData.lifetime <= 0) {
        line.visible = false;
      } else {
        line.material.opacity = line.userData.lifetime / 0.08;
      }
    }

    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
      const p = this.bloodParticles[i];
      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        this.bloodParticles.splice(i, 1);
        continue;
      }
      const positions = p.points.geometry.attributes.position.array;
      for (let j = 0; j < p.velocities.length; j++) {
        const v = p.velocities[j];
        v.y -= 9.8 * dt;
        positions[j * 3] += v.x * dt;
        positions[j * 3 + 1] += v.y * dt;
        positions[j * 3 + 2] += v.z * dt;
      }
      p.points.geometry.attributes.position.needsUpdate = true;
      p.points.material.opacity = p.lifetime / p.maxLife;
    }

    this._updateFireballs(dt, zombies);
    this._updateMissiles(dt, zombies);
    this._updateRepulsors(dt, zombies);
    this._updateSlashes(dt, zombies);
    this._updateFistAirs(dt, zombies);
    this._updateBursts(dt);
    this._updateBurns(dt);
    this._updateLockMarkers(dt, camera);
  }

  _updateFistAirs(dt, zombies) {
    if (!this.fistAirs || this.fistAirs.length === 0) return;
    for (let i = this.fistAirs.length - 1; i >= 0; i--) {
      const f = this.fistAirs[i];
      f._t += dt;
      f.lifetime -= dt;

      if (!f.hit) {
        f.group.position.x += f.velocity.x * dt;
        f.group.position.y += f.velocity.y * dt;
        f.group.position.z += f.velocity.z * dt;

        // Animate halo + ring (visual wind pressure)
        const pulse = 1 + 0.10 * Math.sin(f._t * 26);
        f.palm.scale.setScalar(pulse);
        f.palmCap.scale.setScalar(pulse);
        f.halo.scale.setScalar(1 + 0.20 * Math.sin(f._t * 18));
        f.ring.rotation.z += dt * 9;
        f.ring.scale.setScalar(1 + f._t * 0.6);
        f.light.intensity = 1.6 + Math.sin(f._t * 24) * 0.3;

        // Fade ring as it expands
        f.ring.material.opacity = Math.max(0, 0.55 - f._t * 0.4);

        let hit = null;
        const hitR = f.hitRadius;
        const hitR2 = hitR * hitR;
        for (const z of zombies) {
          if (!z || z.isDead?.() || z.state === 'dying' || !z.mesh) continue;
          const dx = f.group.position.x - z.mesh.position.x;
          const dy = f.group.position.y - (z.mesh.position.y + 1.0);
          const dz = f.group.position.z - z.mesh.position.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < hitR2) { hit = z; break; }
        }

        if (hit) {
          f.hit = true;
          this.spawnBurst(f.group.position.clone(), {
            count: 22,
            radius: 0.5,
            speed: 6,
            lifetime: 0.45,
            colors: { hot: 0xeaf6ff, cold: 0x4080a0 },
            flashColor: 0xcce8ff
          });
          if (f.onHit) f.onHit(hit, f.damage, f.group.position.clone());
        }
      }

      if (f.hit || f.lifetime <= 0) {
        this.scene.remove(f.group);
        f.group.traverse((n) => {
          if (n.geometry) n.geometry.dispose?.();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
            else n.material.dispose?.();
          }
        });
        this.fistAirs.splice(i, 1);
      }
    }
  }

  _updateSlashes(dt, zombies) {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s._t += dt;
      s.lifetime -= dt;

      s.group.position.x += s.velocity.x * dt;
      s.group.position.y += s.velocity.y * dt;
      s.group.position.z += s.velocity.z * dt;

      const k = Math.max(0, s.lifetime / s.maxLife);
      s.blade.material.opacity = 0.9 * k;
      s.edge.material.opacity = 0.95 * k;
      s.light.intensity = 2.5 * k;
      // Slight stretch over time
      const stretch = 1 + (1 - k) * 0.2;
      s.blade.scale.x = stretch;
      s.edge.scale.x = stretch;

      // Hit detection: any zombie within hitWidth of slash center on its forward path
      for (const z of zombies) {
        if (!z || z.isDead?.() || s.hitZombies.has(z)) continue;
        const dx = z.mesh.position.x - s.group.position.x;
        const dy = (z.mesh.position.y + 1.0) - s.group.position.y;
        const dz = z.mesh.position.z - s.group.position.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < s.hitWidth * s.hitWidth) {
          s.hitZombies.add(z);
          if (s.onHit) s.onHit(z, s.damage, z.mesh.position.clone());
        }
      }

      if (s.lifetime <= 0) {
        this.scene.remove(s.group);
        s.group.traverse((n) => {
          if (n.geometry) n.geometry.dispose?.();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
            else n.material.dispose?.();
          }
        });
        this.slashes.splice(i, 1);
      }
    }
  }

  _updateFireballs(dt, zombies) {
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      f._t += dt;
      f.lifetime -= dt;

      const pulse = 1 + 0.12 * Math.sin(f._t * 28);
      f.core.scale.setScalar(pulse);
      f.halo.scale.setScalar(1 + 0.18 * Math.sin(f._t * 22 + 1));
      f.halo.rotation.y += dt * 4;
      f.outer.rotation.y -= dt * 3;
      f.light.intensity = 2.4 + Math.sin(f._t * 30) * 0.6;

      if (!f.hit) {
        f.group.position.x += f.velocity.x * dt;
        f.group.position.y += f.velocity.y * dt;
        f.group.position.z += f.velocity.z * dt;

        f.trailTimer -= dt;
        if (f.trailTimer <= 0) {
          this._spawnTrailPuff(f.group.position, f.radius, f.trailColors);
          f.trailTimer = 0.025;
        }

        let hitZombie = null;
        const hitR = f.hitRadius + f.radius;
        const hitR2 = hitR * hitR;
        for (const z of zombies) {
          if (!z || z.isDead?.() || z.state === 'dying') continue;
          if (!z.mesh) continue;
          const dx = f.group.position.x - z.mesh.position.x;
          const dy = f.group.position.y - (z.mesh.position.y + 1.0);
          const dz = f.group.position.z - z.mesh.position.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < hitR2) { hitZombie = z; break; }
        }

        if (hitZombie) {
          f.hit = true;
          this.spawnBurst(f.group.position.clone(), {
            count: Math.floor(32 * f.burstScale),
            radius: 0.6 * f.burstScale,
            speed: 7,
            lifetime: 0.6,
            colors: f.burstColors,
            flashColor: f.burstFlash
          });
          if (f.onHit) f.onHit(hitZombie, f.damage, f.group.position.clone());
        } else if (f.lifetime <= 0) {
          this.spawnBurst(f.group.position.clone(), {
            count: Math.floor(18 * f.burstScale),
            radius: 0.4 * f.burstScale,
            speed: 4,
            lifetime: 0.4,
            colors: f.burstColors,
            flashColor: f.burstFlash
          });
          if (f.onMiss) f.onMiss(f.group.position.clone());
        }
      }

      if (f.hit || f.lifetime <= 0) {
        this.scene.remove(f.group);
        f.group.traverse((n) => {
          if (n.geometry) n.geometry.dispose?.();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
            else n.material.dispose?.();
          }
        });
        this.fireballs.splice(i, 1);
      }
    }
  }

  _updateMissiles(dt, zombies) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m._t += dt;
      m.lifetime -= dt;

      m.flame.scale.set(0.9, 0.9, 1.4 + Math.random() * 0.6);

      if (!m.hit) {
        // Determine target position (track if alive)
        let tx, ty, tz;
        if (m.target?.mesh && !m.target.isDead?.()) {
          tx = m.target.mesh.position.x;
          ty = m.target.mesh.position.y + 1.0;
          tz = m.target.mesh.position.z;
          m.lastTargetPos.set(tx, ty, tz);
        } else {
          tx = m.lastTargetPos.x;
          ty = m.lastTargetPos.y;
          tz = m.lastTargetPos.z;
        }

        // Steer toward target
        const desiredX = tx - m.group.position.x;
        const desiredY = ty - m.group.position.y;
        const desiredZ = tz - m.group.position.z;
        const dLen = Math.hypot(desiredX, desiredY, desiredZ);
        if (dLen > 1e-3) {
          const dx = (desiredX / dLen) * m.speed;
          const dy = (desiredY / dLen) * m.speed;
          const dz = (desiredZ / dLen) * m.speed;
          // steer = desired - velocity, capped to maxSteer
          let sx = dx - m.velocity.x;
          let sy = dy - m.velocity.y;
          let sz = dz - m.velocity.z;
          const sLen = Math.hypot(sx, sy, sz);
          const maxSteer = m.turnRate * m.speed * dt;
          if (sLen > maxSteer) {
            sx = (sx / sLen) * maxSteer;
            sy = (sy / sLen) * maxSteer;
            sz = (sz / sLen) * maxSteer;
          }
          m.velocity.x += sx;
          m.velocity.y += sy;
          m.velocity.z += sz;
          // Re-normalize to maintain speed
          const vLen = m.velocity.length();
          if (vLen > 1e-6) m.velocity.multiplyScalar(m.speed / vLen);
        }

        // Move
        m.group.position.x += m.velocity.x * dt;
        m.group.position.y += m.velocity.y * dt;
        m.group.position.z += m.velocity.z * dt;

        // Orient
        _vTmp.copy(m.group.position).add(m.velocity);
        m.group.lookAt(_vTmp);

        // Trail
        m.trailTimer -= dt;
        if (m.trailTimer <= 0) {
          _vTmp2.set(0, 0, 0.25).applyMatrix4(m.group.matrixWorld);
          this._spawnSmokeTrailPuff(_vTmp2);
          this._spawnTrailPuff(_vTmp2, 0.18, { hot: 0xffd266, cold: 0xff4422 });
          m.trailTimer = 0.035;
        }

        // Hit detection
        let hitZombie = null;
        const hitR2 = m.hitRadius * m.hitRadius;
        for (const z of zombies) {
          if (!z || z.isDead?.() || z.state === 'dying') continue;
          if (!z.mesh) continue;
          const dx = m.group.position.x - z.mesh.position.x;
          const dy = m.group.position.y - (z.mesh.position.y + 1.0);
          const dz = m.group.position.z - z.mesh.position.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < hitR2) { hitZombie = z; break; }
        }

        if (hitZombie) {
          m.hit = true;
          this.spawnBurst(m.group.position.clone(), {
            count: 28, radius: 0.55, speed: 7, lifetime: 0.6
          });
          if (m.onHit) m.onHit(hitZombie, m.damage, m.group.position.clone());
        } else if (m.lifetime <= 0) {
          this.spawnBurst(m.group.position.clone(), {
            count: 18, radius: 0.4, speed: 5, lifetime: 0.45
          });
        }
      }

      if (m.hit || m.lifetime <= 0) {
        this.scene.remove(m.group);
        m.group.traverse((n) => {
          if (n.geometry) n.geometry.dispose?.();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach((mt) => mt.dispose());
            else n.material.dispose?.();
          }
        });
        this.missiles.splice(i, 1);
      }
    }
  }

  _updateRepulsors(dt, zombies) {
    for (let i = this.repulsors.length - 1; i >= 0; i--) {
      const r = this.repulsors[i];
      r.duration -= dt;
      const t = 1 - Math.max(0, r.duration / r.maxDuration);
      const radius = t * r.maxRadius;
      r.torus.scale.setScalar(Math.max(0.001, radius / 0.6));
      r.torus.material.opacity = 0.95 * (1 - t);
      r.inner.scale.setScalar(0.6 + t * 1.4);
      r.inner.material.opacity = 0.9 * Math.max(0, 1 - t * 1.7);
      r.light.intensity = 3.5 * (1 - t);

      const cosThresh = Math.cos(r.angle / 2);
      for (const z of zombies) {
        if (!z || z.isDead?.() || r.hitZombies.has(z)) continue;
        const zx = z.mesh.position.x - r.origin.x;
        const zy = z.mesh.position.y + 1.0 - r.origin.y;
        const zz = z.mesh.position.z - r.origin.z;
        const d2 = zx * zx + zy * zy + zz * zz;
        if (d2 > radius * radius) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-3) {
          const dot = (zx * r.forward.x + zy * r.forward.y + zz * r.forward.z) / d;
          if (dot < cosThresh) continue;
        }
        r.hitZombies.add(z);
        // Knockback
        const knockX = (zx / Math.max(d, 0.01)) * 1.4;
        const knockZ = (zz / Math.max(d, 0.01)) * 1.4;
        z.mesh.position.x += knockX;
        z.mesh.position.z += knockZ;
        if (r.onHit) r.onHit(z, r.damage, z.mesh.position.clone());
      }

      if (r.duration <= 0) {
        this.scene.remove(r.torus);
        this.scene.remove(r.inner);
        this.scene.remove(r.light);
        r.torus.geometry.dispose();
        r.torus.material.dispose();
        r.inner.geometry.dispose();
        r.inner.material.dispose();
        this.repulsors.splice(i, 1);
      }
    }
  }

  _updateBursts(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.lifetime -= dt;
      const k = Math.max(0, b.lifetime / b.maxLife);
      if (b.lifetime <= 0) {
        this.scene.remove(b.mesh);
        if (b.mesh.geometry) b.mesh.geometry.dispose();
        if (b.mesh.material) b.mesh.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      if (b.mesh.material) b.mesh.material.opacity = k * (b.mesh.material.userData?.baseOpacity ?? 1);
      if (b.scaleEnd) {
        const s = 1 + (1 - k) * (b.scaleEnd - 1);
        b.mesh.scale.setScalar(s);
      }
      if (b.velocities && b.mesh.geometry?.attributes?.position) {
        const positions = b.mesh.geometry.attributes.position.array;
        for (let j = 0; j < b.velocities.length; j++) {
          const v = b.velocities[j];
          v.y -= (b.gravity ?? 0) * dt;
          v.multiplyScalar(Math.max(0, 1 - dt * 1.4));
          positions[j * 3] += v.x * dt;
          positions[j * 3 + 1] += v.y * dt;
          positions[j * 3 + 2] += v.z * dt;
        }
        b.mesh.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  _updateBurns(dt) {
    for (let i = this.burns.length - 1; i >= 0; i--) {
      const burn = this.burns[i];
      burn.duration -= dt;
      const zombieGone = !burn.zombie || burn.zombie.isDead?.() || !burn.zombie.mesh || !burn.zombie.mesh.parent;

      if (!zombieGone && burn.zombie.state !== 'dying') {
        burn.tickAccum += dt;
        while (burn.tickAccum >= burn.tickInterval && burn.duration > 0) {
          burn.tickAccum -= burn.tickInterval;
          const killed = burn.zombie.takeHit(burn.tickDmg, false);
          if (killed && burn.onKill) burn.onKill(burn.zombie);
        }
      }

      const positions = burn.points.geometry.attributes.position.array;
      const colors = burn.points.geometry.attributes.color.array;
      for (let j = 0; j < burn.meta.length; j++) {
        const m = burn.meta[j];
        m.life += dt;
        if (m.life >= m.maxLife) {
          m.life = 0;
          positions[j * 3] = m.baseX;
          positions[j * 3 + 1] = 0;
          positions[j * 3 + 2] = m.baseZ;
        } else {
          positions[j * 3] += m.vx * dt * 0.4;
          positions[j * 3 + 1] += m.vy * dt;
          positions[j * 3 + 2] += m.vz * dt * 0.4;
        }
        const k = m.life / m.maxLife;
        const c = burn.colHot.clone().lerp(burn.colMid, k).lerp(burn.colCool, Math.max(0, k - 0.5) * 2);
        colors[j * 3] = c.r;
        colors[j * 3 + 1] = c.g;
        colors[j * 3 + 2] = c.b;
      }
      burn.points.geometry.attributes.position.needsUpdate = true;
      burn.points.geometry.attributes.color.needsUpdate = true;

      const fade = Math.max(0, Math.min(1, burn.duration / Math.min(0.6, burn.maxDuration)));
      burn.points.material.opacity = fade;
      burn.light.intensity = 1.6 * fade;

      if (burn.duration <= 0 || zombieGone) {
        if (burn.zombie?.mesh) {
          burn.zombie.mesh.remove(burn.points);
          burn.zombie.mesh.remove(burn.light);
        }
        burn.points.geometry.dispose();
        burn.points.material.dispose();
        for (const oc of burn.originalColors) {
          if (oc.mat?.color) oc.mat.color.copy(oc.color);
        }
        this.burns.splice(i, 1);
      }
    }
  }

  _updateLockMarkers(dt, camera) {
    for (let i = this.lockMarkers.length - 1; i >= 0; i--) {
      const lm = this.lockMarkers[i];
      lm._t += dt;
      const z = lm.zombie;
      if (!z || z.isDead?.() || !z.mesh || !z.mesh.parent) {
        if (z?.mesh) z.mesh.remove(lm.marker);
        lm.marker.traverse((n) => {
          if (n.geometry) n.geometry.dispose();
          if (n.material) n.material.dispose();
        });
        this.lockMarkers.splice(i, 1);
        continue;
      }

      // Billboard toward camera
      if (camera) {
        // Convert camera world position to zombie local
        z.mesh.updateMatrixWorld();
        const zInv = new THREE.Matrix4().copy(z.mesh.matrixWorld).invert();
        const camLocal = camera.position.clone().applyMatrix4(zInv);
        lm.marker.lookAt(camLocal);
      }
      const corners = lm.marker.userData.corners;
      if (corners) corners.rotation.z = lm._t * 2.4;
      const pulse = 1 + Math.sin(lm._t * 9) * 0.12;
      lm.marker.scale.setScalar(pulse);
    }
  }
}
