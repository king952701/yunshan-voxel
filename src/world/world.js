// 区块流式管理：随玩家移动逐步生成 / 卸载，没有加载条、没有接缝。
import * as THREE from 'three';
import { CHUNK, HEIGHT, generateChunkData, index } from './generator.js';
import { buildChunkGeometry, geometryFrom } from './chunk.js';
import { AIR, WATER, BLOCKS } from './blocks.js';

const SAVE_KEY = 'yunshan_v1_edits';

export function createMaterials(atlas) {
  const opaque = new THREE.MeshLambertMaterial({
    map: atlas, vertexColors: true,
  });
  const water = new THREE.MeshLambertMaterial({
    map: atlas, vertexColors: true, transparent: true, opacity: 0.78,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const light = new THREE.MeshBasicMaterial({
    map: atlas, vertexColors: true,
  });
  return { opaque, water, light };
}

export class World {
  constructor(scene, seed, materials) {
    this.scene = scene;
    this.seed = seed;
    this.materials = materials;
    this.chunks = new Map();
    this.edits = new Map();
    this.meshQueue = [];
    this.remesh = new Set();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.loadEdits();
    this.stats = { meshes: 0, queued: 0 };
  }

  key(cx, cz) { return cx + ',' + cz; }

  loadEdits() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      for (const k in obj) this.edits.set(k, new Map(obj[k]));
    } catch (e) { /* 存档损坏则忽略 */ }
  }

  saveEdits() {
    try {
      const obj = {};
      for (const [k, v] of this.edits) obj[k] = Array.from(v.entries());
      localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
    } catch (e) { /* 容量不足则放弃保存 */ }
  }

  ensureData(cx, cz) {
    const k = this.key(cx, cz);
    let c = this.chunks.get(k);
    if (c && c.data) return c;
    if (!c) {
      c = { cx, cz, data: null, mesh: null, group: null };
      this.chunks.set(k, c);
    }
    const t0 = performance.now();
    c.data = generateChunkData(cx, cz, this.seed);
    const ed = this.edits.get(k);
    if (ed) for (const [i, id] of ed) c.data.blocks[i] = id;
    c.genMs = performance.now() - t0;
    return c;
  }

  worldGet(wx, wy, wz) {
    if (wy < 0 || wy >= HEIGHT) return AIR;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c || !c.data) return AIR;
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    return c.data.blocks[index(lx, wy, lz)];
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= HEIGHT) return wy < 0 ? 3 : AIR;
    return this.worldGet(wx, wy, wz);
  }

  isSolid(wx, wy, wz) {
    const b = this.getBlock(wx, wy, wz);
    return b !== AIR && BLOCKS[b] && BLOCKS[b].solid;
  }

  setBlock(wx, wy, wz, id) {
    if (wy < 1 || wy >= HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const k = this.key(cx, cz);
    const c = this.ensureData(cx, cz);
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    const i = index(lx, wy, lz);
    if (c.data.blocks[i] === id) return false;
    c.data.blocks[i] = id;
    let ed = this.edits.get(k);
    if (!ed) { ed = new Map(); this.edits.set(k, ed); }
    ed.set(i, id);
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
    return true;
  }

  markDirty(cx, cz) {
    const k = this.key(cx, cz);
    if (!this.chunks.has(k)) return;
    if (!this.remesh.has(k)) this.remesh.add(k);
  }

  buildMesh(cx, cz) {
    const c = this.ensureData(cx, cz);
    this.releaseMesh(c, false);
    const get = (wx, wy, wz) => this.worldGet(wx, wy, wz);
    const parts = buildChunkGeometry(cx * CHUNK, cz * CHUNK, c.data.blocks, get);
    const group = new THREE.Group();
    for (const name of ['opaque', 'water', 'light']) {
      const geo = geometryFrom(parts[name]);
      if (!geo) continue;
      const mat = this.materials[name === 'water' ? 'water' : name === 'light' ? 'light' : 'opaque'];
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = name === 'water' ? 1 : 0;
      group.add(mesh);
    }
    c.group = group;
    c.mesh = true;
    this.group.add(group);
    this.stats.meshes++;
  }

  releaseMesh(c, removeFromScene = true) {
    if (c.group) {
      for (const m of c.group.children) {
        m.geometry.dispose();
      }
      if (removeFromScene) this.group.remove(c.group);
      c.group = null;
      c.mesh = false;
      this.stats.meshes--;
    }
  }

  /** 每帧调用：维护玩家周围的区块 */
  update(px, pz, radius, budgetMs) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const t0 = performance.now();

    // 1) 卸载超出范围的区块
    const keepData = radius + 2;
    for (const [k, c] of this.chunks) {
      const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (d > keepData) {
        this.releaseMesh(c);
        this.chunks.delete(k);
      } else if (d > radius) {
        this.releaseMesh(c);
      }
    }

    // 2) 收集需要建网格的区块（按距离由近到远）
    const need = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        if (dx * dx + dz * dz > radius * radius + radius) continue;
        const c = this.chunks.get(this.key(cx, cz));
        if (!c || !c.mesh) need.push([dx * dx + dz * dz, cx, cz]);
      }
    }
    need.sort((a, b) => a[0] - b[0]);

    // 3) 在时间预算内逐个生成
    for (const [, cx, cz] of need) {
      if (performance.now() - t0 > budgetMs) break;
      this.buildMesh(cx, cz);
    }

    // 4) 重建被修改过的区块（放/挖方块后）
    if (this.remesh.size) {
      for (const k of Array.from(this.remesh)) {
        this.remesh.delete(k);
        if (performance.now() - t0 > budgetMs + 4) break;
        const c = this.chunks.get(k);
        if (c && c.mesh) this.buildMesh(c.cx, c.cz);
      }
    }
    this.stats.queued = need.length;
  }

  /** 保证出生点周围已有地面（首帧同步生成，避免落地掉虚空） */
  preload(px, pz, dataRadius) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    for (let dz = -dataRadius; dz <= dataRadius; dz++) {
      for (let dx = -dataRadius; dx <= dataRadius; dx++) {
        this.ensureData(pcx + dx, pcz + dz);
      }
    }
    // 只同步建 3x3 的网格，其余交给主循环分帧补齐
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.buildMesh(pcx + dx, pcz + dz);
      }
    }
  }

  /** 找一个可以站人的地表高度 */
  spawnY(wx, wz) {
    for (let y = HEIGHT - 12; y > 4; y--) {
      const b = this.getBlock(wx, y, wz);
      if (b !== AIR && b !== WATER && BLOCKS[b] && BLOCKS[b].solid) {
        if (this.getBlock(wx, y + 1, wz) === AIR && this.getBlock(wx, y + 2, wz) === AIR) {
          return y + 1;
        }
      }
    }
    return null;
  }

  /** 体素射线步进（Amanatides & Woo） */
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dx || 1e-9));
    const tDeltaY = Math.abs(1 / (dy || 1e-9));
    const tDeltaZ = Math.abs(1 / (dz || 1e-9));
    let tMaxX = ((dx > 0 ? x + 1 - ox : ox - x)) * tDeltaX;
    let tMaxY = ((dy > 0 ? y + 1 - oy : oy - y)) * tDeltaY;
    let tMaxZ = ((dz > 0 ? z + 1 - oz : oz - z)) * tDeltaZ;
    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    while (t <= maxDist) {
      const b = this.getBlock(x, y, z);
      if (b !== AIR && b !== WATER) {
        return { x, y, z, block: b, nx, ny, nz, dist: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }
}
