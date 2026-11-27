import { and, desc, eq, sql } from "drizzle-orm";

import { normalizeTitle, suggest } from "@/db/repos/titleMemory";
import {
  titleMemory,
  transactions,
  type CategoryKind,
  type TitleMemoryRow,
} from "@/db/schema";
import { useLiveData } from "@/data/use-live-data";

export function useTitleSuggestions(
  text: string,
  kind: CategoryKind,
): TitleMemoryRow[] {
  return useLiveData(["title_memory"], `${kind}:${text}`, (db) =>
    suggest(db, text, kind),
  );
}

/** Every remembered payee, most used first, for reading a typed or spoken line. */
export function useTitleMemory(limit = 400): TitleMemoryRow[] {
  return useLiveData(["title_memory"], String(limit), (db) =>
    db
      .select()
      .from(titleMemory)
      .orderBy(desc(titleMemory.useCount), desc(titleMemory.lastUsedAt))
      .limit(limit)
      .all(),
  );
}

/** The amounts most often paid to this payee lately, most common first: tap one instead of typing. */
export function usePayeeAmounts(
  title: string,
  kind: CategoryKind,
  currency: string,
  limit = 3,
): number[] {
  const norm = normalizeTitle(title);
  return useLiveData(["transactions"], `${kind}:${currency}:${norm}`, (db) => {
    if (norm.length < 2) return [];
    const rows = db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(
        and(
          eq(transactions.kind, kind),
          eq(transactions.currency, currency),
          sql`lower(trim(${transactions.title})) = ${norm}`,
        ),
      )
      .orderBy(desc(transactions.occurredAt))
      .limit(30)
      .all();
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.amount, (counts.get(r.amount) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([amount]) => amount);
  });
}
