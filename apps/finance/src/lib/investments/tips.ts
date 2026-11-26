import { addDays, type DateKey } from "@studio/dates";

import type { InvestmentRow } from "@/db/schema";

export type TipTone = "good" | "info" | "warning";

export interface Tip {
  id: string;
  tone: TipTone;
  title: string;
  body: string;
  investmentId?: string;
  action?: "slab";
}

const TONE_ORDER: Record<TipTone, number> = { warning: 0, info: 1, good: 2 };

const round2 = (x: number) => Number(x.toFixed(2));

const LOW_RATING = /^(BBB|BB|B|C|D)/;

export function investmentTips(input: {
  investments: readonly InvestmentRow[];
  today: DateKey;
  taxRate: number | null;
  fmt: (minor: number) => string;
  dateLabel: (key: DateKey) => string;
}): Tip[] {
  const { today, taxRate, fmt, dateLabel } = input;
  const open = input.investments.filter((i) => !i.closedOn);
  const bonds = open.filter((i) => i.type === "bond");
  const tips: Tip[] = [];

  for (const b of bonds) {
    const rating = b.rating.trim().toUpperCase();
    if (!LOW_RATING.test(rating)) continue;
    tips.push({
      id: `rating:${b.id}`,
      tone: "warning",
      title: `${b.name} is rated ${rating}`,
      body: "Lower-rated bonds pay more because the risk of a missed payment is higher. Keep the amount in any one such issuer small.",
      investmentId: b.id,
    });
  }

  const total = open.reduce((s, i) => s + i.amount, 0);
  if (open.length >= 2 && total > 0) {
    const byIssuer = new Map<string, number>();
    for (const i of open) {
      const key = i.issuer || i.name;
      byIssuer.set(key, (byIssuer.get(key) ?? 0) + i.amount);
    }
    for (const [issuer, amount] of byIssuer) {
      if (amount / total <= 0.4) continue;
      tips.push({
        id: `issuer:${issuer}`,
        tone: "warning",
        title: `${Math.round((amount / total) * 100)}% is with ${issuer}`,
        body: "If one issuer misses payments, everything with them is at risk. Spreading across issuers limits the damage.",
      });
    }
  }

  for (const b of bonds) {
    if (b.cleanPrice == null || b.faceValue == null || b.units == null) continue;
    if (b.cleanPrice <= b.faceValue) continue;
    const premium = Math.round((b.cleanPrice - b.faceValue) * b.units);
    if (premium < 100) continue;
    tips.push({
      id: `premium:${b.id}`,
      tone: "info",
      title: `Paid ${fmt(premium)} above face value`,
      body: `${b.name} repays face value, so this ${fmt(premium)} comes out of your interest. The yield (YTM) you were shown already counts it.`,
      investmentId: b.id,
    });
  }

  for (const b of open) {
    const accrued = b.accruedAtBuy;
    if (accrued == null || accrued === 0) continue;
    tips.push(
      accrued > 0
        ? {
            id: `accrued:${b.id}`,
            tone: "info",
            title: `${fmt(accrued)} accrued interest paid`,
            body: `You paid the seller of ${b.name} the interest built up since its last payout. It comes back in full with the next payout, so it isn't a loss.`,
            investmentId: b.id,
          }
        : {
            id: `accrued:${b.id}`,
            tone: "info",
            title: `${fmt(-accrued)} accrued interest received`,
            body: `You were credited interest when buying ${b.name}, so its next payout is smaller by the same amount.`,
            investmentId: b.id,
          },
    );
  }

  const rated = open.filter((i) => i.rate != null && i.amount > 0);
  if (taxRate !== null) {
    const weight = rated.reduce((s, i) => s + i.amount, 0);
    if (weight > 0) {
      const r = rated.reduce((s, i) => s + (i.rate as number) * i.amount, 0) / weight;
      const net = round2(r * (1 - taxRate / 100));
      tips.push({
        id: "after-tax",
        tone: "info",
        title: `About ${net}% after tax`,
        body: `Interest is taxed at your slab. Your average rate of ${round2(r)}% keeps about ${net}% after ${taxRate}% tax.`,
      });
    }
  } else if (open.length > 0) {
    tips.push({
      id: "slab",
      tone: "info",
      title: "Set your tax slab",
      body: "See what your interest is worth after tax.",
      action: "slab",
    });
  }

  const horizon = addDays(today, 30);
  for (const i of open) {
    if (!i.maturityDate || i.maturityDate <= today || i.maturityDate > horizon) continue;
    tips.push({
      id: `maturing:${i.id}`,
      tone: "info",
      title: `${fmt(i.amount)} back on ${dateLabel(i.maturityDate as DateKey)}`,
      body: `${i.name} ends soon. Decide where this money goes next.`,
      investmentId: i.id,
    });
  }

  for (const b of bonds) {
    if (b.cleanPrice == null || b.faceValue == null || b.units == null) continue;
    if (b.cleanPrice >= b.faceValue) continue;
    const discount = Math.round((b.faceValue - b.cleanPrice) * b.units);
    tips.push({
      id: `discount:${b.id}`,
      tone: "good",
      title: `Bought ${fmt(discount)} below face value`,
      body: `${b.name} repays face value, so you get this ${fmt(discount)} on top of the interest.`,
      investmentId: b.id,
    });
  }

  return tips
    .map((t, n) => ({ t, n }))
    .sort((a, b) => TONE_ORDER[a.t.tone] - TONE_ORDER[b.t.tone] || a.n - b.n)
    .map((x) => x.t);
}
