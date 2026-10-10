// 方块与物品的纯数据表：不依赖 three，因此 3D 体素版与 2.5D 长卷版共用同一套物品、同一份配方。
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5,
  WOOD = 6, BAMBOO = 7, LEAF_BAMBOO = 8, LEAF_PINE = 9, PLANK = 10, TILE = 11,
  WALL = 12, LANTERN = 13, ORE_IRON = 14, ORE_COAL = 15, SNOW = 16, GRAVEL = 17,
  BERRY = 18, TORCH = 19,
  BRICK = 20, BEAM = 21, WINDOW = 22, MAT = 23, BANNER = 24, STONE_LAMP = 25,
  EAVE = 26, GLAZE_TILE = 27, CRATE = 28, STELE = 29, ROOF = 30, GATE = 31;

// tiles: [side, top, bottom] 在贴图集中的编号（仅 3D 版使用）
export const BLOCKS = [
  { id: AIR, name: '空气', solid: false, opaque: false, light: false, hard: 0, tiles: null },
  { id: GRASS, name: '草地', solid: true, opaque: true, light: false, hard: 0.6, tiles: [1, 0, 2], drop: DIRT },
  // 泥土/沙/碎石需铲，否则挖不动料；徒手可挖但慢且不掉
  { id: DIRT, name: '泥土', solid: true, opaque: true, light: false, hard: 0.6, tiles: [2, 2, 2], drop: DIRT, needTool: 'shovel' },
  { id: STONE, name: '岩石', solid: true, opaque: true, light: false, hard: 2.2, tiles: [3, 3, 3], drop: STONE, needTool: 'pickaxe' },
  { id: SAND, name: '沙', solid: true, opaque: true, light: false, hard: 0.5, tiles: [4, 4, 4], drop: SAND, needTool: 'shovel' },
  { id: WATER, name: '水', solid: false, opaque: false, light: false, hard: 0, tiles: [5, 5, 5] },
  // 徒手可伐木（慢），有斧才快——保证开局不会卡死
  { id: WOOD, name: '松木', solid: true, opaque: true, light: false, hard: 2.4, tiles: [6, 6, 6], drop: WOOD },
  { id: BAMBOO, name: '竹', solid: true, opaque: true, light: false, hard: 1.6, tiles: [7, 7, 7], drop: BAMBOO },
  { id: LEAF_BAMBOO, name: '竹叶', solid: true, opaque: false, light: false, hard: 0.25, tiles: [8, 8, 8], drop: LEAF_BAMBOO },
  { id: LEAF_PINE, name: '松针', solid: true, opaque: false, light: false, hard: 0.25, tiles: [9, 9, 9], drop: LEAF_PINE },
  { id: PLANK, name: '木板', solid: true, opaque: true, light: false, hard: 1.0, tiles: [10, 10, 10], drop: PLANK, needTool: 'axe' },
  { id: TILE, name: '青瓦', solid: true, opaque: true, light: false, hard: 1.8, tiles: [11, 11, 11], drop: TILE, needTool: 'pickaxe' },
  { id: WALL, name: '粉墙', solid: true, opaque: true, light: false, hard: 1.2, tiles: [12, 12, 12], drop: WALL, needTool: 'pickaxe' },
  { id: LANTERN, name: '灯笼', solid: true, opaque: true, light: true, hard: 0.4, tiles: [13, 13, 13], drop: LANTERN },
  { id: ORE_IRON, name: '铁矿', solid: true, opaque: true, light: false, hard: 3.0, tiles: [14, 14, 14], drop: ORE_IRON, needTool: 'pickaxe' },
  { id: ORE_COAL, name: '煤矿', solid: true, opaque: true, light: false, hard: 2.6, tiles: [15, 15, 15], drop: ORE_COAL, needTool: 'pickaxe' },
  { id: SNOW, name: '积雪', solid: true, opaque: true, light: false, hard: 0.4, tiles: [16, 16, 16], drop: SNOW },
  { id: GRAVEL, name: '碎石', solid: true, opaque: true, light: false, hard: 0.8, tiles: [17, 17, 17], drop: GRAVEL, needTool: 'shovel' },
  { id: BERRY, name: '野果丛', solid: true, opaque: false, light: false, hard: 0.2, tiles: [18, 18, 18], drop: 103 },
  { id: TORCH, name: '火把', solid: false, opaque: false, light: true, hard: 0.1, tiles: [19, 19, 19], drop: TORCH },
  // ---- 可自建的中式建材 ----
  { id: BRICK, name: '青砖', solid: true, opaque: true, light: false, hard: 1.6, tiles: [20, 20, 20], drop: BRICK, needTool: 'pickaxe' },
  { id: BEAM, name: '木梁', solid: true, opaque: true, light: false, hard: 1.2, tiles: [21, 21, 21], drop: BEAM, needTool: 'axe' },
  { id: WINDOW, name: '纸窗', solid: true, opaque: true, light: false, hard: 0.3, tiles: [22, 22, 22], drop: WINDOW },
  { id: MAT, name: '竹席', solid: true, opaque: true, light: false, hard: 0.4, tiles: [23, 23, 23], drop: MAT },
  { id: BANNER, name: '酒旗', solid: false, opaque: false, light: false, hard: 0.1, tiles: [24, 24, 24], drop: BANNER },
  { id: STONE_LAMP, name: '石灯', solid: true, opaque: true, light: true, hard: 1.4, tiles: [25, 25, 25], drop: STONE_LAMP, needTool: 'pickaxe' },
  { id: EAVE, name: '飞檐', solid: true, opaque: true, light: false, hard: 1.4, tiles: [26, 26, 26], drop: EAVE, needTool: 'pickaxe' },
  { id: GLAZE_TILE, name: '琉璃瓦', solid: true, opaque: true, light: false, hard: 1.8, tiles: [27, 27, 27], drop: GLAZE_TILE, needTool: 'pickaxe' },
  { id: CRATE, name: '木箱', solid: true, opaque: true, light: false, hard: 1.0, tiles: [28, 28, 28], drop: CRATE, needTool: 'axe' },
  { id: STELE, name: '石碑', solid: true, opaque: true, light: false, hard: 2.0, tiles: [29, 29, 29], drop: STELE, needTool: 'pickaxe' },
  { id: ROOF, name: '歇山顶', solid: true, opaque: true, light: false, hard: 1.4, tiles: [30, 30, 30], drop: ROOF, needTool: 'pickaxe' },
  { id: GATE, name: '牌坊', solid: true, opaque: true, light: false, hard: 1.6, tiles: [31, 31, 31], drop: GATE, needTool: 'pickaxe' },
];

// 非方块类物品的 id 常量（与上方 ITEMS 表一一对应）
// 注意：BERRY 已是「野果丛」方块(18)，所以「野果」这个物品叫 BERRY_FRUIT
export const STICK = 100, IRON = 101, BERRY_FRUIT = 103, MEAT = 104, CHARCOAL = 112,
  FIBER = 113, COOKED = 114, ROPE = 115, CLOTH = 116, STEW = 117, DRIED = 118,
  SALVE = 119, TEA = 120, WOOD_SHOVEL = 121, STONE_SHOVEL = 122, IRON_SHOVEL = 123,
  WOOD_SICKLE = 124, STONE_SICKLE = 125, IRON_SICKLE = 126, IRON_AXE = 127,
  RATTAN_ARMOR = 128, IRON_ARMOR = 129, GLAZE = 130, MORTAR = 131,
  PANACEA = 132, RATION = 133, HEAVY_ARMOR = 134;

/** 非方块类物品（工具、材料、食物）。q = 品级 1~10，攻防与效力按品级折算 */
export const ITEMS = {
  100: { name: '木棍', stack: 64, icon: '🥢', color: '#a3703a', q: 2 },
  101: { name: '铁锭', stack: 64, icon: '⚙️', color: '#cfd6dc', q: 4 },
  102: { name: '木镐', stack: 1, icon: '⛏️', color: '#a3703a', q: 2, tool: { kind: 'pickaxe', speed: 2.2, tier: 1 } },
  103: { name: '野果', stack: 32, icon: '🫐', color: '#7a4bd0', q: 1, food: 6 },
  104: { name: '生肉', stack: 32, icon: '🍖', color: '#c05a4e', q: 1, food: 14 },
  105: { name: '石斧', stack: 1, icon: '🪓', color: '#8d949c', q: 3, tool: { kind: 'axe', speed: 2.6, tier: 2 } },
  106: { name: '铁镐', stack: 1, icon: '⛏️', color: '#cfd6dc', q: 5, tool: { kind: 'pickaxe', speed: 4.5, tier: 3 } },
  107: { name: '石镐', stack: 1, icon: '⛏️', color: '#8d949c', q: 3, tool: { kind: 'pickaxe', speed: 3.2, tier: 2 } },
  108: { name: '铁剑', stack: 1, icon: '🗡️', color: '#dfe6ec', q: 6, tool: { kind: 'sword', speed: 1.4, tier: 3, damage: 16 } },
  109: { name: '石剑', stack: 1, icon: '🗡️', color: '#9aa1a9', q: 4, tool: { kind: 'sword', speed: 1.2, tier: 2, damage: 11 } },
  110: { name: '木剑', stack: 1, icon: '🗡️', color: '#a3703a', q: 2, tool: { kind: 'sword', speed: 1.0, tier: 1, damage: 7 } },
  111: { name: '木斧', stack: 1, icon: '🪓', color: '#a3703a', q: 2, tool: { kind: 'axe', speed: 2.0, tier: 1 } },
  112: { name: '木炭', stack: 64, icon: '⬛', color: '#2e2e2e', q: 1 },
  113: { name: '竹纤维', stack: 64, icon: '🧵', color: '#9ccf6a', q: 1 },
  114: { name: '烤肉', stack: 32, icon: '🍗', color: '#c8794a', q: 3, food: 38 },
  115: { name: '绳索', stack: 64, icon: '🪢', color: '#b59b6a', q: 2 },
  116: { name: '粗布', stack: 64, icon: '🧣', color: '#ddd0b8', q: 2 },
  117: { name: '炖肉', stack: 16, icon: '🍲', color: '#a8623c', q: 4, food: 65 },
  118: { name: '果脯', stack: 32, icon: '🫒', color: '#a05fb0', q: 2, food: 16 },
  119: { name: '草药膏', stack: 16, icon: '🌿', color: '#6fbf5a', q: 3, heal: 35 },
  120: { name: '清茶', stack: 16, icon: '🍵', color: '#9fc98a', q: 3, food: 6, heal: 12 },
  121: { name: '木铲', stack: 1, icon: '🥄', color: '#a3703a', q: 2, tool: { kind: 'shovel', speed: 2.0, tier: 1 } },
  122: { name: '石铲', stack: 1, icon: '🥄', color: '#8d949c', q: 3, tool: { kind: 'shovel', speed: 3.0, tier: 2 } },
  123: { name: '铁铲', stack: 1, icon: '🥄', color: '#cfd6dc', q: 5, tool: { kind: 'shovel', speed: 4.2, tier: 3 } },
  124: { name: '木镰', stack: 1, icon: '🌾', color: '#a3703a', q: 2, tool: { kind: 'sickle', speed: 2.0, tier: 1 } },
  125: { name: '石镰', stack: 1, icon: '🌾', color: '#8d949c', q: 3, tool: { kind: 'sickle', speed: 3.0, tier: 2 } },
  126: { name: '铁镰', stack: 1, icon: '🌾', color: '#cfd6dc', q: 5, tool: { kind: 'sickle', speed: 4.2, tier: 3 } },
  127: { name: '铁斧', stack: 1, icon: '🪓', color: '#cfd6dc', q: 5, tool: { kind: 'axe', speed: 4.5, tier: 3 } },
  128: { name: '藤甲', stack: 1, icon: '🦺', color: '#8a6a4a', q: 3, armor: 3 },
  129: { name: '铁甲', stack: 1, icon: '🦺', color: '#cfd6dc', q: 5, armor: 6 },
  130: { name: '琉璃', stack: 64, icon: '💠', color: '#4a9ab0', q: 4 },
  131: { name: '灰泥', stack: 64, icon: '🧱', color: '#cfc7b8', q: 2 },
  132: { name: '金疮药', stack: 16, icon: '🧪', color: '#d84a6a', q: 5, heal: 60 },
  133: { name: '干粮', stack: 16, icon: '🍱', color: '#c9a05a', q: 3, food: 80 },
  134: { name: '重铠', stack: 1, icon: '🦺', color: '#8e97a3', q: 6, armor: 9 },
  // ---- 矿脉产出：埋在地表之下，须持矿镐开采 ----
  135: { name: '玉石', stack: 64, icon: '🟩', color: '#6fc7a8', q: 6 },
  136: { name: '朱砂', stack: 64, icon: '🟥', color: '#c0392b', q: 3 },
  137: { name: '铜矿', stack: 64, icon: '🟧', color: '#b87333', q: 2 },
  138: { name: '锡矿', stack: 64, icon: '🟪', color: '#b0b7bd', q: 2 },
  139: { name: '雄黄', stack: 64, icon: '🟨', color: '#e0a02a', q: 3 },
  140: { name: '硫磺', stack: 64, icon: '🟡', color: '#d9c94a', q: 3 },
  141: { name: '井盐', stack: 64, icon: '⚪', color: '#e8e2d6', q: 2 },
  142: { name: '水晶', stack: 64, icon: '🔹', color: '#a8d8e8', q: 4 },
  143: { name: '玛瑙', stack: 64, icon: '🔶', color: '#c0603a', q: 5 },
  144: { name: '翡翠', stack: 64, icon: '🟢', color: '#2fae7a', q: 7 },
  145: { name: '金矿', stack: 64, icon: '🥇', color: '#f2c94a', q: 6 },
  146: { name: '银矿', stack: 64, icon: '🥈', color: '#dfe4ea', q: 5 },
  // ---- 灵矿：罕见，高阶器物与符箓的根基 ----
  147: { name: '灵石', stack: 64, icon: '💎', color: '#7fd0ff', q: 8 },
  148: { name: '玄铁', stack: 64, icon: '🔘', color: '#4a5a72', q: 8 },
  149: { name: '血玉', stack: 64, icon: '❤️', color: '#b02a3a', q: 9 },
  150: { name: '雷晶', stack: 64, icon: '🌀', color: '#9a7fe8', q: 9 },
  151: { name: '星砂', stack: 64, icon: '✨', color: '#e8d8ff', q: 10 },
};

/**
 * 十阶品级。品级不只是标签：攻防、回复、效力都按 mul 折算，
 * 所以仙品的铁剑确实比凡品的铁剑强得多。
 */
export const QUALITY = [
  { tier: 1, name: '粗品', color: '#8a8f98', mul: 0.70 },
  { tier: 2, name: '凡品', color: '#9aa7b0', mul: 0.80 },
  { tier: 3, name: '常品', color: '#7fb069', mul: 0.90 },
  { tier: 4, name: '良品', color: '#4f9fd4', mul: 1.00 },
  { tier: 5, name: '上品', color: '#7f6bd6', mul: 1.12 },
  { tier: 6, name: '精品', color: '#b06bd6', mul: 1.26 },
  { tier: 7, name: '极品', color: '#d4a13a', mul: 1.42 },
  { tier: 8, name: '绝品', color: '#e0663a', mul: 1.60 },
  { tier: 9, name: '神品', color: '#d94f6a', mul: 1.82 },
  { tier: 10, name: '仙品', color: '#6fe3d0', mul: 2.10 },
];

export function qualityOf(id) {
  const it = ITEMS[id];
  if (!it || !it.q) return QUALITY[0];
  return QUALITY[Math.max(0, Math.min(9, it.q - 1))];
}

// 把品级折进数值：表里写的是基准值，这里一次性折成玩家拿到手的最终值，
// 3D 与 2.5D 读到的都已是含品级的数，不必各自再算一遍。
for (const it of Object.values(ITEMS)) {
  const m = QUALITY[Math.max(0, Math.min(9, (it.q || 1) - 1))].mul;
  if (it.armor != null) it.armor = Math.round(it.armor * m);
  if (it.food != null) it.food = Math.round(it.food * m);
  if (it.heal != null) it.heal = Math.round(it.heal * m);
  if (it.tool && it.tool.damage != null) it.tool.damage = Math.round(it.tool.damage * m);
}

// 每种方块的代表色（用于 UI 与 2.5D 长卷着色）
const BASE_COLORS = {
  0: 0x000000, 1: 0x4f8f36, 2: 0x7a5a3a, 3: 0x8d949c, 4: 0xd9c88f, 5: 0x3f7fbf,
  6: 0x6b4a2a, 7: 0x86bf4e, 8: 0x5aa33a, 9: 0x2f6b3a, 10: 0xb08247, 11: 0x46535e,
  12: 0xe8e3d3, 13: 0xff8a3d, 14: 0x9a8b7a, 15: 0x6e6e6e, 16: 0xf2f6fa, 17: 0x9b8f83,
  18: 0x4a8f3a, 19: 0xffb347,
  20: 0x6b7078, 21: 0x7a5636, 22: 0xf0e3c2, 23: 0xc9a86a, 24: 0xb03a3a, 25: 0x9aa0a6,
  26: 0x3f4b56, 27: 0x2f8f8a, 28: 0x9a6f42, 29: 0x7d838a, 30: 0x4a5866, 31: 0xa33b2f,
};

export function blockBaseColor(id) {
  return BASE_COLORS[id] || 0x888888;
}

export function itemName(id) {
  if (id < 100) return BLOCKS[id] ? BLOCKS[id].name : '?';
  const it = ITEMS[id];
  return it ? it.name : '?';
}

export function itemIcon(id) {
  if (id < 100) return null;
  const it = ITEMS[id];
  return it ? it.icon : '❔';
}

export function itemColor(id) {
  if (id < 100) return '#' + blockBaseColor(id).toString(16).padStart(6, '0');
  const it = ITEMS[id];
  return it ? it.color : '#888';
}
