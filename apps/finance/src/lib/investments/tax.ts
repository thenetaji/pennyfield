import { diffDays, parseKey, type DateKey } from "@studio/dates";

import type {
  InvestmentRow,
  InvestmentType,
  PayoutKind,
  PayoutRow,
} from "@/db/schema";

/** "india": April–March years, TDS, and Indian capital gains classes. "general": one gains figure, any year start. */
export type TaxRules = "india" | "general";
export type TaxRulesSetting = "auto" | TaxRules;

export type GainClass = "none" | "short" | "long" | "unlisted" | "gain";

/** Held longer than this many days, a listed bond's gain is long term in India. */
export const LONG_TERM_DAYS = 365;
const DAYS_PER_MONTH = 30.4375;

export function resolveTaxRules(
  setting: TaxRulesSetting,
  displayCurrency: string,
): TaxRules {
  if (setting !== "auto") return setting;
  return displayCurrency.toUpperCase() === "INR" ? "india" : "general";
}

/** Month (1–12) the tax year starts in. India is fixed to April. */
export function taxYearStartMonth(rules: TaxRules, setting: number): number {
  if (rules === "india") return 4;
  return Number.isInteger(setting) && setting >= 1 && setting <= 12
    ? setting
    : 1;
}

/** The calendar year in which the tax year holding `key` begins. */
export function taxYearOf(key: DateKey, startMonth: number): number {
  const { year, month } = parseKey(key);
  return month >= startMonth ? year : year - 1;
}

/** "2026" for calendar years, "2026-27" otherwise. */
export function taxYearLabel(startYear: number, startMonth: number): string {
  if (startMonth === 1) return String(startYear);
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function taxYearRange(
  startYear: number,
  startMonth: number,
): { from: DateKey; to: DateKey } {
  const from = `${startYear}-${pad(startMonth)}-01`;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return { from, to: `${endYear}-${pad(endMonth)}-${pad(lastDay)}` };
}

/** The day the money is (or was) fully back: closed date, else maturity. */
export function endDate(
  inv: Pick<InvestmentRow, "closedOn" | "maturityDate">,
): DateKey | null {
  return inv.closedOn ?? inv.maturityDate;
}

export function monthsHeld(buyDate: DateKey, end: DateKey): number {
  return Math.round((diffDays(buyDate, end) / DAYS_PER_MONTH) * 10) / 10;
}

/** How a gain on this investment is taxed. Deposits only earn interest, so they never have a gain. */
export function gainClass(
  inv: Pick<
    InvestmentRow,
    "type" | "listed" | "buyDate" | "closedOn" | "maturityDate"
  >,
  rules: TaxRules,
): GainClass {
  if (inv.type === "fd") return "none";
  if (rules === "general") return "gain";
  if (!inv.listed) return "unlisted";
  const end = endDate(inv);
  if (!end) return "short";
  return diffDays(inv.buyDate, end) > LONG_TERM_DAYS ? "long" : "short";
}

export interface PayoutTotals {
  interest: number;
  tds: number;
  principalBack: number;
}

export function payoutTotals(
  payouts: readonly Pick<PayoutRow, "kind" | "gross" | "tds">[],
): PayoutTotals {
  let interest = 0;
  let tds = 0;
  let principalBack = 0;
  for (const p of payouts) {
    tds += p.tds;
    if (p.kind === "interest") interest += p.gross;
    else principalBack += p.gross;
  }
  return { interest, tds, principalBack };
}

/** Gain (positive) or loss once closed; null while open or for a deposit. */
export function realisedGain(
  inv: Pick<InvestmentRow, "type" | "amount" | "closedOn">,
  totals: PayoutTotals,
): number | null {
  if (!inv.closedOn || inv.type === "fd") return null;
  return totals.principalBack - inv.amount;
}

export interface TaxYearSummary {
  startYear: number;
  label: string;
  from: DateKey;
  to: DateKey;
  /** Gross interest received in the year. */
  interest: number;
  /** Tax withheld in the year, to claim as already paid. */
  tds: number;
  /** Gains (negative for losses) by how they are taxed; only "gain" is used under general rules. */
  gains: Record<Exclude<GainClass, "none">, number>;
  /** Number of payouts and closed investments counted. */
  items: number;
}

/** One summary per tax year with any interest, withheld tax or closed gain; newest first. */
export function summarizeTaxYears(
  investments: readonly InvestmentRow[],
  payouts: readonly PayoutRow[],
  rules: TaxRules,
  startMonth: number,
): TaxYearSummary[] {
  const years = new Map<number, TaxYearSummary>();
  const yearFor = (key: DateKey) => {
    const startYear = taxYearOf(key, startMonth);
    let entry = years.get(startYear);
    if (!entry) {
      entry = {
        startYear,
        label: taxYearLabel(startYear, startMonth),
        ...taxYearRange(startYear, startMonth),
        interest: 0,
        tds: 0,
        gains: { short: 0, long: 0, unlisted: 0, gain: 0 },
        items: 0,
      };
      years.set(startYear, entry);
    }
    return entry;
  };
  const byInvestment = new Map<string, PayoutRow[]>();
  for (const p of payouts) {
    const list = byInvestment.get(p.investmentId) ?? [];
    list.push(p);
    byInvestment.set(p.investmentId, list);
    if (p.kind !== "interest" && p.tds === 0) continue;
    const year = yearFor(p.dateKey);
    if (p.kind === "interest") year.interest += p.gross;
    year.tds += p.tds;
    year.items += 1;
  }
  for (const inv of investments) {
    const gain = realisedGain(
      inv,
      payoutTotals(byInvestment.get(inv.id) ?? []),
    );
    if (gain === null || gain === 0 || !inv.closedOn) continue;
    const cls = gainClass(inv, rules);
    if (cls === "none") continue;
    const year = yearFor(inv.closedOn);
    year.gains[cls] += gain;
    year.items += 1;
  }
  return [...years.values()].sort((a, b) => b.startYear - a.startYear);
}

export type InvestmentStatus = "open" | "due" | "closed";

/** "due": past maturity but not marked closed, so a payout is probably missing. */
export function investmentStatus(
  inv: Pick<InvestmentRow, "closedOn" | "maturityDate">,
  today: DateKey,
): InvestmentStatus {
  if (inv.closedOn) return "closed";
  if (inv.maturityDate && inv.maturityDate < today) return "due";
  return "open";
}

/** True when an open investment pays back after the date the money is needed. */
export function backAfter(
  inv: Pick<InvestmentRow, "closedOn" | "maturityDate">,
  needBy: DateKey | null,
): boolean {
  if (!needBy || inv.closedOn) return false;
  return !inv.maturityDate || inv.maturityDate > needBy;
}

export const TYPE_LABELS: Record<InvestmentType, string> = {
  fd: "Fixed deposit",
  bond: "Bond",
  gsec: "Government bond",
  tbill: "Treasury bill",
  other: "Other",
};

export const PAYOUT_KIND_LABELS: Record<PayoutKind, string> = {
  interest: "Interest",
  principal: "Part principal",
  maturity: "Maturity",
  sale: "Sale",
};
