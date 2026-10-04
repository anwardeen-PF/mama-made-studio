# Mama Made Studio

A self-hosted storefront for cute digital stickers and printable art, built for Cloudflare Pages. Static front-end, serverless checkout via Stripe, instant digital delivery via Cloudflare R2.

## How it works

```text
Shopper browses /            (static site, product grid from data/products.json)
        |
        v
Adds to cart (localStorage), clicks Checkout
        |
        v
POST /api/create-checkout-session   (Pages Function, re-prices from our own catalog)
        |
        v
Stripe-hosted Checkout page (card entered on Stripe's domain, never ours)
        |
        v
Redirect to /success.html?session_id=...
        |
        v
GET /api/order-status                (verifies payment_status === 'paid' with Stripe)
        |
        v
GET /api/download?session_id=...&product=...   (re-verifies, then streams file from R2)
```

No card data ever touches our server. No webhook is required for this v1 — payment is confirmed synchronously when the success page loads by asking Stripe directly.

## One-time setup

This project deploys as a Cloudflare **Worker with static assets** (the current unified Workers + Pages model), connected to GitHub so every push to `main` auto-deploys via `wrangler deploy`. `wrangler.jsonc` in this repo defines the Worker name, the static-assets binding, and the R2 binding — the dashboard mostly just needs secrets.

### 1. Stripe

1. Create an account at https://dashboard.stripe.com/register.
2. **Developers → API keys** → copy the **Secret key**.
3. Cloudflare dashboard → **Workers & Pages → mama-made-studio → Settings → Variables and Secrets** → add `STRIPE_SECRET_KEY` as a **Secret** (not a plain variable). Set it for Production.
4. No Stripe Products/Prices need to be pre-created — checkout sessions are built with inline `price_data` straight from `data/products.json`, so the two stay in sync automatically.

### 2. R2 (digital file storage)

1. Cloudflare dashboard → **R2 → Create bucket** → name it **exactly** `mama-made-studio-downloads` (matches `wrangler.jsonc`; the binding is wired automatically on the next deploy — no manual binding step needed).
2. Upload every file from `products-private/` into that bucket, keeping the same filename — it must match the `file_key` in `data/products.json`.
3. Push any small change (or use **Retry build** on the latest deployment) so the Worker picks up the new binding.

### 3. Custom domain

Worker → **Settings → Domains & Routes** → add your domain (must already be on Cloudflare DNS).

### 4. Receipt emails and mailing list

1. Create a [Resend](https://resend.com) account, verify your sending domain, and create an API key.
2. Stripe dashboard → **Developers → Webhooks → Add endpoint**: `https://<your-domain>/api/stripe-webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the signing secret.
3. Cloudflare → Worker → **Settings → Variables and Secrets**: add secrets `STRIPE_WEBHOOK_SECRET` and `RESEND_API_KEY`, and variables `EMAIL_FROM` (e.g. `Mama Made Studio <orders@yourdomain.com>`) and optionally `EMAIL_REPLY_TO`.
4. The `SUBSCRIBERS` KV namespace is created automatically on the next deploy. Signups are stored as `sub:<email>` keys; export them from **Workers & Pages → KV**.

## Adding a new product

1. Design the art, export it (SVG/PNG/PDF — whatever format you're selling).
2. Drop the public-facing preview image in `public/assets/products/`.
3. Drop the actual deliverable file in `products-private/`, then upload it to the R2 bucket.
4. Add an entry to `public/data/products.json` with a unique `id`, `price_cents`, `image` (the preview), and `file_key` (must match the R2 object key exactly).

No code changes needed — the storefront and checkout both read from that one JSON file.

## Security notes

- Checkout prices are always re-computed server-side from `data/products.json` — a tampered client request can't change what's charged.
- `/api/download` re-verifies the Stripe session and checks the requested product was actually part of that paid order before streaming anything.
- `products-private/` and `functions/` are never part of the Pages build output (`public/`), so the real deliverable files and server code are never served as static assets.
- Secrets (`STRIPE_SECRET_KEY`) live only in Cloudflare's encrypted environment variables — never commit them to this repo.

## Later / not yet wired up

- Etsy cross-listing (separate from this codebase — just listing copy/mockups using the same product art).
