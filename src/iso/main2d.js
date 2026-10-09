// 云山录 · 2.5D 山水长卷 —— 入口
// 8000x8000 的中式山水，45° 等距投影，最小像素格，可拖拽漫游、滚轮缩放。
import { Map2D, Scroll, WORLD } from './world2d.js';
import { View2D, ZOOM_MULTS } from './view2d.js';
import { renderFar, renderNear } from './render2d.js';
import { skyFilter } from './palette.js';

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
};

const map = new Map2D(SEED);
const scroll = new Scroll(map);
const view = new View2D();
let img = null;

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

// ------------------------------------------------------------------ 输入
let dragging = false, lastX = 0, lastY = 0;
const keys = Object.create(null);

canvas.addEventListener('mousedown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  view.pan((e.clientX - lastX) * RS, (e.clientY - lastY) * RS);
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX * RS, e.clientY * RS);
}, { passive: false });

window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

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

  if (!scroll.done) scroll.step(12);

  if (view.near) renderNear(img, map, view);
  else renderFar(img, scroll, view);
  ctx.putImageData(img, 0, 0);

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

  requestAnimationFrame(frame);
}

resize();
view.lookAt(0, 0);
requestAnimationFrame(frame);
