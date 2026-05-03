import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Zombie } from './Zombie.js';

export class ZombieSpawner {
  constructor(scene) {
    this.scene = scene;
    this.zombies = [];
    this.lastSpawnMs = 0;
    this.startTimeMs = 0;
    this._tmpPos = new THREE.Vector3();
  }

  start(nowMs) {
    this.startTimeMs = nowMs;
    this.lastSpawnMs = nowMs - CONFIG.ZOMBIES.SPAWN_BASE_INTERVAL_MS;
  }

  reset() {
    for (const z of this.zombies) {
      this.scene.remove(z.mesh);
    }
    this.zombies = [];
  }

  computeInterval(nowMs) {
    const elapsedSec = (nowMs - this.startTimeMs) / 1000;
    return Math.max(
      CONFIG.ZOMBIES.SPAWN_MIN_INTERVAL_MS,
      CONFIG.ZOMBIES.SPAWN_BASE_INTERVAL_MS - elapsedSec * CONFIG.ZOMBIES.SPAWN_INTERVAL_DECAY_PER_SEC * 1000 / 1000
    );
  }

  update(dt, nowMs, playerPos, gameState, audio) {
    const interval = this.computeInterval(nowMs);
    const aliveCount = this.zombies.filter((z) => !z.isDead()).length;
    if (
      nowMs - this.lastSpawnMs > interval &&
      aliveCount < CONFIG.ZOMBIES.MAX_CONCURRENT
    ) {
      this.spawn(playerPos);
      this.lastSpawnMs = nowMs;
    }

    for (const z of this.zombies) {
      z.update(dt, nowMs, playerPos, gameState, audio);
    }
    this.zombies = this.zombies.filter((z) => !z.isDead());
  }

  spawn(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const radius =
      CONFIG.ZOMBIES.SPAWN_RADIUS_MIN +
      Math.random() * (CONFIG.ZOMBIES.SPAWN_RADIUS_MAX - CONFIG.ZOMBIES.SPAWN_RADIUS_MIN);
    this._tmpPos.set(
      playerPos.x + Math.cos(angle) * radius,
      0,
      playerPos.z + Math.sin(angle) * radius
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
