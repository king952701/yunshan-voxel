// 程序化像素贴图集（无任何外部图片资源，全部用 canvas 现画）
// 方块与物品的纯数据在 core/items.js —— 那边不依赖 three，2.5D 长卷版才能共用同一份配方。
import * as THREE from 'three';
import { rand2 } from '../core/noise.js';

export {
  AIR, GRASS, DIRT, STONE, SAND, WATER, WOOD, BAMBOO, LEAF_BAMBOO, LEAF_PINE,
  PLANK, TILE, WALL, LANTERN, ORE_IRON, ORE_COAL, SNOW, GRAVEL, BERRY, TORCH,
  BRICK, BEAM, WINDOW, MAT, BANNER, STONE_LAMP, EAVE, GLAZE_TILE, CRATE, STELE,
  ROOF, GATE, BLOCKS, ITEMS, blockBaseColor, itemName, itemIcon, itemColor,
  QUALITY, qualityOf, FISH_IDS, HERB_IDS, WOOD_IDS, BEAST_IDS,
} from '../core/items.js';

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
