import { byPayee, filterItems, lastMonths, monthlyFlow } from "./model";

const cat = (name: string) => ({ id: name, name });
const item = (
  kind: string,
  title: string,
  amount: number,
  dateKey: string,
  category = "Software",
  accountId = "cash",
) => ({
  kind,
  title,
  amount,
  currency: "INR",
  dateKey,
  accountId,
  category: cat(category),
  splits: [],
});
const same = (minor: number) => minor;

const items = [
  item("income", "Apify", 10000, "2026-10-26", "Business", "bank"),
  item("income", "RapidAPI", 2000, "2026-11-06", "Business", "bank"),
  item("expense", "Tikhub", 1500, "2026-10-10"),
  item("expense", "Tikhub", 500, "2026-11-04"),
  item("expense", "Evomi", 1000, "2026-11-04", "Proxies"),
  item("expense", "Income tax", 4210, "2026-11-10", "Income tax"),
];

describe("business model", () => {
  it("lists the last months oldest first across a year boundary", () => {
    expect(lastMonths("2026-02-10", 3)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("totals money in and out per month, leaving income tax out", () => {
    expect(monthlyFlow(items, ["2026-10", "2026-11"], same)).toEqual([
      { key: "2026-10", income: 10000, spent: 1500 },
      { key: "2026-11", income: 2000, spent: 1500 },
    ]);
  });

  it("groups costs by payee as a share of revenue", () => {
    const rows = byPayee(items, "expense", same);
    expect(rows.map((r) => [r.name, r.amount, r.count])).toEqual([
      ["Tikhub", 2000, 2],
      ["Evomi", 1000, 1],
    ]);
    expect(rows[0]?.share).toBeCloseTo(2000 / 12000);
  });

  it("filters by range, category, account and payee", () => {
    const all = { from: "0000-01-01", to: "9999-12-31" };
    expect(filterItems(items, { ...all, accountId: "bank" })).toHaveLength(2);
    expect(filterItems(items, { ...all, categoryId: "Proxies" })).toHaveLength(1);
    expect(filterItems(items, { ...all, payee: "tikhub" })).toHaveLength(2);
    expect(
      filterItems(items, { from: "2026-11-01", to: "2026-11-30" }),
    ).toHaveLength(4);
  });
});
