const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20
};

export const CHARACTERS = {
  flame_colonel: {
    id: 'flame_colonel',
    name: '炎の大佐',
    subtitle: 'Flame Colonel',
    palette: {
      bg1: '#241a1a',
      bg2: '#1a0e0e',
      skin: '#f4d6b6',
      skinShade: '#d6a87f',
      hair: '#1a1410',
      hairHi: '#3a2a22',
      eye: '#1c1c20',
      jacket: '#16243a',
      jacketHi: '#22344e',
      trim: '#d4a948',
      cape: '#7a1f1f',
      mouth: '#7a3838',
      glow: '#ffcb55'
    }
  },
  pink_alchemist: {
    id: 'pink_alchemist',
    name: '桃色錬金術師',
    subtitle: 'Pink Alchemist',
    palette: {
      bg1: '#3a1c2e',
      bg2: '#1f0d18',
      skin: '#ffe1cd',
      skinShade: '#e6b89a',
      hair: '#ff7ab2',
      hairHi: '#ffb3d4',
      eye: '#3a226b',
      jacket: '#fbf6ee',
      jacketHi: '#ffffff',
      trim: '#e8c46b',
      cape: '#c8336c',
      mouth: '#c8527a',
      glow: '#ffaad4'
    }
  },
  martial_artist: {
    id: 'martial_artist',
    name: '格闘家',
    subtitle: 'Martial Artist',
    palette: {
      bg1: '#2a1a10',
      bg2: '#180c08',
      skin: '#f4d2a8',
      skinShade: '#c89868',
      hair: '#16100c',
      hairHi: '#3a2618',
      eye: '#1a1410',
      jacket: '#f4f0e6',
      jacketHi: '#ffffff',
      trim: '#1a1410',
      cape: '#a83820',
      mouth: '#7a3838',
      glow: '#a8e8ff'
    }
  },
  sword_kirito: {
    id: 'sword_kirito',
    name: '剣士キリト',
    subtitle: 'Black Swordsman',
    palette: {
      bg1: '#15181f',
      bg2: '#080a10',
      skin: '#f0d4b8',
      skinShade: '#c2a288',
      hair: '#0e0e14',
      hairHi: '#2a2a36',
      eye: '#3a3a48',
      jacket: '#16161c',
      jacketHi: '#26262e',
      trim: '#a0a0a8',
      cape: '#0a0a12',
      mouth: '#7a4a4a',
      glow: '#7ee0ff'
    }
  }
};

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function pickDominantHandIdx(result) {
  if (!result || !result.landmarks || result.landmarks.length === 0) return -1;
  if (result.landmarks.length === 1) return 0;
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < (result.handedness || []).length; i++) {
    const cat = result.handedness[i][0];
    if (cat.categoryName === 'Right' && cat.score > bestScore) {
      bestScore = cat.score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export class VtuberAvatar {
  constructor(canvas, characterId = 'flame_colonel') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.character = CHARACTERS[characterId] || CHARACTERS.flame_colonel;
    this.t = 0;
    this.blinkTimer = 0;
    this.blinkPhase = 0;
    this.snapFlashTimer = 0;
    this.lastSnapPrimed = false;
  }

  setCharacter(id) {
    if (CHARACTERS[id]) this.character = CHARACTERS[id];
  }

  notifySnapFired() {
    this.snapFlashTimer = 0.35;
  }

  draw(handResult, snapPrimed = false, dt = 0.016) {
    this.t += dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkPhase = 0.18;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
    }
    if (this.blinkPhase > 0) this.blinkPhase = Math.max(0, this.blinkPhase - dt);
    if (this.snapFlashTimer > 0) this.snapFlashTimer = Math.max(0, this.snapFlashTimer - dt);

    const handState = this._extractHandState(handResult, snapPrimed);
    if (snapPrimed && !this.lastSnapPrimed) {
      // primed entered — small anticipatory effect
    }
    this.lastSnapPrimed = snapPrimed;

    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);
    this._drawBackground(ctx, w, h, handState);
    this._drawCharacter(ctx, w, h, handState);
    this._drawIndicators(ctx, w, h, handState);
  }

  _extractHandState(result, snapPrimed) {
    const idx = pickDominantHandIdx(result);
    if (idx < 0) {
      return {
        present: false,
        snapPrimed: false,
        snapFired: this.snapFlashTimer > 0,
        aimX: 0.5,
        aimY: 0.45,
        spark: 0,
        bobble: Math.sin(this.t * 1.6) * 0.04
      };
    }
    const lm = result.landmarks[idx];
    const wrist = lm[LM.WRIST];
    const thumb = lm[LM.THUMB_TIP];
    const middle = lm[LM.MIDDLE_TIP];
    const palm = dist(wrist, lm[LM.MIDDLE_MCP]) || 0.001;
    const sparkX = (thumb.x + middle.x) / 2;
    const sparkY = (thumb.y + middle.y) / 2;
    const snapDist = dist(thumb, middle) / palm;
    return {
      present: true,
      snapPrimed,
      snapFired: this.snapFlashTimer > 0,
      aimX: 1 - sparkX,
      aimY: sparkY,
      spark: Math.max(0, 1 - snapDist / 0.7),
      bobble: Math.sin(this.t * 2.2) * 0.025
    };
  }

  _drawBackground(ctx, w, h, hs) {
    const p = this.character.palette;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, p.bg1);
    grad.addColorStop(1, p.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    if (hs.snapFired) {
      const flash = this.snapFlashTimer / 0.35;
      const r = ctx.createRadialGradient(w * 0.62, h * 0.35, 5, w * 0.62, h * 0.35, w * 0.9);
      r.addColorStop(0, `rgba(255, 200, 90, ${0.45 * flash})`);
      r.addColorStop(1, 'rgba(255, 200, 90, 0)');
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, h - 18, w, 18);
  }

  _drawCharacter(ctx, w, h, hs) {
    const p = this.character.palette;
    const id = this.character.id;
    const cx = w * 0.5;
    const cy = h * 0.52 + hs.bobble * h;

    if (id === 'flame_colonel') this._drawFlameColonel(ctx, cx, cy, w, h, hs, p);
    else if (id === 'pink_alchemist') this._drawPinkAlchemist(ctx, cx, cy, w, h, hs, p);
    else if (id === 'martial_artist') this._drawMartialArtist(ctx, cx, cy, w, h, hs, p);
    else if (id === 'sword_kirito') this._drawSwordKirito(ctx, cx, cy, w, h, hs, p);
  }

  _drawArmAndSnap(ctx, shoulderX, shoulderY, hs, p, opts = {}) {
    const aimDX = (hs.aimX - 0.5);
    const aimDY = (hs.aimY - 0.5);
    const baseAngle = -Math.PI / 2 + Math.PI * 0.18;
    const targetAngle = Math.atan2(aimDY * 1.3, aimDX * 1.3 + 0.05);
    const useTarget = hs.present;
    const angle = useTarget ? targetAngle * 0.55 + baseAngle * 0.45 : baseAngle;

    const armLen = opts.armLen ?? 56;
    const handX = shoulderX + Math.cos(angle) * armLen;
    const handY = shoulderY + Math.sin(angle) * armLen;
    const elbowX = shoulderX + Math.cos(angle - 0.25) * armLen * 0.55;
    const elbowY = shoulderY + Math.sin(angle - 0.25) * armLen * 0.55 + 6;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = opts.sleeve ?? p.jacket;
    ctx.lineWidth = opts.sleeveWidth ?? 18;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.quadraticCurveTo(elbowX, elbowY, handX, handY);
    ctx.stroke();

    ctx.strokeStyle = opts.cuff ?? p.trim;
    ctx.lineWidth = (opts.sleeveWidth ?? 18) + 2;
    ctx.beginPath();
    ctx.moveTo(handX - Math.cos(angle) * 6, handY - Math.sin(angle) * 6);
    ctx.lineTo(handX - Math.cos(angle) * 1, handY - Math.sin(angle) * 1);
    ctx.stroke();

    // hand
    ctx.fillStyle = opts.glove ?? p.skin;
    ctx.beginPath();
    ctx.arc(handX, handY, 9, 0, Math.PI * 2);
    ctx.fill();

    // snap fingers (thumb+middle pinch)
    const pinchOpen = hs.snapPrimed ? 1.5 : (hs.snapFired ? 5.5 : (hs.present ? 4.5 : 3.5));
    const pinchDir = angle - Math.PI / 2;
    const tx = handX + Math.cos(pinchDir) * pinchOpen;
    const ty = handY + Math.sin(pinchDir) * pinchOpen;
    const mx = handX - Math.cos(pinchDir) * pinchOpen;
    const my = handY - Math.sin(pinchDir) * pinchOpen;

    ctx.strokeStyle = opts.glove ?? p.skin;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // thumb stub
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tx + Math.cos(angle) * 4, ty + Math.sin(angle) * 4);
    ctx.stroke();
    // middle finger
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(mx + Math.cos(angle) * 6, my + Math.sin(angle) * 6);
    ctx.stroke();

    // snap glow
    const glowAmt = Math.max(hs.spark || 0, hs.snapPrimed ? 0.6 : 0, hs.snapFired ? 1 : 0);
    if (glowAmt > 0.05) {
      const gx = handX + Math.cos(angle) * 5;
      const gy = handY + Math.sin(angle) * 5;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 18 * (0.6 + glowAmt));
      gr.addColorStop(0, `rgba(255,240,180,${0.95 * glowAmt})`);
      gr.addColorStop(0.4, `rgba(255,160,40,${0.7 * glowAmt})`);
      gr.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(gx, gy, 18 * (0.6 + glowAmt), 0, Math.PI * 2);
      ctx.fill();

      if (hs.snapFired) {
        ctx.strokeStyle = `rgba(255,220,120,${0.9 * glowAmt})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + this.t * 4;
          ctx.beginPath();
          ctx.moveTo(gx + Math.cos(a) * 6, gy + Math.sin(a) * 6);
          ctx.lineTo(gx + Math.cos(a) * (16 + glowAmt * 8), gy + Math.sin(a) * (16 + glowAmt * 8));
          ctx.stroke();
        }
      }
    }
    return { handX, handY };
  }

  _drawFlameColonel(ctx, cx, cy, w, h, hs, p) {
    // cape
    ctx.fillStyle = p.cape;
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 70, cx + 60, cy + 8);
    ctx.lineTo(cx + 78, h);
    ctx.lineTo(cx - 78, h);
    ctx.closePath();
    ctx.fill();

    // body (jacket)
    ctx.fillStyle = p.jacket;
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + 12);
    ctx.quadraticCurveTo(cx, cy + 4, cx + 50, cy + 12);
    ctx.lineTo(cx + 64, h);
    ctx.lineTo(cx - 64, h);
    ctx.closePath();
    ctx.fill();

    // jacket trim (open chest with white shirt)
    ctx.fillStyle = '#f0f0e8';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 14);
    ctx.lineTo(cx + 12, cy + 14);
    ctx.lineTo(cx + 6, h);
    ctx.lineTo(cx - 6, h);
    ctx.closePath();
    ctx.fill();

    // gold trim
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 14);
    ctx.lineTo(cx - 6, h);
    ctx.moveTo(cx + 12, cy + 14);
    ctx.lineTo(cx + 6, h);
    ctx.stroke();

    // epaulettes
    ctx.fillStyle = p.trim;
    ctx.beginPath();
    ctx.ellipse(cx - 44, cy + 14, 12, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 44, cy + 14, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // arms (right arm extended for snap)
    this._drawArmAndSnap(ctx, cx + 44, cy + 18, hs, p, {
      armLen: 52,
      glove: '#f0e8d0',
      sleeve: p.jacket,
      cuff: p.trim
    });
    // left arm relaxed
    ctx.strokeStyle = p.jacket;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy + 18);
    ctx.quadraticCurveTo(cx - 60, cy + 60, cx - 50, cy + 92);
    ctx.stroke();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(cx - 50, cy + 96, 8, 0, Math.PI * 2);
    ctx.fill();

    // neck
    ctx.fillStyle = p.skin;
    ctx.fillRect(cx - 9, cy - 14, 18, 22);
    ctx.fillStyle = p.skinShade;
    ctx.fillRect(cx - 9, cy + 4, 18, 4);

    // head
    this._drawHead(ctx, cx, cy - 30, p, {
      hairStyle: 'side-part',
      eyeStyle: 'sharp',
      mouthOpen: hs.snapFired ? 0.8 : 0.15,
      brow: 'serious'
    });
  }

  _drawPinkAlchemist(ctx, cx, cy, w, h, hs, p) {
    // cape
    ctx.fillStyle = p.cape;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy + 10);
    ctx.quadraticCurveTo(cx, cy + 86, cx + 70, cy + 10);
    ctx.lineTo(cx + 86, h);
    ctx.lineTo(cx - 86, h);
    ctx.closePath();
    ctx.fill();

    // robe
    ctx.fillStyle = p.jacket;
    ctx.beginPath();
    ctx.moveTo(cx - 52, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 0, cx + 52, cy + 8);
    ctx.lineTo(cx + 70, h);
    ctx.lineTo(cx - 70, h);
    ctx.closePath();
    ctx.fill();

    // gold trim down center
    ctx.fillStyle = p.trim;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 4);
    ctx.lineTo(cx + 5, cy + 4);
    ctx.lineTo(cx + 4, h);
    ctx.lineTo(cx - 4, h);
    ctx.closePath();
    ctx.fill();
    // gem
    ctx.fillStyle = p.cape;
    ctx.beginPath();
    ctx.arc(cx, cy + 24, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // arms
    this._drawArmAndSnap(ctx, cx + 50, cy + 14, hs, p, {
      armLen: 52,
      glove: p.skin,
      sleeve: p.jacket,
      cuff: p.trim,
      sleeveWidth: 16
    });
    ctx.strokeStyle = p.jacket;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + 14);
    ctx.quadraticCurveTo(cx - 64, cy + 56, cx - 56, cy + 90);
    ctx.stroke();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(cx - 56, cy + 94, 7, 0, Math.PI * 2);
    ctx.fill();

    // neck
    ctx.fillStyle = p.skin;
    ctx.fillRect(cx - 8, cy - 10, 16, 18);

    this._drawHead(ctx, cx, cy - 30, p, {
      hairStyle: 'twintails',
      eyeStyle: 'big',
      mouthOpen: hs.snapFired ? 0.9 : 0.25,
      brow: 'cheerful'
    });
  }

  _drawMartialArtist(ctx, cx, cy, w, h, hs, p) {
    // Karate gi (white) outer
    ctx.fillStyle = p.jacket;
    ctx.beginPath();
    ctx.moveTo(cx - 60, cy + 6);
    ctx.quadraticCurveTo(cx, cy - 4, cx + 60, cy + 6);
    ctx.lineTo(cx + 78, h);
    ctx.lineTo(cx - 78, h);
    ctx.closePath();
    ctx.fill();

    // Gi shadow seam down center (V-collar opening)
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 8);
    ctx.lineTo(cx + 16, cy + 8);
    ctx.lineTo(cx + 4, cy + 38);
    ctx.lineTo(cx - 4, cy + 38);
    ctx.closePath();
    ctx.fill();

    // Crossing lapels
    ctx.fillStyle = p.jacketHi;
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 8);
    ctx.lineTo(cx, cy + 36);
    ctx.lineTo(cx - 32, cy + 30);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 16, cy + 8);
    ctx.lineTo(cx, cy + 36);
    ctx.lineTo(cx + 32, cy + 30);
    ctx.closePath();
    ctx.fill();

    // Black belt
    ctx.fillStyle = p.trim;
    ctx.fillRect(cx - 56, cy + 70, 112, 10);
    // belt knot
    ctx.fillRect(cx - 14, cy + 68, 8, 16);
    ctx.fillRect(cx - 4, cy + 68, 8, 16);
    // belt tails
    ctx.fillRect(cx - 12, cy + 80, 4, 14);
    ctx.fillRect(cx - 2, cy + 80, 4, 14);

    // Right arm — extended forward in punch
    this._drawArmAndSnap(ctx, cx + 50, cy + 14, hs, p, {
      armLen: 56,
      glove: p.skin,
      sleeve: p.jacket,
      cuff: p.trim,
      sleeveWidth: 18
    });
    // Left arm — pulled back in chamber position
    ctx.strokeStyle = p.jacket;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + 14);
    ctx.quadraticCurveTo(cx - 70, cy + 50, cx - 64, cy + 80);
    ctx.stroke();
    // Cuff trim on left
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy + 78);
    ctx.lineTo(cx - 58, cy + 82);
    ctx.stroke();
    // Left fist (chambered)
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(cx - 64, cy + 84, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.skinShade;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i += 2) {
      ctx.beginPath();
      ctx.arc(cx - 64 + i * 2, cy + 80, 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Neck
    ctx.fillStyle = p.skin;
    ctx.fillRect(cx - 9, cy - 12, 18, 22);
    ctx.fillStyle = p.skinShade;
    ctx.fillRect(cx - 9, cy + 6, 18, 4);

    // Head — short black hair + headband
    this._drawHead(ctx, cx, cy - 30, p, {
      hairStyle: 'martial',
      eyeStyle: 'sharp',
      mouthOpen: hs.snapFired ? 0.85 : 0.10,
      brow: 'serious'
    });
  }

  _drawSwordKirito(ctx, cx, cy, w, h, hs, p) {
    // Black coat
    ctx.fillStyle = p.cape;
    ctx.beginPath();
    ctx.moveTo(cx - 64, cy + 6);
    ctx.quadraticCurveTo(cx, cy + 70, cx + 64, cy + 6);
    ctx.lineTo(cx + 80, h);
    ctx.lineTo(cx - 80, h);
    ctx.closePath();
    ctx.fill();
    // Inner coat (open)
    ctx.fillStyle = p.jacket;
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 4, cx + 50, cy + 8);
    ctx.lineTo(cx + 64, h);
    ctx.lineTo(cx - 64, h);
    ctx.closePath();
    ctx.fill();
    // Center seam (silver trim)
    ctx.strokeStyle = p.trim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // Sword on back (silhouette behind shoulder)
    ctx.save();
    ctx.translate(cx + 26, cy + 10);
    ctx.rotate(-0.65);
    ctx.fillStyle = '#22222a';
    ctx.fillRect(-3, -6, 6, 26); // grip
    ctx.fillRect(-12, 18, 24, 4); // guard
    ctx.fillStyle = p.trim;
    ctx.fillRect(-3, 22, 6, 70); // blade
    ctx.fillStyle = `rgba(126, 224, 255, 0.5)`;
    ctx.fillRect(-4, 22, 8, 70);
    ctx.restore();

    // Arm (right - holding sword down)
    this._drawArmAndSnap(ctx, cx + 50, cy + 14, hs, p, {
      armLen: 56,
      glove: '#16161c',
      sleeve: p.jacket,
      cuff: p.trim,
      sleeveWidth: 16
    });
    // Left arm
    ctx.strokeStyle = p.jacket;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + 14);
    ctx.quadraticCurveTo(cx - 64, cy + 60, cx - 56, cy + 94);
    ctx.stroke();
    ctx.fillStyle = '#16161c';
    ctx.beginPath();
    ctx.arc(cx - 56, cy + 98, 7, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = p.skin;
    ctx.fillRect(cx - 7, cy - 10, 14, 18);

    this._drawHead(ctx, cx, cy - 30, p, {
      hairStyle: 'kirito',
      eyeStyle: 'sharp',
      mouthOpen: hs.snapFired ? 0.6 : 0.10,
      brow: 'serious'
    });
  }

  _drawRoboPilot_unused(ctx, cx, cy, w, h, hs, p) {
    // chest plate
    ctx.fillStyle = p.jacket;
    ctx.beginPath();
    ctx.moveTo(cx - 56, cy + 4);
    ctx.quadraticCurveTo(cx, cy - 6, cx + 56, cy + 4);
    ctx.lineTo(cx + 70, h);
    ctx.lineTo(cx - 70, h);
    ctx.closePath();
    ctx.fill();

    // chest light
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 4);
    ctx.fillStyle = p.trim;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(cx, cy + 28, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.jacketHi;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + 28, 9, 0, Math.PI * 2);
    ctx.stroke();

    // panel lines
    ctx.strokeStyle = p.jacketHi;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 50);
    ctx.lineTo(cx + 30, cy + 50);
    ctx.moveTo(cx, cy + 36);
    ctx.lineTo(cx, h);
    ctx.stroke();

    // arms
    this._drawArmAndSnap(ctx, cx + 50, cy + 14, hs, p, {
      armLen: 50,
      glove: p.skin,
      sleeve: p.jacket,
      cuff: p.trim,
      sleeveWidth: 16
    });
    ctx.strokeStyle = p.jacket;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + 14);
    ctx.quadraticCurveTo(cx - 60, cy + 60, cx - 54, cy + 92);
    ctx.stroke();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(cx - 54, cy + 96, 7, 0, Math.PI * 2);
    ctx.fill();

    // neck (cylindrical)
    ctx.fillStyle = p.skinShade;
    ctx.fillRect(cx - 8, cy - 12, 16, 18);
    ctx.strokeStyle = p.jacketHi;
    ctx.strokeRect(cx - 8, cy - 12, 16, 18);

    this._drawHead(ctx, cx, cy - 30, p, {
      hairStyle: 'helmet',
      eyeStyle: 'visor',
      mouthOpen: hs.snapFired ? 0.7 : 0.05,
      brow: 'flat'
    });
  }

  _drawHead(ctx, cx, cy, p, style) {
    const hairStyle = style.hairStyle;

    if (hairStyle === 'helmet') {
      // robot head with helmet
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.moveTo(cx - 36, cy - 4);
      ctx.quadraticCurveTo(cx - 36, cy - 36, cx, cy - 36);
      ctx.quadraticCurveTo(cx + 36, cy - 36, cx + 36, cy - 4);
      ctx.lineTo(cx + 36, cy + 28);
      ctx.quadraticCurveTo(cx, cy + 38, cx - 36, cy + 28);
      ctx.closePath();
      ctx.fill();

      // antenna
      ctx.strokeStyle = p.hairHi;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 16, cy - 32);
      ctx.lineTo(cx + 22, cy - 46);
      ctx.stroke();
      const blink = (Math.sin(this.t * 6) > 0.6) ? 1 : 0.3;
      ctx.fillStyle = p.trim;
      ctx.globalAlpha = blink;
      ctx.beginPath();
      ctx.arc(cx + 22, cy - 48, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // visor (eyes)
      const blinkH = 1 - this.blinkPhase * 4;
      ctx.fillStyle = '#0a1820';
      this._roundRect(ctx, cx - 28, cy - 8, 56, 18, 8);
      ctx.fillStyle = p.eye;
      ctx.globalAlpha = 0.85 * Math.max(0.05, blinkH);
      this._roundRect(ctx, cx - 24, cy - 5 + (1 - blinkH) * 5, 48, 10 * blinkH, 5);
      ctx.globalAlpha = 1;

      // mouth (LED bar)
      ctx.fillStyle = p.mouth;
      const mw = 18 + style.mouthOpen * 14;
      const mh = 2 + style.mouthOpen * 5;
      this._roundRect(ctx, cx - mw / 2, cy + 18, mw, mh, 2);

      // cheek lights when mouth open
      if (style.mouthOpen > 0.4) {
        ctx.fillStyle = p.trim;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(cx - 24, cy + 10, 2, 0, Math.PI * 2);
        ctx.arc(cx + 24, cy + 10, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }

    // organic head
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 32, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skinShade;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(cx + 16, cy + 4, 14, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // hair back layer
    if (hairStyle === 'twintails') {
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.ellipse(cx - 38, cy + 10, 12, 28, -0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + 38, cy + 10, 12, 28, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // hair front
    ctx.fillStyle = p.hair;
    if (hairStyle === 'side-part') {
      ctx.beginPath();
      ctx.moveTo(cx - 32, cy - 8);
      ctx.quadraticCurveTo(cx - 30, cy - 38, cx + 6, cy - 36);
      ctx.quadraticCurveTo(cx + 34, cy - 30, cx + 32, cy - 6);
      ctx.lineTo(cx + 32, cy - 12);
      ctx.quadraticCurveTo(cx + 6, cy - 4, cx - 14, cy - 8);
      ctx.quadraticCurveTo(cx - 28, cy - 14, cx - 32, cy - 8);
      ctx.closePath();
      ctx.fill();
      // bangs
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy - 18);
      ctx.quadraticCurveTo(cx - 8, cy - 4, cx + 4, cy - 16);
      ctx.quadraticCurveTo(cx + 14, cy - 24, cx + 20, cy - 18);
      ctx.lineTo(cx + 18, cy - 24);
      ctx.lineTo(cx - 18, cy - 24);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 'twintails') {
      ctx.beginPath();
      ctx.moveTo(cx - 34, cy - 4);
      ctx.quadraticCurveTo(cx - 36, cy - 38, cx, cy - 38);
      ctx.quadraticCurveTo(cx + 36, cy - 38, cx + 34, cy - 4);
      ctx.lineTo(cx + 34, cy - 18);
      ctx.quadraticCurveTo(cx + 6, cy - 12, cx - 8, cy - 18);
      ctx.quadraticCurveTo(cx - 26, cy - 22, cx - 34, cy - 18);
      ctx.closePath();
      ctx.fill();
      // bangs
      ctx.fillStyle = p.hairHi;
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 20);
      ctx.quadraticCurveTo(cx - 6, cy - 4, cx + 8, cy - 18);
      ctx.quadraticCurveTo(cx + 14, cy - 26, cx + 22, cy - 20);
      ctx.lineTo(cx + 18, cy - 28);
      ctx.lineTo(cx - 18, cy - 28);
      ctx.closePath();
      ctx.fill();
    } else if (hairStyle === 'tactical') {
      // Tactical helmet (rounded shell)
      ctx.fillStyle = p.jacket;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 6, 36, 30, 0, Math.PI, 0);
      ctx.lineTo(cx + 36, cy);
      ctx.lineTo(cx - 36, cy);
      ctx.closePath();
      ctx.fill();
      // Helmet rim
      ctx.fillStyle = '#0a0a10';
      ctx.fillRect(cx - 36, cy - 1, 72, 5);
      // Strap
      ctx.strokeStyle = '#0a0a10';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 32, cy + 12);
      ctx.lineTo(cx + 32, cy + 12);
      ctx.stroke();
      // Mount rail (front)
      ctx.fillStyle = p.trim;
      ctx.fillRect(cx - 4, cy - 32, 8, 4);
    } else if (hairStyle === 'martial') {
      // Short cropped black hair
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.moveTo(cx - 32, cy - 4);
      ctx.quadraticCurveTo(cx - 34, cy - 36, cx, cy - 38);
      ctx.quadraticCurveTo(cx + 34, cy - 36, cx + 32, cy - 4);
      ctx.lineTo(cx + 30, cy - 12);
      ctx.quadraticCurveTo(cx, cy - 6, cx - 30, cy - 12);
      ctx.closePath();
      ctx.fill();
      // Forehead bangs
      ctx.fillStyle = p.hairHi;
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 22);
      ctx.lineTo(cx - 12, cy - 14);
      ctx.lineTo(cx - 4, cy - 22);
      ctx.lineTo(cx + 4, cy - 14);
      ctx.lineTo(cx + 14, cy - 22);
      ctx.lineTo(cx + 22, cy - 14);
      ctx.lineTo(cx + 22, cy - 28);
      ctx.lineTo(cx - 22, cy - 28);
      ctx.closePath();
      ctx.fill();
      // Red headband
      ctx.fillStyle = p.cape;
      ctx.fillRect(cx - 34, cy - 16, 68, 7);
      // headband knot on the side
      ctx.beginPath();
      ctx.moveTo(cx - 34, cy - 16);
      ctx.lineTo(cx - 44, cy - 12);
      ctx.lineTo(cx - 38, cy - 6);
      ctx.lineTo(cx - 34, cy - 9);
      ctx.closePath();
      ctx.fill();
      // headband trailing tails
      ctx.fillRect(cx - 46, cy - 4, 4, 14);
      ctx.fillRect(cx - 40, cy - 2, 3, 12);
    } else if (hairStyle === 'kirito') {
      // Spiky black hair (anime swordsman)
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.moveTo(cx - 34, cy - 6);
      ctx.quadraticCurveTo(cx - 38, cy - 38, cx - 18, cy - 36);
      ctx.lineTo(cx - 12, cy - 28);
      ctx.lineTo(cx - 4, cy - 38);
      ctx.lineTo(cx + 4, cy - 28);
      ctx.lineTo(cx + 14, cy - 40);
      ctx.lineTo(cx + 22, cy - 28);
      ctx.lineTo(cx + 32, cy - 36);
      ctx.quadraticCurveTo(cx + 36, cy - 14, cx + 34, cy - 6);
      ctx.lineTo(cx + 32, cy - 12);
      ctx.quadraticCurveTo(cx + 4, cy - 4, cx - 16, cy - 8);
      ctx.quadraticCurveTo(cx - 28, cy - 12, cx - 34, cy - 6);
      ctx.closePath();
      ctx.fill();
      // Side spikes
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy + 4);
      ctx.lineTo(cx - 36, cy + 14);
      ctx.lineTo(cx - 28, cy + 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 30, cy + 4);
      ctx.lineTo(cx + 36, cy + 14);
      ctx.lineTo(cx + 28, cy + 8);
      ctx.fill();
    }

    // eyes
    const blinkH = 1 - this.blinkPhase * 4.5;
    const eyeY = cy + 4;
    const lookX = (style.aimX ?? 0.5);
    const lookOff = 0;
    if (style.eyeStyle === 'big') {
      // big anime eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx - 11, eyeY, 6.5, 8 * Math.max(0.05, blinkH), 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 11, eyeY, 6.5, 8 * Math.max(0.05, blinkH), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.eye;
      ctx.beginPath();
      ctx.ellipse(cx - 11 + lookOff, eyeY, 4, 6 * Math.max(0.05, blinkH), 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 11 + lookOff, eyeY, 4, 6 * Math.max(0.05, blinkH), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 9, eyeY - 2, 1.5, 0, Math.PI * 2);
      ctx.arc(cx + 13, eyeY - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (style.eyeStyle === 'sharp') {
      // sharp serious eyes
      ctx.fillStyle = p.eye;
      ctx.beginPath();
      ctx.ellipse(cx - 11, eyeY, 5.5, 3 * Math.max(0.1, blinkH), -0.05, 0, Math.PI * 2);
      ctx.ellipse(cx + 11, eyeY, 5.5, 3 * Math.max(0.1, blinkH), 0.05, 0, Math.PI * 2);
      ctx.fill();
      if (style.brow === 'serious') {
        ctx.strokeStyle = p.hair;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 16, eyeY - 9);
        ctx.lineTo(cx - 6, eyeY - 7);
        ctx.moveTo(cx + 16, eyeY - 9);
        ctx.lineTo(cx + 6, eyeY - 7);
        ctx.stroke();
      }
    } else if (style.eyeStyle === 'goggles') {
      // Tactical goggles (single visor)
      ctx.fillStyle = '#0a0e12';
      this._roundRect(ctx, cx - 26, eyeY - 7, 52, 14, 6);
      // Lens shine
      ctx.fillStyle = 'rgba(255, 80, 60, 0.45)';
      this._roundRect(ctx, cx - 24, eyeY - 5, 48, 10, 4);
      // Strap
      ctx.strokeStyle = '#1a1d20';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 32, eyeY);
      ctx.lineTo(cx + 32, eyeY);
      ctx.stroke();
      // Highlight scan line
      ctx.fillStyle = `rgba(255, 80, 60, ${0.55 + Math.sin(this.t * 5) * 0.25})`;
      ctx.fillRect(cx - 22 + ((this.t * 30) % 44), eyeY - 3, 4, 6);
    }

    // nose
    ctx.strokeStyle = p.skinShade;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + 1, eyeY + 8);
    ctx.lineTo(cx + 3, eyeY + 14);
    ctx.stroke();

    // mouth
    const mOpen = style.mouthOpen;
    ctx.fillStyle = p.mouth;
    if (mOpen > 0.4) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 22, 5 + mOpen * 4, 3 + mOpen * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = p.mouth;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + 22);
      ctx.quadraticCurveTo(cx, cy + 22 + (style.brow === 'cheerful' ? 4 : 1), cx + 5, cy + 22);
      ctx.stroke();
    }
  }

  _drawIndicators(ctx, w, h, hs) {
    if (!hs.present) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('手をかざしてください', w / 2, h - 5);
    } else if (hs.snapPrimed) {
      ctx.fillStyle = 'rgba(255,210,90,0.95)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('READY — 指を弾け', w / 2, h - 5);
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    if (h < 1) return;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawCharacterPreview(canvas, characterId) {
  const av = new VtuberAvatar(canvas, characterId);
  av.draw(null, false, 0.016);
}
