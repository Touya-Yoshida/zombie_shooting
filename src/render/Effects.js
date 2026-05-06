import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.tracerPool = [];
    this.bloodParticles = [];
    this.maxTracers = 32;
    this._initTracerPool();
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

  spawnBlood(at) {
    const count = 10;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = at.x;
      positions[i * 3 + 1] = at.y;
      positions[i * 3 + 2] = at.z;
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 3
        )
      );
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

  update(dt) {
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
  }
}
