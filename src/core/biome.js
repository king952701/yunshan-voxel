// 云山录的地貌总纲。
//
// 整幅山水按「五横三纵」分成十二区（外加四面环海）：
//
//   北部 1/5   雪原 · 冻土        │ 针叶林（泰加）
//   中北       西北沙丘           │ 中北平原      │ 东北山地
//   中央       西部戈壁           │ 中央草原      │ 东部阔叶林
//   中南       西南沼泽           │ 中南河网      │ 东南湖泊
//   南部 1/5   南海
//
// 分界全部由噪声扭曲，所以不是棋盘格；相邻两区之间插值的是「地貌参数」而不是高度，
// 因此块与块之间是缓坡过渡带，不会出断崖。高度、水系、植被、矿脉一律读这里的分区，
// 所以 3D 体素版与 2.5D 长卷版看到的是同一片山川。
import { fbm2, noise2, ridged2, rand2, smoothstep, clamp } from './noise.js';

export const WORLD = 16384;         // 图幅边长（格）
export const HALF = WORLD / 2;
export const S = WORLD / 8000;      // 地貌尺度：图幅放大，山川同比放大

// 十二区
export const SNOW = 'snow';         // 雪原（含冻土）
export const TAIGA = 'taiga';       // 针叶林
export const DUNE = 'dune';         // 西北沙丘
export const PLAIN = 'plain';       // 中北平原
export const MOUNT = 'mount';       // 东北山地
export const GOBI = 'gobi';         // 西部戈壁
export const STEPPE = 'steppe';     // 中央草原
export const FOREST = 'forest';     // 东部阔叶林
export const SWAMP = 'swamp';       // 西南沼泽
export const RIVERNET = 'rivernet'; // 中南河网
export const LAKE = 'lake';         // 东南湖泊
export const OCEAN = 'ocean';       // 南海

export const BIOME_NAME = {
  snow: '雪原', taiga: '针叶林', dune: '沙丘', plain: '平原',
  mount: '山地', gobi: '戈壁', steppe: '草原', forest: '阔叶林',
  swamp: '沼泽', rivernet: '河网', lake: '湖泊', ocean: '海洋',
};

/** 五横三纵。行 0 在最北、列 0 在最西 */
export const GRID = [
  [SNOW, SNOW, TAIGA],
  [DUNE, PLAIN, MOUNT],
  [GOBI, STEPPE, FOREST],
  [SWAMP, RIVERNET, LAKE],
  [OCEAN, OCEAN, OCEAN],
];
const ROWS = GRID.length;
const COLS = GRID[0].length;
const BLEND = 0.22;                 // 过渡带占每格的比例：越大越朦胧，越小越生硬
const WANDER = WORLD * 0.10;        // 分界的蜿蜒幅度：越界 ±5% 图幅

/**
 * 每区地貌的脾气：
 * lift 整体抬升、amp 丘陵起伏、ridge 山脊锐度、snowLine 雪线偏移（负 = 更容易积雪）、
 * wet 水泽丰歉、tree 林木覆盖、shrub 灌木疏密、sand 沙化程度、
 * lake 湖泊成片的倾向、flow 溪流疏密。
 */
export const P = {
  snow: { lift: 16, amp: 11, ridge: 34, snowLine: -18, wet: 0.85, tree: 0.18, shrub: 0.08, sand: 0.00, lake: 0.02, flow: 0.90 },
  taiga: { lift: 6, amp: 10, ridge: 26, snowLine: -2, wet: 0.72, tree: 0.88, shrub: 0.30, sand: 0.00, lake: 0.03, flow: 0.55 },
  dune: { lift: 4, amp: 5, ridge: 7, snowLine: 8, wet: 0.30, tree: 0.02, shrub: 0.14, sand: 1.00, lake: 0.00, flow: 0.15 },
  plain: { lift: 1, amp: 6, ridge: 10, snowLine: 0, wet: 0.72, tree: 0.14, shrub: 0.45, sand: 0.00, lake: 0.06, flow: 0.60 },
  mount: { lift: 20, amp: 16, ridge: 40, snowLine: 0, wet: 0.60, tree: 0.35, shrub: 0.20, sand: 0.00, lake: 0.02, flow: 0.80 },
  gobi: { lift: 7, amp: 7, ridge: 15, snowLine: 6, wet: 0.22, tree: 0.04, shrub: 0.12, sand: 0.55, lake: 0.00, flow: 0.15 },
  steppe: { lift: 1, amp: 7, ridge: 13, snowLine: 0, wet: 0.72, tree: 0.16, shrub: 0.52, sand: 0.00, lake: 0.06, flow: 0.60 },
  forest: { lift: 3, amp: 9, ridge: 18, snowLine: 0, wet: 0.90, tree: 0.92, shrub: 0.35, sand: 0.00, lake: 0.05, flow: 0.80 },
  swamp: { lift: 0, amp: 3, ridge: 5, snowLine: 5, wet: 1.00, tree: 0.30, shrub: 0.50, sand: 0.10, lake: 0.05, flow: 0.90 },
  rivernet: { lift: 0, amp: 5, ridge: 9, snowLine: 2, wet: 1.00, tree: 0.25, shrub: 0.40, sand: 0.15, lake: 0.05, flow: 1.60 },
  lake: { lift: 0, amp: 5, ridge: 9, snowLine: 2, wet: 1.00, tree: 0.30, shrub: 0.40, sand: 0.10, lake: 0.55, flow: 0.90 },
  ocean: { lift: -20, amp: 3, ridge: 4, snowLine: 6, wet: 1.00, tree: 0.02, shrub: 0.05, sand: 0.80, lake: 0.00, flow: 0.20 },
};

const KEYS = ['lift', 'amp', 'ridge', 'snowLine', 'wet', 'tree', 'shrub', 'sand', 'lake', 'flow'];

// ------------------------------------------------------------------ 分区
/** 把坐标按噪声推歪一点，直线分界就成了蜿蜒的海岸线与山脚线 */
function warpU(wx, wy, seed) {
  return wx + (noise2(wx / (1900 * S), wy / (1900 * S), seed + 811) - 0.5) * WANDER;
}
function warpV(wx, wy, seed) {
  return wy + (noise2(wx / (1900 * S) + 7.3, wy / (1900 * S), seed + 823) - 0.5) * WANDER;
}

/** 归一化后的经纬度（-1 西/北 → +1 东/南），已扭曲 */
function latOf(wx, wy, seed) {
  return [clamp(warpU(wx, wy, seed) / HALF, -1, 1), clamp(warpV(wx, wy, seed) / HALF, -1, 1)];
}

/**
 * 该点落在哪几区、各占多少：取最近的四个格子做双线性插值。
 * 权重随过渡带宽度缓变，所以区与区之间是一片渐变，不是一道硬边。
 */
export function zoneWeights(wx, wy, seed) {
  const [u, v] = latOf(wx, wy, seed);
  const rf = (v + 1) / 2 * (ROWS - 1);      // 0（北）→ 4（南）
  const cf = (u + 1) / 2 * (COLS - 1);      // 0（西）→ 2（东）
  const r0 = Math.min(ROWS - 2, Math.max(0, Math.floor(rf)));
  const c0 = Math.min(COLS - 2, Math.max(0, Math.floor(cf)));
  const wr = smoothstep(0.5 - BLEND, 0.5 + BLEND, rf - r0);
  const wc = smoothstep(0.5 - BLEND, 0.5 + BLEND, cf - c0);
  return [
    [GRID[r0][c0], (1 - wr) * (1 - wc)],
    [GRID[r0][c0 + 1], (1 - wr) * wc],
    [GRID[r0 + 1][c0], wr * (1 - wc)],
    [GRID[r0 + 1][c0 + 1], wr * wc],
  ];
}

/** 高度与植被密度用的参数：按四区的权重插值 */
export function biomeParams(wx, wy, seed) {
  const ws = zoneWeights(wx, wy, seed);
  const out = {};
  for (const k of KEYS) out[k] = 0;
  let best = -1, main = ws[0][0];
  for (const [z, w] of ws) {
    const a = P[z];
    for (const k of KEYS) out[k] += a[k] * w;
    if (w > best) { best = w; main = z; }
  }
  out.biome = main;
  return out;
}

/** 该点主要归哪一区（植被与配色按它来） */
export function biomeNameAt(wx, wy, seed) {
  return biomeParams(wx, wy, seed).biome;
}
export const zoneAt = biomeNameAt;

// ------------------------------------------------------------------ 海
/**
 * 四面环海：越靠图廓沉得越深，南部另外再沉一层（南海占最南 1/5）。
 * 用的是扭曲后的坐标，所以海岸线是弯的，还有半岛与海湾。
 */
export function oceanSink(wx, wy, seed) {
  const [u, v] = latOf(wx, wy, seed);
  const ring = Math.max(Math.abs(u), Math.abs(v));        // 0 图心 → 1 图廓
  // 环海只吃最外一圈：起沉的位置再往里挪，就会把北部雪原整块淹掉
  return smoothstep(0.88, 0.995, ring) * 30              // 环海
    + smoothstep(0.58, 0.78, v) * 22;                    // 南海
}

/** 海上散布的岛屿：只在已经沉进海里的地方往上顶，所以不会在陆地上乱长包 */
export function islandLift(wx, wy, seed) {
  const [u, v] = latOf(wx, wy, seed);
  const ring = Math.max(Math.abs(u), Math.abs(v));
  const atSea = smoothstep(0.84, 0.97, ring);
  if (atSea <= 0) return 0;
  const blob = fbm2(wx / (300 * S), wy / (300 * S), seed + 6600, 3);
  return atSea * smoothstep(0.72, 0.86, blob) * 34;
}

// ------------------------------------------------------------------ 水系
/**
 * 主大河：从北部雪山发源，蜿蜒南下，越到下游越宽，最后注入南海。
 * 河心为 1。河道是一条随纬度摆动的曲线，所以天然连续，不会断成一段段。
 */
export function mainRiver(wx, wy, seed) {
  const v = wy / HALF;                                    // -1 北 → 1 南
  const t = (v + 1) / 2;
  const bend = (fbm2(3.7, wy / (1200 * S), seed + 4400, 3) - 0.5) * 0.55 * HALF;
  const halfW = (0.005 + 0.020 * t) * WORLD;              // 上游窄、入海口阔
  return smoothstep(halfW, halfW * 0.30, Math.abs(wx - bend));
}

/** 大江：主河之外的蜿蜒支流，河心为 1 */
export function riverFactor(wx, wz, seed) {
  const wx2 = wx + (noise2(wx / (170 * S), wz / (170 * S), seed + 31) - 0.5) * 70 * S;
  const wz2 = wz + (noise2(wx / (170 * S) + 5.5, wz / (170 * S), seed + 61) - 0.5) * 70 * S;
  const v = fbm2(wx2 / (420 * S), wz2 / (420 * S), seed + 777, 2);
  return smoothstep(0.030, 0.004, Math.abs(v - 0.5));
}

/**
 * 溪流：沿脊线的细密支流。门槛随该区的 flow 放宽，
 * 河网区密如蛛网，戈壁沙漠则几乎不生。
 */
export function streamFactor(wx, wz, seed, p) {
  const f = p ? p.flow : 0.6;
  const v = ridged2(wx / (150 * S), wz / (150 * S), seed + 1301, 2);
  return smoothstep(0.905 - f * 0.10, 0.985 - f * 0.035, v);
}

/** 湖泊：低洼处积水成湖。lake 越高门槛越低，所以东南是一整片湖群 */
export function lakeFactor(wx, wz, seed, p) {
  const v = fbm2(wx / (1300 * S), wz / (1300 * S), seed + 1201, 2);
  const lo = 0.62 - (p ? p.lake : 0.06) * 0.30;
  return smoothstep(lo, lo + 0.10, v);
}

/**
 * 水网下切的总深度：主江最深、支流次之、溪最浅，湖则随该区的 lake 深浅不一。
 * 这里最容易犯的错是水挖得太深，半张图都成了泽国（雪原与针叶林曾被淹成海），
 * 所以湖的下切跟着 lake 走：草原上的湖只是浅洼，东南湖群才真的成湖。
 */
export function waterCarve(wx, wz, seed, p) {
  const wet = p ? p.wet : 1;
  const lk = p ? p.lake : 0.06;
  return (mainRiver(wx, wz, seed) * 22
    + riverFactor(wx, wz, seed) * 15
    + streamFactor(wx, wz, seed, p) * 5
    + lakeFactor(wx, wz, seed, p) * (9 + lk * 11)) * wet;
}

// ------------------------------------------------------------------ 五金矿山
export const MINE_KEYS = ['gold', 'silver', 'iron', 'copper', 'alum'];
export const MINE_NAME = {
  gold: '金山', silver: '银山', iron: '铁矿山', copper: '铜矿山', alum: '铝矿山',
};

/**
 * 该处是不是一座矿山：低频噪声圈出成片的矿区，区内定下是哪一种金属。
 * w 是成色（0~1），越靠矿区中心露头越密、越纯。海里不开矿。
 */
export function mineAt(wx, wy, seed) {
  const f = fbm2(wx / (900 * S), wy / (900 * S), seed + 5100, 2);
  if (f < 0.58) return null;
  const cx = Math.floor(wx / (420 * S)), cy = Math.floor(wy / (420 * S));
  const r = rand2(cx, cy, seed + 5200);
  return { key: MINE_KEYS[Math.floor(r * 5) % 5], w: smoothstep(0.58, 0.72, f) };
}
