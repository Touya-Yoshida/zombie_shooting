import * as THREE from 'three';

const _ndc = new THREE.Vector2();
const _far = new THREE.Vector3();

export function performHitscan(raycaster, camera, aimNDC, zombieMeshes) {
  _ndc.set(aimNDC.x, aimNDC.y);
  raycaster.setFromCamera(_ndc, camera);
  const hits = raycaster.intersectObjects(zombieMeshes, true);
  if (hits.length > 0) {
    const hit = hits[0];
    return {
      hit: true,
      point: hit.point.clone(),
      object: hit.object,
      bodyPart: hit.object.userData.bodyPart || 'body',
      zombie: findZombieRef(hit.object)
    };
  }
  _far.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 80);
  return {
    hit: false,
    point: _far.clone(),
    object: null,
    bodyPart: null,
    zombie: null
  };
}

function findZombieRef(node) {
  let cur = node;
  while (cur) {
    if (cur.userData?.zombieRef) return cur.userData.zombieRef;
    cur = cur.parent;
  }
  return null;
}
