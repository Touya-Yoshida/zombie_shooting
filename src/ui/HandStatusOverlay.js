import { VtuberAvatar } from './VtuberAvatar.js';

export class HandStatusOverlay {
  constructor(video, characterId = 'flame_colonel') {
    this.canvas = document.getElementById('hand-canvas');
    this.video = video;
    this.avatar = new VtuberAvatar(this.canvas, characterId);
    this.lastFrame = performance.now();
    this.snapPrimed = false;
  }

  setCharacter(id) {
    this.avatar.setCharacter(id);
  }

  setSnapPrimed(primed) {
    this.snapPrimed = primed;
  }

  notifySnapFired() {
    this.avatar.notifySnapFired();
  }

  draw(result) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.avatar.draw(result, this.snapPrimed, dt);
  }
}
