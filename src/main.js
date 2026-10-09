// 云山录 · 体素江湖 —— 入口：装配渲染、世界、玩家、生存与 UI
import * as THREE from 'three';
import { World, createMaterials } from './world/world.js';
import {
  buildAtlas, BLOCKS, ITEMS, AIR, WATER, PLANK, itemName,
} from './world/blocks.js';
import { CHUNK, SEA, HEIGHT, surfaceHeight } from './world/generator.js';
import { Player } from './game/player.js';
import { Inventory, HOTBAR } from './game/inventory.js';
import { RECIPES, craft, STICK } from './game/crafting.js';
import { Survival } from './game/survival.js';
import { Enemies } from './game/enemies.js';
import { Hud, bindInventory } from './ui/hud.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 20261010) | 0;
const SAVE_KEY = 'yunshan_v1_state';

// ------------------------------------------------------------------ 渲染
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 420);
scene.fog = new THREE.FogExp2(0xd8c9a8, 0.011);
scene.background = new THREE.Color(0xd8c9a8);

const sun = new THREE.DirectionalLight(0xffd9a0, 1.3);
sun.position.set(120, 90, 60);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x4a5a3a, 0.55);
scene.add(hemi);
// 随身微光（内息微光）：夜里有月光的底子，脚边不至于伸手不见五指
const lantern = new THREE.PointLight(0xffcf8a, 0, 11, 1.8);
scene.add(lantern);

let pixelScale = 2; // 2 = 半分辨率渲染 + 放大，得到像素颗粒感
function resize() {
  const w = Math.max(320, window.innerWidth), h = Math.max(240, window.innerHeight);
  renderer.setPixelRatio(1);
  renderer.setSize(Math.floor(w / pixelScale), Math.floor(h / pixelScale), false);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ 世界
const atlas = buildAtlas();
const world = new World(scene, SEED, createMaterials(atlas));
const player = new Player(world, camera);
const inv = new Inventory();
bindInventory(inv);
const survival = new Survival();
const enemies = new Enemies(scene, world);
const hud = new Hud((i) => {
  const r = RECIPES[i];
  if (craft(inv, r)) {
    hud.updateCraftAvailability(inv);
    hud.renderInventory(inv);
    hud.toast(`合成 ${itemName(r.out.id)} ×${r.out.count}`);
  } else {
    hud.toast('材料不足');
  }
});

// 高亮方块框
const hlGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
const hl = new THREE.LineSegments(hlGeo, new THREE.LineBasicMaterial({ color: 0x101418 }));
hl.visible = false;
scene.add(hl);

// ------------------------------------------------------------------ 存档
let spawn = { x: 0.5, y: 70, z: 0.5 };

/** 在出生点附近挑一处「有起伏、看得见山」的落脚地 */
function findSpawn() {
  let best = null, bestScore = -1e9;
  for (let r = 0; r <= 144; r += 16) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
      const h = Math.round(surfaceHeight(x, z, SEED));
      if (h <= SEA + 2 || h > HEIGHT - 26) continue;
      const hs = [
        surfaceHeight(x + 22, z, SEED), surfaceHeight(x - 22, z, SEED),
        surfaceHeight(x, z + 22, SEED), surfaceHeight(x, z - 22, SEED),
      ];
      const vari = Math.max(...hs) - Math.min(...hs);
      const score = Math.min(vari, 14) * 2 - Math.abs(h - (SEA + 8));
      if (score > bestScore) { bestScore = score; best = { x: x + 0.5, y: h + 1, z: z + 0.5 }; }
    }
  }
  if (best) {
    world.ensureData(Math.floor(best.x / CHUNK), Math.floor(best.z / CHUNK));
    const y = world.spawnY(Math.floor(best.x), Math.floor(best.z));
    if (y !== null) best.y = y;
  }
  return best || { x: 0.5, y: SEA + 14, z: 0.5 };
}

function save() {
  const data = {
    x: player.pos.x, y: player.pos.y, z: player.pos.z,
    hp: player.hp, hunger: player.hunger, armor: player.armor,
    time: survival.time, day: survival.day,
    yaw: player.yaw, pitch: player.pitch,
    inv: inv.serialize(), seed: SEED,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
  world.saveEdits();
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (d.seed !== SEED) return false;
    player.pos.set(d.x, d.y, d.z);
    player.hp = d.hp; player.hunger = d.hunger; player.armor = d.armor || 0;
    player.yaw = d.yaw || 0; player.pitch = d.pitch || -0.15;
    survival.time = d.time; survival.day = d.day || 1;
    inv.deserialize(d.inv);
    spawn = { x: d.x, y: d.y, z: d.z };
    return true;
  } catch (e) { return false; }
}

// ------------------------------------------------------------------ 输入
const input = { forward: false, back: false, left: false, right: false, jump: false, crouch: false, sprint: false };
const mouse = { left: false, right: false };
let panel = null;
let started = false;
let attackCool = 0;
let placeCool = 0;

const KEYMAP = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch',
  ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { if (panel) setPanel(null); return; }
  const m = KEYMAP[e.code];
  if (m) { input[m] = true; e.preventDefault(); return; }
  switch (e.code) {
    case 'KeyE': setPanel(panel === 'inv' ? null : 'inv'); break;
    case 'KeyC': setPanel(panel === 'craft' ? null : 'craft'); break;
    case 'KeyH': hud.toggleHelp(); break;
    case 'KeyF': player.fly = !player.fly; hud.toast(player.fly ? '御风而行（开）' : '御风而行（关）'); break;
    case 'KeyP':
      pixelScale = pixelScale === 1 ? 2 : pixelScale === 2 ? 3 : 1;
      resize(); hud.toast(`像素档位 1/${pixelScale}`); break;
    case 'KeyR': if (player.dead) respawn(); break;
    default:
      if (/^Digit[1-9]$/.test(e.code)) inv.selected = Number(e.code.slice(5)) - 1;
  }
});
window.addEventListener('keyup', (e) => {
  const m = KEYMAP[e.code];
  if (m) input[m] = false;
});
window.addEventListener('blur', () => {
  for (const k in input) input[k] = false;
  mouse.left = mouse.right = false;
});

canvas.addEventListener('mousedown', (e) => {
  if (!started || panel) return;
  if (e.button === 0) { mouse.left = true; tryAttack(); }
  if (e.button === 2) { mouse.right = true; tryUse(); }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => {
  if (!started || panel) return;
  inv.scroll(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && !panel) {
    player.look(e.movementX || 0, e.movementY || 0);
  }
});

function lock() {
  // 浏览器在无用户手势 / 冷却期内会拒绝，忽略即可
  try { canvas.requestPointerLock(); } catch (e) { /* 忽略 */ }
}

function startGame() {
  started = true;
  hud.showStart(false);
  lock();
}

// 开始遮罩盖在画布之上，必须直接在遮罩上接收点击
hud.el.start.addEventListener('click', startGame);
canvas.addEventListener('click', () => {
  if (!started) { startGame(); return; }
  if (!panel && document.pointerLockElement !== canvas) lock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && started && !panel) {
    mouse.left = mouse.right = false;
  }
});

function setPanel(name) {
  panel = name;
  hud.setPanel(name);
  if (name) {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  } else if (started) {
    lock();
  }
}

function respawn() {
  player.respawn(spawn.x, spawn.y, spawn.z);
  hud.showDead(false);
  enemies.clear();
  if (started) lock();
}

// ------------------------------------------------------------------ 交互
function toolSpeedFor(block) {
  const def = BLOCKS[block];
  const t = inv.tool();
  let s = t ? t.speed : 1;
  if (def && def.needTool) {
    if (!t || t.kind !== def.needTool) s *= 0.34; // 工具不对，慢且不掉料
  }
  return s;
}

function dropFor(block) {
  const def = BLOCKS[block];
  if (!def) return null;
  if (def.needTool) {
    const t = inv.tool();
    if (!t || t.kind !== def.needTool) return null;
  }
  return def.drop || null;
}

function tryAttack() {
  if (attackCool > 0) return;
  const t = inv.tool();
  const dmg = t && t.damage ? t.damage : 3;
  const r = enemies.attack(player.eye(), player.dir(), 3.4, dmg, (e) => {
    inv.add(104, 1); // 生肉
    hud.toast('野兽倒下，取得生肉');
  });
  attackCool = 0.42;
  if (r) return true;
  return false;
}

function tryUse() {
  const s = inv.held();
  if (!s) return;
  const it = ITEMS[s.id];
  // 吃食物
  if (it && it.food) {
    if (survival.eat(player, s.id)) {
      inv.consumeHeld(1);
      hud.toast(`食用 ${itemName(s.id)}`);
      hud.renderInventory(inv);
    }
    return;
  }
  // 敷药（不占饱食，直接回气）
  if (it && it.heal && !it.food) {
    if (player.hp >= 100) { hud.toast('气血已满'); return; }
    player.hp = Math.min(100, player.hp + it.heal);
    inv.consumeHeld(1);
    hud.toast(`敷用 ${itemName(s.id)}，回气 ${it.heal}`);
    hud.renderInventory(inv);
    return;
  }
  // 穿护甲
  if (it && it.armor) {
    player.armor = it.armor;
    inv.consumeHeld(1);
    hud.toast(`披挂 ${itemName(s.id)}，减伤 ${it.armor}`);
    hud.renderInventory(inv);
    return;
  }
  // 放置方块
  if (placeCool > 0) return;
  const id = s.id;
  if (id >= 100 || !BLOCKS[id] || id === AIR) return;
  const hit = world.raycast(player.eye().x, player.eye().y, player.eye().z,
    player.dir().x, player.dir().y, player.dir().z, 6);
  if (!hit) return;
  const bx = hit.x + hit.nx, by = hit.y + hit.ny, bz = hit.z + hit.nz;
  if (by < 1 || by >= HEIGHT) return;
  const target = world.getBlock(bx, by, bz);
  if (target !== AIR && target !== WATER) return;
  // 不能卡住自己
  const p = player.pos;
  if (p.x + 0.32 > bx && p.x - 0.32 < bx + 1 && p.y + 1.8 > by && p.y < by + 1 &&
    p.z + 0.32 > bz && p.z - 0.32 < bz + 1) {
    hud.toast('此处放不下');
    return;
  }
  if (world.setBlock(bx, by, bz, id)) {
    inv.consumeHeld(1);
    hud.renderInventory(inv);
    placeCool = 0.18;
  }
}

const dig = { key: null, progress: 0 };

function updateDig(dt) {
  if (!mouse.left || panel) { dig.key = null; dig.progress = 0; hud.setBreak(0); hl.visible = false; return; }
  const eye = player.eye(), d = player.dir();
  const hit = world.raycast(eye.x, eye.y, eye.z, d.x, d.y, d.z, 5.5);
  if (!hit) { dig.key = null; dig.progress = 0; hud.setBreak(0); hl.visible = false; return; }
  hl.visible = true;
  hl.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

  const key = `${hit.x},${hit.y},${hit.z}`;
  if (key !== dig.key) { dig.key = key; dig.progress = 0; }
  const def = BLOCKS[hit.block];
  const hard = def ? def.hard : 1;
  dig.progress += (dt * toolSpeedFor(hit.block)) / Math.max(0.05, hard);
  hud.setBreak(Math.min(1, dig.progress));
  hl.material.color.setHSL(0.13 - 0.13 * Math.min(1, dig.progress), 0.7, 0.25 + 0.35 * dig.progress);

  if (dig.progress >= 1) {
    dig.progress = 0;
    dig.key = null;
    world.setBlock(hit.x, hit.y, hit.z, AIR);
    const drop = dropFor(hit.block);
    if (drop) {
      const n = inv.add(drop, 1);
      if (n === 0) hud.toast('行囊已满');
      else hud.toast(`获得 ${itemName(drop)}`);
      hud.renderInventory(inv);
    }
  }
}

// ------------------------------------------------------------------ 天光
const SKY_DAY = new THREE.Color(0xbcd9ea);
const SKY_DAWN = new THREE.Color(0xf0c389);
const SKY_NIGHT = new THREE.Color(0x1a2742);
const tmpColor = new THREE.Color();

function updateSky() {
  const a = (survival.time - 0.25) * Math.PI * 2;
  const dayF = Math.max(0, Math.sin(a));
  sun.position.set(Math.cos(a) * 160, Math.sin(a) * 160, 70);
  // 夜里留一层月光底子，否则天色一暗全屏纯黑，路都看不清
  sun.intensity = 0.24 + dayF * 1.12;
  // 太阳越低越暖（晨昏暖金）
  const warm = 1 - Math.min(1, Math.abs(Math.sin(a)) * 2.0);
  sun.color.setRGB(1, 0.92 - warm * 0.22, 0.78 - warm * 0.42);
  hemi.intensity = 0.38 + dayF * 0.42;
  hemi.color.setRGB(0.55 + dayF * 0.35, 0.65 + dayF * 0.25, 0.85 - warm * 0.15);

  if (dayF > 0.02) {
    tmpColor.copy(SKY_DAWN).lerp(SKY_DAY, Math.min(1, dayF * 1.8));
  } else {
    tmpColor.copy(SKY_NIGHT);
  }
  scene.background.copy(tmpColor);
  scene.fog.color.copy(tmpColor);
  scene.fog.density = 0.009 + (1 - dayF) * 0.005;

  // 随身微光跟着视线走，夜里照出脚前几格
  lantern.position.copy(camera.position);
  lantern.intensity = (1 - dayF) * 0.9;

  // 水下视角
  const headBlock = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 1.2), Math.floor(player.pos.z));
  if (headBlock === WATER) {
    scene.fog.color.setRGB(0.16, 0.38, 0.55);
    scene.fog.density = 0.16;
  }
}

// ------------------------------------------------------------------ 主循环
let last = performance.now();
let fpsAcc = 0, fpsCount = 0, fps = 60, adaptTimer = 0;
let radius = 6;
let saveTimer = 0;

function frame(now) {
  const dt = Math.min(0.06, (now - last) / 1000);
  last = now;
  fpsAcc += 1 / Math.max(0.0001, dt); fpsCount++;
  adaptTimer += dt; saveTimer += dt;
  if (adaptTimer > 1) {
    fps = fpsAcc / fpsCount; fpsAcc = 0; fpsCount = 0; adaptTimer = 0;
    if (fps < 38 && radius > 4) radius--;
    else if (fps > 55 && radius < 8) radius++;
  }
  if (saveTimer > 15) { saveTimer = 0; save(); }

  attackCool = Math.max(0, attackCool - dt);
  placeCool = Math.max(0, placeCool - dt);

  if (!panel && !player.dead) {
    player.update(dt, input);
    updateDig(dt);
  } else if (player.dead) {
    player.applyCamera();
  }

  const moving = Math.hypot(player.vel.x, player.vel.z) > 0.6;
  if (!player.dead) survival.update(dt, player, moving);

  world.update(player.pos.x, player.pos.z, radius, 7);

  enemies.update(dt, player, survival.isNight(), () => inv.add(104, 1));

  if (player.dead && !hud.el.dead.classList.contains('show')) {
    hud.showDead(true);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }
  if (!player.dead && hud.el.dead.classList.contains('show')) hud.showDead(false);

  updateSky();
  hud.updateStats(player, survival, fps, enemies.list.length);
  hud.renderHotbar(inv);
  if (panel === 'craft') hud.updateCraftAvailability(inv);
  if (panel === 'inv') hud.renderInventory(inv);
  hud.tick(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ 启动
resize();
hud.buildHotbar();
hud.renderHotbar(inv);
hud.renderInventory(inv);

if (!load()) {
  spawn = findSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  inv.add(PLANK, 8);
  inv.add(STICK, 4);
  hud.toast('点击画面开始');
}
world.preload(player.pos.x, player.pos.z, 3);
// 确保脚下有地
if (!world.isSolid(Math.floor(player.pos.x), Math.floor(player.pos.y) - 1, Math.floor(player.pos.z))) {
  const y = world.spawnY(Math.floor(player.pos.x), Math.floor(player.pos.z));
  if (y) { player.pos.y = y; spawn.y = y; }
}
player.applyCamera();
updateSky();
window.addEventListener('beforeunload', save);
requestAnimationFrame(frame);
