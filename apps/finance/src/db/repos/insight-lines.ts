import { and, between, eq, inArray } from "drizzle-orm";
import type { DetailedLine, InsightsScope } from "@/lib/insights";

import { transactionSplits, transactions } from "../schema";
import { clampToArchive, scopeConditions } from "./reports";
import { getSetting } from "./settings";
import type { Db } from "../types";

export interface RawAnalyzerLine {
  transactionId: string;
  title: string;
  accountId: string;
  categoryId: string | null;
  dateKey: string;
  occurredAt: number;
  amount: number;
  currency: string;
  recurringRuleId: string | null;
}

/** Like `spendLines`, plus the transaction id, title and account for merchant and account breakdowns. */
export function detailedLines(
  db: Db,
  range: { from: string; to: string },
  scope?: InsightsScope,
): DetailedLine[] {
  range = clampToArchive(range, getSetting(db, "archived_through"));
  const kinds = ["expense", "income"] as const;
  const columns = {
    transactionId: transactions.id,
    title: transactions.title,
    accountId: transactions.accountId,
    dateKey: transactions.dateKey,
    kind: transactions.kind,
    currency: transactions.currency,
  };
  const plain = db
    .select({
      ...columns,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        between(transactions.dateKey, range.from, range.to),
        inArray(transactions.kind, [...kinds]),
        eq(transactions.isSplit, false),
        ...scopeConditions(scope, transactions.categoryId),
      ),
    )
    .all();
  const split = db
    .select({
      ...columns,
      categoryId: transactionSplits.categoryId,
      amount: transactionSplits.amount,
    })
    .from(transactionSplits)
    .innerJoin(
      transactions,
      eq(transactionSplits.transactionId, transactions.id),
    )
    .where(
      and(
        between(transactions.dateKey, range.from, range.to),
        inArray(transactions.kind, [...kinds]),
        ...scopeConditions(scope, transactionSplits.categoryId),
      ),
    )
    .all();
  const lines: DetailedLine[] = [];
  for (const row of [...plain, ...split]) {
    if (row.kind !== "expense" && row.kind !== "income") continue;
    lines.push({ ...row, kind: row.kind });
  }
  return lines;
}

/** Expense lines (splits expanded) with the time and recurring link the spend analyzer reads. */
export function analyzerLines(
  db: Db,
  range: { from: string; to: string },
): RawAnalyzerLine[] {
  const columns = {
    transactionId: transactions.id,
    title: transactions.title,
    accountId: transactions.accountId,
    dateKey: transactions.dateKey,
    occurredAt: transactions.occurredAt,
    currency: transactions.currency,
    recurringRuleId: transactions.recurringRuleId,
  };
  const inRange = between(transactions.dateKey, range.from, range.to);
  const plain = db
    .select({
      ...columns,
      categoryId: transactions.categoryId,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        inRange,
        eq(transactions.kind, "expense"),
        eq(transactions.isSplit, false),
      ),
    )
    .all();
  const split = db
    .select({
      ...columns,
      categoryId: transactionSplits.categoryId,
      amount: transactionSplits.amount,
    })
    .from(transactionSplits)
    .innerJoin(
      transactions,
      eq(transactionSplits.transactionId, transactions.id),
    )
    .where(and(inRange, eq(transactions.kind, "expense")))
    .all();
  return [...plain, ...split];
}
