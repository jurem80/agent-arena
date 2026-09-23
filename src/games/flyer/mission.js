import * as THREE from 'three';
import { FlightInput } from './input.js';
import { loadCampusProps, loadPlaneMesh } from './assets.js';

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function makeRaider() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.8, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a1010, emissive: 0x440000, metalness: 0.4, roughness: 0.5 }),
  );
  body.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 1.5 }),
  );
  glow.position.z = -0.7;
  g.add(body, glow);
  g.userData.kind = 'raider';
  return g;
}

/**
 * Grid Defense mission — defend cyan-lit halls from raider waves.
 */
export class MissionGame {
  /**
   * @param {HTMLElement} root
   * @param {{ region: any, plane: any }} opts
   * @param {(hud: object) => void} onHud
   * @param {(result: { won: boolean, score: number, reason: string }) => void} onEnd
   */
  constructor(root, opts, onHud, onEnd) {
    this.root = root;
    this.region = opts.region;
    this.planeCfg = opts.plane;
    this.onHud = onHud;
    this.onEnd = onEnd;
    this.disposed = false;
    this.paused = false;
    this.phase = 'playing';
    this.score = 0;
    this.wave = 0;
    this.wavesTotal = opts.region.waves;
    this.hull = opts.plane.maxHp;
    this.maxHull = opts.plane.maxHp;
    this.campus = 100;
    this.missiles = opts.plane.maxMissiles;
    this.flares = opts.plane.maxFlares;
    this.gunCd = 0;
    this.missileCd = 0;
    this.flareCd = 0;
    this.waveAnnounceT = 0;
    this.spawnQueue = 0;
    this.spawnTimer = 0;
    this.pauseLatch = false;

    this.input = new FlightInput();
    this.clock = new THREE.Clock();
    this.bullets = [];
    this.missileObjs = [];
    this.flareObjs = [];
    this.raiders = [];
    this.enemyRockets = [];
    this.halls = [];

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1020);
    this.scene.fog = new THREE.FogExp2(0x1a1428, 0.012);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.5, 800);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.appendChild(this.renderer.domElement);

    this.plane = new THREE.Group();
    this.scene.add(this.plane);
    this.yaw = 0;
    this.pitch = 0.05;
    this.bank = 0;
    this.speed = opts.plane.speed;
    this.plane.position.set(0, 28, 55);

    this.#buildEnvironment();
    this.#bindResize();
    this.ready = this.#loadMeshes().then(() => {
      if (this.disposed) return;
      this.#startWave(1);
      this.raf = requestAnimationFrame(this.#frame);
    });
  }

  bindHud(hudEl) {
    this.input.bindHud(hudEl);
    const touch = hudEl?.querySelector('#touch-controls');
    if (touch && (matchMedia('(pointer:coarse)').matches || matchMedia('(hover:none)').matches)) {
      touch.hidden = false;
      document.documentElement.classList.add('touch-flight');
    }
  }

  setPaused(v) {
    this.paused = v;
    if (!v) this.clock.getDelta();
  }

  async #loadMeshes() {
    const [planeRes, campus] = await Promise.all([loadPlaneMesh(this.planeCfg), loadCampusProps(this.region)]);
    this.planeMesh = planeRes.mesh;
    this.plane.add(this.planeMesh);
    this.assetNote = [
      planeRes.meshy ? `Meshy · ${planeRes.url?.split('/').pop()}` : 'Procedural plane',
      campus.hallUrl ? campus.hallUrl.split('/').pop() : 'proc hall',
    ].join(' · ');

    const hallCount = this.region.halls;
    const spacing = 28;
    for (let i = 0; i < hallCount; i++) {
      const hall = campus.hall.clone(true);
      const x = (i - (hallCount - 1) / 2) * spacing;
      hall.position.set(x, 0, -10);
      this.scene.add(hall);
      this.halls.push({ mesh: hall, hp: 100 / hallCount, max: 100 / hallCount });

      if (i === 0 || i === hallCount - 1) {
        const tower = campus.tower.clone(true);
        tower.position.set(x + (i === 0 ? -16 : 16), 0, 6);
        this.scene.add(tower);
      }
    }

    // cyan cylinders like cooling towers from screenshot
    for (let i = 0; i < 3; i++) {
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.8, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0x1a4a6a, emissive: 0x006688, emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.55 }),
      );
      cyl.position.set(20 + i * 7, 7, 8);
      cyl.castShadow = true;
      this.scene.add(cyl);
    }
  }

  #buildEnvironment() {
    // dusk sky dome via gradient-ish hemisphere + directional
    const hemi = new THREE.HemisphereLight(0xff8a4a, 0x0a1525, 0.55);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb070, 1.1);
    sun.position.set(-40, 50, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x00d2ff, 0.25);
    fill.position.set(30, 20, 40);
    this.scene.add(fill);

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // runway strip
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 120),
      new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.85 }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0.05, 30);
    runway.receiveShadow = true;
    this.scene.add(runway);

    // runway lights
    for (let i = -8; i <= 8; i++) {
      for (const side of [-11, 11]) {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2 }),
        );
        light.position.set(side, 0.4, 30 + i * 6);
        this.scene.add(light);
      }
    }

    // low-poly hills
    for (let i = 0; i < 28; i++) {
      const h = 8 + Math.random() * 28;
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(12 + Math.random() * 18, h, 5),
        new THREE.MeshStandardMaterial({ color: 0x0e1620 + Math.floor(Math.random() * 0x101018), flatShading: true }),
      );
      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 120;
      hill.position.set(Math.cos(ang) * dist, h * 0.35, Math.sin(ang) * dist - 40);
      this.scene.add(hill);
    }

    // pine trees
    for (let i = 0; i < 60; i++) {
      const tree = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 5 + Math.random() * 4, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a3a28, flatShading: true }),
      );
      tree.position.set((Math.random() - 0.5) * 160, 2.5, (Math.random() - 0.5) * 140 + 20);
      if (Math.hypot(tree.position.x, tree.position.z + 10) < 35) continue;
      this.scene.add(tree);
    }

    // skydome
    const skyGeo = new THREE.SphereGeometry(400, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vPos; void main(){
        float h = normalize(vPos).y;
        vec3 top = vec3(0.05, 0.07, 0.18);
        vec3 mid = vec3(0.35, 0.12, 0.18);
        vec3 hor = vec3(0.95, 0.45, 0.18);
        vec3 col = mix(hor, mid, smoothstep(-0.05, 0.25, h));
        col = mix(col, top, smoothstep(0.15, 0.7, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  #bindResize() {
    this.onResize = () => {
      const w = this.root.clientWidth || window.innerWidth;
      const h = this.root.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  #startWave(n) {
    this.wave = n;
    const counts = this.region.raidersPerWave || [7, 9, 11];
    this.spawnQueue = counts[Math.min(n - 1, counts.length - 1)];
    this.spawnTimer = 0.4;
    this.waveAnnounceT = 2.2;
    this.#pushHud();
  }

  #frame = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.#frame);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.paused || this.phase !== 'playing') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.#updateFlight(dt);
    this.#updateWeapons(dt);
    this.#updateRaiders(dt);
    this.#updateEnemyRockets(dt);
    this.#updateCamera(dt);
    if (this.waveAnnounceT > 0) this.waveAnnounceT -= dt;
    this.renderer.render(this.scene, this.camera);
    this.#pushHud();
  };

  #updateFlight(dt) {
    if (this.input.pause) {
      if (!this.pauseLatch) {
        this.pauseLatch = true;
        this.setPaused(true);
        this.onHud?.({ ...this.#hudState(), pauseRequest: true });
      }
    } else {
      this.pauseLatch = false;
    }

    const targetPitch = this.input.pitch * 0.55;
    const targetBank = this.input.bank * 0.85;
    this.pitch = damp(this.pitch, targetPitch, 6, dt);
    this.bank = damp(this.bank, targetBank, 7, dt);
    this.yaw += this.bank * 0.95 * dt;

    this.plane.rotation.order = 'YXZ';
    this.plane.rotation.y = this.yaw;
    this.plane.rotation.x = this.pitch;
    this.plane.rotation.z = -this.bank * 0.85;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.plane.quaternion);
    this.plane.position.addScaledVector(forward, this.speed * dt);
    this.plane.position.y = THREE.MathUtils.clamp(this.plane.position.y, 6, 70);
    this.plane.position.x = THREE.MathUtils.clamp(this.plane.position.x, -90, 90);
    this.plane.position.z = THREE.MathUtils.clamp(this.plane.position.z, -40, 110);
  }

  #updateWeapons(dt) {
    this.gunCd = Math.max(0, this.gunCd - dt);
    this.missileCd = Math.max(0, this.missileCd - dt);
    this.flareCd = Math.max(0, this.flareCd - dt);

    const muzzle = this.plane.position.clone().add(new THREE.Vector3(0, 0, -3).applyQuaternion(this.plane.quaternion));

    if (this.input.gun && this.gunCd <= 0) {
      this.gunCd = this.planeCfg.gunCooldown;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.plane.quaternion);
      const bolt = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xa8fff0 }),
      );
      bolt.position.copy(muzzle);
      bolt.userData = { vel: dir.multiplyScalar(120), life: 1.4, dmg: this.planeCfg.gunDamage };
      this.scene.add(bolt);
      this.bullets.push(bolt);
    }

    if (this.input.missile && this.missileCd <= 0 && this.missiles > 0) {
      this.missileCd = 0.85;
      this.missiles -= 1;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.plane.quaternion);
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6),
        new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xff8800, emissiveIntensity: 0.8 }),
      );
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      m.position.copy(muzzle);
      const target = this.#nearestRaider();
      m.userData = {
        vel: dir.multiplyScalar(70),
        life: 3.5,
        dmg: this.planeCfg.missileDamage,
        target,
      };
      this.scene.add(m);
      this.missileObjs.push(m);
    }

    if (this.input.flare && this.flareCd <= 0 && this.flares > 0) {
      this.flareCd = 0.55;
      this.flares -= 1;
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffaa33 }),
        );
        f.position.copy(this.plane.position).add(new THREE.Vector3((Math.random() - 0.5) * 3, -1, 2));
        f.userData = {
          vel: new THREE.Vector3((Math.random() - 0.5) * 8, -4 - Math.random() * 4, 6 + Math.random() * 4),
          life: 2.5,
          decoy: true,
        };
        this.scene.add(f);
        this.flareObjs.push(f);
      }
    }

    // update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.position.addScaledVector(b.userData.vel, dt);
      b.userData.life -= dt;
      let hit = false;
      for (const r of this.raiders) {
        if (r.position.distanceTo(b.position) < 1.6) {
          this.#damageRaider(r, b.userData.dmg);
          hit = true;
          break;
        }
      }
      if (hit || b.userData.life <= 0) {
        this.scene.remove(b);
        this.bullets.splice(i, 1);
      }
    }

    // missiles with light seek
    for (let i = this.missileObjs.length - 1; i >= 0; i--) {
      const m = this.missileObjs[i];
      if (m.userData.target && m.userData.target.parent) {
        const to = m.userData.target.position.clone().sub(m.position).normalize();
        m.userData.vel.lerp(to.multiplyScalar(85), 0.08);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.userData.vel.clone().normalize());
      }
      m.position.addScaledVector(m.userData.vel, dt);
      m.userData.life -= dt;
      let hit = false;
      for (const r of this.raiders) {
        if (r.position.distanceTo(m.position) < 2.4) {
          this.#damageRaider(r, m.userData.dmg);
          hit = true;
          break;
        }
      }
      if (hit || m.userData.life <= 0) {
        this.scene.remove(m);
        this.missileObjs.splice(i, 1);
      }
    }

    for (let i = this.flareObjs.length - 1; i >= 0; i--) {
      const f = this.flareObjs[i];
      f.position.addScaledVector(f.userData.vel, dt);
      f.userData.vel.y -= 6 * dt;
      f.userData.life -= dt;
      if (f.userData.life <= 0) {
        this.scene.remove(f);
        this.flareObjs.splice(i, 1);
      }
    }
  }

  #nearestRaider() {
    let best = null;
    let bestD = Infinity;
    for (const r of this.raiders) {
      const d = r.position.distanceTo(this.plane.position);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    return best;
  }

  #updateRaiders(dt) {
    if (this.spawnQueue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnQueue -= 1;
        this.spawnTimer = 0.55 + Math.random() * 0.35;
        this.#spawnRaider();
      }
    }

    for (let i = this.raiders.length - 1; i >= 0; i--) {
      const r = this.raiders[i];
      const targetHall = this.halls[r.userData.hallIndex];
      if (!targetHall || targetHall.hp <= 0) {
        r.userData.hallIndex = this.halls.findIndex((h) => h.hp > 0);
      }
      const hall = this.halls[r.userData.hallIndex];
      if (!hall) continue;
      const dest = hall.mesh.position.clone().add(new THREE.Vector3(0, 8, 0));
      const to = dest.clone().sub(r.position);
      const dist = to.length();
      to.normalize();
      r.position.addScaledVector(to, r.userData.speed * dt);
      r.lookAt(dest);

      // fire rocket occasionally
      r.userData.fireCd -= dt;
      if (r.userData.fireCd <= 0 && dist < 55) {
        r.userData.fireCd = 2.2 + Math.random() * 1.5;
        this.#spawnEnemyRocket(r, hall);
      }

      if (dist < 4) {
        this.#hitCampus(8);
        this.#damageRaider(r, 999);
      }
    }

    if (this.spawnQueue <= 0 && this.raiders.length === 0 && this.phase === 'playing') {
      if (this.wave >= this.wavesTotal) {
        this.#end(true, 'Campus secured.');
      } else {
        this.#startWave(this.wave + 1);
      }
    }
  }

  #spawnRaider() {
    const r = makeRaider();
    const side = Math.random() > 0.5 ? 1 : -1;
    r.position.set(side * (40 + Math.random() * 50), 18 + Math.random() * 20, 70 + Math.random() * 40);
    r.userData.hp = 28 + this.wave * 4;
    r.userData.speed = 14 + this.wave * 1.2;
    r.userData.hallIndex = Math.floor(Math.random() * this.halls.length);
    r.userData.fireCd = 1 + Math.random();
    this.scene.add(r);
    this.raiders.push(r);
  }

  #spawnEnemyRocket(raider, hall) {
    const rocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.16, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xaa0000, emissiveIntensity: 1 }),
    );
    rocket.position.copy(raider.position);
    const target = hall.mesh.position.clone().add(new THREE.Vector3(0, 6, 0));
    const dir = target.sub(rocket.position).normalize();
    rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    rocket.userData = { vel: dir.multiplyScalar(32), life: 5, hallIndex: raider.userData.hallIndex };
    this.scene.add(rocket);
    this.enemyRockets.push(rocket);
  }

  #updateEnemyRockets(dt) {
    for (let i = this.enemyRockets.length - 1; i >= 0; i--) {
      const rk = this.enemyRockets[i];
      // flares decoy rockets
      let decoyed = false;
      for (const f of this.flareObjs) {
        if (rk.position.distanceTo(f.position) < 10) {
          const away = f.position.clone().sub(rk.position).normalize();
          rk.userData.vel.lerp(away.multiplyScalar(40), 0.15);
          decoyed = true;
          break;
        }
      }
      if (!decoyed) {
        const hall = this.halls[rk.userData.hallIndex];
        if (hall && hall.hp > 0) {
          const to = hall.mesh.position.clone().add(new THREE.Vector3(0, 6, 0)).sub(rk.position).normalize();
          rk.userData.vel.lerp(to.multiplyScalar(36), 0.06);
        }
      }
      rk.position.addScaledVector(rk.userData.vel, dt);
      rk.userData.life -= dt;

      // hit player?
      if (rk.position.distanceTo(this.plane.position) < 2.2) {
        this.hull -= 12;
        this.scene.remove(rk);
        this.enemyRockets.splice(i, 1);
        if (this.hull <= 0) {
          this.hull = 0;
          this.#end(false, 'Interceptor down.');
        }
        continue;
      }

      const hall = this.halls[rk.userData.hallIndex];
      if (hall && rk.position.distanceTo(hall.mesh.position.clone().setY(6)) < 5) {
        this.#hitCampus(12);
        this.scene.remove(rk);
        this.enemyRockets.splice(i, 1);
        continue;
      }
      if (rk.userData.life <= 0) {
        this.scene.remove(rk);
        this.enemyRockets.splice(i, 1);
      }
    }
  }

  #damageRaider(r, dmg) {
    r.userData.hp -= dmg;
    if (r.userData.hp <= 0) {
      this.score += 100 + this.wave * 25;
      this.scene.remove(r);
      const idx = this.raiders.indexOf(r);
      if (idx >= 0) this.raiders.splice(idx, 1);
    }
  }

  #hitCampus(amount) {
    this.campus = Math.max(0, this.campus - amount);
    // distribute visual damage
    let left = amount;
    for (const h of this.halls) {
      if (h.hp <= 0) continue;
      const take = Math.min(h.hp, left);
      h.hp -= take;
      left -= take;
      h.mesh.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) {
          o.material.emissiveIntensity = 0.15 + (h.hp / h.max) * 0.9;
        }
      });
      if (left <= 0) break;
    }
    if (this.campus <= 0) {
      this.campus = 0;
      this.#end(false, 'Every hall went dark. Intercept raiders before they reach the roofs.');
    }
  }

  #updateCamera() {
    const back = new THREE.Vector3(0, 4.5, 14).applyQuaternion(this.plane.quaternion);
    const desired = this.plane.position.clone().add(back);
    this.camera.position.lerp(desired, 0.12);
    const look = this.plane.position.clone().add(new THREE.Vector3(0, 1.5, -18).applyQuaternion(this.plane.quaternion));
    this.camera.lookAt(look);
  }

  #hudState() {
    return {
      hull: Math.round(this.hull),
      maxHull: this.maxHull,
      campus: Math.round(this.campus),
      missiles: this.missiles,
      flares: this.flares,
      wave: this.wave,
      wavesTotal: this.wavesTotal,
      score: this.score,
      regionName: this.region.name,
      announce: this.waveAnnounceT > 0 ? { title: `Wave ${this.wave}`, sub: `${this.spawnQueue + this.raiders.length} raiders inbound` } : null,
      raiders: this.raiders.map((r) => {
        const local = r.position.clone().sub(this.plane.position);
        return { x: local.x, z: local.z };
      }),
      playerYaw: this.yaw,
      assetNote: this.assetNote,
      paused: this.paused,
    };
  }

  #pushHud() {
    this.onHud?.(this.#hudState());
  }

  #end(won, reason) {
    if (this.phase !== 'playing') return;
    this.phase = won ? 'won' : 'lost';
    this.onEnd?.({ won, score: this.score, reason });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.input.dispose();
    document.documentElement.classList.remove('touch-flight');
    this.renderer.dispose();
    this.root.innerHTML = '';
  }
}
