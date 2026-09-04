import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  plugins: [{
    name: "test-cloudflare-worker-bindings",
    resolveId(id) {
      return id === "cloudflare:workers" ? "\0test-cloudflare-workers" : null;
    },
    load(id) {
      if (id !== "\0test-cloudflare-workers") return null;
      return `const statement = { bind() { return this; }, async run() { return { meta: { changes: 1 } }; } }; export const env = { SUPABASE_URL: "https://auth.example.test", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", CARDWISE_AUTH_COOKIE_SECRET: "test-cookie-secret-that-is-more-than-thirty-two-characters", DB: { prepare() { return statement; } } };`;
    },
  }],
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function engine() {
  return vite.ssrLoadModule("/lib/rewards/engine.ts");
}

function card(overrides = {}) {
  return {
    id: "card-a",
    name: "Card A",
    issuer: "Example Bank",
    network: "Visa",
    accent: "#123456",
    lastFour: "1234",
    statementDay: 15,
    dueDay: 28,
    rules: [],
    ...overrides,
  };
}

const diningPurchase = { merchant: "Restaurant", category: "dining", channel: "offline", amount: 10000 };

test("caps cashback at the remaining eligible amount", async () => {
  const { rankCards } = await engine();
  const [recommendation] = rankCards([
    card({ rules: [{ id: "r1", label: "Dining", rate: 10, cap: 500, used: 425, capPeriod: "monthly", categories: ["dining"], confidence: "high", source: "issuer", checkedAt: "now" }] }),
  ], diningPurchase);
  assert.equal(recommendation.totalValue, 75);
  assert.equal(recommendation.breakdown[0].status, "capped");
  assert.match(recommendation.breakdown[0].note, /₹75/);
});

test("does not apply category or minimum-spend rules outside their conditions", async () => {
  const { rankCards } = await engine();
  const [recommendation] = rankCards([
    card({ rules: [
      { id: "dining", label: "Dining", rate: 10, categories: ["dining"], confidence: "high", source: "issuer", checkedAt: "now" },
      { id: "minimum", label: "Minimum", rate: 5, minSpend: 15000, confidence: "high", source: "issuer", checkedAt: "now" },
    ] }),
  ], { ...diningPurchase, category: "fuel" });
  assert.equal(recommendation.totalValue, 0);
  assert.equal(recommendation.breakdown.every((rule) => rule.status === "ineligible"), true);
});

test("ranks actual incremental value above a larger but exhausted headline rate", async () => {
  const { rankCards } = await engine();
  const recommendations = rankCards([
    card({ id: "exhausted", dueDay: 25, rules: [{ id: "large", label: "10%", rate: 10, cap: 500, used: 490, categories: ["dining"], confidence: "high", source: "issuer", checkedAt: "now" }] }),
    card({ id: "uncapped", dueDay: 10, rules: [{ id: "steady", label: "4%", rate: 4, categories: ["dining"], confidence: "high", source: "issuer", checkedAt: "now" }] }),
  ], diningPurchase);
  assert.equal(recommendations[0].card.id, "uncapped");
  assert.equal(recommendations[0].totalValue, 400);
  assert.equal(recommendations[1].totalValue, 10);
});

test("uses days to due only as a deterministic tie-breaker", async () => {
  const { rankCards } = await engine();
  const recommendations = rankCards([
    card({ id: "earlier", dueDay: 2, rules: [{ id: "same-1", label: "same", rate: 2, confidence: "high", source: "issuer", checkedAt: "now" }] }),
    card({ id: "later", dueDay: 28, rules: [{ id: "same-2", label: "same", rate: 2, confidence: "high", source: "issuer", checkedAt: "now" }] }),
  ], diningPurchase);
  assert.equal(recommendations[0].totalValue, recommendations[1].totalValue);
  assert.ok(recommendations[0].daysToDue >= recommendations[1].daysToDue);
});

test("rejects unsafe and malformed card input before it reaches persistence", async () => {
  const { cardInputSchema } = await vite.ssrLoadModule("/lib/cards/validation.ts");
  const invalidSensitivePayload = cardInputSchema.safeParse({
    issuer: "Issuer",
    name: "Card",
    network: "Visa",
    lastFour: "1234567812345678",
    statementDay: 0,
    dueDay: 40,
    cvv: "123",
  });
  assert.equal(invalidSensitivePayload.success, false);

  const validPayload = cardInputSchema.safeParse({
    issuer: "Issuer",
    name: "Card",
    network: "Visa",
    lastFour: "1234",
    statementDay: 10,
    dueDay: 25,
    rules: [],
  });
  assert.equal(validPayload.success, true);
});

test("rejects cross-origin write requests and oversized JSON", async () => {
  const { assertSameOrigin, readJson } = await vite.ssrLoadModule("/lib/server/request-guard.ts");
  const { recommendationInputSchema } = await vite.ssrLoadModule("/lib/cards/validation.ts");
  assert.throws(() => assertSameOrigin(new Request("https://cardwise.example/api/cards", { headers: { origin: "https://evil.example" } })), { status: 403 });
  const oversized = new Request("https://cardwise.example/api/cards", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "50000" },
    body: JSON.stringify({}),
  });
  await assert.rejects(() => readJson(oversized, recommendationInputSchema), { status: 413 });

  const chunkedOversized = new Request("https://cardwise.example/api/cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(40_000) }),
  });
  await assert.rejects(() => readJson(chunkedOversized, recommendationInputSchema), { status: 413 });
});

test("research results reject unverified output shapes", async () => {
  const { researchResultSchema } = await vite.ssrLoadModule("/lib/research/normalize.ts");
  const parsed = researchResultSchema.safeParse({ summary: "ok", rules: [{ label: "rule" }], unresolved: [] });
  assert.equal(parsed.success, false);
});

test("never places API secrets or unsafe HTML sinks in the client page", async () => {
  const page = await readFile(path.join(root, "app/page.tsx"), "utf8");
  assert.doesNotMatch(page, /OPENAI_API_KEY|process\.env|dangerouslySetInnerHTML/);
  assert.match(page, /Save card securely/);
  assert.match(page, /Continue with Google/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
});

test("rejects forged workspace headers and malformed bearer credentials", async () => {
  const { extractAccessToken, requireUserIdentity } = await vite.ssrLoadModule("/lib/server/identity.ts");
  assert.throws(
    () => extractAccessToken(new Headers({ "oai-authenticated-user-id": "attacker", "oai-authenticated-user-email": "attacker@example.com" })),
    { status: 401 },
  );
  for (const authorization of ["Basic anything", "Bearer short", "Bearer has spaces", `Bearer ${"x".repeat(12_001)}`]) {
    assert.throws(() => extractAccessToken(new Headers({ authorization })), { status: 401 });
  }
  await assert.rejects(
    () => requireUserIdentity(new Headers({ authorization: "Bearer a_valid_token.with-three.sections" }), async () => ({ id: "not-a-uuid", email: "owner@example.com" })),
    { status: 401 },
  );
});

test("does not allow a valid-looking token to impersonate an invalid Supabase user", async () => {
  const { requireUserIdentity } = await vite.ssrLoadModule("/lib/server/identity.ts");
  const headers = new Headers({ authorization: "Bearer a_valid_token.with-three.sections" });
  await assert.rejects(
    () => requireUserIdentity(headers, async () => ({ id: "1735bd69-781a-4443-8845-1e678145f4a7", email: "not-an-email" })),
    { status: 401 },
  );
  const identity = await requireUserIdentity(headers, async () => ({
    id: "1735bd69-781a-4443-8845-1e678145f4a7",
    email: "Owner@Example.com",
    user_metadata: { full_name: "  Prince Patel  " },
  }));
  assert.deepEqual(identity, { id: "1735bd69-781a-4443-8845-1e678145f4a7", email: "owner@example.com", displayName: "Prince Patel" });
});

test("enforces a high-entropy password policy and rejects unexpected authentication fields", async () => {
  const { emailAuthInputSchema } = await vite.ssrLoadModule("/lib/auth/validation.ts");
  assert.equal(emailAuthInputSchema.safeParse({ mode: "sign-up", email: "person@example.com", password: "alllowercase12" }).success, false);
  assert.equal(emailAuthInputSchema.safeParse({ mode: "sign-up", email: "person@example.com", password: "StrongPassword12", role: "admin" }).success, false);
  assert.equal(emailAuthInputSchema.safeParse({ mode: "sign-in", email: "person@example.com", password: "StrongPassword12" }).data?.email, "person@example.com");
});

test("keeps session material server-only and OAuth callbacks bound to signed PKCE state", async () => {
  const source = await readFile(path.join(root, "lib/server/auth-session.ts"), "utf8");
  const callback = await readFile(path.join(root, "app/api/auth/callback/route.ts"), "utf8");
  assert.match(source, /httpOnly: true/);
  assert.match(source, /secure: true/);
  assert.match(source, /sameSite: "strict"/);
  assert.match(source, /crypto\.subtle\.sign/);
  assert.match(source, /constantTimeEqual/);
  assert.match(callback, /readOAuthFlow/);
  assert.match(callback, /grant_type=pkce/);
});

test("rate limits authentication without persisting raw client addresses", async () => {
  const limiter = await readFile(path.join(root, "lib/server/auth-rate-limit.ts"), "utf8");
  const schema = await readFile(path.join(root, "db/schema.ts"), "utf8");
  assert.match(limiter, /SHA-256/);
  assert.match(limiter, /takeAuthQuota/);
  assert.doesNotMatch(limiter, /INSERT.*cf-connecting-ip/i);
  assert.match(schema, /auth_rate_windows/);
});

test("email authentication rejects cross-site, malformed, and failed upstream requests without issuing cookies", async () => {
  const { POST } = await vite.ssrLoadModule("/app/api/auth/email/route.ts");
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ access_token: "access.token.with.enough.length", refresh_token: "refresh.token.with.enough.length", expires_in: 3600 }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const crossSite = await POST(new Request("https://cardwise.example/api/auth/email", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ mode: "sign-in", email: "owner@example.com", password: "StrongPassword12" }),
    }));
    assert.equal(crossSite.status, 403);
    assert.equal(upstreamCalls, 0);

    const malformed = await POST(new Request("https://cardwise.example/api/auth/email", {
      method: "POST",
      headers: { origin: "https://cardwise.example", "content-type": "application/json" },
      body: JSON.stringify({ mode: "sign-in", email: "owner@example.com", password: "weak" }),
    }));
    assert.equal(malformed.status, 400);
    assert.equal(upstreamCalls, 0);

    const successful = await POST(new Request("https://cardwise.example/api/auth/email", {
      method: "POST",
      headers: { origin: "https://cardwise.example", "content-type": "application/json" },
      body: JSON.stringify({ mode: "sign-in", email: "owner@example.com", password: "StrongPassword12" }),
    }));
    assert.equal(successful.status, 200);
    assert.equal(upstreamCalls, 1);
    const cookies = successful.headers.get("set-cookie") ?? "";
    assert.match(cookies, /HttpOnly/);
    assert.match(cookies, /Secure/);

    globalThis.fetch = async () => new Response(JSON.stringify({ message: "unexpected upstream detail" }), { status: 500, headers: { "content-type": "application/json" } });
    const failedUpstream = await POST(new Request("https://cardwise.example/api/auth/email", {
      method: "POST",
      headers: { origin: "https://cardwise.example", "content-type": "application/json" },
      body: JSON.stringify({ mode: "sign-in", email: "owner@example.com", password: "StrongPassword12" }),
    }));
    assert.equal(failedUpstream.status, 401);
    assert.doesNotMatch(failedUpstream.headers.get("set-cookie") ?? "", /cardwise_access/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects replayed or tampered OAuth PKCE state before exchanging a code", async () => {
  const { createOAuthFlow, readOAuthFlow } = await vite.ssrLoadModule("/lib/server/auth-session.ts");
  const flow = await createOAuthFlow("/");
  const read = await readOAuthFlow(flow.cookieValue, flow.state);
  assert.equal(read.returnTo, "/");
  assert.equal(read.verifier, flow.verifier);
  await assert.rejects(() => readOAuthFlow(flow.cookieValue, `${flow.state}x`), { status: 400 });
  await assert.rejects(() => readOAuthFlow(`${flow.cookieValue}x`, flow.state), { status: 400 });
});

test("handles a high-volume local ranking batch within a predictable budget", async () => {
  const { rankCards } = await engine();
  const cards = Array.from({ length: 20 }, (_, index) => card({
    id: `card-${index}`,
    dueDay: index + 1,
    rules: [{ id: `rule-${index}`, label: "Base", rate: (index % 5) + 1, confidence: "high", source: "issuer", checkedAt: "now" }],
  }));
  const startedAt = performance.now();
  for (let index = 0; index < 5000; index += 1) rankCards(cards, diningPurchase);
  assert.ok(performance.now() - startedAt < 2000, "Ranking 100,000 card evaluations should remain responsive");
});
