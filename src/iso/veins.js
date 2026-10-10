// 地下矿脉：每一格的地表之下都埋着矿藏（负向 Y 轴），露头的可持镐开采。
// 全部按坐标确定性生成，不占内存 —— 走到哪算到哪，和图幅大小无关。
import { fbm2, rand2 } from '../core/noise.js';
import { SEA } from './palette.js';
import { STONE, ORE_COAL, ORE_IRON } from '../core/items.js';

export const COPPER = 137, CINNABAR = 136, JADE = 135;

/** 六种矿脉：tier 是开采所需的最低镐级，exp 是每次采集给的采矿经验 */
export const ORES = [
  { id: STONE, name: '青石', color: 0x8d949c, tier: 1, exp: 6, count: 3 },
  { id: ORE_COAL, name: '煤矿', color: 0x464b52, tier: 1, exp: 10, count: 2 },
  { id: ORE_IRON, name: '铁矿', color: 0xd08a4a, tier: 2, exp: 15, count: 2 },
  { id: COPPER, name: '铜矿', color: 0xb87333, tier: 2, exp: 18, count: 2 },
  { id: CINNABAR, name: '朱砂', color: 0xc0392b, tier: 3, exp: 24, count: 1 },
  { id: JADE, name: '玉石', color: 0x6fc7a8, tier: 3, exp: 32, count: 1 },
];

const ORE_BY_ID = new Map(ORES.map((o) => [o.id, o]));
export function oreInfo(id) { return ORE_BY_ID.get(id) || ORES[0]; }

export const VEIN_CD = 300;   // 采空后 5 分钟自行复生
export const BASE_TIME = 5;   // 一次采集 5 秒（技能与镐会缩短）
export const FX_TIME = 1.2;   // 消失动画时长
const VB = 32;                // 每 32x32 的片区里长出几处露头矿脉

/**
 * 某格地下埋着什么矿（0 = 无矿）—— 这就是负向 Y 轴的底层。
 * 先用低频噪声圈出成片的矿区，再在矿区内按概率落矿，所以矿是一脉一脉的，不是散沙。
 */
export function oreAt(wx, wy, seed) {
  const field = fbm2(wx / 46, wy / 46, seed + 8801, 3);
  if (field < 0.50) return 0;
  if (rand2(wx, wy, seed + 8802) > 0.50) return 0;
  const k = rand2(wx, wy, seed + 8803);
  if (k < 0.30) return STONE;
  if (k < 0.58) return ORE_COAL;
  if (k < 0.78) return ORE_IRON;
  if (k < 0.90) return COPPER;
  if (k < 0.97) return CINNABAR;
  return JADE;
}

/** 露头处的矿种：矿区里出该区的矿，矿区之外也有零散的石材与煤，只是不富集 */
export function veinOreAt(wx, wy, seed) {
  const o = oreAt(wx, wy, seed);
  if (o) return o;
  const k = rand2(wx, wy, seed + 8805);
  if (k < 0.60) return STONE;
  if (k < 0.90) return ORE_COAL;
  return ORE_IRON;
}

export class Veins {
  constructor(map) {
    this.map = map;
    this.seed = map.seed;
    this.blocks = new Map();  // "bx,by" -> node[]（已探明的片区缓存）
    this.fx = [];             // 正在播消失动画的矿块
  }

  static bkey(bx, by) { return bx + ',' + by; }

  /** 一个片区里的露头矿脉（确定性，生成一次就缓存） */
  nodesIn(bx, by) {
    const key = Veins.bkey(bx, by);
    let v = this.blocks.get(key);
    if (v) return v;
    v = [];
    const roll = rand2(bx, by, this.seed + 9101);
    const n = roll < 0.28 ? 0 : roll < 0.78 ? 1 : 2;   // 平均约每片区一处
    for (let i = 0; i < n; i++) {
      const wx = bx * VB + Math.floor(rand2(bx, i, this.seed + 9102) * VB);
      const wy = by * VB + Math.floor(rand2(by, i, this.seed + 9103) * VB);
      if (!this.map.inWorld(wx, wy)) continue;
      if (this.map.height(wx, wy) <= SEA + 1) continue;   // 水里的矿不露头
      if (v.some((p) => p.wx === wx && p.wy === wy)) continue;
      v.push({ wx, wy, ore: veinOreAt(wx, wy, this.seed), cd: 0 });
    }
    this.blocks.set(key, v);
    return v;
  }

  /** 该格上有没有可采的矿脉 */
  at(wx, wy) {
    const v = this.nodesIn(Math.floor(wx / VB), Math.floor(wy / VB));
    for (const p of v) if (p.wx === wx && p.wy === wy && p.cd <= 0) return p;
    return null;
  }

  /** 世界矩形范围内的所有矿脉（cd > 0 的是已采空、正在冷却的） */
  inRect(wx0, wy0, wx1, wy1) {
    const out = [];
    const bx0 = Math.floor(wx0 / VB), bx1 = Math.floor(wx1 / VB);
    const by0 = Math.floor(wy0 / VB), by1 = Math.floor(wy1 / VB);
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        for (const p of this.nodesIn(bx, by)) {
          if (p.wx >= wx0 && p.wx <= wx1 && p.wy >= wy0 && p.wy <= wy1) out.push(p);
        }
      }
    }
    return out;
  }

  /** 找玩家脚下附近最近的一处可采矿脉 */
  nearest(wx, wy, r = 2) {
    let best = null, bd = Infinity;
    for (const p of this.inRect(wx - r, wy - r, wx + r, wy + r)) {
      if (p.cd > 0) continue;
      const d = Math.abs(p.wx - wx) + Math.abs(p.wy - wy);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  /** 采空：记下冷却，并起一段平缓下沉的消失动画 */
  mine(node) {
    if (!node || node.cd > 0) return false;
    node.cd = VEIN_CD;
    this.fx.push({ wx: node.wx, wy: node.wy, ore: node.ore, t: FX_TIME });
    return true;
  }

  /** 推进冷却与动画，返回本帧复生了几处矿脉 */
  tick(dt) {
    if (dt > 0) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        this.fx[i].t -= dt;
        if (this.fx[i].t <= 0) this.fx.splice(i, 1);
      }
    }
    let back = 0;
    for (const list of this.blocks.values()) {
      for (const p of list) {
        if (p.cd > 0) {
          p.cd -= dt;
          if (p.cd <= 0) { p.cd = 0; back++; }
        }
      }
    }
    return back;
  }
}
