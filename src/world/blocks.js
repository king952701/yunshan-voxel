// 方块定义 + 程序化像素贴图集（无任何外部图片资源，全部用 canvas 现画）
import * as THREE from 'three';
import { rand2 } from '../core/noise.js';

export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5,
  WOOD = 6, BAMBOO = 7, LEAF_BAMBOO = 8, LEAF_PINE = 9, PLANK = 10, TILE = 11,
  WALL = 12, LANTERN = 13, ORE_IRON = 14, ORE_COAL = 15, SNOW = 16, GRAVEL = 17,
  BERRY = 18, TORCH = 19,
  BRICK = 20, BEAM = 21, WINDOW = 22, MAT = 23, BANNER = 24, STONE_LAMP = 25,
  EAVE = 26, GLAZE_TILE = 27, CRATE = 28, STELE = 29, ROOF = 30, GATE = 31;

// tiles: [side, top, bottom] 在贴图集中的编号
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

/** 非方块类物品（工具、材料、食物） */
export const ITEMS = {
  100: { name: '木棍', stack: 64, icon: '🥢', color: '#a3703a' },
  101: { name: '铁锭', stack: 64, icon: '⚙️', color: '#cfd6dc' },
  102: { name: '木镐', stack: 1, icon: '⛏️', color: '#a3703a', tool: { kind: 'pickaxe', speed: 2.2, tier: 1 } },
  103: { name: '野果', stack: 32, icon: '🫐', color: '#7a4bd0', food: 6 },
  104: { name: '生肉', stack: 32, icon: '🍖', color: '#c05a4e', food: 14 },
  105: { name: '石斧', stack: 1, icon: '🪓', color: '#8d949c', tool: { kind: 'axe', speed: 2.6, tier: 2 } },
  106: { name: '铁镐', stack: 1, icon: '⛏️', color: '#cfd6dc', tool: { kind: 'pickaxe', speed: 4.5, tier: 3 } },
  107: { name: '石镐', stack: 1, icon: '⛏️', color: '#8d949c', tool: { kind: 'pickaxe', speed: 3.2, tier: 2 } },
  108: { name: '铁剑', stack: 1, icon: '🗡️', color: '#dfe6ec', tool: { kind: 'sword', speed: 1.4, tier: 3, damage: 16 } },
  109: { name: '石剑', stack: 1, icon: '🗡️', color: '#9aa1a9', tool: { kind: 'sword', speed: 1.2, tier: 2, damage: 11 } },
  110: { name: '木剑', stack: 1, icon: '🗡️', color: '#a3703a', tool: { kind: 'sword', speed: 1.0, tier: 1, damage: 7 } },
  111: { name: '木斧', stack: 1, icon: '🪓', color: '#a3703a', tool: { kind: 'axe', speed: 2.0, tier: 1 } },
  112: { name: '木炭', stack: 64, icon: '⬛', color: '#2e2e2e' },
  113: { name: '竹纤维', stack: 64, icon: '🧵', color: '#9ccf6a' },
  114: { name: '烤肉', stack: 32, icon: '🍗', color: '#c8794a', food: 38 },
  115: { name: '绳索', stack: 64, icon: '🪢', color: '#b59b6a' },
  116: { name: '粗布', stack: 64, icon: '🧣', color: '#ddd0b8' },
  117: { name: '炖肉', stack: 16, icon: '🍲', color: '#a8623c', food: 65 },
  118: { name: '果脯', stack: 32, icon: '🫒', color: '#a05fb0', food: 16 },
  119: { name: '草药膏', stack: 16, icon: '🌿', color: '#6fbf5a', heal: 35 },
  120: { name: '清茶', stack: 16, icon: '🍵', color: '#9fc98a', food: 6, heal: 12 },
  121: { name: '木铲', stack: 1, icon: '🥄', color: '#a3703a', tool: { kind: 'shovel', speed: 2.0, tier: 1 } },
  122: { name: '石铲', stack: 1, icon: '🥄', color: '#8d949c', tool: { kind: 'shovel', speed: 3.0, tier: 2 } },
  123: { name: '铁铲', stack: 1, icon: '🥄', color: '#cfd6dc', tool: { kind: 'shovel', speed: 4.2, tier: 3 } },
  124: { name: '木镰', stack: 1, icon: '🌾', color: '#a3703a', tool: { kind: 'sickle', speed: 2.0, tier: 1 } },
  125: { name: '石镰', stack: 1, icon: '🌾', color: '#8d949c', tool: { kind: 'sickle', speed: 3.0, tier: 2 } },
  126: { name: '铁镰', stack: 1, icon: '🌾', color: '#cfd6dc', tool: { kind: 'sickle', speed: 4.2, tier: 3 } },
  127: { name: '铁斧', stack: 1, icon: '🪓', color: '#cfd6dc', tool: { kind: 'axe', speed: 4.5, tier: 3 } },
  128: { name: '藤甲', stack: 1, icon: '🦺', color: '#8a6a4a', armor: 3 },
  129: { name: '铁甲', stack: 1, icon: '🦺', color: '#cfd6dc', armor: 6 },
  130: { name: '琉璃', stack: 64, icon: '💠', color: '#4a9ab0' },
  131: { name: '灰泥', stack: 64, icon: '🧱', color: '#cfc7b8' },
  132: { name: '金疮药', stack: 16, icon: '🧪', color: '#d84a6a', heal: 60 },
  133: { name: '干粮', stack: 16, icon: '🍱', color: '#c9a05a', food: 80 },
  134: { name: '重铠', stack: 1, icon: '🦺', color: '#8e97a3', armor: 9 },
};

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

// 每种方块的代表色（用于 UI 与顶点着色基准）
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

// ---------------------------------------------------------------------------
// 程序化像素贴图集：32 个 tile，每个 16x16，排成 6x6（留出空位便于扩展）
// ---------------------------------------------------------------------------
const TILE_SIZE = 16;
const ATLAS_COLS = 6;
const ATLAS_ROWS = 6;

function px(ctx, x, y, css) {
  ctx.fillStyle = css;
  ctx.fillRect(x, y, 1, 1);
}

function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

/** 用确定性随机给一块区域铺满带明暗颗粒的像素 */
function noiseFill(ctx, ox, oy, baseHex, amount, seed, size = TILE_SIZE) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = rand2(ox + x, oy + y, seed);
      const f = 1 - amount * 0.5 + r * amount;
      px(ctx, ox + x, oy + y, shade(baseHex, f));
    }
  }
}

function drawTile(ctx, index, painter) {
  const col = index % ATLAS_COLS, row = Math.floor(index / ATLAS_COLS);
  const ox = col * TILE_SIZE, oy = row * TILE_SIZE;
  painter(ctx, ox, oy);
}

export function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE_SIZE;
  canvas.height = ATLAS_ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 0 草顶：高亮绿颗粒（最终颜色由顶点色按海拔渐变相乘）
  drawTile(ctx, 0, (c, ox, oy) => noiseFill(c, ox, oy, 0x8fd06a, 0.55, 11));
  // 1 草侧：上部草、下部土
  drawTile(ctx, 1, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x7a5a3a, 0.4, 22);
    for (let x = 0; x < TILE_SIZE; x++) {
      const lip = 3 + Math.floor(rand2(x, 0, 77) * 2.4);
      for (let y = 0; y < lip; y++) px(c, ox + x, oy + y, shade(0x8fd06a, 0.85 + rand2(x, y, 5) * 0.3));
    }
  });
  // 2 泥土
  drawTile(ctx, 2, (c, ox, oy) => noiseFill(c, ox, oy, 0x7a5a3a, 0.45, 33));
  // 3 岩石：灰底 + 深色裂纹
  drawTile(ctx, 3, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x8d949c, 0.4, 44);
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rand2(i, 1, 91) * TILE_SIZE), y = Math.floor(rand2(i, 2, 92) * TILE_SIZE);
      px(c, ox + x, oy + y, shade(0x8d949c, 0.7));
    }
  });
  // 4 沙
  drawTile(ctx, 4, (c, ox, oy) => noiseFill(c, ox, oy, 0xd9c88f, 0.3, 55));
  // 5 水
  drawTile(ctx, 5, (c, ox, oy) => noiseFill(c, ox, oy, 0x3f8fd0, 0.35, 66));
  // 6 松木：竖纹
  drawTile(ctx, 6, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x6b4a2a, 0.35, 77);
    for (let x = 0; x < TILE_SIZE; x++) {
      if (rand2(x, 3, 88) < 0.35) {
        for (let y = 0; y < TILE_SIZE; y++) px(c, ox + x, oy + y, shade(0x6b4a2a, 0.78));
      }
    }
  });
  // 7 竹：青绿 + 竹节
  drawTile(ctx, 7, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x86bf4e, 0.3, 99);
    for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + 5, shade(0x86bf4e, 0.72));
    for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + 11, shade(0x86bf4e, 0.72));
  });
  // 8 竹叶：稀疏叶片颗粒
  drawTile(ctx, 8, (c, ox, oy) => {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const r = rand2(x + 40, y, 121);
        px(c, ox + x, oy + y, r < 0.22 ? 'rgba(0,0,0,0)' : shade(0x5aa33a, 0.75 + r * 0.5));
      }
    }
  });
  // 9 松针
  drawTile(ctx, 9, (c, ox, oy) => noiseFill(c, ox, oy, 0x2f6b3a, 0.6, 131));
  // 10 木板：横纹 + 缝
  drawTile(ctx, 10, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0xb08247, 0.3, 141);
    for (let y = 0; y < TILE_SIZE; y++) if (y % 5 === 0) for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + y, shade(0xb08247, 0.7));
  });
  // 11 青瓦：瓦垄竖线
  drawTile(ctx, 11, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x46535e, 0.35, 151);
    for (let x = 0; x < TILE_SIZE; x += 4) {
      for (let y = 0; y < TILE_SIZE; y++) px(c, ox + x, oy + y, shade(0x46535e, 0.7));
      for (let y = 0; y < TILE_SIZE; y++) px(c, ox + x + 3, oy + y, shade(0x46535e, 1.25));
    }
  });
  // 12 粉墙：米白 + 斑驳
  drawTile(ctx, 12, (c, ox, oy) => noiseFill(c, ox, oy, 0xe8e3d3, 0.18, 161));
  // 13 灯笼：橙红发光
  drawTile(ctx, 13, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0xff8a3d, 0.35, 171);
    for (let y = 3; y < 13; y++) { px(c, ox + 2, oy + y, shade(0xffd08a, 1.0)); px(c, ox + 13, oy + y, shade(0xffd08a, 1.0)); }
  });
  // 14 铁矿：石底 + 橙斑
  drawTile(ctx, 14, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x9a8b7a, 0.4, 181);
    for (let i = 0; i < 8; i++) {
      const x = 2 + Math.floor(rand2(i, 5, 191) * 12), y = 2 + Math.floor(rand2(i, 6, 192) * 12);
      px(c, ox + x, oy + y, shade(0xd08a4a, 1.0));
      px(c, ox + x + 1, oy + y, shade(0xd08a4a, 0.85));
    }
  });
  // 15 煤矿：石底 + 黑斑
  drawTile(ctx, 15, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x8d949c, 0.4, 201);
    for (let i = 0; i < 8; i++) {
      const x = 2 + Math.floor(rand2(i, 7, 211) * 12), y = 2 + Math.floor(rand2(i, 8, 212) * 12);
      px(c, ox + x, oy + y, shade(0x2b2b2b, 1.0));
      px(c, ox + x + 1, oy + y, shade(0x2b2b2b, 1.2));
    }
  });
  // 16 积雪
  drawTile(ctx, 16, (c, ox, oy) => noiseFill(c, ox, oy, 0xf2f6fa, 0.16, 221));
  // 17 碎石
  drawTile(ctx, 17, (c, ox, oy) => noiseFill(c, ox, oy, 0x9b8f83, 0.5, 231));
  // 18 野果丛：绿叶 + 红果
  drawTile(ctx, 18, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x4a8f3a, 0.55, 241);
    for (let i = 0; i < 6; i++) {
      const x = 1 + Math.floor(rand2(i, 9, 251) * 14), y = 1 + Math.floor(rand2(i, 10, 252) * 14);
      px(c, ox + x, oy + y, shade(0x8a3ad0, 1.0));
      px(c, ox + x, oy + y + 1, shade(0x8a3ad0, 0.8));
    }
  });
  // 19 火把：木柄 + 火苗
  drawTile(ctx, 19, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x6b4a2a, 0.3, 261);
    for (let y = 0; y < 5; y++) for (let x = 5; x < 11; x++) px(c, ox + x, oy + y, shade(0xffb347, 0.9 + rand2(x, y, 3) * 0.4));
  });
  // 20 青砖：错缝砖墙
  drawTile(ctx, 20, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x6b7078, 0.35, 271);
    for (let y = 0; y < TILE_SIZE; y++) {
      if (y % 8 === 0) for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + y, shade(0x6b7078, 0.62));
    }
    for (let y = 0; y < TILE_SIZE; y++) {
      const off = (Math.floor(y / 8) % 2) ? 8 : 4;
      px(c, ox + off, oy + y, shade(0x6b7078, 0.62));
      px(c, ox + ((off + 8) % 16), oy + y, shade(0x6b7078, 0.62));
    }
  });
  // 21 木梁：深木 + 顺纹
  drawTile(ctx, 21, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x7a5636, 0.3, 281);
    for (let y = 2; y < TILE_SIZE; y += 6) for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + y, shade(0x7a5636, 0.72));
  });
  // 22 纸窗：米白纸 + 木格
  drawTile(ctx, 22, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0xf0e3c2, 0.16, 291);
    for (let i = 0; i < TILE_SIZE; i++) {
      px(c, ox + i, oy + 0, shade(0x7a5636, 0.9)); px(c, ox + i, oy + 15, shade(0x7a5636, 0.9));
      px(c, ox + 0, oy + i, shade(0x7a5636, 0.9)); px(c, ox + 15, oy + i, shade(0x7a5636, 0.9));
    }
    for (let i = 4; i < 12; i++) { px(c, ox + 7, oy + i, shade(0x7a5636, 0.9)); px(c, ox + i, oy + 7, shade(0x7a5636, 0.9)); }
  });
  // 23 竹席：竹黄 + 编织横纹
  drawTile(ctx, 23, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0xc9a86a, 0.28, 301);
    for (let y = 1; y < TILE_SIZE; y += 3) for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + y, shade(0xc9a86a, 0.74));
  });
  // 24 酒旗：红布 + 米白字条
  drawTile(ctx, 24, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0xb03a3a, 0.3, 311);
    for (let y = 3; y < 12; y++) for (let x = 6; x < 10; x++) px(c, ox + x, oy + y, shade(0xe8dcc0, 1.0));
  });
  // 25 石灯：灰石 + 暖黄灯窗
  drawTile(ctx, 25, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x9aa0a6, 0.35, 321);
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) px(c, ox + x, oy + y, shade(0xffc46a, 1.0));
    for (let x = 0; x < TILE_SIZE; x++) { px(c, ox + x, oy + 3, shade(0x9aa0a6, 0.6)); px(c, ox + x, oy + 12, shade(0x9aa0a6, 0.6)); }
  });
  // 26 飞檐：瓦垄 + 上翘白边
  drawTile(ctx, 26, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x3f4b56, 0.32, 331);
    for (let x = 0; x < TILE_SIZE; x += 4) {
      for (let y = 0; y < TILE_SIZE; y++) { px(c, ox + x, oy + y, shade(0x3f4b56, 0.68)); px(c, ox + x + 3, oy + y, shade(0x3f4b56, 1.3)); }
    }
    for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + 14, shade(0xe8e3d3, 1.0));
  });
  // 27 琉璃瓦：青绿釉面 + 高光
  drawTile(ctx, 27, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x2f8f8a, 0.3, 341);
    for (let x = 0; x < TILE_SIZE; x += 4) {
      for (let y = 0; y < TILE_SIZE; y++) { px(c, ox + x, oy + y, shade(0x2f8f8a, 0.7)); px(c, ox + x + 3, oy + y, shade(0x2f8f8a, 1.45)); }
    }
  });
  // 28 木箱：木纹 + 铁角
  drawTile(ctx, 28, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x9a6f42, 0.3, 351);
    for (let i = 0; i < TILE_SIZE; i++) {
      px(c, ox + i, oy + 1, shade(0x9a6f42, 0.66)); px(c, ox + i, oy + 14, shade(0x9a6f42, 0.66));
      px(c, ox + 1, oy + i, shade(0x9a6f42, 0.66)); px(c, ox + 14, oy + i, shade(0x9a6f42, 0.66));
    }
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, ox + x, oy + y, shade(0x4a4a52, 1.0));
  });
  // 29 石碑：灰石 + 竖刻痕
  drawTile(ctx, 29, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x7d838a, 0.3, 361);
    for (let y = 3; y < 13; y++) {
      px(c, ox + 5, oy + y, shade(0x7d838a, 0.62));
      px(c, ox + 10, oy + y, shade(0x7d838a, 0.62));
    }
  });
  // 30 歇山顶：青瓦脊 + 正脊
  drawTile(ctx, 30, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0x4a5866, 0.3, 371);
    for (let x = 0; x < TILE_SIZE; x += 3) for (let y = 0; y < TILE_SIZE; y++) px(c, ox + x, oy + y, shade(0x4a5866, 0.72));
    for (let x = 0; x < TILE_SIZE; x++) { px(c, ox + x, oy + 1, shade(0x2f3a45, 1.0)); px(c, ox + x, oy + 2, shade(0x2f3a45, 1.1)); }
  });
  // 31 牌坊：朱红柱 + 横梁
  drawTile(ctx, 31, (c, ox, oy) => {
    noiseFill(c, ox, oy, 0xa33b2f, 0.3, 381);
    for (let y = 2; y < 5; y++) for (let x = 0; x < TILE_SIZE; x++) px(c, ox + x, oy + y, shade(0x7a5636, 1.0));
    for (let x = 0; x < 3; x++) for (let y = 5; y < TILE_SIZE; y++) px(c, ox + x, oy + y, shade(0xa33b2f, 0.72));
    for (let x = 13; x < TILE_SIZE; x++) for (let y = 5; y < TILE_SIZE; y++) px(c, ox + x, oy + y, shade(0xa33b2f, 0.72));
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** 返回某个 tile 的 uv 范围（带半像素内缩，防止相邻 tile 渗色） */
export function tileUV(index) {
  const col = index % ATLAS_COLS, row = Math.floor(index / ATLAS_COLS);
  const w = 1 / ATLAS_COLS, h = 1 / ATLAS_ROWS;
  const inset = 0.25 / (ATLAS_COLS * TILE_SIZE);
  return {
    u0: col * w + inset, u1: (col + 1) * w - inset,
    v0: 1 - (row + 1) * h + inset, v1: 1 - row * h - inset,
  };
}
