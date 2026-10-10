// 存档：行囊、仓库、十七门技艺、动土、采空的矿与采集点，还有看到哪儿了。
// 地形、矿脉、采集点本身都是按种子确定性生成的，所以只存「改动」与「冷却」，
// 一份存档通常只有几十 KB，装进 APK 后也没问题。
import { stackLimit } from './edit2d.js';
import { VB } from './veins.js';
import { NB } from './nodes.js';

export const SAVE_KEY = 'yunshan2d.save.v1';
/**
 * 存档版本。VER 2 是地形改版（十二区 + 四面环海）之后：
 * 旧档里「动土」那一层记的是旧地图的绝对高度，矿脉与采集点的冷却是旧坐标，
 * 相机更停在已经不存在的旧位置上 —— 这些一律作废，行囊、仓库、技艺照旧带走。
 */
const VER = 2;

/** 本地存储：隐私模式或某些 webview 里会抛异常，一律吞掉 */
function ls() {
  try {
    return window.localStorage || null;
  } catch (e) {
    return null;
  }
}

/** 只存占了的格子，空的不写 */
function packSlots(inv) {
  const out = [];
  for (let i = 0; i < inv.slots.length; i++) {
    const s = inv.slots[i];
    if (s && s.n > 0) out.push([i, s.id, s.n]);
  }
  return out;
}

function unpackSlots(inv, list) {
  inv.slots.fill(null);
  for (const e of list || []) {
    const i = e[0], id = e[1], n = e[2];
    if (i >= 0 && i < inv.size && n > 0) inv.slots[i] = { id, n: Math.min(n, stackLimit(id)) };
  }
}

export function capture(o) {
  const { inv, store, skills, terra, veins, nodes, view, settings, mat, surv } = o;

  const deltas = [];
  for (const [k, d] of terra.deltas) deltas.push([k, d.h, d.t, d.mat || 0]);

  const vcd = [];
  for (const list of veins.blocks.values()) {
    for (const p of list) if (p.cd > 0) vcd.push([p.wx, p.wy, Math.round(p.cd)]);
  }
  const ncd = [];
  for (const list of nodes.chunks.values()) {
    for (const p of list) if (p.cd > 0) ncd.push([p.wx, p.wy, Math.round(p.cd)]);
  }

  return {
    v: VER, t: Date.now(),
    bag: packSlots(inv), store: packSlots(store),
    sk: { lv: { ...skills.lv }, xp: { ...skills.xp } },
    mat, set: { ...settings },
    surv: surv ? { hp: surv.hp, food: surv.food, water: surv.water } : null,
    cam: [view.zi, Math.round(view.camPX), Math.round(view.camPY)],
    terra: deltas, vcd, ncd,
  };
}

export function restore(o, data) {
  if (!data) return false;
  if (data.v > VER) return false;                 // 更高版本（将来的档）读不了
  // 旧地形留下的档：只带人，不带地图。动土、冷却、相机全是照旧地图记的，留着就是补丁
  const stale = data.v < VER;
  const { inv, store, skills, terra, veins, nodes, view, settings } = o;

  unpackSlots(inv, data.bag);
  unpackSlots(store, data.store);

  // lv 与 xp 分开判空：老档可能只有一半，读进来就崩在半路上
  if (data.sk) {
    if (data.sk.lv) {
      for (const k of Object.keys(skills.lv)) {
        if (data.sk.lv[k] != null) skills.lv[k] = data.sk.lv[k];
      }
    }
    if (data.sk.xp) {
      for (const k of Object.keys(skills.xp)) {
        if (data.sk.xp[k] != null) skills.xp[k] = data.sk.xp[k];
      }
    }
  }

  terra.deltas.clear();
  if (!stale) {
    for (const e of data.terra || []) terra.deltas.set(e[0], { h: e[1], t: e[2], mat: e[3] });

    for (const e of data.vcd || []) {
      const arr = veins.nodesIn(Math.floor(e[0] / VB), Math.floor(e[1] / VB));
      for (const p of arr) if (p.wx === e[0] && p.wy === e[1]) p.cd = e[2];
    }
    for (const e of data.ncd || []) {
      const arr = nodes.chunkAt(Math.floor(e[0] / NB), Math.floor(e[1] / NB));
      for (const p of arr) if (p.wx === e[0] && p.wy === e[1]) p.cd = e[2];
    }
    if (data.cam) {
      view.zi = data.cam[0] || 0;
      view.camPX = data.cam[1] || 0;
      view.camPY = data.cam[2] || 0;
      view.clampCam();
    }
  }

  if (data.mat != null && o.setMat) o.setMat(data.mat);
  if (data.surv && o.surv) {
    o.surv.hp = data.surv.hp;
    o.surv.food = data.surv.food;
    o.surv.water = data.surv.water;
  }
  if (data.set) Object.assign(settings, data.set);
  return true;
}

export function write(o) {
  const s = ls();
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(capture(o)));
    return true;
  } catch (e) {
    return false;   // 配额满了或写不了，游戏照常玩
  }
}

export function read(o) {
  const s = ls();
  if (!s) return false;
  let raw = null;
  try { raw = s.getItem(SAVE_KEY); } catch (e) { return false; }
  if (!raw) return false;
  try {
    return restore(o, JSON.parse(raw));
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  const s = ls();
  if (!s) return false;
  try { s.removeItem(SAVE_KEY); return true; } catch (e) { return false; }
}

/** 存档的字节数与时间，菜单里显示用 */
export function saveInfo() {
  const s = ls();
  if (!s) return null;
  let raw = null;
  try { raw = s.getItem(SAVE_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    return { size: raw.length, time: d.t || 0, items: (d.bag || []).length, digs: (d.terra || []).length };
  } catch (e) {
    return null;
  }
}
