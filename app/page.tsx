"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  CreditCard,
  ExternalLink,
  LineChart,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoWallet } from "@/lib/rewards/demo-data";
import { rankCards } from "@/lib/rewards/engine";
import type { CardRecommendation, Channel, PurchaseCategory, WalletCard } from "@/lib/rewards/types";

const categoryOptions: { value: PurchaseCategory; label: string }[] = [
  { value: "dining", label: "Dining" },
  { value: "online", label: "Online shopping" },
  { value: "travel", label: "Travel" },
  { value: "groceries", label: "Groceries" },
  { value: "fuel", label: "Fuel" },
  { value: "other", label: "Other" },
];

function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const className =
    level === "high"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
      : level === "medium"
        ? "bg-amber-50 text-amber-700 ring-amber-600/15"
        : "bg-rose-50 text-rose-700 ring-rose-600/15";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level === "high" ? "High confidence" : level === "medium" ? "Needs review" : "Unverified"}
    </span>
  );
}

export default function Home() {
  const [merchant, setMerchant] = useState("Barbeque Nation");
  const [amount, setAmount] = useState("8,000");
  const [category, setCategory] = useState<PurchaseCategory>("dining");
  const [channel, setChannel] = useState<Channel>("offline");
  const [isResearching, setIsResearching] = useState(false);
  const [lastChecked, setLastChecked] = useState("just now");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletCard[]>(demoWallet);
  const [isPreviewWallet, setIsPreviewWallet] = useState(true);
  const [remoteRecommendationResult, setRemoteRecommendationResult] = useState<{ key: string; recommendations: CardRecommendation[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [cardForm, setCardForm] = useState({
    issuer: "",
    name: "",
    network: "Visa",
    lastFour: "",
    statementDay: "",
    dueDay: "",
    baseRate: "1",
    categoryRate: "",
    cap: "",
  });

  const numericAmount = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const recommendationKey = `${merchant}\u0001${numericAmount}\u0001${category}\u0001${channel}`;
  const localRecommendations = useMemo(
    () => rankCards(wallet, { merchant, amount: numericAmount, category, channel }),
    [category, channel, merchant, numericAmount, wallet],
  );
  const recommendations = remoteRecommendationResult?.key === recommendationKey
    ? remoteRecommendationResult.recommendations
    : localRecommendations;
  const winner = recommendations[0];
  const alternatives = recommendations.slice(1);
  const winnerCap = winner?.breakdown.find((item) => item.capApplied !== null);

  useEffect(() => {
    let cancelled = false;
    async function loadWallet() {
      try {
        const response = await fetch("/api/cards", { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const payload = await response.json() as { cards?: WalletCard[] };
        if (!cancelled && payload.cards && payload.cards.length) {
          setWallet(payload.cards);
          setIsPreviewWallet(false);
          setRemoteRecommendationResult(null);
        }
      } catch {
        // The preview wallet stays available when the private service is unavailable.
      }
    }
    void loadWallet();
    return () => { cancelled = true; };
  }, []);

  async function research() {
    setIsResearching(true);
    setNotice(null);
    try {
      if (!isPreviewWallet) {
        const response = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchant, amount: numericAmount, category, channel }),
        });
        const payload = await response.json() as { recommendations?: CardRecommendation[]; error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "We could not calculate this recommendation.");
        setRemoteRecommendationResult({ key: recommendationKey, recommendations: payload.recommendations ?? [] });
      }
      setLastChecked("just now");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We could not calculate this recommendation.");
    } finally {
      setIsResearching(false);
    }
  }

  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingCard(true);
    setNotice(null);
    const baseRate = Number(cardForm.baseRate);
    const categoryRate = Number(cardForm.categoryRate);
    const rules = [];
    if (baseRate > 0) rules.push({ label: "Base rewards", rate: baseRate, confidence: "medium", source: "User-entered rule" });
    if (categoryRate > 0) rules.push({ label: `${categoryOptions.find((item) => item.value === category)?.label ?? "Category"} rewards`, rate: categoryRate, cap: cardForm.cap ? Number(cardForm.cap) : undefined, capPeriod: cardForm.cap ? "monthly" : undefined, categories: [category], confidence: "medium", source: "User-entered rule" });
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuer: cardForm.issuer,
          name: cardForm.name,
          network: cardForm.network,
          lastFour: cardForm.lastFour,
          statementDay: Number(cardForm.statementDay),
          dueDay: Number(cardForm.dueDay),
          rules,
        }),
      });
      const payload = await response.json() as { card?: WalletCard; error?: { message?: string } };
      if (!response.ok || !payload.card) throw new Error(payload.error?.message ?? "Your card could not be saved.");
      setWallet((current) => isPreviewWallet ? [payload.card!] : [...current, payload.card!]);
      setIsPreviewWallet(false);
      setIsAddCardOpen(false);
      setCardForm({ issuer: "", name: "", network: "Visa", lastFour: "", statementDay: "", dueDay: "", baseRate: "1", categoryRate: "", cap: "" });
      setNotice("Card added securely to your wallet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your card could not be saved.");
    } finally {
      setIsSavingCard(false);
    }
  }

  async function removeCard(cardId: string) {
    if (isPreviewWallet) return;
    setNotice(null);
    try {
      const response = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Your card could not be removed.");
      }
      setWallet((current) => current.filter((card) => card.id !== cardId));
      setRemoteRecommendationResult(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your card could not be removed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#14213d]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-[#e6eaf0] bg-white px-4 py-5 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#172a5b] shadow-[0_10px_24px_rgba(23,42,91,0.22)]"><CreditCard className="h-5 w-5 text-[#f6c759]" strokeWidth={2.5} /></div>
          <span className="text-xl font-bold tracking-[-0.05em]">CardWise</span>
        </div>

        <nav className="mt-10 space-y-1" aria-label="Main navigation">
          <a className="flex items-center gap-3 rounded-xl bg-[#edf2ff] px-3 py-3 text-sm font-semibold text-[#1f3e92]" href="#recommendation"><Sparkles className="h-4.5 w-4.5" /> Find the best card</a>
          <button onClick={() => setIsWalletOpen(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#63708a] transition hover:bg-slate-50 hover:text-[#14213d]"><WalletCards className="h-4.5 w-4.5" /> My wallet <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">{wallet.length}</span></button>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#63708a] transition hover:bg-slate-50 hover:text-[#14213d]" href="#activity"><LineChart className="h-4.5 w-4.5" /> Reward activity</a>
          <a className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#63708a] transition hover:bg-slate-50 hover:text-[#14213d]" href="#evidence"><BookOpen className="h-4.5 w-4.5" /> Evidence centre</a>
        </nav>

        <div className="mt-auto rounded-2xl bg-[#172a5b] p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-[#f6c759]" /> Your card details stay private</div>
          <p className="mt-2 text-xs leading-5 text-[#c8d2ee]">CardWise never stores card numbers, CVV, PIN, or OTP.</p>
          <button onClick={() => setIsHelpOpen(true)} className="mt-4 text-xs font-semibold text-[#f6c759]">How it works <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button>
        </div>
        <button onClick={() => setIsWalletOpen(true)} className="mt-5 flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#63708a]"><Settings2 className="h-4.5 w-4.5" /> Wallet settings</button>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="flex h-[72px] items-center justify-between border-b border-[#e6eaf0] bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#172a5b]"><CreditCard className="h-4 w-4 text-[#f6c759]" /></div><span className="font-bold tracking-[-0.05em]">CardWise</span></div>
          <div className="hidden items-center gap-2 text-sm text-[#70809b] lg:flex"><span className="font-medium text-[#33415c]">Personal finance</span><ChevronRight className="h-4 w-4" /><span>Recommendations</span></div>
          <div className="flex items-center gap-2 sm:gap-4"><button onClick={() => setIsHelpOpen(true)} className="hidden items-center gap-2 rounded-lg border border-[#e0e5ed] px-3 py-2 text-sm font-semibold text-[#40516f] sm:flex"><CircleHelp className="h-4 w-4" /> Help</button><span aria-label="Your CardWise profile" className="grid h-9 w-9 place-items-center rounded-full bg-[#e6ecfc] text-xs font-bold text-[#1f3e92]">PP</span></div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:py-10">
          <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf7f1] px-2.5 py-1 text-xs font-semibold text-[#187a4d]"><span className="h-1.5 w-1.5 rounded-full bg-[#22a56a]" /> {isPreviewWallet ? "Wallet preview ready" : "Secure wallet connected"}</span>{isPreviewWallet && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/10">Preview data</span>}<button onClick={() => setIsAddCardOpen(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-[#4262ad] hover:bg-[#edf2ff]"><Plus className="h-3.5 w-3.5" /> Add a card</button></div>
              <h1 className="text-3xl font-bold tracking-[-0.045em] text-[#14213d] sm:text-[2.1rem]">Which card should I use?</h1>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#64748b]">Tell us what you are buying. We compare benefits, limits, and fresh evidence from the cards you already own.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#77859c]"><RefreshCw className="h-3.5 w-3.5" /> Evidence checked {lastChecked}</div>
          </section>

          {notice && <div role="status" className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#d6e2f7] bg-[#f2f6ff] px-4 py-3 text-sm font-medium text-[#304d91]"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss message" className="rounded-md p-1 hover:bg-white"><X className="h-4 w-4" /></button></div>}

          <section id="recommendation" className="mt-7 rounded-[22px] border border-[#e1e7ee] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.02),0_10px_30px_rgba(15,23,42,0.025)] sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr_0.62fr_auto] lg:items-end">
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.11em] text-[#7a879c]">Merchant</span><span className="flex h-12 items-center gap-2 rounded-xl border border-[#dce3ec] bg-[#fbfcfe] px-3.5 transition focus-within:border-[#4768c6] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#e9eeff]"><Search className="h-4 w-4 text-[#8290a8]" /><input aria-label="Merchant" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-[#98a4b8]" value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="e.g. Barbeque Nation" /></span></label>
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.11em] text-[#7a879c]">Purchase type</span><select aria-label="Purchase type" className="h-12 w-full rounded-xl border border-[#dce3ec] bg-[#fbfcfe] px-3.5 text-sm font-semibold text-[#243552] outline-none transition focus:border-[#4768c6] focus:bg-white focus:ring-4 focus:ring-[#e9eeff]" value={category} onChange={(event) => setCategory(event.target.value as PurchaseCategory)}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.11em] text-[#7a879c]">Amount</span><span className="flex h-12 items-center rounded-xl border border-[#dce3ec] bg-[#fbfcfe] px-3.5 transition focus-within:border-[#4768c6] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#e9eeff]"><span className="mr-1 text-sm font-bold text-[#51627f]">₹</span><input aria-label="Amount" inputMode="numeric" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" value={amount} onChange={(event) => setAmount(event.target.value)} /></span></label>
              <button onClick={research} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1b377d] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(27,55,125,0.23)] transition hover:bg-[#142c68] focus:outline-none focus:ring-4 focus:ring-[#d8e3ff] disabled:opacity-70" disabled={isResearching}>{isResearching ? <><RefreshCw className="h-4 w-4 animate-spin" /> Checking…</> : <><Sparkles className="h-4 w-4 text-[#f6c759]" /> Find best card</>}</button>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-[#edf0f4] pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm text-[#65738a]"><span>How will you pay?</span><div className="flex rounded-lg bg-[#f2f5f9] p-1">{(["offline", "online"] as Channel[]).map((option) => <button key={option} onClick={() => setChannel(option)} className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition ${channel === option ? "bg-white text-[#1b377d] shadow-sm" : "text-[#718098]"}`}>{option}</button>)}</div></div><button onClick={() => setIsHelpOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4563ad]">Not sure about the category? <CircleHelp className="h-3.5 w-3.5" /></button></div>
          </section>

          <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-live="polite">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#718099]">Your recommendation</h2><span className="text-xs text-[#8290a8]">For {merchant || "this purchase"} · {formatRupees(numericAmount)}</span></div>
              {winner ? <article className="overflow-hidden rounded-[22px] bg-[#142d69] text-white shadow-[0_18px_45px_rgba(20,45,105,0.20)]" id="wallet"><div className="relative overflow-hidden p-6 sm:p-7"><div className="pointer-events-none absolute right-0 top-0 h-52 w-52 -translate-y-16 translate-x-16 rounded-full border-[28px] border-[#38569c] opacity-50" /><div className="pointer-events-none absolute bottom-[-110px] right-36 h-56 w-56 rounded-full bg-[#244589] blur-3xl" /><div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-start"><div><span className="inline-flex rounded-full bg-[#f6c759] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#4d3900]">Best for this purchase</span><h3 className="mt-4 text-2xl font-bold tracking-[-0.035em] sm:text-[1.7rem]">Use your {winner.card.name}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-[#c9d5f1]">{winner.reason} It gives the strongest verified value from your current wallet.</p></div><div className="min-w-[154px] rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><p className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#b8c8ec]">Estimated benefit</p><p className="mt-1 text-[2rem] font-bold tracking-[-0.05em] text-white">{formatRupees(winner.totalValue)}</p><p className="text-xs font-semibold text-[#b8c8ec]">{winner.effectiveRate.toFixed(1)}% effective return</p></div></div><div className="relative mt-7 grid gap-3 border-t border-white/12 pt-5 sm:grid-cols-3"><div className="flex items-center gap-2.5 text-sm"><BadgeCheck className="h-4.5 w-4.5 text-[#71d9a1]" /><span><strong>{winner.daysToDue} days</strong> until payment due</span></div><div className="flex items-center gap-2.5 text-sm"><CalendarDays className="h-4.5 w-4.5 text-[#a7c6ff]" /><span>{winnerCap ? <><strong>{formatRupees(winnerCap.capApplied ?? 0)}</strong> remaining cap</> : "No verified cap applies"}</span></div><button onClick={() => setExpandedCard(expandedCard === winner.card.id ? null : winner.card.id)} className="flex items-center gap-2.5 text-left text-sm font-semibold text-[#f6c759]">Why this card? <ChevronRight className={`h-4 w-4 transition ${expandedCard === winner.card.id ? "rotate-90" : ""}`} /></button></div>{expandedCard === winner.card.id && <div className="relative mt-5 rounded-xl bg-[#0e2458] p-4 text-sm text-[#d8e2f8]">We calculate every applicable rule independently, then apply remaining caps. Reward points are converted to rupees only when their value is verified.</div>}</div></article> : <div className="rounded-2xl border border-dashed border-[#cad5e5] bg-white p-8 text-center"><WalletCards className="mx-auto h-8 w-8 text-[#7185aa]" /><h3 className="mt-3 font-bold text-[#243552]">Add your first card to get a recommendation</h3><p className="mt-1 text-sm text-[#718099]">Only the cards you add are evaluated.</p><button onClick={() => setIsAddCardOpen(true)} className="mt-4 rounded-lg bg-[#1b377d] px-4 py-2 text-sm font-bold text-white">Add a card</button></div>}

              <div className="mt-7"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#718099]">Alternatives</h2><button onClick={() => setExpandedCard(alternatives[0]?.card.id ?? null)} className="text-xs font-bold text-[#4563ad]">Compare all <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button></div><div className="space-y-3">{alternatives.map((recommendation, index) => <article key={recommendation.card.id} className="rounded-2xl border border-[#e1e7ee] bg-white p-4 transition hover:border-[#cfd8e7] hover:shadow-[0_10px_24px_rgba(23,42,91,0.05)] sm:flex sm:items-center sm:gap-4 sm:p-5"><div className="flex flex-1 items-center gap-3.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef2f8] text-xs font-bold text-[#63708a]">#{index + 2}</span><div className="grid h-11 w-[66px] shrink-0 place-items-center rounded-lg shadow-sm" style={{ background: `linear-gradient(135deg, ${recommendation.card.accent}, #243a77)` }}><CreditCard className="h-5 w-5 text-white/85" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#1c2b48]">{recommendation.card.name}</h3><span className="text-xs text-[#8490a5]">•{recommendation.card.lastFour}</span></div><p className="mt-0.5 truncate text-xs text-[#70809a]">{recommendation.reason}</p></div></div><div className="mt-4 flex items-center justify-between gap-4 border-t border-[#edf0f4] pt-3 sm:mt-0 sm:border-0 sm:pt-0"><ConfidenceBadge level={recommendation.confidence} /><div className="text-right"><p className="text-lg font-bold tracking-[-0.03em] text-[#1b377d]">{formatRupees(recommendation.totalValue)}</p><p className="text-[11px] font-semibold text-[#8290a8]">{recommendation.effectiveRate.toFixed(1)}% return</p></div><button onClick={() => setExpandedCard(expandedCard === recommendation.card.id ? null : recommendation.card.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[#61728d] hover:bg-[#f1f4f8]" aria-label={`View ${recommendation.card.name} calculation`}><MoreHorizontal className="h-5 w-5" /></button></div>{expandedCard === recommendation.card.id && <div className="mt-4 w-full rounded-xl bg-[#f6f8fb] p-3 text-xs leading-5 text-[#65738a] sm:ml-12">{recommendation.breakdown.map((item) => <p key={item.rule.id}>{item.rule.label}: {formatRupees(item.finalValue)} · {item.note}</p>)}</div>}</article>)}</div></div>
            </section>

            <aside className="space-y-5">
              <section id="evidence" className="rounded-2xl border border-[#e1e7ee] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-[#1d2c48]">Evidence health</p><p className="mt-1 text-xs leading-5 text-[#718099]">The rules behind this recommendation.</p></div><ShieldCheck className="h-5 w-5 text-[#1fa66a]" /></div><div className="mt-5 space-y-3"><div className="rounded-xl bg-[#f6f8fb] p-3.5"><div className="flex items-center justify-between text-xs"><span className="font-bold text-[#44536d]">{wallet.reduce((count, card) => count + card.rules.length, 0)} card rules checked</span><span className={`font-bold ${isPreviewWallet ? "text-amber-700" : "text-[#178151]"}`}>{isPreviewWallet ? "Preview" : "Saved"}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfe6ef]"><div className="h-full w-full rounded-full bg-[#24a46d]" /></div></div><div className="flex items-center gap-3 text-xs text-[#687891]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf2ff]"><BookOpen className="h-3.5 w-3.5 text-[#4262ad]" /></span><span><strong className="text-[#40516a]">{winner?.breakdown[0]?.rule.source ?? "No evidence yet"}</strong><br />{winner?.breakdown[0]?.rule.checkedAt ?? "Add a card rule"}</span><ExternalLink className="ml-auto h-3.5 w-3.5" /></div></div><button onClick={() => setIsHelpOpen(true)} className="mt-5 w-full rounded-xl border border-[#dbe2ee] py-2.5 text-xs font-bold text-[#3d5ea8] transition hover:bg-[#f5f8ff]">View source evidence</button></section>
              <section id="activity" className="rounded-2xl border border-[#e1e7ee] bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#1d2c48]">Card limits at a glance</p><button onClick={() => setIsWalletOpen(true)} aria-label="Manage card limits" className="text-[#72839e]"><MoreHorizontal className="h-5 w-5" /></button></div><div className="mt-5 space-y-4">{wallet.map((card, index) => { const rule = card.rules.find((item) => item.cap) ?? card.rules[0]; if (!rule?.cap) return <div key={card.id} className="text-xs text-[#718099]">{card.name}: no verified cap</div>; const usedPercent = ((rule.used ?? 0) / rule.cap) * 100; return <div key={card.id}><div className="flex items-center justify-between text-xs"><span className="font-semibold text-[#43536e]">{card.issuer.replace(" Bank", "")}</span><span className="font-bold text-[#64748b]">{formatRupees(rule.used ?? 0)} / {formatRupees(rule.cap)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf0f4]"><div className="h-full rounded-full" style={{ width: `${Math.max(usedPercent, index === 2 ? 5 : 0)}%`, backgroundColor: card.accent }} /></div></div>; })}</div><p className="mt-5 border-t border-[#edf0f4] pt-4 text-xs leading-5 text-[#8290a8]">We rank incremental value, so already-used limits cannot inflate a recommendation.</p></section>
            </aside>
          </div>
        </div>
      </div>

      <Dialog open={isWalletOpen} onOpenChange={setIsWalletOpen}>
        <DialogContent className="max-w-2xl border-[#dce3ec] bg-white p-0">
          <DialogHeader className="border-b border-[#e8edf3] px-6 py-5">
            <DialogTitle className="text-[#1c2b48]">Your wallet</DialogTitle>
            <DialogDescription>Only card identity and the last four digits are stored. Never add a full card number, CVV, PIN, or OTP.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[52vh] space-y-3 overflow-y-auto px-6 py-4">
            {isPreviewWallet && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">You are viewing a safe preview wallet. Add a card to start a private saved wallet.</div>}
            {wallet.map((card) => <div key={card.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] p-3.5"><div className="grid h-10 w-14 place-items-center rounded-lg" style={{ background: `linear-gradient(135deg, ${card.accent}, #243a77)` }}><CreditCard className="h-5 w-5 text-white/85" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#243552]">{card.name} <span className="font-medium text-[#7b8aa1]">•{card.lastFour || "----"}</span></p><p className="mt-0.5 text-xs text-[#718099]">{card.issuer} · Statement {card.statementDay} · Due {card.dueDay}</p><p className="mt-1 text-xs font-medium text-[#4563ad]">{card.rules.length} saved reward rule{card.rules.length === 1 ? "" : "s"}</p></div>{!isPreviewWallet && <button onClick={() => void removeCard(card.id)} className="rounded-lg p-2 text-[#a04a4a] transition hover:bg-rose-50" aria-label={`Remove ${card.name}`}><Trash2 className="h-4 w-4" /></button>}</div>)}
          </div>
          <DialogFooter className="border-t border-[#e8edf3] px-6 py-4"><Button variant="outline" onClick={() => setIsWalletOpen(false)}>Close</Button><Button onClick={() => { setIsWalletOpen(false); setIsAddCardOpen(true); }}><Plus /> Add a card</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCardOpen} onOpenChange={setIsAddCardOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-[#dce3ec] bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#1c2b48]">Add a card</DialogTitle>
            <DialogDescription>Enter only the minimum information needed to calculate benefits. CardWise never asks for sensitive payment credentials.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addCard} className="grid gap-4" data-testid="add-card-form">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-semibold text-[#40516a]">Issuing bank<Input required maxLength={80} value={cardForm.issuer} onChange={(event) => setCardForm({ ...cardForm, issuer: event.target.value })} placeholder="e.g. ICICI Bank" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#40516a]">Card name<Input required maxLength={100} value={cardForm.name} onChange={(event) => setCardForm({ ...cardForm, name: event.target.value })} placeholder="e.g. Sapphiro" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#40516a]">Network<select value={cardForm.network} onChange={(event) => setCardForm({ ...cardForm, network: event.target.value })} className="h-9 rounded-md border border-[#dce3ec] bg-white px-3 text-sm outline-none focus:border-[#4768c6] focus:ring-2 focus:ring-[#dbe5ff]"><option>Visa</option><option>Mastercard</option><option>RuPay</option><option>Amex</option></select></label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#40516a]">Last 4 digits<Input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={cardForm.lastFour} onChange={(event) => setCardForm({ ...cardForm, lastFour: event.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="1234" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#40516a]">Statement day<Input required type="number" min="1" max="31" value={cardForm.statementDay} onChange={(event) => setCardForm({ ...cardForm, statementDay: event.target.value })} placeholder="18" /></label>
              <label className="grid gap-1.5 text-sm font-semibold text-[#40516a]">Payment due day<Input required type="number" min="1" max="31" value={cardForm.dueDay} onChange={(event) => setCardForm({ ...cardForm, dueDay: event.target.value })} placeholder="7" /></label>
            </div>
            <div className="rounded-xl bg-[#f6f8fb] p-4"><p className="text-sm font-bold text-[#304362]">Reward rules for this MVP</p><p className="mt-1 text-xs leading-5 text-[#718099]">Use values you have verified in the issuer terms. Live evidence refresh can be added when the secure research key is configured.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="grid gap-1.5 text-xs font-bold text-[#52627b]">Base return %<Input required type="number" min="0" max="100" step="0.01" value={cardForm.baseRate} onChange={(event) => setCardForm({ ...cardForm, baseRate: event.target.value })} /></label><label className="grid gap-1.5 text-xs font-bold text-[#52627b]">{categoryOptions.find((item) => item.value === category)?.label} return %<Input type="number" min="0" max="100" step="0.01" value={cardForm.categoryRate} onChange={(event) => setCardForm({ ...cardForm, categoryRate: event.target.value })} placeholder="Optional" /></label><label className="grid gap-1.5 text-xs font-bold text-[#52627b]">Monthly cap ₹<Input type="number" min="1" max="1000000" value={cardForm.cap} onChange={(event) => setCardForm({ ...cardForm, cap: event.target.value })} placeholder="Optional" /></label></div></div>
            <DialogFooter className="mt-2"><Button type="button" variant="outline" onClick={() => setIsAddCardOpen(false)}>Cancel</Button><Button type="submit" disabled={isSavingCard}>{isSavingCard ? "Saving…" : "Save card securely"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="border-[#dce3ec] bg-white">
          <DialogHeader><DialogTitle className="text-[#1c2b48]">How CardWise works</DialogTitle><DialogDescription>CardWise evaluates only cards in your wallet and shows the incremental value of this purchase.</DialogDescription></DialogHeader>
          <ol className="space-y-3 text-sm leading-6 text-[#52627b]"><li><strong className="text-[#243552]">1. Add only safe card details.</strong> We store issuer, product, last four digits, cycle dates, and the rules you verify.</li><li><strong className="text-[#243552]">2. Enter a purchase.</strong> Merchant, amount, category, and online or offline context determine which rules apply.</li><li><strong className="text-[#243552]">3. Let deterministic code calculate the value.</strong> It applies caps and used limits before ranking cards. No AI model decides the money math.</li><li><strong className="text-[#243552]">4. Review evidence.</strong> Live research is optional and will never silently replace a historical rule.</li></ol>
          <DialogFooter><Button onClick={() => setIsHelpOpen(false)}>Got it</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
