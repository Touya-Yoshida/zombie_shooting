import { CONFIG } from '../config.js';
import { angle3, dist2D, ema } from '../util/math.js';

const LM = {
  WRIST: 0,
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

function fingerExtended(lm, mcpIdx, tipIdx, ratioThreshold) {
  const wrist = lm[LM.WRIST];
  const mcp = lm[mcpIdx];
  const tip = lm[tipIdx];
  const dWristMcp = dist2D(wrist, mcp);
  const dWristTip = dist2D(wrist, tip);
  if (dWristMcp < 1e-6) return false;
  return dWristTip / dWristMcp > ratioThreshold;
}

function indexPipAngle(lm) {
  return angle3(lm[LM.INDEX_MCP], lm[LM.INDEX_PIP], lm[LM.INDEX_DIP]);
}

function isPistolPose(lm, profile) {
  const ratio = profile?.fingerExtendRatio ?? CONFIG.POSE.FINGER_EXTEND_RATIO;
  const indexExt = fingerExtended(lm, LM.INDEX_MCP, LM.INDEX_TIP, ratio);
  const midExt = fingerExtended(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, ratio);
  const ringExt = fingerExtended(lm, LM.RING_MCP, LM.RING_TIP, ratio);
  const pinkyExt = fingerExtended(lm, LM.PINKY_MCP, LM.PINKY_TIP, ratio);
  return indexExt && !midExt && !ringExt && !pinkyExt;
}

function gripDetected(lm, profile) {
  const ratio = profile?.fingerExtendRatio ?? CONFIG.POSE.FINGER_EXTEND_RATIO;
  const indexExt = fingerExtended(lm, LM.INDEX_MCP, LM.INDEX_TIP, ratio);
  const midExt = fingerExtended(lm, LM.MIDDLE_MCP, LM.MIDDLE_TIP, ratio);
  const allCurled = !indexExt && !midExt;
  const fingerGun = indexExt && !midExt;
  return allCurled || fingerGun;
}

export class PoseClassifier {
  constructor() {
    this.profile = null;
    this.absentFrames = 0;
    this.triggerLatched = false;
    this.smoothAimX = null;
    this.smoothAimY = null;
    this.lastTriggerEdge = false;
    this.triggerHeld = false;
    this.lastRifleTimestamp = 0;
    this.indexAngleEMA = null;
  }

  setProfile(profile) {
    this.profile = profile;
  }

  classify(result, nowMs) {
    const out = {
      present: false,
      twoHands: false,
      weapon: null,
      triggerPulled: false,
      triggerHeld: false,
      aimNDC: this.smoothAimX !== null ? { x: this.smoothAimX, y: this.smoothAimY } : null,
      absentFrames: this.absentFrames,
      reloadRequested: false,
      indexAngle: null
    };

    const hasHands = result && result.landmarks && result.landmarks.length > 0;
    if (!hasHands) {
      this.absentFrames++;
      this.triggerLatched = false;
      this.triggerHeld = false;
      out.absentFrames = this.absentFrames;
      if (this.absentFrames === CONFIG.POSE.ABSENT_FRAMES_FOR_RELOAD) {
        out.reloadRequested = true;
      }
      return out;
    }

    if (this.absentFrames > 0) {
      this.absentFrames = 0;
    }
    out.present = true;

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

    const tip = lm[LM.INDEX_TIP];
    const ndcX = (1 - tip.x) * 2 - 1;
    const ndcY = -(tip.y * 2 - 1);
    const alpha = CONFIG.POSE.AIM_SMOOTH_ALPHA;
    this.smoothAimX = ema(this.smoothAimX, ndcX, alpha);
    this.smoothAimY = ema(this.smoothAimY, ndcY, alpha);
    out.aimNDC = { x: this.smoothAimX, y: this.smoothAimY };

    const twoHands = result.landmarks.length >= 2;
    let isRifle = false;
    if (twoHands) {
      const wristA = result.landmarks[0][LM.WRIST];
      const wristB = result.landmarks[1][LM.WRIST];
      const handDist = dist2D(wristA, wristB);
      const distThresh = this.profile?.twoHandDistance ?? CONFIG.POSE.TWO_HAND_MAX_DISTANCE;
      const closeEnough = handDist < distThresh;
      const bothGrip =
        gripDetected(result.landmarks[0], this.profile) &&
        gripDetected(result.landmarks[1], this.profile);
      if (closeEnough && bothGrip) {
        isRifle = true;
        this.lastRifleTimestamp = nowMs;
      }
    }
    if (!isRifle && nowMs - this.lastRifleTimestamp < CONFIG.POSE.RIFLE_HYSTERESIS_MS) {
      isRifle = true;
    }

    const pistol = isPistolPose(lm, this.profile);
    if (isRifle) out.weapon = 'rifle';
    else if (pistol) out.weapon = 'pistol';
    else out.weapon = null;
    out.twoHands = twoHands;

    const angle = indexPipAngle(lm);
    out.indexAngle = angle;
    this.indexAngleEMA = ema(this.indexAngleEMA, angle, 0.5);

    const extendedAngle = this.profile?.triggerExtendedAngle ?? Math.PI - 0.2;
    const flexedAngle = this.profile?.triggerFlexedAngle ?? Math.PI / 2;
    const triggerThresh =
      this.profile?.triggerThreshold ?? extendedAngle - CONFIG.POSE.TRIGGER_FLEX_DELTA_RAD;
    const releaseThresh =
      this.profile?.triggerReleaseThreshold ?? extendedAngle - CONFIG.POSE.TRIGGER_RELEASE_DELTA_RAD;

    const hasGunPose = out.weapon !== null;

    if (hasGunPose) {
      if (angle < triggerThresh && !this.triggerLatched) {
        this.triggerLatched = true;
        out.triggerPulled = true;
      } else if (angle > releaseThresh && this.triggerLatched) {
        this.triggerLatched = false;
      }
      this.triggerHeld = angle < (triggerThresh + releaseThresh) / 2;
    } else {
      this.triggerLatched = false;
      this.triggerHeld = false;
    }
    out.triggerHeld = this.triggerHeld;

    return out;
  }

  reset() {
    this.absentFrames = 0;
    this.triggerLatched = false;
    this.triggerHeld = false;
    this.smoothAimX = null;
    this.smoothAimY = null;
    this.indexAngleEMA = null;
  }
}
