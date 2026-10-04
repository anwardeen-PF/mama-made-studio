// Cloudflare Worker route: POST /api/stripe-webhook
// Verifies Stripe's signature, then emails the buyer their download links once
// a Checkout session is actually paid (covers delayed payment methods too).

const TOLERANCE_SECONDS = 300;

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('webhook not configured', { status: 503 });
  }

  const payload = await request.text();
  const valid = await verifySignature(payload, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response('invalid signature', { status: 400 });

  const event = JSON.parse(payload);
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      try {
        await sendReceipt(session, request, env);
      } catch (err) {
        console.error('receipt email failed', err);
        // Non-2xx makes Stripe retry the event.
        return new Response('email failed', { status: 500 });
      }
    }
  }
  return new Response('ok');
}

async function sendReceipt(session, request, env) {
  const to = session.customer_details?.email;
  if (!to) return;
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error('email provider not configured');

  // Stripe retries and fires two event types for one order: send only once.
  const sentKey = `receipt:${session.id}`;
  if (env.SUBSCRIBERS && (await env.SUBSCRIBERS.get(sentKey))) return;

  let purchased = [];
  try {
    purchased = JSON.parse(session.metadata?.items || '[]');
  } catch {
    purchased = [];
  }
  const origin = new URL(request.url).origin;
  const catalogRes = await env.ASSETS.fetch(new URL('/data/products.json', request.url));
  const catalog = (await catalogRes.json()).products;

  const items = purchased
    .map(({ id, qty }) => {
      const product = catalog.find((p) => p.id === id);
      if (!product) return null;
      const url = `${origin}/api/download?session_id=${encodeURIComponent(session.id)}&product=${encodeURIComponent(id)}`;
      return { name: product.name, qty, url };
    })
    .filter(Boolean);
  if (items.length === 0) return;

  const html = `<div style="font-family:Arial,sans-serif;max-width:520px">
<h2>Thank you for your order! 🌼</h2>
<p>Your files are ready. Click each link to download:</p>
<ul>${items.map((i) => `<li><a href="${i.url}">${escapeHtml(i.name)}</a> (x${i.qty})</li>`).join('')}</ul>
<p>These links keep working, so save this email. Just reply if anything goes wrong.</p>
<p>Mama Made Studio</p></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject: 'Your Mama Made Studio downloads',
      html,
      ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`);

  if (env.SUBSCRIBERS) await env.SUBSCRIBERS.put(sentKey, '1', { expirationTtl: 60 * 60 * 24 * 30 });
}

async function verifySignature(payload, header, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')));
  const timestamp = parts.t;
  if (!timestamp || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, parts.v1);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
