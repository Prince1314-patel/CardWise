import { z } from "zod";

const categorySchema = z.enum(["dining", "online", "travel", "groceries", "fuel", "other"]);
const channelSchema = z.enum(["online", "offline"]);
const confidenceSchema = z.enum(["high", "medium", "low"]);
const networkSchema = z.enum(["Visa", "Mastercard", "RuPay", "Amex"]);

const cleanText = (max: number) => z.string().trim().min(1).max(max);

export const benefitRuleInputSchema = z.object({
  label: cleanText(80),
  rate: z.number().min(0).max(100),
  cap: z.number().positive().max(1_000_000).optional(),
  capPeriod: z.enum(["transaction", "monthly", "quarterly", "annual"]).optional(),
  used: z.number().min(0).max(1_000_000).optional(),
  minSpend: z.number().positive().max(1_000_000).optional(),
  categories: z.array(categorySchema).max(6).optional(),
  channels: z.array(channelSchema).max(2).optional(),
  confidence: confidenceSchema.default("medium"),
  source: cleanText(120).default("User-entered rule"),
  sourceUrl: z.string().url().max(500).optional(),
  checkedAt: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
}).superRefine((rule, ctx) => {
  if (rule.used !== undefined && rule.cap !== undefined && rule.used > rule.cap) {
    ctx.addIssue({ code: "custom", message: "Used benefit cannot exceed the cap.", path: ["used"] });
  }
});

export const cardInputSchema = z.object({
  issuer: cleanText(80),
  name: cleanText(100),
  network: networkSchema,
  nickname: z.string().trim().max(60).optional(),
  lastFour: z.string().regex(/^\d{4}$/).or(z.literal("")),
  statementDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  rules: z.array(benefitRuleInputSchema).max(20).default([]),
});

export const recommendationInputSchema = z.object({
  merchant: cleanText(120),
  amount: z.number().positive().max(1_000_000),
  category: categorySchema,
  channel: channelSchema,
});

export const researchInputSchema = recommendationInputSchema.extend({
  cardId: z.string().uuid(),
});

export type CardInput = z.output<typeof cardInputSchema>;
export type RecommendationInput = z.infer<typeof recommendationInputSchema>;
