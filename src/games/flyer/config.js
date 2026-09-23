/** Grid Defense — region + plane configs */

export const PLANES = {
  scout: {
    id: 'scout',
    name: 'Scout',
    shortName: 'Scout',
    label: 'Scout (Nimble)',
    blurb: 'Light high-wing trainer — quiet approach, thin skin.',
    unlockAt: 0,
    maxHp: 90,
    maxMissiles: 4,
    maxFlares: 4,
    speed: 36,
    gunDamage: 12,
    gunCooldown: 0.09,
    missileDamage: 48,
    meshyPaths: ['/models/plane.glb'],
    fitSize: 9,
  },
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    shortName: 'Fighter',
    label: 'Fighter (Secure 3)',
    blurb: 'Mid-tier interceptor — faster guns, more missiles.',
    unlockAt: 3,
    maxHp: 110,
    maxMissiles: 6,
    maxFlares: 5,
    speed: 44,
    gunDamage: 15,
    gunCooldown: 0.07,
    missileDamage: 60,
    meshyPaths: ['/models/plane-upgrade-1.glb', '/models/plane.glb'],
    fitSize: 10,
  },
  striker: {
    id: 'striker',
    name: 'Striker',
    shortName: 'Striker',
    label: 'Striker (Secure 6)',
    blurb: 'Heavy attack bird — thick hull, deep missile bay.',
    unlockAt: 6,
    maxHp: 140,
    maxMissiles: 8,
    maxFlares: 6,
    speed: 40,
    gunDamage: 18,
    gunCooldown: 0.06,
    missileDamage: 78,
    meshyPaths: ['/models/plane-upgrade-2.glb', '/models/plane.glb'],
    fitSize: 12,
  },
};

/**
 * 9 regions in display order. Map positions are % of US outline box.
 * Locked regions require previous region secured (chain) OR explicit prerequisite.
 */
export const REGIONS = [
  {
    id: 'hillsboro',
    name: 'Hillsboro',
    state: 'Oregon',
    blurb: 'Raider drones only. Good place to learn the controls.',
    x: 8,
    y: 28,
    halls: 2,
    waves: 3,
    threat: 1,
    unlocksAfter: null,
    tip: 'Raider drones only. Good place to learn the controls.',
    // threat dashes: 1 of 5 for tutorial campus
    datacenterPaths: ['/models/datacenter.glb'],
    watchtowerPaths: ['/models/watchtower.glb'],
    raidersPerWave: [7, 9, 11],
  },
  {
    id: 'santa-clara',
    name: 'Santa Clara',
    state: 'California',
    blurb: 'Bay campus under pressure. Mix of raiders and dive bots.',
    x: 6,
    y: 48,
    halls: 2,
    waves: 3,
    threat: 2,
    unlocksAfter: 'hillsboro',
    tip: 'Secure Hillsboro first.',
    datacenterPaths: ['/models/datacenter.glb'],
    watchtowerPaths: ['/models/watchtower.glb'],
    raidersPerWave: [8, 10, 12],
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    state: 'Arizona',
    blurb: 'Desert node. Open sightlines, hot inbound tracks.',
    x: 18,
    y: 58,
    halls: 2,
    waves: 3,
    threat: 2,
    unlocksAfter: 'santa-clara',
    tip: 'Secure Santa Clara first.',
    datacenterPaths: ['/models/datacenter-medium.glb', '/models/datacenter.glb'],
    watchtowerPaths: ['/models/watchtower.glb'],
    raidersPerWave: [9, 11, 13],
  },
  {
    id: 'dallas',
    name: 'Dallas',
    state: 'Texas',
    blurb: 'Central grid hub. Raiders come in staggered forks.',
    x: 42,
    y: 62,
    halls: 3,
    waves: 4,
    threat: 3,
    unlocksAfter: 'phoenix',
    tip: 'Secure Phoenix first.',
    datacenterPaths: ['/models/datacenter-medium.glb', '/models/datacenter.glb'],
    watchtowerPaths: ['/models/watchtower-heavy.glb', '/models/watchtower.glb'],
    raidersPerWave: [10, 12, 14, 16],
  },
  {
    id: 'council-bluffs',
    name: 'Council Bluffs',
    state: 'Iowa',
    blurb: 'Midwest campus. Watch the river approach lanes.',
    x: 48,
    y: 38,
    halls: 2,
    waves: 3,
    threat: 3,
    unlocksAfter: 'dallas',
    tip: 'Secure Dallas first.',
    datacenterPaths: ['/models/datacenter.glb'],
    watchtowerPaths: ['/models/watchtower.glb'],
    raidersPerWave: [10, 13, 15],
  },
  {
    id: 'chicago',
    name: 'Chicago',
    state: 'Illinois',
    blurb: 'Dense approach corridors. Keep halls lit.',
    x: 58,
    y: 32,
    halls: 3,
    waves: 4,
    threat: 3,
    unlocksAfter: 'council-bluffs',
    tip: 'Secure Council Bluffs first.',
    datacenterPaths: ['/models/datacenter-medium.glb', '/models/datacenter.glb'],
    watchtowerPaths: ['/models/watchtower-heavy.glb', '/models/watchtower.glb'],
    raidersPerWave: [11, 13, 15, 17],
  },
  {
    id: 'columbus',
    name: 'Columbus',
    state: 'Ohio',
    blurb: 'East-central node. Intercept early — halls sit exposed.',
    x: 68,
    y: 38,
    halls: 2,
    waves: 3,
    threat: 4,
    unlocksAfter: 'chicago',
    tip: 'Secure Chicago first.',
    datacenterPaths: ['/models/datacenter.glb'],
    watchtowerPaths: ['/models/watchtower.glb'],
    raidersPerWave: [12, 14, 16],
  },
  {
    id: 'atlanta',
    name: 'Atlanta',
    state: 'Georgia',
    blurb: 'Southern grid. Raider swarms stack hard on wave three.',
    x: 70,
    y: 58,
    halls: 3,
    waves: 4,
    threat: 4,
    unlocksAfter: 'columbus',
    tip: 'Secure Columbus first.',
    datacenterPaths: ['/models/datacenter-large.glb', '/models/datacenter-medium.glb'],
    watchtowerPaths: ['/models/watchtower-heavy.glb', '/models/watchtower.glb'],
    raidersPerWave: [12, 15, 18, 20],
  },
  {
    id: 'ashburn',
    name: 'Ashburn',
    state: 'Virginia',
    blurb: 'East coast megacampus. Final grid link — hold the roofs.',
    x: 82,
    y: 40,
    halls: 3,
    waves: 5,
    threat: 5,
    unlocksAfter: 'atlanta',
    tip: 'Secure Atlanta first.',
    datacenterPaths: ['/models/datacenter-large.glb', '/models/datacenter-medium.glb'],
    watchtowerPaths: ['/models/watchtower-heavy.glb', '/models/watchtower.glb'],
    raidersPerWave: [14, 16, 18, 20, 22],
  },
];

export const MODEL_ORIENT = {
  'datacenter.glb': { x: 0, y: Math.PI, z: 0 },
  'datacenter-medium.glb': { x: 0, y: Math.PI, z: 0 },
  'datacenter-large.glb': { x: 0, y: Math.PI, z: 0 },
  'watchtower.glb': { x: 0, y: 0, z: 0 },
  'watchtower-heavy.glb': { x: 0, y: 0, z: 0 },
  'plane.glb': { x: 0, y: Math.PI * 1.5, z: 0 },
  'plane-upgrade-1.glb': { x: 0, y: Math.PI * 1.5, z: 0 },
  'plane-upgrade-2.glb': { x: 0, y: Math.PI * 1.5, z: 0 },
};

const STORAGE_KEY = 'agent-arena-grid-defense-v1';

export function defaultProgress() {
  return {
    secured: [],
    selectedRegion: 'hillsboro',
    selectedPlane: 'scout',
    bestScores: {},
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return { ...defaultProgress(), ...parsed, secured: parsed.secured || [] };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function securedCount(state) {
  return state.secured.length;
}

export function isRegionUnlocked(state, regionId) {
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return false;
  if (!region.unlocksAfter) return true;
  return state.secured.includes(region.unlocksAfter);
}

export function isPlaneUnlocked(state, planeId) {
  const plane = PLANES[planeId];
  if (!plane) return false;
  return securedCount(state) >= plane.unlockAt;
}

export function lockHint(state, region) {
  if (isRegionUnlocked(state, region.id)) return null;
  const prev = REGIONS.find((r) => r.id === region.unlocksAfter);
  return prev ? `Secure ${prev.name} first.` : 'Locked.';
}

export function markSecured(state, regionId, score) {
  const next = {
    ...state,
    secured: state.secured.includes(regionId) ? state.secured : [...state.secured, regionId],
    bestScores: { ...state.bestScores },
  };
  const prevBest = next.bestScores[regionId];
  if (prevBest == null || score > prevBest) next.bestScores[regionId] = score;
  saveProgress(next);
  return next;
}
