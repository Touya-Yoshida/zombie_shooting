import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.video = null;
    this.lastResult = null;
    this.lastTimestamp = -1;
    this.ready = false;
  }

  async init(videoEl) {
    this.video = videoEl;
    const fileset = await FilesetResolver.forVisionTasks('/wasm');
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: '/models/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    this.ready = true;
  }

  detect(timestampMs) {
    if (!this.ready || !this.video) return null;
    if (this.video.readyState < 2) return null;
    const ts = Math.floor(timestampMs);
    if (ts <= this.lastTimestamp) return this.lastResult;
    this.lastTimestamp = ts;
    try {
      this.lastResult = this.landmarker.detectForVideo(this.video, ts);
    } catch (e) {
      console.warn('Hand detection error:', e);
    }
    return this.lastResult;
  }

  getDominantHand(result) {
    if (!result || !result.landmarks || result.landmarks.length === 0) return null;
    if (result.landmarks.length === 1) {
      return { landmarks: result.landmarks[0], handedness: result.handedness?.[0] };
    }
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < result.handedness.length; i++) {
      const cat = result.handedness[i][0];
      if (cat.categoryName === 'Right' && cat.score > bestScore) {
        bestScore = cat.score;
        bestIdx = i;
      }
    }
    return { landmarks: result.landmarks[bestIdx], handedness: result.handedness?.[bestIdx] };
  }

  hasTwoHands(result) {
    return result && result.landmarks && result.landmarks.length >= 2;
  }
}
