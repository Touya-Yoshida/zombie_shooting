import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(
    CONFIG.CAMERA.FOV,
    window.innerWidth / window.innerHeight,
    CONFIG.CAMERA.NEAR,
    CONFIG.CAMERA.FAR
  );
  cam.position.set(0, CONFIG.PLAYER.EYE_HEIGHT, 0);
  cam.lookAt(0, CONFIG.PLAYER.EYE_HEIGHT, -1);
  return cam;
}

export function handleResize(camera, renderer) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
