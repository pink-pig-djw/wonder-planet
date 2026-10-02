import * as THREE from 'three';
import { R, world, offsetDir } from './world.js';
import { toon, U } from './shaders.js';
import { part, merge, prep, basisAt } from './geo.js';
import { addMesh, addInstanced } from './mk.js';

const S = 0.2; // block pitch (matches terrain shader street grid)
const PALS = [
  [0xff8fa3, 0xffc75f, 0x8fd3ff, 0xb39cff, 0x9be38f, 0xffe066, 0xff9f68, 0x7ee0d2, 0xf6f0ff],
  [0xffb3c6, 0xfff5f8, 0xffd6e0, 0xff8fab, 0xfde2e4, 0xc8b6ff, 0xbde0fe],
  [0xf4b942, 0xd9a066, 0xc9ada7, 0x9db4c0, 0xe0c097, 0xb8c0ff],
  [0x4cc9f0, 0xff6b6b, 0xffd23f, 0x7bd389, 0xf72585, 0xb5e48c, 0xffffff],
  [0xffe5a8, 0xf9c784, 0xfcdde0, 0xf6bd60, 0xffffff, 0xe0aaff],
  [0xa0c4ff, 0xbdb2ff, 0xffc6ff, 0xcaffbf, 0xfdffb6, 0x9bf6ff],
  [0xfff1e6, 0xfde2e4, 0xe2ece9, 0xdfe7fd, 0xfad2e1],
  [0xffd166, 0xffb703, 0xfb8500, 0xffe8a3, 0xfff3c4, 0x8ecae6],
];
const ROOFS = [0xe5533d, 0x3d6fe5, 0x8a5a44, 0xe59b3d, 0x3da35d, 0x9b5de5, 0xf15bb5];

const _m = new THREE.Matrix4();
const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _f = new THREE.Vector3();

export function cityFrame(city, u, v, lift = 0) {
  const d = offsetDir(city.c, city.E, city.N, u, v, new THREE.Vector3());
  const pos = d.clone().multiplyScalar(R + city.h + lift);
  const fwd = city.N.clone().addScaledVector(d, -city.N.dot(d)).normalize();
  return { d, pos, fwd };
}

export function placeGroup(g, pos, up, fwd, s = 1) {
  basisAt(_m, pos, up, fwd, s, s, s);
  _m.decompose(g.position, g.quaternion, g.scale);
  return g;
}

// ------------------------------------------------------------- landmarks
function needleTower() {
  const P = [
    part(new THREE.CylinderGeometry(0.016, 0.038, 0.95, 10), 0xf4f1ea, { t: [0, 0.475, 0] }),
    part(new THREE.CylinderGeometry(0.11, 0.08, 0.05, 24), 0xffffff, { t: [0, 0.86, 0] }),
    part(new THREE.CylinderGeometry(0.112, 0.112, 0.02, 24, 1, true), 0x6fc3ff, { t: [0, 0.865, 0], emit: 1 }),
    part(new THREE.CylinderGeometry(0.06, 0.1, 0.025, 24), 0xff5d8f, { t: [0, 0.9, 0] }),
    part(new THREE.CylinderGeometry(0.003, 0.012, 0.24, 6), 0xdddddd, { t: [0, 1.03, 0] }),
    part(new THREE.CylinderGeometry(0.07, 0.09, 0.02, 16), 0xff5d8f, { t: [0, 0.01, 0] }),
  ];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const g = new THREE.CylinderGeometry(0.007, 0.012, 0.52, 6).rotateZ(0.32).translate(0.083, 0.245, 0).rotateY(a);
    P.push(part(g, 0xff5d8f));
  }
  const grp = new THREE.Group();
  addMesh(grp, merge(P), toon({ vertexColors: true, emitCol: 0xfff2b0, defines: { EMIT_ATTR: '' } }), { outline: { max: 0.008 } });
  const bl = addMesh(grp, merge([part(new THREE.SphereGeometry(0.012, 8, 6), 0xff3355, { emit: 1, t: [0, 1.155, 0] })]),
    toon({ vertexColors: true, emitCol: 0xff2244, defines: { EMIT_ATTR: '', BLINK: '' } }), { outline: false });
  return { grp, h: 1.16 };
}

function ferrisWheel() {
  const H = 0.34, RW = 0.27;
  const grp = new THREE.Group();
  const frame = [part(new THREE.BoxGeometry(0.44, 0.02, 0.18), 0x7a6c8f, { t: [0, 0.01, 0] })];
  const L = Math.hypot(0.16, H), ang = Math.atan2(0.16, H);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    frame.push(part(new THREE.BoxGeometry(0.014, L, 0.014).rotateZ(sx * ang).translate(-sx * 0.08, H / 2, sz * 0.055), 0xfafafa));
  }
  frame.push(part(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8).rotateX(Math.PI / 2).translate(0, H, 0), 0x555566));
  addMesh(grp, merge(frame), toon({ vertexColors: true }));

  const wheel = new THREE.Group();
  wheel.position.y = H;
  const W = [];
  for (const z of [-0.035, 0.035]) {
    W.push(part(new THREE.TorusGeometry(RW, 0.007, 6, 56).translate(0, 0, z), 0xff5d8f));
    W.push(part(new THREE.TorusGeometry(0.05, 0.006, 6, 20).translate(0, 0, z), 0xff5d8f));
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (const z of [-0.035, 0.035]) W.push(part(new THREE.BoxGeometry(0.005, RW, 0.005).translate(0, RW / 2, z).rotateZ(a), 0xffffff));
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    W.push(part(new THREE.SphereGeometry(0.009, 6, 4).translate(Math.cos(a) * RW, Math.sin(a) * RW, 0.042), 0xfff1a0, { emit: 1 }));
  }
  addMesh(wheel, merge(W), toon({ vertexColors: true, emitCol: 0xfff1a0, defines: { EMIT_ATTR: '' } }), { outline: { max: 0.006 } });
  grp.add(wheel);

  const gondG = merge([
    part(new THREE.BoxGeometry(0.045, 0.04, 0.05), 0xffffff, { tint: 1, t: [0, -0.03, 0] }),
    part(new THREE.BoxGeometry(0.05, 0.008, 0.055), 0x444455, { t: [0, -0.008, 0] }),
    part(new THREE.BoxGeometry(0.004, 0.02, 0.004), 0x444455, { t: [0, 0.0, 0] }),
  ]);
  const cols = [0xff6b6b, 0xffd23f, 0x4cc9f0, 0x7bd389, 0xb39cff, 0xff9f68];
  const list = [];
  for (let k = 0; k < 12; k++) list.push({ m: new THREE.Matrix4(), c: new THREE.Color(cols[k % cols.length]) });
  const gond = addInstanced(grp, gondG, toon({ vertexColors: true, defines: { TINTMASK: '' } }), list, { dynamic: true, outline: { max: 0.005 } });
  const m = new THREE.Matrix4();
  return {
    grp, h: H + RW,
    update(t) {
      const a0 = t * 0.18;
      wheel.rotation.z = a0;
      for (let k = 0; k < 12; k++) {
        const a = a0 + (k / 12) * Math.PI * 2;
        m.makeTranslation(Math.cos(a) * RW, H + Math.sin(a) * RW, 0);
        gond.setMatrixAt(k, m);
      }
      gond.instanceMatrix.needsUpdate = true;
    },
  };
}

function gearStatue() {
  const sh = new THREE.Shape();
  const teeth = 12, Ro = 1, Ri = 0.8;
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2, st = (Math.PI * 2) / teeth;
    const pts = [[Ri, a], [Ro, a + st * 0.18], [Ro, a + st * 0.5], [Ri, a + st * 0.68]];
    pts.forEach(([r, b], i) => { const x = Math.cos(b) * r, y = Math.sin(b) * r; if (k === 0 && i === 0) sh.moveTo(x, y); else sh.lineTo(x, y); });
  }
  sh.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.32, 0, Math.PI * 2, true); sh.holes.push(hole);
  const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 24 }).translate(0, 0, -0.11);
  const grp = new THREE.Group();
  addMesh(grp, merge([
    part(new THREE.BoxGeometry(0.1, 0.16, 0.08), 0x8d99ae, { t: [0, 0.08, 0] }),
    part(new THREE.BoxGeometry(0.26, 0.03, 0.14), 0x6c7a91, { t: [0, 0.015, 0] }),
  ]), toon({ vertexColors: true }));
  const gear = addMesh(grp, merge([part(gg, 0xf4b942, { s: [0.16, 0.16, 0.16] }), part(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12).rotateX(Math.PI / 2), 0xe76f51)]), toon({ vertexColors: true }));
  gear.position.y = 0.3;
  const small = addMesh(grp, merge([part(gg, 0x90be6d, { s: [0.08, 0.08, 0.08] })]), toon({ vertexColors: true }));
  small.position.set(0.2, 0.2, 0.02);
  return { grp, h: 0.46, update(t) { gear.rotation.z = t * 0.35; small.rotation.z = -t * 0.7 + 0.13; } };
}

function sodaCan() {
  const g = new THREE.CylinderGeometry(0.13, 0.13, 0.44, 40, 14).toNonIndexed().translate(0, 0.22, 0);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3), emit = new Float32Array(pos.count), tint = new Float32Array(pos.count);
  const red = new THREE.Color(0xe63946), white = new THREE.Color(0xffffff), win = new THREE.Color(0x8fd3ff);
  for (let i = 0; i < pos.count; i += 3) {
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < 3; j++) { x += pos.getX(i + j); y += pos.getY(i + j); z += pos.getZ(i + j); }
    x /= 3; y /= 3; z /= 3;
    const a = Math.atan2(z, x);
    const wave = Math.sin(a * 2 + y * 14);
    let c = red, e = 0;
    if (wave > 0.55 && wave < 0.9) c = white;
    const fl = Math.floor(y / 0.05), sl = Math.floor((a + Math.PI) / (Math.PI / 10));
    if (y > 0.04 && y < 0.4 && fl % 2 === 1 && sl % 2 === 0 && c === red && Math.abs(Math.cos(a * 10)) > -1) { c = win; e = 1; }
    for (let j = 0; j < 3; j++) { col.set([c.r, c.g, c.b], (i + j) * 3); emit[i + j] = e; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aEmit', new THREE.BufferAttribute(emit, 1));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  g.deleteAttribute('uv');
  const straw = [];
  for (let k = 0; k < 8; k++) {
    straw.push(part(new THREE.CylinderGeometry(0.013, 0.013, 0.05, 8).translate(0, 0.025 + k * 0.05, 0).rotateZ(-0.35).translate(0.04, 0.46, 0), k % 2 ? 0xffffff : 0xff5d8f));
  }
  const grp = new THREE.Group();
  addMesh(grp, merge([
    g,
    part(new THREE.CylinderGeometry(0.115, 0.13, 0.03, 32), 0xd5dae2, { t: [0, 0.455, 0] }),
    part(new THREE.BoxGeometry(0.06, 0.008, 0.03), 0xaab2bd, { t: [-0.04, 0.472, 0] }),
    ...straw,
  ]), toon({ vertexColors: true, emitCol: 0xfff0b0, defines: { EMIT_ATTR: '' } }));
  return { grp, h: 0.8 };
}

function stadium() {
  const grp = new THREE.Group();
  const prof = [[0.25, 0], [0.29, 0], [0.29, 0.075], [0.27, 0.08], [0.2, 0.03], [0.2, 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.LatheGeometry(prof, 48);
  bowl.scale(1.35, 1, 1);
  const field = [];
  for (let k = 0; k < 8; k++) {
    field.push(part(new THREE.BoxGeometry(0.06, 0.01, 0.3), k % 2 ? 0x6cc04a : 0x82d65a, { t: [-0.21 + k * 0.06, 0.008, 0] }));
  }
  field.push(part(new THREE.BoxGeometry(0.004, 0.012, 0.3), 0xffffff, { t: [0, 0.009, 0] }));
  field.push(part(new THREE.TorusGeometry(0.05, 0.003, 4, 24).rotateX(Math.PI / 2).translate(0, 0.014, 0), 0xffffff));
  const lights = [];
  for (const [x, z] of [[0.34, 0.22], [-0.34, 0.22], [0.34, -0.22], [-0.34, -0.22]]) {
    lights.push(part(new THREE.CylinderGeometry(0.006, 0.008, 0.22, 6).translate(x, 0.11, z), 0xdddddd));
    lights.push(part(new THREE.BoxGeometry(0.05, 0.03, 0.012).translate(x, 0.225, z), 0xfff7c2, { emit: 1 }));
  }
  addMesh(grp, merge([part(bowl, 0xf1faee), ...field, ...lights]), toon({ vertexColors: true, emitCol: 0xffffe0, defines: { EMIT_ATTR: '', DOUBLE: '' }, side: THREE.DoubleSide }));
  addMesh(grp, merge([part(new THREE.LatheGeometry([[0.205, 0.03], [0.265, 0.074]].map(([x, y]) => new THREE.Vector2(x, y)), 48).scale(1.35, 1, 1).translate(0, 0.002, 0), 0x4895ef)]),
    toon({ vertexColors: true, side: THREE.DoubleSide, defines: { DOUBLE: '' } }), { outline: false });
  return { grp, h: 0.25 };
}

function clockTower() {
  const grp = new THREE.Group();
  const P = [
    part(new THREE.BoxGeometry(0.09, 0.42, 0.09), 0xd9b48f, { t: [0, 0.21, 0] }),
    part(new THREE.BoxGeometry(0.12, 0.13, 0.12), 0xc49a6c, { t: [0, 0.48, 0] }),
    part(new THREE.ConeGeometry(0.1, 0.16, 4).rotateY(Math.PI / 4), 0x3d5a80, { t: [0, 0.625, 0] }),
    part(new THREE.CylinderGeometry(0.003, 0.006, 0.08, 6), 0xffd23f, { t: [0, 0.74, 0] }),
    part(new THREE.BoxGeometry(0.11, 0.02, 0.11), 0xc49a6c, { t: [0, 0.01, 0] }),
  ];
  const faces = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    P.push(part(new THREE.CircleGeometry(0.045, 24).translate(0, 0, 0.061).rotateY(a).translate(0, 0.48, 0), 0xfffbea, { emit: 0.7 }));
    P.push(part(new THREE.TorusGeometry(0.045, 0.004, 4, 24).translate(0, 0, 0.061).rotateY(a).translate(0, 0.48, 0), 0x1d1631));
    faces.push(a);
  }
  addMesh(grp, merge(P), toon({ vertexColors: true, emitCol: 0xfff3c0, defines: { EMIT_ATTR: '' } }));
  const hands = [];
  const handMat = toon({ color: 0x1d1631 });
  for (const a of faces) {
    const pivot = new THREE.Group();
    pivot.position.set(Math.sin(a) * 0.064, 0.48, Math.cos(a) * 0.064);
    pivot.rotation.y = a;
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.026, 0.003).translate(0, 0.012, 0), handMat);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.038, 0.003).translate(0, 0.018, 0.002), handMat);
    pivot.add(hh, mh);
    grp.add(pivot);
    hands.push([hh, mh]);
  }
  return {
    grp, h: 0.78,
    setTime(hours) {
      for (const [hh, mh] of hands) {
        hh.rotation.z = -((hours % 12) / 12) * Math.PI * 2;
        mh.rotation.z = -((hours % 1)) * Math.PI * 2;
      }
    },
  };
}

function glassDome() {
  const grp = new THREE.Group();
  addMesh(grp, merge([
    part(new THREE.SphereGeometry(0.22, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xb9f3ff, { emit: 0.55 }),
    part(new THREE.CylinderGeometry(0.235, 0.24, 0.025, 32), 0xe9ecef, { t: [0, 0.012, 0] }),
    part(new THREE.SphereGeometry(0.03, 10, 8), 0xffd23f, { t: [0, 0.225, 0] }),
  ]), toon({ vertexColors: true, emitCol: 0xa8ffcf, defines: { EMIT_ATTR: '' } }));
  const ribs = [];
  for (let k = 0; k < 8; k++) ribs.push(part(new THREE.TorusGeometry(0.222, 0.004, 4, 24, Math.PI).rotateY((k / 8) * Math.PI), 0xffffff));
  ribs.push(part(new THREE.TorusGeometry(0.19, 0.004, 4, 32).rotateX(Math.PI / 2).translate(0, 0.11, 0), 0xffffff));
  addMesh(grp, merge(ribs), toon({ vertexColors: true }), { outline: false });
  return { grp, h: 0.25 };
}

// ------------------------------------------------------------- city builder
export function buildCities(parent, rng) {
  const grp = new THREE.Group();
  parent.add(grp);
  const towers = [], cyls = [], houses = [], roofs = [], parks = [], antennas = [], blinkers = [], acs = [];
  world.parkTrees = [];
  world.windmillSpots = [];
  const animated = [];
  const labels = [];

  world.cities.forEach((city, ci) => {
    const pal = PALS[ci % PALS.length];
    const reserved = [];
    city.reserved = reserved;
    const landmark = (u, v, r, make, scale = 1, park = true) => {
      reserved.push({ u, v, r });
      const lm = make();
      const f = cityFrame(city, u, v, -0.005);
      placeGroup(lm.grp, f.pos, f.d, f.fwd, scale);
      grp.add(lm.grp);
      if (park) parks.push({ m: basisAt(new THREE.Matrix4(), cityFrame(city, u, v, -0.004).pos, f.d, f.fwd, r * 1.75, 0.012, r * 1.75), c: new THREE.Color(0x86d363) });
      if (lm.update || lm.setTime) animated.push(lm);
      lm.city = city;
      return lm;
    };
    city.landmarkH = 0.3;
    switch (ci) {
      case 0:
        landmark(0.1, 0.1, 0.1, needleTower, 1, false);
        landmark(0.5, -0.3, 0.2, ferrisWheel);
        city.landmarkH = 1.2; break;
      case 2: landmark(0.1, 0.1, 0.12, gearStatue, 1.1); city.landmarkH = 0.6; break;
      case 3: landmark(-0.1, 0.1, 0.12, sodaCan, 1.0, false); city.landmarkH = 0.85; break;
      case 4: landmark(0.2, 0.0, 0.32, stadium, 1.0, false); break;
      case 5: landmark(0.1, -0.1, 0.1, clockTower, 1.0); city.landmarkH = 0.8; break;
      case 7: landmark(-0.1, -0.1, 0.18, glassDome, 1.0); break;
      default: break;
    }
    const n = Math.ceil(city.rad / S) + 1;
    const downtown = ci === 6 ? 2 : ci === 0 ? 0.42 : 0.55;
    for (let bi = -n; bi < n; bi++) for (let bj = -n; bj < n; bj++) {
      const u = (bi + 0.5) * S, v = (bj + 0.5) * S;
      const dist = Math.hypot(u, v);
      if (dist > city.rad - 0.1) continue;
      if (reserved.some((r) => Math.hypot(u - r.u, v - r.v) < r.r + 0.05)) continue;
      const f = 1 - dist / city.rad;
      const r = rng();
      const fr = cityFrame(city, u, v);
      if (r < 0.08 && dist > 0.25) {
        parks.push({ m: basisAt(new THREE.Matrix4(), cityFrame(city, u, v, -0.004).pos, fr.d, fr.fwd, 0.152, 0.012, 0.152), c: new THREE.Color(0x86d363) });
        for (let k = 0; k < 3; k++) {
          const tu = u + (rng() - 0.5) * 0.1, tv = v + (rng() - 0.5) * 0.1;
          world.parkTrees.push({ d: offsetDir(city.c, city.E, city.N, tu, tv, new THREE.Vector3()), r: R + city.h });
        }
        continue;
      }
      if (f > downtown + rng() * 0.08) {
        const big = ci === 0 ? 1.25 : 1;
        const hmain = (0.2 + f * f * 0.62 * (0.55 + rng() * 0.75)) * big;
        const color = new THREE.Color(pal[Math.floor(rng() * pal.length)]);
        if (rng() < 0.28) {
          for (const s of [-1, 1]) {
            const ff = cityFrame(city, u + s * 0.037, v + (rng() - 0.5) * 0.02, -0.01);
            towers.push({ m: basisAt(new THREE.Matrix4(), ff.pos, ff.d, ff.fwd, 0.062, hmain * (0.6 + rng() * 0.4) + 0.01, 0.12), c: new THREE.Color(pal[Math.floor(rng() * pal.length)]) });
          }
        } else {
          const ff = cityFrame(city, u, v, -0.01);
          const w = 0.1 + rng() * 0.03, dd = 0.1 + rng() * 0.035;
          if (rng() < 0.25) cyls.push({ m: basisAt(new THREE.Matrix4(), ff.pos, ff.d, ff.fwd, w * 1.1, hmain + 0.01, w * 1.1), c: color });
          else {
            towers.push({ m: basisAt(new THREE.Matrix4(), ff.pos, ff.d, ff.fwd, w, hmain + 0.01, dd), c: color });
            if (hmain > 0.25 && rng() < 0.5) {
              // stepped crown
              const top = cityFrame(city, u, v, hmain - 0.012);
              towers.push({ m: basisAt(new THREE.Matrix4(), top.pos, top.d, top.fwd, w * 0.62, 0.06 + rng() * 0.08, dd * 0.62), c: color.clone().offsetHSL(0, 0, -0.05) });
            }
          }
          const topH = hmain;
          if (topH > 0.32) {
            const a = cityFrame(city, u + 0.02, v, topH - 0.01);
            antennas.push({ m: basisAt(new THREE.Matrix4(), a.pos, a.d, a.fwd, 1, 1, 1) });
            const b = cityFrame(city, u + 0.02, v, topH + 0.1);
            blinkers.push({ m: basisAt(new THREE.Matrix4(), b.pos, b.d, b.fwd, 1, 1, 1) });
          } else if (rng() < 0.6) {
            const a = cityFrame(city, u + (rng() - 0.5) * 0.04, v + (rng() - 0.5) * 0.04, topH);
            acs.push({ m: basisAt(new THREE.Matrix4(), a.pos, a.d, a.fwd, 0.03, 0.018, 0.022) });
          }
        }
      } else if (f > 0.24 && ci !== 6) {
        for (const su of [-1, 1]) for (const sv of [-1, 1]) {
          if (rng() < 0.15) continue;
          const ff = cityFrame(city, u + su * 0.036, v + sv * 0.036, -0.01);
          const h = 0.07 + rng() * 0.1 + f * 0.12;
          const color = new THREE.Color(pal[Math.floor(rng() * pal.length)]);
          if (rng() < 0.2) cyls.push({ m: basisAt(new THREE.Matrix4(), ff.pos, ff.d, ff.fwd, 0.054, h, 0.054), c: color });
          else towers.push({ m: basisAt(new THREE.Matrix4(), ff.pos, ff.d, ff.fwd, 0.056, h, 0.056), c: color });
        }
      } else {
        for (const su of [-1, 1]) for (const sv of [-1, 1]) {
          if (rng() < 0.12) continue;
          const ff = cityFrame(city, u + su * 0.037 + (rng() - 0.5) * 0.01, v + sv * 0.037 + (rng() - 0.5) * 0.01, -0.008);
          const rot = rng() < 0.5;
          const fwd = rot ? ff.fwd.clone().cross(ff.d) : ff.fwd;
          const w = 0.042 + rng() * 0.01, d = 0.05 + rng() * 0.012, h = 0.03 + rng() * 0.015;
          houses.push({ m: basisAt(new THREE.Matrix4(), ff.pos, ff.d, fwd, w, h + 0.008, d), c: new THREE.Color(pal[Math.floor(rng() * pal.length)]).lerp(new THREE.Color(0xffffff), 0.35) });
          const top = ff.pos.clone().addScaledVector(ff.d, h + 0.008);
          roofs.push({ m: basisAt(new THREE.Matrix4(), top, ff.d, fwd, w, 0.028 + rng() * 0.01, d), c: new THREE.Color(ROOFS[Math.floor(rng() * ROOFS.length)]) });
        }
      }
    }
    // windmill spots for the village
    if (ci === 6) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        world.windmillSpots.push({ d: offsetDir(city.c, city.E, city.N, Math.cos(a) * (city.rad + 0.18), Math.sin(a) * (city.rad + 0.18), new THREE.Vector3()), fwd: city.N.clone() });
      }
    }
    labels.push(city);
  });

  // ---- instanced meshes
  const boxG = prep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const cylG = prep(new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1).translate(0, 0.5, 0));
  addInstanced(grp, boxG, toon({ defines: { BUILDING: '' } }), towers, { outline: { max: 0.01 } });
  addInstanced(grp, cylG, toon({ defines: { BUILDING: '', CYL: '' } }), cyls, { outline: { max: 0.01 } });
  addInstanced(grp, boxG, toon({}), houses, { outline: { max: 0.005 } });
  const roofShape = new THREE.Shape([new THREE.Vector2(-0.6, 0), new THREE.Vector2(0.6, 0), new THREE.Vector2(0, 1)]);
  const roofG = prep(new THREE.ExtrudeGeometry(roofShape, { depth: 1.1, bevelEnabled: false }).translate(0, 0, -0.55));
  addInstanced(grp, roofG, toon({}), roofs, { outline: { max: 0.005 } });
  addInstanced(grp, prep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), toon({}), parks, { outline: false });
  addInstanced(grp, boxG, toon({ color: 0x9aa3b5 }), acs, { outline: { max: 0.004 } });
  addInstanced(grp, prep(new THREE.CylinderGeometry(0.003, 0.006, 0.11, 5).translate(0, 0.055, 0)), toon({ color: 0xd0d4dc }), antennas, { outline: false });
  addInstanced(grp, merge([part(new THREE.SphereGeometry(0.009, 6, 4), 0xff3355, { emit: 1 })]),
    toon({ vertexColors: true, emitCol: 0xff2244, defines: { EMIT_ATTR: '', BLINK: '' } }), blinkers, { outline: false });

  return {
    grp, labels,
    update(t, hours) {
      for (const a of animated) {
        if (a.update) a.update(t);
        if (a.setTime) a.setTime(hours(a.city));
      }
    },
  };
}
