import type { InvestmentRow } from "@/db/schema";

import { investmentTips } from "./tips";

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
    amount: 100_000,
    currency: "INR",
    rate: null,
    payout: "yearly",
    buyDate: "2026-04-01",
    maturityDate: null,
    closedOn: null,
    fromAccountId: null,
    buyTransactionId: null,
    closeTransactionId: null,
    firstPayoutDate: null,
    couponAmount: null,
    redemptionAmount: null,
    units: null,
    faceValue: null,
    cleanPrice: null,
    accruedAtBuy: null,
    note: "",
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

const base = {
  today: "2026-11-26" as const,
  taxRate: 30,
  fmt: (m: number) => `₹${m / 100}`,
  dateLabel: (k: string) => k,
};

describe("investmentTips", () => {
  it("flags low ratings but not A grades", () => {
    const tips = investmentTips({
      ...base,
      investments: [
        inv({ id: "a", name: "A bond", rating: "aa+", issuer: "P" }),
        inv({ id: "b", name: "B bond", rating: " bbb- ", issuer: "Q" }),
      ],
    });
    expect(tips.filter((t) => t.id.startsWith("rating:")).map((t) => t.id)).toEqual(["rating:b"]);
  });

  it("flags an issuer holding over 40%", () => {
    const tips = investmentTips({
      ...base,
      investments: [
        inv({ id: "a", issuer: "Big", amount: 70_000 }),
        inv({ id: "b", issuer: "Small", amount: 30_000 }),
      ],
    });
    expect(tips[0]).toMatchObject({ id: "issuer:Big", tone: "warning", title: "70% is with Big" });
  });

  it("explains a premium and a discount", () => {
    const tips = investmentTips({
      ...base,
      investments: [
        inv({ id: "p", units: 10, faceValue: 100_000, cleanPrice: 101_000 }),
        inv({ id: "d", units: 10, faceValue: 100_000, cleanPrice: 99_000 }),
      ],
    });
    expect(tips.find((t) => t.id === "premium:p")?.title).toBe("Paid ₹100 above face value");
    expect(tips.find((t) => t.id === "discount:d")?.tone).toBe("good");
  });

  it("asks for a slab, orders by tone and skips closed rows", () => {
    const tips = investmentTips({
      ...base,
      taxRate: null,
      investments: [
        inv({ id: "c", closedOn: "2026-10-01", rating: "D" }),
        inv({ id: "m", maturityDate: "2026-12-10", rating: "BB" }),
      ],
    });
    expect(tips.map((t) => t.id)).toEqual(["rating:m", "slab", "maturing:m"]);
    expect(tips[1].action).toBe("slab");
  });
});
