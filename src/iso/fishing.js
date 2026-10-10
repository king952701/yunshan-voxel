// 钓鱼：站在水边按 E 抛竿，等鱼咬钩再按一次 E 收竿。
//
// 状态机与抽鱼都是纯逻辑（随机数从外面注入），所以能在 Node 里真跑一遍：
// 抛竿 → 等鱼 → 咬钩 → 收竿，四个环节都能单独验。
import { ITEMS, FISH_IDS } from '../core/items.js';
import { T } from './palette.js';

/** 钓鱼的阶段 */
export const PHASE = {
  IDLE: 'idle',   // 没在钓
  CAST: 'cast',   // 抛竿
  WAIT: 'wait',   // 等鱼上钩
  BITE: 'bite',   // 咬钩了 —— 这就是按 E 的窗口
};

export const CAST_TIME = 0.5;

/** 水：能下竿的三种地表。沼泽算浅水，深水另算 */
export function isWater(t) {
  return t === T.WATER || t === T.DEEP || t === T.SWAMP;
}

/**
 * 水在哪儿：以 (wx, wy) 为中心找最近的一格水，返回 {wx, wy, deep, dist}。
 * typeAt 是注入的取地表函数，所以这一条也能单独测。
 */
export function waterNear(typeAt, wx, wy, r = 1) {
  let best = null;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const t = typeAt(wx + dx, wy + dy);
      if (!isWater(t)) continue;
      const dist = Math.abs(dx) + Math.abs(dy);
      const deep = t === T.DEEP;
      // 一样近就挑深水那格 —— 深水才出大鱼，不能看循环先碰见谁
      const better = !best || dist < best.dist || (dist === best.dist && deep && !best.deep);
      if (better) best = { wx: wx + dx, wy: wy + dy, deep, dist };
    }
  }
  return best;
}

/** 等鱼上钩要多久：竿越好、钓技越高，鱼来得越快 */
export function waitTime(tier, lv, rand) {
  const base = 5.6 - tier * 1.0 - Math.min(lv, 10) * 0.20;
  return Math.max(0.7, base * (0.45 + rand() * 0.9));
}

/** 咬钩之后按 E 的窗口有多宽：竿越好、技越高，窗口越长 */
export function biteWindow(tier, lv) {
  return Math.min(3.2, 0.8 + tier * 0.28 + Math.min(lv, 10) * 0.07);
}

/**
 * 抽一条鱼。钓力 = 钓技 + 竿 + 水深。
 *
 * 钓力是「拉不拉得动」的门槛，不是加分：太重的鱼直接拉不上来，
 * 拉得动的里面挑最重的那条。所以新手在浅水只能钓些小的，
 * 好竿深水才请得动大鱼。
 */
export function pickPower(lv, tier, deep) {
  return lv * 0.6 + tier * 1.8 + (deep ? 3.5 : 0) + 1;
}

export function pickFish(deep, tier, lv, rand) {
  const power = pickPower(lv, tier, deep);
  let best = null, lightest = null;
  for (let i = 0; i < 6; i++) {
    const id = FISH_IDS[(rand() * FISH_IDS.length) | 0];
    const q = (ITEMS[id] && ITEMS[id].q) || 1;
    if (!lightest || q < lightest.q) lightest = { id, q };
    if (q > power + rand() * 3) continue;        // 这条太重，拉不上来
    if (!best || q > best.q) best = { id, q };
  }
  const pick = best || lightest;                 // 一条都拉不动，退而求其次
  return pick ? pick.id : FISH_IDS[0];
}

/** 返回一根钓竿的力气（没有竿就是 0 级） */
export function rodPower(rod) {
  return rod ? Math.max(1, rod.tier || 1) : 0;
}

/** 钓鱼状态机。rand 从外面注入，测试时可以给一个定值序列 */
export function createFishing(rand = Math.random) {
  return {
    phase: PHASE.IDLE,
    t: 0,
    dur: 0,
    tier: 1,
    lv: 1,
    deep: false,

    /** 抛竿，返回一句提示 */
    cast(tier, lv, deep) {
      this.phase = PHASE.CAST;
      this.t = 0;
      this.dur = CAST_TIME;
      this.tier = tier;
      this.lv = lv;
      this.deep = deep;
      return deep ? '向深处抛竿…' : '向水面抛竿…';
    },

    /** 按 E：咬钩时收竿得鱼，等鱼时收线，其余不算动作 */
    action() {
      if (this.phase === PHASE.BITE) {
        const fish = pickFish(this.deep, this.tier, this.lv, rand);
        this.phase = PHASE.IDLE;
        return { ev: 'catch', fish };
      }
      if (this.phase === PHASE.CAST || this.phase === PHASE.WAIT) {
        this.phase = PHASE.IDLE;
        return { ev: 'cancel' };
      }
      return { ev: 'none' };
    },

    /** 推进：返回 'bite'（咬钩）、'lost'（鱼跑了）或 null */
    tick(dt) {
      if (this.phase === PHASE.IDLE) return null;
      this.t += dt;
      if (this.phase === PHASE.CAST) {
        if (this.t < this.dur) return null;
        this.phase = PHASE.WAIT;
        this.t = 0;
        this.dur = waitTime(this.tier, this.lv, rand);
        return null;
      }
      if (this.phase === PHASE.WAIT) {
        if (this.t < this.dur) return null;
        this.phase = PHASE.BITE;
        this.t = 0;
        this.dur = biteWindow(this.tier, this.lv);
        return 'bite';
      }
      if (this.phase === PHASE.BITE) {
        if (this.t < this.dur) return null;
        this.phase = PHASE.IDLE;
        return 'lost';
      }
      return null;
    },

    /** 收工：走开了、开菜单了、钓鱼被中断 */
    idle() { this.phase = PHASE.IDLE; this.t = 0; },

    /** 给界面看的一句话 */
    hint() {
      if (this.phase === PHASE.CAST) return '抛竿…';
      if (this.phase === PHASE.WAIT) return '等鱼上钩…';
      if (this.phase === PHASE.BITE) return '咬钩了！按 E 收竿';
      return '';
    },
  };
}
