import { monthShort, parseKey, type DateKey } from "@studio/dates";

import type { InvestmentPayoutSchedule, InvestmentType } from "@/db/schema";
import type { InvestmentSummary } from "@/db/repos/investments";
import { backAfter, type GainClass } from "@/lib/investments/tax";

/** "10 Apr 2027". */
export function dateLabel(key: DateKey): string {
  const { day, month, year } = parseKey(key);
  return `${day} ${monthShort(month)} ${year}`;
}

export const TYPES: readonly InvestmentType[] = [
  "fd",
  "bond",
  "gsec",
  "tbill",
  "other",
];

export const SCHEDULE_LABELS: Record<InvestmentPayoutSchedule, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Every 6 months",
  yearly: "Yearly",
  cumulative: "Cumulative",
  at_maturity: "At maturity",
};

export const SCHEDULES = Object.keys(
  SCHEDULE_LABELS,
) as InvestmentPayoutSchedule[];

export const GAIN_CLASS_LABELS: Record<GainClass, string> = {
  none: "Interest only",
  short: "Short term, slab rate",
  long: "Long term, 12.5%",
  unlisted: "Unlisted, slab rate",
  gain: "Capital gain",
};

/** "7.1%" without trailing zeros. */
export function rateLabel(rate: number | null): string | undefined {
  if (rate === null) return undefined;
  return `${Number(rate.toFixed(3))}%`;
}

/** Parses "7.25" or "7,25"; empty is null, anything else is NaN. */
export function parseRate(text: string): number | null {
  const clean = text.trim().replace(",", ".").replace(/%$/, "");
  if (clean === "") return null;
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : Number.NaN;
}

/** The second line of an investment row: when it pays back, and what needs attention. */
export function investmentLine(
  s: InvestmentSummary,
  needBy: string | null,
): string {
  const inv = s.investment;
  if (s.status === "closed" && inv.closedOn)
    return `Closed ${dateLabel(inv.closedOn)}`;
  if (s.status === "due") return "Matured, add the payout";
  const parts = [
    inv.maturityDate
      ? `Matures ${dateLabel(inv.maturityDate)}`
      : "No maturity date",
    rateLabel(inv.rate),
  ];
  if (backAfter(inv, needBy) && needBy) parts.push("after you need it");
  return parts.filter(Boolean).join(" · ");
}
