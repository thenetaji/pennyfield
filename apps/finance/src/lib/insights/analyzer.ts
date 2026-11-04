import {
  addDays,
  daysInMonth,
  diffDays,
  makeKey,
  parseKey,
  weekday,
  type DateKey,
  type Period,
} from "@studio/dates";

import { normaliseTitle } from "./extras";

/** One expense attributed to a category (a plain transaction or one split line), already in display currency. */
export interface AnalyzerLine {
  transactionId: string;
  title: string;
  accountId: string;
  categoryId: string | null;
  dateKey: DateKey;
  /** Local hour 0-23 the transaction was logged at. */
  hour: number;
  amount: number;
  recurringRuleId: string | null;
}

type Range = Pick<Period, "from" | "to">;

const within = (key: DateKey, range: Range) =>
  key >= range.from && key <= range.to;

const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? 0)
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

export interface Forecast {
  spent: number;
  /** Spending expected by the period's last day. */
  projected: number;
  /** Bills still due before the period ends, included in `projected`. */
  upcoming: number;
  /** Day-to-day spending per day the projection assumes for the rest of the period. */
  perDay: number;
  daysLeft: number;
}

/**
 * Month-end projection: what is spent, plus bills still due, plus the everyday pace for the days left. The everyday
 * pace leaves out recurring payments (already counted as bills) and blends towards last period's pace in the first
 * week, when a few days say little.
 */
export function forecast(
  lines: readonly AnalyzerLine[],
  period: Range,
  previous: Range,
  todayKey: DateKey,
  upcoming: number,
): Forecast | null {
  if (todayKey < period.from || todayKey > period.to) return null;
  const elapsed = diffDays(period.from, todayKey) + 1;
  const daysLeft = diffDays(todayKey, period.to);
  let spent = 0;
  let everyday = 0;
  let previousEveryday = 0;
  for (const line of lines) {
    if (within(line.dateKey, period) && line.dateKey <= todayKey) {
      spent += line.amount;
      if (!line.recurringRuleId) everyday += line.amount;
    } else if (within(line.dateKey, previous) && !line.recurringRuleId) {
      previousEveryday += line.amount;
    }
  }
  const previousDays = diffDays(previous.from, previous.to) + 1;
  const pace = everyday / elapsed;
  const previousPace = previousDays > 0 ? previousEveryday / previousDays : 0;
  const weight = previousEveryday > 0 ? Math.min(1, elapsed / 7) : 1;
  const perDay = Math.round(pace * weight + previousPace * (1 - weight));
  return {
    spent,
    projected: spent + upcoming + perDay * daysLeft,
    upcoming,
    perDay,
    daysLeft,
  };
}

export interface UnusualCategory {
  categoryId: string | null;
  amount: number;
  /** Average of the previous periods up to the same day. */
  usual: number;
  /** Whole percent above (positive) or below (negative) usual. */
  percent: number;
}

/**
 * Categories running well above (or below) their usual level: this period so far against the average of earlier
 * periods cut at the same day, so the 4th of the month is compared with the 4th. Small differences are left out so
 * a ₹40 coffee never makes the list.
 */
export function unusualCategories(
  lines: readonly AnalyzerLine[],
  period: Range,
  history: readonly Range[],
  todayKey: DateKey,
  { threshold = 0.35, minShare = 0.04 } = {},
): UnusualCategory[] {
  if (history.length === 0) return [];
  const offset = Math.min(
    diffDays(period.from, todayKey),
    diffDays(period.from, period.to),
  );
  const cut = (range: Range): Range => ({
    from: range.from,
    to:
      addDays(range.from, offset) < range.to
        ? addDays(range.from, offset)
        : range.to,
  });
  const current = new Map<string | null, number>();
  const past = new Map<string | null, number>();
  const now = cut(period);
  const before = history.map(cut);
  for (const line of lines) {
    if (within(line.dateKey, now))
      current.set(
        line.categoryId,
        (current.get(line.categoryId) ?? 0) + line.amount,
      );
    else if (before.some((r) => within(line.dateKey, r)))
      past.set(line.categoryId, (past.get(line.categoryId) ?? 0) + line.amount);
  }
  const usualTotal = sum(past.values()) / history.length;
  const floor = Math.max(usualTotal * minShare, 1);
  const out: UnusualCategory[] = [];
  for (const id of new Set([...current.keys(), ...past.keys()])) {
    const amount = current.get(id) ?? 0;
    const usual = Math.round((past.get(id) ?? 0) / history.length);
    if (usual <= 0 || Math.abs(amount - usual) < floor) continue;
    const ratio = (amount - usual) / usual;
    if (Math.abs(ratio) < threshold) continue;
    // Nothing yet, or a slow first week, is not news: "below usual" waits until a week of the period has passed.
    if (ratio < 0 && (amount === 0 || offset < 7)) continue;
    out.push({
      categoryId: id,
      amount,
      usual,
      percent: Math.round(ratio * 100),
    });
  }
  return out.sort(
    (a, b) => Math.abs(b.amount - b.usual) - Math.abs(a.amount - a.usual),
  );
}

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export const DAY_PARTS: readonly {
  part: DayPart;
  label: string;
  from: number;
  to: number;
}[] = [
  { part: "morning", label: "Morning", from: 5, to: 12 },
  { part: "afternoon", label: "Afternoon", from: 12, to: 17 },
  { part: "evening", label: "Evening", from: 17, to: 22 },
  { part: "night", label: "Night", from: 22, to: 29 },
];

export function dayPartOf(hour: number): DayPart {
  const h = hour < 5 ? hour + 24 : hour;
  return DAY_PARTS.find((p) => h >= p.from && h < p.to)?.part ?? "night";
}

export interface DayPartTotal {
  part: DayPart;
  amount: number;
  count: number;
  /** Whole-number share of the period's spending, 0-100. */
  percent: number;
}

export interface WeekdayShare {
  /** 1 = Monday ... 7 = Sunday. */
  weekday: number;
  amount: number;
  percent: number;
}

export interface Patterns {
  dayParts: DayPartTotal[];
  /** Monday first; callers reorder for the week start. */
  weekdays: WeekdayShare[];
  /** Spending per transaction (splits counted once). */
  average: number;
  median: number;
  count: number;
  /** Share of spending from the single largest transaction, 0-100. */
  largestShare: number;
}

export function patterns(
  lines: readonly AnalyzerLine[],
  period: Range,
): Patterns {
  const parts = new Map<DayPart, { amount: number; count: Set<string> }>();
  const perTransaction = new Map<string, number>();
  const days = new Map<number, number>();
  let total = 0;
  for (const line of lines) {
    if (!within(line.dateKey, period)) continue;
    total += line.amount;
    const day = weekday(line.dateKey);
    days.set(day, (days.get(day) ?? 0) + line.amount);
    const part = dayPartOf(line.hour);
    const slot = parts.get(part) ?? { amount: 0, count: new Set<string>() };
    slot.amount += line.amount;
    slot.count.add(line.transactionId);
    parts.set(part, slot);
    perTransaction.set(
      line.transactionId,
      (perTransaction.get(line.transactionId) ?? 0) + line.amount,
    );
  }
  const amounts = [...perTransaction.values()];
  const largest = amounts.length ? Math.max(...amounts) : 0;
  return {
    dayParts: DAY_PARTS.map(({ part }) => {
      const slot = parts.get(part);
      const amount = slot?.amount ?? 0;
      return {
        part,
        amount,
        count: slot?.count.size ?? 0,
        percent: total > 0 ? Math.round((amount * 100) / total) : 0,
      };
    }),
    weekdays: [1, 2, 3, 4, 5, 6, 7].map((day) => {
      const amount = days.get(day) ?? 0;
      return {
        weekday: day,
        amount,
        percent: total > 0 ? Math.round((amount * 100) / total) : 0,
      };
    }),
    average: amounts.length ? Math.round(total / amounts.length) : 0,
    median: median(amounts),
    count: amounts.length,
    largestShare: total > 0 ? Math.round((largest * 100) / total) : 0,
  };
}

export type RepeatCadence = "weekly" | "monthly";

export interface RepeatPayment {
  title: string;
  /** Typical amount (the median). */
  amount: number;
  cadence: RepeatCadence;
  count: number;
  lastDate: DateKey;
  nextDate: DateKey;
  categoryId: string | null;
  accountId: string;
  /** What it costs over a year at this cadence. */
  yearly: number;
}

interface RepeatCandidate {
  title: string;
  dateKey: DateKey;
  amount: number;
  categoryId: string | null;
  accountId: string;
  recurring: boolean;
}

const CADENCES: readonly {
  cadence: RepeatCadence;
  days: number;
  slack: number;
  perYear: number;
}[] = [
  { cadence: "weekly", days: 7, slack: 1, perYear: 52 },
  { cadence: "monthly", days: 30, slack: 4, perYear: 12 },
];

/**
 * Payments that come back on a rhythm (same payee, similar amount, weekly or monthly) but are not set up as
 * recurring yet. Needs three or more payments, and most of the gaps between them must fit the rhythm.
 */
export function repeatPayments(
  lines: readonly AnalyzerLine[],
  todayKey: DateKey,
  knownTitles: ReadonlySet<string> = new Set(),
): RepeatPayment[] {
  const byTransaction = new Map<string, RepeatCandidate>();
  for (const line of lines) {
    const entry = byTransaction.get(line.transactionId);
    if (entry) entry.amount += line.amount;
    else
      byTransaction.set(line.transactionId, {
        title: line.title,
        dateKey: line.dateKey,
        amount: line.amount,
        categoryId: line.categoryId,
        accountId: line.accountId,
        recurring: line.recurringRuleId !== null,
      });
  }
  const groups = new Map<string, RepeatCandidate[]>();
  for (const tx of byTransaction.values()) {
    const key = normaliseTitle(tx.title);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }
  const out: RepeatPayment[] = [];
  for (const [key, all] of groups) {
    if (knownTitles.has(key) || all.some((t) => t.recurring)) continue;
    const typical = median(all.map((t) => t.amount));
    const similar = all
      .filter((t) => Math.abs(t.amount - typical) <= typical * 0.15)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    if (similar.length < 3) continue;
    const gaps = similar
      .slice(1)
      .map((t, i) => diffDays(similar[i]?.dateKey ?? t.dateKey, t.dateKey));
    const gap = median(gaps);
    const fit = CADENCES.find((c) => Math.abs(gap - c.days) <= c.slack);
    if (!fit) continue;
    const regular = gaps.filter(
      (g) => Math.abs(g - fit.days) <= fit.slack * 2,
    ).length;
    if (regular < Math.ceil(gaps.length * 0.66)) continue;
    const last = similar[similar.length - 1];
    if (!last) continue;
    // A rhythm that stopped two cycles ago has probably ended.
    if (diffDays(last.dateKey, todayKey) > fit.days * 2 + fit.slack) continue;
    const amount = median(similar.map((t) => t.amount));
    const lastDay = parseKey(last.dateKey);
    out.push({
      title: last.title.trim(),
      amount,
      cadence: fit.cadence,
      count: similar.length,
      lastDate: last.dateKey,
      nextDate:
        fit.cadence === "monthly"
          ? nextMonthly(last.dateKey, lastDay.day)
          : addDays(last.dateKey, 7),
      categoryId: last.categoryId,
      accountId: last.accountId,
      yearly: amount * fit.perYear,
    });
  }
  return out.sort((a, b) => b.yearly - a.yearly);
}

function nextMonthly(from: DateKey, day: number): DateKey {
  const { year, month } = parseKey(from);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return makeKey(
    nextYear,
    nextMonth,
    Math.min(day, daysInMonth(nextYear, nextMonth)),
  );
}
