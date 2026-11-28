/**
 * POST /api/land/read — the "কাগজ মিলিয়ে দেখুন" tool on /bhumi-seba sends one
 * document (up to 8 pages, base64) here and gets the extracted fields back.
 *
 * Nothing is stored: no KV write of the content, no logging of the pages or
 * the result. See functions-lib/land-read.js for configuration.
 */
import {
  DEFAULT_MODEL, geminiRequest, parseGemini, takeQuota, validatePages,
} from '../../../functions-lib/land-read.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

/** Only our own pages may spend the Gemini budget. */
function allowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  const host = new URL(origin).hostname;
  return host === 'pickixo.com' || host === 'www.pickixo.com' || host.endsWith('.pickixo.pages.dev')
    || host === 'localhost' || host === '127.0.0.1';
}

export async function onRequestPost({ request, env }) {
  if (!allowedOrigin(request)) return json({ error: 'অনুমতি নেই।' }, 403);
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'কাগজ পড়ার সেবা এখনো চালু হয়নি। কিছুদিন পর আবার চেষ্টা করুন।' }, 503);
  }

  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 22 * 1024 * 1024) return json({ error: 'ফাইল খুব বড়। মোট ১৫ MB-এর কম রাখুন।' }, 413);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'অনুরোধটা পড়া যায়নি।' }, 400); }
  const { pages, error } = validatePages(body);
  if (error) return json({ error }, 400);

  const quota = await takeQuota(env, request.headers.get('CF-Connecting-IP') || 'unknown');
  if (!quota.ok) return json({ error: quota.error }, 429);

  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(geminiRequest(pages)),
    });
  } catch {
    return json({ error: 'কাগজ পড়ার সেবায় পৌঁছানো যায়নি। একটু পরে আবার চেষ্টা করুন।' }, 502);
  }

  if (res.status === 429) return json({ error: 'এই মুহূর্তে অনেক অনুরোধ আসছে। এক মিনিট পরে আবার চেষ্টা করুন।' }, 429);
  if (!res.ok) {
    // Status only: the response body could echo document text.
    console.error(`land/read: Gemini HTTP ${res.status} (model ${model})`);
    return json({ error: 'কাগজটা পড়া যায়নি। আরেকটু পরিষ্কার ছবি দিয়ে আবার চেষ্টা করুন।' }, 502);
  }

  const fields = parseGemini(await res.json());
  if (!fields) return json({ error: 'কাগজটা পড়া যায়নি। আরেকটু পরিষ্কার ছবি দিয়ে আবার চেষ্টা করুন।' }, 502);
  return json({ fields });
}

