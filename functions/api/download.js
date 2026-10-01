// Cloudflare Pages Function: GET /api/download?session_id=...&product=...
// Re-verifies payment against Stripe (never trusts the URL alone) before
// streaming the purchased file out of the private R2 bucket.

import { fetchStripeSession } from './order-status.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const productId = url.searchParams.get('product');
  if (!sessionId || !productId) {
    return new Response('missing session_id or product', { status: 400 });
  }

  const session = await fetchStripeSession(sessionId, env);
  if (!session || session.payment_status !== 'paid') {
    return new Response('order not found or not paid', { status: 403 });
  }

  let purchased = [];
  try {
    purchased = JSON.parse(session.metadata?.items || '[]');
  } catch {
    purchased = [];
  }
  if (!purchased.some((i) => i.id === productId)) {
    return new Response('product not included in this order', { status: 403 });
  }

  const catalogRes = await env.ASSETS.fetch(new URL('/data/products.json', request.url));
  const catalog = (await catalogRes.json()).products;
  const product = catalog.find((p) => p.id === productId);
  if (!product) return new Response('unknown product', { status: 404 });

  if (!env.DOWNLOADS) {
    return new Response(
      'Download storage is not configured yet (R2 bucket binding "DOWNLOADS" missing).',
      { status: 503 }
    );
  }

  const object = await env.DOWNLOADS.get(product.file_key);
  if (!object) return new Response('file not found in storage', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${product.file_key}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
