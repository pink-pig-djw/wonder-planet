import * as THREE from 'three';
import { R, world, elev } from './world.js';
import { toon, U } from './shaders.js';
import { part, merge, basisAt, randDir, tangentFrame, rotAxis } from './geo.js';
import { addMesh, addInstanced } from './mk.js';
import { Trail } from './trail.js';

const _m = new THREE.Matrix4();
export function setPose(obj, pos, up, fwd, s = 1) {
  basisAt(_m, pos, up, fwd, s, s, s);
  _m.decompose(obj.position, obj.quaternion, obj.scale);
}
export function toWorld(planet, P, F, Up) {
  planet.localToWorld(P);
  F.transformDirection(planet.matrixWorld);
  Up.transformDirection(planet.matrixWorld);
}

// ------------------------------------------------------------- planes
function jetGeo() {
  return merge([
    part(new THREE.CylinderGeometry(0.075, 0.068, 0.75, 12).rotateX(Math.PI / 2), 0xffffff),
    part(new THREE.SphereGeometry(0.075, 12, 8).scale(1, 1, 1.7), 0xffffff, { t: [0, 0, 0.37] }),
    part(new THREE.ConeGeometry(0.068, 0.26, 12).rotateX(-Math.PI / 2), 0xffffff, { t: [0, 0.01, -0.5] }),
    part(new THREE.BoxGeometry(0.1, 0.045, 0.1), 0x2b3a67, { t: [0, 0.045, 0.39], emit: 0.4 }),
    part(new THREE.BoxGeometry(0.152, 0.024, 0.48), 0x2b3a67, { t: [0, 0.025, 0.02], emit: 0.7 }),
    part(new THREE.BoxGeometry(1.0, 0.026, 0.2), 0xe8edf5, { t: [0, -0.015, 0.02] }),
    part(new THREE.BoxGeometry(0.07, 0.034, 0.13), 0xffffff, { tint: 1, t: [0.5, -0.015, 0.0] }),
    part(new THREE.BoxGeometry(0.07, 0.034, 0.13), 0xffffff, { tint: 1, t: [-0.5, -0.015, 0.0] }),
    part(new THREE.BoxGeometry(0.03, 0.24, 0.17).translate(0, 0.12, 0).rotateX(-0.35), 0xffffff, { tint: 1, t: [0, 0.03, -0.5] }),
    part(new THREE.BoxGeometry(0.36, 0.02, 0.1), 0xe8edf5, { t: [0, 0.02, -0.53] }),
    part(new THREE.CylinderGeometry(0.042, 0.042, 0.15, 10).rotateX(Math.PI / 2), 0xffffff, { tint: 1, t: [0.23, -0.07, 0.07] }),
    part(new THREE.CylinderGeometry(0.042, 0.042, 0.15, 10).rotateX(Math.PI / 2), 0xffffff, { tint: 1, t: [-0.23, -0.07, 0.07] }),
    part(new THREE.SphereGeometry(0.016, 6, 4), 0xff3344, { emit: 1, t: [-0.54, -0.01, 0] }),
    part(new THREE.SphereGeometry(0.016, 6, 4), 0x33ff88, { emit: 1, t: [0.54, -0.01, 0] }),
  ]);
}
function biplaneGeo() {
  const strut = (x, z) => part(new THREE.BoxGeometry(0.018, 0.25, 0.018), 0x6b4a33, { t: [x, 0.055, z] });
  return merge([
    part(new THREE.BoxGeometry(0.16, 0.16, 0.62), 0xffffff, { tint: 1, t: [0, 0, -0.02] }),
    part(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 10).rotateX(Math.PI / 2), 0x555566, { t: [0, 0, 0.33] }),
    part(new THREE.BoxGeometry(0.92, 0.026, 0.19), 0xfff1c1, { t: [0, 0.18, 0.06] }),
    part(new THREE.BoxGeometry(0.82, 0.026, 0.17), 0xfff1c1, { t: [0, -0.07, 0.06] }),
    strut(0.3, 0.06), strut(-0.3, 0.06), strut(0.06, 0.1), strut(-0.06, 0.1),
    part(new THREE.BoxGeometry(0.02, 0.18, 0.13), 0xffffff, { tint: 1, t: [0, 0.12, -0.3] }),
    part(new THREE.BoxGeometry(0.3, 0.02, 0.1), 0xfff1c1, { t: [0, 0.02, -0.3] }),
    part(new THREE.SphereGeometry(0.05, 10, 8), 0xffd7b5, { t: [0, 0.12, -0.05] }),
    part(new THREE.BoxGeometry(0.105, 0.03, 0.03), 0x2b2b3a, { t: [0, 0.135, -0.01] }),
    part(new THREE.BoxGeometry(0.07, 0.03, 0.2), 0x4cc9f0, { t: [0.03, 0.08, -0.14] }),
    part(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10).rotateZ(Math.PI / 2), 0x2b2b3a, { t: [0.11, -0.13, 0.12] }),
    part(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10).rotateZ(Math.PI / 2), 0x2b2b3a, { t: [-0.11, -0.13, 0.12] }),
  ]);
}
function propGeo() {
  return merge([
    part(new THREE.BoxGeometry(0.045, 0.42, 0.012), 0x8b5a3c),
    part(new THREE.ConeGeometry(0.035, 0.07, 10).rotateX(Math.PI / 2), 0xff5d5d, { t: [0, 0, 0.03] }),
  ]);
}

const PLANE_COLS = [0xff5d5d, 0x4cc9f0, 0xffd23f, 0x7bd389, 0x9b5de5, 0xff9f1c, 0xf72585, 0x2ec4b6];

function bannerTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const draw = () => {
    const g = c.getContext('2d');
    g.fillStyle = '#fff7e3'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#1d1631'; g.lineWidth = 14; g.strokeRect(7, 7, c.width - 14, c.height - 14);
    g.fillStyle = '#ff6b9a';
    for (let x = 0; x < c.width; x += 64) { g.beginPath(); g.moveTo(x, c.height - 7); g.lineTo(x + 32, c.height - 7); g.lineTo(x + 16, c.height - 30); g.fill(); }
    g.fillStyle = '#1d1631';
    g.font = '86px "ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, c.height / 2 - 4);
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  draw();
  if (document.fonts) document.fonts.ready.then(draw).catch(() => {});
  setTimeout(draw, 2500);
  return tex;
}

export function buildPlanes(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const planes = [];
  const jg = jetGeo(), bg = biplaneGeo(), pg = propGeo();
  const cityNames = world.cities.map((c) => c.name);
  const N = 9;
  for (let i = 0; i < N + 2; i++) {
    const bip = i >= N;
    const axis = randDir(rng, new THREE.Vector3());
    if (bip) axis.lerp(new THREE.Vector3(0, 1, 0), 0.7).normalize();
    const base = new THREE.Vector3().crossVectors(axis, randDir(rng, new THREE.Vector3())).normalize();
    const p = {
      kind: 'plane', bip, axis, base,
      alt: bip ? 1.2 + rng() * 0.15 : 1.45 + rng() * 0.6,
      ang: rng() * Math.PI * 2,
      speed: (bip ? 0.035 : 0.05 + rng() * 0.035) * (rng() < 0.5 ? 1 : -1),
      phase: rng() * 10,
      obj: new THREE.Group(),
      color: bip ? (i === N ? 0xff5d5d : 0xffd23f) : PLANE_COLS[i % PLANE_COLS.length],
      pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(),
    };
    const from = cityNames[Math.floor(rng() * cityNames.length)];
    let to = cityNames[Math.floor(rng() * cityNames.length)];
    if (to === from) to = cityNames[(cityNames.indexOf(from) + 1) % cityNames.length];
    p.name = bip ? (i === N ? '小红双翼机 · 拉横幅中' : '黄蜂号双翼机') : `奇想航空 WP-${100 + Math.floor(rng() * 900)}`;
    p.route = bip ? '低空观光，慢慢悠悠' : `${from} → ${to}`;
    const mat = toon({ vertexColors: true, tint: p.color, emitCol: 0xfff3c0, defines: { TINTMASK: '', EMIT_ATTR: '' } });
    addMesh(p.obj, bip ? bg : jg, mat, { outline: { max: 0.008 } });
    if (bip) {
      const prop = addMesh(p.obj, pg, toon({ vertexColors: true, spin: 30, defines: { SPIN: '' } }), { outline: { max: 0.004 } });
      prop.position.z = 0.4;
    }
    grp.add(p.obj);
    if (!bip) p.trail = new Trail(grp, { n: 70, width: 0.022, grow: 2.2, step: 0.05, cross: true, opacity: 0.85 });
    p.focus = { d: 1.1, el: 0.28, min: 0.25, max: 12 };
    p.info = () => `${p.route} · 高度 ${Math.round(p.alt * 1000 + 8000).toLocaleString()} 米`;
    p.getWorldPose = (P, F, Up) => { P.copy(p.pos); F.copy(p.fwd); Up.copy(p.up); toWorld(planet, P, F, Up); };
    planes.push(p);
  }
  // banner on the first biplane
  const bp = planes[N];
  const BN = 28;
  const bgeo = new THREE.PlaneGeometry(1, 1, BN - 1, 1);
  const bmat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uMap: { value: bannerTexture('你好呀，奇想星球！') } }, U),
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMap; uniform vec3 uSunDir; varying vec2 vUv; varying vec3 vW;
      void main(){ vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y); vec3 c = texture2D(uMap, uv).rgb; float day = smoothstep(-0.2, 0.1, dot(normalize(vW), uSunDir));
        gl_FragColor = vec4(c * mix(vec3(0.25, 0.3, 0.55), vec3(1.0), day), 1.0); }`,
    side: THREE.DoubleSide,
  });
  const banner = new THREE.Mesh(bgeo, bmat);
  banner.frustumCulled = false;
  grp.add(banner);
  const ropeG = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const rope = new THREE.Line(ropeG, new THREE.LineBasicMaterial({ color: 0x1d1631 }));
  rope.frustumCulled = false;
  grp.add(rope);

  const tmpP = new THREE.Vector3(), tmpF = new THREE.Vector3(), tmpU = new THREE.Vector3(), side = new THREE.Vector3();
  const poseAt = (p, t, P, F, Up) => {
    const a = p.ang + p.speed * t;
    rotAxis(p.base, p.axis, a, Up);
    F.crossVectors(p.axis, Up).multiplyScalar(Math.sign(p.speed)).normalize();
    P.copy(Up).multiplyScalar(R + p.alt + 0.05 * Math.sin(t * 0.4 + p.phase));
  };
  return {
    grp, planes,
    update(t) {
      for (const p of planes) {
        poseAt(p, t, p.pos, p.fwd, p.up);
        // gentle banking wobble
        const roll = Math.sin(t * 0.3 + p.phase) * 0.12;
        side.crossVectors(p.fwd, p.up);
        tmpU.copy(p.up).multiplyScalar(Math.cos(roll)).addScaledVector(side, Math.sin(roll));
        setPose(p.obj, p.pos, tmpU, p.fwd, p.bip ? 0.26 : 0.3);
        if (p.trail) p.trail.push(tmpP.copy(p.pos).addScaledVector(p.fwd, -0.15), p.up);
      }
      // banner follows the biplane's own path
      const pos = bgeo.attributes.position;
      const v = Math.abs(bp.speed) * (R + bp.alt);
      for (let k = 0; k < BN; k++) {
        const back = 0.32 + (k / (BN - 1)) * 0.95;
        poseAt(bp, t - back / v, tmpP, tmpF, tmpU);
        const flap = Math.sin(t * 9 - k * 0.6) * 0.012 * (k / BN);
        side.crossVectors(tmpF, tmpU).normalize();
        tmpP.addScaledVector(side, flap).addScaledVector(tmpU, -0.03);
        pos.setXYZ(k, tmpP.x + tmpU.x * 0.065, tmpP.y + tmpU.y * 0.065, tmpP.z + tmpU.z * 0.065);
        pos.setXYZ(k + BN, tmpP.x - tmpU.x * 0.065, tmpP.y - tmpU.y * 0.065, tmpP.z - tmpU.z * 0.065);
        if (k === 0) {
          const rp = ropeG.attributes.position;
          rp.setXYZ(0, tmpP.x, tmpP.y, tmpP.z);
          const tail = tmpF.copy(bp.pos).addScaledVector(bp.fwd, -0.12);
          rp.setXYZ(1, tail.x, tail.y, tail.z);
          rp.needsUpdate = true;
        }
      }
      pos.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------- clouds
function cloudGeo(rng, n) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * 1.1 + (rng() - 0.5) * 0.15;
    const r = 0.22 + Math.sin((i / (n - 1)) * Math.PI) * 0.2 + rng() * 0.08;
    const g = new THREE.SphereGeometry(r, 12, 9).translate(x, r * 0.55 + rng() * 0.05, (rng() - 0.5) * 0.3);
    parts.push(part(g, 0xffffff));
  }
  const m = merge(parts, false);
  const p = m.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.02) p.setY(i, 0.02 + (p.getY(i) - 0.02) * 0.15);
  m.computeBoundingSphere();
  // outline normals = smooth radial-ish
  const on = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i) - 0.2, p.getZ(i)).normalize();
    const n = new THREE.Vector3().fromBufferAttribute(m.attributes.normal, i);
    n.lerp(v, 0.3).normalize();
    on.set([n.x, n.y, n.z], i * 3);
  }
  m.setAttribute('oNormal', new THREE.BufferAttribute(on, 3));
  return m;
}

export function buildClouds(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const variants = [cloudGeo(rng, 5), cloudGeo(rng, 6), cloudGeo(rng, 7), cloudGeo(rng, 4)];
  const clouds = [];
  const NC = 44;
  const Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < NC; i++) {
    const axis = Y.clone().add(randDir(rng, new THREE.Vector3()).multiplyScalar(0.45)).normalize();
    const base = new THREE.Vector3().crossVectors(axis, randDir(rng, new THREE.Vector3())).normalize();
    clouds.push({ v: i % variants.length, axis, base, ang: rng() * Math.PI * 2, speed: 0.006 + rng() * 0.01, alt: 1.15 + rng() * 0.5, s: 0.45 + rng() * 0.5, ph: rng() * 6, storm: false });
  }
  // two storm clouds
  for (let k = 0; k < 2; k++) {
    const c = clouds[k];
    c.storm = true; c.s = 0.95; c.v = 2; c.alt = 1.25; c.speed = 0.008;
  }
  const meshes = variants.map((g, vi) => {
    const list = clouds.filter((c) => c.v === vi && !c.storm).map(() => ({ m: new THREE.Matrix4() }));
    return addInstanced(grp, g, toon({ vertexColors: true, color: 0xffffff }), list, { dynamic: true, lod: false, outline: { w: 0.004, s: 0.0016, max: 0.03 } });
  });
  const stormMesh = addInstanced(grp, variants[2], toon({ vertexColors: true, color: 0x9aa6bf }), clouds.filter((c) => c.storm).map(() => ({ m: new THREE.Matrix4() })), { dynamic: true, lod: false, outline: { w: 0.004, s: 0.0016, max: 0.03 } });

  // rain (line segments in each storm cloud's local frame)
  const rains = [];
  for (const c of clouds.filter((c) => c.storm)) {
    const N = 140;
    const pos = new Float32Array(N * 6), seed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = (rng() - 0.5) * 1.1, z = (rng() - 0.5) * 0.4, s = rng();
      pos.set([x, 0, z, x - 0.02, -0.1, z], i * 6);
      seed[i * 2] = s; seed[i * 2 + 1] = s;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, U),
      vertexShader: /* glsl */ `uniform float uTime; attribute float aSeed; varying float vA;
        void main(){ vec3 p = position; float f = fract(uTime * 1.3 + aSeed * 7.0); p.y -= f * 1.15; vA = 1.0 - f;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ gl_FragColor = vec4(0.75, 0.88, 1.0, 0.75 * vA); }`,
      transparent: true, depthWrite: false,
    });
    const lines = new THREE.LineSegments(g, mat);
    lines.frustumCulled = false;
    const holder = new THREE.Group();
    holder.add(lines);
    // lightning bolt
    const bp = [];
    let x = 0, y = -0.05;
    for (let i = 0; i < 9; i++) { bp.push(x, y, 0); x += (rng() - 0.5) * 0.18; y -= 0.13; }
    const bolt = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)), new THREE.LineBasicMaterial({ color: 0xfff27a }));
    const bolt2 = bolt.clone(); bolt2.position.x = 0.006;
    bolt.visible = bolt2.visible = false;
    holder.add(bolt, bolt2);
    grp.add(holder);
    rains.push({ c, holder, bolt, bolt2, next: 2 + rng() * 5, on: 0 });
  }

  const pos = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), m = new THREE.Matrix4();
  return {
    grp, clouds,
    update(t, dt) {
      const counters = [0, 0, 0, 0];
      let si = 0;
      for (const c of clouds) {
        const a = c.ang + c.speed * t;
        rotAxis(c.base, c.axis, a, up);
        fwd.crossVectors(c.axis, up).normalize();
        pos.copy(up).multiplyScalar(R + c.alt + Math.sin(t * 0.3 + c.ph) * 0.03);
        const br = 1 + Math.sin(t * 0.5 + c.ph) * 0.03;
        basisAt(m, pos, up, fwd, c.s * br, c.s * (2 - br) * 0.95, c.s * br);
        if (c.storm) { stormMesh.setMatrixAt(si++, m); c.m = m.clone(); }
        else meshes[c.v].setMatrixAt(counters[c.v]++, m);
      }
      for (const im of meshes) im.instanceMatrix.needsUpdate = true;
      stormMesh.instanceMatrix.needsUpdate = true;
      for (const r of rains) {
        r.c.m.decompose(r.holder.position, r.holder.quaternion, r.holder.scale);
        r.next -= dt;
        if (r.next < 0) { r.on = 0.18; r.next = 3 + Math.random() * 6; }
        r.on -= dt;
        r.bolt.visible = r.bolt2.visible = r.on > 0 && (r.on > 0.12 || r.on < 0.05);
      }
    },
  };
}

// ------------------------------------------------------------- balloons
function balloonGeo(c1, c2) {
  const prof = [[0.0, -0.02], [0.09, 0.0], [0.2, 0.12], [0.33, 0.3], [0.4, 0.5], [0.4, 0.66], [0.33, 0.84], [0.2, 0.96], [0.0, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const env = new THREE.LatheGeometry(prof, 16).toNonIndexed();
  const p = env.attributes.position;
  const col = new Float32Array(p.count * 3);
  const A = new THREE.Color(c1), B = new THREE.Color(c2);
  for (let i = 0; i < p.count; i += 3) {
    let ax = 0, az = 0; for (let j = 0; j < 3; j++) { ax += p.getX(i + j); az += p.getZ(i + j); }
    const seg = Math.floor(((Math.atan2(az, ax) + Math.PI) / (Math.PI * 2)) * 16 + 0.5) % 2;
    const c = seg ? A : B;
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (i + j) * 3);
  }
  env.setAttribute('color', new THREE.BufferAttribute(col, 3));
  env.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  env.setAttribute('aEmit', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  env.deleteAttribute('uv');
  env.translate(0, 0.32, 0);
  const ropes = [[0.08, 0.08], [-0.08, 0.08], [0.08, -0.08], [-0.08, -0.08]].map(([x, z]) =>
    part(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 4).translate(0, 0.12, 0).rotateX(-z * 0.6).rotateZ(x * 0.6).translate(x * 0.75, 0.08, z * 0.75), 0x6b4a33));
  return merge([
    env, ...ropes,
    part(new THREE.BoxGeometry(0.16, 0.1, 0.16), 0xb07a4a, { t: [0, 0.05, 0] }),
    part(new THREE.BoxGeometry(0.17, 0.02, 0.17), 0x7a4e33, { t: [0, 0.1, 0] }),
    part(new THREE.ConeGeometry(0.03, 0.07, 8).rotateX(Math.PI), 0xffb703, { emit: 1, t: [0, 0.22, 0] }),
  ]);
}

export function buildBalloons(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const pairs = [[0xff5d5d, 0xffd23f], [0x4cc9f0, 0xffffff], [0x7bd389, 0xff9f1c], [0xff6b9a, 0x9b5de5], [0x2ec4b6, 0xfff1a0], [0xffffff, 0xf72585], [0xff9f1c, 0x4361ee]];
  const names = ['棉花糖一号', '橘子汽水号', '晚霞号', '泡泡糖号', '薄荷冰号', '樱桃号', '流星号'];
  const out = [];
  let k = 0;
  for (let i = 0; i < 3000 && out.length < pairs.length; i++) {
    const d = randDir(rng, new THREE.Vector3());
    const e = elev(d.x, d.y, d.z);
    if (e < 0.05 || e > 0.4 || Math.abs(d.y) > 0.75) continue;
    if (out.some((b) => b.c.angleTo(d) < 0.25)) continue;
    const pr = pairs[k];
    const b = { kind: 'balloon', c: d, rad: 0.03 + rng() * 0.04, speed: (0.03 + rng() * 0.03) * (rng() < 0.5 ? 1 : -1), ang: rng() * 6.28, alt: Math.max(e, 0) + 0.6 + rng() * 0.35, ph: rng() * 6, name: `热气球「${names[k]}」`, obj: new THREE.Group() };
    const { e: E, n: N } = tangentFrame(d);
    b.E = E.clone(); b.N = N.clone();
    addMesh(b.obj, balloonGeo(pr[0], pr[1]), toon({ vertexColors: true, emitCol: 0xffc04d, defines: { EMIT_ATTR: '' } }), { outline: { max: 0.008 } });
    grp.add(b.obj);
    b.pos = new THREE.Vector3(); b.fwd = new THREE.Vector3(); b.up = new THREE.Vector3();
    b.focus = { d: 0.9, el: 0.25, min: 0.2, max: 10, lift: 0.1 };
    b.info = () => `随风慢慢飘 · 离地 ${Math.round((b.alt) * 1000)} 米`;
    b.getWorldPose = (P, F, Up) => { P.copy(b.pos); F.copy(b.fwd); Up.copy(b.up); toWorld(planet, P, F, Up); };
    out.push(b); k++;
  }
  const tmp = new THREE.Vector3();
  return {
    grp, balloons: out,
    update(t) {
      for (const b of out) {
        const a = b.ang + b.speed * t;
        b.up.copy(b.c).addScaledVector(b.E, Math.cos(a) * b.rad).addScaledVector(b.N, Math.sin(a) * b.rad).normalize();
        tmp.copy(b.E).multiplyScalar(-Math.sin(a)).addScaledVector(b.N, Math.cos(a)).multiplyScalar(Math.sign(b.speed));
        b.fwd.copy(tmp).addScaledVector(b.up, -tmp.dot(b.up)).normalize();
        b.pos.copy(b.up).multiplyScalar(R + b.alt + Math.sin(t * 0.6 + b.ph) * 0.04);
        setPose(b.obj, b.pos, b.up, b.fwd, 0.36);
        b.obj.rotateY(Math.sin(t * 0.3 + b.ph) * 0.4);
      }
    },
  };
}

// ------------------------------------------------------------- birds
export function buildBirds(parent, rng) {
  const grp = new THREE.Group();
  parent.add(grp);
  const wing = (s) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.1, s * 0.55, 0.02, -0.08, 0, 0, -0.15], 3));
    g.computeVertexNormals();
    return part(g, 0x2b2b3a);
  };
  const geo = merge([wing(1), wing(-1), part(new THREE.BoxGeometry(0.06, 0.05, 0.3), 0x2b2b3a)], false);
  const flocks = [];
  for (let i = 0; i < 300 && flocks.length < 7; i++) {
    const d = randDir(rng, new THREE.Vector3());
    const e = elev(d.x, d.y, d.z);
    if (e < 0.0 || Math.abs(d.y) > 0.8) continue;
    const { e: E, n: N } = tangentFrame(d);
    flocks.push({ c: d, E: E.clone(), N: N.clone(), rad: 0.03 + rng() * 0.05, speed: 0.12 + rng() * 0.08, ang: rng() * 6.28, alt: Math.max(e, 0) + 0.3 + rng() * 0.25, n: 7 + Math.floor(rng() * 5) });
  }
  const list = [];
  for (const f of flocks) for (let k = 0; k < f.n; k++) list.push({ m: new THREE.Matrix4() });
  const im = addInstanced(grp, geo, toon({ vertexColors: true, side: THREE.DoubleSide, defines: { FLAP: '', DOUBLE: '' } }), list, { dynamic: true, outline: false });
  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), pos = new THREE.Vector3(), m = new THREE.Matrix4(), tmp = new THREE.Vector3();
  return {
    grp,
    update(t) {
      let idx = 0;
      for (const f of flocks) {
        const a = f.ang + t * f.speed;
        up.copy(f.c).addScaledVector(f.E, Math.cos(a) * f.rad).addScaledVector(f.N, Math.sin(a) * f.rad).normalize();
        tmp.copy(f.E).multiplyScalar(-Math.sin(a)).addScaledVector(f.N, Math.cos(a));
        fwd.copy(tmp).addScaledVector(up, -tmp.dot(up)).normalize();
        side.crossVectors(fwd, up);
        for (let k = 0; k < f.n; k++) {
          const row = Math.ceil(k / 2), sgn = k % 2 ? 1 : -1;
          pos.copy(up).multiplyScalar(R + f.alt + Math.sin(t * 2 + k) * 0.01)
            .addScaledVector(fwd, -row * 0.045)
            .addScaledVector(side, k === 0 ? 0 : sgn * row * 0.04);
          basisAt(m, pos, up, fwd, 0.07);
          im.setMatrixAt(idx++, m);
        }
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
