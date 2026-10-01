// Cloudflare Pages Function: POST /api/create-checkout-session
// Builds a Stripe Checkout Session from the client's cart, re-pricing every
// item from our own catalog so a tampered client request can't change price.

export async function onRequestPost({ request, env }) {
  try {
    const { items } = await request.json();
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'cart is empty' }, 400);
    }

    const catalogRes = await env.ASSETS.fetch(new URL('/data/products.json', request.url));
    const catalog = (await catalogRes.json()).products;

    const lineItems = [];
    const orderItems = [];
    for (const { id, qty } of items) {
      const product = catalog.find((p) => p.id === id);
      const quantity = Math.max(1, Math.min(10, Number(qty) || 1));
      if (!product) continue;
      lineItems.push({
        quantity,
        price_data: {
          currency: catalogCurrency(catalog),
          unit_amount: product.price_cents,
          product_data: { name: product.name },
        },
      });
      orderItems.push({ id: product.id, qty: quantity });
    }

    if (lineItems.length === 0) {
      return json({ error: 'no valid items in cart' }, 400);
    }

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${origin}/#shop`);
    params.set('metadata[items]', JSON.stringify(orderItems));
    lineItems.forEach((li, i) => {
      params.set(`line_items[${i}][quantity]`, String(li.quantity));
      params.set(`line_items[${i}][price_data][currency]`, li.price_data.currency);
      params.set(`line_items[${i}][price_data][unit_amount]`, String(li.price_data.unit_amount));
      params.set(`line_items[${i}][price_data][product_data][name]`, li.price_data.product_data.name);
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!stripeRes.ok) {
      const errBody = await stripeRes.text();
      console.error('Stripe session create failed', errBody);
      return json({ error: 'could not start checkout' }, 502);
    }

    const session = await stripeRes.json();
    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: 'unexpected error' }, 500);
  }
}

function catalogCurrency(catalog) {
  return 'usd';
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
