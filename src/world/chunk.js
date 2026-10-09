// 区块网格化：面剔除 + 体素 AO + 顶点着色（草色随海拔渐变）
// 只生成能看见的面，一个 16x96x16 的区块通常只有几千个面。
import * as THREE from 'three';
import { CHUNK, HEIGHT, SEA, SNOW_LINE, index } from './generator.js';
import { BLOCKS, AIR, WATER, GRASS, SNOW, STONE, GRAVEL, SAND, DIRT, tileUV } from './blocks.js';
import { hash3 } from '../core/noise.js';

const IS_OPAQUE = new Uint8Array(256);
const IS_SOLID = new Uint8Array(256);
const IS_LIGHT = new Uint8Array(256);
for (const b of BLOCKS) {
  IS_OPAQUE[b.id] = b.opaque ? 1 : 0;
  IS_SOLID[b.id] = b.solid ? 1 : 0;
  IS_LIGHT[b.id] = b.light ? 1 : 0;
}

// u × v = n，顶点顺序 (0,0)(1,0)(1,1)(0,1) 保证逆时针朝外
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], shade: 0.80 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.80 },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], shade: 1.00 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.52 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.90 },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], shade: 0.90 },
];

const AO_LEVELS = [0.52, 0.70, 0.86, 1.0];

// 草色随海拔渐变：河谷深绿 → 山腰黄绿 → 高处枯黄，并带细微噪声
const GRASS_TABLE = new Float32Array(HEIGHT * 3);
(function buildGrassTable() {
  const stops = [
    [0.00, 0.16, 0.40, 0.14],
    [0.35, 0.24, 0.52, 0.18],
    [0.65, 0.34, 0.55, 0.22],
    [0.85, 0.46, 0.55, 0.28],
    [1.00, 0.55, 0.56, 0.34],
  ];
  for (let y = 0; y < HEIGHT; y++) {
    const t = Math.max(0, Math.min(1, (y - SEA) / (SNOW_LINE + 6 - SEA)));
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const f = (t - a[0]) / Math.max(0.0001, b[0] - a[0]);
    GRASS_TABLE[y * 3] = a[1] + (b[1] - a[1]) * f;
    GRASS_TABLE[y * 3 + 1] = a[2] + (b[2] - a[2]) * f;
    GRASS_TABLE[y * 3 + 2] = a[3] + (b[3] - a[3]) * f;
  }
})();

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// 带 2 格边距的体素缓冲：把本区块 + 邻区块边缘摊平成一个连续数组，
// 面剔除与 AO 的邻居查询就变成纯索引，没有分支、没有跨区块函数调用。
const PAD = 2;
const PW = CHUNK + PAD * 2;
const PH = HEIGHT + PAD * 2;
const pSize = PW * PW * PH;
let padBuf = null;

function buildPadded(ox, oz, blocks, worldGet) {
  if (!padBuf) padBuf = new Uint8Array(pSize);
  for (let y = -PAD; y < HEIGHT + PAD; y++) {
    const yBase = (y + PAD) * PW * PW;
    for (let z = -PAD; z < CHUNK + PAD; z++) {
      const zBase = yBase + (z + PAD) * PW;
      for (let x = -PAD; x < CHUNK + PAD; x++) {
        let v;
        if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK && y >= 0 && y < HEIGHT) {
          v = blocks[index(x, y, z)];
        } else if (y < 0 || y >= HEIGHT) {
          v = STONE; // 世界顶底视为实心，不会漏出空洞
        } else {
          const b = worldGet(ox + x, y, oz + z);
          v = b === undefined ? AIR : b;
        }
        padBuf[zBase + (x + PAD)] = v;
      }
    }
  }
  return padBuf;
}

// 顶点缓冲：预分配 + 按需翻倍，避免数组 push 的开销
function makePart() {
  const cap = 1024; // 面数
  return {
    cap,
    pos: new Float32Array(cap * 4 * 3), nor: new Float32Array(cap * 4 * 3),
    col: new Float32Array(cap * 4 * 3), uv: new Float32Array(cap * 4 * 2),
    idx: new Uint32Array(cap * 6), n: 0, f: 0,
  };
}

function ensureCap(p, need) {
  if (p.f + need <= p.cap) return;
  let cap = p.cap;
  while (cap < p.f + need) cap *= 2;
  const cp = (old, size) => { const a = new Float32Array(size); a.set(old); return a; };
  p.pos = cp(p.pos, cap * 4 * 3);
  p.nor = cp(p.nor, cap * 4 * 3);
  p.col = cp(p.col, cap * 4 * 3);
  p.uv = cp(p.uv, cap * 4 * 2);
  const ni = new Uint32Array(cap * 6);
  ni.set(p.idx);
  p.idx = ni;
  p.cap = cap;
}

export function buildChunkGeometry(ox, oz, blocks, worldGet) {
  const opaque = makePart();
  const water = makePart();
  const light = makePart();

  const uvCache = [];
  for (let i = 0; i < 64; i++) uvCache.push(null);

  function uvFor(tile) {
    if (!uvCache[tile]) uvCache[tile] = tileUV(tile);
    return uvCache[tile];
  }

  const pad = buildPadded(ox, oz, blocks, worldGet);
  // 局部坐标 (-2 .. CHUNK+1)，直接索引
  const at = (lx, ly, lz) => pad[((ly + PAD) * PW + (lz + PAD)) * PW + (lx + PAD)];
  const blockAt = at;

  function emit(target, x, y, z, face, tile, r, g, b) {
    ensureCap(target, 1);
    const n = face.n, u = face.u, v = face.v;
    const oxp = x + (n[0] > 0 ? 1 : 0);
    const oyp = y + (n[1] > 0 ? 1 : 0);
    const ozp = z + (n[2] > 0 ? 1 : 0);
    const uv = uvFor(tile);
    const base = target.n;
    const s = face.shade;
    let p3 = base * 3, p2 = base * 2;
    for (let c = 0; c < 4; c++) {
      const i = (c === 0 || c === 3) ? 0 : 1;
      const j = (c === 0 || c === 1) ? 0 : 1;
      const du = i === 0 ? -1 : 1;
      const dv = j === 0 ? -1 : 1;
      const s1 = IS_OPAQUE[blockAt(oxp + n[0] + u[0] * du, oyp + n[1] + u[1] * du, ozp + n[2] + u[2] * du)] ? 1 : 0;
      const s2 = IS_OPAQUE[blockAt(oxp + n[0] + v[0] * dv, oyp + n[1] + v[1] * dv, ozp + n[2] + v[2] * dv)] ? 1 : 0;
      const cr = IS_OPAQUE[blockAt(
        oxp + n[0] + u[0] * du + v[0] * dv,
        oyp + n[1] + u[1] * du + v[1] * dv,
        ozp + n[2] + u[2] * du + v[2] * dv)] ? 1 : 0;
      const aoIdx = (s1 && s2) ? 0 : 3 - (s1 + s2 + cr);
      const af = AO_LEVELS[aoIdx] * s;
      target.pos[p3] = oxp + u[0] * i + v[0] * j;
      target.pos[p3 + 1] = oyp + u[1] * i + v[1] * j;
      target.pos[p3 + 2] = ozp + u[2] * i + v[2] * j;
      target.nor[p3] = n[0]; target.nor[p3 + 1] = n[1]; target.nor[p3 + 2] = n[2];
      target.col[p3] = r * af; target.col[p3 + 1] = g * af; target.col[p3 + 2] = b * af;
      target.uv[p2] = i ? uv.u1 : uv.u0;
      target.uv[p2 + 1] = j ? uv.v1 : uv.v0;
      p3 += 3; p2 += 2;
    }
    const i6 = target.f * 6;
    target.idx[i6] = base; target.idx[i6 + 1] = base + 1; target.idx[i6 + 2] = base + 2;
    target.idx[i6 + 3] = base; target.idx[i6 + 4] = base + 2; target.idx[i6 + 5] = base + 3;
    target.n += 4;
    target.f++;
  }

  function colorOf(id, wx, wy, wz) {
    switch (id) {
      case GRASS: {
        const jitter = (hash3(wx, wy, wz, 3) / 4294967296 - 0.5) * 0.09;
        const k = 1 + jitter;
        return [
          srgbToLinear(Math.min(1, GRASS_TABLE[wy * 3] * k)),
          srgbToLinear(Math.min(1, GRASS_TABLE[wy * 3 + 1] * k)),
          srgbToLinear(Math.min(1, GRASS_TABLE[wy * 3 + 2] * k)),
        ];
      }
      case SNOW: return [0.86, 0.90, 0.95];
      case STONE: return [0.72, 0.74, 0.78];
      case GRAVEL: return [0.66, 0.63, 0.58];
      case SAND: return [0.86, 0.80, 0.60];
      case DIRT: return [0.62, 0.46, 0.30];
      default: return [1, 1, 1];
    }
  }

  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const id = blocks[index(x, y, z)];
        if (id === AIR) continue;
        const wx = ox + x, wz = oz + z;
        const isWater = id === WATER;
        const isLight = IS_LIGHT[id] === 1;
        const target = isWater ? water : isLight ? light : opaque;
        const tiles = BLOCKS[id].tiles || [id, id, id];
        const [cr, cg, cb] = colorOf(id, wx, y, wz);
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nb = blockAt(x + face.n[0], y + face.n[1], z + face.n[2]);
          let draw;
          if (isWater) draw = !IS_OPAQUE[nb] && nb !== WATER;
          else if (IS_OPAQUE[id]) draw = !IS_OPAQUE[nb];
          else draw = (nb !== id) && !IS_OPAQUE[nb];
          if (!draw) continue;
          // 面的贴图：顶面用 top，底面用 bottom，其余用 side
          const tile = f === 2 ? tiles[1] : f === 3 ? tiles[2] : tiles[0];
          emit(target, x, y, z, face, tile, cr, cg, cb);
        }
      }
    }
  }

  return { opaque, water, light };
}

export function geometryFrom(part) {
  if (!part || part.f === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(part.pos.slice(0, part.n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(part.nor.slice(0, part.n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(part.col.slice(0, part.n * 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(part.uv.slice(0, part.n * 2), 2));
  g.setIndex(new THREE.BufferAttribute(part.idx.slice(0, part.f * 6), 1));
  g.computeBoundingSphere();
  return g;
}
