'use strict';
/* =====================================================================
   NOVA 64 — Les Collines de Valenciennes en 3D
   Transposition "Mario 2D → Mario 64" : monde ouvert, caméra Lakitu,
   élan, dérapage, triple saut enchaîné, rendu 320×240 texturé.
   Three.js (CDN) + Web Audio.
   ===================================================================== */
import * as THREE from 'three';

/* ---------------------------------------------------------------------
   AUDIO — repris de NOVA 2D (bruitages chien + musique chiptune)
--------------------------------------------------------------------- */
let AC = null, musicOn = true, nextBar = 0, barIdx = 0;
function initAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      setInterval(musicTick, 150);
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { /* le jeu reste jouable sans audio */ }
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
  coin() { squeak(); },
  stomp() { noise({ dur: 0.1, vol: 0.14, f: 500 }); meow(); },
  skid() { tone({ f0: 950, f1: 480, dur: 0.22, type: 'sawtooth', vol: 0.045 }); },
  hurt() { whine(1150, 480, 0.18); whine(950, 380, 0.24, 0.2); },
  win() { bark(1, 0); bark(1.18, 0.18); bark(1.35, 0.36); squeak(0.62); squeak(0.85); },
  over() { whine(750, 170, 1.5); },
  charge() { tone({ f0: 90, f1: 980, dur: 1.35, type: 'sawtooth', vol: 0.07 }); tone({ f0: 45, f1: 490, dur: 1.35, type: 'square', vol: 0.05 }); noise({ dur: 1.3, vol: 0.03, f: 3000 }); },
  superGo() { noise({ dur: 0.35, vol: 0.22, f: 2500 }); [880, 1109, 1319, 1760].forEach((f, i) => tone({ f0: f, dur: 0.45, vol: 0.07, delay: 0.03 * i })); bark(1.5, 0.15); bark(1.7, 0.32); },
  superEnd() { tone({ f0: 700, f1: 180, dur: 0.4, type: 'triangle', vol: 0.12 }); noise({ dur: 0.15, vol: 0.08, f: 600 }); },
};
const EIGHTH = 0.21, BARLEN = EIGHTH * 8;
const MEL = [
  [523, 659, 784, 659, 880, 784, 659, 587],
  [523, 659, 784, 659, 1047, 880, 784, 659],
  [587, 494, 587, 698, 784, 0, 698, 587],
  [659, 523, 440, 523, 659, 587, 494, 392],
];
const BASS = [[262, 196, 220, 175], [262, 196, 220, 175], [294, 196, 247, 175], [262, 220, 196, 131]];
function musicTick() {
  if (!AC) return;
  if (!musicOn || (state !== 'play' && state !== 'transform')) { nextBar = AC.currentTime + 0.1; return; }
  if (nextBar < AC.currentTime) nextBar = AC.currentTime + 0.05;
  while (nextBar < AC.currentTime + 0.4) {
    const m = MEL[barIdx % 4], b = BASS[barIdx % 4];
    m.forEach((f, i) => { if (f) tone({ f0: f, dur: 0.16, type: 'square', vol: 0.034, at: nextBar + i * EIGHTH }); });
    b.forEach((f, i) => { if (f) tone({ f0: f / 2, dur: 0.34, type: 'triangle', vol: 0.06, at: nextBar + i * EIGHTH * 2 }); });
    barIdx++; nextBar += BARLEN;
  }
}

/* ---------------------------------------------------------------------
   RENDU — vraie basse résolution N64 (240 lignes), pixels apparents
--------------------------------------------------------------------- */
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe8f8, 90, 320);

const camera = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 800);

scene.add(new THREE.HemisphereLight(0xdcefff, 0x9a6b3c, 1.15));
const sun = new THREE.DirectionalLight(0xfff2c0, 0.85);
sun.position.set(50, 90, 30);
scene.add(sun);

function resize() {
  const ih = 240;                                  // résolution console
  const iw = Math.max(320, Math.round(innerWidth / innerHeight * ih));
  renderer.setSize(iw, ih, false);
  camera.aspect = iw / ih;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ---------- textures 32×32 générées (filtre NEAREST, esprit N64) ---------- */
function makeTex(draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  draw(c.getContext('2d'), 32);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const grassTex = makeTex((g, s) => {
  g.fillStyle = '#4eb13d'; g.fillRect(0, 0, s, s);
  const cs = ['#43a234', '#5cc24a', '#398f30', '#67ca55'];
  for (let i = 0; i < 110; i++) {
    g.fillStyle = cs[i % 4];
    g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2, 2);
  }
}, 52);
const stoneTex = makeTex((g, s) => {
  g.fillStyle = '#a9b0bc'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#8a929f';
  g.fillRect(0, 14, s, 3); g.fillRect(14, 0, 3, 14); g.fillRect(4, 17, 3, 15);
  g.fillStyle = '#c4cbd6'; g.fillRect(0, 0, s, 2); g.fillRect(0, 17, s, 2);
  for (let i = 0; i < 22; i++) { g.fillStyle = i % 2 ? '#9aa1ad' : '#b6bdc9'; g.fillRect((Math.random() * s) | 0, (Math.random() * s) | 0, 2, 2); }
});

/* ---------- ciel : dôme dégradé façon skybox peinte ---------- */
const sky = (() => {
  const geo = new THREE.SphereGeometry(380, 16, 10);
  const pos = geo.attributes.position;
  const cTop = new THREE.Color(0x2f7fe0), cHor = new THREE.Color(0xc8ecf8);
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) / 380));
    const c = cHor.clone().lerp(cTop, Math.pow(t, 0.7));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  scene.add(m);
  return m;
})();

const rand = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------- terrain : collines gouraud + texture herbe ---------- */
const HILLS = [
  [0, 0, 26, 30],
  [65, -45, 16, 26], [-70, 35, 13, 24], [45, 75, 11, 20],
  [-55, -65, 10, 18], [90, 20, 8, 16], [-20, 85, 9, 18], [-95, -15, 8, 15],
];
function terrainH(x, z) {
  let h = 0;
  for (const [a, b, hh, r] of HILLS) {
    const d2 = ((x - a) * (x - a) + (z - b) * (z - b)) / (r * r);
    h += hh * Math.exp(-d2);
  }
  h += Math.sin(x * 0.15) * Math.cos(z * 0.13) * 0.6;
  const d = Math.hypot(x, z);
  if (d > 120) h -= (d - 120) * 1.4;
  return h;
}
(function buildTerrain() {
  const geo = new THREE.PlaneGeometry(330, 330, 88, 88);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainH(x, z);
    pos.setY(i, h);
    const n = rand(i * 0.13);
    let r = 1, g = 1, b = 1;
    if (h < 0.2) { r = 0.72; g = 0.55; b = 0.4; }            // terre au bord
    else if (n > 0.88) { r = 1; g = 0.74; b = 0.45; }        // taches d'automne
    else if (n < 0.18) { r = 0.85; g = 0.95; b = 0.8; }
    colors.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();                                 // gouraud lisse
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: grassTex, vertexColors: true })));
})();

/* ---------- matériaux ---------- */
const mat = c => new THREE.MeshLambertMaterial({ color: c });
const M = {
  black: mat(0x23202b), tan: mat(0xc8702a), ear: mat(0x3a3543),
  fire: mat(0xf59b30), gold: mat(0xffd23e), white: mat(0xffffff),
  gray: mat(0x9aa3b8), dgray: mat(0x5f6680),
  stone: new THREE.MeshLambertMaterial({ map: stoneTex }),
  trunk: mat(0x7a4a28), leaf1: mat(0xc06a28), leaf2: mat(0xa85a28), leaf3: mat(0x4eb13d),
  pole: mat(0xcfd6df), flagR: mat(0xd8434e),
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/* ---------- ombres rondes (le blob iconique de l'époque) ---------- */
const shadowGeo = new THREE.CircleGeometry(1, 12);
shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
function makeShadow(r) {
  const s = new THREE.Mesh(shadowGeo, shadowMat);
  s.scale.setScalar(r);
  s.renderOrder = 1;
  scene.add(s);
  return s;
}

/* ---------- arbres ---------- */
const trees = [];
for (let i = 0; i < 38; i++) {
  const a = rand(i) * Math.PI * 2, r = 24 + rand(i + 50) * 88;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const h = terrainH(x, z);
  if (h > 13 || h < 0.3) continue;
  const g = new THREE.Group();
  const th = 1.6 + rand(i + 99) * 1.2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, th, 5), M.trunk);
  trunk.position.y = th / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7 + rand(i + 7) * 0.9, 3.6 + rand(i + 13) * 1.8, 6), [M.leaf1, M.leaf2, M.leaf3][i % 3]);
  cone.position.y = th + 1.6;
  g.add(trunk, cone);
  g.position.set(x, h, z);
  scene.add(g);
  trees.push({ x, z, r: 0.7 });
}

/* ---------- nuages ---------- */
const clouds = [];
for (let i = 0; i < 9; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(4 + rand(i + 31) * 3, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  c.scale.set(1.6, 0.5, 1);
  c.position.set((rand(i) - 0.5) * 260, 46 + rand(i + 3) * 18, (rand(i + 9) - 0.5) * 260);
  scene.add(c);
  clouds.push(c);
}

/* ---------- plateformes ---------- */
const platforms = [
  { x: 14, z: 50, top: 2.6, w: 4.4, d: 4.4 },
  { x: 21, z: 44, top: 4.8, w: 4, d: 4 },
  { x: 28, z: 38, top: 7.0, w: 4, d: 4 },
  { x: -16, z: -30, top: 11, w: 5, d: 5 },
  { x: 12, z: -26, top: 12.5, w: 4.5, d: 4.5 },
];
for (const p of platforms) {
  const m = new THREE.Mesh(box(p.w, 1.1, p.d), M.stone);
  m.position.set(p.x, p.top - 0.55, p.z);
  scene.add(m);
}

/* ---------- drapeau ---------- */
const FLAG = { x: 0, z: 0, y: terrainH(0, 0) };
const flagGroup = new THREE.Group();
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7, 6), M.pole);
pole.position.y = 3.5;
const flagCloth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 1.9), M.flagR);
flagCloth.position.set(0, 6.2, -0.95);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), M.gold);
knob.position.y = 7;
flagGroup.add(pole, flagCloth, knob);
flagGroup.position.set(FLAG.x, FLAG.y, FLAG.z);
scene.add(flagGroup);

/* ---------- baballes ---------- */
const ballGeo = new THREE.SphereGeometry(0.55, 8, 6);
const ballMat = new THREE.MeshLambertMaterial({ color: 0xf08020 });
const seamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
const balls = [];
function addBall(x, z, y = null) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ballGeo, ballMat));
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 4, 10), seamMat);
  seam.rotation.x = 1.1;
  g.add(seam);
  const gy = y !== null ? y : terrainH(x, z) + 1.2;
  g.position.set(x, gy, z);
  scene.add(g);
  balls.push({ g, x, z, y: gy, got: false, t: rand(balls.length) * 6 });
}
for (let i = 0; i < 30; i++) {
  const a = i * 2.4, r = 16 + (i * 2.9) % 92;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (terrainH(x, z) < 0.2) continue;
  addBall(x, z);
}
addBall(14, 50, 3.8); addBall(21, 44, 6); addBall(-16, -30, 12.2); addBall(12, -26, 13.7);
addBall(0, 6, terrainH(0, 6) + 1.4);
const TOTAL_BALLS = balls.length;

/* ---------- Super Baballe ---------- */
const superBall = (() => {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), new THREE.MeshLambertMaterial({ color: 0xf59b30, emissive: 0x7a3a00 }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22 }));
  g.add(core, halo);
  g.position.set(28, 8.6, 38);
  scene.add(g);
  return { g, halo, got: false, respawn: 0, t: 0 };
})();

/* ---------------------------------------------------------------------
   NOVA — teckel low-poly (regarde vers +Z)
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
  const h = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 4), M.gold);
  h.position.set(x, y, z);
  h.rotation.x = rx;
  hair.add(h);
});
hair.visible = false;
nova.add(hair);
const aura = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb838, transparent: true, opacity: 0.22 }));
aura.position.y = 0.7;
aura.visible = false;
nova.add(aura);
const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 18), new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9 }));
ring.rotation.x = Math.PI / 2;
ring.visible = false;
scene.add(ring);
nova.scale.setScalar(1.12);
scene.add(nova);
const novaShadow = makeShadow(0.85);

function setSuper(on) {
  for (const m of novaParts.body) m.material = on ? M.fire : M.black;
  for (const m of novaParts.accent) m.material = on ? M.black : M.tan;
  for (const m of novaParts.ears) m.material = on ? M.gold : M.ear;
  hair.visible = on;
  aura.visible = on;
}

/* ---------------------------------------------------------------------
   MATOUS
--------------------------------------------------------------------- */
const cats = [];
const CAT_SPOTS = [[30, 14], [-26, 38], [48, -20], [-44, -28], [12, 72], [-70, 8], [70, 48], [-30, -64], [58, 70], [0, -48]];
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
  return g;
}
for (const [x, z] of CAT_SPOTS) {
  const g = buildCat();
  g.position.set(x, terrainH(x, z), z);
  scene.add(g);
  cats.push({ g, x, z, dir: rand(x + z) * Math.PI * 2, timer: 1 + rand(x) * 3, dead: false, deadT: 0, shadow: makeShadow(0.6) });
}

/* ---------------------------------------------------------------------
   ÉTAT & ENTRÉES
--------------------------------------------------------------------- */
const START = { x: 0, z: 62 };
const P = {
  pos: new THREE.Vector3(START.x, terrainH(START.x, START.z), START.z),
  v: new THREE.Vector3(), onGround: true, yaw: Math.PI, inv: 0,
  jbuf: 0, coyote: 0, chain: 0, landT: 0, flipT: 0, skidT: 0,
};
let state = 'title', score = 0, ballN = 0, lives = 3, superT = 0, transT = 0, playT = 0;
let camYaw = 0, camManual = 0, gT = 0;

const keys = {};
let btnB = false;
addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  initAudio();
  if (e.code === 'KeyM') { musicOn = !musicOn; return; }
  if (state === 'title' || state === 'win' || state === 'gameover') { restart(); return; }
  if (e.code === 'KeyR') { restart(); return; }
  if (e.code === 'Space') P.jbuf = 0.15;
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
  const bA = document.getElementById('btnA'), bB = document.getElementById('btnB');
  bA.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); if (state !== 'play') { restart(); return; } P.jbuf = 0.15; keys.Space = true; });
  bA.addEventListener('pointerup', () => { keys.Space = false; });
  bB.addEventListener('pointerdown', e => { e.preventDefault(); btnB = true; });
  bB.addEventListener('pointerup', () => { btnB = false; });
})();
for (const id of ['ovTitle', 'ovWin', 'ovOver']) {
  document.getElementById(id).addEventListener('pointerdown', () => { initAudio(); restart(); });
}

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

function gameOver() {
  state = 'gameover';
  document.getElementById('overStats').textContent = `Score : ${score} · Baballes : ${ballN}/${TOTAL_BALLS}`;
  document.getElementById('ovOver').hidden = false;
  SFX.over();
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
function fellOff() {
  lives--;
  SFX.hurt();
  updateHUD();
  if (lives <= 0) { gameOver(); return; }
  P.pos.set(START.x, terrainH(START.x, START.z) + 2, START.z);
  P.v.set(0, 0, 0);
  P.inv = 2;
}

function restart() {
  state = 'play';
  score = 0; ballN = 0; lives = 3; superT = 0; transT = 0; playT = 0; barIdx = 0;
  P.pos.set(START.x, terrainH(START.x, START.z), START.z);
  P.v.set(0, 0, 0); P.yaw = Math.PI; P.inv = 0;
  P.chain = 0; P.landT = 0; P.flipT = 0; P.skidT = 0;
  camYaw = 0; camManual = 0;
  setSuper(false);
  nova.rotation.x = 0;
  for (const b of balls) { b.got = false; b.g.visible = true; }
  superBall.got = false; superBall.respawn = 0; superBall.g.visible = true;
  for (const c of cats) {
    c.dead = false; c.deadT = 0;
    c.g.visible = true; c.shadow.visible = true; c.g.scale.set(1, 1, 1);
    c.g.position.set(c.x, terrainH(c.x, c.z), c.z);
  }
  for (const id of ['ovTitle', 'ovWin', 'ovOver']) document.getElementById(id).hidden = true;
  updateHUD();
}

function updatePlayer(dt) {
  /* direction voulue, relative à la caméra — comme le stick de la N64 */
  let ix = 0, iz = 0;
  if (keys.ArrowLeft || keys.KeyA) ix -= 1;
  if (keys.ArrowRight || keys.KeyD) ix += 1;
  if (keys.ArrowUp || keys.KeyW) iz -= 1;
  if (keys.ArrowDown || keys.KeyS) iz += 1;
  if (joy.active) { ix = joy.x; iz = joy.y; }
  let l = Math.hypot(ix, iz);
  if (l > 1) { ix /= l; iz /= l; l = 1; }
  const walk = keys.ShiftLeft || keys.ShiftRight;
  const maxSpd = (walk ? 4.5 : 10.5) * l;

  const fw = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw)); // joueur → caméra
  const rt = new THREE.Vector3(fw.z, 0, -fw.x);                       // droite à l'écran
  const wish = new THREE.Vector3().addScaledVector(fw, iz).addScaledVector(rt, ix);
  if (wish.lengthSq() > 0.001) wish.normalize();

  const spd = Math.hypot(P.v.x, P.v.z);
  if (P.skidT > 0) P.skidT -= dt;

  if (l > 0.05) {
    const dot = spd > 0.5 ? (wish.x * P.v.x + wish.z * P.v.z) / spd : 1;
    if (P.onGround && dot < -0.45 && spd > 5.5) {
      /* dérapage : Nova freine des quatre pattes avant de repartir */
      if (P.skidT <= 0) { SFX.skid(); P.skidT = 0.25; }
      const f = Math.max(0, 1 - 40 * dt / spd);
      P.v.x *= f; P.v.z *= f;
    } else {
      const acc = P.onGround ? 42 : 16;
      P.v.x += wish.x * acc * dt;
      P.v.z += wish.z * acc * dt;
      const ns = Math.hypot(P.v.x, P.v.z);
      const cap = P.onGround ? Math.max(maxSpd, 0.01) : 11.5;
      if (ns > cap) { P.v.x *= cap / ns; P.v.z *= cap / ns; }
    }
  } else if (P.onGround) {
    const f = Math.pow(0.0006, dt);            // arrêt franc, comme Mario
    P.v.x *= f; P.v.z *= f;
  }

  /* sauts enchaînés : simple → double → TRIPLE avec salto */
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

  /* gravité façon M64 : montée portée si saut maintenu, chute rapide */
  const g = P.v.y > 0 ? (keys.Space ? 26 : 48) : 46;
  P.v.y -= g * dt;
  if (P.v.y < -45) P.v.y = -45;

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
    if (wasAir) {
      P.landT = 0.28;                          // fenêtre pour enchaîner
      P.flipT = 0;
      nova.rotation.x = 0;
      if (impact < -16) SFX.land();
    }
  } else if (P.pos.y > gd + 0.05) {
    P.onGround = false;
  }

  /* orientation : Nova pivote vers sa course */
  if (spd > 0.8 || (l > 0.05 && spd <= 0.8)) {
    const target = spd > 0.8 ? Math.atan2(P.v.x, P.v.z) : Math.atan2(wish.x, wish.z);
    let d = target - P.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    P.yaw += d * Math.min(1, (spd < 2 ? 22 : 14) * dt);
  }

  if (P.pos.y < -25) fellOff();
}

function updateCats(dt) {
  for (const c of cats) {
    if (c.dead) {
      c.deadT += dt;
      c.g.scale.y = Math.max(0.12, 1 - c.deadT * 3);
      if (c.deadT > 0.9) { c.g.visible = false; c.shadow.visible = false; }
      continue;
    }
    c.timer -= dt;
    if (c.timer <= 0) { c.dir = rand(gT + c.x) * Math.PI * 2; c.timer = 1.5 + rand(gT + c.z) * 2.5; }
    const nx = c.g.position.x + Math.sin(c.dir) * 3 * dt;
    const nz = c.g.position.z + Math.cos(c.dir) * 3 * dt;
    if (Math.hypot(nx, nz) > 112 || terrainH(nx, nz) < 0.1) { c.dir += Math.PI; continue; }
    c.g.position.x = nx; c.g.position.z = nz;
    c.g.position.y = terrainH(nx, nz);
    c.g.rotation.y = c.dir;
    c.shadow.position.set(nx, c.g.position.y + 0.04, nz);

    const dx = P.pos.x - nx, dz = P.pos.z - nz;
    const dy = P.pos.y - c.g.position.y;
    if (Math.hypot(dx, dz) < 1.15 && dy > -0.5 && dy < 1.4) {
      if (superT > 0) {
        c.dead = true; score += 200; SFX.stomp(); updateHUD();
      } else if (P.v.y < -2 && dy > 0.45) {
        c.dead = true; score += 200; SFX.stomp();
        P.v.y = keys.Space ? 14 : 10;
        updateHUD();
      } else {
        hurt(c.g.position);
      }
    }
  }
}

function updateBalls(dt) {
  for (const b of balls) {
    if (b.got) continue;
    b.t += dt;
    b.g.rotation.y += dt * 2.5;
    b.g.position.y = b.y + Math.sin(b.t * 2.5) * 0.15;
    const dx = b.g.position.x - P.pos.x, dz = b.g.position.z - P.pos.z;
    const dy = b.g.position.y - (P.pos.y + 0.7);
    if (dx * dx + dz * dz + dy * dy < 2.9) {
      b.got = true; b.g.visible = false;
      ballN++; score += 50;
      SFX.coin();
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

function updateHUD() {
  document.getElementById('hudBalls').textContent = ballN;
  document.getElementById('hudTotal').textContent = TOTAL_BALLS;
  document.getElementById('hudScore').textContent = String(score).padStart(6, '0');
  document.getElementById('hudLives').textContent = '🐾'.repeat(Math.max(0, lives));
}
updateHUD();

/* ---------------------------------------------------------------------
   BOUCLE — step() séparé pour rester testable
--------------------------------------------------------------------- */
function step(dt) {
  gT += dt;
  for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 160) c.position.x = -160; }
  flagCloth.rotation.y = Math.sin(gT * 3) * 0.25;

  if (state === 'play') {
    playT += dt;
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

    updatePlayer(dt);
    updateCats(dt);
    updateBalls(dt);

    const fd = Math.hypot(P.pos.x - FLAG.x, P.pos.z - FLAG.z);
    if (fd < 2.6 && Math.abs(P.pos.y - FLAG.y) < 4) {
      state = 'win';
      SFX.win();
      document.getElementById('winStats').textContent =
        `Score : ${score} · Baballes : ${ballN}/${TOTAL_BALLS} · Temps : ${Math.floor(playT)} s`;
      document.getElementById('ovWin').hidden = false;
    }
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
    }
  }

  /* animation de Nova */
  nova.position.copy(P.pos);
  nova.rotation.y = P.yaw;
  if (P.flipT > 0 && !P.onGround) {            // salto du triple saut
    P.flipT += dt;
    nova.rotation.x = -Math.min(1, P.flipT / 0.65) * Math.PI * 2;
  }
  const spd = Math.hypot(P.v.x, P.v.z);
  if (!P.onGround && state === 'play') {
    legs.forEach((leg, i) => { leg.rotation.x = i < 2 ? -0.6 : 0.6; });
  } else {
    const sw = Math.sin(gT * (6 + spd * 1.4)) * Math.min(0.8, spd * 0.1);
    legs.forEach((leg, i) => { leg.rotation.x = (i === 0 || i === 3) ? sw : -sw; });
  }
  nova.visible = !(P.inv > 0 && Math.floor(gT * 10) % 2 === 0);
  const gShadow = groundAt(P.pos.x, P.pos.z, P.pos.y);
  novaShadow.position.set(P.pos.x, gShadow + 0.04, P.pos.z);
  novaShadow.scale.setScalar(0.85 * Math.max(0.35, 1 - (P.pos.y - gShadow) * 0.05));
  novaShadow.visible = nova.visible;

  /* caméra Lakitu : Q/E pour tourner, sinon elle suit la course */
  if (state === 'play') {
    if (keys.KeyQ) { camYaw += 2.6 * dt; camManual = 1.4; }
    if (keys.KeyE) { camYaw -= 2.6 * dt; camManual = 1.4; }
  }
  camManual = Math.max(0, camManual - dt);
  if (camManual <= 0 && spd > 3 && state === 'play') {
    const t = Math.atan2(P.v.x, P.v.z) + Math.PI;
    let d = t - camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camYaw += d * Math.min(1, 1.5 * dt);
  }
  const camDist = 10.5, camH = 4.2;
  const cx = P.pos.x + Math.sin(camYaw) * camDist;
  const cz = P.pos.z + Math.cos(camYaw) * camDist;
  let cy = P.pos.y + camH;
  cy = Math.max(cy, terrainH(cx, cz) + 1.6);
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, 7 * dt));
  camera.lookAt(P.pos.x, P.pos.y + 1.3, P.pos.z);
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
window.N64 = {
  get state() { return state; },
  get P() { return P; },
  get superT() { return superT; },
  get ballN() { return ballN; },
  get lives() { return lives; },
  get score() { return score; },
  get totalBalls() { return TOTAL_BALLS; },
  get camYaw() { return camYaw; },
  cats, balls, superBall, terrainH, restart,
  press(c) { keys[c] = true; }, release(c) { keys[c] = false; },
  jump() { P.jbuf = 0.15; },
  tick(dt = 1 / 60, n = 1) { for (let i = 0; i < n; i++) step(dt); },
};
