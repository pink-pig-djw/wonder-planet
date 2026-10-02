import * as THREE from 'three';
import { R, elev } from './world.js';

const ORBIT_MIN = 13.2, ORBIT_MAX = 95;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);

function makePose() { return { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }; }
function copyPose(a, b) { a.pos.copy(b.pos); a.target.copy(b.target); a.up.copy(b.up); return a; }
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class PlanetCamera {
  constructor(camera, dom, planet) {
    this.cam = camera; this.dom = dom; this.planet = planet;
    this.mode = 'orbit';
    this.q = new THREE.Quaternion();
    this.dist = 34; this.distT = 34;
    this.vel = new THREE.Vector2();
    this.focus = null;
    this.az = 0; this.el = 0.5; this.fd = 2; this.fdT = 2; this.fMin = 0.12; this.fMax = 12;
    this.sf = new THREE.Vector3(); this.sfInit = false;
    this.pose = makePose(); this.dest = makePose(); this.from = makePose();
    this.trans = null;
    this.pushAcc = 0;
    this.pickMeshes = [];
    this.onTap = null; this.onModeChange = null;
    this.lastInput = 0;
    this.orbitPose(this.pose);
    this._bind();
  }

  // ------------------------------------------------------------------ poses
  orbitPose(out) {
    out.pos.set(0, 0, this.dist).applyQuaternion(this.q);
    out.target.set(0, 0, 0);
    out.up.set(0, 1, 0).applyQuaternion(this.q);
    return out;
  }

  focusFrame(P, fwd, up) {
    const f = this.focus;
    if (f.kind === 'point') {
      P.copy(f.local); this.planet.localToWorld(P);
      up.copy(P).normalize();
      this.planet.getWorldQuaternion(_q);
      fwd.set(0, 1, 0).applyQuaternion(_q);
    } else {
      f.obj.getWorldPose(P, fwd, up);
    }
  }

  focusPose(out, dt) {
    const P = out.target, up = out.up, fwd = _v2;
    this.focusFrame(P, fwd, up);
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0).addScaledVector(up, -up.x);
    fwd.normalize();
    if (!this.sfInit) { this.sf.copy(fwd); this.sfInit = true; }
    else this.sf.lerp(fwd, 1 - Math.exp(-dt * (this.focus.kind === 'obj' ? 2.2 : 8)));
    this.sf.addScaledVector(up, -this.sf.dot(up)).normalize();
    const side = _v.crossVectors(up, this.sf);
    const ce = Math.cos(this.el), se = Math.sin(this.el), ca = Math.cos(this.az), sa = Math.sin(this.az);
    out.pos.copy(P)
      .addScaledVector(up, se * this.fd)
      .addScaledVector(this.sf, -ca * ce * this.fd)
      .addScaledVector(side, sa * ce * this.fd);
    if (this.focus.lift) out.target.addScaledVector(up, this.focus.lift);
    return out;
  }

  // ------------------------------------------------------------------ actions
  startTrans(dur = 1.6) {
    copyPose(this.from, this.pose);
    this.trans = { t: 0, dur };
  }

  setFocus(spec, opts = {}) {
    this.focus = spec;
    this.mode = 'focus';
    this.sfInit = false;
    this.az = opts.az ?? 0; this.el = opts.el ?? 0.55;
    this.fMin = opts.min ?? 0.12; this.fMax = opts.max ?? 12;
    this.fdT = opts.d ?? 2.2;
    if (!this.trans) this.fd = this.fdT;
    this.fd = this.fdT;
    this.startTrans(opts.dur ?? 1.8);
    this.vel.set(0, 0);
    this.onModeChange && this.onModeChange();
  }

  focusPoint(localPoint, opts = {}) {
    this.setFocus({ kind: 'point', local: localPoint.clone() }, opts);
  }

  follow(obj, opts = {}) {
    const d = obj.focus || {};
    this.setFocus({ kind: 'obj', obj, lift: d.lift || 0 }, Object.assign({ d: d.d ?? 1, el: d.el ?? 0.35, min: d.min ?? 0.1, max: d.max ?? 14, az: d.az ?? 0 }, opts));
  }

  toOrbit(dist) {
    const cp = this.pose.pos;
    _m.lookAt(cp, _v.set(0, 0, 0), this.pose.up);
    this.q.setFromRotationMatrix(_m);
    this.dist = cp.length();
    this.distT = dist ?? Math.max(this.dist * 1.4, 30);
    this.mode = 'orbit';
    this.focus = null;
    this.startTrans(1.4);
    this.onModeChange && this.onModeChange();
  }

  resetView() {
    if (this.mode === 'focus') this.toOrbit(34);
    else { this.distT = 34; }
  }

  pickSurface(sx, sy) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.cam);
    const hits = rc.intersectObjects(this.pickMeshes, false);
    if (!hits.length) return null;
    return this.planet.worldToLocal(hits[0].point.clone());
  }

  flyToScreen(sx, sy, opts = {}) {
    const p = this.pickSurface(sx, sy);
    if (!p) return false;
    this.focusPoint(p, Object.assign({ d: this.mode === 'focus' ? Math.min(this.fd, 2.4) : 2.6, el: 0.6, az: this.mode === 'focus' ? this.az : 0 }, opts));
    return true;
  }

  // ------------------------------------------------------------------ input
  drag(dx, dy, dtEvt) {
    this.lastInput = performance.now();
    if (this.mode === 'orbit') {
      const k = 0.0042 * THREE.MathUtils.clamp((this.dist - R) / 22, 0.12, 2.2);
      this.rotOrbit(-dx * k, -dy * k);
      const dts = Math.max(dtEvt, 8) / 1000;
      this.vel.set((-dx * k) / dts, (-dy * k) / dts);
    } else {
      this.az -= dx * 0.006;
      this.el = THREE.MathUtils.clamp(this.el + dy * 0.005, 0.03, 1.45);
    }
  }

  rotOrbit(a, b) {
    _q.setFromAxisAngle(Y, a); this.q.multiply(_q);
    _q.setFromAxisAngle(X, b); this.q.multiply(_q);
    this.q.normalize();
  }

  zoom(f, sx, sy) {
    this.lastInput = performance.now();
    if (this.mode === 'orbit') {
      if (f < 1 && this.distT <= ORBIT_MIN + 0.05) {
        this.pushAcc += 1 - f;
        if (this.pushAcc > 0.22) {
          this.pushAcc = 0;
          if (!this.flyToScreen(sx ?? innerWidth / 2, sy ?? innerHeight / 2, { d: 2.2, el: 0.5 })) {
            const p = this.planet.worldToLocal(this.pose.pos.clone()).setLength(R);
            this.focusPoint(p, { d: 2.2, el: 0.5 });
          }
        }
      } else this.pushAcc = 0;
      this.distT = THREE.MathUtils.clamp(this.distT * f, ORBIT_MIN, ORBIT_MAX);
    } else {
      if (f > 1 && this.fdT >= this.fMax - 0.01) {
        this.pushAcc += f - 1;
        if (this.pushAcc > 0.25) { this.pushAcc = 0; this.toOrbit(); return; }
      } else this.pushAcc = 0;
      this.fdT = THREE.MathUtils.clamp(this.fdT * f, this.fMin, this.fMax);
    }
  }

  _bind() {
    const el = this.dom;
    const pts = new Map();
    let down = null, moved = 0, pinch = 0, lastTap = null, tapTimer = null, lastMoveT = 0;
    const onDown = (e, tapCb) => {
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now(), tapCb }; moved = 0; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = 99;
      }
      this.vel.set(0, 0); this.dragging = true; lastMoveT = performance.now();
    };
    this.pointerDown = onDown;
    el.addEventListener('pointerdown', (e) => onDown(e));
    el.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      const now = performance.now();
      if (pts.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4) this.drag(dx, dy, now - lastMoveT);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) this.zoom(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = d;
      }
      lastMoveT = now;
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        this.dragging = false;
        if (performance.now() - lastMoveT > 80) this.vel.set(0, 0);
        if (down && moved < 6 && performance.now() - down.t < 450 && e.type === 'pointerup' && down.tapCb) {
          down.tapCb();
        } else if (down && moved < 6 && performance.now() - down.t < 450 && e.type === 'pointerup') {
          const x = e.clientX, y = e.clientY;
          if (lastTap && performance.now() - lastTap.t < 330 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) {
            clearTimeout(tapTimer); lastTap = null;
            this.flyToScreen(x, y);
          } else {
            lastTap = { x, y, t: performance.now() };
            tapTimer = setTimeout(() => { lastTap = null; this.onTap && this.onTap(x, y); }, 260);
          }
        }
        down = null;
      }
      if (pts.size < 2) pinch = 0;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      this.zoom(Math.exp(THREE.MathUtils.clamp(dy, -120, 120) * 0.0013), e.clientX, e.clientY);
    }, { passive: false });
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    if (this.mode === 'orbit') {
      if (!this.dragging && this.vel.lengthSq() > 1e-8) {
        this.rotOrbit(this.vel.x * dt, this.vel.y * dt);
        this.vel.multiplyScalar(Math.exp(-dt * 3.2));
      }
      this.dist += (this.distT - this.dist) * (1 - Math.exp(-dt * 6));
      this.orbitPose(this.dest);
    } else {
      this.fd += (this.fdT - this.fd) * (1 - Math.exp(-dt * 6));
      this.focusPose(this.dest, dt);
    }
    const P = this.pose;
    if (this.trans) {
      const tr = this.trans;
      tr.t += dt / tr.dur;
      const k = easeInOut(Math.min(1, tr.t));
      const a = this.from.pos, b = this.dest.pos;
      const ra = a.length(), rb = b.length();
      const na = _v.copy(a).normalize(), nb = _v2.copy(b).normalize();
      const ang = Math.acos(THREE.MathUtils.clamp(na.dot(nb), -1, 1));
      let dir;
      if (ang < 1e-4) dir = na.clone();
      else {
        const s = Math.sin(ang);
        dir = na.clone().multiplyScalar(Math.sin((1 - k) * ang) / s).addScaledVector(nb, Math.sin(k * ang) / s);
      }
      const lift = Math.sin(Math.PI * k) * Math.min(ang * R * 0.45, 9);
      P.pos.copy(dir).multiplyScalar(ra + (rb - ra) * k + lift);
      P.target.copy(this.from.target).lerp(this.dest.target, k);
      P.up.copy(this.from.up).lerp(this.dest.up, k);
      if (P.up.lengthSq() < 1e-6) P.up.copy(this.dest.up);
      P.up.normalize();
      if (tr.t >= 1) this.trans = null;
    } else copyPose(P, this.dest);

    // keep above terrain
    const loc = this.planet.worldToLocal(_v.copy(P.pos));
    const r = loc.length();
    loc.normalize();
    const minR = R + Math.max(elev(loc.x, loc.y, loc.z), 0) + 0.05;
    if (r < minR) P.pos.setLength(minR);

    this.cam.position.copy(P.pos);
    this.cam.up.copy(P.up);
    this.cam.lookAt(P.target);
    const near = THREE.MathUtils.clamp(P.pos.distanceTo(P.target) * 0.02, 0.003, 1.2);
    if (Math.abs(near - this.cam.near) > 1e-4) { this.cam.near = near; this.cam.updateProjectionMatrix(); }
  }
}
