// Cloudflare Pages Function: GET /api/order-status?session_id=...
// Confirms a Stripe Checkout session was actually paid, then returns the
// purchased items with download links. Never trust the client's own claim
// of what it bought — always re-check against Stripe.

export async function onRequestGet({ request, env }) {
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId) return json({ error: 'missing session_id' }, 400);

  const session = await fetchStripeSession(sessionId, env);
  if (!session) return json({ error: 'session not found' }, 404);
  if (session.payment_status !== 'paid') {
    return json({ paid: false });
  }

  let purchased = [];
  try {
    purchased = JSON.parse(session.metadata?.items || '[]');
  } catch {
    purchased = [];
  }

  const catalogRes = await env.ASSETS.fetch(new URL('/data/products.json', request.url));
  const catalog = (await catalogRes.json()).products;

  const items = purchased
    .map(({ id, qty }) => {
      const product = catalog.find((p) => p.id === id);
      if (!product) return null;
      return {
        id: product.id,
        name: product.name,
        qty,
        download_url: `/api/download?session_id=${encodeURIComponent(sessionId)}&product=${encodeURIComponent(product.id)}`,
      };
    })
    .filter(Boolean);

  return json({ paid: true, items });
}

export async function fetchStripeSession(sessionId, env) {
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
