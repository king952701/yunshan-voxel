// 设置菜单：设置 / 帮助 / 关于三个标签。
// 帮助里就是内置数据库，左侧索引右侧详情，可按关键词搜索。
import { CATS, buildCodex, searchCodex, codexByCat, catCount } from './codex.js';

const DAY_SPEEDS = [
  { v: 0, label: '静止' },
  { v: 1, label: '常速' },
  { v: 4, label: '四倍' },
];

export function createMenu(opts) {
  const {
    skills, settings, onSetting, onResetTerrain,
    onSave = () => {}, onLoad = () => {}, onClear = () => {}, saveInfo = () => null,
  } = opts;
  const codex = buildCodex(skills);
  let open = false, tab = 'help', cat = 'all', query = '', picked = codex[0];

  const wrap = document.createElement('div');
  wrap.className = 'menu-wrap';
  wrap.hidden = true;
  wrap.style.display = 'none';
  wrap.innerHTML = `
    <div class="menu">
      <div class="menu-head"><b>云山录 · 设置</b><button class="mx" title="关闭">✕</button></div>
      <div class="menu-tabs">
        <button data-tab="help" class="on">帮助</button>
        <button data-tab="set">设置</button>
        <button data-tab="about">关于</button>
      </div>
      <div class="menu-body">
        <div class="pane" data-pane="help">
          <div class="help-left">
            <input class="search" type="text" placeholder="搜索：铁剑 / 星砂 / 采矿 / 品级 …">
            <div class="cats"></div>
            <div class="entries"></div>
          </div>
          <div class="help-right"><div class="detail"></div></div>
        </div>
        <div class="pane" data-pane="set" hidden>
          <div class="row"><span>昼夜流速</span><span class="btns day"></span></div>
          <div class="row"><span>矿脉提示气泡</span><span class="btns hint"></span></div>
          <div class="row"><span>旅人标记</span><span class="btns player"></span></div>
          <div class="row"><span>界面读数</span><span class="btns hud"></span></div>
          <div class="row"><span>复原全部动土</span><span class="btns reset"></span></div>
          <p class="note">复原会把你挖过、垒过的地方全部还原成原始山水，长卷也会重画一遍。</p>
          <div class="row"><span>存档</span><span class="btns save"></span></div>
          <p class="note save-note"></p>
        </div>
        <div class="pane" data-pane="about" hidden>
          <p><b>云山录</b>　8000×8000 的中式山水，45° 等距、最小像素格。</p>
          <p>同一片山川两副看法：<a href="index.html">体素山川（3D）</a>与
             <a href="iso.html">山水长卷（2.5D）</a>，地形由同一套函数生成。</p>
          <p>地形、矿脉、配方均为确定性生成：同一个种子，同一片山水。</p>
          <p class="note">快捷键：Esc 开关本菜单（点右上角 ✕、或点面板外的暗处也能关），
             C 开百工谱，E 采矿脉，R 回图心。</p>
          <p class="note">构建 v4 · 2026-10-10　—— 若这里写的不是 v4，说明浏览器还在用旧缓存。</p>
        </div>
      </div>
    </div>`;

  const el = {
    cats: wrap.querySelector('.cats'),
    entries: wrap.querySelector('.entries'),
    detail: wrap.querySelector('.detail'),
    search: wrap.querySelector('.search'),
    saveNote: wrap.querySelector('.save-note'),
  };

  function btn(label, on, fn) {
    const b = document.createElement('button');
    b.textContent = label;
    if (on) b.className = 'on';
    b.onclick = fn;
    return b;
  }

  function renderCats() {
    el.cats.innerHTML = '';
    for (const c of CATS) {
      const n = catCount(codex, c.key);
      const b = btn(`${c.label} ${n}`, cat === c.key, () => { cat = c.key; picked = null; renderAll(); });
      el.cats.appendChild(b);
    }
  }

  function renderEntries() {
    const found = searchCodex(codexByCat(codex, cat), query);
    el.entries.innerHTML = '';
    if (!found.length) {
      el.entries.innerHTML = '<div class="empty">没有找到，换个词试试</div>';
      return;
    }
    const show = found.slice(0, 300);
    for (const e of show) {
      const d = document.createElement('div');
      d.className = 'entry' + (e === picked ? ' on' : '');
      d.innerHTML = `<i style="background:${e.color || '#888'}"></i>`
        + `<span class="t">${e.title}</span><span class="s">${e.sub}</span>`;
      d.onclick = () => { picked = e; renderEntries(); renderDetail(); };
      el.entries.appendChild(d);
    }
    if (found.length > show.length) {
      const m = document.createElement('div');
      m.className = 'empty';
      m.textContent = `共 ${found.length} 条，先显示前 ${show.length} 条`;
      el.entries.appendChild(m);
    }
  }

  function renderDetail() {
    if (!picked) {
      el.detail.innerHTML = '<div class="empty">左侧点一条看详情</div>';
      return;
    }
    const e = picked;
    el.detail.innerHTML = `<h3><i style="background:${e.color || '#888'}"></i>${e.title}</h3>`
      + `<div class="sub">${e.sub}</div><div class="body">${e.body}</div>`;
  }

  function renderAll() { renderCats(); renderEntries(); renderDetail(); }

  el.search.oninput = () => { query = el.search.value; renderEntries(); };

  // ---- 设置 ----
  const setPane = wrap.querySelector('[data-pane="set"]');
  const dayBox = setPane.querySelector('.day');
  const hintBox = setPane.querySelector('.hint');
  const playerBox = setPane.querySelector('.player');
  const hudBox = setPane.querySelector('.hud');
  const resetBox = setPane.querySelector('.reset');
  const saveBox = setPane.querySelector('.save');

  function renderSaveNote() {
    const i = saveInfo();
    el.saveNote.textContent = i
      ? `上次存档 ${new Date(i.time).toLocaleString()}　约 ${(i.size / 1024).toFixed(1)} KB`
        + `　${i.items} 格物品、${i.digs} 处动土。游戏每八秒自动存一次，切后台与关页面时也会存。`
      : '还没有存档。游戏每八秒自动存一次，切后台与关页面时也会存。';
  }

  function renderSettings() {
    dayBox.innerHTML = '';
    for (const d of DAY_SPEEDS) {
      dayBox.appendChild(btn(d.label, settings.daySpeed === d.v, () => {
        settings.daySpeed = d.v; onSetting('daySpeed', d.v); renderSettings();
      }));
    }
    const toggle = (box, key) => {
      box.innerHTML = '';
      box.appendChild(btn('开', settings[key], () => {
        settings[key] = true; onSetting(key, true); renderSettings();
      }));
      box.appendChild(btn('关', !settings[key], () => {
        settings[key] = false; onSetting(key, false); renderSettings();
      }));
    };
    toggle(hintBox, 'showHint');
    toggle(playerBox, 'showPlayer');
    toggle(hudBox, 'showHud');
    resetBox.innerHTML = '';
    resetBox.appendChild(btn('复原地形', false, () => {
      onResetTerrain();
      api.close();
    }));
    saveBox.innerHTML = '';
    saveBox.appendChild(btn('立即存档', false, () => { onSave(); renderSaveNote(); }));
    saveBox.appendChild(btn('读档', false, () => { onLoad(); renderSaveNote(); }));
    saveBox.appendChild(btn('清档重开', false, () => { onClear(); renderSaveNote(); }));
    renderSaveNote();
  }
  renderSettings();

  // ---- 标签 ----
  wrap.querySelectorAll('.menu-tabs button').forEach((b) => {
    b.onclick = () => {
      tab = b.dataset.tab;
      wrap.querySelectorAll('.menu-tabs button').forEach((x) => x.classList.toggle('on', x === b));
      wrap.querySelectorAll('.pane').forEach((p) => {
        const on = p.dataset.pane === tab;
        p.hidden = !on;
        p.style.display = on ? (p.dataset.pane === 'help' ? 'flex' : 'block') : 'none';
      });
      if (tab === 'help') el.search.focus();
    };
  });

  wrap.querySelector('.mx').onclick = () => api.close();
  wrap.onclick = (e) => { if (e.target === wrap) api.close(); };

  // 开关一律写内联样式，不靠 CSS 层叠：
  // 从前只用 hidden 属性，而 .menu-wrap 的 display:flex 会把浏览器的
  // [hidden]{display:none} 盖掉，于是 ✕ 点了等于没点，面板关不上。
  // 改成内联之后，就算浏览器手里还攥着旧样式表也压不住。
  function show(v) {
    open = v;
    wrap.hidden = !v;
    wrap.style.display = v ? 'flex' : 'none';
  }

  const api = {
    open() {
      show(true);
      renderAll();
      renderSettings();
      if (tab === 'help') el.search.focus();
    },
    close() { show(false); },
    toggle() { open ? api.close() : api.open(); },
    isOpen: () => open,
  };

  document.body.appendChild(wrap);
  return api;
}
