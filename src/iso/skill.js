// 技能：等级越高，同一件事做得越快。先只开「采矿」，后面 15 类生活/战斗技能照这个骨架扩。
import { BASE_TIME } from './veins.js';

export const HAND_SPEED = 2.2;   // 以木镐为基准，徒手按木镐计

/** 一次采集要多久：基础 5 秒，技能等级与镐的速度都会缩短，最短 1.2 秒 */
export function gatherTime(skills, k, toolSpeed) {
  const s = toolSpeed || HAND_SPEED;
  return Math.max(1.2, BASE_TIME * skills.timeMul(k) * (HAND_SPEED / s));
}
export class Skills {
  constructor() {
    this.lv = { mining: 1 };
    this.xp = { mining: 0 };
  }

  /** 从 lv 升到 lv+1 所需经验 */
  static need(lv) { return Math.round(50 * Math.pow(lv, 1.6)); }

  gain(k, n) {
    if (!this.lv[k]) { this.lv[k] = 1; this.xp[k] = 0; }
    this.xp[k] += n;
    let up = 0;
    while (this.xp[k] >= Skills.need(this.lv[k])) {
      this.xp[k] -= Skills.need(this.lv[k]);
      this.lv[k]++;
      up++;
    }
    return up;
  }

  level(k) { return this.lv[k] || 1; }
  exp(k) { return this.xp[k] || 0; }
  needNext(k) { return Skills.need(this.level(k)); }

  /** 等级带来的提速：1 级 1.0，10 级约 0.48 */
  timeMul(k) { return 1 / (1 + (this.level(k) - 1) * 0.12); }
}
