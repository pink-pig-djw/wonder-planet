import * as THREE from 'three';
import { R, world, elev, angDist, offsetDir } from './world.js';
import { toon } from './shaders.js';
import { part, merge, prep, basisAt } from './geo.js';
import { addInstanced } from './mk.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Path {
  constructor(points, closed = true) {
    this.p = points; this.closed = closed;
    const n = points.length;
    this.L = new Float32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      if (i === n && !closed) { this.L[i] = this.L[i - 1]; break; }
      this.L[i] = this.L[i - 1] + points[i - 1].distanceTo(points[i % n]);
    }
    this.len = closed ? this.L[n] : this.L[n - 1];
  }
  raw(s, out) {
    const n = this.p.length;
    if (this.closed) { s %= this.len; if (s < 0) s += this.len; }
    else s = Math.max(0, Math.min(this.len - 1e-6, s));
    let lo = 0, hi = this.closed ? n : n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.L[mid] <= s) lo = mid; else hi = mid; }
    const a = this.p[lo], b = this.p[(lo + 1) % n];
    const seg = this.L[lo + 1] - this.L[lo] || 1;
    return out.copy(a).lerp(b, (s - this.L[lo]) / seg);
  }
  sample(s, pos, fwd, look = 0.025) {
    this.raw(s, pos);
    this.raw(s + look, _a); this.raw(s - look, _b);
    fwd.subVectors(_a, _b);
    if (fwd.lengthSq() < 1e-10) fwd.set(1, 0, 0);
    fwd.normalize();
    return pos;
  }
}

function slerpDir(a, b, t, out) {
  const ang = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const s = Math.sin(ang);
  if (s < 1e-6) return out.copy(a);
  return out.copy(a).multiplyScalar(Math.sin((1 - t) * ang) / s).addScaledVector(b, Math.sin(t * ang) / s).normalize();
}

// spatial hash for "is this near a road?"
class Hash {
  constructor(cell) { this.cell = cell; this.m = new Map(); }
  key(x, y, z) { return Math.floor(x / this.cell) + ',' + Math.floor(y / this.cell) + ',' + Math.floor(z / this.cell); }
  add(p) { const k = this.key(p.x, p.y, p.z); let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(p); }
  near(p, r) {
    const c = this.cell;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const a = this.m.get(this.key(p.x + dx * c, p.y + dy * c, p.z + dz * c));
      if (a) for (const q of a) if (q.distanceToSquared(p) < r * r) return true;
    }
    return false;
  }
}

export function planRoads() {
  const cities = world.cities;
  const edges = [];
  for (let i = 0; i < cities.length; i++) for (let j = i + 1; j < cities.length; j++) {
    const a = cities[i], b = cities[j];
    const dist = angDist(a.c, b.c);
    if (dist > 9) continue;
    const ang = dist / R;
    const t0 = a.rad / R / ang, t1 = 1 - b.rad / R / ang;
    const N = Math.ceil(((t1 - t0) * dist) / 0.05);
    const pts = [];
    let ok = true, bridgeLen = 0;
    for (let k = 0; k <= N; k++) {
      const t = t0 + ((t1 - t0) * k) / N;
      const d = slerpDir(a.c, b.c, t, new THREE.Vector3());
      for (const o of cities) if (o !== a && o !== b && angDist(o.c, d) < o.rad + 0.25) ok = false;
      if (world.volcano && angDist(world.volcano.c, d) < world.volcano.rad * 1.4) ok = false;
      const e = elev(d.x, d.y, d.z);
      if (e > 0.6) ok = false;
      const bridge = e < 0.012;
      if (bridge) bridgeLen += 0.05;
      pts.push({ d, e, bridge, h: bridge ? 0.075 : Math.max(e, 0) + 0.024 });
    }
    if (!ok || bridgeLen > 4.5) continue;
    edges.push({ i, j, dist, pts, a, b });
  }
  edges.sort((x, y) => x.dist - y.dist);
  // Kruskal MST + a couple of extras
  const parent = cities.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const chosen = [];
  let extras = 0;
  for (const e of edges) {
    const ra = find(e.i), rb = find(e.j);
    if (ra !== rb) { parent[ra] = rb; chosen.push(e); }
    else if (extras < 2 && e.dist < 7) { chosen.push(e); extras++; }
  }
  // smooth heights (ramps for bridges), keep above terrain
  for (const r of chosen) {
    const P = r.pts;
    P[0].h = r.a.h + 0.006; P[P.length - 1].h = r.b.h + 0.006;
    for (let it = 0; it < 6; it++) {
      const h = P.map((p) => p.h);
      for (let k = 1; k < P.length - 1; k++) {
        P[k].h = (h[k - 1] + h[k] * 2 + h[k + 1]) / 4;
        const floor = P[k].bridge ? 0.05 : Math.max(P[k].e, 0) + 0.02;
        if (P[k].h < floor) P[k].h = floor;
      }
    }
  }
  world.roads = chosen;
  const hash = new Hash(0.25);
  for (const r of chosen) for (const p of r.pts) hash.add(p.d.clone().multiplyScalar(R));
  world.roadHash = hash;
  return chosen;
}

export function makeBlocked() {
  const v = new THREE.Vector3();
  return (d) => {
    for (const c of world.cities) if (angDist(c.c, d) < c.rad + 0.12) return true;
    for (const f of world.flats) if (angDist(f.c, d) < f.r0 + 0.05) return true;
    if (world.roadHash && world.roadHash.near(v.copy(d).multiplyScalar(R), 0.07)) return true;
    return false;
  };
}

export function buildRoads(parent) {
  const grp = new THREE.Group();
  parent.add(grp);
  const pos = [], nor = [], aro = [], idx = [];
  const W = 0.032, SK = 0.03;
  const pillars = [];
  for (const r of world.roads) {
    const P = r.pts;
    let along = 0;
    const C = P.map((p) => p.d.clone().multiplyScalar(R + p.h));
    r.center = C;
    const rights = [];
    for (let k = 0; k < P.length; k++) {
      const up = P[k].d;
      const t = new THREE.Vector3().subVectors(C[Math.min(k + 1, P.length - 1)], C[Math.max(k - 1, 0)]).normalize();
      const right = new THREE.Vector3().crossVectors(t, up).normalize();
      rights.push(right);
      if (k > 0) along += C[k].distanceTo(C[k - 1]);
      const base = pos.length / 3;
      const L = C[k].clone().addScaledVector(right, -W), Rr = C[k].clone().addScaledVector(right, W);
      const skirt = P[k].bridge ? 0.018 : SK;
      const Lb = L.clone().addScaledVector(up, -skirt), Rb = Rr.clone().addScaledVector(up, -skirt);
      // top L, top R, side L top, side L bottom, side R top, side R bottom
      for (const [p, n, ac, side] of [[L, up, -1, 0], [Rr, up, 1, 0], [L, right.clone().negate(), -1, 1], [Lb, right.clone().negate(), -1, 1], [Rr, right, 1, 1], [Rb, right, 1, 1]]) {
        pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); aro.push(along, ac, side);
      }
      if (k > 0) {
        const a = base - 6, b = base;
        idx.push(a, b, a + 1, a + 1, b, b + 1);         // top
        idx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); // left side
        idx.push(a + 4, b + 4, a + 5, a + 5, b + 4, b + 5); // right side
      }
      if (P[k].bridge && k % 5 === 0) {
        const top = C[k].clone().addScaledVector(up, -0.015);
        const bottom = up.clone().multiplyScalar(R - 0.25);
        const h = top.distanceTo(bottom);
        pillars.push({ m: basisAt(new THREE.Matrix4(), bottom, up, t, 0.022, h, 0.05) });
      }
    }
    r.rights = rights;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aRoad', new THREE.Float32BufferAttribute(aro, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = toon({ defines: { ROAD: '' }, side: THREE.DoubleSide, polygonOffset: [-2, -4] });
  grp.add(new THREE.Mesh(g, mat));
  addInstanced(grp, prep(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), toon({ color: 0xe9e4f2 }), pillars, { outline: { max: 0.006 } });
  return grp;
}

// ------------------------------------------------------------- cars
function carGeos() {
  const wheel = (x, z) => part(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10).rotateZ(Math.PI / 2), 0x22222e, { t: [x, 0.11, z] });
  const car = merge([
    part(new THREE.BoxGeometry(0.46, 0.2, 0.9), 0xffffff, { tint: 1, t: [0, 0.21, 0] }),
    part(new THREE.BoxGeometry(0.4, 0.17, 0.46), 0xffffff, { tint: 1, t: [0, 0.39, -0.06] }),
    part(new THREE.BoxGeometry(0.41, 0.1, 0.4), 0x2b3a67, { t: [0, 0.4, -0.06] }),
    part(new THREE.BoxGeometry(0.1, 0.06, 0.02), 0xfff6c0, { emit: 1, t: [0.14, 0.23, 0.455] }),
    part(new THREE.BoxGeometry(0.1, 0.06, 0.02), 0xfff6c0, { emit: 1, t: [-0.14, 0.23, 0.455] }),
    part(new THREE.BoxGeometry(0.1, 0.06, 0.02), 0xff3344, { emit: 0.6, t: [0.14, 0.23, -0.455] }),
    part(new THREE.BoxGeometry(0.1, 0.06, 0.02), 0xff3344, { emit: 0.6, t: [-0.14, 0.23, -0.455] }),
    wheel(0.23, 0.28), wheel(-0.23, 0.28), wheel(0.23, -0.28), wheel(-0.23, -0.28),
  ]);
  const bus = merge([
    part(new THREE.BoxGeometry(0.5, 0.44, 1.5), 0xffffff, { tint: 1, t: [0, 0.34, 0] }),
    part(new THREE.BoxGeometry(0.51, 0.12, 1.3), 0x2b3a67, { emit: 0.5, t: [0, 0.42, -0.05] }),
    part(new THREE.BoxGeometry(0.45, 0.16, 0.02), 0x2b3a67, { t: [0, 0.42, 0.75] }),
    part(new THREE.BoxGeometry(0.1, 0.06, 0.02), 0xfff6c0, { emit: 1, t: [0.16, 0.2, 0.755] }),
    part(new THREE.BoxGeometry(0.1, 0.06, 0.02), 0xfff6c0, { emit: 1, t: [-0.16, 0.2, 0.755] }),
    wheel(0.25, 0.48), wheel(-0.25, 0.48), wheel(0.25, -0.48), wheel(-0.25, -0.48),
  ]);
  return { car, bus };
}

const CAR_COLS = [0xff5d5d, 0xffd23f, 0x4cc9f0, 0x7bd389, 0xff9f1c, 0xf72585, 0xffffff, 0x9b5de5, 0x2ec4b6, 0xe9ecef];
const CAR_NAMES = ['小红', '豆豆', '阿蓝', '青团', '橘子号', '跳跳糖', '雪球', '葡萄干', '薄荷', '棉花'];

export function buildCars(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const paths = [];
  // highways (two lanes as one closed loop)
  for (const r of world.roads) {
    const C = r.center, Rt = r.rights;
    const fwd = C.map((c, k) => c.clone().addScaledVector(Rt[k], 0.014).addScaledVector(r.pts[k].d, 0.001));
    const back = C.map((c, k) => c.clone().addScaledVector(Rt[k], -0.014).addScaledVector(r.pts[k].d, 0.001)).reverse();
    const path = new Path(fwd.concat(back), true);
    path.kind = 'hwy'; path.name = `${r.a.name} ⇄ ${r.b.name}`;
    paths.push({ path, n: 3 + Math.floor(path.len / 3) });
  }
  // city loops along street grid
  const S = 0.2;
  for (const city of world.cities) {
    const n = Math.floor(city.rad / S);
    const loops = Math.round(5 + city.rad * 9);
    let made = 0;
    for (let tries = 0; tries < 200 && made < loops; tries++) {
      const i0 = -n + Math.floor(rng() * (2 * n)), j0 = -n + Math.floor(rng() * (2 * n));
      const wi = 1 + Math.floor(rng() * 3), hj = 1 + Math.floor(rng() * 3);
      const corners = [[i0, j0], [i0 + wi, j0], [i0 + wi, j0 + hj], [i0, j0 + hj]].map(([i, j]) => [i * S, j * S]);
      if (corners.some(([u, v]) => Math.hypot(u, v) > city.rad - 0.04)) continue;
      const res = city.reserved || [];
      const hit = (u, v) => res.some((r) => Math.hypot(u - r.u, v - r.v) < r.r + 0.04);
      let bad = false;
      const pts = [];
      const order = rng() < 0.5 ? corners : [...corners].reverse();
      for (let k = 0; k < 4; k++) {
        const [u0, v0] = order[k], [u1, v1] = order[(k + 1) % 4];
        const segL = Math.hypot(u1 - u0, v1 - v0);
        const ru = (v1 - v0) / segL * 0.011, rv = -(u1 - u0) / segL * 0.011; // right-hand side lane
        const steps = Math.ceil(segL / 0.04);
        for (let q = 0; q < steps; q++) {
          const u = u0 + ((u1 - u0) * q) / steps, v = v0 + ((v1 - v0) * q) / steps;
          if (hit(u, v)) bad = true;
          const d = offsetDir(city.c, city.E, city.N, u + ru, v + rv, new THREE.Vector3());
          pts.push(d.multiplyScalar(R + city.h + 0.001));
        }
      }
      if (bad) continue;
      const path = new Path(pts, true);
      path.kind = 'city'; path.name = city.name;
      paths.push({ path, n: 1 + Math.floor(rng() * 2) });
      made++;
    }
  }
  const G = carGeos();
  const cars = [];
  for (const { path, n } of paths) {
    for (let k = 0; k < n; k++) {
      const isBus = rng() < (path.kind === 'hwy' ? 0.2 : 0.1);
      cars.push({
        path, s: rng() * path.len, speed: (path.kind === 'hwy' ? 0.2 : 0.11) * (0.8 + rng() * 0.4) * (isBus ? 0.8 : 1),
        bus: isBus, color: new THREE.Color(isBus ? [0xffd23f, 0x4cc9f0, 0xff6b6b][Math.floor(rng() * 3)] : CAR_COLS[Math.floor(rng() * CAR_COLS.length)]),
        name: isBus ? `${path.kind === 'hwy' ? '城际巴士' : '公交车'} ${Math.floor(10 + rng() * 89)} 路` : `${CAR_NAMES[Math.floor(rng() * CAR_NAMES.length)]} · ${String.fromCharCode(65 + Math.floor(rng() * 26))}${Math.floor(100 + rng() * 899)}`,
      });
    }
  }
  const carList = cars.filter((c) => !c.bus), busList = cars.filter((c) => c.bus);
  const mat = () => toon({ vertexColors: true, emitCol: 0xfff1b8, defines: { TINTMASK: '', EMIT_ATTR: '' } });
  const carIM = addInstanced(grp, G.car, mat(), carList.map((c) => ({ m: new THREE.Matrix4(), c: c.color })), { dynamic: true, outline: { max: 0.003 } });
  const busIM = addInstanced(grp, G.bus, mat(), busList.map((c) => ({ m: new THREE.Matrix4(), c: c.color })), { dynamic: true, outline: { max: 0.003 } });
  const pos = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), m = new THREE.Matrix4();
  const SC = 0.058;
  for (const c of cars) {
    c.kind = 'car';
    c.focus = { d: 0.38, el: 0.32, min: 0.08, max: 10 };
    c.getLocal = (P, F) => { c.path.sample(c.s, P, F); return P; };
    c.getWorldPose = (P, F, Up) => {
      c.path.sample(c.s, P, F);
      Up.copy(P).normalize();
      P.addScaledVector(Up, 0.02);
      planet.localToWorld(P);
      F.transformDirection(planet.matrixWorld);
      Up.transformDirection(planet.matrixWorld);
    };
    c.info = () => (c.path.kind === 'hwy' ? `行驶在 ${c.path.name} 公路上` : `在 ${c.path.name} 的街区里兜圈`);
  }
  return {
    grp, cars,
    update(dt) {
      let ci = 0, bi = 0;
      for (const c of cars) {
        c.s += c.speed * dt;
        c.path.sample(c.s, pos, fwd);
        up.copy(pos).normalize();
        basisAt(m, pos, up, fwd, SC, SC, SC);
        if (c.bus) busIM.setMatrixAt(bi++, m); else carIM.setMatrixAt(ci++, m);
      }
      carIM.instanceMatrix.needsUpdate = true;
      busIM.instanceMatrix.needsUpdate = true;
    },
  };
}
