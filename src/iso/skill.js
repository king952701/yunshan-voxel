// 技能：等级越高，同一件事做得越快。
// 采集 7 门 + 制作 10 门；目前「采矿」已接上，其余随采集点/配方逐批接入。
import { BASE_TIME } from './veins.js';

export const HAND_SPEED = 2.2;   // 以木镐为基准，徒手按木镐计

export const SKILLS = [
  // ---- 采集七门 ----
  { key: 'mining', name: '采矿', kind: 'gather', desc: '持镐开采露头的矿脉，等级越高挖得越快。' },
  { key: 'logging', name: '伐木', kind: 'gather', desc: '持斧伐松木与竹，等级越高出材越多。' },
  { key: 'herbal', name: '采药', kind: 'gather', desc: '在山坡林缘辨识草药，是炼丹的根基。' },
  { key: 'fishing', name: '垂钓', kind: 'gather', desc: '临水垂钓，鱼种按水域与时节分布。' },
  { key: 'hunting', name: '狩猎', kind: 'gather', desc: '追猎野兽取其皮肉，须有趁手兵器。' },
  { key: 'digging', name: '掘土', kind: 'gather', desc: '持铲掘土取沙泥，也是营建的第一步。' },
  { key: 'foraging', name: '拾荒', kind: 'gather', desc: '沿途拾取野果、菌菇与弃物。' },
  // ---- 制作十门 ----
  { key: 'weapon', name: '兵器', kind: 'craft', desc: '锻造刀剑枪棍，品级越高杀伤越大。' },
  { key: 'armor', name: '防具', kind: 'craft', desc: '铸甲制铠，藤甲、铁甲到重铠。' },
  { key: 'tool', name: '工具', kind: 'craft', desc: '镐斧铲镰，工具越好采得越快。' },
  { key: 'build', name: '建材', kind: 'craft', desc: '砖瓦梁枋，中式营造的一应物料。' },
  { key: 'ornament', name: '饰品', kind: 'craft', desc: '玉石金银的雕琢磨制。' },
  { key: 'pill', name: '丹药', kind: 'craft', desc: '炼制膏丹，疗伤与调息之用。' },
  { key: 'food', name: '食物', kind: 'craft', desc: '烹饪炙炖腌渍，行旅的口粮。' },
  { key: 'liquor', name: '酒水', kind: 'craft', desc: '酿造茶酒，佐餐亦可行气。' },
  { key: 'pigment', name: '颜料', kind: 'craft', desc: '朱砂雄黄入料，书画与彩绘所需。' },
  { key: 'talisman', name: '符箓', kind: 'craft', desc: '以灵矿为引画符，镇邪护身。' },
];

export const GATHER_SKILLS = SKILLS.filter((s) => s.kind === 'gather');
export const CRAFT_SKILLS = SKILLS.filter((s) => s.kind === 'craft');
export const SKILL_BY_KEY = new Map(SKILLS.map((s) => [s.key, s]));

/** 一次采集要多久：基础 5 秒，技能等级与镐的速度都会缩短，最短 1.2 秒 */
export function gatherTime(skills, k, toolSpeed) {
  const s = toolSpeed || HAND_SPEED;
  return Math.max(1.2, BASE_TIME * skills.timeMul(k) * (HAND_SPEED / s));
}

export class Skills {
  constructor() {
    this.lv = {};
    this.xp = {};
    for (const s of SKILLS) { this.lv[s.key] = 1; this.xp[s.key] = 0; }
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
