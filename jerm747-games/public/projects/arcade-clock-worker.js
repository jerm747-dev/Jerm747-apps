// Install the same pause clock in game HTML already hosted in the arcade.
// The browser and each game continue to manage their own asset caches.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin ||
      !url.pathname.startsWith('/projects/') || !/(?:\/|\.html?)$/i.test(url.pathname)) return;
  event.respondWith((async () => {
    const response = await fetch(request);
    if (!response.ok || response.redirected || !/^text\/html\b/i.test(response.headers.get('Content-Type')||'')) return response;
    const html = await response.clone().text();
    if (html.includes('game-clock.js') || !/<head\b[^>]*>/i.test(html)) return response;
    const headers = new Headers(response.headers);
    for (const key of ['content-length','content-encoding','etag','content-md5']) headers.delete(key);
    const body = html.replace(/<head\b[^>]*>/i, head=>head+'<script src="/arcade-hud/game-clock.js"></script>');
    return new Response(body,{status:response.status,statusText:response.statusText,headers});
  })());
});
