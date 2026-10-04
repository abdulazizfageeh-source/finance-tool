/* عامل خدمة بسيط: يخزّن الأداة في الجهاز لتفتح بدون إنترنت.
   الاستراتيجية: الشبكة أولا (لتصل التحديثات)، وإذا لم تتوفر أو تأخرت تُفتح النسخة المخزّنة. */
var CACHE = 'fin-tool-v2';
var CORE = ['./', './financial-tool.html', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CORE.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromNetwork(req) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, 5000);
    fetch(req).then(function (res) { clearTimeout(t); resolve(res); },
                    function (err) { clearTimeout(t); reject(err); });
  });
}

function fromCache(req) {
  var tries = [req, './', './financial-tool.html', './index.html'];
  var chain = Promise.resolve(undefined);
  tries.forEach(function (t) {
    chain = chain.then(function (found) {
      return found || caches.match(t, { ignoreSearch: true });
    });
  });
  return chain.then(function (found) { return found || Response.error(); });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fromNetwork(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return fromCache(req); })
  );
});
