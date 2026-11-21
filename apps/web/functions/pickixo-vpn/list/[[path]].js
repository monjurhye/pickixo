/**
 * Cloudflare Pages Function: the Pickixo VPN server list, kept fresh.
 *
 *   GET https://pickixo.com/pickixo-vpn/list/servers.txt
 *
 * The published VPN app downloads its server list from that address. The list
 * is regenerated every 30 minutes by the "Pickixo VPN server list" scheduled
 * task on the origin server, and a static site has no such task: the copy in
 * public/pickixo-vpn/list/servers.txt is a snapshot from the day of the build
 * and goes stale as servers come and go.
 *
 * So this function fetches the current list from the origin server, which
 * still answers on www.pickixo.com for this one address (see the www block in
 * config/nginx/pickixo.com.conf on main), and serves it here. If the origin is
 * down, slow, or returns something that is not a list, the snapshot is served
 * instead, so the app always gets a list.
 *
 * This is a plain .js file on purpose: tsconfig.json has allowJs off, so the
 * Next.js build ignores it. Pages builds it separately from this folder.
 *
 * `X-List-Source` on the response says which copy was served:
 *   origin    fetched from the origin server just now
 *   cache     an origin copy fetched within the last five minutes
 *   snapshot  the file from the build (the origin could not be used)
 */

const LIST_PATH = '/pickixo-vpn/list/servers.txt';
const ORIGIN_URL = 'https://www.pickixo.com/pickixo-vpn/list/servers.txt';

/** Every list starts with this line; anything else is an error page. */
const MAGIC = 'PXL1';

/** The task runs every 30 minutes, so five minutes of caching costs nothing. */
const MAX_AGE_SECONDS = 300;
const ORIGIN_TIMEOUT_MS = 4000;

function listResponse(body, source) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
      'X-List-Source': source,
    },
  });
}

async function fromOrigin() {
  const response = await fetch(ORIGIN_URL, {
    // A redirect would mean nginx no longer serves the list on www and is
    // sending us to the apex, which is this function: do not follow it.
    redirect: 'manual',
    signal: AbortSignal.timeout(ORIGIN_TIMEOUT_MS),
  });
  if (response.status !== 200) return null;
  const body = await response.text();
  return body.startsWith(MAGIC) ? body : null;
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  if (url.pathname !== LIST_PATH || !isRead) return context.next();

  // The Cache API only stores GET, and the key must not carry a query string
  // or every ?x=1 would be its own entry and its own origin fetch.
  const cacheKey = new Request(url.origin + LIST_PATH, { method: 'GET' });
  const cache = caches.default;

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set('X-List-Source', 'cache');
      return response;
    }
  } catch {
    // No cache is not a reason to fail; carry on to the origin.
  }

  try {
    const body = await fromOrigin();
    if (body) {
      context.waitUntil(cache.put(cacheKey, listResponse(body, 'origin')).catch(() => {}));
      return listResponse(body, 'origin');
    }
  } catch {
    // Timeout or network error: fall through to the snapshot.
  }

  // Not cached, so the next request tries the origin again.
  const snapshot = await context.next();
  const response = new Response(snapshot.body, snapshot);
  response.headers.set('X-List-Source', 'snapshot');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
