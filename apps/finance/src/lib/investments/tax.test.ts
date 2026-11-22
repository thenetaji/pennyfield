import type { InvestmentRow, PayoutRow } from "@/db/schema";

import {
  backAfter,
  gainClass,
  investmentStatus,
  monthsHeld,
  resolveTaxRules,
  summarizeTaxYears,
  taxYearLabel,
  taxYearOf,
  taxYearRange,
  taxYearStartMonth,
} from "./tax";

function inv(patch: Partial<InvestmentRow>): InvestmentRow {
  return {
    id: "i1",
    name: "X",
    type: "bond",
    issuer: "",
    platform: "",
    reference: "",
    rating: "",
    listed: true,
    amount: 10_000,
    currency: "INR",
    rate: null,
    payout: "yearly",
    buyDate: "2026-04-01",
    maturityDate: null,
    closedOn: null,
    fromAccountId: null,
    buyTransactionId: null,
    closeTransactionId: null,
    note: "",
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

function payout(patch: Partial<PayoutRow>): PayoutRow {
  return {
    id: `p${Math.random()}`,
    investmentId: "i1",
    kind: "interest",
    dateKey: "2026-05-01",
    gross: 100,
    tds: 0,
    accountId: null,
    transactionId: null,
    note: "",
    createdAt: 0,
    ...patch,
  };
}

describe("tax years", () => {
  it("uses India's April–March year for rupees unless set otherwise", () => {
    expect(resolveTaxRules("auto", "INR")).toBe("india");
    expect(resolveTaxRules("auto", "USD")).toBe("general");
    expect(resolveTaxRules("general", "INR")).toBe("general");
    expect(taxYearStartMonth("india", 1)).toBe(4);
    expect(taxYearStartMonth("general", 7)).toBe(7);
  });

  it("puts March in the previous year and April in the next", () => {
    expect(taxYearOf("2027-03-31", 4)).toBe(2026);
    expect(taxYearOf("2027-04-01", 4)).toBe(2027);
    expect(taxYearLabel(2026, 4)).toBe("2026-27");
    expect(taxYearLabel(2099, 4)).toBe("2099-00");
    expect(taxYearLabel(2026, 1)).toBe("2026");
    expect(taxYearRange(2026, 4)).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
    });
    expect(taxYearRange(2026, 1)).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(taxYearRange(2027, 3)).toEqual({
      from: "2027-03-01",
      to: "2028-02-29",
    });
  });
});

describe("gain class", () => {
  it("follows the sheet's rules", () => {
    expect(gainClass(inv({ type: "fd" }), "india")).toBe("none");
    expect(gainClass(inv({ listed: false }), "india")).toBe("unlisted");
    expect(gainClass(inv({ closedOn: "2027-04-01" }), "india")).toBe("short");
    expect(gainClass(inv({ closedOn: "2027-04-02" }), "india")).toBe("long");
    expect(gainClass(inv({ maturityDate: "2028-01-01" }), "india")).toBe(
      "long",
    );
    expect(gainClass(inv({ listed: false }), "general")).toBe("gain");
  });

  it("measures months held like the sheet", () => {
    expect(monthsHeld("2026-04-01", "2027-04-01")).toBe(12);
  });
});

describe("summarizeTaxYears", () => {
  it("adds interest and tax by payout date and gains by closing date", () => {
    const investments = [
      inv({ id: "fd", type: "fd" }),
      inv({ id: "b1", amount: 9_800, closedOn: "2027-05-01" }),
      inv({ id: "b2", amount: 10_000, closedOn: "2027-03-01", listed: false }),
    ];
    const payouts = [
      payout({
        investmentId: "fd",
        dateKey: "2026-06-30",
        gross: 500,
        tds: 50,
      }),
      payout({
        investmentId: "fd",
        dateKey: "2027-03-31",
        gross: 500,
        tds: 50,
      }),
      payout({ investmentId: "fd", dateKey: "2027-04-01", gross: 300 }),
      payout({
        investmentId: "b1",
        kind: "maturity",
        dateKey: "2027-05-01",
        gross: 10_000,
      }),
      payout({
        investmentId: "b2",
        kind: "sale",
        dateKey: "2027-03-01",
        gross: 9_500,
      }),
    ];
    const years = summarizeTaxYears(investments, payouts, "india", 4);
    expect(years.map((y) => y.label)).toEqual(["2027-28", "2026-27"]);
    const [next, current] = years;
    expect(current).toMatchObject({ interest: 1_000, tds: 100 });
    expect(current?.gains.unlisted).toBe(-500);
    expect(next).toMatchObject({ interest: 300, tds: 0 });
    expect(next?.gains.long).toBe(200);
  });

  it("ignores deposits for gains even if more comes back", () => {
    const years = summarizeTaxYears(
      [inv({ type: "fd", closedOn: "2027-01-01" })],
      [payout({ kind: "maturity", dateKey: "2027-01-01", gross: 20_000 })],
      "india",
      4,
    );
    expect(years).toEqual([]);
  });
});

describe("status", () => {
  it("flags a missed maturity and money that is back too late", () => {
    expect(
      investmentStatus(inv({ maturityDate: "2026-11-01" }), "2026-11-22"),
    ).toBe("due");
    expect(
      investmentStatus(inv({ maturityDate: "2026-12-01" }), "2026-11-22"),
    ).toBe("open");
    expect(backAfter(inv({ maturityDate: "2028-02-01" }), "2028-01-15")).toBe(
      true,
    );
    expect(backAfter(inv({ maturityDate: "2028-01-15" }), "2028-01-15")).toBe(
      false,
    );
    expect(backAfter(inv({ maturityDate: null }), "2028-01-15")).toBe(true);
    expect(backAfter(inv({ maturityDate: "2028-02-01" }), null)).toBe(false);
  });
});
