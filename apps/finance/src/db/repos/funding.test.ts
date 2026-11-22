/** @jest-environment node */
import { eq } from "drizzle-orm";

import { transactions } from "../schema";
import { at, categoryId, createTestDb, makeAccounts } from "../test-helpers";
import { createAccount, getAccountBalance } from "./accounts";
import { exportBackup, restoreBackup } from "./backup";
import {
  backfillTopUps,
  countMissingTopUps,
  restoreWithFunding,
  syncCreatedSince,
  syncFunding,
  updateWithFunding,
} from "./funding";
import { setSetting } from "./settings";
import {
  createTransaction,
  deleteTransaction,
  type TransactionInput,
} from "./transactions";

function setup(mode: "full" | "shortfall" = "full") {
  const db = createTestDb();
  const { bank, cash } = makeAccounts(db);
  const food = createAccount(db, {
    name: "Food wallet",
    type: "other",
    currency: "INR",
    color: "green",
  });
  setSetting(db, "funding_main_account_id", bank.id);
  setSetting(db, "funded_accounts", [food.id]);
  setSetting(db, "funding_mode", mode);
  const spend = (amount: number, patch: Partial<TransactionInput> = {}) => {
    const row = createTransaction(db, {
      kind: "expense",
      title: "Lunch",
      amount,
      accountId: food.id,
      categoryId: categoryId(db, "Groceries"),
      occurredAt: at("2026-11-20"),
      ...patch,
    });
    syncFunding(db, row.id);
    return row;
  };
  return { db, bank, cash, food, spend };
}

const topUps = (db: ReturnType<typeof createTestDb>) =>
  db
    .select()
    .from(transactions)
    .all()
    .filter((t) => t.fundsTransactionId !== null);

describe("automatic top-ups", () => {
  it("moves the payment's amount from the main account first", () => {
    const { db, bank, food, spend } = setup();
    const lunch = spend(45_000);
    const [topUp] = topUps(db);
    expect(topUp).toMatchObject({
      kind: "transfer",
      accountId: bank.id,
      transferAccountId: food.id,
      amount: 45_000,
      fundsTransactionId: lunch.id,
      title: "Top up for Lunch",
    });
    expect(getAccountBalance(db, food.id)).toBe(0);
    expect(getAccountBalance(db, bank.id)).toBe(5_000_000 - 45_000);
  });

  it("follows edits and goes away with the payment", () => {
    const { db, food, spend } = setup();
    const lunch = spend(45_000);
    updateWithFunding(db, lunch.id, {
      kind: "expense",
      amount: 60_000,
      accountId: food.id,
      categoryId: categoryId(db, "Groceries"),
      occurredAt: at("2026-11-21"),
    });
    expect(topUps(db)).toHaveLength(1);
    expect(topUps(db)[0]?.amount).toBe(60_000);
    expect(topUps(db)[0]?.dateKey).toBe("2026-11-21");

    const snapshot = deleteTransaction(db, lunch.id);
    expect(topUps(db)).toHaveLength(0);
    restoreWithFunding(db, snapshot ?? (undefined as never));
    expect(topUps(db)).toHaveLength(1);
  });

  it("is skipped once when asked, and removed when the account moves", () => {
    const { db, cash, food, spend } = setup();
    spend(45_000, { noFunding: true });
    expect(topUps(db)).toHaveLength(0);
    const lunch = spend(10_000);
    updateWithFunding(db, lunch.id, {
      kind: "expense",
      amount: 10_000,
      accountId: cash.id,
      categoryId: categoryId(db, "Groceries"),
      occurredAt: at("2026-11-20"),
    });
    expect(topUps(db)).toHaveLength(0);
    expect(getAccountBalance(db, food.id)).toBe(-45_000);
  });

  it("only covers the shortfall in that mode", () => {
    const { db, bank, food, spend } = setup("shortfall");
    createTransaction(db, {
      kind: "transfer",
      amount: 30_000,
      accountId: bank.id,
      transferAccountId: food.id,
      occurredAt: at("2026-11-01"),
    });
    spend(20_000);
    expect(topUps(db)).toHaveLength(0);
    spend(25_000);
    expect(topUps(db)[0]?.amount).toBe(15_000);
    expect(getAccountBalance(db, food.id)).toBe(0);
  });

  it("funds money out of any kind but not transfers back to the main account", () => {
    const { db, bank, food } = setup();
    const back = createTransaction(db, {
      kind: "transfer",
      amount: 5_000,
      accountId: food.id,
      transferAccountId: bank.id,
      occurredAt: at("2026-11-20"),
    });
    syncFunding(db, back.id);
    expect(topUps(db)).toHaveLength(0);
    const since = Date.now();
    createTransaction(db, {
      kind: "income",
      amount: 5_000,
      accountId: food.id,
      categoryId: categoryId(db, "Salary"),
      occurredAt: at("2026-11-20"),
    });
    syncCreatedSince(db, since);
    expect(topUps(db)).toHaveLength(0);
  });

  it("backfills earlier payments in a range", () => {
    const { db, food } = setup();
    setSetting(db, "funded_accounts", []);
    for (const day of ["2026-11-02", "2026-11-10", "2026-10-30"])
      createTransaction(db, {
        kind: "expense",
        amount: 1_000,
        accountId: food.id,
        categoryId: categoryId(db, "Groceries"),
        occurredAt: at(day),
      });
    setSetting(db, "funded_accounts", [food.id]);
    expect(countMissingTopUps(db, food.id, "2026-11-01", "2026-11-30")).toBe(2);
    expect(backfillTopUps(db, food.id, "2026-11-01", "2026-11-30")).toBe(2);
    expect(countMissingTopUps(db, food.id, "2026-11-01", "2026-11-30")).toBe(0);
  });

  it("restores a backup whatever order the top-ups come in", () => {
    const { db, spend } = setup();
    spend(1_000);
    spend(2_000);
    const backup = exportBackup(db, { now: 1, appVersion: "t" });
    backup.tables.transactions?.reverse();
    const fresh = createTestDb();
    restoreBackup(fresh, backup);
    expect(topUps(fresh)).toHaveLength(2);
    const payment = fresh
      .select()
      .from(transactions)
      .where(eq(transactions.kind, "expense"))
      .all();
    expect(payment).toHaveLength(2);
  });
});
