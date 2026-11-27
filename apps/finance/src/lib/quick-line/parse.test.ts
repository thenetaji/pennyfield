import { parseQuickLine, type QuickLineMemory } from "./parse";
import { guessCategories } from "./guess";

const options = {
  accounts: [
    { id: "a1", name: "HDFC Savings" },
    { id: "a2", name: "Card" },
  ],
  categories: [
    { id: "c1", name: "Food", kind: "expense" as const },
    { id: "c2", name: "Transport", kind: "expense" as const },
    { id: "c3", name: "Salary", kind: "income" as const },
  ],
  people: [{ id: "p1", name: "Rahul Shah" }],
  memory: [] as QuickLineMemory[],
  digits: 2,
  today: "2026-11-27", // a Friday
};

describe("parseQuickLine", () => {
  it("reads title, amount, account and day from one line", () => {
    expect(parseQuickLine("uber 250 card yesterday", options)).toEqual({
      title: "Uber",
      amount: 25000,
      kind: "expense",
      accountId: "a2",
      categoryId: "c2",
      daysAgo: 1,
      personId: null,
      personName: null,
      splitCount: 1,
      memo: "",
      categorySource: "keyword",
      accountSource: "said",
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

  it("reads dictated amounts", () => {
    const amount = (t: string) => parseQuickLine(t, { ...options, digits: 0 }).amount;
    expect(amount("Spent Rs. 250 on tea.")).toBe(250);
    expect(amount("chai 250 rupees")).toBe(250);
    expect(amount("tea two fifty")).toBe(250);
    expect(amount("two hundred and fifty for tea")).toBe(250);
    expect(amount("fifteen hundred on shoes")).toBe(1500);
    expect(amount("rent 1.5 lakh")).toBe(150000);
    expect(amount("Paid ₹1,200 for dinner")).toBe(1200);
  });

  it("reads days", () => {
    const days = (t: string) => parseQuickLine(t, options).daysAgo;
    expect(days("tea 20 day before yesterday")).toBe(2);
    expect(days("tea 20 3 days ago")).toBe(3);
    expect(days("tea 20 on friday")).toBe(0);
    expect(days("tea 20 last friday")).toBe(7);
    expect(days("tea 20 monday")).toBe(4);
    expect(days("tea 20 on 12th")).toBe(15);
    expect(days("tea 20 12 nov")).toBe(15);
    expect(days("tea 20 25/12")).toBe(337);
    expect(parseQuickLine("tea 12", options).daysAgo).toBe(0);
  });

  it("reads lending", () => {
    const lent = parseQuickLine("lent 500 to rahul", options);
    expect([lent.kind, lent.personId, lent.categoryId, lent.title]).toEqual(["lent", "p1", null, ""]);
    const borrowed = parseQuickLine("Borrowed 500 from Amit", options);
    expect([borrowed.kind, borrowed.personId, borrowed.personName]).toEqual(["borrowed", null, "Amit"]);
    expect(parseQuickLine("gave rahul 500 loan", options).kind).toBe("lent");
  });

  it("splits a bill", () => {
    const line = parseQuickLine("dinner 1200 split with amit and riya", { ...options, digits: 0 });
    expect([line.amount, line.splitCount, line.memo, line.title]).toEqual([
      400, 3, "Split 1200 with Amit and Riya", "Dinner",
    ]);
    const ways = parseQuickLine("split 900 three ways", { ...options, digits: 0 });
    expect([ways.amount, ways.splitCount]).toEqual([300, 3]);
  });

  it("falls back to saved history, then keywords", () => {
    const memory: QuickLineMemory[] = [
      { titleNorm: "gym", title: "Gym", kind: "expense", categoryId: "c2", accountId: "a1", lastAmount: null, useCount: 3 },
    ];
    const line = parseQuickLine("gym 900", { ...options, memory });
    expect([line.categoryId, line.categorySource, line.accountId, line.accountSource]).toEqual(["c2", "history", "a1", "history"]);
    expect(guessCategories("swiggy", "expense", options)).toEqual(["c1"]);
    expect(parseQuickLine("salary 5000", options).categoryId).toBe("c3");
  });
});
