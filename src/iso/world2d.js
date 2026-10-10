// 中式山水：高度与地表都是 (坐标 + 种子) 的纯函数，
// 按需分块生成并缓存，绝不预先展开几亿格。
// 图幅与地貌分区读 core/biome.js：四块 8000×8000 的不规则大区。
import { surfaceHeight, riverFactor, streamFactor, lakeFactor } from '../core/terrain.js';
import { fbm2, clamp } from '../core/noise.js';
import { SEA, SNOW_LINE, T, surfaceRGB } from './palette.js';
import { blockBaseColor } from '../core/items.js';
import { WORLD, HALF, S, biomeParams, SNOW, PINE, DESERT, LOESS } from '../core/biome.js';

export { WORLD, HALF };
const CH = 64;              // 区块边长（格）
const MAX_CHUNKS = 1200;    // 缓存上限，超出按生成顺序淘汰

export class Map2D {
  constructor(seed) {
    this.seed = seed;
    this.cache = new Map();
    this.order = [];
  }

  inWorld(wx, wy) {
    return wx >= -HALF && wx < HALF && wy >= -HALF && wy < HALF;
  }

  chunkOf(cx, cy) {
    const k = cx + ',' + cy;
    const hit = this.cache.get(k);
    if (hit) return hit;
    const c = this.genChunk(cx, cy);
    this.cache.set(k, c);
    this.order.push(k);
    if (this.order.length > MAX_CHUNKS) this.cache.delete(this.order.shift());
    return c;
  }

  genChunk(cx, cy) {
    const n = CH * CH;
    const h = new Int16Array(n);
    const t = new Uint8Array(n);
    const ox = cx * CH, oy = cy * CH;
    // 先铺高度：每格只调一次地形函数，坡度留给下一轮用邻格算
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        h[y * CH + x] = clamp(Math.round(surfaceHeight(ox + x, oy + y, this.seed)), 3, 92);
      }
    }
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const i = y * CH + x;
        const h0 = h[i];
        const hx = x + 1 < CH ? h[i + 1] : h0;
        const hy = y + 1 < CH ? h[i + CH] : h0;
        t[i] = classify(ox + x, oy + y, h0, Math.abs(hx - h0) + Math.abs(hy - h0), this.seed);
      }
    }
    return { h, t };
  }

  height(wx, wy) {
    if (!this.inWorld(wx, wy)) return SEA - 6;
    const cx = Math.floor(wx / CH), cy = Math.floor(wy / CH);
    const c = this.chunkOf(cx, cy);
    return c.h[(wy - cy * CH) * CH + (wx - cx * CH)];
  }

  type(wx, wy) {
    if (!this.inWorld(wx, wy)) return T.DEEP;
    const cx = Math.floor(wx / CH), cy = Math.floor(wy / CH);
    const c = this.chunkOf(cx, cy);
    return c.t[(wy - cy * CH) * CH + (wx - cx * CH)];
  }
}

/**
 * 地表分类：先按高度定水陆，再按所在地貌定植被。
 * 同一片植被噪声，雪原、松林、草原、沙漠、黄土的门槛各不相同，
 * 所以五块地方各有各的长相，而不是一张绿图刷到底。
 */
export function classify(wx, wy, h, slope, seed) {
  if (h <= SEA - 3) return T.DEEP;
  if (h <= SEA) return T.WATER;
  const p = biomeParams(wx, wy, seed);
  const b = p.biome;
  if (h <= SEA + 2) return p.sand > 0.5 ? T.DUNE : T.SAND;   // 水边滩地
  if (h >= SNOW_LINE + p.snowLine) return T.SNOW;
  // 这套地形整体平缓（相邻高差常在 1 格以内），崖壁阈值按实测坡度标定；黄土多沟壑，更容易露崖
  if (slope > (b === LOESS ? 2.6 : 1.8)) return T.ROCK;
  if (riverFactor(wx, wy, seed) > 0.05 || streamFactor(wx, wy, seed) > 0.10) return T.BANK;
  const veg = fbm2(wx / (300 * S), wy / (300 * S), seed + 313, 2);
  const cover = veg * (0.5 + p.tree);
  if (b === PINE) return cover > 0.34 ? T.PINE : cover > 0.26 ? T.FOREST : T.GRASS;
  if (b === SNOW) return cover > 0.50 ? T.PINE : T.SNOW;
  if (b === DESERT) {
    if (lakeFactor(wx, wy, seed) > 0.15) return T.GRASS;     // 绿洲
    return cover > 0.38 ? T.SHRUB : T.DUNE;                   // 沙生灌木
  }
  if (b === LOESS) return cover > 0.34 ? T.GRASS : cover > 0.24 ? T.SHRUB : T.LOESS;
  // 草原：也是块与块之间的过渡带
  if (cover > 0.44) return T.FOREST;
  const bamboo = fbm2(wx / (190 * S), wy / (190 * S), seed + 6161, 2);
  if (bamboo > 0.635 && p.wet > 0.6) return T.BAMBOO;
  return cover > 0.36 ? T.SHRUB : T.GRASS;
}

// ------------------------------------------------------------------ 长卷
/**
 * 把整幅山水按 45° 等距投影压成一张像素长卷（最小像素格）。
 * 逐行分帧生成，先出上卷、逐渐向下展开，避免长时间白屏。
 */
export const OUTSIDE = 255;   // 图幅之外：留宣纸白边，像画卷的天地头

export class Scroll {
  constructor(map, w = 1600, h = 800) {
    this.map = map;
    this.seed = map.seed;
    this.w = w;
    this.h = h;
    this.hg = new Int16Array(w * h);
    this.tg = new Uint8Array(w * h);
    this.rgb = new Uint8Array(w * h * 3);
    this.row = 0;
    this.done = false;
  }

  /** 生成若干行（budget 行），返回是否已完成 */
  step(budget) {
    if (this.done) return true;
    const { w, h } = this;
    const end = Math.min(h, this.row + budget);
    for (let py = this.row; py < end; py++) {
      const v = ((py + 0.5) / h) * 2 * WORLD - WORLD;
      for (let px = 0; px < w; px++) {
        const u = ((px + 0.5) / w) * 2 * WORLD - WORLD;
        const wx = Math.round((u + v) / 2);
        const wy = Math.round((v - u) / 2);
        const i = py * w + px;
        if (!this.map.inWorld(wx, wy)) {
          this.hg[i] = SEA - 6;
          this.tg[i] = OUTSIDE;
          continue;
        }
        // 直采单格：长卷要扫过全图，走区块缓存会把 15625 个区块全建出来
        const hh = clamp(Math.round(surfaceHeight(wx, wy, this.seed)), 3, 92);
        this.hg[i] = hh;
        this.tg[i] = classify(wx, wy, hh, 0, this.seed);
      }
    }
    this.row = end;
    if (this.row >= h) {
      this.shade();
      this.done = true;
    }
    return this.done;
  }

  /** 整卷重画（复原地形时用）：一次性跑完，会顿一下 */
  repaint() {
    this.row = 0;
    this.done = false;
    while (!this.done) this.step(200);
  }

  /** 坡度光影：光从西北（屏幕上方）来，山脊受光、背坡压暗 */
  shade(terra) {
    const n = this.w * this.h;
    for (let i = 0; i < n; i++) this.shadePixel(i, terra);
  }

  /**
   * 给单个长卷像素上色。terra 提供改动后的地形，
   * 玩家垒的建材按建材自己的颜色画，这样动土也能反映到长卷上。
   */
  shadePixel(i, terra) {
    const { w, hg, tg, rgb } = this;
    const px = i % w, py = (i / w) | 0;
    let t = tg[i];
    if (t === OUTSIDE) {
      rgb[i * 3] = 232; rgb[i * 3 + 1] = 226; rgb[i * 3 + 2] = 210;
      return;
    }
    const h0 = hg[i];
    const up = py > 0 ? hg[i - w] : h0;
    const left = px > 0 ? hg[i - 1] : h0;
    // 长卷是逐像素直采的，坡度改由相邻像素的高度差补判
    // 长卷一个像素约跨 10 格，落差超过 3 就当作崖壁
    if (t !== T.SNOW && Math.abs(h0 - up) + Math.abs(h0 - left) > 3) t = T.ROCK;
    let light = 1;
    if (t !== T.DEEP && t !== T.WATER) {
      const slope = (h0 - up) * 0.035 + (h0 - left) * 0.012;
      light = 1 + clamp(slope, -0.34, 0.34);
    } else {
      // 水面：轻微波纹，越深越暗
      light = t === T.DEEP ? 0.82 : 0.98;
      light += ((px * 7 + py * 13) % 5 - 2) * 0.012;
    }
    // 高处更亮（空气透视）
    light += clamp((h0 - SEA) * 0.0022, 0, 0.12);
    const j = ((px * 31 + py * 17) % 97) / 48 - 1;
    let c = surfaceRGB(t, light, j);
    if (terra) {
      const [wx, wy] = this.toWorld(px, py);
      const m = terra.mat(wx, wy);
      if (m) {
        const base = blockBaseColor(m);
        c = [
          Math.min(255, ((base >> 16) & 255) * light),
          Math.min(255, ((base >> 8) & 255) * light),
          Math.min(255, (base & 255) * light),
        ];
      }
    }
    rgb[i * 3] = c[0];
    rgb[i * 3 + 1] = c[1];
    rgb[i * 3 + 2] = c[2];
  }

  /** 玩家动过一格后，把长卷上对应的一小片重画出来 */
  patch(wx, wy, terra) {
    if (!this.done) return 0;
    const [cx, cy] = this.toPixel(wx, wy);
    const px0 = Math.floor(cx), py0 = Math.floor(cy);
    let n = 0;
    for (let y = py0 - 2; y <= py0 + 2; y++) {
      if (y < 0 || y >= this.h) continue;
      for (let x = px0 - 2; x <= px0 + 2; x++) {
        if (x < 0 || x >= this.w) continue;
        const i = y * this.w + x;
        if (this.tg[i] === OUTSIDE) continue;
        const [wx2, wy2] = this.toWorld(x, y);
        this.hg[i] = terra.height(wx2, wy2);
        this.tg[i] = terra.type(wx2, wy2);
        this.shadePixel(i, terra);
        n++;
      }
    }
    return n;
  }

  /** 长卷像素 → 世界格坐标 */
  toWorld(px, py) {
    const v = ((py + 0.5) / this.h) * 2 * WORLD - WORLD;
    const u = ((px + 0.5) / this.w) * 2 * WORLD - WORLD;
    return [Math.round((u + v) / 2), Math.round((v - u) / 2)];
  }

  /** 世界格坐标 → 长卷像素 */
  toPixel(wx, wy) {
    const u = wx - wy, v = wx + wy;
    const px = ((u + WORLD) / (2 * WORLD)) * this.w;
    const py = ((v + WORLD) / (2 * WORLD)) * this.h;
    return [px, py];
  }
}
