import type { AccountWithBalance } from "@/data/hooks";
import { makeRateLookup } from "@studio/money";

import { balanceCorrection, correctionCategory, totalInDisplay } from "./model";

const account = (name: string, currency: string, balance: number) =>
  ({ id: name, name, currency, balance }) as unknown as AccountWithBalance;

describe("totalInDisplay", () => {
  const rates = makeRateLookup([{ base: "USD", quote: "INR", rate: 80 }]);
  it("converts accounts that have a rate", () => {
    const { total, excluded } = totalInDisplay(
      [account("Cash", "INR", 10000), account("Wise", "USD", 100)],
      { displayCurrency: "INR", rates },
    );
    expect(total).toBe(10000 + 8000);
    expect(excluded).toEqual([]);
  });
  it("excludes accounts with no rate instead of adding them unconverted", () => {
    const { total, excluded } = totalInDisplay(
      [account("Cash", "INR", 10000), account("Euro", "EUR", 100)],
      { displayCurrency: "INR", rates },
    );
    expect(total).toBe(10000);
    expect(excluded.map((a) => a.name)).toEqual(["Euro"]);
  });
});

describe("count balance", () => {
  it("records the gap as spending or income, nothing when it matches", () => {
    expect(balanceCorrection(200000, 120000)).toEqual({
      kind: "expense",
      amount: 80000,
    });
    expect(balanceCorrection(100, 150)).toEqual({ kind: "income", amount: 50 });
    expect(balanceCorrection(100, 100)).toBeNull();
  });

  it("files it under Other for the kind", () => {
    const cats = [
      { id: "food", kind: "expense", name: "Food", archivedAt: null },
      { id: "other", kind: "expense", name: "Other", archivedAt: null },
      { id: "oi", kind: "income", name: "Other income", archivedAt: null },
    ];
    expect(correctionCategory(cats, "expense")).toBe("other");
    expect(correctionCategory(cats, "income")).toBe("oi");
  });
});
