import { desc, ne } from "drizzle-orm";

import { transactions } from "@/db/schema";
import type { Db } from "@/db/types";
import { useLiveData } from "@/data/use-live-data";
import { normaliseTitle } from "@/lib/insights";

const SCAN = 300;

/** Distinct earlier memos matching what is typed, those used with the same title first. */
export function rankMemos(
  rows: readonly { title: string; memo: string }[],
  title: string,
  typed: string,
  limit: number,
): string[] {
  const key = normaliseTitle(title);
  const needle = typed.trim().toLowerCase();
  const seen = new Set<string>();
  const same: string[] = [];
  const other: string[] = [];
  for (const row of rows) {
    const memo = row.memo.trim().replace(/\s+/g, " ");
    const lower = memo.toLowerCase();
    if (!memo || seen.has(lower) || lower === needle) continue;
    if (needle && !lower.includes(needle)) continue;
    seen.add(lower);
    (key && normaliseTitle(row.title) === key ? same : other).push(memo);
  }
  return [...same, ...other].slice(0, limit);
}

function read(db: Db, title: string, typed: string, limit: number) {
  const rows = db
    .select({ title: transactions.title, memo: transactions.memo })
    .from(transactions)
    .where(ne(transactions.memo, ""))
    .orderBy(desc(transactions.occurredAt))
    .limit(SCAN)
    .all();
  return rankMemos(rows, title, typed, limit);
}

export function useRecentMemos(title: string, typed: string, limit = 4): string[] {
  return useLiveData(["transactions"], `${title}\u0000${typed}`, (db) =>
    read(db, title, typed, limit),
  );
}
