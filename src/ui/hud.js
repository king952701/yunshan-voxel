// HUD 与面板：生命/饥饿、快捷栏、背包、合成、提示
import { itemName, itemIcon, itemColor } from '../world/blocks.js';
import { RECIPES, CATEGORIES, canCraft } from '../game/crafting.js';
import { HOTBAR, INV_SIZE } from '../game/inventory.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(onCraft) {
    this.el = {
      hp: $('bar-hp'), hunger: $('bar-hunger'), hpText: $('hp-text'), hungerText: $('hunger-text'),
      clock: $('clock'), day: $('day'), coord: $('coord'), perf: $('perf'), armor: $('armor'),
      hotbar: $('hotbar'), inv: $('inv-grid'), craft: $('craft-list'),
      panelInv: $('panel-inv'), panelCraft: $('panel-craft'),
      toast: $('toast'), start: $('overlay-start'), dead: $('overlay-dead'),
      crosshair: $('crosshair'), breakBar: $('break-bar'),
      help: $('help'),
    };
    this.onCraft = onCraft;
    this.openPanel = null;
    this.toastTimer = 0;
    this.buildHotbar();
    this.buildCraft();
  }

  buildHotbar() {
    this.el.hotbar.innerHTML = '';
    this.hotSlots = [];
    for (let i = 0; i < HOTBAR; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = '<span class="num"></span><span class="ic"></span><span class="ct"></span>';
      d.querySelector('.num').textContent = (i + 1);
      this.el.hotbar.appendChild(d);
      this.hotSlots.push(d);
    }
  }

  /** 按类别分组渲染 50 条配方 */
  buildCraft() {
    this.el.craft.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'craft-head';
    head.textContent = `共 ${RECIPES.length} 式 · 材料齐备者高亮`;
    this.el.craft.appendChild(head);
    this.craftRows = new Array(RECIPES.length);
    for (const cat of CATEGORIES) {
      const h = document.createElement('h3');
      h.className = 'craft-cat';
      h.textContent = cat.label;
      this.el.craft.appendChild(h);
      RECIPES.forEach((r, i) => {
        if (r.cat !== cat.key) return;
        const row = document.createElement('button');
        row.className = 'craft-row';
        const cost = Object.keys(r.in).map((k) => `${itemName(+k)}×${r.in[k]}`).join(' + ');
        row.innerHTML = '<span class="cname"></span><span class="ccost"></span><span class="ctip"></span>';
        row.querySelector('.cname').textContent = `${itemName(r.out.id)} ×${r.out.count}`;
        row.querySelector('.ccost').textContent = cost;
        row.querySelector('.ctip').textContent = r.tip || '';
        row.addEventListener('click', () => this.onCraft(i));
        this.el.craft.appendChild(row);
        this.craftRows[i] = row;
      });
    }
  }

  updateStats(player, survival, fps, enemies) {
    const hp = Math.max(0, Math.round(player.hp));
    const hu = Math.max(0, Math.round(player.hunger));
    this.el.hp.style.width = hp + '%';
    this.el.hunger.style.width = hu + '%';
    this.el.hpText.textContent = hp;
    this.el.hungerText.textContent = hu;
    this.el.clock.textContent = survival.clockString();
    this.el.day.textContent = survival.day;
    this.el.coord.textContent =
      `${Math.floor(player.pos.x)}, ${Math.floor(player.pos.y)}, ${Math.floor(player.pos.z)}`;
    if (this.el.armor) this.el.armor.textContent = player.armor > 0 ? `减伤 ${player.armor}` : '无';
    this.el.perf.textContent = `${Math.round(fps)} FPS${enemies ? ` · 野兽 ${enemies}` : ''}`;
  }

  renderHotbar(inv) {
    for (let i = 0; i < HOTBAR; i++) {
      const s = inv.slots[i];
      const el = this.hotSlots[i];
      el.classList.toggle('sel', i === inv.selected);
      const ic = el.querySelector('.ic');
      const ct = el.querySelector('.ct');
      if (s) {
        ic.textContent = itemIcon(s.id) || '';
        const col = itemColor(s.id);
        ic.style.background = col;
        ic.style.display = 'block';
        ct.textContent = s.count > 1 ? s.count : '';
        el.title = itemName(s.id);
      } else {
        ic.textContent = '';
        ic.style.background = 'transparent';
        ct.textContent = '';
        el.title = '';
      }
    }
  }

  renderInventory(inv) {
    if (!this.el.inv.dataset.built) {
      this.el.inv.innerHTML = '';
      this.invSlots = [];
      for (let i = 0; i < INV_SIZE; i++) {
        const d = document.createElement('div');
        d.className = 'slot wide';
        d.innerHTML = '<span class="ic"></span><span class="ct"></span><span class="nm"></span>';
        this.el.inv.appendChild(d);
        this.invSlots.push(d);
      }
      this.el.inv.dataset.built = '1';
    }
    for (let i = 0; i < INV_SIZE; i++) {
      const s = inv.slots[i];
      const el = this.invSlots[i];
      if (s) {
        el.querySelector('.ic').style.background = itemColor(s.id);
        el.querySelector('.ic').textContent = itemIcon(s.id) || '';
        el.querySelector('.ct').textContent = s.count > 1 ? s.count : '';
        el.querySelector('.nm').textContent = itemName(s.id);
      } else {
        el.querySelector('.ic').style.background = 'transparent';
        el.querySelector('.ic').textContent = '';
        el.querySelector('.ct').textContent = '';
        el.querySelector('.nm').textContent = '';
      }
    }
    this.renderHotbar(inv);
  }

  updateCraftAvailability(inv) {
    for (let i = 0; i < RECIPES.length; i++) {
      const row = this.craftRows[i];
      if (row) row.classList.toggle('off', !canCraft(inv, RECIPES[i]));
    }
  }

  setPanel(name) {
    this.openPanel = name;
    this.el.panelInv.classList.toggle('show', name === 'inv');
    this.el.panelCraft.classList.toggle('show', name === 'craft');
    if (name === 'inv') this.renderInventory(invRef);
    if (name === 'craft') this.updateCraftAvailability(invRef);
  }

  toast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('show');
    this.toastTimer = 2.2;
  }

  tick(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
  }

  setBreak(p) {
    this.el.breakBar.style.width = Math.round(p * 100) + '%';
    this.el.breakBar.parentElement.style.opacity = p > 0 ? 1 : 0.25;
  }

  showStart(v) { this.el.start.classList.toggle('show', v); }
  showDead(v) { this.el.dead.classList.toggle('show', v); }
  toggleHelp() { this.el.help.classList.toggle('show'); }
}

let invRef = null;
export function bindInventory(inv) { invRef = inv; }
