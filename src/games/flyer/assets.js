import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODEL_ORIENT } from './config.js';

const loader = new GLTFLoader();

export function basenameFromUrl(url) {
  return (url.split('?')[0] ?? url).split('/').pop() ?? url;
}

export async function loadFirstGlb(paths) {
  for (const path of paths) {
    try {
      const gltf = await loader.loadAsync(path);
      const root = gltf.scene;
      root.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            if (mat?.map) mat.map.colorSpace = THREE.SRGBColorSpace;
            if (mat && 'metalness' in mat) mat.envMapIntensity = 0.35;
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

export function applyOrient(root, url) {
  const name = basenameFromUrl(url);
  const o = MODEL_ORIENT[name];
  if (o) root.rotation.set(o.x, o.y, o.z);
  return root;
}

export function fitObject(root, targetSize) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  root.scale.multiplyScalar(scale);
  box.setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(center);
  return root;
}

export function makeProceduralPlane() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.35, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2332, metalness: 0.6, roughness: 0.35 }),
  );
  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 0.12, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x243044, metalness: 0.5, roughness: 0.4 }),
  );
  wing.position.y = 0.05;
  const cockpit = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.35, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x003344, metalness: 0.2, roughness: 0.2 }),
  );
  cockpit.position.set(0, 0.28, 0.4);
  g.add(body, wing, cockpit);
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

export function makeProceduralHall() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a3140,
    metalness: 0.45,
    roughness: 0.55,
    emissive: 0x003848,
    emissiveIntensity: 0.35,
  });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 10), mat);
  hall.position.y = 3;
  hall.castShadow = true;
  hall.receiveShadow = true;
  // cyan dashed "rack" lines
  for (let i = 0; i < 6; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x00d2ff, emissiveIntensity: 1.2 }),
    );
    line.position.set(0, 1.2 + i * 0.85, 5.05);
    g.add(line);
  }
  g.add(hall);
  return g;
}

export function makeProceduralTower() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a4558, metalness: 0.4, roughness: 0.5 }),
  );
  pole.position.y = 5;
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 1.4, 10),
    new THREE.MeshStandardMaterial({ color: 0x1e90ff, emissive: 0x003366, metalness: 0.3, roughness: 0.4 }),
  );
  top.position.y = 10.2;
  g.add(pole, top);
  return g;
}

export async function loadPlaneMesh(plane) {
  const loaded = await loadFirstGlb(plane.meshyPaths);
  if (loaded) {
    applyOrient(loaded.root, loaded.url);
    fitObject(loaded.root, plane.fitSize);
    return { mesh: loaded.root, url: loaded.url, meshy: true };
  }
  return { mesh: makeProceduralPlane(), url: null, meshy: false };
}

export async function loadCampusProps(region) {
  const hallLoaded = await loadFirstGlb(region.datacenterPaths);
  const towerLoaded = await loadFirstGlb(region.watchtowerPaths);

  let hall;
  let hallUrl = null;
  if (hallLoaded) {
    applyOrient(hallLoaded.root, hallLoaded.url);
    fitObject(hallLoaded.root, 22);
    hall = hallLoaded.root;
    hallUrl = hallLoaded.url;
  } else {
    hall = makeProceduralHall();
  }

  let tower;
  let towerUrl = null;
  if (towerLoaded) {
    applyOrient(towerLoaded.root, towerLoaded.url);
    fitObject(towerLoaded.root, 12);
    tower = towerLoaded.root;
    towerUrl = towerLoaded.url;
  } else {
    tower = makeProceduralTower();
  }

  return { hall, tower, hallUrl, towerUrl };
}
