import * as THREE from 'three';
import { R, world, elev, biome, angDist } from './world.js';
import { toon } from './shaders.js';
import { part, merge, basisAt, randDir, tangentFrame } from './geo.js';
import { addInstanced, addInstancedChunked } from './mk.js';

const _m = new THREE.Matrix4();
const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);

function treeGeos() {
  const leaf = 0x5cbf4a;
  const decid = merge([
    part(new THREE.CylinderGeometry(0.06, 0.09, 0.42, 6), 0x8b5a3c, { t: [0, 0.21, 0] }),
    part(sph(0.31, 8, 6), leaf, { tint: 1, t: [0, 0.6, 0] }),
    part(sph(0.22, 7, 5), leaf, { tint: 1, t: [0.15, 0.76, 0.05] }),
    part(sph(0.2, 7, 5), leaf, { tint: 1, t: [-0.13, 0.74, -0.08] }),
  ]);
  const pineC = 0x2f8f5b;
  const pine = merge([
    part(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), 0x7a4e33, { t: [0, 0.11, 0] }),
    part(new THREE.ConeGeometry(0.3, 0.38, 9), pineC, { tint: 1, t: [0, 0.36, 0] }),
    part(new THREE.ConeGeometry(0.235, 0.32, 9), pineC, { tint: 1, t: [0, 0.56, 0] }),
    part(new THREE.ConeGeometry(0.16, 0.28, 9), pineC, { tint: 1, t: [0, 0.76, 0] }),
  ]);
  const palmP = [];
  let x = 0, y = 0;
  for (let k = 0; k < 6; k++) {
    const g = new THREE.CylinderGeometry(0.045 - k * 0.003, 0.055 - k * 0.003, 0.15, 6).rotateZ(-0.05 - k * 0.04).translate(x, y + 0.075, 0);
    palmP.push(part(g, k % 2 ? 0xc08a55 : 0xa8743f));
    x += 0.006 + k * 0.006; y += 0.145;
  }
  for (let k = 0; k < 7; k++) {
    const g = new THREE.ConeGeometry(0.075, 0.46, 4).scale(1, 1, 0.3).translate(0, 0.23, 0).rotateZ(-(Math.PI / 2 + 0.35)).rotateY((k / 7) * Math.PI * 2).translate(x, y, 0);
    palmP.push(part(g, 0x3fbf5f, { tint: 1 }));
  }
  palmP.push(part(sph(0.05, 6, 5), 0x7a4e33, { t: [x, y - 0.02, 0.03] }));
  const palm = merge(palmP);
  const cactus = merge([
    part(new THREE.CylinderGeometry(0.085, 0.09, 0.62, 8), 0x4caf50, { tint: 1, t: [0, 0.31, 0] }),
    part(sph(0.085, 8, 6), 0x4caf50, { tint: 1, t: [0, 0.62, 0] }),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 7).rotateZ(Math.PI / 2), 0x4caf50, { tint: 1, t: [0.14, 0.3, 0] }),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 7), 0x4caf50, { tint: 1, t: [0.21, 0.4, 0] }),
    part(sph(0.05, 7, 5), 0x4caf50, { tint: 1, t: [0.21, 0.5, 0] }),
    part(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 7).rotateZ(Math.PI / 2), 0x4caf50, { tint: 1, t: [-0.12, 0.42, 0] }),
    part(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 7), 0x4caf50, { tint: 1, t: [-0.17, 0.48, 0] }),
    part(sph(0.045, 7, 5), 0x4caf50, { tint: 1, t: [-0.17, 0.55, 0] }),
    part(sph(0.045, 6, 4), 0xff7eb6, { t: [0, 0.7, 0] }),
  ]);
  const rock = merge([part(new THREE.IcosahedronGeometry(0.3, 0), 0xa29cb0, { tint: 1, s: [1, 0.6, 0.85], t: [0, 0.1, 0] })]);
  return { decid, pine, palm, cactus, rock };
}

function animalGeos() {
  const cow = merge([
    part(new THREE.BoxGeometry(0.5, 0.32, 0.8), 0xffffff, { t: [0, 0.42, 0] }),
    part(new THREE.BoxGeometry(0.52, 0.18, 0.22), 0x222233, { t: [0, 0.5, 0.12] }),
    part(new THREE.BoxGeometry(0.3, 0.2, 0.18), 0x222233, { t: [0.12, 0.4, -0.22] }),
    part(new THREE.BoxGeometry(0.3, 0.28, 0.3), 0xffffff, { t: [0, 0.6, 0.5] }),
    part(new THREE.BoxGeometry(0.24, 0.12, 0.08), 0xff9eb5, { t: [0, 0.52, 0.66] }),
    part(new THREE.BoxGeometry(0.06, 0.08, 0.04), 0xf2e3c6, { t: [0.12, 0.78, 0.48] }),
    part(new THREE.BoxGeometry(0.06, 0.08, 0.04), 0xf2e3c6, { t: [-0.12, 0.78, 0.48] }),
    ...[[0.17, 0.27], [-0.17, 0.27], [0.17, -0.27], [-0.17, -0.27]].map(([a, b]) => part(new THREE.BoxGeometry(0.1, 0.28, 0.1), 0x333344, { t: [a, 0.14, b] })),
  ]);
  const sheep = merge([
    part(new THREE.IcosahedronGeometry(0.34, 1), 0xfbfbf5, { s: [1, 0.85, 1.2], t: [0, 0.42, 0] }),
    part(new THREE.BoxGeometry(0.2, 0.22, 0.22), 0x2b2b3a, { t: [0, 0.5, 0.42] }),
    ...[[0.14, 0.2], [-0.14, 0.2], [0.14, -0.2], [-0.14, -0.2]].map(([a, b]) => part(new THREE.BoxGeometry(0.08, 0.24, 0.08), 0x2b2b3a, { t: [a, 0.12, b] })),
  ]);
  return { cow, sheep };
}

export function buildNature(parent, rng, blocked) {
  const grp = new THREE.Group();
  parent.add(grp);
  const G = treeGeos();
  const lists = { decid: [], pine: [], palm: [], cactus: [], rock: [] };
  const d = new THREE.Vector3(), f = new THREE.Vector3();
  const add = (kind, dir, e, s, tint) => {
    randDir(rng, f);
    const pos = dir.clone().multiplyScalar(R + e - 0.012 * s * 6);
    lists[kind].push({ m: basisAt(new THREE.Matrix4(), pos, dir, f, s, s * (0.85 + rng() * 0.3), s), c: tint });
  };
  const green = (base, v) => new THREE.Color(base).offsetHSL((rng() - 0.5) * 0.06, (rng() - 0.5) * 0.15, (rng() - 0.5) * v);
  for (let i = 0; i < 110000; i++) {
    randDir(rng, d);
    const e = elev(d.x, d.y, d.z);
    if (e < 0.012) continue;
    if (blocked(d)) continue;
    const b = biome(d.x, d.y, d.z, e);
    const r = rng();
    switch (b.type) {
      case 'forest':
        if (r < 0.36) {
          if (b.temp < 0.45 || rng() < 0.25) add('pine', d, e, 0.13 + rng() * 0.08, green(0xffffff, 0.12));
          else add('decid', d, e, 0.12 + rng() * 0.07, green(0xffffff, 0.14));
        }
        break;
      case 'grass':
        if (b.farm > 0.3) { if (r < 0.006) add('decid', d, e, 0.12 + rng() * 0.05, green(0xffffff, 0.1)); }
        else if (r < 0.06) add('decid', d, e, 0.11 + rng() * 0.07, green(0xffffff, 0.16));
        break;
      case 'tundra':
        if (r < 0.15) add('pine', d, e, 0.11 + rng() * 0.07, new THREE.Color(0xd9ecef).lerp(new THREE.Color(0xffffff), rng() * 0.5));
        break;
      case 'beach':
        if (b.temp > 0.5 && r < 0.16) add('palm', d, e, 0.13 + rng() * 0.06, green(0xffffff, 0.1));
        break;
      case 'desert':
        if (r < 0.022) add('cactus', d, e, 0.07 + rng() * 0.04, green(0xffffff, 0.1));
        else if (r < 0.03) add('rock', d, e, 0.05 + rng() * 0.05, new THREE.Color(0xf2c48d));
        break;
      case 'rock':
        if (r < 0.06) add('rock', d, e, 0.06 + rng() * 0.08, new THREE.Color(0xffffff).multiplyScalar(0.9 + rng() * 0.15));
        else if (r < 0.1 && e < 0.45) add('pine', d, e, 0.1 + rng() * 0.05, green(0xffffff, 0.1));
        break;
      case 'snow':
        if (r < 0.02 && e > 0.02 && e < 0.65) add('pine', d, e, 0.1 + rng() * 0.06, new THREE.Color(0xeef6ff));
        break;
    }
  }
  // park trees from cities
  for (const t of world.parkTrees || []) {
    randDir(rng, f);
    lists.decid.push({ m: basisAt(new THREE.Matrix4(), t.d.clone().multiplyScalar(t.r), t.d, f, 0.08 + rng() * 0.03), c: green(0xffffff, 0.15) });
  }
  const sway = { SWAY: '', TINTMASK: '' };
  addInstancedChunked(grp, G.decid, toon({ vertexColors: true, defines: sway }), lists.decid, { outline: { max: 0.008 } });
  addInstancedChunked(grp, G.pine, toon({ vertexColors: true, defines: sway }), lists.pine, { outline: { max: 0.008 } });
  addInstanced(grp, G.palm, toon({ vertexColors: true, defines: sway }), lists.palm, { outline: { max: 0.006 } });
  addInstanced(grp, G.cactus, toon({ vertexColors: true, defines: { TINTMASK: '' } }), lists.cactus, { outline: { max: 0.006 } });
  addInstanced(grp, G.rock, toon({ vertexColors: true, defines: { TINTMASK: '' } }), lists.rock, { outline: { max: 0.008 } });

  // ---------------- animals
  const A = animalGeos();
  const cows = [], sheep = [];
  for (let i = 0; i < 60000 && (cows.length < 90 || sheep.length < 70); i++) {
    randDir(rng, d);
    const e = elev(d.x, d.y, d.z);
    if (e < 0.02 || blocked(d)) continue;
    const b = biome(d.x, d.y, d.z, e);
    if (b.type === 'grass' && b.farm > 0.3 && cows.length < 90 && rng() < 0.25) {
      // a small herd
      const n = 2 + Math.floor(rng() * 3);
      const { e: E, n: N } = tangentFrame(d);
      for (let k = 0; k < n; k++) {
        const dd = d.clone().addScaledVector(E, (rng() - 0.5) * 0.012).addScaledVector(N, (rng() - 0.5) * 0.012).normalize();
        const ee = elev(dd.x, dd.y, dd.z);
        randDir(rng, f);
        cows.push({ m: basisAt(new THREE.Matrix4(), dd.clone().multiplyScalar(R + ee - 0.003), dd, f, 0.055) });
      }
    } else if ((b.type === 'grass' || b.type === 'tundra') && b.farm < 0.2 && e > 0.08 && sheep.length < 70 && rng() < 0.05) {
      const n = 3 + Math.floor(rng() * 3);
      const { e: E, n: N } = tangentFrame(d);
      for (let k = 0; k < n; k++) {
        const dd = d.clone().addScaledVector(E, (rng() - 0.5) * 0.014).addScaledVector(N, (rng() - 0.5) * 0.014).normalize();
        const ee = elev(dd.x, dd.y, dd.z);
        randDir(rng, f);
        sheep.push({ m: basisAt(new THREE.Matrix4(), dd.clone().multiplyScalar(R + ee - 0.003), dd, f, 0.05) });
      }
    }
  }
  // cows around the UFO farm
  if (world.features.farm) {
    const c = world.features.farm;
    const { e: E, n: N } = tangentFrame(c);
    for (let k = 0; k < 18; k++) {
      const a = rng() * Math.PI * 2, r = 0.2 + rng() * 0.9;
      const dd = c.clone().addScaledVector(E, (Math.cos(a) * r) / R).addScaledVector(N, (Math.sin(a) * r) / R).normalize();
      const ee = elev(dd.x, dd.y, dd.z);
      if (ee < 0.01) continue;
      randDir(rng, f);
      cows.push({ m: basisAt(new THREE.Matrix4(), dd.clone().multiplyScalar(R + ee - 0.003), dd, f, 0.055) });
    }
  }
  addInstanced(grp, A.cow, toon({ vertexColors: true }), cows, { outline: { max: 0.004 } });
  addInstanced(grp, A.sheep, toon({ vertexColors: true }), sheep, { outline: { max: 0.004 } });
  world.cowGeo = A.cow;

  // ---------------- wind turbines
  const tower = merge([
    part(new THREE.CylinderGeometry(0.018, 0.034, 1, 8), 0xffffff, { t: [0, 0.5, 0] }),
    part(new THREE.BoxGeometry(0.06, 0.06, 0.15), 0xf1f3f8, { t: [0, 1.0, 0.01] }),
    part(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 8), 0xb0b8c8, { t: [0, 0.02, 0] }),
  ]);
  const blades = merge([
    part(sph(0.035, 8, 6), 0xff5d5d),
    ...[0, 1, 2].map((k) => part(new THREE.BoxGeometry(0.04, 0.48, 0.008).translate(0, 0.25, 0).rotateZ((k / 3) * Math.PI * 2), 0xffffff)),
    ...[0, 1, 2].map((k) => part(new THREE.BoxGeometry(0.041, 0.07, 0.009).translate(0, 0.45, 0).rotateZ((k / 3) * Math.PI * 2), 0xff5d5d)),
  ]);
  const tw = [], bl = [];
  const addTurbine = (dir) => {
    const e = elev(dir.x, dir.y, dir.z);
    const s = 0.32;
    const wind = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    if (wind.lengthSq() < 0.1) wind.set(1, 0, 0);
    const base = dir.clone().multiplyScalar(R + e - 0.01);
    tw.push({ m: basisAt(new THREE.Matrix4(), base, dir, wind, s) });
    const hub = base.clone().addScaledVector(dir, 1.0 * s).addScaledVector(wind, 0.09 * s);
    bl.push({ m: basisAt(new THREE.Matrix4(), hub, dir, wind, s) });
  };
  const gearCity = world.cities[2];
  let placed = 0;
  for (let i = 0; i < 4000 && placed < 34; i++) {
    let dir;
    if (gearCity && placed < 16) {
      const a = rng() * Math.PI * 2, r = gearCity.rad + 0.35 + rng() * 1.0;
      dir = gearCity.c.clone().addScaledVector(gearCity.E, (Math.cos(a) * r) / R).addScaledVector(gearCity.N, (Math.sin(a) * r) / R).normalize();
    } else dir = randDir(rng, new THREE.Vector3()).clone();
    const e = elev(dir.x, dir.y, dir.z);
    if (e < 0.06 || e > 0.4 || blocked(dir)) continue;
    const b = biome(dir.x, dir.y, dir.z, e);
    if (!['grass', 'tundra', 'forest'].includes(b.type)) continue;
    addTurbine(dir); placed++;
  }
  addInstanced(grp, tower, toon({ vertexColors: true }), tw, { outline: { max: 0.006 } });
  addInstanced(grp, blades, toon({ vertexColors: true, spin: -2.2, defines: { SPIN: '' } }), bl, { outline: { max: 0.005 } });

  // ---------------- dutch windmills (village)
  const millBody = merge([
    part(new THREE.CylinderGeometry(0.28, 0.4, 0.9, 8), 0xf6e7c8, { t: [0, 0.45, 0] }),
    part(new THREE.ConeGeometry(0.36, 0.4, 8), 0xd1495b, { t: [0, 1.1, 0] }),
    part(new THREE.BoxGeometry(0.16, 0.26, 0.05), 0x8b5a3c, { t: [0, 0.13, 0.36] }),
    part(new THREE.BoxGeometry(0.12, 0.12, 0.05), 0x6fc3ff, { t: [0, 0.6, 0.3] }),
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8).rotateX(Math.PI / 2), 0x6b4a33, { t: [0, 0.95, 0.35] }),
  ]);
  const millSails = merge([
    ...[0, 1, 2, 3].map((k) => part(new THREE.BoxGeometry(0.035, 0.66, 0.02).translate(0, 0.33, 0).rotateZ((k / 4) * Math.PI * 2), 0x6b4a33)),
    ...[0, 1, 2, 3].map((k) => part(new THREE.BoxGeometry(0.16, 0.48, 0.012).translate(0.1, 0.4, 0).rotateZ((k / 4) * Math.PI * 2), 0xfffaf0)),
  ]);
  const mb = [], ms = [];
  for (const sp of world.windmillSpots || []) {
    const e = elev(sp.d.x, sp.d.y, sp.d.z);
    if (e < 0.01) continue;
    const s = 0.17;
    const fwd = sp.fwd.clone();
    const base = sp.d.clone().multiplyScalar(R + e - 0.01);
    mb.push({ m: basisAt(new THREE.Matrix4(), base, sp.d, fwd, s) });
    ms.push({ m: basisAt(new THREE.Matrix4(), base.clone().addScaledVector(sp.d, 0.95 * s).add(fwd.clone().addScaledVector(sp.d, -fwd.dot(sp.d)).normalize().multiplyScalar(0.46 * s)), sp.d, fwd, s) });
  }
  addInstanced(grp, millBody, toon({ vertexColors: true }), mb, { outline: { max: 0.006 } });
  addInstanced(grp, millSails, toon({ vertexColors: true, spin: 0.9, defines: { SPIN: '' } }), ms, { outline: { max: 0.005 } });
  return grp;
}
