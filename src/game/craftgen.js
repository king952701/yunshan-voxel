// 制作十门，每门八十式：器型 × 材料，一共八百式。
// 产物与配方都是确定性生成的（同样的种子永远是同一套），所以不必落进仓库，
// 开局算一遍即可；产物的品级由材料品级决定，数值在生成时就折好了。
import { ITEMS, QUALITY, FISH_IDS, HERB_IDS } from '../core/items.js';
import { rand2 } from '../core/noise.js';

export const GEN_START = 363;   // 生成产物的起始 id
export const PER_SKILL = 80;    // 每门八十式

const mul = (q) => QUALITY[Math.min(9, Math.max(0, q - 1))].mul;
const tint = (q) => QUALITY[Math.min(9, Math.max(0, q - 1))].color;

// ------------------------------------------------------------------ 材料
const W_MATS = [
  { n: '木', id: 4, q: 2, tier: 1 },
  { n: '石', id: 3, q: 3, tier: 2 },
  { n: '铜', id: 137, q: 3, tier: 2 },
  { n: '锡', id: 138, q: 3, tier: 2 },
  { n: '铁', id: 101, q: 5, tier: 3 },
  { n: '玉', id: 135, q: 6, tier: 3 },
  { n: '玄铁', id: 148, q: 8, tier: 4 },
  { n: '灵石', id: 147, q: 8, tier: 4 },
];
const A_MATS = [
  { n: '藤', id: 113, q: 2 }, { n: '皮', id: 354, q: 3 }, { n: '布', id: 116, q: 3 },
  { n: '铜', id: 137, q: 3 }, { n: '铁', id: 101, q: 5 }, { n: '银', id: 146, q: 5 },
  { n: '玉', id: 135, q: 6 }, { n: '玄铁', id: 148, q: 8 }, { n: '灵石', id: 147, q: 8 },
  { n: '星砂', id: 151, q: 10 },
];
const GEMS = [
  { n: '水晶', id: 142, q: 4 }, { n: '玛瑙', id: 143, q: 5 }, { n: '银', id: 146, q: 5 },
  { n: '玉', id: 135, q: 6 }, { n: '金', id: 145, q: 6 }, { n: '翡翠', id: 144, q: 7 },
  { n: '血玉', id: 149, q: 9 }, { n: '星砂', id: 151, q: 10 },
];
const PIG_MATS = [
  { n: '青石', id: 3, q: 1 }, { n: '朱砂', id: 136, q: 3 }, { n: '雄黄', id: 139, q: 3 },
  { n: '硫磺', id: 140, q: 3 }, { n: '水晶', id: 142, q: 4 }, { n: '玛瑙', id: 143, q: 5 },
  { n: '银', id: 146, q: 5 }, { n: '金', id: 145, q: 6 }, { n: '翡翠', id: 144, q: 7 },
  { n: '血玉', id: 149, q: 9 },
];

// ------------------------------------------------------------------ 器型
const WEAPON_FORMS = [
  { n: '剑', kind: 'sword', pow: 12 }, { n: '刀', kind: 'sword', pow: 14 },
  { n: '枪', kind: 'sword', pow: 16 }, { n: '戟', kind: 'sword', pow: 18 },
  { n: '钺', kind: 'axe', pow: 15 }, { n: '锤', kind: 'sword', pow: 20 },
  { n: '鞭', kind: 'sword', pow: 13 }, { n: '锏', kind: 'sword', pow: 17 },
  { n: '弓', kind: 'sword', pow: 11 }, { n: '弩', kind: 'sword', pow: 12 },
];
const ARMOR_FORMS = [
  { n: '头巾', base: 2 }, { n: '护腕', base: 2 }, { n: '软甲', base: 4 }, { n: '锁甲', base: 6 },
  { n: '胸甲', base: 7 }, { n: '战靴', base: 3 }, { n: '护腿', base: 4 }, { n: '重铠', base: 9 },
];
const TOOL_FORMS = [
  { n: '镐', kind: 'pickaxe', s: 1.0 }, { n: '斧', kind: 'axe', s: 1.0 },
  { n: '铲', kind: 'shovel', s: 0.95 }, { n: '镰', kind: 'sickle', s: 0.95 },
  { n: '锯', kind: 'axe', s: 1.10 }, { n: '凿', kind: 'pickaxe', s: 0.90 },
  { n: '锄', kind: 'shovel', s: 0.90 }, { n: '耙', kind: 'sickle', s: 0.85 },
];
const BUILD_FORMS = [
  '青砖', '木梁', '纸窗', '竹席', '酒旗', '石灯', '飞檐', '琉璃瓦',
  '木箱', '石碑', '歇山顶', '牌坊', '石阶', '栏杆', '照壁', '水缸',
];
const BUILD_MATS = [
  { n: '木', id: 4, q: 2 }, { n: '石', id: 3, q: 3 }, { n: '砖', id: 21, q: 3 },
  { n: '铁', id: 101, q: 5 }, { n: '玉', id: 135, q: 6 },
];
const ORNA_FORMS = [
  '玉佩', '戒指', '项链', '耳坠', '发簪', '手镯', '腰牌', '香囊', '步摇', '护心镜',
];
const PILL_FORMS = [{ n: '丹', k: 1.0 }, { n: '散', k: 0.7 }];
const FOOD_FORMS = [
  { n: '炙', k: 1.2 }, { n: '炖', k: 1.6 }, { n: '蒸', k: 1.4 }, { n: '腌', k: 1.0 },
];
const LIQUOR_FORMS = [
  { n: '酒', food: 8, heal: 0 }, { n: '酿', food: 12, heal: 0 },
  { n: '露', food: 4, heal: 10 }, { n: '浆', food: 6, heal: 4 },
  { n: '酎', food: 16, heal: 0 },
];
const PIG_COLORS = ['红', '黄', '青', '绿', '白', '墨', '金', '紫'];
const TAL_FORMS = [
  '火符', '水符', '雷符', '风符', '土符', '木符', '金符', '光符', '暗符', '遁符',
  '隐符', '镇符', '辟邪符', '驱疫符', '安神符', '聚灵符', '引雷符', '御寒符', '清心符', '大力符',
];
const TAL_GRADES = [{ n: '黄', q: 3 }, { n: '朱', q: 5 }, { n: '紫', q: 7 }, { n: '金', q: 9 }];

// 食材：十六种鱼配四样常物
const FOOD_MATS = [
  ...FISH_IDS.slice(0, 16).map((id) => ({ n: ITEMS[id].name, id, q: ITEMS[id].q, food: ITEMS[id].food })),
  { n: '野果', id: 103, q: 1, food: ITEMS[103].food },
  { n: '生肉', id: 104, q: 1, food: ITEMS[104].food },
  { n: '烤肉', id: 114, q: 3, food: ITEMS[114].food },
  { n: '炖肉', id: 117, q: 4, food: ITEMS[117].food },
];

// ------------------------------------------------------------------ 生成
export const GEN_RECIPES = [];
export const GEN_IDS = [];

/** 一式的用料：主材按品级递减，另配辅料，偶尔再添一味 */
function costOf(id, cat, mats, q) {
  const r = (salt) => rand2(id, salt, 20261010);
  const mainN = Math.max(1, Math.min(6, Math.round(6 - q * 0.45)));
  const cost = { [mats.id]: mainN };
  const side = { weapon: 112, tool: 112, armor: 115, build: 131, ornament: 113, pill: 112, food: 112, liquor: 112, pigment: 131, talisman: 113 }[cat];
  cost[side] = 1 + Math.floor(r(2) * 3);
  if (r(3) < 0.35) cost[100] = 1 + Math.floor(r(4) * 2);   // 木棍：偶尔要个柄
  return cost;
}

let next = GEN_START;
const put = (cat, name, q, extra, mats, count, icon, stack) => {
  const id = next++;
  GEN_IDS.push(id);
  ITEMS[id] = Object.assign({
    name, q, icon, stack, color: tint(q), cat,
  }, extra);
  const cost = costOf(id, cat, mats, q);
  const bits = Object.keys(cost)
    .map((k) => `${ITEMS[Number(k)] ? ITEMS[Number(k)].name : k}×${cost[k]}`);
  GEN_RECIPES.push({
    cat, out: { id, count },
    in: cost,
    tip: `${bits.join('　')}　→　${name}`,
  });
  return id;
};

// 兵器：十种器型 × 八种材料
for (const f of WEAPON_FORMS) {
  for (const m of W_MATS) {
    const dmg = Math.round(f.pow * mul(m.q));
    put('weapon', m.n + f.n, m.q, {
      tool: { kind: f.kind, speed: Math.round((1.2 + m.tier * 0.75) * 10) / 10, tier: m.tier, damage: dmg },
    }, m, 1, '🗡️', 1);
  }
}
// 防具：八种部位 × 十种材料
for (const f of ARMOR_FORMS) {
  for (const m of A_MATS) {
    put('armor', m.n + f.n, m.q, { armor: Math.max(1, Math.round(f.base * mul(m.q))) }, m, 1, '🦺', 1);
  }
}
// 工具：八种器型 × 十种材料
for (const f of TOOL_FORMS) {
  for (const m of A_MATS) {
    const tier = Math.max(1, Math.min(4, Math.round(m.q / 2)));
    put('tool', m.n + f.n, m.q, {
      tool: { kind: f.kind, speed: Math.round((1.2 + tier * 0.75) * f.s * 10) / 10, tier },
    }, m, 1, '⛏️', 1);
  }
}
// 建材：十六种型 × 五种材料
for (const f of BUILD_FORMS) {
  for (const m of BUILD_MATS) {
    put('build', m.n + f, m.q, {}, m, 2 + Math.floor(rand2(next, 5, 1) * 3), '🧱', 64);
  }
}
// 饰品：十种饰型 × 八种宝石
for (const f of ORNA_FORMS) {
  for (const g of GEMS) {
    put('ornament', g.n + f, g.q, {}, g, 1, '💍', 1);
  }
}
// 丹药：四十味药 × 两种剂型
for (const herb of HERB_IDS.slice(0, 40)) {
  const hm = { n: ITEMS[herb].name, id: herb, q: ITEMS[herb].q };
  for (const f of PILL_FORMS) {
    put('pill', hm.n + f.n, hm.q, { heal: Math.max(5, Math.round(ITEMS[herb].heal * 3 * f.k)) }, hm, 2, '💊', 16);
  }
}
// 食物：二十种食材 × 四种做法
for (const m of FOOD_MATS) {
  for (const f of FOOD_FORMS) {
    put('food', m.n + f.n, m.q, { food: Math.max(4, Math.round(m.food * f.k)) }, m, 2, '🍲', 16);
  }
}
// 酒水：十六味药材 × 五种酒型
for (const herb of HERB_IDS.slice(0, 16)) {
  const hm = { n: ITEMS[herb].name, id: herb, q: ITEMS[herb].q };
  for (const f of LIQUOR_FORMS) {
    // 酒水除了垫肚子，主要用来解渴
    const extra = {
      food: Math.max(3, Math.round(f.food * mul(hm.q))),
      water: Math.max(8, Math.round((f.food * 2.4 + 8) * mul(hm.q))),
    };
    if (f.heal) extra.heal = Math.max(4, Math.round(f.heal * mul(hm.q)));
    put('liquor', hm.n + f.n, hm.q, extra, hm, 1, '🍶', 8);
  }
}
// 颜料：十种矿物 × 八种色系
for (const m of PIG_MATS) {
  for (const c of PIG_COLORS) {
    put('pigment', m.n + c, m.q, {}, m, 4, '🎨', 64);
  }
}
// 符箓：二十种符 × 四等品阶
for (const f of TAL_FORMS) {
  for (const g of TAL_GRADES) {
    put('talisman', g.n + f, g.q, {}, { id: 136, q: g.q }, 1, '🪬', 16);
  }
}

export const GEN_END = next - 1;
