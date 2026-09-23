import {
  PLANES,
  REGIONS,
  loadProgress,
  saveProgress,
  securedCount,
  isRegionUnlocked,
  isPlaneUnlocked,
  lockHint,
  markSecured,
} from './config.js';
import { createMapView } from './map.js';
import { MissionGame } from './mission.js';
import { getAudio } from '../shared/audio.js';

function $(sel, root = document) {
  return root.querySelector(sel);
}

/**
 * Flyer / Grid Defense controller — map → setup → mission loop.
 */
export class FlyerApp {
  /**
   * @param {HTMLElement} shell
   * @param {{ onExitToHub: () => void }} hooks
   */
  constructor(shell, hooks) {
    this.shell = shell;
    this.hooks = hooks;
    this.progress = loadProgress();
    this.mapView = null;
    this.mission = null;
    this.selectedRegionId = this.progress.selectedRegion || 'hillsboro';
    this.selectedPlaneId = this.progress.selectedPlane || 'scout';
    if (!isRegionUnlocked(this.progress, this.selectedRegionId)) this.selectedRegionId = 'hillsboro';
    if (!isPlaneUnlocked(this.progress, this.selectedPlaneId)) this.selectedPlaneId = 'scout';
  }

  start() {
    this.#showMap();
  }

  #region() {
    return REGIONS.find((r) => r.id === this.selectedRegionId) || REGIONS[0];
  }

  #plane() {
    return PLANES[this.selectedPlaneId] || PLANES.scout;
  }

  #showMap() {
    this.#teardownMission();
    const mapScreen = $('#map-screen');
    const missionHud = $('#mission-hud');
    const pauseScreen = $('#pause-screen');
    const endScreen = $('#end-screen');
    const gameRoot = $('#game-root');
    mapScreen.hidden = false;
    missionHud.hidden = true;
    pauseScreen.hidden = true;
    endScreen.hidden = true;
    gameRoot.hidden = true;
    gameRoot.innerHTML = '';

    const n = securedCount(this.progress);
    $('#map-progress-label').textContent = `${n} of 9 secured`;
    $('#map-progress-fill').style.width = `${(n / 9) * 100}%`;

    const mapHost = $('#map-canvas-host');
    mapHost.innerHTML = '';
    this.mapView?.dispose?.();
    this.mapView = createMapView(mapHost, {
      regions: REGIONS,
      progress: this.progress,
      selectedId: this.selectedRegionId,
      isUnlocked: (id) => isRegionUnlocked(this.progress, id),
      onSelect: (id) => this.#selectRegion(id),
    });

    this.#renderSetupSheet();
    this.#wireMapButtons();
  }

  #wireMapButtons() {
    $('#btn-back-hub-map').onclick = () => this.hooks.onExitToHub();
    $('#btn-launch').onclick = () => this.#launch();

    const planeList = $('#plane-list');
    planeList.onclick = (e) => {
      const btn = e.target.closest('[data-plane]');
      if (!btn) return;
      const id = btn.dataset.plane;
      if (!isPlaneUnlocked(this.progress, id)) return;
      this.selectedPlaneId = id;
      this.progress.selectedPlane = id;
      saveProgress(this.progress);
      this.#renderSetupSheet();
    };
  }

  #selectRegion(id) {
    const region = REGIONS.find((r) => r.id === id);
    if (!region) return;
    if (!isRegionUnlocked(this.progress, id)) {
      $('#setup-lock').textContent = lockHint(this.progress, region);
      $('#setup-lock').hidden = false;
      this.mapView?.refresh({ selectedId: this.selectedRegionId, progress: this.progress });
      return;
    }
    this.selectedRegionId = id;
    this.progress.selectedRegion = id;
    saveProgress(this.progress);
    this.mapView?.refresh({ selectedId: id, progress: this.progress });
    this.#renderSetupSheet();
  }

  #renderSetupSheet() {
    const region = this.#region();
    const unlocked = isRegionUnlocked(this.progress, region.id);
    $('#setup-state').textContent = region.state;
    $('#setup-name').textContent = region.name;
    $('#setup-halls').textContent = String(region.halls);
    $('#setup-waves').textContent = String(region.waves);
    const best = this.progress.bestScores?.[region.id];
    $('#setup-best').textContent = best != null ? String(best) : '—';
    const threat = $('#setup-threat');
    threat.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const dash = document.createElement('span');
      dash.className = `threat-dash${i < region.threat ? ' on' : ''}`;
      threat.appendChild(dash);
    }
    $('#setup-tip').textContent = region.tip || region.blurb;
    const lock = $('#setup-lock');
    if (!unlocked) {
      lock.hidden = false;
      lock.textContent = lockHint(this.progress, region);
    } else {
      lock.hidden = true;
    }

    const planeList = $('#plane-list');
    planeList.innerHTML = '';
    for (const plane of Object.values(PLANES)) {
      const open = isPlaneUnlocked(this.progress, plane.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.plane = plane.id;
      btn.className = `plane-chip${this.selectedPlaneId === plane.id ? ' active' : ''}${open ? '' : ' locked'}`;
      btn.textContent = open ? plane.label : plane.label;
      btn.disabled = !open;
      planeList.appendChild(btn);
    }

    $('#btn-launch').disabled = !unlocked;
  }

  #launch() {
    const region = this.#region();
    if (!isRegionUnlocked(this.progress, region.id)) return;
    const plane = this.#plane();
    $('#map-screen').hidden = true;
    $('#end-screen').hidden = true;
    $('#pause-screen').hidden = true;
    const gameRoot = $('#game-root');
    gameRoot.hidden = false;
    gameRoot.innerHTML = '';
    const hud = $('#mission-hud');
    hud.hidden = false;

    this.mission = new MissionGame(
      gameRoot,
      { region, plane },
      (state) => this.#onMissionHud(state),
      (result) => this.#onMissionEnd(result),
    );
    this.mission.bindHud(hud);

    $('#btn-pause').onclick = () => this.#setPause(true);
    $('#btn-mute-mission').onclick = () => {
      const a = getAudio();
      a.setMuted(!a.isMuted);
      $('#btn-mute-mission').classList.toggle('muted', a.isMuted);
      $('#btn-mute-mission').textContent = a.isMuted ? 'Muted' : '♪';
    };
    $('#btn-resume').onclick = () => this.#setPause(false);
    $('#btn-pause-map').onclick = () => {
      this.#setPause(false);
      this.#showMap();
    };
  }

  #setPause(v) {
    if (!this.mission) return;
    this.mission.setPaused(v);
    $('#pause-screen').hidden = !v;
  }

  #onMissionHud(state) {
    if (state.pauseRequest) {
      $('#pause-screen').hidden = false;
    }
    $('#hud-hull-val').textContent = String(state.hull);
    $('#hud-hull-fill').style.width = `${(state.hull / state.maxHull) * 100}%`;
    $('#hud-campus-label').textContent = `${state.regionName} campus`;
    $('#hud-campus-val').textContent = `${state.campus}%`;
    $('#hud-campus-fill').style.width = `${state.campus}%`;
    $('#hud-missiles').textContent = String(state.missiles);
    $('#hud-flares').textContent = String(state.flares);
    $('#hud-wave').textContent = `Wave ${state.wave} of ${state.wavesTotal}`;
    $('#hud-score').textContent = String(state.score);

    const ann = $('#wave-announce');
    if (state.announce) {
      ann.hidden = false;
      $('#wave-announce-title').textContent = state.announce.title;
      $('#wave-announce-sub').textContent = state.announce.sub;
    } else {
      ann.hidden = true;
    }

    // radar
    const radar = $('#radar-dots');
    radar.innerHTML = '';
    for (const r of state.raiders || []) {
      const dx = Math.max(-1, Math.min(1, r.x / 80));
      const dz = Math.max(-1, Math.min(1, r.z / 80));
      const dot = document.createElement('span');
      dot.className = 'radar-dot enemy';
      dot.style.left = `${50 + dx * 42}%`;
      dot.style.top = `${50 + dz * 42}%`;
      radar.appendChild(dot);
    }
    const player = $('#radar-player');
    if (player) player.style.transform = `translate(-50%,-50%) rotate(${(-state.playerYaw * 180) / Math.PI}deg)`;

    const note = $('#asset-note');
    if (state.assetNote) {
      note.hidden = false;
      note.textContent = state.assetNote;
    }
  }

  #onMissionEnd(result) {
    $('#pause-screen').hidden = true;
    const end = $('#end-screen');
    end.hidden = false;
    if (result.won) {
      this.progress = markSecured(this.progress, this.selectedRegionId, result.score);
      $('#end-title').textContent = 'Campus secured';
      $('#end-copy').textContent = result.reason || 'The swarm is offline. Grid link holds.';
    } else {
      $('#end-title').textContent = 'Campus lost';
      $('#end-copy').textContent = result.reason || 'Every hall went dark. Intercept raiders before they reach the roofs.';
    }
    $('#end-score').textContent = String(result.score);
    $('#btn-end-map').onclick = () => this.#showMap();
    $('#btn-end-retry').onclick = () => {
      end.hidden = true;
      this.#launch();
    };
  }

  #teardownMission() {
    this.mission?.dispose?.();
    this.mission = null;
  }

  dispose() {
    this.#teardownMission();
    this.mapView?.dispose?.();
  }
}
