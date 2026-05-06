export const CONFIG = {
  POSE: {
    FINGER_EXTEND_RATIO: 0.78,
    FINGER_CURL_RATIO: 0.62,
    TRIGGER_FLEX_DELTA_RAD: 0.45,
    TRIGGER_RELEASE_DELTA_RAD: 0.20,
    ABSENT_FRAMES_FOR_RELOAD: 18,
    TWO_HAND_MAX_DISTANCE: 0.35,
    RIFLE_HYSTERESIS_MS: 350,
    AIM_SMOOTH_ALPHA: 0.35,
    SNAP_PRIME_RATIO: 0.45,
    SNAP_RELEASE_RATIO: 0.85,
    SNAP_RELEASE_SPEED: 0.35,
    FINGER_EXT_THRESHOLD: 1.55,
    INDEX_EXTENDED_ANGLE: Math.PI - 0.35,
    INDEX_CURLED_ANGLE: Math.PI - 0.7,
    TWO_HAND_PUSH_RATIO: 5.5
  },

  GAME_MODES: {
    TIMED: { id: 'timed', label: '時間制限', durationMs: 180000 },
    ENDLESS: { id: 'endless', label: '無制限', durationMs: 0 }
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
    WALK_SPEED: 1.55,
    MELEE_RANGE: 1.6,
    MELEE_DPS: 9,
    MAX_SIMULTANEOUS_ATTACKERS: 4,
    SPAWN_BASE_INTERVAL_MS: 1300,
    SPAWN_MIN_INTERVAL_MS: 260,
    SPAWN_INTERVAL_DECAY_PER_SEC: 18,
    SPAWN_RADIUS_MIN: 18,
    SPAWN_RADIUS_MAX: 32,
    SPAWN_FRONT_ARC_RAD: Math.PI * 1.0,
    MAX_CONCURRENT: 32,
    BURST_AT_SEC: 45,
    BURST_EXTRA: 1,
    BURST_AT_SEC_2: 120,
    BURST_EXTRA_2: 1
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
