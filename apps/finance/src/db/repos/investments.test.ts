/** @jest-environment node */
import { eq } from "drizzle-orm";

import { transactions } from "../schema";
import { createTestDb, makeAccounts } from "../test-helpers";
import { deleteAccount, getAccountBalance } from "./accounts";
import { exportBackup, restoreBackup } from "./backup";
import {
  addPayout,
  createInvestment,
  deleteInvestment,
  deletePayout,
  getInvestmentDetail,
  listInvestments,
  updateInvestment,
  updatePayout,
  type InvestmentInput,
} from "./investments";
import { getSetting, setSetting } from "./settings";
import { deleteTransaction } from "./transactions";

const FD: InvestmentInput = {
  name: "SBI FD",
  type: "fd",
  amount: 10_000_000,
  rate: 7.1,
  payout: "quarterly",
  buyDate: "2026-04-10",
  maturityDate: "2027-04-10",
};

function setup() {
  const db = createTestDb();
  setSetting(db, "display_currency", "INR");
  const { bank, cash } = makeAccounts(db);
  return { db, bank, cash };
}

const holdingBalance = (db: ReturnType<typeof createTestDb>) =>
  getAccountBalance(db, getSetting(db, "investments_account_id") ?? "");

const entries = (db: ReturnType<typeof createTestDb>) =>
  db.select().from(transactions).all();

describe("investments ledger", () => {
  it("moves the money from the bank into the Investments account", () => {
    const { db, bank } = setup();
    createInvestment(db, { ...FD, fromAccountId: bank.id });
    expect(getAccountBalance(db, bank.id)).toBe(5_000_000 - 10_000_000);
    expect(holdingBalance(db)).toBe(10_000_000);
    expect(entries(db)).toHaveLength(1);
  });

  it("counts money invested before tracking without touching other accounts", () => {
    const { db, bank } = setup();
    createInvestment(db, FD);
    expect(getAccountBalance(db, bank.id)).toBe(5_000_000);
    expect(holdingBalance(db)).toBe(10_000_000);
    expect(entries(db)).toHaveLength(0);
  });

  it("posts interest net of tax withheld as income", () => {
    const { db, bank } = setup();
    const inv = createInvestment(db, { ...FD, fromAccountId: bank.id });
    addPayout(db, inv.id, {
      kind: "interest",
      dateKey: "2026-07-10",
      gross: 177_000,
      tds: 17_700,
      accountId: bank.id,
    });
    const income = entries(db).find((t) => t.kind === "income");
    expect(income?.amount).toBe(159_300);
    expect(income?.title).toBe("Interest, SBI FD");
    expect(holdingBalance(db)).toBe(10_000_000);
  });

  it("closes on maturity and empties the Investments account", () => {
    const { db, bank } = setup();
    const inv = createInvestment(db, { ...FD, fromAccountId: bank.id });
    addPayout(db, inv.id, {
      kind: "maturity",
      dateKey: "2027-04-10",
      gross: 10_000_000,
      accountId: bank.id,
    });
    const detail = getInvestmentDetail(db, inv.id, "2027-04-11");
    expect(detail?.investment.closedOn).toBe("2027-04-10");
    expect(detail?.status).toBe("closed");
    expect(holdingBalance(db)).toBe(0);
    expect(getAccountBalance(db, bank.id)).toBe(5_000_000);
  });

  it("books a bond's discount as a gain when it closes", () => {
    const { db, bank } = setup();
    const inv = createInvestment(db, {
      ...FD,
      name: "NHAI bond",
      type: "bond",
      listed: true,
      amount: 9_800_000,
      fromAccountId: bank.id,
    });
    addPayout(db, inv.id, {
      kind: "maturity",
      dateKey: "2027-04-10",
      gross: 10_000_000,
      accountId: bank.id,
    });
    expect(holdingBalance(db)).toBe(0);
    const detail = getInvestmentDetail(db, inv.id, "2027-05-01");
    expect(detail?.gain).toBe(200_000);
    const gain = entries(db).find((t) => t.kind === "income");
    expect(gain?.title).toBe("Gain, NHAI bond");
    expect(gain?.amount).toBe(200_000);
  });

  it("keeps money that came back outside the accounts out of balances", () => {
    const { db, bank } = setup();
    const inv = createInvestment(db, { ...FD, fromAccountId: bank.id });
    addPayout(db, inv.id, {
      kind: "principal",
      dateKey: "2026-10-10",
      gross: 4_000_000,
      accountId: null,
    });
    expect(holdingBalance(db)).toBe(6_000_000);
    expect(getAccountBalance(db, bank.id)).toBe(5_000_000 - 10_000_000);
  });

  it("rewrites its entries on edit and removes them on delete", () => {
    const { db, bank, cash } = setup();
    const inv = createInvestment(db, { ...FD, fromAccountId: bank.id });
    const payout = addPayout(db, inv.id, {
      kind: "interest",
      dateKey: "2026-07-10",
      gross: 177_000,
      accountId: bank.id,
    });
    updateInvestment(db, inv.id, {
      ...FD,
      amount: 20_000_000,
      fromAccountId: cash.id,
    });
    updatePayout(db, payout.id, {
      kind: "interest",
      dateKey: "2026-07-10",
      gross: 200_000,
      accountId: cash.id,
    });
    expect(getAccountBalance(db, bank.id)).toBe(5_000_000);
    expect(getAccountBalance(db, cash.id)).toBe(100_000 - 20_000_000 + 200_000);
    expect(entries(db)).toHaveLength(2);

    deletePayout(db, payout.id);
    expect(entries(db)).toHaveLength(1);
    deleteInvestment(db, inv.id);
    expect(entries(db)).toHaveLength(0);
    expect(holdingBalance(db)).toBe(0);
    expect(getAccountBalance(db, cash.id)).toBe(100_000);
  });

  it("keeps the Investments balance right when an entry is deleted from Activity", () => {
    const { db, bank } = setup();
    const inv = createInvestment(db, { ...FD, fromAccountId: bank.id });
    const buyId = getInvestmentDetail(db, inv.id, "2026-05-01")?.investment
      .buyTransactionId;
    deleteTransaction(db, buyId ?? "");
    addPayout(db, inv.id, {
      kind: "interest",
      dateKey: "2026-07-10",
      gross: 1_000,
    });
    expect(holdingBalance(db)).toBe(10_000_000);
  });

  it("follows an account that is deleted into another", () => {
    const { db, bank, cash } = setup();
    const inv = createInvestment(db, { ...FD, fromAccountId: cash.id });
    deleteAccount(db, cash.id, bank.id);
    const moved = getInvestmentDetail(db, inv.id, "2026-05-01")?.investment;
    expect(moved?.fromAccountId).toBe(bank.id);
    updateInvestment(db, inv.id, {
      ...FD,
      fromAccountId: moved?.fromAccountId,
    });
    const buy = db
      .select()
      .from(transactions)
      .where(eq(transactions.kind, "transfer"))
      .get();
    expect(buy?.accountId).toBe(bank.id);
  });

  it("rejects tax on principal and tax above the amount", () => {
    const { db } = setup();
    const inv = createInvestment(db, FD);
    expect(() =>
      addPayout(db, inv.id, {
        kind: "maturity",
        dateKey: "2027-04-10",
        gross: 100,
        tds: 10,
      }),
    ).toThrow();
    expect(() =>
      addPayout(db, inv.id, {
        kind: "interest",
        dateKey: "2027-04-10",
        gross: 100,
        tds: 100,
      }),
    ).toThrow();
  });

  it("lists open investments by maturity, then closed ones", () => {
    const { db } = setup();
    createInvestment(db, { ...FD, name: "Late", maturityDate: "2029-01-01" });
    createInvestment(db, { ...FD, name: "No date", maturityDate: null });
    createInvestment(db, { ...FD, name: "Soon", maturityDate: "2026-12-01" });
    createInvestment(db, {
      ...FD,
      name: "Done",
      maturityDate: "2026-06-01",
      closedOn: "2026-06-01",
    });
    expect(
      listInvestments(db, "2026-11-22").map((s) => s.investment.name),
    ).toEqual(["Soon", "Late", "No date", "Done"]);
  });

  it("survives a backup and restore", () => {
    const { db, bank } = setup();
    const inv = createInvestment(db, { ...FD, fromAccountId: bank.id });
    addPayout(db, inv.id, {
      kind: "interest",
      dateKey: "2026-07-10",
      gross: 177_000,
      accountId: bank.id,
    });
    const backup = exportBackup(db, { now: 1, appVersion: "test" });
    const fresh = createTestDb();
    restoreBackup(fresh, backup);
    const detail = getInvestmentDetail(fresh, inv.id, "2026-08-01");
    expect(detail?.payouts).toHaveLength(1);
    expect(detail?.totals.interest).toBe(177_000);
  });
});
