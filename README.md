# RYANTRUST-NV

Static RYANTRUST website plus a Cloudflare Worker for consultation requests.

## Website

```bash
npm run dev
npm run build
```

The production build is written to `dist/`.

## Cloudflare intake setup

The Worker verifies Turnstile, validates fields, rejects a honeypot, rate-limits hashed IPs with KV, restricts CORS, and sends plain-text email through Cloudflare Email Routing.

1. Add `ryantrust.com` to Cloudflare, enable Email Routing, verify the destination mailbox, and create `intake@ryantrust.com` (or another approved sender).
2. Create a Turnstile widget for the production and required Vercel preview hosts.
3. Install and authenticate with Cloudflare:

   ```bash
   cd worker
   npm install
   npx wrangler login
   ```

4. Create production and preview KV namespaces:

   ```bash
   npx wrangler kv namespace create RATE_LIMIT
   npx wrangler kv namespace create RATE_LIMIT --preview
   ```

5. Replace the KV IDs and verified destination address in `worker/wrangler.toml`. Set `ALLOWED_VERCEL_PROJECT` to the Vercel project slug. Confirm `EMAIL_FROM` is on the Email Routing domain and matches the binding's sender allowlist.
6. Store secrets; never commit them:

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put RATE_LIMIT_SALT
   ```

7. Validate and deploy:

   ```bash
   npm test
   npx wrangler deploy --dry-run
   npm run deploy
   ```

8. Replace `REPLACE_WITH_WORKER_SUBDOMAIN` and `REPLACE_WITH_TURNSTILE_SITE_KEY` in `contact.html` with the deployed values.

For local testing, copy `.dev.vars.example` to `.dev.vars`, use Cloudflare's Turnstile test keys, and run `npm run dev`. Email Routing delivery requires a deployed Worker, so complete the final end-to-end check in a staging or production-like deployment.

## Security notes

- Turnstile is verified by the Worker; client-side success is not trusted.
- CORS permits exact production origins and only preview hosts beginning with the configured Vercel project slug.
- KV rate limiting is free-tier friendly but non-atomic; it is an abuse control, not an authorization boundary.
- IPs are salted and hashed before short-lived KV storage. The Worker does not store form content.
- Preserve the non-confidentiality and no-attorney-client-relationship warnings.

## Remaining launch checks

Confirm final endpoint and email delivery, attorney/bar disclosures, trade-name use, office eligibility, privacy text, DNS, accessibility, links, structured data, and mobile behavior before publication.
