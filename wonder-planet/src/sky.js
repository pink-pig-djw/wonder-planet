import * as THREE from 'three';
import { U, GLSL_COMMON, SHADE, toon, outline } from './shaders.js';
import { mulberry32 } from './noise.js';
import { randDir } from './geo.js';

export function buildSky(scene) {
  const grp = new THREE.Group();
  // ---------------- background dome ----------------
  const bg = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: Object.assign({ uSkyK: { value: 0 }, uCamUp: { value: new THREE.Vector3(0, 1, 0) } }, U),
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uSkyK; uniform vec3 uCamUp;
        ${GLSL_COMMON}
        ${SHADE}
        float vnoise(vec3 p){
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          float a = hash13(i), b = hash13(i + vec3(1,0,0)), c = hash13(i + vec3(0,1,0)), d = hash13(i + vec3(1,1,0));
          float e = hash13(i + vec3(0,0,1)), g = hash13(i + vec3(1,0,1)), h = hash13(i + vec3(0,1,1)), k = hash13(i + vec3(1,1,1));
          return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
        }
        void main(){
          vec3 d = normalize(vDir);
          vec3 col = mix(vec3(0.10, 0.06, 0.20), vec3(0.05, 0.07, 0.19), d.y * 0.5 + 0.5);
          float n = vnoise(d * 2.2) * 0.55 + vnoise(d * 4.7 + 2.0) * 0.3 + vnoise(d * 9.0) * 0.15;
          float neb = smoothstep(0.5, 0.78, n);
          vec3 nc = mix(vec3(0.62, 0.24, 0.72), vec3(0.18, 0.55, 0.85), smoothstep(0.3, 0.7, vnoise(d * 1.3 + 7.0)));
          float bands = floor(neb * 3.0) / 3.0;
          col += nc * bands * 0.22;
          col += nc * htDot(neb * 0.7) * 0.3 * uHalftone;
          if (uSkyK > 0.001) {
            float h = dot(d, uCamUp);
            float sunUp = dot(uCamUp, uSunDir);
            vec3 zen = vec3(0.30, 0.60, 0.97), hor = vec3(0.70, 0.90, 1.0);
            float dusk = exp(-sunUp * sunUp * 18.0);
            hor = mix(hor, vec3(1.0, 0.68, 0.55), dusk * 0.8);
            zen = mix(zen, vec3(0.42, 0.42, 0.85), dusk * 0.6);
            vec3 sky = mix(hor, zen, smoothstep(-0.05, 0.55, h));
            float sd = max(dot(d, uSunDir), 0.0);
            sky += vec3(1.0, 0.9, 0.6) * pow(sd, 24.0) * 0.35;
            sky *= 1.0 - 0.07 * htDot(smoothstep(0.35, -0.05, h) * 0.5) * uHalftone;
            col = mix(col, sky, uSkyK);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  bg.renderOrder = -10;
  grp.add(bg);

  // ---------------- stars ----------------
  const rng = mulberry32(99);
  const N = 2200;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N), col = new Float32Array(N * 3);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(0xfff2b0), new THREE.Color(0xb8e4ff), new THREE.Color(0xffc4e1)];
  const d = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    randDir(rng, d).multiplyScalar(800);
    pos.set([d.x, d.y, d.z], i * 3);
    const big = rng() < 0.06;
    size[i] = big ? 9 + rng() * 9 : 1.6 + rng() * 2.8;
    phase[i] = rng() * 6.28;
    const c = palette[Math.floor(rng() * palette.length)];
    col.set([c.r, c.g, c.b], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  sg.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  sg.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: Object.assign({ uPR: { value: Math.min(devicePixelRatio, 2) }, uFade: { value: 1 } }, U),
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPR; uniform float uFade;
      attribute float aSize; attribute float aPhase; attribute vec3 aCol;
      varying vec3 vCol; varying float vBig;
      void main(){
        vCol = aCol; vBig = step(6.0, aSize);
        gl_PointSize = aSize * uPR * (0.7 + 0.3 * sin(uTime * 1.7 + aPhase)) * uFade;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vBig;
      void main(){
        vec2 p = gl_PointCoord - 0.5; float r = length(p);
        float core = 1.0 - smoothstep(mix(0.3, 0.07, vBig), mix(0.5, 0.12, vBig), r);
        float cr = (1.0 - smoothstep(0.0, 0.05, min(abs(p.x), abs(p.y)))) * (1.0 - smoothstep(0.15, 0.5, r)) * vBig;
        float a = max(core, cr);
        if (a < 0.02) discard;
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stars.renderOrder = -9;
  grp.add(stars);

  // ---------------- cartoon sun ----------------
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
        float s = abs(fract((a + uTime * 0.06) / (6.28318 / 14.0)) - 0.5) * 2.0;
        float spikeR = 0.47 + 0.3 * (1.0 - s);
        float spike = 1.0 - smoothstep(spikeR - 0.012, spikeR, r);
        float spikeIn = 1.0 - smoothstep(spikeR - 0.05, spikeR - 0.038, r);
        float disk = 1.0 - smoothstep(0.37, 0.38, r);
        float diskIn = 1.0 - smoothstep(0.34, 0.35, r);
        vec3 ink = vec3(0.11, 0.09, 0.19);
        vec3 col = vec3(0.0); float al = 0.0;
        float glow = exp(-r * r * 2.2) * 0.45;
        col = vec3(1.0, 0.75, 0.3) * glow; al = glow;
        col = mix(col, ink, spike); al = max(al, spike);
        col = mix(col, vec3(1.0, 0.68, 0.16), spikeIn * step(0.37, r));
        col = mix(col, ink, disk);
        vec3 face = mix(vec3(1.0, 0.97, 0.68), vec3(1.0, 0.84, 0.25), smoothstep(0.0, 0.34, r));
        col = mix(col, face, diskIn);
        float hl = 1.0 - smoothstep(0.07, 0.09, length(p - vec2(-0.13, 0.14)));
        col = mix(col, vec3(1.0), hl * 0.8);
        if (al < 0.01) discard;
        gl_FragColor = vec4(col, al);
      }`,
    transparent: true, depthWrite: false,
  }));
  sun.renderOrder = -8;
  sun.scale.setScalar(120);
  grp.add(sun);

  // ---------------- distant ringed planet ----------------
  const pg = new THREE.SphereGeometry(30, 48, 32).toNonIndexed();
  const pc = new Float32Array(pg.attributes.position.count * 3);
  const bands = [0xffb4a2, 0xe5989b, 0xffcdb2, 0xb5838d, 0xffd6a5].map((h) => new THREE.Color(h));
  for (let i = 0; i < pg.attributes.position.count; i++) {
    const y = pg.attributes.position.getY(i) / 30;
    const bi = Math.floor((y + 1) * 3.2 + Math.sin(y * 9) * 0.4 + 10);
    const c = bands[bi % bands.length];
    pc.set([c.r, c.g, c.b], i * 3);
  }
  pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const ringed = new THREE.Group();
  const pm = new THREE.Mesh(pg, toon({ vertexColors: true, defines: { SPACE: '' } }));
  const po = new THREE.Mesh(pg, outline({ outN: false, w: 0.3, s: 0.0, max: 0.5 }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(40, 66, 128, 1), new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    vertexShader: /* glsl */ `varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vP; varying vec3 vW;
      ${GLSL_COMMON}
      ${SHADE}
      void main(){
        float r = length(vP.xy);
        float t = (r - 40.0) / 26.0;
        float b = floor(t * 7.0);
        vec3 c = mix(vec3(1.0, 0.85, 0.6), vec3(0.85, 0.6, 0.75), fract(b * 0.37) );
        float gap = step(0.08, fract(t * 7.0)) ;
        float edge = step(0.015, t) * step(t, 0.985);
        vec3 ink = vec3(0.11, 0.09, 0.19);
        c = mix(ink, c, gap * edge);
        c *= 1.0 - 0.2 * htDot(0.3) * uHalftone;
        gl_FragColor = vec4(c, 0.92);
      }`,
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }));
  ring.rotation.x = -Math.PI / 2 + 0.35;
  ring.rotation.y = 0.3;
  ringed.add(pm, po, ring);
  ringed.position.set(-330, 130, -560);
  ringed.rotation.z = 0.25;
  grp.add(ringed);

  // small teal planet with a tiny moon
  const tg = new THREE.IcosahedronGeometry(12, 4);
  const teal = new THREE.Mesh(tg, toon({ color: 0x6fe3c8, defines: { SPACE: '' } }));
  const tealO = new THREE.Mesh(tg, outline({ outN: false, w: 0.18, s: 0, max: 0.3 }));
  teal.add(tealO);
  teal.position.set(470, -170, -260);
  grp.add(teal);

  // comet
  const comet = new THREE.Group();
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 2), toon({ color: 0xe8f6ff, defines: { SPACE: '' } }));
  head.add(new THREE.Mesh(head.geometry, outline({ outN: false, w: 0.08, s: 0, max: 0.2 })));
  const tail = new THREE.Mesh(new THREE.ConeGeometry(4.2, 70, 24, 1, true), new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `varying vec2 vUv; void main(){ float a = pow(vUv.y, 1.6) * 0.75; vec3 c = mix(vec3(0.5,0.8,1.0), vec3(1.0), vUv.y); float stripe = step(0.5, fract(vUv.x * 9.0)); a *= 0.7 + 0.3 * stripe; gl_FragColor = vec4(c * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  tail.position.y = -36;
  comet.add(head, tail);
  comet.position.set(260, 280, 420);
  comet.lookAt(0, 0, 0);
  comet.rotateX(Math.PI / 2);
  grp.add(comet);

  scene.add(grp);
  return {
    grp,
    update(camera) {
      const R0 = 10;
      const up = camera.position.clone().normalize();
      const alt = camera.position.length() - R0;
      const dayF = THREE.MathUtils.smoothstep(up.dot(U.uSunDir.value), -0.18, 0.22);
      const k = dayF * (1 - THREE.MathUtils.smoothstep(alt, 0.8, 4.5));
      bg.material.uniforms.uSkyK.value = k;
      bg.material.uniforms.uCamUp.value.copy(up);
      stars.material.uniforms.uFade.value = 1 - k;
      stars.visible = k < 0.98;
      sun.position.copy(U.uSunDir.value).multiplyScalar(600).add(camera.position);
      sun.quaternion.copy(camera.quaternion);
      bg.position.copy(camera.position);
      stars.position.copy(camera.position);
    },
  };
}
