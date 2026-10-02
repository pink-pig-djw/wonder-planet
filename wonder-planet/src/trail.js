import * as THREE from 'three';
import { U } from './shaders.js';

const _s = new THREE.Vector3(), _d = new THREE.Vector3();

// Ribbon trail (contrails, wakes, rocket exhaust). Points are in the parent's local space.
export class Trail {
  constructor(parent, o = {}) {
    this.n = o.n ?? 48;
    this.width = o.width ?? 0.02;
    this.grow = o.grow ?? 1;
    this.step = o.step ?? 0.04;
    this.cross = o.cross ?? false;
    this.pts = [];
    const vpp = this.cross ? 4 : 2;
    this.vpp = vpp;
    const nv = this.n * vpp;
    this.pos = new Float32Array(nv * 3);
    const t = new Float32Array(nv);
    for (let i = 0; i < this.n; i++) for (let k = 0; k < vpp; k++) t[i * vpp + k] = i / (this.n - 1);
    const idx = [];
    for (let i = 0; i < this.n - 1; i++) {
      for (let r = 0; r < vpp; r += 2) {
        const a = i * vpp + r, b = (i + 1) * vpp + r;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    g.setIndex(idx);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uColor: { value: new THREE.Color(o.color ?? 0xffffff) }, uOpacity: { value: o.opacity ?? 0.8 } }, U),
      vertexShader: /* glsl */ `attribute float aT; varying float vT; varying vec3 vW;
        void main(){ vT = aT; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOpacity; uniform vec3 uSunDir; varying float vT; varying vec3 vW;
        void main(){
          float day = smoothstep(-0.2, 0.1, dot(normalize(vW), uSunDir));
          float a = pow(1.0 - vT, 1.4) * uOpacity * smoothstep(0.0, 0.04, vT);
          a = floor(a * 4.0 + 0.5) / 4.0;
          if (a < 0.02) discard;
          gl_FragColor = vec4(uColor * mix(0.35, 1.0, day), a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }
  reset() { this.pts.length = 0; }
  push(p, up) {
    const P = this.pts;
    if (P.length && P[0].p.distanceTo(p) < this.step) {
      P[0].p.copy(p); P[0].u.copy(up);
    } else {
      const rec = P.length >= this.n ? P.pop() : { p: new THREE.Vector3(), u: new THREE.Vector3() };
      rec.p.copy(p); rec.u.copy(up);
      P.unshift(rec);
    }
    this.rebuild();
  }
  rebuild() {
    const P = this.pts, n = this.n, vpp = this.vpp, pos = this.pos;
    if (!P.length) { pos.fill(0); this.geo.attributes.position.needsUpdate = true; return; }
    for (let i = 0; i < n; i++) {
      const k = Math.min(i, P.length - 1);
      const a = P[Math.max(k - 1, 0)].p, b = P[Math.min(k + 1, P.length - 1)].p;
      _d.subVectors(a, b);
      if (_d.lengthSq() < 1e-12) _d.set(1, 0, 0);
      _d.normalize();
      const up = P[k].u;
      _s.crossVectors(_d, up).normalize();
      const f = i / (n - 1);
      const w = this.width * (this.grow >= 1 ? 0.35 + f * this.grow : 1 - f * (1 - this.grow));
      const p = P[k].p;
      const o = i * vpp * 3;
      pos[o] = p.x + _s.x * w; pos[o + 1] = p.y + _s.y * w; pos[o + 2] = p.z + _s.z * w;
      pos[o + 3] = p.x - _s.x * w; pos[o + 4] = p.y - _s.y * w; pos[o + 5] = p.z - _s.z * w;
      if (vpp === 4) {
        pos[o + 6] = p.x + up.x * w; pos[o + 7] = p.y + up.y * w; pos[o + 8] = p.z + up.z * w;
        pos[o + 9] = p.x - up.x * w; pos[o + 10] = p.y - up.y * w; pos[o + 11] = p.z - up.z * w;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
