// Worker entry point. Cloudflare's dashboard-driven deploy for this project
// uses the unified Workers + static-assets model, not classic Pages —
// that model has no automatic file-based routing for a `functions/`
// directory, so this script does the routing by hand and falls back to
// serving the static site for everything else.

import { onRequestPost as createCheckoutSession } from '../functions/api/create-checkout-session.js';
import { onRequestGet as orderStatus } from '../functions/api/order-status.js';
import { onRequestGet as downloadFile } from '../functions/api/download.js';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe-webhook.js';
import { onRequestPost as subscribe } from '../functions/api/subscribe.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const ctxArg = { request, env, ctx };

    if (pathname === '/api/create-checkout-session' && request.method === 'POST') {
      return createCheckoutSession(ctxArg);
    }
    if (pathname === '/api/order-status' && request.method === 'GET') {
      return orderStatus(ctxArg);
    }
    if (pathname === '/api/download' && request.method === 'GET') {
      return downloadFile(ctxArg);
    }

    if (pathname === '/api/stripe-webhook' && request.method === 'POST') {
      return stripeWebhook(ctxArg);
    }
    if (pathname === '/api/subscribe' && request.method === 'POST') {
      return subscribe(ctxArg);
    }

    return env.ASSETS.fetch(request);
  },
};
