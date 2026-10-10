// 2.5D 的动土与营建：改动层覆盖在原始地形之上，50 式合成与 3D 版共用同一份配方。
import { T } from './palette.js';
import {
  DIRT, SAND, STONE, WOOD, BAMBOO, SNOW, PLANK, STICK,
  BRICK, BEAM, WINDOW, MAT, BANNER, STONE_LAMP, EAVE, GLAZE_TILE, CRATE, STELE,
  ROOF, GATE, ITEMS, itemName,
} from '../core/items.js';

export const MAT_MAX = 9999;   // 材料道具的叠加上限
export const MIN_H = 4;        // 再挖就穿了
export const MAX_H = 92;

// 九种地表各掉落什么（下标即 palette 的 T）
export const DIG_DROP = [null, null, SAND, DIRT, WOOD, BAMBOO, STONE, SNOW, DIRT, DIRT];

/** 12 种可自筑的中式建材 */
export const BUILD_MATS = [
  BRICK, BEAM, WINDOW, MAT, BANNER, STONE_LAMP,
  EAVE, GLAZE_TILE, CRATE, STELE, ROOF, GATE,
];

export function stackLimit(id) {
  const it = ITEMS[id];
  return it && it.stack === 1 ? 1 : MAT_MAX;
}

export class Inventory {
  constructor() {
    this.slots = new Map();
  }

  count(id) { return this.slots.get(id) || 0; }
  has(id, n = 1) { return this.count(id) >= n; }

  add(id, n = 1) {
    const room = stackLimit(id) - this.count(id);
    const got = Math.max(0, Math.min(n, room));
    if (got > 0) this.slots.set(id, this.count(id) + got);
    return got;
  }

  remove(id, n = 1) {
    const have = this.count(id);
    const take = Math.min(n, have);
    if (take <= 0) return 0;
    const left = have - take;
    if (left > 0) this.slots.set(id, left);
    else this.slots.delete(id);
    return take;
  }

  /** 面板显示用：按 id 排序的 { id, count } */
  list() {
    return [...this.slots.entries()]
      .filter(([, c]) => c > 0)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id - b.id);
  }
}

export function startingKit(inv) {
  inv.add(PLANK, 8);
  inv.add(STICK, 4);
  inv.add(BRICK, 20);
  inv.add(MAT, 12);
  inv.add(102, 1);   // 木镐：开局就能采矿
}

/** 包里最好的那把镐（没有镐就采不了矿） */
export function bestPick(inv) {
  let best = null;
  for (const id of inv.slots.keys()) {
    const it = ITEMS[id];
    if (!it || !it.tool || it.tool.kind !== 'pickaxe') continue;
    if (!best || it.tool.tier > best.tier) best = { id, ...it.tool };
  }
  return best;
}

/**
 * 地形改动层：玩家挖过的坑、堆起的台基都记在这里，
 * 原始地形函数保持纯净，因此长卷与近景读到的始终是同一份世界。
 */
export class Terra {
  constructor(map) {
    this.map = map;
    this.deltas = new Map();
  }

  static key(wx, wy) { return wx + ',' + wy; }

  cell(wx, wy) { return this.deltas.get(Terra.key(wx, wy)); }
  height(wx, wy) { const d = this.cell(wx, wy); return d ? d.h : this.map.height(wx, wy); }
  type(wx, wy) { const d = this.cell(wx, wy); return d ? d.t : this.map.type(wx, wy); }
  mat(wx, wy) { const d = this.cell(wx, wy); return d ? d.mat || 0 : 0; }

  /** 挖下一层，掉落进背包；拆建材则原样返还 */
  dig(wx, wy, inv) {
    if (!this.map.inWorld(wx, wy)) return { ok: false, msg: '图幅之外' };
    const h = this.height(wx, wy);
    const t = this.type(wx, wy);
    if (t === T.DEEP || t === T.WATER) return { ok: false, msg: '水里挖不动' };
    if (h <= MIN_H) return { ok: false, msg: '再挖就穿了' };

    const d = this.cell(wx, wy);
    if (d && d.mat) {
      const back = inv.add(d.mat, 1);
      this.deltas.set(Terra.key(wx, wy), { h: h - 1, t: T.DUG, mat: 0 });
      return { ok: true, drop: d.mat, msg: back ? `拆下 ${itemName(d.mat)}` : `${itemName(d.mat)} 带不下了` };
    }

    const drop = DIG_DROP[t];
    this.deltas.set(Terra.key(wx, wy), { h: h - 1, t: T.DUG, mat: 0 });
    if (drop == null) return { ok: true, drop: 0, msg: '掘开一层' };
    const got = inv.add(drop, 1);
    return { ok: true, drop, msg: got ? `得 ${itemName(drop)}` : `${itemName(drop)} 带不下了` };
  }

  /** 在地表垒一层建材，可堆土丘、筑台基 */
  place(wx, wy, matId, inv) {
    if (!this.map.inWorld(wx, wy)) return { ok: false, msg: '图幅之外' };
    if (!matId) return { ok: false, msg: '先选一种建材' };
    if (!inv.has(matId, 1)) return { ok: false, msg: `没有${itemName(matId)}了` };
    const h = this.height(wx, wy);
    if (h >= MAX_H) return { ok: false, msg: '太高了，够不着' };
    inv.remove(matId, 1);
    this.deltas.set(Terra.key(wx, wy), { h: h + 1, t: T.DUG, mat: matId });
    return { ok: true, msg: `垒上${itemName(matId)}` };
  }

  /** 复原全部动土：改动层清空，山水回到最初的模样 */
  reset() {
    const n = this.deltas.size;
    this.deltas.clear();
    return n;
  }
}
