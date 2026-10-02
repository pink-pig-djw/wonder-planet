import * as THREE from 'three';
import { R, world, elev, offsetDir } from './world.js';
import { toon } from './shaders.js';
import { part, merge, basisAt, randDir, tangentFrame } from './geo.js';
import { addMesh, addInstanced } from './mk.js';
import { Trail } from './trail.js';
import { setPose, toWorld } from './air.js';

function hull(len, w, col, h = 0.16) {
  return [
    part(new THREE.CylinderGeometry(w, w * 0.65, h, 14).scale(1, 1, len / (2 * w)), col, { tint: 1, t: [0, h / 2, 0] }),
    part(new THREE.CylinderGeometry(w * 1.02, w * 1.02, 0.03, 14).scale(1, 1, len / (2 * w)), 0xffffff, { t: [0, h, 0] }),
  ];
}
function sailboatGeo() {
  const sail = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 0.62), new THREE.Vector2(0.34, 0.02)]);
  const jib = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 0.5), new THREE.Vector2(-0.24, 0.02)]);
  return merge([
    ...hull(0.8, 0.17, 0xffffff),
    part(new THREE.BoxGeometry(0.2, 0.03, 0.5), 0xd9a066, { t: [0, 0.17, -0.05] }),
    part(new THREE.CylinderGeometry(0.012, 0.014, 0.78, 6), 0x6b4a33, { t: [0, 0.55, 0.05] }),
    part(new THREE.ExtrudeGeometry(sail, { depth: 0.01, bevelEnabled: false }).rotateY(Math.PI / 2), 0xfffaf0, { t: [0, 0.2, 0.03] }),
    part(new THREE.ExtrudeGeometry(jib, { depth: 0.01, bevelEnabled: false }).rotateY(Math.PI / 2), 0xffffff, { tint: 1, t: [0, 0.2, 0.09] }),
    part(new THREE.BoxGeometry(0.06, 0.04, 0.012), 0xffffff, { tint: 1, t: [0.035, 0.94, 0.05] }),
  ]);
}
function ferryGeo() {
  return merge([
    ...hull(1.0, 0.2, 0xffffff, 0.18),
    part(new THREE.BoxGeometry(0.405, 0.04, 0.9), 0xffffff, { tint: 1, t: [0, 0.12, 0] }),
    part(new THREE.BoxGeometry(0.3, 0.12, 0.62), 0xffffff, { t: [0, 0.25, -0.04] }),
    part(new THREE.BoxGeometry(0.305, 0.04, 0.58), 0x2b3a67, { emit: 1, t: [0, 0.26, -0.04] }),
    part(new THREE.BoxGeometry(0.22, 0.09, 0.32), 0xffffff, { t: [0, 0.35, -0.08] }),
    part(new THREE.BoxGeometry(0.225, 0.03, 0.3), 0x2b3a67, { emit: 1, t: [0, 0.36, -0.08] }),
    part(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 10), 0xff5d5d, { t: [0, 0.47, -0.16] }),
    part(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10), 0x1d1631, { t: [0, 0.54, -0.16] }),
  ]);
}
function cargoGeo(rng) {
  const P = [...hull(1.0, 0.16, 0xc1121f, 0.15),
    part(new THREE.BoxGeometry(0.22, 0.2, 0.14), 0xffffff, { t: [0, 0.25, -0.38] }),
    part(new THREE.BoxGeometry(0.225, 0.04, 0.12), 0x2b3a67, { emit: 1, t: [0, 0.3, -0.38] }),
    part(new THREE.CylinderGeometry(0.03, 0.035, 0.1, 8), 0xffd23f, { t: [0, 0.39, -0.42] })];
  const cc = [0xff5d5d, 0x4cc9f0, 0xffd23f, 0x7bd389, 0xff9f1c, 0x9b5de5];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    if (rng() < 0.2) continue;
    P.push(part(new THREE.BoxGeometry(0.1, 0.07, 0.14), cc[Math.floor(rng() * cc.length)], { t: [(j - 0.5) * 0.105, 0.19 + k * 0.072, -0.18 + i * 0.15] }));
  }
  return merge(P);
}
function duckGeo() {
  return merge([
    part(new THREE.SphereGeometry(0.5, 20, 14).scale(1, 0.62, 1.25), 0xffd23f, { t: [0, 0.18, 0] }),
    part(new THREE.SphereGeometry(0.18, 12, 8).scale(1, 0.8, 1.6), 0xffd23f, { t: [0, 0.42, -0.52], rx: 0.6 }),
    part(new THREE.SphereGeometry(0.32, 18, 12), 0xffd23f, { t: [0, 0.78, 0.42] }),
    part(new THREE.ConeGeometry(0.14, 0.32, 12).rotateX(Math.PI / 2).scale(1, 0.55, 1), 0xff8c42, { t: [0, 0.74, 0.8] }),
    part(new THREE.SphereGeometry(0.05, 8, 6), 0x1d1631, { t: [0.17, 0.88, 0.66] }),
    part(new THREE.SphereGeometry(0.05, 8, 6), 0x1d1631, { t: [-0.17, 0.88, 0.66] }),
    part(new THREE.SphereGeometry(0.02, 6, 4), 0xffffff, { t: [0.19, 0.9, 0.7] }),
    part(new THREE.SphereGeometry(0.02, 6, 4), 0xffffff, { t: [-0.15, 0.9, 0.7] }),
    part(new THREE.SphereGeometry(0.2, 12, 8).scale(0.4, 0.8, 1.4), 0xffc300, { t: [0.47, 0.28, 0], rz: 0.3 }),
    part(new THREE.SphereGeometry(0.2, 12, 8).scale(0.4, 0.8, 1.4), 0xffc300, { t: [-0.47, 0.28, 0], rz: -0.3 }),
  ]);
}
function whaleGeo() {
  return merge([
    part(new THREE.SphereGeometry(0.5, 18, 12).scale(0.75, 0.6, 1.5), 0x4a6fa5, { t: [0, 0, 0] }),
    part(new THREE.SphereGeometry(0.46, 18, 12).scale(0.7, 0.45, 1.4), 0xdbe7f5, { t: [0, -0.1, 0.05] }),
    part(new THREE.SphereGeometry(0.05, 8, 6), 0x1d1631, { t: [0.3, 0.05, 0.5] }),
    part(new THREE.SphereGeometry(0.05, 8, 6), 0x1d1631, { t: [-0.3, 0.05, 0.5] }),
    part(new THREE.CylinderGeometry(0.12, 0.2, 0.6, 10).rotateX(Math.PI / 2), 0x4a6fa5, { t: [0, 0.05, -0.85] }),
    part(new THREE.BoxGeometry(0.75, 0.05, 0.22).translate(0, 0, 0), 0x4a6fa5, { t: [0, 0.06, -1.15] }),
    part(new THREE.SphereGeometry(0.14, 10, 8).scale(1.6, 0.3, 1), 0x4a6fa5, { t: [0.4, -0.15, 0.2], rz: -0.5 }),
    part(new THREE.SphereGeometry(0.14, 10, 8).scale(1.6, 0.3, 1), 0x4a6fa5, { t: [-0.4, -0.15, 0.2], rz: 0.5 }),
  ]);
}

const BOAT_NAMES = { sail: ['帆船「小浪花」', '帆船「蓝莓」', '帆船「贝壳」', '帆船「海风」', '帆船「云朵」'], ferry: ['渡轮「汽水号」', '渡轮「泡芙号」', '渡轮「彩虹号」'], cargo: ['货轮「大胃王」', '货轮「积木号」', '货轮「慢吞吞」'] };

export function buildSea(parent, rng, planet) {
  const grp = new THREE.Group();
  parent.add(grp);
  const geos = { sail: sailboatGeo(), ferry: ferryGeo(), cargo: cargoGeo(rng) };
  const scale = { sail: 0.13, ferry: 0.2, cargo: 0.3 };
  const boats = [];
  const kinds = ['sail', 'sail', 'sail', 'sail', 'sail', 'ferry', 'ferry', 'ferry', 'cargo', 'cargo', 'cargo', 'sail', 'sail', 'ferry'];
  const used = { sail: 0, ferry: 0, cargo: 0 };
  const tmp = new THREE.Vector3();
  for (const kind of kinds) {
    for (let tries = 0; tries < 400; tries++) {
      const c = randDir(rng, new THREE.Vector3());
      if (Math.abs(c.y) > 0.8) continue;
      if (elev(c.x, c.y, c.z) > -0.12) continue;
      const rad = (kind === 'cargo' ? 1.2 + rng() * 1.6 : 0.5 + rng() * 1.0) / R;
      const { e: E, n: N } = tangentFrame(c);
      let ok = true;
      for (let k = 0; k < 48 && ok; k++) {
        const a = (k / 48) * Math.PI * 2;
        tmp.copy(c).addScaledVector(E, Math.cos(a) * rad).addScaledVector(N, Math.sin(a) * rad).normalize();
        if (elev(tmp.x, tmp.y, tmp.z) > -0.05 || Math.abs(tmp.y) > 0.86) ok = false;
      }
      if (!ok) continue;
      const b = {
        kind: 'boat', type: kind, c, E: E.clone(), N: N.clone(), rad,
        speed: ((kind === 'sail' ? 0.12 : 0.09) / (rad * R)) * (rng() < 0.5 ? 1 : -1),
        ang: rng() * 6.28, ph: rng() * 6, obj: new THREE.Group(),
        pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(),
        name: BOAT_NAMES[kind][used[kind]++ % BOAT_NAMES[kind].length],
      };
      const col = kind === 'sail' ? [0xff5d5d, 0x4cc9f0, 0xffd23f, 0x7bd389, 0xff6b9a][Math.floor(rng() * 5)] : kind === 'ferry' ? 0x4361ee : 0xffffff;
      addMesh(b.obj, geos[kind], toon({ vertexColors: true, tint: col, emitCol: 0xfff0b8, defines: { TINTMASK: '', EMIT_ATTR: '' } }), { outline: { max: 0.006 } });
      grp.add(b.obj);
      b.trail = new Trail(grp, { n: 40, width: scale[kind] * 0.16, grow: 3.0, step: 0.035, opacity: 0.9 });
      b.focus = { d: kind === 'cargo' ? 1.0 : 0.65, el: 0.3, min: 0.15, max: 10 };
      b.info = () => (kind === 'sail' ? '迎着海风兜圈子' : kind === 'ferry' ? '往返于两座港口之间' : '运着一船五颜六色的集装箱');
      b.getWorldPose = (P, F, Up) => { P.copy(b.pos); F.copy(b.fwd); Up.copy(b.up); toWorld(planet, P, F, Up); };
      boats.push(b);
      break;
    }
  }

  // giant rubber duck near the port city
  const port = world.features.portCity || world.cities[0];
  let duck = null;
  for (let tries = 0; tries < 600; tries++) {
    const a = rng() * Math.PI * 2, r = port.rad + 0.8 + rng() * 2.2;
    const d = offsetDir(port.c, port.E, port.N, Math.cos(a) * r, Math.sin(a) * r, new THREE.Vector3());
    if (elev(d.x, d.y, d.z) > -0.12) continue;
    const { e: E, n: N } = tangentFrame(d);
    duck = { kind: 'boat', name: '巨型小黄鸭', c: d, E: E.clone(), N: N.clone(), obj: new THREE.Group(), pos: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3() };
    addMesh(duck.obj, duckGeo(), toon({ vertexColors: true }), { outline: { max: 0.01 } });
    grp.add(duck.obj);
    duck.focus = { d: 1.1, el: 0.3, min: 0.3, max: 10 };
    duck.info = () => '在海湾里晃来晃去，谁也不知道它从哪来';
    duck.getWorldPose = (P, F, Up) => { P.copy(duck.pos); F.copy(duck.fwd); Up.copy(duck.up); toWorld(planet, P, F, Up); };
    boats.push(duck);
    break;
  }

  // whales
  const whales = [];
  const spoutG = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 80 && whales.length < 3; i++) {
    const c = randDir(rng, new THREE.Vector3());
    if (elev(c.x, c.y, c.z) > -0.35 || Math.abs(c.y) > 0.7) continue;
    const { e: E, n: N } = tangentFrame(c);
    const w = { c, E: E.clone(), N: N.clone(), rad: 0.06, speed: 0.012, ang: rng() * 6.28, ph: rng() * 20, obj: new THREE.Group() };
    addMesh(w.obj, whaleGeo(), toon({ vertexColors: true }), { outline: { max: 0.01 } });
    grp.add(w.obj);
    const spList = [];
    for (let k = 0; k < 14; k++) spList.push({ m: new THREE.Matrix4() });
    w.spout = addInstanced(grp, spoutG, toon({ color: 0xe8fbff }), spList, { dynamic: true, outline: { max: 0.003 } });
    whales.push(w);
  }

  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), pos = new THREE.Vector3(), m = new THREE.Matrix4(), side = new THREE.Vector3();
  return {
    grp, boats,
    update(t) {
      for (const b of boats) {
        if (b === duck) continue;
        const a = b.ang + b.speed * t;
        b.up.copy(b.c).addScaledVector(b.E, Math.cos(a) * b.rad).addScaledVector(b.N, Math.sin(a) * b.rad).normalize();
        tmp.copy(b.E).multiplyScalar(-Math.sin(a)).addScaledVector(b.N, Math.cos(a)).multiplyScalar(Math.sign(b.speed));
        b.fwd.copy(tmp).addScaledVector(b.up, -tmp.dot(b.up)).normalize();
        b.pos.copy(b.up).multiplyScalar(R - 0.012 + Math.sin(t * 1.4 + b.ph) * 0.004);
        side.crossVectors(b.fwd, b.up);
        const roll = Math.sin(t * 1.1 + b.ph) * 0.06;
        up.copy(b.up).multiplyScalar(Math.cos(roll)).addScaledVector(side, Math.sin(roll));
        setPose(b.obj, b.pos, up, b.fwd, scale[b.type]);
        b.trail.push(pos.copy(b.up).multiplyScalar(R + 0.013).addScaledVector(b.fwd, -scale[b.type] * 0.45), b.up);
      }
      if (duck) {
        duck.up.copy(duck.c);
        fwd.copy(duck.E).multiplyScalar(Math.cos(t * 0.15)).addScaledVector(duck.N, Math.sin(t * 0.15));
        duck.fwd.copy(fwd);
        duck.pos.copy(duck.c).multiplyScalar(R - 0.05 + Math.sin(t * 1.2) * 0.02);
        side.crossVectors(fwd, duck.c);
        const roll = Math.sin(t * 0.9) * 0.08;
        up.copy(duck.c).multiplyScalar(Math.cos(roll)).addScaledVector(side, Math.sin(roll));
        setPose(duck.obj, duck.pos, up, fwd, 0.36);
      }
      for (const w of whales) {
        const cyc = ((t + w.ph) % 16) / 16; // 0..1
        const a = w.ang + w.speed * t * 6;
        w.up = w.up || new THREE.Vector3();
        up.copy(w.c).addScaledVector(w.E, Math.cos(a) * w.rad).addScaledVector(w.N, Math.sin(a) * w.rad).normalize();
        tmp.copy(w.E).multiplyScalar(-Math.sin(a)).addScaledVector(w.N, Math.cos(a));
        fwd.copy(tmp).addScaledVector(up, -tmp.dot(up)).normalize();
        // surface 0.2-0.6, dive 0.6-0.75, hidden otherwise
        let depth = -0.3, pitch = 0;
        if (cyc > 0.15 && cyc < 0.25) depth = -0.3 + ((cyc - 0.15) / 0.1) * 0.28;
        else if (cyc >= 0.25 && cyc < 0.6) depth = -0.02 + Math.sin(t * 1.5) * 0.008;
        else if (cyc >= 0.6 && cyc < 0.78) { const k = (cyc - 0.6) / 0.18; depth = -0.02 - k * 0.3; pitch = Math.sin(k * Math.PI) * 0.9; }
        side.crossVectors(fwd, up);
        const f2 = fwd.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, -Math.sin(pitch));
        const u2 = up.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(fwd, Math.sin(pitch));
        pos.copy(up).multiplyScalar(R + depth);
        setPose(w.obj, pos, u2, f2, 0.26);
        w.obj.visible = depth > -0.25;
        // spout
        const sp = cyc > 0.3 && cyc < 0.45 ? (cyc - 0.3) / 0.15 : -1;
        for (let k = 0; k < 14; k++) {
          if (sp < 0) { m.makeScale(0, 0, 0); w.spout.setMatrixAt(k, m); continue; }
          const q = (sp * 3 + k / 14) % 1;
          const ang = (k / 14) * Math.PI * 2;
          const h = 0.05 + q * 0.28 - q * q * 0.12;
          const spread = q * 0.07;
          pos.copy(up).multiplyScalar(R + h).addScaledVector(fwd, 0.05 + Math.cos(ang) * spread).addScaledVector(side, Math.sin(ang) * spread);
          const s = 0.022 * (1 - q * 0.6);
          basisAt(m, pos, up, fwd, s);
          w.spout.setMatrixAt(k, m);
        }
        w.spout.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
