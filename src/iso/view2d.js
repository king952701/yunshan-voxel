// 45° 等距视图：世界格 <-> 屏幕像素，缩放与漫游
import { WORLD } from './world2d.js';

// 相对「整图铺满」的倍数：1 = 一屏看完 8000x8000
export const ZOOM_MULTS = [1, 2, 4, 8, 16, 32, 64, 128];

export class View2D {
  constructor() {
    this.zi = 0;        // 缩放档
    this.camPX = 0;     // 视图中心在投影空间的坐标（像素）
    this.camPY = 0;
    this.w = 1;
    this.h = 1;
    this.hz = 0.55;     // 高度换算：1 格高度 = 0.55 个半格高
  }

  /** 整图铺满时的 tile 宽（像素/格） */
  fitTw() {
    return Math.min(this.w / (WORLD * 0.5), this.h / (WORLD * 0.25));
  }

  get tw() { return this.fitTw() * ZOOM_MULTS[this.zi]; }
  get th() { return this.tw / 2; }

  /** 近景档：每格 >= 8 像素时逐格绘制立体块 */
  get near() { return this.tw >= 8; }

  /** 世界格 -> 投影空间像素（不含视口平移） */
  projOf(wx, wy, h) {
    const tw = this.tw, th = this.th;
    return [
      (wx - wy) * tw / 2,
      (wx + wy) * th / 2 - (h - 28) * th * this.hz,
    ];
  }

  /** 投影空间 -> 视口像素 */
  toScreen(px, py) {
    return [px - this.camPX + this.w / 2, py - this.camPY + this.h / 2];
  }

  /** 视口像素 -> 投影空间 */
  toProj(sx, sy) {
    return [sx + this.camPX - this.w / 2, sy + this.camPY - this.h / 2];
  }

  /** 视口中心对应的世界格 */
  center() {
    const u = 2 * this.camPX / this.tw;
    const v = 4 * this.camPY / this.tw;
    return [Math.round((u + v) / 2), Math.round((v - u) / 2)];
  }

  /** 把视图中心移到世界格 (wx, wy) */
  lookAt(wx, wy) {
    const p = this.projOf(wx, wy, 28);
    this.camPX = p[0];
    this.camPY = p[1];
  }

  /** 屏幕平移（拖拽）：dx,dy 为像素位移 */
  pan(dx, dy) {
    this.camPX -= dx;
    this.camPY -= dy;
  }

  /** 以视口内某点为锚缩放；dir = +1 放大 / -1 缩小 */
  zoomAt(dir, sx, sy) {
    const before = this.toProj(sx, sy);
    const u = 2 * before[0] / this.tw;
    const v = 4 * before[1] / this.tw;
    this.zi = Math.max(0, Math.min(ZOOM_MULTS.length - 1, this.zi + dir));
    const tw2 = this.tw;
    this.camPX = u * tw2 / 2 - (sx - this.w / 2);
    this.camPY = v * (tw2 / 2) / 2 - (sy - this.h / 2);
    this.clampCam();
  }

  /** 不让视野飘出图外太远 */
  clampCam() {
    const tw = this.tw;
    const maxPx = WORLD * tw / 2 + this.w;
    const maxPy = WORLD * tw / 4 + this.h;
    if (this.camPX > maxPx) this.camPX = maxPx;
    if (this.camPX < -maxPx) this.camPX = -maxPx;
    if (this.camPY > maxPy) this.camPY = maxPy;
    if (this.camPY < -maxPy) this.camPY = -maxPy;
  }
}
