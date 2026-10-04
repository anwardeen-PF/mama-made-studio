// Cloudflare Worker route: POST /api/subscribe  { email }
// Stores the address in KV with a consent timestamp.

export async function onRequestPost({ request, env }) {
  if (!env.SUBSCRIBERS) return json({ error: 'mailing list not configured' }, 503);

  let email = '';
  try {
    ({ email } = await request.json());
  } catch {
    return json({ error: 'invalid request' }, 400);
  }
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: 'please enter a valid email' }, 400);
  }

  const key = `sub:${email}`;
  if (!(await env.SUBSCRIBERS.get(key))) {
    await env.SUBSCRIBERS.put(
      key,
      JSON.stringify({ email, subscribed_at: new Date().toISOString(), source: 'website' })
    );
  }
  return json({ ok: true });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
