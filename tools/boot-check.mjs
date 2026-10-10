// 启动门禁：给 2.5D 入口搭一套 DOM 桩，在 Node 里真把它跑起来，再跑几帧主循环。
//
// 为什么要有这一道：语法检查（node --check）只能证明模块「能解析」，
// 证明不了「跑得起来」。曾经有一次，存档句柄用到了下面才声明的 const，
// 掉进暂时性死区 —— 模块一加载就抛 ReferenceError，入口整个不执行，
// 页面上什么都没有，就是一片黑。那种错语法检查抓不到，只有真启动才抓得到。
//
// 用法：node tools/boot-check.mjs
// 失败就退出码 1，CI 因此会在打包之前停下来，不会把黑屏的版本发出去。
const W = 1280, H = 720;

function ctxStub() {
  const target = {
    canvas: { width: W, height: H },
    measureText: (s) => ({ width: String(s).length * 6 }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * 4 * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * 4 * h * 4) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
  };
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'font') return '11px monospace';
      return () => undefined;              // 其余绘图方法一律吞掉
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

function elStub(id = '') {
  const e = {
    id, hidden: false, textContent: '', innerHTML: '', value: '',
    width: W, height: H, dataset: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    getContext: () => ctxStub(),
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { this.children.push(...cs); },
    prepend(...cs) { this.children.unshift(...cs); },
    after(...cs) { this.children.push(...cs); },
    before(...cs) { this.children.unshift(...cs); },
    insertAdjacentHTML() {}, insertAdjacentElement: () => null,
    closest: () => null, matches: () => false, scrollIntoView() {},
    cloneNode() { return elStub(id); },
    parentNode: null, firstChild: null, lastChild: null, nextSibling: null,
    removeChild() {}, insertBefore() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => elStub(), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H }),
    setAttribute() {}, getAttribute: () => null, focus() {}, blur() {},
    onclick: null, oninput: null, onchange: null,
  };
  e.style = new Proxy({}, { get: () => '', set: () => true });
  return e;
}

const els = new Map();
const store = new Map();
const frames = [];

// 往全局上挂浏览器对象。不能直接赋值：Node 22 起 navigator 是只读 getter，
// 一赋值就抛 TypeError（Node 20 没有这个对象，赋值反而没事），
// 所以先看描述符，碰上只有 getter 的就用 defineProperty 覆盖。
function setGlobal(name, value) {
  const d = Object.getOwnPropertyDescriptor(globalThis, name);
  if (d && !d.writable && !d.set) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  } else {
    globalThis[name] = value;
  }
}

const win = {
  addEventListener() {}, removeEventListener() {},
  devicePixelRatio: 1, innerWidth: W, innerHeight: H,
  location: { search: '', href: 'https://example.invalid/iso.html' },
  requestAnimationFrame: (f) => frames.push(f),
  cancelAnimationFrame() {},
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};

setGlobal('document', {
  getElementById(id) {
    if (!els.has(id)) els.set(id, elStub(id));
    return els.get(id);
  },
  createElement: (tag) => elStub(tag),
  querySelector: () => elStub(), querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: elStub('body'), documentElement: elStub('html'),
});
setGlobal('window', win);
setGlobal('localStorage', win.localStorage);
setGlobal('location', win.location);
setGlobal('devicePixelRatio', 1);
setGlobal('requestAnimationFrame', win.requestAnimationFrame);
setGlobal('cancelAnimationFrame', () => {});
setGlobal('addEventListener', () => {});
setGlobal('self', win);
setGlobal('navigator', { userAgent: 'node', maxTouchPoints: 0 });

let bad = 0;
function report(step, ok, err) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + step + (err ? '  — ' + err : ''));
  if (!ok) bad++;
}

try {
  await import('../src/iso/main2d.js');
  report('2.5D 入口加载与初始化', true);
} catch (e) {
  // 这一条正是黑屏的模样：模块一加载就抛，入口整个不执行
  report('2.5D 入口加载与初始化', false, e.name + ': ' + e.message);
  console.log((e.stack || '').split('\n').slice(1, 5).join('\n'));
  process.exit(1);
}

// 主循环是真正出图的地方，黑屏也可能只出在某一帧
let t = 0;
for (let i = 0; i < 5 && frames.length; i++) {
  t += 16;
  try {
    frames.shift()(t);
    report('第 ' + (i + 1) + ' 帧', true);
  } catch (e) {
    report('第 ' + (i + 1) + ' 帧', false, e.name + ': ' + e.message);
    console.log((e.stack || '').split('\n').slice(1, 5).join('\n'));
    process.exit(1);
  }
}
if (!frames.length) report('注册了主循环', false, '没有排队任何动画帧');

console.log(bad ? '\n启动门禁未通过' : '\n启动门禁通过');
process.exit(bad ? 1 : 0);
