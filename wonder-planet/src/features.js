import * as THREE from 'three';
import { R, world, elev, baseElev, offsetDir } from './world.js';
import { toon, U } from './shaders.js';
import { part, merge, basisAt, randDir, tangentFrame } from './geo.js';
import { addMesh, addInstanced } from './mk.js';
import { setPose } from './air.js';

function lighthouseGroup() {
  const grp = new THREE.Group();
  const P = [part(new THREE.IcosahedronGeometry(0.09, 1), 0x9c9aa8, { s: [1.2, 0.5, 1.2], t: [0, 0.01, 0] })];
  for (let k = 0; k < 5; k++) {
    const r0 = 0.05 - k * 0.003, r1 = 0.05 - (k + 1) * 0.003;
    P.push(part(new THREE.CylinderGeometry(r1, r0, 0.062, 14), k % 2 ? 0xe63946 : 0xffffff, { t: [0, 0.03 + k * 0.062, 0] }));
  }
  P.push(part(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 14), 0x1d1631, { t: [0, 0.315, 0] }));
  P.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), 0xfff3a0, { emit: 1, t: [0, 0.345, 0] }));
  P.push(part(new THREE.ConeGeometry(0.042, 0.055, 12), 0xe63946, { t: [0, 0.397, 0] }));
  addMesh(grp, merge(P), toon({ vertexColors: true, emitCol: 0xfff3a0, defines: { EMIT_ATTR: '' } }), { outline: { max: 0.005 } });
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uNight: { value: 0 } }, U),
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uNight; void main(){ float a = pow(vUv.y, 1.6) * uNight * 0.42; gl_FragColor = vec4(vec3(1.0, 0.95, 0.6) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Group();
  beam.position.y = 0.345;
  for (const s of [1, -1]) beam.add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.5, 18, 1, true).translate(0, -0.75, 0).rotateZ(s * Math.PI / 2), mat));
  grp.add(beam);
  return { grp, beam, mat };
}

export function buildFeatures(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const F = world.features;
  const anim = [];
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  // ---------------- lighthouses on coasts near cities
  const lighthouses = [];
  for (const city of world.cities) {
    if (city.coastAngle === null || lighthouses.length >= 4) continue;
    for (let tries = 0; tries < 300; tries++) {
      const a = city.coastAngle + (rng() - 0.5) * 1.6, r = city.rad + 0.25 + rng() * 1.0;
      const d = offsetDir(city.c, city.E, city.N, Math.cos(a) * r, Math.sin(a) * r, new THREE.Vector3());
      const e = elev(d.x, d.y, d.z);
      if (e < 0.012 || e > 0.09) continue;
      const { e: E, n: N } = tangentFrame(d);
      let wet = false;
      for (let k = 0; k < 8 && !wet; k++) {
        const b = (k / 8) * Math.PI * 2;
        tmp.copy(d).addScaledVector(E, Math.cos(b) * 0.025).addScaledVector(N, Math.sin(b) * 0.025).normalize();
        if (elev(tmp.x, tmp.y, tmp.z) < -0.03) wet = true;
      }
      if (!wet || world.cities.some((c) => c.c.angleTo(d) * R < c.rad + 0.1)) continue;
      const L = lighthouseGroup();
      setPose(L.grp, d.clone().multiplyScalar(R + e - 0.01), d, N, 1);
      grp.add(L.grp);
      L.d = d;
      lighthouses.push(L);
      break;
    }
  }

  // ---------------- pyramids
  if (F.pyramids) {
    const d = F.pyramids;
    const { e: E, n: N } = tangentFrame(d);
    const P = [];
    for (const [u, v, r, h] of [[0, 0, 0.22, 0.26], [0.42, 0.18, 0.16, 0.19], [-0.3, 0.32, 0.12, 0.14]]) {
      P.push(part(new THREE.ConeGeometry(r, h, 4).rotateY(Math.PI / 4), 0xf3c97a, { t: [u, h / 2 - 0.005, v] }));
      P.push(part(new THREE.ConeGeometry(r * 0.25, h * 0.25, 4).rotateY(Math.PI / 4), 0xffe08a, { t: [u, h - h * 0.125 + 0.0, v] }));
    }
    const g = new THREE.Group();
    addMesh(g, merge(P), toon({ vertexColors: true }), { outline: { max: 0.006 } });
    const e = elev(d.x, d.y, d.z);
    setPose(g, d.clone().multiplyScalar(R + e), d, N, 1);
    grp.add(g);
  }

  // ---------------- castle
  if (F.castle) {
    const d = F.castle;
    const { n: N } = tangentFrame(d);
    const P = [];
    const wallC = 0xe2dcef, roofC = 0x4361ee;
    for (const [x, z, w, dd] of [[0, 0.18, 0.36, 0.025], [0, -0.18, 0.36, 0.025], [0.18, 0, 0.025, 0.36], [-0.18, 0, 0.025, 0.36]]) {
      P.push(part(new THREE.BoxGeometry(w, 0.08, dd), wallC, { t: [x, 0.04, z] }));
      const n = 7;
      for (let k = 0; k < n; k++) {
        const f = (k / (n - 1) - 0.5) * 0.3;
        P.push(part(new THREE.BoxGeometry(0.022, 0.02, 0.03), wallC, { t: [w > dd ? f : x, 0.09, w > dd ? z : f] }));
      }
    }
    for (const [x, z] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) {
      P.push(part(new THREE.CylinderGeometry(0.042, 0.046, 0.15, 12), wallC, { t: [x, 0.075, z] }));
      P.push(part(new THREE.ConeGeometry(0.055, 0.09, 12), roofC, { t: [x, 0.195, z] }));
    }
    P.push(part(new THREE.BoxGeometry(0.15, 0.17, 0.13), 0xd3cbe6, { t: [0, 0.085, -0.02] }));
    P.push(part(new THREE.CylinderGeometry(0.038, 0.04, 0.31, 12), wallC, { t: [0.04, 0.155, 0.0] }));
    P.push(part(new THREE.ConeGeometry(0.052, 0.12, 12), 0xff6b9a, { t: [0.04, 0.37, 0.0] }));
    P.push(part(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 4), 0x6b4a33, { t: [0.04, 0.46, 0] }));
    P.push(part(new THREE.BoxGeometry(0.004, 0.025, 0.045), 0xff6b9a, { t: [0.04, 0.485, 0.024] }));
    P.push(part(new THREE.BoxGeometry(0.05, 0.06, 0.02), 0x5a3e2b, { t: [0, 0.03, 0.19] }));
    for (const [x, z] of [[0.04, 0.072], [-0.04, 0.072], [0.0, 0.072]]) P.push(part(new THREE.BoxGeometry(0.018, 0.026, 0.01), 0xffd36b, { emit: 1, t: [x, 0.12, 0.046 + z * 0] }));
    const g = new THREE.Group();
    addMesh(g, merge(P), toon({ vertexColors: true, emitCol: 0xffd36b, defines: { EMIT_ATTR: '' } }), { outline: { max: 0.006 } });
    const e = elev(d.x, d.y, d.z);
    setPose(g, d.clone().multiplyScalar(R + e - 0.005), d, N, 1.15);
    grp.add(g);
    F.castleName = '云朵城堡';
  }

  // ---------------- observatory
  if (F.observatory) {
    const d = F.observatory;
    const { n: N } = tangentFrame(d);
    const g = new THREE.Group();
    addMesh(g, merge([
      part(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 20), 0xf1f3f8, { t: [0, 0.04, 0] }),
      part(new THREE.BoxGeometry(0.04, 0.05, 0.02), 0x4a4e5c, { t: [0, 0.025, 0.115] }),
    ]), toon({ vertexColors: true }), { outline: { max: 0.005 } });
    const dome = new THREE.Group();
    dome.position.y = 0.08;
    addMesh(dome, merge([
      part(new THREE.SphereGeometry(0.105, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xffffff),
      part(new THREE.BoxGeometry(0.035, 0.1, 0.03).translate(0, 0.05, 0).rotateX(0.5), 0x2b2b3a, { t: [0, 0, 0.08] }),
      part(new THREE.CylinderGeometry(0.014, 0.018, 0.12, 10).rotateX(Math.PI / 2 - 0.6), 0xffd23f, { t: [0, 0.08, 0.09] }),
    ]), toon({ vertexColors: true }), { outline: { max: 0.005 } });
    g.add(dome);
    const e = elev(d.x, d.y, d.z);
    setPose(g, d.clone().multiplyScalar(R + e - 0.005), d, N, 1.1);
    grp.add(g);
    anim.push((t) => { dome.rotation.y = Math.sin(t * 0.15) * 2.5; });
  }

  // ---------------- volcano smoke + lava bombs
  let volc = null;
  if (world.volcano) {
    const c = world.volcano.c;
    const { e: E, n: N } = tangentFrame(c);
    const top = c.clone().multiplyScalar(R + elev(c.x, c.y, c.z) + 0.04);
    const NP = 30;
    const puffs = [];
    for (let i = 0; i < NP; i++) puffs.push({ m: new THREE.Matrix4(), ph: i / NP, dx: (rng() - 0.5), dz: (rng() - 0.5) });
    const im = addInstanced(grp, new THREE.SphereGeometry(1, 10, 8), toon({ color: 0xb4b0c4 }), puffs, { dynamic: true, outline: { w: 0.004, max: 0.012 } });
    const bombs = [];
    for (let i = 0; i < 8; i++) bombs.push({ m: new THREE.Matrix4(), ph: rng(), a: rng() * 6.28, v: 0.5 + rng() * 0.4 });
    const bim = addInstanced(grp, merge([part(new THREE.IcosahedronGeometry(1, 1), 0xff7a22, { emit: 1 })]), toon({ vertexColors: true, emitCol: 0xff8a2a, defines: { EMIT_ATTR: '' } }), bombs, { dynamic: true, outline: { max: 0.004 } });
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    volc = (t) => {
      for (let i = 0; i < NP; i++) {
        const q = puffs[i];
        const k = (t * 0.07 + q.ph) % 1;
        p.copy(top).addScaledVector(c, k * 1.6).addScaledVector(E, q.dx * k * 0.5 + k * k * 0.6).addScaledVector(N, q.dz * k * 0.5);
        const s = (0.05 + k * 0.2) * (k > 0.8 ? (1 - k) / 0.2 : 1) * Math.min(1, k * 8);
        basisAt(m, p, c, N, s);
        im.setMatrixAt(i, m);
      }
      im.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < bombs.length; i++) {
        const b = bombs[i];
        const k = (t * 0.35 + b.ph) % 1;
        const tt = k * 2.2;
        const h = b.v * tt - 0.5 * 0.55 * tt * tt;
        if (h < 0) { m.makeScale(0, 0, 0); bim.setMatrixAt(i, m); continue; }
        p.copy(top).addScaledVector(c, h).addScaledVector(E, Math.cos(b.a) * tt * 0.12).addScaledVector(N, Math.sin(b.a) * tt * 0.12);
        basisAt(m, p, c, N, 0.018);
        bim.setMatrixAt(i, m);
      }
      bim.instanceMatrix.needsUpdate = true;
    };
  }

  // ---------------- rainbow near the castle (or a city)
  {
    const base = F.castle || world.cities[1]?.c || world.cities[0].c;
    const { e: E, n: N } = tangentFrame(base);
    const d = base.clone().addScaledVector(E, 0.07).addScaledVector(N, 0.03).normalize();
    const e = Math.max(elev(d.x, d.y, d.z), 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, U),
      vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uSunDir; varying vec3 vP; varying vec3 vW;
        void main(){
          float r = (length(vP.xy) - 0.62) / 0.24;
          int b = int(clamp(floor(r * 6.0), 0.0, 5.0));
          vec3 cols[6] = vec3[6](vec3(0.62,0.4,0.95), vec3(0.3,0.55,1.0), vec3(0.3,0.85,0.95), vec3(0.45,0.88,0.4), vec3(1.0,0.85,0.25), vec3(1.0,0.4,0.4));
          vec3 c = cols[b];
          float day = smoothstep(-0.05, 0.2, dot(normalize(vW), uSunDir));
          float a = 0.8 * day * smoothstep(0.0, 0.12, vP.y);
          float edge = abs(fract(r * 6.0) - 0.5);
          c = mix(c * 0.9, c, step(0.05, 0.5 - edge));
          if (a < 0.01) discard;
          gl_FragColor = vec4(c, a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const rb = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.86, 64, 1, 0, Math.PI), mat);
    const g = new THREE.Group();
    g.add(rb);
    setPose(g, d.clone().multiplyScalar(R + e - 0.05), d, E, 1);
    grp.add(g);
  }

  // ---------------- fireworks over the biggest city at night
  const fw = (() => {
    const city = world.cities[0];
    const NB = 6, NPB = 56, NPT = NB * NPB;
    const pos = new Float32Array(NPT * 3), col = new Float32Array(NPT * 3), alpha = new Float32Array(NPT);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPR: { value: Math.min(devicePixelRatio, 2) } },
      vertexShader: /* glsl */ `attribute vec3 aCol; attribute float aAlpha; uniform float uPR; varying vec3 vC; varying float vA;
        void main(){ vC = aCol; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(0.09 * uPR * 400.0 / -mv.z, 1.0, 26.0) * step(0.01, aAlpha); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `varying vec3 vC; varying float vA;
        void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p); float a = (1.0 - smoothstep(0.15, 0.5, r)) * vA; if (a < 0.02) discard;
          gl_FragColor = vec4(mix(vC, vec3(1.0), 1.0 - smoothstep(0.0, 0.2, r)) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    grp.add(pts);
    const bursts = [];
    for (let b = 0; b < NB; b++) {
      const v = [];
      for (let k = 0; k < NPB; k++) v.push(randDir(rng, new THREE.Vector3()).multiplyScalar(0.18 + rng() * 0.05));
      bursts.push({ t0: -10, c: new THREE.Vector3(), v, color: new THREE.Color() });
    }
    const up = city.c.clone();
    const cw = new THREE.Vector3(), cc = new THREE.Color(), WARM = new THREE.Color(1, 0.9, 0.6);
    return (t) => {
      planet.localToWorld(cw.copy(city.c).multiplyScalar(R)).normalize();
      const night = cw.dot(U.uSunDir.value) < -0.08;
      for (let b = 0; b < NB; b++) {
        const B = bursts[b];
        let age = t - B.t0;
        if (age > 2.4 && night && Math.random() < 0.02) {
          B.t0 = t; age = 0;
          const u = (Math.random() - 0.5) * city.rad * 1.4, v = (Math.random() - 0.5) * city.rad * 1.4;
          offsetDir(city.c, city.E, city.N, u, v, B.c).multiplyScalar(R + city.h + 0.9 + Math.random() * 0.45);
          B.color.setHSL(Math.random(), 0.95, 0.62);
        }
        for (let k = 0; k < NPB; k++) {
          const i = b * NPB + k;
          if (age < 0 || age > 2.4) { alpha[i] = 0; continue; }
          const s = 1 - Math.exp(-age * 2.4);
          const vv = B.v[k];
          pos[i * 3] = B.c.x + vv.x * s * 1.6 - up.x * 0.06 * age * age;
          pos[i * 3 + 1] = B.c.y + vv.y * s * 1.6 - up.y * 0.06 * age * age;
          pos[i * 3 + 2] = B.c.z + vv.z * s * 1.6 - up.z * 0.06 * age * age;
          cc.copy(B.color).lerp(WARM, Math.max(0, 0.4 - age) * 1.5);
          col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
          alpha[i] = Math.max(0, 1 - age / 2.4) * (k % 3 === 0 ? 0.7 + 0.3 * Math.sin(age * 30 + k) : 1);
        }
      }
      g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
    };
  })();

  const sun = U.uSunDir.value;
  return {
    grp,
    update(t) {
      for (const L of lighthouses) {
        L.grp.getWorldPosition(tmp);
        const day = THREE.MathUtils.smoothstep(tmp.normalize().dot(sun), -0.2, 0.1);
        L.mat.uniforms.uNight.value = 1 - day;
        L.beam.rotation.y = t * 1.1;
      }
      if (volc) volc(t);
      fw(t);
      for (const a of anim) a(t);
    },
  };
}
