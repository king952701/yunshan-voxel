// 背包：快捷栏 9 格 + 背包 27 格
import { ITEMS } from '../world/blocks.js';

export const HOTBAR = 9;
export const INV_SIZE = 36;

export class Inventory {
  constructor() {
    this.slots = new Array(INV_SIZE).fill(null); // {id, count}
    this.selected = 0;
  }

  stackLimit(id) {
    if (id < 100) return 64;
    const it = ITEMS[id];
    return it ? (it.stack || 1) : 64;
  }

  add(id, count = 1) {
    const limit = this.stackLimit(id);
    let left = count;
    // 先填已有堆叠
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < limit) {
        const put = Math.min(limit - s.count, left);
        s.count += put; left -= put;
      }
    }
    // 再找空格
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      if (!this.slots[i]) {
        const put = Math.min(limit, left);
        this.slots[i] = { id, count: put };
        left -= put;
      }
    }
    return count - left; // 实际放入数量
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  remove(id, count = 1) {
    let left = count;
    for (let i = INV_SIZE - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, left);
        s.count -= take; left -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return count - left;
  }

  held() {
    return this.slots[this.selected];
  }

  /** 消耗当前手持 1 个，返回是否成功 */
  consumeHeld(n = 1) {
    const s = this.held();
    if (!s || s.count < n) return false;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
    return true;
  }

  tool() {
    const s = this.held();
    if (!s) return null;
    const it = ITEMS[s.id];
    return it && it.tool ? it.tool : null;
  }

  scroll(dir) {
    this.selected = (this.selected + dir + HOTBAR) % HOTBAR;
  }

  serialize() {
    return this.slots.map((s) => (s ? [s.id, s.count] : null));
  }

  deserialize(arr) {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < INV_SIZE; i++) {
      const v = arr[i];
      this.slots[i] = v ? { id: v[0], count: v[1] } : null;
    }
  }
}
