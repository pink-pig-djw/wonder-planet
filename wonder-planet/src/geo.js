import * as THREE from 'three';

const _m = new THREE.Matrix4();

// Turn a geometry into a colored "part" (non-indexed, color/aTint/aEmit attributes)
export function part(geo, color, o = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (o.rx || o.ry || o.rz) {
    _m.makeRotationFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0));
    g.applyMatrix4(_m);
  }
  if (o.s) g.scale(o.s[0], o.s[1], o.s[2]);
  if (o.t) g.translate(o.t[0], o.t[1], o.t[2]);
  const n = g.attributes.position.count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3), tint = new Float32Array(n), emit = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    tint[i] = o.tint ?? 0; emit[i] = o.emit ?? 0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  g.setAttribute('aEmit', new THREE.BufferAttribute(emit, 1));
  for (const k of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'color', 'aTint', 'aEmit'].includes(k)) g.deleteAttribute(k);
  }
  return g;
}

export function merge(parts, outlineNormals = true) {
  const names = ['position', 'normal', 'color', 'aTint', 'aEmit'];
  const out = new THREE.BufferGeometry();
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  for (const name of names) {
    const size = parts[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const p of parts) {
      arr.set(p.attributes[name].array, off);
      off += p.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  if (outlineNormals) addOutlineNormals(out);
  out.computeBoundingSphere();
  return out;
}

// Smooth normals keyed by position — used by the inverted-hull outline so hard-edged
// shapes (boxes) get a closed shell.
export function addOutlineNormals(g) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const map = new Map();
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(pos.getX(i) * 2000) + '_' + Math.round(pos.getY(i) * 2000) + '_' + Math.round(pos.getZ(i) * 2000);
    keys[i] = k;
    let a = map.get(k);
    if (!a) { a = [0, 0, 0]; map.set(k, a); }
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  const on = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = map.get(keys[i]);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    on[i * 3] = a[0] / l; on[i * 3 + 1] = a[1] / l; on[i * 3 + 2] = a[2] / l;
  }
  g.setAttribute('oNormal', new THREE.BufferAttribute(on, 3));
  return g;
}

// Simple geometry with plain smooth normals for outline (when no parts)
export function prep(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  addOutlineNormals(g);
  return g;
}

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _s = new THREE.Vector3();
export function basisAt(m, pos, up, fwdHint, sx = 1, sy = sx, sz = sx) {
  _y.copy(up).normalize();
  _z.copy(fwdHint).addScaledVector(_y, -fwdHint.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.set(1, 0, 0).addScaledVector(_y, -_y.x);
  _z.normalize();
  _x.crossVectors(_y, _z);
  m.makeBasis(_x, _y, _z);
  m.scale(_s.set(sx, sy, sz));
  m.setPosition(pos);
  return m;
}

export function tangentFrame(d, e = new THREE.Vector3(), n = new THREE.Vector3()) {
  if (Math.abs(d.y) > 0.995) e.set(1, 0, 0); else e.set(0, 1, 0).cross(d);
  e.normalize();
  n.crossVectors(d, e).normalize();
  return { e, n };
}

export function randDir(rng, out = new THREE.Vector3()) {
  const z = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

// rotate vector v around unit axis by angle (Rodrigues) -> out
export function rotAxis(v, axis, ang, out = new THREE.Vector3()) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const d = axis.dot(v);
  const cx = axis.y * v.z - axis.z * v.y, cy = axis.z * v.x - axis.x * v.z, cz = axis.x * v.y - axis.y * v.x;
  return out.set(
    v.x * c + cx * s + axis.x * d * (1 - c),
    v.y * c + cy * s + axis.y * d * (1 - c),
    v.z * c + cz * s + axis.z * d * (1 - c),
  );
}

export function hexes(arr) { return arr.map((h) => new THREE.Color(h)); }
