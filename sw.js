// 离线缓存：装到桌面或打进 APK 之后，没网也能进山水
const CACHE = 'yunshan-v4';
// 清单里少一个文件，addAll 就会整包失败（离线进不去），所以新增模块要记着补上
const ASSETS = [
  './', './index.html', './iso.html', './voxel.html', './selftest.html',
  './manifest.json', './icon.svg',
  './vendor/three.module.js',
  './src/main.js', './src/core/items.js', './src/core/noise.js', './src/core/terrain.js',
  './src/core/biome.js',
  './src/game/crafting.js', './src/game/craftgen.js', './src/game/inventory.js',
  './src/game/player.js', './src/game/enemies.js', './src/game/survival.js',
  './src/ui/hud.js', './src/ui/closer.js',
  './src/world/blocks.js', './src/world/chunk.js', './src/world/generator.js',
  './src/world/structures.js', './src/world/world.js',
  './src/iso/main2d.js', './src/iso/world2d.js', './src/iso/view2d.js',
  './src/iso/traveler.js', './src/iso/fishing.js',
  './src/iso/render2d.js', './src/iso/palette.js', './src/iso/edit2d.js',
  './src/iso/veins.js', './src/iso/nodes.js', './src/iso/skill.js',
  './src/iso/codex.js', './src/iso/menu.js', './src/iso/save.js', './src/iso/survival.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.map((k) => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const mine = new URL(req.url).origin === self.location.origin;

  // 自家文件一律「先问网络，再退缓存」。
  // 以前是缓存优先，于是修好的版本发上去了，浏览器还在拿旧副本喂你，
  // 面板关不掉这种问题就会一直犯。断网时照样从缓存起，不影响离线玩。
  if (mine) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./iso.html'))),
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
