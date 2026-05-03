import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();

  const skyColor = new THREE.Color(0x6a7682);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 22, 75);

  const hemi = new THREE.HemisphereLight(0xa8b8cc, 0x2a2418, 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd9a8, 0.65);
  sun.position.set(-12, 20, 8);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x404048, 0.35);
  scene.add(ambient);

  const groundGeom = new THREE.PlaneGeometry(220, 220, 24, 24);
  const positions = groundGeom.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i);
    positions.setZ(i, z + (Math.random() - 0.5) * 0.18);
  }
  groundGeom.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x36402c });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  const propMaterial = new THREE.MeshLambertMaterial({ color: 0x5a4a36 });
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x3a2a1c });
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
    const radius = 18 + Math.random() * 22;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.random() < 0.5) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 + Math.random() * 0.6, 1.2, 1.2),
        propMaterial
      );
      crate.position.set(x, 0.6, z);
      crate.rotation.y = Math.random() * Math.PI;
      scene.add(crate);
    } else {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.5, 4 + Math.random() * 2, 8),
        trunkMaterial
      );
      trunk.position.set(x, 2, z);
      scene.add(trunk);
    }
  }

  return scene;
}
