import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { keyToLocalMs, type DateKey } from "@studio/dates";

import { transactions, type TransactionRow } from "../schema";
import type { Db } from "../types";
import { getAccount } from "./accounts";
import { getAllSettings } from "./settings";
import {
  createTransaction,
  restoreTransaction,
  updateTransaction,
  type TransactionInput,
  type TransactionSnapshot,
} from "./transactions";

/** Money leaving an account; each one can pull a top-up from the main account. */
const FUNDED_KINDS = ["expense", "lent", "repaid_by_me", "transfer"] as const;

const isFundedKind = (kind: string) =>
  (FUNDED_KINDS as readonly string[]).includes(kind);

function topUpOf(db: Db, paymentId: string): TransactionRow | undefined {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.fundsTransactionId, paymentId))
    .get();
}

/**
 * The account's balance just after `payment`, leaving out `payment`'s own top-up: transactions at
 * the same moment or earlier count, later ones do not.
 */
function balanceAfter(
  db: Db,
  payment: TransactionRow,
  topUpId?: string,
): number {
  const account = getAccount(db, payment.accountId);
  if (!account) return 0;
  const cutoff = or(
    sql`${transactions.occurredAt} < ${payment.occurredAt}`,
    and(
      eq(transactions.occurredAt, payment.occurredAt),
      sql`${transactions.createdAt} <= ${payment.createdAt}`,
    ),
  );
  const notTopUp = topUpId ? sql`${transactions.id} <> ${topUpId}` : sql`1 = 1`;
  const own =
    db
      .select({
        v: sql<number>`coalesce(sum(case when ${transactions.kind} in ('income', 'borrowed', 'repaid_to_me') then ${transactions.amount} else -${transactions.amount} end), 0)`,
      })
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), cutoff, notTopUp))
      .get()?.v ?? 0;
  const incoming =
    db
      .select({
        v: sql<number>`coalesce(sum(${transactions.transferAmount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.kind, "transfer"),
          eq(transactions.transferAccountId, account.id),
          cutoff,
          notTopUp,
        ),
      )
      .get()?.v ?? 0;
  return account.openingBalance + own + incoming;
}

/** The top-up this payment should have: from the main account, the full amount or only the shortfall. */
export function plannedTopUp(
  db: Db,
  payment: TransactionRow,
): { fromAccountId: string; amount: number } | null {
  if (payment.fundsTransactionId || payment.noFunding) return null;
  if (!isFundedKind(payment.kind)) return null;
  const settings = getAllSettings(db);
  const mainId = settings.funding_main_account_id;
  if (!mainId || mainId === payment.accountId) return null;
  if (!settings.funded_accounts.includes(payment.accountId)) return null;
  if (payment.kind === "transfer" && payment.transferAccountId === mainId)
    return null;
  const main = getAccount(db, mainId);
  const account = getAccount(db, payment.accountId);
  if (!main || !account || main.currency !== account.currency) return null;
  if (settings.funding_mode === "full")
    return { fromAccountId: main.id, amount: payment.amount };
  const short = -balanceAfter(db, payment, topUpOf(db, payment.id)?.id);
  const amount = Math.min(payment.amount, Math.max(0, short));
  return amount > 0 ? { fromAccountId: main.id, amount } : null;
}

/** Creates, updates or removes the payment's top-up so it matches the settings. */
export function syncFunding(db: Db, paymentId: string, now = Date.now()): void {
  db.transaction((tx) => {
    const payment = tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, paymentId))
      .get();
    if (!payment) return;
    const existing = topUpOf(tx, payment.id);
    const plan = plannedTopUp(tx, payment);
    if (!plan) {
      if (existing)
        tx.delete(transactions).where(eq(transactions.id, existing.id)).run();
      return;
    }
    const input = {
      kind: "transfer" as const,
      title: payment.title ? `Top up for ${payment.title}` : "Top up",
      amount: plan.amount,
      accountId: plan.fromAccountId,
      transferAccountId: payment.accountId,
      occurredAt: payment.occurredAt,
      fundsTransactionId: payment.id,
    };
    if (existing) updateTransaction(tx, existing.id, input, now);
    else createTransaction(tx, input, now);
  });
}

function paymentsBetween(
  db: Db,
  accountId: string,
  from: DateKey,
  to: DateKey,
): TransactionRow[] {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, accountId),
        inArray(transactions.kind, [...FUNDED_KINDS]),
        isNull(transactions.fundsTransactionId),
        gte(transactions.occurredAt, keyToLocalMs(from)),
        lte(transactions.occurredAt, keyToLocalMs(to, 23, 59) + 59_999),
      ),
    )
    .orderBy(asc(transactions.occurredAt), asc(transactions.createdAt))
    .all();
}

/** Earlier payments in the range that would get a top-up but have none yet. */
export function countMissingTopUps(
  db: Db,
  accountId: string,
  from: DateKey,
  to: DateKey,
): number {
  return paymentsBetween(db, accountId, from, to).filter(
    (p) => !topUpOf(db, p.id) && plannedTopUp(db, p) !== null,
  ).length;
}

/** Adds the missing top-ups for payments in the range, oldest first; returns how many were added. */
export function backfillTopUps(
  db: Db,
  accountId: string,
  from: DateKey,
  to: DateKey,
  now = Date.now(),
): number {
  return db.transaction((tx) => {
    let added = 0;
    for (const payment of paymentsBetween(tx, accountId, from, to)) {
      if (topUpOf(tx, payment.id)) continue;
      syncFunding(tx, payment.id, now);
      if (topUpOf(tx, payment.id)) added += 1;
    }
    return added;
  });
}

/** Tops up payments created at or after `since`, e.g. by a recurring rule or a settle-up. */
export function syncCreatedSince(
  db: Db,
  since: number,
  now = Date.now(),
): void {
  const settings = getAllSettings(db);
  if (
    !settings.funding_main_account_id ||
    settings.funded_accounts.length === 0
  )
    return;
  const rows = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        inArray(transactions.accountId, settings.funded_accounts),
        inArray(transactions.kind, [...FUNDED_KINDS]),
        isNull(transactions.fundsTransactionId),
        gte(transactions.createdAt, since),
      ),
    )
    .orderBy(asc(transactions.occurredAt), asc(transactions.createdAt))
    .all();
  for (const row of rows) syncFunding(db, row.id, now);
}

export function updateWithFunding(
  db: Db,
  id: string,
  input: TransactionInput,
  now = Date.now(),
): TransactionRow {
  const row = updateTransaction(db, id, input, now);
  syncFunding(db, row.id, now);
  return row;
}

export function restoreWithFunding(
  db: Db,
  snapshot: TransactionSnapshot,
): void {
  restoreTransaction(db, snapshot);
  syncFunding(db, snapshot.transaction.id);
}
