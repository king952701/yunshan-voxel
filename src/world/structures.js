// 植被与中式建筑：全部确定性生成。
// 结构按「世界对齐的 cell / region」定位，并允许溢出写入相邻区块，
// 因此跨区块的结构会被两侧区块独立且一致地生成 —— 不会出现半棵树或半座塔。
import { hash2, rand2, rand3, fbm2 } from '../core/noise.js';
import { CHUNK, HEIGHT, SEA, SNOW_LINE, index, surfaceHeight, riverFactor, biomeAt } from './generator.js';
import {
  AIR, GRASS, DIRT, STONE, SAND, WATER, WOOD, BAMBOO, LEAF_BAMBOO, LEAF_PINE,
  PLANK, TILE, WALL, LANTERN,
} from './blocks.js';

const VEG_CELL = 8;      // 每 8x8 格一个植被候选点
const VILLAGE_REGION = 40; // 村落判定区域
const LANDMARK_REGION = 112; // 塔 / 寺庙 / 楼阁 判定区域

function makeSetter(cx, cz, blocks) {
  const ox = cx * CHUNK, oz = cz * CHUNK;
  /**
   * mode: 'air' 只填空气；'all' 强制覆盖（建筑）；'cut' 强制清空
   */
  return function set(wx, wy, wz, id, mode = 'air') {
    if (wy < 0 || wy >= HEIGHT) return;
    const lx = wx - ox, lz = wz - oz;
    if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK) return;
    const i = index(lx, wy, lz);
    const cur = blocks[i];
    if (mode === 'air') {
      if (cur === AIR || cur === WATER) blocks[i] = id;
    } else if (mode === 'cut') {
      blocks[i] = AIR;
    } else {
      blocks[i] = id;
    }
  };
}

// ---------------------------------------------------------------- 植被

function pineTree(set, x, groundY, z, seed) {
  const h = 5 + Math.floor(rand2(x, z, seed) * 4);
  for (let i = 1; i <= h; i++) set(x, groundY + i, z, WOOD, 'air');
  const top = groundY + h;
  // 层叠锥形树冠
  for (let layer = 0; layer < 4; layer++) {
    const r = layer < 2 ? 2 : 1;
    const y = top - 2 + layer;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > r + (layer === 0 ? 1 : 0)) continue;
        if (dx === 0 && dz === 0 && y <= top) continue;
        set(x + dx, y, z + dz, LEAF_PINE, 'air');
      }
    }
  }
  set(x, top + 2, z, LEAF_PINE, 'air');
}

function bambooCluster(set, x, groundY, z, seed) {
  const n = 3 + Math.floor(rand2(x, z, seed + 1) * 4);
  for (let i = 0; i < n; i++) {
    const dx = Math.floor(rand2(x + i, z, seed + 2) * 3) - 1;
    const dz = Math.floor(rand2(x, z + i, seed + 3) * 3) - 1;
    const h = 6 + Math.floor(rand2(x + dx, z + dz, seed + 4) * 6);
    for (let y = 1; y <= h; y++) set(x + dx, groundY + y, z + dz, BAMBOO, 'air');
    const top = groundY + h + 1;
    set(x + dx, top, z + dz, LEAF_BAMBOO, 'air');
    set(x + dx + 1, top, z + dz, LEAF_BAMBOO, 'air');
    set(x + dx - 1, top, z + dz, LEAF_BAMBOO, 'air');
    set(x + dx, top, z + dz + 1, LEAF_BAMBOO, 'air');
    set(x + dx, top, z + dz - 1, LEAF_BAMBOO, 'air');
  }
}

function berryBush(set, x, groundY, z, seed) {
  set(x, groundY + 1, z, 18, 'air');
  if (rand2(x, z, seed) > 0.5) set(x + 1, groundY + 1, z, 18, 'air');
  if (rand2(x, z, seed + 9) > 0.6) set(x, groundY + 1, z + 1, 18, 'air');
}

function rock(set, x, groundY, z) {
  set(x, groundY + 1, z, STONE, 'air');
  if (rand3(x, groundY, z, 7) > 0.4) set(x + 1, groundY + 1, z, STONE, 'air');
}

// ---------------------------------------------------------------- 建筑基元

function fillBox(set, x0, y0, z0, x1, y1, z1, id, mode = 'all') {
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) set(x, y, z, id, mode);
}

/** 带挑檐的青瓦屋顶：每层向内收 1，外沿挑出 eaveOver */
function tiledRoof(set, cx, cz, baseY, halfSize, levels, eaveOver = 1) {
  for (let l = 0; l < levels; l++) {
    const r = halfSize - l + eaveOver;
    const y = baseY + l;
    fillBox(set, cx - r, y, cz - r, cx + r, y, cz + r, TILE, 'all');
    // 屋檐四角挂灯笼
    if (l === 0) {
      set(cx - r, y - 1, cz - r, LANTERN, 'air');
      set(cx + r, y - 1, cz - r, LANTERN, 'air');
      set(cx - r, y - 1, cz + r, LANTERN, 'air');
      set(cx + r, y - 1, cz + r, LANTERN, 'air');
    }
  }
}

/** 中式村落民居：粉墙 + 青瓦坡屋顶 + 木门框 */
function villageHouse(set, cx, cz, groundY, seed, size = 2) {
  const baseY = groundY + 1;
  // 地基
  for (let x = cx - size - 1; x <= cx + size + 1; x++)
    for (let z = cz - size - 1; z <= cz + size + 1; z++) {
      for (let y = baseY - 3; y < baseY; y++) set(x, y, z, STONE, 'all');
      for (let y = baseY; y <= baseY + 4; y++) set(x, y, z, AIR, 'cut');
    }
  // 墙体
  for (let x = cx - size; x <= cx + size; x++)
    for (let z = cz - size; z <= cz + size; z++) {
      const edge = x === cx - size || x === cx + size || z === cz - size || z === cz + size;
      if (!edge) continue;
      for (let y = baseY; y <= baseY + 2; y++) set(x, y, z, WALL, 'all');
      // 木柱
      if ((x === cx - size || x === cx + size) && (z === cz - size || z === cz + size)) {
        for (let y = baseY; y <= baseY + 3; y++) set(x, y, z, WOOD, 'all');
      }
    }
  // 门（南向）与窗
  set(cx, baseY, cz + size, AIR, 'cut');
  set(cx, baseY + 1, cz + size, AIR, 'cut');
  set(cx - size, baseY + 1, cz, AIR, 'cut');
  set(cx + size, baseY + 1, cz, AIR, 'cut');
  // 屋顶
  tiledRoof(set, cx, cz, baseY + 3, size, 3, 1);
  // 室内一盏灯
  set(cx, baseY + 2, cz, LANTERN, 'all');
}

/** 楼阁 / 水榭：四面开敞，柱廊 + 大挑檐 */
function pavilion(set, cx, cz, groundY) {
  const baseY = groundY + 1;
  for (let x = cx - 3; x <= cx + 3; x++)
    for (let z = cz - 3; z <= cz + 3; z++) {
      for (let y = baseY - 3; y < baseY; y++) set(x, y, z, STONE, 'all');
      for (let y = baseY; y <= baseY + 6; y++) set(x, y, z, AIR, 'cut');
    }
  // 台基面
  fillBox(set, cx - 3, baseY - 1, cz - 3, cx + 3, baseY - 1, cz + 3, STONE, 'all');
  // 柱
  const posts = [[-2, -2], [2, -2], [-2, 2], [2, 2]];
  for (const [dx, dz] of posts) {
    for (let y = baseY; y <= baseY + 3; y++) set(cx + dx, y, cz + dz, WOOD, 'all');
  }
  // 栏杆
  for (let x = cx - 2; x <= cx + 2; x++) {
    set(x, baseY + 1, cz - 2, PLANK, 'all');
    set(x, baseY + 1, cz + 2, PLANK, 'all');
  }
  for (let z = cz - 2; z <= cz + 2; z++) {
    set(cx - 2, baseY + 1, z, PLANK, 'all');
    set(cx + 2, baseY + 1, z, PLANK, 'all');
  }
  // 双层檐
  tiledRoof(set, cx, cz, baseY + 4, 3, 2, 1);
  tiledRoof(set, cx, cz, baseY + 6, 1, 2, 1);
  set(cx, baseY + 3, cz, LANTERN, 'all');
}

/** 古塔：五层楼阁式，逐层收分 */
function pagoda(set, cx, cz, groundY) {
  let baseY = groundY + 1;
  for (let x = cx - 4; x <= cx + 4; x++)
    for (let z = cz - 4; z <= cz + 4; z++) {
      for (let y = baseY - 4; y < baseY; y++) set(x, y, z, STONE, 'all');
      for (let y = baseY; y <= baseY + 30; y++) set(x, y, z, AIR, 'cut');
    }
  fillBox(set, cx - 4, baseY - 1, cz - 4, cx + 4, baseY - 1, cz + 4, STONE, 'all');
  let half = 3;
  for (let level = 0; level < 5; level++) {
    for (let x = cx - half; x <= cx + half; x++)
      for (let z = cz - half; z <= cz + half; z++) {
        const edge = Math.abs(x - cx) === half || Math.abs(z - cz) === half;
        for (let y = baseY; y <= baseY + 2; y++) {
          set(x, y, z, edge ? WALL : AIR, edge ? 'all' : 'cut');
        }
        if (edge && (Math.abs(x - cx) === half && Math.abs(z - cz) === half)) {
          for (let y = baseY; y <= baseY + 2; y++) set(x, y, z, WOOD, 'all');
        }
      }
    // 门窗
    set(cx, baseY, cz + half, AIR, 'cut');
    set(cx, baseY + 1, cz + half, AIR, 'cut');
    tiledRoof(set, cx, cz, baseY + 3, half, 2, 1);
    set(cx, baseY + 2, cz, LANTERN, 'all');
    baseY += 4;
    half = Math.max(1, 3 - level - 1);
  }
  // 塔刹
  for (let y = baseY; y <= baseY + 3; y++) set(cx, y, cz, WOOD, 'all');
  set(cx, baseY + 4, cz, TILE, 'all');
}

/** 山间寺庙：台基 + 前廊柱 + 重檐大屋顶 */
function temple(set, cx, cz, groundY) {
  const baseY = groundY + 1;
  const w = 4, d = 5;
  for (let x = cx - w - 1; x <= cx + w + 1; x++)
    for (let z = cz - d - 1; z <= cz + d + 1; z++) {
      for (let y = baseY - 4; y < baseY; y++) set(x, y, z, STONE, 'all');
      for (let y = baseY; y <= baseY + 12; y++) set(x, y, z, AIR, 'cut');
    }
  fillBox(set, cx - w - 1, baseY - 1, cz - d - 1, cx + w + 1, baseY - 1, cz + d + 1, STONE, 'all');
  // 墙体 + 角柱
  for (let x = cx - w; x <= cx + w; x++)
    for (let z = cz - d; z <= cz + d; z++) {
      const edge = Math.abs(x - cx) === w || Math.abs(z - cz) === d;
      if (!edge) continue;
      for (let y = baseY; y <= baseY + 4; y++) set(x, y, z, WALL, 'all');
      if (Math.abs(x - cx) === w && Math.abs(z - cz) === d)
        for (let y = baseY; y <= baseY + 5; y++) set(x, y, z, WOOD, 'all');
    }
  // 正面门洞
  for (let x = cx - 1; x <= cx + 1; x++) {
    set(x, baseY, cz + d, AIR, 'cut');
    set(x, baseY + 1, cz + d, AIR, 'cut');
    set(x, baseY + 2, cz + d, AIR, 'cut');
  }
  // 前廊柱
  for (let x = cx - w; x <= cx + w; x += 2) {
    for (let y = baseY; y <= baseY + 4; y++) set(x, y, cz + d + 1, WOOD, 'all');
  }
  tiledRoof(set, cx, cz, baseY + 5, w, 3, 1);
  tiledRoof(set, cx, cz, baseY + 8, 2, 2, 1);
  // 殿内长明灯
  set(cx, baseY + 4, cz - 1, LANTERN, 'all');
  set(cx + 2, baseY + 4, cz + 1, LANTERN, 'all');
  set(cx - 2, baseY + 4, cz + 1, LANTERN, 'all');
}

/** 山间石桥（跨越河道时点缀） */
function stoneBridge(set, cx, cz, groundY, along) {
  const baseY = Math.max(groundY + 2, SEA + 2);
  for (let i = -3; i <= 3; i++) {
    const x = along ? cx + i : cx;
    const z = along ? cz : cz + i;
    fillBox(set, x, baseY - 1, z, x, baseY - 1, z, STONE, 'all');
    set(x, baseY, z, AIR, 'cut');
    set(x, baseY + 1, z, AIR, 'cut');
  }
  for (let i = -2; i <= 2; i++) {
    const x = along ? cx + i : cx;
    const z = along ? cz : cz + i;
    set(along ? x : x - 1, baseY, z, PLANK, 'all');
    set(along ? x : x + 1, baseY, z, PLANK, 'all');
  }
}

// ---------------------------------------------------------------- 装配

function groundAt(wx, wz, seed) {
  return Math.round(surfaceHeight(wx, wz, seed));
}

function isFlat(wx, wz, half, seed) {
  let min = 999, max = -999;
  for (let dx = -half; dx <= half; dx += 2) {
    for (let dz = -half; dz <= half; dz += 2) {
      const h = groundAt(wx + dx, wz + dz, seed);
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return max - min <= 2;
}

export function applyStructures(cx, cz, blocks, heights, seed) {
  const set = makeSetter(cx, cz, blocks);
  const ox = cx * CHUNK, oz = cz * CHUNK;

  // ---- 植被：按 8x8 cell 放置，并扫描邻域以覆盖溢出部分 ----
  const c0x = Math.floor((ox - 8) / VEG_CELL), c1x = Math.floor((ox + CHUNK + 8) / VEG_CELL);
  const c0z = Math.floor((oz - 8) / VEG_CELL), c1z = Math.floor((oz + CHUNK + 8) / VEG_CELL);
  for (let ccx = c0x; ccx <= c1x; ccx++) {
    for (let ccz = c0z; ccz <= c1z; ccz++) {
      const h1 = hash2(ccx, ccz, seed ^ 0x51ed) / 4294967296;
      const lx = hash2(ccx, ccz, seed + 11) % VEG_CELL;
      const lz = hash2(ccx, ccz, seed + 22) % VEG_CELL;
      const wx = ccx * VEG_CELL + lx, wz = ccz * VEG_CELL + lz;
      const gh = Math.round(surfaceHeight(wx, wz, seed));
      if (gh <= SEA + 1) continue; // 水里不长树
      const biome = biomeAt(wx, wz, seed, gh);
      const typeRoll = hash2(ccx, ccz, seed + 33) / 4294967296;

      let density = 0.34;
      if (biome === 'forest') density = 0.62;
      else if (biome === 'riverbank') density = 0.45;
      else if (biome === 'mountain') density = 0.12;
      if (h1 > density) continue;

      if (biome === 'mountain') {
        if (typeRoll < 0.6) rock(set, wx, gh, wz);
        else if (gh < SNOW_LINE) pineTree(set, wx, gh, wz, seed);
      } else if (biome === 'riverbank') {
        if (typeRoll < 0.66) bambooCluster(set, wx, gh, wz, seed);
        else if (typeRoll < 0.86) pineTree(set, wx, gh, wz, seed);
        else berryBush(set, wx, gh, wz, seed);
      } else if (biome === 'forest') {
        if (typeRoll < 0.62) pineTree(set, wx, gh, wz, seed);
        else if (typeRoll < 0.82) bambooCluster(set, wx, gh, wz, seed);
        else berryBush(set, wx, gh, wz, seed);
      } else {
        if (typeRoll < 0.30) pineTree(set, wx, gh, wz, seed);
        else if (typeRoll < 0.52) bambooCluster(set, wx, gh, wz, seed);
        else if (typeRoll < 0.78) berryBush(set, wx, gh, wz, seed);
        else rock(set, wx, gh, wz);
      }
    }
  }

  // ---- 村落：每 40 格一个判定区域 ----
  const v0x = Math.floor((ox - 16) / VILLAGE_REGION), v1x = Math.floor((ox + CHUNK + 16) / VILLAGE_REGION);
  const v0z = Math.floor((oz - 16) / VILLAGE_REGION), v1z = Math.floor((oz + CHUNK + 16) / VILLAGE_REGION);
  for (let rx = v0x; rx <= v1x; rx++) {
    for (let rz = v0z; rz <= v1z; rz++) {
      const hr = hash2(rx, rz, seed ^ 0x9a11) / 4294967296;
      if (hr > 0.28) continue;
      const count = 3 + Math.floor(hash2(rx, rz, seed + 44) / 4294967296 * 4);
      for (let i = 0; i < count; i++) {
        const px = rx * VILLAGE_REGION + 6 + (hash2(rx * 7 + i, rz, seed + 55) % (VILLAGE_REGION - 12));
        const pz = rz * VILLAGE_REGION + 6 + (hash2(rx, rz * 7 + i, seed + 66) % (VILLAGE_REGION - 12));
        const gh = groundAt(px, pz, seed);
        if (gh <= SEA + 1 || gh > SNOW_LINE - 8) continue;
        if (!isFlat(px, pz, 4, seed)) continue;
        if (hash2(px, pz, seed + 77) / 4294967296 < 0.18) {
          pavilion(set, px, pz, gh);
        } else {
          villageHouse(set, px, pz, gh, seed, 2);
        }
      }
    }
  }

  // ---- 地标：塔 / 寺庙，每 112 格一个判定区域 ----
  const l0x = Math.floor((ox - 24) / LANDMARK_REGION), l1x = Math.floor((ox + CHUNK + 24) / LANDMARK_REGION);
  const l0z = Math.floor((oz - 24) / LANDMARK_REGION), l1z = Math.floor((oz + CHUNK + 24) / LANDMARK_REGION);
  for (let rx = l0x; rx <= l1x; rx++) {
    for (let rz = l0z; rz <= l1z; rz++) {
      const hr = hash2(rx, rz, seed ^ 0x2b17) / 4294967296;
      if (hr > 0.42) continue;
      const px = rx * LANDMARK_REGION + 30 + (hash2(rx, rz, seed + 88) % 40);
      const pz = rz * LANDMARK_REGION + 30 + (hash2(rx, rz, seed + 99) % 40);
      const gh = groundAt(px, pz, seed);
      if (gh <= SEA + 2) continue;
      if (!isFlat(px, pz, 6, seed)) continue;
      if (hash2(px, pz, seed + 111) / 4294967296 < 0.5) pagoda(set, px, pz, gh);
      else temple(set, px, pz, gh);
    }
  }

  // ---- 跨河石桥 ----
  const b0x = Math.floor((ox - 8) / 48), b1x = Math.floor((ox + CHUNK + 8) / 48);
  const b0z = Math.floor((oz - 8) / 48), b1z = Math.floor((oz + CHUNK + 8) / 48);
  for (let rx = b0x; rx <= b1x; rx++) {
    for (let rz = b0z; rz <= b1z; rz++) {
      const px = rx * 48 + 24, pz = rz * 48 + 24;
      if (riverFactor(px, pz, seed) < 0.75) continue;
      const gh = groundAt(px, pz, seed);
      if (gh > SEA + 2) continue;
      stoneBridge(set, px, pz, gh, hash2(rx, rz, seed + 5) % 2 === 0);
    }
  }
}
