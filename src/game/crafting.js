// 合成配方（共 50 条）：材料全部来自采集，产出工具 / 建材 / 食药 / 护甲
// cat 用于面板分组：mat 材料 · tool 工具兵器 · build 营建 · food 食药 · armor 护甲
import {
  WOOD, BAMBOO, PLANK, STONE, TILE, WALL, LANTERN, TORCH, ORE_IRON, ORE_COAL,
  DIRT, SAND, LEAF_BAMBOO, BRICK, BEAM, WINDOW, MAT, BANNER, STONE_LAMP,
  EAVE, GLAZE_TILE, STELE, ROOF, GATE,
} from '../world/blocks.js';

export const STICK = 100, IRON = 101, BERRY = 103, MEAT = 104, CHARCOAL = 112,
  FIBER = 113, COOKED = 114, ROPE = 115, CLOTH = 116, STEW = 117, DRIED = 118,
  SALVE = 119, TEA = 120, WOOD_SHOVEL = 121, STONE_SHOVEL = 122, IRON_SHOVEL = 123,
  WOOD_SICKLE = 124, STONE_SICKLE = 125, IRON_SICKLE = 126, IRON_AXE = 127,
  RATTAN_ARMOR = 128, IRON_ARMOR = 129, GLAZE = 130, MORTAR = 131,
  PANACEA = 132, RATION = 133, HEAVY_ARMOR = 134;

export const CATEGORIES = [
  { key: 'mat', label: '材料加工' },
  { key: 'tool', label: '工具兵器' },
  { key: 'build', label: '屋宇营建' },
  { key: 'food', label: '饮食医药' },
  { key: 'armor', label: '护身' },
];

export const RECIPES = [
  // ---------- 材料加工（15） ----------
  { cat: 'mat', out: { id: PLANK, count: 4 }, in: { [WOOD]: 1 }, tip: '松木解板' },
  { cat: 'mat', out: { id: PLANK, count: 2 }, in: { [BAMBOO]: 1 }, tip: '劈竹为板' },
  { cat: 'mat', out: { id: STICK, count: 4 }, in: { [PLANK]: 2 }, tip: '削木棍' },
  { cat: 'mat', out: { id: CHARCOAL, count: 2 }, in: { [WOOD]: 1 }, tip: '炭窑烧制' },
  { cat: 'mat', out: { id: FIBER, count: 3 }, in: { [BAMBOO]: 1 }, tip: '剥竹纤维' },
  { cat: 'mat', out: { id: ROPE, count: 1 }, in: { [FIBER]: 3 }, tip: '三股搓绳' },
  { cat: 'mat', out: { id: CLOTH, count: 1 }, in: { [FIBER]: 4 }, tip: '织粗布' },
  { cat: 'mat', out: { id: BRICK, count: 4 }, in: { [DIRT]: 2, [CHARCOAL]: 1 }, tip: '砖窑烧青砖' },
  { cat: 'mat', out: { id: GLAZE, count: 1 }, in: { [SAND]: 2, [CHARCOAL]: 1 }, tip: '琉璃窑' },
  { cat: 'mat', out: { id: MORTAR, count: 2 }, in: { [STONE]: 2, [SAND]: 1 }, tip: '舂灰泥' },
  { cat: 'mat', out: { id: BEAM, count: 4 }, in: { [WOOD]: 2 }, tip: '大木作梁' },
  { cat: 'mat', out: { id: MAT, count: 2 }, in: { [BAMBOO]: 1, [FIBER]: 2 }, tip: '编竹席' },
  { cat: 'mat', out: { id: WINDOW, count: 2 }, in: { [PLANK]: 1, [FIBER]: 1 }, tip: '木格糊纸窗' },
  { cat: 'mat', out: { id: WALL, count: 4 }, in: { [PLANK]: 1, [STONE]: 2 }, tip: '夯土粉墙' },
  { cat: 'mat', out: { id: TILE, count: 4 }, in: { [STONE]: 2, [CHARCOAL]: 1 }, tip: '烧青瓦' },

  // ---------- 工具兵器（16） ----------
  { cat: 'tool', out: { id: IRON, count: 1 }, in: { [ORE_IRON]: 1, [CHARCOAL]: 1 }, tip: '简易冶炼' },
  { cat: 'tool', out: { id: 102, count: 1 }, in: { [PLANK]: 3, [STICK]: 2 }, tip: '木镐·可采石' },
  { cat: 'tool', out: { id: 111, count: 1 }, in: { [PLANK]: 3, [STICK]: 2 }, tip: '木斧·伐木快' },
  { cat: 'tool', out: { id: 110, count: 1 }, in: { [PLANK]: 2, [STICK]: 1 }, tip: '木剑·伤人 7' },
  { cat: 'tool', out: { id: WOOD_SHOVEL, count: 1 }, in: { [PLANK]: 1, [STICK]: 2 }, tip: '木铲·取土沙' },
  { cat: 'tool', out: { id: WOOD_SICKLE, count: 1 }, in: { [PLANK]: 1, [STICK]: 2 }, tip: '木镰·割草叶' },
  { cat: 'tool', out: { id: 107, count: 1 }, in: { [STONE]: 3, [STICK]: 2 }, tip: '石镐' },
  { cat: 'tool', out: { id: 105, count: 1 }, in: { [STONE]: 3, [STICK]: 2 }, tip: '石斧' },
  { cat: 'tool', out: { id: 109, count: 1 }, in: { [STONE]: 2, [STICK]: 1 }, tip: '石剑·伤人 11' },
  { cat: 'tool', out: { id: STONE_SHOVEL, count: 1 }, in: { [STONE]: 1, [STICK]: 2 }, tip: '石铲' },
  { cat: 'tool', out: { id: STONE_SICKLE, count: 1 }, in: { [STONE]: 1, [STICK]: 2 }, tip: '石镰' },
  { cat: 'tool', out: { id: 106, count: 1 }, in: { [IRON]: 3, [STICK]: 2 }, tip: '铁镐·可采铁矿' },
  { cat: 'tool', out: { id: IRON_AXE, count: 1 }, in: { [IRON]: 3, [STICK]: 2 }, tip: '铁斧' },
  { cat: 'tool', out: { id: 108, count: 1 }, in: { [IRON]: 2, [STICK]: 1 }, tip: '铁剑·伤人 16' },
  { cat: 'tool', out: { id: IRON_SHOVEL, count: 1 }, in: { [IRON]: 1, [STICK]: 2 }, tip: '铁铲' },
  { cat: 'tool', out: { id: IRON_SICKLE, count: 1 }, in: { [IRON]: 1, [STICK]: 2 }, tip: '铁镰' },

  // ---------- 屋宇营建（9） ----------
  { cat: 'build', out: { id: STELE, count: 1 }, in: { [STONE]: 3 }, tip: '立石碑' },
  { cat: 'build', out: { id: TORCH, count: 4 }, in: { [STICK]: 1, [ORE_COAL]: 1 }, tip: '火把·夜行照明' },
  { cat: 'build', out: { id: LANTERN, count: 1 }, in: { [PLANK]: 2, [CHARCOAL]: 1 }, tip: '灯笼·可挂檐下' },
  { cat: 'build', out: { id: STONE_LAMP, count: 1 }, in: { [STONE]: 3, [LANTERN]: 1 }, tip: '石灯·庭前照明' },
  { cat: 'build', out: { id: EAVE, count: 2 }, in: { [BEAM]: 1, [TILE]: 2 }, tip: '翘角飞檐' },
  { cat: 'build', out: { id: ROOF, count: 1 }, in: { [TILE]: 4, [BEAM]: 1 }, tip: '歇山顶' },
  { cat: 'build', out: { id: GLAZE_TILE, count: 2 }, in: { [TILE]: 2, [GLAZE]: 1 }, tip: '琉璃瓦·覆顶' },
  { cat: 'build', out: { id: BANNER, count: 1 }, in: { [CLOTH]: 1, [STICK]: 1 }, tip: '酒旗·招子' },
  { cat: 'build', out: { id: GATE, count: 1 }, in: { [BEAM]: 2, [BRICK]: 2 }, tip: '牌坊' },

  // ---------- 饮食医药（7） ----------
  { cat: 'food', out: { id: COOKED, count: 1 }, in: { [MEAT]: 1, [CHARCOAL]: 1 }, tip: '篝火炙肉' },
  { cat: 'food', out: { id: STEW, count: 1 }, in: { [COOKED]: 1, [BERRY]: 2 }, tip: '山珍炖肉·大补' },
  { cat: 'food', out: { id: DRIED, count: 2 }, in: { [BERRY]: 2, [CHARCOAL]: 1 }, tip: '烘果脯·耐存' },
  { cat: 'food', out: { id: TEA, count: 1 }, in: { [LEAF_BAMBOO]: 2, [BERRY]: 1 }, tip: '竹叶清茶' },
  { cat: 'food', out: { id: SALVE, count: 1 }, in: { [BERRY]: 1, [FIBER]: 2 }, tip: '草药膏·止血 35' },
  { cat: 'food', out: { id: PANACEA, count: 1 }, in: { [SALVE]: 2, [TEA]: 1 }, tip: '金疮药·回气 60' },
  { cat: 'food', out: { id: RATION, count: 1 }, in: { [COOKED]: 2, [DRIED]: 1 }, tip: '远行干粮' },

  // ---------- 护身（3） ----------
  { cat: 'armor', out: { id: RATTAN_ARMOR, count: 1 }, in: { [FIBER]: 6, [ROPE]: 2 }, tip: '藤甲·减伤 3' },
  { cat: 'armor', out: { id: IRON_ARMOR, count: 1 }, in: { [IRON]: 4, [CLOTH]: 2 }, tip: '铁甲·减伤 6' },
  { cat: 'armor', out: { id: HEAVY_ARMOR, count: 1 }, in: { [IRON_ARMOR]: 1, [IRON]: 4, [ROPE]: 2 }, tip: '重铠·减伤 9' },
];

export function canCraft(inv, r) {
  for (const k in r.in) {
    if (inv.count(Number(k)) < r.in[k]) return false;
  }
  return true;
}

export function craft(inv, r) {
  if (!canCraft(inv, r)) return false;
  for (const k in r.in) inv.remove(Number(k), r.in[k]);
  inv.add(r.out.id, r.out.count);
  return true;
}
