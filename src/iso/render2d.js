// 两级渲染：远景走像素长卷（最小像素格），近景逐格画立体块与崖壁
import { WORLD } from './world2d.js';
import { surfaceRGB, T } from './palette.js';
import { blockBaseColor } from '../core/items.js';

const PAPER = [232, 226, 210]; // 未绘制区域的宣纸底色

/** 远景：直接采样长卷像素，保持最小像素格的颗粒感 */
export function renderFar(img, scroll, view) {
  const w = view.w, h = view.h;
  const data = img.data;
  const sw = scroll.w, sh = scroll.h;
  const rgb = scroll.rgb;
  const tw = view.tw;
  const drawnRows = scroll.row;
  const iw = 1 / (2 * WORLD);
  for (let y = 0; y < h; y++) {
    const py = view.camPY + y - h / 2;
    const v = 4 * py / tw;
    const qy = (v + WORLD) * iw * sh;
    let rowBase = y * w * 4;
    for (let x = 0; x < w; x++) {
      const px = view.camPX + x - w / 2;
      const u = 2 * px / tw;
      const qx = (u + WORLD) * iw * sw;
      let r, g, b;
      if (qx < 0 || qx >= sw || qy < 0 || qy >= sh) {
        r = PAPER[0]; g = PAPER[1]; b = PAPER[2];
      } else {
        const iy = qy | 0;
        if (iy >= drawnRows) { r = PAPER[0]; g = PAPER[1]; b = PAPER[2]; }
        else {
          const i = (iy * sw + (qx | 0)) * 3;
          r = rgb[i]; g = rgb[i + 1]; b = rgb[i + 2];
        }
      }
      const o = rowBase + x * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
}

/** 近景：逐格绘制等距块（顶面 + 南侧崖壁），从北往南覆盖 */
export function renderNear(img, terra, view) {
  const w = view.w, h = view.h;
  const data = img.data;
  data.fill(0);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  // 底色：宣纸
  for (let i = 0; i < data.length; i += 4) {
    data[i] = PAPER[0]; data[i + 1] = PAPER[1]; data[i + 2] = PAPER[2];
  }

  const tw = view.tw, th = view.th;
  const hz = view.hz;
  // 视口覆盖的 (u,v) 范围
  const p0 = view.toProj(0, 0);
  const p1 = view.toProj(w, h);
  const uMin = Math.floor(2 * p0[0] / tw) - 2, uMax = Math.ceil(2 * p1[0] / tw) + 2;
  const vMin = Math.floor(4 * p0[1] / tw) - 4, vMax = Math.ceil(4 * p1[1] / tw) + 8;

  for (let v = vMin; v <= vMax; v++) {
    for (let u = uMin; u <= uMax; u++) {
      // u = wx - wy, v = wx + wy —— 只取同奇偶的组合才是整格
      if (((u + v) & 1) !== 0) continue;
      const wx = (u + v) / 2, wy = (v - u) / 2;
      if (wx < -WORLD / 2 || wx >= WORLD / 2 || wy < -WORLD / 2 || wy >= WORLD / 2) continue;
      const hgt = terra.height(wx, wy);
      const t = terra.type(wx, wy);
      const m = terra.mat(wx, wy);
      const p = view.projOf(wx, wy, hgt);
      const sx = p[0] - view.camPX + w / 2;
      const sy = p[1] - view.camPY + h / 2;
      if (sx < -tw || sx > w + tw || sy < -th * 4 || sy > h + th * 4) continue;

      // 崖壁：与南侧邻格的落差（挖出的坑、堆起的台基都会露出来）
      const hf = terra.height(wx + 1, wy + 1);
      const drop = hgt - hf;
      const jit = ((wx * 31 + wy * 17) % 97) / 48 - 1;
      // 光照：西北来光
      const hn = terra.height(wx - 1, wy - 1);
      let light = 1 + Math.max(-0.34, Math.min(0.34, (hgt - hn) * 0.09));
      if (t === T.DEEP) light = 0.82;
      const c = m ? matRGB(m, light) : surfaceRGB(t, light, jit);

      if (drop > 0) {
        const wallH = drop * th * hz;
        fillRect(data, w, h, sx - tw / 2, sy, tw, wallH,
          [c[0] * 0.62, c[1] * 0.62, c[2] * 0.66]);
      }
      fillDiamond(data, w, h, sx, sy, tw, th, c);
    }
  }
}

/** 建材按它自己的代表色上色 */
function matRGB(id, light) {
  const b = blockBaseColor(id);
  return [
    Math.min(255, ((b >> 16) & 255) * light),
    Math.min(255, ((b >> 8) & 255) * light),
    Math.min(255, (b & 255) * light),
  ];
}

function fillDiamond(data, w, h, cx, cy, tw, th, c) {
  const halfW = tw / 2, halfH = th / 2;
  const y0 = Math.max(0, Math.round(cy - halfH));
  const y1 = Math.min(h - 1, Math.round(cy + halfH - 1));
  for (let y = y0; y <= y1; y++) {
    const dy = Math.abs((y + 0.5) - cy) / halfH;
    if (dy > 1) continue;
    const rowW = halfW * (1 - dy);
    const x0 = Math.max(0, Math.round(cx - rowW));
    const x1 = Math.min(w - 1, Math.round(cx + rowW - 1));
    let o = (y * w + x0) * 4;
    for (let x = x0; x <= x1; x++) {
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
      o += 4;
    }
  }
}

function fillRect(data, w, h, x0, y0, rw, rh, c) {
  const xa = Math.max(0, Math.round(x0));
  const xb = Math.min(w - 1, Math.round(x0 + rw - 1));
  const ya = Math.max(0, Math.round(y0));
  const yb = Math.min(h - 1, Math.round(y0 + rh - 1));
  for (let y = ya; y <= yb; y++) {
    let o = (y * w + xa) * 4;
    for (let x = xa; x <= xb; x++) {
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
      o += 4;
    }
  }
}
