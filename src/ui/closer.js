// 界面容器右上角的 ✕：点一下就把面板收起来，不留关不掉的东西。
// 样式由脚本自己带进来，两个页面共用一份，也不必指望样式表先更新。

const CSS = `
.panel-x {
  position: absolute; right: 6px; top: 6px; z-index: 5;
  font-family: inherit; font-size: 17px; line-height: 1; cursor: pointer;
  color: #f2e9dc; background: rgba(10,14,20,.55);
  border: 1px solid rgba(232,192,122,.45); border-radius: 2px;
  min-width: 38px; min-height: 34px; padding: 2px 8px;
}
.panel-x:hover { background: rgba(232,192,122,.22); color: #e8c07a; }
.panel-x:active { background: rgba(232,192,122,.38); }
`;

function ensureStyle() {
  if (document.getElementById('panel-x-style')) return;
  const s = document.createElement('style');
  s.id = 'panel-x-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/**
 * 给一个界面容器装上右上角 ✕。
 * @param {HTMLElement} panel 面板本体（须是 absolute / relative 定位的）
 * @param {Function}    hide   点下去要做什么——通常是把这个面板收起来
 * @param {Object}      opts   title 悬停提示；pad 是否给内容让出右侧空位（满屏遮罩传 false）
 */
export function addClose(panel, hide, opts = {}) {
  if (!panel) return null;
  ensureStyle();
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'panel-x';
  b.title = opts.title || '关闭';
  b.setAttribute('aria-label', b.title);
  b.textContent = opts.label || '✕';
  b.onclick = (e) => { e.stopPropagation(); hide(); };
  // 让标题与正文躲开 ✕。写内联是因为 #hud 这类用 ID 定过内边距，样式表压不过。
  if (opts.pad !== false) panel.style.paddingRight = '46px';
  panel.classList.add('has-x');
  panel.appendChild(b);
  return b;
}
