import type { BenefitRule, WalletCard } from "@/lib/rewards/types";
import type { CardInput } from "@/lib/cards/validation";
import type { UserIdentity } from "./identity";
import { ApiError } from "./errors";
import { getDatabase } from "./database";

type CardRow = {
  id: string;
  issuer: string;
  product_name: string;
  network: WalletCard["network"];
  nickname: string | null;
  last_four: string;
  statement_day: number;
  due_day: number;
};

type RuleRow = {
  id: string;
  card_id: string;
  label: string;
  rate_basis_points: number;
  cap_paise: number | null;
  used_paise: number;
  cap_period: BenefitRule["capPeriod"] | null;
  min_spend_paise: number | null;
  categories_json: string | null;
  channels_json: string | null;
  confidence: BenefitRule["confidence"];
  source_name: string;
  source_url: string | null;
  checked_at: string;
};

function now() {
  return new Date().toISOString();
}

function accentFor(id: string) {
  const accents = ["#1b377d", "#5a2037", "#443278", "#0f766e", "#7c2d12"];
  const total = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return accents[total % accents.length];
}

function parseArray<T extends string>(value: string | null): T[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed as T[] : undefined;
  } catch {
    return undefined;
  }
}

function mapRule(row: RuleRow): BenefitRule {
  return {
    id: row.id,
    label: row.label,
    rate: row.rate_basis_points / 100,
    cap: row.cap_paise === null ? undefined : row.cap_paise / 100,
    used: row.used_paise / 100,
    capPeriod: row.cap_period ?? undefined,
    minSpend: row.min_spend_paise === null ? undefined : row.min_spend_paise / 100,
    categories: parseArray(row.categories_json),
    channels: parseArray(row.channels_json),
    confidence: row.confidence,
    source: row.source_name,
    checkedAt: row.checked_at,
  };
}

export async function ensureUser(identity: UserIdentity) {
  const db = getDatabase();
  const timestamp = now();
  await db.prepare(
    `INSERT INTO users (id, email, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at`,
  ).bind(identity.id, identity.email, identity.displayName, timestamp, timestamp).run();
}

export async function listCards(userId: string): Promise<WalletCard[]> {
  const db = getDatabase();
  const [cardsResult, rulesResult] = await db.batch([
    db.prepare(`SELECT id, issuer, product_name, network, nickname, last_four, statement_day, due_day FROM user_cards WHERE user_id = ? ORDER BY created_at ASC`).bind(userId),
    db.prepare(`SELECT r.id, r.card_id, r.label, r.rate_basis_points, r.cap_paise, r.used_paise, r.cap_period, r.min_spend_paise, r.categories_json, r.channels_json, r.confidence, r.source_name, r.source_url, r.checked_at FROM card_rule_versions r INNER JOIN user_cards c ON c.id = r.card_id WHERE c.user_id = ? AND r.active = 1 ORDER BY r.created_at ASC`).bind(userId),
  ]);
  const rulesByCard = new Map<string, BenefitRule[]>();
  for (const row of rulesResult.results as unknown as RuleRow[]) {
    const mapped = mapRule(row);
    rulesByCard.set(row.card_id, [...(rulesByCard.get(row.card_id) ?? []), mapped]);
  }
  return (cardsResult.results as unknown as CardRow[]).map((card) => ({
    id: card.id,
    issuer: card.issuer,
    name: card.nickname || card.product_name,
    network: card.network,
    accent: accentFor(card.id),
    lastFour: card.last_four,
    statementDay: card.statement_day,
    dueDay: card.due_day,
    rules: rulesByCard.get(card.id) ?? [],
  }));
}

export async function createCard(userId: string, input: CardInput): Promise<WalletCard> {
  const db = getDatabase();
  const cardId = crypto.randomUUID();
  const timestamp = now();
  const statements = [
    db.prepare(`INSERT INTO user_cards (id, user_id, issuer, product_name, network, nickname, last_four, statement_day, due_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(cardId, userId, input.issuer, input.name, input.network, input.nickname || null, input.lastFour, input.statementDay, input.dueDay, timestamp, timestamp),
    ...input.rules.map((rule) => db.prepare(`INSERT INTO card_rule_versions (id, card_id, label, rate_basis_points, cap_paise, used_paise, cap_period, min_spend_paise, categories_json, channels_json, confidence, source_name, source_url, checked_at, valid_until, version, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`)
      .bind(
        crypto.randomUUID(),
        cardId,
        rule.label,
        Math.round(rule.rate * 100),
        rule.cap === undefined ? null : Math.round(rule.cap * 100),
        Math.round((rule.used ?? 0) * 100),
        rule.capPeriod ?? null,
        rule.minSpend === undefined ? null : Math.round(rule.minSpend * 100),
        rule.categories ? JSON.stringify(rule.categories) : null,
        rule.channels ? JSON.stringify(rule.channels) : null,
        rule.confidence,
        rule.source,
        rule.sourceUrl ?? null,
        rule.checkedAt ?? timestamp,
        rule.validUntil ?? null,
        timestamp,
      )),
  ];
  await db.batch(statements);
  const cards = await listCards(userId);
  const created = cards.find((card) => card.id === cardId);
  if (!created) throw new ApiError(500, "CARD_CREATE_FAILED", "Your card could not be saved.");
  return created;
}

export async function deleteCard(userId: string, cardId: string) {
  const db = getDatabase();
  const result = await db.prepare("DELETE FROM user_cards WHERE id = ? AND user_id = ?").bind(cardId, userId).run();
  if (result.meta.changes !== 1) {
    throw new ApiError(404, "CARD_NOT_FOUND", "That card was not found.");
  }
}

export async function recordRecommendation(userId: string, purchase: { merchant: string; category: string; channel: string; amount: number }) {
  const db = getDatabase();
  await db.prepare(`INSERT INTO recommendation_requests (id, user_id, merchant, category, channel, amount_paise, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), userId, purchase.merchant, purchase.category, purchase.channel, Math.round(purchase.amount * 100), now()).run();
}

export async function takeResearchQuota(userId: string, maximumPerHour = 12) {
  const db = getDatabase();
  const windowStart = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  await db.prepare(`INSERT OR IGNORE INTO research_rate_windows (user_id, window_start, request_count) VALUES (?, ?, 0)`).bind(userId, windowStart).run();
  const result = await db.prepare(`UPDATE research_rate_windows SET request_count = request_count + 1 WHERE user_id = ? AND window_start = ? AND request_count < ?`)
    .bind(userId, windowStart, maximumPerHour).run();
  if (result.meta.changes !== 1) {
    throw new ApiError(429, "RESEARCH_LIMIT_REACHED", "You have reached the current research limit. Please try again in the next hour.");
  }
}

export async function takeAuthQuota(fingerprint: string, maximumPerWindow = 8) {
  const db = getDatabase();
  const windowStart = Math.floor(Date.now() / 900_000) * 900_000;
  await db.prepare(`INSERT OR IGNORE INTO auth_rate_windows (fingerprint, window_start, request_count) VALUES (?, ?, 0)`).bind(fingerprint, windowStart).run();
  const result = await db.prepare(`UPDATE auth_rate_windows SET request_count = request_count + 1 WHERE fingerprint = ? AND window_start = ? AND request_count < ?`)
    .bind(fingerprint, windowStart, maximumPerWindow).run();
  if (result.meta.changes !== 1) {
    throw new ApiError(429, "AUTH_RATE_LIMITED", "Please wait before trying again.");
  }
}
