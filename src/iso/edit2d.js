// 2.5D 的行囊与营建：格子制容器，五十式合成与 3D 版共用同一份配方。
// 掘土（破坏地块）已经取消 —— 地表再拿不走了，但建材还能垒；
// 取物的路子只剩两条：采地上的物资、在水边钓鱼。
import { T } from './palette.js';
import {
  PLANK, STICK, BRICK, MAT,
  BEAM, WINDOW, BANNER, STONE_LAMP, EAVE, GLAZE_TILE, CRATE, STELE, ROOF, GATE,
  ITEMS, itemName,
} from '../core/items.js';

export const MAT_MAX = 9999;   // 旧的材料叠加上限，格子制之后只作参考
export const BAG_SIZE = 500;   // 行囊五百格
export const STORE_SIZE = 1000;   // 仓库一千格
export const MAX_H = 92;       // 垒到这么高就够不着了

/** 12 种可自筑的中式建材（掘土取消之后，垒材是唯一的动土方式） */
export const BUILD_MATS = [
  BRICK, BEAM, WINDOW, MAT, BANNER, STONE_LAMP,
  EAVE, GLAZE_TILE, CRATE, STELE, ROOF, GATE,
];

/** 每格能叠多少：兵器只叠一件，食物十六，材料六十四 */
export function stackLimit(id) {
  const it = ITEMS[id];
  if (!it) return 64;        // 方块类
  return it.stack || 64;
}

/**
 * 真正的格子制容器：背包五百格，仓库一千格。
 * 同类物品先往没满的格里塞，塞不下再占新格；取用时跨格扣。
 */
export class Inventory {
  constructor(size = BAG_SIZE) {
    this.size = size;
    this.slots = new Array(size).fill(null);   // 每格 { id, n } 或 null
  }

  /** 占了几格 */
  used() {
    let n = 0;
    for (const s of this.slots) if (s) n++;
    return n;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.n;
    return n;
  }

  has(id, n = 1) { return this.count(id) >= n; }

  add(id, n = 1) {
    const lim = stackLimit(id);
    let left = n;
    if (lim > 1) {
      for (let i = 0; i < this.size && left > 0; i++) {
        const s = this.slots[i];
        if (!s || s.id !== id || s.n >= lim) continue;
        const put = Math.min(left, lim - s.n);
        s.n += put;
        left -= put;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (this.slots[i]) continue;
      const put = Math.min(left, lim);
      this.slots[i] = { id, n: put };
      left -= put;
    }
    return n - left;
  }

  remove(id, n = 1) {
    let left = n;
    for (let i = 0; i < this.size && left > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(left, s.n);
      s.n -= take;
      left -= take;
      if (s.n <= 0) this.slots[i] = null;
    }
    return n - left;
  }

  /** 面板显示用：按 id 归并后的 { id, count } */
  list() {
    const m = new Map();
    for (const s of this.slots) {
      if (!s) continue;
      m.set(s.id, (m.get(s.id) || 0) + s.n);
    }
    return [...m.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => a.id - b.id);
  }

  /** 整理：同种物品归并，尽量少占格子 */
  tidy() {
    const all = this.list();
    this.slots.fill(null);
    for (const it of all) this.add(it.id, it.count);
    return this.used();
  }

  /** 把某物挪到另一个容器（背包 ↔ 仓库），返回实际挪了多少 */
  moveTo(other, id, n = Infinity) {
    const want = Math.min(n, this.count(id));
    let moved = 0;
    for (let i = 0; i < this.size && moved < want; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      while (s.n > 0 && moved < want) {
        const put = other.add(id, Math.min(s.n, want - moved));
        if (put <= 0) break;
        s.n -= put;
        moved += put;
        if (s.n <= 0) { this.slots[i] = null; break; }
      }
    }
    return moved;
  }
}

export function startingKit(inv) {
  inv.add(PLANK, 8);
  inv.add(STICK, 4);
  inv.add(BRICK, 20);
  inv.add(MAT, 12);
  inv.add(102, 1);   // 木镐：开局就能采矿
  inv.add(360, 1);   // 竹钓竿：开局就能垂钓
}

/** 包里最趁手的某类家伙（pickaxe / axe / shovel / sickle / sword / rod） */
export function bestTool(inv, kind) {
  let best = null;
  for (const s of inv.slots) {
    if (!s) continue;
    const id = s.id;
    const it = ITEMS[id];
    if (!it || !it.tool || it.tool.kind !== kind) continue;
    if (!best || it.tool.tier > best.tier) best = { id, ...it.tool };
  }
  return best;
}

/** 包里最好的那把镐（没有镐就采不了矿） */
export function bestPick(inv) {
  return bestTool(inv, 'pickaxe');
}

/**
 * 地形改动层：垒起来的台基、牌坊记在这里，覆盖在原始地形之上。
 * 掘土取消之后这一层只会加高、不会挖低；原始地形函数保持纯净，
 * 因此长卷与近景读到的始终是同一份世界。
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

  /** 在地表垒一层建材，可堆土丘、筑台基（这套地形只加不减） */
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
