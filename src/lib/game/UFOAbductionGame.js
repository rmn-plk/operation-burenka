import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld } from './world.js';
import { createCowModel, createUFO, GLOW_TEXTURE } from './models.js';
import { createBeam, createParticles, createReticle } from './effects.js';
import { SoundKit } from './audio.js';

const CONFIG = {
  duration: 80,
  quota: 8,
  beamRange: 7.8,
  breakRange: 12,
  liftTime: 1.75,
  energyDrain: 16,
  energyRecharge: 23,
  comboWindow: 4.5,
  shipHeight: 8.6,
  shipMinX: -18.2,
  shipMaxX: 16.2,
  shipMinZ: -2.2,
  shipMaxZ: 15.6,
  shipSpeed: 9.2,
  cowMinX: -16.2,
  cowMaxX: 14.8,
  cowMinZ: 0.3,
  cowMaxZ: 15.5,
};

const COW_START = [
  [-11.5, 4.5],
  [-6.2, 9.8],
  [-13.6, 12.6],
  [-1.6, 6.4],
  [4.7, 2.8],
  [8.6, 9.3],
  [12.1, 6.0],
  [1.1, 13.3],
  [-8.9, 1.5],
  [9.9, 13.1],
];

const COW_NAMES = [
  'Бурёнка',
  'Зорька',
  'Милка',
  'Ромашка',
  'Ласточка',
  'Кнопка',
  'Сметанка',
  'Плюшка',
  'Чернушка',
  'Марта',
];

const COW_PALETTE = [0xf4f0df, 0xe8dfc9, 0xf5eadd, 0xe6dcc5];

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function easeInCubic(t) {
  return t * t * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function softShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class UFOAbductionGame {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.raf = 0;
    this.mode = 'menu';
    this.isReady = false;
    this.muted = false;

    this.keys = new Set();
    this.pointerBeam = false;
    this.testBeam = false;
    this.virtualMove = new THREE.Vector2();

    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem('burenka-best-score') || 0);
    } catch {
      this.best = 0;
    }
    this.collected = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.energy = 100;
    this.overheat = 0;
    this.timeLeft = CONFIG.duration;
    this.lastWholeSecond = Math.ceil(CONFIG.duration);
    this.hoverCow = null;
    this.lockCow = null;
    this.wasBeaming = false;
    this.emitAccumulator = 0;
    this.alienExcitement = 0;
    this.captureFlash = 0;
    this.skipHint = 0;
    this.wonCelebration = 0;
    this.menuTargetCooldown = 0;

    this.shipPosition = new THREE.Vector3(0.8, CONFIG.shipHeight, 6.8);
    this.shipVelocity = new THREE.Vector2();
    this.cameraPosition = new THREE.Vector3(18, 17, 43);
    this.cameraLook = new THREE.Vector3(-2, 3.6, 2);
    this.targetLook = new THREE.Vector3();
    this.targetCamera = new THREE.Vector3();
    this.shipGround = new THREE.Vector2();

    this.audio = new SoundKit();
    this.cowWorldPosition = new THREE.Vector3();
    this.tempColor = new THREE.Color();
    this.menuBeamTarget = new THREE.Vector3();
    this.clock = new THREE.Clock();

    this._initRenderer();
    this._initScene();
    this._buildCows();
    this._bindEvents();
    this.resize();
    this.renderer.shadowMap.needsUpdate = true;

    this.isReady = true;
    this.callbacks.onReady?.();
    this.emit(true);
    this._animate();

    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
      window.__BURENKA_TEST__ = {
        start: () => this.start(),
        pause: () => this.pause(),
        resume: () => this.resume(),
        snapshot: () => ({
          ...this.snapshot(),
          mode: this.mode,
          cameraAspect: Number(this.camera.aspect.toFixed(3)),
          ship: { x: this.shipPosition.x, z: this.shipPosition.z },
          cows: this.cows.map((cow) => ({
            name: cow.name,
            x: Number(cow.pos.x.toFixed(2)),
            z: Number(cow.pos.y.toFixed(2)),
            progress: Number(cow.progress.toFixed(2)),
            captured: cow.captured,
            y: Number(cow.root.position.y.toFixed(2)),
          })),
          beamVisible: this._isBeamVisible(),
          beamInput: this._beamInputActive(),
        }),
        teleport: (x, z) => {
          this.shipPosition.x = x;
          this.shipPosition.z = z;
          this.shipVelocity.set(0, 0);
          this.ship.root.position.x = x;
          this.ship.root.position.z = z;
        },
        setBeam: (active) => {
          this.testBeam = Boolean(active);
        },
        win: () => this.finish(true),
        lose: () => this.finish(false),
        renderInfo: () => ({
          ...this.renderer.info.render,
          programs: this.renderer.info.programs?.length || 0,
          shadows: {
            enabled: this.renderer.shadowMap.enabled,
            autoUpdate: this.renderer.shadowMap.autoUpdate,
            needsUpdate: this.renderer.shadowMap.needsUpdate,
          },
        }),
        sceneStats: () => {
          const count = (object) => {
            const stats = { meshes: 0, instanced: 0, sprites: 0, points: 0, lights: 0 };
            object.traverse((child) => {
              if (child.isInstancedMesh) stats.instanced += 1;
              else if (child.isMesh) stats.meshes += 1;
              else if (child.isSprite) stats.sprites += 1;
              else if (child.isPoints) stats.points += 1;
              else if (child.isLight) stats.lights += 1;
            });
            return stats;
          };
          return this.scene.children.map((child) => ({
            name: child.name || child.type,
            ...count(child),
          })).sort((a, b) => (b.meshes + b.instanced + b.sprites) - (a.meshes + a.instanced + a.sprites));
        },
      };
    }
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.1, 420);
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(this.cameraLook);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnvironment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(roomEnvironment, 0.04).texture;
    this.scene.environmentIntensity = 0.34;

    this.world = buildWorld(this.scene);

    this.ship = createUFO();
    this.ship.root.position.copy(this.shipPosition);
    this.ship.root.scale.setScalar(1.06);
    this.ship.root.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    this.scene.add(this.ship.root);

    this.shipCoreLight = new THREE.PointLight(0x79ffd2, 40, 20, 2);
    this.shipCoreLight.position.set(0, 1.0, 0);
    this.shipCoreLight.visible = false;
    this.ship.visual.add(this.shipCoreLight);

    this.shipMagentaLight = new THREE.PointLight(0xb95cff, 70, 18, 2);
    this.shipMagentaLight.position.set(0, -1.0, 0);
    this.ship.visual.add(this.shipMagentaLight);

    this.beam = createBeam(this.scene);
    this.reticle = createReticle(this.scene);
    this.particles = createParticles(this.scene, 520);
    this.beam.shipBeamLight.visible = false;

    this.shadowTexture = softShadowTexture();

    // Four point lights are enough for the whole shot; skip the small fill
    // lights that would otherwise cost a per-fragment loop on every object.
    this.world.barn.windowLight.visible = false;
    this.world.windmill.blades.traverse((object) => {
      if (object.isLight) object.visible = false;
    });
  }

  _buildCows() {
    this.cows = [];
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      color: 0x101010,
    });

    COW_START.forEach(([x, z], index) => {
      const root = new THREE.Group();
      const model = createCowModel();
      model.group.scale.setScalar(1.08);
      model.group.position.y = 0.12;
      model.group.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = false;
          object.receiveShadow = false;
        }
      });
      root.add(model.group);

      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.6), shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(x, 0.065, z);
      shadow.renderOrder = 2;
      this.scene.add(shadow);

      root.position.set(x, 0, z);
      const heading = Math.random() * Math.PI * 2;
      root.rotation.y = heading;
      this.scene.add(root);

      const cow = {
        index,
        name: COW_NAMES[index],
        root,
        model,
        shadow,
        basePos: new THREE.Vector2(x, z),
        pos: new THREE.Vector2(x, z),
        home: new THREE.Vector2(x, z),
        heading,
        moveTarget: new THREE.Vector2(x, z),
        moveTimer: Math.random() * 2,
        walkPhase: Math.random() * Math.PI * 2,
        mooTimer: 3 + Math.random() * 8,
        speed: 0,
        progress: 0,
        captured: false,
        walking: false,
        scale: 1,
        panic: 0,
      };
      this.cows.push(cow);
    });
  }

  _bindEvents() {
    this.onKeyDown = (event) => {
      const code = event.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(code)) {
        event.preventDefault();
      }
      if (event.repeat) return;

      if (code === 'Escape') {
        if (this.mode === 'playing') this.pause();
        else if (this.mode === 'paused') this.resume();
        return;
      }
      if (code === 'Enter' && this.mode === 'menu') {
        this.start();
        return;
      }
      this.keys.add(code);
    };

    this.onKeyUp = (event) => {
      this.keys.delete(event.code);
    };

    this.onPointerDown = (event) => {
      if (event.target !== this.canvas) return;
      if (this.mode !== 'playing') return;
      event.preventDefault();
      this.pointerBeam = true;
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    this.onPointerUp = () => {
      this.pointerBeam = false;
    };

    this.onContextMenu = (event) => {
      if (event.target === this.canvas) event.preventDefault();
    };

    this.onBlur = () => {
      this.pointerBeam = false;
      if (this.mode === 'playing') this.pause();
    };

    this.onVisibility = () => {
      if (document.hidden && this.mode === 'playing') this.pause();
    };

    this.onResize = () => this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);
  }

  resize() {
    if (!this.renderer) return;
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    if (this.camera) {
      this.camera.aspect = width / Math.max(1, height);
      this.camera.updateProjectionMatrix();
    }
  }

  emit(force = false) {
    if (!this.callbacks.onUpdate) return;
    this.callbacks.onUpdate(this.snapshot());
  }

  snapshot() {
    const target = this.lockCow || this.hoverCow;
    const progress = target?.progress || 0;
    let message = 'ИЩЕМ КОРОВУ';
    if (this.overheat > 0) message = 'ЛУЧ ПЕРЕГРЕТ';
    else if (this.lockCow && progress > 0.01) message = `ЗАХВАТ · ${Math.round(progress * 100)}%`;
    else if (target) message = `ЦЕЛЬ · ${target.name.toUpperCase()}`;
    else if (this.mode === 'playing') message = 'НЕТ ЦЕЛИ В РАДИУСЕ';

    const timeLeft = Math.max(0, this.timeLeft);
    return {
      phase: this.mode,
      timeLeft,
      timeLabel: formatTime(timeLeft),
      duration: CONFIG.duration,
      collected: this.collected,
      quota: CONFIG.quota,
      score: this.score,
      best: this.best,
      combo: this.combo,
      comboTimer: Math.max(0, this.comboTimer),
      comboWindow: CONFIG.comboWindow,
      energy: this.energy,
      overheated: this.overheat > 0,
      beamActive: this._isBeamVisible(),
      beamPulling: Boolean(this.lockCow && this._beamInputActive() && this.energy > 0 && this.overheat <= 0),
      targetName: target?.name || '',
      targetProgress: progress,
      targetLocked: Boolean(this.lockCow),
      message,
      muted: this.muted,
      totalCows: this.cows.length,
      hint: this._hint(target, progress),
      shots: this.collected,
    };
  }

  _hint(target, progress) {
    if (this.overheat > 0) return 'Подожди, пока остынет излучатель';
    if (this.lockCow && progress > 0.01) return 'Держи луч, пока корова не окажется на борту';
    if (target) return 'Зажми ЛКМ или ПРОБЕЛ, чтобы включить луч';
    return 'Подлетай ближе к стаду';
  }

  _beamInputActive() {
    return Boolean(
      this.mode === 'playing'
      && (this.pointerBeam || this.keys.has('Space') || this.testBeam),
    );
  }

  _isBeamVisible() {
    return this._beamInputActive() && this.overheat <= 0 && this.energy > 0.2;
  }

  start() {
    this.audio.init();
    this.audio.click();
    this.mode = 'playing';
    this.timeLeft = CONFIG.duration;
    this.lastWholeSecond = Math.ceil(CONFIG.duration);
    this.collected = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.energy = 100;
    this.overheat = 0;
    this.lockCow = null;
    this.hoverCow = null;
    this.wasBeaming = false;
    this.captureFlash = 0;
    this.wonCelebration = 0;
    this.alienExcitement = 0;
    this.pointerBeam = false;
    this.testBeam = false;
    this.shipPosition.set(0.8, CONFIG.shipHeight, 6.8);
    this.shipVelocity.set(0, 0);
    this.ship.root.position.copy(this.shipPosition);
    this.resetCows();
    this.cameraLook.set(0, 5.4, 5.2);
    this.emit(true);
    this.callbacks.onEvent?.({ type: 'start' });
    this.emit(true);
  }

  resetCows() {
    this.cows.forEach((cow, index) => {
      const [x, z] = COW_START[index];
      cow.pos.set(x, z);
      cow.basePos.set(x, z);
      cow.home.set(x, z);
      cow.moveTarget.set(x, z);
      cow.heading = Math.random() * Math.PI * 2;
      cow.root.position.set(x, 0, z);
      cow.root.rotation.set(0, cow.heading, 0);
      cow.root.visible = true;
      cow.model.group.visible = true;
      cow.model.group.position.set(0, 0.12, 0);
      cow.model.group.rotation.set(0, 0, 0);
      cow.model.group.scale.setScalar(1.08);
      cow.shadow.visible = true;
      cow.shadow.position.set(x, 0.065, z);
      cow.shadow.scale.setScalar(1);
      cow.progress = 0;
      cow.captured = false;
      cow.walking = false;
      cow.panic = 0;
      cow.moveTimer = 1 + Math.random() * 3;
      cow.mooTimer = 4 + Math.random() * 8;
      cow.walkPhase = Math.random() * Math.PI * 2;
    });
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.pointerBeam = false;
    this.audio.setBeam(false);
    this.emit(true);
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.clock.getDelta();
    this.audio.click();
    this.emit(true);
  }

  toMenu() {
    this.mode = 'menu';
    this.pointerBeam = false;
    this.testBeam = false;
    this.keys.clear();
    this.lockCow = null;
    this.hoverCow = null;
    this.energy = 100;
    this.overheat = 0;
    this.shipPosition.set(0.8, CONFIG.shipHeight, 6.8);
    this.shipVelocity.set(0, 0);
    this.ship.root.position.copy(this.shipPosition);
    this.resetCows();
    this.audio.setBeam(false);
    this.callbacks.onEvent?.({ type: 'menu' });
    this.emit(true);
  }

  togglePause() {
    if (this.mode === 'playing') this.pause();
    else if (this.mode === 'paused') this.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.emit(true);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.audio.setMuted(this.muted);
    this.emit(true);
  }

  setVirtualMove(x, z) {
    this.virtualMove.set(x, z);
  }

  setVirtualBeam(active) {
    if (this.mode !== 'playing') return;
    this.pointerBeam = Boolean(active);
    if (!active) this.audio.setBeam(false);
  }

  finish(won) {
    if (this.mode === 'won' || this.mode === 'lost') return;
    if (won) {
      const bonus = Math.floor(this.timeLeft) * 10;
      this.score += bonus;
      if (this.score > this.best) {
        this.best = this.score;
        try {
          localStorage.setItem('burenka-best-score', String(this.best));
        } catch {
          // ignore storage failures
        }
      }
      this.mode = 'won';
      this.wonCelebration = 1;
      this.audio.win();
      this.particles.celebration(new THREE.Vector3(this.shipPosition.x, this.shipPosition.y + 1.4, this.shipPosition.z));
      this.callbacks.onEvent?.({ type: 'won', score: this.score, bonus });
    } else {
      this.mode = 'lost';
      this.audio.lose();
      this.callbacks.onEvent?.({ type: 'lost', score: this.score });
    }
    this.lockCow = null;
    this.pointerBeam = false;
    this.testBeam = false;
    this.audio.setBeam(false);
    this.emit(true);
  }

  _chooseNearestCow() {
    const ship = this.shipGround;
    let best = null;
    let bestDistance = CONFIG.beamRange;
    for (const cow of this.cows) {
      if (cow.captured) continue;
      const distance = ship.distanceTo(cow.pos);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cow;
      }
    }
    return best;
  }

  _captureCow(cow) {
    cow.captured = true;
    cow.progress = 0;
    cow.root.visible = false;
    cow.shadow.visible = false;
    this.collected += 1;

    if (this.comboTimer > 0) {
      this.combo = Math.min(5, this.combo + 1);
    } else {
      this.combo = 1;
    }
    const points = 100 * this.combo;
    this.score += points;
    this.comboTimer = CONFIG.comboWindow;

    this.alienExcitement = 1.6;
    this.captureFlash = 1;

    const burstOrigin = new THREE.Vector3(this.shipPosition.x, this.shipPosition.y - 1.2, this.shipPosition.z);
    this.particles.spawn(burstOrigin, {
      count: 42,
      palette: [new THREE.Color(0xff6de1), new THREE.Color(0xb15dff), new THREE.Color(0xffe3ff)],
      speed: 2.8,
      upward: 3.4,
      spread: 1.1,
      lifeMin: 0.5,
      lifeMax: 1.2,
      gravityValue: -2.4,
      radius: 1.2,
    });
    this.particles.spawn(new THREE.Vector3(cow.pos.x, 0.2, cow.pos.y), {
      count: 22,
      palette: [new THREE.Color(0xff79e6), new THREE.Color(0xffd4fb)],
      speed: 1.9,
      upward: 3.8,
      spread: 0.8,
      lifeMin: 0.4,
      lifeMax: 0.9,
      gravityValue: 2.2,
      radius: 0.8,
      shape: 'ring',
    });

    this.audio.abduct(this.combo);
    if (this.combo > 1) {
      this.callbacks.onEvent?.({ type: 'combo', combo: this.combo });
    }
    this.callbacks.onEvent?.({
      type: 'abduct',
      cow: cow.name,
      combo: this.combo,
      points,
      collected: this.collected,
      quota: CONFIG.quota,
    });

    this.lockCow = null;
    if (this.collected >= CONFIG.quota) {
      this.finish(true);
    }
  }

  _updateShip(dt) {
    let inputX = 0;
    let inputZ = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inputX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inputX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inputZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inputZ += 1;
    inputX += this.virtualMove.x;
    inputZ += this.virtualMove.y;

    const length = Math.hypot(inputX, inputZ);
    if (length > 1) {
      inputX /= length;
      inputZ /= length;
    }

    this.shipVelocity.x = damp(this.shipVelocity.x, inputX * CONFIG.shipSpeed, 7.5, dt);
    this.shipVelocity.y = damp(this.shipVelocity.y, inputZ * CONFIG.shipSpeed, 7.5, dt);
    this.shipPosition.x = clamp(this.shipPosition.x + this.shipVelocity.x * dt, CONFIG.shipMinX, CONFIG.shipMaxX);
    this.shipPosition.z = clamp(this.shipPosition.z + this.shipVelocity.y * dt, CONFIG.shipMinZ, CONFIG.shipMaxZ);

    this.ship.root.position.x = this.shipPosition.x;
    this.ship.root.position.z = this.shipPosition.z;

    const targetRoll = -this.shipVelocity.x * 0.028;
    const targetPitch = this.shipVelocity.y * 0.02;
    this.ship.visual.rotation.z = damp(this.ship.visual.rotation.z, targetRoll, 3.8, dt);
    this.ship.visual.rotation.x = damp(this.ship.visual.rotation.x, targetPitch, 3.8, dt);

    this.shipGround.set(this.shipPosition.x, this.shipPosition.z);
  }

  _updateCowAI(cow, dt, time) {
    if (cow.captured) return;

    const distanceToShip = this.shipGround.distanceTo(cow.pos);
    const isPanicked = distanceToShip < 7.2 && this.mode === 'playing';

    if (isPanicked) {
      cow.panic = Math.min(1, cow.panic + dt * 2);
    } else {
      cow.panic = Math.max(0, cow.panic - dt * 0.8);
    }

    if (cow === this.lockCow && cow.progress > 0.005) {
      cow.walking = false;
      cow.speed = damp(cow.speed, 0, 10, dt);
      return;
    }

    let targetX = cow.moveTarget.x;
    let targetZ = cow.moveTarget.y;

    if (isPanicked) {
      const away = new THREE.Vector2(cow.pos.x - this.shipGround.x, cow.pos.y - this.shipGround.y);
      if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, Math.random() - 0.5);
      away.normalize();
      targetX = clamp(cow.pos.x + away.x * 8, CONFIG.cowMinX, CONFIG.cowMaxX);
      targetZ = clamp(cow.pos.y + away.y * 8, CONFIG.cowMinZ, CONFIG.cowMaxZ);
      cow.moveTarget.set(targetX, targetZ);
      cow.moveTimer = 1.2;
    } else {
      cow.moveTimer -= dt;
      if (cow.moveTimer <= 0) {
        cow.moveTimer = 2.2 + Math.random() * 4.5;
        const angle = Math.random() * Math.PI * 2;
        const radius = 1.5 + Math.random() * 5;
        targetX = clamp(cow.home.x + Math.cos(angle) * radius, CONFIG.cowMinX, CONFIG.cowMaxX);
        targetZ = clamp(cow.home.y + Math.sin(angle) * radius, CONFIG.cowMinZ, CONFIG.cowMaxZ);
        cow.moveTarget.set(targetX, targetZ);
        cow.walking = Math.random() > 0.28;
      }
    }

    const dx = targetX - cow.pos.x;
    const dz = targetZ - cow.pos.y;
    const distance = Math.hypot(dx, dz);
    const desiredSpeed = cow.walking || isPanicked ? (isPanicked ? 2.05 : 0.5) : 0;

    if (distance > 0.2 && desiredSpeed > 0) {
      const directionX = dx / distance;
      const directionZ = dz / distance;
      const speed = desiredSpeed * (1 + cow.panic * 0.4);
      cow.pos.x += directionX * speed * dt;
      cow.pos.y += directionZ * speed * dt;
      cow.heading = dampAngle(cow.heading, Math.atan2(directionX, directionZ), 5, dt);
      cow.walkPhase += dt * (isPanicked ? 11 : 6);
      cow.walking = true;
      cow.speed = speed;
    } else {
      cow.walking = false;
      cow.speed = damp(cow.speed, 0, 4, dt);
    }

    cow.pos.x = clamp(cow.pos.x, CONFIG.cowMinX, CONFIG.cowMaxX);
    cow.pos.y = clamp(cow.pos.y, CONFIG.cowMinZ, CONFIG.cowMaxZ);
    cow.root.position.x = cow.pos.x;
    cow.root.position.z = cow.pos.y;
    cow.root.rotation.y = cow.heading;
    cow.shadow.position.set(cow.pos.x, 0.065, cow.pos.y);

    const model = cow.model;
    const walkAmp = Math.min(cow.speed, 2.2) * 0.28;
    model.legs.forEach((leg, index) => {
      const offset = index > 1 ? Math.PI : 0;
      const swing = Math.sin(cow.walkPhase + offset) * walkAmp;
      leg.rotation.x = damp(leg.rotation.x, swing + (isPanicked ? Math.sin(time * 18 + index) * 0.15 : 0), 12, dt);
    });
    model.bodyPivot.position.y = Math.abs(Math.sin(cow.walkPhase * 2)) * 0.025 * Math.min(1, cow.speed);
    model.bodyPivot.rotation.z = Math.sin(cow.walkPhase) * 0.012 * Math.min(1, cow.speed);

    const headTarget = cow.walking ? 0.08 : 0.32 + Math.sin(time * 0.55 + cow.index) * 0.05;
    model.headPivot.rotation.x = damp(model.headPivot.rotation.x, headTarget, 2.5, dt);
    model.headPivot.rotation.z = Math.sin(time * 0.8 + cow.index) * 0.035;
    model.tailPivot.rotation.z = Math.sin(time * 2.1 + cow.index * 1.7) * 0.35;
    model.tailPivot.rotation.x = -0.2 + Math.sin(time * 1.5 + cow.index) * 0.1;
    model.earL.rotation.z = 0.3 + Math.sin(time * 1.7 + cow.index) * 0.08;
    model.earR.rotation.z = -0.3 - Math.sin(time * 1.7 + cow.index + 0.5) * 0.08;

    cow.root.position.y = 0;
    cow.model.group.rotation.set(0, 0, 0);
    cow.model.group.scale.setScalar(1.08);

    cow.mooTimer -= dt;
    if (cow.mooTimer <= 0) {
      cow.mooTimer = 7 + Math.random() * 10;
      if (!this.muted && (isPanicked || distanceToShip < 11) && this.mode === 'playing') {
        this.audio.moo();
      }
    }
  }

  _updateLiftedCow(cow, dt, time) {
    const p = cow.progress;
    const liftHeight = 6.9;
    cow.root.position.x = cow.pos.x + Math.sin(time * 6.0) * 0.025 * p;
    cow.root.position.z = cow.pos.y + Math.cos(time * 5.2) * 0.025 * p;
    cow.root.position.y = p * p * (3 - 2 * p) * liftHeight;
    cow.model.group.rotation.y = p * Math.PI * 3.2 + time * 0.15;
    cow.model.group.rotation.z = Math.sin(time * 9.0) * 0.12 * p;
    cow.model.group.rotation.x = Math.sin(time * 7.5 + 0.5) * 0.08 * p;
    const shrink = 1 - THREE.MathUtils.smoothstep(p, 0.84, 1) * 0.9;
    cow.model.group.scale.setScalar(1.08 * shrink);
    cow.model.legs.forEach((leg, index) => {
      leg.rotation.x = Math.sin(time * 16 + index * Math.PI) * 0.9;
    });
    cow.model.headPivot.rotation.x = -0.35 + Math.sin(time * 9) * 0.25;
    cow.model.tailPivot.rotation.z = Math.sin(time * 10) * 0.6;

    // shadow shrinks and fades while the cow flies
    cow.shadow.position.set(cow.pos.x, 0.065, cow.pos.y);
    cow.shadow.scale.setScalar(1 - p * 0.7);
    cow.shadow.material.opacity = 0.55 * (1 - p);
  }

  _updateBeam(dt, time) {
    if (this.mode !== 'playing') {
      this.beam.update(time, dt, this.ship.emitter, new THREE.Vector3(this.shipPosition.x, 0.1, this.shipPosition.z), false);
      this.reticle.update(time, dt, null, false);
      this.audio.setBeam(false);
      return;
    }

    this.shipGround.set(this.shipPosition.x, this.shipPosition.z);

    if (this.lockCow && this.lockCow.captured) this.lockCow = null;
    if (this.lockCow) {
      const distance = this.shipGround.distanceTo(this.lockCow.pos);
      if (distance > CONFIG.breakRange) {
        this.lockCow = null;
      }
    }

    this.hoverCow = this._chooseNearestCow();

    const inputActive = this._beamInputActive();
    const canBeam = this.overheat <= 0 && this.energy > 0.2;

    if (inputActive && canBeam && !this.lockCow && this.hoverCow) {
      this.lockCow = this.hoverCow;
      this.audio.moo();
      this.particles.spawn(new THREE.Vector3(this.lockCow.pos.x, 0.3, this.lockCow.pos.y), {
        count: 12,
        palette: [new THREE.Color(0xff87e5), new THREE.Color(0xffd3f9)],
        speed: 1.0,
        upward: 1.8,
        spread: 0.5,
        lifeMin: 0.25,
        lifeMax: 0.6,
        gravityValue: 1.4,
        radius: 0.5,
        shape: 'ring',
      });
    }

    const targetCow = this.lockCow || this.hoverCow;
    const beamPoint = targetCow
      ? new THREE.Vector3(targetCow.pos.x, 0.12, targetCow.pos.y)
      : new THREE.Vector3(this.shipPosition.x, 0.12, this.shipPosition.z);

    const beamVisible = inputActive && canBeam;
    const beamIntensity = this.lockCow ? 1 : 0.55;
    this.beam.update(time, dt, this.ship.emitter, beamPoint, beamVisible, beamIntensity);

    if (this.lockCow && beamVisible) {
      const drainScale = 1 + Math.max(0, this.lockCow.progress) * 0.25;
      this.energy = Math.max(0, this.energy - CONFIG.energyDrain * drainScale * dt);
      this.lockCow.progress = Math.min(1, this.lockCow.progress + dt / CONFIG.liftTime);
      if (this.energy <= 0) {
        this.overheat = 1.25;
        this.audio.setBeam(false);
        this.callbacks.onEvent?.({ type: 'overheat' });
        this.skipHint = 2.4;
      }
      if (!this.wasBeaming) {
        this.wasBeaming = true;
      }
    } else {
      if (this.wasBeaming) {
        this.audio.setBeam(false);
      }
      this.wasBeaming = false;
      if (this.lockCow) {
        this.lockCow.progress = Math.max(0, this.lockCow.progress - dt * 0.72);
        if (this.lockCow.progress <= 0.001) {
          this.lockCow.progress = 0;
        }
      }
    }

    if (!beamVisible) {
      this.energy = Math.min(100, this.energy + CONFIG.energyRecharge * dt);
    } else if (!this.lockCow) {
      this.energy = Math.min(100, this.energy + CONFIG.energyRecharge * 0.35 * dt);
    }

    if (this.overheat > 0) {
      this.overheat = Math.max(0, this.overheat - dt);
      if (this.overheat === 0 && this.mode === 'playing') {
        this.callbacks.onEvent?.({ type: 'ready' });
      }
    }

    this.audio.setBeam(beamVisible && Boolean(this.lockCow), this.lockCow ? 1 : 0.5);

    if (targetCow) {
      this.reticle.update(
        time,
        dt,
        targetCow.pos,
        Boolean(this.lockCow) && this.lockCow.progress > 0.001,
        this.lockCow ? this.lockCow.root.position.y : 0,
      );
    } else {
      this.reticle.update(time, dt, null, false);
    }

    // lift animation; progress was just updated
    if (this.lockCow) {
      this.lockCow.root.visible = true;
      if (this.lockCow.progress > 0.001) {
        this._updateLiftedCow(this.lockCow, dt, time);
      }
      if (this.lockCow.progress >= 1) {
        this._captureCow(this.lockCow);
      }
    }

    // keep hovered cows grounded if not lifting
    this.cows.forEach((cow) => {
      if (cow.captured || cow === this.lockCow) return;
      if (cow.root.position.y > 0.01) {
        cow.root.position.y = damp(cow.root.position.y, 0, 8, dt);
      }
    });
  }

  _updateCows(dt, time) {
    for (const cow of this.cows) {
      if (cow.captured) continue;
      if (cow === this.lockCow && cow.progress > 0.001) {
        this._updateLiftedCow(cow, dt, time);
        continue;
      }
      this._updateCowAI(cow, dt, time);
    }
  }

  _updateShipVisual(dt, time) {
    const hover = Math.sin(time * 1.45) * 0.16;
    this.ship.root.position.y = CONFIG.shipHeight + hover;
    this.ship.visual.position.y = Math.sin(time * 2.2) * 0.045;
    this.ship.visual.rotation.y = Math.sin(time * 0.3) * 0.02;

    this.ship.rimLights.forEach((light, index) => {
      const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(time * 2.3 + light.phase));
      light.material.opacity = 0.55 + pulse * 0.45;
      light.mesh.scale.setScalar(0.85 + pulse * 0.35);
      light.glow.material.opacity = 0.22 + pulse * 0.55;
      light.glow.scale.setScalar(0.6 + pulse * 0.5);
    });

    const emitterPulse = 0.75 + Math.sin(time * 6) * 0.25;
    this.ship.emitterRing.scale.setScalar(0.9 + emitterPulse * 0.18);
    this.ship.emitterDisc.material.opacity = 0.6 + emitterPulse * 0.35;
    this.ship.emitterGlow.scale.setScalar(4.2 + emitterPulse * 0.8);
    this.ship.emitterGlow.material.opacity = 0.45 + emitterPulse * 0.3;
    this.ship.underGlow.material.opacity = 0.22 + emitterPulse * 0.12;
    this.ship.antenna.rotation.y += dt * 0.8;
    this.ship.cabinLight.intensity = 3.4 + Math.sin(time * 2.7) * 0.6;

    const excited = this.alienExcitement;
    this.ship.aliens.forEach((alien, index) => {
      const baseY = alien.group.userData.baseY;
      const phase = alien.group.userData.phase;
      const jump = excited > 0 ? Math.abs(Math.sin(time * 8 + phase)) * 0.25 * Math.min(excited, 1) : 0;
      alien.group.position.y = baseY + Math.sin(time * 2.4 + phase) * 0.035 + jump;
      alien.group.rotation.z = Math.sin(time * 1.8 + phase) * 0.06 + (excited > 0 ? Math.sin(time * 7 + phase) * 0.12 : 0);
      const wave = Math.sin(time * 2.6 + phase) * 0.35 + (excited > 0 ? 1.1 : 0.15);
      alien.armL.rotation.z = -wave;
      alien.armR.rotation.z = wave;
      alien.head.rotation.y = Math.sin(time * 1.1 + phase) * 0.28;
      alien.head.rotation.x = -0.17 + Math.sin(time * 1.7 + phase) * 0.05;
      alien.group.scale.setScalar(1 + Math.sin(time * 6 + phase) * 0.015 * (1 + excited));
    });
    this.alienExcitement = Math.max(0, this.alienExcitement - dt * 0.45);

    this.shipCoreLight.intensity = 34 + Math.sin(time * 3.4) * 8 + excited * 12;
    this.shipMagentaLight.intensity = 55 + Math.sin(time * 2.1 + 1) * 10 + excited * 18;

    if (this.mode === 'won') {
      this.ship.root.position.y = CONFIG.shipHeight + 1.2 + Math.sin(time * 1.6) * 0.3;
      this.ship.visual.rotation.z = Math.sin(time * 1.1) * 0.12;
      this.ship.visual.rotation.x = Math.cos(time * 1.3) * 0.08;
    } else {
      const targetRoll = -this.shipVelocity.x * 0.028;
      const targetPitch = this.shipVelocity.y * 0.02;
      this.ship.visual.rotation.z = damp(this.ship.visual.rotation.z, targetRoll, 3.4, dt);
      this.ship.visual.rotation.x = damp(this.ship.visual.rotation.x, targetPitch, 3.4, dt);
    }
  }

  _updateCamera(dt) {
    if (this.mode === 'menu') {
      const angle = 0.15 + Math.sin(this.time * 0.07) * 0.15;
      this.targetCamera.set(
        Math.sin(angle) * 30 + 4,
        18.5 + Math.sin(this.time * 0.11) * 0.45,
        Math.cos(angle) * 29 + 4,
      );
      this.targetLook.set(-3.8, 3.4, 1.5);
      const smooth = 1 - Math.exp(-1.4 * dt);
      this.camera.position.lerp(this.targetCamera, smooth);
      this.cameraLook.lerp(this.targetLook, smooth);
    } else {
      const shipX = this.shipPosition.x;
      const shipZ = this.shipPosition.z;
      const lift = this.mode === 'won' ? 3 : 0;
      this.targetCamera.set(
        shipX + 1.2 + this.shipVelocity.x * 0.16,
        CONFIG.shipHeight + 12.8 + lift + Math.sin(this.time * 1.1) * 0.08,
        shipZ + 21,
      );
      this.targetLook.set(
        shipX + this.shipVelocity.x * 0.12,
        CONFIG.shipHeight - 4.1,
        shipZ - 1.8,
      );
      const smoothing = this.mode === 'won' ? 1.2 : 3.6;
      const smooth = 1 - Math.exp(-smoothing * dt);
      this.camera.position.lerp(this.targetCamera, smooth);
      this.cameraLook.lerp(this.targetLook, smooth);
    }
    this.camera.lookAt(this.cameraLook);
  }

  _updateTime(dt) {
    this.timeLeft -= dt;
    const whole = Math.ceil(Math.max(0, this.timeLeft));
    if (whole !== this.lastWholeSecond) {
      this.lastWholeSecond = whole;
      if (whole <= 10 && whole > 0) {
        this.audio.tick();
      }
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish(false);
    }
  }

  _update(dt) {
    this.time += dt;
    this.world.update(this.time, dt);

    if (this.mode === 'playing') {
      this._updateShip(dt);
      this._updateTime(dt);
      if (this.mode === 'playing') {
        this._updateBeam(dt, this.time);
        this._updateCows(dt, this.time);
      }
      if (this.comboTimer > 0) {
        this.comboTimer = Math.max(0, this.comboTimer - dt);
        if (this.comboTimer === 0) this.combo = 1;
      }
    } else if (this.mode === 'menu') {
      this.ship.root.position.x = this.shipPosition.x;
      this.ship.root.position.z = this.shipPosition.z;
      this.shipVelocity.set(0, 0);
      this._updateCows(dt, this.time);

      // attract-mode: one cow is already caught in the beam on the title screen
      const demoCow = this.cows[3];
      if (demoCow && !demoCow.captured) {
        demoCow.root.position.y = 0.62 + Math.sin(this.time * 1.4) * 0.11;
        demoCow.model.group.rotation.y = this.time * 0.25;
        demoCow.model.group.rotation.z = Math.sin(this.time * 3.1) * 0.035;
        demoCow.model.legs.forEach((leg, index) => {
          leg.rotation.x = Math.sin(this.time * 3.2 + index * Math.PI) * 0.22;
        });
        demoCow.shadow.position.set(demoCow.pos.x, 0.065, demoCow.pos.y);
        demoCow.shadow.scale.setScalar(0.82);
        this.menuBeamTarget.set(demoCow.pos.x, 0.12, demoCow.pos.y);
        this.beam.update(this.time, dt, this.ship.emitter, this.menuBeamTarget, true, 0.62);
        this.reticle.update(this.time, dt, demoCow.pos, true, demoCow.root.position.y);
      } else {
        this.beam.update(this.time, dt, this.ship.emitter, new THREE.Vector3(this.shipPosition.x, 0.1, this.shipPosition.z), false);
        this.reticle.update(this.time, dt, null, false);
      }
      this.energy = 100;
      this.wasBeaming = false;
    } else if (this.mode === 'paused') {
      this.beam.update(this.time, dt, this.ship.emitter, new THREE.Vector3(this.shipPosition.x, 0.1, this.shipPosition.z), false);
      this.audio.setBeam(false);
    } else if (this.mode === 'won' || this.mode === 'lost') {
      this._updateCows(dt, this.time);
      this.beam.update(this.time, dt, this.ship.emitter, new THREE.Vector3(this.shipPosition.x, 0.1, this.shipPosition.z), false);
      this.reticle.update(this.time, dt, null, false);
      this.audio.setBeam(false);
    }

    this._updateShipVisual(dt, this.time);
    this._updateCamera(dt);
    this.particles.update(dt);

    if (this.captureFlash > 0) {
      this.captureFlash = Math.max(0, this.captureFlash - dt * 2.8);
      this.ship.emitterGlow.material.opacity = Math.min(1, this.ship.emitterGlow.material.opacity + this.captureFlash * 0.4);
    }

    this.emitAccumulator += dt;
    if (this.emitAccumulator > 0.08) {
      this.emitAccumulator = 0;
      this.emit();
    }
  }

  _animate() {
    this.raf = requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this._update(dt);
    this.renderer.render(this.scene, this.camera);
    // farm shadows are baked once; cow/UFO contact shadows are cheap blobs
    this.renderer.shadowMap.needsUpdate = false;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.audio.dispose();
    this.renderer.dispose();
    if (window.__BURENKA_TEST__) delete window.__BURENKA_TEST__;
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material.map) material.map.dispose();
          material.dispose();
        });
      }
    });
  }
}
