import { CONFIG } from '../config.js';
import { angle3, dist2D, lerp, median, variance } from '../util/math.js';

const LM = {
  WRIST: 0,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  THUMB_TIP: 4
};

const PROFILE_KEY = 'zombie_shooter_calib_v1';

function pipAngle(lm) {
  return angle3(lm[LM.INDEX_MCP], lm[LM.INDEX_PIP], lm[LM.INDEX_DIP]);
}

function fingerExtensionRatio(lm) {
  const w = lm[LM.WRIST];
  const m = lm[LM.INDEX_MCP];
  const t = lm[LM.INDEX_TIP];
  const wm = dist2D(w, m);
  if (wm < 1e-6) return 1;
  return dist2D(w, t) / wm;
}

function palmSize(lm) {
  return dist2D(lm[LM.WRIST], lm[LM.MIDDLE_MCP]);
}

const STEP_SAMPLE_COUNT = 30;
const STEP_STABILITY_FRAMES = 8;
const STABILITY_THRESHOLD = 0.005;

export class Calibration {
  constructor() {
    this.profile = null;
    this.activeStep = null;
    this.samples = [];
    this.stabilityWindow = [];
    this.onProgress = null;
    this.onStable = null;
    this.onComplete = null;
    this._collected = {};
  }

  static loadStoredProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.triggerThreshold !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  static clearStoredProfile() {
    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {}
  }

  saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {}
  }

  startStep(stepName) {
    this.activeStep = stepName;
    this.samples = [];
    this.stabilityWindow = [];
  }

  feedFrame(result) {
    if (!this.activeStep) return { stable: false, progress: 0, status: 'idle' };
    const hasHand = result && result.landmarks && result.landmarks.length > 0;
    if (!hasHand && this.activeStep !== 'rifle') {
      return { stable: false, progress: 0, status: '手をかざしてください' };
    }
    if (this.activeStep === 'rifle' && (!result || result.landmarks.length < 2)) {
      return { stable: false, progress: 0, status: '両手をかざしてください' };
    }

    let primaryLm = null;
    if (this.activeStep === 'rifle') {
      const w0 = result.landmarks[0][LM.WRIST];
      const w1 = result.landmarks[1][LM.WRIST];
      const handDist = dist2D(w0, w1);
      this.stabilityWindow.push(handDist);
      if (this.stabilityWindow.length > STEP_STABILITY_FRAMES) this.stabilityWindow.shift();
      const stable =
        this.stabilityWindow.length >= STEP_STABILITY_FRAMES &&
        variance(this.stabilityWindow) < STABILITY_THRESHOLD;
      if (stable) {
        this.samples.push(handDist);
      }
      const progress = this.samples.length / STEP_SAMPLE_COUNT;
      if (this.samples.length >= STEP_SAMPLE_COUNT) {
        return { stable: true, progress: 1, status: '計測完了！', done: true };
      }
      return {
        stable,
        progress,
        status: stable ? `計測中... ${this.samples.length}/${STEP_SAMPLE_COUNT}` : '両手を安定させてください'
      };
    }

    primaryLm = result.landmarks[0];
    const angle = pipAngle(primaryLm);
    this.stabilityWindow.push(angle);
    if (this.stabilityWindow.length > STEP_STABILITY_FRAMES) this.stabilityWindow.shift();
    const stable =
      this.stabilityWindow.length >= STEP_STABILITY_FRAMES &&
      variance(this.stabilityWindow) < STABILITY_THRESHOLD;
    if (stable) {
      this.samples.push({
        angle,
        ratio: fingerExtensionRatio(primaryLm),
        palm: palmSize(primaryLm)
      });
    }
    const progress = this.samples.length / STEP_SAMPLE_COUNT;
    if (this.samples.length >= STEP_SAMPLE_COUNT) {
      return { stable: true, progress: 1, status: '計測完了！', done: true };
    }
    return {
      stable,
      progress,
      status: stable
        ? `計測中... ${this.samples.length}/${STEP_SAMPLE_COUNT}`
        : '手を動かさずキープしてください'
    };
  }

  finishStep() {
    if (!this.activeStep || this.samples.length === 0) {
      this.activeStep = null;
      return null;
    }
    if (this.activeStep === 'extended') {
      this._collected.extendedAngle = median(this.samples.map((s) => s.angle));
      this._collected.extendedRatio = median(this.samples.map((s) => s.ratio));
      this._collected.palmSize = median(this.samples.map((s) => s.palm));
    } else if (this.activeStep === 'flexed') {
      this._collected.flexedAngle = median(this.samples.map((s) => s.angle));
    } else if (this.activeStep === 'rifle') {
      this._collected.twoHandDistance = median(this.samples) * 1.4;
    }
    const stepDone = this.activeStep;
    this.activeStep = null;
    this.samples = [];
    this.stabilityWindow = [];
    return stepDone;
  }

  buildProfile() {
    const extendedAngle = this._collected.extendedAngle ?? Math.PI - 0.15;
    const flexedAngle = this._collected.flexedAngle ?? extendedAngle - 0.6;
    if (flexedAngle >= extendedAngle - 0.15) {
      const fallback = extendedAngle - 0.45;
      const finalFlexed = Math.min(flexedAngle, fallback);
      this._collected.flexedAngle = finalFlexed;
    }
    const ext = extendedAngle;
    const flx = this._collected.flexedAngle;
    const profile = {
      triggerExtendedAngle: ext,
      triggerFlexedAngle: flx,
      triggerThreshold: lerp(ext, flx, 0.45),
      triggerReleaseThreshold: lerp(ext, flx, 0.20),
      palmSize: this._collected.palmSize ?? 0.15,
      fingerExtendRatio:
        this._collected.extendedRatio !== undefined
          ? this._collected.extendedRatio * 0.8
          : CONFIG.POSE.FINGER_EXTEND_RATIO,
      twoHandDistance:
        this._collected.twoHandDistance ?? CONFIG.POSE.TWO_HAND_MAX_DISTANCE,
      createdAt: Date.now()
    };
    this.profile = profile;
    this.saveProfile(profile);
    return profile;
  }

  reset() {
    this._collected = {};
    this.activeStep = null;
    this.samples = [];
    this.stabilityWindow = [];
    this.profile = null;
  }
}
