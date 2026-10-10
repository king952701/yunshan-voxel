// 生存：气血、饱食、渴饮；夜里野兽袭人；力竭倒下在自家门口醒来。
// 一天大约十二分钟（常速），一天要吃两三顿、喝三四次水，所以出门得备干粮。
import { ITEMS, itemName } from '../core/items.js';

export const MAX_STAT = 100;
const HUNGER_PER_DAY = 62;    // 饱食一天掉多少
const THIRST_PER_DAY = 84;    // 渴饮掉得更快
const STARVE_HP = 7;          // 饿到见底时，一天掉多少气血
const THIRST_HP = 10;         // 渴比饿更要命

export class Survival {
  constructor() {
    this.hp = MAX_STAT;
    this.food = MAX_STAT;
    this.water = MAX_STAT;
    this.raidT = 8;     // 离下次遇袭还有多久
    this.warned = {};   // 同一条提醒不反复喊
  }

  /** 行囊里最能解决当下问题的那一件：need = 'food' | 'water' | 'hp' */
  static bestFor(inv, need) {
    let best = null;
    for (const it of inv.list()) {
      const d = ITEMS[it.id];
      if (!d) continue;
      const v = need === 'food' ? (d.food || 0) : need === 'water' ? (d.water || 0) : (d.heal || 0);
      if (v <= 0) continue;
      if (!best || v > best.v) best = { id: it.id, v };
    }
    return best;
  }

  /**
   * 推进生存状态。dayFrac 是这一天里推进的比例（主循环按昼夜流速算好传进来），
   * 所以把昼夜调成静止，饥渴也就跟着停了。
   */
  tick(dayFrac) {
    this.food = Math.max(0, this.food - HUNGER_PER_DAY * dayFrac);
    this.water = Math.max(0, this.water - THIRST_PER_DAY * dayFrac);
    let hurt = 0;
    if (this.food <= 0) hurt += STARVE_HP * dayFrac;
    if (this.water <= 0) hurt += THIRST_HP * dayFrac;
    if (hurt > 0) this.hp = Math.max(0, this.hp - hurt);
    return hurt;
  }

  /** 夜里在野外，附近有野兽就会扑上来；手上有兵器能逼退 */
  tickRaid(dt, ctx) {
    this.raidT -= dt;
    if (this.raidT > 0) return null;
    if (!ctx || !ctx.isNight || !ctx.beastName) { this.raidT = 6; return null; }
    this.raidT = 20 + Math.random() * 16;
    if (ctx.weaponName) {
      return { dmg: 0, msg: `${ctx.beastName}摸黑扑来，你举起${ctx.weaponName}逼退了它` };
    }
    const dmg = 7 + Math.floor(Math.random() * 8);
    this.hp = Math.max(0, this.hp - dmg);
    return { dmg, msg: `夜里${ctx.beastName}扑来，气血 -${dmg}（带上兵器可逼退）` };
  }

  /** 就着水边捧水喝 */
  drink() {
    const before = this.water;
    this.water = Math.min(MAX_STAT, this.water + 45);
    return Math.round(this.water - before);
  }

  /** 吃/喝/敷一件，返回 { id, v, name, kind } */
  consume(inv, need) {
    const pick = Survival.bestFor(inv, need);
    if (!pick) return null;
    inv.remove(pick.id, 1);
    if (need === 'food') this.food = Math.min(MAX_STAT, this.food + pick.v);
    else if (need === 'water') this.water = Math.min(MAX_STAT, this.water + pick.v);
    else this.hp = Math.min(MAX_STAT, this.hp + pick.v);
    return { ...pick, kind: need, name: itemName(pick.id) };
  }

  /** 按 F：先救命，再解渴，再充饥——最缺什么先补什么 */
  auto(inv) {
    if (this.hp < 60) { const r = this.consume(inv, 'hp'); if (r) return r; }
    if (this.water < 50) { const r = this.consume(inv, 'water'); if (r) return r; }
    if (this.food < 60) { const r = this.consume(inv, 'food'); if (r) return r; }
    return null;
  }

  /** 力竭倒下：在自家门口醒来，行囊掉一半（家伙留下，不然翻不了身） */
  collapse(inv) {
    const lost = [];
    for (const it of inv.list()) {
      const d = ITEMS[it.id];
      if (d && d.tool) continue;
      const n = Math.floor(it.count / 2);
      if (n > 0) { inv.remove(it.id, n); lost.push(`${itemName(it.id)}×${n}`); }
    }
    this.hp = MAX_STAT * 0.45;
    this.food = 45;
    this.water = 45;
    this.raidT = 30;
    return lost;
  }

  /** 该提醒的提醒一次，不反复喊 */
  warnings() {
    const out = [];
    const once = (k, msg) => {
      if (!this.warned[k]) { this.warned[k] = true; out.push(msg); }
    };
    if (this.water <= 15) once('w15', '渴得厉害，找水喝');
    else if (this.water <= 35) once('w35', '有些口渴了');
    if (this.food <= 15) once('f15', '饿得发慌，得吃点东西');
    else if (this.food <= 35) once('f35', '肚子有点空了');
    if (this.hp <= 25) once('h25', '气血见底，敷药或进食');
    if (this.water > 35) this.warned.w15 = this.warned.w35 = false;
    if (this.food > 35) this.warned.f15 = this.warned.f35 = false;
    if (this.hp > 25) this.warned.h25 = false;
    return out;
  }

  /** 一句话概括眼下的状况 */
  status() {
    if (this.hp <= 0) return '力竭倒下';
    if (this.water <= 15 || this.food <= 15) return '又渴又饿';
    if (this.water <= 35) return '口渴';
    if (this.food <= 35) return '腹中空空';
    if (this.hp <= 50) return '气血有亏';
    return '安好';
  }
}
