import * as THREE from 'three';
import { R, world, elev } from './world.js';
import { toon, U } from './shaders.js';
import { part, merge, basisAt, randDir, tangentFrame, rotAxis } from './geo.js';
import { addMesh, addInstanced } from './mk.js';
import { setPose, toWorld } from './air.js';

const smooth = (t) => t * t * (3 - 2 * t);
const flameMat = () => new THREE.ShaderMaterial({
  uniforms: Object.assign({ uPower: { value: 1 } }, U),
  vertexShader: /* glsl */ `varying vec2 vUv; uniform float uTime; uniform float uPower;
    void main(){ vUv = uv; vec3 p = position; p.xz *= 1.0 + 0.12 * sin(uTime * 40.0 + p.y * 20.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uTime; uniform float uPower;
    void main(){
      float y = vUv.y;
      vec3 c = mix(vec3(1.0, 0.35, 0.1), vec3(1.0, 0.85, 0.3), smoothstep(0.2, 0.7, y));
      c = mix(c, vec3(1.0, 1.0, 0.9), smoothstep(0.8, 0.95, y));
      float a = smoothstep(0.0, 0.35, y) * uPower;
      float band = step(0.5, fract(y * 6.0 - uTime * 8.0));
      c *= 0.9 + 0.15 * band;
      gl_FragColor = vec4(c * a, a);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// ------------------------------------------------------------- rocket
function rocketGeo() {
  const fins = [];
  for (let k = 0; k < 4; k++) {
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.13, -0.06), new THREE.Vector2(0.13, 0.08), new THREE.Vector2(0, 0.24)]);
    fins.push(part(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }).translate(0.1, 0.06, -0.01).rotateY((k / 4) * Math.PI * 2), 0xff5d5d));
  }
  return merge([
    part(new THREE.CylinderGeometry(0.11, 0.115, 0.62, 18), 0xf7f4ee, { t: [0, 0.41, 0] }),
    part(new THREE.CylinderGeometry(0.116, 0.116, 0.05, 18), 0xff5d5d, { t: [0, 0.3, 0] }),
    part(new THREE.ConeGeometry(0.11, 0.3, 18), 0xff5d5d, { t: [0, 0.87, 0] }),
    part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14).rotateX(Math.PI / 2), 0x6fc3ff, { t: [0, 0.56, 0.108], emit: 0.8 }),
    part(new THREE.TorusGeometry(0.047, 0.01, 6, 16), 0x9aa3b5, { t: [0, 0.56, 0.112] }),
    part(new THREE.CylinderGeometry(0.065, 0.09, 0.09, 14), 0x6c7a91, { t: [0, 0.07, 0] }),
    ...fins,
  ]);
}
function padGeo() {
  const P = [
    part(new THREE.CylinderGeometry(0.34, 0.38, 0.04, 32), 0xb8bfcc, { t: [0, 0.02, 0] }),
    part(new THREE.TorusGeometry(0.26, 0.012, 4, 40).rotateX(Math.PI / 2), 0xffd23f, { t: [0, 0.042, 0] }),
    part(new THREE.CylinderGeometry(0.11, 0.11, 0.045, 20), 0x4a4e5c, { t: [0, 0.024, 0] }),
  ];
  for (let k = 0; k < 8; k++) P.push(part(new THREE.BoxGeometry(0.06, 0.07, 0.06), k % 2 ? 0xff5d5d : 0xffffff, { t: [0.24, 0.035 + k * 0.07, 0] }));
  P.push(part(new THREE.BoxGeometry(0.16, 0.025, 0.03), 0xff5d5d, { t: [0.16, 0.44, 0] }));
  P.push(part(new THREE.SphereGeometry(0.02, 8, 6), 0xff3355, { t: [0.24, 0.62, 0], emit: 1 }));
  P.push(part(new THREE.BoxGeometry(0.1, 0.06, 0.08), 0xe9ecef, { t: [-0.3, 0.07, 0.15] }));
  P.push(part(new THREE.BoxGeometry(0.1, 0.02, 0.081), 0x2b3a67, { t: [-0.3, 0.08, 0.15], emit: 1 }));
  return merge(P);
}

export function buildRocket(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const F = world.features.rocket;
  const d = F.d.clone();
  const { e: E, n: N } = tangentFrame(d);
  const padH = R + F.h;
  const pad = new THREE.Group();
  addMesh(pad, padGeo(), toon({ vertexColors: true, emitCol: 0xfff0b8, defines: { EMIT_ATTR: '' } }), { outline: { max: 0.006 } });
  setPose(pad, d.clone().multiplyScalar(padH - 0.01), d, N, 0.6);
  grp.add(pad);

  const rocket = new THREE.Group();
  const body = addMesh(rocket, rocketGeo(), toon({ vertexColors: true, emitCol: 0xbfe6ff, defines: { EMIT_ATTR: '' } }), { outline: { max: 0.006 } });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.75, 14, 1, true).rotateX(Math.PI).translate(0, -0.37, 0), flameMat());
  rocket.add(flame);
  grp.add(rocket);

  // smoke puffs
  const NP = 70;
  const puffs = [];
  for (let i = 0; i < NP; i++) puffs.push({ m: new THREE.Matrix4().makeScale(0, 0, 0), age: 9, life: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0 });
  const puffIM = addInstanced(grp, new THREE.SphereGeometry(1, 10, 8), toon({ color: 0xf4f4f8 }), puffs, { dynamic: true, outline: { max: 0.006 } });
  let pi = 0;
  const spawn = (p, v, s, life) => { const q = puffs[pi++ % NP]; q.p.copy(p); q.v.copy(v); q.s = s; q.age = 0; q.life = life; };

  const SC = 0.32, Ro = R + 4.6, PERIOD = 56;
  const th0 = 0.55, thD = 0.55;
  const path = (time, P) => {
    // returns {phase, flame}
    const t = ((time % PERIOD) + PERIOD) % PERIOD;
    let th = 0, r = padH, phase = 'pad', pw = 0;
    if (t < 6) { phase = 'count'; pw = t > 5 ? (t - 5) * 0.6 : 0; }
    else if (t < 16) { const u = (t - 6) / 10; th = th0 * Math.pow(u, 4); r = padH + (Ro - padH) * smooth(u); phase = 'up'; pw = 1; }
    else if (t < 38) { const u = (t - 16) / 22; th = th0 + u * (Math.PI * 2 - th0 - thD); r = Ro; phase = 'orbit'; pw = 0; }
    else if (t < 48) { const u = (t - 38) / 10; th = Math.PI * 2 - thD * Math.pow(1 - u, 4); r = Ro + (padH - Ro) * smooth(u); phase = 'down'; pw = u > 0.35 ? 0.85 : 0; }
    else { phase = 'landed'; }
    rotAxis(d, E, -th, P).multiplyScalar(r);
    return { phase, pw, t };
  };
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), vel = new THREE.Vector3(), nose = new THREE.Vector3(), up = new THREE.Vector3(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const st = { phase: 'pad', t: 0, launches: 0, pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3() };
  let lastPhase = '';
  const m = new THREE.Matrix4();
  const obj = {
    kind: 'rocket', name: '好奇号火箭', obj: rocket,
    focus: { d: 1.4, el: 0.2, min: 0.3, max: 14, lift: 0.1 },
    info: () => {
      const t = st.t;
      switch (st.phase) {
        case 'count': return `发射倒计时 ${Math.max(1, Math.ceil(6 - t))}…`;
        case 'up': return '点火升空！冲出大气层';
        case 'orbit': return `绕星球轨道飞行中 · 第 ${st.launches} 次任务`;
        case 'down': return t > 41.5 ? '反推减速，准备垂直着陆' : '再入大气层，翻转姿态';
        default: return '平稳着陆，加油补给中';
      }
    },
    getWorldPose: (Pw, Fw, Uw) => { Pw.copy(st.pos); Fw.copy(st.fwd); Uw.copy(st.up); toWorld(planet, Pw, Fw, Uw); },
  };
  return {
    grp, obj,
    update(t, dt) {
      const info = path(t, P0);
      path(t + 0.05, P1);
      st.phase = info.phase; st.t = info.t;
      if (info.phase !== lastPhase) { if (info.phase === 'up') st.launches++; lastPhase = info.phase; }
      vel.subVectors(P1, P0);
      up.copy(P0).normalize();
      if (info.phase === 'pad' || info.phase === 'count' || info.phase === 'landed') nose.copy(d);
      else if (info.phase === 'down') {
        const u = (info.t - 38) / 10;
        const vdir = vel.lengthSq() > 1e-10 ? vel.clone().normalize() : d.clone();
        // flip: travel nose-first, then turn to nose-up for landing
        nose.copy(vdir).lerp(up, smooth(Math.min(1, u * 2.2))).normalize();
      } else nose.copy(vel.lengthSq() > 1e-10 ? vel.clone().normalize() : d);
      q.setFromUnitVectors(Y, nose);
      rocket.position.copy(P0);
      rocket.quaternion.copy(q);
      rocket.scale.setScalar(SC);
      st.pos.copy(P0).addScaledVector(nose, 0.12);
      st.up.copy(up);
      st.fwd.copy(nose).addScaledVector(up, -nose.dot(up));
      if (st.fwd.lengthSq() < 1e-6) st.fwd.copy(N);
      st.fwd.normalize();
      const flick = 0.85 + Math.random() * 0.3;
      flame.material.uniforms.uPower.value = info.pw;
      flame.scale.set(1, info.pw > 0 ? (0.6 + info.pw) * flick : 0.001, 1);
      flame.visible = info.pw > 0.01;
      // smoke
      const alt = P0.length() - padH;
      if (info.pw > 0.2 && alt < 2.2) {
        const tail = P0.clone().addScaledVector(nose, -0.2);
        for (let k = 0; k < 2; k++) {
          const v = randDir(Math.random, new THREE.Vector3()).multiplyScalar(0.25);
          if (alt < 0.15) v.addScaledVector(up, -v.dot(up) * 0.9).multiplyScalar(2.5);
          spawn(tail, v.addScaledVector(nose, -0.25), 0.022 + Math.random() * 0.02, 1.6 + Math.random() * 1.2);
        }
      } else if (info.phase === 'count' && Math.random() < 0.3) {
        spawn(P0.clone().addScaledVector(up, 0.02), randDir(Math.random, new THREE.Vector3()).multiplyScalar(0.12).addScaledVector(up, 0.08), 0.02, 1.5);
      }
      for (let i = 0; i < NP; i++) {
        const p = puffs[i];
        if (p.age > p.life) { m.makeScale(0, 0, 0); puffIM.setMatrixAt(i, m); continue; }
        p.age += dt;
        p.p.addScaledVector(p.v, dt);
        p.v.multiplyScalar(Math.exp(-dt * 1.5));
        const k = p.age / p.life;
        const s = p.s * (1 + k * 3) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        up.copy(p.p).normalize();
        basisAt(m, p.p, up, E, s);
        puffIM.setMatrixAt(i, m);
      }
      puffIM.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------- UFO
export function buildUFO(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const c = world.features.farm || world.cities[0].c;
  const { e: E, n: N } = tangentFrame(c);
  const saucer = new THREE.Group();
  const prof = [[0, -0.05], [0.25, -0.05], [0.5, 0.02], [0.52, 0.05], [0.3, 0.1], [0, 0.11]].map(([x, y]) => new THREE.Vector2(x, y));
  addMesh(saucer, merge([
    part(new THREE.LatheGeometry(prof, 32), 0xc9d2e3),
    part(new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x9ff3ff, { t: [0, 0.09, 0], emit: 0.5 }),
    part(new THREE.CylinderGeometry(0.14, 0.18, 0.05, 20), 0x8d99ae, { t: [0, -0.07, 0] }),
    part(new THREE.SphereGeometry(0.06, 10, 8), 0x7bd389, { t: [0, 0.2, 0] }),
    part(new THREE.SphereGeometry(0.018, 6, 4), 0x1d1631, { t: [0.025, 0.215, 0.05] }),
    part(new THREE.SphereGeometry(0.018, 6, 4), 0x1d1631, { t: [-0.025, 0.215, 0.05] }),
  ]), toon({ vertexColors: true, emitCol: 0xb8fff2, defines: { EMIT_ATTR: '', DOUBLE: '' }, side: THREE.DoubleSide }), { outline: { max: 0.008 } });
  const lights = [];
  for (let k = 0; k < 10; k++) lights.push({ m: new THREE.Matrix4().makeTranslation(Math.cos((k / 10) * 6.283) * 0.42, 0.04, Math.sin((k / 10) * 6.283) * 0.42).scale(new THREE.Vector3(0.035, 0.035, 0.035)), c: new THREE.Color().setHSL(k / 10, 0.9, 0.6) });
  const lightIM = addInstanced(saucer, merge([part(new THREE.SphereGeometry(1, 8, 6), 0xffffff, { emit: 1, tint: 1 })]), toon({ vertexColors: true, emitCol: 0xffffff, defines: { EMIT_ATTR: '', TINTMASK: '' } }), lights, { outline: false });
  grp.add(saucer);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uOn: { value: 0 } }, U),
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uTime; uniform float uOn;
      void main(){ float ring = step(0.55, fract(vUv.y * 8.0 + uTime * 1.5)); float a = (0.3 + 0.3 * ring) * uOn * (0.45 + 0.55 * vUv.y);
        gl_FragColor = vec4(vec3(0.75, 1.0, 0.55) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, 1, 24, 1, true).translate(0, -0.5, 0), beamMat);
  saucer.add(beam);
  const cow = new THREE.Group();
  addMesh(cow, world.cowGeo, toon({ vertexColors: true }), { outline: { max: 0.004 } });
  grp.add(cow);

  const st = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(), phase: '' };
  const tmp = new THREE.Vector3(), g = new THREE.Vector3(), fwd = new THREE.Vector3();
  const spot = (i, out) => {
    const a = i * 2.1 + 0.4, r = 0.35 + (i % 3) * 0.25;
    return out.copy(c).addScaledVector(E, (Math.cos(a) * r) / R).addScaledVector(N, (Math.sin(a) * r) / R).normalize();
  };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), lc = new THREE.Color();
  const obj = {
    kind: 'ufo', name: '不明飞行物 · 小绿人', obj: saucer,
    focus: { d: 1.2, el: 0.25, min: 0.25, max: 12 },
    info: () => st.phase,
    getWorldPose: (P, F, Up) => { P.copy(st.pos); F.copy(st.fwd); Up.copy(st.up); toWorld(planet, P, F, Up); },
  };
  return {
    grp, obj,
    update(t) {
      const CY = 16;
      const i = Math.floor(t / CY), u = (t % CY) / CY;
      spot(i, A); spot(i + 1, B);
      let k = 0;
      if (u > 0.68) k = smooth((u - 0.68) / 0.32);
      g.copy(A).lerp(B, k).normalize();
      const e = Math.max(elev(g.x, g.y, g.z), 0);
      const hover = 0.62 + Math.sin(t * 1.3) * 0.03;
      st.up.copy(g);
      fwd.subVectors(B, A).addScaledVector(g, -B.clone().sub(A).dot(g));
      if (fwd.lengthSq() < 1e-10) fwd.copy(E);
      st.fwd.copy(fwd).normalize();
      st.pos.copy(g).multiplyScalar(R + e + hover);
      const tilt = Math.sin(t * 0.9) * 0.08 + (u > 0.68 && u < 0.98 ? 0.18 : 0);
      const side = tmp.crossVectors(st.fwd, g);
      const upT = g.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(st.fwd, Math.sin(tilt));
      setPose(saucer, st.pos, upT, st.fwd, 0.36);
      saucer.children[0].rotation.y = t * 1.5;
      // beam + cow
      const beamOn = u > 0.08 && u < 0.62 ? Math.min(1, (u - 0.08) * 12, (0.62 - u) * 12) : 0;
      beamMat.uniforms.uOn.value = beamOn;
      beam.visible = beamOn > 0.01;
      beam.scale.set(1, (hover + 0.05) / 0.36, 1);
      const abduct = i % 2 === 0;
      let h = 0; let visible = true;
      if (u > 0.12 && u < 0.58) {
        const p = (u - 0.12) / 0.46;
        h = abduct ? smooth(p) : 1 - smooth(p);
      } else if (u >= 0.58) { h = abduct ? 1 : 0; visible = !abduct; }
      else { h = abduct ? 0 : 1; visible = abduct; }
      st.phase = beamOn > 0 ? (abduct ? '正在「借」一头奶牛……' : '把奶牛还回去了，还挺有礼貌') : '在农场上空巡逻';
      cow.visible = visible && (h < 0.98 || !abduct);
      const ce = Math.max(elev(A.x, A.y, A.z), 0);
      tmp.copy(A).multiplyScalar(R + ce + h * (hover - 0.08));
      setPose(cow, tmp, A, E.clone().applyAxisAngle(A, t * 0.8 * (beamOn > 0 ? 1 : 0)), 0.055);
      if (h > 0.02 && h < 0.98) cow.rotateZ(Math.sin(t * 2) * 0.4);
      // light colours chase
      for (let k2 = 0; k2 < 10; k2++) lightIM.setColorAt(k2, lc.setHSL((k2 / 10 + t * 0.4) % 1, 0.9, 0.62));
      lightIM.instanceColor.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------- satellites, station, moon
export function buildSpace(parent, rng) {
  const grp = new THREE.Group();
  parent.add(grp);
  const objs = [];
  // satellite
  const sat = new THREE.Group();
  const panel = (x) => {
    const P = [part(new THREE.BoxGeometry(0.62, 0.02, 0.3), 0x3a6ad9, { t: [x, 0, 0] })];
    for (let k = 1; k < 4; k++) P.push(part(new THREE.BoxGeometry(0.008, 0.024, 0.3), 0xdde6ff, { t: [x - 0.31 + k * 0.155, 0, 0] }));
    P.push(part(new THREE.BoxGeometry(0.62, 0.024, 0.008), 0xdde6ff, { t: [x, 0, 0] }));
    return P;
  };
  addMesh(sat, merge([
    part(new THREE.BoxGeometry(0.22, 0.26, 0.22), 0xf2b134),
    part(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6).rotateZ(Math.PI / 2), 0x9aa3b5, { t: [0, 0, 0] }),
    ...panel(0.45), ...panel(-0.45),
    part(new THREE.ConeGeometry(0.13, 0.08, 16, 1, true).rotateX(Math.PI), 0xffffff, { t: [0, -0.17, 0] }),
    part(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4), 0xdddddd, { t: [0, 0.22, 0] }),
    part(new THREE.SphereGeometry(0.025, 8, 6), 0xff3355, { t: [0, 0.33, 0], emit: 1 }),
  ]), toon({ vertexColors: true, emitCol: 0xff3355, defines: { EMIT_ATTR: '', SPACE: '', DOUBLE: '' }, side: THREE.DoubleSide }), { outline: { max: 0.01 } });
  grp.add(sat);
  // space station
  const sta = new THREE.Group();
  const ring = new THREE.Group();
  const spokes = [];
  for (let k = 0; k < 4; k++) spokes.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6).translate(0, 0.25, 0).rotateZ((k / 4) * Math.PI * 2), 0xdfe4ee));
  const win = [];
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; win.push(part(new THREE.BoxGeometry(0.05, 0.03, 0.02).rotateZ(a), 0xfff2a8, { emit: 1, t: [Math.cos(a + Math.PI / 2) * 0.5, Math.sin(a + Math.PI / 2) * 0.5, 0.075] })); }
  addMesh(ring, merge([part(new THREE.TorusGeometry(0.5, 0.07, 10, 40), 0xf1f3f8), ...spokes, ...win]), toon({ vertexColors: true, emitCol: 0xfff2a8, defines: { EMIT_ATTR: '', SPACE: '' } }), { outline: { max: 0.01 } });
  sta.add(ring);
  const sp = [part(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 14).rotateX(Math.PI / 2), 0xdfe4ee)];
  for (const z of [-0.55, 0.55]) {
    sp.push(part(new THREE.BoxGeometry(1.4, 0.02, 0.32), 0x3a6ad9, { t: [0, 0, z] }));
    sp.push(part(new THREE.BoxGeometry(0.02, 0.025, 0.32), 0xdde6ff, { t: [0.35, 0, z] }));
    sp.push(part(new THREE.BoxGeometry(0.02, 0.025, 0.32), 0xdde6ff, { t: [-0.35, 0, z] }));
    sp.push(part(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6).rotateX(Math.PI / 2), 0x9aa3b5, { t: [0, 0, z * 0.82] }));
  }
  addMesh(sta, merge(sp), toon({ vertexColors: true, defines: { SPACE: '', DOUBLE: '' }, side: THREE.DoubleSide }), { outline: { max: 0.01 } });
  grp.add(sta);
  // moon
  const MR = 2.2;
  const mg = new THREE.SphereGeometry(MR, 56, 36);
  const p = mg.attributes.position;
  const craters = [];
  for (let k = 0; k < 18; k++) craters.push({ d: randDir(rng, new THREE.Vector3()), r: 0.15 + rng() * 0.35, depth: 0.05 + rng() * 0.07 });
  const col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let h = 0, dark = 0;
    for (const c of craters) {
      const a = v.angleTo(c.d) / c.r;
      if (a < 1) { h -= c.depth * (1 - a * a); dark = Math.max(dark, 1 - a); }
      else if (a < 1.35) h += c.depth * 0.35 * Math.sin(((a - 1) / 0.35) * Math.PI);
    }
    p.setXYZ(i, v.x * (MR + h * 1.3), v.y * (MR + h * 1.3), v.z * (MR + h * 1.3));
    const cc = new THREE.Color(0xe4e1f0).lerp(new THREE.Color(0xb9b3cf), Math.min(1, dark * 1.4));
    col.set([cc.r, cc.g, cc.b], i * 3);
  }
  mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  mg.computeVertexNormals();
  mg.setAttribute('oNormal', mg.attributes.normal.clone());
  const moon = new THREE.Group();
  addMesh(moon, mg, toon({ vertexColors: true, defines: { SPACE: '' } }), { outline: { w: 0.02, s: 0.001, max: 0.06 } });
  // little flag & lander
  const flag = new THREE.Group();
  addMesh(flag, merge([
    part(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), 0xdddddd, { t: [0, 0.11, 0] }),
    part(new THREE.BoxGeometry(0.12, 0.07, 0.005), 0xff6b9a, { t: [0.06, 0.18, 0] }),
    part(new THREE.CylinderGeometry(0.05, 0.07, 0.06, 8), 0xf2b134, { t: [0.22, 0.05, 0.05] }),
    part(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4).rotateZ(0.6), 0x9aa3b5, { t: [0.27, 0.02, 0.05] }),
    part(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4).rotateZ(-0.6), 0x9aa3b5, { t: [0.17, 0.02, 0.05] }),
  ]), toon({ vertexColors: true, defines: { SPACE: '' } }), { outline: { max: 0.004 } });
  const fd = new THREE.Vector3(0.3, 1, 0.2).normalize();
  setPose(flag, fd.clone().multiplyScalar(MR - 0.01), fd, new THREE.Vector3(1, 0, 0), 1.3);
  moon.add(flag);
  grp.add(moon);

  const mk = (name, o, kind, focus, info) => {
    const ob = { kind, name, obj: o, focus, info };
    ob.getWorldPose = (P, F, Up) => {
      o.getWorldPosition(P);
      Up.copy(P).normalize();
      F.copy(ob._vel || new THREE.Vector3(1, 0, 0));
      F.addScaledVector(Up, -F.dot(Up)).normalize();
    };
    objs.push(ob);
    return ob;
  };
  const satO = mk('气象卫星「小眼睛」', sat, 'space', { d: 1.6, el: 0.35, min: 0.4, max: 14 }, () => '每 70 秒绕星球一圈，盯着云朵');
  const staO = mk('空间站「甜甜圈」', sta, 'space', { d: 3.2, el: 0.3, min: 0.8, max: 16 }, () => '旋转的圆环里住着 6 位宇航员');
  const moonO = mk('月亮', moon, 'space', { d: 9, el: 0.25, min: 3, max: 40 }, () => '上面插着一面粉色小旗');
  const prevPos = new Map();
  const w = new THREE.Vector3();
  const axSat = new THREE.Vector3(1, 0, 0.2).normalize(), axSta = new THREE.Vector3(0.3, 1, 0.5).normalize(), axMoon = new THREE.Vector3(0.15, 1, -0.1).normalize();
  const b0 = new THREE.Vector3(0, 0, 1).cross(axSat).normalize(), b1 = new THREE.Vector3(1, 0, 0).cross(axSta).normalize(), b2 = new THREE.Vector3(1, 0, 0).cross(axMoon).normalize();
  const tmpV = new THREE.Vector3();
  return {
    grp, objs,
    update(t) {
      rotAxis(b0, axSat, t * (Math.PI * 2 / 70), tmpV);
      sat.position.copy(tmpV).multiplyScalar(R + 3.3);
      sat.lookAt(0, 0, 0); sat.rotateX(Math.PI / 2);
      rotAxis(b1, axSta, t * (Math.PI * 2 / 120), tmpV);
      sta.position.copy(tmpV).multiplyScalar(R + 6.2);
      sta.lookAt(0, 0, 0);
      ring.rotation.z = t * 0.3;
      rotAxis(b2, axMoon, t * (Math.PI * 2 / 360) + 1.0, tmpV);
      moon.position.copy(tmpV).multiplyScalar(46);
      moon.rotation.y = t * 0.02;
      for (const o of objs) {
        o.obj.getWorldPosition(w);
        const pp = prevPos.get(o);
        if (pp) { o._vel = (o._vel || new THREE.Vector3()).subVectors(w, pp); pp.copy(w); }
        else prevPos.set(o, w.clone());
      }
    },
  };
}
