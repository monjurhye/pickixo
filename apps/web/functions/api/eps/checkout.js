/**
 * POST /api/eps/checkout — the Buy form on /shop and /shop/<slug> posts here.
 *
 * Creates an order with the price from products.json (never from the form),
 * starts an EPS payment, and sends the buyer to EPS's payment page.
 * Until EPS credentials and the ORDERS binding are set, it says that online
 * payment is not open yet instead of failing.
 */
import { epsConfig, initializePayment } from '../../../functions-lib/eps.js';
import { findProduct, newOrderId, page, saveOrder } from '../../../functions-lib/orders.js';

const notOpen = () => page('Online payment not open yet', `<h1>Online payment is not open yet</h1>
<p>We are still setting up card and mobile-wallet payments. To buy now, email
<a href="mailto:support@pickixo.com">support@pickixo.com</a> and we will help you.</p>
<p><a href="/shop">Back to the shop</a></p>`, 503);

const bad = (msg) => page('Please check the form', `<h1>Please check the form</h1><p>${msg}</p>
<p><a href="javascript:history.back()">Go back</a></p>`, 400);

export async function onRequestPost({ request, env }) {
  const cfg = epsConfig(env);
  if (!cfg || !env.ORDERS) return notOpen();

  const form = await request.formData();
  const product = findProduct(String(form.get('product') || ''));
  if (!product) return bad('That product is not on sale.');

  const name = String(form.get('name') || '').trim().slice(0, 80);
  const email = String(form.get('email') || '').trim().slice(0, 120);
  const phoneRaw = String(form.get('phone') || '').replace(/[\s-]/g, '');
  const city = String(form.get('city') || '').trim().slice(0, 60);
  const postcode = String(form.get('postcode') || '').trim().slice(0, 10);

  if (name.length < 2) return bad('Please write your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Please write a valid email address — the download link is sent there.');
  const phone = phoneRaw.replace(/^\+?88/, '');
  if (!/^01[3-9]\d{8}$/.test(phone)) return bad('Please write a Bangladeshi mobile number, like 01XXXXXXXXX.');
  if (city.length < 2) return bad('Please write your city or district.');
  if (form.get('agree') !== 'yes') return bad('Please confirm that you have read the refund policy and terms.');

  const origin = new URL(request.url).origin;
  const order = {
    id: newOrderId(),
    product: product.slug,
    productName: product.name,
    amount: product.priceBdt,
    name, email, phone, city, postcode,
    status: 'pending',
    createdAt: new Date().toISOString(),
    sandbox: cfg.sandbox,
  };
  order.returnUrl = `${origin}/api/eps/return?o=${order.id}`;
  await saveOrder(env, order);

  try {
    const { redirectUrl, epsTransactionId } = await initializePayment(cfg, {
      ...order, ip: request.headers.get('CF-Connecting-IP') || '0.0.0.0',
    });
    order.epsTransactionId = epsTransactionId;
    await saveOrder(env, order);
    return Response.redirect(redirectUrl, 303);
  } catch (err) {
    console.error('EPS checkout failed', order.id, err?.message, JSON.stringify(err?.detail ?? null));
    order.status = 'failed';
    order.note = String(err?.message || err);
    await saveOrder(env, order);
    return page('Payment could not start', `<h1>The payment could not start</h1>
<p>No money was taken. Please try again in a few minutes, or email
<a href="mailto:support@pickixo.com">support@pickixo.com</a> (order ${order.id}).</p>`, 502);
  }
}

export const onRequestGet = () => Response.redirect('https://pickixo.com/shop', 302);
