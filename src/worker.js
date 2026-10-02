// Worker entry point. Cloudflare's dashboard-driven deploy for this project
// uses the unified Workers + static-assets model, not classic Pages —
// that model has no automatic file-based routing for a `functions/`
// directory, so this script does the routing by hand and falls back to
// serving the static site for everything else.

import { onRequestPost as createCheckoutSession } from './api/create-checkout-session.js';
import { onRequestGet as orderStatus } from './api/order-status.js';
import { onRequestGet as downloadFile } from './api/download.js';

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

    return env.ASSETS.fetch(request);
  },
};
