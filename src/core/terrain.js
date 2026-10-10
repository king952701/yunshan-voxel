// 地形纯函数：只依赖噪声与地貌分区，不碰方块表，因此 3D 体素版与 2.5D 长卷版可以共用同一套山水。
import { fbm2, ridged2, smoothstep, clamp } from './noise.js';
import {
  S, biomeParams, biomeNameAt,
  riverFactor, streamFactor, lakeFactor, waterCarve, mainRiver,
  oceanSink, islandLift,
  SNOW, SWAMP, MOUNT, TAIGA, FOREST,
} from './biome.js';

export const SEA = 28;          // 水面高度
export const SNOW_LINE = 58;    // 雪线

export { riverFactor, streamFactor, lakeFactor, mainRiver, oceanSink, islandLift };

/**
 * 地表高度（整数格）。
 * 山形是共用的（丘陵 + 层叠山峦），起伏的脾气由所在地貌决定：
 * 雪原高而多雪、松林多丘陵、草原平缓、沙漠平而少雨、黄土多沟壑。
 */
export function surfaceHeight(wx, wz, seed) {
  const p = biomeParams(wx, wz, seed);
  const cont = fbm2(wx / (520 * S), wz / (520 * S), seed, 4);
  const hill = fbm2(wx / (120 * S), wz / (120 * S), seed + 555, 4);
  const ridge = ridged2(wx / (240 * S), wz / (240 * S), seed + 999, 4);
  const mountain = smoothstep(0.46, 0.72, cont);
  let h = SEA + 2 + p.lift + hill * (4 + p.amp) + mountain * (ridge * p.ridge - 4);
  h -= waterCarve(wx, wz, seed, p);          // 主江、支流、溪、湖把地切开
  h -= oceanSink(wx, wz, seed);              // 四面环海，南部另沉一层南海
  h += islandLift(wx, wz, seed);             // 海上再顶出些散岛
  h += (fbm2(wx / 26, wz / 26, seed + 4242, 2) - 0.5) * 2.2;   // 细颗粒
  return h;
}

export function slopeAt(wx, wz, seed) {
  const h = surfaceHeight(wx, wz, seed);
  return Math.abs(surfaceHeight(wx + 1, wz, seed) - h)
    + Math.abs(surfaceHeight(wx, wz + 1, seed) - h);
}

/**
 * 粗分类：3D 版的村寨、古塔按这个选地方，沿用旧名，免得那边跟着改。
 * 2.5D 的长卷不读它，走 palette 的细分类。
 */
export function biomeAt(wx, wz, seed, h) {
  if (h <= SEA + 1) return 'water';
  const b = biomeNameAt(wx, wz, seed);
  if (b === SWAMP) return 'swamp';
  if (h >= SNOW_LINE - 4 || b === MOUNT) return 'mountain';
  if (riverFactor(wx, wz, seed) > 0.08 || mainRiver(wx, wz, seed) > 0.05) return 'riverbank';
  return (b === TAIGA || b === SNOW || b === FOREST) ? 'forest' : 'plain';
}

export { clamp };
