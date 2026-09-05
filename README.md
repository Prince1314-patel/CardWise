# CardWise

CardWise recommends the most valuable card **from a user's existing wallet** for a specific INR purchase. It pairs an evidence-aware research layer with deterministic reward calculations, so an LLM never decides money math or silently ignores caps.

## What works now

- Responsive, high-polish transaction workflow: merchant, category, amount, and online/offline context.
- Wallet API backed by Cloudflare D1: create, list, and remove only the current user's cards.
- Canonical-safe wallet input: issuer, product, network, last four digits, billing dates, and user-entered rules. Full card numbers, CVV, PIN, and OTP are not accepted or stored.
- Deterministic ranking: percentage rewards, category/channel rules, minimum spend, fixed rewards, caps, remaining-cap usage, effective return, and due-date tiebreaking.
- Version-ready D1 schema for users, cards, rule versions, recommendation requests, and research quotas.
- Server-only OpenAI Responses API research endpoint with built-in web search, structured output validation, source URLs, per-user quota, anti-prompt-injection instructions, and no stored model responses.
- Security headers on every worker response, same-origin mutation checks, request-size limits, schema validation, private/no-store API responses, and ownership-scoped data access.
- A graceful preview wallet is available when an authenticated wallet is not yet connected.

## Architecture

```text
Wallet + purchase
  -> Evidence retrieval (when configured)
  -> Normalized evidence / versioned rules
  -> Deterministic reward engine
  -> INR ranking + explanation
```

The research endpoint returns proposed, structured evidence. A production review/save interface is intentionally the next step before web-retrieved rules are auto-applied to a wallet: unverified research must not silently turn into a financial recommendation.

## Local setup

Requirements: Node.js 22.13+.

```bash
npm ci
npm run db:generate
npm run dev
```

For live research, provide the secret only to the server/worker runtime:

```bash
OPENAI_API_KEY=... \
OPENAI_RESEARCH_MODEL=gpt-5.6-terra \
npm run dev
```

Never prefix this variable with `NEXT_PUBLIC_`, expose it in client code, or commit it.

## Public authentication configuration

CardWise uses Supabase Auth for Google OAuth and email/password sign-in. Set these server-side environment variables in the public deployment:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
CARDWISE_AUTH_COOKIE_SECRET=<a-random-32-plus-character-secret>
CARDWISE_AUTH_RATE_LIMIT_PEPPER=<a-different-random-32-plus-character-secret>
```

`SUPABASE_PUBLISHABLE_KEY` is safe to use for Supabase's public Auth API, but it remains server-side in this implementation. Do not provide a Supabase service-role key to CardWise.

In Supabase Auth, enable Email and Google, register the production callback URL as `https://your-domain/api/auth/callback`, and restrict redirect URLs to your own production and local-development origins. The app uses PKCE, signed short-lived OAuth state, HTTP-only Secure session cookies, origin checks on all authentication writes, generic login failures, and D1-backed login rate limiting. Generate the cookie secret and rate-limit pepper independently; neither belongs in source control.

## Verification

```bash
npm test
npm run lint
npm run build
```

The automated suite checks capped and conditional reward math, tie-breaking, malformed/sensitive card input rejection, cross-origin and body-size protection, research-output validation, client secret/unsafe-HTML absence, high-volume ranking performance, worker-security configuration, and component regressions.

## Data model

The D1/Drizzle schema lives in `db/schema.ts`; migrations live in `drizzle/`.

- `users`, `user_cards`
- `card_rule_versions` (append/version rather than overwrite)
- `recommendation_requests`
- `research_rate_windows`

The database stores observed evidence and user state, not an eternal claim that an offer will never change.

## Delivery notes

CardWise is a financial recommendation assistant, not a payment processor. Users should pay card statements in full; the billing-cycle signal is only a secondary tiebreaker after monetary value. Merchant MCC and campaign eligibility remain uncertain until settlement unless verified by evidence.
