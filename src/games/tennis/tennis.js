/**
 * 3D Tennis (Three.js + Meshy models).
 * Extracted from production class `Ll` and helpers (arena.pretty.js).
 *
 * Controls:
 * - Move: WASD / arrows, virtual stick (`bindControls`)
 * - Swing / serve: Space (charge+release), canvas pointer charge, or swing button
 */

import * as THREE from 'three';
import {
  loadTennisAssets,
  meshySourceSummary,
  wrapScaledModel,
  wrapRacket,
  wrapNet,
  wrapPlayer,
} from '../shared/meshy.js';

const CHARGE_TIME = 1;
const MIN_POWER = 0.22;
const MAX_POWER = 1;

/** Half-court / court dimensions (ITF-ish meters). */
const HALF_LENGTH = 11.89;
const HALF_WIDTH = 4.115;
const SINGLES_HALF = 5.485;
const SERVICE_LINE_Z = 6.4;
const NET_H = 0.914;
const BALL_R = 0.065;
const GRAVITY = -16;
const BOUNCE = 0.68;
const NET_WIDTH = SINGLES_HALF * 2;
const NET_MESH_H = NET_H + 0.15;

const YOU_FACE = 0;
const BOT_FACE = Math.PI;

function pointLabel(n) {
  return ['0', '15', '30', '40'][Math.min(3, n)] ?? '40';
}

function inBounds(x, z) {
  return Math.abs(x) <= HALF_WIDTH + 0.05 && Math.abs(z) <= HALF_LENGTH + 0.05;
}

/** Valid first bounce for a serve into the correct box. */
function inServeBox(x, z, server, court) {
  if (server === 'you') {
    if (z >= -0.05 || z < -SERVICE_LINE_Z - 0.05) return false;
    return court === 'deuce'
      ? x >= -0.05 && x <= HALF_WIDTH + 0.05
      : x <= 0.05 && x >= -HALF_WIDTH - 0.05;
  }
  if (z <= 0.05 || z > SERVICE_LINE_Z + 0.05) return false;
  return court === 'deuce'
    ? x <= 0.05 && x >= -HALF_WIDTH - 0.05
    : x >= -0.05 && x <= HALF_WIDTH + 0.05;
}

/**
 * @typedef {object} TennisHud
 * @property {string} scoreYou
 * @property {string} scoreBot
 * @property {number} gamesYou
 * @property {number} gamesBot
 * @property {number} setsYou
 * @property {number} setsBot
 * @property {'you'|'bot'} server
 * @property {'deuce'|'ad'} serveCourt
 * @property {number} serveAttempt
 * @property {number} faults
 * @property {boolean} inTiebreak
 * @property {string} message
 * @property {number} power
 * @property {number} aim
 * @property {boolean} charging
 */

export class TennisGame {
  root;
  renderer;
  scene;
  camera;
  raf = 0;
  disposed = false;
  last = 0;
  /** @type {(hud: TennisHud) => void} */
  onHud;

  ball;
  ballVel = new THREE.Vector3();
  ballLive = false;
  assets = null;

  usingMeshy = {
    racket: false,
    ball: false,
    net: false,
    chair: false,
    player: false,
    opponent: false,
  };

  you;
  bot;
  youRacketPivot;
  botRacketPivot;

  youX = 0;
  youZ = HALF_LENGTH - 0.6;
  botX = 0;
  botZ = -11.29;

  youSwing = 0;
  botSwing = 0;
  charging = false;
  chargePower = 0;
  chargeAim = 0;
  chargePointerId = null;
  chargeOrigin = null;
  spaceCharging = false;

  pointsYou = 0;
  pointsBot = 0;
  gamesYou = 0;
  gamesBot = 0;
  setsYou = 0;
  setsBot = 0;
  advantage = null;
  inTiebreak = false;
  tbYou = 0;
  tbBot = 0;
  setOver = false;

  server = 'you';
  serveCourt = 'deuce';
  serveAttempt = 1;
  serving = true;
  inServeFlight = false;
  touchedNet = false;
  lastHitter = null;
  bouncesOnReturnSide = 0;
  pauseT = 1;
  status = 'Serve — Swing';

  keys = new Set();
  stickX = 0;
  stickZ = 0;
  pointerId = null;
  dragOrigin = null;

  onKeyDown;
  onKeyUp;
  onResize;
  cleanups = [];

  /**
   * @param {HTMLElement} root
   * @param {(hud: TennisHud) => void} onHud
   * @param {Awaited<ReturnType<typeof loadTennisAssets>> | null} [assets]
   */
  constructor(root, onHud, assets = null) {
    this.root = root;
    this.onHud = onHud;
    this.assets = assets;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87a344);
    this.scene.fog = null;

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.className = 'tennis-canvas';
    this.renderer.domElement.style.touchAction = 'none';
    root.appendChild(this.renderer.domElement);

    this.buildCourt();
    this.buildPlayers();
    this.buildBall();
    this.setupLights();
    this.bindInput();
    this.resize();

    this.onKeyDown = (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        if (!this.spaceCharging && !this.charging) this.beginCharge();
        this.spaceCharging = true;
      }
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space' && this.spaceCharging) {
        this.spaceCharging = false;
        this.releaseCharge();
      }
    };
    this.onResize = () => this.resize();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);

    this.prepareServe(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);

    const summary = assets ? meshySourceSummary(assets) : '';
    this.status = summary ? `Meshy · ${summary}` : 'Serve — Swing';
    this.pushHud();
  }

  static async create(root, onHud) {
    const assets = await loadTennisAssets();
    return new TennisGame(root, onHud, assets);
  }

  /**
   * Wire HUD touch stick + swing button (`data-tennis="stick|knob|swing"`).
   * @param {HTMLElement} hudRoot
   */
  bindControls(hudRoot) {
    const stick = hudRoot.querySelector('[data-tennis="stick"]');
    const knob = hudRoot.querySelector('[data-tennis="knob"]');
    const swing = hudRoot.querySelector('[data-tennis="swing"]');

    if (stick) {
      const onDown = (e) => {
        this.pointerId = e.pointerId;
        stick.setPointerCapture(e.pointerId);
        const rect = stick.getBoundingClientRect();
        this.dragOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.updateStick(e.clientX, e.clientY, stick, knob);
        e.preventDefault();
      };
      const onMove = (e) => {
        if (this.pointerId !== e.pointerId || !this.dragOrigin) return;
        this.updateStick(e.clientX, e.clientY, stick, knob);
        e.preventDefault();
      };
      const onUp = (e) => {
        if (this.pointerId !== e.pointerId) return;
        this.pointerId = null;
        this.dragOrigin = null;
        this.stickX = 0;
        this.stickZ = 0;
        if (knob) knob.style.transform = 'translate(-50%, -50%)';
        stick.classList.remove('active');
      };
      stick.addEventListener('pointerdown', onDown);
      stick.addEventListener('pointermove', onMove);
      stick.addEventListener('pointerup', onUp);
      stick.addEventListener('pointercancel', onUp);
      this.cleanups.push(() => {
        stick.removeEventListener('pointerdown', onDown);
        stick.removeEventListener('pointermove', onMove);
        stick.removeEventListener('pointerup', onUp);
        stick.removeEventListener('pointercancel', onUp);
      });
    }

    if (swing) {
      const onDown = (e) => {
        e.preventDefault();
        this.chargePointerId = e.pointerId;
        try {
          swing.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        this.chargeOrigin = { x: e.clientX, y: e.clientY };
        this.beginCharge();
      };
      const onMove = (e) => {
        if (this.chargePointerId !== e.pointerId || !this.charging || !this.chargeOrigin) return;
        const dx = e.clientX - this.chargeOrigin.x;
        this.chargeAim = THREE.MathUtils.clamp(dx / 70, -1, 1);
        e.preventDefault();
      };
      const onUp = (e) => {
        if (this.chargePointerId !== null && e.pointerId !== this.chargePointerId) return;
        this.chargePointerId = null;
        this.chargeOrigin = null;
        this.releaseCharge();
      };
      swing.addEventListener('pointerdown', onDown);
      swing.addEventListener('pointermove', onMove);
      swing.addEventListener('pointerup', onUp);
      swing.addEventListener('pointercancel', onUp);
      this.cleanups.push(() => {
        swing.removeEventListener('pointerdown', onDown);
        swing.removeEventListener('pointermove', onMove);
        swing.removeEventListener('pointerup', onUp);
        swing.removeEventListener('pointercancel', onUp);
      });
    }
  }

  beginCharge() {
    if (this.setOver || this.charging) return;
    if (this.serving && this.server !== 'you') return;
    if (!this.serving && this.ballLive && this.lastHitter === 'you') return;
    this.charging = true;
    this.chargePower = 0;
    this.chargeAim = 0;
    this.status = 'Charging…';
    this.pushHud();
  }

  releaseCharge() {
    if (!this.charging) return;
    const power = THREE.MathUtils.clamp(Math.max(this.chargePower, MIN_POWER), MIN_POWER, MAX_POWER);
    const aim = this.chargeAim;
    this.charging = false;
    this.chargePower = 0;
    this.executeShot('you', power, aim);
  }

  updateStick(clientX, clientY, stickEl, knobEl) {
    if (!this.dragOrigin) return;
    const rect = stickEl.getBoundingClientRect();
    const maxR = Math.min(rect.width, rect.height) * 0.38;
    let dx = clientX - this.dragOrigin.x;
    let dy = clientY - this.dragOrigin.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    this.stickX = dx / maxR;
    this.stickZ = dy / maxR;
    if (knobEl) {
      knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
    stickEl.classList.add('active');
  }

  buildCourt() {
    const root = new THREE.Group();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 36),
      new THREE.MeshStandardMaterial({ color: 0x2a6a4a, roughness: 0.92 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    root.add(ground);

    const court = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_WIDTH * 2 + 1.2, HALF_LENGTH * 2 + 1.2),
      new THREE.MeshStandardMaterial({ color: 0x3a8a5c, roughness: 0.85 }),
    );
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    root.add(court);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f0e8 });
    const addLine = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.012, z);
      root.add(m);
    };
    addLine(0.04, HALF_LENGTH * 2, -SINGLES_HALF, 0);
    addLine(0.04, HALF_LENGTH * 2, SINGLES_HALF, 0);
    addLine(0.06, HALF_LENGTH * 2, -HALF_WIDTH, 0);
    addLine(0.06, HALF_LENGTH * 2, HALF_WIDTH, 0);
    addLine(HALF_WIDTH * 2, 0.06, 0, -HALF_LENGTH);
    addLine(HALF_WIDTH * 2, 0.06, 0, HALF_LENGTH);
    addLine(0.05, HALF_LENGTH * 2, 0, 0);
    addLine(HALF_WIDTH * 2, 0.05, 0, -SERVICE_LINE_Z);
    addLine(HALF_WIDTH * 2, 0.05, 0, SERVICE_LINE_Z);

    if (this.assets?.net) {
      const url = this.assets.urls.net ?? '/models/tennis/tennis-net-wide.glb';
      const net = wrapNet(this.assets.net, url, NET_WIDTH, NET_MESH_H);
      net.position.set(0, 0, 0);
      this.scene.add(net);
      this.usingMeshy.net = true;
    } else {
      const netG = new THREE.Group();
      const postGeo = new THREE.CylinderGeometry(0.07, 0.08, NET_MESH_H, 8);
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x3a3a30,
        metalness: 0.45,
        roughness: 0.4,
      });
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(side * SINGLES_HALF, NET_MESH_H / 2, 0);
        post.castShadow = true;
        netG.add(post);
      }
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(NET_WIDTH - 0.15, NET_H),
        new THREE.MeshStandardMaterial({
          color: 0x1a1e22,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          roughness: 0.9,
        }),
      );
      mesh.position.y = NET_H / 2;
      netG.add(mesh);
      const tape = new THREE.Mesh(
        new THREE.BoxGeometry(NET_WIDTH, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xf5f0ea }),
      );
      tape.position.y = NET_H;
      netG.add(tape);
      root.add(netG);
    }

    if (this.assets?.chair) {
      const chair = wrapScaledModel(
        this.assets.chair,
        '/models/tennis/tennis-court-props.glb',
        3.6,
      );
      chair.position.set(-6.915, 0, 0);
      this.scene.add(chair);
      this.usingMeshy.chair = true;
    }

    for (const z of [-18, 18]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(16, 2.2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x4a5a60, roughness: 0.7 }),
      );
      wall.position.set(0, 1, z);
      root.add(wall);
    }

    this.scene.add(root);
  }

  makeRacket() {
    if (this.assets?.racket) {
      const r = wrapRacket(this.assets.racket, '/models/tennis/tennis-racket.glb', 0.68);
      r.rotation.set(0.15, Math.PI / 2, -0.25);
      this.usingMeshy.racket = true;
      return r;
    }
    const g = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x2c2418, roughness: 0.6 }),
    );
    handle.position.y = 0.28;
    g.add(handle);
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.018, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8c454, roughness: 0.4 }),
    );
    frame.rotation.x = Math.PI / 2;
    frame.position.y = 0.55;
    g.add(frame);
    const strings = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 16),
      new THREE.MeshStandardMaterial({
        color: 0xc8d0e8,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    strings.position.y = 0.55;
    g.add(strings);
    g.rotation.set(0.15, Math.PI / 2, -0.25);
    return g;
  }

  makeCompetitor(who) {
    const root = new THREE.Group();
    root.name = who === 'you' ? 'player-you' : 'player-bot';

    const mesh = who === 'you' ? this.assets?.player : this.assets?.opponent;
    const url =
      who === 'you'
        ? (this.assets?.urls.player ?? '/models/tennis/tennis-player.glb')
        : (this.assets?.urls.opponent ?? '/models/tennis/tennis-opponent.glb');

    if (mesh) {
      root.add(wrapPlayer(mesh, url, 1.78));
      if (who === 'you') this.usingMeshy.player = true;
      else this.usingMeshy.opponent = true;
    } else {
      const shirt = who === 'you' ? 0x3a6a8a : 0xd4652f;
      const pants = who === 'you' ? 0x2a3828 : 0x5a4038;
      const skin = 0xe0c8a8;

      const hips = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.2, 0.22, 10),
        new THREE.MeshStandardMaterial({ color: pants, roughness: 0.7 }),
      );
      hips.position.y = 0.85;
      hips.castShadow = true;
      root.add(hips);

      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.22, 0.55, 10),
        new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.55 }),
      );
      torso.position.y = 1.22;
      torso.castShadow = true;
      root.add(torso);

      const vest = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.35, 0.08),
        new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.5, metalness: 0.05 }),
      );
      vest.position.set(0, 1.25, -0.14);
      root.add(vest);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 12),
        new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 }),
      );
      head.position.y = 1.62;
      head.castShadow = true;
      root.add(head);

      const nose = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 6, 6),
        new THREE.MeshStandardMaterial({ color: skin }),
      );
      nose.position.set(0, 1.62, -0.14);
      root.add(nose);

      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.08, 0.72, 8),
          new THREE.MeshStandardMaterial({ color: pants, roughness: 0.7 }),
        );
        leg.position.set(side * 0.1, 0.4, 0);
        leg.castShadow = true;
        root.add(leg);
        const shoe = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.08, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xf0e8e8, roughness: 0.6 }),
        );
        shoe.position.set(side * 0.1, 0.05, -0.02);
        root.add(shoe);
      }

      const armL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.055, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 }),
      );
      armL.position.set(-0.32, 1.2, 0);
      armL.rotation.z = 0.25;
      root.add(armL);

      const armR = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.055, 0.45, 8),
        new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 }),
      );
      armR.position.set(0.34, 1.15, -0.05);
      armR.rotation.z = -0.55;
      armR.rotation.x = 0.35;
      root.add(armR);
    }

    const pivot = new THREE.Group();
    pivot.name = 'racket-pivot';
    pivot.position.set(0.42, 1.05, -0.08);
    const racket = this.makeRacket();
    pivot.add(racket);
    root.add(pivot);
    root.userData.racketPivot = pivot;
    root.userData.racket = racket;
    return root;
  }

  buildPlayers() {
    this.you = this.makeCompetitor('you');
    this.bot = this.makeCompetitor('bot');
    this.youRacketPivot = this.you.userData.racketPivot;
    this.botRacketPivot = this.bot.userData.racketPivot;
    this.you.rotation.y = YOU_FACE;
    this.bot.rotation.y = BOT_FACE;
    this.scene.add(this.you, this.bot);
  }

  buildBall() {
    if (this.assets?.ball) {
      this.ball = wrapScaledModel(this.assets.ball, '/models/tennis/tennis-ball.glb', BALL_R * 2.4, {
        ground: false,
        centerY: true,
      });
      this.usingMeshy.ball = true;
    } else {
      this.ball = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_R, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0xd4e54a,
          roughness: 0.45,
          emissive: 0x334400,
          emissiveIntensity: 0.15,
        }),
      );
      this.ball.castShadow = true;
    }
    this.scene.add(this.ball);
  }

  setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xc8e0ff, 0x3a5030, 0.85));
    const sun = new THREE.DirectionalLight(0xffe8d8, 1.15);
    sun.position.set(8, 18, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
  }

  bindInput() {
    const el = this.renderer.domElement;
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.chargePointerId = e.pointerId;
      this.chargeOrigin = { x: e.clientX, y: e.clientY };
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.youX = THREE.MathUtils.clamp(nx * (HALF_WIDTH - 0.4), -HALF_WIDTH + 0.35, HALF_WIDTH - 0.35);
      this.beginCharge();
    };
    const onMove = (e) => {
      if (this.chargePointerId !== e.pointerId || !this.charging || !this.chargeOrigin) {
        if (e.pointerType === 'touch' || e.buttons === 1) {
          const rect = el.getBoundingClientRect();
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          this.youX = THREE.MathUtils.clamp(
            nx * (HALF_WIDTH - 0.4),
            -HALF_WIDTH + 0.35,
            HALF_WIDTH - 0.35,
          );
        }
        return;
      }
      const dx = e.clientX - this.chargeOrigin.x;
      this.chargeAim = THREE.MathUtils.clamp(dx / 70, -1, 1);
      e.preventDefault();
    };
    const onUp = (e) => {
      if (this.chargePointerId !== null && e.pointerId !== this.chargePointerId) return;
      if (this.chargePointerId === e.pointerId) {
        this.chargePointerId = null;
        this.chargeOrigin = null;
        this.releaseCharge();
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    this.cleanups.push(() => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    });
  }

  resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  serveStandX(server, court) {
    if (server === 'you') return court === 'deuce' ? -2.4 : 2.4;
    return court === 'deuce' ? 2.4 : -2.4;
  }

  prepareServe(resetAttempt) {
    if (this.setOver) return;
    this.serving = true;
    this.ballLive = false;
    this.inServeFlight = false;
    this.touchedNet = false;
    this.lastHitter = null;
    this.bouncesOnReturnSide = 0;
    this.ballVel.set(0, 0, 0);
    this.pauseT = 0.85;
    if (resetAttempt) this.serveAttempt = 1;

    const x = this.serveStandX(this.server, this.serveCourt);
    if (this.server === 'you') {
      this.youX = x;
      this.youZ = HALF_LENGTH - 0.35;
      this.you.position.set(this.youX, 0, this.youZ);
    } else {
      this.botX = x;
      this.botZ = -11.54;
      this.bot.position.set(this.botX, 0, this.botZ);
    }

    const nth = this.serveAttempt === 1 ? '1st' : '2nd';
    const side = this.serveCourt === 'deuce' ? 'Deuce' : 'Ad';
    this.status =
      this.server === 'you' ? `${nth} serve · ${side} — Swing` : `Bot ${nth} serve · ${side}`;
    this.pushHud();
  }

  launchServe(who, power = 0.75, aim = 0) {
    const behind =
      who === 'you' ? this.youZ >= HALF_LENGTH - 1.6 : this.botZ <= -10.29;
    if (!behind) {
      this.status = 'Serve from behind baseline';
      this.pushHud();
      return;
    }

    this.serving = false;
    this.ballLive = true;
    this.inServeFlight = true;
    this.touchedNet = false;
    this.lastHitter = who;
    this.bouncesOnReturnSide = 0;

    const dir = who === 'you' ? -1 : 1;
    let targetX =
      who === 'you'
        ? this.serveCourt === 'deuce'
          ? 2
          : -2
        : this.serveCourt === 'deuce'
          ? -2
          : 2;
    if (who === 'you') targetX += aim * 2.2;
    else targetX += (Math.random() - 0.5) * 1.2;

    const speed = THREE.MathUtils.lerp(9.5, 15.5, power);
    const loft = THREE.MathUtils.lerp(4.6, 3.2, power);
    const mult = this.serveAttempt === 1 ? 1 : 0.88;
    const hSpeed = speed * mult;

    const pos = this.ball.position.clone();
    pos.y = 1.35;
    this.ball.position.copy(pos);

    const targetZ = dir * (SERVICE_LINE_Z * 0.55);
    const dx = targetX - pos.x;
    const dz = targetZ - pos.z;
    const len = Math.hypot(dx, dz) || 1;
    this.ballVel.set((dx / len) * hSpeed, loft, (dz / len) * hSpeed);
    this.status = power > 0.7 ? 'Serve!' : 'Soft serve';
    this.pushHud();
  }

  executeShot(who, power, aim) {
    if (this.setOver) return;
    const player = who === 'you' ? this.you : this.bot;
    const pivot = who === 'you' ? this.youRacketPivot : this.botRacketPivot;

    if (who === 'you') this.youSwing = 0.5 + power * 0.7;
    else this.botSwing = 0.5 + power * 0.7;

    if (this.serving && who === this.server) {
      this.launchServe(who, power, aim);
      pivot.rotation.x = -0.9 - power * 0.4;
      return;
    }
    if (!this.ballLive || this.inServeFlight) return;

    const onSide = who === 'you' ? this.ball.position.z > 0.15 : this.ball.position.z < -0.15;
    const dist = this.ball.position.distanceTo(
      new THREE.Vector3(player.position.x, 1, player.position.z),
    );
    if (!onSide || dist > 2.6) {
      if (who === 'you') {
        this.status = 'Out of reach';
        this.pushHud();
      }
      return;
    }
    if (this.bouncesOnReturnSide > 1 || this.lastHitter === who) return;

    this.lastHitter = who;
    this.bouncesOnReturnSide = 0;
    this.touchedNet = false;

    const dir = who === 'you' ? -1 : 1;
    const aimSign = who === 'you' ? -aim : aim;
    const targetX =
      (who === 'you' ? this.botX : this.youX) * 0.25 + aimSign * 3.2 - this.ball.position.x;
    const speed = THREE.MathUtils.lerp(8.5, 14.5, power);
    const loft = THREE.MathUtils.lerp(4, 2.6, power);
    this.ballVel.set(targetX * 1.15, loft, dir * speed);
    this.ball.position.y = Math.max(this.ball.position.y, 0.55);
    pivot.rotation.x = -1 - power * 0.5;
    this.status = power > 0.75 ? 'Winner attempt' : 'Rally';
    this.pushHud();
  }

  fault(reason) {
    this.ballLive = false;
    this.inServeFlight = false;
    if (this.serveAttempt === 1) {
      this.serveAttempt = 2;
      this.status = `Fault — ${reason} · 2nd serve`;
      this.prepareServe(false);
    } else {
      this.status = `Double fault — ${reason}`;
      this.awardPoint(this.server === 'you' ? 'bot' : 'you');
    }
  }

  letServe() {
    this.ballLive = false;
    this.inServeFlight = false;
    this.status = 'Let — replay serve';
    this.prepareServe(false);
  }

  awardPoint(who) {
    this.ballLive = false;
    this.inServeFlight = false;
    this.serving = false;

    if (this.inTiebreak) {
      if (who === 'you') this.tbYou += 1;
      else this.tbBot += 1;
      this.status = who === 'you' ? 'Tiebreak point — You' : 'Tiebreak point — Bot';
      if ((this.tbYou >= 7 || this.tbBot >= 7) && Math.abs(this.tbYou - this.tbBot) >= 2) {
        this.winGame(this.tbYou > this.tbBot ? 'you' : 'bot');
        return;
      }
      const total = this.tbYou + this.tbBot;
      if (total === 1 || (total > 1 && (total - 1) % 2 === 0)) {
        this.server = this.server === 'you' ? 'bot' : 'you';
      }
      this.serveCourt = this.serveCourt === 'deuce' ? 'ad' : 'deuce';
      this.serveAttempt = 1;
      this.prepareServe(true);
      return;
    }

    if (this.pointsYou >= 3 && this.pointsBot >= 3) {
      if (this.advantage === who) {
        this.winGame(who);
        return;
      }
      if (this.advantage && this.advantage !== who) {
        this.advantage = null;
        this.status = 'Deuce';
        this.afterPointServeFlip();
        return;
      }
      this.advantage = who;
      this.status = who === 'you' ? 'Advantage You' : 'Advantage Bot';
      this.afterPointServeFlip();
      return;
    }

    if (who === 'you') this.pointsYou += 1;
    else this.pointsBot += 1;

    if (this.pointsYou >= 4 || this.pointsBot >= 4) {
      this.winGame(who);
      return;
    }
    this.status = who === 'you' ? 'Point — You' : 'Point — Bot';
    this.afterPointServeFlip();
  }

  afterPointServeFlip() {
    this.serveCourt = this.serveCourt === 'deuce' ? 'ad' : 'deuce';
    this.serveAttempt = 1;
    this.prepareServe(true);
  }

  winGame(who) {
    this.inTiebreak = false;
    this.tbYou = 0;
    this.tbBot = 0;
    this.pointsYou = 0;
    this.pointsBot = 0;
    this.advantage = null;
    if (who === 'you') this.gamesYou += 1;
    else this.gamesBot += 1;
    this.status = who === 'you' ? 'Game — You' : 'Game — Bot';

    if (this.gamesYou === 6 && this.gamesBot === 6) {
      this.inTiebreak = true;
      this.tbYou = 0;
      this.tbBot = 0;
      this.server = this.server === 'you' ? 'bot' : 'you';
      this.serveCourt = 'deuce';
      this.serveAttempt = 1;
      this.status = 'Tiebreak';
      this.prepareServe(true);
      return;
    }
    if ((this.gamesYou >= 6 || this.gamesBot >= 6) && Math.abs(this.gamesYou - this.gamesBot) >= 2) {
      this.winSet(this.gamesYou > this.gamesBot ? 'you' : 'bot');
      return;
    }
    this.server = this.server === 'you' ? 'bot' : 'you';
    this.serveCourt = 'deuce';
    this.serveAttempt = 1;
    this.prepareServe(true);
  }

  winSet(who) {
    if (who === 'you') this.setsYou += 1;
    else this.setsBot += 1;
    this.gamesYou = 0;
    this.gamesBot = 0;
    this.setOver = true;
    this.status = who === 'you' ? 'Set — You win!' : 'Set — Bot wins';
    this.ballLive = false;
    this.serving = false;
    this.pushHud();
    this.pauseT = 2.5;
    window.setTimeout(() => {
      if (this.disposed) return;
      this.setOver = false;
      this.setsYou = 0;
      this.setsBot = 0;
      this.server = 'you';
      this.serveCourt = 'deuce';
      this.serveAttempt = 1;
      this.status = 'New set';
      this.prepareServe(true);
    }, 2500);
  }

  pushHud() {
    let scoreYou;
    let scoreBot;
    if (this.inTiebreak) {
      scoreYou = String(this.tbYou);
      scoreBot = String(this.tbBot);
    } else if (this.pointsYou >= 3 && this.pointsBot >= 3) {
      if (this.advantage === 'you') {
        scoreYou = 'AD';
        scoreBot = '40';
      } else if (this.advantage === 'bot') {
        scoreYou = '40';
        scoreBot = 'AD';
      } else {
        scoreYou = '40';
        scoreBot = '40';
      }
    } else {
      scoreYou = pointLabel(this.pointsYou);
      scoreBot = pointLabel(this.pointsBot);
    }

    this.onHud({
      scoreYou,
      scoreBot,
      gamesYou: this.gamesYou,
      gamesBot: this.gamesBot,
      setsYou: this.setsYou,
      setsBot: this.setsBot,
      server: this.server,
      serveCourt: this.serveCourt,
      serveAttempt: this.serveAttempt,
      faults: this.serveAttempt === 2 ? 1 : 0,
      inTiebreak: this.inTiebreak,
      message: this.status,
      power: this.charging ? this.chargePower : 0,
      aim: this.charging ? this.chargeAim : 0,
      charging: this.charging,
    });
  }

  trySwing(who) {
    this.executeShot(who, 0.55 + Math.random() * 0.25, (Math.random() - 0.5) * 0.8);
  }

  frame = (t) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };

  update(dt) {
    let mx = this.stickX;
    let mz = this.stickZ;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) mx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) mx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) mz -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) mz += 1;
    if (this.charging) mx = 0;
    mx = THREE.MathUtils.clamp(mx, -1, 1);
    mz = THREE.MathUtils.clamp(mz, -1, 1);

    const speed = 7.5;
    if (this.serving && this.server === 'you') {
      this.youX += mx * speed * 0.55 * dt;
      this.youZ = Math.max(this.youZ, HALF_LENGTH - 1.4);
    } else {
      this.youX += mx * speed * dt;
      this.youZ += mz * speed * dt;
    }
    this.youX = THREE.MathUtils.clamp(this.youX, -HALF_WIDTH + 0.35, HALF_WIDTH - 0.35);
    this.youZ = THREE.MathUtils.clamp(this.youZ, 1, HALF_LENGTH - 0.25);
    this.you.position.set(this.youX, 0, this.youZ);

    if (this.serving && this.server === 'bot') {
      const target = this.serveStandX('bot', this.serveCourt);
      this.botX = THREE.MathUtils.damp(this.botX, target, 4, dt);
      this.botZ = THREE.MathUtils.damp(this.botZ, -11.54, 4, dt);
    } else if (this.ballLive && this.ball.position.z < 0.2) {
      this.botX +=
        Math.sign(this.ball.position.x - this.botX) *
        Math.min(Math.abs(this.ball.position.x - this.botX), 6.5 * dt);
      this.botZ = THREE.MathUtils.damp(
        this.botZ,
        THREE.MathUtils.clamp(this.ball.position.z + 1, -11.59, -1),
        4,
        dt,
      );
    } else {
      this.botX = THREE.MathUtils.damp(this.botX, 0, 1.5, dt);
      this.botZ = THREE.MathUtils.damp(this.botZ, -10.69, 2, dt);
    }
    this.botX = THREE.MathUtils.clamp(this.botX, -HALF_WIDTH + 0.35, HALF_WIDTH - 0.35);
    this.bot.position.set(this.botX, 0, this.botZ);

    if (this.charging) {
      this.chargePower = Math.min(MAX_POWER, this.chargePower + dt / CHARGE_TIME);
      let aim = this.stickX;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) aim -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) aim += 1;
      if (Math.abs(aim) > 0.04) this.chargeAim = THREE.MathUtils.clamp(aim, -1, 1);
      this.pushHud();
    }

    if (this.serving && this.server === 'bot' && this.pauseT <= 0 && !this.setOver) {
      this.trySwing('bot');
    } else if (
      this.ballLive &&
      !this.inServeFlight &&
      this.ball.position.z < -0.3 &&
      this.lastHitter !== 'bot' &&
      this.ball.position.distanceTo(new THREE.Vector3(this.botX, 1, this.botZ)) < 2.2 &&
      Math.random() < 0.06
    ) {
      this.trySwing('bot');
    }

    this.youSwing = Math.max(0, this.youSwing - dt * 3);
    this.botSwing = Math.max(0, this.botSwing - dt * 3);
    this.youRacketPivot.rotation.x = THREE.MathUtils.damp(
      this.youRacketPivot.rotation.x,
      -0.15 - this.youSwing * 1.1,
      10,
      dt,
    );
    this.botRacketPivot.rotation.x = THREE.MathUtils.damp(
      this.botRacketPivot.rotation.x,
      -0.15 - this.botSwing * 1.1,
      10,
      dt,
    );

    if (this.pauseT > 0) {
      this.pauseT -= dt;
      if (this.serving) {
        const p = this.server === 'you' ? this.you : this.bot;
        const oz = this.server === 'you' ? -0.45 : 0.45;
        this.ball.position.set(p.position.x + 0.2, 1.1, p.position.z + oz);
      }
      return;
    }

    if (!this.ballLive || this.setOver) return;

    const prevZ = this.ball.position.z;
    this.ballVel.y += GRAVITY * dt;
    this.ball.position.addScaledVector(this.ballVel, dt);

    // Net collision
    if (
      Math.abs(this.ball.position.z) < 0.14 &&
      this.ball.position.y < NET_H + 0.08 &&
      Math.abs(this.ball.position.x) < HALF_WIDTH + 0.55
    ) {
      this.touchedNet = true;
      if (this.ball.position.y < NET_H - 0.02) {
        this.ball.position.z = Math.sign(prevZ || 1) * 0.16;
        this.ballVel.set(this.ballVel.x * 0.2, Math.abs(this.ballVel.y) * 0.25, -Math.sign(prevZ || 1) * 1.5);
        if (!this.inServeFlight) {
          this.awardPoint(this.lastHitter === 'you' ? 'bot' : 'you');
          return;
        }
      } else {
        this.ball.position.z = Math.sign(this.ballVel.z || prevZ || -1) * 0.16;
        this.ballVel.y *= 0.85;
        this.ballVel.z *= 0.9;
      }
    }

    // Bounce
    if (this.ball.position.y <= BALL_R) {
      const bx = this.ball.position.x;
      const bz = this.ball.position.z;
      this.ball.position.y = BALL_R;
      this.ballVel.y = Math.abs(this.ballVel.y) * BOUNCE;
      this.ballVel.x *= 0.9;
      this.ballVel.z *= 0.9;

      if (this.inServeFlight) {
        if (this.touchedNet && inServeBox(bx, bz, this.server, this.serveCourt)) {
          this.letServe();
          return;
        }
        if (!inServeBox(bx, bz, this.server, this.serveCourt)) {
          this.fault(this.touchedNet ? 'net' : 'out');
          return;
        }
        this.inServeFlight = false;
        this.bouncesOnReturnSide = 1;
        this.status = 'Rally';
        this.pushHud();
        return;
      }

      if (!inBounds(bx, bz)) {
        this.awardPoint(this.lastHitter === 'you' ? 'bot' : 'you');
        return;
      }

      const onYourSide = bz > 0;
      const lastWasBot = this.lastHitter === 'bot';
      if (onYourSide !== lastWasBot) {
        this.awardPoint(this.lastHitter === 'you' ? 'bot' : 'you');
        return;
      }
      this.bouncesOnReturnSide += 1;
      if (this.bouncesOnReturnSide >= 2) {
        this.awardPoint(this.lastHitter ?? (onYourSide ? 'bot' : 'you'));
        return;
      }
    }

    if (this.ball.position.z > HALF_LENGTH + 2.5 || this.ball.position.z < -14.39) {
      if (this.inServeFlight) this.fault('long');
      else this.awardPoint(this.lastHitter === 'you' ? 'bot' : 'you');
      return;
    }
    if (Math.abs(this.ball.position.x) > HALF_WIDTH + 3.5) {
      if (this.inServeFlight) this.fault('wide');
      else this.awardPoint(this.lastHitter === 'you' ? 'bot' : 'you');
    }
  }

  updateCamera(dt) {
    const target = new THREE.Vector3(this.youX * 0.35, 3.8, this.youZ + 6.5);
    this.camera.position.lerp(target, 1 - Math.exp(-5 * dt));
    this.camera.lookAt(new THREE.Vector3(this.youX * 0.15, 0.85, -1.5));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
