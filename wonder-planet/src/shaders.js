import * as THREE from 'three';

// Shared uniforms (same objects referenced by every material)
export const U = {
  uSunDir: { value: new THREE.Vector3(1, 0.35, 0.55).normalize() },
  uTime: { value: 0 },
  uHalftone: { value: 1 },
  uDot: { value: 5 },
  uR: { value: 10 },
};

export const GLSL_COMMON = /* glsl */ `
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
`;

const DEFORM = /* glsl */ `
#ifdef SPIN
  { float a = uTime * uSpin + seed * 6.2831; float c = cos(a), s = sin(a);
    pos.xy = vec2(c * pos.x - s * pos.y, s * pos.x + c * pos.y);
    nrm.xy = vec2(c * nrm.x - s * nrm.y, s * nrm.x + c * nrm.y); }
#endif
#ifdef SWAY
  { float k = max(pos.y, 0.0); k *= k;
    pos.x += k * 0.075 * sin(uTime * 1.7 + seed * 40.0);
    pos.z += k * 0.05 * sin(uTime * 1.3 + seed * 17.0); }
#endif
#ifdef FLAP
  pos.y += abs(pos.x) * 0.9 * sin(uTime * 15.0 + seed * 30.0);
#endif
`;

const SEED = /* glsl */ `
  float seed = 0.5;
#ifdef USE_INSTANCING
  seed = hash13(instanceMatrix[3].xyz * 13.7 + 0.37);
#endif
  mat4 M = modelMatrix;
#ifdef USE_INSTANCING
  M = modelMatrix * instanceMatrix;
#endif
`;

const VS = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform vec3 uColor;
uniform float uSpin;
varying vec3 vN;
varying vec3 vW;
varying vec3 vC;
varying float vE;
varying float vSeed;
#ifdef EMIT_ATTR
attribute float aEmit;
#endif
#ifdef TINTMASK
attribute float aTint;
#endif
#ifdef BUILDING
varying vec3 vLoc; varying vec3 vLN; varying float vH; varying float vRad;
#endif
#ifdef TERRAIN
attribute float aFarm; varying float vFarm; varying vec3 vObj;
#endif
#ifdef ROAD
attribute vec3 aRoad; varying vec3 vRoad;
#endif
${GLSL_COMMON}
void main(){
  vec3 pos = position; vec3 nrm = normal;
  ${SEED}
  ${DEFORM}
  vec4 wp = M * vec4(pos, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(M) * nrm);
  vSeed = seed;
  vec3 base = uColor;
#ifdef USE_COLOR
  base *= color;
#endif
  vec3 tint = uTint;
#ifdef USE_INSTANCING_COLOR
  tint *= instanceColor;
#endif
#ifdef TINTMASK
  base *= mix(vec3(1.0), tint, aTint);
#else
  base *= tint;
#endif
  vC = base;
  vE = 0.0;
#ifdef EMIT_ATTR
  vE = aEmit;
#endif
#ifdef BUILDING
  vec3 sc = vec3(1.0);
 #ifdef USE_INSTANCING
  sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
 #endif
  vLoc = position * sc; vLN = normal; vH = sc.y; vRad = sc.x * 0.5;
#endif
#ifdef TERRAIN
  vFarm = aFarm; vObj = position;
#endif
#ifdef ROAD
  vRoad = aRoad;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SHADE = /* glsl */ `
uniform vec3 uSunDir;
uniform float uHalftone;
uniform float uDot;
float htDot(float k){
  vec2 p = gl_FragCoord.xy / uDot;
  p = vec2(p.x - p.y, p.x + p.y) * 0.70710678;
  vec2 f = fract(p) - 0.5;
  float d = length(f);
  float r = sqrt(clamp(k, 0.0, 1.0)) * 0.62;
  return 1.0 - smoothstep(r - 0.07, r + 0.07, d);
}
vec3 toonShade(vec3 base, vec3 n, vec3 wp, float emit, vec3 emitCol){
  float ndl = dot(n, uSunDir);
  float b1 = smoothstep(-0.03, 0.03, ndl);
  float b2 = smoothstep(0.45, 0.5, ndl);
  vec3 V = normalize(cameraPosition - wp);
  float rim = smoothstep(0.62, 0.68, 1.0 - max(dot(n, V), 0.0));
#ifdef SPACE
  float day = 1.0; float sunUp = 1.0;
  float light = 0.36 + 0.5 * b1 + 0.14 * b2;
#else
  vec3 up = normalize(wp);
  float sunUp = dot(up, uSunDir);
  float day = smoothstep(-0.2, 0.08, sunUp);
  float light = 0.62 + 0.25 * b1 + 0.13 * b2;
#endif
  vec3 dayCol = base * light + rim * b1 * 0.10;
  float dusk = exp(-sunUp * sunUp * 26.0);
  dayCol *= mix(vec3(1.0), vec3(1.16, 0.84, 0.70), dusk * 0.55);
  vec3 nightCol = base * vec3(0.22, 0.27, 0.52) + rim * vec3(0.04, 0.06, 0.14);
  vec3 col = mix(nightCol, dayCol, day);
  float shadow = mix(0.42, (1.0 - b1) * 0.62 + (1.0 - b2) * 0.14, day);
  col *= 1.0 - 0.2 * htDot(shadow) * uHalftone;
  float em = clamp(emit * mix(1.0, 0.28, day), 0.0, 1.0);
  col = mix(col, emitCol, em);
  return col;
}
`;

const FS = /* glsl */ `
uniform float uTime;
uniform vec3 uEmitCol;
uniform float uR;
varying vec3 vN;
varying vec3 vW;
varying vec3 vC;
varying float vE;
varying float vSeed;
#ifdef BUILDING
varying vec3 vLoc; varying vec3 vLN; varying float vH; varying float vRad;
#endif
#ifdef TERRAIN
varying float vFarm; varying vec3 vObj;
uniform vec4 uCityC[8]; uniform vec3 uCityE[8]; uniform vec3 uCityN[8]; uniform int uCityCount;
#endif
#ifdef ROAD
varying vec3 vRoad;
#endif
${GLSL_COMMON}
${SHADE}
void main(){
  vec3 n = normalize(vN);
#ifdef DOUBLE
  if (!gl_FrontFacing) n = -n;
#endif
  vec3 base = vC;
  float emit = vE;
  vec3 emitCol = uEmitCol;
#ifdef BUILDING
  float isWall = 1.0 - step(0.5, abs(vLN.y));
 #ifdef CYL
  float hc = atan(vLoc.z, vLoc.x) * vRad;
 #else
  float hc = abs(vLN.x) > 0.5 ? vLoc.z : vLoc.x;
 #endif
  vec2 cell = vec2(hc / 0.042, (vLoc.y - 0.02) / 0.048);
  vec2 f = fract(cell);
  float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.8);
  vec2 fw = fwidth(cell);
  win = mix(0.33, win, clamp(1.6 - max(fw.x, fw.y) * 2.2, 0.0, 1.0));
  win *= step(0.03, vLoc.y) * step(vLoc.y, vH - 0.025) * isWall;
  float h = hash13(vec3(floor(cell), vSeed * 91.0 + vLN.x * 3.0 + vLN.z * 7.0));
  float lit = step(0.45, fract(h + floor(uTime * 0.04 + h * 5.0) * 0.618));
  base = mix(base, vec3(0.52, 0.74, 0.95) * (0.85 + 0.25 * h), win);
  emit = win * lit;
  emitCol = mix(vec3(1.0, 0.82, 0.42), vec3(1.0, 0.95, 0.75), h);
  base *= 1.0 - 0.25 * step(0.5, vLN.y);
  base *= 1.0 - 0.2 * isWall * (1.0 - step(0.022, vLoc.y));
#endif
#ifdef ROAD
  if (vRoad.z > 0.5) { base = vec3(0.70, 0.66, 0.70); }
  else {
    float ac = abs(vRoad.y);
    base = vec3(0.36, 0.37, 0.46);
    base = mix(base, vec3(0.96), step(0.74, ac) * step(ac, 0.86));
    base = mix(base, vec3(1.0, 0.85, 0.28), step(ac, 0.08) * step(0.5, fract(vRoad.x * 7.0)));
    emit = step(0.74, ac) * step(ac, 0.86) * step(0.8, fract(vRoad.x * 3.0));
    emitCol = vec3(1.0, 0.78, 0.4);
  }
#endif
#ifdef TERRAIN
  vec3 d = normalize(vObj);
  if (vFarm > 0.35) {
    vec3 a = abs(d); vec2 uv; float face;
    if (a.x > a.y && a.x > a.z) { uv = d.yz / a.x; face = sign(d.x); }
    else if (a.y > a.z) { uv = d.xz / a.y; face = 2.0 * sign(d.y); }
    else { uv = d.xy / a.z; face = 3.0 * sign(d.z); }
    uv *= uR * 1.9;
    uv.x += hash13(vec3(floor(uv.y), face, 3.0)) * 0.9;
    vec2 cell = floor(uv); vec2 fr = fract(uv);
    float h = hash13(vec3(cell, face + 7.0));
    vec3 fc = h < 0.2 ? vec3(0.96, 0.83, 0.36) : h < 0.38 ? vec3(0.64, 0.85, 0.34) : h < 0.52 ? vec3(0.85, 0.63, 0.38)
            : h < 0.72 ? vec3(0.47, 0.77, 0.31) : h < 0.86 ? vec3(0.99, 0.91, 0.52) : vec3(0.78, 0.62, 0.86);
    float rows = step(0.5, fract((fract(h * 7.3) > 0.5 ? fr.x : fr.y) * 8.0));
    fc *= 1.0 - 0.08 * rows;
    float edge = min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y));
    fc = mix(vec3(0.25, 0.55, 0.27), fc, smoothstep(0.035, 0.06, edge));
    base = mix(base, fc, smoothstep(0.35, 0.6, vFarm));
  }
  for (int i = 0; i < 8; i++) {
    if (i >= uCityCount) break;
    vec4 c = uCityC[i];
    float dc = dot(d, c.xyz);
    if (dc < 0.97) continue;
    vec2 p = vec2(dot(d, uCityE[i]), dot(d, uCityN[i])) / dc * uR;
    float rr = length(p);
    if (rr > c.w + 0.05) continue;
    vec2 g = abs(fract(p / 0.2 + 0.5) - 0.5) * 0.2;
    float m = min(g.x, g.y);
    float along = g.x < g.y ? p.y : p.x;
    float street = 1.0 - smoothstep(0.02, 0.024, m);
    vec3 asphalt = vec3(0.37, 0.38, 0.47);
    float dash = (1.0 - smoothstep(0.0016, 0.003, m)) * step(0.5, fract(along * 12.0));
    vec3 cityCol = mix(vec3(0.91, 0.88, 0.81), mix(asphalt, vec3(1.0, 0.86, 0.3), dash), street);
    float ringD = abs(rr - c.w);
    float ring = 1.0 - smoothstep(0.03, 0.034, ringD);
    float ringDash = (1.0 - smoothstep(0.0016, 0.003, ringD)) * step(0.5, fract(atan(p.y, p.x) * c.w * 12.0));
    vec3 col = rr < c.w ? cityCol : base;
    col = mix(col, mix(asphalt, vec3(1.0, 0.86, 0.3), ringDash), ring);
    float lamp = (1.0 - smoothstep(0.0, 0.0035, abs(m - 0.026))) * step(0.8, fract(along * 10.0)) * step(rr, c.w - 0.03);
    if (lamp > emit) { emit = lamp; emitCol = vec3(1.0, 0.86, 0.5); }
    base = col;
  }
#endif
#ifdef BLINK
  emit *= step(0.6, fract(uTime * 0.8 + vSeed * 7.0));
#endif
  vec3 col = toonShade(base, n, vW, emit, emitCol);
  gl_FragColor = vec4(col, 1.0);
}
`;

const OVS = /* glsl */ `
uniform float uTime; uniform float uOutW; uniform float uOutS; uniform float uOutMax; uniform float uSpin;
#ifdef OUTN
attribute vec3 oNormal;
#endif
${GLSL_COMMON}
void main(){
  vec3 pos = position;
#ifdef OUTN
  vec3 nrm = oNormal;
#else
  vec3 nrm = normal;
#endif
  ${SEED}
  ${DEFORM}
  vec4 wp = M * vec4(pos, 1.0);
  vec3 wn = normalize(mat3(M) * nrm);
  float dist = length(cameraPosition - wp.xyz);
  wp.xyz += wn * min(uOutW + uOutS * dist, uOutMax);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const OFS = /* glsl */ `
uniform vec3 uOutCol;
void main(){ gl_FragColor = vec4(uOutCol, 1.0); }
`;

export const INK = new THREE.Color(0x1d1631);

export function toon(o = {}) {
  const defines = Object.assign({}, o.defines || {});
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, {
      uColor: { value: new THREE.Color(o.color ?? 0xffffff) },
      uTint: { value: new THREE.Color(o.tint ?? 0xffffff) },
      uEmitCol: { value: new THREE.Color(o.emitCol ?? 0xffd27a) },
      uSpin: { value: o.spin ?? 1 },
    }, o.uniforms || {}),
    vertexShader: VS,
    fragmentShader: FS,
    defines,
    vertexColors: !!o.vertexColors,
    side: o.side ?? THREE.FrontSide,
  });
  if (o.polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = o.polygonOffset[0];
    mat.polygonOffsetUnits = o.polygonOffset[1];
  }
  return mat;
}

export function outline(o = {}) {
  const defines = Object.assign({}, o.defines || {});
  if (o.outN !== false) defines.OUTN = '';
  // the outline must not tint / building etc: keep only deform defines
  for (const k of Object.keys(defines)) {
    if (!['SPIN', 'SWAY', 'FLAP', 'OUTN'].includes(k)) delete defines[k];
  }
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, {
      uOutW: { value: o.w ?? 0.002 },
      uOutS: { value: o.s ?? 0.0022 },
      uOutMax: { value: o.max ?? 0.02 },
      uOutCol: { value: new THREE.Color(o.color ?? INK) },
      uSpin: { value: o.spin ?? 1 },
    }),
    vertexShader: OVS,
    fragmentShader: OFS,
    defines,
    side: THREE.BackSide,
  });
}
