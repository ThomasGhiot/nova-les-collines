'use strict';
/* =====================================================================
   NOVA — Les Collines de Valenciennes
   Mini-platformer en un niveau. Canvas + Web Audio, zéro dépendance.
   DA : automne pastel. Héroïne : Nova, teckel nain noir et feu à poils
   longs, qui ramasse des baballes orange. Ennemis : matous gris rayés.
   Jouable au clavier et en tactile (boutons virtuels sur mobile).
   ===================================================================== */

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');

const TILE = 32, VIEW_W = 960, VIEW_H = 480, HUD_H = 60;
const W = 160, H = 15;                 // taille du niveau en tuiles
const GRAV = 0.55, MAX_FALL = 12;
const FLAG_X = 146;

/* ---------------------------------------------------------------------
   NIVEAU — construit par code (plus fiable qu'une carte ASCII)
   #: sol  X: pierre  B: brique  ?: bloc surprise  U: bloc vidé
--------------------------------------------------------------------- */
const map = [];
(function buildLevel() {
  for (let y = 0; y < H; y++) map.push(Array(W).fill('.'));
  const fill = (x0, x1, y0, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) map[y][x] = c; };
  const ground = (x0, x1) => fill(x0, x1, 13, 14, '#');

  ground(0, 38); ground(43, 70); ground(75, 100); ground(104, 159);

  // section 1 : initiation
  map[9][14] = '?'; map[9][15] = 'B'; map[9][16] = '?'; map[9][17] = 'B'; map[9][18] = '?';
  map[5][16] = '?';
  fill(33, 34, 11, 12, 'X');                       // muret

  // section 2 : briques + plateforme au-dessus du vide
  map[9][47] = 'B'; map[9][48] = '?'; map[9][49] = 'B'; map[9][50] = '?'; map[9][51] = 'B';
  fill(66, 67, 10, 12, 'X');                       // tour
  fill(72, 73, 10, 10, 'X');                       // plateforme flottante

  // section 3 : pyramide
  map[9][83] = '?'; map[9][84] = 'B'; map[9][85] = '?';
  for (let i = 0; i < 4; i++) fill(92 + i, 92 + i, 12 - i, 12, 'X');

  // section finale : escalier, drapeau, fort
  map[9][115] = '?';
  for (let i = 0; i < 5; i++) fill(132 + i, 132 + i, 12 - i, 12, 'X');
  map[12][FLAG_X] = 'X';                           // socle du drapeau
  fill(151, 156, 9, 12, 'X'); fill(153, 154, 6, 8, 'X'); // petit fort
})();
const MAP0 = map.map(r => r.slice());

const SOLID = new Set(['#', 'X', 'B', '?', 'U']);
const isSolid = c => SOLID.has(c);
function cellAt(tx, ty) {
  if (tx < 0 || tx >= W) return 'X';     // murs invisibles aux bords
  if (ty < 0 || ty >= H) return '.';
  return map[ty][tx];
}

const ENEMY_X = [21, 27, 49, 56, 63, 80, 85, 89, 112, 118, 124, 126];
const COIN_T = [
  [8, 9], [9, 8], [10, 8], [11, 9],
  [33, 8], [34, 8],
  [39, 9], [40, 8], [41, 8], [42, 9],
  [47, 5], [48, 5], [49, 5], [50, 5], [51, 5],
  [66, 8], [67, 8],
  [72, 8], [73, 8],
  [88, 8], [89, 7], [90, 7], [91, 8],
  [101, 9], [102, 8], [103, 9],
  [108, 9], [109, 9], [110, 9], [111, 9], [112, 9],
  [132, 10], [133, 9], [134, 8], [135, 7], [136, 6],
];

/* ---------------------------------------------------------------------
   SPRITES — pixel-art défini en chaînes, rendu en canvas hors écran
--------------------------------------------------------------------- */
const PAL = {
  n: '#23202b', e: '#3a3543', t: '#c8702a',
  W: '#ffffff', B: '#2a2030', c: '#9aa3b8', s: '#5f6680',
};
function makeSprite(rows, scale = 2) {
  const c = document.createElement('canvas');
  c.width = 16 * scale; c.height = 16 * scale;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const k = row[x];
      if (k !== '.' && PAL[k]) { g.fillStyle = PAL[k]; g.fillRect(x * scale, y * scale, scale, scale); }
    }
  });
  return c;
}
/* Nova de profil, tournée vers la droite : tête à droite, longue
   silhouette basse de teckel, queue à gauche, marques feu (t). */
const NOVA_BODY = [
  '................',
  '................',
  '................',
  '..........nnnn..',
  '.........ennnnn.',
  '.........ennnWn.',
  'tt.......ennnttt',
  '.nn.......nnttt.',
  '..nnnnnnnnnnnn..',
  '.nnnnnnnnnnnnnn.',
  '.nnnnnnnnnnnnn..',
  '..nnnnnnnnnntt..',
  '..tttttttttttt..',
];
const S = {
  novaIdle: makeSprite([...NOVA_BODY, '...tt......tt...', '...tt......tt...', '................']),
  novaRun:  makeSprite([...NOVA_BODY, '..tt........tt..', '.tt..........tt.', '................']),
  novaJump: makeSprite([...NOVA_BODY, '...tt.....tt....', '................', '................']),
  /* Matou de profil, tourné vers la gauche : tête à gauche, rayures
     sombres sur le dos, queue dressée à droite. */
  catA: makeSprite([
    '................', '................', '................',
    '..c...c.........',
    '..cc.cc.........',
    '.ccccccc........',
    '.cWBcccc........',
    '.cccccc......cc.',
    '.Wccccc......cc.',
    '..ccccccccccccc.',
    '..ccsccsccscc...',
    '..cWWccccccccc..',
    '..cccccccccccc..',
    '..cc..cc..cc....',
    '..ss..ss..ss....',
    '................',
  ]),
  catB: makeSprite([
    '................', '................', '................',
    '..c...c.........',
    '..cc.cc.........',
    '.ccccccc........',
    '.cWBcccc........',
    '.cccccc.....cc..',
    '.Wccccc......cc.',
    '..ccccccccccccc.',
    '..ccsccsccscc...',
    '..cWWccccccccc..',
    '..cccccccccccc..',
    '...cc..cc..cc...',
    '...ss..ss..ss...',
    '................',
  ]),
  catSquash: makeSprite([
    '................', '................', '................', '................', '................',
    '................', '................', '................', '................', '................',
    '................', '................',
    '..cccccccccccc..',
    '.cWBcccccccccc..',
    '.ssssssssssssss.',
    '................',
  ]),
};

/* ---------- tuiles dessinées procéduralement ---------- */
function tileCanvas(fn) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  fn(g);
  return c;
}
const T = {};
T.dirt = tileCanvas(g => {
  g.fillStyle = '#8a5a33'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#7a4a28';
  [[4, 6], [14, 12], [24, 8], [8, 22], [20, 26], [27, 18], [2, 16]].forEach(([x, y]) => g.fillRect(x, y, 3, 3));
  g.fillStyle = '#96673c';
  [[10, 4], [26, 24], [16, 18]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
});
T.grass = tileCanvas(g => {
  g.drawImage(T.dirt, 0, 0);
  g.fillStyle = '#6da33c'; g.fillRect(0, 0, 32, 10);
  g.fillStyle = '#85c04b'; g.fillRect(0, 0, 32, 5);
  g.fillStyle = '#587f2f';
  [[3, 8], [11, 8], [19, 8], [27, 8]].forEach(([x, y]) => g.fillRect(x, y, 2, 4));
});
T.stone = tileCanvas(g => {
  g.fillStyle = '#9aa1ad'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#c2c8d2'; g.fillRect(0, 0, 32, 3); g.fillRect(0, 0, 3, 32);
  g.fillStyle = '#6e7480'; g.fillRect(0, 29, 32, 3); g.fillRect(29, 0, 3, 32);
  g.fillStyle = '#848b97'; g.fillRect(8, 8, 4, 4); g.fillRect(20, 18, 4, 4);
});
T.brick = tileCanvas(g => {
  g.fillStyle = '#b65034'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#8c3a22';
  g.fillRect(0, 9, 32, 3); g.fillRect(0, 21, 32, 3);
  g.fillRect(15, 0, 3, 9); g.fillRect(7, 12, 3, 9); g.fillRect(23, 12, 3, 9); g.fillRect(15, 24, 3, 8);
  g.fillStyle = '#cf6a47'; g.fillRect(0, 0, 32, 2);
});
T.q = tileCanvas(g => {
  g.fillStyle = '#eebc2e'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#ffe48a'; g.fillRect(0, 0, 32, 3); g.fillRect(0, 0, 3, 32);
  g.fillStyle = '#a8761a'; g.fillRect(0, 29, 32, 3); g.fillRect(29, 0, 3, 32);
  g.fillStyle = '#7a4a08';
  [[3, 3], [26, 3], [3, 26], [26, 26]].forEach(([x, y]) => g.fillRect(x, y, 3, 3));
  g.font = 'bold 20px Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', 16, 17);
});
T.used = tileCanvas(g => {
  g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#a3815c'; g.fillRect(0, 0, 32, 3); g.fillRect(0, 0, 3, 32);
  g.fillStyle = '#64492f'; g.fillRect(0, 29, 32, 3); g.fillRect(29, 0, 3, 32);
  g.fillStyle = '#64492f';
  [[3, 3], [26, 3], [3, 26], [26, 26]].forEach(([x, y]) => g.fillRect(x, y, 3, 3));
});

/* ---------------------------------------------------------------------
   AUDIO — bruitages et musique générés en Web Audio
--------------------------------------------------------------------- */
let AC = null, musicOn = true, nextBar = 0, barIdx = 0;
function initAudio() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      setInterval(musicTick, 150);
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { /* pas d'audio dispo : le jeu reste jouable */ }
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
/* Bruitages "chien" synthétisés :
   - wouf : sciante qui chute brutalement + souffle de bruit
   - couic : jouet qui couine (sinus monte puis retombe)
   - kaï : gémissement aigu descendant                         */
function bark(pitch = 1, delay = 0) {
  tone({ f0: 420 * pitch, f1: 130 * pitch, dur: 0.13, type: 'sawtooth', vol: 0.16, delay });
  noise({ dur: 0.08, vol: 0.1, f: 1200, delay });
}
function squeak(delay = 0) {
  tone({ f0: 850, f1: 1550, dur: 0.07, type: 'sine', vol: 0.14, delay });
  tone({ f0: 1550, f1: 550, dur: 0.13, type: 'sine', vol: 0.13, delay: delay + 0.07 });
}
function whine(f0, f1, dur, delay = 0) {
  tone({ f0, f1, dur, type: 'sine', vol: 0.13, delay });
}
function meow(delay = 0) {
  // miaou indigné du matou écrasé : montée puis chute nasillarde
  tone({ f0: 520, f1: 800, dur: 0.12, type: 'sawtooth', vol: 0.09, delay });
  tone({ f0: 800, f1: 320, dur: 0.2, type: 'sawtooth', vol: 0.09, delay: delay + 0.12 });
}
const SFX = {
  jump()  { bark(1); },                                               // wouf !
  land()  { noise({ dur: 0.07, vol: 0.12, f: 400 }); },               // pattes au sol
  coin()  { squeak(); },                                              // baballe qui couine
  stomp() { noise({ dur: 0.1, vol: 0.14, f: 500 }); meow(); },        // plouf + miaou indigné
  brick() { noise({ dur: 0.2, vol: 0.22, f: 900 }); tone({ f0: 180, f1: 60, dur: 0.12, type: 'square', vol: 0.08 }); },
  bump()  { tone({ f0: 120, f1: 80, dur: 0.08, type: 'square', vol: 0.15 }); },
  hurt()  { whine(1150, 480, 0.18); whine(950, 380, 0.24, 0.2); },    // kaï kaï !
  win()   { bark(1, 0); bark(1.18, 0.18); bark(1.35, 0.36); squeak(0.62); squeak(0.85); }, // jappements de joie
  over()  { whine(750, 170, 1.5); },                                  // long gémissement triste
};
const EIGHTH = 0.21, BARLEN = EIGHTH * 8;
const MEL = [
  [523, 659, 784, 659, 880, 784, 659, 587],
  [523, 659, 784, 659, 1047, 880, 784, 659],
  [587, 494, 587, 698, 784, 0, 698, 587],
  [659, 523, 440, 523, 659, 587, 494, 392],
];
const BASS = [
  [262, 196, 220, 175],
  [262, 196, 220, 175],
  [294, 196, 247, 175],
  [262, 220, 196, 131],
];
function musicTick() {
  if (!AC) return;
  if (!musicOn || state !== 'play') { nextBar = AC.currentTime + 0.1; return; }
  if (nextBar < AC.currentTime) nextBar = AC.currentTime + 0.05;
  while (nextBar < AC.currentTime + 0.4) {
    const m = MEL[barIdx % 4], b = BASS[barIdx % 4];
    m.forEach((f, i) => { if (f) tone({ f0: f, dur: 0.16, type: 'square', vol: 0.038, at: nextBar + i * EIGHTH }); });
    b.forEach((f, i) => { if (f) tone({ f0: f / 2, dur: 0.34, type: 'triangle', vol: 0.07, at: nextBar + i * EIGHTH * 2 }); });
    barIdx++; nextBar += BARLEN;
  }
}

/* ---------------------------------------------------------------------
   ÉTAT DU JEU
--------------------------------------------------------------------- */
const player = { x: 0, y: 0, w: 26, h: 24, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jbuf: 0, anim: 0 };
let enemies = [], coinsArr = [], pops = [], parts = [];
const bumps = new Map();
let camX = 0, shake = 0, state = 'title', score = 0, coinN = 0, lives = 3;
let timeF = 0, gFrame = 0, deathT = 0, respT = 0, winT = 0;

const leaves = Array.from({ length: 16 }, (_, i) => ({
  x: Math.random() * VIEW_W, y: Math.random() * VIEW_H,
  p: Math.random() * 6.28, v: 0.4 + Math.random() * 0.8,
  s: 3 + Math.random() * 3, c: ['#e98e3a', '#d8642e', '#caa53d'][i % 3],
}));

function rebuildLevel() {
  for (let y = 0; y < H; y++) map[y] = MAP0[y].slice();
  enemies = ENEMY_X.map(x => ({
    x: x * TILE + 4, y: 13 * TILE - 24, w: 24, h: 24, vx: 0, vy: 0,
    dir: -1, onGround: false, active: false, dead: false, deadT: 0, t: Math.random() * 60,
  }));
  coinsArr = COIN_T.map(([tx, ty]) => ({ x: tx * TILE + 16, y: ty * TILE + 16, t: Math.random() * 60, got: false }));
  pops = []; parts = []; bumps.clear();
  player.x = 2 * TILE; player.y = 13 * TILE - player.h - 1;
  player.vx = 0; player.vy = 0; player.face = 1; player.onGround = false;
  player.coyote = 0; player.jbuf = 0;
  camX = 0; shake = 0; winT = 0;
}
function fullReset() {
  score = 0; coinN = 0; lives = 3; timeF = 0; barIdx = 0;
  rebuildLevel();
  state = 'play';
}
rebuildLevel();

/* ---------------------------------------------------------------------
   PHYSIQUE — déplacement + collisions tuiles (axe X puis axe Y)
--------------------------------------------------------------------- */
function moveEntity(e) {
  const res = { hitL: false, hitR: false, landed: false, impact: 0, head: false, headY: 0, headTiles: [] };

  e.x += e.vx;
  let x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w - 0.01) / TILE);
  let y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 0.01) / TILE);
  if (e.vx > 0) {
    for (let ty = y0; ty <= y1; ty++) if (isSolid(cellAt(x1, ty))) { e.x = x1 * TILE - e.w - 0.01; res.hitR = true; e.vx = 0; break; }
  } else if (e.vx < 0) {
    for (let ty = y0; ty <= y1; ty++) if (isSolid(cellAt(x0, ty))) { e.x = (x0 + 1) * TILE + 0.01; res.hitL = true; e.vx = 0; break; }
  }

  e.vy = Math.min(e.vy + GRAV, MAX_FALL);
  e.y += e.vy;
  x0 = Math.floor(e.x / TILE); x1 = Math.floor((e.x + e.w - 0.01) / TILE);
  y0 = Math.floor(e.y / TILE); y1 = Math.floor((e.y + e.h - 0.01) / TILE);
  const wasAir = !e.onGround;
  e.onGround = false;
  if (e.vy > 0) {
    for (let tx = x0; tx <= x1; tx++) if (isSolid(cellAt(tx, y1))) {
      res.impact = e.vy;
      e.y = y1 * TILE - e.h - 0.01; e.vy = 0; e.onGround = true;
      if (wasAir) res.landed = true;
      break;
    }
  } else if (e.vy < 0) {
    for (let tx = x0; tx <= x1; tx++) if (isSolid(cellAt(tx, y0))) res.headTiles.push(tx);
    if (res.headTiles.length) { e.y = (y0 + 1) * TILE + 0.01; e.vy = 0; res.head = true; res.headY = y0; }
  }
  return res;
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function bumpBlock(tx, ty) {
  const c = cellAt(tx, ty);
  if (c === '?') {
    map[ty][tx] = 'U';
    bumps.set(tx + ',' + ty, 8);
    pops.push({ x: tx * TILE + 16, y: ty * TILE - 4, vy: -7, t: 0 });
    score += 100; coinN++;
    SFX.coin();
  } else if (c === 'B') {
    map[ty][tx] = '.';
    score += 20; shake = 6;
    SFX.brick();
    for (let i = 0; i < 6; i++) parts.push({
      x: tx * TILE + 16, y: ty * TILE + 16,
      vx: (Math.random() * 2 - 1) * 3.2, vy: -Math.random() * 6 - 2,
      t: 0, life: 40, color: '#b65034', s: 5,
    });
  } else {
    if (c === 'U') bumps.set(tx + ',' + ty, 8);
    SFX.bump();
  }
}
function dust(x, y, col = '#cbb89a') {
  for (let i = 0; i < 4; i++) parts.push({
    x, y, vx: (Math.random() * 2 - 1) * 1.6, vy: -Math.random() * 1.5,
    t: 0, life: 22, color: col, s: 3,
  });
}

/* ---------------------------------------------------------------------
   ENTRÉES
--------------------------------------------------------------------- */
const keys = {};
addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  initAudio();
  if (e.code === 'KeyM') { musicOn = !musicOn; return; }
  if (state === 'title') { fullReset(); return; }
  if (e.code === 'KeyP' && (state === 'play' || state === 'pause')) { state = state === 'play' ? 'pause' : 'play'; return; }
  if (e.code === 'KeyR' && (state === 'win' || state === 'gameover' || state === 'play' || state === 'pause')) { fullReset(); return; }
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') player.jbuf = 8;
});
addEventListener('keyup', e => { keys[e.code] = false; });

/* ---------- contrôles tactiles (mobile) ---------- */
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
function virtualPress(code) {
  initAudio();
  if (state === 'title') { fullReset(); return; }
  if ((state === 'win' || state === 'gameover') && code === 'Space') { fullReset(); return; }
  if (state === 'pause') state = 'play';
  keys[code] = true;
  if (code === 'Space') player.jbuf = 8;
}
function virtualRelease(code) { keys[code] = false; }
(function setupTouch() {
  const ui = document.getElementById('touch');
  if (!ui) return;
  if (IS_TOUCH) ui.hidden = false;
  const bind = (id, code) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      virtualPress(code);
    });
    el.addEventListener('pointerup', e => { e.preventDefault(); virtualRelease(code); });
    el.addEventListener('pointercancel', () => virtualRelease(code));
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  bind('btnL', 'ArrowLeft');
  bind('btnR', 'ArrowRight');
  bind('btnA', 'Space');
  bind('btnB', 'ShiftLeft');
  // toucher/cliquer l'écran de jeu : démarrer ou rejouer
  cvs.addEventListener('pointerdown', () => {
    initAudio();
    if (state === 'title' || state === 'win' || state === 'gameover') fullReset();
  });
})();

/* ---------------------------------------------------------------------
   MISE À JOUR
--------------------------------------------------------------------- */
function updatePlayer() {
  const left = keys.ArrowLeft || keys.KeyA, right = keys.ArrowRight || keys.KeyD;
  const run = keys.ShiftLeft || keys.ShiftRight;
  const max = run ? 5.0 : 3.2, acc = 0.55;

  if (left && !right) { player.vx = Math.max(player.vx - acc, -max); player.face = -1; }
  else if (right && !left) { player.vx = Math.min(player.vx + acc, max); player.face = 1; }
  else { player.vx *= player.onGround ? 0.72 : 0.93; if (Math.abs(player.vx) < 0.05) player.vx = 0; }
  if (Math.abs(player.vx) > max) player.vx *= 0.96;

  if (player.onGround) player.coyote = 7; else if (player.coyote > 0) player.coyote--;
  if (player.jbuf > 0) player.jbuf--;
  const jumpHeld = keys.Space || keys.ArrowUp || keys.KeyW;
  if (player.jbuf > 0 && (player.onGround || player.coyote > 0)) {
    player.vy = -12.6; player.onGround = false; player.coyote = 0; player.jbuf = 0;
    SFX.jump();
    dust(player.x + player.w / 2, player.y + player.h);
  }
  if (!jumpHeld && player.vy < -4) player.vy = -4;   // saut à hauteur variable

  const res = moveEntity(player);
  if (res.landed && res.impact > 7) { SFX.land(); dust(player.x + player.w / 2, player.y + player.h); }
  if (res.head) {
    const cx = (player.x + player.w / 2) / TILE - 0.5;
    let best = res.headTiles[0];
    for (const tx of res.headTiles) if (Math.abs(tx - cx) < Math.abs(best - cx)) best = tx;
    bumpBlock(best, res.headY);
  }
  if (player.onGround && Math.abs(player.vx) > 0.4) player.anim += Math.abs(player.vx) * 0.05;

  if (player.y > H * TILE + 60) die(true);
}

function updateEnemies() {
  for (const en of enemies) {
    if (en.dead) { en.deadT++; continue; }
    if (!en.active) { if (en.x < camX + VIEW_W + 96) en.active = true; else continue; }
    en.vx = en.dir * 0.8;
    const res = moveEntity(en);
    if (res.hitL) en.dir = 1; else if (res.hitR) en.dir = -1;
    if (en.onGround) {
      const aheadX = en.dir > 0 ? en.x + en.w + 1 : en.x - 1;
      const below = cellAt(Math.floor(aheadX / TILE), Math.floor((en.y + en.h + 2) / TILE));
      if (!isSolid(below)) en.dir *= -1;
    }
    en.t++;
    if (en.y > H * TILE + 80) { en.dead = true; en.deadT = 999; }
  }
  enemies = enemies.filter(e => !(e.dead && e.deadT > 26));
}

function collidePlayerEnemies() {
  for (const en of enemies) {
    if (en.dead || !en.active) continue;
    if (!overlap(player, en)) continue;
    if (player.vy > 0.5 && player.y + player.h - en.y < en.h * 0.65) {
      en.dead = true; en.deadT = 0;
      score += 200;
      SFX.stomp();
      player.vy = (keys.Space || keys.ArrowUp || keys.KeyW) ? -11.5 : -8.5;
      dust(en.x + en.w / 2, en.y + 6, '#9aa3b8');
    } else {
      die(false);
      return;
    }
  }
}

function updateCoins() {
  for (const c of coinsArr) {
    if (c.got) continue;
    if (Math.abs(player.x + player.w / 2 - c.x) < 22 && Math.abs(player.y + player.h / 2 - c.y) < 26) {
      c.got = true; coinN++; score += 50;
      SFX.coin();
      for (let i = 0; i < 5; i++) parts.push({
        x: c.x, y: c.y, vx: (Math.random() * 2 - 1) * 2, vy: -Math.random() * 3,
        t: 0, life: 24, color: '#ffd23e', s: 3,
      });
    }
  }
}

function die(fell) {
  if (state !== 'play') return;
  state = 'dying'; deathT = 0;
  SFX.hurt();
  player.vx = 0;
  player.vy = fell ? -2 : -10;
}

function update() {
  gFrame++;
  // décor et timers toujours animés
  for (const l of leaves) {
    l.p += 0.03;
    l.x -= l.v + Math.sin(l.p) * 0.5;
    l.y += 0.35 + Math.cos(l.p * 0.7) * 0.3;
    if (l.x < -10) l.x = VIEW_W + 10;
    if (l.y > VIEW_H + 10) l.y = -10;
  }
  for (const [k, v] of bumps) { if (v <= 1) bumps.delete(k); else bumps.set(k, v - 1); }
  for (const p of pops) { p.vy += 0.4; p.y += p.vy; p.t++; }
  pops = pops.filter(p => p.t < 28);
  for (const p of parts) { p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.t++; }
  parts = parts.filter(p => p.t < p.life);
  for (const c of coinsArr) c.t++;
  if (shake > 0) shake--;

  if (state === 'play') {
    timeF++;
    updatePlayer();
    updateEnemies();
    updateCoins();
    collidePlayerEnemies();
    if (state === 'play' && player.x + player.w / 2 >= FLAG_X * TILE + 12) {
      state = 'win'; winT = 0;
      SFX.win();
    }
    const target = player.x + player.w / 2 - VIEW_W * 0.42;
    camX += (target - camX) * 0.12;
    camX = Math.max(0, Math.min(camX, W * TILE - VIEW_W));
  } else if (state === 'dying') {
    deathT++;
    player.vy = Math.min(player.vy + GRAV, MAX_FALL);
    player.y += player.vy;
    if (deathT > 50 && player.y > H * TILE + 240) {
      lives--;
      if (lives <= 0) { state = 'gameover'; SFX.over(); }
      else { rebuildLevel(); state = 'respawn'; respT = 70; }
    }
  } else if (state === 'respawn') {
    respT--;
    if (respT <= 0) state = 'play';
  } else if (state === 'win') {
    winT++;
  }
}

/* ---------------------------------------------------------------------
   RENDU
--------------------------------------------------------------------- */
function txt(s, x, y, size, color, align = 'left') {
  ctx.font = `bold ${size}px Consolas, "Courier New", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
function titleTxt(s, x, y, size, color) {
  ctx.font = `bold ${size}px Consolas, "Courier New", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(40,20,10,0.8)';
  ctx.fillText(s, x + 3, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, '#7ec4e8'); grd.addColorStop(0.7, '#cfe6d0'); grd.addColorStop(1, '#fdeec9');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // soleil
  ctx.fillStyle = 'rgba(255,238,170,0.35)'; ctx.beginPath(); ctx.arc(120, 80, 52, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,242,190,0.95)'; ctx.beginPath(); ctx.arc(120, 80, 36, 0, 7); ctx.fill();
  // nuages (parallaxe 0.25)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 9; i++) {
    const px = i * 320 + 60 - camX * 0.25, py = 56 + (i * 53) % 95;
    if (px < -120 || px > VIEW_W + 120) continue;
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, 7); ctx.arc(px + 22, py - 6, 14, 0, 7); ctx.arc(px + 42, py + 2, 16, 0, 7);
    ctx.fill();
  }
  // collines (parallaxe 0.45)
  for (let i = 0; i < 13; i++) {
    const px = i * 300 + 40 - camX * 0.45;
    if (px < -260 || px > VIEW_W + 260) continue;
    ctx.fillStyle = i % 2 ? '#e3bd7d' : '#d9a85f';
    ctx.beginPath(); ctx.arc(px, VIEW_H + 40, 130 + (i % 3) * 35, Math.PI, 0); ctx.fill();
  }
  // arbres (parallaxe 0.7)
  for (let i = 0; i < 26; i++) {
    const px = i * 190 + 50 - camX * 0.7;
    if (px < -60 || px > VIEW_W + 60 || i % 4 === 1) continue;
    const base = VIEW_H - 8, ht = 90 + (i * 37) % 50;
    ctx.fillStyle = '#7a4a28'; ctx.fillRect(px - 4, base - 26, 8, 26);
    ctx.fillStyle = i % 3 ? '#b06a32' : '#9c5b33';
    ctx.beginPath();
    ctx.moveTo(px, base - ht);
    ctx.lineTo(px - 34, base - 18);
    ctx.lineTo(px + 34, base - 18);
    ctx.closePath(); ctx.fill();
  }
}

function drawBall(x, y, t, r) {
  // baballe orange façon balle de tennis, couture qui roule
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#b35413'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#f08020'; ctx.beginPath(); ctx.arc(0, 0, r - 1.5, 0, 7); ctx.fill();
  ctx.rotate(t * 0.08);
  ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r - 4, 0.4, 2.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r - 4, 3.5, 5.5); ctx.stroke();
  ctx.restore();
}

function drawWorld() {
  // tuiles visibles
  const tx0 = Math.max(0, Math.floor(camX / TILE));
  const tx1 = Math.min(W - 1, tx0 + Math.ceil(VIEW_W / TILE) + 1);
  for (let ty = 0; ty < H; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = map[ty][tx];
      if (c === '.') continue;
      const b = bumps.get(tx + ',' + ty);
      const dy = b ? -Math.sin((8 - b) / 8 * Math.PI) * 7 : 0;
      const img = c === '#' ? (cellAt(tx, ty - 1) === '#' ? T.dirt : T.grass)
        : c === 'X' ? T.stone
        : c === 'B' ? T.brick
        : c === '?' ? T.q : T.used;
      ctx.drawImage(img, tx * TILE, ty * TILE + dy);
    }
  }
  // drapeau
  const fx = FLAG_X * TILE + 16;
  ctx.fillStyle = '#cfd6df'; ctx.fillRect(fx - 2, 4 * TILE, 4, 8 * TILE);
  ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.arc(fx, 4 * TILE - 4, 6, 0, 7); ctx.fill();
  const fy = 4 * TILE + 8 + (state === 'win' ? Math.min(winT * 3, 6.5 * TILE) : 0);
  ctx.fillStyle = '#d8434e';
  ctx.beginPath();
  ctx.moveTo(fx - 2, fy);
  ctx.lineTo(fx - 2, fy + 20);
  ctx.lineTo(fx - 28 + Math.sin(gFrame * 0.1) * 2, fy + 10);
  ctx.closePath(); ctx.fill();

  // baballes
  for (const c of coinsArr) if (!c.got) drawBall(c.x, c.y + Math.sin(c.t * 0.06) * 2, c.t, 9);
  for (const p of pops) drawBall(p.x, p.y, p.t * 3, 8);

  // ennemis
  for (const en of enemies) {
    const spr = en.dead ? S.catSquash : (Math.floor(en.t / 12) % 2 ? S.catA : S.catB);
    const dx = Math.round(en.x + en.w / 2), dyE = Math.round(en.y + en.h - 30);
    ctx.save();
    ctx.translate(dx, dyE + 16);
    ctx.scale(en.dir > 0 ? -1 : 1, 1);
    ctx.drawImage(spr, -16, -16);
    ctx.restore();
  }

  // joueuse : Nova
  let spr;
  if (!player.onGround || state === 'dying') spr = S.novaJump;
  else if (Math.abs(player.vx) > 0.4) spr = Math.floor(player.anim) % 2 ? S.novaRun : S.novaIdle;
  else spr = S.novaIdle;
  ctx.save();
  ctx.translate(Math.round(player.x + player.w / 2), Math.round(player.y + player.h - 14));
  ctx.scale(player.face, state === 'dying' ? -1 : 1);
  ctx.drawImage(spr, -16, -16);
  ctx.restore();

  // particules
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  ctx.globalAlpha = 1;
}

function drawLeaves() {
  ctx.globalAlpha = 0.8;
  for (const l of leaves) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.p);
    ctx.fillStyle = l.c;
    ctx.fillRect(-l.s / 2, -l.s / 3, l.s, l.s * 0.66);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  ctx.fillStyle = '#221c33'; ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = '#e98e3a'; ctx.fillRect(0, HUD_H - 3, VIEW_W, 3);
  txt('SCORE ' + String(score).padStart(6, '0'), 24, HUD_H / 2, 20, '#ffffff');
  drawBall(268, HUD_H / 2, gFrame, 9);
  txt('×' + coinN, 284, HUD_H / 2, 20, '#f08020');
  txt('TEMPS ' + String(Math.floor(timeF / 60)).padStart(3, '0'), 370, HUD_H / 2, 20, '#cfd6df');
  for (let i = 0; i < lives; i++) ctx.drawImage(S.novaIdle, 560 + i * 30, HUD_H / 2 - 12, 24, 24);
  if (!IS_TOUCH) txt('M musique · P pause · R rejouer', VIEW_W - 24, HUD_H / 2, 15, '#8d86a8', 'right');
}

function overlayBox(alpha) {
  ctx.fillStyle = `rgba(20,16,40,${alpha})`;
  ctx.fillRect(0, HUD_H, VIEW_W, VIEW_H);
}

function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(0, HUD_H);
  drawBackground();
  ctx.save();
  const shX = shake > 0 ? (Math.random() * 2 - 1) * 3 : 0;
  const shY = shake > 0 ? (Math.random() * 2 - 1) * 3 : 0;
  ctx.translate(-Math.round(camX) + shX, shY);
  drawWorld();
  ctx.restore();
  drawLeaves();
  ctx.restore();
  drawHUD();

  const cx = VIEW_W / 2, cy = HUD_H + VIEW_H / 2;
  if (state === 'title') {
    overlayBox(0.55);
    titleTxt('NOVA', cx, cy - 110, 64, '#f08020');
    titleTxt('Le chien des Collines de Valenciennes', cx, cy - 60, 24, '#ffe9c9');
    ctx.drawImage(S.novaIdle, cx - 130, cy - 20, 96, 96);
    ctx.drawImage(S.catA, cx + 40, cy + 12, 72, 72);
    if (IS_TOUCH) txt('◀ ▶ bouger    B courir    A sauter', cx, cy + 116, 19, '#ffffff', 'center');
    else txt('← → bouger    MAJ courir    ESPACE sauter', cx, cy + 116, 19, '#ffffff', 'center');
    txt('Saute sur les matous, attrape les baballes orange, file au drapeau !', cx, cy + 146, 16, '#cfd6df', 'center');
    if (Math.floor(gFrame / 30) % 2) txt(IS_TOUCH ? '— Touche l\'écran pour jouer —' : '— Appuie sur une touche —', cx, cy + 190, 20, '#ffd23e', 'center');
  } else if (state === 'pause') {
    overlayBox(0.45);
    titleTxt('PAUSE', cx, cy - 10, 48, '#ffffff');
    txt('P pour reprendre', cx, cy + 40, 18, '#cfd6df', 'center');
  } else if (state === 'respawn') {
    overlayBox(0.45);
    titleTxt('PRÊT ?', cx, cy - 16, 44, '#ffd23e');
    txt(`Vies restantes : ${lives}`, cx, cy + 34, 22, '#ffffff', 'center');
  } else if (state === 'win' && winT > 55) {
    overlayBox(0.55);
    titleTxt('NIVEAU TERMINÉ !', cx, cy - 80, 46, '#ffd23e');
    txt(`Score : ${score}`, cx, cy - 10, 24, '#ffffff', 'center');
    txt(`Baballes : ${coinN}`, cx, cy + 26, 24, '#f08020', 'center');
    txt(`Temps : ${Math.floor(timeF / 60)} s`, cx, cy + 62, 24, '#cfd6df', 'center');
    if (Math.floor(gFrame / 30) % 2) txt(IS_TOUCH ? 'Touche l\'écran pour rejouer' : 'R pour rejouer', cx, cy + 120, 20, '#ffffff', 'center');
  } else if (state === 'gameover') {
    overlayBox(0.6);
    titleTxt('GAME OVER', cx, cy - 40, 52, '#d8434e');
    txt(`Score : ${score}`, cx, cy + 20, 24, '#ffffff', 'center');
    if (Math.floor(gFrame / 30) % 2) txt(IS_TOUCH ? 'Touche l\'écran pour réessayer' : 'R pour réessayer', cx, cy + 70, 20, '#ffd23e', 'center');
  }
}

/* ---------------------------------------------------------------------
   BOUCLE PRINCIPALE — pas fixe 60 Hz
--------------------------------------------------------------------- */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
