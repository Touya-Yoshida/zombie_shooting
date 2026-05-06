// 21-landmark wireframe hand model that loops through a character's gesture.
// Hand is built procedurally from finger curl values + special pose modifiers.

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

const FINGER_DEFS = {
  thumb: {
    mcp: { x: 0.34, y: 0.74 },
    baseDir: -1.5,
    segments: [0.085, 0.075, 0.065],
    bendStep: [0.30, 0.55, 0.55]
  },
  index: {
    mcp: { x: 0.42, y: 0.62 },
    baseDir: -Math.PI / 2 - 0.05,
    segments: [0.12, 0.085, 0.065],
    bendStep: [0.45, 0.75, 0.75]
  },
  middle: {
    mcp: { x: 0.5, y: 0.6 },
    baseDir: -Math.PI / 2,
    segments: [0.13, 0.095, 0.075],
    bendStep: [0.45, 0.75, 0.75]
  },
  ring: {
    mcp: { x: 0.58, y: 0.62 },
    baseDir: -Math.PI / 2 + 0.05,
    segments: [0.12, 0.085, 0.065],
    bendStep: [0.45, 0.75, 0.75]
  },
  pinky: {
    mcp: { x: 0.65, y: 0.66 },
    baseDir: -Math.PI / 2 + 0.13,
    segments: [0.095, 0.07, 0.055],
    bendStep: [0.45, 0.75, 0.75]
  }
};

const FINGER_ORDER = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const FINGER_LM_START = { thumb: 1, index: 5, middle: 9, ring: 13, pinky: 17 };

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerp2(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}
function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function buildHandLandmarks(curls, opts = {}) {
  const lm = new Array(21);
  lm[0] = { x: 0.5, y: 0.84 };
  for (const finger of FINGER_ORDER) {
    const def = FINGER_DEFS[finger];
    const curl = Math.max(0, Math.min(1, curls[finger] ?? 0));
    let angle = def.baseDir;
    let pos = { x: def.mcp.x, y: def.mcp.y };
    const start = FINGER_LM_START[finger];
    lm[start] = pos;
    for (let s = 0; s < 3; s++) {
      angle += curl * def.bendStep[s];
      pos = {
        x: pos.x + Math.cos(angle) * def.segments[s],
        y: pos.y + Math.sin(angle) * def.segments[s]
      };
      lm[start + 1 + s] = pos;
    }
  }
  // Snap pose adjustment: pull thumb tip toward middle finger tip
  if (opts.thumbToMiddle && opts.thumbToMiddle > 0) {
    const t = opts.thumbToMiddle;
    const targetTip = lm[12];
    const targetIp = lerp2(lm[11], lm[12], 0.4);
    lm[4] = lerp2(lm[4], targetTip, t);
    lm[3] = lerp2(lm[3], targetIp, t * 0.6);
    lm[2] = lerp2(lm[2], lerp2(lm[2], targetIp, 0.5), t * 0.3);
  }
  return lm;
}

const DEMOS = {
  flame_colonel: {
    duration: 3.6,
    title: '🔥 指パッチン → 火球',
    captions: [
      { t: 0.00, text: '構える' },
      { t: 0.18, text: '親指と中指をくっつける' },
      { t: 0.45, text: 'チャージ完了' },
      { t: 0.62, text: '指を弾く（パッチン！）' },
      { t: 0.82, text: '火球発射' }
    ],
    stateAt(t) {
      if (t < 0.18) {
        const u = ease(t / 0.18);
        return {
          curls: {
            thumb: lerp(0.45, 0.20, u),
            index: lerp(0.45, 0.05, u),
            middle: lerp(0.45, 0.5, u),
            ring: lerp(0.45, 0.78, u),
            pinky: lerp(0.45, 0.78, u)
          },
          thumbToMiddle: 0,
          chargeGlow: 0
        };
      } else if (t < 0.45) {
        const u = ease((t - 0.18) / 0.27);
        return {
          curls: { thumb: 0.20, index: 0.05, middle: 0.5, ring: 0.78, pinky: 0.78 },
          thumbToMiddle: u * 0.95,
          chargeGlow: u * 0.9
        };
      } else if (t < 0.62) {
        const u = (t - 0.45) / 0.17;
        return {
          curls: { thumb: 0.20, index: 0.05, middle: 0.5, ring: 0.78, pinky: 0.78 },
          thumbToMiddle: 0.95,
          chargeGlow: 0.9 + Math.sin(u * Math.PI * 6) * 0.1
        };
      } else if (t < 0.78) {
        const u = ease((t - 0.62) / 0.16);
        return {
          curls: {
            thumb: lerp(0.20, 0.0, u),
            index: 0.05,
            middle: lerp(0.5, 0.0, u),
            ring: lerp(0.78, 0.45, u),
            pinky: lerp(0.78, 0.45, u)
          },
          thumbToMiddle: lerp(0.95, 0, u),
          chargeGlow: 1 - u,
          spark: 1 - u,
          fireball: u
        };
      } else {
        const u = ease((t - 0.78) / 0.22);
        return {
          curls: {
            thumb: lerp(0.0, 0.45, u),
            index: lerp(0.05, 0.45, u),
            middle: lerp(0.0, 0.45, u),
            ring: lerp(0.45, 0.45, u),
            pinky: lerp(0.45, 0.45, u)
          },
          thumbToMiddle: 0,
          fireball: 1
        };
      }
    },
    drawExtras(ctx, lm, w, h, state) {
      const middleTipPx = { x: lm[12].x * w, y: lm[12].y * h };
      const thumbTipPx = { x: lm[4].x * w, y: lm[4].y * h };
      const sparkPos = {
        x: (middleTipPx.x + thumbTipPx.x) / 2,
        y: (middleTipPx.y + thumbTipPx.y) / 2
      };
      if ((state.chargeGlow ?? 0) > 0.05) {
        const r = 14 + state.chargeGlow * 12;
        const g = ctx.createRadialGradient(sparkPos.x, sparkPos.y, 0, sparkPos.x, sparkPos.y, r);
        g.addColorStop(0, `rgba(255, 240, 180, ${0.85 * state.chargeGlow})`);
        g.addColorStop(0.5, `rgba(255, 160, 40, ${0.55 * state.chargeGlow})`);
        g.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sparkPos.x, sparkPos.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if ((state.spark ?? 0) > 0.05) {
        const r = 18 + (1 - state.spark) * 22;
        ctx.strokeStyle = `rgba(255, 220, 120, ${0.9 * state.spark})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(sparkPos.x + Math.cos(a) * r * 0.4, sparkPos.y + Math.sin(a) * r * 0.4);
          ctx.lineTo(sparkPos.x + Math.cos(a) * r, sparkPos.y + Math.sin(a) * r);
          ctx.stroke();
        }
      }
      if ((state.fireball ?? 0) > 0.05) {
        const fx = lerp(sparkPos.x, w * 1.05, state.fireball);
        const fy = lerp(sparkPos.y, h * 0.15, state.fireball);
        const fr = 16 - state.fireball * 4;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.4);
        g.addColorStop(0, 'rgba(255, 240, 180, 0.95)');
        g.addColorStop(0.4, 'rgba(255, 130, 40, 0.7)');
        g.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fx, fy, fr * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  pink_alchemist: {
    duration: 3.4,
    title: '✨ 開いた掌 → 魔法弾連射',
    captions: [
      { t: 0.00, text: '握った状態から…' },
      { t: 0.15, text: '5本の指を全部開く' },
      { t: 0.35, text: '掌を向けたまま連射' },
      { t: 0.85, text: '握ると停止' }
    ],
    stateAt(t) {
      if (t < 0.15) {
        const u = ease(t / 0.15);
        return {
          curls: {
            thumb: lerp(0.7, 0.55, u),
            index: 0.85,
            middle: 0.85,
            ring: 0.85,
            pinky: 0.85
          },
          openGlow: 0
        };
      } else if (t < 0.35) {
        const u = ease((t - 0.15) / 0.20);
        return {
          curls: {
            thumb: lerp(0.55, 0.05, u),
            index: lerp(0.85, 0.0, u),
            middle: lerp(0.85, 0.0, u),
            ring: lerp(0.85, 0.0, u),
            pinky: lerp(0.85, 0.0, u)
          },
          openGlow: u
        };
      } else if (t < 0.85) {
        const phase = (t - 0.35) / 0.5;
        return {
          curls: { thumb: 0.05, index: 0.0, middle: 0.0, ring: 0.0, pinky: 0.0 },
          openGlow: 1,
          firing: true,
          firePhase: phase
        };
      } else {
        const u = ease((t - 0.85) / 0.15);
        return {
          curls: {
            thumb: lerp(0.05, 0.7, u),
            index: lerp(0.0, 0.85, u),
            middle: lerp(0.0, 0.85, u),
            ring: lerp(0.0, 0.85, u),
            pinky: lerp(0.0, 0.85, u)
          },
          openGlow: 1 - u
        };
      }
    },
    drawExtras(ctx, lm, w, h, state) {
      const palmCx = (lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 4 * w;
      const palmCy = (lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 4 * h;
      if ((state.openGlow ?? 0) > 0.05) {
        const r = 30 + state.openGlow * 8;
        const g = ctx.createRadialGradient(palmCx, palmCy, 0, palmCx, palmCy, r);
        g.addColorStop(0, `rgba(255, 200, 240, ${0.7 * state.openGlow})`);
        g.addColorStop(0.6, `rgba(255, 100, 200, ${0.4 * state.openGlow})`);
        g.addColorStop(1, 'rgba(180, 30, 130, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(palmCx, palmCy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.firing) {
        // 3 staggered bolts traveling away
        for (let i = 0; i < 3; i++) {
          const u = ((state.firePhase * 4 + i * 0.33) % 1);
          const bx = lerp(palmCx, w * 0.5, u);
          const by = lerp(palmCy, h * 0.05, u);
          const br = 6 - u * 4;
          const a = 1 - u;
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, br * 2);
          g.addColorStop(0, `rgba(255, 220, 255, ${0.95 * a})`);
          g.addColorStop(0.5, `rgba(255, 80, 200, ${0.7 * a})`);
          g.addColorStop(1, 'rgba(180, 20, 130, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(bx, by, br * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },
  special_forces: {
    duration: 3.4,
    title: '🔫 指鉄砲 → 手首スナップ発射',
    captions: [
      { t: 0.00, text: '指で「銃」を作る' },
      { t: 0.20, text: '人差し指で標的を狙う' },
      { t: 0.55, text: '手首を上にスナップ' },
      { t: 0.75, text: '発射（一撃必殺）' }
    ],
    stateAt(t) {
      if (t < 0.20) {
        const u = ease(t / 0.20);
        return {
          curls: {
            thumb: lerp(0.6, 0.0, u),
            index: lerp(0.85, 0.05, u),
            middle: lerp(0.85, 0.85, u),
            ring: 0.85,
            pinky: 0.85
          },
          wristTilt: 0,
          aim: 0
        };
      } else if (t < 0.55) {
        const u = (t - 0.20) / 0.35;
        return {
          curls: { thumb: 0.0, index: 0.05, middle: 0.85, ring: 0.85, pinky: 0.85 },
          wristTilt: 0,
          aim: u,
          aimingHold: true
        };
      } else if (t < 0.75) {
        const u = ease((t - 0.55) / 0.20);
        return {
          curls: { thumb: 0.0, index: 0.05, middle: 0.85, ring: 0.85, pinky: 0.85 },
          wristTilt: u * -0.7,
          aim: 1,
          firing: u
        };
      } else {
        const u = ease((t - 0.75) / 0.25);
        return {
          curls: { thumb: lerp(0.0, 0.6, u), index: lerp(0.05, 0.85, u), middle: 0.85, ring: 0.85, pinky: 0.85 },
          wristTilt: lerp(-0.7, 0, u),
          missile: 1
        };
      }
    },
    drawExtras(ctx, lm, w, h, state) {
      const indexTipPx = { x: lm[8].x * w, y: lm[8].y * h };
      const target = { x: w * 0.5, y: h * 0.16 };
      // Aim laser
      if ((state.aim ?? 0) > 0) {
        ctx.strokeStyle = `rgba(255, 80, 60, ${0.4 + state.aim * 0.4})`;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(indexTipPx.x, indexTipPx.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Crosshair on target
        ctx.strokeStyle = '#ff4433';
        ctx.lineWidth = 2;
        const r = 14 + Math.sin(performance.now() * 0.01) * 2;
        ctx.beginPath();
        ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(target.x - 18, target.y); ctx.lineTo(target.x - 8, target.y);
        ctx.moveTo(target.x + 8, target.y); ctx.lineTo(target.x + 18, target.y);
        ctx.moveTo(target.x, target.y - 18); ctx.lineTo(target.x, target.y - 8);
        ctx.moveTo(target.x, target.y + 8); ctx.lineTo(target.x, target.y + 18);
        ctx.stroke();
      }
      // Muzzle flash + shot line
      if ((state.firing ?? 0) > 0.05) {
        const u = state.firing;
        ctx.fillStyle = `rgba(255, 220, 120, ${u})`;
        ctx.beginPath();
        ctx.arc(indexTipPx.x, indexTipPx.y, 8 + u * 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 240, 180, ${u * 0.95})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(indexTipPx.x, indexTipPx.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
      // Wrist snap arrow indicator
      if ((state.wristTilt ?? 0) < -0.1) {
        ctx.strokeStyle = '#ffcc44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.18, h * 0.85);
        ctx.lineTo(w * 0.18, h * 0.55);
        ctx.lineTo(w * 0.14, h * 0.62);
        ctx.moveTo(w * 0.18, h * 0.55);
        ctx.lineTo(w * 0.22, h * 0.62);
        ctx.stroke();
        ctx.fillStyle = '#ffcc44';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SNAP UP', w * 0.06, h * 0.5);
      }
    }
  },
  sword_kirito: {
    duration: 3.0,
    title: '⚔️ 振り下ろし → 遠距離斬撃',
    captions: [
      { t: 0.00, text: '剣を構える（手をグーに）' },
      { t: 0.30, text: '振り上げ' },
      { t: 0.55, text: '一気に振り下ろす！' },
      { t: 0.80, text: '斬撃が前方に飛ぶ' }
    ],
    stateAt(t) {
      if (t < 0.30) {
        const u = ease(t / 0.30);
        return {
          curls: { thumb: lerp(0.4, 0.7, u), index: lerp(0.5, 0.85, u), middle: lerp(0.5, 0.85, u), ring: lerp(0.5, 0.85, u), pinky: lerp(0.5, 0.85, u) },
          handY: lerp(0.55, 0.55, u),
          swordAngle: 0
        };
      } else if (t < 0.55) {
        const u = ease((t - 0.30) / 0.25);
        return {
          curls: { thumb: 0.7, index: 0.85, middle: 0.85, ring: 0.85, pinky: 0.85 },
          handY: lerp(0.55, 0.30, u),
          swordAngle: lerp(0, -0.5, u)
        };
      } else if (t < 0.80) {
        const u = ease((t - 0.55) / 0.25);
        return {
          curls: { thumb: 0.7, index: 0.85, middle: 0.85, ring: 0.85, pinky: 0.85 },
          handY: lerp(0.30, 0.75, u),
          swordAngle: lerp(-0.5, 1.4, u),
          swinging: u
        };
      } else {
        const u = (t - 0.80) / 0.20;
        return {
          curls: { thumb: 0.55, index: 0.85, middle: 0.85, ring: 0.85, pinky: 0.85 },
          handY: 0.7,
          swordAngle: 1.0,
          slash: u
        };
      }
    },
    drawExtras(ctx, lm, w, h, state) {
      // Draw a sword extending from the hand at angle
      const wristPx = { x: lm[0].x * w, y: lm[0].y * h };
      const ang = state.swordAngle ?? 0;
      const len = 110;
      const tipX = wristPx.x + Math.sin(-ang) * len;
      const tipY = wristPx.y + Math.cos(-ang) * -len;
      // Blade
      ctx.strokeStyle = '#cdd5e0';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wristPx.x, wristPx.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = `rgba(126, 224, 255, ${0.7 + (state.swinging ?? 0) * 0.3})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(wristPx.x, wristPx.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // Guard
      ctx.strokeStyle = '#a0a0a8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      const perp = { x: Math.cos(-ang) * 12, y: Math.sin(-ang) * 12 };
      ctx.moveTo(wristPx.x - perp.x, wristPx.y - perp.y);
      ctx.lineTo(wristPx.x + perp.x, wristPx.y + perp.y);
      ctx.stroke();

      // Slash arc when firing
      if ((state.slash ?? 0) > 0) {
        const u = state.slash;
        const slashY = lerp(h * 0.5, h * 0.05, u);
        const slashWidth = 220 - u * 100;
        ctx.strokeStyle = `rgba(180, 232, 255, ${1 - u})`;
        ctx.lineWidth = 14 - u * 10;
        ctx.beginPath();
        ctx.arc(w / 2, slashY + 80, slashWidth, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - u})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(w / 2, slashY + 80, slashWidth, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
  },
  _unused_robo: {
    duration: 4.2,
    title: '🎯 ロックオン → ミサイル ／ 両手で衝撃波',
    captions: [
      { t: 0.00, text: '人差し指で標的を指す' },
      { t: 0.20, text: 'ロックオン (最大3体)' },
      { t: 0.55, text: '指を曲げて発射' },
      { t: 0.72, text: '誘導ミサイルが斉射' },
      { t: 0.92, text: '両手プッシュで衝撃波も◎' }
    ],
    stateAt(t) {
      if (t < 0.10) {
        const u = ease(t / 0.10);
        return {
          curls: {
            thumb: lerp(0.6, 0.4, u),
            index: lerp(0.85, 0.05, u),
            middle: 0.85,
            ring: 0.85,
            pinky: 0.85
          },
          locks: 0,
          fired: 0
        };
      } else if (t < 0.55) {
        // pointing — lock count grows over time
        const u = (t - 0.10) / 0.45;
        const locks = Math.min(3, Math.floor(u * 3.6));
        return {
          curls: { thumb: 0.4, index: 0.05, middle: 0.85, ring: 0.85, pinky: 0.85 },
          locks,
          lockGrow: u
        };
      } else if (t < 0.7) {
        const u = ease((t - 0.55) / 0.15);
        return {
          curls: { thumb: 0.4, index: lerp(0.05, 0.85, u), middle: 0.85, ring: 0.85, pinky: 0.85 },
          locks: 3,
          firing: u
        };
      } else if (t < 0.92) {
        const u = (t - 0.7) / 0.22;
        return {
          curls: { thumb: 0.5, index: 0.85, middle: 0.85, ring: 0.85, pinky: 0.85 },
          locks: 0,
          missiles: u
        };
      } else {
        const u = (t - 0.92) / 0.08;
        return {
          curls: { thumb: 0.5, index: 0.85, middle: 0.85, ring: 0.85, pinky: 0.85 },
          missiles: 1,
          repulsorPreview: u
        };
      }
    },
    drawExtras(ctx, lm, w, h, state) {
      const indexTipPx = { x: lm[8].x * w, y: lm[8].y * h };
      // Lock targets (3 imaginary positions on screen)
      const TARGETS = [
        { x: w * 0.18, y: h * 0.22 },
        { x: w * 0.5, y: h * 0.12 },
        { x: w * 0.82, y: h * 0.22 }
      ];
      const locks = state.locks ?? 0;
      // Pointer beam from index tip when pointing/locking
      if ((state.lockGrow ?? 0) > 0 || locks > 0) {
        for (let i = 0; i < locks; i++) {
          const t = TARGETS[i];
          ctx.strokeStyle = 'rgba(255, 80, 80, 0.45)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(indexTipPx.x, indexTipPx.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
          ctx.setLineDash([]);
          // Lock ring
          const pulse = 1 + Math.sin(performance.now() * 0.01 + i) * 0.1;
          ctx.strokeStyle = '#ff3344';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 14 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          // Crosshair
          ctx.beginPath();
          ctx.moveTo(t.x - 18, t.y);
          ctx.lineTo(t.x - 8, t.y);
          ctx.moveTo(t.x + 8, t.y);
          ctx.lineTo(t.x + 18, t.y);
          ctx.moveTo(t.x, t.y - 18);
          ctx.lineTo(t.x, t.y - 8);
          ctx.moveTo(t.x, t.y + 8);
          ctx.lineTo(t.x, t.y + 18);
          ctx.stroke();
        }
      }
      // Firing flash
      if ((state.firing ?? 0) > 0.05) {
        const f = state.firing;
        ctx.fillStyle = `rgba(255, 220, 120, ${f * 0.6})`;
        ctx.beginPath();
        ctx.arc(indexTipPx.x, indexTipPx.y, 10 + f * 14, 0, Math.PI * 2);
        ctx.fill();
      }
      // Missiles flying to targets
      if ((state.missiles ?? 0) > 0) {
        const u = state.missiles;
        for (let i = 0; i < 3; i++) {
          const t = TARGETS[i];
          const mx = lerp(indexTipPx.x, t.x, u);
          const my = lerp(indexTipPx.y, t.y, u);
          ctx.fillStyle = '#ffcc66';
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
          // trail
          ctx.strokeStyle = `rgba(255, 140, 60, ${0.6 * (1 - u * 0.4)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(indexTipPx.x, indexTipPx.y);
          ctx.lineTo(mx, my);
          ctx.stroke();
          if (u > 0.95) {
            ctx.fillStyle = 'rgba(255, 200, 80, 0.6)';
            ctx.beginPath();
            ctx.arc(t.x, t.y, 22, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // Repulsor hint
      if ((state.repulsorPreview ?? 0) > 0) {
        const u = state.repulsorPreview;
        ctx.strokeStyle = `rgba(120, 220, 255, ${0.7 - u * 0.5})`;
        ctx.lineWidth = 2;
        const cx = w * 0.5;
        const cy = h * 0.85;
        ctx.beginPath();
        ctx.arc(cx, cy, 30 + u * 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(120, 220, 255, ${0.6 - u * 0.5})`;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('両手プッシュで衝撃波', cx, h - 6);
      }
    }
  }
};

export class HandDemo {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.character = 'flame_colonel';
    this.t = 0;
    this.lastTime = performance.now();
  }

  setCharacter(id) {
    if (DEMOS[id]) this.character = id;
    this.t = 0;
  }

  step() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const demo = DEMOS[this.character] || DEMOS.flame_colonel;
    this.t = (this.t + dt) % demo.duration;
    this._draw(demo);
  }

  _draw(demo) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0c0c14');
    grad.addColorStop(1, '#06060a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(80, 130, 180, 0.10)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const tNorm = this.t / demo.duration;
    const state = demo.stateAt(tNorm);
    const lm = buildHandLandmarks(state.curls, { thumbToMiddle: state.thumbToMiddle ?? 0 });

    // Hand reserved area: top portion of canvas left for extras visualization
    const handYOffset = 20;
    const handScale = 0.78;
    const handCx = w * 0.5;
    const handCyBase = h * 0.5 + handYOffset;
    const transformLm = lm.map((p) => ({
      x: handCx + (p.x - 0.5) * w * handScale,
      y: handCyBase + (p.y - 0.55) * h * handScale
    }));

    // Compute landmarks scaled to pixel space for extras (using normalized 0..1 within demo box)
    const lmPx = transformLm.map((p) => ({ x: p.x / w, y: p.y / h }));

    // Draw extras BEHIND the hand (locks, glow)
    if (demo.drawExtras) demo.drawExtras(ctx, lmPx, w, h, state);

    // Draw bones (connections)
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.85)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(transformLm[a].x, transformLm[a].y);
      ctx.lineTo(transformLm[b].x, transformLm[b].y);
      ctx.stroke();
    }

    // Draw landmarks
    for (let i = 0; i < transformLm.length; i++) {
      const p = transformLm[i];
      const isTip = [4, 8, 12, 16, 20].includes(i);
      const isWrist = i === 0;
      ctx.fillStyle = isWrist ? '#ffffff' : (isTip ? '#ffe066' : '#5cf5b5');
      ctx.beginPath();
      ctx.arc(p.x, p.y, isWrist ? 4 : (isTip ? 4 : 2.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // Title
    ctx.fillStyle = '#ffcc66';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(demo.title, w / 2, 22);

    // Caption based on phase
    let captionText = '';
    for (const c of demo.captions) {
      if (tNorm >= c.t) captionText = c.text;
    }
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(captionText, w / 2, h - 12);

    // Progress bar
    const barY = h - 4;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, barY, w, 2);
    ctx.fillStyle = '#ffcc66';
    ctx.fillRect(0, barY, w * tNorm, 2);
  }
}
