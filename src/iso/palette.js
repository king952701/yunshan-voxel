// 2.5D 像素长卷：地表分类、配色与天光色温
export const SEA = 28;
export const SNOW_LINE = 58;

export const T = {
  DEEP: 0, WATER: 1, SAND: 2, GRASS: 3,
  FOREST: 4, BAMBOO: 5, ROCK: 6, SNOW: 7, BANK: 8,
  DUG: 9,   // 挖过的裸地：比草地更深、偏土黄
  PINE: 10, // 松林：比杂木林更深的青
  LOESS: 11, // 黄土：塬与沟壑的赭黄
  SHRUB: 12, // 灌木丛：介于草与林之间的橄榄色
  DUNE: 13,  // 沙丘：沙漠内陆，比河滩更干更亮
};

// 昼间基色：水、沙、草、林、竹、岩、雪、河岸（取中式山水的青绿设色）
const BASE = [
  [38, 64, 86],
  [72, 132, 158],
  [214, 197, 150],
  [124, 154, 88],
  [76, 110, 66],
  [116, 158, 92],
  [136, 130, 120],
  [232, 238, 242],
  [147, 176, 116],
  [124, 92, 58],
  [52, 88, 62],
  [198, 166, 98],
  [142, 144, 80],
  [228, 209, 158],
];
// 同色系抖动幅度：让最小像素格也有颗粒感
const JIT = [5, 6, 11, 16, 14, 13, 11, 5, 14, 12, 13, 12, 14, 8];

function c255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

/** 地表 → RGB。light 为坡度光照系数，j 为 [-1,1] 的颗粒抖动 */
export function surfaceRGB(t, light, j) {
  const b = BASE[t] || BASE[T.GRASS];
  const jit = (JIT[t] || 8) * j;
  return [
    c255((b[0] + jit) * light),
    c255((b[1] + jit) * light),
    c255((b[2] + jit) * light),
  ];
}

/** 天光：返回给 canvas 的 CSS filter，夜色偏靛蓝、晨昏偏暖金 */
export function skyFilter(dayF, dawn) {
  // dayF: 0=深夜 1=正午；dawn: 0..1 晨昏强度
  const br = 0.42 + dayF * 0.62;
  const sat = 0.55 + dayF * 0.5;
  const hue = (1 - dayF) * -14 + dawn * 8;
  const sep = dawn * 0.18;
  return `brightness(${br.toFixed(3)}) saturate(${sat.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg) sepia(${sep.toFixed(3)})`;
}

/** 天色（供水面反光与雾使用） */
export function skyTint(dayF, dawn) {
  const night = [18, 26, 44];
  const noon = [188, 217, 234];
  const warm = [240, 195, 137];
  const a = dayF;
  let r = night[0] + (noon[0] - night[0]) * a;
  let g = night[1] + (noon[1] - night[1]) * a;
  let b = night[2] + (noon[2] - night[2]) * a;
  r += (warm[0] - r) * dawn * 0.5;
  g += (warm[1] - g) * dawn * 0.35;
  b += (warm[2] - b) * dawn * 0.15;
  return [c255(r), c255(g), c255(b)];
}
