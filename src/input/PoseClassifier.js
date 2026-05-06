import { CONFIG } from '../config.js';
import { angle3, dist2D, ema } from '../util/math.js';

const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_TIP: 20
};

function fingerRatio(lm, mcpIdx, tipIdx) {
  const wrist = lm[LM.WRIST];
  const mcp = lm[mcpIdx];
  const tip = lm[tipIdx];
  const wm = dist2D(wrist, mcp);
  if (wm < 1e-6) return 0;
  return dist2D(wrist, tip) / wm;
}

function fingerExt(lm, mcpIdx, tipIdx, threshold) {
  return fingerRatio(lm, mcpIdx, tipIdx) > threshold;
}

function snapRatio(lm) {
  const palm = dist2D(lm[LM.WRIST], lm[LM.MIDDLE_MCP]);
  if (palm < 1e-6) return 999;
  return dist2D(lm[LM.THUMB_TIP], lm[LM.MIDDLE_TIP]) / palm;
}

function detectOpenPalm(lm, t) {
  return fingerExt(lm, LM.INDEX_MCP, LM.INDEX_TIP, t) &&
         fingerExt(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, t) &&
         fingerExt(lm, LM.RING_MCP, LM.RING_TIP, t) &&
         fingerExt(lm, LM.PINKY_MCP, LM.PINKY_TIP, t);
}

function detectPointing(lm, t) {
  return fingerExt(lm, LM.INDEX_MCP, LM.INDEX_TIP, t) &&
         !fingerExt(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, t) &&
         !fingerExt(lm, LM.RING_MCP, LM.RING_TIP, t) &&
         !fingerExt(lm, LM.PINKY_MCP, LM.PINKY_TIP, t);
}

function detectPistolPose(lm, t) {
  // index extended + thumb extended (out/up) + others curled
  const indexExt = fingerExt(lm, LM.INDEX_MCP, LM.INDEX_TIP, t);
  const thumbExt = fingerRatio(lm, LM.THUMB_MCP, LM.THUMB_TIP) > 1.30;
  const midCurl = !fingerExt(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, t);
  const ringCurl = !fingerExt(lm, LM.RING_MCP, LM.RING_TIP, t);
  const pinkyCurl = !fingerExt(lm, LM.PINKY_MCP, LM.PINKY_TIP, t);
  return indexExt && thumbExt && midCurl && ringCurl && pinkyCurl;
}

function detectGripPose(lm, t) {
  // All four main fingers curled (fist or holding)
  const indexCurl = !fingerExt(lm, LM.INDEX_MCP, LM.INDEX_TIP, t);
  const midCurl = !fingerExt(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, t);
  const ringCurl = !fingerExt(lm, LM.RING_MCP, LM.RING_TIP, t);
  const pinkyCurl = !fingerExt(lm, LM.PINKY_MCP, LM.PINKY_TIP, t);
  return indexCurl && midCurl && ringCurl && pinkyCurl;
}

export class PoseClassifier {
  constructor() {
    this.profile = null;
    this.absentFrames = 0;
    this.snapLatched = false;
    this.lastSnapDistance = null;
    this.smoothAimX = null;
    this.smoothAimY = null;
    this.indexExtendedLatched = false;
    this.lastTwoHandPush = false;

    this.wristYHistory = [];
    this.handCenterHistory = [];
    this.wristSnapCooldown = 0;
    this.swingCooldown = 0;
  }

  setProfile(profile) {
    this.profile = profile;
  }

  reset() {
    this.absentFrames = 0;
    this.snapLatched = false;
    this.lastSnapDistance = null;
    this.smoothAimX = null;
    this.smoothAimY = null;
    this.indexExtendedLatched = false;
    this.lastTwoHandPush = false;
    this.wristYHistory = [];
    this.handCenterHistory = [];
    this.wristSnapCooldown = 0;
    this.swingCooldown = 0;
  }

  classify(result, nowMs) {
    const out = {
      present: false,
      twoHands: false,
      aimNDC: this.smoothAimX !== null ? { x: this.smoothAimX, y: this.smoothAimY } : null,
      absentFrames: this.absentFrames,
      reloadRequested: false,
      snapPrimed: false,
      snapFired: false,
      openPalm: false,
      pointingIndex: false,
      indexCurled: false,
      pistolPose: false,
      gripPose: false,
      wristSnapUp: false,
      swingDown: false,
      twoHandPush: false,
      twoHandPushFired: false,
      aimSource: null
    };

    const hasHands = result && result.landmarks && result.landmarks.length > 0;
    if (!hasHands) {
      this.absentFrames++;
      this.snapLatched = false;
      this.indexExtendedLatched = false;
      this.lastTwoHandPush = false;
      this.wristYHistory = [];
      this.handCenterHistory = [];
      out.absentFrames = this.absentFrames;
      if (this.absentFrames === CONFIG.POSE.ABSENT_FRAMES_FOR_RELOAD) {
        out.reloadRequested = true;
      }
      return out;
    }

    if (this.absentFrames > 0) this.absentFrames = 0;
    out.present = true;
    out.twoHands = result.landmarks.length >= 2;

    let dominantIdx = 0;
    if (result.handedness && result.handedness.length > 1) {
      let bestScore = -1;
      for (let i = 0; i < result.handedness.length; i++) {
        const cat = result.handedness[i][0];
        if (cat.categoryName === 'Right' && cat.score > bestScore) {
          bestScore = cat.score;
          dominantIdx = i;
        }
      }
    }
    const lm = result.landmarks[dominantIdx];
    const fingerT = CONFIG.POSE.FINGER_EXT_THRESHOLD;

    const openPalm = detectOpenPalm(lm, fingerT);
    const pointing = detectPointing(lm, fingerT);
    const pistol = detectPistolPose(lm, fingerT);
    const grip = detectGripPose(lm, fingerT);
    const snapDist = snapRatio(lm);

    out.openPalm = openPalm;
    out.pointingIndex = pointing;
    out.pistolPose = pistol;
    out.gripPose = grip;

    let aimX, aimY;
    if (pistol || pointing) {
      aimX = lm[LM.INDEX_TIP].x;
      aimY = lm[LM.INDEX_TIP].y;
      out.aimSource = 'index';
    } else if (openPalm) {
      aimX = (lm[LM.INDEX_TIP].x + lm[LM.MIDDLE_TIP].x + lm[LM.RING_TIP].x) / 3;
      aimY = (lm[LM.INDEX_TIP].y + lm[LM.MIDDLE_TIP].y + lm[LM.RING_TIP].y) / 3;
      out.aimSource = 'palm';
    } else if (grip) {
      aimX = (lm[LM.WRIST].x + lm[LM.MIDDLE_MCP].x) / 2;
      aimY = (lm[LM.WRIST].y + lm[LM.MIDDLE_MCP].y) / 2;
      out.aimSource = 'grip';
    } else {
      aimX = (lm[LM.THUMB_TIP].x + lm[LM.MIDDLE_TIP].x) / 2;
      aimY = (lm[LM.THUMB_TIP].y + lm[LM.MIDDLE_TIP].y) / 2;
      out.aimSource = 'snap';
    }
    const ndcX = (1 - aimX) * 2 - 1;
    const ndcY = -(aimY * 2 - 1);
    const alpha = CONFIG.POSE.AIM_SMOOTH_ALPHA;
    this.smoothAimX = ema(this.smoothAimX, ndcX, alpha);
    this.smoothAimY = ema(this.smoothAimY, ndcY, alpha);
    out.aimNDC = { x: this.smoothAimX, y: this.smoothAimY };

    // Snap (Mustang)
    const lastDist = this.lastSnapDistance ?? snapDist;
    const dDist = snapDist - lastDist;
    this.lastSnapDistance = snapDist;
    const primeThresh = CONFIG.POSE.SNAP_PRIME_RATIO;
    const releaseThresh = CONFIG.POSE.SNAP_RELEASE_RATIO;
    const releaseSpeed = CONFIG.POSE.SNAP_RELEASE_SPEED;
    if (snapDist < primeThresh) {
      this.snapLatched = true;
    } else if (this.snapLatched && (snapDist > releaseThresh || dDist > releaseSpeed)) {
      this.snapLatched = false;
      out.snapFired = true;
    }
    out.snapPrimed = this.snapLatched;

    // Pointing → curl trigger (legacy Mech, still emitted)
    const indexAngle = angle3(lm[LM.INDEX_MCP], lm[LM.INDEX_PIP], lm[LM.INDEX_DIP]);
    const extAngle = CONFIG.POSE.INDEX_EXTENDED_ANGLE;
    const curlAngle = CONFIG.POSE.INDEX_CURLED_ANGLE;
    if (pointing && indexAngle > extAngle) {
      this.indexExtendedLatched = true;
    } else if (this.indexExtendedLatched && indexAngle < curlAngle) {
      this.indexExtendedLatched = false;
      out.indexCurled = true;
    }

    // Two-hand push
    if (out.twoHands) {
      const otherIdx = dominantIdx === 0 ? 1 : 0;
      const lmOther = result.landmarks[otherIdx];
      const palmA = openPalm;
      const palmB = detectOpenPalm(lmOther, fingerT);
      const wristDist = dist2D(lm[LM.WRIST], lmOther[LM.WRIST]);
      const palmRef = dist2D(lm[LM.WRIST], lm[LM.MIDDLE_MCP]) || 0.001;
      const wristRatio = wristDist / palmRef;
      if (palmA && palmB && wristRatio < CONFIG.POSE.TWO_HAND_PUSH_RATIO) {
        out.twoHandPush = true;
        if (!this.lastTwoHandPush) out.twoHandPushFired = true;
      }
    }
    this.lastTwoHandPush = out.twoHandPush;

    // Motion tracking for wrist snap up & swing down
    const palmRef = dist2D(lm[LM.WRIST], lm[LM.MIDDLE_MCP]) || 0.001;
    this.wristYHistory.push({ y: lm[LM.WRIST].y, t: nowMs });
    while (this.wristYHistory.length > 0 && nowMs - this.wristYHistory[0].t > 220) {
      this.wristYHistory.shift();
    }
    if (this.wristYHistory.length >= 3 && nowMs > this.wristSnapCooldown) {
      const oldest = this.wristYHistory[0];
      const newest = this.wristYHistory[this.wristYHistory.length - 1];
      const dt = (newest.t - oldest.t) / 1000;
      if (dt >= 0.05) {
        const dy = (newest.y - oldest.y) / palmRef;
        const speed = dy / dt; // y is downward in image space → negative = upward
        if (speed < -3.2) {
          out.wristSnapUp = true;
          this.wristSnapCooldown = nowMs + 350;
        }
      }
    }

    const hcx = (lm[LM.WRIST].x + lm[LM.MIDDLE_MCP].x) / 2;
    const hcy = (lm[LM.WRIST].y + lm[LM.MIDDLE_MCP].y) / 2;
    this.handCenterHistory.push({ x: hcx, y: hcy, t: nowMs });
    while (this.handCenterHistory.length > 0 && nowMs - this.handCenterHistory[0].t > 280) {
      this.handCenterHistory.shift();
    }
    if (this.handCenterHistory.length >= 3 && nowMs > this.swingCooldown) {
      const oldest = this.handCenterHistory[0];
      const newest = this.handCenterHistory[this.handCenterHistory.length - 1];
      const dt = (newest.t - oldest.t) / 1000;
      if (dt >= 0.05) {
        const dy = (newest.y - oldest.y) / palmRef;
        const speed = dy / dt;
        if (speed > 3.6) {
          out.swingDown = true;
          this.swingCooldown = nowMs + 480;
        }
      }
    }

    return out;
  }
}
