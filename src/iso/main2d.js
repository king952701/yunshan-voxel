// 云山录 · 2.5D 山水长卷 —— 入口
// 8000x8000 的中式山水，45° 等距投影，最小像素格；可拖拽漫游、缩放、动土营建、持镐采矿。
import { Map2D, Scroll, WORLD } from './world2d.js';
import { View2D, ZOOM_MULTS } from './view2d.js';
import { renderFar, renderNear } from './render2d.js';
import { skyFilter } from './palette.js';
import {
  Terra, Inventory, startingKit, BUILD_MATS, bestPick,
} from './edit2d.js';
import { Veins, oreInfo, FX_TIME, BASE_TIME } from './veins.js';
import { Skills, gatherTime } from './skill.js';
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
  skill: document.getElementById('skill'), pick: document.getElementById('pick'),
  vein: document.getElementById('vein'),
};

const map = new Map2D(SEED);
const scroll = new Scroll(map);
const view = new View2D();
const terra = new Terra(map);
const veins = new Veins(map);
const skills = new Skills();
const inv = new Inventory();
startingKit(inv);
let selMat = BRICK;
let img = null;
let hover = null;
let gather = null;      // 正在进行的采集
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
let dragging = false, lastX = 0, lastY = 0, moved = 0;
const keys = Object.create(null);

canvas.addEventListener('mousedown', (e) => {
  dragging = true; moved = 0;
  lastX = e.clientX; lastY = e.clientY;
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
  if (e.code === 'KeyE') startGather();
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

// ------------------------------------------------------------------ 采矿
function startGather() {
  if (gather) return;
  if (!view.near) { say('放大到近景才看得见矿脉'); return; }
  const c = view.center();
  const p = veins.nearest(c[0], c[1], 2);
  if (!p) { say('脚边没有可采的矿脉'); return; }
  const pick = bestPick(inv);
  if (!pick) { say('须持矿镐（百工谱里可合成）'); return; }
  const info = oreInfo(p.ore);
  if (pick.tier < info.tier) { say(`${info.name}太硬，${itemName(pick.id)}啃不动`); return; }
  gather = { node: p, t: 0, dur: gatherTime(skills, 'mining', pick.speed) };
  say(`开采${info.name}…`);
}

function tickGather(dt) {
  if (!gather) return;
  const c = view.center();
  if (Math.abs(c[0] - gather.node.wx) + Math.abs(c[1] - gather.node.wy) > 2) {
    gather = null;
    say('走开了，采集中断');
    return;
  }
  gather.t += dt;
  if (gather.t < gather.dur) return;
  const info = oreInfo(gather.node.ore);
  veins.mine(gather.node);
  const got = inv.add(gather.node.ore, info.count);
  const up = skills.gain('mining', info.exp);
  say(got
    ? `${info.name}×${got}` + (up ? `　采矿升至 ${skills.level('mining')} 级` : '')
    : `${itemName(gather.node.ore)}带不下了`);
  gather = null;
  renderBag();
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

// ------------------------------------------------------------------ 叠加绘制
function css(hex, light) {
  const r = Math.min(255, ((hex >> 16) & 255) * light);
  const g = Math.min(255, ((hex >> 8) & 255) * light);
  const b = Math.min(255, (hex & 255) * light);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function diamond(sx, sy, tw, th, k) {
  ctx.beginPath();
  ctx.moveTo(sx, sy - th * k / 2);
  ctx.lineTo(sx + tw * k / 2, sy);
  ctx.lineTo(sx, sy + th * k / 2);
  ctx.lineTo(sx - tw * k / 2, sy);
  ctx.closePath();
}

function screenOf(wx, wy, lift) {
  const h = terra.height(wx, wy) + lift;
  const p = view.projOf(wx, wy, h);
  return view.toScreen(p[0], p[1]);
}

/** 矿脉露头与采空后的下沉动画 */
function drawVeins(c) {
  const R = Math.ceil(Math.max(view.w / view.tw, view.h / (view.th || 1))) + 6;
  const list = veins.inRect(c[0] - R, c[1] - R, c[0] + R, c[1] + R);
  for (const p of list) {
    if (p.cd > 0) continue;
    const s = screenOf(p.wx, p.wy, 1);
    const info = oreInfo(p.ore);
    diamond(s[0], s[1], view.tw, view.th, 0.62);
    ctx.fillStyle = css(info.color, 1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 一点高光，让矿石看着发亮
    diamond(s[0] - view.tw * 0.06, s[1] - view.th * 0.1, view.tw, view.th, 0.22);
    ctx.fillStyle = css(info.color, 1.5);
    ctx.fill();
  }
  for (const f of veins.fx) {
    const k = Math.max(0, f.t / FX_TIME);
    const s = screenOf(f.wx, f.wy, 1);
    const info = oreInfo(f.ore);
    ctx.globalAlpha = k;
    diamond(s[0], s[1] + (1 - k) * view.th * 1.8, view.tw, view.th, 0.62 * (0.4 + 0.6 * k));
    ctx.fillStyle = css(info.color, 0.6 + 0.4 * k);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** 旅人：就在视野中心那一格 */
function drawPlayer(c) {
  const s = screenOf(c[0], c[1], 1);
  ctx.fillStyle = '#2b2f38';
  ctx.fillRect(s[0] - 1, s[1] - 7, 3, 6);
  ctx.beginPath();
  ctx.ellipse(s[0], s[1] - 7, 4.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c07a';
  ctx.fillRect(s[0] - 3, s[1] - 8, 7, 1);
}

function drawGather(c) {
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  if (gather) {
    const p = gather.node;
    const s = screenOf(p.wx, p.wy, 1);
    const w = 68, hh = 7, x = s[0] - w / 2, y = s[1] - 26;
    ctx.fillStyle = 'rgba(12,16,22,.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, hh + 2);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(x, y, w, hh);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(x, y, w * Math.min(1, gather.t / gather.dur), hh);
    ctx.fillStyle = '#f2e9dc';
    ctx.fillText(`采 ${oreInfo(p.ore).name} ${Math.max(0, gather.dur - gather.t).toFixed(1)}s`, s[0], y - 4);
  } else {
    const p = veins.nearest(c[0], c[1], 2);
    if (p) {
      const s = screenOf(c[0], c[1], 2);
      ctx.fillStyle = 'rgba(12,16,22,.8)';
      const label = `[E] 采 ${oreInfo(p.ore).name}`;
      const w = ctx.measureText(label).width + 10;
      ctx.fillRect(s[0] - w / 2, s[1] - 26, w, 14);
      ctx.fillStyle = '#f2c14e';
      ctx.fillText(label, s[0], s[1] - 16);
    }
  }
  ctx.textAlign = 'left';
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
  tickGather(dt);
  if (veins.tick(dt) > 0) say('矿脉复生');
  if (toastLeft > 0) toastLeft -= dt;

  if (!scroll.done) scroll.step(12);

  if (view.near) renderNear(img, terra, view);
  else renderFar(img, scroll, view);
  ctx.putImageData(img, 0, 0);

  const c = view.center();
  if (view.near) {
    // 指向的格子描一圈金边，点下去才知道落在哪
    if (hover) {
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
    drawVeins(c);
    drawPlayer(c);
    drawGather(c);
  }

  const sky = skyOf();
  canvas.style.filter = skyFilter(sky.dayF, sky.dawn);

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
  const pick = bestPick(inv);
  el.pick.textContent = pick ? itemName(pick.id) : '空手';
  el.skill.textContent = `采矿 ${skills.level('mining')} 级 ${skills.exp('mining')}/${skills.needNext('mining')}`;
  const near = view.near ? veins.nearest(c[0], c[1], 2) : null;
  el.vein.textContent = near ? `脚边有${oreInfo(near.ore).name}` : (view.near ? '近处无矿' : '—');
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

// 控制台与自动化用的句柄：window.__iso.view.lookAt(x, y) 之类
window.__iso = { map, view, veins, terra, inv, skills, scroll, gather: () => gather };
