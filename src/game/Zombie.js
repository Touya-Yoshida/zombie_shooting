import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  createZombieMesh,
  animateZombieWalk,
  animateZombieAttack,
  animateZombieDying
} from '../render/ZombieMesh.js';

const STATE = {
  WALKING: 'walking',
  ATTACKING: 'attacking',
  DYING: 'dying',
  DEAD: 'dead'
};

let zombieIdCounter = 0;

export class Zombie {
  constructor(scene, position) {
    this.id = zombieIdCounter++;
    this.scene = scene;
    this.mesh = createZombieMesh();
    this.mesh.position.copy(position);
    this.mesh.userData.zombieRef = this;
    this.mesh.traverse((node) => {
      node.userData.zombieRef = this;
    });
    scene.add(this.mesh);
    this.hp = CONFIG.ZOMBIES.BODY_HP;
    this.state = STATE.WALKING;
    this.dyingTime = 0;
    this.lastAttackMs = 0;
    this.tmp = new THREE.Vector3();
  }

  takeHit(damage, isHeadshot) {
    if (this.state === STATE.DYING || this.state === STATE.DEAD) return false;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.state = STATE.DYING;
      this.dyingTime = 0;
      return true;
    }
    return false;
  }

  isDead() {
    return this.state === STATE.DEAD;
  }

  update(dt, nowMs, playerPos, gameState, audio, canAttack = true) {
    if (this.state === STATE.DEAD) return;

    if (this.state === STATE.DYING) {
      this.dyingTime += dt;
      animateZombieDying(this.mesh, this.dyingTime);
      if (this.dyingTime > 0.7) {
        this.state = STATE.DEAD;
        this.scene.remove(this.mesh);
        this.mesh.traverse((node) => {
          if (node.geometry) node.geometry.dispose?.();
          if (node.material) {
            if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
            else node.material.dispose?.();
          }
        });
      }
      return;
    }

    this.tmp.copy(playerPos).sub(this.mesh.position);
    this.tmp.y = 0;
    const distance = this.tmp.length();

    if (distance < CONFIG.ZOMBIES.MELEE_RANGE) {
      this.state = STATE.ATTACKING;
      animateZombieAttack(this.mesh, nowMs * 0.001);
      if (canAttack) {
        const dps = CONFIG.ZOMBIES.MELEE_DPS;
        gameState.takeDamage(dps * dt, nowMs);
        if (nowMs - this.lastAttackMs > 600 && audio) {
          audio.play('zombieGrowl');
          this.lastAttackMs = nowMs;
        }
      }
    } else {
      this.state = STATE.WALKING;
      this.tmp.normalize();
      const speed = CONFIG.ZOMBIES.WALK_SPEED;
      this.mesh.position.x += this.tmp.x * speed * dt;
      this.mesh.position.z += this.tmp.z * speed * dt;
      const angle = Math.atan2(this.tmp.x, this.tmp.z);
      this.mesh.rotation.y = angle;
      animateZombieWalk(this.mesh, nowMs * 0.001, 1);
    }
  }
}
