import * as THREE from 'three';

const SKIN_COLORS = [0x4a6b3a, 0x556b2f, 0x3e5c2e, 0x60724a];

export function createZombieMesh() {
  const group = new THREE.Group();
  const skinColor = SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)];
  const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const clothesMat = new THREE.MeshLambertMaterial({ color: 0x2a2820 });
  const trousersMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1f });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), clothesMat);
  torso.position.y = 1.0;
  torso.userData.bodyPart = 'body';
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.30), skinMat);
  head.position.y = 1.6;
  head.userData.bodyPart = 'head';
  group.add(head);
  group.userData.head = head;

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), eyeMat);
  leftEye.position.set(-0.07, 1.62, -0.16);
  group.add(leftEye);
  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), eyeMat);
  rightEye.position.set(0.07, 1.62, -0.16);
  group.add(rightEye);

  const armGeom = new THREE.BoxGeometry(0.16, 0.62, 0.16);
  const leftArm = new THREE.Mesh(armGeom, skinMat);
  leftArm.position.set(-0.36, 1.0, -0.18);
  leftArm.rotation.x = -1.0;
  leftArm.userData.bodyPart = 'arm';
  group.add(leftArm);
  group.userData.leftArm = leftArm;

  const rightArm = new THREE.Mesh(armGeom, skinMat);
  rightArm.position.set(0.36, 1.0, -0.18);
  rightArm.rotation.x = -1.0;
  rightArm.userData.bodyPart = 'arm';
  group.add(rightArm);
  group.userData.rightArm = rightArm;

  const legGeom = new THREE.BoxGeometry(0.20, 0.78, 0.22);
  const leftLeg = new THREE.Mesh(legGeom, trousersMat);
  leftLeg.position.set(-0.14, 0.39, 0);
  leftLeg.userData.bodyPart = 'leg';
  group.add(leftLeg);
  group.userData.leftLeg = leftLeg;

  const rightLeg = new THREE.Mesh(legGeom, trousersMat);
  rightLeg.position.set(0.14, 0.39, 0);
  rightLeg.userData.bodyPart = 'leg';
  group.add(rightLeg);
  group.userData.rightLeg = rightLeg;

  group.traverse((node) => {
    if (node.isMesh) node.castShadow = false;
  });

  return group;
}

export function animateZombieWalk(mesh, time, speed) {
  const t = time * speed * 6;
  const swing = 0.4;
  if (mesh.userData.leftLeg) mesh.userData.leftLeg.rotation.x = Math.sin(t) * swing;
  if (mesh.userData.rightLeg) mesh.userData.rightLeg.rotation.x = -Math.sin(t) * swing;
  if (mesh.userData.leftArm) mesh.userData.leftArm.rotation.x = -1.0 + Math.sin(t) * 0.15;
  if (mesh.userData.rightArm) mesh.userData.rightArm.rotation.x = -1.0 - Math.sin(t) * 0.15;
}

export function animateZombieAttack(mesh, time) {
  const t = time * 8;
  const swing = Math.sin(t) * 0.4;
  if (mesh.userData.leftArm) mesh.userData.leftArm.rotation.x = -1.5 + swing;
  if (mesh.userData.rightArm) mesh.userData.rightArm.rotation.x = -1.5 - swing;
}

export function animateZombieDying(mesh, t) {
  mesh.rotation.x = Math.min(Math.PI / 2, t * 4);
  mesh.position.y = -t * 0.3;
}
