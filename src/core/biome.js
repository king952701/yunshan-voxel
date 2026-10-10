// 云山录的地貌总纲：整幅山水由四块不规则的大区拼成，每块 8000×8000。
// 高度、水系、植被、矿脉一律读这里的分区，所以 3D 体素版与 2.5D 长卷版
// 看到的是同一片山川；想换图幅只改下面这两个数。
import { fbm2, noise2, ridged2, rand2, smoothstep } from './noise.js';

export const REGION = 8000;          // 每块边长的格数
export const BLOCK_N = 2;            // 2×2 = 四块
export const WORLD = REGION * BLOCK_N;
export const HALF = WORLD / 2;
export const S = WORLD / 8000;       // 地貌尺度：图幅放大，山川同比放大

// 五种地貌
export const SNOW = 'snow', PINE = 'pine', GRASS = 'grass', DESERT = 'desert', LOESS = 'loess';
export const BIOME_NAME = { snow: '雪原', pine: '松林', grass: '草原', desert: '沙漠', loess: '黄土' };

// 四块的主地貌（行 0 在北、列 0 在西）。
// 只列了四块，而地貌有五种，所以让「草原」做块与块之间的过渡带：
// 五种都在图上，又正好是四块。
export const BLOCK_BIOME = [[SNOW, PINE], [DESERT, LOESS]];

// 块内掺的次生地貌：免得一大块从头到脚一个样。
// 门槛定得高，斑块只占一两块，不至于喧宾夺主把主地貌挤掉。
const SECOND = { snow: PINE, pine: GRASS, grass: LOESS, desert: GRASS, loess: GRASS };
const SECOND_AT = { snow: 0.66, pine: 0.68, grass: 0.66, desert: 0.72, loess: 0.68 };

/**
 * 每块地貌的脾气：
 * lift 整体抬升、amp 丘陵起伏、ridge 山脊锐度、snowLine 雪线偏移（负 = 更容易积雪）、
 * wet 水泽丰歉（管江溪湖的多寡）、tree 林木覆盖、shrub 灌木疏密、sand 沙化程度。
 */
export const P = {
  snow: { lift: 15, amp: 11, ridge: 32, snowLine: -13, wet: 0.85, tree: 0.20, shrub: 0.10, sand: 0 },
  pine: { lift: 5, amp: 10, ridge: 26, snowLine: -1, wet: 1.00, tree: 0.88, shrub: 0.30, sand: 0 },
  grass: { lift: 1, amp: 7, ridge: 13, snowLine: 0, wet: 0.72, tree: 0.16, shrub: 0.52, sand: 0 },
  desert: { lift: 4, amp: 5, ridge: 7, snowLine: 8, wet: 0.30, tree: 0.02, shrub: 0.14, sand: 1 },
  loess: { lift: 3, amp: 9, ridge: 19, snowLine: 2, wet: 0.45, tree: 0.07, shrub: 0.34, sand: 0.25 },
};

const KEYS = ['lift', 'amp', 'ridge', 'snowLine', 'wet', 'tree', 'shrub', 'sand'];

// ------------------------------------------------------------------ 分区
/** 东西分界：一条随南北蜿蜒的曲线（噪声扭曲，所以不是直线） */
function splitX(wy, seed) {
  return (fbm2(wy / (1500 * S), 4.7, seed + 811, 2) - 0.5) * 2600 * S;
}

/** 南北分界：一条随东西蜿蜒的曲线 */
function splitY(wx, seed) {
  return (fbm2(wx / (1500 * S), 9.3, seed + 823, 2) - 0.5) * 2600 * S;
}

/** 该点落在哪一块（行、列）。3D 是无限地图，所以这里不设边界，越界自然接着最外一块 */
export function blockAt(wx, wy, seed) {
  return [wy < splitY(wx, seed) ? 0 : 1, wx < splitX(wy, seed) ? 0 : 1];
}

const BAND = 1200 * S;    // 参数过渡带：高度在这一段里缓变，所以块与块之间不会出断崖
const GRASS_CORE = 0.12;  // 只有贴着分界的这一条窄带才直接算草原，免得过渡带吃掉整块

/** 该点的地貌构成：主地貌、次生地貌、深入块内的程度 m、次生斑块的程度 q、离分界多远 */
export function biomeMix(wx, wy, seed) {
  const [bi, bj] = blockAt(wx, wy, seed);
  const main = BLOCK_BIOME[bi][bj];
  const d = Math.min(Math.abs(wx - splitX(wy, seed)), Math.abs(wy - splitY(wx, seed)));
  const m = smoothstep(BAND * 0.35, BAND, d);        // 0 = 过渡带，1 = 深入块内
  const patch = fbm2(wx / (760 * S), wy / (760 * S), seed + 857, 2);
  const thr = SECOND_AT[main];
  const q = smoothstep(thr, thr + 0.09, patch);
  return { main, second: SECOND[main], m, q, d };
}

/** 该点归哪种地貌（植被与配色按它来） */
export function biomeNameAt(wx, wy, seed) {
  const { main, second, q, d } = biomeMix(wx, wy, seed);
  if (d < BAND * GRASS_CORE) return GRASS;
  return q > 0.5 ? second : main;
}

/**
 * 高度与植被密度用的参数：按过渡带与次生斑块的权重插值。
 * 插值的是参数而不是高度本身，所以块与块之间是缓坡，不会出断崖。
 */
export function biomeParams(wx, wy, seed) {
  const { main, second, m, q, d } = biomeMix(wx, wy, seed);
  const a = P[main], b = P[second], g = P[GRASS];
  const out = {};
  for (const k of KEYS) {
    const inner = a[k] + (b[k] - a[k]) * q;
    out[k] = g[k] + (inner - g[k]) * m;
  }
  out.biome = d < BAND * GRASS_CORE ? GRASS : (q > 0.5 ? second : main);
  return out;
}

// ------------------------------------------------------------------ 水系
/** 大江：蜿蜒横贯全图，河心为 1 */
export function riverFactor(wx, wz, seed) {
  const wx2 = wx + (noise2(wx / (170 * S), wz / (170 * S), seed + 31) - 0.5) * 70 * S;
  const wz2 = wz + (noise2(wx / (170 * S) + 5.5, wz / (170 * S), seed + 61) - 0.5) * 70 * S;
  const v = fbm2(wx2 / (420 * S), wz2 / (420 * S), seed + 777, 2);
  return smoothstep(0.030, 0.004, Math.abs(v - 0.5));
}

/**
 * 溪流：沿脊线的细密支流，比江窄得多，也多得多。
 * 门槛再收紧就只剩头发丝宽，缩到长卷上一个像素都占不到，等于白画。
 */
export function streamFactor(wx, wz, seed) {
  const v = ridged2(wx / (150 * S), wz / (150 * S), seed + 1301, 2);
  return smoothstep(0.84, 0.97, v);
}

/** 湖泊：低洼处积水成湖，湖心为 1 */
export function lakeFactor(wx, wz, seed) {
  const v = fbm2(wx / (1300 * S), wz / (1300 * S), seed + 1201, 2);
  return smoothstep(0.62, 0.72, v);
}

/** 水网下切的总深度：江最深、湖最阔、溪最浅，再按地貌的水泽丰歉缩放 */
export function waterCarve(wx, wz, seed, p) {
  const wet = p ? p.wet : 1;
  return (riverFactor(wx, wz, seed) * 15
    + streamFactor(wx, wz, seed) * 6
    + lakeFactor(wx, wz, seed) * 20) * wet;
}

// ------------------------------------------------------------------ 五金矿山
export const MINE_KEYS = ['gold', 'silver', 'iron', 'copper', 'alum'];
export const MINE_NAME = {
  gold: '金山', silver: '银山', iron: '铁矿山', copper: '铜矿山', alum: '铝矿山',
};

/**
 * 该处是不是一座矿山：低频噪声圈出成片的矿区，区内定下是哪一种金属。
 * w 是成色（0~1），越靠矿区中心露头越密、越纯。
 */
export function mineAt(wx, wy, seed) {
  const f = fbm2(wx / (900 * S), wy / (900 * S), seed + 5100, 2);
  if (f < 0.58) return null;
  const cx = Math.floor(wx / (420 * S)), cy = Math.floor(wy / (420 * S));
  const r = rand2(cx, cy, seed + 5200);
  return { key: MINE_KEYS[Math.floor(r * 5) % 5], w: smoothstep(0.58, 0.72, f) };
}
