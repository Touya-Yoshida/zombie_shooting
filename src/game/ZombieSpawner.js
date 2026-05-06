import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Zombie } from './Zombie.js';

export class ZombieSpawner {
  constructor(scene, camera = null) {
    this.scene = scene;
    this.camera = camera;
    this.zombies = [];
    this.lastSpawnMs = 0;
    this.startTimeMs = 0;
    this._tmpPos = new THREE.Vector3();
    this.spawnIntervalMul = 1.0;
    this.maxConcurrentMul = 1.0;
  }

  // Clamp configured arc to the camera's actual horizontal FOV so zombies
  // never spawn outside the visible frustum (with a small inset so a zombie's
  // body sits comfortably inside the screen edge instead of half-clipped).
  _visibleArc() {
    const configured = CONFIG.ZOMBIES.SPAWN_FRONT_ARC_RAD ?? Math.PI;
    if (!this.camera) return configured;
    const vFov = (this.camera.fov ?? 70) * Math.PI / 180;
    const aspect = this.camera.aspect ?? (window.innerWidth / window.innerHeight);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const edgeMargin = 0.18; // ~10° inset on each side
    const visible = Math.max(0.4, hFov - edgeMargin * 2);
    return Math.min(configured, visible);
  }

  start(nowMs) {
    this.startTimeMs = nowMs;
    this.lastSpawnMs = nowMs - CONFIG.ZOMBIES.SPAWN_BASE_INTERVAL_MS * this.spawnIntervalMul;
  }

  setDifficultyMultipliers({ spawnInterval = 1.0, maxConcurrent = 1.0 } = {}) {
    this.spawnIntervalMul = spawnInterval;
    this.maxConcurrentMul = maxConcurrent;
  }

  reset() {
    for (const z of this.zombies) {
      this.scene.remove(z.mesh);
    }
    this.zombies = [];
  }

  computeInterval(nowMs) {
    const elapsedSec = (nowMs - this.startTimeMs) / 1000;
    const base = CONFIG.ZOMBIES.SPAWN_BASE_INTERVAL_MS - elapsedSec * CONFIG.ZOMBIES.SPAWN_INTERVAL_DECAY_PER_SEC;
    return Math.max(
      CONFIG.ZOMBIES.SPAWN_MIN_INTERVAL_MS * this.spawnIntervalMul,
      base * this.spawnIntervalMul
    );
  }

  _maxConcurrent() {
    return Math.max(4, Math.round(CONFIG.ZOMBIES.MAX_CONCURRENT * this.maxConcurrentMul));
  }

  update(dt, nowMs, playerPos, gameState, audio) {
    const interval = this.computeInterval(nowMs);
    const maxConc = this._maxConcurrent();
    const aliveCount = this.zombies.filter((z) => !z.isDead()).length;
    if (
      nowMs - this.lastSpawnMs > interval &&
      aliveCount < maxConc
    ) {
      const elapsedSec = (nowMs - this.startTimeMs) / 1000;
      let spawnCount = 1;
      if (elapsedSec > (CONFIG.ZOMBIES.BURST_AT_SEC_2 ?? Infinity)) {
        spawnCount += CONFIG.ZOMBIES.BURST_EXTRA_2 ?? 0;
      } else if (elapsedSec > (CONFIG.ZOMBIES.BURST_AT_SEC ?? Infinity)) {
        spawnCount += CONFIG.ZOMBIES.BURST_EXTRA ?? 0;
      }
      const room = maxConc - aliveCount;
      spawnCount = Math.min(spawnCount, room);
      for (let i = 0; i < spawnCount; i++) this.spawn(playerPos);
      this.lastSpawnMs = nowMs;
    }

    // Sort by horizontal (XZ) distance to player; only the N nearest in melee
    // range deal damage. Player has y ~= 1.7 while zombie origin is y=0, so we
    // must ignore the vertical gap or melee detection always fails.
    const maxAttackers = CONFIG.ZOMBIES.MAX_SIMULTANEOUS_ATTACKERS ?? 4;
    const sorted = this.zombies
      .filter((z) => !z.isDead())
      .map((z) => {
        const dx = playerPos.x - z.mesh.position.x;
        const dz = playerPos.z - z.mesh.position.z;
        return { z, d: Math.hypot(dx, dz) };
      })
      .sort((a, b) => a.d - b.d);
    let attackers = 0;
    for (const { z, d } of sorted) {
      const inMelee = d < CONFIG.ZOMBIES.MELEE_RANGE;
      const canAttack = inMelee && attackers < maxAttackers;
      if (canAttack) attackers++;
      z.update(dt, nowMs, playerPos, gameState, audio, canAttack);
    }
    this.zombies = this.zombies.filter((z) => !z.isDead());
  }

  spawn(playerPos) {
    // Spawn within a forward arc only (camera is fixed looking down -Z).
    // Arc is clamped to camera's actual horizontal FOV so spawns stay on-screen.
    const arc = this._visibleArc();
    const a = (Math.random() - 0.5) * arc;
    const radius =
      CONFIG.ZOMBIES.SPAWN_RADIUS_MIN +
      Math.random() * (CONFIG.ZOMBIES.SPAWN_RADIUS_MAX - CONFIG.ZOMBIES.SPAWN_RADIUS_MIN);
    this._tmpPos.set(
      playerPos.x + Math.sin(a) * radius,
      0,
      playerPos.z - Math.cos(a) * radius
    );
    const zombie = new Zombie(this.scene, this._tmpPos);
    this.zombies.push(zombie);
  }

  getMeshes() {
    return this.zombies
      .filter((z) => !z.isDead() && z.mesh)
      .map((z) => z.mesh);
  }
}
