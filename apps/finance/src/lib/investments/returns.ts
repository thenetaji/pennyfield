import { addDays, addMonths, diffDays, type DateKey } from "@studio/dates";

import type {
  InvestmentPayoutSchedule,
  InvestmentRow,
  PayoutRow,
} from "@/db/schema";

import {
  payoutTotals,
  taxYearOf,
  taxYearRange,
  type TaxRules,
  type TaxYearSummary,
} from "./tax";

export interface ExpectedFlow {
  dateKey: DateKey;
  kind: "interest" | "principal";
  amount: number;
}

export type Terms = Pick<
  InvestmentRow,
  | "amount"
  | "rate"
  | "payout"
  | "buyDate"
  | "maturityDate"
  | "firstPayoutDate"
  | "couponAmount"
  | "redemptionAmount"
> & {
  /** The issuer's schedule; when present it replaces the calculated one. */
  schedule?: readonly ExpectedFlow[];
};

const PERIOD_MONTHS: Partial<Record<InvestmentPayoutSchedule, number>> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};
const DAYS_PER_YEAR = 365;
/** Indian banks compound cumulative deposits every quarter. */
const COMPOUNDS_PER_YEAR = 4;

const simple = (amount: number, rate: number, days: number) =>
  (amount * rate * days) / (100 * DAYS_PER_YEAR);

const compounded = (amount: number, rate: number, days: number) =>
  amount *
    (1 + rate / (100 * COMPOUNDS_PER_YEAR)) **
      ((COMPOUNDS_PER_YEAR * days) / DAYS_PER_YEAR) -
  amount;

const byDate = (a: ExpectedFlow, b: ExpectedFlow) =>
  a.dateKey.localeCompare(b.dateKey) || a.kind.localeCompare(b.kind);

/** What comes back at maturity: the stated redemption value, else the amount invested. */
export const redemptionOf = (
  inv: Pick<Terms, "amount" | "redemptionAmount" | "payout" | "couponAmount">,
) => (quotesMaturityAmount(inv) ? inv.amount : (inv.redemptionAmount ?? inv.amount));

/** A deposit paying at maturity whose stated amount back is above the amount put in: that amount includes the interest. */
const quotesMaturityAmount = (
  inv: Pick<Terms, "amount" | "redemptionAmount" | "payout" | "couponAmount">,
) =>
  !PERIOD_MONTHS[inv.payout] &&
  !inv.couponAmount &&
  inv.redemptionAmount !== null &&
  inv.redemptionAmount > inv.amount;

/**
 * Interest and principal the terms promise, from purchase to maturity. An entered schedule wins. Otherwise periodic
 * payouts start on the first payout date (or one period after purchase) and repeat each period; with a stated coupon
 * every payout is that coupon, else a period's interest at the rate plus a broken period at maturity. Cumulative
 * deposits compound quarterly and pay at maturity.
 */
export function expectedFlows(inv: Terms): ExpectedFlow[] {
  if (inv.schedule && inv.schedule.length > 0) {
    const rows = [...inv.schedule];
    if (inv.maturityDate && !rows.some((r) => r.kind === "principal"))
      rows.push({
        dateKey: inv.maturityDate,
        kind: "principal",
        amount: redemptionOf(inv),
      });
    return rows.sort(byDate);
  }
  const maturity = inv.maturityDate;
  if (!maturity) return [];
  const principal: ExpectedFlow = {
    dateKey: maturity,
    kind: "principal",
    amount: redemptionOf(inv),
  };
  const rate = inv.rate ?? 0;
  const months = PERIOD_MONTHS[inv.payout];
  const coupon =
    inv.couponAmount ??
    (months ? Math.round((inv.amount * rate * months) / 1200) : 0);
  // Platforms quote a deposit's maturity amount with the interest in it, so the part above the amount put in is interest.
  if (quotesMaturityAmount(inv))
    return [
      { dateKey: maturity, kind: "interest", amount: (inv.redemptionAmount ?? 0) - inv.amount },
      principal,
    ];
  if (rate <= 0 && !inv.couponAmount) return [principal];
  const days = diffDays(inv.buyDate, maturity);
  if (!months) {
    const interest =
      inv.couponAmount ??
      (inv.payout === "cumulative"
        ? compounded(inv.amount, rate, days)
        : simple(inv.amount, rate, days));
    return [
      { dateKey: maturity, kind: "interest", amount: Math.round(interest) },
      principal,
    ];
  }
  const flows: ExpectedFlow[] = [];
  const first = inv.firstPayoutDate ?? addMonths(inv.buyDate, months);
  let previous = inv.buyDate;
  for (let k = 0; ; k += 1) {
    const next = addMonths(first, months * k);
    if (next >= maturity) break;
    if (next > inv.buyDate)
      flows.push({ dateKey: next, kind: "interest", amount: coupon });
    previous = next;
  }
  // A stated coupon leaves the last part to the redemption value, as issuers quote it.
  const broken = inv.couponAmount
    ? 0
    : Math.round(simple(inv.amount, rate, diffDays(previous, maturity)));
  if (broken > 0)
    flows.push({ dateKey: maturity, kind: "interest", amount: broken });
  flows.push(principal);
  return flows;
}

/** Interest the terms have earned by `today`, paid or not: payouts due so far plus the running share of the next. */
export function earnedBy(inv: Terms, today: DateKey): number {
  if (today <= inv.buyDate) return 0;
  let earned = 0;
  let last = inv.buyDate;
  for (const flow of expectedFlows(inv)) {
    if (flow.kind !== "interest") continue;
    if (flow.dateKey <= today) {
      earned += flow.amount;
      last = flow.dateKey;
      continue;
    }
    const span = diffDays(last, flow.dateKey);
    if (span > 0) earned += (flow.amount * diffDays(last, today)) / span;
    break;
  }
  return Math.round(earned);
}

export interface InvestmentReturns {
  /** All interest the terms promise over the whole term. */
  expectedInterest: number;
  /** Promised interest not received yet. */
  interestToCome: number;
  /** Earned by today but not received. */
  accrued: number;
  /** What is invested now plus interest earned and not yet received. */
  currentValue: number;
  /** Redemption value plus every rupee of interest over the term. */
  totalAtMaturity: number;
  /** Interest plus any difference between the redemption value and the amount invested. */
  expectedGain: number;
  /** Yearly return from the dates and amounts that actually moved; null when there is too little to tell. */
  xirr: number | null;
}

/** An investment with its entered schedule, if any. */
export type PlannedInvestment = InvestmentRow & Pick<Terms, "schedule">;

export function investmentReturns(
  inv: PlannedInvestment,
  payouts: readonly PayoutRow[],
  today: DateKey,
): InvestmentReturns {
  const totals = payoutTotals(payouts);
  const expectedInterest = expectedFlows(inv)
    .filter((f) => f.kind === "interest")
    .reduce((sum, f) => sum + f.amount, 0);
  const open = !inv.closedOn;
  const accrued = open
    ? Math.max(0, earnedBy(inv, today) - totals.interest)
    : 0;
  const still = open ? Math.max(0, inv.amount - totals.principalBack) : 0;
  return {
    expectedInterest,
    interestToCome: open ? Math.max(0, expectedInterest - totals.interest) : 0,
    accrued,
    currentValue: still + accrued,
    totalAtMaturity:
      redemptionOf(inv) + Math.max(expectedInterest, totals.interest),
    expectedGain: expectedInterest + redemptionOf(inv) - inv.amount,
    xirr: xirr(cashFlows([inv], payouts, today, () => accrued)),
  };
}

export interface DatedAmount {
  dateKey: DateKey;
  /** Negative for money put in, positive for money back. */
  amount: number;
}

/** Money in and out of these investments; open ones count as sold today at their current value. */
export function cashFlows(
  investments: readonly InvestmentRow[],
  payouts: readonly PayoutRow[],
  today: DateKey,
  accruedOf: (inv: InvestmentRow) => number,
): DatedAmount[] {
  const ids = new Set(investments.map((i) => i.id));
  const flows: DatedAmount[] = investments.map((i) => ({
    dateKey: i.buyDate,
    amount: -i.amount,
  }));
  for (const p of payouts)
    if (ids.has(p.investmentId))
      flows.push({ dateKey: p.dateKey, amount: p.gross });
  for (const inv of investments) {
    if (inv.closedOn) continue;
    const back = payoutTotals(
      payouts.filter((p) => p.investmentId === inv.id),
    ).principalBack;
    const value = Math.max(0, inv.amount - back) + accruedOf(inv);
    if (value > 0) flows.push({ dateKey: today, amount: value });
  }
  return flows;
}

const MIN_DAYS = 7;

/** Annual internal rate of return, as a percentage; null without money both in and out over a week or more. */
export function xirr(flows: readonly DatedAmount[]): number | null {
  if (flows.length < 2) return null;
  if (!flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0))
    return null;
  const start = flows.reduce(
    (min, f) => (f.dateKey < min ? f.dateKey : min),
    flows[0]?.dateKey ?? "",
  );
  const end = flows.reduce(
    (max, f) => (f.dateKey > max ? f.dateKey : max),
    start,
  );
  if (diffDays(start, end) < MIN_DAYS) return null;
  const years = flows.map((f) => diffDays(start, f.dateKey) / DAYS_PER_YEAR);
  const npv = (rate: number) =>
    flows.reduce(
      (sum, f, i) => sum + f.amount / (1 + rate) ** (years[i] ?? 0),
      0,
    );
  let low = -0.99;
  let high = 10;
  if (npv(low) * npv(high) > 0) return null;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (npv(low) * npv(mid) <= 0) high = mid;
    else low = mid;
  }
  return Math.round(((low + high) / 2) * 10000) / 100;
}

/** Indian health and education cess on income tax. */
export const CESS = 0.04;
export const LONG_TERM_RATE = 12.5;

/** The tax rate on interest, cess included under Indian rules. */
export function effectiveSlab(slab: number, rules: TaxRules): number {
  return rules === "india" ? slab * (1 + CESS) : slab;
}

export const afterTax = (amount: number, ratePercent: number) =>
  Math.round(amount * (1 - ratePercent / 100));

export interface UpcomingPayout extends ExpectedFlow {
  investmentId: string;
  name: string;
}

/** Promised payouts of open investments after today and up to `horizon`, soonest first. */
export function upcomingPayouts(
  investments: readonly PlannedInvestment[],
  today: DateKey,
  horizon: DateKey,
): UpcomingPayout[] {
  const out: UpcomingPayout[] = [];
  for (const inv of investments) {
    if (inv.closedOn) continue;
    for (const flow of expectedFlows(inv))
      if (flow.dateKey > today && flow.dateKey <= horizon)
        out.push({ ...flow, investmentId: inv.id, name: inv.name });
  }
  return out.sort(
    (a, b) =>
      a.dateKey.localeCompare(b.dateKey) ||
      a.kind.localeCompare(b.kind) ||
      a.name.localeCompare(b.name),
  );
}

export interface TdsWarning {
  issuer: string;
  /** Interest for this tax year: recorded, or promised by the terms when that is more. */
  interest: number;
  limit: number;
}

/** Interest one payer can pay in a year before deducting TDS: banks ₹50,000, companies ₹10,000 (in paise). */
export const TDS_LIMITS = { bank: 5_000_000, company: 1_000_000 } as const;

/** Payers on track to pay more interest this tax year than the TDS limit. Indian rules only; government bonds have no TDS. */
export function tdsWarnings(
  investments: readonly PlannedInvestment[],
  payouts: readonly PayoutRow[],
  today: DateKey,
): TdsWarning[] {
  const year = taxYearRange(taxYearOf(today, 4), 4);
  const byIssuer = new Map<string, TdsWarning>();
  const add = (inv: InvestmentRow, amount: number) => {
    if (inv.type === "gsec" || inv.type === "tbill" || amount <= 0) return;
    const issuer = (inv.issuer || inv.name).trim();
    const key = `${inv.type === "fd" ? "bank" : "company"}:${issuer.toLowerCase()}`;
    const entry = byIssuer.get(key) ?? {
      issuer,
      interest: 0,
      limit: inv.type === "fd" ? TDS_LIMITS.bank : TDS_LIMITS.company,
    };
    entry.interest += amount;
    byIssuer.set(key, entry);
  };
  // Per investment, the larger of what was recorded and what the terms promise, so a late entry still counts.
  for (const inv of investments) {
    const recorded = payouts
      .filter(
        (p) =>
          p.investmentId === inv.id &&
          p.kind === "interest" &&
          p.dateKey >= year.from &&
          p.dateKey <= year.to,
      )
      .reduce((sum, p) => sum + p.gross, 0);
    const promised = expectedFlows(inv)
      .filter(
        (f) =>
          f.kind === "interest" &&
          f.dateKey >= year.from &&
          f.dateKey <= year.to,
      )
      .reduce((sum, f) => sum + f.amount, 0);
    add(inv, Math.max(recorded, inv.closedOn ? 0 : promised));
  }
  return [...byIssuer.values()]
    .filter((w) => w.interest > w.limit)
    .sort((a, b) => b.interest - a.interest);
}

/** Principal coming back per month for the next `months` months, keyed by each month's first day. */
export function maturityLadder(
  investments: readonly PlannedInvestment[],
  payouts: readonly PayoutRow[],
  today: DateKey,
  months: number,
): { months: { key: DateKey; amount: number }[]; later: number } {
  const first = `${today.slice(0, 7)}-01`;
  const keys = Array.from({ length: months }, (_, i) => addMonths(first, i));
  const sums = new Map(keys.map((k) => [k, 0]));
  let later = 0;
  const end = addDays(addMonths(first, months), -1);
  for (const inv of investments) {
    if (inv.closedOn || !inv.maturityDate) continue;
    const back = payoutTotals(
      payouts.filter((p) => p.investmentId === inv.id),
    ).principalBack;
    const amount = Math.max(0, redemptionOf(inv) - back);
    const month = `${inv.maturityDate.slice(0, 7)}-01`;
    // Overdue maturities count as this month: the money is due now.
    const key = month < first ? first : month;
    if (inv.maturityDate > end) later += amount;
    else sums.set(key, (sums.get(key) ?? 0) + amount);
  }
  return {
    months: keys.map((key) => ({ key, amount: sums.get(key) ?? 0 })),
    later,
  };
}

/** Interest received per month over the last `months` months, ending with the month of `today`. */
export function interestByMonth(
  payouts: readonly PayoutRow[],
  today: DateKey,
  months: number,
): { key: DateKey; amount: number }[] {
  const current = `${today.slice(0, 7)}-01`;
  const keys = Array.from({ length: months }, (_, i) =>
    addMonths(current, i - months + 1),
  );
  const sums = new Map(keys.map((k) => [k, 0]));
  for (const p of payouts) {
    if (p.kind !== "interest") continue;
    const key = `${p.dateKey.slice(0, 7)}-01`;
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + p.gross);
  }
  return keys.map((key) => ({ key, amount: sums.get(key) ?? 0 }));
}

/**
 * Tax on a year's interest and gains: interest and short-term or unlisted gains at the slab, Indian long-term
 * gains at 12.5% plus cess. Losses count as zero here; setting them off is left to the return.
 */
export function estimateTax(
  year: TaxYearSummary,
  rules: TaxRules,
  taxRate: number,
): number {
  const atSlab =
    year.interest +
    Math.max(0, year.gains.short) +
    Math.max(0, year.gains.unlisted) +
    Math.max(0, year.gains.gain);
  const longRate =
    rules === "india" ? effectiveSlab(LONG_TERM_RATE, rules) : taxRate;
  return Math.round(
    (atSlab * taxRate + Math.max(0, year.gains.long) * longRate) / 100,
  );
}
