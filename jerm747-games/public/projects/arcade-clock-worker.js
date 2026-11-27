// Install the same pause clock in game HTML already hosted in the arcade.
// The browser and each game continue to manage their own asset caches.
// v2: the page streams through. Only the start of the file (up to </head>, at most 64 KB) is held
// to add the clock tag, so big games start drawing while the rest of the file is still arriving.
const PEEK = 65536;
const TAG = '<script src="/arcade-hud/game-clock.js"></script>';

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin ||
      !url.pathname.startsWith('/projects/') || !/(?:\/|\.html?)$/i.test(url.pathname)) return;
  event.respondWith((async () => {
    let response;
    try { response = await fetch(request); }
    catch { return fetch(request); } // let the browser show its own error / retry once
    if (!response.ok || response.redirected || !response.body ||
        !/^text\/html\b/i.test(response.headers.get('Content-Type') || '')) return response;
    const headers = new Headers(response.headers);
    for (const key of ['content-length', 'content-encoding', 'etag', 'content-md5']) headers.delete(key);
    return new Response(withClock(response.body), {status: response.status, statusText: response.statusText, headers});
  })());
});

function withClock(body) {
  // Peek at raw bytes; a single-byte decoder keeps string offsets equal to byte offsets.
  const reader = body.getReader(), peek = new TextDecoder('latin1'), encoder = new TextEncoder();
  let held = new Uint8Array(0), decided = false;
  return new ReadableStream({
    async pull(controller) {
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (decided) {
            if (done) controller.close(); else controller.enqueue(value);
            return;
          }
          if (value) { const next = new Uint8Array(held.length + value.length); next.set(held); next.set(value, held.length); held = next; }
          const text = peek.decode(held);
          if (!done && held.length < PEEK && !/<\/head>/i.test(text)) continue; // keep peeking
          decided = true;
          const open = /<head\b[^>]*>/i.exec(text);
          if (open && !text.includes('game-clock.js')) {
            const at = open.index + open[0].length;
            controller.enqueue(held.subarray(0, at));
            controller.enqueue(encoder.encode(TAG));
            controller.enqueue(held.subarray(at));
          } else controller.enqueue(held);
          held = null;
          if (done) controller.close();
          return;
        }
      } catch (error) { controller.error(error); }
    },
    cancel(reason) { return reader.cancel(reason); }
  });
}
