import { z } from "zod";

const categorySchema = z.enum(["dining", "online", "travel", "groceries", "fuel", "other"]);
const channelSchema = z.enum(["online", "offline"]);

export const researchedRuleSchema = z.object({
  label: z.string().trim().min(1).max(80),
  rate: z.number().min(0).max(100),
  cap: z.number().positive().max(1_000_000).nullable(),
  capPeriod: z.enum(["transaction", "monthly", "quarterly", "annual"]).nullable(),
  minSpend: z.number().positive().max(1_000_000).nullable(),
  categories: z.array(categorySchema).max(6),
  channels: z.array(channelSchema).max(2),
  sourceUrl: z.string().url().max(500),
  sourceTitle: z.string().trim().min(1).max(160),
  confidence: z.enum(["high", "medium", "low"]),
  conditions: z.array(z.string().trim().min(1).max(180)).max(8),
});

export const researchResultSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  rules: z.array(researchedRuleSchema).max(12),
  unresolved: z.array(z.string().trim().min(1).max(180)).max(10),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;

export const researchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "rules", "unresolved"],
  properties: {
    summary: { type: "string", maxLength: 500 },
    unresolved: { type: "array", items: { type: "string", maxLength: 180 }, maxItems: 10 },
    rules: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "rate", "cap", "capPeriod", "minSpend", "categories", "channels", "sourceUrl", "sourceTitle", "confidence", "conditions"],
        properties: {
          label: { type: "string", maxLength: 80 },
          rate: { type: "number", minimum: 0, maximum: 100 },
          cap: { type: ["number", "null"], minimum: 0, maximum: 1000000 },
          capPeriod: { type: ["string", "null"], enum: ["transaction", "monthly", "quarterly", "annual", null] },
          minSpend: { type: ["number", "null"], minimum: 0, maximum: 1000000 },
          categories: { type: "array", maxItems: 6, items: { type: "string", enum: ["dining", "online", "travel", "groceries", "fuel", "other"] } },
          channels: { type: "array", maxItems: 2, items: { type: "string", enum: ["online", "offline"] } },
          sourceUrl: { type: "string", maxLength: 500 },
          sourceTitle: { type: "string", maxLength: 160 },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          conditions: { type: "array", maxItems: 8, items: { type: "string", maxLength: 180 } },
        },
      },
    },
  },
} as const;
