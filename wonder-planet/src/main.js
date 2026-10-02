import './cm.js';
import * as THREE from 'three';
import { U } from './shaders.js';
import { R, world, generateWorld } from './world.js';
import { buildTerrain, buildWater, buildAtmosphere } from './planet.js';
import { buildSky } from './sky.js';
import { PlanetCamera } from './camera.js';
import { buildCities } from './cities.js';
import { planRoads, makeBlocked, buildRoads, buildCars } from './roads.js';
import { buildNature } from './nature.js';
import { buildPlanes, buildClouds, buildBalloons, buildBirds } from './air.js';
import { buildSea } from './sea.js';
import { buildRocket, buildUFO, buildSpace } from './space.js';
import { buildFeatures } from './features.js';
import { setupUI, makeClock } from './ui.js';
import { mulberry32 } from './noise.js';
import { LOD } from './mk.js';

const loadMsg = document.getElementById('load-msg');
const step = (msg) => new Promise((res) => { if (loadMsg) loadMsg.textContent = msg; requestAnimationFrame(() => setTimeout(res, 0)); });

async function init() {
  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  stage.appendChild(renderer.domElement);
  U.uDot.value = 4.2 * PR;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 3000);

  await step('正在捏出大陆和海洋…');
  generateWorld(7);
  const rng = mulberry32(2024);
  planRoads();

  const tilt = new THREE.Group();
  tilt.rotation.z = 0.32;
  scene.add(tilt);
  const planet = new THREE.Group();
  tilt.add(planet);

  const terrain = buildTerrain();
  const water = buildWater();
  planet.add(terrain, water);
  tilt.add(buildAtmosphere());
  const sky = buildSky(scene);

  await step('正在盖房子、铺公路…');
  const cities = buildCities(planet, rng);
  buildRoads(planet);
  const blocked = makeBlocked();

  await step('正在种树、放牛…');
  buildNature(planet, rng, blocked);
  const features = buildFeatures(planet, rng, planet);

  await step('正在放飞飞机和热气球…');
  const cars = buildCars(planet, rng, planet);
  const planes = buildPlanes(planet, rng, planet);
  const clouds = buildClouds(planet, rng, planet);
  const balloons = buildBalloons(planet, rng, planet);
  const birds = buildBirds(planet, rng);
  const sea = buildSea(planet, rng, planet);
  const rocket = buildRocket(planet, rng, planet);
  const ufo = buildUFO(planet, rng, planet);
  const space = buildSpace(tilt, rng);

  const pc = new PlanetCamera(camera, renderer.domElement, planet);
  pc.pickMeshes = [terrain.userData.mesh, water.userData.mesh];

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { spin: !reduce, speed: 1, simTime: 0, spinAngle: 0, nearLOD: null };

  // start with the biggest city in morning light
  {
    const target = U.uSunDir.value.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.75);
    target.y = 0.25; target.normalize();
    let best = 0, bd = -2;
    const c = world.cities[0].c;
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      planet.rotation.y = a; planet.updateMatrixWorld(true);
      const w = c.clone().transformDirection(planet.matrixWorld);
      const d = w.dot(target);
      if (d > bd) { bd = d; best = a; }
    }
    state.spinAngle = best;
    planet.rotation.y = best; planet.updateMatrixWorld(true);
    const w = c.clone().transformDirection(planet.matrixWorld);
    const m = new THREE.Matrix4().lookAt(w.clone().multiplyScalar(34).add(new THREE.Vector3(0, 3, 0)), new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    pc.q.setFromRotationMatrix(m);
    pc.update(0);
  }

  const clock = makeClock(planet, U.uSunDir.value);
  const followables = [
    ...planes.planes,
    ...cars.cars,
    ...sea.boats,
    ...balloons.balloons,
    rocket.obj,
    ufo.obj,
    ...space.objs,
  ];
  const ui = setupUI({ pc, camera, planet, state, U, followables, clock });
  if (reduce) document.getElementById('t-spin').setAttribute('aria-pressed', 'false');

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  const cityHours = (city) => clock(city.c);
  const tm = new THREE.Clock();
  function frame(fixedDt, skipRender) {
    const rdt = fixedDt ?? Math.min(tm.getDelta(), 0.05);
    const dt = rdt * state.speed;
    state.simTime += dt;
    const t = state.simTime;
    U.uTime.value = t;
    if (state.spin) state.spinAngle += dt * 0.02;
    planet.rotation.y = state.spinAngle;
    planet.updateMatrixWorld(true);
    tilt.updateMatrixWorld(true);
    cities.update(t, cityHours);
    cars.update(dt);
    planes.update(t);
    clouds.update(t, dt);
    balloons.update(t);
    birds.update(t);
    sea.update(t);
    rocket.update(t, dt);
    ufo.update(t);
    space.update(t);
    features.update(t);
    planet.updateMatrixWorld(true);
    tilt.updateMatrixWorld(true);
    pc.update(rdt);
    const near = camera.position.length() < 19;
    if (near !== state.nearLOD) { state.nearLOD = near; for (const o of LOD.outlines) o.visible = near; }
    sky.update(camera);
    ui.update();
    if (!skipRender) renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(() => frame());
  document.getElementById('loader').classList.add('done');
  window.__planetReady = true;
  window.__P = { pc, state, world, U, planet, tilt, renderer, scene, camera, frame, cars, planes, sea, rocket, ufo, space, balloons, followables, clock };
}

init().catch((e) => {
  console.error(e);
  const m = document.getElementById('load-msg');
  if (m) { m.className = 'err'; m.textContent = '星球搭建失败：' + (e && e.message ? e.message : e); }
});
