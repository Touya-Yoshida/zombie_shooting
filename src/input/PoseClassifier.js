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
  const indexExt = fingerExt(lm, LM.INDEX_MCP, LM.INDEX_TIP, t);
  const thumbExt = fingerRatio(lm, LM.THUMB_MCP, LM.THUMB_TIP) > 1.30;
  const midCurl = !fingerExt(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, t);
  const ringCurl = !fingerExt(lm, LM.RING_MCP, LM.RING_TIP, t);
  const pinkyCurl = !fingerExt(lm, LM.PINKY_MCP, LM.PINKY_TIP, t);
  return indexExt && thumbExt && midCurl && ringCurl && pinkyCurl;
}

function detectGripPose(lm, t) {
  const indexCurl = !fingerExt(lm, LM.INDEX_MCP, LM.INDEX_TIP, t);
  const midCurl = !fingerExt(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, t);
  const ringCurl = !fingerExt(lm, LM.RING_MCP, LM.RING_TIP, t);
  const pinkyCurl = !fingerExt(lm, LM.PINKY_MCP, LM.PINKY_TIP, t);
  return indexCurl && midCurl && ringCurl && pinkyCurl;
}

function emptyHandResult() {
  return {
    present: false,
    aimNDC: null,
    snapPrimed: false,
    snapFired: false,
    openPalm: false,
    pointingIndex: false,
    indexCurled: false,
    pistolPose: false,
    gripPose: false,
    wristSnapUp: false,
    swingDown: false,
    punchFired: false,
    aimSource: null
  };
}

export class PoseClassifier {
  constructor() {
    this.profile = null;
    this.absentFrames = 0;
    this.lastTwoHandPush = false;
    this.hands = {
      left: this._newHandState(),
      right: this._newHandState()
    };
  }

  _newHandState() {
    return {
      snapLatched: false,
      lastSnapDistance: null,
      smoothAimX: null,
      smoothAimY: null,
      indexExtendedLatched: false,
      wristYHistory: [],
      handCenterHistory: [],
      palmSizeHistory: [],
      wristSnapCooldown: 0,
      swingCooldown: 0,
      punchCooldown: 0
    };
  }

  setProfile(profile) {
    this.profile = profile;
  }

  reset() {
    this.absentFrames = 0;
    this.lastTwoHandPush = false;
    this.hands.left = this._newHandState();
    this.hands.right = this._newHandState();
  }

  _resetHandTransient(slot) {
    const s = this.hands[slot];
    s.snapLatched = false;
    s.indexExtendedLatched = false;
    s.wristYHistory = [];
    s.handCenterHistory = [];
    s.palmSizeHistory = [];
    s.lastSnapDistance = null;
  }

  classify(result, nowMs) {
    const out = {
      present: false,
      twoHands: false,
      twoHandPush: false,
      twoHandPushFired: false,
      reloadRequested: false,
      absentFrames: this.absentFrames,
      left: emptyHandResult(),
      right: emptyHandResult(),
      // Top-level convenience aliases (back-compat with single-hand consumers)
      aimNDC: null,
      snapPrimed: false,
      snapFired: false,
      openPalm: false,
      pointingIndex: false,
      indexCurled: false,
      pistolPose: false,
      gripPose: false,
      wristSnapUp: false,
      swingDown: false,
      punchFired: false,
      aimSource: null
    };

    const hasHands = result && result.landmarks && result.landmarks.length > 0;
    if (!hasHands) {
      this.absentFrames++;
      this.lastTwoHandPush = false;
      this._resetHandTransient('left');
      this._resetHandTransient('right');
      out.absentFrames = this.absentFrames;
      if (this.absentFrames === CONFIG.POSE.ABSENT_FRAMES_FOR_RELOAD) {
        out.reloadRequested = true;
      }
      return out;
    }
    if (this.absentFrames > 0) this.absentFrames = 0;
    out.present = true;
    out.twoHands = result.landmarks.length >= 2;

    // Map hand indices to left/right slots based on MediaPipe handedness.
    const slotAssign = { left: -1, right: -1 };
    const used = new Set();
    if (result.handedness && result.handedness.length > 0) {
      for (let i = 0; i < result.landmarks.length; i++) {
        const cat = result.handedness[i]?.[0];
        if (!cat) continue;
        const slot = cat.categoryName === 'Right' ? 'right' : 'left';
        if (slotAssign[slot] < 0) {
          slotAssign[slot] = i;
          used.add(i);
        }
      }
      // If a slot is still empty but a hand was unassigned (e.g. both labeled
      // the same), drop the leftover into the empty slot.
      for (const slot of ['left', 'right']) {
        if (slotAssign[slot] < 0) {
          for (let i = 0; i < result.landmarks.length; i++) {
            if (!used.has(i)) { slotAssign[slot] = i; used.add(i); break; }
          }
        }
      }
    } else {
      slotAssign.right = 0;
    }

    for (const slot of ['left', 'right']) {
      const idx = slotAssign[slot];
      if (idx < 0) {
        this._resetHandTransient(slot);
        out[slot] = emptyHandResult();
        continue;
      }
      out[slot] = this._classifyHand(result.landmarks[idx], this.hands[slot], nowMs);
    }

    // Two-hand push (open palms, wrists close)
    if (slotAssign.left >= 0 && slotAssign.right >= 0) {
      const lmL = result.landmarks[slotAssign.left];
      const lmR = result.landmarks[slotAssign.right];
      const fingerT = CONFIG.POSE.FINGER_EXT_THRESHOLD;
      const palmA = detectOpenPalm(lmL, fingerT);
      const palmB = detectOpenPalm(lmR, fingerT);
      const wristDist = dist2D(lmL[LM.WRIST], lmR[LM.WRIST]);
      const palmRef = dist2D(lmR[LM.WRIST], lmR[LM.MIDDLE_MCP]) || 0.001;
      const wristRatio = wristDist / palmRef;
      if (palmA && palmB && wristRatio < CONFIG.POSE.TWO_HAND_PUSH_RATIO) {
        out.twoHandPush = true;
        if (!this.lastTwoHandPush) out.twoHandPushFired = true;
      }
    }
    this.lastTwoHandPush = out.twoHandPush;

    // Top-level aliases — prefer right, fall through to left.
    const primary = out.right.present ? out.right : (out.left.present ? out.left : null);
    if (primary) {
      out.aimNDC = primary.aimNDC;
      out.aimSource = primary.aimSource;
    }
    for (const slot of ['left', 'right']) {
      const h = out[slot];
      if (!h.present) continue;
      out.snapPrimed = out.snapPrimed || h.snapPrimed;
      out.snapFired = out.snapFired || h.snapFired;
      out.openPalm = out.openPalm || h.openPalm;
      out.pointingIndex = out.pointingIndex || h.pointingIndex;
      out.indexCurled = out.indexCurled || h.indexCurled;
      out.pistolPose = out.pistolPose || h.pistolPose;
      out.gripPose = out.gripPose || h.gripPose;
      out.wristSnapUp = out.wristSnapUp || h.wristSnapUp;
      out.swingDown = out.swingDown || h.swingDown;
      out.punchFired = out.punchFired || h.punchFired;
    }

    return out;
  }

  _classifyHand(lm, state, nowMs) {
    const fingerT = CONFIG.POSE.FINGER_EXT_THRESHOLD;
    const out = emptyHandResult();
    out.present = true;

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
    state.smoothAimX = ema(state.smoothAimX, ndcX, alpha);
    state.smoothAimY = ema(state.smoothAimY, ndcY, alpha);
    out.aimNDC = { x: state.smoothAimX, y: state.smoothAimY };

    // Snap (Mustang)
    const lastDist = state.lastSnapDistance ?? snapDist;
    const dDist = snapDist - lastDist;
    state.lastSnapDistance = snapDist;
    const primeThresh = CONFIG.POSE.SNAP_PRIME_RATIO;
    const releaseThresh = CONFIG.POSE.SNAP_RELEASE_RATIO;
    const releaseSpeed = CONFIG.POSE.SNAP_RELEASE_SPEED;
    if (snapDist < primeThresh) {
      state.snapLatched = true;
    } else if (state.snapLatched && (snapDist > releaseThresh || dDist > releaseSpeed)) {
      state.snapLatched = false;
      out.snapFired = true;
    }
    out.snapPrimed = state.snapLatched;

    // Pointing → curl trigger
    const indexAngle = angle3(lm[LM.INDEX_MCP], lm[LM.INDEX_PIP], lm[LM.INDEX_DIP]);
    const extAngle = CONFIG.POSE.INDEX_EXTENDED_ANGLE;
    const curlAngle = CONFIG.POSE.INDEX_CURLED_ANGLE;
    if (pointing && indexAngle > extAngle) {
      state.indexExtendedLatched = true;
    } else if (state.indexExtendedLatched && indexAngle < curlAngle) {
      state.indexExtendedLatched = false;
      out.indexCurled = true;
    }

    // Wrist snap up
    const palmRef = dist2D(lm[LM.WRIST], lm[LM.MIDDLE_MCP]) || 0.001;
    state.wristYHistory.push({ y: lm[LM.WRIST].y, t: nowMs });
    while (state.wristYHistory.length > 0 && nowMs - state.wristYHistory[0].t > 220) {
      state.wristYHistory.shift();
    }
    if (state.wristYHistory.length >= 3 && nowMs > state.wristSnapCooldown) {
      const oldest = state.wristYHistory[0];
      const newest = state.wristYHistory[state.wristYHistory.length - 1];
      const dt = (newest.t - oldest.t) / 1000;
      if (dt >= 0.05) {
        const dy = (newest.y - oldest.y) / palmRef;
        const speed = dy / dt;
        if (speed < -3.2) {
          out.wristSnapUp = true;
          state.wristSnapCooldown = nowMs + 350;
        }
      }
    }

    // Swing down
    const hcx = (lm[LM.WRIST].x + lm[LM.MIDDLE_MCP].x) / 2;
    const hcy = (lm[LM.WRIST].y + lm[LM.MIDDLE_MCP].y) / 2;
    state.handCenterHistory.push({ x: hcx, y: hcy, t: nowMs });
    while (state.handCenterHistory.length > 0 && nowMs - state.handCenterHistory[0].t > 280) {
      state.handCenterHistory.shift();
    }
    if (state.handCenterHistory.length >= 3 && nowMs > state.swingCooldown) {
      const oldest = state.handCenterHistory[0];
      const newest = state.handCenterHistory[state.handCenterHistory.length - 1];
      const dt = (newest.t - oldest.t) / 1000;
      if (dt >= 0.05) {
        const dy = (newest.y - oldest.y) / palmRef;
        const speed = dy / dt;
        if (speed > 3.6) {
          out.swingDown = true;
          state.swingCooldown = nowMs + 480;
        }
      }
    }

    // Punch (closed fist thrust toward camera → palm grows fast)
    state.palmSizeHistory.push({ s: palmRef, t: nowMs });
    while (state.palmSizeHistory.length > 0 && nowMs - state.palmSizeHistory[0].t > 240) {
      state.palmSizeHistory.shift();
    }
    if (grip && state.palmSizeHistory.length >= 3 && nowMs > state.punchCooldown) {
      const oldest = state.palmSizeHistory[0];
      const newest = state.palmSizeHistory[state.palmSizeHistory.length - 1];
      const dt = (newest.t - oldest.t) / 1000;
      if (dt >= 0.06 && oldest.s > 1e-4) {
        const growthRate = (newest.s / oldest.s - 1) / dt;
        if (growthRate > 1.6) {
          out.punchFired = true;
          state.punchCooldown = nowMs + 380;
        }
      }
    }

    return out;
  }
}
