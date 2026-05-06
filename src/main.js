import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createScene } from './render/Scene.js';
import { createCamera, handleResize } from './render/Camera.js';
import { GunViewModel } from './render/GunViewModel.js';
import { CharacterViewModel } from './render/CharacterViewModel.js';
import { Effects } from './render/Effects.js';
import { HandTracker } from './input/HandTracker.js';
import { PoseClassifier } from './input/PoseClassifier.js';
import { Calibration } from './input/Calibration.js';
import { GameState, STATE } from './game/GameState.js';
import { WeaponSystem } from './game/WeaponSystem.js';
import { AbilitySystem } from './game/AbilitySystem.js';
import { ZombieSpawner } from './game/ZombieSpawner.js';
import { AudioBus } from './audio/AudioBus.js';
import { HUD } from './ui/HUD.js';
import { Reticle } from './ui/Reticle.js';
import { HandStatusOverlay } from './ui/HandStatusOverlay.js';
import { VtuberAvatar, CHARACTERS, drawCharacterPreview } from './ui/VtuberAvatar.js';
import { HandDemo } from './ui/HandDemo.js';
import { performHitscan } from './util/raycast.js';
import { submitScore, getScores, computeScore, formatSurvivedMs, clearScores } from './game/HighScores.js';

const video = document.getElementById('video');
const canvas = document.getElementById('three');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const recalibrateBtn = document.getElementById('recalibrate-btn');
const calibOverlay = document.getElementById('calibration-overlay');
const calibTitle = document.getElementById('calib-title');
const calibInstruction = document.getElementById('calib-instruction');
const calibStep = document.getElementById('calib-step');
const calibProgressBar = document.getElementById('calib-progress-bar');
const calibStatus = document.getElementById('calib-status');
const calibSkipBtn = document.getElementById('calib-skip-btn');
const gameoverOverlay = document.getElementById('gameover-overlay');
const gameoverTitle = document.getElementById('gameover-title');
const finalTime = document.getElementById('final-time');
const finalKills = document.getElementById('final-kills');
const restartBtn = document.getElementById('restart-btn');
const characterSelect = document.getElementById('character-select');
const modeSelect = document.getElementById('mode-select');
const scoreboardList = document.getElementById('scoreboard-list');
const scoreboardTabs = document.querySelectorAll('.scoreboard-tab');
const scoresClearBtn = document.getElementById('scores-clear-btn');
const gameoverCause = document.getElementById('gameover-cause');
const gameoverRank = document.getElementById('gameover-rank');
const gameoverScoreList = document.getElementById('gameover-scoreboard-list');
const finalScore = document.getElementById('final-score');
const backToTitleBtn = document.getElementById('back-to-title-btn');
const modeBadge = document.getElementById('mode-badge');
const handDemoCanvas = document.getElementById('hand-demo');
const handDemo = handDemoCanvas ? new HandDemo(handDemoCanvas) : null;
const damageVignette = document.getElementById('damage-vignette');

const SELECT_KEY = 'flame_alchemist_select_v1';
const stored = (() => {
  try { return JSON.parse(localStorage.getItem(SELECT_KEY) || '{}'); } catch { return {}; }
})();
let selectedCharacter = (CHARACTERS[stored.character] && stored.character !== 'robo_pilot')
  ? stored.character
  : 'flame_colonel';
let selectedMode = stored.mode === 'endless' ? 'endless' : 'timed';

function persistSelection() {
  try {
    localStorage.setItem(SELECT_KEY, JSON.stringify({ character: selectedCharacter, mode: selectedMode }));
  } catch {}
}

function buildCharacterCards() {
  characterSelect.innerHTML = '';
  for (const id of Object.keys(CHARACTERS)) {
    const c = CHARACTERS[id];
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'char-card' + (id === selectedCharacter ? ' selected' : '');
    card.dataset.char = id;
    const cv = document.createElement('canvas');
    cv.width = 120;
    cv.height = 144;
    card.appendChild(cv);
    const name = document.createElement('div');
    name.className = 'char-name';
    name.textContent = c.name;
    card.appendChild(name);
    const sub = document.createElement('div');
    sub.className = 'char-sub';
    sub.textContent = c.subtitle;
    card.appendChild(sub);
    card.addEventListener('click', () => {
      selectedCharacter = id;
      persistSelection();
      handOverlay.setCharacter(id);
      abilitySystem.setCharacter(id);
      gunView.setCharacter?.(id);
      handDemo?.setCharacter(id);
      updateAbilityHint();
      for (const el of characterSelect.querySelectorAll('.char-card')) {
        el.classList.toggle('selected', el.dataset.char === id);
      }
    });
    characterSelect.appendChild(card);
    drawCharacterPreview(cv, id);
  }
}

function bindModeCards() {
  for (const card of modeSelect.querySelectorAll('.mode-card')) {
    card.classList.toggle('selected', card.dataset.mode === selectedMode);
    card.addEventListener('click', () => {
      selectedMode = card.dataset.mode;
      persistSelection();
      for (const el of modeSelect.querySelectorAll('.mode-card')) {
        el.classList.toggle('selected', el.dataset.mode === selectedMode);
      }
      renderScoreboard();
    });
  }
}

let scoreboardTab = 'timed';
function renderScoreboard(highlightRecord = null) {
  scoreboardTab = selectedMode;
  for (const t of scoreboardTabs) {
    t.classList.toggle('selected', t.dataset.tab === scoreboardTab);
  }
  scoreboardList.innerHTML = '';
  const list = getScores(scoreboardTab).slice(0, 5);
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'まだ記録なし — 一番乗りに！';
    scoreboardList.appendChild(li);
    return;
  }
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const li = document.createElement('li');
    if (highlightRecord && r.date === highlightRecord.date && r.score === highlightRecord.score) {
      li.className = 'you';
    }
    li.innerHTML = `
      <span class="score-rank">${i + 1}</span>
      <span><b>${r.score}</b> <span class="score-meta">pt</span></span>
      <span class="score-kills">${r.kills} kills</span>
      <span class="score-meta">${formatSurvivedMs(r.survivedMs)}</span>
    `;
    scoreboardList.appendChild(li);
  }
}

function bindScoreboardTabs() {
  for (const tab of scoreboardTabs) {
    tab.addEventListener('click', () => {
      scoreboardTab = tab.dataset.tab;
      for (const t of scoreboardTabs) t.classList.toggle('selected', t === tab);
      const list = getScores(scoreboardTab).slice(0, 5);
      scoreboardList.innerHTML = '';
      if (list.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'まだ記録なし';
        scoreboardList.appendChild(li);
        return;
      }
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const li = document.createElement('li');
        li.innerHTML = `
          <span class="score-rank">${i + 1}</span>
          <span><b>${r.score}</b> <span class="score-meta">pt</span></span>
          <span class="score-kills">${r.kills} kills</span>
          <span class="score-meta">${formatSurvivedMs(r.survivedMs)}</span>
        `;
        scoreboardList.appendChild(li);
      }
    });
  }
}

function renderGameoverScoreboard(mode, highlightRecord) {
  gameoverScoreList.innerHTML = '';
  const list = getScores(mode).slice(0, 5);
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = '記録なし';
    gameoverScoreList.appendChild(li);
    return;
  }
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const li = document.createElement('li');
    if (highlightRecord && r.date === highlightRecord.date && r.score === highlightRecord.score) {
      li.className = 'you';
    }
    li.innerHTML = `
      <span class="score-rank">${i + 1}</span>
      <span><b>${r.score}</b> <span class="score-meta">pt</span></span>
      <span class="score-kills">${r.kills} kills</span>
      <span class="score-meta">${formatSurvivedMs(r.survivedMs)}</span>
    `;
    gameoverScoreList.appendChild(li);
  }
}

const ABILITY_INFO = {
  flame_colonel:  { label: 'FLAME',   desc: '指パッチン → 火球' },
  pink_alchemist: { label: 'BOLT',    desc: '開いた掌 → 魔法弾連射' },
  special_forces: { label: 'PISTOL',  desc: '指鉄砲で狙う → 手首スナップで発射' },
  sword_kirito:   { label: 'SLASH',   desc: '剣を振り下ろすと斬撃が飛ぶ' }
};

const DIFFICULTY = {
  flame_colonel:  { spawnInterval: 1.85, maxConcurrent: 0.55 },
  pink_alchemist: { spawnInterval: 0.85, maxConcurrent: 1.10 },
  special_forces: { spawnInterval: 1.10, maxConcurrent: 0.85 },
  sword_kirito:   { spawnInterval: 1.00, maxConcurrent: 1.00 }
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = createScene();
const camera = createCamera();
scene.add(camera);

const gunView = new CharacterViewModel(camera);
gunView.setVisible(true);
const effects = new Effects(scene);

const audio = new AudioBus();
const handTracker = new HandTracker();
const poseClassifier = new PoseClassifier();
const calibration = new Calibration();
const gameState = new GameState();
const weaponSys = new WeaponSystem(audio, gunView);
const zombieSpawner = new ZombieSpawner(scene);
const hud = new HUD();
const reticle = new Reticle();
const handOverlay = new HandStatusOverlay(video, selectedCharacter);
const raycaster = new THREE.Raycaster();
const playerPos = new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT, 0);
const abilitySystem = new AbilitySystem({ audio, effects, gunView, camera, raycaster });
abilitySystem.setCharacter(selectedCharacter);
abilitySystem.onFire = (kind /*, pose */) => {
  reticle.flash();
  handOverlay.notifySnapFired();
  gunView.triggerFire?.(kind);
};

window.addEventListener('resize', () => handleResize(camera, renderer));

const CALIB_STEPS = [
  {
    name: 'extended',
    title: 'キャリブレーション 1/2',
    instruction: '手を開いた状態（パーの形）で正面にかざしてください'
  },
  {
    name: 'flexed',
    title: 'キャリブレーション 2/2',
    instruction: '親指と中指を軽くくっつけた「指パッチン直前」のポーズをキープ'
  }
];

let currentCalibStepIdx = 0;
let bootMode = 'idle';

async function startApp() {
  startOverlay.style.display = 'none';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    alert('カメラの許可が必要です: ' + e.message);
    startOverlay.style.display = 'flex';
    return;
  }

  audio.unlock();

  hud.showBanner('読み込み中...', 5000);
  try {
    await handTracker.init(video);
  } catch (e) {
    alert('MediaPipeの読み込みに失敗しました: ' + e.message);
    return;
  }
  hud.showBanner('', 0);

  // Snap detection is calibration-free; skip the calibration flow entirely.
  // (The Calibration / GunViewModel code is kept for the legacy gun mode.)
  enterPlay();
}

function startCalibration() {
  calibration.reset();
  currentCalibStepIdx = 0;
  gameState.setState(STATE.CALIBRATING);
  calibOverlay.style.display = 'flex';
  enterCalibrationStep(0);
}

function enterCalibrationStep(idx) {
  if (idx >= CALIB_STEPS.length) {
    finishCalibration();
    return;
  }
  currentCalibStepIdx = idx;
  const step = CALIB_STEPS[idx];
  calibTitle.textContent = step.title;
  calibInstruction.textContent = step.instruction;
  calibStep.textContent = `Step ${idx + 1} / ${CALIB_STEPS.length}`;
  calibProgressBar.style.width = '0%';
  calibStatus.textContent = '手をかざしてください...';
  calibration.startStep(step.name);
  calibSkipBtn.style.display = 'inline-block';
}

function finishCalibration() {
  const profile = calibration.buildProfile();
  poseClassifier.setProfile(profile);
  calibOverlay.style.display = 'none';
  hud.showBanner('校正完了！', 1500);
  enterPlay();
}

function updateAbilityHint() {
  const info = ABILITY_INFO[selectedCharacter] || ABILITY_INFO.flame_colonel;
  hud.setAbility(info.label);
}

function enterPlay() {
  poseClassifier.reset();
  zombieSpawner.reset();
  zombieSpawner.setDifficultyMultipliers(DIFFICULTY[selectedCharacter] || {});
  abilitySystem.setCharacter(selectedCharacter);
  abilitySystem.reset();
  gunView.setCharacter(selectedCharacter);
  gameState.setMode(selectedMode);
  gameState.startGame(performance.now());
  zombieSpawner.start(performance.now());
  if (modeBadge) {
    modeBadge.textContent = gameState.isEndless() ? 'ENDLESS' : 'TIMED 3:00';
  }
  updateAbilityHint();
  const info = ABILITY_INFO[selectedCharacter] || ABILITY_INFO.flame_colonel;
  hud.showBanner(`${info.label} — ${info.desc}`, 2400);
}

function showGameOver(nowMs, victory = false) {
  gameoverTitle.textContent = victory ? 'MISSION COMPLETE' : 'GAME OVER';
  gameoverTitle.classList.toggle('gameover-victory', victory);
  const survivedMs = gameState.survivedMs(nowMs);
  finalTime.textContent = gameState.formatSurvived(nowMs);
  finalKills.textContent = gameState.kills;

  const submitMode = gameState.isEndless() ? 'endless' : 'timed';
  const submission = submitScore({
    kills: gameState.kills,
    survivedMs,
    mode: submitMode,
    character: selectedCharacter,
    cleared: victory
  });
  finalScore.textContent = submission.record.score;

  if (gameoverCause) {
    if (victory) {
      gameoverCause.textContent = '原因: 制限時間を生き延びた！';
    } else if (gameState.isEndless()) {
      gameoverCause.textContent = '原因: HP 0 — ゾンビに囲まれた';
    } else {
      gameoverCause.textContent = '原因: HP 0 — 時間内に倒れた';
    }
  }

  if (gameoverRank) {
    gameoverRank.classList.toggle('new-best', !!submission.isNewBest);
    if (submission.isNewBest) {
      gameoverRank.textContent = `🔥 NEW HIGH SCORE — #1`;
    } else if (submission.inTop) {
      gameoverRank.textContent = `ランクイン！ #${submission.rank}`;
    } else {
      gameoverRank.textContent = `ランク外（トップ10入りならず）`;
    }
  }

  renderGameoverScoreboard(submitMode, submission.record);
  gameoverOverlay.style.display = 'flex';
  audio.play(victory ? 'weaponSwap' : 'gameOver');
}

function restart() {
  gameoverOverlay.style.display = 'none';
  enterPlay();
}

function backToTitle() {
  gameoverOverlay.style.display = 'none';
  startOverlay.style.display = 'flex';
  gameState.setState(STATE.BOOTING);
  renderScoreboard();
}

startBtn.addEventListener('click', () => {
  bootMode = 'fresh';
  startApp();
});

recalibrateBtn.addEventListener('click', () => {
  Calibration.clearStoredProfile();
  bootMode = 'recalibrate';
  startApp();
});

calibSkipBtn.addEventListener('click', () => {
  calibration.finishStep();
  enterCalibrationStep(currentCalibStepIdx + 1);
});

restartBtn.addEventListener('click', restart);

if (backToTitleBtn) {
  backToTitleBtn.addEventListener('click', backToTitle);
}

if (scoresClearBtn) {
  scoresClearBtn.addEventListener('click', () => {
    if (confirm('ハイスコアをすべて消去しますか？')) {
      clearScores();
      renderScoreboard();
    }
  });
}

let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const result = handTracker.detect(now);

  if (gameState.state === STATE.CALIBRATING) {
    handOverlay.setSnapPrimed(false);
    handOverlay.draw(result);
    const status = calibration.feedFrame(result);
    calibProgressBar.style.width = `${(status.progress || 0) * 100}%`;
    calibStatus.textContent = status.status;
    if (status.done) {
      calibration.finishStep();
      setTimeout(() => enterCalibrationStep(currentCalibStepIdx + 1), 250);
    }
  } else if (gameState.state === STATE.PLAYING) {
    const pose = poseClassifier.classify(result, now);
    if (pose.aimNDC) reticle.setNDC(pose.aimNDC);

    const handPosed = pose.snapPrimed || pose.openPalm || pose.pointingIndex || pose.pistolPose || pose.gripPose || pose.twoHandPush;
    handOverlay.setSnapPrimed(handPosed);
    handOverlay.draw(result);
    gunView.setSnapPrimed?.(pose.snapPrimed);

    abilitySystem.update(pose, now, dt, { zombies: zombieSpawner.zombies, gameState });

    zombieSpawner.update(dt, now, playerPos, gameState, audio);

    gameState.checkTimeLimit(now);

    if (gameState.state === STATE.DEAD) {
      showGameOver(now, false);
    } else if (gameState.state === STATE.CLEARED) {
      showGameOver(now, true);
    } else if (gameState.hp < gameState.maxHp && now - gameState.lastDamageTimeMs < 50) {
      hud.flashDamage();
      audio.play('playerHurt');
    }

    if (damageVignette) {
      const sinceDmg = now - gameState.lastDamageTimeMs;
      damageVignette.classList.toggle('hit', sinceDmg < 120);
      damageVignette.classList.toggle('sustained', sinceDmg < 600 && gameState.hp < gameState.maxHp * 0.4);
    }

    hud.update(gameState, abilitySystem, now, pose);
  } else if (gameState.state === STATE.DEAD || gameState.state === STATE.CLEARED) {
    handOverlay.setSnapPrimed(false);
    handOverlay.draw(result);
    hud.update(gameState, abilitySystem, now, null);
  } else {
    handOverlay.setSnapPrimed(false);
    handOverlay.draw(result);
  }

  effects.update(dt, { zombies: zombieSpawner.zombies, camera });
  gunView.update(dt);
  renderer.render(scene, camera);

  // Drive the start-screen motion demo whenever the start overlay is visible.
  if (handDemo && startOverlay && startOverlay.style.display !== 'none') {
    handDemo.step();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame((t) => {
  lastFrame = t;
  requestAnimationFrame(loop);
});

buildCharacterCards();
bindModeCards();
bindScoreboardTabs();
renderScoreboard();
handDemo?.setCharacter(selectedCharacter);
handDemo?.step();
