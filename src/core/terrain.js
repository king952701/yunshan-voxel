// 地形纯函数：只依赖噪声，不碰方块表，因此 3D 体素版与 2.5D 长卷版可以共用同一套山水。
import { fbm2, ridged2, noise2, smoothstep, clamp } from './noise.js';

export const SEA = 28;          // 水面高度
export const SNOW_LINE = 58;    // 雪线

/** 地表高度（整数格）。地形主体：起伏丘陵 + 层叠山峦 */
export function surfaceHeight(wx, wz, seed) {
  const cont = fbm2(wx / 520, wz / 520, seed, 4);
  const hill = fbm2(wx / 120, wz / 120, seed + 555, 4);
  const ridge = ridged2(wx / 240, wz / 240, seed + 999, 4);
  const mountain = smoothstep(0.46, 0.72, cont);
  let h = SEA + 2 + hill * 10 + mountain * (ridge * 42 - 4);
  h -= riverFactor(wx, wz, seed) * (13 + hill * 6);
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
  return Math.abs(surfaceHeight(wx + 1, wz, seed) - h)
    + Math.abs(surfaceHeight(wx, wz + 1, seed) - h);
}

export function biomeAt(wx, wz, seed, h) {
  if (h <= SEA + 1) return 'water';
  if (h >= SNOW_LINE - 4) return 'mountain';
  if (riverFactor(wx, wz, seed) > 0.08) return 'riverbank';
  return fbm2(wx / 300, wz / 300, seed + 313, 2) > 0.53 ? 'forest' : 'plain';
}

export { clamp };
