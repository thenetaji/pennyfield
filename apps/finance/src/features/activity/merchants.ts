import type { TransactionListItem } from "@/data/hooks";
import { normaliseTitle } from "@/lib/insights";
import type { Payee } from "@/features/insights/payees-model";
import { tidyTitle } from "@/features/insights/payees-model";
import { convertWithRates, type RateLookup } from "@studio/money";

/**
 * The listed transactions of `kind` grouped by merchant (spellings combined), biggest first. Untitled ones have no
 * merchant but still count toward the total each share is taken from.
 */
export function merchantTotals(
  items: readonly TransactionListItem[],
  kind: "expense" | "income",
  ctx: { displayCurrency: string; rates: RateLookup },
): Payee[] {
  type Acc = {
    title: string;
    titleDate: string;
    amount: number;
    count: number;
    byCategory: Map<string | null, number>;
    lastDate: string;
  };
  const groups = new Map<string, Acc>();
  let total = 0;
  for (const item of items) {
    if (item.kind !== kind) continue;
    const amount = convertWithRates(
      item.amount,
      item.currency,
      ctx.displayCurrency,
      ctx.rates,
    );
    total += amount;
    const key = normaliseTitle(item.title);
    if (key === "") continue;
    const group = groups.get(key) ?? {
      title: tidyTitle(item.title),
      titleDate: item.dateKey,
      amount: 0,
      count: 0,
      byCategory: new Map(),
      lastDate: item.dateKey,
    };
    group.amount += amount;
    group.count += 1;
    const categoryId = item.categoryId ?? item.splits[0]?.categoryId ?? null;
    group.byCategory.set(
      categoryId,
      (group.byCategory.get(categoryId) ?? 0) + amount,
    );
    if (item.dateKey > group.titleDate) {
      group.title = tidyTitle(item.title);
      group.titleDate = item.dateKey;
    }
    if (item.dateKey > group.lastDate) group.lastDate = item.dateKey;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      let categoryId: string | null = null;
      let best = -1;
      for (const [id, amount] of g.byCategory)
        if (amount > best) {
          best = amount;
          categoryId = id;
        }
      return {
        key,
        title: g.title,
        amount: g.amount,
        count: g.count,
        average: Math.round(g.amount / g.count),
        percent: total > 0 ? Math.round((g.amount * 100) / total) : 0,
        categoryId,
        lastDate: g.lastDate,
      };
    })
    .sort(
      (a, b) =>
        b.amount - a.amount || b.count - a.count || a.key.localeCompare(b.key),
    );
}
