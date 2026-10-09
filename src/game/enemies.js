// 夜间出没的野兽：简单追击 AI + 体素拼装外观
import * as THREE from 'three';

const MAX = 8;

export class Enemies {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.spawnTimer = 3;
    this.matBody = new THREE.MeshLambertMaterial({ color: 0x6d5744 });
    this.matHead = new THREE.MeshLambertMaterial({ color: 0x57432f });
    this.matEye = new THREE.MeshBasicMaterial({ color: 0xff6a3c });
    this.matHurt = new THREE.MeshLambertMaterial({ color: 0xff5544 });
    this.geoBody = new THREE.BoxGeometry(1.05, 0.55, 0.52);
    this.geoHead = new THREE.BoxGeometry(0.44, 0.42, 0.46);
    this.geoLeg = new THREE.BoxGeometry(0.16, 0.5, 0.16);
    this.geoTail = new THREE.BoxGeometry(0.14, 0.14, 0.5);
    this.geoEye = new THREE.BoxGeometry(0.08, 0.08, 0.06);
  }

  makeMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.geoBody, this.matBody);
    body.position.set(0, 0.66, 0);
    g.add(body);
    const head = new THREE.Mesh(this.geoHead, this.matHead);
    head.position.set(0, 0.82, -0.62);
    g.add(head);
    for (const [x, z] of [[-0.36, -0.3], [0.36, -0.3], [-0.36, 0.32], [0.36, 0.32]]) {
      const leg = new THREE.Mesh(this.geoLeg, this.matBody);
      leg.position.set(x, 0.25, z);
      g.add(leg);
    }
    const tail = new THREE.Mesh(this.geoTail, this.matHead);
    tail.position.set(0, 0.78, 0.62);
    g.add(tail);
    for (const x of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(this.geoEye, this.matEye);
      eye.position.set(x, 0.9, -0.84);
      g.add(eye);
    }
    return g;
  }

  groundY(x, z, fromY) {
    const w = this.world;
    for (let y = Math.min(fromY, 94); y > 2; y--) {
      if (w.isSolid(x, y, z)) return y + 1;
    }
    return null;
  }

  spawnNear(player) {
    if (this.list.length >= MAX) return;
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 16;
      const x = Math.floor(player.pos.x + Math.cos(a) * r);
      const z = Math.floor(player.pos.z + Math.sin(a) * r);
      const gy = this.groundY(x, z, Math.floor(player.pos.y) + 12);
      if (gy === null || gy < 30) continue;
      if (this.world.getBlock(x, gy, z) === 5) continue; // 不在水里刷
      const mesh = this.makeMesh();
      this.group.add(mesh);
      this.list.push({ x: x + 0.5, y: gy, z: z + 0.5, vy: 0, hp: 24, cool: 0, mesh, hurtT: 0 });
      return;
    }
  }

  update(dt, player, isNight, onKill) {
    this.spawnTimer -= dt;
    if (isNight && this.spawnTimer <= 0) {
      this.spawnTimer = 6 + Math.random() * 6;
      this.spawnNear(player);
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      const dx = player.pos.x - e.x, dz = player.pos.z - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 52 || (!isNight && dist > 28)) {
        this.group.remove(e.mesh);
        this.list.splice(i, 1);
        continue;
      }

      // 追击
      if (dist > 1.25) {
        const s = 3.3 * dt;
        const nx = e.x + (dx / dist) * s;
        const nz = e.z + (dz / dist) * s;
        const gy = this.groundY(Math.floor(nx), Math.floor(nz), Math.floor(e.y) + 3);
        if (gy !== null) {
          e.x = nx; e.z = nz;
          if (gy - e.y >= 1.05 && gy - e.y < 2.2) e.y = gy; // 上一格台阶
          else if (e.y - gy > 1.2) { e.vy -= 26 * dt; e.y += e.vy * dt; }
          else e.y = gy;
          if (gy - e.y > 2.5) { e.x -= (dx / dist) * s; e.z -= (dz / dist) * s; } // 太高，放弃
          e.vy = 0;
        }
        e.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
      }

      // 攻击玩家
      e.cool -= dt;
      if (dist < 1.5 && e.cool <= 0 && Math.abs(player.pos.y - e.y) < 2.2) {
        e.cool = 1.3;
        player.hurt(9);
      }

      e.hurtT = Math.max(0, e.hurtT - dt);
      e.mesh.scale.setScalar(e.hurtT > 0 ? 0.9 : 1);
      e.mesh.children[0].material = e.hurtT > 0 ? this.matHurt : this.matBody;
      e.mesh.position.set(e.x, e.y, e.z);
    }
  }

  /** 玩家挥击：命中视线前方最近的野兽 */
  attack(origin, dir, range, damage, onKill) {
    let best = null, bestD = Infinity;
    for (const e of this.list) {
      const cx = e.x, cy = e.y + 0.7, cz = e.z;
      const vx = cx - origin.x, vy = cy - origin.y, vz = cz - origin.z;
      const d = Math.hypot(vx, vy, vz);
      if (d > range) continue;
      const dot = (vx * dir.x + vy * dir.y + vz * dir.z) / Math.max(0.0001, d);
      if (dot < 0.72) continue;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return false;
    best.hp -= damage;
    best.hurtT = 0.18;
    // 击退
    best.x += dir.x * 0.6; best.z += dir.z * 0.6;
    if (best.hp <= 0) {
      this.group.remove(best.mesh);
      this.list.splice(this.list.indexOf(best), 1);
      if (onKill) onKill(best);
      return 'kill';
    }
    return true;
  }

  clear() {
    for (const e of this.list) this.group.remove(e.mesh);
    this.list.length = 0;
  }
}
