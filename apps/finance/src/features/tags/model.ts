import { categoryKeys, withAlpha, type CategoryColorKey } from "@studio/theme";

/** Colours a new tag can take; gray is left for categories. */
export const TAG_COLORS: readonly CategoryColorKey[] = categoryKeys.filter(
  (key) => key !== "gray" && key !== "brown",
);

export const isTagColor = (value: string): value is CategoryColorKey =>
  (categoryKeys as readonly string[]).includes(value);

/** Palette key for a stored tag colour; unknown values read as gray. */
export const tagColorKey = (value: string): CategoryColorKey =>
  isTagColor(value) ? value : "gray";

/** Pill colours from a resolved palette hex: text and dot in the colour, a soft tint behind. */
export function tagPillColors(hex: string): {
  fg: string;
  bg: string;
  ring: string;
} {
  return { fg: hex, bg: withAlpha(hex, 0.16), ring: withAlpha(hex, 0.45) };
}

/** First palette colour no existing tag uses, then cycling. */
export function nextTagColor(
  existing: readonly { color: string }[],
): CategoryColorKey {
  const used = new Set(existing.map((t) => t.color));
  return (
    TAG_COLORS.find((c) => !used.has(c)) ??
    TAG_COLORS[existing.length % TAG_COLORS.length] ??
    "blue"
  );
}

/** Case-insensitive match for the create row: true when `query` is non-empty and no tag has that exact name. */
export function canCreateTag(
  query: string,
  tags: readonly { name: string }[],
): boolean {
  const clean = query.trim().replace(/\s+/g, " ").toLowerCase();
  return clean !== "" && !tags.some((t) => t.name.toLowerCase() === clean);
}

export const matchesQuery = (name: string, query: string): boolean =>
  name.toLowerCase().includes(query.trim().toLowerCase());

export interface BreakdownRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  /** 0-1 of the largest row, for bar length. */
  share: number;
}

interface BreakdownItem {
  kind: string;
  amount: number;
  currency: string;
  category: { id: string; name: string; color: string; icon: string } | null;
  splits: readonly {
    amount: number;
    category: { id: string; name: string; color: string; icon: string };
  }[];
}

/** Expense spend per category in the display currency, biggest first; split lines count under their own category. */
export function categoryBreakdown(
  items: readonly BreakdownItem[],
  convert: (minor: number, currency: string) => number,
): BreakdownRow[] {
  const byCategory = new Map<string, Omit<BreakdownRow, "share">>();
  const add = (
    category: { id: string; name: string; color: string; icon: string },
    minor: number,
    currency: string,
  ) => {
    const row = byCategory.get(category.id) ?? {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      amount: 0,
    };
    row.amount += convert(minor, currency);
    byCategory.set(category.id, row);
  };
  for (const item of items) {
    if (item.kind !== "expense") continue;
    if (item.splits.length > 1)
      for (const line of item.splits)
        add(line.category, line.amount, item.currency);
    else if (item.category) add(item.category, item.amount, item.currency);
  }
  const rows = [...byCategory.values()].sort(
    (a, b) => b.amount - a.amount || a.name.localeCompare(b.name),
  );
  const top = rows[0]?.amount ?? 0;
  return rows.map((row) => ({ ...row, share: top > 0 ? row.amount / top : 0 }));
}

/** Expenses whose category or title has one of these names count as income tax: kept out of costs and taken off after profit. */
const TAX_CATEGORY = /^(income\s+)?tax(es)?$/i;

export const isTaxCategory = (name: string): boolean =>
  TAX_CATEGORY.test(name.trim());

interface ProfitItem extends BreakdownItem {
  dateKey: string;
  title?: string;
}

export interface ProfitMonth {
  /** `YYYY-MM`. */
  month: string;
  revenue: number;
  costs: number;
  profit: number;
}

export interface ProfitSummary {
  revenue: number;
  /** Expenses other than income tax. */
  costs: number;
  tax: number;
  profit: number;
  afterTax: number;
  /** Profit / revenue; null without revenue. */
  margin: number | null;
  /** Profit / costs; null without costs. */
  roi: number | null;
  /** Newest first. */
  months: ProfitMonth[];
}

/** Revenue, costs and profit for a tag's income and expenses, in the display currency. */
export function profitSummary(
  items: readonly ProfitItem[],
  convert: (minor: number, currency: string) => number,
): ProfitSummary {
  let revenue = 0;
  let costs = 0;
  let tax = 0;
  const months = new Map<string, ProfitMonth>();
  const month = (key: string) => {
    const id = key.slice(0, 7);
    const row = months.get(id) ?? {
      month: id,
      revenue: 0,
      costs: 0,
      profit: 0,
    };
    months.set(id, row);
    return row;
  };
  for (const item of items) {
    if (item.kind === "income") {
      const v = convert(item.amount, item.currency);
      revenue += v;
      month(item.dateKey).revenue += v;
      continue;
    }
    if (item.kind !== "expense") continue;
    const lines =
      item.splits.length > 1
        ? item.splits.map((l) => ({ amount: l.amount, name: l.category.name }))
        : [{ amount: item.amount, name: item.category?.name ?? "" }];
    const taxTitle = isTaxCategory(item.title ?? "");
    for (const line of lines) {
      const v = convert(line.amount, item.currency);
      if (taxTitle || isTaxCategory(line.name)) tax += v;
      else {
        costs += v;
        month(item.dateKey).costs += v;
      }
    }
  }
  const profit = revenue - costs;
  return {
    revenue,
    costs,
    tax,
    profit,
    afterTax: profit - tax,
    margin: revenue > 0 ? profit / revenue : null,
    roi: costs > 0 ? profit / costs : null,
    months: [...months.values()]
      .map((m) => ({ ...m, profit: m.revenue - m.costs }))
      .sort((a, b) => b.month.localeCompare(a.month)),
  };
}
