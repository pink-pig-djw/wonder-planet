import * as THREE from 'three';
import { outline } from './shaders.js';

export const LOD = { outlines: [] };

// Mesh + inverted-hull outline
export function addMesh(parent, geo, mat, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  parent.add(m);
  if (o.outline !== false) {
    const om = new THREE.Mesh(geo, outline(Object.assign({ w: 0.002, s: 0.0018, max: 0.012 }, o.outline || {}, { defines: mat.defines, outN: !!geo.attributes.oNormal, spin: mat.uniforms?.uSpin?.value ?? 1 })));
    m.add(om);
    m.userData.out = om;
  }
  return m;
}

// Instanced mesh from a list of { m: Matrix4, c?: Color }
export function addInstanced(parent, geo, mat, list, o = {}) {
  const n = Math.max(list.length, o.count || 0);
  const im = new THREE.InstancedMesh(geo, mat, Math.max(n, 1));
  im.count = list.length;
  const useColor = list.some((x) => x.c);
  for (let i = 0; i < list.length; i++) {
    im.setMatrixAt(i, list[i].m);
    if (useColor) im.setColorAt(i, list[i].c || new THREE.Color(1, 1, 1));
  }
  if (o.dynamic) { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; }
  parent.add(im);
  if (o.outline !== false) {
    const om = new THREE.InstancedMesh(geo, outline(Object.assign({ w: 0.0015, s: 0.0016, max: 0.01 }, o.outline || {}, { defines: mat.defines, outN: !!geo.attributes.oNormal, spin: mat.uniforms?.uSpin?.value ?? 1 })), Math.max(n, 1));
    om.instanceMatrix = im.instanceMatrix;
    om.count = im.count;
    om.frustumCulled = im.frustumCulled;
    parent.add(om);
    im.userData.out = om;
    if (o.lod !== false) LOD.outlines.push(om);
  }
  return im;
}

export function setCount(im, n) {
  im.count = n;
  if (im.userData.out) im.userData.out.count = n;
}

// Split a big instance list into ~24 spatial chunks so frustum culling works up close
export function addInstancedChunked(parent, geo, mat, list, o = {}) {
  const buckets = new Map();
  const v = new THREE.Vector3();
  for (const it of list) {
    v.setFromMatrixPosition(it.m);
    const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
    const f = ax > ay && ax > az ? 0 : ay > az ? 1 : 2;
    const key = f * 8 + (v.getComponent(f) > 0 ? 4 : 0) + (v.getComponent((f + 1) % 3) > 0 ? 2 : 0) + (v.getComponent((f + 2) % 3) > 0 ? 1 : 0);
    let b = buckets.get(key);
    if (!b) { b = []; buckets.set(key, b); }
    b.push(it);
  }
  const out = [];
  for (const b of buckets.values()) out.push(addInstanced(parent, geo, mat, b, o));
  return out;
}
