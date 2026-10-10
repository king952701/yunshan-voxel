// 地表采集点：树木、灌木丛、药丛、野兽、土堆、果丛。
// 与矿脉同构——按坐标确定性生成，采空后冷却，冷却结束自行复生，地形数据不动。
// 钓鱼不在这里：那是「站在任何水边按 E」的路子，见 fishing.js。
import { rand2 } from '../core/noise.js';
import { T } from './palette.js';
import { biomeParams } from '../core/biome.js';
import {
  ITEMS, HERB_IDS, WOOD_IDS, BEAST_IDS,
  DIRT, SAND, GRAVEL, BAMBOO, MEAT, BERRY_FRUIT, STICK,
} from '../core/items.js';

export const NODE_CD = 300;   // 采空后 5 分钟自行复生
export const NB = 32;         // 每 32x32 片区长出几处采集点

/** 六类采集点：各自对应一门采集技能与一件趁手家伙 */
export const KINDS = {
  tree: { name: '树木', skill: 'logging', tool: 'axe', color: '#6b8f4e', icon: '🌲' },
  shrub: { name: '灌木丛', skill: 'foraging', tool: null, color: '#8a9a5b', icon: '🪴' },
  herb: { name: '药丛', skill: 'herbal', tool: 'sickle', color: '#6fbf5a', icon: '🌿' },
  beast: { name: '野兽', skill: 'hunting', tool: 'sword', color: '#c0603a', icon: '🐗' },
  soil: { name: '土堆', skill: 'digging', tool: 'shovel', color: '#b59b6a', icon: '🟫' },
  berry: { name: '果丛', skill: 'foraging', tool: null, color: '#a05fb0', icon: '🫐' },
};

export function kindInfo(kind) { return KINDS[kind] || KINDS.berry; }

/** 某处采集点能采到什么：坐标定了，产出就定了 */
export function nodeLoot(kind, wx, wy, seed, type) {
  switch (kind) {
    case 'tree': {
      if (type === T.BAMBOO) return { id: BAMBOO, count: 2 };
      const i = Math.floor(rand2(wx, wy, seed + 501) * WOOD_IDS.length);
      return { id: WOOD_IDS[i], count: 1 + Math.floor(rand2(wx, wy, seed + 502) * 2) };
    }
    case 'shrub': {
      // 灌木砍下来是木棍，运气好还挂着一把野果
      if (rand2(wx, wy, seed + 561) < 0.72) {
        return { id: STICK, count: 2 + Math.floor(rand2(wx, wy, seed + 562) * 2) };
      }
      return { id: BERRY_FRUIT, count: 1 };
    }
    case 'herb': {
      // 越靠后的药越名贵，也越少：把随机数取幂，名贵的自然落进长尾
      const r = Math.pow(rand2(wx, wy, seed + 511), 2.2);
      const i = Math.min(HERB_IDS.length - 1, Math.floor(r * HERB_IDS.length));
      return { id: HERB_IDS[i], count: 1 };
    }

    case 'beast': {
      const i = Math.floor(rand2(wx, wy, seed + 531) * BEAST_IDS.length);
      const meat = 1 + Math.floor(rand2(wx, wy, seed + 532) * 2);
      return { id: BEAST_IDS[i], count: 1, extra: { id: MEAT, count: meat } };
    }
    case 'soil': {
      const k = rand2(wx, wy, seed + 541);
      return { id: k < 0.5 ? DIRT : k < 0.8 ? SAND : GRAVEL, count: 2 };
    }
    default: {
      return { id: BERRY_FRUIT, count: 2 + Math.floor(rand2(wx, wy, seed + 551) * 2) };
    }
  }
}

// 每类点长在什么地表上
const GROUND = {
  tree: (t) => t === T.FOREST || t === T.BAMBOO || t === T.GRASS || t === T.PINE,
  shrub: (t) => t === T.SHRUB || t === T.GRASS || t === T.LOESS || t === T.DUNE
    || t === T.GOBI || t === T.TUNDRA,
  herb: (t) => t === T.GRASS || t === T.FOREST || t === T.BANK || t === T.SHRUB
    || t === T.SWAMP,
  beast: (t) => t === T.FOREST || t === T.GRASS || t === T.BAMBOO || t === T.PINE,
  soil: (t) => t === T.SAND || t === T.BANK || t === T.ROCK || t === T.DUNE
    || t === T.LOESS || t === T.GOBI,
  berry: (t) => t === T.GRASS || t === T.FOREST || t === T.BAMBOO || t === T.SHRUB,
};

const PLAN = [
  ['tree', 3, 5], ['shrub', 1, 3], ['herb', 1, 3],
  ['beast', 0, 1], ['soil', 1, 2], ['berry', 1, 2],
];

// 疏密随地貌：松林里树挨着树，沙漠里几乎不生木，水泽之乡药丛最密
const BIOME_MUL = {
  tree: (p) => p.tree * 2.4,
  shrub: (p) => 0.4 + p.shrub * 1.6,
  herb: (p) => 0.5 + p.wet,
  beast: (p) => 0.3 + p.tree * 1.2,
  soil: (p) => 0.4 + p.sand * 1.6,
  berry: (p) => 0.5 + p.shrub,
};

export class Nodes {
  constructor(map) {
    this.map = map;
    this.seed = map.seed;
    this.chunks = new Map();
  }

  chunkAt(bx, by) {
    const key = bx + ',' + by;
    let v = this.chunks.get(key);
    if (v) return v;
    v = [];
    const p = biomeParams(bx * NB + NB / 2, by * NB + NB / 2, this.seed);
    PLAN.forEach(([kind, lo, hi], ki) => {
      const base = lo + Math.floor(rand2(bx, by, this.seed + 6301 + ki) * (hi - lo + 1));
      const n = Math.round(base * BIOME_MUL[kind](p));
      for (let i = 0; i < n; i++) {
        const wx = bx * NB + Math.floor(rand2(bx, i, this.seed + 6401 + ki) * NB);
        const wy = by * NB + Math.floor(rand2(by, i, this.seed + 6501 + ki) * NB);
        if (!this.map.inWorld(wx, wy)) continue;
        const t = this.map.type(wx, wy);
        if (!GROUND[kind](t)) continue;
        if (v.some((p) => p.wx === wx && p.wy === wy)) continue;
        v.push({ wx, wy, kind, cd: 0, loot: nodeLoot(kind, wx, wy, this.seed, t) });
      }
    });
    this.chunks.set(key, v);
    return v;
  }

  /** 视野内的采集点（冷却中的不返） */
  inRect(x0, y0, x1, y1) {
    const out = [];
    const bx0 = Math.floor(x0 / NB), bx1 = Math.floor(x1 / NB);
    const by0 = Math.floor(y0 / NB), by1 = Math.floor(y1 / NB);
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        for (const p of this.chunkAt(bx, by)) {
          if (p.wx < x0 || p.wx > x1 || p.wy < y0 || p.wy > y1) continue;
          if (p.cd > 0) continue;
          out.push(p);
        }
      }
    }
    return out;
  }

  /** 最近的可采点；r 是格数半径 */
  nearest(wx, wy, r = 2) {
    let best = null, bd = r * r;
    const bx0 = Math.floor((wx - r) / NB), bx1 = Math.floor((wx + r) / NB);
    const by0 = Math.floor((wy - r) / NB), by1 = Math.floor((wy + r) / NB);
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        for (const p of this.chunkAt(bx, by)) {
          if (p.cd > 0) continue;
          const d = (p.wx - wx) * (p.wx - wx) + (p.wy - wy) * (p.wy - wy);
          if (d <= bd) { bd = d; best = p; }
        }
      }
    }
    return best;
  }

  /** 冷却递减，到点复生 */
  tick(dt) {
    for (const v of this.chunks.values()) {
      for (const p of v) if (p.cd > 0) p.cd = Math.max(0, p.cd - dt);
    }
  }

  /** 采空：进冷却，产出照旧（同一坐标 deterministic，复生后还是那份） */
  take(p) {
    p.cd = NODE_CD;
    return p.loot;
  }
}

export function lootName(loot) {
  const it = ITEMS[loot.id];
  return it ? it.name : '?';
}
