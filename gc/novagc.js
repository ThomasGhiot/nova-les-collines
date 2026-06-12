'use strict';
/* =====================================================================
   NOVA SUNSHINE — La Baie des Baballes (v1.0)
   Niveau unique qualité "store" : missions du Capitaine Médor, course
   chronométrée, nonos cachés, charge au sol, faune (mouettes, crabes,
   papillons), ombres portées temps réel, tone mapping, particules,
   caméra Lakitu retravaillée (stable en l'air, recentrage C).
   Three.js (CDN) + Web Audio.
   ===================================================================== */
import * as THREE from 'three';

/* ---------------------------------------------------------------------
   AUDIO
--------------------------------------------------------------------- */
let AC = null, musicOn = true, nextBar = 0, barIdx = 0;
function initAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      setInterval(musicTick, 150);
      setInterval(ambience, 6500);
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { /* jouable sans audio */ }
}
function tone({ f0 = 440, f1 = f0, dur = 0.1, type = 'square', vol = 0.15, at = null, delay = 0 }) {
  if (!AC) return;
  const t0 = at !== null ? at : AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(f0, 1), t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(AC.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise({ dur = 0.15, vol = 0.2, f = 800, delay = 0 }) {
  if (!AC) return;
  const t0 = AC.currentTime + delay;
  const src = AC.createBufferSource();
  const buf = AC.createBuffer(1, Math.max(1, AC.sampleRate * dur), AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  src.buffer = buf;
  const flt = AC.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = f;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(flt).connect(g).connect(AC.destination);
  src.start(t0);
}
function bark(p = 1, d = 0) { tone({ f0: 420 * p, f1: 130 * p, dur: 0.13, type: 'sawtooth', vol: 0.16, delay: d }); noise({ dur: 0.08, vol: 0.1, f: 1200, delay: d }); }
function squeak(d = 0) { tone({ f0: 850, f1: 1550, dur: 0.07, type: 'sine', vol: 0.14, delay: d }); tone({ f0: 1550, f1: 550, dur: 0.13, type: 'sine', vol: 0.13, delay: d + 0.07 }); }
function whine(f0, f1, dur, d = 0) { tone({ f0, f1, dur, type: 'sine', vol: 0.13, delay: d }); }
function meow(d = 0) { tone({ f0: 520, f1: 800, dur: 0.12, type: 'sawtooth', vol: 0.09, delay: d }); tone({ f0: 800, f1: 320, dur: 0.2, type: 'sawtooth', vol: 0.09, delay: d + 0.12 }); }
const SFX = {
  jump(chain = 1) { bark(1 + (chain - 1) * 0.16); if (chain === 3) bark(1.55, 0.1); },
  land() { noise({ dur: 0.07, vol: 0.12, f: 400 }); },
  splash() { noise({ dur: 0.35, vol: 0.2, f: 900 }); tone({ f0: 320, f1: 80, dur: 0.25, type: 'sine', vol: 0.1 }); },
  coin() { squeak(); },
  stomp() { noise({ dur: 0.1, vol: 0.14, f: 500 }); meow(); },
  skid() { tone({ f0: 950, f1: 480, dur: 0.22, type: 'sawtooth', vol: 0.045 }); },
  hurt() { whine(1150, 480, 0.18); whine(950, 380, 0.24, 0.2); },
  win() { bark(1, 0); bark(1.18, 0.18); bark(1.35, 0.36); squeak(0.62); squeak(0.85); },
  over() { whine(750, 170, 1.5); },
  charge() { tone({ f0: 90, f1: 980, dur: 1.35, type: 'sawtooth', vol: 0.07 }); tone({ f0: 45, f1: 490, dur: 1.35, type: 'square', vol: 0.05 }); noise({ dur: 1.3, vol: 0.03, f: 3000 }); },
  superGo() { noise({ dur: 0.35, vol: 0.22, f: 2500 }); [880, 1109, 1319, 1760].forEach((f, i) => tone({ f0: f, dur: 0.45, vol: 0.07, delay: 0.03 * i })); bark(1.5, 0.15); bark(1.7, 0.32); },
  superEnd() { tone({ f0: 700, f1: 180, dur: 0.4, type: 'triangle', vol: 0.12 }); noise({ dur: 0.15, vol: 0.08, f: 600 }); },
  poundUp() { tone({ f0: 480, f1: 760, dur: 0.14, type: 'sine', vol: 0.07 }); },
  pound() { noise({ dur: 0.28, vol: 0.3, f: 300 }); tone({ f0: 130, f1: 40, dur: 0.32, type: 'sawtooth', vol: 0.2 }); },
  quest() { [784, 988, 1175, 1568].forEach((f, i) => tone({ f0: f, dur: 0.16, vol: 0.09, delay: i * 0.11 })); bark(1.25, 0.5); },
  ring() { tone({ f0: 1175, f1: 1568, dur: 0.12, type: 'sine', vol: 0.1 }); },
  raceGo() { tone({ f0: 660, dur: 0.12, vol: 0.1 }); tone({ f0: 660, dur: 0.12, vol: 0.1, delay: 0.25 }); tone({ f0: 990, dur: 0.3, vol: 0.12, delay: 0.5 }); },
  gull() { tone({ f0: 1350, f1: 1050, dur: 0.16, type: 'sine', vol: 0.035 }); tone({ f0: 1280, f1: 880, dur: 0.22, type: 'sine', vol: 0.03, delay: 0.22 }); },
  bigBark() {                                                          // le WOUF qui fait fuir les matous
    bark(0.8); bark(0.65, 0.09);
    noise({ dur: 0.22, vol: 0.16, f: 650 });
    tone({ f0: 180, f1: 60, dur: 0.25, type: 'sawtooth', vol: 0.1 });
  },
  scaredMeow() { tone({ f0: 880, f1: 1400, dur: 0.14, type: 'sawtooth', vol: 0.07 }); tone({ f0: 1300, f1: 700, dur: 0.12, type: 'sawtooth', vol: 0.06, delay: 0.14 }); },
  coco() { noise({ dur: 0.08, vol: 0.18, f: 350 }); tone({ f0: 220, f1: 90, dur: 0.12, type: 'triangle', vol: 0.14 }); },
};
function ambience() {
  if (!AC || state !== 'play' || !musicOn) return;
  if (Math.random() < 0.8) noise({ dur: 2.2, vol: 0.016, f: 480 });           // ressac
  if (Math.random() < 0.4) SFX.gull();
}
const EIGHTH = 0.21, BARLEN = EIGHTH * 8;
const MEL = [
  [659, 784, 880, 784, 1047, 880, 784, 659],
  [659, 784, 880, 784, 1175, 1047, 880, 784],
  [698, 587, 698, 880, 1047, 0, 880, 698],
  [784, 659, 587, 659, 784, 880, 659, 523],
];
const BASS = [[262, 196, 220, 175], [262, 196, 220, 175], [349, 262, 294, 220], [262, 220, 196, 165]];
function musicTick() {
  if (!AC) return;
  if (!musicOn || paused || (state !== 'play' && state !== 'transform')) { nextBar = AC.currentTime + 0.1; return; }
  if (nextBar < AC.currentTime) nextBar = AC.currentTime + 0.05;
  while (nextBar < AC.currentTime + 0.4) {
    const m = MEL[barIdx % 4], b = BASS[barIdx % 4];
    m.forEach((f, i) => { if (f) tone({ f0: f, dur: 0.17, type: 'triangle', vol: 0.05, at: nextBar + i * EIGHTH }); });
    b.forEach((f, i) => { if (f) tone({ f0: f / 2, dur: 0.36, type: 'triangle', vol: 0.06, at: nextBar + i * EIGHTH * 2 }); });
    barIdx++; nextBar += BARLEN;
  }
}

/* ---------------------------------------------------------------------
   RENDU — 480p lissé, ombres portées, tone mapping filmique
--------------------------------------------------------------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfeeff, 130, 460);

const camera = new THREE.PerspectiveCamera(52, 4 / 3, 0.1, 900);

scene.add(new THREE.HemisphereLight(0xeaf8ff, 0xc8a060, 1.0));
const sun = new THREE.DirectionalLight(0xfff6d8, 1.6);
sun.position.set(-120, 220, -90);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -150; sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150; sun.shadow.camera.bottom = -150;
sun.shadow.camera.near = 60; sun.shadow.camera.far = 520;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

function resize() {
  const ih = 480;
  const iw = Math.round(innerWidth / innerHeight * ih);
  renderer.setSize(iw, ih, false);
  camera.aspect = iw / ih;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function makeTex(draw, size = 64, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const groundTex = makeTex((g, s) => {
  g.fillStyle = '#e8e4dc'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = ['#dcd8d0', '#f2eee6', '#d2cec6', '#eeeae2'][i % 4];
    g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2, 2);
  }
}, 64, 60);
const woodTex = makeTex((g, s) => {
  g.fillStyle = '#a8743c'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#8e5e2e';
  for (let y = 0; y < s; y += 8) g.fillRect(0, y, s, 2);
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#b8844c' : '#986830'; g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 3, 1); }
}, 64, 2);

const sky = (() => {
  const geo = new THREE.SphereGeometry(420, 24, 14);
  const pos = geo.attributes.position;
  const cTop = new THREE.Color(0x1d6fd8), cHor = new THREE.Color(0xcfeeff);
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) / 420));
    const c = cHor.clone().lerp(cTop, Math.pow(t, 0.65));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -2;
  scene.add(m);
  return m;
})();
const radialTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex, color: 0xfff4be, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
flare.scale.setScalar(130);
flare.position.set(-220, 300, -160);
scene.add(flare);

const rand = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------------------------------------------------------------------
   L'ÎLE
--------------------------------------------------------------------- */
const WATER = 0;
const HILLS = [
  [0, 0, 24, 34],
  [55, -35, 12, 22], [-50, 40, 10, 20], [40, 55, 8, 16], [-60, -45, 9, 18],
];
function terrainH(x, z) {
  let h = 1.8;
  for (const [a, b, hh, r] of HILLS) {
    const d2 = ((x - a) * (x - a) + (z - b) * (z - b)) / (r * r);
    h += hh * Math.exp(-d2);
  }
  h += Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.5;
  const d = Math.hypot(x, z);
  if (d > 80) h -= (d - 80) * 0.22;
  if (d > 110) h -= (d - 110) * 0.5;
  return h;
}
(function buildIsland() {
  const geo = new THREE.PlaneGeometry(440, 440, 110, 110);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);
    const n = rand(i * 0.13);
    let r, g, b;
    if (h < WATER + 0.25) { r = 0.5; g = 0.68; b = 0.62; }
    else if (h < 2.6) { r = 0.98; g = 0.9; b = 0.64; }
    else if (n > 0.9) { r = 0.55; g = 0.85; b = 0.4; }
    else { r = 0.32; g = 0.72; b = 0.28; }
    colors.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: groundTex, vertexColors: true }));
  m.receiveShadow = true;
  scene.add(m);
})();

/* mer animée + écume du rivage + paillettes */
const water = (() => {
  const geo = new THREE.PlaneGeometry(900, 900, 46, 46);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color: 0x2693d8, transparent: true, opacity: 0.72,
    specular: 0xffffff, shininess: 90,
  }));
  m.position.y = WATER;
  scene.add(m);
  return m;
})();
const waterPos = water.geometry.attributes.position;
const waterBase = waterPos.array.slice();
const foam = (() => {
  const geo = new THREE.RingGeometry(86, 97, 64);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }));
  m.position.y = WATER + 0.07;
  m.renderOrder = 2;
  scene.add(m);
  return m;
})();
const sparkles = [];
for (let i = 0; i < 14; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex, color: 0xeaffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(1.6);
  scene.add(s);
  sparkles.push({ s, t: rand(i) * 4 });
}

const mat = c => new THREE.MeshLambertMaterial({ color: c });
const shiny = (c, s = 30) => new THREE.MeshPhongMaterial({ color: c, specular: 0x666666, shininess: s });
const M = {
  black: shiny(0x23202b, 18), tan: shiny(0xc8702a, 18), ear: shiny(0x3a3543, 14),
  fire: shiny(0xf59b30, 40), gold: shiny(0xffd23e, 60), white: mat(0xffffff),
  gray: shiny(0x9aa3b8, 18), dgray: mat(0x5f6680), red: shiny(0xd8434e, 35),
  wood: new THREE.MeshLambertMaterial({ map: woodTex }),
  trunk: mat(0x9a6a3c), palmLeaf: shiny(0x2f9e3c, 22), leaf3: shiny(0x4eb13d, 16),
  pole: shiny(0xe8eef4, 80), flagR: shiny(0xff5a3c, 25),
  sage: shiny(0x8a7060, 14), cream: shiny(0xe8dcc8, 10),
  crab: shiny(0xe85c40, 30), bone: shiny(0xf6f2e4, 50),
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function shadowed(root) { root.traverse(o => { if (o.isMesh) o.castShadow = true; }); return root; }

/* ombre ronde de visée sous Nova (en plus des vraies ombres) */
const blobShadow = (() => {
  const g = new THREE.PlaneGeometry(2, 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: radialTex, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  m.renderOrder = 1;
  scene.add(m);
  return m;
})();

/* ---------- végétation ---------- */
const trees = [];
const palms = [];
for (let i = 0; i < 26; i++) {
  const a = rand(i) * Math.PI * 2, r = 60 + rand(i + 50) * 32;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const h = terrainH(x, z);
  if (h < 1.2) continue;
  const g = new THREE.Group();
  const lean = (rand(i + 4) - 0.5) * 0.35;
  const th = 4.5 + rand(i + 99) * 2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, th, 7), M.trunk);
  trunk.position.y = th / 2;
  trunk.rotation.z = lean;
  g.add(trunk);
  const top = new THREE.Vector3(Math.sin(lean) * -th, th * Math.cos(lean), 0);
  for (let k = 0; k < 6; k++) {
    const leaf = new THREE.Mesh(box(2.6, 0.07, 0.7), M.palmLeaf);
    leaf.position.copy(top);
    leaf.rotation.y = k * Math.PI / 3 + rand(i + k) * 0.4;
    leaf.rotation.z = -0.45;
    leaf.translateX(1.1);
    g.add(leaf);
  }
  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), M.trunk);
  coco.position.copy(top).y -= 0.3;
  g.add(coco);
  g.position.set(x, h, z);
  scene.add(shadowed(g));
  trees.push({ x, z, r: 0.6 });
  palms.push({ x: x + top.x, z, topY: h + top.y, cocoCD: 0 });
}
for (let i = 0; i < 10; i++) {
  const a = rand(i + 200) * Math.PI * 2, r = 14 + rand(i + 250) * 30;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const h = terrainH(x, z);
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.8, 6), M.trunk);
  trunk.position.y = 0.9;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.9, 4.2, 8), M.leaf3);
  cone.position.y = 3.4;
  g.add(trunk, cone);
  g.position.set(x, h, z);
  scene.add(shadowed(g));
  trees.push({ x, z, r: 0.7 });
}

const clouds = [];
for (let i = 0; i < 10; i++) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(5 + rand(i + k) * 4, 10, 7), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    s.position.set(k * 6 - 6, rand(i * 3 + k) * 2, rand(i + k * 7) * 3);
    s.scale.y = 0.55;
    g.add(s);
  }
  g.position.set((rand(i) - 0.5) * 360, 55 + rand(i + 3) * 25, (rand(i + 9) - 0.5) * 360);
  scene.add(g);
  clouds.push(g);
}

/* ---------- ponton + plateformes ---------- */
const platforms = [];
const pierZ = 14;
for (let k = 0; k < 5; k++) platforms.push({ x: 86 + k * 8, z: pierZ, top: 1.3, w: 8.2, d: 3.4, wood: true });
platforms.push({ x: -20, z: -42, top: 6.5, w: 4.5, d: 4.5 });
platforms.push({ x: -12, z: -50, top: 9.5, w: 4, d: 4 });
for (const p of platforms) {
  const m = new THREE.Mesh(box(p.w, 0.5, p.d), p.wood ? M.wood : shiny(0xb8bfca, 14));
  m.position.set(p.x, p.top - 0.25, p.z);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  if (p.wood) {
    for (const dz of [-1.2, 1.2]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, p.top + 1.6, 6), M.trunk);
      pile.position.set(p.x - p.w / 2 + 0.5, (p.top - 1.6) / 2, p.z + dz);
      pile.castShadow = true;
      scene.add(pile);
    }
  }
}

/* ---------- drapeau ---------- */
const FLAG = { x: 0, z: 0, y: terrainH(0, 0) };
const flagGroup = new THREE.Group();
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7, 8), M.pole);
pole.position.y = 3.5;
const flagCloth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 1.9), M.flagR);
flagCloth.position.set(0, 6.2, -0.95);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M.gold);
knob.position.y = 7;
flagGroup.add(pole, flagCloth, knob);
flagGroup.position.set(FLAG.x, FLAG.y, FLAG.z);
scene.add(shadowed(flagGroup));

/* ---------- baballes ---------- */
const ballGeo = new THREE.SphereGeometry(0.55, 12, 9);
const ballMat = shiny(0xf08020, 55);
const seamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
const balls = [];
function addBall(x, z, y = null) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ballGeo, ballMat));
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 5, 14), seamMat);
  seam.rotation.x = 1.1;
  g.add(seam);
  const gy = y !== null ? y : terrainH(x, z) + 1.2;
  g.position.set(x, gy, z);
  scene.add(g);
  balls.push({ g, x, z, y: gy, got: false, float: y === null && terrainH(x, z) < WATER, t: rand(balls.length) * 6 });
}
for (let i = 0; i < 26; i++) {
  const a = i * 2.4, r = 12 + (i * 3.1) % 72;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (terrainH(x, z) < 2) continue;
  addBall(x, z);
}
for (let k = 0; k < 4; k++) addBall(88 + k * 8, pierZ, 2.4);
addBall(70, -30, WATER + 0.55); addBall(50, -60, WATER + 0.55);
addBall(-70, -50, WATER + 0.55); addBall(-85, 20, WATER + 0.55);
addBall(-20, -42, 7.7); addBall(-12, -50, 10.7);
const TOTAL_BALLS = balls.length;

const superBall = (() => {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), new THREE.MeshPhongMaterial({ color: 0xf59b30, emissive: 0x7a3a00, specular: 0xffffff, shininess: 80 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 9), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22 }));
  g.add(core, halo);
  g.position.set(122, 3.2, pierZ);
  scene.add(g);
  return { g, halo, got: false, respawn: 0, t: 0 };
})();

/* ---------- les 3 nonos cachés ---------- */
function buildBone() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), M.bone);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  for (const [sx, sy] of [[-0.42, 0.12], [-0.42, -0.12], [0.42, 0.12], [0.42, -0.12]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), M.bone);
    s.position.set(sx, sy, 0);
    g.add(s);
  }
  return g;
}
const BONE_SPOTS = [
  [-58, null, -62],            // plage nord-ouest, derrière la colline
  [-12, 10.6, -50],            // sommet de la plus haute plateforme
  [36, WATER - 0.2, 96],       // dans l'eau claire du lagon
];
const bones = BONE_SPOTS.map(([x, y, z], i) => {
  const g = buildBone();
  const gy = y !== null ? y : terrainH(x, z) + 1;
  g.position.set(x, gy, z);
  scene.add(g);
  return { g, y: gy, got: false, t: rand(i) * 5 };
});

/* ---------- la course : arche + 5 anneaux ---------- */
const RACE_TIME = 25;
function ringMesh(r, tube, color) {
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }));
}
const raceArch = ringMesh(2.6, 0.22, 0xffd23e);
raceArch.position.set(40, terrainH(40, 46) + 2.2, 46);
raceArch.rotation.y = 0.8;
scene.add(raceArch);
const RING_SPOTS = [[56, null, 34], [70, null, 24], [86, 3, pierZ], [104, 3, pierZ], [122, 3.6, pierZ]];
const raceRings = RING_SPOTS.map(([x, y, z], i) => {
  const m = ringMesh(2.1, 0.16, 0xffd23e);
  const gy = y !== null ? y : terrainH(x, z) + 2;
  m.position.set(x, gy, z);
  m.rotation.y = i < 2 ? 0.9 : Math.PI / 2;
  scene.add(m);
  return { m, x, y: gy, z };
});
let raceIdx = -1, raceT = 0, raceDone = false;

/* ---------------------------------------------------------------------
   NOVA (+ collier à médaille)
--------------------------------------------------------------------- */
const nova = new THREE.Group();
nova.rotation.order = 'YXZ';
const novaParts = { body: [], accent: [], ears: [] };
(function buildNova() {
  const add = (geo, m, x, y, z, list) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    nova.add(me);
    if (list) novaParts[list].push(me);
    return me;
  };
  add(box(0.55, 0.5, 1.5), M.black, 0, 0.62, 0, 'body');
  add(box(0.5, 0.16, 1.3), M.tan, 0, 0.36, 0, 'accent');
  add(box(0.5, 0.45, 0.5), M.black, 0, 0.95, 0.92, 'body');
  add(box(0.24, 0.2, 0.34), M.tan, 0, 0.84, 1.28, 'accent');
  add(box(0.1, 0.36, 0.24), M.ear, -0.31, 0.88, 0.92, 'ears');
  add(box(0.1, 0.36, 0.24), M.ear, 0.31, 0.88, 0.92, 'ears');
  add(box(0.07, 0.07, 0.07), M.white, -0.14, 1.05, 1.18);
  add(box(0.07, 0.07, 0.07), M.white, 0.14, 1.05, 1.18);
  const tail = add(box(0.1, 0.1, 0.55), M.black, 0, 0.92, -0.95, 'body');
  tail.rotation.x = -0.65;
  add(box(0.09, 0.09, 0.14), M.gold, 0, 1.06, -1.18, 'accent');
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 14), M.red);
  collar.position.set(0, 0.78, 0.72);
  collar.rotation.x = Math.PI / 2 - 0.25;
  nova.add(collar);
  const medal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), M.gold);
  medal.position.set(0, 0.62, 0.95);
  nova.add(medal);
})();
const legs = [];
for (const [lx, lz] of [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]]) {
  const geo = box(0.15, 0.4, 0.15);
  geo.translate(0, -0.2, 0);
  const leg = new THREE.Mesh(geo, M.tan);
  leg.position.set(lx, 0.42, lz);
  nova.add(leg);
  legs.push(leg);
  novaParts.accent.push(leg);
}
const hair = new THREE.Group();
[[0, 1.35, 0.85, -0.3], [-0.16, 1.3, 0.7, -0.7], [0.16, 1.3, 0.7, -0.7], [0, 1.25, 0.5, -1.1]].forEach(([x, y, z, rx]) => {
  const h = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 5), M.gold);
  h.position.set(x, y, z);
  h.rotation.x = rx;
  hair.add(h);
});
hair.visible = false;
nova.add(hair);
const aura = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 9), new THREE.MeshBasicMaterial({ color: 0xffb838, transparent: true, opacity: 0.22 }));
aura.position.y = 0.7;
aura.visible = false;
nova.add(aura);
const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9 }));
ring.rotation.x = Math.PI / 2;
ring.visible = false;
scene.add(ring);
/* onde sonore du WOUF */
const barkRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 28), new THREE.MeshBasicMaterial({ color: 0xfff4be, transparent: true, opacity: 0.8 }));
barkRing.rotation.x = Math.PI / 2;
barkRing.visible = false;
scene.add(barkRing);
let barkT = 1;
nova.scale.setScalar(1.12);
scene.add(shadowed(nova));

function setSuper(on) {
  for (const m of novaParts.body) m.material = on ? M.fire : M.black;
  for (const m of novaParts.accent) m.material = on ? M.black : M.tan;
  for (const m of novaParts.ears) m.material = on ? M.gold : M.ear;
  hair.visible = on;
  aura.visible = on;
}

/* ---------------------------------------------------------------------
   PNJ : le Capitaine Médor
--------------------------------------------------------------------- */
const medor = (() => {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); g.add(me); return me; };
  add(box(0.65, 0.6, 1.6), M.sage, 0, 0.7, 0);
  add(box(0.6, 0.2, 1.4), M.cream, 0, 0.42, 0);
  add(box(0.58, 0.52, 0.56), M.sage, 0, 1.25, 0.95);
  add(box(0.3, 0.26, 0.4), M.cream, 0, 1.08, 1.34);            // museau blanchi
  add(box(0.12, 0.42, 0.28), M.ear, -0.36, 1.16, 0.95);
  add(box(0.12, 0.42, 0.28), M.ear, 0.36, 1.16, 0.95);
  add(box(0.08, 0.08, 0.08), M.white, -0.16, 1.36, 1.24);
  add(box(0.08, 0.08, 0.08), M.white, 0.16, 1.36, 1.24);
  const cap = add(box(0.5, 0.14, 0.5), M.red, 0, 1.56, 0.95);  // casquette de capitaine
  cap.rotation.x = -0.12;
  add(box(0.5, 0.1, 0.2), M.red, 0, 1.5, 1.24);
  for (const [lx, lz] of [[-0.22, 0.55], [0.22, 0.55], [-0.22, -0.55], [0.22, -0.55]])
    add(box(0.17, 0.45, 0.17), M.cream, lx, 0.22, lz);
  const tail = add(box(0.1, 0.1, 0.6), M.sage, 0, 1.05, -1.05);
  tail.rotation.x = -0.5;
  g.scale.setScalar(1.35);
  g.position.set(10, terrainH(10, 62), 62);
  g.rotation.y = -2.2;
  scene.add(shadowed(g));
  return g;
})();
const excl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), M.gold);
excl.rotation.x = Math.PI;
scene.add(excl);
const MEDOR_LINES = [
  '<b>Capitaine Médor</b> — Wouf ! Bienvenue dans la Baie des Baballes, petite Nova !',
  '<b>Capitaine Médor</b> — Mes missions sont notées en haut à droite. La <b>SUPER BABALLE</b> brille au bout du ponton !',
  '<b>Capitaine Médor</b> — L\'arche dorée sur la plage lance ma course. Et mes 3 <b>nonos</b> ont disparu : plage nord-ouest, haute plateforme, et... dans le lagon !',
  '<b>Capitaine Médor</b> — En l\'air, fais une <b>charge au sol</b> (MAJ ou B) : les matous détestent ça. Wouf wouf !',
  '<b>Capitaine Médor</b> — Et surtout : <b>ABOIE</b> (F, ou le bouton W) ! Les matous filent ventre à terre... et les noix de coco tombent des palmiers. Boum !',
];
let medorLine = 0, medorNear = false, medorTimer = 0;

/* ---------------------------------------------------------------------
   FAUNE : matous, mouettes, crabes, papillons
--------------------------------------------------------------------- */
const cats = [];
const CAT_SPOTS = [[26, 10], [-22, 30], [40, -16], [-36, -22], [10, 56], [-54, 6], [52, 38], [-24, -52], [44, 56], [0, -38]];
function buildCat() {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); g.add(me); return me; };
  add(box(0.5, 0.45, 1.0), M.gray, 0, 0.52, 0);
  add(box(0.52, 0.1, 0.7), M.dgray, 0, 0.76, -0.05);
  add(box(0.42, 0.4, 0.42), M.gray, 0, 0.78, 0.6);
  add(new THREE.ConeGeometry(0.09, 0.22, 4), M.dgray, -0.13, 1.06, 0.6);
  add(new THREE.ConeGeometry(0.09, 0.22, 4), M.dgray, 0.13, 1.06, 0.6);
  add(box(0.06, 0.06, 0.06), M.white, -0.11, 0.84, 0.82);
  add(box(0.06, 0.06, 0.06), M.white, 0.11, 0.84, 0.82);
  const tail = add(box(0.08, 0.55, 0.08), M.gray, 0, 0.85, -0.55);
  tail.rotation.x = 0.35;
  for (const [lx, lz] of [[-0.16, 0.32], [0.16, 0.32], [-0.16, -0.32], [0.16, -0.32]])
    add(box(0.12, 0.3, 0.12), M.dgray, lx, 0.15, lz);
  return shadowed(g);
}
for (const [x, z] of CAT_SPOTS) {
  const g = buildCat();
  g.position.set(x, terrainH(x, z), z);
  scene.add(g);
  cats.push({ g, x, z, dir: rand(x + z) * Math.PI * 2, timer: 1 + rand(x) * 3, dead: false, deadT: 0, scared: 0 });
}

const gulls = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M.white);
  body.scale.set(1, 0.7, 1.6);
  g.add(body);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(box(1.3, 0.05, 0.45), M.white);
    w.position.x = s * 0.75;
    g.add(w);
    wings.push(w);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), M.gold);
  beak.rotation.x = Math.PI / 2;
  beak.position.z = 0.55;
  g.add(beak);
  scene.add(g);
  gulls.push({ g, wings, a: rand(i) * 6.28, r: 35 + rand(i + 9) * 35, h: 16 + rand(i + 5) * 14, spd: 0.25 + rand(i + 2) * 0.2 });
}

const crabs = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(box(0.5, 0.22, 0.36), M.crab);
  body.position.y = 0.18;
  g.add(body);
  for (const s of [-1, 1]) {
    const claw = new THREE.Mesh(box(0.16, 0.12, 0.16), M.crab);
    claw.position.set(s * 0.34, 0.2, 0.22);
    g.add(claw);
    for (let k = 0; k < 3; k++) {
      const leg = new THREE.Mesh(box(0.05, 0.14, 0.05), M.crab);
      leg.position.set(s * 0.3, 0.07, -0.12 + k * 0.12);
      g.add(leg);
    }
  }
  const a = rand(i + 60) * 6.28;
  const r = 84 + rand(i + 61) * 6;
  g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  g.position.y = terrainH(g.position.x, g.position.z);
  scene.add(shadowed(g));
  crabs.push({ g, a, r, dir: 1, timer: 2 + rand(i) * 3 });
}

const flies = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(box(0.16, 0.02, 0.12), shiny([0xffd23e, 0xff8c28, 0xe85ca0][i % 3], 10));
    w.position.x = s * 0.09;
    g.add(w);
  }
  const a = rand(i + 80) * 6.28, r = 16 + rand(i + 81) * 38;
  g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  scene.add(g);
  flies.push({ g, ax: g.position.x, az: g.position.z, p: rand(i) * 6 });
}

/* ---------------------------------------------------------------------
   PARTICULES (pool de sprites)
--------------------------------------------------------------------- */
const parts = [];
for (let i = 0; i < 42; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex, transparent: true, opacity: 0, depthWrite: false }));
  s.visible = false;
  scene.add(s);
  parts.push({ s, alive: false, t: 0, life: 1, v: new THREE.Vector3(), grav: 9, size: 0.5 });
}
function burst(pos, color, n, spread = 3, up = 4, life = 0.7, size = 0.45, grav = 9) {
  let made = 0;
  for (const p of parts) {
    if (p.alive) continue;
    p.alive = true; p.t = 0; p.life = life * (0.7 + Math.random() * 0.6); p.grav = grav; p.size = size;
    p.s.visible = true;
    p.s.material.color.set(color);
    p.s.material.opacity = 0.9;
    p.s.position.copy(pos);
    p.v.set((Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread);
    p.s.scale.setScalar(size);
    if (++made >= n) break;
  }
}
function updateParts(dt) {
  for (const p of parts) {
    if (!p.alive) continue;
    p.t += dt;
    if (p.t >= p.life) { p.alive = false; p.s.visible = false; continue; }
    p.v.y -= p.grav * dt;
    p.s.position.addScaledVector(p.v, dt);
    const k = 1 - p.t / p.life;
    p.s.material.opacity = 0.9 * k;
    p.s.scale.setScalar(p.size * (0.6 + 0.4 * k));
  }
}

/* ---------------------------------------------------------------------
   ÉTAT, MISSIONS & ENTRÉES
--------------------------------------------------------------------- */
const START = { x: 0, z: 70 };
const P = {
  pos: new THREE.Vector3(START.x, terrainH(START.x, START.z), START.z),
  v: new THREE.Vector3(), onGround: true, yaw: Math.PI, inv: 0,
  jbuf: 0, coyote: 0, chain: 0, landT: 0, flipT: 0, skidT: 0,
  swimming: false, pound: 0, poundT: 0, stepPh: 0,
};
let state = 'title', paused = false, score = 0, ballN = 0, lives = 3;
let superT = 0, transT = 0, playT = 0;
const TIME_LIMIT = 300;                 // 5 minutes pour tout faire
let timeLeft = TIME_LIMIT, lastWhole = TIME_LIMIT;
let camYaw = 0, camManual = 0, camShake = 0, camH = 4.4, camDist = 11, gT = 0;
let catsSquashed = 0, bonesGot = 0, flagDone = false;
let barkCD = 0, scaredCount = 0;
const cocos = [];

const QUESTS = [
  { label: 'Ramasse 25 baballes', done: false, prog: () => `${Math.min(ballN, 25)}/25`, check: () => ballN >= 25 },
  { label: 'Fais valdinguer 6 matous', done: false, prog: () => `${Math.min(catsSquashed, 6)}/6`, check: () => catsSquashed >= 6 },
  { label: 'Effraie 8 matous au WOUF', done: false, prog: () => `${Math.min(scaredCount, 8)}/8`, check: () => scaredCount >= 8 },
  { label: 'Gagne la course de l\'arche', done: false, prog: () => '', check: () => raceDone },
  { label: 'Déterre les 3 nonos cachés', done: false, prog: () => `${bonesGot}/3`, check: () => bonesGot >= 3 },
  { label: 'Plante le drapeau au sommet', done: false, prog: () => '', check: () => flagDone },
];
const questsDiv = document.getElementById('quests');
function refreshQuests() {
  questsDiv.innerHTML = '<div class="t">MISSIONS DU CAPITAINE</div>' +
    QUESTS.map(q => `<div class="${q.done ? 'done' : ''}">${q.done ? '' : '· '}${q.label}${!q.done && q.prog() ? ' — ' + q.prog() : ''}</div>`).join('');
}
let toastT = 0;
function toast(msg) {
  const d = document.getElementById('toast');
  d.textContent = msg;
  d.style.display = 'block';
  toastT = 2.8;
}
function checkQuests() {
  for (const q of QUESTS) {
    if (!q.done && q.check()) {
      q.done = true;
      score += 1000;
      SFX.quest();
      toast(`MISSION ACCOMPLIE — ${q.label} !`);
      updateHUD();
    }
  }
  refreshQuests();
}

const keys = {};
let btnB = false, camL = false, camR = false;
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') {
    if (e.key === 'Enter') submitName();
    return;                              // on tape son nom : le jeu n'écoute pas
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  initAudio();
  if (e.code === 'KeyM') { musicOn = !musicOn; return; }
  if (state === 'win') { if (e.code === 'KeyR') restart(); return; }
  if (state === 'title' || state === 'gameover') { restart(); return; }
  if (e.code === 'KeyP' && state === 'play') {
    paused = !paused;
    document.getElementById('ovPause').hidden = !paused;
    return;
  }
  if (paused) { if (e.code === 'KeyR') { paused = false; document.getElementById('ovPause').hidden = true; restart(); } return; }
  if (e.code === 'KeyR') { restart(); return; }
  if (e.code === 'KeyC') { camYaw = P.yaw + Math.PI; camManual = 0.6; return; }
  if (e.code === 'KeyF') { doBark(); return; }
  if (e.code === 'Space') P.jbuf = 0.15;
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !P.onGround && !P.swimming && !P.pound && state === 'play') {
    P.pound = 1; P.poundT = 0;
    SFX.poundUp();
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const joy = { active: false, id: null, x: 0, y: 0, sx: 0, sy: 0 };
(function setupTouch() {
  if (!IS_TOUCH) return;
  document.getElementById('joyzone').hidden = false;
  document.getElementById('touch').hidden = false;
  document.getElementById('ctrlsDesk').hidden = true;
  document.getElementById('ctrlsTouch').hidden = false;
  const zone = document.getElementById('joyzone');
  const base = document.getElementById('joybase');
  const knobEl = document.getElementById('joyknob');
  zone.addEventListener('pointerdown', e => {
    e.preventDefault(); initAudio();
    joy.active = true; joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY;
    base.style.display = 'block';
    base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px';
    zone.setPointerCapture(e.pointerId);
  });
  zone.addEventListener('pointermove', e => {
    if (!joy.active || e.pointerId !== joy.id) return;
    let dx = (e.clientX - joy.sx) / 42, dy = (e.clientY - joy.sy) / 42;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    joy.x = dx; joy.y = dy;
    knobEl.style.transform = `translate(calc(-50% + ${dx * 26}px), calc(-50% + ${dy * 26}px))`;
  });
  const end = e => {
    if (e.pointerId !== joy.id) return;
    joy.active = false; joy.x = 0; joy.y = 0;
    base.style.display = 'none';
    knobEl.style.transform = 'translate(-50%,-50%)';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  const on = (id, down, up) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); down(); });
    el.addEventListener('pointerup', e => { e.preventDefault(); up && up(); });
    el.addEventListener('pointercancel', () => { up && up(); });
  };
  on('btnA', () => {
    if (state !== 'play') { restart(); return; }
    P.jbuf = 0.15; keys.Space = true;
  }, () => { keys.Space = false; });
  on('btnB', () => {
    if (state === 'play' && !P.onGround && !P.swimming && !P.pound) { P.pound = 1; P.poundT = 0; SFX.poundUp(); return; }
    btnB = true;
  }, () => { btnB = false; });
  on('btnCL', () => { camL = true; }, () => { camL = false; });
  on('btnCR', () => { camR = true; }, () => { camR = false; });
  on('btnCC', () => { camYaw = P.yaw + Math.PI; camManual = 0.6; });
  on('btnW', () => { if (state === 'play') doBark(); });
  on('btnP', () => {
    if (state !== 'play') return;
    paused = !paused;
    document.getElementById('ovPause').hidden = !paused;
  });
})();
for (const id of ['ovTitle', 'ovOver']) {
  document.getElementById(id).addEventListener('pointerdown', () => { initAudio(); restart(); });
}
document.getElementById('ovPause').addEventListener('pointerdown', () => {
  paused = false;
  document.getElementById('ovPause').hidden = true;
});
document.getElementById('nameOk').addEventListener('click', e => { e.stopPropagation(); submitName(); });
document.getElementById('btnReplay').addEventListener('click', e => { e.stopPropagation(); restart(); });
renderTitleBoard();

/* ---------------------------------------------------------------------
   LOGIQUE
--------------------------------------------------------------------- */
function groundAt(x, z, y) {
  let g = terrainH(x, z);
  for (const pf of platforms) {
    if (Math.abs(x - pf.x) < pf.w / 2 + 0.3 && Math.abs(z - pf.z) < pf.d / 2 + 0.3 && y >= pf.top - 0.45)
      g = Math.max(g, pf.top);
  }
  return g;
}
function catKill(c) {
  c.dead = true; c.deadT = 0;
  catsSquashed++;
  score += 200;
  SFX.stomp();
  burst(c.g.position.clone().setY(c.g.position.y + 0.6), 0x9aa3b8, 6, 4, 4);
  updateHUD();
}

/* ---------- le WOUF : aboiement qui terrorise les matous ---------- */
function doBark() {
  if (state !== 'play' || paused || barkCD > 0 || P.swimming) return;
  barkCD = 2.2;
  SFX.bigBark();
  barkT = 0;
  barkRing.visible = true;
  barkRing.position.set(P.pos.x, P.pos.y + 0.8, P.pos.z);
  const R = superT > 0 ? 15 : 9;                 // méga-WOUF en Super Nova
  for (const c of cats) {
    if (c.dead) continue;
    const d = Math.hypot(c.g.position.x - P.pos.x, c.g.position.z - P.pos.z);
    if (d < R) {
      if (superT > 0) { catKill(c); continue; }
      if (c.scared <= 0) { scaredCount++; SFX.scaredMeow(); }
      c.scared = 3;
      c.dir = Math.atan2(c.g.position.x - P.pos.x, c.g.position.z - P.pos.z);
      burst(c.g.position.clone().setY(c.g.position.y + 1.1), 0xffffff, 4, 2, 3.5, 0.5, 0.3);
    }
  }
  // le WOUF secoue les palmiers proches : les noix de coco tombent !
  for (const p of palms) {
    const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
    if (d < 6 && p.cocoCD <= 0) {
      p.cocoCD = 7;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), M.trunk);
      m.castShadow = true;
      m.position.set(p.x, p.topY - 0.4, p.z);
      scene.add(m);
      cocos.push({ m, v: 0, rest: 0 });
    }
  }
}
function updateCocos(dt) {
  for (const p of palms) if (p.cocoCD > 0) p.cocoCD -= dt;
  for (let i = cocos.length - 1; i >= 0; i--) {
    const c = cocos[i];
    const gnd = terrainH(c.m.position.x, c.m.position.z) + 0.24;
    if (c.rest > 0) {
      c.rest -= dt;
    } else {
      c.v -= 30 * dt;
      c.m.position.y += c.v * dt;
      if (c.m.position.y <= gnd) {
        c.m.position.y = gnd;
        if (Math.abs(c.v) > 4) { c.v = -c.v * 0.35; SFX.coco(); burst(c.m.position, 0xd8cfa8, 4, 2, 2, 0.4, 0.3); }
        else { c.v = 0; c.rest = 6; }
      }
      // une noix de coco sur la tête d'un matou...
      for (const cat of cats) {
        if (cat.dead) continue;
        const d = Math.hypot(cat.g.position.x - c.m.position.x, cat.g.position.z - c.m.position.z);
        if (d < 1.1 && Math.abs(c.m.position.y - cat.g.position.y - 0.6) < 1) {
          catKill(cat);
          scene.remove(c.m);
          cocos.splice(i, 1);
          break;
        }
      }
    }
    if (cocos[i] !== c) continue;
    // Nova peut la ramasser une fois au sol (+100)
    if (c.rest > 0) {
      const d = Math.hypot(c.m.position.x - P.pos.x, c.m.position.z - P.pos.z);
      if (d < 1.4 && Math.abs(c.m.position.y - P.pos.y) < 1.6) {
        score += 100;
        SFX.coin();
        burst(c.m.position, 0xc8a060, 5, 3, 3, 0.5, 0.35);
        scene.remove(c.m);
        cocos.splice(i, 1);
        updateHUD();
        continue;
      }
      if (c.rest <= dt) { scene.remove(c.m); cocos.splice(i, 1); }
    }
  }
}
function gameOver(reason = '') {
  state = 'gameover';
  document.getElementById('overStats').textContent =
    (reason ? reason + ' — ' : '') + `Score : ${score} · Baballes : ${ballN}/${TOTAL_BALLS}`;
  document.getElementById('ovOver').hidden = false;
  SFX.over();
}

/* ---------------------------------------------------------------------
   TABLEAU DES RECORDS (local à l'appareil)
--------------------------------------------------------------------- */
function loadBoard() {
  try { return JSON.parse(localStorage.getItem('novaSunshineBoard') || '[]'); } catch (e) { return []; }
}
function boardHTML(list, hi = -1) {
  if (!list.length) return '<p style="color:#9ec8dd">Aucun record pour l\'instant… sois la première truffe !</p>';
  return '<table class="board"><tr><th>#</th><th>NOM</th><th>SCORE</th><th>RANG</th><th>⏱</th></tr>' +
    list.map((e, i) =>
      `<tr class="${i === hi ? 'hi' : ''}"><td>${i + 1}</td><td>${e.name}</td><td class="sc">${e.score}</td><td>${e.rank}</td><td>${e.time}s</td></tr>`
    ).join('') + '</table>';
}
function saveScore(name, rank) {
  const list = loadBoard();
  const entry = { name, score, rank, time: Math.floor(playT), date: Date.now() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 8);
  const hi = top.indexOf(entry);
  try {
    localStorage.setItem('novaSunshineBoard', JSON.stringify(top));
    localStorage.setItem('novaPlayerName', name);
  } catch (e) {}
  return { top, hi };
}
function renderTitleBoard() {
  const el = document.getElementById('titleBoard');
  const list = loadBoard().slice(0, 5);
  el.innerHTML = list.length ? '<p style="color:#ffe34a;font-weight:bold;margin-top:14px">🏆 TABLEAU DES RECORDS</p>' + boardHTML(list) : '';
}
function hurt(knockFrom) {
  if (P.inv > 0 || superT > 0 || state !== 'play') return;
  lives--;
  SFX.hurt();
  updateHUD();
  if (lives <= 0) { gameOver(); return; }
  P.inv = 2.2;
  if (knockFrom) {
    const d = new THREE.Vector3().subVectors(P.pos, knockFrom).setY(0).normalize();
    P.v.x = d.x * 9; P.v.z = d.z * 9; P.v.y = 7;
    P.onGround = false;
  }
}

function restart() {
  state = 'play'; paused = false;
  score = 0; ballN = 0; lives = 3; superT = 0; transT = 0; playT = 0; barIdx = 0;
  catsSquashed = 0; bonesGot = 0; flagDone = false;
  raceIdx = -1; raceT = 0; raceDone = false;
  timeLeft = TIME_LIMIT; lastWhole = TIME_LIMIT;
  barkCD = 0; scaredCount = 0;
  for (const c of cocos) scene.remove(c.m);
  cocos.length = 0;
  for (const p of palms) p.cocoCD = 0;
  barkRing.visible = false; barkT = 1;
  for (const q of QUESTS) q.done = false;
  P.pos.set(START.x, terrainH(START.x, START.z), START.z);
  P.v.set(0, 0, 0); P.yaw = Math.PI; P.inv = 0;
  P.chain = 0; P.landT = 0; P.flipT = 0; P.skidT = 0; P.swimming = false; P.pound = 0;
  camYaw = 0; camManual = 0; camShake = 0;
  setSuper(false);
  nova.rotation.x = 0;
  for (const b of balls) { b.got = false; b.g.visible = true; }
  for (const b of bones) { b.got = false; b.g.visible = true; }
  superBall.got = false; superBall.respawn = 0; superBall.g.visible = true;
  for (const c of cats) {
    c.dead = false; c.deadT = 0; c.scared = 0;
    c.g.visible = true; c.g.scale.set(1, 1, 1); c.g.rotation.z = 0;
    c.g.position.set(c.x, terrainH(c.x, c.z), c.z);
  }
  medorLine = 0;
  document.getElementById('hudTime').textContent = '5:00';
  document.getElementById('hudTime').style.color = '#d8f4ff';
  document.getElementById('raceTimer').style.display = 'none';
  document.getElementById('dialog').style.display = 'none';
  for (const id of ['ovTitle', 'ovWin', 'ovOver', 'ovPause']) document.getElementById(id).hidden = true;
  refreshQuests();
  updateHUD();
}

function updatePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.ArrowLeft || keys.KeyA) ix -= 1;
  if (keys.ArrowRight || keys.KeyD) ix += 1;
  if (keys.ArrowUp || keys.KeyW) iz -= 1;
  if (keys.ArrowDown || keys.KeyS) iz += 1;
  if (joy.active) { ix = joy.x; iz = joy.y; }
  let l = Math.hypot(ix, iz);
  if (l > 1) { ix /= l; iz /= l; l = 1; }
  /* MAJ (clavier) ou B (mobile) au sol : marche précise pour le ponton */
  const walk = (keys.ShiftLeft || keys.ShiftRight || btnB) && P.onGround;

  const fw = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
  const rt = new THREE.Vector3(fw.z, 0, -fw.x);
  const wish = new THREE.Vector3().addScaledVector(fw, iz).addScaledVector(rt, ix);
  if (wish.lengthSq() > 0.001) wish.normalize();

  const ground = groundAt(P.pos.x, P.pos.z, P.pos.y);
  const wasSwimming = P.swimming;
  P.swimming = ground < WATER - 0.5 && P.pos.y < WATER + 0.15;
  if (P.swimming && !wasSwimming) {
    P.pound = 0;
    if (P.v.y < -3) { SFX.splash(); burst(P.pos.clone().setY(WATER + 0.2), 0xd8f4ff, 10, 4, 5, 0.6, 0.5, 12); }
  }

  const spd = Math.hypot(P.v.x, P.v.z);
  if (P.skidT > 0) P.skidT -= dt;

  /* charge au sol */
  if (P.pound === 1) {
    P.poundT += dt;
    P.v.set(0, 1.8, 0);
    if (P.poundT > 0.16) { P.pound = 2; P.v.y = -42; }
  } else if (P.pound === 2) {
    P.v.x = 0; P.v.z = 0; P.v.y = -42;
  } else if (P.swimming) {
    const maxSpd = 4.5 * l;
    P.v.x += wish.x * 12 * dt;
    P.v.z += wish.z * 12 * dt;
    const ns = Math.hypot(P.v.x, P.v.z);
    if (ns > Math.max(maxSpd, 0.01)) { P.v.x *= maxSpd / ns || 0; P.v.z *= maxSpd / ns || 0; }
    if (l < 0.05) { const f = Math.pow(0.05, dt); P.v.x *= f; P.v.z *= f; }
    P.v.y += (WATER - 0.4 - P.pos.y) * 22 * dt;
    P.v.y *= Math.pow(0.05, dt);
    P.jbuf = Math.max(0, P.jbuf - dt);
    if (P.jbuf > 0) { P.v.y = 7.5; P.jbuf = 0; SFX.splash(); burst(P.pos.clone().setY(WATER + 0.2), 0xd8f4ff, 8, 3, 6, 0.6, 0.45, 12); P.chain = 0; }
    const d = Math.hypot(P.pos.x, P.pos.z);
    if (d > 150) { P.v.x -= P.pos.x / d * 32 * dt; P.v.z -= P.pos.z / d * 32 * dt; }
  } else {
    if (l > 0.05) {
      const dot = spd > 0.5 ? (wish.x * P.v.x + wish.z * P.v.z) / spd : 1;
      if (P.onGround && dot < -0.45 && spd > 5.5) {
        if (P.skidT <= 0) {
          SFX.skid(); P.skidT = 0.25;
          burst(P.pos.clone().setY(P.pos.y + 0.2), 0xd8cfa8, 4, 2, 2, 0.4, 0.35, 6);
        }
        const f = Math.max(0, 1 - 40 * dt / spd);
        P.v.x *= f; P.v.z *= f;
      } else {
        const maxSpd = (walk ? 4.5 : 10.5) * l;
        const acc = P.onGround ? 42 : 16;
        P.v.x += wish.x * acc * dt;
        P.v.z += wish.z * acc * dt;
        const ns = Math.hypot(P.v.x, P.v.z);
        const cap = P.onGround ? Math.max(maxSpd, 0.01) : 11.5;
        if (ns > cap) { P.v.x *= cap / ns; P.v.z *= cap / ns; }
      }
    } else if (P.onGround) {
      const f = Math.pow(0.0006, dt);
      P.v.x *= f; P.v.z *= f;
    }

    if (P.onGround) { P.coyote = 0.12; P.landT = Math.max(0, P.landT - dt); }
    else P.coyote = Math.max(0, P.coyote - dt);
    if (P.onGround && P.landT <= 0) P.chain = 0;
    P.jbuf = Math.max(0, P.jbuf - dt);
    if (P.jbuf > 0 && (P.onGround || P.coyote > 0)) {
      const moving = Math.hypot(P.v.x, P.v.z) > 4;
      P.chain = (P.landT > 0 && moving) ? Math.min(P.chain + 1, 3) : 1;
      P.v.y = [13.5, 15.5, 19][P.chain - 1] + (superT > 0 ? 4 : 0);
      if (P.chain === 3) P.flipT = 0.0001;
      SFX.jump(P.chain);
      P.onGround = false; P.coyote = 0; P.jbuf = 0;
    }
    const g = P.v.y > 0 ? (keys.Space ? 26 : 48) : 46;
    P.v.y -= g * dt;
    if (P.v.y < -45) P.v.y = -45;
  }

  P.pos.x += P.v.x * dt;
  P.pos.z += P.v.z * dt;
  P.pos.y += P.v.y * dt;

  for (const t of trees) {
    const dx = P.pos.x - t.x, dz = P.pos.z - t.z;
    const d = Math.hypot(dx, dz);
    if (d < t.r && d > 0.001 && P.pos.y < terrainH(t.x, t.z) + 4) {
      P.pos.x = t.x + dx / d * t.r;
      P.pos.z = t.z + dz / d * t.r;
    }
  }

  const gd = groundAt(P.pos.x, P.pos.z, P.pos.y);
  const wasAir = !P.onGround;
  if (P.pos.y <= gd) {
    const impact = P.v.y;
    P.pos.y = gd;
    P.v.y = 0;
    P.onGround = true;
    if (P.pound) {
      /* impact de la charge : onde de choc */
      P.pound = 0;
      camShake = 0.35;
      SFX.pound();
      burst(P.pos.clone().setY(gd + 0.3), 0xd8cfa8, 14, 9, 5, 0.7, 0.6, 10);
      for (const c of cats) {
        if (c.dead) continue;
        const d = Math.hypot(c.g.position.x - P.pos.x, c.g.position.z - P.pos.z);
        if (d < 5 && Math.abs(c.g.position.y - gd) < 2.5) catKill(c);
      }
      P.landT = 0;
    } else if (wasAir && !P.swimming) {
      P.landT = 0.28;
      P.flipT = 0;
      nova.rotation.x = 0;
      if (impact < -16) SFX.land();
    }
  } else if (P.pos.y > gd + 0.05) {
    P.onGround = false;
  }

  /* bruits de pas selon la surface */
  if (P.onGround && spd > 3.5 && !P.swimming) {
    P.stepPh += spd * dt;
    if (P.stepPh > 2.4) {
      P.stepPh = 0;
      const onPlat = gd > terrainH(P.pos.x, P.pos.z) + 0.6;
      const th = terrainH(P.pos.x, P.pos.z);
      if (onPlat) noise({ dur: 0.05, vol: 0.05, f: 750 });
      else if (th < 2.6) noise({ dur: 0.06, vol: 0.04, f: 220 });
      else noise({ dur: 0.05, vol: 0.04, f: 400 });
    }
  }

  if (spd > 0.8 || (l > 0.05 && spd <= 0.8)) {
    const target = spd > 0.8 ? Math.atan2(P.v.x, P.v.z) : Math.atan2(wish.x, wish.z);
    let d = target - P.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    P.yaw += d * Math.min(1, (spd < 2 ? 22 : 14) * dt);
  }
}

function updateCats(dt) {
  for (const c of cats) {
    if (c.dead) {
      c.deadT += dt;
      c.g.scale.y = Math.max(0.12, 1 - c.deadT * 3);
      if (c.deadT > 0.9) c.g.visible = false;
      continue;
    }
    const fleeing = c.scared > 0;
    if (fleeing) c.scared -= dt;
    else {
      c.timer -= dt;
      if (c.timer <= 0) { c.dir = rand(gT + c.x) * Math.PI * 2; c.timer = 1.5 + rand(gT + c.z) * 2.5; }
    }
    const spd = fleeing ? 8.5 : 3;
    const nx = c.g.position.x + Math.sin(c.dir) * spd * dt;
    const nz = c.g.position.z + Math.cos(c.dir) * spd * dt;
    if (terrainH(nx, nz) < 2.2) { c.dir += fleeing ? 2.4 : Math.PI; continue; }
    c.g.position.x = nx; c.g.position.z = nz;
    c.g.position.y = terrainH(nx, nz) + (fleeing ? Math.abs(Math.sin(gT * 11)) * 0.25 : 0);
    c.g.rotation.y = c.dir;
    c.g.rotation.z = fleeing ? Math.sin(gT * 14) * 0.12 : 0;

    const dx = P.pos.x - nx, dz = P.pos.z - nz;
    const dy = P.pos.y - c.g.position.y;
    if (Math.hypot(dx, dz) < 1.15 && dy > -0.5 && dy < 1.4) {
      if (superT > 0) {
        catKill(c);
      } else if (P.v.y < -2 && dy > 0.45) {
        catKill(c);
        P.v.y = keys.Space ? 14 : 10;
      } else if (!fleeing) {
        hurt(c.g.position);          // un matou en fuite ne griffe pas
      }
    }
  }
}

function updateBalls(dt) {
  for (const b of balls) {
    if (b.got) continue;
    b.t += dt;
    b.g.rotation.y += dt * 2.5;
    b.g.position.y = b.y + Math.sin(b.t * 2.5) * (b.float ? 0.28 : 0.15);
    const dx = b.g.position.x - P.pos.x, dz = b.g.position.z - P.pos.z;
    const dy = b.g.position.y - (P.pos.y + 0.7);
    if (dx * dx + dz * dz + dy * dy < 2.9) {
      b.got = true; b.g.visible = false;
      ballN++; score += 50;
      SFX.coin();
      burst(b.g.position, 0xffd23e, 6, 3, 4, 0.5, 0.4);
      updateHUD();
    }
  }
  for (const b of bones) {
    if (b.got) continue;
    b.t += dt;
    b.g.rotation.y += dt * 1.4;
    b.g.position.y = b.y + Math.sin(b.t * 2) * 0.15;
    const dx = b.g.position.x - P.pos.x, dz = b.g.position.z - P.pos.z;
    const dy = b.g.position.y - (P.pos.y + 0.5);
    if (dx * dx + dz * dz + dy * dy < (P.swimming ? 6.5 : 3.6)) {
      b.got = true; b.g.visible = false;
      bonesGot++; score += 300;
      bark(1.3); bark(1.5, 0.15);
      burst(b.g.position, 0xffffff, 10, 4, 5, 0.7, 0.5);
      toast(`NONO TROUVÉ ! (${bonesGot}/3)`);
      updateHUD();
    }
  }
  const sb = superBall;
  sb.t += dt;
  if (sb.got) {
    if (sb.respawn > 0) { sb.respawn -= dt; if (sb.respawn <= 0) { sb.got = false; sb.g.visible = true; } }
  } else {
    sb.g.rotation.y += dt * 1.5;
    sb.halo.scale.setScalar(1 + 0.12 * Math.sin(sb.t * 4));
    const dx = sb.g.position.x - P.pos.x, dz = sb.g.position.z - P.pos.z;
    const dy = sb.g.position.y - (P.pos.y + 0.7);
    if (dx * dx + dz * dz + dy * dy < 4.2) {
      sb.got = true; sb.respawn = 15; sb.g.visible = false;
      score += 500;
      state = 'transform'; transT = 0;
      P.v.set(0, Math.max(0, P.v.y), 0);
      SFX.charge();
      updateHUD();
    }
  }
}

function updateRace(dt) {
  raceArch.rotation.z += dt * 0.4;
  if (raceIdx === -1 && !raceDone) {
    const d = Math.hypot(P.pos.x - raceArch.position.x, P.pos.z - raceArch.position.z);
    if (d < 2.6 && Math.abs(P.pos.y - raceArch.position.y) < 3.4) {
      raceIdx = 0; raceT = RACE_TIME;
      SFX.raceGo();
      toast('COURS ! Passe les 5 anneaux d\'or !');
    }
  }
  const timerDiv = document.getElementById('raceTimer');
  if (raceIdx >= 0) {
    raceT -= dt;
    timerDiv.style.display = 'block';
    timerDiv.textContent = Math.max(0, raceT).toFixed(1);
    timerDiv.style.color = raceT < 5 ? '#ff5a5a' : '#ffe34a';
    const r = raceRings[raceIdx];
    const d = Math.hypot(P.pos.x - r.x, P.pos.z - r.z);
    if (d < 2.4 && Math.abs((P.pos.y + 0.7) - r.y) < 2.6) {
      SFX.ring();
      burst(new THREE.Vector3(r.x, r.y, r.z), 0xffd23e, 8, 4, 3, 0.5, 0.5);
      raceIdx++;
      if (raceIdx >= raceRings.length) {
        raceDone = true;
        raceIdx = -1;
        timerDiv.style.display = 'none';
        score += 800;
      }
    }
    if (raceT <= 0 && raceIdx >= 0) {
      raceIdx = -1;
      timerDiv.style.display = 'none';
      toast('Trop lent ! Retourne à l\'arche dorée.');
    }
  }
  raceRings.forEach((r, i) => {
    const active = raceIdx === i;
    r.m.material.opacity = active ? 0.85 : (raceIdx === -1 && !raceDone ? 0.3 : 0.15);
    r.m.scale.setScalar(active ? 1 + 0.08 * Math.sin(gT * 8) : 1);
  });
  raceArch.material.opacity = raceDone ? 0.15 : 0.6 + 0.25 * Math.sin(gT * 3);
}

function updateFauna(dt) {
  for (const u of gulls) {
    u.a += u.spd * dt;
    u.g.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(u.a * 3) * 2, Math.sin(u.a) * u.r);
    u.g.rotation.y = -u.a - Math.PI / 2;
    const fl = Math.sin(gT * 7 + u.r) * 0.5;
    u.wings[0].rotation.z = fl;
    u.wings[1].rotation.z = -fl;
  }
  for (const c of crabs) {
    c.timer -= dt;
    if (c.timer <= 0) { c.dir *= -1; c.timer = 2 + Math.random() * 3; }
    const dP = Math.hypot(P.pos.x - c.g.position.x, P.pos.z - c.g.position.z);
    const speed = dP < 5 ? 3.2 : 1.1;
    if (dP < 5) c.dir = Math.sign(Math.sin(Math.atan2(c.g.position.z, c.g.position.x) - Math.atan2(P.pos.z, P.pos.x)) || 1);
    c.a += c.dir * speed * dt / c.r;
    c.g.position.set(Math.cos(c.a) * c.r, 0, Math.sin(c.a) * c.r);
    c.g.position.y = terrainH(c.g.position.x, c.g.position.z);
    c.g.rotation.y = -c.a;
  }
  for (const f of flies) {
    f.p += dt;
    const x = f.ax + Math.sin(f.p * 0.7) * 4, z = f.az + Math.cos(f.p * 0.5) * 4;
    f.g.position.set(x, terrainH(x, z) + 1.6 + Math.sin(f.p * 2.2) * 0.5, z);
    f.g.children[0].rotation.z = Math.sin(f.p * 18) * 0.7;
    f.g.children[1].rotation.z = -Math.sin(f.p * 18) * 0.7;
  }
  /* Capitaine Médor : queue frétillante, point d'exclamation, dialogue */
  excl.position.set(medor.position.x, medor.position.y + 3.1 + Math.sin(gT * 3) * 0.15, medor.position.z);
  excl.visible = !medorNear;
  const dM = Math.hypot(P.pos.x - medor.position.x, P.pos.z - medor.position.z);
  const dlg = document.getElementById('dialog');
  if (dM < 4.5 && state === 'play') {
    medor.rotation.y = Math.atan2(P.pos.x - medor.position.x, P.pos.z - medor.position.z);
    if (!medorNear) {
      medorNear = true;
      dlg.innerHTML = MEDOR_LINES[medorLine % MEDOR_LINES.length];
      dlg.style.display = 'block';
      medorLine++;
      medorTimer = 4.5;
      bark(0.7);
    }
    medorTimer -= dt;
    if (medorTimer <= 0) {
      dlg.innerHTML = MEDOR_LINES[medorLine % MEDOR_LINES.length];
      medorLine++;
      medorTimer = 4.5;
    }
  } else if (medorNear) {
    medorNear = false;
    dlg.style.display = 'none';
  }
}

function updateHUD() {
  document.getElementById('hudBalls').textContent = ballN;
  document.getElementById('hudTotal').textContent = TOTAL_BALLS;
  document.getElementById('hudScore').textContent = String(score).padStart(6, '0');
  document.getElementById('hudLives').textContent = '🐾'.repeat(Math.max(0, lives));
}
updateHUD();
refreshQuests();

let winRank = 'C';
function doWin() {
  flagDone = true;
  checkQuests();
  state = 'win';
  SFX.win();
  const bonus = Math.max(0, Math.floor(timeLeft)) * 10;   // bonus chrono
  score += bonus;
  updateHUD();
  const done = QUESTS.filter(q => q.done).length;
  winRank = done >= 6 ? 'S' : done >= 5 ? 'A' : done >= 4 ? 'B' : 'C';
  document.getElementById('winRank').textContent = winRank;
  document.getElementById('winStats').textContent =
    `Score : ${score} (dont bonus chrono +${bonus}) · Baballes : ${ballN}/${TOTAL_BALLS} · Temps : ${Math.floor(playT)} s`;
  document.getElementById('winQuests').textContent = `Missions accomplies : ${done}/6` + (done >= 6 ? ' — L\'OS D\'OR EST À TOI ! 🦴' : '');
  // formulaire de nom pour le tableau des records
  document.getElementById('nameForm').hidden = false;
  document.getElementById('winBoard').innerHTML = '';
  document.getElementById('btnReplay').hidden = true;
  const inp = document.getElementById('nameInput');
  try { inp.value = localStorage.getItem('novaPlayerName') || ''; } catch (e) { inp.value = ''; }
  document.getElementById('ovWin').hidden = false;
  setTimeout(() => inp.focus(), 50);
}
function submitName() {
  const inp = document.getElementById('nameInput');
  const name = (inp.value.trim().toUpperCase() || 'NOVA').slice(0, 12);
  const { top, hi } = saveScore(name, winRank);
  document.getElementById('nameForm').hidden = true;
  document.getElementById('winBoard').innerHTML =
    '<p style="color:#ffe34a;font-weight:bold;margin-top:10px">🏆 TABLEAU DES RECORDS</p>' + boardHTML(top, hi);
  document.getElementById('btnReplay').hidden = false;
  renderTitleBoard();
  SFX.quest();
}

/* ---------------------------------------------------------------------
   BOUCLE
--------------------------------------------------------------------- */
let questTimer = 0;
function step(dt) {
  if (paused) { renderer.render(scene, camera); return; }
  gT += dt;
  for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 220) c.position.x = -220; }
  flagCloth.rotation.y = Math.sin(gT * 3) * 0.25;

  for (let i = 0; i < waterPos.count; i++) {
    const x = waterBase[i * 3], z = waterBase[i * 3 + 2];
    waterPos.setY(i, 0.16 * Math.sin(x * 0.07 + gT * 1.5) + 0.12 * Math.cos(z * 0.09 + gT * 1.1));
  }
  waterPos.needsUpdate = true;
  foam.material.opacity = 0.13 + 0.07 * Math.sin(gT * 1.3);
  for (const sp of sparkles) {
    sp.t += dt;
    if (sp.t > 3) {
      sp.t = 0;
      const a = Math.random() * 6.28, r = 95 + Math.random() * 60;
      sp.s.position.set(Math.cos(a) * r, WATER + 0.25, Math.sin(a) * r);
    }
    sp.s.material.opacity = Math.max(0, Math.sin(sp.t / 3 * Math.PI)) * 0.5;
  }
  updateParts(dt);
  if (barkT < 1) {
    barkT += dt * 2.6;
    barkRing.scale.setScalar(0.5 + barkT * (superT > 0 ? 15 : 9));
    barkRing.material.opacity = Math.max(0, 0.8 * (1 - barkT));
    if (barkT >= 1) barkRing.visible = false;
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) document.getElementById('toast').style.display = 'none'; }

  if (state === 'play') {
    playT += dt;
    /* compte à rebours du niveau */
    timeLeft -= dt;
    const whole = Math.ceil(timeLeft);
    if (whole !== lastWhole) {
      lastWhole = whole;
      const el = document.getElementById('hudTime');
      const mm = Math.max(0, Math.floor(whole / 60)), ss = Math.max(0, whole % 60);
      el.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      el.style.color = whole <= 30 ? '#ff5a5a' : '#d8f4ff';
      if (whole <= 10 && whole > 0) tone({ f0: 880, dur: 0.07, vol: 0.08 });
    }
    if (timeLeft <= 0) { gameOver('⏱ TEMPS ÉCOULÉ !'); return; }
    if (P.inv > 0) P.inv -= dt;
    if (superT > 0) {
      superT -= dt;
      if (superT <= 0) { superT = 0; setSuper(false); SFX.superEnd(); }
      else {
        aura.material.opacity = 0.16 + 0.1 * Math.sin(gT * 12);
        aura.scale.setScalar(1 + 0.08 * Math.sin(gT * 9));
        if (superT < 4) aura.visible = Math.floor(gT * 8) % 2 === 0;
      }
      document.getElementById('superfill').style.width = (superT / 20 * 100) + '%';
    }
    document.getElementById('superwrap').style.display = superT > 0 ? 'flex' : 'none';

    if (barkCD > 0) barkCD -= dt;
    updatePlayer(dt);
    updateCats(dt);
    updateBalls(dt);
    updateCocos(dt);
    updateRace(dt);
    updateFauna(dt);

    questTimer -= dt;
    if (questTimer <= 0) { questTimer = 0.3; checkQuests(); }

    const fd = Math.hypot(P.pos.x - FLAG.x, P.pos.z - FLAG.z);
    if (fd < 2.6 && Math.abs(P.pos.y - FLAG.y) < 4) doWin();
  } else if (state === 'transform') {
    transT += dt;
    ring.visible = true;
    ring.position.copy(P.pos);
    ring.position.y += 0.7;
    ring.scale.setScalar(0.3 + transT * 5);
    ring.material.opacity = Math.max(0, 0.9 - transT * 0.6);
    setSuper(Math.floor(transT * 12) % 2 === 0);
    if (transT >= 1.45) {
      ring.visible = false;
      superT = 20;
      setSuper(true);
      state = 'play';
      SFX.superGo();
      burst(P.pos.clone().setY(P.pos.y + 0.8), 0xffd23e, 16, 7, 8, 0.9, 0.6);
    }
  } else {
    updateFauna(dt);
  }

  /* animation de Nova */
  nova.position.copy(P.pos);
  nova.rotation.y = P.yaw;
  if (P.swimming) {
    nova.rotation.x = 0.25 + Math.sin(gT * 5) * 0.08;
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(gT * 10 + i * 1.6) * 0.7; });
  } else if (P.pound) {
    nova.rotation.x = P.pound === 1 ? -0.7 : 0.4;
    legs.forEach(leg => { leg.rotation.x = 0.8; });
  } else if (P.flipT > 0 && !P.onGround) {
    P.flipT += dt;
    nova.rotation.x = -Math.min(1, P.flipT / 0.65) * Math.PI * 2;
  } else {
    if (P.flipT === 0) nova.rotation.x = 0;
    const spd2 = Math.hypot(P.v.x, P.v.z);
    if (!P.onGround && state === 'play') {
      legs.forEach((leg, i) => { leg.rotation.x = i < 2 ? -0.6 : 0.6; });
    } else {
      const sw = Math.sin(gT * (6 + spd2 * 1.4)) * Math.min(0.8, spd2 * 0.1);
      legs.forEach((leg, i) => { leg.rotation.x = (i === 0 || i === 3) ? sw : -sw; });
    }
  }
  nova.visible = !(P.inv > 0 && Math.floor(gT * 10) % 2 === 0);
  const gShadow = groundAt(P.pos.x, P.pos.z, P.pos.y);
  const overWater = gShadow < WATER - 0.3;
  blobShadow.position.set(P.pos.x, (overWater ? WATER : gShadow) + 0.06, P.pos.z);
  blobShadow.scale.setScalar(Math.max(0.35, 1 - (P.pos.y - gShadow) * 0.05));
  blobShadow.visible = nova.visible && !P.swimming && !P.onGround;

  /* ---------- CAMÉRA LAKITU v2 ----------
     - gelée pendant les sauts (la référence des contrôles ne bouge pas en l'air)
     - ne tourne que si on court VERS/LOIN d'elle (fini la toupie en strafe)
     - C (clavier) recentre derrière Nova
     - vue surélevée automatique sur le ponton et les plateformes      */
  const spd = Math.hypot(P.v.x, P.v.z);
  if (state === 'play' && !paused) {
    if (keys.KeyQ || camL) { camYaw += 2.6 * dt; camManual = 1.4; }
    if (keys.KeyE || camR) { camYaw -= 2.6 * dt; camManual = 1.4; }
  }
  camManual = Math.max(0, camManual - dt);
  if (camManual <= 0 && (P.onGround || P.swimming) && spd > 3 && state === 'play') {
    const lookX = -Math.sin(camYaw), lookZ = -Math.cos(camYaw);
    const forwardness = Math.max(0, (P.v.x * lookX + P.v.z * lookZ) / spd);
    if (forwardness > 0.15) {
      const t = Math.atan2(P.v.x, P.v.z) + Math.PI;
      let d = t - camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      camYaw += d * Math.min(1, 2.2 * dt) * forwardness;
    }
  }
  const onPlat = gShadow > terrainH(P.pos.x, P.pos.z) + 0.6;
  const tDist = onPlat ? 9 : 11, tH = onPlat ? 6.8 : 4.4;
  camDist += (tDist - camDist) * Math.min(1, 3 * dt);
  camH += (tH - camH) * Math.min(1, 3 * dt);
  if (camShake > 0) camShake -= dt;
  const shk = camShake > 0 ? camShake * 0.5 : 0;
  const cx = P.pos.x + Math.sin(camYaw) * camDist + (Math.random() - 0.5) * shk;
  const cz = P.pos.z + Math.cos(camYaw) * camDist + (Math.random() - 0.5) * shk;
  let cy = P.pos.y + camH + (Math.random() - 0.5) * shk;
  cy = Math.max(cy, terrainH(cx, cz) + 1.6, WATER + 1.4);
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, 10 * dt));
  camera.lookAt(P.pos.x, P.pos.y + 1.2, P.pos.z);
  sky.position.copy(camera.position);

  renderer.render(scene, camera);
}

let lastT = performance.now();
function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  step(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* poignée de debug/vérification */
window.NGC = {
  get state() { return state; },
  get P() { return P; },
  get superT() { return superT; },
  get ballN() { return ballN; },
  get lives() { return lives; },
  get score() { return score; },
  get totalBalls() { return TOTAL_BALLS; },
  get camYaw() { return camYaw; },
  get raceIdx() { return raceIdx; },
  get raceDone() { return raceDone; },
  get bonesGot() { return bonesGot; },
  get catsSquashed() { return catsSquashed; },
  get scaredCount() { return scaredCount; },
  get cocos() { return cocos; },
  get timeLeft() { return timeLeft; },
  setTime(v) { timeLeft = v; lastWhole = Math.ceil(v) + 1; },
  doBark, submitName,
  get quests() { return QUESTS.map(q => ({ label: q.label, done: q.done })); },
  cats, balls, bones, superBall, raceRings, raceArch, terrainH, restart,
  renderer, camera, palms,
  press(c) { keys[c] = true; }, release(c) { keys[c] = false; },
  jump() { P.jbuf = 0.15; },
  pound() { if (!P.onGround && !P.pound) { P.pound = 1; P.poundT = 0; } },
  tick(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) step(dt); },
};
