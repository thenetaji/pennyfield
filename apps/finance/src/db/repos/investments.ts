import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { keyToLocalMs, type DateKey } from "@studio/dates";
import { newId } from "@studio/data";

import {
  investmentStatus,
  payoutTotals,
  PAYOUT_KIND_LABELS,
  realisedGain,
  type InvestmentStatus,
  type PayoutTotals,
} from "@/lib/investments/tax";
import { ValidationError } from "../errors";
import {
  accounts,
  categories,
  investmentPayouts,
  investmentSchedule,
  investments,
  transactions,
  type AccountRow,
  type CategoryKind,
  type InvestmentPayoutSchedule,
  type InvestmentRow,
  type InvestmentType,
  type PayoutKind,
  type PayoutRow,
  type ScheduleRow,
} from "../schema";
import type { Db } from "../types";
import { createAccount, getAccount } from "./accounts";
import { createCategory } from "./categories";
import { getSetting, setSetting } from "./settings";
import { createTransaction } from "./transactions";

export interface InvestmentInput {
  name: string;
  type: InvestmentType;
  issuer?: string;
  platform?: string;
  reference?: string;
  rating?: string;
  listed?: boolean;
  /** Positive minor units. */
  amount: number;
  rate?: number | null;
  payout: InvestmentPayoutSchedule;
  buyDate: DateKey;
  maturityDate?: DateKey | null;
  closedOn?: DateKey | null;
  /** Account the money came from; null when it left before tracking began. */
  fromAccountId?: string | null;
  /** First interest date; later payouts repeat from it. */
  firstPayoutDate?: DateKey | null;
  /** Interest per payout as the issuer states it, minor units. */
  couponAmount?: number | null;
  /** What comes back at maturity, minor units. */
  redemptionAmount?: number | null;
  /** Bonds: units bought. */
  units?: number | null;
  /** Bonds: face value per unit, minor units. */
  faceValue?: number | null;
  /** Bonds: price paid per unit without accrued interest, minor units. */
  cleanPrice?: number | null;
  /** Bonds: accrued interest at purchase, minor units; positive was paid, negative was received. */
  accruedAtBuy?: number | null;
  note?: string;
}

export interface PayoutInput {
  kind: PayoutKind;
  dateKey: DateKey;
  /** Before tax withheld; positive minor units. */
  gross: number;
  tds?: number;
  /** Account the money arrived in; null keeps it out of balances. */
  accountId?: string | null;
  note?: string;
}

export interface InvestmentSummary {
  investment: InvestmentRow;
  totals: PayoutTotals;
  /** Gain or loss once closed; null while open or for a deposit. */
  gain: number | null;
  status: InvestmentStatus;
}

export interface InvestmentDetail extends InvestmentSummary {
  /** Newest first. */
  payouts: PayoutRow[];
}

const HOLDING_NAME = "Investments";
const INTEREST_CATEGORY = { name: "Interest", icon: "bank", color: "indigo" };
const GAIN_CATEGORY = {
  name: "Investments",
  icon: "chart.line.uptrend.xyaxis",
  color: "teal",
};
const LOSS_CATEGORY = {
  name: "Investment losses",
  icon: "arrow-down-right",
  color: "teal",
};

const noon = (key: DateKey) => keyToLocalMs(key, 12);
const clean = (value: string | undefined) => (value ?? "").trim();

function assertDate(key: string | null | undefined, field: string): void {
  if (key == null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key))
    throw new ValidationError("invalid_input", `${field} is not a date`);
}

function validateInvestment(input: InvestmentInput): void {
  if (clean(input.name) === "")
    throw new ValidationError("invalid_input", "name is required");
  if (!Number.isInteger(input.amount))
    throw new ValidationError("amount_not_integer");
  if (input.amount <= 0) throw new ValidationError("amount_not_positive");
  if (input.rate != null && (!Number.isFinite(input.rate) || input.rate < 0))
    throw new ValidationError("invalid_input", "rate must be zero or more");
  assertDate(input.buyDate, "buy date");
  assertDate(input.maturityDate, "maturity date");
  assertDate(input.closedOn, "closed date");
  if (input.maturityDate && input.maturityDate < input.buyDate)
    throw new ValidationError("invalid_input", "matures before it was bought");
  if (input.closedOn && input.closedOn < input.buyDate)
    throw new ValidationError("invalid_input", "closed before it was bought");
  assertDate(input.firstPayoutDate, "first payout date");
  if (input.firstPayoutDate && input.firstPayoutDate <= input.buyDate)
    throw new ValidationError("invalid_input", "first payout is before it was bought");
  for (const value of [input.couponAmount, input.redemptionAmount])
    if (value != null && (!Number.isInteger(value) || value <= 0))
      throw new ValidationError("amount_not_positive");
  if (input.units != null && !(Number.isFinite(input.units) && input.units > 0))
    throw new ValidationError("invalid_input", "units must be more than zero");
  for (const value of [input.faceValue, input.cleanPrice])
    if (value != null && (!Number.isInteger(value) || value <= 0))
      throw new ValidationError("amount_not_positive");
  if (input.accruedAtBuy != null && !Number.isInteger(input.accruedAtBuy))
    throw new ValidationError("amount_not_integer");
}

function validatePayout(input: PayoutInput): void {
  assertDate(input.dateKey, "date");
  const tds = input.tds ?? 0;
  if (!Number.isInteger(input.gross) || !Number.isInteger(tds))
    throw new ValidationError("amount_not_integer");
  if (input.gross <= 0) throw new ValidationError("amount_not_positive");
  if (tds < 0 || tds >= input.gross)
    throw new ValidationError(
      "invalid_input",
      "tax must be less than the amount",
    );
  if (input.kind !== "interest" && tds > 0)
    throw new ValidationError(
      "invalid_input",
      "tax is only withheld on interest",
    );
}

/** The account holding invested money, created on first use in `currency`. */
export function ensureHoldingAccount(db: Db, currency: string): AccountRow {
  const id = getSetting(db, "investments_account_id");
  const existing = id ? getAccount(db, id) : undefined;
  if (existing) return existing;
  const created = createAccount(db, {
    name: HOLDING_NAME,
    type: "other",
    currency,
    color: "teal",
    icon: "investments",
  });
  setSetting(db, "investments_account_id", created.id);
  return created;
}

/** Currency new investments use: the holding account's, else the display currency. */
export function investmentCurrency(db: Db): string {
  const id = getSetting(db, "investments_account_id");
  const holding = id ? getAccount(db, id) : undefined;
  return holding?.currency ?? getSetting(db, "display_currency");
}

function findOrCreateCategory(
  db: Db,
  kind: CategoryKind,
  spec: { name: string; icon: string; color: string },
): string {
  const found = db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.kind, kind),
        isNull(categories.archivedAt),
        sql`lower(${categories.name}) = ${spec.name.toLowerCase()}`,
      ),
    )
    .get();
  return found?.id ?? createCategory(db, { kind, ...spec }).id;
}

function payoutsOf(db: Db, investmentId: string): PayoutRow[] {
  return db
    .select()
    .from(investmentPayouts)
    .where(eq(investmentPayouts.investmentId, investmentId))
    .orderBy(desc(investmentPayouts.dateKey), desc(investmentPayouts.createdAt))
    .all();
}

function usableAccount(
  db: Db,
  id: string | null,
  currency: string,
): AccountRow | undefined {
  if (!id) return undefined;
  const account = getAccount(db, id);
  return account && account.currency === currency ? account : undefined;
}

/**
 * Rewrites the ledger entries for one investment: the purchase as a transfer into the holding account,
 * interest as income, principal as a transfer out, and on closing any gain or loss, so the holding
 * account's balance is what is still invested.
 */
function syncLedger(db: Db, investmentId: string, now: number): void {
  const inv = db
    .select()
    .from(investments)
    .where(eq(investments.id, investmentId))
    .get();
  if (!inv) return;
  const payouts = payoutsOf(db, inv.id);
  const stale = [
    inv.buyTransactionId,
    inv.closeTransactionId,
    ...payouts.map((p) => p.transactionId),
  ].filter((id): id is string => id !== null);
  if (stale.length > 0)
    db.delete(transactions).where(inArray(transactions.id, stale)).run();

  const holding = ensureHoldingAccount(db, inv.currency);
  const linked = holding.currency === inv.currency;

  const from = linked
    ? usableAccount(db, inv.fromAccountId, inv.currency)
    : undefined;
  const buy =
    from && from.id !== holding.id
      ? createTransaction(
          db,
          {
            kind: "transfer",
            title: `Bought ${inv.name}`,
            amount: inv.amount,
            accountId: from.id,
            transferAccountId: holding.id,
            occurredAt: noon(inv.buyDate),
          },
          now,
        )
      : undefined;

  let interestCategory: string | undefined;
  for (const p of payouts) {
    const to = linked
      ? usableAccount(db, p.accountId, inv.currency)
      : undefined;
    let txId: string | null = null;
    if (to && p.kind === "interest") {
      interestCategory ??= findOrCreateCategory(
        db,
        "income",
        INTEREST_CATEGORY,
      );
      txId = createTransaction(
        db,
        {
          kind: "income",
          title: `Interest, ${inv.name}`,
          amount: p.gross - p.tds,
          accountId: to.id,
          categoryId: interestCategory,
          occurredAt: noon(p.dateKey),
        },
        now,
      ).id;
    } else if (to && to.id !== holding.id) {
      txId = createTransaction(
        db,
        {
          kind: "transfer",
          title: `${PAYOUT_KIND_LABELS[p.kind]}, ${inv.name}`,
          amount: p.gross,
          accountId: holding.id,
          transferAccountId: to.id,
          occurredAt: noon(p.dateKey),
        },
        now,
      ).id;
    }
    if (txId !== p.transactionId)
      db.update(investmentPayouts)
        .set({ transactionId: txId })
        .where(eq(investmentPayouts.id, p.id))
        .run();
  }

  let close: string | null = null;
  const left = inv.amount - payoutTotals(payouts).principalBack;
  if (linked && inv.closedOn && left !== 0) {
    const gain = left < 0;
    close = createTransaction(
      db,
      {
        kind: gain ? "income" : "expense",
        title: `${gain ? "Gain" : "Loss"}, ${inv.name}`,
        amount: Math.abs(left),
        accountId: holding.id,
        categoryId: gain
          ? findOrCreateCategory(db, "income", GAIN_CATEGORY)
          : findOrCreateCategory(db, "expense", LOSS_CATEGORY),
        occurredAt: noon(inv.closedOn),
      },
      now,
    ).id;
  }
  db.update(investments)
    .set({ buyTransactionId: buy?.id ?? null, closeTransactionId: close })
    .where(eq(investments.id, inv.id))
    .run();
  syncHoldingOpening(db, holding);
}

/**
 * Money that was invested, or came back, without an account entry still belongs in the holding account:
 * its opening balance carries it so the balance matches what is invested.
 */
function syncHoldingOpening(db: Db, holding: AccountRow): void {
  const rows = db
    .select()
    .from(investments)
    .where(eq(investments.currency, holding.currency))
    .all();
  const payouts = rows.flatMap((inv) => payoutsOf(db, inv.id));
  const ids = [
    ...rows.map((inv) => inv.buyTransactionId),
    ...payouts.map((p) => p.transactionId),
  ].filter((id): id is string => id !== null);
  // An entry deleted from Activity no longer moves money, so the opening balance takes it back.
  const posted = new Set(
    ids.length === 0
      ? []
      : db
          .select({ id: transactions.id })
          .from(transactions)
          .where(inArray(transactions.id, ids))
          .all()
          .map((r) => r.id),
  );
  const isPosted = (id: string | null) => id !== null && posted.has(id);
  let opening = 0;
  for (const inv of rows)
    if (!isPosted(inv.buyTransactionId)) opening += inv.amount;
  for (const p of payouts)
    if (p.kind !== "interest" && !isPosted(p.transactionId)) opening -= p.gross;
  if (opening !== holding.openingBalance)
    db.update(accounts)
      .set({ openingBalance: opening, updatedAt: Date.now() })
      .where(eq(accounts.id, holding.id))
      .run();
}

function toRow(input: InvestmentInput) {
  return {
    name: clean(input.name),
    type: input.type,
    issuer: clean(input.issuer),
    platform: clean(input.platform),
    reference: clean(input.reference),
    rating: clean(input.rating),
    listed: input.listed ?? false,
    amount: input.amount,
    rate: input.rate ?? null,
    payout: input.payout,
    buyDate: input.buyDate,
    maturityDate: input.maturityDate ?? null,
    closedOn: input.closedOn ?? null,
    fromAccountId: input.fromAccountId ?? null,
    firstPayoutDate: input.firstPayoutDate ?? null,
    couponAmount: input.couponAmount ?? null,
    redemptionAmount: input.redemptionAmount ?? null,
    units: input.units ?? null,
    faceValue: input.faceValue ?? null,
    cleanPrice: input.cleanPrice ?? null,
    accruedAtBuy: input.accruedAtBuy ?? null,
    note: clean(input.note),
  };
}

export function getInvestment(db: Db, id: string): InvestmentRow | undefined {
  return db.select().from(investments).where(eq(investments.id, id)).get();
}

export function createInvestment(
  db: Db,
  input: InvestmentInput,
  now = Date.now(),
): InvestmentRow {
  validateInvestment(input);
  return db.transaction((tx) => {
    const row: InvestmentRow = {
      id: newId(),
      ...toRow(input),
      currency: investmentCurrency(tx),
      buyTransactionId: null,
      closeTransactionId: null,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(investments).values(row).run();
    syncLedger(tx, row.id, now);
    return getInvestment(tx, row.id) ?? row;
  });
}

export function updateInvestment(
  db: Db,
  id: string,
  input: InvestmentInput,
  now = Date.now(),
): InvestmentRow {
  validateInvestment(input);
  return db.transaction((tx) => {
    if (!getInvestment(tx, id)) throw new ValidationError("not_found");
    tx.update(investments)
      .set({ ...toRow(input), updatedAt: now })
      .where(eq(investments.id, id))
      .run();
    syncLedger(tx, id, now);
    const row = getInvestment(tx, id);
    if (!row) throw new ValidationError("not_found");
    return row;
  });
}

/** Removes the investment, its payouts and every account entry it made. */
export function deleteInvestment(db: Db, id: string): void {
  db.transaction((tx) => {
    const inv = getInvestment(tx, id);
    if (!inv) return;
    const ids = [
      inv.buyTransactionId,
      inv.closeTransactionId,
      ...payoutsOf(tx, id).map((p) => p.transactionId),
    ].filter((v): v is string => v !== null);
    if (ids.length > 0)
      tx.delete(transactions).where(inArray(transactions.id, ids)).run();
    tx.delete(investments).where(eq(investments.id, id)).run();
    const holdingId = getSetting(tx, "investments_account_id");
    const holding = holdingId ? getAccount(tx, holdingId) : undefined;
    if (holding) syncHoldingOpening(tx, holding);
  });
}

/** Records money coming back. Maturity or a sale also closes the investment on that date. */
export function addPayout(
  db: Db,
  investmentId: string,
  input: PayoutInput,
  now = Date.now(),
): PayoutRow {
  validatePayout(input);
  return db.transaction((tx) => {
    const inv = getInvestment(tx, investmentId);
    if (!inv) throw new ValidationError("not_found");
    const row: PayoutRow = {
      id: newId(),
      investmentId,
      kind: input.kind,
      dateKey: input.dateKey,
      gross: input.gross,
      tds: input.tds ?? 0,
      accountId: input.accountId ?? null,
      transactionId: null,
      note: clean(input.note),
      createdAt: now,
    };
    tx.insert(investmentPayouts).values(row).run();
    if (!inv.closedOn && (input.kind === "maturity" || input.kind === "sale"))
      tx.update(investments)
        .set({ closedOn: input.dateKey, updatedAt: now })
        .where(eq(investments.id, investmentId))
        .run();
    syncLedger(tx, investmentId, now);
    return getPayout(tx, row.id) ?? row;
  });
}

export function getPayout(db: Db, id: string): PayoutRow | undefined {
  return db
    .select()
    .from(investmentPayouts)
    .where(eq(investmentPayouts.id, id))
    .get();
}

export function updatePayout(
  db: Db,
  id: string,
  input: PayoutInput,
  now = Date.now(),
): PayoutRow {
  validatePayout(input);
  return db.transaction((tx) => {
    const existing = getPayout(tx, id);
    if (!existing) throw new ValidationError("not_found");
    tx.update(investmentPayouts)
      .set({
        kind: input.kind,
        dateKey: input.dateKey,
        gross: input.gross,
        tds: input.tds ?? 0,
        accountId: input.accountId ?? null,
        note: clean(input.note),
      })
      .where(eq(investmentPayouts.id, id))
      .run();
    syncLedger(tx, existing.investmentId, now);
    const row = getPayout(tx, id);
    if (!row) throw new ValidationError("not_found");
    return row;
  });
}

export function deletePayout(db: Db, id: string, now = Date.now()): void {
  db.transaction((tx) => {
    const existing = getPayout(tx, id);
    if (!existing) return;
    if (existing.transactionId)
      tx.delete(transactions)
        .where(eq(transactions.id, existing.transactionId))
        .run();
    tx.delete(investmentPayouts).where(eq(investmentPayouts.id, id)).run();
    syncLedger(tx, existing.investmentId, now);
  });
}

function summarize(
  inv: InvestmentRow,
  payouts: readonly PayoutRow[],
  today: DateKey,
): InvestmentSummary {
  const totals = payoutTotals(payouts);
  return {
    investment: inv,
    totals,
    gain: realisedGain(inv, totals),
    status: investmentStatus(inv, today),
  };
}

/** Open ones first by maturity (soonest first), then closed ones, most recently closed first. */
export function listInvestments(db: Db, today: DateKey): InvestmentSummary[] {
  const rows = db
    .select()
    .from(investments)
    .orderBy(asc(investments.maturityDate), asc(investments.createdAt))
    .all();
  const payouts = listAllPayouts(db);
  const byInvestment = new Map<string, PayoutRow[]>();
  for (const p of payouts)
    byInvestment.set(p.investmentId, [
      ...(byInvestment.get(p.investmentId) ?? []),
      p,
    ]);
  const out = rows.map((inv) =>
    summarize(inv, byInvestment.get(inv.id) ?? [], today),
  );
  const open = out.filter((s) => s.status !== "closed");
  const closed = out
    .filter((s) => s.status === "closed")
    .sort((a, b) =>
      (b.investment.closedOn ?? "").localeCompare(a.investment.closedOn ?? ""),
    );
  // Undated maturities sort first in SQL; they belong after the dated ones.
  open.sort(
    (a, b) =>
      Number(a.investment.maturityDate === null) -
      Number(b.investment.maturityDate === null),
  );
  return [...open, ...closed];
}

export function getInvestmentDetail(
  db: Db,
  id: string,
  today: DateKey,
): InvestmentDetail | undefined {
  const inv = getInvestment(db, id);
  if (!inv) return undefined;
  const payouts = payoutsOf(db, id);
  return { ...summarize(inv, payouts, today), payouts };
}

export function listAllPayouts(db: Db): PayoutRow[] {
  return db
    .select()
    .from(investmentPayouts)
    .orderBy(asc(investmentPayouts.dateKey), asc(investmentPayouts.createdAt))
    .all();
}

export function listAllInvestments(db: Db): InvestmentRow[] {
  return db.select().from(investments).all();
}

export interface ScheduleInput {
  dateKey: DateKey;
  kind: "interest" | "principal";
  /** Positive minor units. */
  amount: number;
}

export function listSchedule(db: Db, investmentId?: string): ScheduleRow[] {
  const query = db.select().from(investmentSchedule);
  return (
    investmentId
      ? query.where(eq(investmentSchedule.investmentId, investmentId))
      : query
  )
    .orderBy(asc(investmentSchedule.dateKey), asc(investmentSchedule.kind))
    .all();
}

/** Replaces the investment's schedule; an empty list goes back to the calculated one. */
export function setSchedule(
  db: Db,
  investmentId: string,
  rows: readonly ScheduleInput[],
): void {
  for (const row of rows) {
    assertDate(row.dateKey, "date");
    if (!Number.isInteger(row.amount) || row.amount <= 0)
      throw new ValidationError("amount_not_positive");
  }
  db.transaction((tx) => {
    if (!getInvestment(tx, investmentId)) throw new ValidationError("not_found");
    tx.delete(investmentSchedule)
      .where(eq(investmentSchedule.investmentId, investmentId))
      .run();
    if (rows.length > 0)
      tx.insert(investmentSchedule)
        .values(
          rows.map((row) => ({
            id: newId(),
            investmentId,
            dateKey: row.dateKey,
            kind: row.kind,
            amount: row.amount,
          })),
        )
        .run();
  });
}
