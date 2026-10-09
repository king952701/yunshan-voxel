// 无限无缝地形：所有高度/生物群系都是 (世界坐标 + 种子) 的纯函数，
// 因此相邻区块边界天然连续，不存在接缝。
import { fbm2, ridged2, noise2, noise3, smoothstep, clamp, rand2 } from '../core/noise.js';
import {
  AIR, GRASS, DIRT, STONE, SAND, WATER, SNOW, GRAVEL, ORE_COAL, ORE_IRON,
} from './blocks.js';
import { applyStructures } from './structures.js';

export const CHUNK = 16;
export const HEIGHT = 96;
export const SEA = 28;          // 水面高度
export const SNOW_LINE = 58;    // 雪线（只覆盖较高的山顶）

export function index(x, y, z) {
  return (y * CHUNK + z) * CHUNK + x;
}

/** 地表高度（整数格）。地形主体：起伏丘陵 + 层叠山峦 */
export function surfaceHeight(wx, wz, seed) {
  const cont = fbm2(wx / 520, wz / 520, seed, 4);
  const hill = fbm2(wx / 120, wz / 120, seed + 555, 4);
  const ridge = ridged2(wx / 240, wz / 240, seed + 999, 4);
  // 山脊幅度上限经标定：最高约 78 格，不会撞到世界盒上限而被削平成台地
  const mountain = smoothstep(0.46, 0.72, cont);
  let h = SEA + 2 + hill * 10 + mountain * (ridge * 42 - 4);
  // 河谷下切
  const r = riverFactor(wx, wz, seed);
  h -= r * (13 + hill * 6);
  // 山脚细碎起伏
  h += (fbm2(wx / 26, wz / 26, seed + 4242, 2) - 0.5) * 2.2;
  return h;
}

/** 河道因子：0 = 陆地，1 = 河心。用域扭曲做出蜿蜒的河 */
export function riverFactor(wx, wz, seed) {
  const wx2 = wx + (noise2(wx / 170, wz / 170, seed + 31) - 0.5) * 70;
  const wz2 = wz + (noise2(wx / 170 + 5.5, wz / 170, seed + 61) - 0.5) * 70;
  const v = fbm2(wx2 / 420, wz2 / 420, seed + 777, 2);
  const d = Math.abs(v - 0.5);
  return smoothstep(0.030, 0.004, d);
}

export function slopeAt(wx, wz, seed) {
  const h = surfaceHeight(wx, wz, seed);
  const hx = surfaceHeight(wx + 1, wz, seed);
  const hz = surfaceHeight(wx, wz + 1, seed);
  return Math.abs(hx - h) + Math.abs(hz - h);
}

export function biomeAt(wx, wz, seed, h) {
  if (h <= SEA + 1) return 'water';
  if (h >= SNOW_LINE - 4) return 'mountain';
  if (riverFactor(wx, wz, seed) > 0.08) return 'riverbank';
  const m = fbm2(wx / 300, wz / 300, seed + 313, 2);
  return m > 0.53 ? 'forest' : 'plain';
}

/** 生成一个区块的体素数据（含跨区块结构，保证边界无缝） */
export function generateChunkData(cx, cz, seed) {
  const blocks = new Uint8Array(CHUNK * CHUNK * HEIGHT);
  const heights = new Uint8Array(CHUNK * CHUNK);
  const ox = cx * CHUNK, oz = cz * CHUNK;

  for (let z = 0; z < CHUNK; z++) {
    for (let x = 0; x < CHUNK; x++) {
      const wx = ox + x, wz = oz + z;
      let h = Math.round(surfaceHeight(wx, wz, seed));
      h = clamp(Math.round(h), 3, HEIGHT - 14);
      heights[z * CHUNK + x] = h;

      const beach = h <= SEA + 1;
      const snowy = h >= SNOW_LINE;
      const slope = slopeAt(wx, wz, seed);
      const rocky = slope > 6.5;

      for (let y = 0; y <= h; y++) {
        let id;
        if (y <= 2) {
          id = STONE; // 世界底部，挖不穿
        } else if (y === h) {
          id = beach ? SAND : snowy ? SNOW : rocky ? STONE : GRASS;
        } else if (y > h - 4) {
          id = beach ? SAND : rocky && y > h - 2 ? GRAVEL : DIRT;
        } else {
          id = STONE;
        }
        blocks[index(x, y, z)] = id;
      }

      // 地下洞穴（只在远离水面的山体内部开洞，避免灌水）
      if (h > SEA + 4) {
        const yTop = h - 5;
        for (let y = 5; y <= yTop; y++) {
          const n = noise3(wx / 28, y / 17, wz / 28, seed + 8888);
          if (n > 0.70 || n < 0.30) blocks[index(x, y, z)] = AIR;
        }
      }

      // 矿脉：只在石层内
      for (let y = 4; y < h - 4; y++) {
        if (blocks[index(x, y, z)] !== STONE) continue;
        const r = rand2(wx * 31 + y, wz * 17 + y, seed + 20250);
        if (y < 44 && r < 0.010) blocks[index(x, y, z)] = ORE_IRON;
        else if (y < 62 && r > 0.985) blocks[index(x, y, z)] = ORE_COAL;
      }
    }
  }

  // 水面填充：任何水面以下仍为空的格子都灌水
  for (let z = 0; z < CHUNK; z++) {
    for (let x = 0; x < CHUNK; x++) {
      for (let y = 3; y <= SEA; y++) {
        if (blocks[index(x, y, z)] === AIR) blocks[index(x, y, z)] = WATER;
      }
    }
  }

  applyStructures(cx, cz, blocks, heights, seed);

  return { blocks, heights };
}
