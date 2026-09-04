export type PurchaseCategory =
  | "dining"
  | "online"
  | "travel"
  | "groceries"
  | "fuel"
  | "other";

export type Channel = "online" | "offline";

export type CapPeriod = "transaction" | "monthly" | "quarterly" | "annual";

export type BenefitRule = {
  id: string;
  label: string;
  rate: number;
  cap?: number;
  capPeriod?: CapPeriod;
  used?: number;
  minSpend?: number;
  categories?: PurchaseCategory[];
  channels?: Channel[];
  confidence: "high" | "medium" | "low";
  source: string;
  checkedAt: string;
  isDemo?: boolean;
};

export type WalletCard = {
  id: string;
  name: string;
  issuer: string;
  network: "Visa" | "Mastercard" | "RuPay" | "Amex";
  accent: string;
  lastFour: string;
  statementDay: number;
  dueDay: number;
  rules: BenefitRule[];
};

export type Purchase = {
  merchant: string;
  category: PurchaseCategory;
  amount: number;
  channel: Channel;
};

export type BenefitBreakdown = {
  rule: BenefitRule;
  rawValue: number;
  capApplied: number | null;
  finalValue: number;
  status: "applied" | "ineligible" | "capped" | "unverified";
  note: string;
};

export type CardRecommendation = {
  card: WalletCard;
  totalValue: number;
  effectiveRate: number;
  daysToDue: number;
  breakdown: BenefitBreakdown[];
  confidence: "high" | "medium" | "low";
  reason: string;
};
