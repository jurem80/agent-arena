import './styles/main.css';
import { FlyerApp } from './games/flyer/FlyerApp.js';
import { PongGame } from './games/pong/pong.js';
import { TennisGame } from './games/tennis/tennis.js';
import { getAudio } from './games/shared/audio.js';

const app = document.getElementById('app');

app.innerHTML = `
  <div class="shell">
    <div id="game-root" class="game-root" hidden></div>
    <div id="pong-root" class="pong-root" hidden></div>
    <div id="tennis-root" class="tennis-root" hidden></div>

    <div id="hub-screen" class="overlay panel-screen hub-screen">
      <div class="menu-top hub-top">
        <div class="brand-block">
          <p class="eyebrow">Bot playground</p>
          <h1 class="title">Agent Arena</h1>
          <p class="tagline">Pick a game. Flyer, Pong, and 3D Tennis are live. More sports soon.</p>
        </div>
      </div>
      <div class="menu-scroll hub-scroll">
        <div class="game-grid" role="list">
          <button type="button" class="game-card" data-game="flyer" role="listitem">
            <span class="game-card-kicker">Live</span>
            <span class="game-card-title">Grid Defense</span>
            <span class="game-card-copy">Defend 9 campuses. Scout → Fighter → Striker. Stick + flares.</span>
            <span class="game-card-cta">Play</span>
          </button>
          <button type="button" class="game-card" data-game="pong" role="listitem">
            <span class="game-card-kicker">Live</span>
            <span class="game-card-title">Pong</span>
            <span class="game-card-copy">Classic paddle rally vs a bot. Drag or A/D · ←/→.</span>
            <span class="game-card-cta">Play</span>
          </button>
          <button type="button" class="game-card" data-game="tennis" role="listitem">
            <span class="game-card-kicker">New</span>
            <span class="game-card-title">Tennis</span>
            <span class="game-card-copy">3D court · Meshy racket/ball/net · 15-30-40.</span>
            <span class="game-card-cta">Play</span>
          </button>
          <div class="game-card soon" aria-disabled="true">
            <span class="game-card-kicker">Soon</span>
            <span class="game-card-title">Volleyball</span>
            <span class="game-card-copy">Court bots. Not in this build.</span>
            <span class="game-card-cta">Coming soon</span>
          </div>
          <div class="game-card soon" aria-disabled="true">
            <span class="game-card-kicker">Soon</span>
            <span class="game-card-title">Football</span>
            <span class="game-card-copy">Pitch bots. Not in this build.</span>
            <span class="game-card-cta">Coming soon</span>
          </div>
        </div>
        <p class="hub-footnote">Solo for now — no lobby, no multiplayer.</p>
      </div>
    </div>

    <!-- Grid Defense map -->
    <div id="map-screen" class="overlay gd-map-screen" hidden>
      <div class="gd-map-chrome">
        <div class="gd-map-brand">
          <p class="gd-eyebrow">Agent Arena — Grid Defense</p>
          <h1 class="gd-title"><span>Agent Arena</span><em>Grid defense</em></h1>
          <p class="gd-tag">Rogue drone swarms are hitting America’s compute. Fly the interceptor, protect each campus, and keep the grid online.</p>
          <div class="gd-progress">
            <span id="map-progress-label">0 of 9 secured</span>
            <div class="gd-progress-bar"><i id="map-progress-fill"></i></div>
          </div>
        </div>
        <button type="button" id="btn-back-hub-map" class="gd-back">← Games</button>
      </div>
      <div id="map-canvas-host" class="gd-map-host"></div>
      <aside id="setup-sheet" class="gd-setup">
        <p class="gd-setup-state" id="setup-state">Oregon</p>
        <h2 class="gd-setup-name" id="setup-name">Hillsboro</h2>
        <p class="gd-setup-lock" id="setup-lock" hidden></p>
        <div class="gd-setup-stats">
          <div><strong id="setup-halls">2</strong><span>Data halls</span></div>
          <div><strong id="setup-waves">3</strong><span>Waves</span></div>
          <div><strong id="setup-best">—</strong><span>Best score</span></div>
        </div>
        <div class="gd-threat">
          <span>Threat level</span>
          <div id="setup-threat" class="threat-row"></div>
        </div>
        <p class="gd-setup-label">Aircraft</p>
        <div id="plane-list" class="plane-list"></div>
        <button type="button" id="btn-launch" class="gd-launch">Launch defense</button>
        <p class="gd-setup-tip" id="setup-tip">Raider drones only. Good place to learn the controls.</p>
      </aside>
      <p class="gd-map-hint">Drag to look around. Tap a glowing region to defend it.</p>
    </div>

    <!-- Mission HUD -->
    <div id="mission-hud" class="mission-hud" hidden>
      <div class="mh-top">
        <div class="mh-left">
          <div class="mh-stat">
            <div class="mh-stat-head"><span>Hull</span><strong id="hud-hull-val">90</strong></div>
            <div class="bar"><div class="bar-fill hull" id="hud-hull-fill"></div></div>
          </div>
          <div class="mh-stat">
            <div class="mh-stat-head"><span id="hud-campus-label">Hillsboro campus</span><strong id="hud-campus-val">100%</strong></div>
            <div class="bar"><div class="bar-fill campus" id="hud-campus-fill"></div></div>
          </div>
          <div class="mh-ammo">
            <span>Missiles <b id="hud-missiles">4</b></span>
            <span>Flares <b id="hud-flares">4</b></span>
          </div>
        </div>
        <div class="mh-center">
          <div id="hud-wave" class="mh-wave">Wave 1 of 3</div>
          <div id="hud-score" class="mh-score">0</div>
        </div>
        <div class="mh-right">
          <div class="radar" aria-hidden="true">
            <div id="radar-dots"></div>
            <span id="radar-player" class="radar-player"></span>
          </div>
          <div class="mh-tools">
            <button type="button" id="btn-pause" class="icon-btn" aria-label="Pause">Pause</button>
            <button type="button" id="btn-mute-mission" class="icon-btn" aria-label="Mute">Mute</button>
          </div>
        </div>
      </div>
      <div id="wave-announce" class="wave-announce" hidden>
        <div id="wave-announce-title">Wave 1</div>
        <div id="wave-announce-sub">7 raiders inbound</div>
      </div>
      <div class="reticle" aria-hidden="true"></div>
      <div class="mh-keys">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> fly
        <span>·</span> <kbd>Space</kbd> guns
        <span>·</span> <kbd>E</kbd> missile
        <span>·</span> <kbd>Q</kbd> flares
        <span>·</span> <kbd>Esc</kbd> pause
      </div>
      <div id="touch-controls" class="touch-controls" hidden>
        <div class="touch-bottom">
          <div class="touch-stick" data-touch="stick">
            <div class="touch-stick-base"></div>
            <div class="touch-stick-knob" data-touch="knob"></div>
            <span class="touch-stick-label">Steer</span>
          </div>
          <div class="touch-actions">
            <button type="button" class="touch-btn flare" data-touch="flare">Flare</button>
            <button type="button" class="touch-btn bomb" data-touch="missile">Missile</button>
            <button type="button" class="touch-btn fire" data-touch="fire">Fire</button>
          </div>
        </div>
      </div>
    </div>

    <div id="pause-screen" class="overlay end-screen" hidden>
      <div class="end-card gd-card">
        <h2>Paused</h2>
        <p>The swarm is holding position.</p>
        <div class="end-actions">
          <button type="button" id="btn-pause-map" class="cta ghost">Back to map</button>
          <button type="button" id="btn-resume" class="cta gd-cta">Resume</button>
        </div>
      </div>
    </div>

    <div id="end-screen" class="overlay end-screen" hidden>
      <div class="end-card gd-card">
        <h2 id="end-title">Campus lost</h2>
        <p id="end-copy">Every hall went dark. Intercept raiders before they reach the roofs.</p>
        <div id="end-score" class="end-score">0</div>
        <div class="end-actions">
          <button type="button" id="btn-end-map" class="cta ghost">Back to map</button>
          <button type="button" id="btn-end-retry" class="cta gd-cta">Try again</button>
        </div>
      </div>
    </div>

    <div id="pong-hud" class="pong-hud" hidden>
      <button type="button" id="btn-back-hub-pong" class="hud-back">← Games</button>
      <div class="pong-score">
        <span>You <strong id="pong-you">0</strong></span>
        <span class="pong-msg" id="pong-msg">Rally</span>
        <span>Bot <strong id="pong-bot">0</strong></span>
      </div>
    </div>

    <div id="tennis-hud" class="tennis-hud" hidden>
      <button type="button" id="btn-back-hub-tennis" class="hud-back">← Games</button>
      <div class="tennis-score">
        <span class="tennis-side">
          <span class="tennis-name">You</span>
          <strong id="tennis-you">0</strong>
          <em class="tennis-games">G <span id="tennis-games-you">0</span></em>
          <em class="tennis-sets">S <span id="tennis-sets-you">0</span></em>
        </span>
        <span class="tennis-msg-wrap">
          <span class="tennis-msg" id="tennis-msg">Serve</span>
          <span class="tennis-meta" id="tennis-meta"></span>
        </span>
        <span class="tennis-side tennis-side-bot">
          <span class="tennis-name">Bot</span>
          <strong id="tennis-bot">0</strong>
          <em class="tennis-games">G <span id="tennis-games-bot">0</span></em>
          <em class="tennis-sets">S <span id="tennis-sets-bot">0</span></em>
        </span>
      </div>
      <div class="tennis-power" id="tennis-power" hidden>
        <div class="tennis-power-label">Power</div>
        <div class="tennis-power-track"><div class="tennis-power-fill" id="tennis-power-fill"></div></div>
        <div class="tennis-aim-meter" id="tennis-aim-meter"><span class="tennis-aim-needle" id="tennis-aim-needle"></span></div>
      </div>
      <div class="tennis-touch">
        <div class="touch-stick tennis-stick" data-tennis="stick">
          <div class="touch-stick-base"></div>
          <div class="touch-stick-knob" data-tennis="knob"></div>
          <span class="touch-stick-label">Move</span>
        </div>
        <button type="button" class="touch-btn fire tennis-swing" data-tennis="swing">
          <span class="tennis-swing-label">Swing</span>
          <span class="tennis-swing-hint">hold</span>
        </button>
      </div>
    </div>

    <div id="asset-note" class="asset-note" hidden></div>
  </div>
`;

getAudio();

let flyerApp = null;
let pongGame = null;
let tennisGame = null;

function hideAll() {
  for (const id of ['hub-screen', 'map-screen', 'mission-hud', 'pause-screen', 'end-screen', 'pong-hud', 'tennis-hud', 'game-root', 'pong-root', 'tennis-root']) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  flyerApp?.dispose?.();
  flyerApp = null;
  pongGame?.dispose?.();
  pongGame = null;
  tennisGame?.dispose?.();
  tennisGame = null;
  document.getElementById('game-root').innerHTML = '';
  document.getElementById('pong-root').innerHTML = '';
  document.getElementById('tennis-root').innerHTML = '';
}

function showHub() {
  hideAll();
  document.getElementById('hub-screen').hidden = false;
}

function startFlyer() {
  hideAll();
  flyerApp = new FlyerApp(document.querySelector('.shell'), { onExitToHub: showHub });
  flyerApp.start();
}

function startPong() {
  hideAll();
  const root = document.getElementById('pong-root');
  root.hidden = false;
  document.getElementById('pong-hud').hidden = false;
  pongGame = new PongGame(root, (hud) => {
    document.getElementById('pong-you').textContent = String(hud.scoreYou);
    document.getElementById('pong-bot').textContent = String(hud.scoreBot);
    document.getElementById('pong-msg').textContent = hud.message;
  });
  document.getElementById('btn-back-hub-pong').onclick = showHub;
}

async function startTennis() {
  hideAll();
  const root = document.getElementById('tennis-root');
  root.hidden = false;
  const hud = document.getElementById('tennis-hud');
  hud.hidden = false;
  tennisGame = await TennisGame.create(root, (state) => {
    document.getElementById('tennis-you').textContent = String(state.scoreYou ?? '0');
    document.getElementById('tennis-bot').textContent = String(state.scoreBot ?? '0');
    document.getElementById('tennis-games-you').textContent = String(state.gamesYou ?? 0);
    document.getElementById('tennis-games-bot').textContent = String(state.gamesBot ?? 0);
    document.getElementById('tennis-sets-you').textContent = String(state.setsYou ?? 0);
    document.getElementById('tennis-sets-bot').textContent = String(state.setsBot ?? 0);
    document.getElementById('tennis-msg').textContent = state.message ?? '';
    document.getElementById('tennis-meta').textContent = state.meta ?? '';
    const power = document.getElementById('tennis-power');
    if (state.charging) {
      power.hidden = false;
      const fill = document.getElementById('tennis-power-fill');
      fill.style.width = `${Math.round((state.power ?? 0) * 100)}%`;
      fill.classList.toggle('maxed', (state.power ?? 0) >= 0.98);
      document.getElementById('tennis-aim-needle').style.transform = `translateX(${(state.aim ?? 0) * 40}px)`;
    } else {
      power.hidden = true;
    }
  });
  tennisGame.bindControls?.(hud);
  document.getElementById('btn-back-hub-tennis').onclick = showHub;
}

document.querySelectorAll('.game-card[data-game]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const g = btn.dataset.game;
    if (g === 'flyer') startFlyer();
    else if (g === 'pong') startPong();
    else if (g === 'tennis') startTennis();
  });
});

showHub();
