import type {
  BenefitBreakdown,
  BenefitRule,
  CardRecommendation,
  Purchase,
  WalletCard,
} from "./types";

const confidenceScore = { high: 3, medium: 2, low: 1 } as const;

function isEligible(rule: BenefitRule, purchase: Purchase) {
  const categoryMatch = !rule.categories || rule.categories.includes(purchase.category);
  const channelMatch = !rule.channels || rule.channels.includes(purchase.channel);
  const spendMatch = !rule.minSpend || purchase.amount >= rule.minSpend;
  return categoryMatch && channelMatch && spendMatch;
}

function calculateRule(rule: BenefitRule, purchase: Purchase): BenefitBreakdown {
  if (!isEligible(rule, purchase)) {
    return {
      rule,
      rawValue: 0,
      capApplied: null,
      finalValue: 0,
      status: "ineligible",
      note: rule.minSpend && purchase.amount < rule.minSpend
        ? `Minimum spend is ₹${rule.minSpend.toLocaleString("en-IN")}.`
        : "This benefit does not apply to this purchase.",
    };
  }

  const rawValue = (purchase.amount * rule.rate) / 100;
  const remainingCap = rule.cap === undefined ? Infinity : Math.max(0, rule.cap - (rule.used ?? 0));
  const finalValue = Math.min(rawValue, remainingCap);
  const capped = finalValue < rawValue;

  return {
    rule,
    rawValue,
    capApplied: Number.isFinite(remainingCap) ? remainingCap : null,
    finalValue,
    status: rule.confidence === "low" ? "unverified" : capped ? "capped" : "applied",
    note: capped
      ? `Only ₹${remainingCap.toLocaleString("en-IN")} remains in the ${rule.capPeriod ?? "monthly"} limit.`
      : `${rule.rate}% applies to this transaction.`,
  };
}

function daysUntilNextDue(card: WalletCard) {
  const today = new Date();
  const due = new Date(today.getFullYear(), today.getMonth(), card.dueDay);
  if (due <= today) due.setMonth(due.getMonth() + 1);
  return Math.max(1, Math.ceil((due.getTime() - today.getTime()) / 86_400_000));
}

export function rankCards(cards: WalletCard[], purchase: Purchase): CardRecommendation[] {
  return cards
    .map((card) => {
      const breakdown = card.rules.map((rule) => calculateRule(rule, purchase));
      const totalValue = breakdown.reduce((sum, item) => sum + item.finalValue, 0);
      const applied = breakdown.filter((item) => item.finalValue > 0);
      const lowestConfidence = applied.reduce<"high" | "medium" | "low">(
        (lowest, item) =>
          confidenceScore[item.rule.confidence] < confidenceScore[lowest]
            ? item.rule.confidence
            : lowest,
        "high",
      );
      const bestRule = [...applied].sort((a, b) => b.finalValue - a.finalValue)[0];
      const daysToDue = daysUntilNextDue(card);

      return {
        card,
        totalValue,
        effectiveRate: purchase.amount ? (totalValue / purchase.amount) * 100 : 0,
        daysToDue,
        breakdown,
        confidence: lowestConfidence,
        reason: bestRule
          ? `${bestRule.rule.label} gives ₹${Math.round(bestRule.finalValue).toLocaleString("en-IN")} on this purchase.`
          : "No verified benefit is available for this purchase yet.",
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue || b.daysToDue - a.daysToDue);
}
