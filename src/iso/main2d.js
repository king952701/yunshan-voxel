// 云山录 · 2.5D 山水长卷 —— 入口
// 8000x8000 的中式山水，45° 等距投影，最小像素格；可拖拽漫游、缩放、动土营建、持镐采矿。
import { Map2D, Scroll, WORLD } from './world2d.js';
import { View2D, ZOOM_MULTS } from './view2d.js';
import { renderFar, renderNear } from './render2d.js';
import { skyFilter, T } from './palette.js';
import {
  Terra, Inventory, startingKit, BUILD_MATS, bestPick, bestTool, STORE_SIZE,
} from './edit2d.js';
import { Veins, oreInfo, FX_TIME, BASE_TIME } from './veins.js';
import { Nodes, KINDS, kindInfo, NODE_CD } from './nodes.js';
import { Skills, SKILLS, gatherTime } from './skill.js';
import {
  ALL_RECIPES, CATEGORIES, CRAFT_CATS, SKILL_OF_CAT, canCraft, craft,
} from '../game/crafting.js';
import { itemName, itemColor, qualityOf, ITEMS, BRICK } from '../core/items.js';
import { createMenu } from './menu.js';
import { write, read, clearSave, saveInfo } from './save.js';
import { Survival, MAX_STAT } from './survival.js';

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
  vein: document.getElementById('vein'), hud: document.getElementById('hud'),
  store: document.getElementById('store'), storeBody: document.getElementById('store-body'),
  storeCap: document.getElementById('store-cap'),
  vitals: document.getElementById('vitals'),
};

const settings = { daySpeed: 1, showHint: true, showPlayer: true, showHud: true };
let menuApi = null;   // 设置菜单，末尾创建

const map = new Map2D(SEED);
const scroll = new Scroll(map);
const view = new View2D();
const terra = new Terra(map);
const veins = new Veins(map);
const nodes = new Nodes(map);
const skills = new Skills();
const surv = new Survival();   // 气血、饱食、渴饮
const inv = new Inventory();
const store = new Inventory(STORE_SIZE);   // 仓库一千格

// 存档句柄：地形、矿脉、采集点都是按种子确定性生成的，所以只存改动、格子与冷却
const saveState = {
  inv, store, skills, terra, veins, nodes, view, settings, surv,
  get mat() { return selMat; },
  setMat: (v) => { selMat = v; },
};
let saveDirty = false, saveT = 0;
function markSave() { saveDirty = true; }
function flushSave(force) {
  if (!force && !saveDirty) return false;
  saveT = 0;
  saveDirty = false;
  return write(saveState);
}
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

// ------------------------------------------------------------------ 触控
// 单指拖 = 漫游；双指张合 = 缩放；轻点 = 选中脚边那一格（真要动土按下方按钮）
const touchPts = new Map();
let pinchD = 0, tapT = 0, tapMove = 0, tapX = 0, tapY = 0;

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    touchPts.set(t.identifier, [t.clientX, t.clientY]);
    tapT = performance.now();
    tapMove = 0;
    tapX = t.clientX;
    tapY = t.clientY;
  } else if (e.touches.length === 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    pinchD = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    const p = touchPts.get(t.identifier);
    if (!p) return;
    const dx = t.clientX - p[0], dy = t.clientY - p[1];
    tapMove += Math.abs(dx) + Math.abs(dy);
    view.pan(dx * RS, dy * RS);
    touchPts.set(t.identifier, [t.clientX, t.clientY]);
    hover = view.near ? pickCell(t.clientX * RS, t.clientY * RS) : null;
  } else if (e.touches.length === 2) {
    const [a, b] = [e.touches[0], e.touches[1]];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinchD > 0) {
      const step = d > pinchD * 1.14 ? 1 : d < pinchD * 0.88 ? -1 : 0;
      if (step) {
        view.zoomAt(step, (a.clientX + b.clientX) / 2 * RS, (a.clientY + b.clientY) / 2 * RS);
        pinchD = d;
      }
    } else {
      pinchD = d;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (e.touches.length > 0) return;
  if (tapMove < 10 && performance.now() - tapT < 320) {
    hover = view.near ? pickCell(tapX * RS, tapY * RS) : null;
    if (view.near && hover) say(`选中 ${hover[0]}, ${hover[1]}　按下方「掘土/垒材」动土`);
    else if (!view.near) say('双指张开放大到近景，才好动土');
  }
  touchPts.clear();
  pinchD = 0;
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') { if (menuApi) menuApi.toggle(); return; }
  if (menuApi && menuApi.isOpen()) return;   // 菜单开着时不响应游戏按键
  keys[e.code] = true;
  if (e.code === 'KeyE') startGather();
  if (e.code === 'KeyF') eatOrDrink();
  if (e.code === 'KeyC') toggleCraft();
  if (e.code === 'KeyB') toggleStore();
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
  markSave();   // 有过动作就记一笔，八秒后落盘
}

// ------------------------------------------------------------------ 采集
const ACT = {
  mining: '开采', logging: '伐木', herbal: '采药',
  fishing: '垂钓', hunting: '狩猎', digging: '掘土', foraging: '拾取',
};
const TOOL_CN = {
  pickaxe: '矿镐', axe: '斧', shovel: '铲', sickle: '镰', sword: '兵器', rod: '钓竿',
};
const SKILL_CN = Object.fromEntries(SKILLS.map((s) => [s.key, s.name]));

/** 脚边有什么可采：矿脉与地表采集点取更近的那个 */
function targetAt(wx, wy, r = 2) {
  const p = veins.nearest(wx, wy, r);
  const n = nodes.nearest(wx, wy, r);
  if (!p) return n ? { kind: 'node', p: n } : null;
  if (!n) return { kind: 'vein', p };
  const dp = Math.abs(p.wx - wx) + Math.abs(p.wy - wy);
  const dn = Math.abs(n.wx - wx) + Math.abs(n.wy - wy);
  return dn < dp ? { kind: 'node', p: n } : { kind: 'vein', p };
}

/** 用哪门技能、哪件家伙、采得什么 */
function targetMeta(t) {
  if (t.kind === 'vein') {
    const info = oreInfo(t.p.ore);
    return {
      skill: 'mining', tool: 'pickaxe', tier: info.tier, exp: info.exp,
      name: info.name, out: { id: t.p.ore, count: info.count },
    };
  }
  const k = kindInfo(t.p.kind);
  const loot = t.p.loot;
  const q = qualityOf(loot.id).tier;
  return {
    skill: k.skill, tool: k.tool, tier: 0, exp: 8 + q * 4,
    name: itemName(loot.id), out: loot,
  };
}

function startGather() {
  if (gather) return;
  if (!view.near) { say('放大到近景才看得见采集点'); return; }
  const c = view.center();
  const t = targetAt(c[0], c[1], 2);
  if (!t) { say('脚边没有可采的东西'); return; }
  const m = targetMeta(t);
  let speed = 0;
  if (m.tool) {
    const tool = bestTool(inv, m.tool);
    if (!tool) { say(`须持${TOOL_CN[m.tool]}（百工谱里可合成）`); return; }
    if (tool.tier < m.tier) { say(`${m.name}太硬，${itemName(tool.id)}啃不动`); return; }
    speed = tool.speed;
  }
  gather = { kind: t.kind, node: t.p, t: 0, dur: gatherTime(skills, m.skill, speed) };
  say(`${ACT[m.skill]}${m.name}…`);
}

function tickGather(dt) {
  if (!gather) return;
  const c = view.center();
  const p = gather.node;
  if (Math.abs(c[0] - p.wx) + Math.abs(c[1] - p.wy) > 2) {
    gather = null;
    say('走开了，采集中断');
    return;
  }
  gather.t += dt;
  if (gather.t < gather.dur) return;
  const m = targetMeta({ kind: gather.kind, p });
  if (gather.kind === 'vein') veins.mine(p);
  else nodes.take(p);
  const got = inv.add(m.out.id, m.out.count);
  let msg = got ? `${m.name}×${got}` : `${m.name}带不下了`;
  const up = skills.gain(m.skill, m.exp);
  if (up) msg += `　${SKILL_CN[m.skill]}升至 ${skills.level(m.skill)} 级`;
  if (m.out.extra) {
    const g2 = inv.add(m.out.extra.id, m.out.extra.count);
    if (g2) msg += `　另得${itemName(m.out.extra.id)}×${g2}`;
  }
  say(msg);
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
    const q = qualityOf(it.id);
    d.innerHTML = `<i style="background:${itemColor(it.id)}"></i>`
      + `<span>${itemName(it.id)}`
      + `<em style="color:${q.color};font-style:normal;font-size:10px"> ${q.name}</em></span>`
      + `<b>${it.count}</b>`;
    d.onclick = () => {
      if (BUILD_MATS.includes(it.id)) { selMat = it.id; say(`选中${itemName(it.id)}`); renderBag(); }
      else say(`${itemName(it.id)}不是建材`);
    };
    el.bag.appendChild(d);
  }
  const cap = document.createElement('div');
  cap.className = 'note';
  cap.style.cssText = 'padding:4px 2px';
  cap.textContent = `${inv.used()} / ${inv.size} 格 · 按 B 开仓库（${store.used()}/${store.size}）`;
  el.bag.appendChild(cap);
  el.mat.textContent = itemName(selMat);
  el.mat.style.color = itemColor(selMat);
}

// ------------------------------------------------------------------ 生存
/** 脚下或四邻有水，可以捧起来喝 */
function nearWater() {
  const [wx, wy] = view.center();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const t = terra.type(wx + dx, wy + dy);
      if (t === T.WATER || t === T.DEEP) return true;
    }
  }
  return false;
}

/** 附近有没有野兽（入夜会扑人） */
function nearestBeast(wx, wy, r = 6) {
  let best = null, bd = r * r;
  for (const p of nodes.inRect(wx - r, wy - r, wx + r, wy + r)) {
    if (p.kind !== 'beast') continue;
    const d = (p.wx - wx) * (p.wx - wx) + (p.wy - wy) * (p.wy - wy);
    if (d <= bd) { bd = d; best = p; }
  }
  return best;
}

/** F 键：先救命、再解渴、再充饥；渴了又在水边就直接捧水喝 */
function eatOrDrink() {
  if (surv.water < 85 && nearWater()) {
    const n = surv.drink();
    say(n ? `捧起水喝了几口，渴饮 +${n}` : '已经喝不下了');
    renderBag();
    return;
  }
  const r = surv.auto(inv);
  if (!r) {
    say(nearWater()
      ? '还不饿也不渴（真要解渴就再按一次 F）'
      : '行囊里没有能吃喝的：钓鱼、打猎、拾野果，或走到水边捧水喝');
    return;
  }
  const verb = r.kind === 'hp' ? '敷' : r.kind === 'water' ? '饮' : '吃';
  const label = r.kind === 'hp' ? '气血' : r.kind === 'water' ? '渴饮' : '饱食';
  say(`${verb}下${r.name}，${label} +${r.v}`);
  renderBag();
}

/** 力竭倒下：在自家门口醒来，行囊掉一半 */
function collapseAtHome() {
  const lost = surv.collapse(inv);
  view.lookAt(0, 0);
  renderBag();
  say(lost.length
    ? `力竭倒下……在自家门口醒来，掉了 ${lost.slice(0, 3).join('、')}${lost.length > 3 ? ' 等' : ''}`
    : '力竭倒下……在自家门口醒来，身上没多少东西可掉');
}

// ------------------------------------------------------------------ 仓库
let storeOpen = false;

function renderStore() {
  el.storeCap.textContent = `行囊 ${inv.used()}/${inv.size} 格　仓库 ${store.used()}/${store.size} 格`;
  el.storeBody.innerHTML = '';
  const head = (t) => {
    const h = document.createElement('div');
    h.className = 'note';
    h.style.cssText = 'margin:6px 0 2px';
    h.textContent = t;
    el.storeBody.appendChild(h);
  };
  const rows = (from, to, label) => {
    const items = from.list().slice(0, 40);
    if (!items.length) {
      const e = document.createElement('div');
      e.className = 'note';
      e.textContent = '（空）';
      el.storeBody.appendChild(e);
      return;
    }
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cursor = 'pointer';
      row.innerHTML = `<div class="out"><i style="background:${itemColor(it.id)}"></i>`
        + `${itemName(it.id)}×${it.count}</div>`
        + `<div class="tip">${label}</div>`;
      row.onclick = () => {
        const n = from.moveTo(to, it.id);
        say(n ? `${label} ${itemName(it.id)}×${n}` : '腾不出地方了');
        renderBag();
        renderStore();
      };
      el.storeBody.appendChild(row);
    }
  };
  head('行囊 —— 点一条存入仓库');
  rows(inv, store, '存入');
  head('仓库 —— 点一条取回行囊');
  rows(store, inv, '取出');
  const bar = document.createElement('div');
  bar.className = 'btns';
  bar.style.cssText = 'display:flex;gap:6px;padding:8px 0 2px';
  const mk = (label, fn) => {

    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    return b;
  };
  let total = 0;
  bar.appendChild(mk('全部存入', () => {
    for (const it of inv.list()) total += inv.moveTo(store, it.id);
    say(total ? `存入 ${total} 件` : '腾不出地方了');
    renderBag(); renderStore();
  }));
  bar.appendChild(mk('全部取出', () => {
    for (const it of store.list()) total += store.moveTo(inv, it.id);
    say(total ? `取出 ${total} 件` : '行囊装不下了');
    renderBag(); renderStore();
  }));
  el.storeBody.appendChild(bar);
}

function toggleCraft() {
  craftOpen = !craftOpen;
  el.craft.style.display = craftOpen ? 'block' : 'none';
  if (craftOpen) { storeOpen = false; el.store.style.display = 'none'; renderCraft(); }
}

function toggleStore() {
  storeOpen = !storeOpen;
  el.store.style.display = storeOpen ? 'block' : 'none';
  if (storeOpen) { craftOpen = false; el.craft.style.display = 'none'; renderStore(); }
}

const CRAFT_PAGE = 40;
let craftPage = 0;
let craftQ = '';

// 搜索框只建一次，免得每次重绘都丢焦点
const craftSearch = document.createElement('input');
craftSearch.className = 'craft-search';
craftSearch.placeholder = '搜配方（如 玄铁剑、丹、符）';
craftSearch.oninput = () => { craftQ = craftSearch.value; craftPage = 0; renderCraft(); };
el.tabs.after(craftSearch);

function renderCraft() {
  el.tabs.innerHTML = '';
  for (const c of CRAFT_CATS) {
    const b = document.createElement('button');
    b.textContent = c.label;
    b.className = c.key === craftCat ? 'on' : '';
    b.onclick = () => { craftCat = c.key; craftPage = 0; renderCraft(); };
    el.tabs.appendChild(b);
  }
  const baseCats = new Set(CATEGORIES.map((c) => c.key));
  let list = ALL_RECIPES.filter((r) => (craftCat === 'base' ? baseCats.has(r.cat) : r.cat === craftCat));
  if (craftQ.trim()) {
    const q = craftQ.trim();
    list = list.filter((r) => itemName(r.out.id).includes(q));
  }
  const pages = Math.max(1, Math.ceil(list.length / CRAFT_PAGE));
  craftPage = Math.max(0, Math.min(pages - 1, craftPage));
  el.craftBody.innerHTML = '';
  for (const r of list.slice(craftPage * CRAFT_PAGE, craftPage * CRAFT_PAGE + CRAFT_PAGE)) {
    const okc = canCraft(inv, r);
    const qq = qualityOf(r.out.id);
    const row = document.createElement('div');
    row.className = 'row' + (okc ? '' : ' off');
    const need = Object.entries(r.in)
      .map(([id, n]) => `${itemName(Number(id))}×${n}`).join('　');
    row.innerHTML = `<div class="out"><i style="background:${itemColor(r.out.id)}"></i>`
      + `${itemName(r.out.id)}`
      + `<em style="color:${qq.color};font-style:normal;font-size:10px"> ${qq.name}</em>`
      + `×${r.out.count}</div>`
      + `<div class="in">${need}</div>`
      + (r.tip ? `<div class="tip">${r.tip}</div>` : '');
    row.onclick = () => {
      if (!craft(inv, r)) { say('材料不够'); return; }
      let msg = `合成${itemName(r.out.id)}×${r.out.count}`;
      const k = SKILL_OF_CAT[r.cat];
      if (k) {
        const up = skills.gain(k, 10 + (ITEMS[r.out.id].q || 1) * 4);
        if (up) msg += `　${SKILL_CN[k]}升至 ${skills.level(k)} 级`;
      }
      say(msg);
      renderBag();
      renderCraft();
    };
    el.craftBody.appendChild(row);
  }
  if (pages > 1) {
    const bar = document.createElement('div');
    bar.className = 'btns';
    bar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 0 2px';
    const mk = (label, on) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = on;
      return b;
    };
    bar.appendChild(mk('上一页', () => { craftPage = Math.max(0, craftPage - 1); renderCraft(); }));
    const info = document.createElement('span');
    info.className = 'note';
    info.textContent = `第 ${craftPage + 1} / ${pages} 页　共 ${list.length} 式`;
    bar.appendChild(info);
    bar.appendChild(mk('下一页', () => { craftPage = Math.min(pages - 1, craftPage + 1); renderCraft(); }));
    el.craftBody.appendChild(bar);
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
    // 灵矿自带一层微光，隔着老远也能认出来
    if (info.q >= 8) {
      diamond(s[0], s[1], view.tw, view.th, 1.15);
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = css(info.color, 1.1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
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

/** 地表采集点：树画树冠、钓点画涟漪、兽画身形，一眼能分 */
function drawNodes(c) {
  const R = 40;
  const list = nodes.inRect(c[0] - R, c[1] - R, c[0] + R, c[1] + R);
  for (const p of list) {
    const k = kindInfo(p.kind);
    const s = screenOf(p.wx, p.wy, 1);
    ctx.fillStyle = k.color;
    if (p.kind === 'tree') {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1] - 10);
      ctx.lineTo(s[0] - 5, s[1] - 1);
      ctx.lineTo(s[0] + 5, s[1] - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(s[0] - 1, s[1] - 2, 2, 3);
    } else if (p.kind === 'fish') {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(s[0], s[1], 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.kind === 'beast') {
      ctx.fillRect(s[0] - 4, s[1] - 6, 8, 4);
      ctx.fillRect(s[0] - 4, s[1] - 2, 2, 3);
      ctx.fillRect(s[0] + 2, s[1] - 2, 2, 3);
    } else if (p.kind === 'soil') {
      ctx.beginPath();
      ctx.ellipse(s[0], s[1], 5, 2.5, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(s[0], s[1] - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
    const m = targetMeta({ kind: gather.kind, p });
    ctx.fillText(`${ACT[m.skill]} ${m.name} ${Math.max(0, gather.dur - gather.t).toFixed(1)}s`, s[0], y - 4);
  } else if (settings.showHint) {
    const t = targetAt(c[0], c[1], 2);
    if (t) {
      const m = targetMeta(t);
      const s = screenOf(c[0], c[1], 2);
      ctx.fillStyle = 'rgba(12,16,22,.8)';
      const label = `[E] ${ACT[m.skill]} ${m.name}`;
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

  time = (time + dt * (settings.daySpeed || 0) / DAY_SEC) % 1;
  handleKeys(dt);
  tickGather(dt);
  if (veins.tick(dt) > 0) say('矿脉复生');
  nodes.tick(dt);

  // 生存：饥渴跟着昼夜走，把昼夜调成静止，饥渴也就停了
  const dayFrac = dt * (settings.daySpeed || 0) / DAY_SEC;
  if (dayFrac > 0) {
    surv.tick(dayFrac);
    for (const w of surv.warnings()) say(w);
  }
  if (view.near) {
    const c0 = view.center();
    const beast = nearestBeast(c0[0], c0[1], 6);
    const sword = bestTool(inv, 'sword');
    const raid = surv.tickRaid(dt, {
      isNight: skyOf().dayF < 0.28,
      beastName: beast ? '野兽' : null,
      weaponName: sword ? itemName(sword.id) : null,
    });
    if (raid) say(raid.msg);
  }
  if (surv.hp <= 0) collapseAtHome();
  if (toastLeft > 0) toastLeft -= dt;

  saveT += dt;
  if (saveDirty && saveT > 8) flushSave();

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
    drawNodes(c);
    if (settings.showPlayer) drawPlayer(c);
    drawGather(c);
  }

  const sky = skyOf();
  canvas.style.filter = skyFilter(sky.dayF, sky.dawn);

  el.hud.style.display = settings.showHud ? 'block' : 'none';
  el.coord.textContent = `${c[0]}, ${c[1]}`;
  el.zoom.textContent = view.near
    ? `近景 · 每格 ${view.tw.toFixed(1)}px`
    : `长卷 · ${ZOOM_MULTS[view.zi]}×`;
  el.clock.textContent = clockString();
  el.perf.textContent = `${Math.round(fps)} FPS`;
  el.vitals.textContent = `气血 ${Math.round(surv.hp)} · 饱食 ${Math.round(surv.food)}`
    + ` · 渴饮 ${Math.round(surv.water)} · ${surv.status()}`;
  el.vitals.style.color = (surv.hp <= 25 || surv.food <= 15 || surv.water <= 15) ? '#ff8a6a'
    : (surv.hp < 60 || surv.food < 35 || surv.water < 35) ? '#e8c07a' : '#c6d0db';
  if (!scroll.done) {
    el.prog.textContent = `绘制山水长卷 ${Math.round(scroll.row / scroll.h * 100)}%`;
    el.prog.style.display = 'block';
  } else {
    el.prog.style.display = 'none';
  }
  el.seed.textContent = String(SEED);
  const near = view.near ? targetAt(c[0], c[1], 2) : null;
  if (near) {
    const m = targetMeta(near);
    const tool = m.tool ? bestTool(inv, m.tool) : null;
    el.pick.textContent = m.tool ? (tool ? itemName(tool.id) : `缺${TOOL_CN[m.tool]}`) : '徒手即可';
    el.skill.textContent = `${SKILL_CN[m.skill]} ${skills.level(m.skill)} 级 ${skills.exp(m.skill)}/${skills.needNext(m.skill)}`;
    el.vein.textContent = `脚边有${m.name}`;
  } else {
    const pick = bestPick(inv);
    el.pick.textContent = pick ? itemName(pick.id) : '空手';
    el.skill.textContent = `采矿 ${skills.level('mining')} 级 ${skills.exp('mining')}/${skills.needNext('mining')}`;
    el.vein.textContent = view.near ? '近处无可采' : '—';
  }
  if (toastLeft > 0) {
    el.toast.textContent = toastText;
    el.toast.style.display = 'block';
  } else {
    el.toast.style.display = 'none';
  }

  requestAnimationFrame(frame);
}

resize();

// 有档接着玩，没档才发开局行囊
if (read(saveState)) {
  const info = saveInfo();
  say(info
    ? `读档：接着上次的山水（${info.items} 格物品、${info.digs} 处动土）`
    : '读档：接着上次的山水');
} else {
  view.lookAt(0, 0);
  startingKit(inv);
  say('新开一卷山水：拖动漫游，滚轮放大到近景才好动土');
}
renderBag();
requestAnimationFrame(frame);

// 切后台与关页面时务必落盘：手机上随时会被系统收走
window.addEventListener('beforeunload', () => flushSave(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(true); });

// 设置菜单：设置 / 帮助（内置数据库）/ 关于
menuApi = createMenu({
  skills,
  settings,
  onSetting: () => { markSave(); },
  onResetTerrain: () => {
    const n = terra.reset();
    if (n) { scroll.repaint(); say(`复原 ${n} 处动土，山水回到最初`); }
    else say('还没有动过土');
  },
  onSave: () => { say(flushSave(true) ? '已存档' : '这台设备不让存档'); },
  onLoad: () => {
    if (read(saveState)) { renderBag(); say('读档：回到上次存档的地方'); }
    else say('还没有存档');
  },
  onClear: () => {
    clearSave();
    terra.reset();
    scroll.repaint();
    inv.slots.fill(null);
    store.slots.fill(null);
    for (const k of Object.keys(skills.lv)) { skills.lv[k] = 1; skills.xp[k] = 0; }
    surv.hp = MAX_STAT; surv.food = MAX_STAT; surv.water = MAX_STAT;
    startingKit(inv);
    view.lookAt(0, 0);
    renderBag();
    say('清档重开：一切回到最初');
  },
  saveInfo,
});
document.getElementById('gear').onclick = () => menuApi.toggle();

// 手机上的一排动作按钮（触屏没有右键与快捷键）
const touchBar = document.getElementById('touch');
if (touchBar) {
  for (const b of touchBar.querySelectorAll('button')) {
    b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'dig') act('dig');
      else if (a === 'place') act('place');
      else if (a === 'gather') startGather();
      else if (a === 'eat') eatOrDrink();
      else if (a === 'craft') toggleCraft();
      else if (a === 'store') toggleStore();
      else if (a === 'menu') menuApi.toggle();
    };
  }
}

// 控制台与自动化用的句柄：window.__iso.view.lookAt(x, y) 之类
window.__iso = {
  map, view, veins, nodes, terra, inv, skills, scroll, settings, menu: () => menuApi,
  gather: () => gather,
};
