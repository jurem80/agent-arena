/**
 * Meshy / GLB load helpers used by Tennis (and Flyer asset loading patterns).
 * From production `Wi`, `Ar`, `ha`, `Sh`, `Lx`, `Ix`, `Dx`, `Nx`, `Vi`, `ca`.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Per-file orientation fixes applied after load (filename → Euler XYZ). */
export const TENNIS_MODEL_ORIENT = {
  'tennis-racket.glb': { x: 0, y: 0, z: 0 },
  'tennis-ball.glb': { x: 0, y: 0, z: 0 },
  'tennis-net.glb': { x: 0, y: 0, z: 0 },
  'tennis-net-wide.glb': { x: 0, y: 0, z: 0 },
  'tennis-court-props.glb': { x: 0, y: Math.PI / 2, z: 0 },
  'tennis-player.glb': { x: 0, y: Math.PI, z: 0 },
  'tennis-opponent.glb': { x: 0, y: Math.PI, z: 0 },
  'tennis-player-you.glb': { x: 0, y: Math.PI, z: 0 },
  'tennis-player-bot.glb': { x: 0, y: Math.PI, z: 0 },
};

/** Fallback path lists under `/models/tennis/...`. */
export const TENNIS_MESH_PATHS = {
  racket: ['/models/tennis/tennis-racket.glb'],
  ball: ['/models/tennis/tennis-ball.glb'],
  net: ['/models/tennis/tennis-net-wide.glb', '/models/tennis/tennis-net.glb'],
  chair: ['/models/tennis/tennis-court-props.glb'],
  player: ['/models/tennis/tennis-player.glb', '/models/tennis/tennis-player-you.glb'],
  opponent: [
    '/models/tennis/tennis-opponent.glb',
    '/models/tennis/tennis-player-bot.glb',
    '/models/tennis/tennis-player.glb',
  ],
};

export function basenameFromUrl(url) {
  return (url.split('?')[0] ?? url).split('/').pop() ?? url;
}

/**
 * Try each path until one GLB loads; enable shadows and fix map color space.
 * @param {GLTFLoader} loader
 * @param {string[]} paths
 * @returns {Promise<{ root: THREE.Object3D, url: string } | null>}
 */
export async function loadFirstGlb(loader, paths) {
  for (const path of paths) {
    try {
      const gltf = await loader.loadAsync(path);
      const root = gltf.scene;
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const mat of mats) {
              if ('map' in mat && mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        }
      });
      return { root, url: path };
    } catch {
      /* try next fallback */
    }
  }
  return null;
}

/**
 * Same as loadFirstGlb but also tweaks metalness env intensity (Flyer-style `Ar`).
 */
export async function loadFirstGlbRich(loader, paths) {
  for (const path of paths) {
    try {
      const gltf = await loader.loadAsync(path);
      const root = gltf.scene;
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const mat of mats) {
              if ('map' in mat && mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
              if ('normalMap' in mat && mat.normalMap) {
                // Production used empty-string color space (THREE.NoColorSpace).
                mat.normalMap.colorSpace = THREE.NoColorSpace ?? '';
              }
              if ('metalness' in mat) mat.envMapIntensity = 1.1;
            }
          }
        }
      });
      return { root, url: path };
    } catch {
      /* try next */
    }
  }
  return null;
}

function orientFor(url) {
  const name = basenameFromUrl(url);
  return TENNIS_MODEL_ORIENT[name] ?? { x: 0, y: 0, z: 0 };
}

/**
 * Wrap a cloned Meshy scene, apply orientation, uniform-scale to `targetSize`, ground/center.
 * @param {THREE.Object3D} source
 * @param {string} url
 * @param {number} targetSize
 * @param {{ ground?: boolean, centerY?: boolean }} [opts]
 */
export function wrapScaledModel(source, url, targetSize, opts) {
  const rot = orientFor(url);
  const wrap = new THREE.Group();
  wrap.name = `tennis:${basenameFromUrl(url)}`;
  const clone = source.clone(true);
  clone.rotation.set(rot.x, rot.y, rot.z);
  wrap.add(clone);

  const box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  wrap.scale.setScalar(targetSize / maxDim);

  box.setFromObject(wrap);
  wrap.position.x -= (box.min.x + box.max.x) / 2;
  wrap.position.z -= (box.min.z + box.max.z) / 2;
  if (opts?.ground !== false) {
    wrap.position.y -= box.min.y;
  } else if (opts?.centerY) {
    wrap.position.y -= (box.min.y + box.max.y) / 2;
  }
  return wrap;
}

/** Racket-specific wrap (name + scale). */
export function wrapRacket(source, url, targetSize = 0.72) {
  const rot = orientFor(url);
  const wrap = new THREE.Group();
  wrap.name = 'tennis:racket';
  const clone = source.clone(true);
  clone.rotation.set(rot.x, rot.y, rot.z);
  wrap.add(clone);

  let box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  wrap.scale.setScalar(targetSize / maxDim);
  box.setFromObject(wrap);
  wrap.position.x -= (box.min.x + box.max.x) / 2;
  wrap.position.z -= (box.min.z + box.max.z) / 2;
  wrap.position.y -= box.min.y;
  return wrap;
}

/** Net wrap: scale width/height independently; auto-yaw if model is Z-long. */
export function wrapNet(source, url, width, height) {
  const rot = orientFor(url);
  const wrap = new THREE.Group();
  wrap.name = 'tennis:net';
  const clone = source.clone(true);
  clone.rotation.set(rot.x, rot.y, rot.z);
  wrap.add(clone);

  let box = new THREE.Box3().setFromObject(wrap);
  let size = new THREE.Vector3();
  box.getSize(size);
  if (size.z > size.x * 1.15) {
    clone.rotation.y += Math.PI / 2;
    box = new THREE.Box3().setFromObject(wrap);
    box.getSize(size);
  }
  const sx = width / Math.max(0.01, size.x);
  const sy = height / Math.max(0.01, size.y);
  wrap.scale.set(sx, sy, sx);
  box.setFromObject(wrap);
  wrap.position.x -= (box.min.x + box.max.x) / 2;
  wrap.position.z -= (box.min.z + box.max.z) / 2;
  wrap.position.y -= box.min.y;
  return wrap;
}

/** Player/opponent wrap scaled by height. */
export function wrapPlayer(source, url, targetHeight = 1.78) {
  const name = basenameFromUrl(url);
  const rot = TENNIS_MODEL_ORIENT[name] ?? { x: 0, y: Math.PI, z: 0 };
  const wrap = new THREE.Group();
  wrap.name = `tennis:player:${name}`;
  const clone = source.clone(true);
  clone.rotation.set(rot.x, rot.y, rot.z);
  wrap.add(clone);

  let box = new THREE.Box3().setFromObject(wrap);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = size.y || 1;
  wrap.scale.setScalar(targetHeight / h);
  box.setFromObject(wrap);
  wrap.position.x -= (box.min.x + box.max.x) / 2;
  wrap.position.z -= (box.min.z + box.max.z) / 2;
  wrap.position.y -= box.min.y;
  return wrap;
}

/**
 * Load all tennis Meshy assets with fallback paths.
 * @returns {Promise<TennisAssets>}
 */
export async function loadTennisAssets() {
  const loader = new GLTFLoader();
  const [racket, ball, net, chair, player, opponent] = await Promise.all([
    loadFirstGlb(loader, TENNIS_MESH_PATHS.racket),
    loadFirstGlb(loader, TENNIS_MESH_PATHS.ball),
    loadFirstGlb(loader, TENNIS_MESH_PATHS.net),
    loadFirstGlb(loader, TENNIS_MESH_PATHS.chair),
    loadFirstGlb(loader, TENNIS_MESH_PATHS.player),
    loadFirstGlb(loader, TENNIS_MESH_PATHS.opponent),
  ]);

  return {
    racket: racket?.root ?? null,
    ball: ball?.root ?? null,
    net: net?.root ?? null,
    chair: chair?.root ?? null,
    player: player?.root ?? null,
    opponent: opponent?.root ?? null,
    source: {
      racket: racket ? 'meshy' : 'missing',
      ball: ball ? 'meshy' : 'missing',
      net: net ? 'meshy' : 'missing',
      chair: chair ? 'meshy' : 'missing',
      player: player ? 'meshy' : 'missing',
      opponent: opponent ? 'meshy' : 'missing',
    },
    urls: {
      racket: racket?.url,
      ball: ball?.url,
      net: net?.url,
      chair: chair?.url,
      player: player?.url,
      opponent: opponent?.url,
    },
  };
}

/** Human-readable list of which tennis slots used Meshy. */
export function meshySourceSummary(assets) {
  return Object.keys(assets.source)
    .filter((k) => assets.source[k] === 'meshy')
    .join('+');
}
