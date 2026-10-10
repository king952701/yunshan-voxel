// 离线缓存：装到桌面或打进 APK 之后，没网也能进山水
const CACHE = 'yunshan-v2';
const ASSETS = [
  './', './index.html', './iso.html', './voxel.html', './manifest.json', './icon.svg',
  './vendor/three.module.js',
  './src/main.js', './src/core/items.js', './src/core/noise.js', './src/core/terrain.js',
  './src/game/crafting.js', './src/game/craftgen.js', './src/game/inventory.js',
  './src/game/player.js', './src/game/enemies.js', './src/game/survival.js',
  './src/ui/hud.js',
  './src/world/blocks.js', './src/world/chunk.js', './src/world/generator.js',
  './src/world/structures.js', './src/world/world.js',
  './src/iso/main2d.js', './src/iso/world2d.js', './src/iso/view2d.js',
  './src/iso/render2d.js', './src/iso/palette.js', './src/iso/edit2d.js',
  './src/iso/veins.js', './src/iso/nodes.js', './src/iso/skill.js',
  './src/iso/codex.js', './src/iso/menu.js',
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./iso.html'))),
  );
});
