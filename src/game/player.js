// 第一人称玩家：移动、重力、体素 AABB 碰撞、游泳、掉落伤害
import * as THREE from 'three';
import { WATER } from '../world/blocks.js';

const GRAVITY = 30;
const JUMP = 9.0;
const HALF = 0.3;
const BODY = 1.8;
const EYE = 1.62;
const WALK = 4.4;
const SPRINT = 6.6;
const SWIM = 2.8;

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 60, 0); // 脚底坐标
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.15;
    this.onGround = false;
    this.inWater = false;
    this.fly = false;
    this.eyeSmooth = 0;
    this.fallFrom = null;
    this.hp = 100;
    this.hunger = 100;
    this.armor = 0;   // 护甲减伤（穿藤甲/铁甲/重铠后生效）
    this.dead = false;
    this.bob = 0;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  collides(x, y, z) {
    const w = this.world;
    const x0 = Math.floor(x - HALF), x1 = Math.floor(x + HALF);
    const y0 = Math.floor(y + 0.001), y1 = Math.floor(y + BODY - 0.001);
    const z0 = Math.floor(z - HALF), z1 = Math.floor(z + HALF);
    for (let yy = y0; yy <= y1; yy++)
      for (let zz = z0; zz <= z1; zz++)
        for (let xx = x0; xx <= x1; xx++) {
          if (w.isSolid(xx, yy, zz)) return true;
        }
    return false;
  }

  /** 单轴移动：发生碰撞时二分逼近贴合位置，保留沿墙滑行 */
  moveAxis(axis, delta) {
    if (delta === 0) return 0;
    const p = this.pos;
    let target = axis === 0 ? p.x + delta : axis === 1 ? p.y + delta : p.z + delta;
    const test = (v) => axis === 0 ? this.collides(v, p.y, p.z)
      : axis === 1 ? this.collides(p.x, v, p.z)
        : this.collides(p.x, p.y, v);
    if (!test(target)) {
      if (axis === 0) p.x = target; else if (axis === 1) p.y = target; else p.z = target;
      return delta;
    }
    // 二分：找到刚好不碰撞的位移
    let lo = 0, hi = delta;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const v = axis === 0 ? p.x + mid : axis === 1 ? p.y + mid : p.z + mid;
      if (test(v)) hi = mid; else lo = mid;
    }
    const moved = lo;
    if (axis === 0) p.x += moved; else if (axis === 1) p.y += moved; else p.z += moved;
    return moved;
  }

  update(dt, input) {
    const p = this.pos, v = this.vel;

    // 相机朝向基向量（three 相机默认朝 -Z）
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy, fz = -cy;
    const rx = cy, rz = -sy;

    let mx = 0, mz = 0;
    if (input.forward) { mx += fx; mz += fz; }
    if (input.back) { mx -= fx; mz -= fz; }
    if (input.right) { mx += rx; mz += rz; }
    if (input.left) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    const feetBlock = this.world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z));
    this.inWater = feetBlock === WATER;
    const midBlock = this.world.getBlock(Math.floor(p.x), Math.floor(p.y + BODY * 0.6), Math.floor(p.z));
    const headInWater = midBlock === WATER;

    let speed = input.sprint ? SPRINT : WALK;
    if (this.inWater || headInWater) speed = SWIM;

    const wishX = mx * speed, wishZ = mz * speed;
    const accel = this.onGround ? 16 : 8;
    const k = 1 - Math.exp(-accel * dt);
    v.x += (wishX - v.x) * k;
    v.z += (wishZ - v.z) * k;

    if (this.fly) {
      v.y = 0;
      if (input.jump) p.y += 8 * dt;
      if (input.crouch) p.y -= 8 * dt;
      this.onGround = false;
    } else if (this.inWater || headInWater) {
      v.y -= GRAVITY * 0.28 * dt;
      v.y = Math.max(v.y, -3.2);
      if (input.jump) v.y = 3.4;
      if (v.y > 0) this.fallFrom = null;
    } else {
      v.y -= GRAVITY * dt;
      v.y = Math.max(v.y, -55);
      if (input.jump && this.onGround) {
        v.y = JUMP;
        this.onGround = false;
      }
    }

    // 水平移动 + 自动上 1 格台阶
    const beforeX = p.x;
    this.moveAxis(0, v.x * dt);
    if (Math.abs(p.x - beforeX) < Math.abs(v.x * dt) - 1e-6 && this.onGround) {
      const stepY = p.y + 1.02;
      if (!this.collides(p.x + Math.sign(v.x) * 0.05, stepY, p.z) && !this.collides(p.x, stepY, p.z)) {
        const oldY = p.y;
        p.y = Math.floor(p.y) + 1;
        this.eyeSmooth -= (p.y - oldY);
        this.moveAxis(0, v.x * dt * 0.9);
      }
    }
    const beforeZ = p.z;
    this.moveAxis(2, v.z * dt);
    if (Math.abs(p.z - beforeZ) < Math.abs(v.z * dt) - 1e-6 && this.onGround) {
      const stepY = p.y + 1.02;
      if (!this.collides(p.x, stepY, p.z + Math.sign(v.z) * 0.05) && !this.collides(p.x, stepY, p.z)) {
        const oldY = p.y;
        p.y = Math.floor(p.y) + 1;
        this.eyeSmooth -= (p.y - oldY);
        this.moveAxis(2, v.z * dt * 0.9);
      }
    }

    // 垂直
    const movedY = this.moveAxis(1, v.y * dt);
    if (movedY !== v.y * dt) {
      if (v.y < 0) {
        this.onGround = true;
        if (this.fallFrom !== null) {
          const fall = this.fallFrom - p.y;
          if (fall > 3.5) this.hurt(Math.round((fall - 3.5) * 5));
          this.fallFrom = null;
        }
      }
      v.y = 0;
    } else {
      if (v.y < -0.1) {
        this.onGround = false;
        if (this.fallFrom === null) this.fallFrom = p.y;
      } else if (v.y > 0) {
        this.onGround = false;
      }
    }
    if (this.fly) this.onGround = false;

    // 掉出世界保护
    if (p.y < -8) {
      p.y = 90; v.y = 0; this.hurt(20);
    }

    // 视角摇晃
    const moving = Math.hypot(v.x, v.z);
    if (this.onGround && moving > 0.5) this.bob += dt * moving * 1.6;
    this.eyeSmooth += (0 - this.eyeSmooth) * Math.min(1, dt * 8);

    this.applyCamera();
  }

  applyCamera() {
    const bobY = Math.sin(this.bob) * 0.045;
    this.camera.position.set(
      this.pos.x,
      this.pos.y + EYE + this.eyeSmooth + bobY,
      this.pos.z
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE + this.eyeSmooth, this.pos.z);
  }

  dir() {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    return v;
  }

  hurt(n) {
    if (this.dead) return;
    const dmg = Math.max(1, Math.round(n - this.armor));
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.dead = true;
  }

  respawn(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.hp = 100;
    this.hunger = 60;
    this.dead = false;
    this.fallFrom = null;
  }
}
