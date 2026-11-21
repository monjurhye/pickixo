/**
 * /api/eps/ipn — EPS's server-to-server payment notification (IPN). Give this
 * address to EPS as the IPN / webhook URL: https://pickixo.com/api/eps/ipn
 *
 * The notification is only a nudge: it names an order, and the order's state
 * is then fetched from EPS itself, so a forged notification cannot mark
 * anything paid. That also means it does not depend on the exact format EPS
 * sends.
 */
import { epsConfig } from '../../../functions-lib/eps.js';
import { loadOrder, settleOrder } from '../../../functions-lib/orders.js';

const KEYS = ['merchantTransactionId', 'MerchantTransactionId', 'merchanttransactionid', 'CustomerOrderId', 'customerOrderId', 'o'];

async function orderIdFrom(request) {
  const url = new URL(request.url);
  for (const k of KEYS) if (url.searchParams.get(k)) return url.searchParams.get(k);
  if (request.method !== 'POST') return null;
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('json')) {
      const body = await request.json();
      const flat = { ...body, ...(body?.data ?? {}) };
      for (const k of KEYS) if (flat[k]) return String(flat[k]);
    } else {
      const form = await request.formData();
      for (const k of KEYS) if (form.get(k)) return String(form.get(k));
    }
  } catch { /* unreadable body */ }
  return null;
}

export async function onRequest({ request, env }) {
  if (!epsConfig(env) || !env.ORDERS) return new Response('not configured', { status: 503 });
  const id = await orderIdFrom(request);
  const order = await loadOrder(env, id);
  if (!order) return new Response('unknown order', { status: 404 });
  try {
    const settled = await settleOrder(env, order, new URL(request.url).origin);
    return Response.json({ ok: true, order: settled.id, status: settled.status });
  } catch (err) {
    console.error('IPN check failed', order.id, err?.message);
    return new Response('check failed', { status: 502 });
  }
}
