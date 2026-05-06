import * as THREE from 'three';

export class GunViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);

    this.pistol = this._createPistol();
    this.rifle = this._createRifle();
    this.group.add(this.pistol);
    this.group.add(this.rifle);

    this.muzzleWorld = new THREE.Vector3();
    this.recoilOffset = 0;
    this.muzzleFlash = this._createMuzzleFlash();
    this.group.add(this.muzzleFlash);
    this.flashTimer = 0;

    this.setWeapon('pistol');
  }

  _createPistol() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0x404048 });
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), bodyMat);
    grip.position.set(0, -0.06, 0.04);
    grip.rotation.x = 0.25;
    g.add(grip);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), bodyMat);
    slide.position.set(0, 0.03, -0.05);
    g.add(slide);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.10);
    g.add(barrel);
    g.position.set(0.22, -0.22, -0.45);
    g.userData.muzzleLocal = new THREE.Vector3(0, 0.03, -0.20);
    return g;
  }

  _createRifle() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2c3024 });
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0x404048 });
    const stockMat = new THREE.MeshLambertMaterial({ color: 0x4a3a28 });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.30), bodyMat);
    receiver.position.set(0, 0.0, -0.05);
    g.add(receiver);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.20), stockMat);
    stock.position.set(0, -0.01, 0.16);
    g.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 8), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.30);
    g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.06), bodyMat);
    mag.position.set(0, -0.10, -0.05);
    g.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.05), bodyMat);
    grip.position.set(0, -0.08, 0.04);
    grip.rotation.x = 0.4;
    g.add(grip);

    g.position.set(0.14, -0.20, -0.55);
    g.visible = false;
    g.userData.muzzleLocal = new THREE.Vector3(0, 0.01, -0.52);
    return g;
  }

  _createMuzzleFlash() {
    const geom = new THREE.PlaneGeometry(0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffdd66,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    return mesh;
  }

  setWeapon(weapon) {
    this.weapon = weapon;
    this.pistol.visible = weapon === 'pistol';
    this.rifle.visible = weapon === 'rifle';
  }

  fire() {
    this.recoilOffset = 0.04;
    this.flashTimer = 0.05;
    this.muzzleFlash.material.opacity = 1.0;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    const active = this.weapon === 'pistol' ? this.pistol : this.rifle;
    this.muzzleFlash.position.copy(active.position).add(active.userData.muzzleLocal);
  }

  update(dt) {
    this.recoilOffset *= Math.max(0, 1 - dt * 12);
    const active = this.weapon === 'pistol' ? this.pistol : this.rifle;
    const baseZ = this.weapon === 'pistol' ? -0.45 : -0.55;
    active.position.z = baseZ + this.recoilOffset;

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.muzzleFlash.material.opacity = Math.max(0, this.flashTimer / 0.05);
    }
  }

  getMuzzleWorldPosition() {
    const active = this.weapon === 'pistol' ? this.pistol : this.rifle;
    const local = active.userData.muzzleLocal.clone();
    local.add(active.position);
    this.muzzleWorld.copy(local);
    this.camera.localToWorld(this.muzzleWorld);
    return this.muzzleWorld;
  }
}
