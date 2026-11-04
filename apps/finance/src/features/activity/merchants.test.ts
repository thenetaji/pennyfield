import { makeRateLookup } from "@studio/money";
import type { TransactionListItem } from "@/data/hooks";
import { merchantTotals } from "./merchants";

const ctx = {
  displayCurrency: "INR",
  rates: makeRateLookup([{ base: "USD", quote: "INR", rate: 80 }]),
};
let seq = 0;
const tx = (
  title: string,
  amount: number,
  dateKey: string,
  extra: Partial<TransactionListItem> = {},
) =>
  ({
    id: `t${++seq}`,
    kind: "expense",
    title,
    amount,
    currency: "INR",
    dateKey,
    categoryId: "software",
    splits: [],
    ...extra,
  }) as unknown as TransactionListItem;

describe("merchantTotals", () => {
  it("combines spellings of one merchant and converts currencies", () => {
    const out = merchantTotals(
      [
        tx("Tikhub", 50000, "2026-11-01"),
        tx("TIKHUB API", 30000, "2026-11-03"),
        tx("tikhub.io", 100, "2026-11-04", { currency: "USD" }),
        tx("Swiggy", 20000, "2026-11-02", { categoryId: "food" }),
        tx("", 5000, "2026-11-02"),
      ],
      "expense",
      ctx,
    );
    expect(out.map((m) => [m.key, m.title, m.amount, m.count])).toEqual([
      ["tikhub", "tikhub.io", 88000, 3],
      ["swiggy", "Swiggy", 20000, 1],
    ]);
    expect(out[0]).toMatchObject({
      average: 29333,
      percent: 78,
      lastDate: "2026-11-04",
      categoryId: "software",
    });
  });

  it("only counts the requested kind", () => {
    const out = merchantTotals(
      [
        tx("Acme", 1000, "2026-11-01", { kind: "income" }),
        tx("Acme", 500, "2026-11-02"),
      ],
      "income",
      ctx,
    );
    expect(out).toEqual([
      expect.objectContaining({
        key: "acme",
        amount: 1000,
        count: 1,
        percent: 100,
      }),
    ]);
  });
});
