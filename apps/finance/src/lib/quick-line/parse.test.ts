import { parseQuickLine } from "./parse";

const options = {
  accounts: [
    { id: "a1", name: "HDFC Savings" },
    { id: "a2", name: "Card" },
  ],
  categories: [{ id: "c1", name: "Food" }],
  digits: 2,
};

describe("parseQuickLine", () => {
  it("reads title, amount, account and day from one line", () => {
    expect(parseQuickLine("uber 250 card yesterday", options)).toEqual({
      title: "Uber",
      amount: 25000,
      kind: "expense",
      accountId: "a2",
      categoryId: null,
      daysAgo: 1,
    });
  });

  it("understands thousands, commas and decimals", () => {
    expect(parseQuickLine("rent 12,500", options).amount).toBe(1250000);
    expect(parseQuickLine("laptop 2.5k", options).amount).toBe(250000);
    expect(parseQuickLine("tea 19.5", options).amount).toBe(1950);
  });

  it("keeps a second number in the title", () => {
    const line = parseQuickLine("7up 40 2", options);
    expect(line.amount).toBe(4000);
    expect(line.title).toBe("7up 2");
  });

  it("uses the currency's decimals", () => {
    expect(parseQuickLine("sushi 1200", { ...options, digits: 0 }).amount).toBe(1200);
  });

  it("treats a plus sign or income word as income", () => {
    expect(parseQuickLine("salary +50000", options).kind).toBe("income");
    expect(parseQuickLine("refund 200 received", options).kind).toBe("income");
  });

  it("uses a category name as the title when nothing else is given", () => {
    const line = parseQuickLine("food 200", options);
    expect(line.categoryId).toBe("c1");
    expect(line.title).toBe("Food");
  });
});
