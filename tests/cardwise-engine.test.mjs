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
