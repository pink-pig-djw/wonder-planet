import * as THREE from 'three';
import { R, world } from './world.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _a = new THREE.Vector3();

export function makeClock(planet, sunDir) {
  // local solar time (hours) at a planet-local direction
  return (localDir) => {
    const w = _v.copy(localDir).transformDirection(planet.matrixWorld);
    planet.parent.getWorldQuaternion(_q);
    const A = _a.set(0, 1, 0).applyQuaternion(_q);
    const sp = _v2.copy(sunDir).addScaledVector(A, -sunDir.dot(A));
    const wp = _v3.copy(w).addScaledVector(A, -w.dot(A));
    const ang = Math.atan2(A.dot(new THREE.Vector3().crossVectors(sp, wp)), sp.dot(wp));
    return (((12 + (ang / (Math.PI * 2)) * 24) % 24) + 24) % 24;
  };
}
const _q = new THREE.Quaternion();

export function fmtTime(h) {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const word = h < 5 ? '深夜' : h < 7 ? '清晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 17 ? '下午' : h < 19 ? '傍晚' : h < 23 ? '夜晚' : '深夜';
  return `${word} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function setupUI(ctx) {
  const { pc, camera, planet, state, U, followables, clock } = ctx;
  const bubble = $('bubble'), bName = $('b-name'), bInfo = $('b-info');
  const hint = $('hint');
  const labelsEl = $('labels');

  // ---------------- toggles
  const tSpin = $('t-spin'), tSpeed = $('t-speed'), tDots = $('t-dots'), tLabels = $('t-labels');
  tSpin.onclick = () => { state.spin = !state.spin; tSpin.setAttribute('aria-pressed', state.spin); };
  const speeds = [1, 3, 8, 0.3];
  let si = 0;
  tSpeed.onclick = () => {
    si = (si + 1) % speeds.length; state.speed = speeds[si];
    tSpeed.textContent = `速度 ${state.speed}×`;
    tSpeed.setAttribute('aria-pressed', state.speed !== 1);
  };
  tDots.onclick = () => { U.uHalftone.value = U.uHalftone.value > 0.5 ? 0 : 1; tDots.setAttribute('aria-pressed', U.uHalftone.value > 0.5); };
  let showLabels = true;
  tLabels.onclick = () => { showLabels = !showLabels; tLabels.setAttribute('aria-pressed', showLabels); labelsEl.hidden = !showLabels; };

  // ---------------- follow toolbar
  const cats = {};
  for (const f of followables) (cats[f.kind] = cats[f.kind] || []).push(f);
  const idx = {};
  const tools = [...document.querySelectorAll('.tool[data-k]')];
  let current = null;
  const setActive = (k) => tools.forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === k));
  const follow = (obj) => {
    current = obj;
    pc.follow(obj);
    setActive(obj.kind);
    hideHint();
  };
  tools.forEach((b) => {
    const k = b.dataset.k;
    if (!cats[k] || !cats[k].length) { b.hidden = true; return; }
    b.onclick = () => {
      const list = cats[k];
      idx[k] = ((idx[k] ?? -1) + 1) % list.length;
      if (k === 'car') idx[k] = Math.floor(Math.random() * list.length);
      follow(list[idx[k]]);
    };
  });
  const home = () => { current = null; setActive(null); pc.toOrbit(34); };
  $('t-home').onclick = home;
  $('b-exit').onclick = home;
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') home(); });
  pc.onModeChange = () => { if (pc.mode !== 'focus' || pc.focus.kind !== 'obj') { current = null; setActive(null); } };

  // ---------------- tap to follow
  const proj = new THREE.Vector3(), P = new THREE.Vector3(), F = new THREE.Vector3(), Up = new THREE.Vector3();
  const occluded = (p) => {
    const o = camera.position, d = _v.subVectors(p, o);
    const L = d.length(); d.divideScalar(L);
    const b = o.dot(d), c = o.lengthSq() - (R + 0.02) * (R + 0.02);
    const disc = b * b - c;
    if (disc < 0) return false;
    const t = -b - Math.sqrt(disc);
    return t > 0 && t < L - 0.05;
  };
  pc.onTap = (x, y) => {
    let best = null, bd = 34;
    for (const f of followables) {
      f.getWorldPose(P, F, Up);
      if (occluded(P)) continue;
      proj.copy(P).project(camera);
      if (proj.z > 1) continue;
      const sx = (proj.x * 0.5 + 0.5) * innerWidth, sy = (-proj.y * 0.5 + 0.5) * innerHeight;
      const dd = Math.hypot(sx - x, sy - y);
      if (dd < bd) { bd = dd; best = f; }
    }
    if (best) follow(best);
  };

  // ---------------- hint fades after first interaction
  let hintHidden = false;
  const hideHint = () => { if (hintHidden) return; hintHidden = true; setTimeout(() => { hint.style.opacity = '0'; }, 4000); };
  renderer_dom(pc).addEventListener('pointerdown', hideHint, { once: true });

  // ---------------- city labels
  const labels = world.cities.map((c) => {
    const el = document.createElement('div');
    el.className = 'city';
    el.innerHTML = `${c.name}<small>${c.en}</small>`;
    const go = () => {
      current = null; setActive(null);
      pc.focusPoint(c.c.clone().multiplyScalar(R + c.h), { d: 2.4 + c.rad, el: 0.6, az: 0.5 });
    };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); pc.pointerDown(e, go); });
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    labelsEl.appendChild(el);
    return { c, el, anchor: c.c.clone().multiplyScalar(R + c.h + Math.min(c.landmarkH || 0.3, 0.6) + 0.25) };
  });
  const extra = [];
  if (world.features.castle) extra.push({ name: '云朵城堡', en: 'CLOUD CASTLE', d: world.features.castle, h: 0.75 });
  if (world.volcano) extra.push({ name: '咕嘟火山', en: 'BUBBLE VOLCANO', d: world.volcano.c, h: 1.35 });
  if (world.features.pyramids) extra.push({ name: '沙丘金字塔', en: 'DUNE PYRAMIDS', d: world.features.pyramids, h: 0.5 });
  if (world.features.rocket) extra.push({ name: '火箭发射场', en: 'LAUNCH PAD', d: world.features.rocket.d, h: 0.6 });
  for (const x of extra) {
    const el = document.createElement('div');
    el.className = 'city';
    el.style.background = '#ffe9a8';
    el.innerHTML = `${x.name}<small>${x.en}</small>`;
    const go = () => { current = null; setActive(null); pc.focusPoint(x.d.clone().multiplyScalar(R + 0.1), { d: 2.2, el: 0.5, az: 0.4 }); };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); pc.pointerDown(e, go); });
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    labelsEl.appendChild(el);
    labels.push({ c: null, el, anchor: x.d.clone().multiplyScalar(R + x.h) });
  }

  const W = new THREE.Vector3(), N = new THREE.Vector3(), C = new THREE.Vector3();
  let frameN = 0;
  return {
    update() {
      frameN++;
      // labels
      if (showLabels) {
        for (const L of labels) {
          W.copy(L.anchor);
          planet.localToWorld(W);
          N.copy(W).normalize();
          C.subVectors(camera.position, W);
          const dist = C.length();
          const facing = N.dot(C.divideScalar(dist));
          proj.copy(W).project(camera);
          const vis = facing > 0.08 && proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1 && dist > 1.6;
          if (!vis) { if (L.el.style.display !== 'none') L.el.style.display = 'none'; continue; }
          if (L.el.style.display === 'none') L.el.style.display = '';
          const sx = (proj.x * 0.5 + 0.5) * innerWidth, sy = (-proj.y * 0.5 + 0.5) * innerHeight;
          const s = THREE.MathUtils.clamp(16 / dist, 0.62, 1);
          const op = THREE.MathUtils.smoothstep(facing, 0.08, 0.3) * THREE.MathUtils.smoothstep(dist, 1.6, 3.0);
          L.el.style.opacity = op.toFixed(2);
          L.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
          L.el.style.zIndex = String(Math.round(1000 - dist * 10));
        }
      }
      // bubble
      if (frameN % 6 !== 0) return;
      if (pc.mode === 'focus') {
        bubble.hidden = false;
        let local;
        if (pc.focus.kind === 'obj') {
          const o = pc.focus.obj;
          bName.textContent = o.name;
          o.getWorldPose(P, F, Up);
          local = planet.worldToLocal(P.clone()).normalize();
          const t = o.kind === 'space' ? '' : ` · ${fmtTime(clock(local))}`;
          bInfo.textContent = `${o.info()}${t}`;
        } else {
          local = pc.focus.local.clone().normalize();
          let near = null, nd = 1e9;
          for (const c of world.cities) { const d = c.c.angleTo(local) * R; if (d < nd) { nd = d; near = c; } }
          bName.textContent = nd < near.rad + 0.3 ? `${near.name} · 街头漫步` : '地表漫游';
          bInfo.textContent = `当地 ${fmtTime(clock(local))}${nd >= near.rad + 0.3 ? ` · 距${near.name} ${Math.round(nd * 120)} 公里` : ''}`;
        }
      } else bubble.hidden = true;
    },
  };
}

function renderer_dom(pc) { return pc.dom; }
