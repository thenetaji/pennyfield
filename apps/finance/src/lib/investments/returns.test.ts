import type { InvestmentRow, PayoutRow } from "@/db/schema";

import {
  earnedBy,
  estimateTax,
  expectedFlows,
  interestByMonth,
  investmentReturns,
  maturityLadder,
  tdsWarnings,
  upcomingPayouts,
  xirr,
} from "./returns";

function inv(patch: Partial<InvestmentRow> = {}): InvestmentRow {
  return {
    id: "i1",
    name: "SBI FD",
    type: "fd",
    issuer: "SBI",
    platform: "",
    reference: "",
    rating: "",
    listed: false,
    amount: 10_000_000,
    currency: "INR",
    rate: 8,
    payout: "quarterly",
    buyDate: "2026-01-01",
    maturityDate: "2027-01-01",
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
    dateKey: "2026-04-01",
    gross: 200_000,
    tds: 0,
    accountId: null,
    transactionId: null,
    note: "",
    createdAt: 0,
    ...patch,
  };
}

describe("expectedFlows", () => {
  it("pays a coupon each quarter and the principal at maturity", () => {
    const flows = expectedFlows(inv());
    expect(flows.map((f) => [f.dateKey, f.kind, f.amount])).toEqual([
      ["2026-04-01", "interest", 200_000],
      ["2026-07-01", "interest", 200_000],
      ["2026-10-01", "interest", 200_000],
      ["2027-01-01", "interest", 201_644],
      ["2027-01-01", "principal", 10_000_000],
    ]);
  });

  it("compounds a cumulative deposit quarterly", () => {
    const [interest] = expectedFlows(inv({ payout: "cumulative" }));
    // 1,00,000 at 8% compounded quarterly for 365 days ≈ ₹8,243.
    expect(interest?.amount).toBe(824_322);
  });

  it("has only the principal without a rate", () => {
    expect(expectedFlows(inv({ rate: null }))).toHaveLength(1);
    expect(expectedFlows(inv({ maturityDate: null }))).toEqual([]);
  });
});

describe("earned and accrued", () => {
  it("adds paid coupons and the days since the last one", () => {
    // Two coupons by 1 Jul plus 31 days at 8%.
    expect(earnedBy(inv(), "2026-08-01")).toBe(400_000 + 67_945);
    expect(earnedBy(inv(), "2025-12-01")).toBe(0);
  });

  it("reports interest still to come and accrued since the last payout", () => {
    const r = investmentReturns(
      inv(),
      [payout({ dateKey: "2026-04-01" }), payout({ dateKey: "2026-07-01" })],
      "2026-08-01",
    );
    expect(r.expectedInterest).toBe(801_644);
    expect(r.interestToCome).toBe(401_644);
    expect(r.accrued).toBe(67_945);
    expect(r.currentValue).toBe(10_067_945);
    expect(r.totalAtMaturity).toBe(10_801_644);
  });
});

describe("xirr", () => {
  it("finds the yearly rate of a simple one-year gain", () => {
    expect(
      xirr([
        { dateKey: "2026-01-01", amount: -100_000 },
        { dateKey: "2027-01-01", amount: 108_000 },
      ]),
    ).toBe(8);
  });

  it("matches the quoted yield for a held deposit", () => {
    const r = investmentReturns(
      inv({ closedOn: "2027-01-01" }),
      [
        payout({ dateKey: "2026-04-01" }),
        payout({ dateKey: "2026-07-01" }),
        payout({ dateKey: "2026-10-01" }),
        payout({ dateKey: "2027-01-01", gross: 201_644 }),
        payout({ dateKey: "2027-01-01", kind: "maturity", gross: 10_000_000 }),
      ],
      "2027-02-01",
    );
    // Quarterly 8% is 8.24% a year once the coupons are counted when they arrive.
    expect(r.xirr).toBeCloseTo(8.24, 1);
  });

  it("needs money both ways and at least a week", () => {
    expect(xirr([{ dateKey: "2026-01-01", amount: -1 }])).toBeNull();
    expect(
      xirr([
        { dateKey: "2026-01-01", amount: -100 },
        { dateKey: "2026-01-03", amount: 101 },
      ]),
    ).toBeNull();
  });
});

describe("planning views", () => {
  const book = [
    inv({ id: "a", maturityDate: "2026-12-15" }),
    inv({ id: "b", maturityDate: "2027-03-10", amount: 5_000_000 }),
    inv({ id: "c", maturityDate: "2029-01-01", amount: 1_000_000 }),
    inv({ id: "d", maturityDate: "2026-11-01" }),
    inv({ id: "e", maturityDate: "2026-12-01", closedOn: "2026-12-01" }),
  ];

  it("buckets money coming back by month, overdue in this month", () => {
    const ladder = maturityLadder(book, [], "2026-11-22", 6);
    expect(ladder.months[0]).toEqual({ key: "2026-11-01", amount: 10_000_000 });
    expect(ladder.months[1]).toEqual({ key: "2026-12-01", amount: 10_000_000 });
    expect(ladder.months[4]).toEqual({ key: "2027-03-01", amount: 5_000_000 });
    expect(ladder.later).toBe(1_000_000);
  });

  it("lists promised payouts in order", () => {
    const next = upcomingPayouts(book, "2026-11-22", "2026-12-31");
    expect(next.map((p) => `${p.investmentId}:${p.kind}`)).toEqual([
      "a:interest",
      "a:principal",
    ]);
  });

  it("sums interest received per month", () => {
    const months = interestByMonth(
      [
        payout({ dateKey: "2026-11-01", gross: 100 }),
        payout({ dateKey: "2026-11-20", gross: 50 }),
        payout({ dateKey: "2025-01-01", gross: 999 }),
        payout({ dateKey: "2026-10-01", kind: "maturity", gross: 7 }),
      ],
      "2026-11-22",
      3,
    );
    expect(months).toEqual([
      { key: "2026-09-01", amount: 0 },
      { key: "2026-10-01", amount: 0 },
      { key: "2026-11-01", amount: 150 },
    ]);
  });

  it("warns when one bank's interest this tax year passes ₹50,000", () => {
    const big = inv({
      id: "big",
      amount: 100_000_000,
      buyDate: "2026-04-01",
      maturityDate: "2028-04-01",
    });
    const warnings = tdsWarnings(
      [big, inv({ id: "g", type: "gsec", amount: 90_000_000 })],
      [
        payout({
          investmentId: "big",
          dateKey: "2026-07-01",
          gross: 2_000_000,
        }),
      ],
      "2026-11-22",
    );
    expect(warnings).toEqual([
      { issuer: "SBI", interest: 2_000_000 * 3, limit: 5_000_000 },
    ]);
  });
});

describe("estimateTax", () => {
  it("taxes interest at the slab and long-term gains at 12.5% plus cess", () => {
    const year = {
      startYear: 2026,
      label: "2026-27",
      from: "2026-04-01",
      to: "2027-03-31",
      interest: 100_000,
      tds: 10_000,
      gains: { short: 0, long: 100_000, unlisted: -5_000, gain: 0 },
      items: 3,
    };
    expect(estimateTax(year, "india", 31.2)).toBe(31_200 + 13_000);
  });
});
