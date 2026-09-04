import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userCards = sqliteTable(
  "user_cards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    productName: text("product_name").notNull(),
    network: text("network").notNull(),
    nickname: text("nickname"),
    lastFour: text("last_four").notNull(),
    statementDay: integer("statement_day").notNull(),
    dueDay: integer("due_day").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("user_cards_user_id_id_idx").on(table.userId, table.id)],
);

export const cardRuleVersions = sqliteTable(
  "card_rule_versions",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id").notNull().references(() => userCards.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    rateBasisPoints: integer("rate_basis_points").notNull(),
    capPaise: integer("cap_paise"),
    usedPaise: integer("used_paise").notNull().default(0),
    capPeriod: text("cap_period"),
    minSpendPaise: integer("min_spend_paise"),
    categoriesJson: text("categories_json"),
    channelsJson: text("channels_json"),
    confidence: text("confidence").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    checkedAt: text("checked_at").notNull(),
    validUntil: text("valid_until"),
    version: integer("version").notNull().default(1),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("card_rule_versions_card_id_id_idx").on(table.cardId, table.id)],
);

export const recommendationRequests = sqliteTable(
  "recommendation_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    merchant: text("merchant").notNull(),
    category: text("category").notNull(),
    channel: text("channel").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("recommendation_requests_user_id_created_at_idx").on(table.userId, table.createdAt)],
);

export const researchRateWindows = sqliteTable(
  "research_rate_windows",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(0),
  },
  (table) => [uniqueIndex("research_rate_windows_user_window_idx").on(table.userId, table.windowStart)],
);

export const authRateWindows = sqliteTable(
  "auth_rate_windows",
  {
    fingerprint: text("fingerprint").notNull(),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(0),
  },
  (table) => [uniqueIndex("auth_rate_windows_fingerprint_window_idx").on(table.fingerprint, table.windowStart)],
);
