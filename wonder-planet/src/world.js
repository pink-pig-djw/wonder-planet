import * as THREE from 'three';
import { makeNoise3, fbm, ridged, smooth, clamp, mulberry32 } from './noise.js';
import { randDir, tangentFrame } from './geo.js';

export const R = 10;
const NC = makeNoise3(11), NR = makeNoise3(23), NM = makeNoise3(37), ND = makeNoise3(41),
  NW = makeNoise3(53), NF = makeNoise3(67), NT = makeNoise3(79);

const NB = makeNoise3(91);
export function baseElev(x, y, z) {
  const wx = NW(x * 1.6, y * 1.6, z * 1.6) * 0.2;
  const wy = NW(x * 1.6 + 5.3, y * 1.6 - 2.1, z * 1.6 + 1.3) * 0.2;
  const wz = NW(x * 1.6 - 3.7, y * 1.6 + 4.2, z * 1.6 - 6.1) * 0.2;
  const px = x + wx, py = y + wy, pz = z + wz;
  const c = fbm(NC, px * 1.2 + 2.1, py * 1.2, pz * 1.2, 5, 2.0, 0.5) + 0.04;
  let e;
  if (c < 0) e = c * 1.4 - 0.015;
  else {
    e = 0.008 + c * 0.4;
    const rg = ridged(NR, px * 1.75, py * 1.75, pz * 1.75, 3);
    const blob = Math.max(0, fbm(NB, px * 1.6, py * 1.6, pz * 1.6, 3));
    const mm = smooth(0.07, 0.3, c) * smooth(-0.12, 0.28, NM(x * 1.2 + 3, y * 1.2, z * 1.2));
    e += (Math.pow(rg, 2.0) * 0.72 + blob * 0.55) * mm;
    e += 0.022 * (ND(x * 9, y * 9, z * 9) * 0.5 + 0.5) * smooth(0.0, 0.1, c);
  }
  return e;
}

export const world = { cities: [], flats: [], volcano: null, features: {} };

export function elev(x, y, z) {
  let e = baseElev(x, y, z);
  const V = world.volcano;
  if (V) {
    const dot = x * V.c.x + y * V.c.y + z * V.c.z;
    if (dot > V.cosOuter) {
      const t = (Math.acos(Math.min(1, dot)) * R) / V.rad;
      const cone = 1.0 * Math.pow(Math.max(0, 1 - t), 1.2) - 0.18 * t + 0.03;
      if (cone > e) e = cone;
      if (t < 0.16) e -= 0.34 * (1 - (t / 0.16) * (t / 0.16));
    }
  }
  for (let i = 0; i < world.flats.length; i++) {
    const f = world.flats[i];
    const dot = x * f.c.x + y * f.c.y + z * f.c.z;
    if (dot < f.cosOuter) continue;
    const ang = Math.acos(Math.min(1, dot)) * R;
    const w = 1 - smooth(f.r0, f.r1, ang);
    e += (f.h - e) * w;
  }
  return e;
}
export const elevV = (v) => elev(v.x, v.y, v.z);
export const surfR = (v) => R + Math.max(elevV(v), 0);

export function moisture(x, y, z) { return fbm(NM, x * 1.6 + 9.1, y * 1.6, z * 1.6, 3); }
export function temperature(x, y, z, e) {
  return 1 - Math.pow(Math.abs(y), 1.7) * 1.05 - Math.max(e, 0) * 0.7 + 0.08 * NT(x * 3, y * 3, z * 3);
}
export function farmMask(x, y, z) { return smooth(0.08, 0.28, NF(x * 2.1, y * 2.1, z * 2.1)); }

// biome classification shared by terrain colouring & decoration placement
export function biome(x, y, z, e) {
  const temp = temperature(x, y, z, e);
  const moist = moisture(x, y, z);
  const n = ND(x * 6, y * 6, z * 6);
  let type;
  if (Math.abs(y) > 0.9 + 0.03 * n) type = 'snow';
  else if (e < 0) type = 'ocean';
  else if (temp < 0.06 || e > 0.56 + 0.06 * n) type = 'snow';
  else if (e > 0.33 + 0.05 * n) type = 'rock';
  else if (e < 0.02) type = temp > 0.25 ? 'beach' : 'tundra';
  else if (moist < -0.17 && temp > 0.42) type = 'desert';
  else if (temp < 0.22) type = 'tundra';
  else if (moist > 0.09) type = 'forest';
  else type = 'grass';
  let farm = 0;
  if (type === 'grass' && e < 0.2) farm = farmMask(x, y, z);
  return { type, temp, moist, farm, n };
}

const _v = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3();
function slopeAt(d, eps = 0.02) {
  tangentFrame(d, _e, _n);
  let m = 0;
  const e0 = baseElev(d.x, d.y, d.z);
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    _v.copy(d).addScaledVector(_e, a * eps).addScaledVector(_n, b * eps).normalize();
    m = Math.max(m, Math.abs(baseElev(_v.x, _v.y, _v.z) - e0));
  }
  return m;
}
export function angDist(a, b) { return Math.acos(clamp(a.dot(b), -1, 1)) * R; }

// offset a direction by (u, v) units in its tangent frame (gnomonic)
export function offsetDir(c, e, n, u, v, out = new THREE.Vector3()) {
  return out.copy(c).addScaledVector(e, u / R).addScaledVector(n, v / R).normalize();
}

const CITY_NAMES = [
  ['星尘城', 'STARDUST CITY'], ['棉花糖港', 'MARSHMALLOW PORT'], ['齿轮镇', 'GEARTOWN'],
  ['汽水湾', 'SODA BAY'], ['布丁镇', 'PUDDING TOWN'], ['咕噜山城', 'GURGLE HILLS'],
  ['风铃村', 'WINDCHIME'], ['蜂蜜坡', 'HONEY SLOPE'],
];

export function generateWorld(seed = 7) {
  const rng = mulberry32(seed);
  world.rng = rng;
  // ---------- cities ----------
  const cands = [];
  for (let i = 0; i < 6000; i++) {
    const d = randDir(rng);
    if (Math.abs(d.y) > 0.7) continue;
    const e = baseElev(d.x, d.y, d.z);
    if (e < 0.03 || e > 0.22) continue;
    if (slopeAt(d) > 0.05) continue;
    cands.push({ d, e });
  }
  const cities = [];
  for (const c of cands) {
    if (cities.length >= 8) break;
    if (cities.some((o) => angDist(o.c, c.d) < 4.6)) continue;
    cities.push({ c: c.d.clone(), e0: c.e });
  }
  cities.forEach((city, i) => {
    city.rad = i === 0 ? 1.05 : 0.6 + rng() * 0.32;
    city.h = clamp(city.e0, 0.035, 0.18);
    const { e, n } = tangentFrame(city.c);
    city.E = e.clone(); city.N = n.clone();
    city.name = CITY_NAMES[i][0]; city.en = CITY_NAMES[i][1];
    // coastal?
    let coast = null;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const dist = city.rad + 0.6;
      offsetDir(city.c, city.E, city.N, Math.cos(a) * dist, Math.sin(a) * dist, _v);
      if (baseElev(_v.x, _v.y, _v.z) < -0.02) { coast = a; break; }
    }
    city.coastAngle = coast;
    world.flats.push({ c: city.c, r0: city.rad + 0.08, r1: city.rad + 0.55, h: city.h, cosOuter: Math.cos((city.rad + 0.6) / R) });
  });
  world.cities = cities;

  const farFromCities = (d, m) => cities.every((c) => angDist(c.c, d) > c.rad + m);

  // ---------- volcano (ocean island) ----------
  for (let i = 0; i < 3000; i++) {
    const d = randDir(rng);
    if (Math.abs(d.y) > 0.55) continue;
    if (baseElev(d.x, d.y, d.z) > -0.25) continue;
    if (!farFromCities(d, 3)) continue;
    world.volcano = { c: d.clone(), rad: 1.25, cosOuter: Math.cos((1.25 * 1.5) / R) };
    break;
  }

  const F = world.features;
  const findPoint = (n, test) => {
    for (let i = 0; i < n; i++) { const d = randDir(rng); if (test(d)) return d.clone(); }
    return null;
  };

  // ---------- rocket pad near a coastal city ----------
  const portCity = cities.find((c) => c.coastAngle !== null && cities.indexOf(c) > 0) || cities[1] || cities[0];
  F.portCity = portCity;
  for (let i = 0; i < 400 && !F.rocket; i++) {
    const a = rng() * Math.PI * 2, dist = portCity.rad + 0.9 + rng() * 1.2;
    const d = offsetDir(portCity.c, portCity.E, portCity.N, Math.cos(a) * dist, Math.sin(a) * dist, new THREE.Vector3());
    const e = baseElev(d.x, d.y, d.z);
    if (e < 0.03 || e > 0.25 || slopeAt(d) > 0.07 || !farFromCities(d, 0.7)) continue;
    F.rocket = { d, h: e };
  }
  if (!F.rocket) {
    const d = findPoint(5000, (d) => { const e = baseElev(d.x, d.y, d.z); return e > 0.03 && e < 0.25 && farFromCities(d, 0.8); });
    F.rocket = { d, h: baseElev(d.x, d.y, d.z) };
  }
  world.flats.push({ c: F.rocket.d, r0: 0.3, r1: 0.6, h: F.rocket.h, cosOuter: Math.cos(0.65 / R) });

  // ---------- observatory on a mountain ----------
  F.observatory = findPoint(20000, (d) => {
    const e = baseElev(d.x, d.y, d.z);
    return e > 0.4 && e < 0.62 && Math.abs(d.y) < 0.75 && farFromCities(d, 0.6);
  });
  if (F.observatory) {
    const h = baseElev(F.observatory.x, F.observatory.y, F.observatory.z);
    world.flats.push({ c: F.observatory, r0: 0.12, r1: 0.3, h, cosOuter: Math.cos(0.32 / R) });
  }

  // ---------- pyramids in a desert ----------
  F.pyramids = findPoint(30000, (d) => {
    const e = baseElev(d.x, d.y, d.z);
    if (e < 0.03 || e > 0.2) return false;
    return biome(d.x, d.y, d.z, e).type === 'desert' && farFromCities(d, 0.8) && slopeAt(d) < 0.06;
  });
  if (F.pyramids) {
    const h = baseElev(F.pyramids.x, F.pyramids.y, F.pyramids.z);
    world.flats.push({ c: F.pyramids, r0: 0.4, r1: 0.7, h, cosOuter: Math.cos(0.75 / R) });
  }

  // ---------- farm (UFO zone) ----------
  F.farm = findPoint(30000, (d) => {
    const e = baseElev(d.x, d.y, d.z);
    if (e < 0.03 || e > 0.18) return false;
    const b = biome(d.x, d.y, d.z, e);
    return b.type === 'grass' && b.farm > 0.9 && farFromCities(d, 0.8);
  });

  // ---------- castle on a hill ----------
  F.castle = findPoint(30000, (d) => {
    const e = baseElev(d.x, d.y, d.z);
    if (e < 0.2 || e > 0.34) return false;
    const b = biome(d.x, d.y, d.z, e);
    return (b.type === 'grass' || b.type === 'forest') && farFromCities(d, 1.0) && slopeAt(d) < 0.08;
  });
  if (F.castle) {
    const h = baseElev(F.castle.x, F.castle.y, F.castle.z) + 0.03;
    world.flats.push({ c: F.castle, r0: 0.2, r1: 0.45, h, cosOuter: Math.cos(0.5 / R) });
  }
  return world;
}
