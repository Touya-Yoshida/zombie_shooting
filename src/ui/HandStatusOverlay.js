const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export class HandStatusOverlay {
  constructor(video) {
    this.canvas = document.getElementById('hand-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.video = video;
    this.w = this.canvas.width;
    this.h = this.canvas.height;
  }

  draw(result) {
    const { ctx, w, h, video } = this;
    ctx.clearRect(0, 0, w, h);
    if (video.readyState >= 2) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-w, 0);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, w, h);
    }
    if (!result || !result.landmarks) return;
    for (let h_i = 0; h_i < result.landmarks.length; h_i++) {
      const lms = result.landmarks[h_i];
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#00ff88';
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = lms[a];
        const pb = lms[b];
        ctx.beginPath();
        ctx.moveTo((1 - pa.x) * w, pa.y * h);
        ctx.lineTo((1 - pb.x) * w, pb.y * h);
        ctx.stroke();
      }
      for (let i = 0; i < lms.length; i++) {
        const p = lms[i];
        ctx.fillStyle = i === 8 ? '#ff4444' : '#ffdd44';
        ctx.beginPath();
        ctx.arc((1 - p.x) * w, p.y * h, i === 8 ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
