import type { FlowDatum } from "@studio/charts";

import { normalizeTitle } from "@/db/repos/titleMemory";
import { isTaxCategory } from "@/features/tags/model";

export interface BusinessItem {
  kind: string;
  title: string;
  amount: number;
  currency: string;
  dateKey: string;
  accountId: string;
  category: { id: string; name: string } | null;
  splits: readonly { amount: number; category: { id: string; name: string } }[];
}

export interface BusinessFilter {
  from: string;
  to: string;
  categoryId?: string | null;
  accountId?: string | null;
  /** Normalised title. */
  payee?: string | null;
}

type Convert = (minor: number, currency: string) => number;

const inCategory = (item: BusinessItem, id: string) =>
  item.category?.id === id || item.splits.some((l) => l.category.id === id);

export function filterItems<T extends BusinessItem>(
  items: readonly T[],
  f: BusinessFilter,
): T[] {
  return items.filter(
    (i) =>
      i.dateKey >= f.from &&
      i.dateKey <= f.to &&
      (!f.categoryId || inCategory(i, f.categoryId)) &&
      (!f.accountId || i.accountId === f.accountId) &&
      (!f.payee || normalizeTitle(i.title) === f.payee),
  );
}

const isTax = (item: BusinessItem) =>
  isTaxCategory(item.title) || isTaxCategory(item.category?.name ?? "");

/** Money in and out (income tax excluded) for each `YYYY-MM` in `months`, oldest first. */
export function monthlyFlow(
  items: readonly BusinessItem[],
  months: readonly string[],
  convert: Convert,
): FlowDatum[] {
  const rows = new Map<string, FlowDatum>(
    months.map((m) => [m, { key: m, income: 0, spent: 0 }]),
  );
  for (const item of items) {
    const row = rows.get(item.dateKey.slice(0, 7));
    if (!row) continue;
    const v = convert(item.amount, item.currency);
    if (item.kind === "income") row.income += v;
    else if (item.kind === "expense" && !isTax(item)) row.spent += v;
  }
  return [...rows.values()];
}

/** The `count` months ending with the one containing `today`, oldest first. */
export function lastMonths(today: string, count = 12): string[] {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export interface PayeeRow {
  /** Normalised title, the filter value. */
  key: string;
  name: string;
  amount: number;
  /** Share of this side's total (income) or of revenue (costs); null without revenue. */
  share: number | null;
  count: number;
}

/** Income or costs grouped by title, largest first. Costs are shared against revenue. */
export function byPayee(
  items: readonly BusinessItem[],
  kind: "income" | "expense",
  convert: Convert,
): PayeeRow[] {
  const rows = new Map<string, Omit<PayeeRow, "share">>();
  let revenue = 0;
  let total = 0;
  for (const item of items) {
    const v = convert(item.amount, item.currency);
    if (item.kind === "income") revenue += v;
    if (item.kind !== kind || (kind === "expense" && isTax(item))) continue;
    total += v;
    const name = item.title.trim() || item.category?.name || "No title";
    const key = normalizeTitle(name);
    const row = rows.get(key) ?? { key, name, amount: 0, count: 0 };
    row.amount += v;
    row.count += 1;
    rows.set(key, row);
  }
  const base = kind === "income" ? total : revenue;
  return [...rows.values()]
    .map((r) => ({ ...r, share: base > 0 ? r.amount / base : null }))
    .sort((a, b) => b.amount - a.amount);
}
