import { normaliseTitle } from "./extras";
import { addDays, type DateKey } from "@studio/dates";

export type PriceRise = {
  title: string;
  /** What it usually cost before. */
  from: number;
  to: number;
  percent: number;
  dateKey: DateKey;
};

const MIN_RISE_PERCENT = 5;
const RECENT_DAYS = 45;
/** Earlier payments must agree this closely for "usual price" to mean anything. */
const STEADY_WITHIN = 0.04;
const MIN_EARLIER = 2;

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** Steady payments whose latest amount went up: a subscription quietly raising its price. */
export function priceRises(
  lines: readonly { transactionId: string; title: string; dateKey: DateKey; amount: number }[],
  today: DateKey,
): PriceRise[] {
  const totals = new Map<string, { title: string; dateKey: DateKey; amount: number }>();
  for (const line of lines) {
    const entry = totals.get(line.transactionId);
    if (entry) entry.amount += line.amount;
    else totals.set(line.transactionId, { title: line.title, dateKey: line.dateKey, amount: line.amount });
  }
  const byTitle = new Map<string, { title: string; dateKey: DateKey; amount: number }[]>();
  for (const payment of totals.values()) {
    const key = normaliseTitle(payment.title);
    if (!key) continue;
    byTitle.set(key, [...(byTitle.get(key) ?? []), payment]);
  }
  const earliestRecent = addDays(today, -RECENT_DAYS);
  const rises: PriceRise[] = [];
  for (const payments of byTitle.values()) {
    const ordered = [...payments].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const latest = ordered[ordered.length - 1];
    const earlier = ordered.slice(0, -1).slice(-6);
    if (!latest || earlier.length < MIN_EARLIER || latest.dateKey < earliestRecent) continue;
    const usual = median(earlier.map((p) => p.amount));
    if (usual <= 0 || earlier.some((p) => Math.abs(p.amount - usual) > usual * STEADY_WITHIN)) continue;
    const percent = Math.round(((latest.amount - usual) * 100) / usual);
    if (percent < MIN_RISE_PERCENT) continue;
    rises.push({ title: latest.title, from: usual, to: latest.amount, percent, dateKey: latest.dateKey });
  }
  return rises.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
