/**
 * Orders for pickixo.com digital products.
 *
 * Bindings (Cloudflare Pages → Settings → Bindings):
 *   ORDERS          KV namespace   order records and download tokens
 *   PRODUCT_FILES   R2 bucket      the product files, named as in products.json
 * Optional variables:
 *   RESEND_API_KEY  send the download link by email (resend.com)
 *   MAIL_FROM       e.g. "Pickixo <orders@pickixo.com>" (a domain verified in Resend)
 *   OWNER_EMAIL     also tell the owner about each paid order
 *
 * KV keys:
 *   order:<id>   { id, product, productName, amount, name, email, phone, city,
 *                  status: 'pending'|'paid'|'failed'|'cancelled', createdAt,
 *                  paidAt, epsTransactionId, downloadToken, downloads, emailed }
 *   dl:<token>   <order id>
 */

import products from '../src/data/products.json';
import { checkPayment, epsConfig } from './eps.js';

export const DOWNLOAD_DAYS = 7;
export const MAX_DOWNLOADS = 5;
const ORDER_TTL_SECONDS = 60 * 60 * 24 * 400; // keep records for accounts

export function findProduct(slug) {
  return products.find((p) => p.slug === slug) ?? null;
}

/** 16 digits: time to the millisecond plus three random digits. */
export function newOrderId() {
  const r = crypto.getRandomValues(new Uint16Array(1))[0] % 1000;
  return `${Date.now()}${String(r).padStart(3, '0')}`;
}

function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function loadOrder(env, id) {
  if (!/^\d{10,20}$/.test(String(id || ''))) return null;
  const raw = await env.ORDERS.get(`order:${id}`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveOrder(env, order) {
  await env.ORDERS.put(`order:${order.id}`, JSON.stringify(order), { expirationTtl: ORDER_TTL_SECONDS });
}

/**
 * Ask EPS about the order and record the answer. Safe to call any number of
 * times (from the buyer's return, from EPS's IPN): a paid order is only
 * fulfilled once.
 */
export async function settleOrder(env, order, origin, fetchImpl = fetch) {
  if (order.status === 'paid') return order;
  const cfg = epsConfig(env);
  if (!cfg) return order;

  const result = await checkPayment(cfg, order.id, fetchImpl);
  if (result.status === 'success') {
    // The amount EPS says it collected must be the price we asked for.
    if (!result.matchesId || !(Math.abs(result.amount - order.amount) < 0.01)) {
      order.status = 'review';
      order.note = `EPS reported ${result.amount} for ${order.amount}`;
      await saveOrder(env, order);
      return order;
    }
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    order.epsTransactionId = result.raw.EpsTransactionId ?? result.raw.epsTransactionId ?? order.epsTransactionId ?? null;
    order.downloadToken = randomToken();
    order.downloads = 0;
    await env.ORDERS.put(`dl:${order.downloadToken}`, order.id, {
      expirationTtl: DOWNLOAD_DAYS * 24 * 60 * 60,
    });
    await saveOrder(env, order);
    await sendEmails(env, order, origin, fetchImpl);
    return order;
  }
  if (result.status === 'failed' || result.status === 'cancelled') {
    order.status = result.status;
    await saveOrder(env, order);
  }
  return order;
}

export function downloadUrl(origin, order) {
  return `${origin}/api/download/${order.downloadToken}`;
}

async function sendEmails(env, order, origin, fetchImpl) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return;
  const link = downloadUrl(origin, order);
  const send = (to, subject, text) =>
    fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
    }).then((r) => r.ok).catch(() => false);

  order.emailed = await send(
    order.email,
    `Your Pickixo order ${order.id}`,
    [
      `Hello ${order.name},`,
      '',
      `Thank you for buying "${order.productName}" (৳${order.amount}).`,
      '',
      `Download it here (valid for ${DOWNLOAD_DAYS} days, up to ${MAX_DOWNLOADS} downloads):`,
      link,
      '',
      `Order number: ${order.id}`,
      order.epsTransactionId ? `EPS transaction: ${order.epsTransactionId}` : '',
      '',
      'Questions or a problem with the file? Reply to support@pickixo.com.',
      'Refund policy: https://pickixo.com/refund-policy',
      '',
      'Pickixo',
    ].filter((l) => l !== null).join('\n'),
  );
  if (env.OWNER_EMAIL) {
    await send(env.OWNER_EMAIL, `Paid: ${order.productName} ৳${order.amount}`,
      `Order ${order.id}\n${order.name} <${order.email}> ${order.phone}\nEPS ${order.epsTransactionId ?? ''}`);
  }
  await saveOrder(env, order);
}

// --- pages -----------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function page(title, bodyHtml, status = 200) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Pickixo</title>
<style>
:root{--bg:#f7f5ef;--card:#fdfcf9;--text:#1f1a17;--muted:#5f5852;--line:#ddd5ca;--accent:#9e3f22}
@media (prefers-color-scheme:dark){:root{--bg:#15120f;--card:#1d1a17;--text:#ece6dc;--muted:#ada399;--line:#34302b;--accent:#e8906b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Bengali",sans-serif}
main{max-width:620px;margin:0 auto;padding:40px 16px}article{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:28px 24px}
h1{font:500 1.9rem/1.2 Georgia,serif;margin:0 0 12px}p{color:var(--muted)}a{color:var(--accent)}
.btn{display:inline-block;background:#9e3f22;color:#fff;text-decoration:none;padding:12px 20px;border-radius:5px;font-weight:600}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:20px 0;color:var(--muted)}dt{color:var(--text)}
</style></head><body><main><article>${bodyHtml}</article>
<p style="text-align:center;font-size:.875rem;margin-top:20px"><a href="/">pickixo.com</a> · <a href="/contact">Contact</a> · <a href="/refund-policy">Refund policy</a></p>
</main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function orderPage(order, origin) {
  const facts = `<dl><dt>Order</dt><dd>${esc(order.id)}</dd><dt>Product</dt><dd>${esc(order.productName)}</dd><dt>Amount</dt><dd>৳${esc(order.amount)}</dd></dl>`;
  if (order.status === 'paid') {
    return page('Payment received', `<h1>Thank you — payment received</h1>${facts}
<p><a class="btn" href="${esc(downloadUrl(origin, order))}">Download your PDF</a></p>
<p>The link works for ${DOWNLOAD_DAYS} days and up to ${MAX_DOWNLOADS} downloads${order.emailed ? `, and we have emailed it to ${esc(order.email)}` : ''}. Please save the file on your device.</p>
<p>A problem with the file? Email <a href="mailto:support@pickixo.com">support@pickixo.com</a> with your order number.</p>`);
  }
  if (order.status === 'failed' || order.status === 'cancelled') {
    return page('Payment not completed', `<h1>Payment ${order.status === 'failed' ? 'failed' : 'cancelled'}</h1>${facts}
<p>No money was taken for this order. You can <a href="/pricing">try again</a>.</p>`);
  }
  if (order.status === 'review') {
    return page('Payment being checked', `<h1>We are checking your payment</h1>${facts}
<p>The payment did not match the order exactly, so we are checking it by hand. We will email you at ${esc(order.email)}. Questions: <a href="mailto:support@pickixo.com">support@pickixo.com</a>.</p>`);
  }
  return page('Payment pending', `<h1>Waiting for the payment to confirm</h1>${facts}
<p>EPS has not confirmed this payment yet. This page checks again when you <a href="">refresh it</a>. If money left your account and this does not change within an hour, email <a href="mailto:support@pickixo.com">support@pickixo.com</a> with the order number.</p>`);
}
