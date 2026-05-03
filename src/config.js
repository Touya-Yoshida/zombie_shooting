export const CONFIG = {
  POSE: {
    FINGER_EXTEND_RATIO: 0.78,
    FINGER_CURL_RATIO: 0.62,
    TRIGGER_FLEX_DELTA_RAD: 0.45,
    TRIGGER_RELEASE_DELTA_RAD: 0.20,
    ABSENT_FRAMES_FOR_RELOAD: 18,
    TWO_HAND_MAX_DISTANCE: 0.35,
    RIFLE_HYSTERESIS_MS: 350,
    AIM_SMOOTH_ALPHA: 0.35
  },

  WEAPONS: {
    PISTOL: {
      name: 'PISTOL',
      damage: 35,
      headshotMultiplier: 3,
      rpm: 240,
      magSize: 7,
      reloadMs: 900,
      auto: false,
      spread: 0.0
    },
    RIFLE: {
      name: 'RIFLE',
      damage: 28,
      headshotMultiplier: 3,
      rpm: 600,
      magSize: 30,
      reloadMs: 1500,
      auto: true,
      spread: 0.012
    }
  },

  ZOMBIES: {
    BODY_HP: 70,
    HEADSHOT_DAMAGE_MULTIPLIER: 3,
    WALK_SPEED: 1.5,
    MELEE_RANGE: 1.7,
    MELEE_DPS: 14,
    SPAWN_BASE_INTERVAL_MS: 2400,
    SPAWN_MIN_INTERVAL_MS: 700,
    SPAWN_INTERVAL_DECAY_PER_SEC: 8,
    SPAWN_RADIUS_MIN: 22,
    SPAWN_RADIUS_MAX: 35,
    MAX_CONCURRENT: 24
  },

  PLAYER: {
    MAX_HP: 100,
    EYE_HEIGHT: 1.7
  },

  AUDIO: {
    MASTER_VOLUME: 0.6
  },

  CAMERA: {
    FOV: 70,
    NEAR: 0.1,
    FAR: 200
  }
};
