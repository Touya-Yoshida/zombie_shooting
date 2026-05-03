import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createScene } from './render/Scene.js';
import { createCamera, handleResize } from './render/Camera.js';
import { GunViewModel } from './render/GunViewModel.js';
import { Effects } from './render/Effects.js';
import { HandTracker } from './input/HandTracker.js';
import { PoseClassifier } from './input/PoseClassifier.js';
import { Calibration } from './input/Calibration.js';
import { GameState, STATE } from './game/GameState.js';
import { WeaponSystem } from './game/WeaponSystem.js';
import { ZombieSpawner } from './game/ZombieSpawner.js';
import { AudioBus } from './audio/AudioBus.js';
import { HUD } from './ui/HUD.js';
import { Reticle } from './ui/Reticle.js';
import { HandStatusOverlay } from './ui/HandStatusOverlay.js';
import { performHitscan } from './util/raycast.js';

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
const finalTime = document.getElementById('final-time');
const finalKills = document.getElementById('final-kills');
const restartBtn = document.getElementById('restart-btn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = createScene();
const camera = createCamera();
scene.add(camera);

const gunView = new GunViewModel(camera);
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
const handOverlay = new HandStatusOverlay(video);
const raycaster = new THREE.Raycaster();
const playerPos = new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT, 0);

window.addEventListener('resize', () => handleResize(camera, renderer));

const CALIB_STEPS = [
  {
    name: 'extended',
    title: 'キャリブレーション 1/3',
    instruction: '指鉄砲のポーズで人差し指をピンと伸ばしてください'
  },
  {
    name: 'flexed',
    title: 'キャリブレーション 2/3',
    instruction: '人差し指を「引き金を引くように」軽く曲げてキープしてください'
  },
  {
    name: 'rifle',
    title: 'キャリブレーション 3/3（任意）',
    instruction: '両手で銃を構えるポーズをしてください（スキップ可）'
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

  const stored = Calibration.loadStoredProfile();
  if (stored && bootMode !== 'recalibrate') {
    poseClassifier.setProfile(stored);
    enterPlay();
  } else {
    startCalibration();
  }
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
  calibSkipBtn.style.display = step.name === 'rifle' ? 'inline-block' : 'none';
}

function finishCalibration() {
  const profile = calibration.buildProfile();
  poseClassifier.setProfile(profile);
  calibOverlay.style.display = 'none';
  hud.showBanner('校正完了！', 1500);
  enterPlay();
}

function enterPlay() {
  poseClassifier.reset();
  zombieSpawner.reset();
  weaponSys.ammo.pistol = weaponSys.getMagSize();
  weaponSys.ammo.rifle = CONFIG.WEAPONS.RIFLE.magSize;
  weaponSys.current = 'pistol';
  gunView.setWeapon('pistol');
  gameState.startGame(performance.now());
  zombieSpawner.start(performance.now());
  hud.showBanner('SURVIVE', 1500);
}

function showGameOver(nowMs) {
  finalTime.textContent = gameState.formatSurvived(nowMs);
  finalKills.textContent = gameState.kills;
  gameoverOverlay.style.display = 'flex';
  audio.play('gameOver');
}

function restart() {
  gameoverOverlay.style.display = 'none';
  enterPlay();
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

let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const result = handTracker.detect(now);
  handOverlay.draw(result);

  if (gameState.state === STATE.CALIBRATING) {
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

    const ammoBefore = weaponSys.getAmmo();
    weaponSys.onFire = (firingPose) => onShotFired(firingPose, now);
    weaponSys.update(pose, now);

    zombieSpawner.update(dt, now, playerPos, gameState, audio);

    if (gameState.state === STATE.DEAD) {
      showGameOver(now);
    } else if (gameState.hp < gameState.maxHp && now - gameState.lastDamageTimeMs < 50) {
      hud.flashDamage();
      audio.play('playerHurt');
    }

    hud.update(gameState, weaponSys, now, pose);
  } else if (gameState.state === STATE.DEAD) {
    hud.update(gameState, weaponSys, now, null);
  }

  effects.update(dt);
  gunView.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function onShotFired(pose, nowMs) {
  if (!pose.aimNDC) return;
  reticle.flash();
  const meshes = zombieSpawner.getMeshes();
  const result = performHitscan(raycaster, camera, pose.aimNDC, meshes);
  const muzzle = gunView.getMuzzleWorldPosition();
  effects.spawnTracer(muzzle, result.point);
  if (result.hit && result.zombie) {
    const w = weaponSys.getCurrent();
    const isHead = result.bodyPart === 'head';
    const dmg = w.damage * (isHead ? w.headshotMultiplier : 1);
    const killed = result.zombie.takeHit(dmg, isHead);
    effects.spawnBlood(result.point);
    audio.play('zombieHit');
    if (killed) gameState.registerKill();
  }
}

requestAnimationFrame((t) => {
  lastFrame = t;
  requestAnimationFrame(loop);
});

if (Calibration.loadStoredProfile()) {
  recalibrateBtn.style.display = 'inline-block';
}
