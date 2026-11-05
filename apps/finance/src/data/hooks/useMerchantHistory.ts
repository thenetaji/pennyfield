import { and, eq, ne } from "drizzle-orm";

import { transactions, type TransactionKind } from "@/db/schema";
import type { Db } from "@/db/types";
import { useLiveData } from "@/data/use-live-data";
import { normaliseTitle } from "@/lib/insights";

export interface MerchantPayment {
  id: string;
  amount: number;
  dateKey: string;
  occurredAt: number;
}

export interface MerchantHistory {
  /** Oldest first, same currency as the transaction. */
  payments: MerchantPayment[];
  /** 1-based position of the transaction among them. */
  position: number;
  average: number;
  total: number;
  firstDate: string;
}

export function merchantHistory(
  rows: readonly (MerchantPayment & { title: string; currency: string })[],
  target: { id: string; title: string; currency: string },
): MerchantHistory | null {
  const key = normaliseTitle(target.title);
  if (!key) return null;
  const payments = rows
    .filter((r) => r.currency === target.currency && normaliseTitle(r.title) === key)
    .sort((a, b) => a.occurredAt - b.occurredAt)
    .map(({ id, amount, dateKey, occurredAt }) => ({ id, amount, dateKey, occurredAt }));
  const position = payments.findIndex((p) => p.id === target.id) + 1;
  if (payments.length < 2 || position === 0) return null;
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  return {
    payments,
    position,
    total,
    average: Math.round(total / payments.length),
    firstDate: payments[0]?.dateKey ?? "",
  };
}

function read(db: Db, target: { id: string; title: string; currency: string; kind: TransactionKind }) {
  const rows = db
    .select({
      id: transactions.id,
      title: transactions.title,
      amount: transactions.amount,
      currency: transactions.currency,
      dateKey: transactions.dateKey,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(and(eq(transactions.kind, target.kind), ne(transactions.title, "")))
    .all();
  return merchantHistory(rows, target);
}

/** Every payment with the same merchant name (spellings combined), for the transaction detail screen. */
export function useMerchantHistory(
  target: { id: string; title: string; currency: string; kind: TransactionKind } | undefined,
): MerchantHistory | null {
  const key = target ? `${target.id}:${target.kind}:${target.currency}:${target.title}` : "";
  return useLiveData(["transactions"], key, (db) =>
    target && (target.kind === "expense" || target.kind === "income") ? read(db, target) : null,
  );
}
