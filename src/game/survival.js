// 生存数值：生命、饥饿、昼夜推进
import { ITEMS } from '../world/blocks.js';

export const DAY_LENGTH = 480; // 一昼夜 8 分钟

export class Survival {
  constructor() {
    this.time = 0.30;   // 0=午夜 0.25=日出 0.5=正午 0.75=日落
    this.day = 1;
    this.hungerTimer = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
  }

  isNight() {
    return this.time < 0.24 || this.time > 0.76;
  }

  /** 夜色浓度 0..1，用于降低环境光 */
  nightAmount() {
    // 正午 0，午夜 1
    const t = this.time;
    if (t > 0.30 && t < 0.70) return 0;
    if (t <= 0.30) return Math.min(1, (0.30 - t) / 0.18);
    return Math.min(1, (t - 0.70) / 0.18);
  }

  update(dt, player, moving) {
    const prev = this.time;
    this.time += dt / DAY_LENGTH;
    if (this.time >= 1) { this.time -= 1; this.day++; }

    // 饥饿：移动更饿
    this.hungerTimer += dt * (moving ? 1.6 : 1.0);
    if (this.hungerTimer >= 1) {
      this.hungerTimer = 0;
      player.hunger = Math.max(0, player.hunger - 0.12);
    }
    if (player.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 2) { this.starveTimer = 0; player.hurt(2); }
    } else {
      this.starveTimer = 0;
    }
    // 饱食时缓慢回血
    if (player.hunger > 70 && player.hp < 100) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3) { this.regenTimer = 0; player.hp = Math.min(100, player.hp + 1); }
    } else {
      this.regenTimer = 0;
    }
  }

  eat(player, itemId) {
    const it = ITEMS[itemId];
    if (!it || !it.food) return false;
    player.hunger = Math.min(100, player.hunger + it.food);
    player.hp = Math.min(100, player.hp + Math.round(it.food * 0.3));
    return true;
  }

  clockString() {
    const total = this.time * 24;
    const h = Math.floor(total);
    const m = Math.floor((total - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
