// 云山录 · 2.5D 山水长卷 —— 入口
// 8000x8000 的中式山水，45° 等距投影，最小像素格；可拖拽漫游、缩放、动土营建。
import { Map2D, Scroll, WORLD } from './world2d.js';
import { View2D, ZOOM_MULTS } from './view2d.js';
import { renderFar, renderNear } from './render2d.js';
import { skyFilter } from './palette.js';
import { Terra, Inventory, startingKit, BUILD_MATS } from './edit2d.js';
import { RECIPES, CATEGORIES, canCraft, craft } from '../game/crafting.js';
import { itemName, itemColor, BRICK } from '../core/items.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 20261010) | 0;
const RS = 0.75;        // 渲染倍率：低于 1 得到更大的像素颗粒
const DAY_SEC = 360;    // 一昼夜 6 分钟

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d', { alpha: false });
const el = {
  coord: document.getElementById('coord'), zoom: document.getElementById('zoom'),
  clock: document.getElementById('clock'), perf: document.getElementById('perf'),
  prog: document.getElementById('prog'), seed: document.getElementById('seed'),
  bag: document.getElementById('bag'), mat: document.getElementById('mat'),
  toast: document.getElementById('toast'), craft: document.getElementById('craft'),
  craftBody: document.getElementById('craft-body'), tabs: document.getElementById('tabs'),
};

const map = new Map2D(SEED);
const scroll = new Scroll(map);
const view = new View2D();
const terra = new Terra(map);
const inv = new Inventory();
startingKit(inv);
let selMat = BRICK;
let img = null;
let hover = null;
let toastText = '', toastLeft = 0;
let craftOpen = false;
let craftCat = 'mat';

function resize() {
  const w = Math.max(320, window.innerWidth), h = Math.max(240, window.innerHeight);
  const cw = Math.floor(w * RS), ch = Math.floor(h * RS);
  canvas.width = cw;
  canvas.height = ch;
  view.w = cw;
  view.h = ch;
  img = ctx.createImageData(cw, ch);
  view.clampCam();
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ 交互
let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, moved = 0;
const keys = Object.create(null);

canvas.addEventListener('mousedown', (e) => {
  dragging = true; moved = 0;
  lastX = downX = e.clientX; lastY = downY = e.clientY;
});
window.addEventListener('mouseup', (e) => {
  if (dragging && moved < 5 && e.target === canvas) {
    act(e.button === 2 ? 'place' : 'dig');
  }
  dragging = false;
});
window.addEventListener('mousemove', (e) => {
  const mx = e.clientX * RS, my = e.clientY * RS;
  hover = view.near ? pickCell(mx, my) : null;
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  moved += Math.abs(dx) + Math.abs(dy);
  view.pan(dx * RS, dy * RS);
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX * RS, e.clientY * RS);
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyC') { craftOpen = !craftOpen; el.craft.style.display = craftOpen ? 'block' : 'none'; if (craftOpen) renderCraft(); }
  if (e.code === 'KeyR') view.lookAt(0, 0);
  const n = e.code.match(/^Digit([1-9])$/);
  if (n) {
    const m = BUILD_MATS[Number(n[1]) - 1];
    if (m != null) { selMat = m; say(`选中${itemName(m)}`); renderBag(); }
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

/** 屏幕像素 -> 世界格（高度会让格子上下偏移，迭代几轮逼近） */
function pickCell(sx, sy) {
  let h = 28, wx = 0, wy = 0;
  for (let i = 0; i < 4; i++) {
    const [px, py] = view.toProj(sx, sy);
    const u = 2 * px / view.tw;
    const v = (py + (h - 28) * view.th * view.hz) / (view.th / 2);
    wx = Math.round((u + v) / 2);
    wy = Math.round((v - u) / 2);
    h = terra.height(wx, wy);
  }
  return [wx, wy];
}

function act(kind) {
  if (!view.near) { say('滚轮放大到近景才好动土'); return; }
  if (!hover) return;
  const [wx, wy] = hover;
  const r = kind === 'dig' ? terra.dig(wx, wy, inv) : terra.place(wx, wy, selMat, inv);
  if (r.ok) scroll.patch(wx, wy, terra);
  say(r.msg);
  renderBag();
  if (craftOpen) renderCraft();
}

function say(msg) {
  toastText = msg;
  toastLeft = 2.2;
}

// ------------------------------------------------------------------ 面板
function renderBag() {
  const items = inv.list();
  el.bag.innerHTML = '';
  if (!items.length) {
    el.bag.innerHTML = '<div class="empty">空空如也，先挖两下</div>';
  }
  for (const it of items) {
    const d = document.createElement('div');
    d.className = 'slot' + (it.id === selMat ? ' on' : '');
    d.innerHTML = `<i style="background:${itemColor(it.id)}"></i>`
      + `<span>${itemName(it.id)}</span><b>${it.count}</b>`;
    d.onclick = () => {
      if (BUILD_MATS.includes(it.id)) { selMat = it.id; say(`选中${itemName(it.id)}`); renderBag(); }
      else say(`${itemName(it.id)}不是建材`);
    };
    el.bag.appendChild(d);
  }
  el.mat.textContent = itemName(selMat);
  el.mat.style.color = itemColor(selMat);
}

function renderCraft() {
  el.tabs.innerHTML = '';
  for (const c of CATEGORIES) {
    const b = document.createElement('button');
    b.textContent = c.label;
    b.className = c.key === craftCat ? 'on' : '';
    b.onclick = () => { craftCat = c.key; renderCraft(); };
    el.tabs.appendChild(b);
  }
  el.craftBody.innerHTML = '';
  const list = RECIPES.filter((r) => r.cat === craftCat);
  for (const r of list) {
    const okc = canCraft(inv, r);
    const row = document.createElement('div');
    row.className = 'row' + (okc ? '' : ' off');
    const need = Object.entries(r.in)
      .map(([id, n]) => `${itemName(Number(id))}×${n}`).join('　');
    row.innerHTML = `<div class="out"><i style="background:${itemColor(r.out.id)}"></i>`
      + `${itemName(r.out.id)}×${r.out.count}</div>`
      + `<div class="in">${need}</div>`
      + `<div class="tip">${r.tip}</div>`;
    row.onclick = () => {
      if (craft(inv, r)) { say(`合成${itemName(r.out.id)}×${r.out.count}`); renderBag(); renderCraft(); }
      else say('材料不够');
    };
    el.craftBody.appendChild(row);
  }
}

function handleKeys(dt) {
  const step = 900 * dt / Math.max(0.35, view.tw * 4);
  let dx = 0, dy = 0;
  if (keys.KeyW || keys.ArrowUp) { dx -= 1; dy -= 1; }
  if (keys.KeyS || keys.ArrowDown) { dx += 1; dy += 1; }
  if (keys.KeyA || keys.ArrowLeft) { dx -= 1; dy += 1; }
  if (keys.KeyD || keys.ArrowRight) { dx += 1; dy -= 1; }
  if (dx || dy) {
    const k = step * view.tw / 2;
    view.camPX += dx * k;
    view.camPY += dy * k * 0.5;
    view.clampCam();
  }
}

// ------------------------------------------------------------------ 天光
let time = 0.30;
function skyOf() {
  const a = (time - 0.25) * Math.PI * 2;
  const dayF = Math.max(0, Math.sin(a));
  const dawn = 1 - Math.min(1, Math.abs(Math.sin(a)) * 2.2);
  return { dayF, dawn: Math.max(0, dawn) * (dayF > 0.02 ? 1 : 0) };
}
function clockString() {
  const t = ((time + 0.25) % 1) * 24;
  const hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ 主循环
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fps = 60, tAcc = 0;

function frame(now) {
  const dt = Math.min(0.08, (now - last) / 1000);
  last = now;
  fpsAcc += 1 / Math.max(1e-4, dt); fpsN++; tAcc += dt;
  if (tAcc > 0.5) { fps = fpsAcc / fpsN; fpsAcc = 0; fpsN = 0; tAcc = 0; }

  time = (time + dt / DAY_SEC) % 1;
  handleKeys(dt);
  if (toastLeft > 0) toastLeft -= dt;

  if (!scroll.done) scroll.step(12);

  if (view.near) renderNear(img, terra, view);
  else renderFar(img, scroll, view);
  ctx.putImageData(img, 0, 0);

  // 指向的格子描一圈金边，点下去才知道落在哪
  if (view.near && hover) {
    const p = view.projOf(hover[0], hover[1], terra.height(hover[0], hover[1]));
    const s = view.toScreen(p[0], p[1]);
    const hw = view.tw / 2, hh = view.th / 2;
    ctx.strokeStyle = '#ffd88a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s[0] - hw, s[1]);
    ctx.lineTo(s[0], s[1] - hh);
    ctx.lineTo(s[0] + hw, s[1]);
    ctx.lineTo(s[0], s[1] + hh);
    ctx.closePath();
    ctx.stroke();
  }

  const sky = skyOf();
  canvas.style.filter = skyFilter(sky.dayF, sky.dawn);

  const c = view.center();
  el.coord.textContent = `${c[0]}, ${c[1]}`;
  el.zoom.textContent = view.near
    ? `近景 · 每格 ${view.tw.toFixed(1)}px`
    : `长卷 · ${ZOOM_MULTS[view.zi]}×`;
  el.clock.textContent = clockString();
  el.perf.textContent = `${Math.round(fps)} FPS`;
  if (!scroll.done) {
    el.prog.textContent = `绘制山水长卷 ${Math.round(scroll.row / scroll.h * 100)}%`;
    el.prog.style.display = 'block';
  } else {
    el.prog.style.display = 'none';
  }
  el.seed.textContent = String(SEED);
  if (toastLeft > 0) {
    el.toast.textContent = toastText;
    el.toast.style.display = 'block';
  } else {
    el.toast.style.display = 'none';
  }

  requestAnimationFrame(frame);
}

resize();
view.lookAt(0, 0);
renderBag();
requestAnimationFrame(frame);
