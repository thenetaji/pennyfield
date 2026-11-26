import { addDays, makeKey, type DateKey } from "@studio/dates";

import {
  convertLine,
  normaliseTitle,
  type ConversionContext,
  type DetailedLine,
  type FlatLine,
  type TitleTotal,
} from "@/lib/insights";

export interface MonthTotal {
  /** First day of the calendar month. */
  key: DateKey;
  /** 1-12. */
  month: number;
  spent: number;
  earned: number;
}

/** The year that starts in `year` on the 1st of `startMonth` (1 = calendar year, 4 = April-March financial year). */
export function yearPeriod(year: number, startMonth = 1): { from: DateKey; to: DateKey } {
  const next = makeKey(year + 1, startMonth, 1);
  return { from: makeKey(year, startMonth, 1), to: addDays(next, -1) };
}

/** "2025", or "FY 25-26" for a year that starts after January. */
export function yearName(year: number, startMonth = 1): string {
  if (startMonth === 1) return String(year);
  const yy = (n: number) => String(n % 100).padStart(2, "0");
  return `FY ${yy(year)}-${yy(year + 1)}`;
}

/** The start year of the year containing `today`. */
export function yearOf(today: DateKey, startMonth = 1): number {
  const y = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= startMonth ? y : y - 1;
}

/** Spending and earnings for each month of the year starting in `year`, its first month first. */
export function monthlyTotals(
  lines: readonly FlatLine[],
  year: number,
  ctx: ConversionContext,
  startMonth = 1,
): MonthTotal[] {
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = ((startMonth - 1 + i) % 12) + 1;
    const y = m < startMonth ? year + 1 : year;
    return { key: makeKey(y, m, 1), month: m, spent: 0, earned: 0 };
  });
  const index = new Map(months.map((m, i) => [m.key.slice(0, 7), i]));
  for (const line of lines) {
    const month = months[index.get(line.dateKey.slice(0, 7)) ?? -1];
    if (!month) continue;
    if (line.kind === "expense") month.spent += convertLine(line, ctx);
    else month.earned += convertLine(line, ctx);
  }
  return months;
}

/** Index of the month with the most spending (earliest on ties), or null when nothing was spent. */
export function biggestMonth(months: readonly MonthTotal[]): number | null {
  let best: number | null = null;
  months.forEach((m, i) => {
    if (m.spent > 0 && (best === null || m.spent > (months[best]?.spent ?? 0)))
      best = i;
  });
  return best;
}

/**
 * The title bought most often (distinct transactions), with ties broken by amount then name. Untitled entries
 * are skipped. `percent` is the share of all transactions of the kind in the range.
 */
export function mostFrequentTitle(
  lines: readonly DetailedLine[],
  kind: FlatLine["kind"],
  range: { from: DateKey; to: DateKey },
  ctx: ConversionContext,
): TitleTotal | null {
  type Acc = {
    title: string;
    amount: number;
    ids: Set<string>;
    categories: Map<string | null, number>;
  };
  const groups = new Map<string, Acc>();
  const all = new Set<string>();
  for (const line of lines) {
    if (
      line.kind !== kind ||
      line.dateKey < range.from ||
      line.dateKey > range.to
    )
      continue;
    all.add(line.transactionId);
    const key = normaliseTitle(line.title);
    if (key === "") continue;
    const amount = convertLine(line, ctx);
    const group = groups.get(key) ?? {
      title: line.title.trim().replace(/\s+/g, " "),
      amount: 0,
      ids: new Set<string>(),
      categories: new Map(),
    };
    group.amount += amount;
    group.ids.add(line.transactionId);
    group.categories.set(
      line.categoryId,
      (group.categories.get(line.categoryId) ?? 0) + amount,
    );
    groups.set(key, group);
  }
  let best: TitleTotal | null = null;
  for (const [key, g] of groups) {
    const candidate: TitleTotal = {
      key,
      title: g.title,
      amount: g.amount,
      count: g.ids.size,
      percent: all.size === 0 ? 0 : Math.round((g.ids.size * 100) / all.size),
      categoryId:
        [...g.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
    if (
      best === null ||
      candidate.count > best.count ||
      (candidate.count === best.count &&
        (candidate.amount > best.amount ||
          (candidate.amount === best.amount && candidate.key < best.key)))
    )
      best = candidate;
  }
  return best;
}

/** Distinct transactions of the given kinds in the range. */
export function entryCount(
  lines: readonly DetailedLine[],
  range: { from: DateKey; to: DateKey },
): number {
  const ids = new Set<string>();
  for (const line of lines)
    if (line.dateKey >= range.from && line.dateKey <= range.to)
      ids.add(line.transactionId);
  return ids.size;
}

/** The part of the year that has happened: up to today for the current year, the whole year otherwise. */
export function elapsedYear(
  year: number,
  today: DateKey,
  startMonth = 1,
): { from: DateKey; to: DateKey } | null {
  const { from, to } = yearPeriod(year, startMonth);
  if (today < from) return null;
  return { from, to: today < to ? today : to };
}

/** Week columns (seven slots each, `weekStart` first) covering the calendar year; slots outside the year are null. */
export function yearWeeks(
  year: number,
  weekStart: number,
  weekdayOf: (key: DateKey) => number,
): (DateKey | null)[][] {
  const { from, to } = yearPeriod(year);
  const lead = (((weekdayOf(from) - weekStart) % 7) + 7) % 7;
  const weeks: (DateKey | null)[][] = [];
  let week: (DateKey | null)[] = Array.from({ length: lead }, () => null);
  for (let key = from; key <= to; key = addDays(key, 1)) {
    week.push(key);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}
