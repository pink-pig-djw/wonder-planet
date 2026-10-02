import * as THREE from 'three';
import { R, elev, biome, world } from './world.js';
import { toon, outline, U, GLSL_COMMON, SHADE } from './shaders.js';
import { lerp } from './noise.js';

// Build an indexed unit icosphere (dedupe IcosahedronGeometry vertices)
export function icosphere(detail) {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const src = ico.attributes.position.array;
  const map = new Map();
  const pos = [];
  const index = new Uint32Array(src.length / 3);
  for (let i = 0; i < src.length / 3; i++) {
    const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
    const k = Math.round(x * 1e5) + ',' + Math.round(y * 1e5) + ',' + Math.round(z * 1e5);
    let id = map.get(k);
    if (id === undefined) { id = pos.length / 3; map.set(k, id); pos.push(x, y, z); }
    index[i] = id;
  }
  ico.dispose();
  return { pos: new Float32Array(pos), index };
}

const C = (h) => new THREE.Color(h);
const PAL = {
  floor: C(0xd9c690), beach: C(0xf7de9e), grassA: C(0x93d85c), grassB: C(0x6fc24d),
  forestA: C(0x44a453), forestB: C(0x2f8c47), desertA: C(0xf4c56c), desertB: C(0xe6a955),
  tundraA: C(0xaecb9c), tundraB: C(0xc9dbbb), rockA: C(0xa8928a), rockB: C(0x8c7c84),
  snow: C(0xf4f8ff), volcA: C(0x7a605a), volcB: C(0x54403f), lava: C(0xff6a1f),
};
const _c = new THREE.Color();

export function terrainColor(x, y, z, e, out) {
  const b = biome(x, y, z, e);
  const t = b.n * 0.5 + 0.5;
  switch (b.type) {
    case 'ocean': out.copy(PAL.floor); break;
    case 'beach': out.copy(PAL.beach); break;
    case 'grass': out.copy(PAL.grassA).lerp(PAL.grassB, t); break;
    case 'forest': out.copy(PAL.forestA).lerp(PAL.forestB, t); break;
    case 'desert': out.copy(PAL.desertA).lerp(PAL.desertB, t); break;
    case 'tundra': out.copy(PAL.tundraA).lerp(PAL.tundraB, t); break;
    case 'rock': out.copy(PAL.rockA).lerp(PAL.rockB, t); break;
    default: out.copy(PAL.snow);
  }
  return b;
}

export function buildTerrain() {
  const { pos: dirs, index } = icosphere(84);
  const n = dirs.length / 3;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const farm = new Float32Array(n), emit = new Float32Array(n);
  const V = world.volcano;
  for (let i = 0; i < n; i++) {
    const x = dirs[i * 3], y = dirs[i * 3 + 1], z = dirs[i * 3 + 2];
    const e = elev(x, y, z);
    const r = R + Math.max(e, -0.9);
    pos[i * 3] = x * r; pos[i * 3 + 1] = y * r; pos[i * 3 + 2] = z * r;
    const b = terrainColor(x, y, z, e, _c);
    if (V) {
      const dot = x * V.c.x + y * V.c.y + z * V.c.z;
      if (dot > V.cosOuter) {
        const t = (Math.acos(Math.min(1, dot)) * R) / V.rad;
        if (t < 0.8 && e > 0.015) _c.copy(PAL.volcA).lerp(PAL.volcB, Math.min(1, (0.8 - t) * 1.6));
        if (t < 0.13) { _c.copy(PAL.lava); emit[i] = 1; }
      }
    }
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    farm[i] = b.farm;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aFarm', new THREE.BufferAttribute(farm, 1));
  g.setAttribute('aEmit', new THREE.BufferAttribute(emit, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeVertexNormals();
  g.setAttribute('oNormal', g.attributes.normal);
  g.computeBoundingSphere();

  const cityC = [], cityE = [], cityN = [];
  for (let i = 0; i < 8; i++) {
    const c = world.cities[i];
    cityC.push(c ? new THREE.Vector4(c.c.x, c.c.y, c.c.z, c.rad) : new THREE.Vector4());
    cityE.push(c ? c.E.clone() : new THREE.Vector3());
    cityN.push(c ? c.N.clone() : new THREE.Vector3());
  }
  const mat = toon({
    vertexColors: true,
    emitCol: 0xff7a22,
    defines: { TERRAIN: '', EMIT_ATTR: '' },
    uniforms: {
      uCityC: { value: cityC }, uCityE: { value: cityE }, uCityN: { value: cityN },
      uCityCount: { value: world.cities.length },
    },
  });
  const mesh = new THREE.Mesh(g, mat);
  const out = new THREE.Mesh(g, outline({ w: 0.0, s: 0.0016, max: 0.05 }));
  const grp = new THREE.Group();
  grp.add(mesh, out);
  grp.userData.mesh = mesh;
  return grp;
}

// --------------------------- Water ---------------------------
const WVS = /* glsl */ `
uniform float uTime;
attribute float aDepth;
varying float vDepth; varying vec3 vW; varying vec3 vObj; varying vec3 vN;
void main(){
  vec3 d = normalize(position);
  float w = sin(dot(d, vec3(37.0, 11.0, 23.0)) + uTime * 1.3) * 0.5 + sin(dot(d, vec3(-13.0, 41.0, 7.0)) + uTime * 1.7) * 0.5;
  vec3 pos = position + d * w * 0.008;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vW = wp.xyz; vObj = position; vDepth = aDepth; vN = normalize(mat3(modelMatrix) * d);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WFS = /* glsl */ `
uniform float uTime; uniform float uR;
varying float vDepth; varying vec3 vW; varying vec3 vObj; varying vec3 vN;
${GLSL_COMMON}
${SHADE}
void main(){
  vec3 d = normalize(vObj);
  float dep = vDepth;
  vec3 col = vec3(0.56, 0.94, 0.9);
  col = mix(col, vec3(0.27, 0.80, 0.90), smoothstep(0.045, 0.055, dep));
  col = mix(col, vec3(0.17, 0.60, 0.88), smoothstep(0.17, 0.19, dep));
  col = mix(col, vec3(0.13, 0.43, 0.78), smoothstep(0.48, 0.5, dep));
  float foam = 1.0 - smoothstep(0.0, 0.004, dep - 0.012 - 0.006 * sin(uTime * 2.0 + d.x * 70.0 + d.z * 55.0));
  float wl = fract(dep * 9.0 - uTime * 0.3);
  float waveLine = smoothstep(0.0, 0.03, wl) * (1.0 - smoothstep(0.07, 0.1, wl)) * (1.0 - smoothstep(0.04, 0.12, dep));
  col = mix(col, vec3(1.0), max(foam, waveLine * 0.8));
  // cartoon wave strokes
  vec3 a = abs(d); vec2 uv; float face;
  if (a.x > a.y && a.x > a.z) { uv = d.yz / a.x; face = sign(d.x); }
  else if (a.y > a.z) { uv = d.xz / a.y; face = 2.0 * sign(d.y); }
  else { uv = d.xy / a.z; face = 3.0 * sign(d.z); }
  uv *= uR * 4.0;
  uv.x += uTime * 0.05;
  vec2 cell = floor(uv); vec2 fr = fract(uv);
  float h = hash13(vec3(cell, face));
  vec2 p = (fr - 0.5 - (vec2(hash13(vec3(cell, face + 3.0)), h) - 0.5) * 0.4) * vec2(1.0, 1.5);
  float arc = abs(length(p - vec2(0.0, 0.22)) - 0.22);
  float stroke = (1.0 - smoothstep(0.018, 0.03, arc)) * step(p.y, 0.1) * step(abs(p.x), 0.2);
  float vis = step(0.72, h) * smoothstep(0.2, 0.5, sin(uTime * 0.7 + h * 40.0));
  col = mix(col, vec3(0.86, 0.97, 1.0), stroke * vis * smoothstep(0.12, 0.2, dep));
  float ice = smoothstep(0.88, 0.89, abs(d.y) + 0.025 * sin(d.x * 23.0) * cos(d.z * 19.0));
  col = mix(col, vec3(0.9, 0.96, 1.0), ice);
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 H = normalize(uSunDir + V);
  vec3 np = normalize(n + 0.05 * vec3(sin(d.y * 140.0 + uTime), sin(d.z * 150.0 - uTime * 1.3), sin(d.x * 130.0 + uTime * 0.7)));
  float sp = pow(max(dot(np, H), 0.0), 220.0);
  vec3 c = toonShade(col, n, vW, 0.0, vec3(0.0));
  c += step(0.45, sp) * (1.0 - ice) * vec3(1.0, 0.98, 0.9) * 0.7 * smoothstep(-0.05, 0.1, dot(normalize(vW), uSunDir));
  gl_FragColor = vec4(c, 1.0);
}`;

export function buildWater() {
  const { pos: dirs, index } = icosphere(64);
  const n = dirs.length / 3;
  const pos = new Float32Array(n * 3), dep = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = dirs[i * 3], y = dirs[i * 3 + 1], z = dirs[i * 3 + 2];
    pos[i * 3] = x * R; pos[i * 3 + 1] = y * R; pos[i * 3 + 2] = z * R;
    dep[i] = -elev(x, y, z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(dirs, 3));
  g.setAttribute('oNormal', new THREE.BufferAttribute(dirs, 3));
  g.setAttribute('aDepth', new THREE.BufferAttribute(dep, 1));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U), vertexShader: WVS, fragmentShader: WFS });
  const mesh = new THREE.Mesh(g, mat);
  const out = new THREE.Mesh(g, outline({ w: 0.0, s: 0.003, max: 0.09 }));
  const grp = new THREE.Group();
  grp.add(mesh, out);
  grp.userData.mesh = mesh;
  return grp;
}

// --------------------------- Atmosphere ---------------------------
export function buildAtmosphere() {
  const g = new THREE.SphereGeometry(R * 1.15, 96, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix)*normal);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 V = normalize(vW - cameraPosition);
        float ndv = max(dot(normalize(vN), V), 0.0);
        float k = smoothstep(0.0, 0.5, ndv);
        float band = k * k * 0.55 + (smoothstep(0.16, 0.18, k) - smoothstep(0.22, 0.24, k)) * 0.3 + smoothstep(0.55, 0.6, k) * 0.12;
        float s = dot(normalize(vW), uSunDir);
        vec3 day = vec3(0.45, 0.78, 1.0);
        vec3 dusk = vec3(1.0, 0.58, 0.35);
        vec3 night = vec3(0.30, 0.22, 0.62);
        vec3 c = mix(night, day, smoothstep(-0.25, 0.25, s));
        c = mix(c, dusk, exp(-s * s * 14.0) * 0.8);
        float fade = (1.0 - smoothstep(0.85, 1.0, ndv)) * (1.0 - 0.85 * (1.0 - smoothstep(11.0, 12.6, length(cameraPosition))));
        gl_FragColor = vec4(c * band * mix(0.45, 1.0, smoothstep(-0.3, 0.2, s)) * fade, 1.0);
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(g, mat);
}
