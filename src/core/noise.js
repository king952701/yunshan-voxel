// 确定性噪声：同一 (坐标 + 种子) 永远得到同一结果，是无缝无限地图的基础。

export function imul(a, b) {
  return Math.imul(a, b);
}

export function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash3(x, y, z, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^
    Math.imul(z | 0, 0x7feb352d) ^ Math.imul(seed | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** [0,1) 均匀随机 */
export function rand2(x, y, seed) {
  return hash2(x, y, seed) / 4294967296;
}

export function rand3(x, y, z, seed) {
  return hash3(x, y, z, seed) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** 2D value noise，输出 [0,1] */
export function noise2(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const n00 = rand2(x0, y0, seed);
  const n10 = rand2(x0 + 1, y0, seed);
  const n01 = rand2(x0, y0 + 1, seed);
  const n11 = rand2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
}

/** 3D value noise，输出 [0,1] */
export function noise3(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = smooth(x - x0), fy = smooth(y - y0), fz = smooth(z - z0);
  const c000 = rand3(x0, y0, z0, seed);
  const c100 = rand3(x0 + 1, y0, z0, seed);
  const c010 = rand3(x0, y0 + 1, z0, seed);
  const c110 = rand3(x0 + 1, y0 + 1, z0, seed);
  const c001 = rand3(x0, y0, z0 + 1, seed);
  const c101 = rand3(x0 + 1, y0, z0 + 1, seed);
  const c011 = rand3(x0, y0 + 1, z0 + 1, seed);
  const c111 = rand3(x0 + 1, y0 + 1, z0 + 1, seed);
  const x00 = lerp(c000, c100, fx), x10 = lerp(c010, c110, fx);
  const x01 = lerp(c001, c101, fx), x11 = lerp(c011, c111, fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

/** 分形叠加噪声，输出 [0,1] */
export function fbm2(x, y, seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function fbm3(x, y, z, seed, octaves = 2, lacunarity = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + i * 7919);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** 山脊噪声：制造层叠山峦的锐利脊线，输出 [0,1] */
export function ridged2(x, y, seed, octaves = 4) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise2(x * freq, y * freq, seed + i * 3313);
    const r = 1 - Math.abs(n * 2 - 1);
    sum += amp * r * r;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
